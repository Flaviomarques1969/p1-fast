const device = document.getElementById('device');
const alertBloco = document.getElementById('alertBloco');
const alertMsg = document.getElementById('alertMsg');
const btnAuto = document.getElementById('btnAuto');
const btnComm = document.getElementById('btnComm');
const btnGrave = document.getElementById('btnGrave');
const btnHide = document.getElementById('btnHide');

let autoTimer = null;
let commTimer = null;

function setMessage(tipo){
  alertBloco.dataset.tipo = tipo;
  if(tipo === 'comunicacao'){
    alertMsg.textContent = 'Pneu DD acima da janela';
  } else if(tipo === 'grave'){
    alertMsg.textContent = 'Pressão óleo crítica';
  }
  device.dataset.msgState = 'ativa';
  if(commTimer) clearTimeout(commTimer);
  if(tipo === 'comunicacao'){
    commTimer = setTimeout(() => {
      device.dataset.msgState = 'oculta';
    }, 4000);
  }
}
function hideMessage(){
  if(commTimer) clearTimeout(commTimer);
  device.dataset.msgState = 'oculta';
}
function clearActive(){
  [btnAuto, btnComm, btnGrave, btnHide].forEach(b => b.classList.remove('is-active'));
}
function startAutoLoop(){
  if(autoTimer) clearInterval(autoTimer);
  let phase = 0; // 0=oculto, 1=comunicacao, 2=oculto, 3=grave
  const tick = () => {
    phase = (phase + 1) % 4;
    if(phase === 1) setMessage('comunicacao');
    else if(phase === 3) setMessage('grave');
    else hideMessage();
  };
  tick();
  autoTimer = setInterval(tick, 5000);
}
function stopAutoLoop(){
  if(autoTimer) clearInterval(autoTimer);
  autoTimer = null;
}

btnAuto.addEventListener('click', () => {
  if(autoTimer){
    stopAutoLoop();
    btnAuto.classList.remove('is-active');
  } else {
    clearActive();
    btnAuto.classList.add('is-active');
    startAutoLoop();
  }
});
btnComm.addEventListener('click', () => {
  stopAutoLoop();
  clearActive();
  btnComm.classList.add('is-active');
  setMessage('comunicacao');
});
btnGrave.addEventListener('click', () => {
  stopAutoLoop();
  clearActive();
  btnGrave.classList.add('is-active');
  setMessage('grave');
});
btnHide.addEventListener('click', () => {
  stopAutoLoop();
  clearActive();
  btnHide.classList.add('is-active');
  hideMessage();
});

// Botões de halo — também trocam a semântica do delta + frase + apex pra coerência
const infoDelta = document.querySelector('.info__delta');
const infoAcao = document.querySelector('.info__acao');
const apexEntrada = document.querySelector('.apex__ponto:nth-child(1)');
const apexEntradaVal = apexEntrada.querySelector('.apex__valor');
const apexFreio = document.querySelector('.apex__ponto[data-papel="freio"]');
const apexFreioVal = apexFreio.querySelector('.apex__valor');

// Freio: distância (m) do ponto que começou a frear até o ponto geográfico
// do ápice. Referência = distância que produziu MAIOR velocidade no ápice
// (histórico por autódromo + carro). Cor verde se atual ∈ ref ± 10%, vermelho fora.
const FREIO_REF = 16; // referência histórica desse autódromo + carro (m)
function freioEstadoFromAtual(atual, ref){
  const tolerance = ref * 0.10;
  return Math.abs(atual - ref) <= tolerance ? 'ok-melhor' : 'ok-pior';
}

const haloStates = {
  'neutro':         {deltaClass:'erro', deltaVal:'0.42', acaoText:'FREIE TARDE', acaoClass:'erro',
                     entradaEstado:'ok-pior',   entradaVal:'88', freioAtual:18},
  'recorde-stint':  {deltaClass:'bom',  deltaVal:'0.27', acaoText:'ÁPICE TARDE', acaoClass:'',
                     entradaEstado:'ok-melhor', entradaVal:'95', freioAtual:15},
  'pior-stint':     {deltaClass:'erro', deltaVal:'0.42', acaoText:'FREIE TARDE', acaoClass:'erro',
                     entradaEstado:'ok-pior',   entradaVal:'88', freioAtual:22},
};

document.querySelectorAll('[data-halo]').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('[data-halo]').forEach(x => x.classList.remove('is-active'));
    b.classList.add('is-active');
    const halo = b.dataset.halo;
    device.dataset.trechoStatus = halo;
    const s = haloStates[halo];
    if(!s) return;
    infoDelta.className = 'info__delta ' + s.deltaClass;
    infoDelta.textContent = s.deltaVal;
    infoAcao.className = 'info__acao ' + s.acaoClass;
    infoAcao.textContent = s.acaoText;
    apexEntrada.dataset.estado = s.entradaEstado;
    apexEntradaVal.innerHTML = s.entradaVal + '<small>km/h</small>';
    apexFreio.dataset.estado = freioEstadoFromAtual(s.freioAtual, FREIO_REF);
    apexFreioVal.innerHTML = s.freioAtual + '<span class="apex__valor__sep">/</span>' + FREIO_REF + '<small>m</small>';
  });
});

// boot — começar com auto-loop ligado pra demonstração
btnAuto.classList.add('is-active');
startAutoLoop();

/* SMART SHIFT LIGHT — visual-only (capacete+escapamento descartam áudio).
   Modelo: níveis 0-6 (subida par-a-par) + fire (strobe) + overrev (erro).
   FIRE = 3 pulsos brancos a ~10Hz (sweet spot da detecção periférica)
          + flash sincronizado do device inteiro (rim+top) pra captura periférica.
   Auto-cycle: 0→1→2→3→4→5→6→FIRE→OVERREV→0, dwell por step. */
const shiftLight = document.getElementById('shiftLight');
const shiftDots = shiftLight.querySelectorAll('.shift-light__dot');
const shiftButtons = document.querySelectorAll('[data-shift]');

const SHIFT_SEQUENCE = [
  {state:'0',       dwell:500},
  {state:'1',       dwell:360},
  {state:'2',       dwell:360},
  {state:'3',       dwell:360},
  {state:'4',       dwell:360},
  {state:'5',       dwell:360},
  {state:'6',       dwell:160},
  {state:'fire',    dwell:300},
  {state:'overrev', dwell:800},
];

let shiftAutoTimer = null;

function setShiftLevel(level){
  if(level === 'overrev'){
    shiftLight.dataset.state = 'overrev';
    device.dataset.shiftFire = 'idle';
    shiftDots.forEach(d => d.classList.remove('is-on'));
    return;
  }
  if(level === 'fire'){
    shiftLight.dataset.state = 'fire';
    shiftDots.forEach(d => d.classList.remove('is-on'));
    // re-trigger device flash animation: toggle off then on no próximo frame
    device.dataset.shiftFire = 'idle';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { device.dataset.shiftFire = 'active'; });
    });
    return;
  }
  shiftLight.dataset.state = 'lit';
  device.dataset.shiftFire = 'idle';
  const lvl = Number(level) || 0;
  shiftDots.forEach(d => {
    const tier = Number(d.dataset.tier);
    d.classList.toggle('is-on', tier <= lvl);
  });
}
function startShiftAutoCycle(){
  if(shiftAutoTimer) clearTimeout(shiftAutoTimer);
  let i = 0;
  const step = () => {
    setShiftLevel(SHIFT_SEQUENCE[i].state);
    shiftAutoTimer = setTimeout(() => {
      i = (i + 1) % SHIFT_SEQUENCE.length;
      step();
    }, SHIFT_SEQUENCE[i].dwell);
  };
  step();
}
function stopShiftAutoCycle(){
  if(shiftAutoTimer) clearTimeout(shiftAutoTimer);
  shiftAutoTimer = null;
}
function setShiftButtonActive(target){
  shiftButtons.forEach(b => b.classList.toggle('is-active', b === target));
}
shiftButtons.forEach(b => {
  b.addEventListener('click', () => {
    const mode = b.dataset.shift;
    setShiftButtonActive(b);
    if(mode === 'auto'){
      startShiftAutoCycle();
    } else {
      stopShiftAutoCycle();
      setShiftLevel(mode);
    }
  });
});

// boot — auto-cycle do shift light pra mostrar a progressão completa
startShiftAutoCycle();

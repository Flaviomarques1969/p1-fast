# AUDITORIA COM EVIDÊNCIA — as funções rodam mesmo na volta de 2:39? (22/06/2026)

Pedido: "audite com evidências se as funções estão realmente rodando utilizando a volta de 2:39".
Método: falsificação — para cada função, mostrar que a SAÍDA muda quando o DADO muda (se fosse número
fixo, não mudaria). Comando: `dotnet run --project P1Fast.Cockpit.SessaoReplay -- --auditoria`.

## 0. Procedência do dado (é a sessão real, não simulação)
- Arquivo: `.claude-exec/dados-pista/sessao-2026-06-21-1140-brasilia-COMPLETA.json` (16 MB)
- sha256: 5bac02ea841d5268c1b92aa0bb82cc39f219a07a61496789fd21d8781e182256
- `sim = False` (NÃO é simulação), id `sessao-2026-06-21T14-40-01-885Z`, 18,6 min, 1.942 amostras de
  motor + 27.310 de GPS.
- A volta de 2:39 é REAL: detector oficial de linha de chegada de Brasília → volta 2 = **2:39.60**
  (a volta 1, 3:14.95, é a saída/aquecimento).

## 1. Veredicto por função (evidência da rodada real)
| Função | Entrada real | Falsificação (muda com o dado?) | Veredicto |
|---|---|---|---|
| Luz de marcha | rpm pico real 5912 → Lit nível 6 | +400 → Overrev; 0 → Off | REAL (computa do rpm) |
| Alertas | água 55°C, rpm 5912 → nenhum | mesma amostra com água 85 → MOTOR QUENTE | REAL (lê a água) |
| Bolinha/ápice | lat −15.77310 lng −47.90044 (Brasília), raio 9,5m | longe = 16m, em cima = 0m | REAL (GPS de Brasília) |
| Em qual curva | GPS real → 8 de 8 curvas | GPS 5 km fora da pista → 0 curvas | REAL (geometria de Brasília) |
| Delta + coach | 2ª volta vs 1ª → RECORDE/BUSCAR LIMITE/MANTEVE (5 frases reais) | 10% + rápido → −1,88s; 10% + lento → +2,44s | REAL (compara velocidade) |

Bateria de testes automáticos: 256 (1 falha pré-existente PAN_04, vírgula no Mac). Cérebro compila 0/0.

## 2. O QUE É HONESTO DIZER (limites, sem maquiar)
- **As funções consomem a sessão inteira em movimento (3.499 pontos = as 2 voltas), não só o trecho
  isolado de 2:39.** A volta de 2:39 É usada — ela é a 2ª passagem (a mais rápida); o coach compara
  cada curva da 2ª volta com a 1ª (a referência). Por isso saiu "RECORDE": a 2ª volta foi mais rápida.
- **A frase "FREOU CEDO" mostrada no Incremento 4 era SIMULADA** (eu desacelerei a passagem de
  propósito, porque naquele momento eu olhava 1 curva só). NÃO era real. O coach REAL (sem simulação)
  é o do capstone: RECORDE / BUSCAR LIMITE / MANTEVE LINHA (2ª volta vs 1ª).
- **Campos que o aparelho não capturou viram "sem dado", não 0:** óleo (sensor ausente), EGT, marcha,
  erro de ECU não existem na captura T3000 desta sessão — as funções auditadas usam só os campos REAIS
  (rpm, água, lambda, bateria, bit de óleo).
- **Piso de ruído do delta ≈ 0,061s:** comparar uma passagem com ela mesma (velocidade variando) NÃO dá
  exatamente zero, por uma assimetria do cálculo aprovado (atual usa a média do par, referência usa o
  ponto). É fiel ao JS original; o efeito prático é que diferenças abaixo de ~0,06s não são confiáveis.
- **A bolinha auditada (raio 9,5m) é a curva mais fechada do trajeto em movimento** (1 ponto real de
  Brasília). As 8 curvas da segmentação usam os ápices do arquivo aprovado das barras (reais).
- **A TELA em si (WinUI) NÃO foi executada** — isto audita o CÉREBRO rodando sobre o dado real (no Mac).
  A tela acendendo só prova no notebook Windows.

## 3. Conclusão
As 5 funções rodam de verdade sobre o dado real da sessão de domingo (que contém a volta de 2:39), e
cada uma reage ao dado (falsificação confirmada). Os pontos simulados/padrão estão listados acima, sem
esconder. O que falta de prova é só a parte VISUAL (tela) e o empacotamento — no Windows.

## 4. DEMONSTRAÇÃO VISUAL (22/06)
- `relatorios/cockpit-piloto-2-39.html` + `relatorios/dados/fita-cockpit-2-39.js` (3.286 quadros).
- A fita foi gerada pelo MAESTRO em C# (as MESMAS funções auditadas) processando a sessão real
  (motor + GPS por tempo): `dotnet run --project P1Fast.Cockpit.SessaoReplay -- --exportar-tela=...`.
- A tela HTML só DESENHA a fita (visual idêntico ao MainWindow.xaml nativo). Conteúdo real: 1.539
  quadros com luz acesa (giro até 5.912), 1.429 dentro de curva (as 8), coach (RECORDE/MANTEVE/BUSCAR
  LIMITE) e alertas (mistura). Abre na 1ª curva; botões tocar/velocidade/próxima curva.
- HONESTO: é o visual do cockpit (web) movido pelo cérebro REAL; o .exe nativo mostra a MESMA imagem,
  mas só renderiza no Windows. Nada aqui é simulado — vem da fita do dado real.

## 5. ACHADO GRAVE (exigência "nada falso" do Flávio) — motor parou antes da volta de 2:39
- O motor (injeção T3000) gravou até tWall 1782053674844. A volta de 2:39 (volta 2, entre o 2º e 3º
  cruzamento da chegada) é [1782053697825, 1782053857468] — começa **23 s DEPOIS** de o motor parar.
- **0 amostras de motor na volta de 2:39.** A luz de marcha/rotação que aparecia nela era VELHA (stale) = falsa.
- A volta ANTERIOR (3:14, volta 1) tem **172 amostras de motor + GPS** = a única com tudo real.
- CONSERTO: export passou a APAGAR a luz e deixar a rotação em branco quando não há motor vivo
  (mVivo = amostra de motor < 2 s). Duas telas geradas, ambas 100% reais:
  - relatorios/cockpit-volta-3-14-completa.html (motor + GPS — tudo real, luz acesa).
  - relatorios/cockpit-volta-2-39-so-gps.html (só GPS — velocidades/curvas/delta/stint reais; luz APAGADA + "motor: sem dado").
- Também consertados nesta rodada: barra de stint (era fixa da demo → agora resultado real por curva) e os
  pontinhos de sinal (eram fixos com "alerta" falso → agora ligam só motor/GPS vivos de verdade).
- Este é EXATAMENTE o problema que o trabalho de gravação combate: a captura do motor caiu no meio da sessão.

  function linhasTrechos(s){
    var tr = s.trechos, at = s.voltaAtual, ult = s.ultimaVolta, l = [];
    if(!tr) return l;
    if(tr.erro){ l.push('trechos — cadastro da pista com problema'); return l; }
    if(!tr.lista.length) return l;
    var i = at && at.trechoAtual ? at.trechoAtual - 1 : null;
    if(i != null && tr.lista[i]){
      var m = ult && ult.trechos ? ult.trechos[i] : null;
      l.push('trecho <b>' + esc(tr.lista[i].nome) + '</b> ' + (i + 1) + '/' + tr.lista.length
        + ' · última <b>' + fmtS(m && m.tempoS) + '</b> · melhor <b>' + fmtS(tr.melhoresS[i]) + '</b>'
        + (m && m.kmhMin != null ? ' · mín <b>' + Math.round(m.kmhMin) + '</b>' : ''));
    }
    if(tr.perdasUltima.length) l.push('a última perdeu: ' + tr.perdasUltima.map(function(p){
      return '<b>' + esc(p.nome) + '</b> <span class="perdeu">+' + p.difS.toFixed(2).replace('.', ',') + '</span>'; }).join(' · '));
    if(tr.voltaIdealS != null) l.push('ideal pelos trechos <b>' + fmt(tr.voltaIdealS) + '</b>');
    return l;
  }

  function desenharConsistencia(ui, s){
    var k = s.consistencia, pc = s.pancadas, l = [];
    if(k) l.push('consistência <b>±' + k.desvioS.toFixed(2).replace('.', ',') + ' s</b> · amplitude <b>'
      + k.amplitudeS.toFixed(2).replace('.', ',') + ' s</b> · ' + k.nVoltas + ' voltas',
      'mais longe da média: <b>V' + k.voltaMaisFora.n + ' ' + (k.voltaMaisFora.difS >= 0 ? '+' : '−')
      + Math.abs(k.voltaMaisFora.difS).toFixed(2).replace('.', ',') + ' s</b>');
    else l.push('consistência — (precisa de 2 voltas)');
    var ult = s.ultimaVolta;
    l.push('pancadas <b>' + (s.voltaAtual ? pc.volta.length : 0) + '</b> nesta volta'
      + (ult && ult.pancadas != null ? ' · <b>' + ult.pancadas + '</b> na última' : '')
      + (pc.lugaresRepetidos.length ? ' · <b>' + pc.lugaresRepetidos.length + '</b> lugar(es) repetido(s)' : ''));
    var tr = s.trocas;
    if(tr && tr.total) l.push('trocas (provável) <b>' + (s.voltaAtual ? tr.volta.length : 0) + '</b> nesta volta'
      + (ult && ult.trocas != null ? ' · <b>' + ult.trocas + '</b> na última' : '')
      + (ult && ult.trocaBuracoMedioS != null ? ' · buraco <b>' + ult.trocaBuracoMedioS.toFixed(2).replace('.', ',') + ' s</b>' : ''));
    var ts = s.traseira;
    if(ts && ts.temGiro) l.push('traseira (provável · giro a conferir) <b>' + (s.voltaAtual ? ts.volta.length : 0) + '</b> nesta volta'
      + (ult && ult.traseira != null ? ' · <b>' + ult.traseira + '</b> na última' : '')
      + (ts.sinalAprendido ? '' : ' · aprendendo o giro nas curvas'));
    var lt = linhasTrechos(s);
    ui.cons.innerHTML = l.join('<br>') + (lt.length ? '<br><span data-tv-trechos>' + lt.join('<br>') + '</span>' : '');
  }


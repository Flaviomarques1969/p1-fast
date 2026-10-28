  // linha do trecho e "a última perdeu", na coluna ao lado do mapa (curtas: a coluna é estreita)
  function linhasTrechos(s){
    var tr = s.trechos, at = s.voltaAtual, ult = s.ultimaVolta, l = [];
    if(!tr) return l;
    if(tr.erro){ l.push('trechos — cadastro da pista com problema'); return l; }
    if(!tr.lista.length) return l;
    var i = at && at.trechoAtual ? at.trechoAtual - 1 : null;
    if(i != null && tr.lista[i]){
      var m = ult && ult.trechos ? ult.trechos[i] : null;
      l.push('trecho <b>' + esc(tr.lista[i].nome) + '</b> ' + (i + 1) + '/' + tr.lista.length);
      l.push('últ <b>' + fmtS(m && m.tempoS) + '</b> · mel <b>' + fmtS(tr.melhoresS[i]) + '</b>'
        + (m && m.kmhMin != null ? ' · mín <b>' + Math.round(m.kmhMin) + '</b>' : ''));
    }
    if(tr.perdasUltima.length){ var p = tr.perdasUltima[0];
      l.push('perdeu <b>' + esc(p.nome) + '</b> <span class="perdeu">+' + p.difS.toFixed(2).replace('.', ',') + '</span>'); }
    return l;
  }

  // contagens da volta (nesta / última); a consistência do stint foi para o bloco do stint
  function desenharConsistencia(ui, s){
    var pc = s.pancadas, ult = s.ultimaVolta, at = s.voltaAtual, c = [];
    function par(nome, agora, ultima){ return '<div class="ln"><span>' + nome + '</span><span><b>' + agora + '</b> <span class="ap">/</span> <b>'
      + (ultima == null ? '—' : ultima) + '</b></span></div>'; }
    c.push(par('pancadas', at ? pc.volta.length : 0, ult && ult.pancadas));
    if(pc.lugaresRepetidos.length) c.push('<div class="ln"><span>repetidas</span><span><b>' + pc.lugaresRepetidos.length + '</b> lugar' + (pc.lugaresRepetidos.length > 1 ? 'es' : '') + '</span></div>');
    var tr = s.trocas;
    if(tr && tr.total) c.push(par('trocas', at ? tr.volta.length : 0, ult && ult.trocas));
    var ts = s.traseira;
    if(ts && ts.temGiro) c.push(par('traseira', at ? ts.volta.length : 0, ult && ult.traseira));
    c.push('<div class="ln ap"><span>nesta / última</span><span>provável</span></div>');
    ui.cont.innerHTML = c.join('');
    var lt = linhasTrechos(s);
    ui.cons.innerHTML = lt.map(function(x){ return '<div style="overflow:hidden;text-overflow:ellipsis">' + x + '</div>'; }).join('');
    ui.cons.style.display = lt.length ? '' : 'none';
  }


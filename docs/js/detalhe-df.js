/* ══ Detalhe do documento fiscal — abas no topo (pacote AV-DF) ═══════════════
   Proposta aprovada em 10/11/2026 (docs/proposta-detalhe-df.html v1.2, R-303):
   a estrutura A, com os ajustes pedidos na revisão dos mockups.

   detalhe_df_abas  A coluna da direita vira só abas, presas no topo, e o
                    detalhe abre sempre na Partição (D-DF-05). As abas:
                    Partição · Alertas (D-DF-06) · Eventos e ajustes (D-DF-02
                    a 04) · Histórico, sem a situação e com os dois filtros
                    (D-DF-07) · Apuração por tributo · Linha do tempo.
                    Vale para todo documento: entrada e saída, com e sem
                    partição. No celular, a coluna do documento vira um
                    bloco recolhido acima das abas.

   Os módulos que já punham coisas no detalhe continuam donos do conteúdo:
   o AV-EV preenche o quadro de ajustes ([data-evf-slot]) e o AV-E2, a tabela
   de eventos, agora compacta, e a linha do tempo ([data-evl-slot]). Com a
   flag desligada, o detalhe de sempre fica como está, para comparar.
   ═══════════════════════════════════════════════════════════════════════════ */
/* @pacote — o estado das flags é reescrito por tools/avaliacao.py promover */
window.shFeature && shFeature.registrar({"id": "AV-DF", "nome": "Detalhe do documento fiscal — abas no topo", "branch": "feat/detalhe-df", "entrada": "#/creditos/dfs", "flags": {"detalhe_df_abas": "aprovada"}, "rotulos": {"detalhe_df_abas": "Detalhe do DF com abas no topo: Partição, Alertas, Eventos e ajustes, Histórico, Apuração e Linha do tempo"}});
/* @fim-pacote */
(function () {
  'use strict';

  var X = window.shDetalhe = window.shDetalhe || {};
  function on() { return !window.shFeature || shFeature.ligada('detalhe_df_abas'); }
  X.abasTopo = on;

  (function () {
    if (document.getElementById('dfa-css')) return;
    var l = document.createElement('link');
    l.id = 'dfa-css'; l.rel = 'stylesheet'; l.href = 'css/detalhe-df.css?v=1';
    document.head.appendChild(l);
  })();

  var ORG = { cbs: 'Receita Federal', ibs: 'Comitê Gestor', doc: 'Documento' };
  var GRUPOS = [
    ['acao', 'Exigem ação', 'Ocorrências abertas e prazos que correm: alguém precisa analisar e decidir.'],
    ['acomp', 'Em acompanhamento', 'O SplitHub está resolvendo sozinho, ou espera o órgão. Vira ação se não resolver.'],
    ['info', 'Informativos', 'Situações normais do ciclo que vale saber.']
  ];
  function p() { return X._p; }
  function desdeTxt(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'number') { var d = new Date(v); return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); }
    return /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? p().br(v) : String(v);
  }
  function rotTipo(i) { return (window.IncCatalogo && IncCatalogo.label ? IncCatalogo.label(i.tipo) : null) || i.tipoLabel || i.tipo; }

  /* ── aba Alertas: o que pede atenção, organizado ─────────────────────── */
  // Três fontes: a situação do ciclo (X.situacao), as ocorrências da família I
  // do documento e os alertas de competência (D-14). Uma linha por tributo.
  function itens(nf, s) {
    var P = p(), L = [], vistos = {};
    s.alertas.forEach(function (a) {
      if (a.card) vistos[a.card.id] = 1;
      L.push({ sev: a.grupo || 'acomp', trib: a.trib || 'doc', tit: a.tit || a.titulo, valor: a.valor, det: a.det, desde: a.desde, orig: a.orig, card: a.card,
        ev: a.card && /^evt_/.test(a.card.tipo) ? a.card.evento || null : null, hist: true });
    });
    (window._inconsistenciasGlobal || []).forEach(function (i) {
      if (!/^evt_/.test(i.tipo) || String(i.nfNumero) !== String(nf.numero) || vistos[i.id] || P.stCard(i) === 'resolvida') return;
      var t = String(i.tipoFiscal || '').toLowerCase(); if (t !== 'cbs' && t !== 'ibs') t = 'doc';
      vistos[i.id] = 1;
      L.push({ sev: 'acao', trib: t, tit: rotTipo(i), valor: i.valor, det: i.detalhe || i.resumo, desde: i.dataISO, orig: 'Órgão', card: i, ev: i.evento || null, hist: false });
    });
    if (window.shEvmL2 && shEvmL2._alertas) {
      try {
        shEvmL2._alertas().forEach(function (a) {
          if (String(a.ev.nf) !== String(nf.numero) || !a.s || a.s.estado === 'resolvido') return;
          Object.keys(a.val).filter(function (T) { return a.val[T].st === 'pesa'; }).forEach(function (T) {
            L.push({ sev: a.s.estado === 'aberto' ? 'acao' : 'acomp', trib: T.toLowerCase(), tit: 'Efeito confirmado depois do fechamento', valor: Math.abs(a.val[T].v || 0),
              det: 'O ' + a.ev.cod + ' (' + a.ev.id + ') foi confirmado depois do fechamento da competência ' + a.P.slice(5) + '/' + a.P.slice(0, 4) + '. Nada reabre sozinho.',
              desde: a.ev.trib[T] && a.ev.trib[T].exec, orig: 'SplitHub', alerta: a.id, ev: a.ev.id, hist: false });
          });
        });
      } catch (e) { console.error('[AV-DF] alertas de competência', e); }
    }
    s.info.forEach(function (x) { L.push({ sev: 'info', trib: x.trib || 'doc', tit: x.txt }); });
    return L;
  }
  // a situação marca os eventos (alerta, card) e pula os já marcados: limpar antes de cada leitura
  function situacao(c) {
    c.evs.forEach(function (e) { delete e.alerta; delete e.card; });
    return X.situacao(c.nf, c.rfs, c.evs);
  }
  function nAcao(L) { return L.filter(function (a) { return a.sev !== 'info'; }).length; }
  function rotAlertas(L) { var n = nAcao(L); return 'Alertas' + (n ? '<span class="dfa-bd" title="exigem ação ou estão em acompanhamento">' + n + '</span>' : ''); }
  function cartao(a) {
    var P = p(), esc = P.esc;
    var meta = [a.desde ? 'Desde ' + desdeTxt(a.desde) : '', a.orig ? 'origem ' + a.orig : ''].filter(Boolean).join(' · ');
    var acoes = (a.card ? P.refCard(a.card) : '')
      + (a.ev ? '<button class="pp-btn" onclick="window.shDetalheDF.verEvento(this,\'' + esc(a.ev) + '\')">Ver o evento ' + esc(a.ev) + '</button>' : '')
      + (a.alerta ? '<button class="pp-btn" onclick="window.shDetalheDF.verAlerta(\'' + esc(a.alerta) + '\')">Ver o alerta ' + esc(a.alerta) + '</button>' : '')
      + (a.hist ? '<button class="pp-btn" onclick="window.shDetalheDF.verHist(this,\'' + a.trib + '\')">Ver no histórico</button>' : '');
    return '<div class="dfa-al ' + a.sev + '" data-trib="' + a.trib + '">'
      + '<div class="dfa-al-h">' + P.chipTrib(a.trib === 'doc' ? null : a.trib) + '<span class="dfa-al-o">' + ORG[a.trib] + '</span>'
      + '<strong class="dfa-al-t">' + esc(a.tit) + '</strong>' + (a.valor > 0 ? '<span class="dfa-al-v">' + P.money(a.valor) + '</span>' : '') + '</div>'
      + (a.det ? '<div class="dfa-al-d">' + esc(a.det) + '</div>' : '')
      + (meta ? '<div class="dfa-al-m">' + esc(meta) + '</div>' : '')
      + (acoes ? '<div class="dfa-al-a">' + acoes + '</div>' : '')
      + '</div>';
  }
  // tribs: os tributos do filtro — os dois no DF; no RF (AV-RF), só o do registro
  function alertasHtml(L, tribs, onde) {
    if (!L.length) return '<div class="dfa-vazio"><strong>Nenhum alerta neste ' + (onde || 'documento') + '.</strong>Quando algo pedir atenção, como uma divergência no órgão, uma ocorrência aberta, um prazo correndo ou uma integração sem resposta, aparece aqui.</div>';
    var porT = { todos: L.length, cbs: 0, ibs: 0, doc: 0 };
    L.forEach(function (a) { porT[a.trib] = (porT[a.trib] || 0) + 1; });
    tribs = tribs || ['cbs', 'ibs'];
    var pills = GRUPOS.map(function (g) {
      var n = L.filter(function (a) { return a.sev === g[0]; }).length; if (!n) return '';
      var r = n === 1 ? { acao: 'exige ação', acomp: 'em acompanhamento', info: 'informativo' }[g[0]] : g[1].toLowerCase();
      return '<span class="dfa-pill ' + g[0] + '">' + n + ' ' + r + '</span>';
    }).join('');
    var seg = [['todos', 'Todos']].concat(tribs.map(function (t) { return [t, t.toUpperCase()]; })).concat([['doc', 'DF']]).map(function (t, i) {
      return '<button data-alt="' + t[0] + '" class="' + (i ? '' : 'on') + '" onclick="window.shDetalheDF.alFiltro(this)">' + t[1] + ' · ' + (porT[t[0]] || 0) + '</button>';
    }).join('');
    return '<div data-dfa-al><div class="pp-tool"><span class="dfa-pills">' + pills + '</span><span class="pp-sp"></span><span class="pp-seg">' + seg + '</span></div>'
      + GRUPOS.map(function (g) {
        var it = L.filter(function (a) { return a.sev === g[0]; }); if (!it.length) return '';
        return '<div class="dfa-grp" data-grp="' + g[0] + '"><div class="dfa-grp-h ' + g[0] + '">' + g[1] + ' · <span data-grp-n>' + it.length + '</span></div>'
          + '<div class="dfa-grp-d">' + g[2] + '</div>' + it.map(cartao).join('') + '</div>';
      }).join('')
      + '<div class="dfa-vazio" data-al-vazio hidden>Nenhum alerta deste tributo.</div></div>';
  }
  function alFiltro(btn) {
    var box = btn.closest('[data-dfa-al]'); if (!box) return;
    var t = btn.getAttribute('data-alt');
    p().cada(box.querySelectorAll('[data-alt]'), function (b) { b.classList.toggle('on', b === btn); });
    var tot = 0;
    p().cada(box.querySelectorAll('[data-grp]'), function (g) {
      var n = 0;
      p().cada(g.querySelectorAll('.dfa-al'), function (c) { var ok = t === 'todos' || c.getAttribute('data-trib') === t; c.hidden = !ok; if (ok) n++; });
      g.hidden = !n; g.querySelector('[data-grp-n]').textContent = n; tot += n;
    });
    box.querySelector('[data-al-vazio]').hidden = !!tot;
  }

  /* ── corpo do detalhe ─────────────────────────────────────────────────── */
  X.corpoDFAbas = function (nf, ctx) {
    var P = p(), ent = nf.tipo !== 'saida';
    var comPart = ent ? X.ativo(nf) : X.ativoDeb(nf);
    var rfs = comPart ? (ent ? P.rfsDe(nf) : P.rfsDeb(nf))
      : (nf.registrosFiscais || []).slice().sort(function (a, b) { return P.trib(a) === P.trib(b) ? 0 : P.trib(a) === 'cbs' ? -1 : 1; });
    var key = P.chave('df-' + nf.numero), evs = X.eventos(nf, null);
    X._cache[key] = { evs: evs, nf: nf, rfs: rfs, modo: 'df', semSituacao: true };
    var hist = X.historico(key);
    var L = itens(nf, situacao(X._cache[key]));

    var esq = '<div class="mbox-section-label">Documento Fiscal</div>' + ctx.docHtml
      + (comPart ? '' : '<div class="mbox-divider"></div>' + (ctx.valHtml || ''))
      + '<div class="mbox-divider"></div>' + ctx.chaveHtml + ctx.ctrHtml + ctx.radHtml
      + '<div class="mbox-divider"></div><div class="mbox-section-label">Inconsistências Vinculadas</div>' + ctx.incHtml;

    var primeira = comPart
      ? (ent ? P.quadro(nf, X.valores(nf)) : P.quadroDeb(nf, null))
      : ((ent && window.shParcial ? window.shParcial.secaoDF(nf) : '') + '<div class="mbox-section-label">Registros fiscais</div>'
        + (ctx.rfsHtml || '<div class="pp-mut">Nenhum registro fiscal neste documento.</div>'));
    var aps = comPart && ent ? rfs : [];
    var abas = [['part', comPart ? 'Partição' : 'Registros fiscais'], ['al', rotAlertas(L)], ['evl-eventos', 'Eventos e ajustes<span data-evaj-n></span>'], ['hist', 'Histórico · ' + evs.length]]
      .concat(aps.map(function (rf) { return ['ap-' + P.trib(rf), 'Apuração · ' + P.trib(rf).toUpperCase()]; }))
      .concat([['evl-tempo', 'Linha do tempo']]);
    var bar = '<div class="pp-abas" role="tablist">' + abas.map(function (t, i) {
      return '<button role="tab" data-g="aba" data-v="' + t[0] + '" class="' + (i ? '' : 'on') + '" onclick="window.shDetalheDF.aba(this)">' + t[1] + '</button>';
    }).join('') + '</div>';
    var oculto = ' style="display:none"';
    var dir = '<div data-pp-box>' + bar
      + '<div data-aba="part">' + primeira + '</div>'
      + '<div data-aba="al"' + oculto + '>' + alertasHtml(L) + '</div>'
      + '<div data-aba="evl-eventos"' + oculto + '><div data-evf-slot></div>'
      + '<div class="dfa-ev evl-aba" data-evl-slot="eventos"><div class="pp-mut">Nenhum evento fiscal recebido para este documento.</div></div></div>'
      + '<div data-aba="hist"' + oculto + '><div id="pph-' + key + '">' + hist + '</div></div>'
      + aps.map(function (rf) { return '<div data-aba="ap-' + P.trib(rf) + '"' + oculto + '>' + X.apuracaoHtml(rf, nf) + '</div>'; }).join('')
      + '<div data-aba="evl-tempo"' + oculto + '><div class="evl-aba" data-evl-slot="tempo"><div class="pp-mut">Nenhum evento fiscal neste documento.</div></div></div>'
      + '</div>';
    var resumo = (nf.tipoDF || 'NF-e') + ' ' + nf.numero + ' · documento, chave, contrato e inconsistências';
    return '<div class="pp-body pp-abas-topo" data-dfa-key="' + key + '">'
      + '<div class="mbox-col pp-col-l"><details class="dfa-doc" open><summary>' + P.esc(resumo) + '</summary>' + esq + '</details></div>'
      + '<div class="mbox-col pp-col-r">' + dir + '</div></div>';
  };

  /* ── troca de aba e atalhos ───────────────────────────────────────────── */
  function rolagem(box) {
    var col = box.closest('.pp-col-r'), body = box.closest('.pp-body');
    return col && col.scrollHeight > col.clientHeight + 1 && getComputedStyle(col).overflowY !== 'visible' ? col : body;
  }
  // troca a aba e, se o começo dela ficou escondido sob a barra presa, sobe até ele
  function aba(btn) {
    X.alternar(btn);
    var box = btn.closest('[data-pp-box]'); if (!box) return;
    var pane = box.querySelector('[data-aba="' + btn.getAttribute('data-v') + '"]'), bar = box.querySelector('.pp-abas'), sc = rolagem(box);
    if (!pane || !bar || !sc) return;
    var d = pane.getBoundingClientRect().top - sc.getBoundingClientRect().top - bar.offsetHeight - 4;
    if (d < 0) sc.scrollTop += d;
    btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function irPara(de, v) {
    var box = de.closest('[data-pp-box]') || document.querySelector('#nf-detalhe-overlay [data-pp-box]') || document.querySelector('#rf-detalhe-overlay [data-pp-box]'); if (!box) return null;
    var b = box.querySelector('[data-g="aba"][data-v="' + v + '"]'); if (b) aba(b);
    return box;
  }
  function verEvento(de, id) {
    var box = irPara(de, 'evl-eventos'); if (!box) return;
    var tr = box.querySelector('tr[data-ev="' + id + '"]');
    if (!tr) return;
    var x = box.querySelector('[data-ev-x="' + id + '"]');
    if (x && x.hidden && window.shEvmL2 && shEvmL2.expandir) shEvmL2.expandir(tr);
    tr.classList.add('dfa-real');
    setTimeout(function () { tr.classList.remove('dfa-real'); }, 1800);
    tr.scrollIntoView({ block: 'center' });
  }
  function verHist(de, t) {
    var box = irPara(de, 'hist'); if (!box) return;
    var b = box.querySelector('[data-aba="hist"] [data-tv="' + t + '"]') || box.querySelector('[data-aba="hist"] [data-tv="todos"]');
    if (b && !b.classList.contains('on')) X.filtrarTrilha(b);
  }
  function verAlerta(id) {
    ['nf-detalhe-overlay', 'rf-detalhe-overlay'].forEach(function (k) { var o = document.getElementById(k); if (o) o.remove(); });
    if (window.shEvmL2 && shEvmL2.verAlerta) shEvmL2.verAlerta(id);
  }

  /* ── depois que os outros módulos preencheram o detalhe ─────────────────── */
  // As ocorrências da família I podem nascer enquanto o AV-E2 monta a tabela de
  // eventos; a aba Alertas é refeita aqui, por último, para contá-las.
  function depois() {
    if (!on()) return;
    var ov = document.getElementById('nf-detalhe-overlay'); if (!ov) return;
    var corpo = ov.querySelector('.pp-abas-topo'); if (!corpo) return;
    var c = X._cache[corpo.getAttribute('data-dfa-key')]; if (!c) return;
    var L = itens(c.nf, situacao(c));
    var pane = corpo.querySelector('[data-aba="al"]'), btn = corpo.querySelector('[data-g="aba"][data-v="al"]');
    if (pane) pane.innerHTML = alertasHtml(L);
    if (btn) btn.innerHTML = rotAlertas(L);
    var d = corpo.querySelector('.dfa-doc');
    if (d && window.matchMedia && matchMedia('(max-width: 760px)').matches) d.open = false;
  }
  function ganchos() {
    var f = window.abrirDetalhesNFporNumero;
    if (typeof f !== 'function' || f._avdf) return;
    var w = function () {
      var r = f.apply(this, arguments);
      try { depois(); } catch (e) { console.error('[AV-DF] detalhe', e); }
      return r;
    };
    // os ganchos do AV-EV e do AV-E2 já estão por dentro: não embrulhar de novo
    w._avdf = true; if (f._evf) w._evf = true; if (f._evl) w._evl = true;
    window.abrirDetalhesNFporNumero = w;
  }

  // _situacao, _alertasHtml, _rotAlertas: o detalhe do RF (AV-RF, js/detalhe-rf.js) monta a mesma aba Alertas
  window.shDetalheDF = { on: on, aba: aba, alFiltro: alFiltro, verEvento: verEvento, verHist: verHist, verAlerta: verAlerta, _itens: itens,
    _situacao: situacao, _alertasHtml: alertasHtml, _rotAlertas: rotAlertas };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(ganchos, 700); });
  else setTimeout(ganchos, 700);
  window.addEventListener('load', function () { setTimeout(ganchos, 1300); });
})();

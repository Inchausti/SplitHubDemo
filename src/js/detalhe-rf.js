/* ══ Detalhe do registro fiscal — abas no topo (pacote AV-RF) ═══════════════
   Proposta aprovada em 10/11/2026 (docs/proposta-detalhe-rf.html v1.1, R-306),
   com as dez decisões recomendadas, no mesmo modelo do detalhe do DF (AV-DF).

   detalhe_rf_abas  A coluna da direita vira só abas, presas no topo, e o
                    detalhe abre sempre na Partição (D-RF-01, 02). As abas:
                    Partição · Alertas do tributo e do documento (D-RF-03) ·
                    Eventos e ajustes, só deste órgão (D-RF-04) · Movimentos
                    (D-RF-05) · Histórico com o filtro por tributo (D-RF-06) ·
                    Apuração do tributo · Linha do tempo do tributo (D-RF-07).
                    A coluna da esquerda ganha o status, o link para o
                    documento e o RF do outro tributo (D-RF-08); a janela vai
                    a 1.120 px (D-RF-09). No celular, a coluna vira um bloco
                    recolhido acima das abas.

   Depende do AV-DF (D-RF-10): a aba Alertas, a barra de abas e os estilos vêm
   de js/detalhe-df.js. O AV-EV preenche o quadro de ajustes ([data-evf-slot]) e
   o AV-E2, a tabela de eventos e a linha do tempo do tributo ([data-evl-slot]).
   Com a flag desligada, o detalhe de sempre fica como está, para comparar.
   ═══════════════════════════════════════════════════════════════════════════ */
/* @pacote — o estado das flags é reescrito por tools/avaliacao.py promover */
window.shFeature && shFeature.registrar({"id": "AV-RF", "nome": "Detalhe do registro fiscal — abas no topo", "branch": "feat/detalhe-rf", "entrada": "#/creditos/rfs", "flags": {"detalhe_rf_abas": "avaliacao"}, "rotulos": {"detalhe_rf_abas": "Detalhe do RF com abas no topo: Partição, Alertas, Eventos e ajustes, Movimentos, Histórico, Apuração e Linha do tempo"}});
/* @fim-pacote */
(function () {
  'use strict';

  var X = window.shDetalhe = window.shDetalhe || {};
  function on() { return (!window.shFeature || shFeature.ligada('detalhe_rf_abas')) && !!window.shDetalheDF && !!X._p; }
  X.abasTopoRF = on;

  (function () {
    if (document.getElementById('rfa-css')) return;
    var l = document.createElement('link');
    l.id = 'rfa-css'; l.rel = 'stylesheet'; l.href = 'css/detalhe-rf.css?v=1';
    document.head.appendChild(l);
  })();

  var ORG = { cbs: 'Receita Federal', ibs: 'Comitê Gestor' };
  function p() { return X._p; }
  function D() { return window.shDetalheDF; }

  /* ── coluna da esquerda (D-RF-08) ─────────────────────────────────────── */
  function resumo(rf, nf) { return p().esc(rf.id + ' · registro, documento e inconsistências'); }
  function orgao(rf) { return ' <span class="rfa-org">· ' + ORG[p().trib(rf)] + '</span>'; }
  function status(rf, DR) {
    var S = window.shParcial; if (!S) return '';
    if (rf.balances && S.selo) return DR('Status', S.selo(rf, false));
    if (rf.debBalances && S.seloDeb) return DR('Status', S.seloDeb(rf, false));
    return '';
  }
  function linkDoc(nf) {
    return '<button class="rfa-lk" title="Abrir o detalhe do documento na Partição" onclick="window.shDetalheRF.abrirDoc(\'' + p().esc(nf.numero) + '\')">'
      + p().esc((nf.tipoDF || 'NF-e') + ' ' + nf.numero) + ' →</button>';
  }
  // o RF do outro tributo do mesmo documento
  function irmao(rf, nf) {
    var P = p(), t = P.trib(rf);
    var o = (nf.registrosFiscais || []).filter(function (x) { return x.id !== rf.id && P.trib(x) !== t; })[0];
    if (!o) return '';
    var T = P.trib(o).toUpperCase();
    return '<div class="mbox-divider"></div><div class="mbox-section-label">O outro tributo do documento</div>'
      + '<div class="rfa-irm"><span>' + P.chipTrib(P.trib(o)) + ' <span class="pp-mono">' + P.esc(o.id) + '</span> <span class="pp-mut">' + T + ' · ' + ORG[P.trib(o)] + '</span></span>'
      + '<button class="rfa-lk" onclick="window.shDetalheRF.abrirRF(\'' + P.esc(o.id) + '\')">Abrir →</button></div>';
  }
  function abrirDoc(n) {
    var o = document.getElementById('rf-detalhe-overlay'); if (o) o.remove();
    if (typeof window.abrirDetalhesNFporNumero === 'function') window.abrirDetalhesNFporNumero(n);
  }
  function abrirRF(id) { if (typeof window.abrirDetalheRF === 'function') window.abrirDetalheRF(id); }

  /* ── aba Alertas: só o tributo do registro e o documento (D-RF-03) ─────── */
  function itensRF(c) {
    var t = p().trib(c.rf);
    return D()._itens(c.nf, D()._situacao(c)).filter(function (a) { return a.trib === t || a.trib === 'doc'; });
  }

  /* ── coluna da direita ────────────────────────────────────────────────── */
  X.colunaRFAbas = function (rf, nf) {
    var P = p(), t = P.trib(rf), T = t.toUpperCase(), part = !!rf.balances;
    var key = P.chave('rf-' + rf.id);
    // histórico: a trilha do registro e a do documento (D-RF-06)
    var evs = X.eventos(nf, null).filter(function (e) { return !e.trib || e.trib === t; });
    X._cache[key] = { evs: evs, nf: nf, rfs: [rf], rf: rf, modo: 'rf', semSituacao: true };
    var hist = X.historico(key);
    var L = itensRF(X._cache[key]);

    var primeira = rf.balances ? P.quadro(nf, X.valores(nf), rf) : rf.debBalances ? P.quadroDeb(nf, rf)
      : '<div class="pp-mut">Este registro não tem partição.</div>';
    var abas = [['part', 'Partição'], ['al', D()._rotAlertas(L)], ['evl-eventos', 'Eventos e ajustes<span data-evaj-n></span>']]
      .concat(part ? [['mov', 'Movimentos']] : [])
      .concat([['hist', 'Histórico · ' + evs.length]])
      .concat(part ? [['ap', 'Apuração · ' + T]] : [])
      .concat([['evl-tempo', 'Linha do tempo']]);
    var bar = '<div class="pp-abas" role="tablist">' + abas.map(function (a, i) {
      return '<button role="tab" data-g="aba" data-v="' + a[0] + '" class="' + (i ? '' : 'on') + '" onclick="window.shDetalheDF.aba(this)">' + a[1] + '</button>';
    }).join('') + '</div>';
    var oculto = ' style="display:none"';
    return '<div data-pp-box data-rfa-key="' + key + '">' + bar
      + '<div data-aba="part">' + primeira + '</div>'
      + '<div data-aba="al"' + oculto + '>' + D()._alertasHtml(L, [t], 'registro') + '</div>'
      + '<div data-aba="evl-eventos"' + oculto + '><div data-evf-slot></div>'
      + '<div class="dfa-ev evl-aba" data-evl-slot="eventos"><div class="pp-mut">Nenhum evento fiscal recebido para este documento.</div></div></div>'
      + (part ? '<div data-aba="mov"' + oculto + '>' + window.shParcial.tabelaMovimentos(rf)
        + '<div class="pp-nota">Cada linha move uma quantia de uma parcela para outra. Os movimentos de cada parcela somam o saldo dela; a data é a do reconhecimento pelo órgão.</div></div>' : '')
      + '<div data-aba="hist"' + oculto + '><div id="pph-' + key + '">' + hist + '</div></div>'
      + (part ? '<div data-aba="ap"' + oculto + '>' + X.apuracaoHtml(rf, nf) + '</div>' : '')
      + '<div data-aba="evl-tempo"' + oculto + '><div class="evl-aba" data-evl-slot="tempo"><div class="pp-mut">Nenhum evento fiscal neste documento.</div></div></div>'
      + '</div>';
  };

  /* ── depois que os outros módulos preencheram o detalhe ─────────────────── */
  // a glosa e o motor do art. 53 acrescentam blocos ao fim da coluna da esquerda:
  // entram no bloco recolhível, para o celular não os deixar soltos abaixo dele
  function recolher(ov) {
    var col = ov.querySelector('.pp-col-l'), d = col && col.querySelector('.dfa-doc'); if (!d) return;
    while (d.nextSibling) d.appendChild(d.nextSibling);
  }
  function depois() {
    if (!on()) return;
    var ov = document.getElementById('rf-detalhe-overlay'); if (!ov) return;
    var box = ov.querySelector('[data-rfa-key]'); if (!box) return;
    var c = X._cache[box.getAttribute('data-rfa-key')]; if (!c) return;
    var T = p().trib(c.rf).toUpperCase();
    if (window.shEvmL2 && shEvmL2.injetarRF) { try { shEvmL2.injetarRF(c.nf.numero, T); } catch (e) { console.error('[AV-RF] eventos', e); } }
    // as ocorrências da família I podem nascer ao montar a tabela de eventos: a aba Alertas é refeita por último
    var L = itensRF(c);
    var pane = box.querySelector('[data-aba="al"]'), btn = box.querySelector('[data-g="aba"][data-v="al"]');
    if (pane) pane.innerHTML = D()._alertasHtml(L, [p().trib(c.rf)], 'registro');
    if (btn) btn.innerHTML = D()._rotAlertas(L);
    recolher(ov);
    setTimeout(function () { var o = document.getElementById('rf-detalhe-overlay'); if (o) recolher(o); }, 0);
    var d = ov.querySelector('.dfa-doc');
    if (d && window.matchMedia && matchMedia('(max-width: 760px)').matches) d.open = false;
  }
  function ganchos() {
    var f = window.abrirDetalheRF;
    if (typeof f !== 'function' || f._avrf) return;
    var w = function () {
      var r = f.apply(this, arguments);
      try { depois(); } catch (e) { console.error('[AV-RF] detalhe', e); }
      return r;
    };
    // os ganchos da glosa, do AV-EV e do motor já estão por dentro: não embrulhar de novo
    w._avrf = true; ['_evf', '_gl', '_mt2'].forEach(function (k) { if (f[k]) w[k] = true; });
    window.abrirDetalheRF = w;
  }

  window.shDetalheRF = { on: on, resumo: resumo, orgao: orgao, status: status, linkDoc: linkDoc, irmao: irmao, abrirDoc: abrirDoc, abrirRF: abrirRF };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(ganchos, 700); });
  else setTimeout(ganchos, 700);
  window.addEventListener('load', function () { setTimeout(ganchos, 1300); });
})();

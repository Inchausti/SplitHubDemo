/* ═══════════════════════════════════════════════════════════════════════════
   Status do débito — ciclo e flags
   Proposta src/docs/proposta-status-debito.html (v1.0)

   O registro de saída tinha um campo só, com quatro valores que misturavam
   o estado do ciclo com o problema do documento. Aqui os dois eixos ficam
   separados, como já acontece no crédito:

     ciclo  → nao_extinto · parcial · extinto     (soma o total)
     flags  → vencido · inconsistencia · retido   (cruzam o ciclo)

   Decisões aplicadas, conforme a proposta:
   D-DB-01 · débito vencido entra na fila do art. 53, com prioridade
   D-DB-02 · débito com inconsistência fica retido e fora da fila
   D-DB-03 · existe o estado parcialmente extinto
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var S = window.shStatusDebito = window.shStatusDebito || {};

  S.CICLO = { nao_extinto: 'Não Extinto', parcial: 'Parcialmente Extinto', extinto: 'Extinto' };
  S.FLAGS = { vencido: 'Vencido', inconsistencia: 'Inconsistência', retido: 'Retido', em_contencioso: 'Em contencioso' };

  function saidas(fn) {
    var L = window._nfListaCompleta || window.nfListaFiltradaGlobal || [];
    L.forEach(function (nf) { if (nf.tipo === 'saida') (nf.registrosFiscais || []).forEach(function (rf) { fn(rf, nf); }); });
  }
  function tem(rf, f) { return (rf.statusFlags || []).indexOf(f) >= 0; }
  function marca(rf, f) { rf.statusFlags = rf.statusFlags || []; if (rf.statusFlags.indexOf(f) < 0) rf.statusFlags.push(f); }
  function desmarca(rf, f) { rf.statusFlags = (rf.statusFlags || []).filter(function (x) { return x !== f; }); }
  S.tem = tem;

  /* ── 1. separação dos dois eixos, antes de qualquer indicador ─────────── */
  S.normalizar = function () {
    saidas(function (rf) {
      if (rf._statusBase === undefined) rf._statusBase = rf.status;
      var base = rf._statusBase, flags = [];
      var ciclo = base === 'extinto' ? 'extinto' : 'nao_extinto';
      if (base === 'vencido') flags.push('vencido');
      if (base === 'inconsistencia') { flags.push('inconsistencia'); flags.push('retido'); }
      rf.statusFlags = flags;
      rf.statusDebito = ciclo;
      rf.status = ciclo;
    });
  };

  /* ── 2. inconsistência apurada vira flag, mesmo onde o rótulo não estava ─
     São os 14 registros que tinham divergência vinculada e não apareciam
     em indicador nenhum (P-01 da proposta). */
  S.flagsDeInconsistencia = function () {
    saidas(function (rf) {
      if ((rf._inconsistencias || []).length) {
        marca(rf, 'inconsistencia');
        if (rf.statusDebito !== 'extinto') marca(rf, 'retido');
      }
    });
  };

  /* ── 3. o ciclo depois do motor ──────────────────────────────────────── */
  S.aplicarCiclo = function (rf, extintoTotal, parcial) {
    rf.statusDebito = extintoTotal ? 'extinto' : parcial ? 'parcial' : 'nao_extinto';
    rf.status = rf.statusDebito;
    if (extintoTotal && tem(rf, 'vencido')) { desmarca(rf, 'vencido'); rf._foiVencido = true; }
  };

  /* ── indicadores: duas leituras ──────────────────────────────────────── */
  function fmt(v) {
    if (v >= 1e6) return 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M';
    if (v >= 1e3) return 'R$ ' + Math.round(v / 1e3) + 'K';
    return (window.ff ? ff(v) : 'R$ ' + Math.round(v));
  }
  function set(id, txt) { var e = document.getElementById(id); if (e) e.textContent = txt; }
  function rotulo(id, txt) {
    var e = document.getElementById(id); if (!e) return;
    var card = e.closest ? e.closest('.kcard') : null; if (!card) return;
    var l = card.querySelector('.klbl'); if (!l) return;
    var info = l.querySelector('.periodo-info');
    l.textContent = txt + ' ';
    if (info) l.appendChild(info);
  }
  S.kpis = function (listaRFs) {
    try { S.flagsDeInconsistencia(); } catch (e) {}
    var ix = {}; saidas(function (rf) { ix[rf.id] = rf; });
    var t = { total: 0, extinto: 0, parcial: 0, naoExt: 0, vencido: 0, inc: 0, retido: 0, parcialAbatido: 0, exVencido: 0, nVenc: 0, nInc: 0, nExVenc: 0 };
    (listaRFs || []).forEach(function (r) {
      var rf = ix[r.rf] || ix[r.rfId] || {}, v = r.deb || 0, c = rf.statusDebito || r.status;
      t.total += v;
      if (c === 'extinto') t.extinto += v;
      else if (c === 'parcial') { t.parcial += v; t.naoExt += v; t.parcialAbatido += rf._valorCompensado || 0; }
      else t.naoExt += v;
      if (tem(rf, 'vencido')) { t.vencido += v; t.nVenc++; }
      if (tem(rf, 'inconsistencia')) { t.inc += v; t.nInc++; }
      if (tem(rf, 'retido')) t.retido += v;
      if (rf._foiVencido) { t.exVencido += v; t.nExVenc++; }
    });
    var pct = function (v) { return t.total > 0 ? (v / t.total * 100).toFixed(1).replace('.', ',') + '%' : '—'; };
    set('deb-total', fmt(t.total));
    set('deb-extinto', fmt(t.extinto));
    set('deb-extinto-sub', pct(t.extinto) + ' do total — ciclo encerrado');
    set('deb-nao-extinto', fmt(t.naoExt));
    set('deb-nao-extinto-sub', pct(t.naoExt) + ' — ' + (t.parcial > 0 ? fmt(t.parcial) + ' parcialmente extintos (' + fmt(t.parcialAbatido) + ' já abatidos)' : 'nenhum parcialmente extinto'));
    rotulo('deb-vencido', 'Vencidos · flag');
    set('deb-vencido', fmt(t.vencido));
    set('deb-vencido-sub', t.nVenc
      ? t.nVenc + ' RFs em atraso · cruza o ciclo, não soma com ele'
      : (t.nExVenc ? 'nenhum em atraso · ' + fmt(t.exVencido) + ' em ' + t.nExVenc + ' RFs foram extintos por compensação depois de vencer (art. 53)' : 'nenhum débito em atraso'));
    rotulo('deb-inconsist', 'Com inconsistência · flag');
    set('deb-inconsist', fmt(t.inc));
    set('deb-inconsist-sub', t.nInc + ' RFs · ' + fmt(t.retido) + ' retidos, fora da compensação (D-DB-02)');
    set('deb-aguard', fmt(t.naoExt));
    set('deb-aguard-sub', pct(t.naoExt) + ' — recolhimento pendente');
    S._tot = t;
  };

  /* ── composição mensal: por ciclo, não por rótulo ─────────────────────── */
  S.composicao = function (filtroTipo) {
    if (filtroTipo !== undefined) window._composicaoDebitosFiltro = filtroTipo;
    var filtro = window._composicaoDebitosFiltro || '';
    var MES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    var ISO = MES.map(function (_, i) { return '2026-' + (i < 9 ? '0' : '') + (i + 1); });
    var ordem = ['extinto', 'parcial', 'nao_extinto'];
    var cor = { extinto: PALETTE.teal, parcial: PALETTE.purple, nao_extinto: PALETTE.gray };
    var agg = {}; ISO.forEach(function (m) { agg[m] = { extinto: 0, parcial: 0, nao_extinto: 0 }; });
    var f = window._filtrosDebitos || {}, busca = (f.busca || '').toLowerCase();
    saidas(function (rf) {
      if (filtro && rf.tipoFiscal !== filtro) return;
      if (!window._matchPeriodo(rf.data, f)) return;
      if (busca) { var s = (rf.id || '').toLowerCase() + ('nf-' + (rf.nfVinculada || '')).toLowerCase() + (rf.entidade || '').toLowerCase(); if (!s.includes(busca)) return; }
      if (f.tipoFiscal && rf.tipoFiscal !== f.tipoFiscal.toLowerCase()) return;
      if (f.status && (rf.statusDebito || rf.status) !== f.status) return;
      if (f.metodo && rf.metodoExtincao !== f.metodo) return;
      if (f.dataNFDe && rf.data < f.dataNFDe) return;
      if (f.dataNFAte && rf.data > f.dataNFAte) return;
      var m = (rf.data || '').slice(0, 7); if (!agg[m]) return;
      var v = rf.valor || 0;
      if (f.debMin !== '' && v < parseFloat(f.debMin)) return;
      if (f.debMax !== '' && v > parseFloat(f.debMax)) return;
      var c = rf.statusDebito || rf.status || 'nao_extinto';
      if (agg[m][c] !== undefined) agg[m][c] += Math.round(v / 1e6 * 1000) / 1000;
    });
    _svgStackedBar('cDebComposicao', ordem.map(function (c) {
      return { label: S.CICLO[c], color: cor[c], data: ISO.map(function (m) { return Math.round((agg[m][c] || 0) * 100) / 100; }) };
    }), MES, 200);
    var sub = document.getElementById('cDebComposicao-sub');
    if (sub) sub.textContent = 'R$ milhões · IBS + CBS · por estado do ciclo · vencido e inconsistência são flags e aparecem nos KPIs';
    ['btn-deb-todos', 'btn-deb-ibs', 'btn-deb-cbs'].forEach(function (id) {
      var b = document.getElementById(id); if (!b) return;
      var on = (id === 'btn-deb-todos' && !filtro) || (id === 'btn-deb-ibs' && filtro === 'ibs') || (id === 'btn-deb-cbs' && filtro === 'cbs');
      b.style.background = on ? 'var(--teal)' : 'transparent';
      b.style.color = on ? '#fff' : 'var(--txt2)';
      b.style.borderColor = on ? 'var(--teal)' : 'var(--brd)';
    });
  };

  /* ── histórico: vencimento e inconsistência viram evento, com data ───── */
  S.historicoRF = function (rf, nf) {
    if (!nf || nf.tipo !== 'saida') return [];
    var F = window._rfFmtTS || function (x) { return x; }, A = window._rfAddDays;
    var out = [], v = rf.valor || 0;
    function ev(ts, tipo, ator, desc, cls) { return { ts: ts, data: F(ts), tipo: tipo, modulo: 'Débitos', ator: ator, desc: desc, cls: cls }; }
    function money(x) { return 'R$ ' + (Math.round((x || 0) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    var venc = rf.dataPrevExtincao || (A ? A(String(nf.data).slice(0, 10), 40) : null);
    if (venc && (tem(rf, 'vencido') || rf._foiVencido)) {
      out.push(ev(String(venc).slice(0, 10) + 'T23:59', 'VENCIMENTO', 'SplitHub',
        'Prazo de recolhimento do débito de ' + (rf.tipoFiscal || '').toUpperCase() + ' vencido em ' + String(venc).slice(0, 10).split('-').reverse().join('/')
        + ' sem extinção · ' + money(v) + ' em atraso · acréscimos legais sobre o valor não extinto'
        + (rf._foiVencido ? ' · extinto depois, por compensação na ordem do art. 53' : ''), rf._foiVencido ? 'pending' : 'erro'));
    }
    if (tem(rf, 'retido')) {
      var inc = (rf._inconsistencias || [])[0];
      out.push(ev(String(nf.data).slice(0, 10) + 'T11:20', 'RETIDO', 'SplitHub',
        'Débito retido para compensação enquanto houver inconsistência aberta'
        + (inc ? ' · ' + (inc.tipoLabel || inc.tipo) : '') + ' · a extinção por crédito só ocorre depois da regularização (D-DB-02)', 'pending'));
    }
    return out;
  };

  /* ── ganchos ─────────────────────────────────────────────────────────── */
  function ganchos() {
    if (typeof window.atualizarKPIsDebitos === 'function' && !window.atualizarKPIsDebitos._sd) {
      window.atualizarKPIsDebitos = function (lista) { try { S.kpis(lista); } catch (e) { console.error('[status-debito] kpis', e); } };
      window.atualizarKPIsDebitos._sd = true;
    }
    if (typeof window.renderizarComposicaoDebitos === 'function' && !window.renderizarComposicaoDebitos._sd) {
      window.renderizarComposicaoDebitos = function (f) { try { S.composicao(f); } catch (e) { console.error('[status-debito] composição', e); } };
      window.renderizarComposicaoDebitos._sd = true;
    }
    // a tela de Debito pode ter sido pintada antes dos ganchos entrarem
    if (typeof window.showView === 'function' && !window.showView._sd) {
      var sv = window.showView;
      window.showView = function (id) {
        var r = sv.apply(this, arguments);
        if (id === 'debitos') setTimeout(function () { try { window.renderizarTabelaDebitos(); } catch (e) {} }, 0);
        return r;
      };
      Object.keys(sv).forEach(function (k) { window.showView[k] = sv[k]; });
      window.showView._sd = true;
    }
    if (typeof window._rfGerarHistorico === 'function' && !window._rfGerarHistorico._sd) {
      var gh = window._rfGerarHistorico;
      window._rfGerarHistorico = function (rf, nf) {
        var ev = gh.apply(this, arguments);
        try { S.historicoRF(rf, nf).forEach(function (e) { ev.push(e); }); } catch (e) { console.error('[status-debito] histórico', e); }
        return ev;
      };
      window._rfGerarHistorico._sd = true;
    }
  }
  // os ganchos precisam estar no lugar antes do primeiro calculo de indicadores
  (function tentar(n) {
    ganchos();
    if (!(window.atualizarKPIsDebitos && window.atualizarKPIsDebitos._sd) && (n || 0) < 20) setTimeout(function () { tentar((n || 0) + 1); }, 50);
  })(0);
})();

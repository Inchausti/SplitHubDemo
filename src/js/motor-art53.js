/* ═══════════════════════════════════════════════════════════════════════════
   Motor de compensação — art. 53 da LC 214/2025

   O crédito apropriado abate débito na ordem da lei: 1º o saldo a recolher
   vencido; 2º os débitos do próprio período; o que sobra é saldo credor, que
   compensa nos períodos seguintes ou sai para ressarcimento. Split Payment e
   RAD extinguem o débito com dinheiro e não disputam crédito.

   O motor roda sobre a base carregada antes de qualquer indicador, e as telas
   leem o livro que ele produz: Apuração, Crédito, Débito, detalhe do RF,
   histórico, Ressarcimento e Fluxo de Caixa Tributário.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var M = window.shMotor = window.shMotor || {};
  // Decisões de 18/09/2026: split fora por enquanto; preservar meses devedores —
  // o saldo que sai para ressarcimento (plano do módulo) deixa de compensar.
  // Período pela apropriação: o crédito só existe depois do recolhimento do
  // fornecedor (LC 214/2025, art. 47) — não pode compensar nem ser pedido antes.
  M.opcoes = M.opcoes || { split: 0, periodo: 'apropriacao', vencidos: 'preservar', ressarcimento: 'modulo', pedido: 'modulo' };

  var MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function perAdd(k, n) { var p = k.split('-'); var d = new Date(+p[0], +p[1] - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  // Plano de ressarcimento do módulo (mesmos períodos e proporções da base simulada),
  // agora sobre o saldo credor que o motor apura.
  function plano(T, ref) {
    if (T === 'CBS') return [
      { p: perAdd(ref, -4), tipo: 'pedido', frac: 0.6, status: 'pago', id: 'PED-CBS-' + perAdd(ref, -4) },
      { p: perAdd(ref, -2), tipo: 'pedido', frac: 0.7, status: 'em_analise', div: true, id: 'PED-CBS-' + perAdd(ref, -2) },
      { p: perAdd(ref, -1), tipo: 'intencao', frac: 1, status: 'declarada', id: 'INT-CBS-' + perAdd(ref, -1) }];
    return [
      { p: perAdd(ref, -4), tipo: 'pedido', frac: 1, status: 'pago', parcial: true, id: 'PED-IBS-' + perAdd(ref, -4) },
      { p: perAdd(ref, -3), tipo: 'cancelada', frac: 0, status: 'cancelada', id: 'INT-IBS-' + perAdd(ref, -3) },
      { p: perAdd(ref, -2), tipo: 'pedido', frac: 0.5, status: 'em_analise', id: 'PED-IBS-' + perAdd(ref, -2) }];
  }
  function perLbl(k) { var p = k.split('-'); return MES[+p[1] - 1] + '/' + p[0]; }
  function fimMes(k) { var p = k.split('-'); var d = new Date(+p[0], +p[1], 0); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function br(iso) { var p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; }
  function money(v) { return 'R$ ' + (Math.round((v || 0) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function mi(v) { return (Math.round((v || 0) / 1e4) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function T_(rf) { return String(rf.tipoFiscal || '').toUpperCase(); }
  function sc(rf) { return rf.statusCredito || rf.status || ''; }

  /* ── o motor ─────────────────────────────────────────────────────────── */
  function motor(L, op) {
    var livro = [], porMes = {}, cenarioComCredito = 0, planoRes = {};
    function ids(a) { return a.map(function (c) { return c.rf.id; }); }
    ['CBS', 'IBS'].forEach(function (T) {
      var creds = [], debs = [];
      L.forEach(function (nf) {
        (nf.registrosFiscais || []).forEach(function (rf) {
          if (T_(rf) !== T) return;
          if (nf.tipo === 'entrada') {
            var s = sc(rf);
            if (s !== 'apropriado' && s !== 'utilizado') return;
            if (!((rf.valor || 0) > 0)) return;   // valor nao positivo nao entra no pool
            var per = (op.periodo === 'apropriacao' && rf.dataApropriacao ? String(rf.dataApropriacao) : String(rf.data || nf.data)).slice(0, 7);
            creds.push({ rf: rf, nf: nf, per: per, ord: String(rf.dataApropriacao || rf.data || '') + rf.id, saldo: rf.valor || 0 });
          } else {
            // D-DB-01 e D-DB-02: o vencido entra na fila e tem prioridade;
            // o retido por inconsistencia fica fora ate a regularizacao.
            var SD = window.shStatusDebito;
            var st = rf.status, venc = !!(SD && SD.tem(rf, 'vencido')), retido = !!(SD && SD.tem(rf, 'retido'));
            var cobre = !retido && (st === 'nao_extinto' || st === 'parcial' || (st === 'extinto' && rf.metodoExtincao === 'Compensacao'));
            if (!cobre || !((rf.valor || 0) > 0)) return;
            debs.push({ rf: rf, nf: nf, per: String(nf.data || rf.data).slice(0, 7), ord: String(nf.data || '') + rf.id, falta: rf.valor || 0, orig: venc ? 'vencido' : st, venc: venc });
          }
        });
      });
      creds.sort(function (a, b) { return a.per < b.per ? -1 : a.per > b.per ? 1 : (a.ord < b.ord ? -1 : 1); });
      debs.sort(function (a, b) { return a.per < b.per ? -1 : a.per > b.per ? 1 : (a.ord < b.ord ? -1 : 1); });
      var meses = {};
      creds.forEach(function (c) { meses[c.per] = 1; }); debs.forEach(function (d) { meses[d.per] = 1; });
      var ks = Object.keys(meses).sort();
      var fila = [];   // débitos em aberto, do mais antigo para o mais novo (art. 53, 1º e 2º)
      var ci = 0, pool = [];
      ks.forEach(function (k) {
        while (ci < creds.length && creds[ci].per <= k) pool.push(creds[ci++]);
        // deferimento parcial: o não reconhecido volta a compensar a partir da decisão
        var dev = 0;
        pool.forEach(function (c) { if (c.volta === k) { c.saldo = c.rf.valor || 0; dev += c.saldo; c.res = null; c.volta = null; c.voltou = true; c.rf._disponivelDesde = k; } });
        debs.forEach(function (d) { if (d.per === k) fila.push(d); });
        // art. 53, 1o: o saldo a recolher vencido vem antes dos debitos do periodo
        fila.sort(function (a, b) { return (b.venc ? 1 : 0) - (a.venc ? 1 : 0); });
        var comp = 0;
        for (var i = 0; i < fila.length; i++) {
          var d = fila[i];
          while (d.falta > 0.005) {
            var c = null; for (var j = 0; j < pool.length; j++) { if (pool[j].saldo > 0.005) { c = pool[j]; break; } }
            if (!c) break;
            var v = Math.min(d.falta, c.saldo);
            c.saldo -= v; d.falta -= v; comp += v;
            if (c.saldo <= 0.005 && !c.fim) c.fim = k;
            if (d.falta <= 0.005) d.fim = k;
            livro.push({ tributo: T, mes: k, cred: c.rf.id, credDF: c.nf.numero, deb: d.rf.id, debDF: d.nf.numero, valor: v });
          }
        }
        // O que o crédito não cobriu é o tributo a recolher DO MÊS: vai para guia e não
        // espera crédito futuro. Só o débito vencido e não pago segue na fila (art. 53, 1º).
        var aRecolherMes = fila.filter(function (d) { return d.falta > 0.005 && d.orig !== 'vencido'; }).reduce(function (s, d) { return s + d.falta; }, 0);
        fila = fila.filter(function (d) { return d.falta > 0.005 && d.orig === 'vencido'; });
        // fim do período: o saldo que vai para ressarcimento sai do caminho da compensação
        var saiu = 0;
        if (op.ressarcimento === 'modulo') plano(T, op.ref).forEach(function (pl) {
          if (pl.p !== k) return;
          // só crédito já apropriado na data da intenção
          // a intenção trava o saldo credor do período: entra o crédito apropriado até o fim dele
          var lim = fimMes(k);
          var livres = pool.filter(function (c) { return !c.res && c.saldo >= (c.rf.valor || 0) - 0.005 && c.saldo > 0.005 && (!c.rf.dataApropriacao || String(c.rf.dataApropriacao).slice(0, 10) <= lim); });
          var reg = planoRes[pl.id] = { tributo: T, p: k, tipo: pl.tipo, status: pl.status, livres: ids(livres), sel: [], volta: null, div: null, valor: 0 };
          if (pl.tipo === 'cancelada' || !livres.length) return;   // cancelada: reservou e devolveu no mesmo mês
          var base = livres.slice();
          if (pl.div && base.length > 2) { var dv = base.pop(); dv.rf._motorDiv = pl.id; reg.div = dv.rf.id; }
          var alvo = base.reduce(function (s, c) { return s + c.saldo; }, 0) * (op.pedido === 'integral' ? 1 : pl.frac), acum = 0, sel = [];
          base.forEach(function (c) { if (acum < alvo - 0.005 || !sel.length) { sel.push(c); acum += c.saldo; } });
          sel.forEach(function (c, i) {
            c.res = { id: pl.id, tipo: pl.tipo, status: pl.status, per: k }; saiu += c.saldo; reg.valor += c.saldo; c.saldo = 0;
            if (pl.parcial && i === sel.length - 1 && sel.length > 1) { c.volta = perAdd(k, 3); reg.volta = c.rf.id; }
          });
          reg.sel = ids(sel);
        });
        var saldo = pool.reduce(function (s, c) { return s + Math.max(0, c.saldo); }, 0);
        porMes[T + '|' + k] = { tributo: T, mes: k, compensado: comp, saldoCredor: saldo, aRecolher: aRecolherMes, vencidoAberto: fila.reduce(function (s, d) { return s + d.falta; }, 0), ressarcimento: saiu, devolvido: dev };
      });
      // grava o resultado na cópia
      creds.forEach(function (c) {
        var usado = (c.rf.valor || 0) - Math.max(0, c.saldo);
        c.rf._valorCompensado = usado;
        if (c.res && op.aplicar) {
          // na base viva, o módulo de Ressarcimento marca e extingue — com a trilha
          c.rf._motorRes = { id: c.res.id, tipo: c.res.tipo, status: c.res.status, per: c.res.per };
          c.rf.statusCredito = 'apropriado'; c.rf.status = 'apropriado'; c.rf.metodoExtincao = null; c.rf.dataExtincaoCredito = null; c.rf._valorCompensado = 0;
          return;
        }
        if (c.res) {
          if (c.res.status === 'pago') { c.rf.statusCredito = 'utilizado'; c.rf.status = 'utilizado'; c.rf.metodoExtincao = 'Ressarcimento'; c.rf.dataExtincaoCredito = fimMes(perAdd(c.res.per, 3)); c.rf._valorCompensado = 0; }
          else { c.rf.statusCredito = 'apropriado'; c.rf.status = 'apropriado'; c.rf.metodoExtincao = null; c.rf.dataExtincaoCredito = null; c.rf._valorCompensado = 0; c.rf.ressarcimento = { marca: c.res.tipo === 'intencao' ? 'reservado' : 'em_pedido', ref: c.res.id, tributo: T }; }
          return;
        }
        if (c.saldo <= 0.005) { c.rf.statusCredito = 'utilizado'; c.rf.status = 'utilizado'; c.rf.metodoExtincao = 'Compensacao'; c.rf.dataExtincaoCredito = fimMes(c.fim || c.per); }
        else { c.rf.statusCredito = 'apropriado'; c.rf.status = 'apropriado'; c.rf.metodoExtincao = null; c.rf.dataExtincaoCredito = null; if (usado > 0.005) c.rf._parcial = true; }
      });
      debs.forEach(function (d) {
        var usado = (d.rf.valor || 0) - d.falta, SD = window.shStatusDebito;
        d.rf._valorCompensado = usado;
        var quitado = d.falta <= 0.005;
        if (quitado) { d.rf.metodoExtincao = 'Compensacao'; d.rf.dataExtincao = br(fimMes(d.fim || d.per)) + ' 18:00'; }
        else { d.rf.metodoExtincao = null; d.rf.dataExtincao = '—'; if (usado > 0.005) d.rf._parcial = true; }
        if (SD && SD.aplicarCiclo) SD.aplicarCiclo(d.rf, quitado, usado > 0.005);
        else d.rf.status = quitado ? 'extinto' : 'nao_extinto';
      });
    });
    // débitos de cenário preservados (vencido/inconsistência) em mês com crédito sobrando
    L.forEach(function (nf) {
      if (nf.tipo !== 'saida') return;
      (nf.registrosFiscais || []).forEach(function (rf) {
        var SD2 = window.shStatusDebito;
        if (!(SD2 && (SD2.tem(rf, 'retido') || SD2.tem(rf, 'vencido')))) return;
        var pm = porMes[T_(rf) + '|' + String(nf.data).slice(0, 7)];
        if (pm && pm.saldoCredor > 0.005) cenarioComCredito++;
      });
    });
    return { livro: livro, porMes: porMes, cenarioComCredito: cenarioComCredito, plano: planoRes };
  }

  /* ── o motor na base, antes de qualquer indicador ────────────────────── */
  function refHoje() {
    var d = new Date(), s = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    if (s < '2026-06-01') s = '2026-06-01'; if (s > '2026-12-20') s = '2026-12-20';
    return s.slice(0, 7);
  }
  M.aplicarNaBase = function () {
    var L = (window.nfListaFiltradaGlobal && window.nfListaFiltradaGlobal.length) ? window.nfListaFiltradaGlobal : (window._nfListaCompleta || []);
    if (!L.length || (M.live && M.live.nf0 === L[0] && M.live.n === L.length)) return;
    var op = { split: 0, periodo: M.opcoes.periodo, vencidos: M.opcoes.vencidos, ressarcimento: 'modulo', pedido: M.opcoes.pedido, aplicar: true, ref: refHoje() };
    var r = motor(L, op);
    var porCred = {}, porDeb = {};
    r.livro.forEach(function (x) { (porCred[x.cred] = porCred[x.cred] || []).push(x); (porDeb[x.deb] = porDeb[x.deb] || []).push(x); });
    M.live = { nf0: L[0], n: L.length, porMes: r.porMes, livro: r.livro, plano: r.plano, ref: op.ref, op: op, porCred: porCred, porDeb: porDeb };
    try { vincular(); M.telas(); } catch (e) { console.error('[motor] vínculo', e); }
  };
  function chaveDe(per) { if (per.indexOf('/') < 0) return per; var p = per.split('/'); return p[1] + '-' + pad(MES.indexOf(p[0]) + 1); }

  // Apuração lida do livro do motor: compensação no mês em que acontece, saldo
  // anterior consumido, devolução do deferimento parcial e débitos com os
  // créditos que os abateram.
  M.ajustarApuracao = function () {
    if (!M.live || !window.apurData) return;
    var V = M.live, L = window._nfListaCompleta || window.nfListaFiltradaGlobal || [], ad = window.apurData;
    var rfNf = {}; L.forEach(function (nf) { (nf.registrosFiscais || []).forEach(function (rf) { rfNf[rf.id] = { rf: rf, nf: nf }; }); });
    function perCred(rf, nf) { return (V.op.periodo === 'apropriacao' && rf.dataApropriacao ? String(rf.dataApropriacao) : String(rf.data || nf.data)).slice(0, 7); }
    function doc(nf) { return (nf.tipoDF || 'NF-e') + ' ' + nf.numero; }
    // crédito apropriado num mês sem DF emitido (ex.: DF de dez apropriado em jan)
    // pertence à apuração daquele mês (art. 47): o período passa a existir
    var novos = [];
    L.forEach(function (nf) {
      if (nf.tipo !== 'entrada') return;
      (nf.registrosFiscais || []).forEach(function (rf) {
        var st = sc(rf); if (st !== 'apropriado' && st !== 'utilizado') return;
        var k = perCred(rf, nf), p = k.split('-'), lbl = MES[+p[1] - 1] + '/' + p[0];
        if (!ad[lbl] && novos.indexOf(lbl) < 0) novos.push(lbl);
      });
    });
    if (novos.length) {
      var ord = function (a) { var p = a.split('/'); return +p[1] * 100 + MES.indexOf(p[0]); };
      var ativo = window.apurPeriodoAtivo, todos = Object.keys(ad).concat(novos).sort(function (a, b) { return ord(a) - ord(b); }), copia = {};
      todos.forEach(function (lbl) { copia[lbl] = ad[lbl] || { status: 'calculada', ultimaExecucao: null, ibsSaldoInicial: 0, cbsSaldoInicial: 0, creditos: [], debitos: [], soCredito: true }; });
      Object.keys(ad).forEach(function (lbl) { delete ad[lbl]; });
      todos.forEach(function (lbl) { ad[lbl] = copia[lbl]; });
      var sel = document.getElementById('apur-periodo-sel');
      if (sel) {
        sel.innerHTML = '';
        todos.slice().reverse().forEach(function (lbl) { var o = document.createElement('option'); o.value = lbl; o.textContent = lbl.charAt(0).toUpperCase() + lbl.slice(1) + (ad[lbl].soCredito ? ' · só créditos apropriados' : ''); sel.appendChild(o); });
        if (ativo && ad[ativo]) sel.value = ativo;
      }
    }
    Object.keys(ad).forEach(function (per) {
      var k = chaveDe(per), d = ad[per], cred = [], deb = [];
      ['IBS', 'CBS'].forEach(function (T) {
        var ant = V.porMes[T + '|' + perAdd(k, -1)];
        d[T === 'IBS' ? 'ibsSaldoInicial' : 'cbsSaldoInicial'] = ant ? ant.saldoCredor : 0;
      });
      L.forEach(function (nf) {
        (nf.registrosFiscais || []).forEach(function (rf) {
          var T = T_(rf); if (T !== 'IBS' && T !== 'CBS') return;
          var v = rf.valor || 0;
          if (nf.tipo === 'entrada') {
            var st = sc(rf), isAprop = st === 'apropriado' || st === 'utilizado';
            if ((isAprop ? perCred(rf, nf) : String(nf.data).slice(0, 7)) !== k) return;
            var util = (V.porCred[rf.id] || []).filter(function (x) { return x.mes === k; }).reduce(function (a, x) { return a + x.valor; }, 0);
            cred.push({ doc: doc(nf), tributo: T, data: br(nf.data), forn: nf.entidade || '—', total: v, aprop: isAprop ? v : 0, naoAprop: isAprop ? 0 : v,
              util: util, naoUtil: isAprop ? Math.max(0, v - util) : 0, ressarc: rf.metodoExtincao === 'Ressarcimento' ? v : 0,
              motivo: isAprop ? null : (rf.motivo || 'Aguardando confirmação na Plataforma Centralizada') });
          } else if (nf.tipo === 'saida' && String(nf.data).slice(0, 7) === k) {
            var ext = rf.status === 'extinto' ? v : (rf._valorCompensado || 0);
            var met = rf.metodoExtincao, mec = ext <= 0 ? null : met === 'RAD' ? 'rad' : met === 'Split Payment' ? 'split' : 'credito';
            var usados = (V.porDeb[rf.id] || []).map(function (x) { var c = rfNf[x.cred]; return { doc: c ? doc(c.nf) : x.cred, forn: c ? (c.nf.entidade || '—') : '—', valor: x.valor }; });
            deb.push({ doc: doc(nf), tributo: T, data: br(nf.data), cliente: nf.entidade || '—', total: v, naoExt: v - ext, extinto: ext, mec: mec,
              splitEvt: mec === 'split' ? { data: br(nf.data), meio: 'PIX', txId: 'SP-' + String(nf.data).replace(/-/g, '') + '-' + String(nf.numero).slice(-4), valor: ext } : null,
              radEvt: mec === 'rad' ? { adquirente: nf.entidade, cnpj: nf.cnpj || '—', data: br(nf.data) } : null,
              credEvt: mec === 'credito' ? usados : null });
          }
        });
      });
      // créditos de meses anteriores consumidos neste mês — o saldo anterior em uso
      var ant = {};
      V.livro.forEach(function (x) {
        if (x.mes !== k) return; var c = rfNf[x.cred]; if (!c || perCred(c.rf, c.nf) === k) return;
        ant[x.cred] = ant[x.cred] || { doc: doc(c.nf) + ' · saldo anterior', tributo: x.tributo, data: br(c.nf.data), forn: c.nf.entidade || '—', total: 0, aprop: 0, naoAprop: 0, util: 0, naoUtil: 0, ressarc: 0, motivo: null, saldoAnterior: true };
        ant[x.cred].util += x.valor; ant[x.cred].total += x.valor;
      });
      Object.keys(ant).forEach(function (key) { cred.push(ant[key]); });
      // devolução do deferimento parcial: o crédito volta ao saldo neste mês
      Object.keys(V.plano).forEach(function (id) {
        var pl = V.plano[id]; if (!pl.volta || perAdd(pl.p, 3) !== k) return; var c = rfNf[pl.volta]; if (!c) return;
        cred.push({ doc: doc(c.nf) + ' · devolvido (' + id + ')', tributo: pl.tributo, data: br(fimMes(k)), forn: c.nf.entidade || '—', total: c.rf.valor, aprop: c.rf.valor, naoAprop: 0, util: 0, naoUtil: c.rf.valor, ressarc: 0, motivo: null, devolucao: true });
      });
      d.creditos = cred; d.debitos = deb;
    });
  };


  /* ══ Fase 2 · etapa 2 — o vínculo exato entre crédito e débito ═════════
     O livro do motor diz, linha a linha, qual crédito abateu qual débito e
     por quanto. Aqui esse vínculo é gravado nos registros e passa a aparecer
     nas listagens de Crédito e de Débito, no detalhe do RF e no histórico —
     inclusive quando a compensação é parcial. */
  function docDe(nf) { return (nf.tipoDF || 'NF-e') + ' ' + nf.numero; }
  function vincular() {
    var V = M.live, L = window._nfListaCompleta || window.nfListaFiltradaGlobal || [], ix = {};
    L.forEach(function (nf) { (nf.registrosFiscais || []).forEach(function (rf) { ix[rf.id] = { rf: rf, nf: nf }; delete rf._motorUsos; delete rf._motorCreds; delete rf._dfsSaidaAbatidos; }); });
    V.livro.forEach(function (x) {
      var c = ix[x.cred], d = ix[x.deb]; if (!c || !d) return;
      var quando = fimMes(x.mes);
      (c.rf._motorUsos = c.rf._motorUsos || []).push({ id: x.deb, doc: docDe(d.nf), numero: d.nf.numero, ent: d.nf.entidade || '—', valor: x.valor, mes: x.mes, data: quando });
      (d.rf._motorCreds = d.rf._motorCreds || []).push({ id: x.cred, doc: docDe(c.nf), numero: c.nf.numero, ent: c.nf.entidade || '—', valor: x.valor, mes: x.mes, data: quando });
      // o histórico legado já sabe ler esta lista
      (c.rf._dfsSaidaAbatidos = c.rf._dfsSaidaAbatidos || []).push({ numero: d.nf.numero, valor: x.valor });
    });
  }

  /* ── listagens: duas colunas novas em Crédito e em Débito ────────────── */
  var COL_CRED = [
    { key: 'motorComp', label: 'Compensado', cls: 'r', tip: 'Quanto deste crédito já abateu débito, pela ordem do <strong>art. 53</strong>. Menor que o crédito significa <strong>compensação parcial</strong> — o resto segue disponível.' },
    { key: 'motorUsos', label: 'Débitos abatidos', tip: 'Documentos de saída que este crédito abateu, com o valor de cada um e o período da apuração em que isso aconteceu.' }
  ];
  var COL_DEB = [
    { key: 'motorComp', label: 'Compensado', cls: 'r', tip: 'Quanto deste débito foi extinto por compensação com crédito do mesmo tributo (<strong>art. 53</strong>). Menor que o débito significa <strong>compensação parcial</strong>.' },
    { key: 'motorCreds', label: 'Créditos usados', tip: 'Documentos de entrada cujos créditos abateram este débito, com o valor de cada um.' }
  ];
  function colunas() {
    var T = window.SH_TABLES || {};
    if (T.creditos && !T.creditos._mt) { T.creditos.cols = T.creditos.cols.concat(COL_CRED); T.creditos._mt = 1; }
    if (T.debitos && !T.debitos._mt) { T.debitos.cols = T.debitos.cols.concat(COL_DEB); T.debitos._mt = 1; }
  }
  function cifra(v) { return money(v); }
  function celValor(rf, total) {
    var c = rf._valorCompensado || 0;
    if (c <= 0.005) return '<span style="color:var(--txt3)">—</span>';
    var parcial = c < (total || 0) - 0.005;
    return '<span class="mono" style="font-weight:600' + (parcial ? ';color:var(--purple)' : '') + '">' + cifra(c) + '</span>'
      + (parcial ? '<br><span style="font-size:9px;font-weight:700;letter-spacing:.06em;color:var(--purple)">PARCIAL</span>' : '');
  }
  function celDocs(lista) {
    if (!lista || !lista.length) return '<span style="color:var(--txt3)">—</span>';
    var ordem = lista.slice().sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
    var tit = ordem.map(function (x) { return x.doc + ' · ' + cifra(x.valor) + ' · apuração de ' + perLbl(x.mes); }).join('\n');
    var vis = ordem.slice(0, 2).map(function (x) {
      return '<span style="white-space:nowrap"><button onclick="window.abrirDetalhesNFporNumero(\'' + esc(String(x.numero)) + '\')" style="background:none;border:none;padding:0;font:inherit;font-size:11px;font-weight:600;color:var(--blue);cursor:pointer;text-decoration:underline">'
        + esc(x.doc) + '</button> <span style="color:var(--txt2);font-size:10px">' + cifra(x.valor) + '</span></span>';
    }).join('<br>');
    var resto = ordem.length - 2;
    return '<div title="' + esc(tit) + '" style="line-height:1.5">' + vis + (resto > 0 ? '<br><span style="font-size:10px;color:var(--txt3)">+ ' + resto + ' documento' + (resto > 1 ? 's' : '') + '</span>' : '') + '</div>';
  }
  function rfDaLinha(tr) {
    var id = tr.cells.length ? String(tr.cells[0].textContent || '').trim() : '';
    return (window._rfIndex || {})[id] || null;
  }
  function pintarLinhas(tbodyId, entrada) {
    var tb = document.getElementById(tbodyId); if (!tb || !M.live) return;
    Array.prototype.forEach.call(tb.querySelectorAll('tr'), function (tr) {
      if (tr.getAttribute('data-mt') === '1' || tr.cells.length < 4) return;
      var e = rfDaLinha(tr); if (!e) return;
      var rf = e.rf;
      var c1 = tr.insertCell(-1), c2 = tr.insertCell(-1);
      c1.className = 'r'; c2.style.minWidth = '150px';
      c1.innerHTML = celValor(rf, rf.valor || 0);
      c2.innerHTML = celDocs(entrada ? rf._motorUsos : rf._motorCreds);
      tr.setAttribute('data-mt', '1');
    });
  }

  /* ── detalhe do RF: a seção da compensação, com os documentos ────────── */
  function painelRF() {
    var box = document.querySelector('#rf-detalhe-overlay .mbox-col'); if (!box || !M.live) return;
    var tit = document.querySelector('#rf-detalhe-overlay .mbox-title');
    var id = tit ? String(tit.textContent || '').split('·').pop().trim() : '';
    var e = (window._rfIndex || {})[id]; if (!e) return;
    var rf = e.rf, entrada = e.nf.tipo !== 'saida', usos = entrada ? rf._motorUsos : rf._motorCreds;
    var comp = rf._valorCompensado || 0, tot = rf.valor || 0, DR = window._rfDetailRow;
    if (!usos && comp <= 0.005) return;
    var linhas = (usos || []).slice().sort(function (a, b) { return a.data < b.data ? -1 : 1; }).map(function (x) {
      return '<div style="display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px solid var(--brd)">'
        + '<button onclick="window.abrirDetalhesNFporNumero(\'' + esc(String(x.numero)) + '\')" style="background:none;border:none;padding:0;font:inherit;font-size:11px;font-weight:600;color:var(--blue);cursor:pointer;text-decoration:underline">' + esc(x.doc) + '</button>'
        + '<span class="mono" style="font-size:11px">' + cifra(x.valor) + '</span></div>'
        + '<div style="font-size:10px;color:var(--txt3);margin-bottom:5px">' + esc(x.ent) + ' · apuração de ' + perLbl(x.mes) + '</div>';
    }).join('');
    var d = document.createElement('div');
    d.innerHTML = '<div class="mbox-divider"></div>'
      + '<div class="mbox-section-label">Compensação · art. 53</div>'
      + DR(entrada ? 'Crédito compensado' : 'Débito compensado', cifra(comp), 'var(--p-teal)')
      + (comp < tot - 0.005 ? DR(entrada ? 'Saldo do crédito' : 'Ainda a recolher', cifra(tot - comp), 'var(--purple)') : '')
      + (linhas ? '<div style="margin-top:6px">' + linhas + '</div>' : '')
      + '<div class="mbox-info-box"><span class="mbox-info-box-label">Como o motor escolheu</span>'
      + '<span style="color:var(--txt2)">O crédito abate, em cada apuração, primeiro o saldo a recolher vencido e depois os débitos do próprio período, do mais antigo para o mais novo (<strong>art. 53 da LC 214/2025</strong>). '
      + 'Um crédito pode abater vários débitos, e um débito pode ser abatido por vários créditos — daí a compensação parcial.</span></div>';
    box.appendChild(d);
  }

  /* ── histórico: o evento diz qual documento, quanto e em que apuração ── */
  function historico(ev, rf, nf) {
    if (!M.live) return ev;
    var T = T_(rf), F = window._rfFmtTS || function (x) { return x; };
    function mk(ts, tipo, modulo, ator, desc, cls) { return { ts: ts, data: F(ts), tipo: tipo, modulo: modulo, ator: ator, desc: desc, cls: cls }; }
    function lista(us) { return us.map(function (x) { return x.doc + ' (' + cifra(x.valor) + ')'; }).join(', '); }
    if (nf.tipo !== 'saida') {
      var usos = rf._motorUsos;
      if (!usos || !usos.length) return ev;
      ev = ev.filter(function (e) { return e.tipo !== 'UTILIZAÇÃO'; });
      var meses = {}; usos.forEach(function (x) { (meses[x.mes] = meses[x.mes] || []).push(x); });
      var ks = Object.keys(meses).sort(), usado = 0;
      ks.forEach(function (k, i) {
        var us = meses[k], v = us.reduce(function (a, x) { return a + x.valor; }, 0); usado += v;
        var resto = (rf.valor || 0) - usado;
        var desc = 'Crédito de ' + cifra(v) + ' de ' + T + ' compensado na apuração de ' + perLbl(k)
          + ' · ' + (us.length > 1 ? 'débitos abatidos' : 'débito abatido') + ': ' + lista(us)
          + ' · método: Compensação · ordem do art. 53 da LC 214/2025';
        if (i === ks.length - 1 && resto > 0.005) desc += ' · saldo de ' + cifra(resto) + ' segue disponível para os próximos períodos';
        if (v < (rf.valor || 0) - 0.005 || ks.length > 1) desc = 'Compensação parcial · ' + desc;
        ev.push(mk(fimMes(k) + 'T14:18', 'UTILIZAÇÃO', 'Apuração', 'SplitHub', desc, 'ok'));
      });
      return ev;
    }
    var creds = rf._motorCreds;
    if (!creds || !creds.length) return ev;
    var mesesD = {}; creds.forEach(function (x) { (mesesD[x.mes] = mesesD[x.mes] || []).push(x); });
    var kd = Object.keys(mesesD).sort(), pago = 0, total = rf.valor || 0;
    ev = ev.filter(function (e) { return !(e.tipo === 'EXTINÇÃO' && rf.metodoExtincao === 'Compensacao'); });
    kd.forEach(function (k, i) {
      var us = mesesD[k], v = us.reduce(function (a, x) { return a + x.valor; }, 0); pago += v;
      var falta = total - pago, ultimo = i === kd.length - 1;
      var desc = (falta > 0.005 || !ultimo ? 'Compensação parcial · ' : '') + 'Débito de ' + T + ' abatido em ' + cifra(v)
        + ' na apuração de ' + perLbl(k) + ' · ' + (us.length > 1 ? 'créditos usados' : 'crédito usado') + ': ' + lista(us)
        + ' · ordem do art. 53 da LC 214/2025'
        + (ultimo && falta > 0.005 ? ' · restam ' + cifra(falta) + ' a recolher' : '');
      ev.push(mk(fimMes(k) + 'T14:18', 'UTILIZAÇÃO', 'Apuração', 'SplitHub', desc, falta > 0.005 && ultimo ? 'pending' : 'ok'));
      if (ultimo && falta <= 0.005) ev.push(mk(fimMes(k) + 'T18:00', 'EXTINÇÃO', 'Débitos', 'SplitHub',
        'Débito de ' + T + ' extinto · ciclo tributário encerrado · método: Compensação com créditos do mesmo tributo', 'ok'));
    });
    return ev;
  }


  /* ══ Fase 2 · etapa 3 — Fluxo de Caixa Tributário pelo motor ═══════════
     A tela compara hoje crédito apropriado com débito bruto do mês de
     emissão e chama a diferença de posição. Isso ignora três coisas: o
     crédito só existe depois da apropriação, o débito extinto por split
     ou RAD nunca precisou de crédito, e o saldo credor se transporta.
     Com o motor, cada mês mostra o que de fato aconteceu: quanto o
     crédito compensou, quanto sobrou de guia e qual saldo ficou. */
  function fmM(v) {
    var neg = v < 0; var a = Math.abs(v);
    var t = a >= 1e6 ? 'R$ ' + (a / 1e6).toFixed(1).replace('.', ',') + 'M' : 'R$ ' + Math.round(a / 1e3) + 'K';
    return neg ? '−' + t : t;
  }
  function fctTribs() { var t = (window._fctTributo || 'ambos').toUpperCase(); return t === 'AMBOS' ? ['IBS', 'CBS'] : [t]; }
  function fctSerie() {
    var V = M.live, tribs = fctTribs(), by = {}, fat = {};
    function slot(m) { return (by[m] = by[m] || { cred: 0, deb: 0, debCred: 0, comp: 0, guia: 0, venc: 0, saldo: 0, ress: 0, dev: 0, split: 0, rad: 0, aberto: 0, fat: 0 }); }
    Object.keys(V.porMes).forEach(function (k) {
      var p = V.porMes[k]; if (tribs.indexOf(p.tributo) < 0) return;
      var x = slot(p.mes);
      x.venc += p.vencidoAberto; x.saldo += p.saldoCredor; x.ress += p.ressarcimento; x.dev += p.devolvido;
    });
    (window.nfListaFiltradaGlobal || []).forEach(function (nf) {
      var mEmi = String(nf.data || '').slice(0, 7); if (!mEmi) return;
      if (nf.tipo === 'saida' && !fat[nf.id || mEmi + nf.entidade]) { fat[nf.id || mEmi + nf.entidade] = 1; slot(mEmi).fat += nf.valorTotal || 0; }
      (nf.registrosFiscais || []).forEach(function (rf) {
        var T = T_(rf); if (tribs.indexOf(T) < 0) return;
        var v = rf.valor || 0;
        if (nf.tipo === 'entrada') {
          var st = sc(rf); if (st !== 'apropriado' && st !== 'utilizado') return;
          slot(String(rf.dataApropriacao || nf.data).slice(0, 7)).cred += v;
        } else {
          // contas pelo lado do débito, no mês em que ele foi emitido: o que
          // saiu em dinheiro, o que o crédito abateu, o que virou guia e o que
          // segue em aberto (vencido sem cobertura ou retido por inconsistência)
          var x = slot(mEmi), SD3 = window.shStatusDebito, comp = rf._valorCompensado || 0;
          var resto = Math.max(0, v - comp);
          x.deb += v;
          if (rf.metodoExtincao === 'Split Payment') { x.split += v; }
          else if (rf.metodoExtincao === 'RAD') { x.rad += v; }
          else {
            x.comp += comp; x.debCred += v;
            var aberto = SD3 && (SD3.tem(rf, 'retido') || SD3.tem(rf, 'vencido'));
            if (aberto) x.aberto += resto; else x.guia += resto;
          }
        }
      });
    });
    var meses = Object.keys(by).sort();
    return { meses: meses, by: by };
  }

  function fctCabecalho() {
    var tb = document.getElementById('fct-t-body'); if (!tb) return;
    var tr = tb.parentElement && tb.parentElement.querySelector('thead tr'); if (!tr || tr.getAttribute('data-mt') === '1') return;
    tr.innerHTML = '<th>Mês</th>'
      + '<th class="r" style="color:var(--teal)">Crédito aprop.</th>'
      + '<th class="r">Débito</th>'
      + '<th class="r">Pago (split/RAD)</th>'
      + '<th class="r" style="color:var(--purple)">Compensado</th>'
      + '<th class="r" style="color:var(--amber)">A recolher</th>'
      + '<th class="r" style="color:var(--red)">Em aberto</th>'
      + '<th class="r" style="color:var(--teal)">Saldo credor</th>'
      + '<th class="r">Alíq. efetiva</th>'
      + '<th>Situação</th>';
    tr.setAttribute('data-mt', '1');
  }

  function fctRender() {
    if (!M.live) return;
    var S = fctSerie(), meses = S.meses, by = S.by;
    if (!meses.length) return;
    var lbl = meses.map(function (m) { return m.slice(5, 7) + '/' + m.slice(2, 4); });
    function serie(f) { return meses.map(function (m) { return +(f(by[m]) / 1e6).toFixed(2); }); }
    if (typeof svgLine === 'function') {
      // crédito apropriado × débito do mês × o que sobrou para guia
      svgLine('cFCT', [
        { data: serie(function (d) { return d.cred; }), color: 'var(--teal)', fill: true, dots: false, w: 2, label: 'Crédito apropriado' },
        { data: serie(function (d) { return d.debCred; }), color: 'var(--red)', fill: false, dots: false, w: 2, label: 'Débito que depende de crédito', dash: true },
        { data: serie(function (d) { return d.guia; }), color: 'var(--amber)', fill: false, dots: true, w: 1.5, label: 'A recolher em guia' }
      ], lbl, 200, { min: 0 });
      // saldo credor do motor — estoque, não acumulado de diferença
      svgLine('cFCTSaldo', [
        { data: serie(function (d) { return d.saldo; }), color: 'var(--teal)', fill: true, dots: true, w: 2.5, label: 'Saldo credor' }
      ], lbl, 140, { min: 0 });
      // alíquota efetiva: o débito que o crédito não absorveu, sobre o faturamento
      var aliq = meses.map(function (m) { var d = by[m]; return d.fat ? +(((d.deb - d.comp) / d.fat) * 100).toFixed(2) : 0; });
      var pos = aliq.filter(function (v) { return v > 0; });
      svgLine('cFCTAliq', [
        { data: aliq, color: 'var(--teal)', fill: true, dots: true, w: 2.5, label: 'Alíquota efetiva %' },
        { data: meses.map(function () { return 26.5; }), color: 'var(--txt3)', fill: false, dots: false, w: 1.5, label: 'Referência 26,5%', dash: true }
      ], lbl, 170, { min: pos.length ? Math.max(0, Math.min.apply(null, pos) - 4) : 0, max: Math.max(26.5, Math.max.apply(null, aliq)) + 4,
        fmt: function (v) { return (v < 0 ? '−' : '') + Math.abs(v).toFixed(1).replace('.', ',') + '%'; } });
      var med = pos.length ? +(pos.reduce(function (a, b) { return a + b; }, 0) / pos.length).toFixed(1) : 0;
      var mStr = med.toFixed(1).replace('.', ',') + '%';
      ['fct-aliq-media', 'fct-aliq-media-chart'].forEach(function (id) { var e = document.getElementById(id); if (e) e.textContent = mStr; });
      var eco = +(26.5 - med).toFixed(1), eStr = (eco > 0 ? '−' : '+') + Math.abs(eco).toFixed(1).replace('.', ',') + 'pp vs ref.';
      ['fct-aliq-economia', 'fct-aliq-economia-chart'].forEach(function (id) { var e = document.getElementById(id); if (e) { e.textContent = eStr; e.style.color = eco > 0 ? PALETTE.teal : PALETTE.red; } });
    }
    fctCabecalho();
    var tb = document.getElementById('fct-t-body');
    if (tb) {
      tb.innerHTML = meses.map(function (m) {
        var d = by[m];
        var sit = d.aberto > 0.5 ? '<span style="color:' + PALETTE.red + ';font-weight:600;font-size:10px">● Débito em aberto</span>'
          : d.guia > 0.5 || d.venc > 0.5
          ? '<span style="color:' + PALETTE.amber + ';font-weight:600;font-size:10px">● A recolher</span>'
          : d.saldo > 0.5 ? '<span style="color:' + PALETTE.teal + ';font-weight:600;font-size:10px">● Saldo credor</span>'
          : '<span style="color:var(--txt3);font-weight:600;font-size:10px">● Zerado</span>';
        var aliq = d.fat ? ((d.deb - d.comp) / d.fat * 100).toFixed(1) + '%' : '—';
        return '<tr>'
          + '<td class="nowrap">' + m.slice(5, 7) + '/' + m.slice(0, 4) + '</td>'
          + '<td class="r mono" style="color:' + PALETTE.teal + '">' + fmM(d.cred) + '</td>'
          + '<td class="r mono">' + fmM(d.deb) + '</td>'
          + '<td class="r mono" style="color:var(--txt2)">' + fmM(d.split + d.rad) + '</td>'
          + '<td class="r mono" style="color:var(--purple)">' + fmM(d.comp) + '</td>'
          + '<td class="r mono" style="color:' + (d.guia > 0.5 ? PALETTE.amber : 'var(--txt3)') + ';font-weight:' + (d.guia > 0.5 ? '700' : '400') + '">' + fmM(d.guia) + '</td>'
          + '<td class="r mono" style="color:' + (d.aberto > 0.5 ? PALETTE.red : 'var(--txt3)') + '">' + fmM(d.aberto) + '</td>'
          + '<td class="r mono" style="color:' + PALETTE.teal + ';font-weight:700">' + fmM(d.saldo) + '</td>'
          + '<td class="r mono">' + aliq + '</td>'
          + '<td>' + sit + '</td>'
          + '</tr>';
      }).join('');
    }
    var sub = document.getElementById('fct-periodo-sub');
    if (sub && sub.getAttribute('data-mt') !== '1') { sub.textContent = 'IBS+CBS · crédito apropriado, compensação pela ordem do art. 53, guia do mês e saldo credor'; sub.setAttribute('data-mt', '1'); }
  }

  /* Projeção: o saldo credor do último mês realizado segue pela média móvel
     de 3 meses, compensando na ordem do art. 53 — o que o crédito não cobre
     vira guia, e o que sobra fica de saldo. */
  function fctForecast() {
    if (!M.live) return;
    var S = fctSerie(), meses = S.meses, by = S.by;
    if (!meses.length) return;
    var corte = new Date().toISOString().slice(0, 7);
    var real = meses.filter(function (m) { return m <= corte; });
    if (!real.length) real = meses.slice(0, Math.ceil(meses.length / 2));
    var ultimo = real[real.length - 1], ano = +ultimo.slice(0, 4), mUlt = +ultimo.slice(5, 7);
    var fc = []; for (var i = mUlt + 1; i <= 12; i++) fc.push(ano + '-' + pad(i));
    function mm3(arr, n) {
      var buf = arr.slice(), out = [];
      for (var i = 0; i < n; i++) {
        var k = Math.min(3, buf.length); if (!k) { out.push(0); buf.push(0); continue; }
        var s = 0; for (var j = buf.length - k; j < buf.length; j++) s += buf[j];
        var v = Math.round(s / k); out.push(v); buf.push(v);
      }
      return out;
    }
    var credReal = real.map(function (m) { return Math.round(by[m].cred); });
    var debReal = real.map(function (m) { return Math.round(by[m].debCred); });
    var saldoReal = real.map(function (m) { return Math.round(by[m].saldo); });
    var guiaReal = real.map(function (m) { return Math.round(by[m].guia + by[m].venc); });
    var credFc = mm3(credReal, fc.length), debFc = mm3(debReal, fc.length);
    var saldo = saldoReal.length ? saldoReal[saldoReal.length - 1] : 0, saldoFc = [], guiaFc = [];
    debFc.forEach(function (deb, i) {
      var disp = saldo + credFc[i], comp = Math.min(disp, deb);
      saldo = disp - comp; saldoFc.push(Math.round(saldo)); guiaFc.push(Math.round(deb - comp));
    });
    var totCred = credReal.reduce(function (a, b) { return a + b; }, 0);
    var totDeb = debReal.reduce(function (a, b) { return a + b; }, 0);
    var totGuia = guiaReal.reduce(function (a, b) { return a + b; }, 0);
    var saldoHoje = saldoReal.length ? saldoReal[saldoReal.length - 1] : 0;
    var saldoFim = saldoFc.length ? saldoFc[saldoFc.length - 1] : saldoHoje;
    function set(id, v, c) { var e = document.getElementById(id); if (e) { e.textContent = v; if (c) e.style.color = c; } }
    var lblUlt = pad(mUlt) + '/' + ano;
    set('fct-fc-k-cred', fmM(totCred)); set('fct-fc-k-cred-sub', 'apropriado · Jan–' + lblUlt);
    set('fct-fc-k-deb', fmM(totDeb)); set('fct-fc-k-deb-sub', 'que depende de crédito · Jan–' + lblUlt);
    set('fct-fc-k-saldo', fmM(saldoHoje), PALETTE.teal);
    var sSub = document.getElementById('fct-fc-k-saldo-sub'); if (sSub) sSub.textContent = 'saldo credor em ' + lblUlt;
    set('fct-fc-k-fc', fmM(saldoFim), saldoFim >= 0 ? PALETTE.teal : PALETTE.red);
    set('fct-fc-k-fc-sub', 'saldo credor projetado 12/' + ano);
    set('fct-fc-badge', fc.length ? '● Forecast ' + fc[0].slice(5, 7) + '–12/' + ano : '');
    // gráfico: mesma montagem do app, com o saldo credor do motor no lugar do acumulado
    var canvas = document.getElementById('fct-fc-canvas');
    if (canvas && window._renderFcChart && window._prepCanvas && canvas.parentElement && canvas.parentElement.offsetWidth > 10) {
      var todos = real.concat(fc), hz = window._fctForecastHorizonte || 6, de = Math.max(0, todos.length - hz);
      var visLabels = todos.slice(de).map(function (m) { return m.slice(5, 7) + '/' + m.slice(2, 4); });
      var nReal = Math.max(0, real.length - de), cR = [], cF = [], dR = [], dF = [], sR = [], sF = [];
      for (var j = de; j < todos.length; j++) {
        var isR = j < real.length, k = j - real.length;
        cR.push(isR ? credReal[j] : null); cF.push(isR ? null : credFc[k]);
        dR.push(isR ? -debReal[j] : null); dF.push(isR ? null : -debFc[k]);
        sR.push(isR ? saldoReal[j] : null); sF.push(isR ? null : saldoFc[k]);
      }
      if (nReal - 1 >= 0 && nReal - 1 < sF.length) sF[nReal - 1] = sR[nReal - 1];
      var dark = document.documentElement.getAttribute('data-theme') === 'dark'
        || (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme:dark)').matches);
      var H = Math.max(220, Math.min(300, canvas.parentElement.offsetWidth * 0.33));
      window._prepCanvas(canvas, H);
      window._renderFcChart(canvas, '_fctForecastChart', {
        visLabels: visLabels, credRealVis: cR, credFcVis: cF, debRealVis: dR, debFcVis: dF,
        saldoRealVis: sR, saldoFcVis: sF, visNReal: nReal, visNFc: fc.length, fmM: fmM,
        tooltipBg: dark ? '#1c1f2a' : '#ffffff', tooltipBdr: dark ? '#2d3144' : '#e4e6ea',
        tickC: dark ? '#6b7280' : '#9ca3af', gridC: dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)'
      });
    }
    var ins = document.getElementById('fct-fc-insights');
    if (ins) {
      var nGuia = guiaReal.filter(function (v) { return v > 0.5; }).length;
      var mesesGuia = real.filter(function (m) { return by[m].guia + by[m].venc > 0.5; }).map(function (m) { return m.slice(5, 7) + '/' + m.slice(2, 4); });
      var tend = credFc.length ? credFc[credFc.length - 1] - credReal[credReal.length - 1] : 0;
      var ressTotal = real.reduce(function (a, m) { return a + by[m].ress; }, 0);
      var bloco = [
        { cor: nGuia ? PALETTE.amber : PALETTE.teal,
          titulo: nGuia ? 'Guia em ' + nGuia + (nGuia > 1 ? ' meses' : ' mês') : 'Nenhuma guia no período',
          corpo: nGuia ? 'O crédito não cobriu todo o débito em ' + mesesGuia.join(', ') + ' — total de ' + fmM(totGuia) + ' a recolher, pela ordem do art. 53.'
                       : 'Em todos os meses realizados o crédito apropriado cobriu o débito do período.' },
        { cor: tend >= 0 ? PALETTE.teal : PALETTE.red,
          titulo: tend >= 0 ? 'Tendência de crescimento' : 'Tendência de queda',
          corpo: 'Crédito projetado para 12/' + ano + ': ' + fmM(credFc[credFc.length - 1] || 0) + ' (variação ' + (tend >= 0 ? '+' : '') + fmM(tend) + ' contra o último mês realizado).' },
        { cor: PALETTE.teal, titulo: 'Saldo credor projetado 12/' + ano,
          corpo: 'Saldo de ' + fmM(saldoFim) + ' ao fim do exercício, já descontado o que sai para ressarcimento (' + fmM(ressTotal) + ' no período realizado). Projeção por média móvel de 3 meses, compensando na ordem do art. 53.' }
      ];
      ins.innerHTML = bloco.map(function (b) {
        return '<div style="border-left:3px solid ' + b.cor + ';padding:8px 12px;background:var(--bg2,var(--sidebar));border-radius:0 6px 6px 0;font-size:11px">'
          + '<div style="font-weight:700;color:' + b.cor + ';margin-bottom:2px;font-size:12px">' + b.titulo + '</div>'
          + '<div style="color:var(--txt2);line-height:1.5">' + b.corpo + '</div></div>';
      }).join('');
    }
  }
  M.fct = fctRender; M.fctFc = fctForecast;

  M.telas = function () {
    if (!M.live) return;
    ['renderizarTabelaCreditos', 'renderizarTabelaDebitos'].forEach(function (fn) {
      if (typeof window[fn] !== 'function' || window[fn]._mt2) return;
      var o = window[fn], entrada = fn.indexOf('Creditos') > 0;
      window[fn] = function () {
        var r = o.apply(this, arguments);
        try { pintarLinhas(entrada ? 't-creditos' : 't-debitos', entrada); } catch (e) { console.error('[motor] listagem', e); }
        return r;
      };
      window[fn]._mt2 = true;
    });
    ['renderizarFCT', 'renderizarFCTForecast'].forEach(function (fn) {
      if (typeof window[fn] !== 'function' || window[fn]._mt3) return;
      var o = window[fn], ehFc = fn.indexOf('Forecast') > 0;
      window[fn] = function () {
        var r = o.apply(this, arguments);
        try { setTimeout(ehFc ? fctForecast : fctRender, 0); } catch (e) { console.error('[motor] fluxo de caixa', e); }
        return r;
      };
      window[fn]._mt3 = true;
    });
    if (typeof window._rfGerarHistorico === 'function' && !window._rfGerarHistorico._mt2) {
      var gh = window._rfGerarHistorico;
      window._rfGerarHistorico = function (rf, nf) {
        var ev = gh.apply(this, arguments);
        try { return historico(ev, rf, nf); } catch (e) { console.error('[motor] histórico', e); return ev; }
      };
      window._rfGerarHistorico._mt2 = true;
    }
    if (typeof window.abrirDetalheRF === 'function' && !window.abrirDetalheRF._mt2) {
      var ad = window.abrirDetalheRF;
      window.abrirDetalheRF = function () {
        var r = ad.apply(this, arguments);
        try { painelRF(); } catch (e) { console.error('[motor] detalhe', e); }
        return r;
      };
      window.abrirDetalheRF._mt2 = true;
    }
  };
  try { colunas(); } catch (e) { console.error('[motor] colunas', e); }

  /* ── ganchos das telas ───────────────────────────────────────────────── */
  function iniciar() {
    // Apuração: lê o livro do motor depois da sincronização
    if (typeof window.sincronizarApuracao === 'function' && !window.sincronizarApuracao._mt) {
      var sa = window.sincronizarApuracao;
      window.sincronizarApuracao = function () {
        var r = sa.apply(this, arguments);
        if (M.live) { try { M.ajustarApuracao(); if (window.apurRenderAll) window.apurRenderAll(); } catch (e) { console.error('[motor] apuração', e); } }
        return r;
      };
      window.sincronizarApuracao._mt = true;
    }
    // "Não utilizados" do período: só o crédito do próprio período, sem o saldo anterior
    if (typeof window.apurCalcTotals === 'function' && !window.apurCalcTotals._mt) {
      var ct = window.apurCalcTotals;
      window.apurCalcTotals = function (per, tri) {
        var t = ct.apply(this, arguments);
        if (M.live && window.apurData && window.apurData[per]) {
          t.naoUtil = window.apurData[per].creditos.filter(function (c) { return c.tributo === tri && !c.saldoAnterior; }).reduce(function (a, c) { return a + (c.naoUtil || 0); }, 0);
        }
        return t;
      };
      window.apurCalcTotals._mt = true;
    }
    M.telas();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(iniciar, 50); });
  else setTimeout(iniciar, 50);
})();

/* ═══════════════════════════════════════════════════════════════════════════
   Ressarcimento — módulo (protótipo · simulação 2026)
   Saldo credor, intenção, pedido, análise e recebimento, por tributo.
   CBS (Receita Federal) e IBS (Comitê Gestor) são processos independentes:
   nenhum valor deste módulo soma os dois tributos.

   Simulação 2026: pela LC 214/2025 e pelos regulamentos (Decreto 12.955/2026,
   art. 465; Resolução CGIBS 6/2026, art. 466), saldos de 2026 não são
   ressarcidos. Neste protótipo a regra RN-RES-02 está desligada para
   demonstrar o fluxo; nenhum pedido é transmitido ao Fisco.

   Reserva e pedido são marcas sobre o RF apropriado (rf.ressarcimento) e não
   mudam o statusCredito. Só o pagamento extingue o crédito, com
   metodoExtincao = 'Ressarcimento' (D-06 do ciclo de vida, RN-RES-11).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var R = window.shRes = window.shRes || {};
  R.SIMULACAO_2026 = true;          // RN-RES-02 desligada (protótipo)
  R.LIMITE_APROVACAO = { CBS: 1500000, IBS: 1500000 };
  R.tri = R.tri || 'CBS';
  R.aba = R.aba || 'saldo';
  R.intencoes = R.intencoes || [];
  R.pedidos = R.pedidos || [];
  R.recebimentos = R.recebimentos || [];

  var MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var USUARIO = 'José da Silva';
  var CONTA = 'Banco do Brasil · ag. 3421 · cc 48.112-7 (matriz)';
  var ORGAO = { CBS: 'Receita Federal', IBS: 'Comitê Gestor do IBS' };
  var TAXA_SELIC_MES = 0.0112;      // simulada

  /* ── utilitários ─────────────────────────────────────────────────────── */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function money(v) { return 'R$ ' + (Math.round((v || 0) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function moneyC(v) {
    v = v || 0; var a = Math.abs(v);
    if (a >= 1e6) return 'R$ ' + (v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' mi';
    if (a >= 1e3) return 'R$ ' + (v / 1e3).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' mil';
    return money(v);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function d2i(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function i2d(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +(p[2] || 1)); }
  function br(s) { if (!s) return '—'; var p = s.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function addDias(s, n) { var d = i2d(s); d.setDate(d.getDate() + n); return d2i(d); }
  function dias(a, b) { return Math.round((i2d(b) - i2d(a)) / 864e5); }
  function perLbl(k) { var p = k.split('-'); return MES[+p[1] - 1] + '/' + p[0]; }
  function perAdd(k, n) { var p = k.split('-'); var d = new Date(+p[0], +p[1] - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function ultimoDiaUtil(k) { var p = k.split('-'); var d = new Date(+p[0], +p[1], 0); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1); return d2i(d); }
  function diaUtil(k, dia) { var p = k.split('-'); var d = new Date(+p[0], +p[1] - 1, dia); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); return d2i(d); }
  function hoje() {
    var s = d2i(new Date());
    if (s < '2026-06-01') return '2026-06-01';
    if (s > '2026-12-20') return '2026-12-20';
    return s;
  }
  function restam(dt) {
    var n = dias(R.hoje, dt);
    if (n < 0) return '<span class="res-late">vencido há ' + (-n) + ' d</span>';
    if (n === 0) return '<span class="res-warn">vence hoje</span>';
    return '<span class="' + (n <= 7 ? 'res-warn' : 'res-muted') + '">em ' + n + ' d</span>';
  }

  /* ── dados: RFs do tributo ───────────────────────────────────────────── */
  function lista() { return (window._nfListaCompleta && window._nfListaCompleta.length) ? window._nfListaCompleta : (window.nfListaFiltradaGlobal || []); }
  function scOf(rf) { return rf.statusCredito || rf.status || ''; }
  function rfsDo(T) {
    var out = [];
    lista().forEach(function (nf) {
      if (nf.tipo !== 'entrada') return;
      (nf.registrosFiscais || []).forEach(function (rf) {
        if ((rf.tipoFiscal || '').toUpperCase() !== T) return;
        out.push({ rf: rf, nf: nf, per: (rf.data || nf.data || '').slice(0, 7) });
      });
    });
    out.sort(function (a, b) { return a.per < b.per ? -1 : a.per > b.per ? 1 : (a.rf.id < b.rf.id ? -1 : 1); });
    return out;
  }
  // Só entra crédito apropriado até a data do ato — a apropriação é o
  // recolhimento que extingue o débito do fornecedor (LC 214/2025, art. 47).
  function livres(T, ate, dataAto) {
    return rfsDo(T).filter(function (x) {
      if (scOf(x.rf) !== 'apropriado' || x.rf.ressarcimento || x.per > ate) return false;
      var ap = x.rf.dataApropriacao ? String(x.rf.dataApropriacao).slice(0, 10) : null;
      return !dataAto || !ap || ap <= dataAto;
    });
  }
  function soma(arr) { return arr.reduce(function (s, x) { return s + (x.rf.valor || 0); }, 0); }
  function ids(arr) { return arr.map(function (x) { return x.rf.id; }); }
  function doRef(ref) {
    var out = [];
    lista().forEach(function (nf) {
      (nf.registrosFiscais || []).forEach(function (rf) {
        if (rf.ressarcimento && rf.ressarcimento.ref === ref) out.push({ rf: rf, nf: nf, per: (rf.data || nf.data || '').slice(0, 7) });
      });
    });
    return out;
  }
  function doIds(lst) { var ix = idx(); return lst.map(function (id) { var rf = ix[id]; if (!rf) return null; var nf = null; lista().some(function (n) { if ((n.registrosFiscais || []).indexOf(rf) >= 0) { nf = n; return true; } return false; }); return { rf: rf, nf: nf || {}, per: (rf.data || '').slice(0, 7) }; }).filter(Boolean); }
  function marcar(arr, marca, ref, T) { arr.forEach(function (x) { x.rf.ressarcimento = { marca: marca, ref: ref, tributo: T }; }); R._v++; }
  function desmarcar(ref) { doRef(ref).forEach(function (x) { if (x.rf.ressarcimento.marca !== 'ressarcido') delete x.rf.ressarcimento; }); R._v++; }
  function extinguir(arr, ref, T, data) {
    var dfs = [];
    arr.forEach(function (x) {
      var rf = x.rf;
      if (!rf._resOrig) rf._resOrig = { statusCredito: rf.statusCredito, status: rf.status, metodoExtincao: rf.metodoExtincao, dataExtincaoCredito: rf.dataExtincaoCredito, dataExtincao: rf.dataExtincao };
      rf.ressarcimento = { marca: 'ressarcido', ref: ref, tributo: T, data: data };
      rf.statusCredito = 'utilizado';
      rf.status = 'utilizado';
      rf.metodoExtincao = 'Ressarcimento';
      rf.dataExtincaoCredito = data;
      rf.dataExtincao = br(data);
      if (x.nf && dfs.indexOf(x.nf) < 0) dfs.push(x.nf);
    });
    // DF com todos os RFs extintos passa a utilizado; com parte, segue o estado
    // parcial derivado dos RFs (D-05 do ciclo de vida)
    dfs.forEach(function (nf) {
      var rfs = nf.registrosFiscais || [];
      if (!rfs.length || !rfs.every(function (r) { return scOf(r) === 'utilizado'; })) return;
      if (!nf._resOrigDF) nf._resOrigDF = { status: nf.status, statusCredito: nf.statusCredito, metodoExtincao: nf.metodoExtincao, dataExtincaoCredito: nf.dataExtincaoCredito };
      nf.status = 'utilizado'; nf.statusCredito = 'utilizado';
      if (rfs.every(function (r) { return r.metodoExtincao === 'Ressarcimento'; })) nf.metodoExtincao = 'Ressarcimento';
      nf.dataExtincaoCredito = rfs.map(function (r) { return r.dataExtincaoCredito || ''; }).sort().pop() || data;
    });
    R._v++;
  }
  R._v = R._v || 0;

  function limparMarcas(L) {
    L.forEach(function (nf) {
      if (nf._resOrigDF) { var o = nf._resOrigDF; nf.status = o.status; nf.statusCredito = o.statusCredito; nf.metodoExtincao = o.metodoExtincao; nf.dataExtincaoCredito = o.dataExtincaoCredito; delete nf._resOrigDF; }
      (nf.registrosFiscais || []).forEach(function (rf) {
        if (rf._resOrig) { var r = rf._resOrig; rf.statusCredito = r.statusCredito; rf.status = r.status; rf.metodoExtincao = r.metodoExtincao; rf.dataExtincaoCredito = r.dataExtincaoCredito; rf.dataExtincao = r.dataExtincao; delete rf._resOrig; }
        delete rf.ressarcimento;
        delete rf._resEventos;
      });
    });
  }

  /* ── trilha do ressarcimento no RF ──────────────────────────────────────
     Cada ato fica no próprio RF, com a data e o autor, e entra no histórico
     do RF e do DF (_rfGerarHistorico). Nada é reconstruído depois: o que o
     RF viveu — inclusive quando voltou a compensar — continua registrado. */
  function trilha(arr, data, hora, tipo, txt, ator, cls) {
    arr.forEach(function (x) {
      var rf = x.rf || x;
      var t = typeof txt === 'function' ? txt(x) : txt;
      (rf._resEventos = rf._resEventos || []).push({ ts: data + 'T' + hora, tipo: tipo, modulo: 'Ressarcimento', ator: ator || 'SplitHub', desc: t, cls: cls || 'ok' });
    });
  }
  R.historicoRF = function (rf) {
    var F = window._rfFmtTS || function (x) { return x; };
    return (rf._resEventos || []).map(function (e) { return { ts: e.ts, data: F(e.ts), tipo: e.tipo, modulo: e.modulo, ator: e.ator, desc: e.desc, cls: e.cls }; });
  };
  // Relógio das ações do usuário: cada ato ganha um minuto posterior ao anterior,
  // para a trilha nunca inverter a ordem quando os passos são feitos em sequência.
  function agora() {
    var d = new Date(), m = d.getHours() * 60 + d.getMinutes();
    if (R._ultMin != null && m <= R._ultMin) m = R._ultMin + 1;
    if (m > 23 * 60 + 59) m = 23 * 60 + 59;
    R._ultMin = m;
    return pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  }
  function vT(x) { return money(x.rf.valor) + ' de ' + (x.rf.tipoFiscal || '').toUpperCase(); }
  function lgl(T) { return T === 'CBS' ? 'Decreto 12.955/2026, art. 39' : 'Resolução CGIBS 6/2026, art. 39'; }

  // 1. Saldo apurado e intenção declarada (reserva) — e a aprovação, quando exigida
  function passoIntencao(arr, i, hora) {
    // A intenção trava o saldo credor DO PERÍODO. Crédito apropriado depois da
    // declaração (até o fim do período) entra na reserva na data em que nasce.
    var hAprov = hora === '16:00' ? '17:10' : agora();
    var antes = [], depois = [];
    arr.forEach(function (x) { var ap = x.rf.dataApropriacao ? String(x.rf.dataApropriacao).slice(0, 10) : null; (ap && ap > i.declaradaEm ? depois : antes).push(x); });
    trilha(antes, i.declaradaEm, hora, 'RESSARCIMENTO', function (x) {
      return 'Intenção de ressarcimento ' + i.id + ' declarada · crédito de ' + vT(x) + ' reservado no saldo credor de ' + perLbl(i.periodo)
        + ' · deixa de compensar débitos de ' + i.tributo + ' de ' + perLbl(perAdd(i.periodo, 1)) + ' · status do crédito segue Apropriado · ' + lgl(i.tributo) + ', §§ 4º e 5º';
    }, i.por, 'pending');
    if (i.aprovadaPor) trilha(antes, i.declaradaEm, hAprov, 'RESSARCIMENTO',
      'Intenção ' + i.id + ' aprovada — valor acima do limite de ' + moneyC(R.LIMITE_APROVACAO[i.tributo]) + ' (D-03)', i.aprovadaPor, 'ok');
    depois.forEach(function (x) {
      trilha([x], String(x.rf.dataApropriacao).slice(0, 10), '11:40', 'RESSARCIMENTO',
        'Crédito de ' + vT(x) + ' apropriado depois da intenção ' + i.id + ' (declarada em ' + br(i.declaradaEm) + (i.aprovadaPor ? ', aprovada por ' + i.aprovadaPor : '')
        + ') · entra reservado no saldo credor de ' + perLbl(i.periodo) + ' · não compensa débitos de ' + i.tributo + ' de ' + perLbl(perAdd(i.periodo, 1))
        + ' · ' + lgl(i.tributo) + ', §§ 4º e 5º', 'SplitHub', 'pending');
    });
    var fimPer = (function (k) { var p = k.split('-'); return d2i(new Date(+p[0], +p[1], 0)); })(i.periodo);
    if (fimPer >= i.declaradaEm && fimPer <= R.hoje) trilha(arr, fimPer, '23:50', 'RESSARCIMENTO', function (x) {
      return 'Saldo credor de ' + i.tributo + ' de ' + perLbl(i.periodo) + ' apurado em ' + br(fimPer) + ' · crédito de ' + vT(x) + ' segue reservado, fora do transporte para compensação';
    }, 'SplitHub', 'pending');
  }
  // 2. Conferência (CBS) ou impedimentos (IBS), antes do pedido
  function passoVerificacao(arr, p, data, hora) {
    if (p.tributo === 'CBS') trilha(arr, data, hora, 'RESSARCIMENTO', function (x) {
      return 'Conferência com a API de créditos da CBS · saldo do documento confere com a Receita Federal · ' + vT(x) + ' apto ao pedido';
    }, 'Receita Federal', 'ok');
    else trilha(arr, data, hora, 'RESSARCIMENTO',
      'Verificação de impedimentos do IBS · alerta: auto de infração de IBS em contencioso (Resolução CGIBS 6/2026, art. 486, III) — o pedido segue, com risco de indeferimento (D-07)',
      'SplitHub', 'pending');
  }
  // 3. Pedido registrado, com prazo de análise e pagamento por silêncio
  function passoPedido(arr, p, hora, por) {
    trilha(arr, p.protocoladoEm, hora, 'RESSARCIMENTO', function (x) {
      return 'Incluído no pedido ' + p.id + ' · ' + (p.tributo === 'CBS' ? 'PER/DCOMP ' : 'protocolo ') + p.numero + ' · ' + ORGAO[p.tributo]
        + ' · ' + vT(x) + ' bloqueado até a decisão · análise em até ' + p.prazo + ' dias (' + p.base + '), até ' + br(p.fimAnalise)
        + ' · sem resposta, pagamento até ' + br(p.pagSilencio);
    }, por, 'pending');
  }
  // Documento que sai do caminho e volta a compensar
  function passoVolta(arr, data, hora, motivo, ator, cls) {
    trilha(arr, data, hora, 'RESSARCIMENTO', function (x) {
      return motivo + ' · crédito de ' + vT(x) + ' volta a compensar desde ' + br(data) + ' · ' + lgl((x.rf.tipoFiscal || '').toUpperCase()) + ', § 8º';
    }, ator || 'SplitHub', cls || 'ok');
  }
  // 4. Decisão
  function passoDecisao(arr, p, data, hora, txt, cls) { trilha(arr, data, hora, 'RESSARCIMENTO', txt, ORGAO[p.tributo], cls); }
  // 5. Pagamento recebido, conciliado, e extinção do crédito
  function passoPagamento(arr, p, rec, hora) {
    trilha(arr, rec.data, hora || '10:00', 'RESSARCIMENTO', function (x) {
      var s = rec.principal ? Math.round(rec.selic * (x.rf.valor || 0) / rec.principal * 100) / 100 : 0;
      return 'Pagamento do pedido ' + p.id + ' recebido · parcela do documento: ' + money(x.rf.valor) + ' + Selic ' + money(s) + ' = ' + money((x.rf.valor || 0) + s)
        + ' · ' + rec.conta + ' · conciliado em ' + rec.id;
    }, ORGAO[p.tributo], 'ok');
    trilha(arr, rec.data, hora ? agora() : '16:45', 'EXTINÇÃO', function (x) {
      return 'Crédito de ' + vT(x) + ' extinto por ressarcimento · pedido ' + p.id + ' · não abateu débito · método: Ressarcimento · ' + lgl(p.tributo) + ', §§ 15 e 17';
    }, 'SplitHub', 'ok');
  }

  function selic(v, de, ate, diaria) {
    var meses = Math.max(0, Math.floor(dias(de, ate) / 30));
    if (diaria) return Math.round(v * TAXA_SELIC_MES / 30 * dias(de, ate) * 100) / 100;
    return Math.round(v * (TAXA_SELIC_MES * Math.max(0, meses - 1) + 0.01) * 100) / 100;
  }
  function perdcomp(dt, seq) { var p = dt.split('-'); return '24815.0' + (3700 + seq) + '.' + p[2] + p[1] + p[0].slice(2) + '.1.2.57-' + (4400 + seq * 7); }
  function protIbs(seq) { return 'CGIBS-2026-' + String(4800 + seq * 13).padStart(7, '0'); }
  function ev(data, txt, por, tipo) { return { data: data, txt: txt, por: por || 'Sistema', tipo: tipo || 'info' }; }

  /* ── base simulada 2026 ──────────────────────────────────────────────── */
  function seed() {
    var L = lista();
    if (!L.length) return false;
    if (R._seedNf === L[0] && R._seedN === L.length) return true;
    limparMarcas(L);
    R._seedNf = L[0]; R._seedN = L.length;
    R.intencoes = []; R.pedidos = []; R.recebimentos = [];
    R.hoje = hoje(); R.ref = R.hoje.slice(0, 7);
    if (motorVivo()) seedMotor(R.ref); else { seedCBS(R.ref); seedIBS(R.ref); }
    R.impedimentos = [
      { id: 'IMP-01', tributo: 'IBS', tipo: 'Auto de infração de IBS em contencioso', ref: 'AI 2026/000318 · 03/2026', base: 'Resolução CGIBS 6/2026, art. 486, III', efeito: 'Pode levar ao indeferimento, mesmo sem decisão definitiva. Alerta — não bloqueia o pedido (D-07).' }
    ];
    R.conformidade = {
      CBS: { programa: 'Não enquadrada', prazo: 60, base: 'Hipótese do art. 40 da LC 214/2025 — 60 dias' },
      IBS: { programa: 'Não enquadrada', prazo: 180, base: 'Demais hipóteses — 180 dias' }
    };
    return true;
  }


  /* ── base do ressarcimento sobre o motor (validação local, chave ligada) ──
     O motor já escolheu, na ordem do art. 53, o saldo que sobra em cada período
     e quais créditos vão para intenção e pedido. Aqui só se registram os atos —
     datas, valores, trilha — e se extingue o que foi pago. */
  function motorVivo() { return !!(window.shMotor && window.shMotor.live); }
  function seedMotor(ref) {
    var P = window.shMotor.live.plano, seq = 1;
    function g(id) { return P[id]; }
    function L_(ids) { return doIds(ids || []); }
    function sem(a, ids) { return a.filter(function (x) { return ids.indexOf(x.rf.id) < 0; }); }
    // ── CBS
    var T = 'CBS', p1 = perAdd(ref, -4), r1 = g('PED-CBS-' + p1);
    if (r1 && r1.sel.length) {
      var l1 = L_(r1.livres), it1 = L_(r1.sel), fora1 = sem(l1, r1.sel);
      var v1 = soma(it1), i1 = ultimoDiaUtil(p1), pr1 = diaUtil(perAdd(p1, 1), 22), dc1 = addDias(pr1, 49), pg1 = addDias(dc1, 14);
      var pedId = 'PED-CBS-' + p1, sel1 = selic(v1, pr1, pg1, false);
      var int1 = { id: 'INT-CBS-' + p1, tributo: T, periodo: p1, valor: soma(l1), declaradaEm: i1, prazoPedido: ultimoDiaUtil(perAdd(p1, 1)), status: 'convertida', por: 'Maria Costa', aprovadaPor: 'Rafael Lima', pedidoId: pedId };
      var ped1 = { id: pedId, tributo: T, periodo: p1, numero: perdcomp(pr1, seq++), valor: v1, protocoladoEm: pr1, prazo: 60, base: 'Art. 40 da LC 214/2025', fimAnalise: addDias(pr1, 60), pagSilencio: addDias(pr1, 75), status: 'pago', deferido: v1, decididoEm: dc1, pagoEm: pg1, rfs: ids(it1), excluidos: [],
        hist: [ev(i1, 'Intenção declarada · ' + money(soma(l1)), 'Maria Costa'), ev(addDias(i1, 1), 'Intenção aprovada (acima do limite)', 'Rafael Lima'), ev(addDias(pr1, -2), 'Conferência com a API de créditos da CBS: todos os documentos conferem', 'Receita Federal', 'ok'), ev(pr1, 'Pedido transmitido · PER/DCOMP registrado · ' + money(v1) + (fora1.length ? ' · remanescente volta a compensar' : ''), 'Maria Costa'), ev(dc1, 'Deferido integral pela Receita Federal', 'Receita Federal', 'ok'), ev(pg1, 'Pagamento recebido e conciliado · Selic ' + money(sel1), 'José da Silva', 'ok')] };
      var rec1 = { id: 'REC-CBS-' + p1, pedidoId: pedId, tributo: T, data: pg1, principal: v1, selic: sel1, total: v1 + sel1, conta: CONTA, conciliado: true };
      R.intencoes.push(int1); R.pedidos.push(ped1); R.recebimentos.push(rec1);
      passoIntencao(l1, int1, '16:00');
      passoVerificacao(it1, ped1, addDias(pr1, -2), '14:00');
      passoPedido(it1, ped1, '16:30', 'Maria Costa');
      passoVolta(fora1, pr1, '16:35', 'Não incluído no pedido parcial ' + pedId, 'Maria Costa');
      passoDecisao(it1, ped1, dc1, '11:00', 'Pedido ' + pedId + ' deferido integral pela Receita Federal · pagamento em até 15 dias', 'ok');
      passoPagamento(it1, ped1, rec1);
      extinguir(it1, pedId, T, pg1);
    }
    var p2 = perAdd(ref, -2), r2 = g('PED-CBS-' + p2);
    if (r2 && r2.sel.length) {
      var l2 = L_(r2.livres), it2 = L_(r2.sel), div = r2.div ? L_([r2.div])[0] : null;
      var fora2 = sem(sem(l2, r2.sel), div ? [div.rf.id] : []);
      var v2 = soma(it2), i2 = ultimoDiaUtil(p2), pr2 = diaUtil(perAdd(p2, 1), 20), pedId2 = 'PED-CBS-' + p2;
      var int2 = { id: 'INT-CBS-' + p2, tributo: T, periodo: p2, valor: soma(l2), declaradaEm: i2, prazoPedido: ultimoDiaUtil(perAdd(p2, 1)), status: 'convertida', por: 'Maria Costa', aprovadaPor: 'Rafael Lima', pedidoId: pedId2 };
      var ped2 = { id: pedId2, tributo: T, periodo: p2, numero: perdcomp(pr2, seq++), valor: v2, protocoladoEm: pr2, prazo: 60, base: 'Art. 40 da LC 214/2025', fimAnalise: addDias(pr2, 60), pagSilencio: addDias(pr2, 75), status: 'em_analise', deferido: 0, rfs: ids(it2),
        excluidos: div ? [{ rfId: div.rf.id, doc: (div.nf.tipoDF || 'NF-e') + ' ' + div.nf.numero, valor: div.rf.valor, motivo: 'Saldo divergente na API de créditos da CBS' }] : [],
        hist: [ev(i2, 'Intenção declarada · ' + money(soma(l2)), 'Maria Costa'), ev(addDias(i2, 1), 'Intenção aprovada (acima do limite)', 'Rafael Lima')] };
      if (div) ped2.hist.push(ev(addDias(pr2, -2), 'Conferência com a Receita: 1 documento divergente excluído do pedido', 'Sistema', 'warn'));
      ped2.hist.push(ev(pr2, 'Pedido parcial transmitido · ' + money(v2) + ' · remanescente volta a compensar', 'Maria Costa'));
      R.intencoes.push(int2); R.pedidos.push(ped2);
      passoIntencao(l2, int2, '16:00');
      passoVerificacao(it2.concat(fora2), ped2, addDias(pr2, -2), '14:00');
      if (div) {
        trilha([div], addDias(pr2, -2), '14:05', 'RESSARCIMENTO', 'Conferência com a API de créditos da CBS · saldo do documento diverge da Receita Federal · excluído do pedido ' + pedId2 + ' (D-06) · inconsistência aberta', 'Receita Federal', 'erro');
        passoVolta([div], addDias(pr2, -2), '14:06', 'Excluído do pedido por divergência com a Receita', 'SplitHub', 'erro');
        R._divergente = { rfId: div.rf.id, nf: div.nf, rf: div.rf, pedidoId: pedId2 };
      }
      passoPedido(it2, ped2, '16:30', 'Maria Costa');
      passoVolta(fora2, pr2, '16:35', 'Não incluído no pedido parcial ' + pedId2, 'Maria Costa');
      marcar(it2, 'em_pedido', pedId2, T);
    }
    var p3 = perAdd(ref, -1), r3 = g('INT-CBS-' + p3);
    if (r3 && r3.sel.length) {
      var l3 = L_(r3.sel), i3 = ultimoDiaUtil(p3);
      var int3 = { id: 'INT-CBS-' + p3, tributo: T, periodo: p3, valor: soma(l3), declaradaEm: i3, prazoPedido: ultimoDiaUtil(perAdd(p3, 1)), status: 'declarada', por: 'Maria Costa', aprovadaPor: 'Rafael Lima' };
      R.intencoes.push(int3);
      passoIntencao(l3, int3, '16:00');
      marcar(l3, 'reservado', int3.id, T);
    }
    // ── IBS
    T = 'IBS';
    var q1 = perAdd(ref, -4), s1 = g('PED-IBS-' + q1);
    if (s1 && s1.sel.length) {
      var m1 = L_(s1.livres), j1 = L_(s1.sel), out1 = sem(m1, s1.sel);
      var naoRec = s1.volta ? L_([s1.volta]) : [], def = sem(j1, s1.volta ? [s1.volta] : []);
      var w1 = soma(j1), vd = soma(def);
      var h1 = ultimoDiaUtil(q1), pq1 = diaUtil(perAdd(q1, 1), 24), dq1 = diaUtil(perAdd(q1, 3), 3), pgq1 = addDias(dq1, 13);
      var pid = 'PED-IBS-' + q1, sq1 = selic(vd, pq1, pgq1, false);
      var iq1 = { id: 'INT-IBS-' + q1, tributo: T, periodo: q1, valor: soma(m1), declaradaEm: h1, prazoPedido: ultimoDiaUtil(perAdd(q1, 1)), status: 'convertida', por: 'Ana Ferreira', aprovadaPor: 'Rafael Lima', pedidoId: pid };
      var pd1 = { id: pid, tributo: T, periodo: q1, numero: protIbs(1), valor: w1, protocoladoEm: pq1, prazo: 180, base: 'Demais hipóteses — 180 dias', fimAnalise: addDias(pq1, 180), pagSilencio: addDias(pq1, 195), status: 'pago', deferido: vd, decididoEm: dq1, pagoEm: pgq1, rfs: ids(j1), excluidos: [],
        hist: [ev(h1, 'Intenção declarada · ' + money(soma(m1)), 'Ana Ferreira'), ev(addDias(pq1, -1), 'Verificação de impedimentos: 1 alerta (auto de infração em contencioso)', 'Sistema', 'warn'), ev(pq1, 'Pedido registrado · protocolo do Comitê Gestor · ' + money(w1), 'Ana Ferreira'), ev(dq1, 'Deferido parcial · ' + money(vd) + ' · ' + naoRec.length + ' documento não reconhecido', 'Comitê Gestor do IBS', 'warn'), ev(dq1, 'Remanescente de ' + money(w1 - vd) + ' volta a compensar desde a decisão', 'Sistema'), ev(pgq1, 'Pagamento recebido e conciliado · Selic ' + money(sq1), 'José da Silva', 'ok')] };
      var rq1 = { id: 'REC-IBS-' + q1, pedidoId: pid, tributo: T, data: pgq1, principal: vd, selic: sq1, total: vd + sq1, conta: CONTA, conciliado: true };
      R.intencoes.push(iq1); R.pedidos.push(pd1); R.recebimentos.push(rq1);
      passoIntencao(m1, iq1, '16:00');
      passoVerificacao(j1, pd1, addDias(pq1, -1), '14:00');
      passoPedido(j1, pd1, '16:30', 'Ana Ferreira');
      passoVolta(out1, pq1, '16:35', 'Não incluído no pedido parcial ' + pid, 'Ana Ferreira');
      passoDecisao(def, pd1, dq1, '11:00', 'Pedido ' + pid + ' deferido parcialmente pelo Comitê Gestor do IBS · crédito do documento reconhecido · pagamento em até 15 dias', 'ok');
      passoDecisao(naoRec, pd1, dq1, '11:00', 'Pedido ' + pid + ' deferido parcialmente · crédito do documento não reconhecido no ressarcimento', 'erro');
      passoVolta(naoRec, dq1, '11:05', 'Não reconhecido no deferimento parcial', 'Comitê Gestor do IBS', 'ok');
      passoPagamento(def, pd1, rq1);
      extinguir(def, pid, T, pgq1);
    }
    var q2 = perAdd(ref, -3), s2 = g('INT-IBS-' + q2);
    if (s2 && s2.livres.length) {
      var m2 = L_(s2.livres), h2 = ultimoDiaUtil(q2), canc = addDias(h2, 12);
      var iq2 = { id: 'INT-IBS-' + q2, tributo: T, periodo: q2, valor: soma(m2), declaradaEm: h2, prazoPedido: ultimoDiaUtil(perAdd(q2, 1)), status: 'cancelada', por: 'Ana Ferreira', aprovadaPor: 'Rafael Lima', canceladaEm: canc, motivo: 'Débitos de IBS do mês seguinte absorveriam o saldo' };
      R.intencoes.push(iq2);
      passoIntencao(m2, iq2, '16:00');
      passoVolta(m2, canc, '10:30', 'Intenção ' + iq2.id + ' cancelada por Ana Ferreira — débitos de IBS do mês seguinte absorveriam o saldo', 'Ana Ferreira', 'ok');
    }
    var q3 = perAdd(ref, -2), s3 = g('PED-IBS-' + q3);
    if (s3 && s3.sel.length) {
      var m3 = L_(s3.livres), j3 = L_(s3.sel), out3 = sem(m3, s3.sel);
      var w3 = soma(j3), h3 = ultimoDiaUtil(q3), pq3 = diaUtil(perAdd(q3, 1), 26), pid3 = 'PED-IBS-' + q3;
      var iq3 = { id: 'INT-IBS-' + q3, tributo: T, periodo: q3, valor: soma(m3), declaradaEm: h3, prazoPedido: ultimoDiaUtil(perAdd(q3, 1)), status: 'convertida', por: 'Ana Ferreira', aprovadaPor: 'Rafael Lima', pedidoId: pid3 };
      var pd3 = { id: pid3, tributo: T, periodo: q3, numero: protIbs(2), valor: w3, protocoladoEm: pq3, prazo: 180, base: 'Demais hipóteses — 180 dias', fimAnalise: addDias(pq3, 180), pagSilencio: addDias(pq3, 195), status: 'em_analise', deferido: 0, rfs: ids(j3), excluidos: [],
        hist: [ev(h3, 'Intenção declarada · ' + money(soma(m3)), 'Ana Ferreira'), ev(addDias(pq3, -1), 'Verificação de impedimentos: 1 alerta (auto de infração em contencioso)', 'Sistema', 'warn'), ev(pq3, 'Pedido parcial registrado · protocolo do Comitê Gestor', 'Ana Ferreira')] };
      R.intencoes.push(iq3); R.pedidos.push(pd3);
      passoIntencao(m3, iq3, '16:00');
      passoVerificacao(j3, pd3, addDias(pq3, -1), '14:00');
      passoPedido(j3, pd3, '16:30', 'Ana Ferreira');
      passoVolta(out3, pq3, '16:35', 'Não incluído no pedido parcial ' + pid3, 'Ana Ferreira');
      marcar(j3, 'em_pedido', pid3, T);
    }
  }

  function seedCBS(ref) {
    var T = 'CBS', seq = 1;
    // 1) Pedido pago, integral — ref-4
    var p1 = perAdd(ref, -4);
    if (p1 >= '2026-01') {
      var i1 = addDias(ultimoDiaUtil(p1), -2);
      var l1 = livres(T, p1, i1), it1 = l1.slice(0, Math.max(1, Math.round(l1.length * 0.6))), fora1 = l1.slice(it1.length);
      if (it1.length) {
        var v1 = soma(it1), pr1 = diaUtil(perAdd(p1, 1), 22), dc1 = addDias(pr1, 49), pg1 = addDias(dc1, 14);
        var intId = 'INT-CBS-' + p1, pedId = 'PED-CBS-' + p1, sel1 = selic(v1, pr1, pg1, false);
        var int1 = { id: intId, tributo: T, periodo: p1, valor: soma(l1), declaradaEm: i1, prazoPedido: ultimoDiaUtil(perAdd(p1, 1)), status: 'convertida', por: 'Maria Costa', aprovadaPor: 'Rafael Lima', pedidoId: pedId };
        var ped1 = { id: pedId, tributo: T, periodo: p1, numero: perdcomp(pr1, seq++), valor: v1, protocoladoEm: pr1, prazo: 60, base: 'Art. 40 da LC 214/2025', fimAnalise: addDias(pr1, 60), pagSilencio: addDias(pr1, 75), status: 'pago', deferido: v1, decididoEm: dc1, pagoEm: pg1, rfs: ids(it1), excluidos: [],
          hist: [ev(i1, 'Intenção declarada · ' + money(soma(l1)), 'Maria Costa'), ev(addDias(i1, 1), 'Intenção aprovada (acima do limite)', 'Rafael Lima'), ev(addDias(pr1, -2), 'Conferência com a API de créditos da CBS: todos os documentos conferem', 'Receita Federal', 'ok'), ev(pr1, 'Pedido transmitido · PER/DCOMP registrado · ' + money(v1) + (fora1.length ? ' · remanescente volta a compensar' : ''), 'Maria Costa'), ev(dc1, 'Deferido integral pela Receita Federal', 'Receita Federal', 'ok'), ev(pg1, 'Pagamento recebido e conciliado · Selic ' + money(sel1), 'José da Silva', 'ok')] };
        var rec1 = { id: 'REC-CBS-' + p1, pedidoId: pedId, tributo: T, data: pg1, principal: v1, selic: sel1, total: v1 + sel1, conta: CONTA, conciliado: true };
        R.intencoes.push(int1); R.pedidos.push(ped1); R.recebimentos.push(rec1);
        passoIntencao(l1, int1, '16:00');
        passoVerificacao(it1, ped1, addDias(pr1, -2), '14:00');
        passoPedido(it1, ped1, '16:30', 'Maria Costa');
        passoVolta(fora1, pr1, '16:35', 'Não incluído no pedido parcial ' + pedId, 'Maria Costa');
        passoDecisao(it1, ped1, dc1, '11:00', 'Pedido ' + pedId + ' deferido integral pela Receita Federal · pagamento em até 15 dias', 'ok');
        passoPagamento(it1, ped1, rec1);
        extinguir(it1, pedId, T, pg1);
      }
    }
    // 2) Pedido em análise, parcial — ref-2 (1 documento divergente da Receita, excluído)
    var p2 = perAdd(ref, -2);
    if (p2 >= '2026-01') {
      var i2 = addDias(ultimoDiaUtil(p2), -1);
      var l2 = livres(T, p2, i2);
      var div = l2.length > 2 ? l2[l2.length - 1] : null;
      var base2 = div ? l2.slice(0, -1) : l2;
      var it2 = base2.slice(0, Math.max(1, Math.round(base2.length * 0.7))), fora2 = base2.slice(it2.length);
      if (it2.length) {
        var v2 = soma(it2), pr2 = diaUtil(perAdd(p2, 1), 20);
        var intId2 = 'INT-CBS-' + p2, pedId2 = 'PED-CBS-' + p2;
        var int2 = { id: intId2, tributo: T, periodo: p2, valor: soma(l2), declaradaEm: i2, prazoPedido: ultimoDiaUtil(perAdd(p2, 1)), status: 'convertida', por: 'Maria Costa', aprovadaPor: 'Rafael Lima', pedidoId: pedId2 };
        var ped2 = { id: pedId2, tributo: T, periodo: p2, numero: perdcomp(pr2, seq++), valor: v2, protocoladoEm: pr2, prazo: 60, base: 'Art. 40 da LC 214/2025', fimAnalise: addDias(pr2, 60), pagSilencio: addDias(pr2, 75), status: 'em_analise', deferido: 0, rfs: ids(it2),
          excluidos: div ? [{ rfId: div.rf.id, doc: (div.nf.tipoDF || 'NF-e') + ' ' + div.nf.numero, valor: div.rf.valor, motivo: 'Saldo divergente na API de créditos da CBS' }] : [],
          hist: [ev(i2, 'Intenção declarada · ' + money(soma(l2)), 'Maria Costa'), ev(addDias(i2, 1), 'Intenção aprovada (acima do limite)', 'Rafael Lima')] };
        if (div) ped2.hist.push(ev(addDias(pr2, -2), 'Conferência com a Receita: 1 documento divergente excluído do pedido', 'Sistema', 'warn'));
        ped2.hist.push(ev(pr2, 'Pedido parcial transmitido · ' + money(v2) + ' · remanescente volta a compensar', 'Maria Costa'));
        R.intencoes.push(int2); R.pedidos.push(ped2);
        passoIntencao(l2, int2, '16:00');
        passoVerificacao(it2.concat(fora2), ped2, addDias(pr2, -2), '14:00');
        if (div) {
          trilha([div], addDias(pr2, -2), '14:05', 'RESSARCIMENTO', function (x) {
            return 'Conferência com a API de créditos da CBS · saldo do documento diverge da Receita Federal · excluído do pedido ' + pedId2 + ' (D-06) · inconsistência aberta';
          }, 'Receita Federal', 'erro');
          passoVolta([div], addDias(pr2, -2), '14:06', 'Excluído do pedido por divergência com a Receita', 'SplitHub', 'erro');
        }
        passoPedido(it2, ped2, '16:30', 'Maria Costa');
        passoVolta(fora2, pr2, '16:35', 'Não incluído no pedido parcial ' + pedId2, 'Maria Costa');
        marcar(it2, 'em_pedido', pedId2, T);
        if (div) R._divergente = { rfId: div.rf.id, nf: div.nf, rf: div.rf, pedidoId: pedId2 };
      }
    }
    // 3) Intenção declarada, pedido pendente — ref-1
    var p3 = perAdd(ref, -1);
    if (p3 >= '2026-01') {
      var i3 = addDias(ultimoDiaUtil(p3), -1);
      var l3 = livres(T, p3, i3);
      if (l3.length) {
        var int3 = { id: 'INT-CBS-' + p3, tributo: T, periodo: p3, valor: soma(l3), declaradaEm: i3, prazoPedido: ultimoDiaUtil(perAdd(p3, 1)), status: 'declarada', por: 'Maria Costa', aprovadaPor: 'Rafael Lima' };
        R.intencoes.push(int3);
        passoIntencao(l3, int3, '16:00');
        marcar(l3, 'reservado', int3.id, T);
      }
    }
  }

  function seedIBS(ref) {
    var T = 'IBS';
    // 1) Deferido parcial e pago — ref-4
    var p1 = perAdd(ref, -4);
    if (p1 >= '2026-01') {
      var i1 = addDias(ultimoDiaUtil(p1), -3);
      var l1 = livres(T, p1, i1), it1 = l1.slice(0, Math.max(1, Math.round(l1.length * 0.6))), fora1 = l1.slice(it1.length);
      if (it1.length) {
        var v1 = soma(it1), def = it1.length > 1 ? it1.slice(0, it1.length - 1) : it1, naoRec = it1.slice(def.length), vd = soma(def);
        var pr1 = diaUtil(perAdd(p1, 1), 24), dc1 = addDias(pr1, 68), pg1 = addDias(dc1, 13);
        var pedId = 'PED-IBS-' + p1, sel1 = selic(vd, pr1, pg1, false);
        var int1 = { id: 'INT-IBS-' + p1, tributo: T, periodo: p1, valor: soma(l1), declaradaEm: i1, prazoPedido: ultimoDiaUtil(perAdd(p1, 1)), status: 'convertida', por: 'Ana Ferreira', aprovadaPor: 'Rafael Lima', pedidoId: pedId };
        var ped1 = { id: pedId, tributo: T, periodo: p1, numero: protIbs(1), valor: v1, protocoladoEm: pr1, prazo: 180, base: 'Demais hipóteses — 180 dias', fimAnalise: addDias(pr1, 180), pagSilencio: addDias(pr1, 195), status: 'pago', deferido: vd, decididoEm: dc1, pagoEm: pg1, rfs: ids(it1), excluidos: [],
          hist: [ev(i1, 'Intenção declarada · ' + money(soma(l1)), 'Ana Ferreira'), ev(addDias(pr1, -1), 'Verificação de impedimentos: 1 alerta (auto de infração em contencioso)', 'Sistema', 'warn'), ev(pr1, 'Pedido registrado · protocolo do Comitê Gestor · ' + money(v1), 'Ana Ferreira'), ev(dc1, 'Deferido parcial · ' + money(vd) + ' · ' + naoRec.length + ' documento não reconhecido', 'Comitê Gestor do IBS', 'warn'), ev(dc1, 'Remanescente de ' + money(v1 - vd) + ' volta a compensar desde a decisão', 'Sistema'), ev(pg1, 'Pagamento recebido e conciliado · Selic ' + money(sel1), 'José da Silva', 'ok')] };
        var rec1 = { id: 'REC-IBS-' + p1, pedidoId: pedId, tributo: T, data: pg1, principal: vd, selic: sel1, total: vd + sel1, conta: CONTA, conciliado: true };
        R.intencoes.push(int1); R.pedidos.push(ped1); R.recebimentos.push(rec1);
        passoIntencao(l1, int1, '16:00');
        passoVerificacao(it1, ped1, addDias(pr1, -1), '14:00');
        passoPedido(it1, ped1, '16:30', 'Ana Ferreira');
        passoVolta(fora1, pr1, '16:35', 'Não incluído no pedido parcial ' + pedId, 'Ana Ferreira');
        passoDecisao(def, ped1, dc1, '11:00', 'Pedido ' + pedId + ' deferido parcialmente pelo Comitê Gestor do IBS · crédito do documento reconhecido · pagamento em até 15 dias', 'ok');
        passoDecisao(naoRec, ped1, dc1, '11:00', 'Pedido ' + pedId + ' deferido parcialmente · crédito do documento não reconhecido no ressarcimento', 'erro');
        passoVolta(naoRec, dc1, '11:05', 'Não reconhecido no deferimento parcial', 'Comitê Gestor do IBS', 'ok');
        passoPagamento(def, ped1, rec1);
        extinguir(def, pedId, T, pg1);
      }
    }
    // 2) Intenção cancelada — ref-3
    var p2 = perAdd(ref, -3);
    if (p2 >= '2026-01') {
      var i2 = addDias(ultimoDiaUtil(p2), -4);
      var l2 = livres(T, p2, i2);
      if (l2.length) {
        var canc = addDias(i2, 12);
        var int2 = { id: 'INT-IBS-' + p2, tributo: T, periodo: p2, valor: soma(l2), declaradaEm: i2, prazoPedido: ultimoDiaUtil(perAdd(p2, 1)), status: 'cancelada', por: 'Ana Ferreira', aprovadaPor: 'Rafael Lima', canceladaEm: canc, motivo: 'Débitos de IBS do mês seguinte absorveriam o saldo' };
        R.intencoes.push(int2);
        passoIntencao(l2, int2, '16:00');
        passoVolta(l2, canc, '10:30', 'Intenção ' + int2.id + ' cancelada por Ana Ferreira — débitos de IBS do mês seguinte absorveriam o saldo', 'Ana Ferreira', 'ok');
      }
    }
    // 3) Pedido em análise — ref-2
    var p3 = perAdd(ref, -2);
    if (p3 >= '2026-01') {
      var i3 = addDias(ultimoDiaUtil(p3), -2);
      var l3 = livres(T, p3, i3), it3 = l3.slice(0, Math.max(1, Math.round(l3.length * 0.5))), fora3 = l3.slice(it3.length);
      if (it3.length) {
        var v3 = soma(it3), pr3 = diaUtil(perAdd(p3, 1), 26), pedId3 = 'PED-IBS-' + p3;
        var int3 = { id: 'INT-IBS-' + p3, tributo: T, periodo: p3, valor: soma(l3), declaradaEm: i3, prazoPedido: ultimoDiaUtil(perAdd(p3, 1)), status: 'convertida', por: 'Ana Ferreira', aprovadaPor: 'Rafael Lima', pedidoId: pedId3 };
        var ped3 = { id: pedId3, tributo: T, periodo: p3, numero: protIbs(2), valor: v3, protocoladoEm: pr3, prazo: 180, base: 'Demais hipóteses — 180 dias', fimAnalise: addDias(pr3, 180), pagSilencio: addDias(pr3, 195), status: 'em_analise', deferido: 0, rfs: ids(it3), excluidos: [],
          hist: [ev(i3, 'Intenção declarada · ' + money(soma(l3)), 'Ana Ferreira'), ev(addDias(pr3, -1), 'Verificação de impedimentos: 1 alerta (auto de infração em contencioso)', 'Sistema', 'warn'), ev(pr3, 'Pedido parcial registrado · protocolo do Comitê Gestor', 'Ana Ferreira')] };
        R.intencoes.push(int3); R.pedidos.push(ped3);
        passoIntencao(l3, int3, '16:00');
        passoVerificacao(it3, ped3, addDias(pr3, -1), '14:00');
        passoPedido(it3, ped3, '16:30', 'Ana Ferreira');
        passoVolta(fora3, pr3, '16:35', 'Não incluído no pedido parcial ' + pedId3, 'Ana Ferreira');
        marcar(it3, 'em_pedido', pedId3, T);
      }
    }
  }

  /* ── regras de prazo ─────────────────────────────────────────────────── */
  function atualizarPrazos() {
    R.intencoes.forEach(function (i) {
      if (i.status === 'declarada' && R.hoje > i.prazoPedido) {
        i.status = 'vencida';
        passoVolta(doRef(i.id), addDias(i.prazoPedido, 1), '00:05', 'Intenção ' + i.id + ' vencida sem pedido até ' + br(i.prazoPedido), 'SplitHub', 'ok');
        desmarcar(i.id);
      }
    });
  }

  /* ── cálculo por período ─────────────────────────────────────────────── */
  // Valor que sai do saldo no período k: pedido (bloqueado ou deferido) ou intenção declarada.
  // A Apuração usa o mesmo cálculo para o transporte (sincronizarApuracao).
  function saidaDe(T, k) {
    if (motorVivo()) {
      var pm = window.shMotor.live.porMes[T + '|' + k], base = saidaBase(T, k);
      base.valor = pm ? (pm.ressarcimento || 0) : 0;
      return base;
    }
    return saidaBase(T, k);
  }
  function saidaBase(T, k) {
    var ped = R.pedidos.filter(function (p) { return p.tributo === T && p.periodo === k && p.status !== 'cancelado' && p.status !== 'indeferido'; })[0];
    var ints = R.intencoes.filter(function (i) { return i.tributo === T && i.periodo === k; });
    var intc = ints[ints.length - 1];
    if (ped) return { valor: /^(pago|deferido|deferido_parcial)$/.test(ped.status) ? (ped.deferido || 0) : ped.valor, destino: 'pedido', ped: ped, intc: intc };
    if (intc && intc.status === 'declarada') return { valor: intc.valor, destino: 'intencao', ped: null, intc: intc };
    return { valor: 0, destino: intc ? intc.status : 'compensacao', ped: null, intc: intc };
  }
  function chaveDe(k) { if (k.indexOf('/') < 0) return k; var p = k.split('/'); return p[1] + '-' + pad(MES.indexOf(p[0]) + 1); }
  R.saidaPeriodo = function (T, k) { if (!garantir()) return 0; return saidaDe(T, chaveDe(k)).valor; };
  R.aplicarNaBase = function () { R._viaBase = true; garantir(); };

  function periodos(T) {
    if (motorVivo()) {
      var V = window.shMotor.live, todos = rfsDo(T), res = [];
      for (var km = '2026-01'; km <= R.ref; km = perAdd(km, 1)) {
        var kk = km, ap = 0;
        todos.forEach(function (x) {
          var s = scOf(x.rf); if (s !== 'apropriado' && s !== 'utilizado') return;
          var per = (V.op.periodo === 'apropriacao' && x.rf.dataApropriacao ? String(x.rf.dataApropriacao) : String(x.rf.data || x.nf.data)).slice(0, 7);
          if (per === kk) ap += x.rf.valor || 0;
        });
        var pm = V.porMes[T + '|' + kk] || {}, pa = V.porMes[T + '|' + perAdd(kk, -1)] || {};
        var ini0 = pa.saldoCredor || 0, dev = pm.devolvido || 0, comp0 = pm.compensado || 0, saida0 = pm.ressarcimento || 0;
        var transp0 = pm.saldoCredor != null ? pm.saldoCredor : ini0 + ap + dev - comp0 - saida0;
        var sd0 = saidaDe(T, kk);
        res.push({ k: kk, ini: ini0, aprop: ap + dev, comp: comp0, fim: transp0 + saida0, saida: saida0, transp: transp0, destino: sd0.destino, ped: sd0.ped, intc: sd0.intc, dev: dev });
      }
      return res;
    }
    var all = rfsDo(T), out = [], ini = 0;
    for (var k = '2026-01'; k <= R.ref; k = perAdd(k, 1)) {
      var aprop = 0, comp = 0;
      all.forEach(function (x) {
        if (x.per !== k) return;
        var s = scOf(x.rf);
        if (s === 'apropriado' || s === 'utilizado') {
          aprop += x.rf.valor || 0;
          if (s === 'utilizado' && x.rf.metodoExtincao !== 'Ressarcimento') comp += x.rf.valor || 0;
        }
      });
      var fim = ini + aprop - comp;
      var sd = saidaDe(T, k), ped = sd.ped, intc = sd.intc, saida = sd.valor, destino = sd.destino;
      out.push({ k: k, ini: ini, aprop: aprop, comp: comp, fim: fim, saida: saida, transp: fim - saida, destino: destino, ped: ped, intc: intc });
      ini = fim - saida;
    }
    return out;
  }

  R.periodos = function (T) { garantir(); return periodos(T); };
  R.resumo = function (T) { garantir(); return resumo(T); };

  function resumo(T) {
    var ps = periodos(T), atual = ps[ps.length - 1] || { transp: 0, fim: 0 };
    var reservado = R.intencoes.filter(function (i) { return i.tributo === T && i.status === 'declarada'; }).reduce(function (s, i) { return s + i.valor; }, 0);
    var abertos = R.pedidos.filter(function (p) { return p.tributo === T && /^(em_analise|exigencia|fiscalizacao|deferido|deferido_parcial)$/.test(p.status); });
    var emPedido = abertos.reduce(function (s, p) { return s + (/^deferido/.test(p.status) ? p.deferido : p.valor); }, 0);
    var recs = R.recebimentos.filter(function (r) { return r.tributo === T; });
    var recebido = recs.reduce(function (s, r) { return s + r.total; }, 0);
    var selicTot = recs.reduce(function (s, r) { return s + r.selic; }, 0);
    return { periodos: ps, atual: atual, disponivel: atual.transp, reservado: reservado, emPedido: emPedido, abertos: abertos, recebido: recebido, selic: selicTot, prazos: prazos(T) };
  }

  function prazos(T) {
    var out = [];
    var temInt = R.intencoes.some(function (i) { return i.tributo === T && i.periodo === R.ref && i.status !== 'cancelada'; });
    if (!temInt) out.push({ data: ultimoDiaUtil(R.ref), txt: 'Intenção de ' + perLbl(R.ref), tipo: 'intencao' });
    R.intencoes.forEach(function (i) { if (i.tributo === T && i.status === 'declarada') out.push({ data: i.prazoPedido, txt: 'Pedido de ' + perLbl(i.periodo), tipo: 'pedido' }); });
    R.pedidos.forEach(function (p) {
      if (p.tributo !== T) return;
      if (/^(em_analise|exigencia)$/.test(p.status)) { out.push({ data: p.fimAnalise, txt: 'Fim da análise · ' + p.id, tipo: 'analise' }); out.push({ data: p.pagSilencio, txt: 'Pagamento por silêncio · ' + p.id, tipo: 'silencio' }); }
      if (p.status === 'fiscalizacao') out.push({ data: addDias(p.fiscalizacaoEm, 360), txt: 'Limite da fiscalização · ' + p.id, tipo: 'fiscalizacao' });
    });
    return out.filter(function (x) { return x.data >= R.hoje; }).sort(function (a, b) { return a.data < b.data ? -1 : 1; });
  }

  /* ── marcas no RF (usadas por Crédito) ───────────────────────────────── */
  var MARCA = {
    reservado:  { lbl: 'Reservado · ressarcimento', cls: 'amber' },
    em_pedido:  { lbl: 'Em pedido · ressarcimento', cls: 'blue' },
    ressarcido: { lbl: 'Ressarcido', cls: 'green' }
  };
  function idx() {
    var L = lista();
    if (R._idxFor !== L) { R._idx = {}; L.forEach(function (nf) { (nf.registrosFiscais || []).forEach(function (rf) { R._idx[rf.id] = rf; }); }); R._idxFor = L; }
    return R._idx;
  }
  R.marcaKey = function (rfId) { garantir(); var rf = idx()[rfId]; return rf && rf.ressarcimento ? rf.ressarcimento.marca : ''; };
  R.marcaHtml = function (rfId) {
    var k = R.marcaKey(rfId); if (!k) return '';
    var rf = idx()[rfId], m = MARCA[k];
    return '<br><span class="res-mark ' + m.cls + '" title="' + esc(rf.ressarcimento.ref) + ' — módulo de Ressarcimento" onclick="event.stopPropagation();shRes.abrirRef(\'' + esc(rf.ressarcimento.ref) + '\')">' + m.lbl + '</span>';
  };

  /* ── estilos ─────────────────────────────────────────────────────────── */
  function css() {
    if (document.getElementById('res-css')) return;
    var s = document.createElement('style');
    s.id = 'res-css';
    s.textContent = [
      '.res-tag{display:inline-flex;align-items:center;gap:4px;font-size:9.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--purple);background:color-mix(in srgb,var(--purple) 12%,transparent);border:1px solid color-mix(in srgb,var(--purple) 35%,transparent);border-radius:3px;padding:1px 6px;white-space:nowrap;vertical-align:1px}',
      '.res-mark{display:inline-block;margin-top:3px;font-size:9.5px;font-weight:700;letter-spacing:.03em;border-radius:3px;padding:1px 6px;white-space:nowrap;cursor:pointer;border:1px solid}',
      '.res-mark.amber,.res-chip.amber{color:var(--amber);background:rgba(var(--status-amber-rgb),.1);border-color:rgba(var(--status-amber-rgb),.35)}',
      '.res-mark.blue,.res-chip.blue{color:var(--blue);background:rgba(var(--status-blue-rgb),.1);border-color:rgba(var(--status-blue-rgb),.35)}',
      '.res-mark.green,.res-chip.green{color:var(--green);background:rgba(var(--status-green-rgb),.1);border-color:rgba(var(--status-green-rgb),.35)}',
      '.res-chip.teal{color:var(--teal);background:rgba(var(--teal-rgb),.1);border-color:rgba(var(--teal-rgb),.35)}',
      '.res-chip.red{color:var(--red);background:rgba(var(--status-red-rgb),.1);border-color:rgba(var(--status-red-rgb),.35)}',
      '.res-chip.gray{color:var(--txt3);background:rgba(var(--status-gray-rgb),.1);border-color:rgba(var(--status-gray-rgb),.35)}',
      '.res-chip{display:inline-block;font-size:10.5px;font-weight:700;border:1px solid;border-radius:20px;padding:2px 9px;white-space:nowrap}',
      '.res-tri{display:inline-flex;border:1px solid var(--border);border-radius:8px;padding:3px;gap:3px;background:var(--card)}',
      '.res-tri button{border:none;background:transparent;color:var(--txt2);font:inherit;font-size:12px;font-weight:700;padding:6px 16px;border-radius:5px;cursor:pointer}',
      '.res-tri button.on{background:var(--teal);color:#fff}',
      '.res-tri button:focus-visible,.res-act:focus-visible{outline:2px solid var(--teal);outline-offset:2px}',
      '.res-sim{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;border:1px dashed rgba(var(--status-amber-rgb),.55);background:rgba(var(--status-amber-rgb),.07);border-radius:10px;padding:11px 14px;margin-bottom:18px;font-size:12px;color:var(--txt2);line-height:1.55}',
      '.res-sim b{color:var(--txt1)}',
      '.res-sim .res-chip{flex-shrink:0}',
      '.res-sim > div{min-width:0;flex:1 1 280px}',
      '.res-orgao{font-size:11px;color:var(--txt3);margin-top:6px}',
      '.res-kpi .kval{font-size:18px}',
      '.res-cur{display:flex;flex-wrap:wrap;gap:14px;align-items:stretch;margin-bottom:20px}',
      '.res-cur > .ccrd{flex:1 1 300px;min-width:0;margin:0}',
      '.res-cmp{font-size:12px;color:var(--txt2)}',
      '.res-cmp td{padding:6px 8px;border-bottom:1px solid var(--border);vertical-align:top}',
      '.res-cmp th{padding:6px 8px;text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--txt3);border-bottom:1px solid var(--border)}',
      '.res-alert{border:1px solid rgba(var(--status-red-rgb),.35);background:rgba(var(--status-red-rgb),.06);border-radius:8px;padding:9px 12px;font-size:12px;color:var(--txt2);margin-top:10px;line-height:1.5}',
      '.res-alert b{color:var(--red)}',
      '.res-late{color:var(--red);font-weight:700}',
      '.res-warn{color:var(--amber);font-weight:700}',
      '.res-muted{color:var(--txt3)}',
      '.res-act{background:transparent;border:1px solid rgba(var(--teal-rgb),.4);color:var(--teal);border-radius:14px;font:inherit;font-size:11px;font-weight:700;padding:3px 10px;cursor:pointer;white-space:nowrap}',
      '.res-act.p{background:var(--teal);color:#fff;border-color:var(--teal)}',
      '.res-act.d{border-color:rgba(var(--status-red-rgb),.4);color:var(--red)}',
      '.res-act:disabled{opacity:.45;cursor:not-allowed}',
      '.res-banner{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px solid color-mix(in srgb,var(--purple) 30%,transparent);background:color-mix(in srgb,var(--purple) 6%,transparent);border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:var(--txt2);line-height:1.5}',
      '.res-banner > span:nth-child(2){flex:1 1 260px;min-width:0}',
      '.res-banner b{color:var(--txt1)}',
      '#res-ov{display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1300;align-items:center;justify-content:center;padding:16px}',
      '#res-ov.open{display:flex}',
      '#res-md{background:var(--sidebar);border:1px solid var(--border);border-radius:12px;width:640px;max-width:100%;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,.3)}',
      '#res-md .res-md-h{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:flex-start;justify-content:space-between}',
      '#res-md .res-md-h h3{font-size:15px;color:var(--txt1);margin:0}',
      '#res-md .res-md-h p{font-size:12px;color:var(--txt3);margin:3px 0 0}',
      '#res-md .res-md-b{padding:16px 20px;overflow:auto;font-size:12.5px;color:var(--txt2);line-height:1.55}',
      '#res-md .res-md-f{padding:12px 20px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}',
      '.res-dl{display:grid;grid-template-columns:minmax(0,160px) minmax(0,1fr);gap:6px 14px;margin-bottom:12px}',
      '.res-dl dt{color:var(--txt3);font-size:11px;text-transform:uppercase;letter-spacing:.05em;padding-top:2px}',
      '.res-dl dd{margin:0;color:var(--txt1);min-width:0;overflow-wrap:anywhere}',
      '.res-tl{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}',
      '.res-tl li{display:grid;grid-template-columns:86px minmax(0,1fr);gap:10px;font-size:12px}',
      '.res-tl .d{font-family:var(--font-mono);color:var(--txt3);font-size:11px;padding-top:1px}',
      '.res-tl .t{color:var(--txt1)}',
      '.res-tl .t small{display:block;color:var(--txt3)}',
      '.res-tl li.ok .t{color:var(--green)}',
      '.res-tl li.warn .t{color:var(--amber)}',
      '.res-h4{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--txt3);margin:16px 0 8px}',
      '.res-f{display:flex;flex-direction:column;gap:4px;margin-bottom:10px}',
      '.res-f label{font-size:11px;color:var(--txt3);font-weight:600}',
      '.res-f input,.res-f select{background:var(--card);border:1px solid var(--border);border-radius:6px;color:var(--txt1);font:inherit;font-size:12.5px;padding:7px 9px;min-width:0}',
      '.res-eff{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:10px 0}',
      '.res-eff li{margin-left:16px}',
      '#res-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:1400;max-width:calc(100vw - 32px);background:var(--card);color:var(--txt1);border:1px solid var(--border);border-radius:8px;padding:10px 14px;font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.25)}',
      '@media (max-width:640px){.res-dl{grid-template-columns:minmax(0,1fr)}.res-tri button{padding:6px 12px}.res-tl li{grid-template-columns:minmax(0,1fr);gap:0}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function chip(cls, txt) { return '<span class="res-chip ' + cls + '">' + esc(txt) + '</span>'; }
  var PED_ST = {
    em_analise: ['blue', 'Em análise'], exigencia: ['amber', 'Exigência'], fiscalizacao: ['amber', 'Em fiscalização'],
    deferido: ['teal', 'Deferido'], deferido_parcial: ['teal', 'Deferido parcial'], indeferido: ['red', 'Indeferido'],
    cancelado: ['gray', 'Cancelado'], pago: ['green', 'Pago']
  };
  var INT_ST = { declarada: ['amber', 'Declarada'], convertida: ['teal', 'Convertida em pedido'], cancelada: ['gray', 'Cancelada'], vencida: ['red', 'Vencida'] };
  function pedChip(p) { var s = PED_ST[p.status] || ['gray', p.status]; return chip(s[0], s[1]); }
  function intChip(i) { var s = INT_ST[i.status] || ['gray', i.status]; return chip(s[0], s[1]); }
  function triChip(T) { return '<span class="res-chip ' + (T === 'CBS' ? 'amber' : 'blue') + '">' + T + '</span>'; }

  function toast(msg) {
    var t = document.getElementById('res-toast'); if (t) t.remove();
    t = document.createElement('div'); t.id = 'res-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 4500);
  }

  /* ── tela ────────────────────────────────────────────────────────────── */
  function garantir() { var ok = seed(); if (ok) atualizarPrazos(); return ok; }

  R.render = function () {
    css();
    var el = document.getElementById('view-ressarcimento');
    if (!el) return;
    if (!garantir()) { el.innerHTML = '<div class="pg-hdr"><div><div class="pg-title">Ressarcimento</div><div class="pg-sub">Carregando a base…</div></div></div>'; setTimeout(R.render, 600); return; }
    var T = R.tri, S = resumo(T), prox = S.prazos[0];
    var h = '';
    h += '<div class="pg-hdr"><div><div class="pg-title">Ressarcimento <span class="res-tag">Novo módulo</span></div>'
      + '<div class="pg-sub">Saldo credor, intenção, pedido e recebimento — ' + T + ' · ' + ORGAO[T] + ' · matriz · hoje ' + br(R.hoje) + '</div></div>'
      + '<div class="hdr-act" style="gap:8px;flex-wrap:wrap"><div class="res-tri" role="tablist" aria-label="Tributo">'
      + ['CBS', 'IBS'].map(function (t) { return '<button role="tab" aria-selected="' + (t === T) + '" class="' + (t === T ? 'on' : '') + '" onclick="shRes.setTri(\'' + t + '\')">' + t + '</button>'; }).join('')
      + '</div></div></div>';
    h += '<div class="res-sim">' + chip('amber', 'Simulação 2026') + '<div><b>Regra de 2026 desligada neste protótipo.</b> Pela LC 214/2025 (Decreto 12.955/2026, art. 465; Resolução CGIBS 6/2026, art. 466), saldos credores de 2026 não são ressarcidos. '
      + 'Aqui a regra RN-RES-02 está desligada para demonstrar o fluxo com a base atual. Nenhum pedido é transmitido ao Fisco; números de PER/DCOMP e protocolos são ilustrativos, e a Selic é simulada.</div></div>';
    h += '<div class="kgrid k5 res-kpi">'
      + kpi('Saldo credor disponível', moneyC(S.disponivel), 'Período em curso · ' + perLbl(R.ref))
      + kpi('Reservado por intenção', moneyC(S.reservado), S.reservado ? 'Não compensa o mês seguinte' : 'Nenhuma intenção aberta')
      + kpi('Em pedido', moneyC(S.emPedido), S.abertos.length + ' pedido' + (S.abertos.length === 1 ? '' : 's') + ' em aberto · bloqueado')
      + kpi('Recebido em 2026', moneyC(S.recebido), 'Inclui Selic de ' + moneyC(S.selic))
      + kpi('Próximo prazo', prox ? br(prox.data).slice(0, 5) : '—', prox ? esc(prox.txt) + ' · ' + restam(prox.data) : 'Sem prazos em aberto')
      + '</div>';
    var abas = [['saldo', 'Saldo credor'], ['intencoes', 'Intenções'], ['pedidos', 'Pedidos'], ['recebimentos', 'Recebimentos']];
    h += '<div class="stabs" role="tablist">' + abas.map(function (a) { return '<button class="stab' + (R.aba === a[0] ? ' active' : '') + '" onclick="shRes.setAba(\'' + a[0] + '\')">' + a[1] + '</button>'; }).join('') + '</div>';
    if (R.aba === 'saldo') h += abaSaldo(T, S);
    else if (R.aba === 'intencoes') h += abaIntencoes(T);
    else if (R.aba === 'pedidos') h += abaPedidos(T);
    else h += abaRecebimentos(T);
    el.innerHTML = h;
  };

  function mini(l, v) { return '<div style="min-width:0"><div style="font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:var(--txt3);margin-bottom:3px">' + l + '</div><div style="font-size:15px;font-weight:700;font-family:var(--font-mono);color:var(--txt1)">' + v + '</div></div>'; }
  function kpi(l, v, s) { return '<div class="kcard"><div class="klbl">' + l + '</div><div class="kval">' + v + '</div><div class="ksub">' + s + '</div></div>'; }

  function abaSaldo(T, S) {
    var at = S.atual, h = '';
    var intAtual = R.intencoes.filter(function (i) { return i.tributo === T && i.periodo === R.ref && i.status !== 'cancelada'; })[0];
    var podeDeclarar = !intAtual && R.hoje <= ultimoDiaUtil(R.ref) && S.disponivel > 0;
    var prazoDias = T === 'CBS' ? R.conformidade.CBS.prazo : R.conformidade.IBS.prazo;
    var pedAte = ultimoDiaUtil(perAdd(R.ref, 1)), pagPrev = addDias(pedAte, prazoDias), selEst = selic(S.disponivel, pedAte, pagPrev, false);
    h += '<div class="res-cur">';
    h += '<div class="ccrd"><div class="ctitle">Período em curso · ' + perLbl(R.ref) + '</div><div class="csub">Decisão até ' + br(ultimoDiaUtil(R.ref)) + ' · ' + restam(ultimoDiaUtil(R.ref)) + '</div>'
      + '<table class="res-cmp" style="width:100%;border-collapse:collapse;margin-top:8px"><thead><tr><th></th><th>Compensar</th><th>Ressarcir</th></tr></thead><tbody>'
      + '<tr><td>Valor</td><td>' + money(S.disponivel) + '</td><td>' + money(S.disponivel) + '</td></tr>'
      + '<tr><td>Uso</td><td>Abate débitos de ' + T + ' a partir de ' + perLbl(perAdd(R.ref, 1)) + '</td><td>Não compensa ' + perLbl(perAdd(R.ref, 1)) + '; débitos seguem para recolhimento</td></tr>'
      + '<tr><td>Dinheiro</td><td>Imediato, na apuração seguinte</td><td>Pedido até ' + br(pedAte) + ' · até ' + prazoDias + ' dias de análise · previsto ' + br(pagPrev) + '</td></tr>'
      + '<tr><td>Correção</td><td>Nenhuma (valor nominal)</td><td>Selic estimada ' + money(selEst) + '</td></tr>'
      + '</tbody></table>'
      + '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">'
      + (intAtual ? intChip(intAtual) + ' <span class="res-muted" style="font-size:11.5px">' + intAtual.id + '</span>'
        : '<button class="res-act p" ' + (podeDeclarar ? '' : 'disabled') + ' onclick="shRes.modalIntencao()">Declarar intenção de ' + T + '</button>')
      + '</div>';
    if (T === 'IBS') h += (R.impedimentos || []).map(function (im) { return '<div class="res-alert"><b>Impedimento do IBS · alerta.</b> ' + esc(im.tipo) + ' (' + esc(im.ref) + '). ' + esc(im.efeito) + ' <span class="res-muted">' + esc(im.base) + '</span></div>'; }).join('');
    h += '</div>';
    h += '<div class="ccrd"><div class="ctitle">Enquadramento · ' + ORGAO[T] + '</div><div class="csub">Define o prazo de análise do pedido</div>'
      + '<dl class="res-dl" style="margin-top:10px"><dt>Conformidade</dt><dd>' + esc(R.conformidade[T].programa) + '</dd><dt>Prazo de análise</dt><dd>' + esc(R.conformidade[T].base) + '</dd>'
      + '<dt>Estabelecimento</dt><dd>Matriz — pedido centralizado</dd>'
      + (T === 'CBS' ? '<dt>Conferência</dt><dd>API de créditos da CBS · ' + (R._divergente ? '<span class="res-warn">1 documento divergente</span>' : 'sem divergência') + '</dd>' : '<dt>Canal</dt><dd>Registro do protocolo do Comitê Gestor</dd>')
      + '</dl></div>';
    h += '</div>';
    h += '<div class="tcrd"><div class="tcrd-hdr"><div class="sechdr" style="margin-bottom:0"><h2>Saldo credor por período · ' + T + '</h2><p>Na data do último dia do período · o que sai para ressarcimento não é transportado</p></div></div>'
      + '<div class="twrap"><table><thead><tr><th>Período</th><th class="r">Saldo inicial</th><th class="r">Apropriado</th><th class="r">Compensado</th><th class="r">Saldo credor</th><th>Destino</th><th class="r">No ressarcimento</th><th class="r">Transportado</th><th>Prazo</th><th></th></tr></thead><tbody>';
    S.periodos.slice().reverse().forEach(function (p) {
      var dest, prazo = '—', acao = '';
      if (p.destino === 'pedido') { dest = pedChip(p.ped) + ' <span class="res-muted" style="font-size:11px">' + p.ped.id + '</span>'; acao = '<button class="res-act" onclick="shRes.modalPedido(\'' + p.ped.id + '\')">Ver pedido</button>'; if (/^(em_analise|exigencia)$/.test(p.ped.status)) prazo = 'Análise até ' + br(p.ped.fimAnalise); }
      else if (p.destino === 'intencao') { dest = intChip(p.intc); prazo = 'Pedido até ' + br(p.intc.prazoPedido) + ' · ' + restam(p.intc.prazoPedido); acao = '<button class="res-act p" onclick="shRes.modalMontar(\'' + p.intc.id + '\')">Montar pedido</button>'; }
      else if (p.destino === 'cancelada' || p.destino === 'vencida') { dest = intChip(p.intc) + ' <span class="res-muted" style="font-size:11px">voltou a compensar</span>'; }
      else if (p.k === R.ref) { dest = chip('gray', 'Em apuração'); prazo = 'Intenção até ' + br(ultimoDiaUtil(R.ref)); }
      else dest = '<span class="res-muted">Compensação</span>';
      h += '<tr><td class="nowrap"><b>' + perLbl(p.k) + '</b></td><td class="r mono">' + money(p.ini) + '</td><td class="r mono" style="color:var(--teal)">' + money(p.aprop) + '</td><td class="r mono">' + money(p.comp) + '</td>'
        + '<td class="r mono" style="font-weight:700">' + money(p.fim) + '</td><td class="nowrap">' + dest + '</td><td class="r mono">' + (p.saida ? money(p.saida) : '—') + '</td><td class="r mono">' + money(p.transp) + '</td>'
        + '<td class="nowrap" style="font-size:11.5px">' + prazo + '</td><td class="nowrap">' + acao + '</td></tr>';
    });
    h += '</tbody></table></div></div>';
    return h;
  }

  function abaIntencoes(T) {
    var l = R.intencoes.filter(function (i) { return i.tributo === T; }).slice().sort(function (a, b) { return a.periodo < b.periodo ? 1 : -1; });
    var h = '<div class="tcrd"><div class="tcrd-hdr"><div class="sechdr" style="margin-bottom:0"><h2>Intenções · ' + T + '</h2><p>Opcional, até o último dia útil do período. Trava o saldo para não compensar o mês seguinte.</p></div></div>'
      + '<div class="twrap"><table><thead><tr><th>ID</th><th>Período</th><th class="r">Valor reservado</th><th>Declarada em</th><th>Por</th><th>Aprovação</th><th>Pedido até</th><th>Situação</th><th></th></tr></thead><tbody>';
    if (!l.length) h += '<tr><td colspan="9" class="res-muted" style="text-align:center;padding:18px">Nenhuma intenção de ' + T + '.</td></tr>';
    l.forEach(function (i) {
      var acao = i.status === 'declarada'
        ? '<button class="res-act p" onclick="shRes.modalMontar(\'' + i.id + '\')">Montar pedido</button> <button class="res-act d" onclick="shRes.cancelarIntencao(\'' + i.id + '\')">Cancelar</button>'
        : (i.pedidoId ? '<button class="res-act" onclick="shRes.modalPedido(\'' + i.pedidoId + '\')">' + i.pedidoId + '</button>' : (i.motivo ? '<span class="res-muted" style="font-size:11px">' + esc(i.motivo) + '</span>' : ''));
      h += '<tr><td class="mono nowrap">' + i.id + '</td><td>' + perLbl(i.periodo) + '</td><td class="r mono">' + money(i.valor) + '</td><td class="nowrap">' + br(i.declaradaEm) + '</td><td class="nowrap">' + esc(i.por) + '</td>'
        + '<td class="nowrap">' + (i.aprovadaPor ? esc(i.aprovadaPor) : '<span class="res-muted">Abaixo do limite</span>') + '</td><td class="nowrap">' + br(i.prazoPedido) + (i.status === 'declarada' ? ' · ' + restam(i.prazoPedido) : '') + '</td><td class="nowrap">' + intChip(i) + (i.canceladaEm ? ' <span class="res-muted" style="font-size:11px">' + br(i.canceladaEm) + '</span>' : '') + '</td><td class="nowrap">' + acao + '</td></tr>';
    });
    return h + '</tbody></table></div></div>';
  }

  function abaPedidos(T) {
    var l = R.pedidos.filter(function (p) { return p.tributo === T; }).slice().sort(function (a, b) { return a.periodo < b.periodo ? 1 : -1; });
    var h = '<div class="tcrd"><div class="tcrd-hdr"><div class="sechdr" style="margin-bottom:0"><h2>Pedidos · ' + T + '</h2><p>' + (T === 'CBS' ? 'PER/DCOMP transmitido na Receita Federal e registrado aqui' : 'Protocolo do Comitê Gestor registrado aqui') + ' · o valor pedido fica bloqueado até a decisão</p></div></div>'
      + '<div class="twrap"><table><thead><tr><th>ID</th><th>Período</th><th>' + (T === 'CBS' ? 'PER/DCOMP' : 'Protocolo') + '</th><th class="r">Valor pedido</th><th>Protocolado</th><th>Prazo</th><th>Fim da análise</th><th>Situação</th><th class="r">Deferido</th><th></th></tr></thead><tbody>';
    if (!l.length) h += '<tr><td colspan="10" class="res-muted" style="text-align:center;padding:18px">Nenhum pedido de ' + T + '.</td></tr>';
    l.forEach(function (p) {
      h += '<tr><td class="mono nowrap">' + p.id + '</td><td>' + perLbl(p.periodo) + '</td><td class="mono nowrap" style="font-size:11px">' + esc(p.numero) + '</td><td class="r mono">' + money(p.valor) + '</td><td class="nowrap">' + br(p.protocoladoEm) + '</td>'
        + '<td class="nowrap">' + p.prazo + ' dias</td><td class="nowrap">' + br(p.fimAnalise) + (/^(em_analise|exigencia)$/.test(p.status) ? ' · ' + restam(p.fimAnalise) : '') + '</td><td class="nowrap">' + pedChip(p) + '</td>'
        + '<td class="r mono">' + (p.deferido ? money(p.deferido) : '—') + '</td><td><button class="res-act" onclick="shRes.modalPedido(\'' + p.id + '\')">Detalhe</button></td></tr>';
    });
    return h + '</tbody></table></div></div>';
  }

  function abaRecebimentos(T) {
    var l = R.recebimentos.filter(function (r) { return r.tributo === T; });
    var prev = R.pedidos.filter(function (p) { return p.tributo === T && /^(em_analise|exigencia|deferido|deferido_parcial)$/.test(p.status); });
    var h = '<div class="tcrd"><div class="tcrd-hdr"><div class="sechdr" style="margin-bottom:0"><h2>Recebimentos · ' + T + '</h2><p>Recebido contra deferido corrigido. O pagamento grava <b>Ressarcimento</b> como método de extinção dos créditos do pedido.</p></div></div>'
      + '<div class="twrap"><table><thead><tr><th>ID</th><th>Pedido</th><th>Data</th><th class="r">Principal</th><th class="r">Selic</th><th class="r">Total</th><th>Conta</th><th>Conciliação</th></tr></thead><tbody>';
    l.forEach(function (r) {
      h += '<tr><td class="mono nowrap">' + r.id + '</td><td class="mono nowrap"><a href="javascript:void(0)" onclick="shRes.modalPedido(\'' + r.pedidoId + '\')" style="color:var(--teal)">' + r.pedidoId + '</a></td><td class="nowrap">' + br(r.data) + '</td><td class="r mono">' + money(r.principal) + '</td><td class="r mono">' + money(r.selic) + '</td><td class="r mono" style="font-weight:700">' + money(r.total) + '</td><td style="font-size:11.5px">' + esc(r.conta) + '</td><td>' + (r.conciliado ? chip('green', 'Conciliado') : chip('amber', 'Divergente')) + '</td></tr>';
    });
    prev.forEach(function (p) {
      var v = /^deferido/.test(p.status) ? p.deferido : p.valor;
      var dt = /^deferido/.test(p.status) ? addDias(p.decididoEm, 15) : p.pagSilencio;
      h += '<tr style="opacity:.8"><td class="mono nowrap res-muted">previsto</td><td class="mono nowrap"><a href="javascript:void(0)" onclick="shRes.modalPedido(\'' + p.id + '\')" style="color:var(--teal)">' + p.id + '</a></td><td class="nowrap">' + br(dt) + '</td><td class="r mono">' + money(v) + '</td><td class="r mono">' + money(selic(v, p.protocoladoEm, dt, false)) + '</td><td class="r mono">' + money(v + selic(v, p.protocoladoEm, dt, false)) + '</td><td class="res-muted" style="font-size:11.5px">Previsão pelo prazo legal</td><td>' + chip('gray', 'Previsto') + '</td></tr>';
    });
    if (!l.length && !prev.length) h += '<tr><td colspan="8" class="res-muted" style="text-align:center;padding:18px">Nenhum recebimento de ' + T + '.</td></tr>';
    return h + '</tbody></table></div></div>';
  }

  /* ── modais ──────────────────────────────────────────────────────────── */
  function modal(titulo, sub, corpo, rodape) {
    css();
    var ov = document.getElementById('res-ov');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'res-ov';
      ov.addEventListener('click', function (e) { if (e.target === ov) R.fechar(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov.classList.contains('open')) R.fechar(); });
      document.body.appendChild(ov);
    }
    ov.innerHTML = '<div id="res-md" role="dialog" aria-modal="true" aria-labelledby="res-md-t"><div class="res-md-h"><div><h3 id="res-md-t">' + titulo + '</h3><p>' + sub + '</p></div><button class="btn" onclick="shRes.fechar()" aria-label="Fechar">✕</button></div>'
      + '<div class="res-md-b">' + corpo + '</div><div class="res-md-f">' + (rodape || '<button class="btn" onclick="shRes.fechar()">Fechar</button>') + '</div></div>';
    ov.classList.add('open');
  }
  R.fechar = function () { var ov = document.getElementById('res-ov'); if (ov) ov.classList.remove('open'); };

  R.modalIntencao = function () {
    garantir();
    var T = R.tri, S = resumo(T), v = soma(livres(T, R.ref, R.hoje)), lim = R.LIMITE_APROVACAO[T];
    var naoAprop = Math.max(0, S.disponivel - v);
    var corpo = (naoAprop > 0.005 ? '<div class="res-alert" style="border-color:rgba(var(--status-amber-rgb),.4);background:rgba(var(--status-amber-rgb),.07);margin:0 0 12px"><b style="color:var(--amber)">' + money(naoAprop) + ' do saldo ainda não foi apropriado até hoje</b> e fica fora da reserva — crédito só existe depois do recolhimento do fornecedor (LC 214/2025, art. 47).</div>' : '')
      + '<dl class="res-dl"><dt>Tributo</dt><dd>' + T + ' · ' + ORGAO[T] + '</dd><dt>Período</dt><dd>' + perLbl(R.ref) + '</dd><dt>Saldo reservado</dt><dd><b>' + money(v) + '</b></dd><dt>Pedido até</dt><dd>' + br(ultimoDiaUtil(perAdd(R.ref, 1))) + '</dd></dl>'
      + '<div class="res-eff"><b style="color:var(--txt1)">O que acontece ao confirmar</b><ul style="margin:6px 0 0">'
      + '<li>O saldo de ' + money(v) + ' deixa de compensar débitos de ' + T + ' de ' + perLbl(perAdd(R.ref, 1)) + '; esses débitos seguem para recolhimento.</li>'
      + '<li>Os registros fiscais do saldo recebem a marca <span class="res-mark amber" style="cursor:default">Reservado · ressarcimento</span>; o status do crédito não muda.</li>'
      + '<li>Cancelável até o pedido: o saldo volta a compensar na hora. Sem pedido até o prazo, a intenção vence e o saldo volta a compensar.</li></ul></div>'
      + (v > lim ? '<div class="res-alert" style="border-color:rgba(var(--status-amber-rgb),.4);background:rgba(var(--status-amber-rgb),.07)"><b style="color:var(--amber)">Acima do limite de ' + moneyC(lim) + '.</b> A intenção precisa de aprovação (D-03). No protótipo, a aprovação é registrada por Rafael Lima.</div>' : '')
      + (T === 'IBS' && (R.impedimentos || []).length ? '<div class="res-alert"><b>Impedimento do IBS · alerta.</b> ' + esc(R.impedimentos[0].tipo) + '. O pedido pode ser indeferido; a intenção segue permitida.</div>' : '');
    modal('Declarar intenção de ressarcimento · ' + T, 'Simulação 2026 · a regra de saldos de 2026 está desligada', corpo,
      '<button class="btn" onclick="shRes.fechar()">Cancelar</button><button class="btn btn-t" onclick="shRes.confirmarIntencao()">Declarar intenção</button>');
  };

  R.confirmarIntencao = function () {
    var T = R.tri, l = livres(T, R.ref, R.hoje), v = soma(l), id = 'INT-' + T + '-' + R.ref;
    if (!l.length) { toast('Não há saldo apropriado de ' + T + ' para reservar.'); return; }
    var acima = v > R.LIMITE_APROVACAO[T];
    var it = { id: id, tributo: T, periodo: R.ref, valor: v, declaradaEm: R.hoje, prazoPedido: ultimoDiaUtil(perAdd(R.ref, 1)), status: 'declarada', por: USUARIO, aprovadaPor: acima ? 'Rafael Lima' : null };
    R.intencoes.push(it);
    passoIntencao(l, it, agora());
    marcar(l, 'reservado', id, T);
    R.fechar(); refresh();
    toast('Intenção de ' + T + ' de ' + perLbl(R.ref) + ' declarada · ' + money(v) + ' reservados.');
  };

  R.cancelarIntencao = function (id) {
    var i = R.intencoes.filter(function (x) { return x.id === id; })[0]; if (!i) return;
    i.status = 'cancelada'; i.canceladaEm = R.hoje; i.motivo = 'Cancelada por ' + USUARIO;
    passoVolta(doRef(id), R.hoje, agora(), 'Intenção ' + id + ' cancelada por ' + USUARIO, USUARIO, 'ok');
    desmarcar(id);
    refresh();
    toast('Intenção ' + id + ' cancelada · o saldo volta a compensar a partir de hoje.');
  };

  R.modalMontar = function (intId) {
    garantir();
    var i = R.intencoes.filter(function (x) { return x.id === intId; })[0]; if (!i) return;
    var T = i.tributo, its = doRef(intId), conf = R.conformidade[T];
    var linhas = its.map(function (x, n) {
      return '<tr><td><input type="checkbox" class="res-sel" data-id="' + x.rf.id + '" data-v="' + x.rf.valor + '" checked onchange="shRes._somaSel()" aria-label="Incluir ' + esc(x.rf.id) + '"></td><td class="mono nowrap">' + x.rf.id + '</td><td class="nowrap">' + esc((x.nf.tipoDF || 'NF-e') + ' ' + x.nf.numero) + '</td><td class="trunc">' + esc(x.nf.entidade || '—') + '</td><td class="r mono">' + money(x.rf.valor) + '</td>'
        + (T === 'CBS' ? '<td>' + chip('green', 'Confere') + '</td>' : '') + '</tr>';
    }).join('');
    var aberto = i.periodo >= R.ref;
    var corpo = (aberto ? '<div class="res-alert" style="border-color:rgba(var(--status-amber-rgb),.4);background:rgba(var(--status-amber-rgb),.07);margin:0 0 12px"><b style="color:var(--amber)">Período ainda aberto.</b> O pedido só cabe depois do fim de ' + perLbl(i.periodo) + ', a partir de ' + br(perAdd(i.periodo, 1) + '-01') + '. Liberado aqui para a simulação.</div>' : '')
      + '<dl class="res-dl"><dt>Intenção</dt><dd>' + i.id + ' · ' + perLbl(i.periodo) + ' · ' + money(i.valor) + '</dd><dt>Prazo do pedido</dt><dd>' + br(i.prazoPedido) + ' · ' + restam(i.prazoPedido) + '</dd><dt>Hipótese de prazo</dt><dd>' + esc(conf.base) + '</dd></dl>'
      + '<div class="res-h4">Composição por documento</div><div class="twrap" style="--twrap-h:260px"><table><thead><tr><th></th><th>RF</th><th>Documento</th><th>Fornecedor</th><th class="r">Crédito</th>' + (T === 'CBS' ? '<th>Receita</th>' : '') + '</tr></thead><tbody>' + linhas + '</tbody></table></div>'
      + '<div style="margin:8px 0 12px;font-size:12px">Valor do pedido: <b id="res-sel-total" style="color:var(--txt1)">' + money(i.valor) + '</b> <span class="res-muted">· o não pedido volta a compensar desde a data do pedido</span></div>'
      + '<div class="shg2" style="gap:10px"><div class="res-f"><label for="res-num">' + (T === 'CBS' ? 'Número do PER/DCOMP' : 'Protocolo do Comitê Gestor') + '</label><input id="res-num" value="' + (T === 'CBS' ? perdcomp(R.hoje, 9) : protIbs(9)) + '"></div>'
      + '<div class="res-f"><label for="res-dt">Data de ' + (T === 'CBS' ? 'transmissão' : 'protocolo') + '</label><input id="res-dt" type="date" value="' + R.hoje + '"></div></div>'
      + (T === 'IBS' && (R.impedimentos || []).length ? '<div class="res-alert"><b>Impedimento do IBS · alerta.</b> ' + esc(R.impedimentos[0].tipo) + ' — ' + esc(R.impedimentos[0].base) + '.</div>' : '');
    modal('Montar e registrar pedido · ' + T, T === 'CBS' ? 'Transmita o PER/DCOMP na Receita Federal e registre o número aqui' : 'Registre o protocolo emitido pelo Comitê Gestor do IBS', corpo,
      '<button class="btn" onclick="shRes.fechar()">Cancelar</button><button class="btn btn-t" onclick="shRes.confirmarPedido(\'' + intId + '\')">Registrar pedido</button>');
  };
  R._somaSel = function () {
    var t = 0; document.querySelectorAll('#res-md .res-sel').forEach(function (c) { if (c.checked) t += +c.getAttribute('data-v'); });
    var el = document.getElementById('res-sel-total'); if (el) el.textContent = money(t);
  };

  R.confirmarPedido = function (intId) {
    var i = R.intencoes.filter(function (x) { return x.id === intId; })[0]; if (!i) return;
    var T = i.tributo, sel = [];
    document.querySelectorAll('#res-md .res-sel').forEach(function (c) { if (c.checked) sel.push(c.getAttribute('data-id')); });
    if (!sel.length) { toast('Selecione ao menos um documento.'); return; }
    var num = (document.getElementById('res-num') || {}).value || '', dt = (document.getElementById('res-dt') || {}).value || R.hoje;
    var its = doRef(intId), dentro = its.filter(function (x) { return sel.indexOf(x.rf.id) >= 0; }), fora = its.filter(function (x) { return sel.indexOf(x.rf.id) < 0; });
    var pedId = 'PED-' + T + '-' + i.periodo, conf = R.conformidade[T], v = soma(dentro);
    var pedTmp = { id: pedId, tributo: T, numero: num, protocoladoEm: dt, prazo: conf.prazo, base: conf.base, fimAnalise: addDias(dt, conf.prazo), pagSilencio: addDias(dt, conf.prazo + 15) };
    passoVerificacao(dentro, pedTmp, dt, agora());
    passoPedido(dentro, pedTmp, agora(), USUARIO);
    passoVolta(fora, dt, agora(), 'Não incluído no pedido ' + (fora.length ? 'parcial ' : '') + pedId, USUARIO, 'ok');
    fora.forEach(function (x) { delete x.rf.ressarcimento; });
    marcar(dentro, 'em_pedido', pedId, T);
    i.status = 'convertida'; i.pedidoId = pedId;
    R.pedidos.push({ id: pedId, tributo: T, periodo: i.periodo, numero: num, valor: v, protocoladoEm: dt, prazo: conf.prazo, base: conf.base, fimAnalise: addDias(dt, conf.prazo), pagSilencio: addDias(dt, conf.prazo + 15), status: 'em_analise', deferido: 0, rfs: ids(dentro), excluidos: [],
      hist: [ev(i.declaradaEm, 'Intenção declarada · ' + money(i.valor), i.por), ev(dt, 'Pedido ' + (fora.length ? 'parcial ' : '') + 'registrado · ' + money(v) + (fora.length ? ' · remanescente volta a compensar' : ''), USUARIO)] });
    R.fechar(); R.aba = 'pedidos'; refresh();
    toast('Pedido ' + pedId + ' registrado · ' + money(v) + ' bloqueados até a decisão.');
  };

  R.modalPedido = function (id) {
    garantir();
    var p = R.pedidos.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var T = p.tributo, its = p.rfs.map(function (rid) { return idx()[rid]; }).filter(Boolean);
    var rec = R.recebimentos.filter(function (r) { return r.pedidoId === id; })[0];
    var corpo = '<dl class="res-dl"><dt>Tributo</dt><dd>' + triChip(T) + ' ' + ORGAO[T] + '</dd><dt>Período</dt><dd>' + perLbl(p.periodo) + '</dd><dt>' + (T === 'CBS' ? 'PER/DCOMP' : 'Protocolo') + '</dt><dd class="mono">' + esc(p.numero) + '</dd>'
      + '<dt>Valor pedido</dt><dd><b>' + money(p.valor) + '</b></dd><dt>Situação</dt><dd>' + pedChip(p) + (p.deferido ? ' · deferido ' + money(p.deferido) : '') + '</dd>'
      + '<dt>Prazo de análise</dt><dd>' + p.prazo + ' dias · ' + esc(p.base) + '</dd><dt>Fim da análise</dt><dd>' + br(p.fimAnalise) + (/^(em_analise|exigencia)$/.test(p.status) ? ' · ' + restam(p.fimAnalise) : '') + '</dd>'
      + '<dt>Sem resposta</dt><dd>Pagamento até ' + br(p.pagSilencio) + ', com Selic diária</dd>'
      + (rec ? '<dt>Recebido</dt><dd>' + money(rec.total) + ' em ' + br(rec.data) + ' (Selic ' + money(rec.selic) + ')</dd>' : '') + '</dl>'
      + (p.excluidos && p.excluidos.length ? '<div class="res-alert" style="border-color:rgba(var(--status-amber-rgb),.4);background:rgba(var(--status-amber-rgb),.07)"><b style="color:var(--amber)">Excluído do pedido.</b> ' + p.excluidos.map(function (e) { return esc(e.doc) + ' · ' + money(e.valor) + ' — ' + esc(e.motivo); }).join('; ') + '. Inconsistência aberta em Inconsistências.</div>' : '')
      + '<div class="res-h4">Linha do tempo e auditoria</div><ul class="res-tl">' + p.hist.map(function (e) { return '<li class="' + e.tipo + '"><span class="d">' + br(e.data) + '</span><span class="t">' + esc(e.txt) + '<small>' + esc(e.por) + '</small></span></li>'; }).join('') + '</ul>'
      + '<div class="res-h4">Registros fiscais do pedido (' + its.length + ')</div><div class="twrap" style="--twrap-h:200px"><table><thead><tr><th>RF</th><th>DF</th><th class="r">Crédito</th><th>Marca</th></tr></thead><tbody>'
      + its.map(function (rf) { var m = rf.ressarcimento ? MARCA[rf.ressarcimento.marca] : null; return '<tr><td class="mono nowrap">' + rf.id + '</td><td class="nowrap">' + esc(rf.nfVinculada || '') + '</td><td class="r mono">' + money(rf.valor) + '</td><td>' + (m ? '<span class="res-mark ' + m.cls + '" style="cursor:default">' + m.lbl + '</span>' : '<span class="res-muted">voltou a compensar</span>') + '</td></tr>'; }).join('')
      + '</tbody></table></div>';
    var aberto = /^(em_analise|exigencia|fiscalizacao)$/.test(p.status), deferido = /^deferido/.test(p.status);
    if (aberto) corpo += '<div class="res-h4">Registrar decisão</div><div class="shg2" style="gap:10px"><div class="res-f"><label for="res-dec">Decisão</label><select id="res-dec"><option value="deferido">Deferido integral</option><option value="deferido_parcial">Deferido parcial</option><option value="indeferido">Indeferido</option><option value="fiscalizacao">Fiscalização iniciada</option><option value="cancelado">Pedido cancelado</option></select></div>'
      + '<div class="res-f"><label for="res-vdef">Valor deferido (parcial)</label><input id="res-vdef" type="number" min="0" step="0.01" value="' + (Math.round(p.valor * 0.9 * 100) / 100) + '"></div></div>';
    var rod = '<button class="btn" onclick="shRes.fechar()">Fechar</button>';
    if (aberto) rod += '<button class="btn btn-t" onclick="shRes.registrarDecisao(\'' + id + '\')">Registrar decisão</button>';
    if (deferido) rod += '<button class="btn btn-t" onclick="shRes.registrarRecebimento(\'' + id + '\')">Registrar recebimento</button>';
    modal(p.id + ' · ' + T, 'Pedido de ressarcimento de ' + perLbl(p.periodo) + ' · ' + ORGAO[T], corpo, rod);
  };

  R.registrarDecisao = function (id) {
    var p = R.pedidos.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var d = (document.getElementById('res-dec') || {}).value || 'deferido';
    var vdef = parseFloat((document.getElementById('res-vdef') || {}).value || '0') || 0;
    var org = ORGAO[p.tributo];
    var h = agora();
    if (d === 'deferido') { p.status = 'deferido'; p.deferido = p.valor; p.decididoEm = R.hoje; p.hist.push(ev(R.hoje, 'Deferido integral · pagamento em até 15 dias', org, 'ok'));
      passoDecisao(doRef(id), p, R.hoje, h, 'Pedido ' + id + ' deferido integral · crédito do documento reconhecido · pagamento em até 15 dias', 'ok'); }
    else if (d === 'deferido_parcial') {
      vdef = Math.min(Math.max(vdef, 0), p.valor);
      p.status = 'deferido_parcial'; p.deferido = vdef; p.decididoEm = R.hoje;
      // remanescente: RFs do fim da lista voltam a compensar até o valor deferido caber
      var its = doRef(id), acum = 0, fora = [], dentro = [];
      its.forEach(function (x) { acum += x.rf.valor; if (acum > vdef + 0.005) fora.push(x); else dentro.push(x); });
      passoDecisao(dentro, p, R.hoje, h, 'Pedido ' + id + ' deferido parcialmente · crédito do documento reconhecido · pagamento em até 15 dias', 'ok');
      passoDecisao(fora, p, R.hoje, h, 'Pedido ' + id + ' deferido parcialmente · crédito do documento não reconhecido no ressarcimento', 'erro');
      passoVolta(fora, R.hoje, agora(), 'Não reconhecido no deferimento parcial', org, 'ok');
      fora.forEach(function (x) { delete x.rf.ressarcimento; });
      p.deferido = soma(doRef(id));
      p.hist.push(ev(R.hoje, 'Deferido parcial · ' + money(p.deferido), org, 'warn'));
      p.hist.push(ev(R.hoje, 'Remanescente de ' + money(p.valor - p.deferido) + ' volta a compensar desde a decisão', 'Sistema'));
    }
    else if (d === 'indeferido') { p.status = 'indeferido'; p.decididoEm = R.hoje;
      passoDecisao(doRef(id), p, R.hoje, h, 'Pedido ' + id + ' indeferido pelo ' + org, 'erro');
      passoVolta(doRef(id), R.hoje, agora(), 'Pedido indeferido — a partir da decisão definitiva', org, 'ok');
      desmarcar(id); p.hist.push(ev(R.hoje, 'Indeferido · o saldo volta a compensar a partir da decisão definitiva', org, 'warn')); }
    else if (d === 'fiscalizacao') { p.status = 'fiscalizacao'; p.fiscalizacaoEm = R.hoje;
      passoDecisao(doRef(id), p, R.hoje, h, 'Fiscalização iniciada no pedido ' + id + ' · prazo de análise suspenso · limite de 360 dias, até ' + br(addDias(R.hoje, 360)), 'pending'); p.hist.push(ev(R.hoje, 'Fiscalização iniciada · prazo suspenso · limite de 360 dias', org, 'warn')); }
    else if (d === 'cancelado') { p.status = 'cancelado';
      passoVolta(doRef(id), R.hoje, h, 'Pedido ' + id + ' cancelado por ' + USUARIO, USUARIO, 'ok');
      desmarcar(id); p.hist.push(ev(R.hoje, 'Pedido cancelado · remanescente volta a compensar', USUARIO)); }
    R._v++; refresh(); R.modalPedido(id);
    toast('Decisão registrada em ' + id + '.');
  };

  R.registrarRecebimento = function (id) {
    var p = R.pedidos.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var its = doRef(id), sel = selic(p.deferido, p.protocoladoEm, R.hoje, R.hoje > p.fimAnalise);
    var rec = { id: 'REC-' + p.tributo + '-' + p.periodo, pedidoId: id, tributo: p.tributo, data: R.hoje, principal: p.deferido, selic: sel, total: p.deferido + sel, conta: CONTA, conciliado: true };
    passoPagamento(its, p, rec, agora());
    extinguir(its, id, p.tributo, R.hoje);
    p.status = 'pago'; p.pagoEm = R.hoje;
    p.hist.push(ev(R.hoje, 'Pagamento recebido e conciliado · Selic ' + money(sel) + ' · créditos extintos por Ressarcimento', USUARIO, 'ok'));
    R.recebimentos.push(rec);
    refresh(); R.modalPedido(id);
    toast('Recebimento conciliado · ' + its.length + ' registros fiscais extintos por Ressarcimento.');
  };

  /* ── navegação ───────────────────────────────────────────────────────── */
  R.setTri = function (t) { R.tri = t; R.render(); };
  R.setAba = function (a) { R.aba = a; R.render(); };
  R.abrir = function (tri, aba) {
    if (tri) R.tri = tri; if (aba) R.aba = aba;
    var b = document.getElementById('nav-ressarcimento-btn');
    if (b && window.showView) window.showView('ressarcimento', b); else R.render();
  };
  R.abrirRef = function (ref) {
    var p = R.pedidos.filter(function (x) { return x.id === ref; })[0];
    var i = R.intencoes.filter(function (x) { return x.id === ref; })[0];
    var T = (p || i || {}).tributo;
    R.abrir(T, p ? 'pedidos' : 'intencoes');
    if (p) setTimeout(function () { R.modalPedido(ref); }, 80);
  };

  // Toda ação do módulo re-sincroniza o produto inteiro: indicadores, gráficos,
  // listagens, inconsistências e a Apuração (transporte do saldo).
  function refresh() {
    try { if (window.dataSyncFixed && window.dataSyncFixed.sincronizar) window.dataSyncFixed.sincronizar(); } catch (e) {}
    try { if (window.sincronizarApuracao && window.apurPeriodoAtivo) { var per = window.apurPeriodoAtivo; window.sincronizarApuracao(); if (window.apurData && window.apurData[per]) { window.apurPeriodoAtivo = per; var sel = document.getElementById('apur-periodo-sel'); if (sel) sel.value = per; window.apurRenderAll && window.apurRenderAll(); } } } catch (e) {}
    R.render();
    R.renderIntegracoes();
  }

  /* ── integrações com outros módulos (marcadas "Ressarcimento") ───────── */
  function tag() { return '<span class="res-tag">Ressarcimento</span>'; }
  function banner(viewId, id, html) {
    var v = document.getElementById(viewId); if (!v) return;
    var el = document.getElementById(id);
    if (!html) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div'); el.id = id; el.className = 'res-banner';
      var hdr = v.querySelector('.pg-hdr');
      if (hdr) hdr.insertAdjacentElement('afterend', el); else v.insertBefore(el, v.firstChild);
    }
    el.innerHTML = html;
  }

  R.renderIntegracoes = function () {
    if (!garantir()) return;
    css();
    var c = resumo('CBS'), i = resumo('IBS');
    // Início — card por tributo, sem soma
    var dv = document.getElementById('view-dashboard');
    if (dv) {
      var card = document.getElementById('dash-res-card');
      if (!card) {
        card = document.createElement('div'); card.id = 'dash-res-card'; card.className = 'ccrd'; card.style.marginBottom = '14px';
        var hero = dv.querySelector(':scope > .ccrd');
        if (hero) hero.insertAdjacentElement('afterend', card); else dv.appendChild(card);
      }
      function col(T, s) {
        var pz = s.prazos[0];
        return '<div style="min-width:0"><div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">' + triChip(T) + '<span class="res-muted" style="font-size:11px">' + ORGAO[T] + '</span></div>'
          + '<div class="shg4" style="gap:10px">'
          + mini('Disponível', moneyC(s.disponivel)) + mini('Reservado', moneyC(s.reservado)) + mini('Em pedido', moneyC(s.emPedido)) + mini('Recebido 2026', moneyC(s.recebido))
          + '</div><div style="font-size:11px;color:var(--txt3);margin-top:6px">Próximo prazo: ' + (pz ? '<b style="color:var(--txt1)">' + br(pz.data) + '</b> · ' + esc(pz.txt) + ' · ' + restam(pz.data) : '—') + '</div></div>';
      }
      card.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0"><div class="ctitle" style="margin-bottom:0">Saldo credor e ressarcimento</div>' + tag() + chip('amber', 'Simulação 2026') + '</div>'
        + '<button class="res-act" onclick="shRes.abrir()">Abrir Ressarcimento →</button></div>'
        + '<div class="shg2" style="gap:18px">' + col('CBS', c) + col('IBS', i) + '</div>'
        + '<div style="font-size:11px;color:var(--txt3);margin-top:8px">CBS e IBS são pedidos distintos, a órgãos distintos — os valores não se somam.</div>';
    }
    // Débito — trava da intenção sobre o mês seguinte
    var ints = R.intencoes.filter(function (x) { return x.status === 'declarada'; });
    banner('view-debitos', 'deb-res-banner', ints.length ? tag() + '<span><b>Intenção de ressarcimento declarada.</b> ' + ints.map(function (x) { return x.tributo + ' de ' + perLbl(x.periodo) + ' (' + moneyC(x.valor) + ')'; }).join(' e ')
      + ': esses créditos não compensam débitos do mês seguinte do mesmo tributo — os débitos não extintos seguem para recolhimento.</span><button class="res-act" onclick="shRes.abrir(\'' + ints[0].tributo + '\',\'intencoes\')">Ver intenções →</button>' : '');
    // Conciliação — conferência de saldo credor com a Receita (CBS)
    var dvg = R._divergente;
    banner('view-conciliacao', 'conc-res-banner', dvg ? tag() + '<span><b>Conferência com a Receita · CBS.</b> ' + esc((dvg.nf.tipoDF || 'NF-e') + ' ' + dvg.nf.numero) + ' (' + money(dvg.rf.valor) + ') tem saldo divergente na API de créditos da CBS e foi excluído do pedido ' + dvg.pedidoId + '.</span><button class="res-act" onclick="shRes.abrirRef(\'' + dvg.pedidoId + '\')">Ver pedido →</button>' : '');
    // Organização — enquadramento por órgão e impedimentos
    var og = document.getElementById('admin-organizacao');
    if (og) {
      var oc = document.getElementById('org-res-card');
      if (!oc) { oc = document.createElement('div'); oc.id = 'org-res-card'; oc.className = 'tcrd'; var kg = og.querySelector(':scope > .kgrid'); if (kg) kg.insertAdjacentElement('afterend', oc); else og.insertBefore(oc, og.firstChild); }
      oc.innerHTML = '<div class="tcrd-hdr"><div class="sechdr" style="margin-bottom:0"><h2>Ressarcimento · enquadramento por órgão ' + tag() + '</h2><p>Define o prazo de análise dos pedidos. O pedido é centralizado na matriz.</p></div></div>'
        + '<div class="twrap" style="--twrap-h:none"><table><thead><tr><th>Tributo</th><th>Órgão</th><th>Programa de conformidade</th><th>Prazo de análise</th><th>Estabelecimento do pedido</th><th>Impedimentos registrados</th></tr></thead><tbody>'
        + ['CBS', 'IBS'].map(function (T) { var im = (R.impedimentos || []).filter(function (x) { return x.tributo === T; }); return '<tr><td>' + triChip(T) + '</td><td>' + ORGAO[T] + '</td><td>' + esc(R.conformidade[T].programa) + '</td><td>' + esc(R.conformidade[T].base) + '</td><td>Matriz</td><td>' + (im.length ? im.map(function (x) { return '<span class="res-warn">' + esc(x.tipo) + '</span> <span class="res-muted">' + esc(x.ref) + '</span>'; }).join('<br>') : '<span class="res-muted">Nenhum</span>') + '</td></tr>'; }).join('')
        + '</tbody></table></div>';
    }
    // Crédito — o ressarcimento dentro do ciclo de vida do crédito
    R.renderCreditoPainel();
    // Apuração — faixa no Resumo
    var ar = document.getElementById('apur-resumo');
    if (ar) {
      var st = document.getElementById('apur-res-strip');
      if (!st) { st = document.createElement('div'); st.id = 'apur-res-strip'; st.className = 'res-banner'; ar.insertBefore(st, ar.firstChild); }
      var perAt = window.apurPeriodoAtivo ? chaveDe(window.apurPeriodoAtivo) : R.ref;
      function lin(T, s) {
        var sd = saidaDe(T, perAt);
        var noPer = sd.valor ? 'em ' + perLbl(perAt) + ' saem ' + moneyC(sd.valor) + ' para ressarcimento (' + (sd.ped ? sd.ped.id : sd.intc.id) + ') e não são transportados' : 'em ' + perLbl(perAt) + ' nada sai para ressarcimento';
        return '<b>' + T + '</b> ' + noPer + ' · hoje: reservado ' + moneyC(s.reservado) + ', em pedido ' + moneyC(s.emPedido);
      }
      st.innerHTML = tag() + '<span>' + lin('CBS', c) + '<br>' + lin('IBS', i) + '<br><span class="res-muted">O saldo em intenção ou pedido não é transportado para compensação. Créditos ressarcidos saem do saldo como extinção por Ressarcimento, não como compensação.</span></span><button class="res-act" onclick="shRes.abrir()">Ressarcimento →</button>';
    }
  };

  /* ── Crédito: o ressarcimento no ciclo de vida do crédito ─────────────────
     Lê as mesmas linhas da listagem de Crédito (_credRfsLista), com os mesmos
     filtros e período: Apropriados do KPI = livre + reservado + em pedido, e
     Utilizados = compensado + ressarcido. CBS e IBS não se somam. */
  R.renderCreditoPainel = function () {
    var cv = document.getElementById('cred-visao'); if (!cv || !garantir()) return;
    css();
    var el = document.getElementById('cred-res-painel');
    if (!el) {
      el = document.createElement('div'); el.id = 'cred-res-painel'; el.className = 'ccrd'; el.style.marginBottom = '16px';
      var kg = cv.querySelector('.kgrid'); if (kg) kg.insertAdjacentElement('afterend', el); else cv.insertBefore(el, cv.firstChild);
    }
    var linhas = window._credRfsLista && window._credRfsLista.length ? window._credRfsLista : null;
    var ag = { CBS: { livre: 0, reservado: 0, em_pedido: 0, compensado: 0, ressarcido: 0, nRes: 0, nPed: 0, nRsv: 0 }, IBS: { livre: 0, reservado: 0, em_pedido: 0, compensado: 0, ressarcido: 0, nRes: 0, nPed: 0, nRsv: 0 } };
    function soma1(T, sc, met, id, v) {
      var o = ag[T]; if (!o) return;
      var mk = R.marcaKey(id);
      if (sc === 'utilizado') { if (met === 'Ressarcimento') { o.ressarcido += v; o.nRes++; } else o.compensado += v; }
      else if (sc === 'apropriado') { if (mk === 'reservado') { o.reservado += v; o.nRsv++; } else if (mk === 'em_pedido') { o.em_pedido += v; o.nPed++; } else o.livre += v; }
    }
    if (linhas) linhas.forEach(function (r) { soma1(String(r.tipoFiscal || '').toUpperCase(), r.statusCredito, r.metodoExtincao, r.rfId, r.cred || 0); });
    else lista().forEach(function (nf) { if (nf.tipo !== 'entrada') return; (nf.registrosFiscais || []).forEach(function (rf) { soma1((rf.tipoFiscal || '').toUpperCase(), scOf(rf), rf.metodoExtincao, rf.id, rf.valor || 0); }); });
    // o contador de registros desce para a linha de baixo: ao lado do valor
    // ele empurrava a métrica e quebrava o alinhamento da grade
    function rfs(n) { return n ? '<div class="res-muted" style="font-size:10.5px;font-weight:500;margin-top:1px">' + n + ' RF</div>' : ''; }
    function col(T) {
      var o = ag[T];
      return '<div style="flex:1 1 320px;min-width:0"><div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">' + triChip(T) + '<span class="res-muted" style="font-size:11px">' + ORGAO[T] + '</span></div>'
        // As cinco métricas numa grade só: duas grades (3 e 2) em larguras
        // médias deixavam uma métrica órfã e as linhas desencontradas.
        + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:10px 14px">'
        + mini('Apropriado livre', moneyC(o.livre))
        + mini('Reservado · intenção', moneyC(o.reservado) + rfs(o.nRsv))
        + mini('Em pedido', moneyC(o.em_pedido) + rfs(o.nPed))
        + mini('Utilizado · compensado', moneyC(o.compensado))
        + mini('Utilizado · ressarcido', moneyC(o.ressarcido) + rfs(o.nRes))
        + '</div></div>';
    }
    el.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:6px">'
      + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0"><div class="ctitle" style="margin-bottom:0">Ressarcimento no ciclo do crédito</div>' + tag() + chip('amber', 'Simulação 2026') + '</div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="res-act" onclick="shRes.filtrarCredito(\'reservado\')">RFs reservados</button><button class="res-act" onclick="shRes.filtrarCredito(\'em_pedido\')">RFs em pedido</button><button class="res-act" onclick="shRes.filtrarCredito(\'ressarcido\')">RFs ressarcidos</button><button class="res-act p" onclick="shRes.abrir()">Ressarcimento →</button></div></div>'
      + '<div style="font-size:11.5px;color:var(--txt3);margin-bottom:12px;line-height:1.5">Apropriado → reservado pela intenção → em pedido → ressarcido. Reservado e em pedido seguem <b>Apropriados</b> até o pagamento; ressarcido é <b>Utilizado</b> com método Ressarcimento e não abate débito. Mesmo recorte e filtros dos indicadores acima.</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:18px">' + col('CBS') + col('IBS') + '</div>';
  };
  R.filtrarCredito = function (marca) {
    var b = document.getElementById('nav-creditos-btn');
    if (b && window.showView) window.showView('creditos', b);
    var t = document.querySelector('.stab[onclick^="showSub(\'cred\',\'listagem\'"]'); if (t) t.click();
    setTimeout(function () {
      try { if (window.injetarFiltrosCreditos && !document.getElementById('fc-ressarc')) window.injetarFiltrosCreditos(); } catch (e) {}
      var el = document.getElementById('fc-ressarc'); if (el) el.value = marca;
      try { window.creditosFiltrarGrid && window.creditosFiltrarGrid(); } catch (e) {}
    }, 120);
  };

  /* ── inconsistências da família Ressarcimento ────────────────────────── */
  R.TIPOS_INC = {
    res_intencao_sem_pedido: 'Intenção sem pedido no prazo',
    res_saldo_divergente: 'Saldo credor divergente da Receita',
    res_pedido_indeferido: 'Pedido de ressarcimento indeferido',
    res_pagamento_divergente: 'Pagamento divergente do deferido',
    res_impedimento_ibs: 'Impedimento do IBS ao ressarcimento'
  };
  R.inconsistencias = function (inc) {
    if (!garantir()) return;
    function push(o) { o.id = 'INC-' + String(inc.length + 1).padStart(4, '0'); o.familia = 'ressarcimento'; inc.push(o); }
    var d = R._divergente;
    if (d) push({ tipo: 'res_saldo_divergente', tipoLabel: R.TIPOS_INC.res_saldo_divergente, dfId: d.nf.numero, dfNum: d.nf.numero, nfNumero: String(d.nf.numero), rfId: d.rf.id, tipoFiscal: 'CBS', origem: 'rf', tipoFluxo: 'entrada', status: 'aberta', prioridade: d.rf.valor > 100000 ? 'alta' : 'media', valor: d.rf.valor, valorTotal: d.nf.valorTotal || 0, valorLiq: d.nf.valorLiquido || 0, entidade: d.nf.entidade, cnpj: d.nf.cnpj, dataISO: R.hoje, data: br(R.hoje), statusCredito: d.rf.statusCredito, metodoExtincao: d.rf.metodoExtincao || null });
    var pI = R.pedidos.filter(function (p) { return p.tributo === 'IBS' && /^(em_analise|exigencia)$/.test(p.status); })[0];
    if (pI && (R.impedimentos || []).length) {
      var rf0 = idx()[pI.rfs[0]] || {};
      push({ tipo: 'res_impedimento_ibs', tipoLabel: R.TIPOS_INC.res_impedimento_ibs, dfId: pI.id, dfNum: pI.id, nfNumero: '', rfId: null, tipoFiscal: 'IBS', origem: 'df', tipoFluxo: 'entrada', status: 'em_analise', prioridade: 'alta', valor: pI.valor, valorTotal: pI.valor, valorLiq: pI.valor, entidade: 'Comitê Gestor do IBS', cnpj: rf0.cnpj || '', dataISO: pI.protocoladoEm, data: br(pI.protocoladoEm), statusCredito: 'apropriado', metodoExtincao: null });
    }
    var pg = R.recebimentos.filter(function (r) { return r.tributo === 'IBS'; })[0];
    var pp = pg && R.pedidos.filter(function (p) { return p.id === pg.pedidoId; })[0];
    if (pp && pp.valor > pp.deferido) push({ tipo: 'res_pagamento_divergente', tipoLabel: 'Deferido parcial — remanescente a revisar', dfId: pp.id, dfNum: pp.id, nfNumero: '', rfId: null, tipoFiscal: 'IBS', origem: 'df', tipoFluxo: 'entrada', status: 'resolvida', prioridade: 'media', valor: pp.valor - pp.deferido, valorTotal: pp.valor, valorLiq: pp.deferido, entidade: 'Comitê Gestor do IBS', cnpj: '', dataISO: pp.decididoEm, data: br(pp.decididoEm), statusCredito: 'apropriado', metodoExtincao: null });
  };

  /* ── ganchos ─────────────────────────────────────────────────────────── */
  function ganchos() {
    if (typeof window.showView === 'function' && !window.showView._res) {
      var sv = window.showView;
      window.showView = function (id, btn, fb) {
        var r = sv.apply(this, arguments);
        if (id === 'ressarcimento') { var t = document.getElementById('ah-title'); if (t) t.textContent = 'Ressarcimento'; setTimeout(R.render, 0); }
        if (id === 'apuracao') setTimeout(function () { try { if (window.sincronizarApuracao) window.sincronizarApuracao(); } catch (e) {} }, 0);
        if (id === 'dashboard' || id === 'creditos' || id === 'debitos' || id === 'conciliacao' || id === 'apuracao' || id === 'admin') setTimeout(R.renderIntegracoes, 60);
        return r;
      };
      window.showView._res = true;
    }
    if (typeof window.renderizarTabelaCreditos === 'function' && !window.renderizarTabelaCreditos._res) {
      var tc = window.renderizarTabelaCreditos;
      window.renderizarTabelaCreditos = function () { var r = tc.apply(this, arguments); try { R.renderCreditoPainel(); } catch (e) {} return r; };
      window.renderizarTabelaCreditos._res = true;
    }
    if (typeof window.apurRenderAll === 'function' && !window.apurRenderAll._res) {
      var ar = window.apurRenderAll;
      window.apurRenderAll = function () { var r = ar.apply(this, arguments); try { R.renderIntegracoes(); } catch (e) {} return r; };
      window.apurRenderAll._res = true;
    }
  }

  function iniciar() {
    ganchos();
    var n = 0;
    (function tentar() {
      if (garantir()) {
        if (!R._viaBase) { try { if (window.dataSyncFixed && window.dataSyncFixed.sincronizar) window.dataSyncFixed.sincronizar(); } catch (e) {} }
        try { R.renderIntegracoes(); } catch (e) {}
        try {
          var inc = window._inconsistenciasGlobal;
          if (inc && !inc.some(function (x) { return x.familia === 'ressarcimento'; })) R.inconsistencias(inc);
        } catch (e) {}
        return;
      }
      if (++n < 40) setTimeout(tentar, 500);
    })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(iniciar, 0); });
  else setTimeout(iniciar, 0);
})();

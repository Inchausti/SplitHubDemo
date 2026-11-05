/* ══ Eventos fiscais — a esteira e o detalhe do evento (lote 1) ═════════════
   Constrói as telas T-01 e T-02 da proposta de telas v1.2, ajustadas pelas
   decisões que vieram depois dela:
     · o evento chega pela API pública ou pelo upload de CSV, enviado pelo
       cliente a partir do ERP e do sistema fiscal (D-21)
     · a confirmação é por tributo: CBS pela Receita Federal, IBS pelo Comitê
       Gestor, cada um no seu tempo — nunca somados (D-21, D-22)
     · atributo vale na autorização; valor só no reflexo do órgão (C-01)
     · divergência nunca aplica valor sozinha (ciclo de vida D-09)
     · a v1 não segmenta por item (05/10/2026): o efeito cai no registro do
       tributo, no documento
     · o previsto nunca aparece somado ao vigente (princípio visual das telas)
   Tudo simulado: os eventos de exemplo são gerados sobre as NF-e da base e
   vivem em memória. A leitura da Receita Federal e o arquivo do Comitê Gestor
   são botões de simulação.
   Pacote AV-EF, atrás da flag eventos_modulo (features.js, pacote AV-00).
   A rota é #/eventos — #/eventos-fiscais já é a configuração do AV-EV.
   ═══════════════════════════════════════════════════════════════════════════ */
/* @pacote — o estado das flags é reescrito por tools/avaliacao.py promover */
window.shFeature && shFeature.registrar({"id": "AV-EF", "nome": "Eventos fiscais — esteira e detalhe", "branch": "feat/modulo-eventos", "entrada": "#/eventos", "flags": {"eventos_modulo": "avaliacao"}, "rotulos": {"eventos_modulo": "A esteira de eventos recebidos e o detalhe com a confirmação por órgão"}, "alvos": {"eventos_modulo": ["#nav-eventos-btn", "#view-eventos"]}});
/* @fim-pacote */
(function () {
  'use strict';

  var FLAG = 'eventos_modulo';
  function on() { return !window.shFeature || shFeature.ligada(FLAG); }

  /* ── utilitários ──────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(v) { return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function delta(v) {
    if (v == null) return '<span class="evm-muted">?</span>';
    if (!v) return '<span class="evm-zero">R$ 0,00</span>';
    return '<span class="' + (v > 0 ? 'evm-pos' : 'evm-neg') + '">' + (v > 0 ? '+' : '−') + money(Math.abs(v)) + '</span>';
  }
  function p2(n) { return ('0' + n).slice(-2); }
  function fD(d) { d = new Date(d); return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear(); }
  function fDH(d) { d = new Date(d); return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); }
  function iso(d) { d = new Date(d); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function comp(d) { d = new Date(d); return MESES[d.getMonth()] + '/' + d.getFullYear(); }
  function ha(d) {
    var m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 60) return 'há ' + Math.max(m, 1) + ' min';
    var h = Math.round(m / 60); if (h < 24) return 'há ' + h + ' h';
    var dd = Math.round(h / 24); return 'há ' + dd + (dd === 1 ? ' dia' : ' dias');
  }
  function pl(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function redondo(v) { var a = Math.abs(v), q = a >= 10000 ? 1000 : 100; return Math.max(q, Math.round(a / q) * q); }
  var DIA = 86400000, HORA = 3600000, MIN = 60000;
  function fechar(id) { var e = document.getElementById(id); if (e) e.remove(); }
  function toast(msg) {
    fechar('evm-toast');
    var t = document.createElement('div');
    t.id = 'evm-toast'; t.className = 'evm-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 4500);
  }

  // o CSS vem pelo próprio módulo, para o pacote não disputar linhas do index.html
  (function () {
    if (document.getElementById('evm-css')) return;
    var l = document.createElement('link');
    l.id = 'evm-css'; l.rel = 'stylesheet'; l.href = 'css/eventos-modulo.css?v=2';
    document.head.appendChild(l);
  })();

  /* ── Catálogo dos eventos que chegam pela API ─────────────────────────── */
  // efeito: valor | atributo | reversao.  acao[lado]: o que o SplitHub planeja; sinal sobre o registro
  var CAT = {
    '110001': { nome: 'Cancelamento de evento', tipo: 'cancelamento_evento', autor: 'autor_evento', efeito: 'reversao' },
    '112110': { nome: 'Informação de efetivo pagamento integral', tipo: 'pagamento_integral', autor: 'emitente', efeito: 'atributo',
      acao: { entrada: 'Marcar o documento como pago integralmente', saida: 'Marcar o documento como pago integralmente' } },
    '112120': { nome: 'Importação em ALC/ZFM não convertida em isenção', tipo: 'alc_zfm_nao_convertida', autor: 'emitente', efeito: 'valor',
      acao: { saida: 'Somar ao débito o tributo da isenção não convertida' }, sinal: { saida: 1 } },
    '112130': { nome: 'Perecimento, perda, roubo ou furto — transporte CIF', tipo: 'perecimento_cif', autor: 'emitente', efeito: 'valor',
      acao: { entrada: 'Estornar o crédito do que não foi entregue', saida: 'Reduzir o débito do que pereceu antes da entrega' }, sinal: { entrada: -1, saida: -1 } },
    '112140': { nome: 'Fornecimento não realizado com pagamento antecipado', tipo: 'fornecimento_nao_realizado', autor: 'emitente', efeito: 'valor',
      acao: { entrada: 'Estornar o crédito do que não foi fornecido', saida: 'Reduzir o débito do que não foi fornecido' }, sinal: { entrada: -1, saida: -1 } },
    '112150': { nome: 'Atualização da data de previsão de entrega', tipo: 'previsao_entrega', autor: 'emitente', efeito: 'atributo',
      acao: { entrada: 'Registrar a nova data de entrega', saida: 'Registrar a nova data de entrega' } },
    '211110': { nome: 'Solicitação de apropriação de crédito presumido', tipo: 'apropriacao_credito_presumido', autor: 'destinatario', efeito: 'valor',
      acao: { entrada: 'Somar o crédito presumido ao crédito do documento' }, sinal: { entrada: 1 } },
    '211124': { nome: 'Perecimento, perda, roubo ou furto — transporte FOB', tipo: 'perecimento_fob', autor: 'destinatario', efeito: 'valor',
      acao: { entrada: 'Estornar o crédito do que pereceu' }, sinal: { entrada: -1 } },
    '211128': { nome: 'Aceite de débito por emissão de nota de crédito', tipo: 'aceite_nota_credito', autor: 'destinatario', efeito: 'valor',
      acao: { entrada: 'Reduzir o crédito pelo valor da nota de crédito', saida: 'Consolidar a redução do débito pela nota de crédito' }, sinal: { entrada: -1, saida: -1 } },
    '211130': { nome: 'Imobilização de item', tipo: 'imobilizacao', autor: 'destinatario', efeito: 'atributo',
      acao: { entrada: 'Marcar o bem como imobilizado — muda o prazo de ressarcimento' } },
    '211140': { nome: 'Apropriação de crédito de combustível', tipo: 'credito_combustivel', autor: 'destinatario', efeito: 'valor',
      acao: { entrada: 'Apropriar o crédito do combustível consumido' }, sinal: { entrada: 1 } },
    '211150': { nome: 'Apropriação de crédito de bens e serviços vinculados à atividade', tipo: 'credito_vinculado_atividade', autor: 'destinatario', efeito: 'valor',
      acao: { entrada: 'Apropriar o crédito condicionado à atividade' }, sinal: { entrada: 1 } }
  };
  var SERIES = [['110', 'Cancelamento'], ['112', 'Do emitente'], ['211', 'Do destinatário'], ['212', 'Sucessão'], ['412', 'Do órgão']];
  var AUTOR = { emitente: 'Emitente', destinatario: 'Destinatário', autor_evento: 'Autor do evento cancelado' };
  var ROLE = { emitente: 'issuer', destinatario: 'acquirer', autor_evento: 'issuer' };
  // nunca agrupados: cada tributo tem o seu órgão, o seu campo e o seu tempo
  var ORGAO = {
    CBS: { nome: 'Receita Federal', o: 'a', pelo: 'pela', curto: 'RFB', campo: { entrada: 'creditos[].cbs.apurado', saida: 'debitos[].cbs.apurado' } },
    IBS: { nome: 'Comitê Gestor', o: 'o', pelo: 'pelo', curto: 'CG', campo: { entrada: 'CREDITO_A_PROPRIAR', saida: 'DEBITO_EM_ABERTO' } }
  };
  var TRIBS = ['CBS', 'IBS'];
  var ESTADOS = ['capturada', 'planejada', 'aguardando', 'executada', 'divergente', 'ausente', 'cancelada'];
  var ESPERA_AUSENCIA = 30; // dias — alinhada à conciliação da apuração assistida (D-EV-05)

  /* ── Estado ───────────────────────────────────────────────────────────── */
  var ST = window._evmState = {
    ok: false, eventos: [], ausentes: [], seq: 400,
    aba: 'esteira', kpi: null, f: {},
    leitura: { CBS: null, IBS: null }, cota: 3, cotaUsada: 0
  };

  function ultimaLeitura06(ref) {
    var d = new Date(ref); d.setHours(6, 0, 0, 0);
    if (d.getTime() > ref) d = new Date(d.getTime() - DIA);
    return d.getTime();
  }

  /* roteiro dos exemplos: [código, lado, estado CBS, estado IBS, fração do registro, canal] */
  var ROTEIRO = [
    ['211128', 'entrada', 'executada', 'executada', 0.2, 'API'],
    ['211124', 'entrada', 'executada', 'executada', 0.25, 'API'],
    ['211110', 'entrada', 'aguardando', 'aguardando', 0.1, 'API'],
    ['211128', 'entrada', 'executada', 'divergente', 0.1, 'API'],
    ['112150', 'entrada', 'executada', 'executada', 0, 'CSV'],
    ['112140', 'entrada', 'executada', 'aguardando', 0.5, 'API'],
    ['211140', 'entrada', 'planejada', 'planejada', 0.1, 'API'],
    ['211150', 'entrada', 'aguardando', 'aguardando', 0.25, 'API'],
    ['112110', 'entrada', 'executada', 'executada', 0, 'API'],
    ['211130', 'entrada', 'executada', 'executada', 0, 'CSV'],
    ['112130', 'entrada', 'executada', 'executada', 0.1, 'CSV'],
    ['211128', 'entrada', 'divergente', 'executada', 0.2, 'API'],
    ['211110', 'entrada', 'executada', 'executada', 0.1, 'API'],
    ['211124', 'entrada', 'executada', 'aguardando', 0.2, 'API'],
    ['211128', 'entrada', 'planejada', 'planejada', 0.25, 'API'],
    ['211150', 'entrada', 'executada', 'executada', 0.1, 'CSV'],
    ['211128', 'entrada', 'capturada', 'capturada', 0.2, 'API'],
    ['211110', 'entrada', 'planejada', 'planejada', 0.2, 'API'],   // cancelado pelo 110001 abaixo
    ['211128', 'saida', 'executada', 'executada', 0.1, 'API'],
    ['112120', 'saida', 'executada', 'aguardando', 0.2, 'API'],
    ['112130', 'saida', 'executada', 'executada', 0.1, 'API'],
    ['112140', 'saida', 'divergente', 'divergente', 0.25, 'API'],
    ['112110', 'saida', 'executada', 'executada', 0, 'API'],
    ['112150', 'saida', 'executada', 'executada', 0, 'API'],
    ['211128', 'saida', 'aguardando', 'aguardando', 0.2, 'API'],
    ['112140', 'saida', 'executada', 'executada', 0.5, 'CSV'],
    ['112120', 'saida', 'planejada', 'planejada', 0.1, 'API'],
    ['211128', 'saida', 'executada', 'executada', 0.25, 'API'],
    ['112130', 'saida', 'aguardando', 'executada', 0.2, 'API'],
    ['112110', 'saida', 'executada', 'executada', 0, 'CSV']
  ];
  // ausências: o órgão mostra o efeito, ou a norma exige o evento, e ele não chegou
  var AUSENCIAS = [
    { cod: '211128', lado: 'entrada', tribs: ['CBS'], frac: 0.1, dias: 4,
      indicio: function (v) { return 'A Receita Federal reduziu a CBS deste documento em ' + money(v.CBS) + ' e nenhum evento chegou que explique a redução.'; } },
    { cod: '211128', lado: 'entrada', tribs: ['CBS', 'IBS'], frac: 0.2, dias: 12,
      indicio: function () { return 'Chegou a nota de crédito (tipo 04) que referencia este documento, sem o aceite do destinatário. A nota de crédito só consolida com o 211128.'; } },
    { cod: '112110', lado: 'saida', tribs: ['IBS'], frac: 0, dias: 7,
      indicio: function () { return 'O Comitê Gestor registrou o IBS deste documento como pago integralmente, e a informação de pagamento integral não chegou.'; } },
    { cod: '211110', lado: 'entrada', tribs: ['IBS'], frac: 0.1, dias: 21,
      indicio: function (v) { return 'O Comitê Gestor mostra ' + money(v.IBS) + ' de crédito presumido apropriado neste documento sem a solicitação correspondente.'; } }
  ];

  function nfs() { return window._nfListaCompleta || window.nfListaFiltradaGlobal || []; }
  function rfDe(nf, t) { return (nf.registrosFiscais || []).filter(function (r) { return String(r.tipoFiscal).toUpperCase() === t; })[0] || null; }

  function candidatos(lado, usados, agora) {
    var lim = iso(agora - 45 * DIA);
    var l = nfs().filter(function (nf) {
      return nf.tipo === lado && nf.tipoDF === 'NF-e' && nf.data <= lim && usados.indexOf(nf.numero) < 0 && rfDe(nf, 'CBS') && rfDe(nf, 'IBS');
    });
    if (!l.length) l = nfs().filter(function (nf) { return nf.tipo === lado && usados.indexOf(nf.numero) < 0 && rfDe(nf, 'CBS') && rfDe(nf, 'IBS'); });
    return l;
  }

  function datas(estados, k, agora, canal) {
    var ult = ultimaLeitura06(agora), capt;
    var pior = estados.indexOf('capturada') >= 0 ? 'capturada' : estados.indexOf('planejada') >= 0 ? 'planejada'
      : estados.indexOf('aguardando') >= 0 ? 'aguardando' : estados.indexOf('divergente') >= 0 ? 'divergente' : 'executada';
    if (pior === 'capturada') capt = agora - 4 * MIN;
    else if (pior === 'planejada') capt = Math.max(ult + 40 * MIN, agora - (40 + k % 80) * MIN);
    else if (pior === 'aguardando') capt = ult - (1 + k % 5) * DIA - (2 + k % 6) * HORA;
    else if (pior === 'divergente') capt = ult - (6 + k % 18) * DIA - (3 + k % 5) * HORA;
    else capt = ult - (3 + k % 34) * DIA - (1 + k % 9) * HORA;
    var aut = canal === 'CSV' ? capt - (20 + k % 20) * HORA : capt - (8 + k % 40) * MIN;
    return { capt: capt, aut: aut, plan: capt + MIN };
  }

  function semear() {
    if (ST.ok) return true;
    if (!nfs().length) return false;
    var agora = Date.now(), usados = [], ult = ultimaLeitura06(agora);
    ST.leitura = { CBS: ult, IBS: ult + 12 * MIN };
    var cancelavel = null, ultimaNf = {};
    ROTEIRO.forEach(function (r, i) {
      var cod = r[0], lado = r[1], c = CAT[cod], k = hash(cod + lado + i), nf;
      // de quatro em quatro, o evento cai num documento que já tem outro: a vida real do documento
      if (i % 4 === 3 && ultimaNf[lado]) nf = ultimaNf[lado];
      else {
        var cand = candidatos(lado, usados, agora); if (!cand.length) return;
        nf = cand[k % cand.length]; usados.push(nf.numero);
      }
      ultimaNf[lado] = nf;
      var est = { CBS: r[2], IBS: r[3] };
      var dt = datas([est.CBS, est.IBS], k, agora, r[5]);
      var ev = {
        id: null, cod: cod, lado: lado, canal: r[5], nf: nf.numero, entidade: nf.entidade, cnpj: nf.cnpj, cnpjEmpresa: nf.cnpjComprador, chave: nf.chaveDF,
        competenciaDoc: comp(nf.data + 'T12:00:00'), aut: dt.aut, capt: dt.capt, plan: r[2] === 'capturada' ? null : dt.plan,
        protocolo: '1' + (lado === 'entrada' ? '41' : '35') + '26' + String(100000000 + k % 899999999).slice(0, 9) + p2(i),
        seq: 1, revisao: false, canceladoPor: null, cancela: null, trib: {}
      };
      TRIBS.forEach(function (t) {
        var rf = rfDe(nf, t), antes = Number(rf.valor) || 0;
        var d = c.efeito === 'valor' ? (c.sinal[lado] || 0) * redondo(antes * r[4]) : 0;
        var x = { rf: rf.id, antes: antes, delta: d, estado: est[t], lido: null, observado: null, exec: null };
        if (c.efeito === 'atributo' && est[t] !== 'capturada') { x.estado = 'executada'; x.exec = ev.aut; }
        else if (x.estado === 'executada') { x.exec = Math.max(ev.capt + HORA, ultimaLeitura06(ev.capt + (1 + k % 3) * DIA)); x.lido = x.exec; x.observado = antes + d; }
        else if (x.estado === 'aguardando') { x.lido = ST.leitura[t]; x.observado = antes; }
        else if (x.estado === 'divergente') { x.lido = ST.leitura[t]; x.observado = antes + (d > 0 ? 1 : -1) * redondo(Math.abs(d) / 2); }
        ev.trib[t] = x;
      });
      ev.id = 'EV-' + ('000000' + (++ST.seq)).slice(-6);
      ST.eventos.push(ev);
      if (cod === '211110' && r[2] === 'planejada' && !cancelavel) cancelavel = ev;
    });
    // um 110001 que cancela um evento ainda planejado: nada havia sido aplicado
    if (cancelavel) {
      var alvo = cancelavel, cc = alvo.capt + 25 * MIN;
      var ca = {
        id: 'EV-' + ('000000' + (++ST.seq)).slice(-6), cod: '110001', lado: alvo.lado, canal: 'API', nf: alvo.nf, entidade: alvo.entidade, cnpj: alvo.cnpj, cnpjEmpresa: alvo.cnpjEmpresa,
        chave: alvo.chave, competenciaDoc: alvo.competenciaDoc, aut: cc - 6 * MIN, capt: Math.min(cc, Date.now() - 2 * MIN), plan: Math.min(cc, Date.now() - 2 * MIN) + MIN,
        protocolo: alvo.protocolo.slice(0, -2) + '99', seq: 1, revisao: false, canceladoPor: null, cancela: alvo.id, trib: {}
      };
      TRIBS.forEach(function (t) { ca.trib[t] = { rf: alvo.trib[t].rf, antes: alvo.trib[t].antes, delta: 0, estado: 'executada', lido: null, observado: null, exec: ca.aut }; });
      alvo.canceladoPor = ca.id; alvo.canceladoEm = ca.aut;
      ST.eventos.push(ca);
    }
    AUSENCIAS.forEach(function (a, i) {
      var cand = candidatos(a.lado, usados, agora); if (!cand.length) return;
      var nf = cand[hash('aus' + i) % cand.length]; usados.push(nf.numero);
      var v = {};
      a.tribs.forEach(function (t) { var rf = rfDe(nf, t); v[t] = a.frac ? redondo((Number(rf.valor) || 0) * a.frac) : 0; });
      ST.ausentes.push({ id: 'AUS-' + p2(i + 1), cod: a.cod, lado: a.lado, nf: nf.numero, entidade: nf.entidade, chave: nf.chaveDF,
        tribs: a.tribs, valores: v, desde: ult - a.dias * DIA, indicio: a.indicio(v), revisao: false, pedido: null });
    });
    encadear();
    ST.eventos.sort(function (a, b) { return b.capt - a.capt; });
    ST.ok = true;
    return true;
  }

  // vários eventos no mesmo documento: o "antes" de cada um é o vigente deixado pelo anterior já executado
  function encadear() {
    var porNf = {};
    ST.eventos.forEach(function (ev) { (porNf[ev.nf] = porNf[ev.nf] || []).push(ev); });
    Object.keys(porNf).forEach(function (n) {
      var evs = porNf[n].sort(function (a, b) { return a.capt - b.capt; }), vig = {};
      evs.forEach(function (ev) {
        TRIBS.forEach(function (t) {
          var x = ev.trib[t]; if (!x) return;
          if (vig[t] == null) vig[t] = x.antes;
          var gap = x.observado == null ? null : x.observado - x.antes;
          x.antes = vig[t];
          if (gap != null) x.observado = x.antes + gap;
          if (x.estado === 'executada' && !ev.canceladoPor && CAT[ev.cod].efeito === 'valor') vig[t] = x.antes + x.delta;
        });
      });
    });
  }

  /* ── Estado do evento a partir dos tributos ───────────────────────────── */
  function tribsDo(ev) { return TRIBS.filter(function (t) { return ev.trib[t]; }); }
  function estadoEv(ev) {
    if (ev.canceladoPor) return 'cancelada';
    var es = tribsDo(ev).map(function (t) { return ev.trib[t].estado; });
    if (es.indexOf('divergente') >= 0) return 'divergente';
    if (es.indexOf('capturada') >= 0) return 'capturada';
    if (es.every(function (e) { return e === 'executada'; })) return 'executada';
    if (es.indexOf('aguardando') >= 0) return 'aguardando';
    return 'planejada';
  }
  var ROT_EST = { capturada: 'capturada', planejada: 'planejada', aguardando: 'aguardando', executada: 'executada', divergente: 'divergente', ausente: 'ausente', cancelada: 'cancelada' };
  function chip(e, trib) { return '<span class="evm-chip ' + e + '">' + (trib ? '<span class="evm-trib">' + trib + '</span>' : '') + ROT_EST[e] + '</span>'; }
  function chipsEv(ev) {
    var e = estadoEv(ev);
    if (e === 'cancelada') return chip('cancelada');
    var ts = tribsDo(ev), es = ts.map(function (t) { return ev.trib[t].estado; });
    if (es.every(function (x) { return x === es[0]; })) return chip(es[0]);
    // tributos em tempos diferentes: um chip por órgão
    return '<span class="evm-chips">' + ts.map(function (t) { return chip(ev.trib[t].estado, t); }).join('') + '</span>';
  }
  function efeitoEv(ev) {
    var c = CAT[ev.cod];
    if (ev.cod === '110001' || c.efeito === 'atributo') return 0;
    return tribsDo(ev).reduce(function (s, t) { return s + ev.trib[t].delta; }, 0);
  }
  function acaoEv(ev) {
    if (ev.cod === '110001') return 'Cancelar o ' + ev.cancela + ' — nada havia sido aplicado';
    var c = CAT[ev.cod]; return (c.acao && c.acao[ev.lado]) || '—';
  }
  function serie(cod) { return String(cod).slice(0, 3); }
  function tribRot(ev) { return tribsDo(ev).join(' · '); }

  /* ── Linhas da esteira (eventos e ausências) ──────────────────────────── */
  function linhas() {
    var vis = {}; (window.nfListaFiltradaGlobal || nfs()).forEach(function (nf) { vis[nf.numero] = 1; });
    var L = ST.eventos.filter(function (ev) { return vis[ev.nf]; }).map(function (ev) {
      return { tipo: 'ev', ev: ev, id: ev.id, cod: ev.cod, nf: ev.nf, entidade: ev.entidade, lado: ev.lado, estado: estadoEv(ev),
        data: ev.capt, tribs: tribsDo(ev), autor: CAT[ev.cod].autor, canal: ev.canal };
    });
    ST.ausentes.filter(function (a) { return vis[a.nf]; }).forEach(function (a) {
      L.push({ tipo: 'aus', aus: a, id: a.id, cod: a.cod, nf: a.nf, entidade: a.entidade, lado: a.lado, estado: 'ausente',
        data: a.desde, tribs: a.tribs, autor: CAT[a.cod].autor, canal: '' });
    });
    return L;
  }
  function filtrar(L) {
    var f = ST.f, q = (f.q || '').toLowerCase();
    return L.filter(function (l) {
      if (ST.aba === 'pendentes' && ['planejada', 'aguardando', 'capturada'].indexOf(l.estado) < 0) return false;
      if (ST.aba === 'ausencias' && l.estado !== 'ausente') return false;
      if (ST.kpi === 'planejados' && ['planejada', 'aguardando'].indexOf(l.estado) < 0) return false;
      if (ST.kpi && ST.kpi !== 'planejados' && l.estado !== ST.kpi) return false;
      if (f.estado && l.estado !== f.estado) return false;
      if (f.serie && serie(l.cod) !== f.serie) return false;
      if (f.cod && l.cod !== f.cod) return false;
      if (f.trib && l.tribs.indexOf(f.trib) < 0) return false;
      if (f.lado && l.lado !== f.lado) return false;
      if (f.autor && l.autor !== f.autor) return false;
      if (f.canal && l.canal !== f.canal) return false;
      if (f.de && iso(l.data) < f.de) return false;
      if (f.ate && iso(l.data) > f.ate) return false;
      if (q && (l.id + ' ' + l.cod + ' ' + l.nf + ' ' + l.entidade + ' ' + (CAT[l.cod].nome || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) {
      if (ST.aba === 'pendentes' || ST.kpi) {
        var pa = a.estado === 'ausente' || a.estado === 'divergente' ? 0 : 1, pb = b.estado === 'ausente' || b.estado === 'divergente' ? 0 : 1;
        if (pa !== pb) return pa - pb;
      }
      return b.data - a.data;
    });
  }

  /* ── Montagem da view, do menu e da rota ──────────────────────────────── */
  function montar() {
    if (!on()) return false;
    if (!document.getElementById('nav-eventos-btn')) {
      var ref = document.getElementById('nav-inconsist-btn');
      if (ref) ref.insertAdjacentHTML('afterend',
        '<button class="nav-sub-btn" id="nav-eventos-btn" title="Eventos fiscais" data-view="eventos" onclick="shEvm.abrirView(this)"><span class="nav-sub-dot"></span><span class="nav-label"> Eventos fiscais</span></button>');
    }
    if (!document.getElementById('view-eventos')) {
      var irma = document.getElementById('view-inconsistencias');
      if (!irma) return false;
      irma.insertAdjacentHTML('afterend', '<div id="view-eventos" class="view"></div>');
    }
    return true;
  }
  function abrirView(btn) {
    if (!montar()) return;
    btn = btn || document.getElementById('nav-eventos-btn');
    if (typeof window.showView === 'function') window.showView('eventos', btn);
    if (typeof window.expandNavGroup === 'function') { try { window.expandNavGroup('nav-sub-group-apuracao'); } catch (e) {} }
    render();
    window.scrollTo(0, 0);
  }

  /* ── T-01 · a esteira ─────────────────────────────────────────────────── */
  function kpis(L) {
    var n = function (fn) { return L.filter(fn).length; };
    var ev = L.filter(function (l) { return l.tipo === 'ev'; });
    return {
      capturados: ev.length,
      planejados: n(function (l) { return l.estado === 'planejada' || l.estado === 'aguardando'; }),
      executados: n(function (l) { return l.estado === 'executada'; }),
      divergentes: n(function (l) { return l.estado === 'divergente'; }),
      ausentes: n(function (l) { return l.estado === 'ausente'; }),
      api: ev.filter(function (l) { return l.canal === 'API'; }).length,
      csv: ev.filter(function (l) { return l.canal === 'CSV'; }).length,
      capturadas: n(function (l) { return l.estado === 'capturada'; })
    };
  }
  function kcard(id, rot, val, sub, cor) {
    var ativo = ST.kpi === id || (id === 'executados' && ST.kpi === 'executada') || (id === 'divergentes' && ST.kpi === 'divergente') || (id === 'ausentes' && ST.kpi === 'ausente');
    var alvo = { capturados: '', planejados: 'planejados', executados: 'executada', divergentes: 'divergente', ausentes: 'ausente' }[id];
    return '<div class="kcard evm-kpi ' + (cor || '') + (ativo ? ' on' : '') + '" role="button" tabindex="0" aria-pressed="' + ativo + '"'
      + ' onclick="shEvm.kpi(\'' + alvo + '\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();shEvm.kpi(\'' + alvo + '\')}">'
      + '<div class="klbl">' + rot + '</div><div class="kval">' + val + '</div><div class="ksub">' + sub + '</div></div>';
  }
  function opt(v, rot, sel) { return '<option value="' + esc(v) + '"' + (sel === v ? ' selected' : '') + '>' + esc(rot) + '</option>'; }
  function filtrosHtml() {
    var f = ST.f;
    var tipos = '<option value="">Todos</option>' + SERIES.map(function (s) {
      var cods = Object.keys(CAT).filter(function (c) { return serie(c) === s[0]; });
      return '<optgroup label="' + s[0] + 'xxx · ' + s[1] + '">' + (cods.length ? cods.map(function (c) { return opt(c, c + ' · ' + CAT[c].nome, f.cod); }).join('') : '<option disabled>nenhum evento da série nesta base</option>') + '</optgroup>';
    }).join('');
    var n = ['estado', 'cod', 'trib', 'lado', 'autor', 'canal', 'de', 'ate'].filter(function (k) { return f[k]; }).length;
    return '<div class="sh-fp">'
      + '<div class="sh-fp-bar">'
      + '<div class="sh-fp-sw"><span class="sh-fp-sw-ico">⌕</span><input id="evm-busca" type="text" placeholder="Buscar evento, documento, código ou entidade…" value="' + esc(f.q || '') + '" oninput="shEvm.filtro(\'q\',this.value)" aria-label="Buscar na esteira"></div>'
      + '<button id="evm-f-toggle-btn" class="sh-fp-btn' + (ST.fAberto ? ' open' : '') + '" onclick="shEvm.alternarFiltros()" aria-expanded="' + !!ST.fAberto + '">⧉ Filtros <span class="sh-fp-badge" data-count="' + n + '">' + n + '</span></button>'
      + '</div>'
      + '<div class="sh-fp-panel" id="evm-f-corpo" style="display:' + (ST.fAberto ? 'block' : 'none') + '">'
      + '<div class="sh-fp-grid">'
      + '<div class="sh-fp-field"><label for="evm-f-cod">Tipo de evento</label><select id="evm-f-cod" onchange="shEvm.filtro(\'cod\',this.value)">' + tipos + '</select></div>'
      + '<div class="sh-fp-field"><label for="evm-f-estado">Estado da ação</label><select id="evm-f-estado" onchange="shEvm.filtro(\'estado\',this.value)"><option value="">Todos</option>' + ESTADOS.map(function (e) { return opt(e, ROT_EST[e], f.estado); }).join('') + '</select></div>'
      + '<div class="sh-fp-field"><label for="evm-f-trib">Tributo</label><select id="evm-f-trib" onchange="shEvm.filtro(\'trib\',this.value)"><option value="">Todos</option>' + opt('CBS', 'CBS — Receita Federal', f.trib) + opt('IBS', 'IBS — Comitê Gestor', f.trib) + '</select></div>'
      + '<div class="sh-fp-field"><label for="evm-f-lado">Documento</label><select id="evm-f-lado" onchange="shEvm.filtro(\'lado\',this.value)"><option value="">Entrada e saída</option>' + opt('entrada', 'Entrada — crédito', f.lado) + opt('saida', 'Saída — débito', f.lado) + '</select></div>'
      + '<div class="sh-fp-field"><label for="evm-f-autor">Autor</label><select id="evm-f-autor" onchange="shEvm.filtro(\'autor\',this.value)"><option value="">Todos</option>' + Object.keys(AUTOR).map(function (a) { return opt(a, AUTOR[a], f.autor); }).join('') + '</select></div>'
      + '<div class="sh-fp-field"><label for="evm-f-canal">Recebido por</label><select id="evm-f-canal" onchange="shEvm.filtro(\'canal\',this.value)"><option value="">API e CSV</option>' + opt('API', 'API', f.canal) + opt('CSV', 'Upload de CSV', f.canal) + '</select></div>'
      + '<div class="sh-fp-field"><label for="evm-f-de">Recebido — de</label><input id="evm-f-de" type="date" value="' + esc(f.de || '') + '" onchange="shEvm.filtro(\'de\',this.value)"></div>'
      + '<div class="sh-fp-field"><label for="evm-f-ate">Recebido — até</label><input id="evm-f-ate" type="date" value="' + esc(f.ate || '') + '" onchange="shEvm.filtro(\'ate\',this.value)"></div>'
      + '</div>'
      + '<div class="sh-fp-footer"><button class="sh-fp-clear" onclick="shEvm.limpar()">✕ Limpar filtros</button><span class="sh-fp-count" id="evm-f-contagem"></span><button class="sh-fp-apply" onclick="shEvm.alternarFiltros()">Fechar</button></div>'
      + '</div></div>';
  }

  function linhaEv(l) {
    if (l.tipo === 'aus') {
      var a = l.aus;
      return '<tr class="evm-linha ausente" tabindex="0" onclick="shEvm.ausencia(\'' + a.id + '\')" onkeydown="if(event.key===\'Enter\')shEvm.ausencia(\'' + a.id + '\')">'
        + '<td class="evm-mono evm-muted">—</td>'
        + '<td><span class="evm-mono">' + a.cod + '</span> <span class="evm-small">esperado · ' + esc(CAT[a.cod].nome) + '</span></td>'
        + '<td><span class="evm-mono">' + esc(a.nf) + '</span><div class="evm-small">' + esc(a.entidade) + '</div></td>'
        + '<td class="evm-acao evm-muted">Nenhuma — o evento não chegou</td>'
        + '<td class="evm-num">' + delta(null) + '</td>'
        + '<td class="evm-mono">' + a.tribs.join(' · ') + '</td>'
        + '<td>' + chip('ausente') + '</td></tr>';
    }
    var ev = l.ev, c = CAT[ev.cod];
    return '<tr class="evm-linha ' + l.estado + '" tabindex="0" onclick="shEvm.detalhe(\'' + ev.id + '\')" onkeydown="if(event.key===\'Enter\')shEvm.detalhe(\'' + ev.id + '\')">'
      + '<td class="evm-mono">' + ev.id + (ev.revisao ? ' <span title="Marcado para revisão" aria-label="Marcado para revisão">⚑</span>' : '') + '<div class="evm-small">' + fDH(ev.capt) + ' · ' + ev.canal + '</div></td>'
      + '<td><span class="evm-mono">' + ev.cod + '</span> <span class="evm-small">' + esc(c.nome) + '</span></td>'
      + '<td><span class="evm-mono">' + esc(ev.nf) + '</span> <span class="evm-small">' + (ev.lado === 'entrada' ? 'entrada' : 'saída') + '</span><div class="evm-small">' + esc(ev.entidade) + '</div></td>'
      + '<td class="evm-acao' + (l.estado === 'capturada' ? ' evm-muted' : '') + '">' + (l.estado === 'capturada' ? 'Calculando o efeito' : esc(acaoEv(ev))) + '</td>'
      + '<td class="evm-num">' + (l.estado === 'capturada' ? '<span class="evm-muted">em cálculo</span>'
        : ev.canceladoPor ? '<s class="evm-muted" title="Cancelado — nada aplicado">' + delta(efeitoEv(ev)).replace(/<[^>]+>/g, '') + '</s>' : delta(efeitoEv(ev))) + '</td>'
      + '<td class="evm-mono">' + tribRot(ev) + '</td>'
      + '<td>' + chipsEv(ev) + '</td></tr>';
  }

  function porDocumento(L) {
    var g = {}, ordem = [];
    L.forEach(function (l) {
      if (!g[l.nf]) { g[l.nf] = { nf: l.nf, entidade: l.entidade, lado: l.lado, ls: [] }; ordem.push(l.nf); }
      g[l.nf].ls.push(l);
    });
    var peso = { ausente: 0, divergente: 1, capturada: 2, planejada: 3, aguardando: 4, executada: 5, cancelada: 6 };
    return ordem.map(function (k) {
      var d = g[k], prev = { CBS: 0, IBS: 0 }, apl = { CBS: 0, IBS: 0 }, pior = 'cancelada', ult = 0;
      d.ls.forEach(function (l) {
        if (peso[l.estado] < peso[pior]) pior = l.estado;
        if (l.data > ult) ult = l.data;
        if (l.tipo !== 'ev' || l.ev.canceladoPor || CAT[l.cod].efeito !== 'valor') return;
        TRIBS.forEach(function (t) { var x = l.ev.trib[t]; if (!x) return; if (x.estado === 'executada') apl[t] += x.delta; else prev[t] += x.delta; });
      });
      return '<tr class="evm-linha" tabindex="0" onclick="shEvm.doDocumento(\'' + esc(d.nf) + '\')" onkeydown="if(event.key===\'Enter\')shEvm.doDocumento(\'' + esc(d.nf) + '\')">'
        + '<td><span class="evm-mono">' + esc(d.nf) + '</span> <span class="evm-small">' + (d.lado === 'entrada' ? 'entrada · crédito' : 'saída · débito') + '</span><div class="evm-small">' + esc(d.entidade) + '</div></td>'
        + '<td class="evm-num">' + d.ls.length + '</td>'
        + '<td class="evm-small">' + fDH(ult) + '</td>'
        + '<td class="evm-num">' + delta(prev.CBS) + '</td><td class="evm-num">' + delta(prev.IBS) + '</td>'
        + '<td class="evm-num">' + delta(apl.CBS) + '</td><td class="evm-num">' + delta(apl.IBS) + '</td>'
        + '<td>' + chip(pior) + '</td></tr>';
    }).join('');
  }

  function render() {
    var v = document.getElementById('view-eventos');
    if (!v || !on()) return;
    if (!semear()) { v.innerHTML = '<div class="evm-vazio">Os documentos ainda estão carregando. Abra a tela de novo em instantes.</div>'; return; }
    var todas = linhas(), k = kpis(todas), L = filtrar(todas);
    var aba = function (id, rot) { return '<button class="atab' + (ST.aba === id ? ' active' : '') + '" onclick="shEvm.aba(\'' + id + '\')">' + rot + '</button>'; };
    var restam = ST.cota - ST.cotaUsada;
    var tabela;
    if (ST.aba === 'documento') {
      tabela = '<table><thead><tr><th>Documento</th><th class="r">Eventos</th><th>Último</th><th class="r">Previsto CBS</th><th class="r">Previsto IBS</th><th class="r">Aplicado CBS</th><th class="r">Aplicado IBS</th><th>Pior estado</th></tr></thead><tbody>'
        + (L.length ? porDocumento(L) : '<tr><td colspan="8" class="evm-vazio">Nenhum documento com eventos neste filtro.</td></tr>') + '</tbody></table>';
    } else {
      tabela = '<table><thead><tr><th>Evento</th><th>Tipo</th><th>Documento</th><th>Ação planejada</th><th class="r">Efeito</th><th>Trib.</th><th>Estado</th></tr></thead><tbody>'
        + (L.length ? L.map(linhaEv).join('') : '<tr><td colspan="7" class="evm-vazio">' + (ST.aba === 'ausencias' ? 'Nenhuma ausência: todo efeito visto nos órgãos tem o evento correspondente.' : 'Nenhum evento neste filtro.') + '</td></tr>') + '</tbody></table>';
    }
    var titulos = { esteira: 'Esteira', pendentes: 'Ações pendentes', documento: 'Por documento', ausencias: 'Ausências' };
    var subtab = { esteira: 'em ordem de recebimento', pendentes: 'planejadas e aguardando o órgão', documento: 'documentos com evento', ausencias: 'eventos que deveriam existir e não chegaram' };
    v.innerHTML =
      '<div class="analytics-tabs" role="tablist">' + aba('esteira', 'Esteira') + aba('pendentes', 'Ações pendentes') + aba('documento', 'Por documento') + aba('ausencias', 'Ausências') + '</div>'
      + '<div class="pg-hdr"><div class="evm-min0"><div class="pg-title">Eventos fiscais</div><div class="pg-sub">Eventos autorizados que o cliente envia pela API e por CSV, com a ação planejada de cada um e a confirmação de cada órgão</div></div>'
      + '<div class="evm-hdr-acoes">'
      + '<button class="evm-btn" onclick="shEvm.lerReceita()"' + (restam <= 0 ? ' disabled' : '') + ' title="' + (restam <= 0 ? 'Cota de leituras sob demanda esgotada hoje — a próxima leitura agendada é às 06:00' : 'Lê a apuração assistida da CBS fora do horário agendado · ' + restam + ' de ' + ST.cota + ' leituras sob demanda hoje') + '">↻ Ler a Receita Federal agora</button>'
      + '<button class="evm-btn" onclick="shEvm.arquivoComite()" title="Simulação: o Comitê Gestor envia o arquivo do IBS; não há leitura sob demanda">⇣ Simular arquivo do Comitê Gestor</button>'
      + '<button class="evm-btn" onclick="shEvm.exportar()">Exportar</button>'
      + '</div></div>'
      + '<div class="evm-fonte"><span>Recebidos: <b>' + k.api + '</b> pela API · <b>' + k.csv + '</b> por CSV</span>'
      + '<span>Receita Federal · CBS: lida <b>' + fDH(ST.leitura.CBS) + '</b> · próxima às 06:00</span>'
      + '<span>Comitê Gestor · IBS: último arquivo <b>' + fDH(ST.leitura.IBS) + '</b></span></div>'
      + '<div class="kgrid k5">'
      + kcard('capturados', 'Recebidos', k.capturados, k.capturadas ? k.capturadas + ' com o efeito em cálculo' : 'no período', '')
      + kcard('planejados', 'Planejados', k.planejados, 'aguardando o órgão', 'blue')
      + kcard('executados', 'Executados', k.executados, 'confirmados pelo órgão', 'green')
      + kcard('divergentes', 'Divergentes', k.divergentes, 'o órgão não confirmou o valor', 'red')
      + kcard('ausentes', 'Ausentes', k.ausentes, 'deveriam existir', 'amber')
      + '</div>'
      + filtrosHtml()
      + '<div class="tcrd"><div class="tcrd-hdr" style="display:flex;align-items:center;justify-content:space-between;gap:12px">'
      + '<div class="sechdr" style="margin-bottom:0"><h2>' + titulos[ST.aba] + '</h2><p>' + (ST.aba === 'documento' ? L.map(function (l) { return l.nf; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).length : L.length) + ' ' + subtab[ST.aba]
      + (ST.kpi ? ' · filtro do indicador ativo — <a href="#" onclick="shEvm.kpi(\'\');return false">limpar</a>' : '') + '</p></div></div>'
      + '<div class="twrap">' + tabela + '</div></div>';
    var cont = document.getElementById('evm-f-contagem'); if (cont) cont.textContent = L.length + ' de ' + todas.length + ' linhas';
  }

  /* ── T-02 · o detalhe do evento ───────────────────────────────────────── */
  function overlay(id, largura, miolo) {
    fechar(id);
    document.body.insertAdjacentHTML('beforeend',
      '<div id="' + id + '" class="moverlay evm-ov" onclick="if(event.target===this)this.remove()">'
      + '<div class="mbox evm-mbox" style="--evm-w:' + largura + 'px" role="dialog" aria-modal="true" aria-labelledby="' + id + '-t">' + miolo + '</div></div>');
    var b = document.querySelector('#' + id + ' .mbox-close'); if (b) b.focus();
  }
  function cab(id, titulo, chipHtml, sub) {
    return '<div class="mbox-hdr"><div style="display:flex;align-items:center;gap:12px" class="evm-min0"><div class="mbox-icon">🧾</div><div class="evm-min0">'
      + '<div class="mbox-title" id="' + id + '-t">' + titulo + ' ' + chipHtml + '</div><div class="evm-sub-hdr">' + sub + '</div></div></div>'
      + '<button class="mbox-close" aria-label="Fechar" onclick="document.getElementById(\'' + id + '\').remove()">✕</button></div>';
  }
  function proxima06() { var d = new Date(); d.setHours(6, 0, 0, 0); if (d.getTime() <= Date.now()) d = new Date(d.getTime() + DIA); return d; }

  function fases(ev) {
    var c = CAT[ev.cod], e = estadoEv(ev), ts = tribsDo(ev);
    var f1 = '<div class="evm-fase feita"><div class="evm-fase-n">1 · Capturado</div><div class="evm-fase-l"><b>' + fDH(ev.capt) + '</b><br>' + (ev.canal === 'CSV' ? 'pelo upload de CSV' : 'pela API') + '</div></div>';
    var f2 = ev.plan
      ? '<div class="evm-fase feita"><div class="evm-fase-n">2 · Planejado</div><div class="evm-fase-l"><b>' + fDH(ev.plan) + '</b><br>efeito calculado</div></div>'
      : '<div class="evm-fase atual"><div class="evm-fase-n">2 · Planejado</div><div class="evm-fase-l">—<br>calculando o efeito</div></div>';
    var f3, f4;
    if (e === 'cancelada') {
      f3 = '<div class="evm-fase"><div class="evm-fase-n">3 · Aguardando</div><div class="evm-fase-l">—<br>interrompido pelo cancelamento</div></div>';
      f4 = '<div class="evm-fase"><div class="evm-fase-n">4 · Executado</div><div class="evm-fase-l">—<br>nada foi aplicado</div></div>';
    } else if (c.efeito !== 'valor') {
      f3 = '<div class="evm-fase feita"><div class="evm-fase-n">3 · Aguardando</div><div class="evm-fase-l">não se aplica<br>' + (ev.cod === '110001' ? 'o cancelado não tinha efeito aplicado' : 'atributo vale na autorização') + '</div></div>';
      f4 = '<div class="evm-fase feita"><div class="evm-fase-n">4 · Executado</div><div class="evm-fase-l"><b>' + fDH(ev.aut) + '</b><br>na autorização</div></div>';
    } else {
      var l3 = ts.map(function (t) {
        var x = ev.trib[t], o = ORGAO[t];
        if (x.estado === 'capturada' || x.estado === 'planejada') return '<b>' + t + '</b> · ' + o.nome + ': ' + (t === 'CBS' ? 'leitura às ' + fDH(proxima06()) : 'arquivo do próximo envio');
        if (x.estado === 'aguardando') return '<b>' + t + '</b> · ' + o.nome + ': esperando ' + ha(ev.plan);
        if (x.estado === 'divergente') return '<b>' + t + '</b> · ' + o.nome + ': valor diferente';
        return '<b>' + t + '</b> · ' + o.nome + ': confirmou';
      }).join('<br>');
      var l4 = ts.map(function (t) { var x = ev.trib[t]; return '<b>' + t + '</b>: ' + (x.estado === 'executada' ? fDH(x.exec) : x.estado === 'divergente' ? 'não aplicado' : '—'); }).join('<br>');
      var todasExec = ts.every(function (t) { return ev.trib[t].estado === 'executada'; });
      var algumaDiv = ts.some(function (t) { return ev.trib[t].estado === 'divergente'; });
      f3 = '<div class="evm-fase ' + (algumaDiv ? 'erro' : todasExec ? 'feita' : ev.plan ? 'atual' : '') + '"><div class="evm-fase-n">3 · Aguardando o órgão</div><div class="evm-fase-l">' + l3 + '</div></div>';
      f4 = '<div class="evm-fase ' + (todasExec ? 'feita' : '') + '"><div class="evm-fase-n">4 · Executado</div><div class="evm-fase-l">' + l4 + '</div></div>';
    }
    return '<div class="evm-fases">' + f1 + f2 + f3 + f4 + '</div>';
  }

  function faixa(ev) {
    var c = CAT[ev.cod], e = estadoEv(ev);
    if (e === 'cancelada') return '<div class="evm-faixa neutra">Cancelado pelo <b>' + esc(ev.canceladoPor) + '</b> em ' + fDH(ev.canceladoEm) + '. Nada foi aplicado: o evento ainda esperava o órgão.</div>';
    var div = tribsDo(ev).filter(function (t) { return ev.trib[t].estado === 'divergente'; });
    if (div.length) {
      return '<div class="evm-faixa red">' + div.map(function (t) {
        var x = ev.trib[t];
        return '<b>Divergência na ' + t + '.</b> ' + ORGAO[t].o.toUpperCase() + ' ' + ORGAO[t].nome + ' mostra ' + money(x.observado) + '; o esperado era ' + money(x.antes + x.delta) + '.';
      }).join(' ') + ' Nada foi aplicado — divergência nunca aplica valor sozinha. Ela vai para Inconsistências, família I · Eventos fiscais, com uma ocorrência por tributo.'
        + ' <a href="#/inconsistencias/listagem" onclick="document.getElementById(\'evm-det\').remove()">Abrir Inconsistências</a></div>';
    }
    if (ev.cod === '110001') return '<div class="evm-faixa neutra">Cancela o <b>' + esc(ev.cancela) + '</b>. Como o cancelado ainda esperava o órgão, não há efeito a desfazer.</div>';
    if (c.efeito === 'atributo') return '<div class="evm-faixa blue">Evento de atributo: vale na autorização e não espera o órgão. Nenhum valor muda.</div>';
    if (e !== 'executada') return '<div class="evm-faixa blue">O previsto <b>não</b> soma ao vigente: o valor só muda quando o órgão de cada tributo confirmar.</div>';
    return '';
  }

  function tabelaAcao(ev) {
    var c = CAT[ev.cod], ts = tribsDo(ev), lado = ev.lado === 'entrada' ? 'Crédito' : 'Débito';
    var linhas_ = ts.map(function (t) {
      var x = ev.trib[t], exec = x.estado === 'executada' && c.efeito === 'valor' && !ev.canceladoPor;
      var vig = exec ? x.antes + x.delta : x.antes;
      return '<tr><td><b>' + t + '</b><div class="evm-small">' + ORGAO[t].nome + '</div></td>'
        + '<td><a href="#" class="evm-mono" onclick="shEvm.verRf(\'' + esc(x.rf) + '\');return false">' + esc(x.rf) + '</a></td>'
        + '<td class="evm-num">' + money(x.antes) + '</td>'
        + '<td class="evm-num">' + (c.efeito === 'valor' && !ev.canceladoPor ? money(x.antes + x.delta) : '<span class="evm-muted">—</span>') + '</td>'
        + '<td class="evm-num">' + (ev.canceladoPor ? delta(0) : delta(x.delta)) + '</td>'
        + '<td class="evm-num"><b>' + money(vig) + '</b></td>'
        + '<td>' + chip(ev.canceladoPor ? 'cancelada' : x.estado) + '</td></tr>';
    }).join('');
    var algumExec = ts.some(function (t) { return ev.trib[t].estado === 'executada'; }) && c.efeito === 'valor';
    if (!ev.plan) return '<div><div class="evm-rot">Ação planejada</div><div class="evm-small">O evento acabou de chegar e o efeito ainda está sendo calculado. Os valores aparecem aqui quando o cálculo terminar.</div></div>';
    return '<div><div class="evm-rot">Ação planejada · ' + esc(acaoEv(ev)) + '</div>'
      + '<div class="twrap" style="--twrap-h:none"><table><thead><tr><th>Tributo</th><th>Registro</th><th class="r">' + lado + ' antes</th><th class="r">' + (algumExec ? 'Previsto / aplicado' : 'Previsto') + '</th><th class="r">Delta</th><th class="r">' + lado + ' vigente</th><th>Situação</th></tr></thead><tbody>' + linhas_ + '</tbody></table></div>'
      + '<div class="evm-small" style="margin-top:6px">A primeira versão não segmenta por item: o efeito é a soma dos itens do evento e cai no registro do tributo, no documento.</div></div>';
  }

  function tabelaConfirmacao(ev) {
    var c = CAT[ev.cod];
    if (!ev.plan) return '';
    if (c.efeito !== 'valor') {
      return '<div><div class="evm-rot">O que cada órgão precisa confirmar</div><div class="evm-small">Nada: ' + (ev.cod === '110001' ? 'o cancelamento não desfaz valor algum.' : 'o evento muda um atributo, que vale na autorização.') + '</div></div>';
    }
    var linhas_ = tribsDo(ev).map(function (t) {
      var x = ev.trib[t], o = ORGAO[t], esperado = x.antes + x.delta;
      var obs = x.lido == null ? '<span class="evm-muted">—</span>' : money(x.observado);
      var sit = ev.canceladoPor ? chip('cancelada') : chip(x.estado);
      return '<tr><td><b>' + o.nome + '</b><div class="evm-small">' + t + '</div></td>'
        + '<td class="evm-mono">' + o.campo[ev.lado] + '</td>'
        + '<td class="evm-num">' + money(esperado) + '</td>'
        + '<td class="evm-num">' + obs + '</td>'
        + '<td class="evm-small">' + (x.lido == null ? (t === 'CBS' ? 'próxima leitura ' + fDH(proxima06()) : 'próximo arquivo') : fDH(x.lido)) + '</td>'
        + '<td>' + sit + '</td></tr>';
    }).join('');
    return '<div><div class="evm-rot">O que cada órgão precisa confirmar</div>'
      + '<div class="twrap" style="--twrap-h:none"><table><thead><tr><th>Órgão</th><th>Campo na API</th><th class="r">Esperado</th><th class="r">Última leitura</th><th>Lido em</th><th>Situação</th></tr></thead><tbody>' + linhas_ + '</tbody></table></div></div>';
  }

  function trilha(ev) {
    var c = CAT[ev.cod], it = [];
    it.push([ev.aut, 'Autorizado pela SEFAZ · protocolo ' + ev.protocolo]);
    it.push([ev.capt, 'Recebido ' + (ev.canal === 'CSV' ? 'pelo upload de CSV' : 'pela API')]);
    if (ev.plan) it.push([ev.plan, 'Efeito calculado: ' + acaoEv(ev)]);
    if (c.efeito === 'valor' && !ev.canceladoPor) {
      tribsDo(ev).forEach(function (t) {
        var x = ev.trib[t];
        if (x.estado === 'executada') it.push([x.exec, t + ' confirmada ' + ORGAO[t].pelo + ' ' + ORGAO[t].nome + ' — valor aplicado']);
        else if (x.estado === 'divergente') it.push([x.lido, t + ': ' + ORGAO[t].o + ' ' + ORGAO[t].nome + ' mostra ' + money(x.observado) + ', diferente do esperado — nada aplicado']);
        else if (x.estado === 'aguardando') it.push([x.lido, t + ': ' + (t === 'CBS' ? 'leitura da Receita Federal' : 'arquivo do Comitê Gestor') + ' ainda sem o efeito']);
      });
    }
    if (ev.canceladoPor) it.push([ev.canceladoEm, 'Cancelado pelo ' + ev.canceladoPor]);
    (ev.marcas || []).forEach(function (m) { it.push([m.em, m.txt]); });
    it.sort(function (a, b) { return a[0] - b[0]; });
    return '<div><div class="evm-rot">Trilha</div><div class="twrap" style="--twrap-h:none"><table><tbody>'
      + it.map(function (i) { return '<tr><td class="evm-small" style="white-space:nowrap">' + fDH(i[0]) + '</td><td>' + esc(i[1]) + '</td></tr>'; }).join('')
      + '</tbody></table></div></div>';
  }

  function detalhe(id) {
    var ev = ST.eventos.filter(function (x) { return x.id === id; })[0];
    if (!ev) { toast('Evento ' + id + ' não encontrado nesta base.'); return; }
    var c = CAT[ev.cod];
    var sub = '<span class="evm-mono">' + ev.cod + '</span><span>autorizado ' + fDH(ev.aut) + '</span><span>protocolo <span class="evm-mono">' + ev.protocolo + '</span></span>'
      + '<span>autor: ' + esc(AUTOR[c.autor]) + '</span><span>sequência ' + ev.seq + '</span>'
      + '<span>NF-e <span class="evm-mono">' + esc(ev.nf) + '</span> · ' + (ev.lado === 'entrada' ? 'entrada' : 'saída') + ' · competência ' + ev.competenciaDoc + '</span>';
    overlay('evm-det', 920,
      cab('evm-det', esc(ev.id) + ' · ' + esc(c.nome), chip(estadoEv(ev)), sub)
      + '<div class="evm-corpo">' + faixa(ev) + fases(ev) + tabelaAcao(ev) + tabelaConfirmacao(ev) + trilha(ev) + '</div>'
      + '<div class="evm-pe">'
      + '<button class="evm-btn" onclick="shEvm.verDocumento(\'' + esc(ev.nf) + '\')">Ver documento</button>'
      + '<button class="evm-btn" onclick="shEvm.payload(\'' + ev.id + '\')">Ver payload original</button>'
      + '<button class="evm-btn pri" onclick="shEvm.revisao(\'' + ev.id + '\')">' + (ev.revisao ? 'Tirar a marca de revisão' : 'Marcar para revisão') + '</button>'
      + '</div>');
    try { history.replaceState(null, '', '#/eventos/' + ev.id); } catch (e) {}
  }

  function payload(id) {
    var ev = ST.eventos.filter(function (x) { return x.id === id; })[0]; if (!ev) return;
    var c = CAT[ev.cod], det = {};
    if (ev.cod === '110001') det = { cancelled_event_protocol: (ST.eventos.filter(function (x) { return x.id === ev.cancela; })[0] || {}).protocolo, reason: 'Evento emitido em duplicidade' };
    else if (c.efeito === 'valor') det = { cbs_amount: Math.abs(ev.trib.CBS.delta), ibs_amount: Math.abs(ev.trib.IBS.delta) };
    else if (ev.cod === '112150') det = { expected_delivery_date: iso(ev.aut + 20 * DIA) };
    else if (ev.cod === '112110') det = { full_payment: true };
    else if (ev.cod === '211130') det = { fixed_asset: true };
    var p = {
      type: c.tipo, event_code: ev.cod, access_key: ev.chave, protocol: ev.protocolo,
      event_datetime: new Date(ev.aut).toISOString().slice(0, 19) + '-03:00', sequence: ev.seq,
      author: { tax_id: String((c.autor === 'emitente') === (ev.lado === 'saida') ? ev.cnpjEmpresa || '' : ev.cnpj || '').replace(/\D/g, ''), role: ROLE[c.autor] },
      authorizer_state: ev.lado === 'entrada' ? '41' : '35', environment: 'production', detail: det
    };
    overlay('evm-pl', 720, cab('evm-pl', 'Payload original · ' + esc(ev.id), '', '<span>recebido ' + (ev.canal === 'CSV' ? 'por CSV e convertido no formato da API' : 'pela API') + ' em ' + fDH(ev.capt) + '</span><span>guardado para reprocessar e auditar</span>')
      + '<div class="evm-corpo"><pre class="evm-json">' + esc(JSON.stringify(p, null, 2)) + '</pre></div>');
  }

  function revisao(id) {
    var ev = ST.eventos.filter(function (x) { return x.id === id; })[0]; if (!ev) return;
    ev.revisao = !ev.revisao;
    (ev.marcas = ev.marcas || []).push({ em: Date.now(), txt: ev.revisao ? 'Marcado para revisão' : 'Marca de revisão retirada' });
    toast(ev.revisao ? ev.id + ' marcado para revisão.' : 'Marca de revisão retirada do ' + ev.id + '.');
    detalhe(id); render();
  }

  function ausencia(id) {
    var a = ST.ausentes.filter(function (x) { return x.id === id; })[0]; if (!a) return;
    var dias = Math.floor((Date.now() - a.desde) / DIA), c = CAT[a.cod];
    var sub = '<span>NF-e <span class="evm-mono">' + esc(a.nf) + '</span> · ' + (a.lado === 'entrada' ? 'entrada' : 'saída') + ' · ' + esc(a.entidade) + '</span><span>' + a.tribs.join(' · ') + '</span><span>visto desde ' + fD(a.desde) + '</span>';
    overlay('evm-aus', 720,
      cab('evm-aus', 'Evento esperado · <span class="evm-mono">' + a.cod + '</span> ' + esc(c.nome), chip('ausente'), sub)
      + '<div class="evm-corpo">'
      + '<div class="evm-faixa amber"><b>O que indica a ausência.</b> ' + esc(a.indicio) + '</div>'
      + '<div class="evm-fases">'
      + '<div class="evm-fase"><div class="evm-fase-n">Quem emite</div><div class="evm-fase-l">' + esc(AUTOR[c.autor]) + (c.autor === 'destinatario' && a.lado === 'entrada' || c.autor === 'emitente' && a.lado === 'saida' ? ' — a própria empresa' : ' — a outra parte') + '</div></div>'
      + '<div class="evm-fase"><div class="evm-fase-n">Visto pelo órgão</div><div class="evm-fase-l">' + a.tribs.map(function (t) { return '<b>' + t + '</b> · ' + ORGAO[t].nome + (a.valores[t] ? ': ' + money(a.valores[t]) : ''); }).join('<br>') + '</div></div>'
      + '<div class="evm-fase ' + (dias >= ESPERA_AUSENCIA ? 'erro' : 'atual') + '"><div class="evm-fase-n">Espera</div><div class="evm-fase-l"><b>' + dias + ' de ' + ESPERA_AUSENCIA + ' dias</b><br>passado o prazo, vira ocorrência em Inconsistências, família I</div></div>'
      + '<div class="evm-fase"><div class="evm-fase-n">Pedido</div><div class="evm-fase-l">' + (a.pedido ? 'reenvio pedido ao ERP em <b>' + fDH(a.pedido) + '</b>' : 'nenhum ainda') + '</div></div>'
      + '</div>'
      + '<div class="evm-small">Pode ser um evento que o ERP não enviou, um que o órgão processou sem o SplitHub saber, ou um fato que nenhum dos dois viu. O efeito não é aplicado enquanto o evento não chega.</div>'
      + '</div>'
      + '<div class="evm-pe">'
      + '<button class="evm-btn" onclick="shEvm.verDocumento(\'' + esc(a.nf) + '\')">Ver documento</button>'
      + '<button class="evm-btn" onclick="shEvm.revisaoAus(\'' + a.id + '\')">' + (a.revisao ? 'Tirar a marca de revisão' : 'Marcar para revisão') + '</button>'
      + '<button class="evm-btn pri" onclick="shEvm.pedirReenvio(\'' + a.id + '\')"' + (a.pedido ? ' disabled' : '') + '>Pedir o reenvio ao ERP</button>'
      + '</div>');
  }

  /* ── Leitura dos órgãos (simulada) ────────────────────────────────────── */
  function confirmar(t) {
    var r = { ok: 0, div: 0, seg: 0 }, agora = Date.now();
    ST.eventos.forEach(function (ev) {
      var x = ev.trib[t];
      if (!x || ev.canceladoPor || CAT[ev.cod].efeito !== 'valor') return;
      if (x.estado === 'planejada' || x.estado === 'aguardando') {
        var h = hash(ev.id + t + ST.cotaUsada) % 10;
        if (h < 7) { x.estado = 'executada'; x.exec = agora; x.lido = agora; x.observado = x.antes + x.delta; r.ok++; }
        else if (h < 8) { x.estado = 'divergente'; x.lido = agora; x.observado = x.antes + (x.delta > 0 ? 1 : -1) * redondo(Math.abs(x.delta) / 2); r.div++; }
        else { x.estado = 'aguardando'; x.lido = agora; x.observado = x.antes; r.seg++; }
      }
    });
    ST.leitura[t] = agora;
    return r;
  }
  function lerReceita() {
    if (ST.cotaUsada >= ST.cota) return;
    ST.cotaUsada++;
    var r = confirmar('CBS');
    toast('Receita Federal lida: ' + pl(r.ok, 'confirmado', 'confirmados') + ', ' + pl(r.div, 'divergente', 'divergentes') + ' e ' + pl(r.seg, 'segue', 'seguem') + ' aguardando na CBS.');
    render();
  }
  function arquivoComite() {
    var r = confirmar('IBS');
    toast('Arquivo do Comitê Gestor processado: ' + pl(r.ok, 'confirmado', 'confirmados') + ', ' + pl(r.div, 'divergente', 'divergentes') + ' e ' + pl(r.seg, 'segue', 'seguem') + ' aguardando no IBS.');
    render();
  }

  function exportar() {
    var L = filtrar(linhas()), sep = ';';
    var cab_ = ['evento', 'codigo', 'tipo', 'documento', 'lado', 'entidade', 'acao_planejada', 'efeito', 'tributos', 'estado', 'estado_cbs', 'estado_ibs', 'recebido_em', 'canal'];
    var q = function (s) { s = String(s == null ? '' : s); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    var rows = L.map(function (l) {
      if (l.tipo === 'aus') return [l.id, l.cod, 'esperado · ' + CAT[l.cod].nome, l.nf, l.lado, l.entidade, 'nenhuma — o evento não chegou', '', l.tribs.join('+'), 'ausente', '', '', iso(l.data), ''];
      var ev = l.ev;
      return [ev.id, ev.cod, CAT[ev.cod].nome, ev.nf, ev.lado, ev.entidade, acaoEv(ev), String(efeitoEv(ev)).replace('.', ','), tribRot(ev).replace(/ · /g, '+'), l.estado,
        ev.trib.CBS ? ev.trib.CBS.estado : '', ev.trib.IBS ? ev.trib.IBS.estado : '', fDH(ev.capt), ev.canal];
    });
    var csv = '﻿' + [cab_].concat(rows).map(function (r) { return r.map(q).join(sep); }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'eventos-fiscais-' + iso(Date.now()) + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast(pl(L.length, 'linha exportada', 'linhas exportadas') + '.');
  }

  /* ── Rota: #/eventos, #/eventos/EV-000401, #/eventos/ausencias ────────── */
  function rota() {
    var h = location.hash || '';
    if (h.indexOf('#/eventos') !== 0 || h.indexOf('#/eventos-fiscais') === 0) return;
    var lp = document.getElementById('lp-screen');
    if (lp && lp.style.display !== 'none') return;
    var resto = h.slice('#/eventos'.length).replace(/^\//, '').split('?')[0];
    if (['esteira', 'pendentes', 'documento', 'ausencias'].indexOf(resto) >= 0) ST.aba = resto;
    abrirView();
    if (/^EV-\d+$/.test(resto)) setTimeout(function () { detalhe(resto); }, 50);
  }

  window.shEvm = {
    render: render, abrirView: abrirView, detalhe: detalhe, ausencia: ausencia, payload: payload, revisao: revisao,
    aba: function (a) { ST.aba = a; ST.kpi = null; render(); },
    kpi: function (k) { ST.kpi = ST.kpi === k || !k ? null : k; if (ST.kpi) ST.aba = 'esteira'; render(); },
    filtro: function (k, v) {
      ST.f[k] = v;
      var foco = document.activeElement && document.activeElement.id, pos = foco === 'evm-busca' ? document.activeElement.selectionStart : null;
      render();
      if (foco) { var el = document.getElementById(foco); if (el) { el.focus(); if (pos != null && el.setSelectionRange) el.setSelectionRange(pos, pos); } }
    },
    limpar: function () { ST.f = {}; ST.kpi = null; render(); },
    alternarFiltros: function () { ST.fAberto = !ST.fAberto; render(); },
    doDocumento: function (nf) { ST.f = { q: nf }; ST.aba = 'esteira'; ST.kpi = null; render(); },
    verDocumento: function (nf) {
      ['evm-det', 'evm-aus', 'evm-pl'].forEach(fechar);
      if (typeof window.abrirDetalhesNFporNumero === 'function') window.abrirDetalhesNFporNumero(nf);
    },
    verRf: function (rfId) {
      ['evm-det', 'evm-pl'].forEach(fechar);
      if (typeof window.abrirDetalheRF === 'function') window.abrirDetalheRF(rfId);
    },
    revisaoAus: function (id) {
      var a = ST.ausentes.filter(function (x) { return x.id === id; })[0]; if (!a) return;
      a.revisao = !a.revisao; toast(a.revisao ? 'Ausência marcada para revisão.' : 'Marca de revisão retirada.'); ausencia(id);
    },
    pedirReenvio: function (id) {
      var a = ST.ausentes.filter(function (x) { return x.id === id; })[0]; if (!a || a.pedido) return;
      a.pedido = Date.now();
      toast('Reenvio pedido ao ERP para a NF-e ' + a.nf + '. Quando o evento chegar, ele entra na esteira e a ausência se fecha.');
      ausencia(id);
    },
    lerReceita: lerReceita, arquivoComite: arquivoComite, exportar: exportar,
    estado: function () { return ST; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
  window.addEventListener('hashchange', rota);
  window.addEventListener('load', function () { setTimeout(function () { montar(); rota(); }, 450); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    ['evm-pl', 'evm-det', 'evm-aus'].some(function (id) { var el = document.getElementById(id); if (el) { el.remove(); return true; } return false; });
  });
})();

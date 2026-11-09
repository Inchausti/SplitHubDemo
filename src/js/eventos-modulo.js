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
   Correções de 09/11/2026, pelas divergências do PRD de Eventos fiscais:
     · DV-11 importação por CSV (proposta AE-04): oito modelos, cabeçalho por
       nome, agrupamento pela chave natural, pré-visualização por evento e
       arquivo das linhas recusadas; os itens somam por tributo (sem item na v1)
     · DV-12 gerenciador de colunas do produto (ShColMgr), com a exportação
     · DV-20 o payload original só aparece para o perfil técnico (V-05), que
       na v1 é o Administrador
     · DV-22 a divergência não promete ocorrência da família I, que ainda não
       existe no catálogo de Inconsistências
   Pacote AV-EF, atrás da flag eventos_modulo (features.js, pacote AV-00).
   A rota é #/eventos — #/eventos-fiscais já é a configuração do AV-EV.
   ═══════════════════════════════════════════════════════════════════════════ */
/* @pacote — o estado das flags é reescrito por tools/avaliacao.py promover */
window.shFeature && shFeature.registrar({"id": "AV-EF", "nome": "Eventos fiscais — esteira e detalhe", "branch": "feat/modulo-eventos", "entrada": "#/eventos", "flags": {"eventos_modulo": "aprovada"}, "rotulos": {"eventos_modulo": "A esteira de eventos recebidos e o detalhe com a confirmação por órgão"}, "alvos": {"eventos_modulo": ["#nav-eventos-btn", "#view-eventos"]}});
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
  function fDHA(d) { d = new Date(d); return fD(d) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); }
  function isoDH(d) { d = new Date(d); return iso(d) + 'T' + p2(d.getHours()) + ':' + p2(d.getMinutes()); }
  function csvCampo(s) { s = String(s == null ? '' : s); return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function baixar(nome, linhas) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + linhas.map(function (r) { return r.map(csvCampo).join(';'); }).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = nome;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ── Quem está usando (gestão de usuários, D-USR-02) ──────────────────── */
  function usuario() { var s = window._usuState; return (s && s.usuarios && s.usuarios[0]) || null; }
  function perfil() { var u = usuario(); return u ? u.perfil : 'administrador'; }
  // V-05: o payload cru é do perfil técnico. Na v1, o técnico é o Administrador,
  // o único perfil que mexe em integrações; Fiscal, Tesouraria e Leitura não o veem
  function vePayload() { return perfil() === 'administrador'; }
  // CSV-R01: importar eventos é ação com efeito — Administrador e Fiscal
  function podeImportar() { var p = perfil(); return p === 'administrador' || p === 'fiscal'; }
  function nomeUsuario() {
    var u = usuario(); if (u) return u.nome;
    var n = document.querySelector('.ah-uname'); return (n && n.textContent.trim()) || 'Usuário';
  }

  // o CSS vem pelo próprio módulo, para o pacote não disputar linhas do index.html
  (function () {
    if (document.getElementById('evm-css')) return;
    var l = document.createElement('link');
    l.id = 'evm-css'; l.rel = 'stylesheet'; l.href = 'css/eventos-modulo.css?v=4';
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
        competenciaDoc: comp(nf.data + 'T12:00:00'), compIso: String(nf.data).slice(0, 7), aut: dt.aut, capt: dt.capt, plan: r[2] === 'capturada' ? null : dt.plan,
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
        chave: alvo.chave, competenciaDoc: alvo.competenciaDoc, compIso: alvo.compIso, aut: cc - 6 * MIN, capt: Math.min(cc, Date.now() - 2 * MIN), plan: Math.min(cc, Date.now() - 2 * MIN) + MIN,
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

  /* ── Colunas da esteira: o gerenciador de colunas do produto (DV-12) ─── */
  // As sete primeiras são as da proposta de telas, sem a de item (D-02); as
  // demais começam ocultas e entram pelo botão Colunas, que também exporta
  var CM = 'evm-esteira', cmReg = false, cmNo = null, subId = true;
  var COLS = [
    { key: 'id', label: 'Evento', fixed: true, type: 'str' },
    { key: 'tipo', label: 'Tipo', type: 'str' },
    { key: 'doc', label: 'Documento', type: 'str' },
    { key: 'acao', label: 'Ação planejada', type: 'str' },
    { key: 'efeito', label: 'Efeito', type: 'num' },
    { key: 'tribs', label: 'Trib.', type: 'str' },
    { key: 'estado', label: 'Estado', type: 'str' },
    { key: 'recebido', label: 'Recebido em', visible: false, type: 'date' },
    { key: 'canal', label: 'Canal', visible: false, type: 'str' },
    { key: 'autorizado', label: 'Autorizado em', visible: false, type: 'date' },
    { key: 'autor', label: 'Autor', visible: false, type: 'str' },
    { key: 'cbs', label: 'CBS · Receita Federal', visible: false, type: 'str' },
    { key: 'ibs', label: 'IBS · Comitê Gestor', visible: false, type: 'str' },
    { key: 'competencia', label: 'Competência', visible: false, type: 'date' },
    { key: 'protocolo', label: 'Protocolo', visible: false, type: 'str' }
  ];
  function registrarColunas() {
    if (cmReg || !window.ShColMgr) return;
    ShColMgr.register(CM, {
      tbodyId: 'evm-tbody', theadId: 'thead-evm-esteira', toolbarSel: '#evm-col-toolbar',
      allRowsFn: function () { return ST.objs || []; },
      pageRowsFn: function () { return ST.objs || []; },
      reRenderFn: function () { render(); },
      csvCellFn: csvCelula,
      cols: COLS
    });
    cmReg = true;
  }
  function colunas() {
    return cmReg ? ShColMgr.visCols(CM) : COLS.filter(function (c) { return c.visible !== false; });
  }
  // a linha como objeto plano: é o que o gerenciador ordena e exporta
  function objeto(l) {
    var c = CAT[l.cod], o = { _l: l, tipo: l.cod + ' · ' + c.nome, doc: l.nf, tribs: l.tribs.join(' · '), estado: l.estado, autor: AUTOR[c.autor] };
    if (l.tipo === 'aus') {
      o.id = l.aus.id; o.acao = 'Nenhuma — o evento não chegou'; o.efeito = null;
      o.recebido = o.canal = o.autorizado = o.protocolo = o.competencia = '';
      o.cbs = l.tribs.indexOf('CBS') >= 0 ? 'ausente' : '';
      o.ibs = l.tribs.indexOf('IBS') >= 0 ? 'ausente' : '';
      return o;
    }
    var ev = l.ev;
    o.id = ev.id;
    o.acao = l.estado === 'capturada' ? 'Calculando o efeito' : acaoEv(ev);
    o.efeito = l.estado === 'capturada' || ev.canceladoPor ? 0 : efeitoEv(ev);
    o.recebido = isoDH(ev.capt); o.canal = ev.canal; o.autorizado = isoDH(ev.aut);
    o.protocolo = ev.protocolo; o.competencia = ev.compIso || '';
    o.cbs = ev.trib.CBS ? (ev.canceladoPor ? 'cancelada' : ev.trib.CBS.estado) : '';
    o.ibs = ev.trib.IBS ? (ev.canceladoPor ? 'cancelada' : ev.trib.IBS.estado) : '';
    return o;
  }
  function csvCelula(o, c) {
    if (c.key === 'recebido' || c.key === 'autorizado') return o[c.key] ? fDHA(o[c.key]) : '';
    if (c.key === 'efeito') return o.efeito == null ? '' : String(o.efeito).replace('.', ',');
    if (c.key === 'competencia') return o._l.ev ? o._l.ev.competenciaDoc : '';
    return null;
  }
  function celula(k, l, o) {
    var a = l.aus, ev = l.ev, nada = '<span class="evm-muted">—</span>';
    switch (k) {
      case 'id':
        if (a) return '<td class="evm-mono evm-muted">—</td>';
        return '<td class="evm-mono">' + ev.id + (ev.revisao ? ' <span title="Marcado para revisão" aria-label="Marcado para revisão">⚑</span>' : '')
          + (subId ? '<div class="evm-small">' + fDH(ev.capt) + ' · ' + ev.canal + '</div>' : '') + '</td>';
      case 'tipo':
        return '<td><span class="evm-mono">' + l.cod + '</span> <span class="evm-small">' + (a ? 'esperado · ' : '') + esc(CAT[l.cod].nome) + '</span></td>';
      case 'doc':
        return '<td><span class="evm-mono">' + esc(l.nf) + '</span>' + (a ? '' : ' <span class="evm-small">' + (l.lado === 'entrada' ? 'entrada' : 'saída') + '</span>')
          + '<div class="evm-small">' + esc(l.entidade) + '</div></td>';
      case 'acao':
        if (a) return '<td class="evm-acao evm-muted">Nenhuma — o evento não chegou</td>';
        return '<td class="evm-acao' + (l.estado === 'capturada' ? ' evm-muted' : '') + '">' + esc(o.acao) + '</td>';
      case 'efeito':
        if (a) return '<td class="evm-num">' + delta(null) + '</td>';
        return '<td class="evm-num">' + (l.estado === 'capturada' ? '<span class="evm-muted">em cálculo</span>'
          : ev.canceladoPor ? '<s class="evm-muted" title="Cancelado — nada aplicado">' + delta(efeitoEv(ev)).replace(/<[^>]+>/g, '') + '</s>' : delta(efeitoEv(ev))) + '</td>';
      case 'tribs': return '<td class="evm-mono">' + esc(o.tribs) + '</td>';
      case 'estado': return '<td>' + (a ? chip('ausente') : chipsEv(ev)) + '</td>';
      case 'recebido': return '<td class="evm-small evm-nw">' + (a ? nada : fDH(ev.capt)) + '</td>';
      case 'canal': return '<td class="evm-small">' + (a ? nada : ev.canal) + '</td>';
      case 'autorizado': return '<td class="evm-small evm-nw">' + (a ? nada : fDH(ev.aut)) + '</td>';
      case 'autor': return '<td class="evm-small">' + esc(o.autor) + '</td>';
      case 'cbs': case 'ibs': return '<td>' + (o[k] ? chip(o[k]) : nada) + '</td>';
      case 'competencia': return '<td class="evm-small">' + (a ? nada : ev.competenciaDoc) + '</td>';
      case 'protocolo': return '<td class="evm-mono">' + (a ? nada : ev.protocolo) + '</td>';
    }
    return '<td></td>';
  }
  function linhaEv(o, cols) {
    var l = o._l, abre = l.tipo === 'aus' ? 'shEvm.ausencia(\'' + l.aus.id + '\')' : 'shEvm.detalhe(\'' + l.ev.id + '\')';
    return '<tr class="evm-linha ' + l.estado + '" tabindex="0" onclick="' + abre + '" onkeydown="if(event.key===\'Enter\')' + abre + '">'
      + cols.map(function (c) { return celula(c.key, l, o); }).join('') + '</tr>';
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
      registrarColunas();
      var cols = colunas(), vis = cols.map(function (c) { return c.key; });
      var objs = L.map(objeto);
      if (cmReg) objs = ShColMgr.sortRows(CM, objs);
      ST.objs = objs;
      // com Recebido em ou Canal à vista, a linha de baixo do Evento repetiria o dado
      subId = vis.indexOf('recebido') < 0 && vis.indexOf('canal') < 0;
      tabela = '<table><thead id="thead-evm-esteira"><tr>'
        + cols.map(function (c) { return '<th data-col-key="' + c.key + '"' + (c.type === 'num' ? ' class="r"' : '') + '>' + esc(c.label) + '</th>'; }).join('')
        + '</tr></thead><tbody id="evm-tbody">'
        + (objs.length ? objs.map(function (o) { return linhaEv(o, cols); }).join('')
          : '<tr><td colspan="' + cols.length + '" class="evm-vazio">' + (ST.aba === 'ausencias' ? 'Nenhuma ausência: todo efeito visto nos órgãos tem o evento correspondente.' : 'Nenhum evento neste filtro.') + '</td></tr>')
        + '</tbody></table>';
    }
    var titulos = { esteira: 'Esteira', pendentes: 'Ações pendentes', documento: 'Por documento', ausencias: 'Ausências' };
    var subtab = { esteira: 'em ordem de recebimento', pendentes: 'planejadas e aguardando o órgão', documento: 'documentos com evento', ausencias: 'eventos que deveriam existir e não chegaram' };
    // o grupo de botões do gerenciador sobrevive à troca do HTML: sai antes e volta depois,
    // para o painel de colunas não fechar a cada clique
    var cmVivo = document.querySelector('#evm-col-toolbar > .sh-cm-controls');
    if (cmVivo) { cmNo = cmVivo; cmVivo.parentNode.removeChild(cmVivo); }
    v.innerHTML =
      '<div class="analytics-tabs" role="tablist">' + aba('esteira', 'Esteira') + aba('pendentes', 'Ações pendentes') + aba('documento', 'Por documento') + aba('ausencias', 'Ausências') + '</div>'
      + '<div class="pg-hdr"><div class="evm-min0"><div class="pg-title">Eventos fiscais</div><div class="pg-sub">Eventos autorizados que o cliente envia pela API e por CSV, com a ação planejada de cada um e a confirmação de cada órgão</div></div>'
      + '<div class="evm-hdr-acoes">'
      + '<button class="evm-btn" onclick="shEvm.lerReceita()"' + (restam <= 0 ? ' disabled' : '') + ' title="' + (restam <= 0 ? 'Cota de leituras sob demanda esgotada hoje — a próxima leitura agendada é às 06:00' : 'Lê a apuração assistida da CBS fora do horário agendado · ' + restam + ' de ' + ST.cota + ' leituras sob demanda hoje') + '">↻ Ler a Receita Federal agora</button>'
      + '<button class="evm-btn" onclick="shEvm.arquivoComite()" title="Simulação: o Comitê Gestor envia o arquivo do IBS; não há leitura sob demanda">⇣ Simular arquivo do Comitê Gestor</button>'
      + (podeImportar() ? '<button class="evm-btn" onclick="shEvm.importar()" title="Eventos já autorizados, em arquivo: para quem ainda não integrou, para carga retroativa e para registro pontual">⇡ Importar CSV</button>' : '')
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
      + '<div class="tcrd"><div class="tcrd-hdr evm-tcrd-hdr">'
      + '<div class="sechdr evm-min0" style="margin-bottom:0"><h2>' + titulos[ST.aba] + '</h2><p>' + (ST.aba === 'documento' ? L.map(function (l) { return l.nf; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).length : L.length) + ' ' + subtab[ST.aba]
      + (ST.kpi ? ' · filtro do indicador ativo — <a href="#" onclick="shEvm.kpi(\'\');return false">limpar</a>' : '') + '</p></div>'
      + (ST.aba === 'documento' ? '' : '<div id="evm-col-toolbar" class="evm-col-toolbar"></div>') + '</div>'
      + '<div class="twrap">' + tabela + '</div></div>';
    var slot = document.getElementById('evm-col-toolbar');
    if (slot && cmNo) slot.appendChild(cmNo);
    if (slot && cmReg) { try { ShColMgr.afterRender(CM); } catch (e) {} }
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
        return '<b>Divergência ' + (t === 'CBS' ? 'na' : 'no') + ' ' + t + '.</b> ' + ORGAO[t].o.toUpperCase() + ' ' + ORGAO[t].nome + ' mostra ' + money(x.observado) + '; o esperado era ' + money(x.antes + x.delta) + '.';
      }).join(' ') + ' Nada foi aplicado — divergência nunca aplica valor sozinha.'
        + ' O evento fica no indicador Divergentes desta esteira; marque-o para revisão para acompanhar o tratamento.</div>';
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
    var arq = ev.arquivo;
    it.push([ev.capt, 'Recebido ' + (ev.canal === 'CSV' ? 'pelo upload de CSV' : 'pela API')
      + (arq ? ' · arquivo ' + arq.nome + ', ' + faixaLinhas(arq.linhas, true) + ' · carregado por ' + arq.por + (arq.hash ? ' · SHA-256 ' + arq.hash.slice(0, 12) + '…' : '') : '')]);
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
      + (vePayload() ? '<button class="evm-btn" onclick="shEvm.payload(\'' + ev.id + '\')">Ver payload original</button>' : '')
      + '<button class="evm-btn pri" onclick="shEvm.revisao(\'' + ev.id + '\')">' + (ev.revisao ? 'Tirar a marca de revisão' : 'Marcar para revisão') + '</button>'
      + '</div>');
    try { history.replaceState(null, '', '#/eventos/' + ev.id); } catch (e) {}
  }

  function payload(id) {
    if (!vePayload()) { toast('O payload original é do perfil técnico: na v1, o Administrador.'); return; }
    var ev = ST.eventos.filter(function (x) { return x.id === id; })[0]; if (!ev) return;
    var c = CAT[ev.cod], det = {};
    if (ev.detalhe) det = ev.detalhe;   // veio por CSV: o detail montado das linhas do arquivo
    else if (ev.cod === '110001') det = { cancelled_event_protocol: (ST.eventos.filter(function (x) { return x.id === ev.cancela; })[0] || {}).protocolo, reason: 'Evento emitido em duplicidade' };
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
      + '<div class="evm-fase ' + (dias >= ESPERA_AUSENCIA ? 'erro' : 'atual') + '"><div class="evm-fase-n">Espera</div><div class="evm-fase-l"><b>' + dias + ' de ' + ESPERA_AUSENCIA + ' dias</b><br>' + (dias >= ESPERA_AUSENCIA ? 'prazo vencido: a ausência pede tratamento' : 'antes do prazo, é processamento normal do órgão') + '</div></div>'
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

  /* ── T-01 · Importação por CSV (proposta AE-04, DV-11) ─────────────────
     O CSV não é uma porta nova: cada evento do arquivo passa pelas mesmas
     validações da API (V-01 a V-14), pela mesma idempotência da chave
     natural (V-13) e pelo mesmo ciclo de vida, mais cinco validações de
     arquivo (CV-01 a CV-05). Sem item na v1: os itens do evento somam por
     tributo, e o efeito cai no registro do tributo, no documento. */
  var ENV = ['event_code', 'type', 'access_key', 'protocol', 'event_datetime', 'sequence', 'author_tax_id', 'author_role', 'authorizer_state', 'environment'];
  var ENV_OBR = ['event_code', 'access_key', 'protocol', 'event_datetime', 'sequence', 'author_tax_id', 'author_role'];
  var MODELOS = {
    M1: { nome: 'indicador', cods: ['112110', '211128', '212110', '212120'], cols: ['accepted'], obr: ['accepted'] },
    M2: { nome: 'data', cods: ['112150'], cols: ['expected_delivery_date'], obr: ['expected_delivery_date'] },
    M3: { nome: 'itens', cods: ['112120', '112140', '211124', '211130', '211140'], cols: ['item_number', 'ibs_amount', 'cbs_amount', 'quantity', 'unit'], obr: ['item_number', 'ibs_amount', 'cbs_amount'], itens: true },
    M4: { nome: 'itens com estorno', cods: ['112130'], cols: ['item_number', 'ibs_amount', 'cbs_amount', 'quantity', 'unit', 'reversal_ibs_amount', 'reversal_cbs_amount'], obr: ['item_number', 'ibs_amount', 'cbs_amount'], itens: true },
    M5: { nome: 'itens de crédito', cods: ['211150'], cols: ['item_number', 'ibs_credit_amount', 'cbs_credit_amount'], obr: ['item_number', 'ibs_credit_amount', 'cbs_credit_amount'], itens: true },
    M6: { nome: 'crédito presumido', cods: ['211110'], cols: ['item_number', 'calculation_base', 'classification_code', 'ibs_rate', 'ibs_amount', 'ibs_suspensive_amount', 'cbs_rate', 'cbs_amount', 'cbs_suspensive_amount'], obr: ['item_number', 'ibs_amount', 'cbs_amount'], itens: true },
    M7: { nome: 'decisão', cods: ['412120', '412130'], cols: ['granted', 'reason_code', 'reason'], obr: ['granted'] },
    M8: { nome: 'cancelamento', cods: ['110001'], cols: ['cancelled_event_code', 'cancelled_protocol'], obr: ['cancelled_event_code', 'cancelled_protocol'] }
  };
  var NUMERICAS = ['ibs_amount', 'cbs_amount', 'quantity', 'reversal_ibs_amount', 'reversal_cbs_amount', 'ibs_credit_amount', 'cbs_credit_amount', 'calculation_base', 'ibs_rate', 'cbs_rate', 'ibs_suspensive_amount', 'cbs_suspensive_amount'];
  var RETIRADOS = ['211120'];   // eliminados pela NT: pela AE-05, entram com aviso — a esteira ainda não os registra
  // o valor do 211128 vem da nota de crédito que referencia o documento, e o CSV (M1) só traz o aceite
  var SO_API = { '211128': 'o valor do 211128 vem da nota de crédito referenciada, que a importação por CSV ainda não lê; envie este evento pela API' };
  var DIC = {
    event_code: 'Diz o evento; o cabeçalho diz o modelo',
    type: 'Derivado do código. Se vier, tem de bater (V-02)',
    access_key: '44 posições, com dígito verificador',
    protocol: 'Evento sem autorização não entra (V-05)',
    event_datetime: 'Data e hora da autorização, com fuso — 2026-08-15T16:40:00-03:00',
    sequence: 'Com a chave e o código, forma a chave natural',
    author_tax_id: 'Quem registrou o evento no órgão — não quem carrega o arquivo',
    author_role: 'issuer, acquirer, successor ou tax_authority',
    authorizer_state: 'UF do autor',
    environment: 'production; homologação é recusada com a credencial de produção (V-14)',
    accepted: '1 ou 0', expected_delivery_date: 'dd/mm/aaaa ou aaaa-mm-dd',
    item_number: 'O nItem do documento; uma linha por item',
    ibs_amount: 'IBS do item, com vírgula decimal — 2880,00', cbs_amount: 'CBS do item, com vírgula decimal',
    quantity: 'Quantidade, com vírgula decimal', unit: 'Unidade',
    reversal_ibs_amount: 'IBS a estornar no item', reversal_cbs_amount: 'CBS a estornar no item',
    ibs_credit_amount: 'Crédito de IBS do item', cbs_credit_amount: 'Crédito de CBS do item',
    calculation_base: 'Base de cálculo do presumido', classification_code: 'Código do crédito presumido (cCredPres)',
    ibs_rate: 'Alíquota do IBS', cbs_rate: 'Alíquota da CBS',
    ibs_suspensive_amount: 'Parcela do IBS com suspensão', cbs_suspensive_amount: 'Parcela da CBS com suspensão',
    granted: '1 ou 0', reason_code: 'Código do motivo', reason: 'Motivo',
    cancelled_event_code: 'Código do evento cancelado', cancelled_protocol: 'Protocolo do evento cancelado'
  };
  var RES = { pronto: ['ok', 'pronto'], aviso: ['aviso', 'aviso'], erro: ['erro', 'erro'], existe: ['neutro', 'já importado'] };
  var IMP = null;

  function digitos(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
  function faixaLinhas(ls, comRotulo) {
    var seguidas = ls.every(function (n, i) { return !i || n === ls[i - 1] + 1; });
    var t = ls.length === 1 ? String(ls[0]) : seguidas ? ls[0] + '–' + ls[ls.length - 1] : ls.join(', ');
    return comRotulo ? (ls.length === 1 ? 'linha ' : 'linhas ') + t : t;
  }
  function numBR(s) { s = String(s == null ? '' : s).trim(); return /^\d+(,\d+)?$/.test(s) ? Number(s.replace(',', '.')) : NaN; }
  function dvChave(ch) {
    var p = 2, s = 0;
    for (var i = 42; i >= 0; i--) { s += (+ch[i]) * p; p = p === 9 ? 2 : p + 1; }
    var r = s % 11; return (r < 2 ? 0 : 11 - r) === +ch[43];
  }
  function sha256(txt) {
    try {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)).then(function (b) {
        return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      }).catch(function () { return ''; });
    } catch (e) { return Promise.resolve(''); }
  }
  // ponto e vírgula, aspas duplas e BOM do Excel
  function lerCsv(txt) {
    txt = String(txt).replace(/^﻿/, '');
    var out = [], linha = [], campo = '', q = false;
    for (var i = 0; i < txt.length; i++) {
      var ch = txt[i];
      if (q) { if (ch === '"') { if (txt[i + 1] === '"') { campo += '"'; i++; } else q = false; } else campo += ch; continue; }
      if (ch === '"') q = true;
      else if (ch === ';') { linha.push(campo); campo = ''; }
      else if (ch === '\n') { linha.push(campo); out.push(linha); linha = []; campo = ''; }
      else if (ch !== '\r') campo += ch;
    }
    if (campo !== '' || linha.length) { linha.push(campo); out.push(linha); }
    return out;
  }

  // CV-01 e CV-02: o cabeçalho diz o modelo; as colunas podem vir em qualquer ordem
  function detectar(cab_) {
    var conhecidas = ENV.slice();
    Object.keys(MODELOS).forEach(function (m) { conhecidas = conhecidas.concat(MODELOS[m].cols); });
    if (!cab_.some(function (h) { return conhecidas.indexOf(h) >= 0; }))
      return { erro: ['header_unknown', 'CV-01', 'O cabeçalho não corresponde a nenhum dos oito modelos. A primeira linha precisa trazer os nomes das colunas, como no modelo em branco.'] };
    var melhor = null, n = 0;
    Object.keys(MODELOS).forEach(function (m) {
      var k = MODELOS[m].cols.filter(function (c) { return cab_.indexOf(c) >= 0; }).length;
      if (k > n || (k && k === n && MODELOS[m].cols.length < MODELOS[melhor].cols.length)) { melhor = m; n = k; }
    });
    if (!melhor) return { erro: ['header_unknown', 'CV-01', 'O cabeçalho só tem as colunas do envelope: faltam as do modelo, que dizem qual dos oito ele é.'] };
    var M = MODELOS[melhor], falta = ENV_OBR.concat(M.obr).filter(function (c) { return cab_.indexOf(c) < 0; });
    if (falta.length) return { modelo: melhor, erro: ['column_missing', 'CV-02', 'Faltam colunas obrigatórias do modelo ' + melhor + ' · ' + M.nome + ': ' + falta.join(', ') + '.'] };
    return { modelo: melhor, ignoradas: cab_.filter(function (h) { return h && ENV.indexOf(h) < 0 && M.cols.indexOf(h) < 0; }) };
  }

  // o resultado de um evento — todas as linhas com a mesma chave natural
  function avaliar(g, m, idx, docs) {
    var M = MODELOS[m];
    var val = function (row, col) { var i = idx[col]; return i == null || row[i] == null ? '' : String(row[i]).trim(); };
    var r0 = g.rows[0], l0 = g.linhas[0], cod = val(r0, 'event_code'), chave = digitos(val(r0, 'access_key'));
    var o = { linhas: g.linhas, rows: g.rows, cod: cod, docRot: '—', itens: M.itens ? g.rows.length : null, res: 'pronto', codigo: '', msg: '', coluna: '', linhaErro: null };
    function falha(codigo, msg, coluna, linha) { o.res = 'erro'; o.codigo = codigo; o.msg = msg; o.coluna = coluna || ''; o.linhaErro = linha || l0; return o; }
    // CV-04: linhas do mesmo evento com o mesmo envelope — evento pela metade não existe
    for (var i = 1; i < g.rows.length; i++) {
      for (var j = 0; j < ENV.length; j++) {
        if (idx[ENV[j]] == null || val(g.rows[i], ENV[j]) === val(r0, ENV[j])) continue;
        return falha('group_inconsistent', 'a linha é do mesmo evento da linha ' + l0 + ' e traz outro valor; o grupo inteiro fica de fora.', ENV[j], g.linhas[i]);
      }
    }
    // V-01: o código existe na NT; a esteira trata os treze do catálogo
    var nt = RETIRADOS.slice(); Object.keys(MODELOS).forEach(function (k) { nt = nt.concat(MODELOS[k].cods); });
    if (nt.indexOf(cod) < 0) return falha('event_code_unknown', cod ? 'o código ' + cod + ' não existe no catálogo da NT.' : 'event_code vazio.', 'event_code');
    if (!CAT[cod]) return falha('event_code_not_supported', (RETIRADOS.indexOf(cod) >= 0 ? 'o ' + cod + ' foi eliminado pela NT, e ' : '') + 'a esteira ainda não trata o ' + cod + '.', 'event_code');
    if (SO_API[cod]) return falha('event_code_not_supported', SO_API[cod] + '.', 'event_code');
    // V-03: o detail do código é o do modelo do arquivo
    if (M.cods.indexOf(cod) < 0) {
      var certo = Object.keys(MODELOS).filter(function (k) { return MODELOS[k].cods.indexOf(cod) >= 0; })[0];
      return falha('detail_shape_invalid', 'o ' + cod + ' usa o modelo ' + certo + ', e o cabeçalho é do ' + m + '.', 'event_code');
    }
    var c = CAT[cod], tp = val(r0, 'type');
    if (tp && tp !== c.tipo) return falha('type_code_mismatch', 'o type do ' + cod + ' é ' + c.tipo + ', e a linha diz ' + tp + '.', 'type');                 // V-02
    if (chave.length !== 44 || !dvChave(chave)) return falha('access_key_invalid', 'a chave precisa de 44 posições e dígito verificador válido.', 'access_key');   // V-04
    var seq = val(r0, 'sequence');
    if (!/^\d+$/.test(seq) || +seq < 1) return falha('value_format_invalid', 'sequence precisa ser um número inteiro a partir de 1.', 'sequence');
    var nf = docs[chave];
    if (nf) o.docRot = (nf.tipoDF || 'DF') + ' ' + nf.numero;
    // V-13: a chave natural já existe — devolve o existente, nada se duplica
    var ja = ST.eventos.filter(function (e) { return digitos(e.chave) === chave && e.cod === cod && +e.seq === +seq; })[0];
    if (ja) { o.res = 'existe'; o.msg = 'chegou antes ' + (ja.canal === 'CSV' ? 'por CSV' : 'pela API') + ', como ' + ja.id + ' — a V-13 devolve o existente.'; return o; }
    if (!nf) return falha('document_not_found', 'o documento desta chave não está na base. Nesta versão, o evento só entra com o documento já carregado.', 'access_key');
    var prot = val(r0, 'protocol');
    if (!prot) return falha('protocol_required', 'protocol vazio: evento sem autorização não entra.', 'protocol');      // V-05
    var dh = val(r0, 'event_datetime');                                                                                 // CV-03
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$/.test(dh) || isNaN(Date.parse(dh)))
      return falha('value_format_invalid', 'event_datetime precisa ser data e hora com fuso — 2026-08-15T16:40:00-03:00.', 'event_datetime');
    var amb = val(r0, 'environment').toLowerCase();                                                                    // V-14
    if (['homologation', 'homologacao', 'homologação', '2'].indexOf(amb) >= 0) return falha('environment_mismatch', 'evento de homologação só entra com credencial de sandbox; esta importação usa a de produção.', 'environment');
    if (amb && ['production', 'producao', 'produção', '1'].indexOf(amb) < 0) return falha('value_format_invalid', 'environment precisa ser production.', 'environment');
    // V-06: o papel e o CNPJ do autor batem com o documento
    var papel = val(r0, 'author_role'), lado = nf.tipo;
    if (['issuer', 'acquirer', 'successor', 'tax_authority'].indexOf(papel) < 0) return falha('value_format_invalid', 'author_role precisa ser issuer, acquirer, successor ou tax_authority.', 'author_role');
    if (c.autor !== 'autor_evento' && papel !== ROLE[c.autor]) return falha('author_role_mismatch', 'o ' + cod + ' é registrado pelo ' + AUTOR[c.autor].toLowerCase() + ' (' + ROLE[c.autor] + '), e a linha diz ' + papel + '.', 'author_role');
    if (papel === 'issuer' || papel === 'acquirer') {
      var daEmpresa = papel === (lado === 'entrada' ? 'acquirer' : 'issuer');
      if (digitos(val(r0, 'author_tax_id')) !== digitos(daEmpresa ? nf.cnpjComprador : nf.cnpj))
        return falha('author_role_mismatch', 'o CNPJ do autor não é o do ' + (papel === 'issuer' ? 'emitente' : 'destinatário') + ' do documento.', 'author_tax_id');
    }
    if (cod !== '110001' && !(c.acao && c.acao[lado]))
      return falha('event_side_not_supported', 'o ' + cod + ' não muda o ' + (lado === 'entrada' ? 'crédito' : 'débito') + ' da empresa num documento de ' + (lado === 'entrada' ? 'entrada' : 'saída') + '.', 'access_key');
    if (cod === '211110' && nf.tipoDF === 'NFC-e') return falha('presumed_credit_not_allowed', 'crédito presumido não cabe em documento modelo 65 (NFC-e).', 'access_key');   // V-09
    if (!rfDe(nf, 'CBS') && !rfDe(nf, 'IBS')) return falha('document_without_tax', 'o documento não tem registro fiscal de CBS nem de IBS para receber o efeito.', 'access_key');
    // o que cada modelo traz
    var soma = { CBS: 0, IBS: 0 }, det = {}, alvo = null;
    if (M.itens) {
      if (g.rows.length > 990) return falha('items_limit_exceeded', 'no máximo 990 itens por evento.', 'item_number', g.linhas[990]);   // V-08
      var vistos = {}, itens = [];
      for (var r = 0; r < g.rows.length; r++) {
        var row = g.rows[r], ln = g.linhas[r], it = val(row, 'item_number'), item;
        if (!/^\d+$/.test(it) || +it < 1) return falha('value_format_invalid', 'item_number precisa ser um número inteiro a partir de 1.', 'item_number', ln);
        if (vistos[it]) return falha('item_duplicated', 'o item ' + it + ' já veio na linha ' + vistos[it] + ' do mesmo evento.', 'item_number', ln);   // V-07
        vistos[it] = ln; item = { item_number: +it };
        for (var q = 0; q < M.cols.length; q++) {
          var col = M.cols[q], s = val(row, col);
          if (col === 'item_number' || idx[col] == null || (s === '' && M.obr.indexOf(col) < 0)) continue;
          if (NUMERICAS.indexOf(col) < 0) { item[col] = s; continue; }
          var nv = numBR(s);
          if (isNaN(nv)) return falha('value_format_invalid', '"' + s + '" não é número no formato do arquivo: vírgula decimal, sem separador de milhar — 2880,00.', col, ln);   // CV-03
          item[col] = nv;
        }
        soma.IBS += item[m === 'M5' ? 'ibs_credit_amount' : 'ibs_amount'] || 0;
        soma.CBS += item[m === 'M5' ? 'cbs_credit_amount' : 'cbs_amount'] || 0;
        itens.push(item);
      }
      det = { items: itens };
    } else if (m === 'M1') {
      var ac = val(r0, 'accepted');
      if (ac !== '1' && ac !== '0') return falha('value_format_invalid', 'accepted precisa ser 1 ou 0.', 'accepted');
      if (cod === '112110' && ac === '0') return falha('indicator_value_invalid', 'a informação de pagamento integral não aceita accepted 0.', 'accepted');   // V-12
      det = cod === '112110' ? { full_payment: true } : { accepted: ac === '1' };
    } else if (m === 'M2') {
      var dt = val(r0, 'expected_delivery_date'), br = dt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/), dIso = br ? br[3] + '-' + br[2] + '-' + br[1] : dt;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dIso) || isNaN(Date.parse(dIso))) return falha('value_format_invalid', 'expected_delivery_date precisa ser dd/mm/aaaa ou aaaa-mm-dd.', 'expected_delivery_date');
      det = { expected_delivery_date: dIso };
    } else if (m === 'M8') {
      var cc = val(r0, 'cancelled_event_code'), cp = val(r0, 'cancelled_protocol');
      alvo = ST.eventos.filter(function (e) { return e.protocolo === cp && digitos(e.chave) === chave; })[0];
      if (!alvo || alvo.cod !== cc) return falha('cancelled_event_not_found', 'nenhum ' + cc + ' deste documento tem o protocolo ' + cp + '.', 'cancelled_protocol');
      if (alvo.cod === '110001') return falha('cannot_cancel_cancellation', 'um cancelamento não cancela outro cancelamento.', 'cancelled_event_code');   // V-10
      if (papel !== ROLE[CAT[alvo.cod].autor]) return falha('cancel_author_mismatch', 'quem cancela é o autor do evento cancelado (' + ROLE[CAT[alvo.cod].autor] + ').', 'author_role');   // V-11
      if (alvo.canceladoPor) return falha('already_cancelled', 'o ' + alvo.id + ' já foi cancelado pelo ' + alvo.canceladoPor + '.', 'cancelled_protocol');
      if (CAT[alvo.cod].efeito === 'valor' && tribsDo(alvo).some(function (t) { return alvo.trib[t].estado === 'executada'; }))
        return falha('cancel_after_execution', 'o ' + alvo.id + ' já foi executado, e a esteira ainda não desfaz valor aplicado.', 'cancelled_protocol');
      det = { cancelled_event_code: cc, cancelled_protocol: cp };
    }
    // avisos: o evento entra, e o aviso fica na trilha dele
    var vis = window.nfListaFiltradaGlobal;
    if (vis && !vis.some(function (x) { return x.numero === nf.numero; })) {
      o.res = 'aviso'; o.codigo = 'document_out_of_filter';
      o.msg = 'o documento está fora do filtro de empresa atual: o evento entra, mas só aparece na esteira com o filtro ajustado.';
    } else if (c.efeito === 'valor') {
      var junto = ST.eventos.filter(function (e) {
        return e.nf === nf.numero && !e.canceladoPor && CAT[e.cod].efeito === 'valor'
          && tribsDo(e).some(function (t) { return e.trib[t].estado === 'planejada' || e.trib[t].estado === 'aguardando'; });
      })[0];
      if (junto) {
        o.res = 'aviso'; o.codigo = 'concurrent_event';
        o.msg = 'o documento já tem o ' + junto.id + ' esperando o órgão: se os dois refletirem na mesma leitura, o reflexo pode não ser atribuível a um só.';
      }
    }
    o.data = { nf: nf, cod: cod, seq: +seq, protocolo: prot, aut: Date.parse(dh), soma: soma, detalhe: det, alvo: alvo };
    return o;
  }

  function processar(nome, txt) {
    IMP.nome = nome; IMP.erroArq = null; IMP.grupos = null; IMP.hash = ''; IMP.ignoradas = [];
    sha256(txt).then(function (h) { if (IMP && IMP.nome === nome) IMP.hash = h; });
    var L = lerCsv(txt).map(function (r, i) { return { r: r, n: i + 1 }; })
      .filter(function (x) { return x.r.some(function (c) { return String(c).trim() !== ''; }); });
    if (!L.length) { IMP.erroArq = ['header_unknown', 'CV-01', 'O arquivo está vazio.']; return desenharImp(); }
    var cab_ = L[0].r.map(function (h) { return String(h).trim(); }), det = detectar(cab_);
    if (det.modelo) { IMP.modelo = det.modelo; IMP.detectado = det.modelo; }
    if (det.erro) { IMP.erroArq = det.erro; return desenharImp(); }
    IMP.cab = cab_; IMP.ignoradas = det.ignoradas;
    var idx = {}; cab_.forEach(function (h, i) { if (h && idx[h] == null) idx[h] = i; });
    var dados = L.slice(1);
    if (!dados.length) { IMP.erroArq = ['header_unknown', 'CV-01', 'O arquivo só tem o cabeçalho, sem nenhuma linha de evento.']; return desenharImp(); }
    // CSV-R04: as linhas se agrupam pela chave natural — chave de acesso, código e sequência
    var grupos = [], porK = {};
    dados.forEach(function (x) {
      var v = function (c) { return idx[c] == null || x.r[idx[c]] == null ? '' : String(x.r[idx[c]]).trim(); };
      var k = digitos(v('access_key')) + '|' + v('event_code') + '|' + v('sequence');
      if (!porK[k]) { porK[k] = { rows: [], linhas: [] }; grupos.push(porK[k]); }
      porK[k].rows.push(x.r); porK[k].linhas.push(x.n);
    });
    if (grupos.length > 5000) { IMP.erroArq = ['file_too_large', 'CV-05', 'O arquivo tem ' + grupos.length.toLocaleString('pt-BR') + ' eventos; o limite é de 5.000 por arquivo.']; return desenharImp(); }
    var docs = {}; nfs().forEach(function (nf) { docs[digitos(nf.chaveDF)] = nf; });
    IMP.nLinhas = dados.length;
    IMP.grupos = grupos.map(function (g) { return avaliar(g, det.modelo, idx, docs); });
    desenharImp();
  }

  function chipRes(r, txt) { return '<span class="evm-res ' + RES[r][0] + '">' + (txt || RES[r][1]) + '</span>'; }
  function dicionario(m) {
    var M = MODELOS[m], fora = M.cods.filter(function (c) { return !CAT[c] || SO_API[c]; });
    var tr = function (col, obr) { return '<tr><td class="evm-mono">' + col + '</td><td>' + (obr ? 'sim' : 'não') + '</td><td class="evm-small">' + esc(DIC[col] || '') + '</td></tr>'; };
    return '<details class="evm-dic"><summary>Colunas do modelo ' + m + ' · ' + esc(M.nome) + ' — o envelope, comum aos oito, e as do modelo</summary>'
      + '<div class="twrap" style="--twrap-h:none"><table><thead><tr><th>Coluna</th><th>Obrig.</th><th>Observação</th></tr></thead><tbody>'
      + ENV.map(function (c) { return tr(c, ENV_OBR.indexOf(c) >= 0); }).join('') + M.cols.map(function (c) { return tr(c, M.obr.indexOf(c) >= 0); }).join('')
      + '</tbody></table></div>'
      + '<div class="evm-small">Ponto e vírgula entre colunas, vírgula decimal sem separador de milhar, UTF-8 com ou sem BOM. Até 5.000 eventos por arquivo, enviados em lotes de 500 pela rota de lote da API.</div>'
      + (M.itens ? '<div class="evm-small">Uma linha por item, com o envelope repetido. A primeira versão não segmenta por item: os itens do evento somam por tributo, e o efeito cai no registro do tributo, no documento.</div>' : '')
      + (fora.length ? '<div class="evm-small">A esteira ainda não recebe por arquivo o ' + fora.join(', o ') + ': essas linhas voltam recusadas, com o motivo.</div>' : '')
      + '</details>';
  }
  function desenharImp() {
    if (!IMP) return;
    var html, pe;
    if (IMP.passo === 3) {
      var R = IMP.resultado;
      html = '<div class="twrap" style="--twrap-h:none"><table><thead><tr><th>Resultado</th><th class="r">Eventos</th><th>O que acontece agora</th></tr></thead><tbody>'
        + '<tr><td>' + chipRes('pronto', 'recebidos') + '</td><td class="evm-num">' + R.recebidos + '</td><td>Entram em capturada e seguem o ciclo de qualquer evento: planeja, aguarda o órgão, executa.</td></tr>'
        + '<tr><td>' + chipRes('aviso', 'com aviso') + '</td><td class="evm-num">' + R.avisos + (R.avisos ? ' dos ' + R.recebidos : '') + '</td><td>Entram como os outros, e o aviso fica na trilha do evento.</td></tr>'
        + '<tr><td>' + chipRes('erro', 'recusados') + '</td><td class="evm-num">' + R.recusados + '</td><td>Ficam no arquivo de erros, com as linhas originais e três colunas a mais: erro_codigo, erro_mensagem e erro_coluna.</td></tr>'
        + '<tr><td>' + chipRes('existe', 'já existiam') + '</td><td class="evm-num">' + R.existiam + '</td><td>Nada muda: o evento já estava na base.</td></tr>'
        + '</tbody></table></div>';
      pe = '<button class="evm-btn" onclick="shEvm.impFechar()">Fechar</button>'
        + (R.recusados ? '<button class="evm-btn" onclick="shEvm.impErros()">Baixar arquivo de erros</button>' : '')
        + '<button class="evm-btn pri" onclick="shEvm.impVer()">' + (R.recebidos === 1 ? 'Ver o evento na esteira' : 'Ver os ' + R.recebidos + ' na esteira') + '</button>';
      overlay('evm-csv', 820, cab('evm-csv', 'Importação concluída', '',
        '<span>Passos 3 e 4</span><span>' + pl(R.lotes, 'lote', 'lotes') + ' · ' + pl(R.recebidos, 'evento', 'eventos') + '</span><span>' + fDHA(R.em) + ' · por ' + esc(R.por) + '</span><span>' + esc(IMP.nome) + '</span>')
        + '<div class="evm-corpo">' + html + '</div><div class="evm-pe">' + pe + '</div>');
      return;
    }
    var G = IMP.grupos, n = { pronto: 0, aviso: 0, erro: 0, existe: 0 };
    (G || []).forEach(function (g) { n[g.res]++; });
    html = '<div class="evm-imp-sel">'
      + '<div class="evm-campo"><label for="evm-imp-modelo">Modelo</label><select id="evm-imp-modelo" onchange="shEvm.impModelo(this.value)">'
      + Object.keys(MODELOS).map(function (k) { return opt(k, k + ' · ' + MODELOS[k].nome + ' — ' + MODELOS[k].cods.join(', '), IMP.modelo); }).join('') + '</select></div>'
      + '<div class="evm-imp-acoes"><button class="evm-btn" onclick="shEvm.impBaixarModelo()">Baixar modelo em branco</button>'
      + '<label class="evm-btn evm-arq">Escolher arquivo<input type="file" accept=".csv,.txt" onchange="shEvm.impArquivo(this)" aria-label="Escolher o arquivo CSV"></label>'
      + '<button class="evm-btn" onclick="shEvm.impExemplo()" title="Monta um arquivo do modelo M3 sobre documentos desta base, com um caso de cada resultado">Usar um arquivo de exemplo</button></div></div>'
      + dicionario(IMP.modelo);
    if (IMP.erroArq) html += '<div class="evm-faixa red"><b>' + esc(IMP.erroArq[1]) + ' · <span class="evm-mono">' + esc(IMP.erroArq[0]) + '</span>.</b> ' + esc(IMP.erroArq[2]) + ' Nenhum evento sai deste arquivo.</div>';
    if (G) {
      html += '<div class="evm-small"><b>' + esc(IMP.nome) + '</b> · ' + pl(IMP.nLinhas, 'linha', 'linhas') + ' · ' + pl(G.length, 'evento', 'eventos') + ' · modelo ' + IMP.detectado + ' reconhecido pelo cabeçalho'
        + (IMP.ignoradas.length ? ' · colunas ignoradas: ' + esc(IMP.ignoradas.join(', ')) : '') + '</div>'
        + '<div class="evm-imp-kpis">' + [['pronto', 'Prontos'], ['aviso', 'Com aviso'], ['erro', 'Com erro'], ['existe', 'Já importados']].map(function (x) {
          return '<div class="evm-imp-kpi ' + RES[x[0]][0] + '"><div class="evm-ik-l">' + x[1] + '</div><div class="evm-ik-v">' + n[x[0]] + '</div></div>';
        }).join('') + '</div>'
        + '<div class="twrap" style="--twrap-h:none"><table><thead><tr><th>Linhas</th><th>Evento</th><th>Documento</th><th class="r">Itens</th><th>Resultado</th><th>Detalhe</th></tr></thead><tbody>'
        + G.map(function (g) {
          return '<tr><td class="evm-mono evm-nw">' + faixaLinhas(g.linhas) + '</td><td class="evm-mono">' + esc(g.cod || '—') + '</td><td class="evm-small evm-nw">' + esc(g.docRot) + '</td>'
            + '<td class="evm-num">' + (g.itens == null ? '—' : g.itens) + '</td><td>' + chipRes(g.res) + '</td><td class="evm-small">'
            + (g.res === 'pronto' ? '<span class="evm-muted">—</span>'
              : (g.codigo ? '<span class="evm-mono">' + esc(g.codigo) + '</span> — ' : '')
              + (g.res === 'erro' ? 'linha ' + g.linhaErro + (g.coluna ? ', <span class="evm-mono">' + esc(g.coluna) + '</span>' : '') + ': ' : '') + esc(g.msg))
            + '</td></tr>';
        }).join('') + '</tbody></table></div>'
        + '<div class="evm-small">O resultado é por evento: um erro numa linha de item recusa o evento inteiro. Os prontos e os com aviso entram; os com erro ficam de fora, e o já importado não é reenviado.</div>';
    }
    var envia = n.pronto + n.aviso;
    pe = '<button class="evm-btn" onclick="shEvm.impFechar()">Cancelar</button>'
      + (n.erro ? '<button class="evm-btn" onclick="shEvm.impErros()">Baixar as linhas com erro</button>' : '')
      + '<button class="evm-btn pri" onclick="shEvm.impEnviar()"' + (envia ? '' : ' disabled') + '>' + (envia ? 'Enviar ' + pl(envia, 'evento', 'eventos') : 'Nada a enviar') + '</button>';
    overlay('evm-csv', 900, cab('evm-csv', 'Importar eventos por CSV', '', '<span>Passos 1 e 2 · o arquivo passa pelas mesmas validações da API antes de sair daqui</span>')
      + '<div class="evm-corpo">' + html + '</div><div class="evm-pe">' + pe + '</div>');
  }

  function importar() {
    if (!podeImportar()) { toast('Importar eventos é do Administrador e do Fiscal.'); return; }
    if (!semear()) return;
    IMP = { passo: 1, modelo: 'M3' };
    desenharImp();
  }
  function impArquivo(inp) {
    var f = inp.files && inp.files[0]; if (!f || !IMP) return;
    if (!/\.(csv|txt)$/i.test(f.name)) { IMP.nome = f.name; IMP.grupos = null; IMP.erroArq = ['file_type_invalid', 'Extensão', 'O arquivo precisa ser .csv ou .txt.']; return desenharImp(); }
    var rd = new FileReader();
    rd.onload = function () { processar(f.name, String(rd.result || '')); };
    rd.readAsText(f, 'utf-8');
  }
  // um arquivo M3 sobre documentos desta base, com um caso de cada resultado
  function impExemplo() {
    if (!IMP) return;
    var vis = window.nfListaFiltradaGlobal || nfs(), usados = {}, agora = Date.now(), k = 0;
    ST.eventos.forEach(function (e) { usados[e.nf] = 1; }); ST.ausentes.forEach(function (a) { usados[a.nf] = 1; });
    var livres = function (lado) {
      return vis.filter(function (nf) { return nf.tipo === lado && nf.tipoDF === 'NF-e' && !usados[nf.numero] && rfDe(nf, 'CBS') && rfDe(nf, 'IBS') && digitos(nf.chaveDF).length === 44; });
    };
    var ent = livres('entrada'), sai = livres('saida'), porNum = {};
    nfs().forEach(function (nf) { porNum[nf.numero] = nf; });
    var L = [['event_code', 'access_key', 'protocol', 'event_datetime', 'sequence', 'author_tax_id', 'author_role', 'item_number', 'ibs_amount', 'cbs_amount', 'quantity', 'unit']];
    var v = function (nf, t) { return redondo((Number(rfDe(nf, t).valor) || 0) * 0.1) + ',00'; };
    function evento(cod, nf, papel, itens, o) {
      o = o || {}; k++;
      var d = new Date(agora - (2 + k) * DIA); d.setHours(8 + k % 9, (k * 7) % 60, 0, 0);
      var prot = o.prot != null ? o.prot : '1' + digitos(nf.chaveDF).slice(0, 2) + '26' + String(100000000 + hash(nf.numero + cod + k) % 899999999).slice(0, 9) + p2(k);
      var tax = digitos(papel === (nf.tipo === 'entrada' ? 'acquirer' : 'issuer') ? nf.cnpjComprador : nf.cnpj);
      itens.forEach(function (it) {
        L.push([cod, digitos(nf.chaveDF), prot, iso(d) + 'T' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':00-03:00', o.seq || '1', tax, papel, it[0], it[1], it[2], it[3] || '1,0000', 'UN']);
      });
    }
    var e = ent.slice(0, 6);
    if (e[0]) evento('211124', e[0], 'acquirer', [['1', v(e[0], 'IBS'), v(e[0], 'CBS'), '2,0000']]);
    if (e[1]) evento('211124', e[1], 'acquirer', [['1', v(e[1], 'IBS'), v(e[1], 'CBS')], ['4', v(e[1], 'IBS'), v(e[1], 'CBS')]]);
    if (e[2]) evento('211140', e[2], 'acquirer', [['2', v(e[2], 'IBS'), v(e[2], 'CBS'), '500,0000']]);
    if (e[0]) evento('211130', e[0], 'acquirer', [['3', '0,00', '0,00']]);
    // aviso: o documento já tem um evento esperando o órgão
    var esp = ST.eventos.filter(function (x) {
      return x.lado === 'entrada' && x.canal === 'API' && !x.canceladoPor && CAT[x.cod].efeito === 'valor' && porNum[x.nf]
        && vis.some(function (nf) { return nf.numero === x.nf; })
        && tribsDo(x).some(function (t) { return x.trib[t].estado === 'planejada' || x.trib[t].estado === 'aguardando'; });
    })[0];
    if (esp) {
      var codAv = ['211140', '211124'].filter(function (cd) { return !ST.eventos.some(function (x) { return x.nf === esp.nf && x.cod === cd; }); })[0];
      if (codAv) evento(codAv, porNum[esp.nf], 'acquirer', [['1', v(porNum[esp.nf], 'IBS'), v(porNum[esp.nf], 'CBS')]]);
    }
    // já importado: a chave natural de um evento que chegou pela API
    var dup = ST.eventos.filter(function (x) { return x.canal === 'API' && x.lado === 'entrada' && (x.cod === '211124' || x.cod === '211140') && porNum[x.nf]; })[0];
    if (dup) evento(dup.cod, porNum[dup.nf], 'acquirer', [['1', v(porNum[dup.nf], 'IBS'), v(porNum[dup.nf], 'CBS')]], { prot: dup.protocolo, seq: String(dup.seq) });
    if (e[3]) evento('211140', e[3], 'acquirer', [['1', v(e[3], 'IBS'), v(e[3], 'CBS')]], { prot: '' });                         // protocol_required
    if (e[4]) evento('211124', e[4], 'acquirer', [['2', v(e[4], 'IBS'), v(e[4], 'CBS')], ['2', v(e[4], 'IBS'), v(e[4], 'CBS')]]);   // item_duplicated
    if (sai[0]) evento('112120', sai[0], 'issuer', [['1', v(sai[0], 'IBS'), v(sai[0], 'CBS')]]);
    if (e[5]) evento('211140', e[5], 'acquirer', [['1', '1.000,00', v(e[5], 'CBS')]]);                                             // value_format_invalid
    IMP.passo = 1;
    processar('eventos-exemplo-' + iso(agora) + '.csv', L.map(function (r) { return r.map(csvCampo).join(';'); }).join('\r\n'));
  }
  function impEnviar() {
    if (!IMP || !IMP.grupos) return;
    var ok = IMP.grupos.filter(function (g) { return g.res === 'pronto' || g.res === 'aviso'; });
    if (!ok.length) return;
    var agora = Date.now(), por = nomeUsuario(), ids = [];
    ok.forEach(function (g) {
      var d = g.data, nf = d.nf, c = CAT[d.cod], lado = nf.tipo;
      var ev = {
        id: 'EV-' + ('000000' + (++ST.seq)).slice(-6), cod: d.cod, lado: lado, canal: 'CSV', nf: nf.numero, entidade: nf.entidade, cnpj: nf.cnpj, cnpjEmpresa: nf.cnpjComprador, chave: nf.chaveDF,
        competenciaDoc: comp(nf.data + 'T12:00:00'), compIso: String(nf.data).slice(0, 7), aut: d.aut, capt: agora, plan: null,
        protocolo: d.protocolo, seq: d.seq, revisao: false, canceladoPor: null, cancela: d.alvo ? d.alvo.id : null, trib: {}, detalhe: d.detalhe,
        arquivo: { nome: IMP.nome, hash: IMP.hash, linhas: g.linhas, por: por, em: agora }, marcas: []
      };
      TRIBS.forEach(function (t) {
        if (d.alvo) {
          var y = d.alvo.trib[t];
          if (y) ev.trib[t] = { rf: y.rf, antes: y.antes, delta: 0, estado: 'capturada', lido: null, observado: null, exec: null };
          return;
        }
        var rf = rfDe(nf, t); if (!rf) return;
        var dl = c.efeito === 'valor' ? (c.sinal[lado] || 0) * Math.round(d.soma[t] * 100) / 100 : 0;
        ev.trib[t] = { rf: rf.id, antes: Number(rf.valor) || 0, delta: dl, estado: 'capturada', lido: null, observado: null, exec: null };
      });
      if (g.res === 'aviso') ev.marcas.push({ em: agora, txt: 'Aviso na importação (' + g.codigo + '): ' + g.msg });
      ST.eventos.push(ev); ids.push(ev.id);
    });
    encadear();
    var n = { aviso: 0, erro: 0, existe: 0 };
    IMP.grupos.forEach(function (g) { if (n[g.res] != null) n[g.res]++; });
    IMP.passo = 3;
    IMP.resultado = { recebidos: ok.length, avisos: n.aviso, recusados: n.erro, existiam: n.existe, lotes: Math.ceil(ok.length / 500), em: agora, por: por };
    desenharImp();
    render();
    // como na API: o evento entra em capturada e, calculado o efeito, passa a planejada
    setTimeout(function () { planejar(ids); }, 3000);
  }
  function planejar(ids) {
    var agora = Date.now(), n = 0;
    ST.eventos.forEach(function (ev) {
      if (ids.indexOf(ev.id) < 0 || ev.plan) return;
      var c = CAT[ev.cod]; ev.plan = agora; n++;
      tribsDo(ev).forEach(function (t) {
        var x = ev.trib[t];
        if (c.efeito === 'valor') x.estado = 'planejada';
        else { x.estado = 'executada'; x.exec = ev.aut; }   // atributo e cancelamento valem na autorização
      });
      if (ev.cancela) {
        var alvo = ST.eventos.filter(function (e) { return e.id === ev.cancela; })[0];
        if (alvo && !alvo.canceladoPor) { alvo.canceladoPor = ev.id; alvo.canceladoEm = ev.aut; }
      }
    });
    if (!n) return;
    encadear();
    toast('Efeito calculado para ' + pl(n, 'evento importado', 'eventos importados') + '.');
    render();
  }
  function impErros() {
    if (!IMP || !IMP.grupos) return;
    var w = IMP.cab.length, L = [IMP.cab.concat(['erro_codigo', 'erro_mensagem', 'erro_coluna'])];
    IMP.grupos.forEach(function (g) {
      if (g.res !== 'erro') return;
      g.rows.forEach(function (r) {
        var x = r.slice(0, w); while (x.length < w) x.push('');
        L.push(x.concat([g.codigo, 'linha ' + g.linhaErro + ': ' + g.msg, g.coluna]));
      });
    });
    baixar('erros-' + IMP.nome.replace(/\.(csv|txt)$/i, '') + '.csv', L);
  }
  // o cabeçalho do modelo escolhido, com as colunas na ordem do dicionário
  function impBaixarModelo() {
    if (!IMP) return;
    var M = MODELOS[IMP.modelo];
    baixar('modelo-' + IMP.modelo.toLowerCase() + '-' + M.nome.replace(/[^a-zà-ú]+/gi, '-').toLowerCase() + '.csv', [ENV.concat(M.cols)]);
  }
  function impModelo(m) { if (!IMP || !MODELOS[m]) return; IMP.modelo = m; desenharImp(); }
  function impFechar() { IMP = null; fechar('evm-csv'); }
  function impVer() {
    var nome = IMP && IMP.nome;
    impFechar();
    ST.aba = 'esteira'; ST.kpi = null; ST.f = { canal: 'CSV' };
    render();
    if (nome) toast('Esteira filtrada pelo canal CSV. Os eventos de ' + nome + ' estão no topo.');
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
    lerReceita: lerReceita, arquivoComite: arquivoComite,
    importar: importar, impModelo: impModelo, impArquivo: impArquivo, impExemplo: impExemplo, impEnviar: impEnviar,
    impErros: impErros, impBaixarModelo: impBaixarModelo, impFechar: impFechar, impVer: impVer,
    estado: function () { return ST; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
  window.addEventListener('hashchange', rota);
  window.addEventListener('load', function () { setTimeout(function () { montar(); rota(); }, 450); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    ['evm-pl', 'evm-det', 'evm-aus', 'evm-csv'].some(function (id) {
      var el = document.getElementById(id); if (!el) return false;
      if (id === 'evm-csv') impFechar(); else el.remove();
      return true;
    });
  });
})();

/* ============================================================
   SplitHub — Integrações: catálogo de conexões e credenciais
   T-09 Catálogo + assistente de nova conexão
   T-10 Emissão de credencial de API (client_id / client_secret)

   Contexto: até aqui o módulo só modelava conexões de SAÍDA
   (webhook do RAD para o ERP). A API publicada em
   https://split-hubhq.github.io/docs/ tem seis contextos, e três
   deles são de ENTRADA — o ERP chama o SplitHub. O maior deles é a
   ingestão de DFs, que não tinha nenhuma tela onde gerar a chave.

   A doc de autenticação descreve o uso do client_id/client_secret
   mas declara que o processo de geração dessas credenciais não é
   especificado. É essa lacuna que este módulo modela.

   Tudo aqui é MOCK, para especificar o comportamento ao time que
   for desenvolver: os segredos são aleatórios em memória, nenhuma
   chamada sai do navegador.
   ============================================================ */
(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }
  var badge = function () { return window.radBadge.apply(null, arguments); };

  var API_BASE = 'https://api.splithub.com.br';
  var DOC_BASE = 'https://split-hubhq.github.io/docs/';

  // ══════════════════════════════════════════════════════════
  // CATÁLOGO — um tipo por contexto documentado da API
  // ══════════════════════════════════════════════════════════
  /* direcao: entrada  = o ERP chama o SplitHub  → credencial de API
              saida    = o SplitHub chama o ERP  → endpoint + segredo
              ambas    = os dois sentidos no mesmo par                */
  var CATALOGO = [
    {
      v: 'ingestao_dfs', nome: 'Ingestão de documentos fiscais',
      direcao: 'entrada', doc: 'ingestao-dfs.html', icone: '⇥',
      resumo: 'O ERP envia os DFs para identificação automática de IBS/CBS. É a porta de entrada de todo o resto do produto.',
      endpoints: [
        'POST /v1/documentos-fiscais',
        'POST /v1/documentos-fiscais/batch',
        'GET /v1/documentos-fiscais/{id}',
        'GET /v1/documentos-fiscais',
        'PATCH /v1/documentos-fiscais/{id}',
        'DELETE /v1/documentos-fiscais/{id}'
      ],
      escopos: [
        { v: 'dfs:write', label: 'Enviar documentos', desc: 'POST individual e em lote' },
        { v: 'dfs:read', label: 'Consultar documentos', desc: 'GET por id e listagem com filtros' },
        { v: 'dfs:manage', label: 'Corrigir e remover', desc: 'PATCH em pending/error e DELETE' }
      ],
      notas: [
        '14 tipos de DF-e aceitos (NF-e, NFC-e, CT-e, MDF-e, NFCom, NFS-e…).',
        'XML assinado ou JSON equivalente aos grupos da NF-e 4.0.',
        'Grupo <code>items[].tax.ibs_cbs</code> obrigatório desde 01/01/2026.',
        'Lote de até 500 documentos; acima disso retorna 400.',
        'Processamento assíncrono: 202 Accepted → pending → processing → completed | error.'
      ],
      exemplo: 'POST /v1/documentos-fiscais'
    },
    {
      v: 'fornecedores', nome: 'Base de fornecedores',
      direcao: 'entrada', doc: 'fornecedores.html', icone: '⇥',
      resumo: 'Mantém a base de fornecedores em dia a partir do cadastro do ERP: CNPJ, contatos, endereços e representantes fiscais.',
      endpoints: [
        'POST /v1/fornecedores',
        'GET /v1/fornecedores',
        'GET /v1/fornecedores/{cnpj}',
        'PATCH /v1/fornecedores/{cnpj}'
      ],
      escopos: [
        { v: 'fornecedores:write', label: 'Criar e atualizar', desc: 'POST e PATCH' },
        { v: 'fornecedores:read', label: 'Consultar', desc: 'GET individual e listagem' }
      ],
      notas: ['O CNPJ é a chave. Reenviar um CNPJ existente atualiza o cadastro.'],
      exemplo: 'POST /v1/fornecedores'
    },
    {
      v: 'contratos', nome: 'Contratos entre CNPJs',
      direcao: 'entrada', doc: 'contratos.html', icone: '⇥',
      resumo: 'Espelha os contratos do ERP: referência, vigência, valor e o método de pagamento — inclusive a opção de RAD que governa a execução automática.',
      endpoints: [
        'POST /v1/contratos',
        'GET /v1/contratos',
        'GET /v1/contratos/{id}',
        'PATCH /v1/contratos/{id}'
      ],
      escopos: [
        { v: 'contratos:write', label: 'Criar e atualizar', desc: 'POST e PATCH' },
        { v: 'contratos:read', label: 'Consultar', desc: 'GET individual e listagem' }
      ],
      notas: ['O <code>contract_id</code> aqui é o mesmo referenciado no envio do DF.'],
      exemplo: 'POST /v1/contratos'
    },
    {
      v: 'rad_erp', nome: 'RAD ↔ ERP',
      direcao: 'ambas', doc: 'rad.html', icone: '⇄',
      resumo: 'Leva ao ERP a guia gerada pela execução do RAD e recebe de volta o comprovante do pagamento. É a conexão que a política de execução automática consome.',
      endpoints: ['POST /v1/rad/proofs'],
      eventos: [
        { v: 'rad.darf_recebida', desc: 'Guia gerada e pronta para pagamento no ERP' },
        { v: 'rad.proof_received', desc: 'Confirmação de que o comprovante foi aceito' }
      ],
      escopos: [
        { v: 'rad:proofs', label: 'Registrar comprovante', desc: 'POST /v1/rad/proofs' }
      ],
      notas: [
        'Retornos possíveis na geração: <code>DARF_GERADO</code>, <code>DFE_NAO_ENCONTRADO</code>, <code>VALOR_PARCIAL_SUPERIOR_DFE</code>.',
        'Guias: IBS 6912 · CBS 5952.',
        'Uma política de execução só emite webhook se apontar para uma conexão deste tipo.'
      ],
      exemplo: 'POST /v1/rad/proofs'
    },
    {
      v: 'garantia_credito', nome: 'Garantia de crédito',
      direcao: 'saida', doc: 'garantia-credito.html', icone: '⇤',
      resumo: 'Avisa o ERP a cada mudança no ciclo de vida de um crédito ou de um débito, para que a contabilização do outro lado acompanhe.',
      eventos: [
        { v: 'credito.status_alterado', desc: 'Inclui compensated_debt_dfe_key quando o crédito é utilizado' },
        { v: 'debito.status_alterado', desc: 'Traz o array utilized_credits com os créditos que abateram o débito' }
      ],
      notas: ['O endpoint precisa responder 200 OK. Sem confirmação, o SplitHub reenvia o evento.'],
      exemplo: 'webhook'
    },
    {
      v: 'automacoes', nome: 'Automações',
      direcao: 'saida', doc: 'automacoes.html', icone: '⇤',
      resumo: 'Notifica a execução das regras de automação — sincronismo com ITSM, cobrança de fornecedor e distribuição de relatórios.',
      endpoints: ['POST /v1/webhooks/automacoes'],
      eventos: [
        { v: 'automation.executed', desc: 'Regra disparada com sucesso' },
        { v: 'automation.failed', desc: 'Traz o detalhe do erro para reprocessamento' }
      ],
      notas: ['A referência completa das regras está marcada como “em breve” na documentação.'],
      exemplo: 'webhook'
    }
  ];
  window.INTG_CATALOGO = CATALOGO;

  function tipoCfg(v) {
    return CATALOGO.filter(function (t) { return t.v === v; })[0] ||
      { v: v, nome: v, direcao: 'saida', icone: '⇤', resumo: '', notas: [] };
  }
  window.intgTipoCfg = tipoCfg;

  var DIRECAO = {
    entrada: { label: 'Entrada', cor: 'var(--teal)', rgb: 'var(--teal-rgb)',
      desc: 'O ERP chama a API do SplitHub' },
    saida: { label: 'Saída', cor: 'var(--blue)', rgb: 'var(--blue-rgb)',
      desc: 'O SplitHub chama o endpoint do ERP' },
    ambas: { label: 'Bidirecional', cor: 'var(--amber)', rgb: 'var(--amber-rgb)',
      desc: 'Webhook de ida e endpoint de volta' }
  };
  window.INTG_DIRECAO = DIRECAO;

  function usaCredencialApi(t) { return t.direcao === 'entrada' || t.direcao === 'ambas'; }
  function usaWebhook(t) { return t.direcao === 'saida' || t.direcao === 'ambas'; }

  // ══════════════════════════════════════════════════════════
  // GERAÇÃO DE CREDENCIAIS (mock)
  // ══════════════════════════════════════════════════════════
  function rnd(n) {
    var a = 'abcdefghijklmnopqrstuvwxyz0123456789', s = '';
    for (var i = 0; i < n; i++) s += a.charAt(Math.floor(Math.random() * a.length));
    return s;
  }
  function pref(amb) { return amb === 'sandbox' ? 'test' : 'live'; }
  function gerarClientId(amb) { return 'shc_' + pref(amb) + '_' + rnd(24); }
  function gerarClientSecret(amb) { return 'shs_' + pref(amb) + '_' + rnd(40); }
  function gerarWebhookSecret(amb) { return 'whsec_' + pref(amb) + '_' + rnd(32); }
  function mascarar(s) {
    if (!s) return '—';
    return s.substring(0, s.lastIndexOf('_') + 5) + '••••••••••••' + s.slice(-4);
  }
  window.intgMascarar = mascarar;

  function hojeBR() {
    var r = window.HOJE_REF || new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return p(r.getDate()) + '/' + p(r.getMonth() + 1) + '/' + r.getFullYear();
  }
  function proximoId() {
    var n = (window._radIntegracoes || []).length + 1;
    return 'INT-' + String(n).padStart(4, '0');
  }

  // ══════════════════════════════════════════════════════════
  // SEED — as conexões existentes ganham tipo; entram as de entrada
  // ══════════════════════════════════════════════════════════
  function prepararSeed() {
    var lista = window._radIntegracoes || (window._radIntegracoes = []);
    if (lista._preparada) return;

    lista.forEach(function (i) {
      if (!i.tipo) i.tipo = 'rad_erp';
      if (!i.ambiente) i.ambiente = /hml|homolog|test/i.test(i.nome + i.token) ? 'sandbox' : 'producao';
      if (!i.clientId) i.clientId = gerarClientId(i.ambiente);
      /* O seed nasceu antes do catálogo, com um token só. Uma conexão
         bidirecional precisa das duas pontas — a de API para o ERP
         chamar /v1/rad/proofs e a de assinatura para o que sai daqui. */
      if (/^sk_/.test(i.token || '')) i.token = mascarar(gerarClientSecret(i.ambiente));
      if (!i.tokenWebhook && tipoCfg(i.tipo).direcao === 'ambas') {
        i.tokenWebhook = mascarar(gerarWebhookSecret(i.ambiente));
      }
      if (!i.escopos) i.escopos = ['rad:proofs'];
      if (!i.criadoEm) i.criadoEm = i.tokenCriadoEm;
      if (!i.criadoPor) i.criadoPor = 'Carga inicial';
      if (!i.cnpjs) i.cnpjs = [];
      if (!i.chamadas) i.chamadas = 0;
    });

    /* Conexões de entrada — o contexto que faltava. A primeira é o
       caso que o cliente descreveu: importação de DFs com chave. */
    lista.push({
      id: 'INT-0004', tipo: 'ingestao_dfs', nome: 'Protheus — Ingestão de DFs (matriz)',
      ambiente: 'producao', direcaoNota: '',
      clientId: 'shc_live_a71f39c2d840be15702c',
      token: 'shs_live_2e9c••••••••••••41ab', tokenCriadoEm: '02/07/2026',
      escopos: ['dfs:write', 'dfs:read'],
      cnpjs: ['54.891.237/0001-48', '54.891.237/0002-29'],
      eventos: [], webhookUrl: '',
      ativo: true, ultimaEntrega: '08/09/2026 05:12',
      chamadas: 18447, entregas: 0, falhas: 0, errosApi: 63,
      criadoEm: '02/07/2026', criadoPor: 'Marina Costa', historico: []
    });
    lista.push({
      id: 'INT-0005', tipo: 'ingestao_dfs', nome: 'Protheus — Ingestão de DFs (sandbox)',
      ambiente: 'sandbox',
      clientId: 'shc_test_66b0e4915cc7038adf12',
      token: 'shs_test_c104••••••••••••9f7d', tokenCriadoEm: '02/07/2026',
      escopos: ['dfs:write', 'dfs:read', 'dfs:manage'],
      cnpjs: [], eventos: [], webhookUrl: '',
      ativo: true, ultimaEntrega: '05/09/2026 16:40',
      chamadas: 912, entregas: 0, falhas: 0, errosApi: 148,
      criadoEm: '02/07/2026', criadoPor: 'Marina Costa', historico: []
    });
    lista.push({
      id: 'INT-0006', tipo: 'garantia_credito', nome: 'Contabilidade — status de crédito',
      ambiente: 'producao',
      webhookUrl: 'https://erp.induspar.com.br/hooks/splithub/credito',
      token: 'whsec_live_8d22••••••••••••06ce', tokenCriadoEm: '14/08/2026',
      eventos: ['credito.status_alterado', 'debito.status_alterado'],
      escopos: [], cnpjs: [],
      ativo: true, ultimaEntrega: '08/09/2026 03:20',
      entregas: 2310, falhas: 8, chamadas: 0,
      criadoEm: '14/08/2026', criadoPor: 'Marina Costa', historico: []
    });

    lista._preparada = true;
  }

  // ══════════════════════════════════════════════════════════
  // T-09 — LISTA DE CONEXÕES
  // ══════════════════════════════════════════════════════════
  function chip(txt, cor, rgb, mono) {
    return '<span style="font-size:10px;' + (mono ? 'font-family:var(--font-mono);' : 'font-weight:600;') +
      'padding:2px 7px;border-radius:4px;background:rgba(' + rgb + ',.1);color:' + cor +
      ';border:1px solid rgba(' + rgb + ',.22)">' + txt + '</span>';
  }

  function mono(v) { return '<span style="font-family:var(--font-mono);color:var(--txt2)">' + v + '</span>'; }

  /* Uma conexão bidirecional carrega DUAS credenciais, e elas não se
     substituem: a de API autentica o ERP quando ele chama
     POST /v1/rad/proofs; a de webhook assina o que o SplitHub envia. */
  function linhaSegredo(i) {
    var t = tipoCfg(i.tipo), p = [];
    if (usaCredencialApi(t)) {
      if (i.clientId) p.push('client_id ' + mono(i.clientId));
      p.push('client_secret ' + mono(i.token));
    }
    if (usaWebhook(t)) p.push('signing secret ' + mono(t.direcao === 'ambas' ? (i.tokenWebhook || '—') : i.token));
    p.push('emitido em ' + i.tokenCriadoEm);
    return '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:9px;font-size:11px;color:var(--txt3);align-items:center">' +
      p.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>';
  }

  function metricas(i, t) {
    if (usaCredencialApi(t) && t.direcao === 'entrada') {
      var err = i.errosApi || 0, tot = i.chamadas || 0;
      var taxa = tot ? (100 - (err / tot) * 100) : null;
      var cor = taxa === null ? 'var(--txt3)' : taxa >= 99 ? 'var(--green)' : taxa >= 95 ? 'var(--amber)' : 'var(--red)';
      return { rotulo: 'Aceite das chamadas',
        valor: taxa === null ? 'sem tráfego' : taxa.toFixed(1).replace('.', ',') + '%',
        cor: cor, sub: tot.toLocaleString('pt-BR') + ' chamadas · ' + err + ' com erro' };
    }
    var s = window.radSaudeIntegracao(i);
    return { rotulo: 'Taxa de entrega', valor: s.label, cor: s.cor,
      sub: (i.entregas || 0) + ' envios · ' + (i.falhas || 0) + ' falhas' };
  }

  function cartao(i) {
    var t = tipoCfg(i.tipo);
    var d = DIRECAO[t.direcao];
    var m = metricas(i, t);
    var vinculadas = (window._radPoliticas || []).filter(function (p) { return p.integracaoId === i.id; });
    var eventos = i.eventos || [], escopos = i.escopos || [];

    var acoes = [];
    if (usaWebhook(t)) acoes.push('<button class="btn" style="font-size:11px;padding:5px 12px" onclick="radTestarConexao(\'' + i.id + '\')">Testar conexão</button>');
    if (t.direcao === 'ambas') {
      acoes.push('<button class="btn" style="font-size:11px;padding:5px 12px" onclick="intgRotacionar(\'' + i.id + '\',\'api\')">Rotacionar client_secret</button>');
      acoes.push('<button class="btn" style="font-size:11px;padding:5px 12px" onclick="intgRotacionar(\'' + i.id + '\',\'webhook\')">Rotacionar signing secret</button>');
    } else {
      acoes.push('<button class="btn" style="font-size:11px;padding:5px 12px" onclick="intgRotacionar(\'' + i.id + '\')">Rotacionar segredo</button>');
    }
    if (i.tipo === 'rad_erp') acoes.push('<button class="btn" style="font-size:11px;padding:5px 12px" onclick="radVerVinculados(\'' + i.id + '\')">Políticas vinculadas (' + vinculadas.length + ')</button>');
    acoes.push('<a class="btn" style="font-size:11px;padding:5px 12px;text-decoration:none;display:inline-block" href="' + DOC_BASE + t.doc + '" target="_blank" rel="noopener">Documentação ↗</a>');
    acoes.push('<button class="btn" style="font-size:11px;padding:5px 12px;margin-left:auto" onclick="radToggleIntegracao(\'' + i.id + '\')">' + (i.ativo ? 'Desativar' : 'Ativar') + '</button>');

    return '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px 18px;margin-bottom:12px">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
      '<div style="flex:1;min-width:240px">' +
      '<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">' +
      '<span style="font-size:14px;font-weight:700;color:var(--txt1)">' + i.nome + '</span>' +
      (i.ativo ? badge('Ativa', 'var(--green)', 'var(--status-green-rgb)')
               : badge('Inativa', 'var(--txt3)', 'var(--status-gray-rgb)')) +
      (i.ambiente === 'sandbox' ? badge('Sandbox', 'var(--amber)', 'var(--status-amber-rgb)') : '') +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;align-items:center">' +
      chip(d.icone || t.icone, d.cor, d.rgb) + chip(t.nome, d.cor, d.rgb) +
      '<span style="font-size:10.5px;color:var(--txt3)">' + d.desc + '</span></div>' +
      (i.webhookUrl ? '<div style="font-size:11px;color:var(--txt2);font-family:var(--font-mono);margin-top:8px;word-break:break-all">' +
        i.webhookUrl + '</div>' : '') +
      linhaSegredo(i) +
      '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px">' +
        eventos.map(function (e) { return chip(e, 'var(--blue)', 'var(--blue-rgb)', true); }).join('') +
        escopos.map(function (e) { return chip(e, 'var(--teal)', 'var(--teal-rgb)', true); }).join('') +
      '</div>' +
      (i.cnpjs && i.cnpjs.length
        ? '<div style="font-size:10.5px;color:var(--txt3);margin-top:8px">Escopo: ' + i.cnpjs.length +
          ' CNPJ(s) — ' + i.cnpjs.join(' · ') + '</div>'
        : (usaCredencialApi(t) ? '<div style="font-size:10.5px;color:var(--txt3);margin-top:8px">Escopo: todos os CNPJs da organização</div>' : '')) +
      '</div>' +
      '<div style="text-align:right;min-width:150px">' +
      '<div style="font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.06em">' + m.rotulo + '</div>' +
      '<div style="font-size:19px;font-weight:800;color:' + m.cor + ';margin-top:2px">' + m.valor + '</div>' +
      '<div style="font-size:10.5px;color:var(--txt3);margin-top:2px">' + m.sub + '</div>' +
      '<div style="font-size:10.5px;color:var(--txt3);margin-top:4px">Última: ' + i.ultimaEntrega + '</div>' +
      '</div></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">' +
      acoes.join('') + '</div>' +
      '<div id="rad-teste-' + i.id + '" style="display:none;margin-top:10px;font-size:11.5px;padding:9px 12px;border-radius:6px"></div>' +
      '</div>';
  }

  window.radConexoesRender = function () {
    var wrap = el('rad-conexoes-lista');
    if (!wrap) return;
    prepararSeed();

    var lista = window._radIntegracoes || [];
    var fTipo = (el('intg-f-tipo') || {}).value || '';
    var fDir = (el('intg-f-direcao') || {}).value || '';
    var fAmb = (el('intg-f-ambiente') || {}).value || '';

    var vis = lista.filter(function (i) {
      var t = tipoCfg(i.tipo);
      return (!fTipo || i.tipo === fTipo) && (!fDir || t.direcao === fDir) && (!fAmb || i.ambiente === fAmb);
    });

    // Contagem por direção, para dar a medida do que existe hoje
    var porDir = { entrada: 0, saida: 0, ambas: 0 };
    lista.forEach(function (i) { porDir[tipoCfg(i.tipo).direcao]++; });

    var resumo = '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">' +
      Object.keys(DIRECAO).map(function (k) {
        var d = DIRECAO[k];
        return '<div style="flex:1;min-width:150px;background:var(--card);border:1px solid var(--border);' +
          'border-left:3px solid ' + d.cor + ';border-radius:8px;padding:11px 14px">' +
          '<div style="font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.06em">' + d.label + '</div>' +
          '<div style="font-size:20px;font-weight:800;color:var(--txt1);margin-top:2px">' + porDir[k] + '</div>' +
          '<div style="font-size:10.5px;color:var(--txt3)">' + d.desc + '</div></div>';
      }).join('') + '</div>';

    var vazio = '<div style="text-align:center;color:var(--txt3);padding:28px;font-size:13px">' +
      'Nenhuma conexão com esses filtros.</div>';

    wrap.innerHTML = resumo + (vis.length ? vis.map(cartao).join('') : vazio);
  };

  window.intgFiltrar = function () { window.radConexoesRender(); };

  // ══════════════════════════════════════════════════════════
  // Ações sobre uma conexão
  // ══════════════════════════════════════════════════════════
  function porId(id) {
    return (window._radIntegracoes || []).filter(function (i) { return i.id === id; })[0] || null;
  }

  window.intgRotacionar = function (id, qual) {
    var i = porId(id); if (!i) return;
    var t = tipoCfg(i.tipo);
    if (!qual) qual = usaCredencialApi(t) ? 'api' : 'webhook';
    var novo = qual === 'api' ? gerarClientSecret(i.ambiente) : gerarWebhookSecret(i.ambiente);
    if (qual === 'api') i.token = mascarar(novo); else if (t.direcao === 'ambas') i.tokenWebhook = mascarar(novo); else i.token = mascarar(novo);
    i.tokenCriadoEm = hojeBR();
    telaSegredo(i, qual === 'api' ? novo : null, 'rotacao', qual === 'api' ? null : novo);
  };

  window.radVerVinculados = function (id) {
    var vinc = (window._radPoliticas || []).filter(function (p) { return p.integracaoId === id; });
    if (!vinc.length) return window.radToast('Nenhuma política usa esta conexão.');
    var nomes = vinc.map(function (p) {
      return (p.nome || p.id) + ' — ' + window.radOrqCfg(p.orquestracao).label.toLowerCase() +
        ': ' + window.radCoberturaTexto(p) + ' (' + window.radModoCfg(p.modo).label + ')';
    }).join('\n');
    alert('Políticas que entregam por esta conexão:\n\n' + nomes);
  };

  window.radToggleIntegracao = function (id) {
    var i = porId(id); if (!i) return;
    var vinc = (window._radPoliticas || []).filter(function (p) { return p.integracaoId === id && p.ativo; });
    if (i.ativo && vinc.length) {
      if (!confirm('Esta conexão é usada por ' + vinc.length + ' política(s) ativa(s). ' +
                   'Desativar interrompe a entrega das guias desses CNPJs. Continuar?')) return;
    }
    i.ativo = !i.ativo;
    window.radConexoesRender();
    window.radToast('Conexão ' + (i.ativo ? 'ativada' : 'desativada') + '.');
  };

  /* Testar conexão — só faz sentido onde o SplitHub é quem chama.
     Sem sandbox documentado, o teste usa dfe_key fictícia. */
  window.radTestarConexao = function (id) {
    var i = porId(id); if (!i) return;
    var box = el('rad-teste-' + id); if (!box) return;
    var ev = (i.eventos && i.eventos[0]) || 'rad.darf_recebida';
    box.style.display = 'block';
    box.style.background = 'rgba(var(--blue-rgb),.08)';
    box.style.border = '1px solid rgba(var(--blue-rgb),.22)';
    box.style.color = 'var(--txt2)';
    box.innerHTML = 'Enviando evento de teste para <span style="font-family:var(--font-mono)">' + i.webhookUrl + '</span>…';
    setTimeout(function () {
      var ok = i.ativo && (i.falhas || 0) / (i.entregas || 1) < 0.15;
      box.style.background = ok ? 'rgba(var(--status-green-rgb),.08)' : 'rgba(var(--status-red-rgb),.08)';
      box.style.border = '1px solid rgba(' + (ok ? 'var(--status-green-rgb)' : 'var(--status-red-rgb)') + ',.25)';
      box.style.color = ok ? 'var(--green)' : 'var(--red)';
      box.innerHTML = ok
        ? '<strong>200 OK</strong> — evento <span style="font-family:var(--font-mono)">' + ev + '</span> ' +
          'aceito com payload fictício. Conexão apta.'
        : '<strong>504 Gateway Timeout</strong> — o endpoint não respondeu. ' +
          'Verifique a URL e se o ERP aceita POST sem autenticação de origem.';
    }, 700);
  };

  // ══════════════════════════════════════════════════════════
  // T-09 — ASSISTENTE DE NOVA CONEXÃO
  // ══════════════════════════════════════════════════════════
  var wz = null;   // rascunho corrente
  var IS = 'width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 11px;' +
    'color:var(--txt1);font-size:13px;font-family:inherit;box-sizing:border-box;outline:none';

  function bloco(titulo, conteudo) {
    return '<div style="margin-bottom:20px">' +
      '<div style="font-size:10px;font-weight:700;color:var(--txt3);text-transform:uppercase;' +
      'letter-spacing:.07em;margin-bottom:9px">' + titulo + '</div>' + conteudo + '</div>';
  }
  function campo(lbl, inp, hint) {
    return '<div style="margin-bottom:12px">' +
      '<label style="display:block;font-size:11px;font-weight:600;color:var(--txt2);margin-bottom:5px">' + lbl + '</label>' +
      inp + (hint ? '<div style="font-size:10.5px;color:var(--txt3);margin-top:4px">' + hint + '</div>' : '') + '</div>';
  }
  function passos(n) {
    var nomes = ['Tipo de conexão', 'Configuração', 'Credenciais'];
    return '<div style="display:flex;gap:6px;margin-top:12px">' + nomes.map(function (t, k) {
      var at = k + 1 === n, feito = k + 1 < n;
      return '<div style="flex:1;padding-top:7px;border-top:2px solid ' +
        (at ? 'var(--teal)' : feito ? 'rgba(var(--teal-rgb),.4)' : 'var(--border)') + '">' +
        '<div style="font-size:10px;font-weight:700;color:' + (at ? 'var(--teal)' : 'var(--txt3)') + '">' +
        (k + 1) + '. ' + t + '</div></div>';
    }).join('') + '</div>';
  }

  function abrirDrawer(titulo, sub, corpo, rodape, largura) {
    fechar();
    var d = document.createElement('div');
    d.id = 'intg-wz-overlay';
    d.setAttribute('onclick', 'if(event.target===this)intgFecharWizard()');
    d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9300;display:flex;justify-content:flex-end';
    d.innerHTML = '<div style="background:var(--card);border-left:1px solid var(--border);width:' + (largura || 560) +
      'px;max-width:96vw;height:100vh;overflow-y:auto;display:flex;flex-direction:column">' +
      '<div style="padding:20px 24px 14px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--card);z-index:2">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">' +
      '<div><div style="font-size:16px;font-weight:700;color:var(--txt1)">' + titulo + '</div>' +
      '<div style="font-size:11.5px;color:var(--txt3);margin-top:3px">' + sub + '</div></div>' +
      '<button onclick="intgFecharWizard()" style="background:none;border:none;color:var(--txt3);font-size:20px;' +
      'cursor:pointer;line-height:1;padding:0 2px">×</button></div>' + (rodape || '') + '</div>' +
      '<div id="intg-wz-corpo" style="padding:20px 24px;flex:1">' + corpo + '</div></div>';
    document.body.appendChild(d);
  }
  function fechar() {
    var o = el('intg-wz-overlay'); if (o) o.remove();
  }
  window.intgFecharWizard = function () { fechar(); wz = null; window.radConexoesRender(); };

  // ── Passo 1: catálogo ──
  window.intgNova = function () {
    var grupos = [
      { d: 'entrada', t: 'Entrada — o ERP chama o SplitHub',
        n: 'Gera <strong>client_id</strong> e <strong>client_secret</strong>, trocados por um JWT em <code>POST /v1/auth/login</code>.' },
      { d: 'ambas', t: 'Bidirecional',
        n: 'Gera as duas pontas: o segredo de assinatura do webhook e o escopo de retorno.' },
      { d: 'saida', t: 'Saída — o SplitHub chama o ERP',
        n: 'Pede a URL do endpoint e gera o segredo de assinatura dos eventos.' }
    ];

    var corpo = grupos.map(function (g) {
      var itens = CATALOGO.filter(function (t) { return t.direcao === g.d; });
      var d = DIRECAO[g.d];
      return '<div style="margin-bottom:22px">' +
        '<div style="font-size:11.5px;font-weight:700;color:' + d.cor + ';margin-bottom:3px">' + g.t + '</div>' +
        '<div style="font-size:11px;color:var(--txt3);margin-bottom:10px;line-height:1.5">' + g.n + '</div>' +
        itens.map(function (t) {
          var linhas = (t.endpoints || []).concat((t.eventos || []).map(function (e) { return e.v; }));
          return '<button type="button" onclick="intgWizTipo(\'' + t.v + '\')" ' +
            'style="display:block;width:100%;text-align:left;background:var(--bg);border:1px solid var(--border);' +
            'border-radius:8px;padding:12px 14px;margin-bottom:8px;cursor:pointer;font-family:inherit" ' +
            'onmouseover="this.style.borderColor=\'' + d.cor + '\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
            '<div style="display:flex;align-items:center;gap:8px">' +
            '<span style="font-size:14px;color:' + d.cor + '">' + t.icone + '</span>' +
            '<span style="font-size:13px;font-weight:700;color:var(--txt1)">' + t.nome + '</span></div>' +
            '<div style="font-size:11px;color:var(--txt2);margin-top:5px;line-height:1.5">' + t.resumo + '</div>' +
            '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:8px">' +
            linhas.slice(0, 4).map(function (l) { return chip(l, d.cor, d.rgb, true); }).join('') +
            (linhas.length > 4 ? '<span style="font-size:10px;color:var(--txt3);padding:2px 4px">+' + (linhas.length - 4) + '</span>' : '') +
            '</div></button>';
        }).join('') + '</div>';
    }).join('');

    abrirDrawer('Nova conexão', 'O tipo define o que a plataforma pede e o que ela emite.',
      corpo, passos(1), 600);
  };

  // ── Passo 2: configuração ──
  window.intgWizTipo = function (v) {
    var t = tipoCfg(v);
    /* Marca por padrão tudo que a integração normal exige. Fica de fora
       só o escopo destrutivo (:manage), que precisa de escolha explícita
       — a ingestão é assíncrona, então ler o status é parte do fluxo. */
    wz = { tipo: v, ambiente: 'producao', nome: '', webhookUrl: '',
           eventos: (t.eventos || []).map(function (e) { return e.v; }),
           escopos: (t.escopos || []).filter(function (e) { return e.v.indexOf(':manage') < 0; })
                      .map(function (e) { return e.v; }),
           cnpjs: [] };
    if (!wz.escopos.length && (t.escopos || []).length) wz.escopos = [t.escopos[0].v];
    renderPasso2();
  };

  function renderPasso2() {
    var t = tipoCfg(wz.tipo);
    var d = DIRECAO[t.direcao];

    var ambiente = '<div style="display:flex;gap:8px">' +
      [['producao', 'Produção', 'Chaves com prefixo live. Contam para os limites da conta.'],
       ['sandbox', 'Sandbox', 'Prefixo test. Os documentos não geram crédito nem guia real.']]
      .map(function (a) {
        var sel = wz.ambiente === a[0];
        return '<label style="flex:1;padding:10px 12px;border-radius:7px;cursor:pointer;' +
          'border:1px solid ' + (sel ? 'var(--teal)' : 'var(--border)') + ';' +
          'background:' + (sel ? 'rgba(var(--teal-rgb),.08)' : 'transparent') + '">' +
          '<div style="display:flex;align-items:center;gap:7px">' +
          '<input type="radio" name="intg-amb" value="' + a[0] + '"' + (sel ? ' checked' : '') +
          ' onchange="intgWizCampo(\'ambiente\',this.value)">' +
          '<span style="font-size:12.5px;font-weight:700;color:var(--txt1)">' + a[1] + '</span></div>' +
          '<div style="font-size:10.5px;color:var(--txt3);margin-top:4px;line-height:1.45">' + a[2] + '</div></label>';
      }).join('') + '</div>';

    var caixa = 'max-height:150px;overflow-y:auto;border:1px solid var(--border);border-radius:7px;padding:8px 10px;background:var(--bg)';

    var escoposHtml = '';
    if (usaCredencialApi(t) && (t.escopos || []).length) {
      escoposHtml = bloco('Escopos da credencial',
        '<div style="' + caixa + '">' + t.escopos.map(function (e) {
          var on = wz.escopos.indexOf(e.v) >= 0;
          return '<label style="display:flex;gap:8px;align-items:flex-start;padding:5px 0;cursor:pointer">' +
            '<input type="checkbox"' + (on ? ' checked' : '') + ' onchange="intgWizLista(\'escopos\',\'' + e.v + '\',this.checked)" style="margin-top:3px">' +
            '<span><span style="font-size:12px;color:var(--txt1)">' + e.label + '</span> ' +
            '<span style="font-family:var(--font-mono);font-size:10.5px;color:var(--teal)">' + e.v + '</span>' +
            '<div style="font-size:10.5px;color:var(--txt3)">' + e.desc + '</div></span></label>';
        }).join('') + '</div>' +
        '<div style="font-size:10.5px;color:var(--txt3);margin-top:6px">O JWT emitido carrega só os escopos marcados. Chamada fora do escopo retorna <code>403</code>.</div>');
    }

    var webhookHtml = '';
    if (usaWebhook(t)) {
      webhookHtml = bloco('Endpoint de destino',
        campo('URL do webhook',
          '<input id="intg-wz-url" value="' + (wz.webhookUrl || '') + '" placeholder="https://erp.suaempresa.com.br/hooks/splithub" ' +
          'oninput="intgWizCampo(\'webhookUrl\',this.value)" style="' + IS + '">',
          'HTTPS obrigatório. O endpoint precisa responder <code>200 OK</code> — sem isso o SplitHub reenvia o evento.') +
        '<div style="' + caixa + '">' + (t.eventos || []).map(function (e) {
          var on = wz.eventos.indexOf(e.v) >= 0;
          return '<label style="display:flex;gap:8px;align-items:flex-start;padding:5px 0;cursor:pointer">' +
            '<input type="checkbox"' + (on ? ' checked' : '') + ' onchange="intgWizLista(\'eventos\',\'' + e.v + '\',this.checked)" style="margin-top:3px">' +
            '<span><span style="font-family:var(--font-mono);font-size:11px;color:var(--blue)">' + e.v + '</span>' +
            '<div style="font-size:10.5px;color:var(--txt3)">' + e.desc + '</div></span></label>';
        }).join('') + '</div>');
    }

    var orgs = window._orgCnpjs || [];
    var cnpjHtml = bloco('Escopo por CNPJ',
      '<div style="' + caixa + '">' +
      (orgs.length ? orgs.map(function (o) {
        var on = wz.cnpjs.indexOf(o.cnpj) >= 0;
        return '<label style="display:flex;gap:8px;align-items:center;padding:4px 0;cursor:pointer">' +
          '<input type="checkbox"' + (on ? ' checked' : '') + ' onchange="intgWizLista(\'cnpjs\',\'' + o.cnpj + '\',this.checked)">' +
          '<span style="font-size:11.5px;color:var(--txt1)">' + o.razao +
          ' <span style="font-family:var(--font-mono);color:var(--txt3)">' + o.cnpj + '</span></span></label>';
      }).join('') : '<div style="font-size:11px;color:var(--txt3)">Nenhum CNPJ carregado.</div>') + '</div>' +
      '<div style="font-size:10.5px;color:var(--txt3);margin-top:6px">Nenhum marcado = a conexão vale para todos os CNPJs da organização.</div>');

    var notas = (t.notas || []).length
      ? '<div style="background:rgba(var(--blue-rgb),.06);border:1px solid rgba(var(--blue-rgb),.2);border-radius:8px;padding:12px 14px;margin-bottom:20px">' +
        '<div style="font-size:10px;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px">' +
        'O que a documentação define</div>' +
        '<ul style="margin:0;padding-left:16px;font-size:11px;color:var(--txt2);line-height:1.65">' +
        t.notas.map(function (n) { return '<li>' + n + '</li>'; }).join('') + '</ul>' +
        '<a href="' + DOC_BASE + t.doc + '" target="_blank" rel="noopener" ' +
        'style="font-size:11px;color:var(--blue);display:inline-block;margin-top:8px">Referência completa ↗</a></div>'
      : '';

    var corpo =
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">' +
      '<span style="font-size:15px;color:' + d.cor + '">' + t.icone + '</span>' +
      '<span style="font-size:13.5px;font-weight:700;color:var(--txt1)">' + t.nome + '</span>' +
      chip(d.label, d.cor, d.rgb) +
      '<button class="btn" style="font-size:10.5px;padding:3px 9px;margin-left:auto" onclick="intgNova()">Trocar tipo</button></div>' +
      notas +
      bloco('Identificação',
        campo('Nome da conexão',
          '<input id="intg-wz-nome" value="' + (wz.nome || '') + '" placeholder="ERP Protheus — Matriz PR" ' +
          'oninput="intgWizCampo(\'nome\',this.value)" style="' + IS + '">',
          'Aparece no log de entregas e no seletor da política de execução.') +
        ambiente) +
      escoposHtml + webhookHtml + cnpjHtml +
      '<div id="intg-wz-msg" style="font-size:11.5px;margin-bottom:12px;min-height:16px"></div>' +
      '<div style="display:flex;gap:8px">' +
      '<button class="btn" style="flex:1" onclick="intgNova()">Voltar</button>' +
      '<button class="btn primary" style="flex:2" onclick="intgWizCriar()">Criar conexão e emitir credenciais</button></div>';

    abrirDrawer('Nova conexão', 'Passo 2 — o que esta conexão pode fazer.', corpo, passos(2), 600);
  }

  window.intgWizCampo = function (k, v) { if (wz) wz[k] = v; };
  window.intgWizLista = function (k, v, on) {
    if (!wz) return;
    var a = wz[k] || (wz[k] = []);
    var idx = a.indexOf(v);
    if (on && idx < 0) a.push(v);
    if (!on && idx >= 0) a.splice(idx, 1);
  };

  function msg(txt, cor) {
    var m = el('intg-wz-msg'); if (m) { m.textContent = txt; m.style.color = cor || 'var(--red)'; }
  }

  // ── Passo 3: credenciais, exibidas uma única vez ──
  window.intgWizCriar = function () {
    if (!wz) return;
    var t = tipoCfg(wz.tipo);
    if (!(wz.nome || '').trim()) return msg('Informe um nome para a conexão.');
    if (usaWebhook(t)) {
      if (!/^https:\/\/.+/.test(wz.webhookUrl || '')) return msg('A URL do webhook precisa começar com https://');
      if (!wz.eventos.length) return msg('Selecione ao menos um evento.');
    }
    if (usaCredencialApi(t) && (t.escopos || []).length && !wz.escopos.length) {
      return msg('Selecione ao menos um escopo.');
    }

    var segredo = usaCredencialApi(t) ? gerarClientSecret(wz.ambiente) : gerarWebhookSecret(wz.ambiente);
    var segredoWh = t.direcao === 'ambas' ? gerarWebhookSecret(wz.ambiente) : null;
    var conexao = {
      id: proximoId(), tipo: wz.tipo, nome: wz.nome.trim(), ambiente: wz.ambiente,
      clientId: usaCredencialApi(t) ? gerarClientId(wz.ambiente) : '',
      token: mascarar(segredo), tokenWebhook: segredoWh ? mascarar(segredoWh) : '',
      tokenCriadoEm: hojeBR(),
      escopos: wz.escopos.slice(), eventos: wz.eventos.slice(),
      webhookUrl: wz.webhookUrl || '', cnpjs: wz.cnpjs.slice(),
      ativo: true, ultimaEntrega: '—', entregas: 0, falhas: 0, chamadas: 0, errosApi: 0,
      criadoEm: hojeBR(), criadoPor: window.CONTRATO_USUARIO_ATUAL || 'José da Silva',
      historico: []
    };
    (window._radIntegracoes || []).push(conexao);
    telaSegredo(conexao, segredo, 'criacao', segredoWh);
  };

  function caixaSegredo(rotulo, valor, revelavel) {
    var uid = 'sec-' + Math.random().toString(36).slice(2, 8);
    return '<div style="margin-bottom:12px">' +
      '<div style="font-size:10px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">' +
      rotulo + '</div>' +
      '<div style="display:flex;gap:8px;align-items:stretch">' +
      '<code id="' + uid + '" style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:6px;' +
      'padding:9px 11px;font-family:var(--font-mono);font-size:11.5px;color:' +
      (revelavel ? 'var(--amber)' : 'var(--txt1)') + ';word-break:break-all;line-height:1.5">' + valor + '</code>' +
      '<button class="btn" style="font-size:11px;padding:5px 12px;white-space:nowrap" ' +
      'onclick="intgCopiar(\'' + uid + '\',this)">Copiar</button></div></div>';
  }

  window.intgCopiar = function (uid, btn) {
    var e = el(uid); if (!e) return;
    var txt = e.textContent;
    var ok = function () { if (btn) { btn.textContent = 'Copiado'; setTimeout(function () { btn.textContent = 'Copiar'; }, 1600); } };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(ok, function () { fallback(txt, ok); });
    } else fallback(txt, ok);
  };
  function fallback(txt, ok) {
    var ta = document.createElement('textarea');
    ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); ok(); } catch (e) {}
    document.body.removeChild(ta);
  }

  function exemploCurl(c, segredo, api) {
    var t = tipoCfg(c.tipo);
    if (api) {
      return '# 1. troca as credenciais por um JWT (expira em 3600s)\n' +
        'curl -X POST ' + API_BASE + '/v1/auth/login \\\n' +
        '  -H \'Content-Type: application/json\' \\\n' +
        '  -d \'{"client_id":"' + c.clientId + '",\n' +
        '       "client_secret":"' + segredo + '"}\'\n\n' +
        '# 2. usa o access_token nas chamadas\n' +
        'curl -X POST ' + API_BASE + '/' + (t.exemplo || '').replace(/^\w+\s+\//, '') + ' \\\n' +
        '  -H "Authorization: Bearer $ACCESS_TOKEN" \\\n' +
        '  -H \'Content-Type: application/json\' \\\n' +
        '  --data-binary @documento.json';
    }
    return '# o SplitHub assina cada envio com este segredo\n' +
      '# header:  X-SplitHub-Signature: t=<unix>,v1=<hmac_sha256>\n' +
      '# base:    <t> + "." + <corpo bruto da requisição>\n\n' +
      'openssl dgst -sha256 -hmac "' + segredo + '" \\\n' +
      '  <<< "$TIMESTAMP.$RAW_BODY"';
  }

  function telaSegredo(c, segredo, origem, segredoWh) {
    var t = tipoCfg(c.tipo);
    var api = usaCredencialApi(t) && !!segredo;
    var criou = origem === 'criacao';

    var alerta = '<div style="background:rgba(var(--status-amber-rgb),.09);border:1px solid rgba(var(--status-amber-rgb),.28);' +
      'border-radius:8px;padding:12px 14px;margin-bottom:18px">' +
      '<div style="font-size:11.5px;font-weight:700;color:var(--amber);margin-bottom:5px">' +
      'Copie agora — este valor não volta a ser exibido</div>' +
      '<div style="font-size:11px;color:var(--txt2);line-height:1.6">A plataforma guarda apenas o hash. ' +
      'Fechando esta tela, o painel passa a mostrar só os quatro últimos caracteres. ' +
      'Se perder, o caminho é rotacionar — o que invalida o valor anterior.</div></div>';

    var assinatura = segredoWh || !api
      ? '<div style="background:rgba(var(--status-red-rgb),.07);border:1px solid rgba(var(--status-red-rgb),.22);' +
        'border-radius:8px;padding:11px 14px;margin-bottom:18px">' +
        '<div style="font-size:10px;font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">' +
        'Proposto — ainda não está na API publicada</div>' +
        '<div style="font-size:11px;color:var(--txt2);line-height:1.6">A documentação de webhooks não define verificação de assinatura. ' +
        'Sem ela, qualquer origem que descubra a URL pode forjar um evento. ' +
        'Este segredo modela o header <code>X-SplitHub-Signature</code> que o time precisa especificar.</div></div>'
      : '';

    var rotacao = !criou
      ? '<div style="background:rgba(var(--blue-rgb),.07);border:1px solid rgba(var(--blue-rgb),.2);border-radius:8px;' +
        'padding:11px 14px;margin-bottom:18px;font-size:11px;color:var(--txt2);line-height:1.6">' +
        'O segredo anterior continua aceito por <strong>24 horas</strong>, para dar janela de troca sem derrubar a integração.</div>'
      : '';

    var rodapeCnpj = (c.cnpjs && c.cnpjs.length)
      ? c.cnpjs.length + ' CNPJ(s) no escopo'
      : 'todos os CNPJs da organização';

    var corpo = alerta + assinatura + rotacao +
      (api ? caixaSegredo('client_id', c.clientId, false) : '') +
      (segredo ? caixaSegredo(api ? 'client_secret' : 'signing secret', segredo, true) : '') +
      (segredoWh ? caixaSegredo('signing secret — assina os eventos enviados ao ERP', segredoWh, true) : '') +
      bloco('Resumo da conexão',
        '<div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px 14px;' +
        'font-size:11.5px;color:var(--txt2);line-height:1.85">' +
        '<div><span style="color:var(--txt3)">Tipo</span> · ' + t.nome + '</div>' +
        '<div><span style="color:var(--txt3)">Ambiente</span> · ' + (c.ambiente === 'sandbox' ? 'Sandbox' : 'Produção') + '</div>' +
        (c.webhookUrl ? '<div><span style="color:var(--txt3)">Destino</span> · <span style="font-family:var(--font-mono);font-size:10.5px">' + c.webhookUrl + '</span></div>' : '') +
        ((c.escopos || []).length ? '<div><span style="color:var(--txt3)">Escopos</span> · <span style="font-family:var(--font-mono);font-size:10.5px">' + c.escopos.join(' · ') + '</span></div>' : '') +
        ((c.eventos || []).length ? '<div><span style="color:var(--txt3)">Eventos</span> · <span style="font-family:var(--font-mono);font-size:10.5px">' + c.eventos.join(' · ') + '</span></div>' : '') +
        '<div><span style="color:var(--txt3)">Escopo</span> · ' + rodapeCnpj + '</div>' +
        '</div>') +
      bloco('Primeira chamada',
        '<pre style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px 14px;' +
        'overflow-x:auto;font-family:var(--font-mono);font-size:10.5px;color:var(--txt2);line-height:1.7;margin:0;' +
        'white-space:pre">' + exemploCurl(c, api ? segredo : (segredoWh || segredo), api).replace(/</g, '&lt;') + '</pre>') +
      '<button class="btn primary" style="width:100%" onclick="intgFecharWizard()">' +
      (criou ? 'Já copiei — concluir' : 'Já copiei — fechar') + '</button>';

    abrirDrawer(criou ? 'Conexão criada' : 'Segredo rotacionado',
      criou ? c.id + ' · ' + c.nome : c.nome, corpo, criou ? passos(3) : '', 600);
  }

  // ══════════════════════════════════════════════════════════
  // Inicialização
  // ══════════════════════════════════════════════════════════
  window.intgInit = function () {
    prepararSeed();
    var sel = el('intg-f-tipo');
    if (sel && sel.options.length <= 1) {
      CATALOGO.forEach(function (t) {
        var o = document.createElement('option');
        o.value = t.v; o.textContent = t.nome;
        sel.appendChild(o);
      });
    }
    window.radConexoesRender();
  };

  // A carga do app pode terminar depois deste arquivo.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', prepararSeed);
  } else prepararSeed();

})();

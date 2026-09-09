/* ============================================================
   SplitHub — Execução Automática de RAD
   Supre a Lacuna 2 de J-03: geração manual de guias.

   Modelo de integração conforme a API documentada em
   https://split-hubhq.github.io/docs/rad.html
     SplitHub → ERP   webhook rad.darf_recebida
     ERP → SplitHub   POST /v1/rad/proofs
     SplitHub → ERP   webhook rad.proof_received

   Este arquivo concentra dados, motor e renderização das telas
   T-01 a T-04. As alterações em T-05..T-08 vivem no index.html.
   ============================================================ */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════
  // CATÁLOGOS
  // ══════════════════════════════════════════════════════════

  /* Automático é o estado pretendido, não o fim de uma escada de
     maturidade. As réguas de pagamento já vivem no ERP: o SplitHub gera
     a guia e entrega, e o ERP decide quando pagar segundo as próprias
     regras. Um portão humano no meio duplicaria esse controle. */
  var MODOS = [
    { v: 'automatico', label: 'Automático', cor: 'var(--teal)', rgb: 'var(--teal-rgb)',
      recomendado: true,
      desc: 'Configurou, roda sozinho. O motor gera as guias na janela e emite o webhook ao ERP, que aplica as próprias réguas de pagamento. O humano só entra nas exceções: erro de geração ou falha de entrega.' },
    { v: 'assistido', label: 'Assistido', cor: 'var(--blue)', rgb: 'var(--blue-rgb)',
      desc: 'Transitório. O motor monta o lote e aguarda aprovação a cada janela. Serve para conferir o recorte nos primeiros ciclos — não é destino, porque repõe manualmente uma decisão que o ERP já toma.' },
    { v: 'manual', label: 'Manual', cor: 'var(--txt3)', rgb: 'var(--status-gray-rgb)',
      desc: 'O motor não age. Toda guia depende de seleção e geração na aba Guias RAD — o comportamento anterior à automação.' }
  ];
  function modoCfg(v) { return MODOS.find(function (m) { return m.v === v; }) || MODOS[0]; }

  // return_code da API — dois dos três valores são erro
  var RETURN_CODES = {
    DARF_GERADO:                { label: 'Guia gerada',            cor: 'var(--green)', erro: false, acao: '—' },
    DFE_NAO_ENCONTRADO:         { label: 'DF não encontrado',      cor: 'var(--red)',   erro: true,
                                  acao: 'Revisar a ingestão do documento fiscal (J-02)' },
    VALOR_PARCIAL_SUPERIOR_DFE: { label: 'Valor parcial superior', cor: 'var(--amber)', erro: true,
                                  acao: 'Revisar a apuração do registro fiscal' }
  };

  var EXEC_STATUS = {
    programado:           { label: 'Programado',   cor: 'var(--txt3)' },
    aguardando_aprovacao: { label: 'Aguard. aprovação', cor: 'var(--amber)' },
    bloqueado:            { label: 'Bloqueado',    cor: 'var(--red)' },
    aprovado:             { label: 'Aprovado',     cor: 'var(--blue)' },
    enviado:              { label: 'Enviado',      cor: 'var(--blue)' },
    falha_envio:          { label: 'Falha envio',  cor: 'var(--red)' },
    confirmado:           { label: 'Confirmado',   cor: 'var(--green)' }
  };

  /* Modelos de orquestração — o critério de cobertura da política. */
  var ORQUESTRACOES = [
    { v: 'cnpj', label: 'Por CNPJ', cor: 'var(--teal)', rgb: 'var(--teal-rgb)',
      desc: 'A política cobre um ou mais CNPJs compradores. Todo RF de método RAD desses estabelecimentos entra na janela.',
      hint: 'Use quando a régua é do estabelecimento — filiais que fecham no mesmo dia, ou uma matriz com calendário próprio.' },
    { v: 'contrato', label: 'Por contrato', cor: 'var(--blue)', rgb: 'var(--blue-rgb)',
      desc: 'A política cobre um ou mais contratos de método RAD, independentemente do CNPJ comprador.',
      hint: 'Use quando a régua é do fornecedor ou do acordo — um contrato de insumo com prazo diferente do resto.' },
    { v: 'valor', label: 'Por valor de imposto', cor: 'var(--amber)', rgb: 'var(--amber-rgb)',
      desc: 'A política cobre as guias cujo valor de imposto cai dentro de uma faixa.',
      hint: 'Use para separar o grão fino do alto valor: guias grandes com mais antecedência, pequenas em lote.' }
  ];
  /* Sobre qual valor a faixa incide. O RF guarda o valor da própria guia;
     os totais da nota vêm espelhados nele (valorTotalNF, valorLiquidoNF) e,
     na falta, do DF. */
  var BASES_VALOR = [
    { v: 'cbs_ibs', label: 'Valor CBS/IBS do DF',
      curto: 'guia CBS/IBS',
      desc: 'O valor do próprio registro fiscal — o que vira a guia. É a leitura mais direta: a faixa fala do que será pago.',
      calc: function (nf, rf) { return rf.valor || 0; } },
    { v: 'imposto_total', label: 'Valor total de imposto',
      curto: 'imposto total do DF',
      desc: 'IBS + CBS do documento inteiro. Um DF gera duas guias; esta base olha a soma antes da divisão.',
      calc: function (nf, rf) { return (nf.ibs || 0) + (nf.cbs || 0); } },
    { v: 'nota', label: 'Valor da nota',
      curto: 'valor da nota',
      desc: 'O valor total do documento fiscal. Use quando a régua é comercial — notas grandes tratadas com mais antecedência.',
      calc: function (nf, rf) { return rf.valorTotalNF || nf.valorTotal || 0; } },
    { v: 'liquido', label: 'Valor líquido',
      curto: 'valor líquido',
      desc: 'O valor da nota descontados os tributos. É o que efetivamente circula para o fornecedor.',
      calc: function (nf, rf) { return rf.valorLiquidoNF || nf.valorLiquido || 0; } }
  ];
  function baseCfg(v) {
    return BASES_VALOR.filter(function (b) { return b.v === v; })[0] || BASES_VALOR[0];
  }
  window.RAD_BASES_VALOR = BASES_VALOR;
  window.radBaseCfg = baseCfg;

  function orqCfg(v) {
    return ORQUESTRACOES.filter(function (o) { return o.v === v; })[0] || ORQUESTRACOES[0];
  }
  window.RAD_ORQUESTRACOES = ORQUESTRACOES;
  window.radOrqCfg = orqCfg;

  window.RAD_MODOS = MODOS;
  window.RAD_RETURN_CODES = RETURN_CODES;
  window.RAD_EXEC_STATUS = EXEC_STATUS;
  window.radModoCfg = modoCfg;

  // ══════════════════════════════════════════════════════════
  // DADOS
  // ══════════════════════════════════════════════════════════

  // T-03 — Integrações (conexões de saída). Hoje o produto só tem entrada.
  window._radIntegracoes = [
    { id: 'INT-0001', nome: 'ERP Protheus — Matriz PR',
      webhookUrl: 'https://erp.induspar.com.br/hooks/splithub',
      token: 'sk_live_4f2a••••••••••••3d91', tokenCriadoEm: '12/08/2026',
      eventos: ['rad.darf_recebida', 'rad.proof_received'],
      ativo: true, ultimaEntrega: '08/09/2026 06:00', entregas: 142, falhas: 3 },
    { id: 'INT-0002', nome: 'ERP SAP — Filial SP',
      webhookUrl: 'https://sap-sp.induspar.com.br/api/splithub/webhook',
      token: 'sk_live_9b71••••••••••••ae04', tokenCriadoEm: '20/08/2026',
      eventos: ['rad.darf_recebida'],
      ativo: true, ultimaEntrega: '08/09/2026 06:00', entregas: 58, falhas: 11 },
    { id: 'INT-0003', nome: 'ERP Senior — Filial MG (homologação)',
      webhookUrl: 'https://hml-mg.induspar.com.br/splithub',
      token: 'sk_test_1c30••••••••••••77bf', tokenCriadoEm: '01/09/2026',
      eventos: ['rad.darf_recebida', 'rad.proof_received'],
      ativo: false, ultimaEntrega: '—', entregas: 0, falhas: 0 }
  ];

  /* T-01/T-02 — Política de execução RAD.

     A política é a entidade, não o CNPJ: a organização cria quantas
     quiser. Cada uma declara um MODELO DE ORQUESTRAÇÃO, que é o
     critério de cobertura — o que a política alcança:

       cnpj      um ou mais CNPJs compradores
       contrato  um ou mais contratos de método RAD
       valor     uma faixa de valor de imposto por guia

     Isso é ortogonal ao MODO (automático, assistido, manual), que diz
     quanta decisão humana existe, e ao contrato, que define QUEM recolhe.

     Duas políticas ativas podem acabar reivindicando a mesma nota — em
     modelos diferentes, sobretudo. A guia sairia duplicada, e a segunda
     voltaria do ERP como erro. Por isso há detecção de sobreposição. */
  window._radPoliticas = [
    { id: 'POL-0001', nome: 'Matriz e filial SP', orquestracao: 'cnpj',
      cnpjs: ['54.891.237/0001-48', '54.891.237/0002-29'], contratos: [],
      faixaMin: 0, faixaMax: null,
      modo: 'automatico',
      diasExecucao: [5, 20], horaExecucao: '06:00', antecedencia: 5,
      valorMinimo: 0, excluirFlags: ['glosado'],
      integracaoId: 'INT-0001', ativo: true, ultimaExecucao: '05/09/2026 06:00',
      historico: [] },
    /* Assistido de propósito: contrato recém-integrado, nos primeiros
       ciclos de conferência do recorte. É o único caso que ainda leva um
       lote à fila de decisão, agora que a alçada saiu. */
    { id: 'POL-0002', nome: 'Contrato de insumo CT-0011', orquestracao: 'contrato',
      cnpjs: [], contratos: ['CT-0011'],
      faixaMin: 0, faixaMax: null,
      modo: 'assistido',
      diasExecucao: [1, 15], horaExecucao: '07:00', antecedencia: 7,
      valorMinimo: 0, excluirFlags: ['glosado'],
      integracaoId: 'INT-0002', ativo: true, ultimaExecucao: '01/09/2026 07:00',
      historico: [] },
    /* Pausada de propósito: a faixa cruza notas que POL-0001 e POL-0002
       já cobrem. Ativá-la faz a listagem acusar a sobreposição — que é
       exatamente o caso que a detecção entre modelos existe para pegar. */
    { id: 'POL-0003', nome: 'Guias de alto valor', orquestracao: 'valor',
      cnpjs: [], contratos: [],
      baseValor: 'cbs_ibs', faixaMin: 470000, faixaMax: null,
      modo: 'assistido',
      diasExecucao: [10], horaExecucao: '08:00', antecedencia: 3,
      valorMinimo: 0, excluirFlags: ['glosado'],
      integracaoId: 'INT-0003', ativo: false, ultimaExecucao: '—',
      historico: [] }
  ];

  // T-03 aba 2 — log de entregas de webhook
  window._radEntregas = [
    { id: 'DLV-00142', integracaoId: 'INT-0001', evento: 'rad.darf_recebida',
      dfeKey: '35260954891237000148550010000123451000123456', tentativas: 1,
      httpStatus: 200, status: 'entregue', ultimaTentativa: '08/09/2026 06:00:12' },
    { id: 'DLV-00141', integracaoId: 'INT-0001', evento: 'rad.proof_received',
      dfeKey: '35260954891237000148550010000123441000123444', tentativas: 1,
      httpStatus: 200, status: 'entregue', ultimaTentativa: '08/09/2026 05:58:04' },
    { id: 'DLV-00140', integracaoId: 'INT-0002', evento: 'rad.darf_recebida',
      dfeKey: '35260954891237000229550010000098761000098765', tentativas: 4,
      httpStatus: 504, status: 'falha', ultimaTentativa: '08/09/2026 06:14:55' },
    { id: 'DLV-00139', integracaoId: 'INT-0002', evento: 'rad.darf_recebida',
      dfeKey: '35260954891237000229550010000098751000098754', tentativas: 2,
      httpStatus: null, status: 'pendente', ultimaTentativa: '08/09/2026 06:12:31' },
    { id: 'DLV-00138', integracaoId: 'INT-0001', evento: 'rad.darf_recebida',
      dfeKey: '35260954891237000148550010000123431000123433', tentativas: 1,
      httpStatus: 200, status: 'entregue', ultimaTentativa: '05/09/2026 06:00:09' }
  ];

  // T-03 aba 3 — comprovantes recebidos via POST /v1/rad/proofs
  window._radComprovantes = [
    { id: 'comp_5e21fa', darfId: 'darf_9f21ab', tipoPagamento: 'pix',
      valorPago: 18450.00, recebidoEm: '06/09/2026 14:22:08', status: 'confirmed',
      motivo: null, integracaoId: 'INT-0001' },
    { id: 'comp_5e21f9', darfId: 'darf_9f21aa', tipoPagamento: 'boleto',
      valorPago: 7320.55, recebidoEm: '06/09/2026 11:03:47', status: 'confirmed',
      motivo: null, integracaoId: 'INT-0001' },
    { id: '—', darfId: 'darf_INEXISTENTE', tipoPagamento: 'pix',
      valorPago: 2100.00, recebidoEm: '07/09/2026 09:41:12', status: 'rejeitado',
      motivo: 'darf_id não encontrado', integracaoId: 'INT-0002' },
    { id: '—', darfId: 'darf_9f21b4', tipoPagamento: 'boleto',
      valorPago: 5600.00, recebidoEm: '07/09/2026 16:20:00', status: 'rejeitado',
      motivo: 'campo obrigatório ausente: boleto.linha_digitavel', integracaoId: 'INT-0002' }
  ];

  // ══════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════

  function fmtBRL(v) {
    return 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtCompacto(v) {
    if (v >= 1e6) return 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M';
    if (v >= 1e3) return 'R$ ' + Math.round(v / 1e3) + 'K';
    return 'R$ ' + (v || 0).toLocaleString('pt-BR');
  }
  function el(id) { return document.getElementById(id); }
  function setTxt(id, v) { var e = el(id); if (e) e.textContent = v; }

  function orgPorCnpj(cnpj) {
    return (window._orgCnpjs || []).find(function (o) { return o.cnpj === cnpj; }) || null;
  }
  function politicaPorId(id) {
    return (window._radPoliticas || []).find(function (p) { return p.id === id; }) || null;
  }
  window.radPoliticaPorId = politicaPorId;

  /* Só responde para a orquestração por CNPJ. Nas outras, a cobertura
     não é do estabelecimento, e dizer que um CNPJ "tem política" seria
     mentira — ele pode ter parte das notas cobertas e parte não. */
  function politicaPorCnpj(cnpj) {
    return (window._radPoliticas || []).find(function (p) {
      return p.orquestracao === 'cnpj' && (p.cnpjs || []).indexOf(cnpj) >= 0;
    }) || null;
  }
  window.radPoliticaPorCnpj = politicaPorCnpj;

  // Contratos que a política pode recortar: só os de método RAD.
  function contratosRad() {
    return (window.contratosGlobal || []).filter(function (c) {
      return (c.metodo || (c.rad ? 'rad' : '')) === 'rad';
    });
  }
  window.radContratosRad = contratosRad;

  function fmtFaixa(p) {
    var min = p.faixaMin || 0, max = p.faixaMax;
    var base = ' de ' + baseCfg(p.baseValor).curto;
    if (!min && !max) return 'qualquer' + base;
    if (!max) return base.replace(' de ', '') + ' acima de ' + fmtBRL(min);
    if (!min) return base.replace(' de ', '') + ' at\u00e9 ' + fmtBRL(max);
    return base.replace(' de ', '') + ' de ' + fmtBRL(min) + ' a ' + fmtBRL(max);
  }
  window.radFmtFaixa = fmtFaixa;

  // O que a política cobre, em uma linha, conforme a orquestração.
  function coberturaTexto(p) {
    if (p.orquestracao === 'contrato') {
      var n = (p.contratos || []).length;
      return n ? n + ' contrato' + (n > 1 ? 's' : '') + ' \u00b7 ' + p.contratos.join(', ') : 'nenhum contrato';
    }
    if (p.orquestracao === 'valor') return fmtFaixa(p);
    var q = (p.cnpjs || []).length;
    if (!q) return 'nenhum CNPJ';
    var o = orgPorCnpj(p.cnpjs[0]);
    var primeiro = o ? o.razao + ' \u2014 ' + o.uf : p.cnpjs[0];
    return q === 1 ? primeiro : q + ' CNPJs \u00b7 ' + primeiro + ' +' + (q - 1);
  }
  window.radCoberturaTexto = coberturaTexto;

  /* Conflito dentro do mesmo modelo: o mesmo CNPJ ou o mesmo contrato em
     duas políticas, ou faixas de valor que se cruzam. Barra o salvamento
     — é duplicidade certa, não um risco. */
  function conflitoCobertura(p, ignorarId) {
    var out = [];
    (window._radPoliticas || []).forEach(function (o) {
      if (o.id === ignorarId || o.orquestracao !== p.orquestracao) return;
      if (p.orquestracao === 'cnpj') {
        (p.cnpjs || []).forEach(function (c) {
          if ((o.cnpjs || []).indexOf(c) >= 0) out.push({ politica: o, item: c });
        });
      } else if (p.orquestracao === 'contrato') {
        (p.contratos || []).forEach(function (c) {
          if ((o.contratos || []).indexOf(c) >= 0) out.push({ politica: o, item: c });
        });
      } else {
        // Faixas sobre bases diferentes não são comparáveis: R$ 400 mil de
        // guia e R$ 400 mil de nota não descrevem o mesmo conjunto.
        if ((o.baseValor || 'cbs_ibs') !== (p.baseValor || 'cbs_ibs')) return;
        var aMin = p.faixaMin || 0, aMax = p.faixaMax === null || p.faixaMax === undefined ? Infinity : p.faixaMax;
        var bMin = o.faixaMin || 0, bMax = o.faixaMax === null || o.faixaMax === undefined ? Infinity : o.faixaMax;
        if (aMin <= bMax && bMin <= aMax) out.push({ politica: o, item: fmtFaixa(o) });
      }
    });
    return out;
  }
  window.radConflitoCobertura = conflitoCobertura;

  /* Sobreposição entre modelos diferentes só aparece no resultado: uma
     política por CNPJ e outra por valor podem reivindicar o mesmo RF.
     Não dá para barrar na configuração, então é medida e exibida. */
  function sobreposicaoRFs() {
    var dono = {}, dupes = {};
    (window._radPoliticas || [])
      .filter(function (p) { return p.ativo && p.modo !== 'manual'; })
      .forEach(function (p) {
        selecionarElegiveis(p).forEach(function (r) {
          if (dono[r.rfId] && dono[r.rfId] !== p.id) {
            dupes[r.rfId] = dupes[r.rfId] || [dono[r.rfId]];
            if (dupes[r.rfId].indexOf(p.id) < 0) dupes[r.rfId].push(p.id);
          } else if (!dono[r.rfId]) dono[r.rfId] = p.id;
        });
      });
    return Object.keys(dupes).map(function (k) { return { rfId: k, politicas: dupes[k] }; });
  }
  window.radSobreposicaoRFs = sobreposicaoRFs;

  /* Qual política reivindica cada RF. O índice é construído sob demanda
     e invalidado a cada mudança de política — sem ele, responder isso por
     linha de tabela custaria uma varredura completa por linha. */
  var _idxPolRF = null;
  function indicePoliticaPorRF() {
    if (_idxPolRF) return _idxPolRF;
    var idx = {};
    (window._radPoliticas || [])
      .filter(function (p) { return p.ativo && p.modo !== 'manual'; })
      .forEach(function (p) {
        selecionarElegiveis(p).forEach(function (r) {
          if (!idx[r.rfId]) idx[r.rfId] = p.id;
        });
      });
    return (_idxPolRF = idx);
  }
  function invalidarIndice() { _idxPolRF = null; }
  window.radInvalidarIndicePolitica = invalidarIndice;
  window.radPoliticaDoRF = function (rfId) { return indicePoliticaPorRF()[rfId] || null; };

  /* Guias RAD pendentes que nenhuma política ativa alcança. Continuam
     dependendo de geração manual, e é o número que some quando a
     listagem deixa de ser por CNPJ. */
  window.radRFsDescobertos = function () {
    var idx = indicePoliticaPorRF(), fora = [];
    (window.nfListaFiltradaGlobal || []).forEach(function (nf) {
      if (nf.tipo !== 'entrada') return;
      (nf.registrosFiscais || []).forEach(function (rf) {
        if ((rf.metodoPagamento || nf.metodoPagamento || '') !== 'RAD') return;
        var pago = (rf.dataPagamento && rf.dataPagamento !== '—') ||
                   rf.statusCredito === 'apropriado' || rf.statusCredito === 'utilizado';
        if (pago || idx[rf.id]) return;
        fora.push({ rfId: rf.id, valor: rf.valor || 0, cnpjComprador: nf.cnpjComprador || '',
                    forn: rf.entidade || nf.entidade || '—' });
      });
    });
    return fora;
  };

  function cnpjsSemCobertura() {
    var cobertos = {};
    (window._radPoliticas || [])
      .filter(function (p) { return p.ativo && p.modo !== 'manual'; })
      .forEach(function (p) {
        selecionarElegiveis(p).forEach(function (r) { cobertos[r.cnpjComprador] = true; });
      });
    return (window._orgCnpjs || []).filter(function (o) { return !cobertos[o.cnpj]; });
  }
  window.radCnpjsSemCobertura = cnpjsSemCobertura;

  function integracaoPorId(id) {
    return (window._radIntegracoes || []).find(function (i) { return i.id === id; }) || null;
  }

  function badge(txt, cor, rgb) {
    var bg = rgb ? 'rgba(' + rgb + ',.12)' : cor + '1A';
    var bd = rgb ? 'rgba(' + rgb + ',.28)' : cor + '44';
    return '<span style="font-size:10px;font-weight:700;letter-spacing:.04em;padding:2px 8px;' +
      'border-radius:4px;color:' + cor + ';background:' + bg + ';border:1px solid ' + bd + ';' +
      'white-space:nowrap">' + txt + '</span>';
  }
  window.radBadge = badge;

  function janelaTexto(p) {
    if (!p) return '—';
    return 'dias ' + p.diasExecucao.join(' e ') + ' · ' + p.horaExecucao;
  }

  // Saúde da integração pela taxa de entrega
  /* Conexões anteriores ao catálogo não têm tipo; todas eram RAD↔ERP. */
  function ehConexaoRad(i) { return !i.tipo || i.tipo === 'rad_erp'; }
  window.radEhConexaoRad = ehConexaoRad;

  function saudeIntegracao(intg) {
    if (!intg || !intg.entregas) return { pct: null, cor: 'var(--txt3)', label: 'sem tráfego' };
    var pct = (intg.entregas - intg.falhas) / intg.entregas;
    var cor = pct >= 0.95 ? 'var(--green)' : pct >= 0.80 ? 'var(--amber)' : 'var(--red)';
    return { pct: pct, cor: cor, label: (pct * 100).toFixed(1).replace('.', ',') + '%' };
  }
  window.radSaudeIntegracao = saudeIntegracao;

  // ══════════════════════════════════════════════════════════
  // MOTOR — seleção de RFs elegíveis
  // ══════════════════════════════════════════════════════════

  // Rótulos das flags que retêm uma nota fora do lote
  var FLAG_LABEL = {
    glosado:        'Crédito glosado pelo Fisco',
    vencido:        'Prazo de apropriação vencido',
    inconsistencia: 'Inconsistência entre RF e TF',
    em_risco:       'Registro sinalizado em risco'
  };
  window.RAD_FLAG_LABEL = FLAG_LABEL;


  /* Decide se o RF cai na cobertura da política, conforme o modelo de
     orquestração. É o único ponto que conhece os três modelos — o resto
     do motor trabalha sobre o resultado. */
  function dentroDaCobertura(pol, nf, rf, valor) {
    if (pol.orquestracao === 'contrato') {
      var ct = rf.contratoId || nf.contratoId || null;
      return !!ct && (pol.contratos || []).indexOf(ct) >= 0;
    }
    if (pol.orquestracao === 'valor') {
      var min = pol.faixaMin || 0;
      var max = pol.faixaMax === null || pol.faixaMax === undefined ? Infinity : pol.faixaMax;
      var base = baseCfg(pol.baseValor).calc(nf, rf);
      return base >= min && base <= max;
    }
    return (pol.cnpjs || []).indexOf(nf.cnpjComprador) >= 0;
  }

  /* Aplica os critérios da política sobre os RFs de método RAD: primeiro
     a cobertura do modelo de orquestração, depois valor mínimo e flags de
     exclusão. As notas que batem numa flag são separadas em vez de
     descartadas — a política retém, e a fila de decisão mostra o porquê. */
  function selecionarElegiveis(pol) {
    if (!pol) return [];
    var out = [];
    (window.nfListaFiltradaGlobal || []).forEach(function (nf) {
      if (nf.tipo !== 'entrada') return;
      (nf.registrosFiscais || []).forEach(function (rf) {
        var met = rf.metodoPagamento || nf.metodoPagamento || '';
        if (met !== 'RAD') return;

        var pago = (rf.dataPagamento && rf.dataPagamento !== '—') ||
                   rf.statusCredito === 'apropriado' || rf.statusCredito === 'utilizado';
        if (pago) return;

        var v = rf.valor || 0;
        if (!dentroDaCobertura(pol, nf, rf, v)) return;
        // Na orquestração por valor a faixa já é o piso; aqui seria redundante.
        if (pol.orquestracao !== 'valor' && v < (pol.valorMinimo || 0)) return;

        var flags = (rf.statusFlags || []).concat(rf.statusCredito === 'glosado' ? ['glosado'] : []);
        var atingidas = (pol.excluirFlags || []).filter(function (f) { return flags.indexOf(f) >= 0; });
        var bloqueado = atingidas.length > 0;

        out.push({
          rfId: rf.id, dfeKey: rf.chaveDF || nf.chave || '',
          cnpjComprador: nf.cnpjComprador || '',
          contratoId: rf.contratoId || nf.contratoId || null,
          statusCredito: rf.statusCredito || '',
          nfNumero: nf.numero, forn: rf.entidade || nf.entidade || '—',
          tipoFiscal: rf.tipoFiscal === 'ibs' ? 'Guia IBS' : 'DARF CBS',
          valor: v, dataRF: rf.data || '', bloqueado: bloqueado,
          motivoBloqueio: bloqueado ? FLAG_LABEL[atingidas[0]] || atingidas[0] : null
        });
      });
    });
    return out;
  }
  window.radSelecionarElegiveis = selecionarElegiveis;

  /* Monta o lote da próxima execução, separando o que segue do que é
     retido. A separação é o que permite T-04 §2 tratar o lote que aguarda
     decisão e as notas retidas como filas distintas, com donos distintos:
     uma pede aprovação, a outra pede resolver a causa. */
  function montarLote(pol) {
    var eleg = selecionarElegiveis(pol);
    var incluidos = eleg.filter(function (r) { return !r.bloqueado; });
    var bloqueados = eleg.filter(function (r) { return r.bloqueado; });
    var total = incluidos.reduce(function (s, r) { return s + r.valor; }, 0);
    return {
      politicaId: pol.id, politicaNome: pol.nome || pol.id,
      orquestracao: pol.orquestracao, cobertura: coberturaTexto(pol),
      cnpjs: incluidos.concat(bloqueados).map(function (r) { return r.cnpjComprador; })
        .filter(function (c, i, a) { return c && a.indexOf(c) === i; }),
      incluidos: incluidos, bloqueados: bloqueados,
      qtd: incluidos.length, total: total,
      status: bloqueados.length && !incluidos.length ? 'bloqueado'
            : pol.modo === 'assistido' ? 'aguardando_aprovacao'
            : 'programado'
    };
  }
  window.radMontarLote = montarLote;

  function lotesDeTodasPoliticas() {
    return (window._radPoliticas || [])
      .filter(function (p) { return p.ativo && p.modo !== 'manual'; })
      .map(montarLote);
  }
  window.radLotes = lotesDeTodasPoliticas;

  // ══════════════════════════════════════════════════════════
  // T-01 — Política de Execução RAD (lista)
  // ══════════════════════════════════════════════════════════

  window.radPoliticasRenderKPIs = function () {
    var pols = window._radPoliticas || [];
    var ativas = pols.filter(function (p) { return p.ativo && p.modo !== 'manual'; });
    setTxt('rad-kpi-ativos', ativas.length + '/' + pols.length);
    var descobertos = cnpjsSemCobertura().length;
    var subAtivos = el('rad-kpi-ativos-sub');
    if (subAtivos) {
      subAtivos.textContent = descobertos
        ? descobertos + ' CNPJ(s) sem nenhuma guia coberta'
        : 'todos os CNPJs com guia coberta';
      subAtivos.style.color = descobertos ? 'var(--amber)' : 'var(--txt2)';
    }

    var lotes = lotesDeTodasPoliticas();
    var guias = lotes.reduce(function (s, l) { return s + l.qtd; }, 0);
    setTxt('rad-kpi-guias', String(guias));
    setTxt('rad-kpi-guias-sub', fmtCompacto(lotes.reduce(function (s, l) { return s + l.total; }, 0)) + ' na próxima janela');

    var aguard = lotes.filter(function (l) { return l.status === 'aguardando_aprovacao'; });
    setTxt('rad-kpi-aprovacao', String(aguard.length));
    setTxt('rad-kpi-aprovacao-sub', fmtCompacto(aguard.reduce(function (s, l) { return s + l.total; }, 0)) + ' retidos');

    var falhas = (window._radEntregas || []).filter(function (e) { return e.status === 'falha'; }).length;
    var rej = (window._radComprovantes || []).filter(function (c) { return c.status === 'rejeitado'; }).length;
    setTxt('rad-kpi-falhas', String(falhas + rej));
    var sub = el('rad-kpi-falhas-sub');
    if (sub) {
      sub.textContent = falhas + ' entregas · ' + rej + ' comprovantes';
      sub.style.color = (falhas + rej) > 0 ? 'var(--red)' : 'var(--green)';
    }
  };

  window.radPoliticasRenderTabela = function () {
    var tbody = el('t-rad-politicas');
    if (!tbody) return;

    var fModo = (el('rad-filtro-modo') || {}).value || '';
    var fOrq = (el('rad-filtro-orq') || {}).value || '';
    var fIntg = (el('rad-filtro-integracao') || {}).value || '';
    var busca = ((el('rad-busca') || {}).value || '').trim().toLowerCase();

    var todas = window._radPoliticas || [];
    var linhas = todas.filter(function (p) {
      if (fModo && p.modo !== fModo) return false;
      if (fOrq && p.orquestracao !== fOrq) return false;
      if (fIntg && p.integracaoId !== fIntg) return false;
      if (busca) {
        var alvo = (p.id + ' ' + (p.nome || '') + ' ' + coberturaTexto(p) + ' ' +
                    (p.cnpjs || []).join(' ') + ' ' + (p.contratos || []).join(' ')).toLowerCase();
        if (alvo.indexOf(busca) === -1) return false;
      }
      return true;
    });

    if (window.ShColMgr && ShColMgr.sortRows) {
      window._radPoliticasLista = linhas.map(function (p) {
        var intg = integracaoPorId(p.integracaoId);
        return {
          politica: p.nome || p.id, orquestracao: orqCfg(p.orquestracao).label,
          cobertura: coberturaTexto(p), modo: modoCfg(p.modo).label,
          janela: janelaTexto(p), antecedencia: p.antecedencia + ' dias',
          integracao: intg ? intg.nome : '—',
          ultimaExecucao: p.ultimaExecucao,
          situacao: p.ativo ? 'Ativa' : 'Pausada'
        };
      });
    }

    var h = '';
    linhas.forEach(function (p) {
      var m = modoCfg(p.modo), o = orqCfg(p.orquestracao);
      var intg = integracaoPorId(p.integracaoId);
      var saude = saudeIntegracao(intg);
      var pontoSaude = intg
        ? '<span title="Taxa de entrega ' + saude.label + '" style="display:inline-block;width:7px;height:7px;' +
          'border-radius:50%;background:' + saude.cor + ';margin-right:6px;flex-shrink:0"></span>'
        : '';
      var situacao = p.ativo ? badge('Ativa', 'var(--green)', 'var(--status-green-rgb)')
                             : badge('Pausada', 'var(--amber)', 'var(--status-amber-rgb)');
      var lote = p.ativo && p.modo !== 'manual' ? montarLote(p) : null;

      h += '<tr onclick="radAbrirEditor(\'' + p.id + '\')" style="cursor:pointer">' +
        '<td style="text-align:center"><input type="checkbox" class="rad-pol-chk" data-pol="' + p.id +
          '" onclick="event.stopPropagation()" onchange="radAtualizarSelecao()" style="cursor:pointer;width:14px;height:14px"></td>' +
        '<td><div style="font-weight:600">' + (p.nome || p.id) + '</div>' +
          '<div style="font-size:10px;color:var(--txt3);font-family:var(--font-mono)">' + p.id +
          (lote ? ' · ' + lote.qtd + ' guia(s) na próxima janela' : '') + '</div></td>' +
        '<td>' + badge(o.label, o.cor, o.rgb) + '</td>' +
        '<td style="font-size:11.5px;color:var(--txt2);max-width:230px">' + coberturaTexto(p) + '</td>' +
        '<td>' + badge(m.label, m.cor, m.rgb) + '</td>' +
        '<td style="font-size:12px;white-space:nowrap">' + janelaTexto(p) + '</td>' +
        '<td style="font-size:12px;white-space:nowrap">D-' + p.antecedencia + '</td>' +
        '<td style="font-size:11px"><span style="display:inline-flex;align-items:center">' + pontoSaude +
          (intg ? intg.nome : '<span style="color:var(--txt3)">—</span>') + '</span></td>' +
        '<td style="font-size:11px;color:var(--txt2);white-space:nowrap">' + p.ultimaExecucao + '</td>' +
        '<td>' + situacao + '</td></tr>';
    });

    if (!linhas.length) {
      h = '<tr><td colspan="10" style="text-align:center;color:var(--txt3);padding:24px">' +
          (todas.length ? 'Nenhuma política encontrada para este filtro.'
                        : 'Nenhuma política criada. Comece por <strong>Nova política</strong>.') + '</td></tr>';
    }
    tbody.innerHTML = h;

    var cnt = el('rad-contagem');
    if (cnt) cnt.textContent = linhas.length + ' de ' + todas.length + ' políticas';
    radAlertaSobreposicao();
    if (window.ShColMgr && ShColMgr.afterRender) { try { ShColMgr.afterRender('rad-politicas'); } catch (e) {} }
    window.radAtualizarSelecao();
  };

  /* Duas políticas ativas reivindicando o mesmo RF geram a guia duas
     vezes. Entre modelos diferentes isso só aparece no resultado, então
     a listagem mede e avisa em vez de fingir que não acontece. */
  window.radAlertaSobreposicao = function () {
    var box = el('rad-sobreposicao'); if (!box) return;
    var dupes = sobreposicaoRFs();
    if (!dupes.length) { box.style.display = 'none'; return; }
    var pares = {};
    dupes.forEach(function (d) { pares[d.politicas.slice().sort().join(' + ')] = true; });
    box.style.display = 'flex';
    el('rad-sobreposicao-txt').innerHTML =
      '<strong>' + dupes.length + ' guia(s) reivindicada(s) por mais de uma política ativa</strong> — ' +
      Object.keys(pares).join(', ') + '. ' +
      'Sem ajuste, a mesma guia sai duas vezes e a segunda volta do ERP como erro.';
  };

  window.radAtualizarSelecao = function () {
    var chks = document.querySelectorAll('.rad-pol-chk:checked');
    var bar = el('rad-lote-bar');
    if (!bar) return;
    if (chks.length) {
      bar.style.display = 'flex';
      setTxt('rad-lote-info', chks.length + ' política' + (chks.length > 1 ? 's' : '') + ' selecionada' + (chks.length > 1 ? 's' : ''));
    } else { bar.style.display = 'none'; }
  };

  window.radToggleTodos = function (chk) {
    document.querySelectorAll('.rad-pol-chk').forEach(function (c) { c.checked = chk.checked; });
    window.radAtualizarSelecao();
  };

  // Ativação e pausa em massa — útil em fechamento ou incidente
  window.radAlterarAtivacaoLote = function (ativar) {
    var ids = [].slice.call(document.querySelectorAll('.rad-pol-chk:checked'))
      .map(function (c) { return c.getAttribute('data-pol'); });
    var n = 0;
    ids.forEach(function (id) {
      var p = politicaPorId(id);
      if (p && p.ativo !== ativar) {
        p.ativo = ativar;
        radRegistrarEvento(p, ativar ? 'ativacao' : 'pausa', [], 'Alteração em lote pela listagem.');
        n++;
      }
    });
    invalidarIndice();
    document.querySelectorAll('.rad-pol-chk').forEach(function (c) { c.checked = false; });
    window.radPoliticasRenderTabela();
    window.radPoliticasRenderKPIs();
    if (n) radToast(n + ' política(s) ' + (ativar ? 'ativada(s)' : 'pausada(s)') + '.');
  };

  window.radLimparFiltros = function () {
    ['rad-busca', 'rad-filtro-modo', 'rad-filtro-orq', 'rad-filtro-integracao'].forEach(function (id) {
      var e = el(id); if (e) e.value = '';
    });
    window.radPoliticasRenderTabela();
  };

  // ══════════════════════════════════════════════════════════
  // AUDITORIA DA POLÍTICA — mesmo padrão adotado em Contratos
  // ══════════════════════════════════════════════════════════

  var RAD_EVENTOS = {
    criacao:   { label: 'Política criada',   icone: '+', cor: 'var(--green)' },
    edicao:    { label: 'Política editada',  icone: '✎', cor: 'var(--blue)' },
    ativacao:  { label: 'Política ativada',  icone: '▶', cor: 'var(--teal)' },
    pausa:     { label: 'Política pausada',  icone: '⏸', cor: 'var(--amber)' },
    execucao:  { label: 'Execução manual',   icone: '⚡', cor: 'var(--purple)' }
  };

  function agoraISO() {
    var ref = window.HOJE_REF || new Date();
    var a = new Date();
    var d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), a.getHours(), a.getMinutes(), a.getSeconds());
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' +
           p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function fmtDataHora(iso) {
    if (!iso) return '—';
    var p = iso.split('T'); if (p.length < 2) return iso;
    var d = p[0].split('-'); if (d.length < 3) return iso;
    return d[2] + '/' + d[1] + '/' + d[0] + ' às ' + p[1].substring(0, 5);
  }

  function radHistorico(pol) {
    if (!pol.historico || !pol.historico.length) {
      pol.historico = [{
        ts: agoraISO(), tipo: 'criacao', usuario: 'Carga inicial',
        alteracoes: [], obs: 'Política existente na base ao início do registro de auditoria.'
      }];
    }
    return pol.historico;
  }
  function radRegistrarEvento(pol, tipo, alteracoes, obs) {
    /* O placeholder de "carga inicial" só faz sentido para política que já
       existia. Numa criação, o próprio evento é o começo do histórico. */
    var h = tipo === 'criacao' ? (pol.historico || (pol.historico = [])) : radHistorico(pol);
    h.push({
      ts: agoraISO(), tipo: tipo,
      usuario: window.CONTRATO_USUARIO_ATUAL || 'José da Silva',
      alteracoes: alteracoes || [], obs: obs || ''
    });
  }
  window.radRegistrarEvento = radRegistrarEvento;

  function radDiff(antes, depois) {
    var campos = [
      { k: 'nome', label: 'Nome', fmt: function (v) { return v || '—'; } },
      { k: 'orquestracao', label: 'Orquestração', fmt: function (v) { return orqCfg(v).label; } },
      { k: 'cnpjs', label: 'CNPJs cobertos', fmt: function (v) { return (v || []).join(', ') || '—'; } },
      { k: 'contratos', label: 'Contratos cobertos', fmt: function (v) { return (v || []).join(', ') || '—'; } },
      { k: 'baseValor', label: 'Valor comparado', fmt: function (v) { return baseCfg(v).label; } },
      { k: 'faixaMin', label: 'Faixa — mínimo', fmt: fmtBRL },
      { k: 'faixaMax', label: 'Faixa — máximo', fmt: function (v) { return v === null || v === undefined ? 'sem teto' : fmtBRL(v); } },
      { k: 'modo', label: 'Modo', fmt: function (v) { return modoCfg(v).label; } },
      { k: 'diasExecucao', label: 'Dias de execução', fmt: function (v) { return (v || []).join(', '); } },
      { k: 'horaExecucao', label: 'Hora', fmt: function (v) { return v; } },
      { k: 'antecedencia', label: 'Antecedência', fmt: function (v) { return v + ' dias'; } },
      { k: 'valorMinimo', label: 'Valor mínimo', fmt: fmtBRL },
      { k: 'integracaoId', label: 'Integração', fmt: function (v) { var i = integracaoPorId(v); return i ? i.nome : 'Somente plataforma'; } }
    ];
    var out = [];
    campos.forEach(function (c) {
      if (String(antes[c.k]) !== String(depois[c.k])) {
        out.push({ campo: c.label, de: c.fmt(antes[c.k]), para: c.fmt(depois[c.k]) });
      }
    });
    return out;
  }

  function radHistoricoHtml(pol, c) {
    var hist = radHistorico(pol).slice().reverse();
    var linhas = hist.map(function (ev, i) {
      var cfg = RAD_EVENTOS[ev.tipo] || { label: ev.tipo, icone: '·', cor: c.txt2 };
      var ultimo = (i === hist.length - 1);
      var alt = '';
      if (ev.alteracoes && ev.alteracoes.length) {
        alt = '<div style="margin-top:6px;display:flex;flex-direction:column;gap:3px">' +
          ev.alteracoes.map(function (a) {
            return '<div style="font-size:11px;color:' + c.txt2 + ';line-height:1.5">' +
              '<span style="color:' + c.txt3 + '">' + a.campo + ':</span> ' +
              '<span style="text-decoration:line-through;opacity:.65">' + a.de + '</span> ' +
              '<span style="color:' + c.txt3 + '">→</span> ' +
              '<span style="color:' + c.txt1 + ';font-weight:600">' + a.para + '</span></div>';
          }).join('') + '</div>';
      }
      var obs = ev.obs ? '<div style="font-size:11px;color:' + c.txt3 + ';margin-top:5px;font-style:italic">' + ev.obs + '</div>' : '';
      return '<div style="display:flex;gap:11px">' +
        '<div style="display:flex;flex-direction:column;align-items:center;width:20px;flex-shrink:0">' +
        '<div style="width:20px;height:20px;border-radius:50%;background:' + cfg.cor + '22;border:1px solid ' + cfg.cor +
          '55;color:' + cfg.cor + ';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700">' + cfg.icone + '</div>' +
        (ultimo ? '' : '<div style="width:1px;flex:1;background:' + c.brd + ';margin:3px 0;min-height:10px"></div>') +
        '</div><div style="flex:1;padding-bottom:' + (ultimo ? '0' : '14px') + '">' +
        '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap">' +
        '<span style="font-size:12px;font-weight:600;color:' + c.txt1 + '">' + cfg.label + '</span>' +
        '<span style="font-size:10.5px;color:' + c.txt3 + ';font-family:var(--font-mono)">' + fmtDataHora(ev.ts) + '</span></div>' +
        '<div style="font-size:10.5px;color:' + c.txt3 + ';margin-top:1px">' + ev.usuario + '</div>' +
        alt + obs + '</div></div>';
    }).join('');
    return '<div style="padding:14px 0 0;border-top:1px solid ' + c.brd + ';margin-top:14px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
      '<span style="font-size:10.5px;font-weight:700;color:' + c.txt3 + ';text-transform:uppercase;letter-spacing:.07em">Histórico e auditoria</span>' +
      '<span style="font-size:10.5px;color:' + c.txt3 + '">' + hist.length + ' evento' + (hist.length !== 1 ? 's' : '') + '</span></div>' +
      '<div style="display:flex;flex-direction:column">' + linhas + '</div></div>';
  }

  // ══════════════════════════════════════════════════════════
  // T-02 — Editor de política (drawer)
  // ══════════════════════════════════════════════════════════


  /* O seletor de cobertura muda com o modelo de orquestração, então vive
     fora da montagem do editor — trocar o modelo redesenha só este bloco. */
  function coberturaEditorHtml(pol) {
    var caixa = 'max-height:190px;overflow-y:auto;border:1px solid var(--border);border-radius:7px;padding:8px 10px;background:var(--bg)';
    var inp = 'width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 11px;color:var(--txt1);font-size:13px;font-family:inherit;box-sizing:border-box;outline:none';
    var nota = 'font-size:10.5px;color:var(--txt3);margin-top:6px;line-height:1.5';

    if (pol.orquestracao === 'contrato') {
      var cts = contratosRad();
      if (!cts.length) {
        return '<div style="font-size:12px;color:var(--amber)">Nenhum contrato de método RAD na base. ' +
          'Cadastre o contrato antes de orquestrar por contrato.</div>';
      }
      return '<div style="' + caixa + '">' + cts.map(function (ct) {
        var on = (pol.contratos || []).indexOf(ct.id) >= 0;
        var dono = (window._radPoliticas || []).filter(function (o) {
          return o.id !== pol.id && o.orquestracao === 'contrato' && (o.contratos || []).indexOf(ct.id) >= 0;
        })[0];
        return '<label style="display:flex;gap:8px;align-items:flex-start;padding:5px 0;' +
          (dono ? 'opacity:.5;cursor:not-allowed' : 'cursor:pointer') + '">' +
          '<input type="checkbox"' + (on ? ' checked' : '') + (dono ? ' disabled' : '') +
          ' onchange="radEdCobertura(\'contratos\',\'' + ct.id + '\',this.checked)" style="margin-top:3px">' +
          '<span><span style="font-family:var(--font-mono);font-size:11.5px;color:var(--blue)">' + ct.id + '</span> ' +
          '<span style="font-size:11.5px;color:var(--txt1)">fornecedor ' + ct.cnpj + '</span>' +
          '<div style="font-size:10.5px;color:var(--txt3)">vigência ' + ct.inicio + ' a ' + ct.fim +
          ' · prazo ' + ct.prazo + ' dias' +
          (dono ? ' · <span style="color:var(--amber)">já em ' + dono.id + '</span>' : '') +
          '</div></span></label>';
      }).join('') + '</div>' +
      '<div style="' + nota + '">Todo RF de método RAD destes contratos entra na janela, seja qual for o CNPJ comprador.</div>';
    }

    if (pol.orquestracao === 'valor') {
      var baseAtual = baseCfg(pol.baseValor);
      var outras = (window._radPoliticas || []).filter(function (o) {
        return o.id !== pol.id && o.orquestracao === 'valor' &&
               (o.baseValor || 'cbs_ibs') === baseAtual.v;
      });
      var baseSel = '<div style="margin-bottom:12px">' +
        '<label style="display:block;font-size:11px;font-weight:600;color:var(--txt2);margin-bottom:5px">' +
        'Valor comparado</label>' +
        '<select id="rad-ed-base" onchange="radEditorBase(this.value)" style="' + inp + '">' +
        BASES_VALOR.map(function (b) {
          return '<option value="' + b.v + '"' + (b.v === baseAtual.v ? ' selected' : '') + '>' + b.label + '</option>';
        }).join('') + '</select>' +
        '<div style="font-size:10.5px;color:var(--txt3);margin-top:5px;line-height:1.5">' + baseAtual.desc + '</div></div>';
      return baseSel +
        '<div class="shg2" style="gap:12px">' +
        '<div><label style="display:block;font-size:11px;font-weight:600;color:var(--txt2);margin-bottom:5px">' +
        'Valor mínimo</label>' +
        '<input id="rad-ed-faixa-min" type="number" min="0" step="1000" value="' + (pol.faixaMin || 0) +
        '" oninput="radEditorPrevia()" style="' + inp + '"></div>' +
        '<div><label style="display:block;font-size:11px;font-weight:600;color:var(--txt2);margin-bottom:5px">' +
        'Valor máximo</label>' +
        '<input id="rad-ed-faixa-max" type="number" min="0" step="1000" placeholder="sem teto" value="' +
        (pol.faixaMax === null || pol.faixaMax === undefined ? '' : pol.faixaMax) +
        '" oninput="radEditorPrevia()" style="' + inp + '"></div></div>' +
        '<div style="' + nota + '">Deixe o máximo vazio para “acima de”.' +
        (outras.length ? '<br>Outras faixas sobre ' + baseAtual.curto + ': ' + outras.map(function (o) {
          return o.id + ' (' + fmtFaixa(o) + ')';
        }).join(', ') + '. Faixas que se cruzam sobre a mesma base não podem coexistir.' : '') + '</div>';
    }

    var orgs = window._orgCnpjs || [];
    if (!orgs.length) return '<div style="font-size:12px;color:var(--txt3)">Nenhum CNPJ carregado.</div>';
    return '<div style="' + caixa + '">' + orgs.map(function (o) {
      var on = (pol.cnpjs || []).indexOf(o.cnpj) >= 0;
      var dono = (window._radPoliticas || []).filter(function (x) {
        return x.id !== pol.id && x.orquestracao === 'cnpj' && (x.cnpjs || []).indexOf(o.cnpj) >= 0;
      })[0];
      return '<label style="display:flex;gap:8px;align-items:flex-start;padding:5px 0;' +
        (dono ? 'opacity:.5;cursor:not-allowed' : 'cursor:pointer') + '">' +
        '<input type="checkbox"' + (on ? ' checked' : '') + (dono ? ' disabled' : '') +
        ' onchange="radEdCobertura(\'cnpjs\',\'' + o.cnpj + '\',this.checked)" style="margin-top:3px">' +
        '<span><span style="font-size:11.5px;color:var(--txt1)">' + o.razao + '</span>' +
        '<div style="font-size:10.5px;color:var(--txt3);font-family:var(--font-mono)">' + o.cnpj + ' · ' + o.uf +
        (dono ? ' · <span style="color:var(--amber);font-family:var(--font-body)">já em ' + dono.id + '</span>' : '') +
        '</div></span></label>';
    }).join('') + '</div>' +
    '<div style="' + nota + '">Um CNPJ só pode estar em uma política por CNPJ — em duas, a mesma guia sairia duplicada.</div>';
  }

  /* Aceita o id da política, um CNPJ (atalho vindo da Organização) ou
     nada, para criar do zero. */
  window.radAbrirEditor = function (ref) {
    var pol = ref ? (politicaPorId(ref) || politicaPorCnpj(ref)) : null;
    var novo = !pol;
    if (novo) {
      var ehCnpj = ref && /\d{2}\.\d{3}\.\d{3}\//.test(ref);
      pol = { id: 'POL-' + String((window._radPoliticas || []).length + 1).padStart(4, '0'),
        nome: '', orquestracao: 'cnpj',
        cnpjs: ehCnpj ? [ref] : [], contratos: [],
        baseValor: 'cbs_ibs', faixaMin: 0, faixaMax: null,
        modo: 'automatico', diasExecucao: [5], horaExecucao: '06:00',
        antecedencia: 5, valorMinimo: 0, excluirFlags: ['glosado'],
        integracaoId: null, ativo: false,
        ultimaExecucao: '—', historico: [] };
    }
    /* O editor trabalha sobre uma cópia. Antes ele mutava a política real
       a cada tecla, e cancelar não desfazia nada — agora só o salvamento
       escreve de volta, e a cópia ainda serve de base para o diff. */
    window._radPolOriginal = novo ? null : pol;
    window._radPolEditando = novo ? pol : JSON.parse(JSON.stringify(pol));
    window._radPolNova = novo;
    pol = window._radPolEditando;

    var cs = getComputedStyle(document.documentElement), cv = function (n) { return cs.getPropertyValue(n).trim(); };
    var c = { bg: cv('--bg'), card: cv('--card'), brd: cv('--border'), txt1: cv('--txt1'),
      txt2: cv('--txt2'), txt3: cv('--txt3'), teal: cv('--teal'), blue: cv('--blue'), red: cv('--red') };
    var IS = 'width:100%;background:' + c.bg + ';border:1px solid ' + c.brd + ';border-radius:6px;padding:8px 11px;' +
      'color:' + c.txt1 + ';font-size:13px;font-family:inherit;box-sizing:border-box;outline:none';

    function bloco(titulo, conteudo) {
      return '<div style="margin-bottom:20px">' +
        '<div style="font-size:10px;font-weight:700;color:' + c.txt3 + ';text-transform:uppercase;' +
        'letter-spacing:.07em;margin-bottom:9px">' + titulo + '</div>' + conteudo + '</div>';
    }
    function campo(lbl, inp, hint) {
      return '<div style="margin-bottom:12px">' +
        '<label style="display:block;font-size:11px;font-weight:600;color:' + c.txt2 + ';margin-bottom:5px">' + lbl + '</label>' +
        inp + (hint ? '<div style="font-size:10.5px;color:' + c.txt3 + ';margin-top:4px">' + hint + '</div>' : '') + '</div>';
    }

    /* Orquestração — o critério de cobertura. Ortogonal ao modo: um
       diz O QUE a política alcança, o outro QUANTA decisão humana existe. */
    var orqHtml = ORQUESTRACOES.map(function (o) {
      var sel = pol.orquestracao === o.v;
      return '<label class="rad-orq-card" data-orq="' + o.v + '" ' +
        'style="display:block;padding:10px 12px;border-radius:7px;cursor:pointer;margin-bottom:7px;' +
        'border:1px solid ' + (sel ? o.cor : c.brd) + ';background:' + (sel ? 'rgba(' + o.rgb + ',.08)' : 'transparent') + '">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
        '<input type="radio" name="rad-orq" value="' + o.v + '"' + (sel ? ' checked' : '') +
          ' onchange="radEditorOrq(this.value)" style="cursor:pointer">' +
        '<span style="font-size:12.5px;font-weight:700;color:' + o.cor + '">' + o.label + '</span></div>' +
        '<div style="font-size:11px;color:' + c.txt2 + ';margin-top:4px;line-height:1.5;padding-left:22px">' + o.desc + '</div>' +
        '<div style="font-size:10.5px;color:' + c.txt3 + ';margin-top:3px;line-height:1.45;padding-left:22px">' + o.hint + '</div>' +
        '</label>';
    }).join('');

    // Modo — cartões clicáveis, cada um explicando o que delega
    var modosHtml = MODOS.map(function (m) {
      var sel = pol.modo === m.v;
      return '<label style="display:block;padding:10px 12px;border-radius:7px;cursor:pointer;margin-bottom:7px;' +
        'border:1px solid ' + (sel ? m.cor : c.brd) + ';background:' + (sel ? 'rgba(' + m.rgb + ',.08)' : 'transparent') + '">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
        '<input type="radio" name="rad-modo" value="' + m.v + '"' + (sel ? ' checked' : '') +
          ' onchange="radEditorModoMudou(this.value)" style="cursor:pointer">' +
        '<span style="font-size:12.5px;font-weight:700;color:' + m.cor + '">' + m.label + '</span>' +
        (m.recomendado ? '<span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:3px;' +
          'letter-spacing:.04em;background:rgba(var(--teal-rgb),.15);color:var(--teal)">RECOMENDADO</span>' : '') +
        '</div>' +
        '<div style="font-size:11px;color:' + c.txt2 + ';margin-top:4px;line-height:1.5;padding-left:22px">' + m.desc + '</div>' +
        '</label>';
    }).join('');

    var diasHtml = '<div style="display:flex;flex-wrap:wrap;gap:4px">' +
      [1, 5, 10, 15, 20, 25, 28].map(function (d) {
        var on = pol.diasExecucao.indexOf(d) >= 0;
        return '<button type="button" data-dia="' + d + '" onclick="radToggleDia(' + d + ',this)" ' +
          'style="min-width:34px;padding:5px 8px;border-radius:6px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;' +
          'border:1px solid ' + (on ? c.teal : c.brd) + ';background:' + (on ? 'rgba(var(--teal-rgb),.12)' : 'transparent') +
          ';color:' + (on ? c.teal : c.txt2) + '">' + d + '</button>';
      }).join('') + '</div>';

    /* Só conexões do tipo rad_erp entregam guia: as de entrada não têm
       endpoint de destino, e as de outros contextos não emitem estes
       eventos. Sem o filtro, a política ofereceria destinos inválidos. */
    var intgOpts = '<option value="">Somente plataforma — não emite webhook</option>' +
      (window._radIntegracoes || []).filter(ehConexaoRad).map(function (i) {
        return '<option value="' + i.id + '"' + (pol.integracaoId === i.id ? ' selected' : '') + '>' +
          i.nome + (i.ativo ? '' : ' (inativa)') + '</option>';
      }).join('');

    var html = '<div id="rad-editor-overlay" onclick="if(event.target===this)radFecharEditor()" ' +
      'style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9300;display:flex;justify-content:flex-end">' +
      '<div style="background:' + c.card + ';border-left:1px solid ' + c.brd + ';width:520px;max-width:96vw;height:100vh;' +
      'overflow-y:auto;display:flex;flex-direction:column">' +

      '<div style="padding:20px 24px 14px;border-bottom:1px solid ' + c.brd + ';position:sticky;top:0;background:' + c.card + ';z-index:2">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
      '<div><div style="color:' + c.blue + ';font-size:11px;font-family:var(--font-mono);margin-bottom:3px">' + pol.id +
        (novo ? ' · nova' : '') + '</div>' +
      '<div id="rad-ed-titulo" style="color:' + c.txt1 + ';font-size:16px;font-weight:700">' +
        (pol.nome || 'Nova política') + '</div>' +
      '<div id="rad-ed-cobertura-resumo" style="color:' + c.txt3 + ';font-size:11px;margin-top:2px">' +
        coberturaTexto(pol) + '</div></div>' +
      '<button onclick="radFecharEditor()" style="background:none;border:none;color:' + c.txt2 + ';font-size:22px;cursor:pointer;padding:0 4px">✕</button>' +
      '</div></div>' +

      '<div style="padding:20px 24px;flex:1">' +
      bloco('Identificação',
        campo('Nome da política',
          '<input id="rad-ed-nome" value="' + (pol.nome || '') + '" placeholder="Matriz e filiais PR" ' +
          'oninput="radEditorNome(this.value)" style="' + IS + '">',
          'aparece na listagem, na fila de execução e no histórico')) +
      bloco('Modelo de orquestração', orqHtml +
        '<div id="rad-ed-cobertura" style="margin-top:12px">' + coberturaEditorHtml(pol) + '</div>') +
      bloco('Modo de operação', modosHtml) +
      bloco('Janela de execução',
        campo('Dias do mês', diasHtml) +
        '<div class="shg2" style="gap:12px">' +
        campo('Hora', '<input id="rad-ed-hora" value="' + pol.horaExecucao + '" style="' + IS + '">') +
        campo('Antecedência', '<input id="rad-ed-antec" type="number" min="0" max="60" value="' + pol.antecedencia + '" style="' + IS + '">',
          'dias antes do vencimento') +
        '</div>' +
        '<div id="rad-ed-previa" style="font-size:11.5px;color:' + c.teal + ';background:rgba(var(--teal-rgb),.08);' +
        'border:1px solid rgba(var(--teal-rgb),.2);border-radius:6px;padding:9px 12px;line-height:1.5"></div>') +
      bloco('Critérios de inclusão',
        '<div id="rad-ed-vmin-wrap" style="display:' + (pol.orquestracao === 'valor' ? 'none' : 'block') + '">' +
        campo('Valor mínimo por guia', '<input id="rad-ed-vmin" type="number" min="0" value="' + pol.valorMinimo + '" style="' + IS + '">',
          'guias abaixo deste valor acumulam para a próxima janela') + '</div>' +
        '<div style="font-size:11px;color:' + c.txt3 + ';margin:2px 0 7px">Notas com estas flags ficam de fora do lote e aparecem na fila de decisão</div>' +
        '<div style="display:flex;flex-direction:column;gap:7px">' +
        ['glosado', 'vencido', 'inconsistencia'].map(function (f) {
          return '<label style="display:flex;align-items:center;gap:8px;font-size:12px;color:' + c.txt2 + '">' +
            '<input type="checkbox" class="rad-ed-flag" value="' + f + '"' +
            (pol.excluirFlags.indexOf(f) >= 0 ? ' checked' : '') + '> ' +
            '<span>' + (FLAG_LABEL[f] || f) + ' <code style="font-size:10.5px">' + f + '</code></span></label>';
        }).join('') +
        '</div>') +
      bloco('Destino',
        campo('Integração', '<select id="rad-ed-intg" onchange="radEditorPrevia()" style="' + IS + '">' + intgOpts + '</select>') +
        '<div id="rad-ed-saude" style="font-size:11.5px;color:' + c.txt2 + '"></div>') +
      '<div id="rad-ed-msg" style="font-size:12px;min-height:18px;margin-bottom:4px"></div>' +
      (novo ? '' : radHistoricoHtml(pol, c)) +
      '</div>' +

      '<div style="display:flex;gap:10px;padding:14px 24px;border-top:1px solid ' + c.brd + ';position:sticky;bottom:0;background:' + c.card + '">' +
      '<button onclick="radFecharEditor()" style="flex:1;padding:10px;background:none;border:1px solid ' + c.brd +
        ';color:' + c.txt2 + ';border-radius:8px;cursor:pointer;font-size:13px;font-family:inherit">Cancelar</button>' +
      '<button onclick="radSalvarPolitica()" style="flex:1.4;padding:10px;background:' + c.teal +
        ';border:none;color:#fff;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;font-family:inherit">Salvar política</button>' +
      '</div></div></div>';

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstChild);
    document.body.style.overflow = 'hidden';
    radEditorPrevia();
  };

  window.radFecharEditor = function () {
    var o = el('rad-editor-overlay'); if (o) o.remove();
    document.body.style.overflow = '';
  };

  window.radEditorNome = function (v) {
    var p = window._radPolEditando; if (!p) return;
    p.nome = v;
    var t = el('rad-ed-titulo');
    if (t) t.textContent = v || 'Nova política';
  };

  /* Trocar o modelo redesenha só o seletor de cobertura. O que estava
     marcado no modelo anterior fica guardado na política — volta se o
     usuário voltar —, mas só o do modelo corrente decide a seleção. */
  window.radEditorOrq = function (v) {
    var p = window._radPolEditando; if (!p) return;
    p.orquestracao = v;
    document.querySelectorAll('#rad-editor-overlay .rad-orq-card').forEach(function (l) {
      var o = orqCfg(l.getAttribute('data-orq')), on = o.v === v;
      l.style.borderColor = on ? o.cor : 'var(--border)';
      l.style.background = on ? 'rgba(' + o.rgb + ',.08)' : 'transparent';
      // O rádio também é acertado aqui, para a chamada direta não divergir do clique.
      var r = l.querySelector('input[name="rad-orq"]');
      if (r) r.checked = on;
    });
    var box = el('rad-ed-cobertura');
    if (box) box.innerHTML = coberturaEditorHtml(p);
    var vm = el('rad-ed-vmin-wrap');
    if (vm) vm.style.display = v === 'valor' ? 'none' : 'block';
    radEditorPrevia();
  };

  window.radEditorBase = function (v) {
    var p = window._radPolEditando; if (!p) return;
    p.baseValor = v;
    var box = el('rad-ed-cobertura');
    if (box) box.innerHTML = coberturaEditorHtml(p);
    radEditorPrevia();
  };

  window.radEdCobertura = function (campo, valor, on) {
    var p = window._radPolEditando; if (!p) return;
    var a = p[campo] || (p[campo] = []);
    var i = a.indexOf(valor);
    if (on && i < 0) a.push(valor);
    if (!on && i >= 0) a.splice(i, 1);
    radEditorPrevia();
  };

  window.radEditorModoMudou = function (v) {
    var p = window._radPolEditando; if (p) p.modo = v;
    document.querySelectorAll('#rad-editor-overlay label').forEach(function (l) {
      var r = l.querySelector('input[name="rad-modo"]');
      if (!r) return;
      var m = modoCfg(r.value), on = r.value === v;
      l.style.borderColor = on ? m.cor : 'var(--border)';
      l.style.background = on ? 'rgba(' + m.rgb + ',.08)' : 'transparent';
    });
    radEditorPrevia();
  };

  window.radToggleDia = function (d, btn) {
    var p = window._radPolEditando; if (!p) return;
    var i = p.diasExecucao.indexOf(d);
    if (i >= 0) p.diasExecucao.splice(i, 1); else p.diasExecucao.push(d);
    p.diasExecucao.sort(function (a, b) { return a - b; });
    var on = p.diasExecucao.indexOf(d) >= 0;
    btn.style.borderColor = on ? 'var(--teal)' : 'var(--border)';
    btn.style.background = on ? 'rgba(var(--teal-rgb),.12)' : 'transparent';
    btn.style.color = on ? 'var(--teal)' : 'var(--txt2)';
    radEditorPrevia();
  };

  /* Simulação — converte a política de promessa em número conferível.
     Sem isso o usuário configura no escuro e descobre o efeito quando
     já virou dinheiro. */
  window.radEditorPrevia = function () {
    var p = window._radPolEditando; if (!p) return;
    var prev = el('rad-ed-previa'); if (!prev) return;

    p.horaExecucao = (el('rad-ed-hora') || {}).value || p.horaExecucao;
    p.antecedencia = parseInt((el('rad-ed-antec') || {}).value, 10) || 0;
    p.valorMinimo = parseFloat((el('rad-ed-vmin') || {}).value) || 0;
    if (p.orquestracao === 'valor') {
      p.baseValor = (el('rad-ed-base') || {}).value || p.baseValor || 'cbs_ibs';
      p.faixaMin = parseFloat((el('rad-ed-faixa-min') || {}).value) || 0;
      var _max = (el('rad-ed-faixa-max') || {}).value;
      p.faixaMax = _max === '' || _max === undefined ? null : parseFloat(_max);
    }
    var _res = el('rad-ed-cobertura-resumo');
    if (_res) _res.textContent = coberturaTexto(p);
    p.integracaoId = (el('rad-ed-intg') || {}).value || null;

    var _vazia = p.orquestracao === 'cnpj' ? !(p.cnpjs || []).length
               : p.orquestracao === 'contrato' ? !(p.contratos || []).length
               : false;

    if (p.modo === 'manual') {
      prev.innerHTML = 'Modo manual: o motor não gera nada. As guias cobertas por esta política ' +
        'continuam dependendo de seleção na aba <strong>Guias RAD</strong>.';
      prev.style.color = 'var(--txt2)';
    } else if (_vazia) {
      prev.innerHTML = p.orquestracao === 'cnpj'
        ? 'Selecione ao menos um CNPJ para a política cobrir.'
        : 'Selecione ao menos um contrato para a política cobrir.';
      prev.style.color = 'var(--red)';
    } else if (!p.diasExecucao.length) {
      prev.innerHTML = 'Selecione ao menos um dia de execução.';
      prev.style.color = 'var(--red)';
    } else {
      var lote = montarLote(p);
      var _destino = p.modo === 'automatico'
        ? ' e seguiria direto ao ERP, sem intervenção'
        : ' e aguardaria aprovação a cada janela';
      prev.innerHTML = 'Executa <strong>dias ' + p.diasExecucao.join(', ') + '</strong> às ' + p.horaExecucao +
        ', incluindo guias que vencem em até ' + p.antecedencia + ' dias.<br>' +
        'Hoje isso produziria <strong>' + lote.qtd + ' guia(s)</strong> somando <strong>' + fmtBRL(lote.total) + '</strong>' + _destino +
        (lote.bloqueados.length ? '<br><span style="color:var(--amber)">' + lote.bloqueados.length +
          ' retida(s) por flag de exclusão</span>' : '');
      prev.style.color = 'var(--teal)';
    }

    var saude = el('rad-ed-saude');
    if (saude) {
      var i = integracaoPorId(p.integracaoId);
      if (!i) { saude.innerHTML = '<span style="color:var(--txt3)">Guias geradas ficam só na plataforma.</span>'; }
      else {
        var s = saudeIntegracao(i);
        saude.innerHTML = '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:' +
          s.cor + ';margin-right:6px"></span>Taxa de entrega <strong>' + s.label + '</strong> · ' +
          i.entregas + ' envios, ' + i.falhas + ' falhas' + (i.ativo ? '' : ' · <span style="color:var(--amber)">conexão inativa</span>');
      }
    }
  };

  window.radSalvarPolitica = function () {
    var p = window._radPolEditando; if (!p) return;
    var msg = el('rad-ed-msg');
    var setMsg = function (t, cor) { if (msg) { msg.textContent = t; msg.style.color = cor; } };

    radEditorPrevia();
    if (!(p.nome || '').trim()) {
      return setMsg('Informe um nome para a política.', 'var(--red)');
    }
    if (p.orquestracao === 'cnpj' && !(p.cnpjs || []).length) {
      return setMsg('Orquestração por CNPJ: selecione ao menos um CNPJ.', 'var(--red)');
    }
    if (p.orquestracao === 'contrato' && !(p.contratos || []).length) {
      return setMsg('Orquestração por contrato: selecione ao menos um contrato.', 'var(--red)');
    }
    if (p.orquestracao === 'valor') {
      if (p.faixaMax !== null && p.faixaMax !== undefined && p.faixaMax <= (p.faixaMin || 0)) {
        return setMsg('O valor máximo precisa ser maior que o mínimo.', 'var(--red)');
      }
    }
    /* Cobertura repetida dentro do mesmo modelo é duplicidade certa, não
       um risco: a mesma guia sairia duas vezes. Barra o salvamento. */
    var conflitos = conflitoCobertura(p, window._radPolNova ? null : p.id);
    if (conflitos.length) {
      var c0 = conflitos[0];
      return setMsg('Cobertura já usada por ' + c0.politica.id + ' (' + (c0.politica.nome || '') + '): ' +
        c0.item + '.', 'var(--red)');
    }
    if (p.modo !== 'manual' && !p.diasExecucao.length) {
      return setMsg('Informe ao menos um dia de execução.', 'var(--red)');
    }
    if (p.modo !== 'manual' && !p.integracaoId) {
      setMsg('Atenção: sem integração, as guias ficam só na plataforma.', 'var(--amber)');
    }

    p.excluirFlags = [].slice.call(document.querySelectorAll('.rad-ed-flag:checked'))
      .map(function (c) { return c.value; });
    p.ativo = p.modo !== 'manual';

    p.nome = (p.nome || '').trim();
    if (window._radPolNova) {
      radRegistrarEvento(p, 'criacao', [
        { campo: 'Orquestração', de: '—', para: orqCfg(p.orquestracao).label },
        { campo: 'Cobertura', de: '—', para: coberturaTexto(p) },
        { campo: 'Modo', de: '—', para: modoCfg(p.modo).label },
        { campo: 'Janela', de: '—', para: janelaTexto(p) }
      ], 'Política criada com orquestração ' + orqCfg(p.orquestracao).label.toLowerCase() + '.');
      window._radPoliticas.push(p);
      window._radPolNova = false;
    } else {
      var orig = window._radPolOriginal;
      var alteracoes = radDiff(orig, p);
      Object.keys(p).forEach(function (k) { if (k !== 'historico') orig[k] = p[k]; });
      radRegistrarEvento(orig, 'edicao', alteracoes, alteracoes.length ? '' : 'Salvo sem alteração de parâmetro.');
      p = orig;
    }

    invalidarIndice();
    window.radFecharEditor();
    window.radPoliticasRenderTabela();
    window.radPoliticasRenderKPIs();
    if (window.radExecRender) window.radExecRender();
    radToast('Política salva e registrada no histórico.');
  };

  // ══════════════════════════════════════════════════════════
  // Toast
  // ══════════════════════════════════════════════════════════
  function radToast(txt) {
    var t = el('rad-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'rad-toast';
      t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9500;' +
        'background:var(--teal);color:#fff;padding:11px 22px;border-radius:8px;font-size:13px;font-weight:600;' +
        'box-shadow:0 6px 24px rgba(0,0,0,.3);opacity:0;transition:opacity .2s';
      document.body.appendChild(t);
    }
    t.textContent = txt;
    t.style.opacity = '1';
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.style.opacity = '0'; }, 2600);
  }
  window.radToast = radToast;

  // ══════════════════════════════════════════════════════════
  // Inicialização
  // ══════════════════════════════════════════════════════════
  /* A view pode ser aberta antes de a carga de dados terminar. Reagenda
     enquanto _orgCnpjs não estiver populado, com teto para não girar
     indefinidamente se a carga falhar. */
  window.radInit = function (tentativa) {
    tentativa = tentativa || 0;
    if (!(window._orgCnpjs || []).length && tentativa < 20) {
      return setTimeout(function () { window.radInit(tentativa + 1); }, 150);
    }
    var selIntg = el('rad-filtro-integracao');
    if (selIntg && selIntg.options.length <= 1) {
      (window._radIntegracoes || []).filter(ehConexaoRad).forEach(function (i) {
        var o = document.createElement('option');
        o.value = i.id; o.textContent = i.nome;
        selIntg.appendChild(o);
      });
    }
    window.radPoliticasRenderKPIs();
    window.radPoliticasRenderTabela();
  };

})();

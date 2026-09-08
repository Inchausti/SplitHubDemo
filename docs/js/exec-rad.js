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

  var MODOS = [
    { v: 'manual', label: 'Manual', cor: 'var(--txt3)', rgb: 'var(--status-gray-rgb)',
      desc: 'O motor não age. Toda guia depende de seleção e geração manual na aba Guias RAD.' },
    { v: 'assistido', label: 'Assistido', cor: 'var(--blue)', rgb: 'var(--blue-rgb)',
      desc: 'O motor monta o lote na janela e notifica. A geração só ocorre após aprovação humana.' },
    { v: 'automatico', label: 'Automático', cor: 'var(--teal)', rgb: 'var(--teal-rgb)',
      desc: 'O motor gera, aprova dentro da alçada e emite o webhook. O humano trata apenas exceções.' }
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

  // T-01/T-02 — Política de execução por CNPJ comprador.
  // Eixo ortogonal ao contrato: contrato define QUEM recolhe (por CNPJ
  // fornecedor); a política define QUANDO e COMO a empresa executa.
  window._radPoliticas = [
    { id: 'POL-0001', cnpjComprador: '54.891.237/0001-48', modo: 'automatico',
      diasExecucao: [5, 20], horaExecucao: '06:00', antecedencia: 5,
      valorMinimo: 0, excluirFlags: ['glosado'],
      alcadaAtiva: true, limiteAutoAprovacao: 50000, aprovadores: ['tesouraria@induspar.com'],
      integracaoId: 'INT-0001', ativo: true, ultimaExecucao: '05/09/2026 06:00',
      historico: [] },
    { id: 'POL-0002', cnpjComprador: '54.891.237/0002-29', modo: 'assistido',
      diasExecucao: [1, 15], horaExecucao: '07:00', antecedencia: 7,
      valorMinimo: 500, excluirFlags: ['glosado'],
      alcadaAtiva: false, limiteAutoAprovacao: 20000, aprovadores: ['tesouraria@induspar.com', 'cfo@induspar.com'],
      integracaoId: 'INT-0002', ativo: true, ultimaExecucao: '01/09/2026 07:00',
      historico: [] },
    { id: 'POL-0003', cnpjComprador: '54.891.237/0003-00', modo: 'assistido',
      diasExecucao: [10], horaExecucao: '08:00', antecedencia: 3,
      valorMinimo: 0, excluirFlags: ['glosado'],
      alcadaAtiva: false, limiteAutoAprovacao: 15000, aprovadores: ['fiscal@induspar.com'],
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
  function politicaPorCnpj(cnpj) {
    return (window._radPoliticas || []).find(function (p) { return p.cnpjComprador === cnpj; }) || null;
  }
  window.radPoliticaPorCnpj = politicaPorCnpj;

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


  /* Aplica os critérios da política sobre os RFs RAD do CNPJ comprador:
     filtra por método, prazo, valor e flags de exclusão. As notas que
     batem numa flag são separadas em vez de descartadas — a política
     retém, e a fila de decisão mostra o porquê. */
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
        if (v < (pol.valorMinimo || 0)) return;

        var flags = (rf.statusFlags || []).concat(rf.statusCredito === 'glosado' ? ['glosado'] : []);
        var atingidas = (pol.excluirFlags || []).filter(function (f) { return flags.indexOf(f) >= 0; });
        var bloqueado = atingidas.length > 0;

        out.push({
          rfId: rf.id, dfeKey: rf.chaveDF || nf.chave || '',
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
     retido. A separação é o que permite T-04 §2 tratar bloqueio e
     alçada como filas distintas, com donos distintos. */
  function montarLote(pol) {
    var eleg = selecionarElegiveis(pol);
    var incluidos = eleg.filter(function (r) { return !r.bloqueado; });
    var bloqueados = eleg.filter(function (r) { return r.bloqueado; });
    var total = incluidos.reduce(function (s, r) { return s + r.valor; }, 0);
    // Alçada é opcional: desativada, o lote não é retido por valor.
    var excedeAlcada = !!pol.alcadaAtiva && total > (pol.limiteAutoAprovacao || 0);
    return {
      politicaId: pol.id, cnpj: pol.cnpjComprador,
      incluidos: incluidos, bloqueados: bloqueados,
      qtd: incluidos.length, total: total,
      excedeAlcada: excedeAlcada,
      status: bloqueados.length && !incluidos.length ? 'bloqueado'
            : excedeAlcada || pol.modo === 'assistido' ? 'aguardando_aprovacao'
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
    setTxt('rad-kpi-ativos', ativas.length + '/' + (window._orgCnpjs || []).length);

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
    var fIntg = (el('rad-filtro-integracao') || {}).value || '';
    var busca = ((el('rad-busca') || {}).value || '').trim().toLowerCase();

    var linhas = (window._orgCnpjs || []).map(function (o) {
      var p = politicaPorCnpj(o.cnpj);
      return { org: o, pol: p, modo: p ? p.modo : 'manual' };
    }).filter(function (r) {
      if (fModo && r.modo !== fModo) return false;
      if (fIntg && (!r.pol || r.pol.integracaoId !== fIntg)) return false;
      if (busca) {
        var alvo = (r.org.cnpj + ' ' + r.org.razao + ' ' + r.org.uf).toLowerCase();
        if (alvo.indexOf(busca) === -1) return false;
      }
      return true;
    });

    if (window.ShColMgr && ShColMgr.sortRows) {
      // projeção plana para o gerenciador de colunas
      window._radPoliticasLista = linhas.map(function (r) {
        var intg = r.pol ? integracaoPorId(r.pol.integracaoId) : null;
        return {
          cnpj: r.org.cnpj, estabelecimento: r.org.razao + ' — ' + r.org.uf,
          modo: modoCfg(r.modo).label,
          janela: r.pol ? janelaTexto(r.pol) : '—',
          antecedencia: r.pol ? r.pol.antecedencia + ' dias' : '—',
          alcada: r.pol ? fmtBRL(r.pol.limiteAutoAprovacao) : '—',
          integracao: intg ? intg.nome : '—',
          ultimaExecucao: r.pol ? r.pol.ultimaExecucao : '—',
          situacao: r.pol && r.pol.ativo ? 'Ativa' : r.pol ? 'Pausada' : 'Sem política'
        };
      });
    }

    var h = '';
    linhas.forEach(function (r) {
      var p = r.pol, m = modoCfg(r.modo);
      var intg = p ? integracaoPorId(p.integracaoId) : null;
      var saude = saudeIntegracao(intg);
      var pontoSaude = intg
        ? '<span title="Taxa de entrega ' + saude.label + '" style="display:inline-block;width:7px;height:7px;' +
          'border-radius:50%;background:' + saude.cor + ';margin-right:6px;flex-shrink:0"></span>'
        : '';
      var situacao = !p ? badge('Sem política', 'var(--txt3)', 'var(--status-gray-rgb)')
                   : p.ativo ? badge('Ativa', 'var(--green)', 'var(--status-green-rgb)')
                   : badge('Pausada', 'var(--amber)', 'var(--status-amber-rgb)');

      h += '<tr onclick="radAbrirEditor(\'' + r.org.cnpj + '\')" style="cursor:pointer">' +
        '<td style="text-align:center"><input type="checkbox" class="rad-pol-chk" data-cnpj="' + r.org.cnpj +
          '" onclick="event.stopPropagation()" onchange="radAtualizarSelecao()" style="cursor:pointer;width:14px;height:14px"></td>' +
        '<td class="mono" style="font-size:11px">' + r.org.cnpj + '</td>' +
        '<td><div style="font-weight:500">' + r.org.razao + '</div>' +
          '<div style="font-size:10px;color:var(--txt2)">' + r.org.uf + ' · ' + r.org.tipo + '</div></td>' +
        '<td>' + badge(m.label, m.cor, m.rgb) + '</td>' +
        '<td style="font-size:12px;white-space:nowrap">' + (p ? janelaTexto(p) : '—') + '</td>' +
        '<td style="font-size:12px;white-space:nowrap">' + (p ? 'D-' + p.antecedencia : '—') + '</td>' +
        '<td class="r mono" style="font-size:11px">' + (p ? fmtBRL(p.limiteAutoAprovacao) : '—') + '</td>' +
        '<td style="font-size:11px"><span style="display:inline-flex;align-items:center">' + pontoSaude +
          (intg ? intg.nome : '<span style="color:var(--txt3)">—</span>') + '</span></td>' +
        '<td style="font-size:11px;color:var(--txt2);white-space:nowrap">' + (p ? p.ultimaExecucao : '—') + '</td>' +
        '<td>' + situacao + '</td></tr>';
    });

    if (!linhas.length) {
      h = '<tr><td colspan="10" style="text-align:center;color:var(--txt3);padding:24px">' +
          'Nenhum CNPJ encontrado para este filtro.</td></tr>';
    }
    tbody.innerHTML = h;

    var cnt = el('rad-contagem');
    if (cnt) cnt.textContent = linhas.length + ' de ' + (window._orgCnpjs || []).length + ' CNPJs';
    if (window.ShColMgr && ShColMgr.afterRender) { try { ShColMgr.afterRender('rad-politicas'); } catch (e) {} }
    window.radAtualizarSelecao();
  };

  window.radAtualizarSelecao = function () {
    var chks = document.querySelectorAll('.rad-pol-chk:checked');
    var bar = el('rad-lote-bar');
    if (!bar) return;
    if (chks.length) {
      bar.style.display = 'flex';
      setTxt('rad-lote-info', chks.length + ' CNPJ' + (chks.length > 1 ? 's' : '') + ' selecionado' + (chks.length > 1 ? 's' : ''));
    } else { bar.style.display = 'none'; }
  };

  window.radToggleTodos = function (chk) {
    document.querySelectorAll('.rad-pol-chk').forEach(function (c) { c.checked = chk.checked; });
    window.radAtualizarSelecao();
  };

  // Ativação e pausa em massa — útil em fechamento ou incidente
  window.radAlterarAtivacaoLote = function (ativar) {
    var cnpjs = [].slice.call(document.querySelectorAll('.rad-pol-chk:checked'))
      .map(function (c) { return c.getAttribute('data-cnpj'); });
    var n = 0;
    cnpjs.forEach(function (cnpj) {
      var p = politicaPorCnpj(cnpj);
      if (p && p.ativo !== ativar) {
        p.ativo = ativar;
        radRegistrarEvento(p, ativar ? 'ativacao' : 'pausa', [], 'Alteração em lote pela listagem.');
        n++;
      }
    });
    document.querySelectorAll('.rad-pol-chk').forEach(function (c) { c.checked = false; });
    window.radPoliticasRenderTabela();
    window.radPoliticasRenderKPIs();
    if (n) radToast(n + ' política(s) ' + (ativar ? 'ativada(s)' : 'pausada(s)') + '.');
  };

  window.radLimparFiltros = function () {
    ['rad-busca', 'rad-filtro-modo', 'rad-filtro-integracao'].forEach(function (id) {
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
    radHistorico(pol).push({
      ts: agoraISO(), tipo: tipo,
      usuario: window.CONTRATO_USUARIO_ATUAL || 'José da Silva',
      alteracoes: alteracoes || [], obs: obs || ''
    });
  }
  window.radRegistrarEvento = radRegistrarEvento;

  function radDiff(antes, depois) {
    var campos = [
      { k: 'modo', label: 'Modo', fmt: function (v) { return modoCfg(v).label; } },
      { k: 'diasExecucao', label: 'Dias de execução', fmt: function (v) { return (v || []).join(', '); } },
      { k: 'horaExecucao', label: 'Hora', fmt: function (v) { return v; } },
      { k: 'antecedencia', label: 'Antecedência', fmt: function (v) { return v + ' dias'; } },
      { k: 'valorMinimo', label: 'Valor mínimo', fmt: fmtBRL },
      { k: 'alcadaAtiva', label: 'Alçada', fmt: function (v) { return v ? 'ativa' : 'desativada'; } },
      { k: 'limiteAutoAprovacao', label: 'Limite da alçada', fmt: fmtBRL },
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

  window.radAbrirEditor = function (cnpj) {
    var org = orgPorCnpj(cnpj);
    if (!org) return;
    var pol = politicaPorCnpj(cnpj);
    var novo = !pol;
    if (novo) {
      pol = { id: 'POL-' + String((window._radPoliticas || []).length + 1).padStart(4, '0'),
        cnpjComprador: cnpj, modo: 'manual', diasExecucao: [5], horaExecucao: '06:00',
        antecedencia: 5, valorMinimo: 0, excluirFlags: ['glosado'],
        alcadaAtiva: false, limiteAutoAprovacao: 20000, aprovadores: [], integracaoId: null, ativo: false,
        ultimaExecucao: '—', historico: [] };
    }
    window._radPolEditando = pol;
    window._radPolNova = novo;

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

    // Modo — cartões clicáveis, cada um explicando o que delega
    var modosHtml = MODOS.map(function (m) {
      var sel = pol.modo === m.v;
      return '<label style="display:block;padding:10px 12px;border-radius:7px;cursor:pointer;margin-bottom:7px;' +
        'border:1px solid ' + (sel ? m.cor : c.brd) + ';background:' + (sel ? 'rgba(' + m.rgb + ',.08)' : 'transparent') + '">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
        '<input type="radio" name="rad-modo" value="' + m.v + '"' + (sel ? ' checked' : '') +
          ' onchange="radEditorModoMudou(this.value)" style="cursor:pointer">' +
        '<span style="font-size:12.5px;font-weight:700;color:' + m.cor + '">' + m.label + '</span></div>' +
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

    var intgOpts = '<option value="">Somente plataforma — não emite webhook</option>' +
      (window._radIntegracoes || []).map(function (i) {
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
      '<div style="color:' + c.txt1 + ';font-size:16px;font-weight:700">' + org.razao + '</div>' +
      '<div style="color:' + c.txt3 + ';font-size:11px;font-family:var(--font-mono);margin-top:2px">' + org.cnpj + ' · ' + org.uf + '</div></div>' +
      '<button onclick="radFecharEditor()" style="background:none;border:none;color:' + c.txt2 + ';font-size:22px;cursor:pointer;padding:0 4px">✕</button>' +
      '</div></div>' +

      '<div style="padding:20px 24px;flex:1">' +
      bloco('Modo de operação', modosHtml) +
      bloco('Janela de execução',
        campo('Dias do mês', diasHtml) +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        campo('Hora', '<input id="rad-ed-hora" value="' + pol.horaExecucao + '" style="' + IS + '">') +
        campo('Antecedência', '<input id="rad-ed-antec" type="number" min="0" max="60" value="' + pol.antecedencia + '" style="' + IS + '">',
          'dias antes do vencimento') +
        '</div>' +
        '<div id="rad-ed-previa" style="font-size:11.5px;color:' + c.teal + ';background:rgba(var(--teal-rgb),.08);' +
        'border:1px solid rgba(var(--teal-rgb),.2);border-radius:6px;padding:9px 12px;line-height:1.5"></div>') +
      bloco('Critérios de inclusão',
        campo('Valor mínimo por guia', '<input id="rad-ed-vmin" type="number" min="0" value="' + pol.valorMinimo + '" style="' + IS + '">',
          'guias abaixo deste valor acumulam para a próxima janela') +
        '<div style="font-size:11px;color:' + c.txt3 + ';margin:2px 0 7px">Notas com estas flags ficam de fora do lote e aparecem na fila de decisão</div>' +
        '<div style="display:flex;flex-direction:column;gap:7px">' +
        ['glosado', 'vencido', 'inconsistencia'].map(function (f) {
          return '<label style="display:flex;align-items:center;gap:8px;font-size:12px;color:' + c.txt2 + '">' +
            '<input type="checkbox" class="rad-ed-flag" value="' + f + '"' +
            (pol.excluirFlags.indexOf(f) >= 0 ? ' checked' : '') + '> ' +
            '<span>' + (FLAG_LABEL[f] || f) + ' <code style="font-size:10.5px">' + f + '</code></span></label>';
        }).join('') +
        '</div>') +
      bloco('Alçada de aprovação <span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:3px;' +
        'background:rgba(var(--status-amber-rgb),.14);color:' + c.txt2 + ';margin-left:6px;letter-spacing:.04em">OPCIONAL · MOCK</span>',
        '<label style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:' + c.txt2 + ';margin-bottom:10px;cursor:pointer">' +
        '<input type="checkbox" id="rad-ed-alcada-ativa"' + (pol.alcadaAtiva ? ' checked' : '') +
        ' onchange="radToggleAlcada(this.checked)" style="margin-top:2px"> ' +
        '<span>Reter lotes acima de um valor para aprovação humana</span></label>' +
        '<div style="font-size:11px;color:' + c.txt3 + ';line-height:1.55;margin-bottom:12px">' +
        'O modo já define quanta decisão humana existe — assistido aprova todo lote, automático não aprova nenhum. ' +
        'A alçada é um segundo controle, por valor, para quem quer que o automático pare acima de um teto.</div>' +
        '<div id="rad-ed-alcada-campos" style="display:' + (pol.alcadaAtiva ? 'block' : 'none') + '">' +
        campo('Limite de auto-aprovação', '<input id="rad-ed-alcada" type="number" min="0" value="' + pol.limiteAutoAprovacao + '" style="' + IS + '">',
          'lotes acima deste valor vão para a fila de aprovação') +
        campo('Aprovadores', '<input id="rad-ed-aprov" value="' + (pol.aprovadores || []).join(', ') + '" placeholder="email@empresa.com" style="' + IS + '">',
          'separados por vírgula') +
        '<div style="font-size:11px;color:' + c.txt3 + ';font-style:italic">Mockado nesta versão: a fila é montada e exibida, mas aprovar não dispara emissão real.</div>' +
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
    p.alcadaAtiva = !!(el('rad-ed-alcada-ativa') || {}).checked;
    p.limiteAutoAprovacao = parseFloat((el('rad-ed-alcada') || {}).value) || 0;
    p.integracaoId = (el('rad-ed-intg') || {}).value || null;

    if (p.modo === 'manual') {
      prev.innerHTML = 'Modo manual: o motor não gera nada. As guias deste CNPJ continuam ' +
        'dependendo de seleção na aba <strong>Guias RAD</strong>.';
      prev.style.color = 'var(--txt2)';
    } else if (!p.diasExecucao.length) {
      prev.innerHTML = 'Selecione ao menos um dia de execução.';
      prev.style.color = 'var(--red)';
    } else {
      var lote = montarLote(p);
      prev.innerHTML = 'Executa <strong>dias ' + p.diasExecucao.join(', ') + '</strong> às ' + p.horaExecucao +
        ', incluindo guias que vencem em até ' + p.antecedencia + ' dias.<br>' +
        'Hoje isso produziria <strong>' + lote.qtd + ' guia(s)</strong> somando <strong>' + fmtBRL(lote.total) + '</strong>' +
        (lote.excedeAlcada ? ' — <span style="color:var(--amber);font-weight:600">acima da alçada, iria para aprovação</span>'
                           : (p.alcadaAtiva ? ' — dentro da alçada' : '')) +
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

  window.radToggleAlcada = function (on) {
    var box = el('rad-ed-alcada-campos');
    if (box) box.style.display = on ? 'block' : 'none';
    radEditorPrevia();
  };

  window.radSalvarPolitica = function () {
    var p = window._radPolEditando; if (!p) return;
    var msg = el('rad-ed-msg');
    var setMsg = function (t, cor) { if (msg) { msg.textContent = t; msg.style.color = cor; } };

    radEditorPrevia();
    if (p.modo !== 'manual' && !p.diasExecucao.length) {
      return setMsg('Informe ao menos um dia de execução.', 'var(--red)');
    }
    if (p.alcadaAtiva && !(p.limiteAutoAprovacao > 0)) {
      return setMsg('Com alçada ativa, informe um limite maior que zero.', 'var(--red)');
    }
    if (p.modo !== 'manual' && !p.integracaoId) {
      setMsg('Atenção: sem integração, as guias ficam só na plataforma.', 'var(--amber)');
    }

    p.excluirFlags = [].slice.call(document.querySelectorAll('.rad-ed-flag:checked'))
      .map(function (c) { return c.value; });
    p.aprovadores = ((el('rad-ed-aprov') || {}).value || '').split(',')
      .map(function (s) { return s.trim(); }).filter(Boolean);
    p.ativo = p.modo !== 'manual';

    var existente = politicaPorCnpj(p.cnpjComprador);
    if (window._radPolNova && !existente) {
      radRegistrarEvento(p, 'criacao', [
        { campo: 'Modo', de: '—', para: modoCfg(p.modo).label },
        { campo: 'Janela', de: '—', para: janelaTexto(p) },
        { campo: 'Alçada', de: '—', para: fmtBRL(p.limiteAutoAprovacao) }
      ], 'Política criada para o CNPJ ' + p.cnpjComprador + '.');
      window._radPoliticas.push(p);
    } else {
      radRegistrarEvento(p, 'edicao', [], '');
    }

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
      (window._radIntegracoes || []).forEach(function (i) {
        var o = document.createElement('option');
        o.value = i.id; o.textContent = i.nome;
        selIntg.appendChild(o);
      });
    }
    window.radPoliticasRenderKPIs();
    window.radPoliticasRenderTabela();
  };

})();

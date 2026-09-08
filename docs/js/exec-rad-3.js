/* ============================================================
   SplitHub — Execução Automática de RAD (parte 3)
   T-05 listagem · T-06 modal de guia · T-07 comprovante
   T-08 organização

   Enriquece os RFs com os campos que a API de RAD devolve e que o
   protótipo não modelava: darf_id, guide_number, return_code, a
   decomposição do valor (principal/multa/juros) e o rastreamento na
   Receita. Os valores são derivados de seed do rfId para permanecerem
   estáveis entre renders.
   ============================================================ */
(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }
  function fmtBRL(v) {
    return 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Seed determinística — mesma abordagem já usada na geração da guia
  function seedDe(str) {
    var h = 0, s = String(str || '');
    for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }
  function rng(seed) {
    var s = seed;
    return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }

  // ══════════════════════════════════════════════════════════
  // ENRIQUECIMENTO — campos da API
  // ══════════════════════════════════════════════════════════

  /* Deriva os campos que a API devolveria para um RF.
     Em produção estes valores chegam pelo webhook rad.darf_recebida;
     aqui são derivados por seed para dar estabilidade à demonstração. */
  window.radEnriquecerRF = function (r) {
    if (!r || !r.rfId) return r;
    if (r._radEnriquecido) return r;

    var seed = seedDe(r.rfId);
    var rnd = rng(seed);
    var isIBS = (r.tipo || '').indexOf('IBS') >= 0;

    // return_code — a maioria gera, mas dois casos de erro existem e
    // precisam de tratamento na interface
    var q = seed % 100;
    // Erro de geração só faz sentido em guia ainda não paga — guia paga
    // necessariamente foi gerada com sucesso. Como a maior parte da base
    // está paga, a faixa de erro é aplicada sobre as pendentes.
    var rc = 'DARF_GERADO';
    if (!r.pago) {
      rc = q < 14 ? 'DFE_NAO_ENCONTRADO'
         : q < 24 ? 'VALOR_PARCIAL_SUPERIOR_DFE'
         : 'DARF_GERADO';
    }

    r.returnCode = rc;
    r.darfId = 'darf_' + seed.toString(16).slice(0, 6);
    r.guideNumber = rc === 'DARF_GERADO'
      ? (isIBS ? '6912' : '5952') + String(seed % 1000000000).padStart(9, '0')
      : null;

    // Vencimento: mantém a regra do protótipo (data do RF + 15 dias)
    var dp = (r.dataRFIso || '').split('-');
    if (dp.length === 3) {
      var d = new Date(+dp[0], +dp[1] - 1, +dp[2] + 15);
      var p = function (n) { return String(n).padStart(2, '0'); };
      r.dueDate = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
      r.dueDateBR = p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
    }

    // Decomposição do valor — a API separa principal, multa e juros.
    // O protótipo tratava a guia como valor único; guia em atraso passa
    // a mostrar quanto do total é penalidade.
    var atrasada = r.statusCredito === 'nao_apropriado' && !r.pago && q < 30;
    r.principalValue = r.valor || 0;
    r.penaltyValue = atrasada ? Math.round(r.principalValue * 0.02 * 100) / 100 : 0;
    r.interestValue = atrasada ? Math.round(r.principalValue * 0.01 * 100) / 100 : 0;
    r.totalValue = Math.round((r.principalValue + r.penaltyValue + r.interestValue) * 100) / 100;

    r.pdfLink = rc === 'DARF_GERADO'
      ? 'https://api.splithub.com.br/v1/darf/' + r.darfId + '.pdf' : null;
    r.pixKey = isIBS ? '50873548000108' : '00394460005753';

    // Origem: RFs de CNPJ com política ativa contam como automáticos
    var pol = window.radPoliticaPorCnpj
      ? window.radPoliticaPorCnpj('54.891.237/0001-48') : null;
    r.origemGeracao = (pol && pol.ativo && pol.modo !== 'manual' && q % 3 !== 0)
      ? 'automatica' : 'manual';
    r.politicaId = r.origemGeracao === 'automatica' && pol ? pol.id : null;

    // Estado da entrega do webhook ao ERP
    if (rc !== 'DARF_GERADO') {
      r.entregaStatus = null;
    } else if (r.pago) {
      r.entregaStatus = 'entregue';
    } else {
      r.entregaStatus = q < 12 ? 'falha' : q < 20 ? 'pendente' : 'entregue';
    }
    r.entregaTentativas = r.entregaStatus === 'falha' ? 4 : r.entregaStatus === 'pendente' ? 2 : 1;

    // rastreamento_rfb — só existe após o comprovante ser processado
    if (r.pago) {
      var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      var prot = '', n = seed;
      for (var i = 0; i < 12; i++) { prot += chars[n % 36]; n = Math.floor(n / 7) + i * 11 + 3; }
      r.protocoloRfb = 'RFB' + prot;
      r.statusRdoc = q < 8 ? 'PROCESSANDO' : 'CONFIRMADO';
      r.dataConfirmacaoRfb = r.pagamento && r.pagamento !== '—'
        ? r.pagamento.split(' ')[0] : '—';
      r.tipoPagamentoComprovante = (seed % 2 === 0) ? 'pix' : 'boleto';
    } else {
      r.protocoloRfb = null; r.statusRdoc = null; r.dataConfirmacaoRfb = null;
      r.tipoPagamentoComprovante = null;
    }

    r._radEnriquecido = true;
    return r;
  };

  // ══════════════════════════════════════════════════════════
  // T-05 — células das colunas novas
  // ══════════════════════════════════════════════════════════

  window.radCelulaOrigem = function (r) {
    if (r.origemGeracao === 'automatica') {
      return '<span title="Gerada pela política ' + (r.politicaId || '') + '" ' +
        'style="font-size:9.5px;font-weight:700;letter-spacing:.05em;padding:2px 7px;border-radius:4px;' +
        'color:var(--teal);background:rgba(var(--teal-rgb),.12);border:1px solid rgba(var(--teal-rgb),.28);' +
        'white-space:nowrap">AUTO</span>';
    }
    return '<span style="font-size:9.5px;font-weight:700;letter-spacing:.05em;padding:2px 7px;border-radius:4px;' +
      'color:var(--txt3);background:rgba(var(--status-gray-rgb),.14);border:1px solid rgba(var(--status-gray-rgb),.3);' +
      'white-space:nowrap">MANUAL</span>';
  };

  window.radCelulaGuia = function (r) {
    if (r.returnCode !== 'DARF_GERADO') {
      var cfg = window.RAD_RETURN_CODES[r.returnCode] || {};
      return '<span title="' + (cfg.acao || '') + '" style="font-size:9.5px;font-weight:700;padding:2px 7px;' +
        'border-radius:4px;color:' + (cfg.cor || 'var(--red)') + ';background:rgba(var(--status-red-rgb),.1);' +
        'border:1px solid rgba(var(--status-red-rgb),.25);white-space:nowrap">' + (cfg.label || 'Erro') + '</span>';
    }
    return '<span class="mono" style="font-size:10.5px;color:var(--txt2)">' + (r.guideNumber || '—') + '</span>';
  };

  window.radCelulaEntrega = function (r) {
    if (!r.entregaStatus) return '<span style="color:var(--txt3);font-size:11px">—</span>';
    var m = {
      entregue: ['Entregue', 'var(--green)', 'var(--status-green-rgb)'],
      pendente: ['Pendente', 'var(--amber)', 'var(--status-amber-rgb)'],
      falha:    ['Falha',    'var(--red)',   'var(--status-red-rgb)']
    }[r.entregaStatus];
    var tt = r.entregaStatus === 'entregue'
      ? 'ERP confirmou o recebimento (200 OK)'
      : r.entregaTentativas + ' tentativa(s) — o ERP ainda não recebeu a guia';
    return '<span title="' + tt + '" style="font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:4px;' +
      'color:' + m[1] + ';background:rgba(' + m[2] + ',.12);border:1px solid rgba(' + m[2] + ',.28);' +
      'white-space:nowrap">' + m[0] + '</span>';
  };

  window.radCelulaRfb = function (r) {
    if (!r.statusRdoc) return '<span style="color:var(--txt3);font-size:11px">—</span>';
    var ok = r.statusRdoc === 'CONFIRMADO';
    return '<span title="Protocolo ' + r.protocoloRfb + (r.dataConfirmacaoRfb ? ' · ' + r.dataConfirmacaoRfb : '') + '" ' +
      'style="font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:4px;' +
      'color:' + (ok ? 'var(--green)' : 'var(--amber)') + ';' +
      'background:rgba(' + (ok ? 'var(--status-green-rgb)' : 'var(--status-amber-rgb)') + ',.12);' +
      'border:1px solid rgba(' + (ok ? 'var(--status-green-rgb)' : 'var(--status-amber-rgb)') + ',.28);' +
      'white-space:nowrap">' + (ok ? 'Confirmado' : 'Processando') + '</span>';
  };

  // ══════════════════════════════════════════════════════════
  // T-06 — modal de guia com dados da API
  // ══════════════════════════════════════════════════════════

  /* Guia com return_code de erro não abre o modal normal: não existe
     código de barras nem PIX para exibir. Mostra a causa e a ação. */
  window.radAbrirGuiaErro = function (r) {
    var cfg = window.RAD_RETURN_CODES[r.returnCode] || {};
    var cs = getComputedStyle(document.documentElement), cv = function (n) { return cs.getPropertyValue(n).trim(); };
    var c = { card: cv('--card'), brd: cv('--border'), txt1: cv('--txt1'), txt2: cv('--txt2'),
              txt3: cv('--txt3'), blue: cv('--blue'), red: cv('--red') };
    var html = '<div id="rad-guia-erro-overlay" onclick="if(event.target===this)this.remove()" ' +
      'style="position:fixed;inset:0;background:rgba(0,0,0,.68);z-index:9200;display:flex;align-items:center;justify-content:center;padding:20px">' +
      '<div style="background:' + c.card + ';border:1px solid ' + c.brd + ';border-top:3px solid ' + (cfg.cor || c.red) +
      ';border-radius:12px;width:520px;max-width:95vw">' +
      '<div style="padding:20px 24px 14px;border-bottom:1px solid ' + c.brd + '">' +
      '<div style="color:' + c.blue + ';font-size:11px;font-family:var(--font-mono);margin-bottom:3px">' + r.rf + ' · ' + r.tipo + '</div>' +
      '<div style="color:' + c.txt1 + ';font-size:16px;font-weight:700">Guia não pôde ser gerada</div></div>' +
      '<div style="padding:18px 24px">' +
      '<div style="display:flex;align-items:center;gap:9px;margin-bottom:14px">' +
      '<span style="font-family:var(--font-mono);font-size:12px;font-weight:700;color:' + (cfg.cor || c.red) + '">' + r.returnCode + '</span>' +
      '<span style="font-size:12.5px;color:' + c.txt2 + '">' + (cfg.label || '') + '</span></div>' +
      '<div style="background:rgba(var(--status-red-rgb),.07);border:1px solid rgba(var(--status-red-rgb),.2);' +
      'border-radius:7px;padding:13px 15px;font-size:12.5px;color:' + c.txt2 + ';line-height:1.6">' +
      '<div style="font-weight:700;color:' + c.txt1 + ';margin-bottom:5px">Ação sugerida</div>' + (cfg.acao || '—') + '</div>' +
      '<div style="margin-top:14px;font-size:12px;color:' + c.txt2 + ';line-height:1.7">' +
      '<div><span style="color:' + c.txt3 + '">Fornecedor:</span> ' + r.forn + '</div>' +
      '<div><span style="color:' + c.txt3 + '">Valor apurado:</span> ' + fmtBRL(r.valor) + '</div>' +
      '<div><span style="color:' + c.txt3 + '">darf_id:</span> <span style="font-family:var(--font-mono)">' + r.darfId + '</span></div>' +
      '</div></div>' +
      '<div style="padding:14px 24px 20px;border-top:1px solid ' + c.brd + ';display:flex;justify-content:flex-end;gap:9px">' +
      '<button class="btn" onclick="document.getElementById(\'rad-guia-erro-overlay\').remove()">Fechar</button>' +
      '</div></div></div>';
    var w = document.createElement('div'); w.innerHTML = html; document.body.appendChild(w.firstChild);
  };

  /* Bloco injetado no modal de guia: decomposição do valor, link do PDF
     oficial e estado da entrega ao ERP. */
  window.radBlocoGuiaApi = function (r) {
    var linhas = '';
    if (r.penaltyValue || r.interestValue) {
      linhas =
        '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px">' +
        '<span style="color:var(--txt2)">Principal</span><span style="font-family:var(--font-mono);color:var(--txt1)">' + fmtBRL(r.principalValue) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px">' +
        '<span style="color:var(--amber)">Multa</span><span style="font-family:var(--font-mono);color:var(--amber)">' + fmtBRL(r.penaltyValue) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px">' +
        '<span style="color:var(--amber)">Juros</span><span style="font-family:var(--font-mono);color:var(--amber)">' + fmtBRL(r.interestValue) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;padding:7px 0 0;margin-top:4px;border-top:1px solid var(--border);font-size:12.5px;font-weight:700">' +
        '<span style="color:var(--txt1)">Total</span><span style="font-family:var(--font-mono);color:var(--txt1)">' + fmtBRL(r.totalValue) + '</span></div>';
    }

    var entrega = '';
    if (r.entregaStatus) {
      var ok = r.entregaStatus === 'entregue';
      var cor = ok ? 'var(--green)' : r.entregaStatus === 'pendente' ? 'var(--amber)' : 'var(--red)';
      var rgb = ok ? 'var(--status-green-rgb)' : r.entregaStatus === 'pendente' ? 'var(--status-amber-rgb)' : 'var(--status-red-rgb)';
      entrega = '<div style="margin-top:12px;padding:9px 13px;border-radius:7px;font-size:11.5px;' +
        'background:rgba(' + rgb + ',.08);border:1px solid rgba(' + rgb + ',.22);color:var(--txt2)">' +
        '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:' + cor + ';margin-right:7px"></span>' +
        (ok ? 'Entregue ao ERP — webhook <span style="font-family:var(--font-mono)">rad.darf_recebida</span> confirmado.'
            : 'Não entregue ao ERP após ' + r.entregaTentativas + ' tentativa(s). ' +
              '<a href="javascript:void(0)" onclick="radReenviarDaGuia(\'' + r.rfId + '\')" style="color:' + cor + ';font-weight:600">Reenviar</a>') +
        '</div>';
    }

    return (linhas ? '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">' +
        '<div style="font-size:10px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px">Composição do valor</div>' +
        linhas + '</div>' : '') +
      (r.pdfLink ? '<div style="margin-top:12px"><a href="' + r.pdfLink + '" target="_blank" rel="noopener" ' +
        'style="font-size:11.5px;color:var(--blue);text-decoration:none;border-bottom:1px dotted var(--blue)">' +
        'Abrir PDF oficial da guia ↗</a></div>' : '') +
      entrega;
  };

  window.radReenviarDaGuia = function (rfId) {
    window.radToast('Reenvio solicitado. Acompanhe em Configurações → Integrações.');
  };

  // ══════════════════════════════════════════════════════════
  // T-07 — bloco de rastreamento na Receita
  // ══════════════════════════════════════════════════════════

  window.radBlocoRastreamento = function (r) {
    if (!r || !r.statusRdoc) return '';
    var ok = r.statusRdoc === 'CONFIRMADO';
    var cor = ok ? 'var(--green)' : 'var(--amber)';
    var rgb = ok ? 'var(--status-green-rgb)' : 'var(--status-amber-rgb)';
    function linha(k, v) {
      return '<div style="display:flex;justify-content:space-between;gap:12px;padding:5px 0;font-size:12px">' +
        '<span style="color:var(--txt2)">' + k + '</span>' +
        '<span style="color:var(--txt1);font-family:var(--font-mono);text-align:right;word-break:break-all">' + v + '</span></div>';
    }
    return '<div style="margin-top:16px;padding:13px 15px;border-radius:8px;' +
      'background:rgba(' + rgb + ',.06);border:1px solid rgba(' + rgb + ',.2)">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:9px">' +
      '<span style="width:7px;height:7px;border-radius:50%;background:' + cor + '"></span>' +
      '<span style="font-size:10.5px;font-weight:700;color:' + cor + ';text-transform:uppercase;letter-spacing:.06em">' +
      'Rastreamento na Receita</span></div>' +
      linha('Protocolo', r.protocoloRfb) +
      linha('status_rdoc', r.statusRdoc) +
      linha('Confirmado em', r.dataConfirmacaoRfb || '—') +
      (ok ? '' : '<div style="font-size:11px;color:var(--amber);margin-top:7px;font-style:italic">' +
        'O recolhimento ainda não foi confirmado pela Receita. O crédito só avança após a confirmação.</div>') +
      '</div>';
  };

  // ══════════════════════════════════════════════════════════
  // T-08 — Organização: coluna de política
  // ══════════════════════════════════════════════════════════

  window.radCelulaPoliticaOrg = function (cnpj) {
    var p = window.radPoliticaPorCnpj ? window.radPoliticaPorCnpj(cnpj) : null;
    if (!p) {
      return '<a href="javascript:void(0)" onclick="event.stopPropagation();radIrParaPolitica(\'' + cnpj + '\')" ' +
        'style="font-size:10px;font-weight:700;letter-spacing:.05em;padding:2px 8px;border-radius:4px;' +
        'color:var(--txt3);background:rgba(var(--status-gray-rgb),.14);border:1px solid rgba(var(--status-gray-rgb),.3);' +
        'text-decoration:none;white-space:nowrap" title="Sem política de execução — clique para configurar">Configurar</a>';
    }
    var m = window.radModoCfg(p.modo);
    return '<a href="javascript:void(0)" onclick="event.stopPropagation();radIrParaPolitica(\'' + cnpj + '\')" ' +
      'style="font-size:10px;font-weight:700;letter-spacing:.05em;padding:2px 8px;border-radius:4px;' +
      'color:' + m.cor + ';background:rgba(' + m.rgb + ',.12);border:1px solid rgba(' + m.rgb + ',.28);' +
      'text-decoration:none;white-space:nowrap" title="' + (p.ativo ? 'Política ativa' : 'Política pausada') + '">' +
      m.label + (p.ativo ? '' : ' ⏸') + '</a>';
  };

  window.radIrParaPolitica = function (cnpj) {
    showAdminSub('exec-rad', document.getElementById('subnav-admin-exec-rad'));
    setTimeout(function () { window.radAbrirEditor(cnpj); }, 250);
  };

  /* Após cadastrar um CNPJ, oferece criar a política herdando os
     parâmetros de outro estabelecimento como ponto de partida. */
  window.radSugerirPolitica = function (cnpj) {
    var org = (window._orgCnpjs || []).find(function (o) { return o.cnpj === cnpj; });
    if (!org) return;
    var base = (window._radPoliticas || []).find(function (p) { return p.ativo; });
    var msg = 'CNPJ ' + org.razao + ' cadastrado.\n\n' +
      'Sem política de execução RAD, as guias deste estabelecimento continuarão sendo geradas manualmente.\n\n' +
      (base ? 'Criar política herdando os parâmetros de outro estabelecimento?' : 'Configurar política agora?');
    if (confirm(msg)) window.radIrParaPolitica(cnpj);
  };

})();

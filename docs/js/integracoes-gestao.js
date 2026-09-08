/* ============================================================
   SplitHub — Integrações: gestão, health check e incidentes
   T-11 Gestão das integrações

   As três primeiras abas respondem "o que está configurado" e "o que
   passou por aqui". Faltava a pergunta operacional: as conexões estão
   de pé agora, e o que já quebrou.

   Uma assimetria governa a tela inteira: o SplitHub consegue SONDAR uma
   conexão de saída — basta emitir um evento de teste e medir a resposta.
   Numa conexão de entrada não há o que sondar: quem chama é o ERP. Ali
   a saúde é observada pelo tráfego que chega, e a ausência de tráfego é
   ambígua — pode ser silêncio legítimo ou integração morta.

   Tudo aqui é MOCK: os números derivam das métricas já exibidas nas
   conexões, para que as duas telas nunca se contradigam.
   ============================================================ */
(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }
  function tipoCfg(v) { return window.intgTipoCfg ? window.intgTipoCfg(v) : { direcao: 'saida', nome: v }; }
  function conexoes() { return window._radIntegracoes || []; }
  function porId(id) { return conexoes().filter(function (i) { return i.id === id; })[0] || null; }

  var ESTADOS = {
    operacional: { label: 'Operacional', cor: 'var(--green)', rgb: 'var(--status-green-rgb)' },
    degradado:   { label: 'Degradado',   cor: 'var(--amber)', rgb: 'var(--status-amber-rgb)' },
    fora:        { label: 'Fora do ar',  cor: 'var(--red)',   rgb: 'var(--status-red-rgb)' },
    silencio:    { label: 'Sem tráfego', cor: 'var(--txt3)',  rgb: 'var(--status-gray-rgb)' }
  };

  var SEVERIDADES = {
    critica: { label: 'Crítica', cor: 'var(--red)',   rgb: 'var(--status-red-rgb)' },
    alta:    { label: 'Alta',    cor: 'var(--amber)', rgb: 'var(--status-amber-rgb)' },
    media:   { label: 'Média',   cor: 'var(--blue)',  rgb: 'var(--blue-rgb)' }
  };

  var CAUSAS = {
    timeout:           'Timeout no endpoint',
    http_5xx:          'Erro 5xx do destino',
    credencial:        'Credencial inválida ou expirada',
    payload:           'Payload rejeitado',
    indisponibilidade: 'Indisponibilidade do ERP',
    silencio:          'Ausência de tráfego'
  };

  function fmtBRL(v) {
    return 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function pct(v) { return (v * 100).toFixed(2).replace('.', ',') + '%'; }
  function chip(txt, cor, rgb, mono) {
    return '<span style="font-size:10px;' + (mono ? 'font-family:var(--font-mono);' : 'font-weight:600;') +
      'padding:2px 7px;border-radius:4px;background:rgba(' + rgb + ',.1);color:' + cor +
      ';border:1px solid rgba(' + rgb + ',.22)">' + txt + '</span>';
  }

  // ══════════════════════════════════════════════════════════
  // HEALTH CHECK
  // ══════════════════════════════════════════════════════════
  /* Sonda ativa só existe onde o SplitHub é quem chama. Nas conexões de
     entrada a saúde vem do tráfego recebido, e "sem tráfego" não é um
     diagnóstico: é a falta de um. */
  function ehSondavel(i) { return tipoCfg(i.tipo).direcao !== 'entrada'; }

  function saude(i) {
    var sondavel = ehSondavel(i);
    var tot = sondavel ? (i.entregas || 0) : (i.chamadas || 0);
    var err = sondavel ? (i.falhas || 0) : (i.errosApi || 0);

    if (!i.ativo) {
      return { estado: 'silencio', sondavel: sondavel, taxa: null,
               nota: 'Conexão desativada — nenhuma sonda é executada.' };
    }
    if (!tot) {
      return { estado: 'silencio', sondavel: sondavel, taxa: null,
               nota: sondavel ? 'Nenhum evento emitido ainda.'
                              : 'Nenhuma chamada recebida. Sem tráfego, não há como distinguir integração ociosa de integração morta.' };
    }

    var ok = (tot - err) / tot;
    var estado = ok >= 0.98 ? 'operacional' : ok >= 0.90 ? 'degradado' : 'fora';

    /* Latências derivadas do id, para os números não dançarem a cada
       render. Num sistema real vêm do histograma das entregas. */
    var seed = 0;
    String(i.id).split('').forEach(function (c) { seed += c.charCodeAt(0); });
    var base = sondavel ? 120 + (seed % 180) : 40 + (seed % 90);
    var mult = estado === 'operacional' ? 1 : estado === 'degradado' ? 2.4 : 5.1;

    return {
      estado: estado, sondavel: sondavel, taxa: ok,
      p50: Math.round(base * mult),
      p95: Math.round(base * mult * 2.7),
      uptime24: Math.max(0, Math.min(1, ok + 0.01)),
      uptime7: ok,
      uptime30: Math.max(0, Math.min(1, ok - 0.004)),
      nota: sondavel
        ? 'Sonda a cada 5 minutos: evento de teste com payload fictício.'
        : 'Sem sonda ativa — quem inicia a chamada é o ERP. A leitura vem do tráfego recebido.'
    };
  }
  window.intgSaude = saude;

  // ══════════════════════════════════════════════════════════
  // INCIDENTES — seed
  // ══════════════════════════════════════════════════════════
  function seedIncidentes() {
    if (window._intgIncidentes) return window._intgIncidentes;
    window._intgIncidentes = [
      {
        id: 'INC-0004', integracaoId: 'INT-0002', severidade: 'alta', causa: 'timeout',
        titulo: 'Entregas ao SAP SP falhando de forma intermitente',
        inicio: '06/09/2026 04:12', fim: null, estado: 'aberto',
        impacto: { guias: 11, valor: 486300, chamadas: 0 },
        eventos: [
          { ts: '06/09/2026 04:12', tipo: 'deteccao', texto: 'Taxa de entrega cai abaixo de 90% na janela de 15 minutos.' },
          { ts: '06/09/2026 04:14', tipo: 'alerta', texto: 'Notificação enviada aos responsáveis pela integração.' },
          { ts: '06/09/2026 09:30', tipo: 'diagnostico', texto: 'Endpoint responde 504 acima de 8s. Time do ERP confirma fila de processamento saturada.' },
          { ts: '08/09/2026 06:00', tipo: 'nota', texto: '11 guias aguardando reenvio no log de entregas.' }
        ],
        resolucao: null
      },
      {
        id: 'INC-0003', integracaoId: 'INT-0005', severidade: 'media', causa: 'payload',
        titulo: 'Lote de DFs rejeitado por grupo ibs_cbs ausente',
        inicio: '05/09/2026 16:40', fim: '05/09/2026 18:05', estado: 'resolvido',
        impacto: { guias: 0, valor: 0, chamadas: 148 },
        eventos: [
          { ts: '05/09/2026 16:40', tipo: 'deteccao', texto: '148 chamadas com 422 em POST /v1/documentos-fiscais/batch.' },
          { ts: '05/09/2026 17:10', tipo: 'diagnostico', texto: 'Documentos enviados sem items[].tax.ibs_cbs, obrigatório desde 01/01/2026.' },
          { ts: '05/09/2026 18:05', tipo: 'resolucao', texto: 'Mapeamento corrigido no sandbox e lote reenviado com sucesso.' }
        ],
        resolucao: 'Ajuste no mapeamento do ERP. Nenhum documento de produção afetado — a conexão era de sandbox.'
      },
      {
        id: 'INC-0002', integracaoId: 'INT-0001', severidade: 'critica', causa: 'credencial',
        titulo: 'Rotação de segredo sem atualização no ERP',
        inicio: '20/08/2026 08:00', fim: '20/08/2026 09:12', estado: 'resolvido',
        impacto: { guias: 6, valor: 214800, chamadas: 0 },
        eventos: [
          { ts: '20/08/2026 08:00', tipo: 'deteccao', texto: 'Comprovantes recebidos passam a retornar 401.' },
          { ts: '20/08/2026 08:35', tipo: 'diagnostico', texto: 'Segredo rotacionado no dia anterior; janela de 24h expirou antes da troca do lado do ERP.' },
          { ts: '20/08/2026 09:12', tipo: 'resolucao', texto: 'Novo segredo aplicado no ERP. Comprovantes reprocessados.' }
        ],
        resolucao: 'A janela de sobreposição de 24h existe justamente para isso, e não foi usada. Passou a valer o aviso na tela de rotação.'
      },
      {
        id: 'INC-0001', integracaoId: 'INT-0003', severidade: 'media', causa: 'indisponibilidade',
        titulo: 'Homologação MG indisponível durante migração',
        inicio: '01/09/2026 10:00', fim: '01/09/2026 22:40', estado: 'resolvido',
        impacto: { guias: 0, valor: 0, chamadas: 0 },
        eventos: [
          { ts: '01/09/2026 10:00', tipo: 'deteccao', texto: 'Sonda ativa sem resposta — connection refused.' },
          { ts: '01/09/2026 10:05', tipo: 'nota', texto: 'Janela de manutenção comunicada previamente pelo time do ERP.' },
          { ts: '01/09/2026 22:40', tipo: 'resolucao', texto: 'Ambiente restabelecido; sonda volta a responder 200.' }
        ],
        resolucao: 'Manutenção programada. A conexão está pausada desde então, aguardando validação.'
      }
    ];
    return window._intgIncidentes;
  }

  function incidentesDe(id) {
    return seedIncidentes().filter(function (x) { return x.integracaoId === id; });
  }
  function abertos() {
    return seedIncidentes().filter(function (x) { return x.estado !== 'resolvido'; });
  }

  /* O seed do RAD vive em setembro de 2026 — é a data das últimas
     entregas e execuções —, enquanto HOJE_REF fixa o resto do protótipo
     em abril. Usar HOJE_REF aqui daria duração negativa para um
     incidente em curso, então o "agora" desta tela é o do próprio seed. */
  var AGORA_RAD = '08/09/2026 06:00';

  // Duração em texto, a partir das duas datas BR
  function duracao(inc) {
    function parse(d) {
      if (!d) return null;
      var p = d.split(' '), dt = p[0].split('/'), h = (p[1] || '00:00').split(':');
      return new Date(+dt[2], +dt[1] - 1, +dt[0], +h[0], +h[1]);
    }
    var a = parse(inc.inicio), b = parse(inc.fim) || parse(AGORA_RAD);
    if (!a) return '—';
    var min = Math.max(0, Math.round((b - a) / 60000));
    if (min < 60) return min + ' min';
    var h = Math.floor(min / 60);
    if (h < 24) return h + 'h ' + (min % 60) + 'min';
    return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
  }

  // ══════════════════════════════════════════════════════════
  // RENDER — KPIs
  // ══════════════════════════════════════════════════════════
  function kpis() {
    var ativas = conexoes().filter(function (i) { return i.ativo; });
    var estados = { operacional: 0, degradado: 0, fora: 0, silencio: 0 };
    ativas.forEach(function (i) { estados[saude(i).estado]++; });

    var ab = abertos();
    var resolvidos = seedIncidentes().filter(function (x) { return x.estado === 'resolvido'; });
    var mediaMin = resolvidos.length
      ? Math.round(resolvidos.reduce(function (a, x) {
          var d = duracao(x);
          var n = /^(\d+)h/.test(d) ? parseInt(d, 10) * 60
                : /^(\d+)d/.test(d) ? parseInt(d, 10) * 1440
                : parseInt(d, 10);
          return a + (isNaN(n) ? 0 : n);
        }, 0) / resolvidos.length)
      : 0;
    var mttr = mediaMin >= 60 ? Math.round(mediaMin / 60) + 'h' : mediaMin + 'min';

    var disp = ativas.length
      ? ativas.reduce(function (a, i) { var s = saude(i); return a + (s.uptime30 || 0); }, 0) / ativas.length
      : 0;

    var card = function (rotulo, valor, sub, cor, tip) {
      return '<div class="kcard"><div class="klbl">' + rotulo +
        (tip ? ' <span class="periodo-info" data-tip="' + tip + '">i</span>' : '') + '</div>' +
        '<div class="kval"' + (cor ? ' style="color:' + cor + '"' : '') + '>' + valor + '</div>' +
        '<div class="ksub">' + sub + '</div></div>';
    };

    return '<div class="kgrid k4" style="margin-bottom:20px">' +
      card('Conexões operacionais', estados.operacional + '/' + ativas.length,
        estados.degradado + ' degradada(s) · ' + estados.fora + ' fora do ar',
        estados.fora ? 'var(--red)' : estados.degradado ? 'var(--amber)' : 'var(--green)',
        'Conexões ativas cuja taxa de sucesso está acima de 98%. Entre 90% e 98% conta como degradada; abaixo disso, fora do ar.') +
      card('Incidentes abertos', String(ab.length),
        ab.length ? ab.map(function (x) { return x.id; }).join(' · ') : 'nenhum em curso',
        ab.length ? 'var(--amber)' : 'var(--green)',
        'Incidentes ainda não resolvidos, em qualquer conexão.') +
      card('MTTR', mttr, 'média dos ' + resolvidos.length + ' incidentes resolvidos', null,
        'Tempo médio entre a detecção e a resolução. Mede quanto a operação leva para recuperar uma integração, não quanto ela quebra.') +
      card('Disponibilidade 30d', disp ? pct(disp) : '—', 'média das conexões ativas',
        disp >= 0.98 ? 'var(--green)' : disp >= 0.9 ? 'var(--amber)' : 'var(--red)',
        'Média simples da taxa de sucesso de 30 dias entre as conexões ativas.') +
      '</div>';
  }

  // ══════════════════════════════════════════════════════════
  // RENDER — painel de health check
  // ══════════════════════════════════════════════════════════
  function barraUptime(v, cor) {
    return '<div style="height:5px;border-radius:3px;background:rgba(var(--status-gray-rgb),.25);overflow:hidden;margin-top:4px">' +
      '<div style="height:100%;width:' + ((v || 0) * 100).toFixed(1) + '%;background:' + cor + '"></div></div>';
  }

  function cartaoSaude(i) {
    var s = saude(i);
    var e = ESTADOS[s.estado];
    var t = tipoCfg(i.tipo);
    var inc = incidentesDe(i.id);
    var abertosAqui = inc.filter(function (x) { return x.estado !== 'resolvido'; });

    var metricas = s.taxa === null
      ? '<div style="font-size:11.5px;color:var(--txt3);line-height:1.6;margin-top:10px">' + s.nota + '</div>'
      : '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:14px;margin-top:12px">' +
        ['24h', '7d', '30d'].map(function (jan, k) {
          var v = [s.uptime24, s.uptime7, s.uptime30][k];
          return '<div><div style="font-size:9.5px;color:var(--txt3);text-transform:uppercase;letter-spacing:.06em">' +
            'Disponib. ' + jan + '</div>' +
            '<div style="font-size:13px;font-weight:700;color:var(--txt1);margin-top:2px">' + pct(v) + '</div>' +
            barraUptime(v, e.cor) + '</div>';
        }).join('') +
        '<div><div style="font-size:9.5px;color:var(--txt3);text-transform:uppercase;letter-spacing:.06em">Latência p50 / p95</div>' +
        '<div style="font-size:13px;font-weight:700;color:var(--txt1);margin-top:2px;font-family:var(--font-mono)">' +
        s.p50 + ' / ' + s.p95 + ' ms</div>' +
        '<div style="font-size:10px;color:var(--txt3);margin-top:4px">' +
        (s.sondavel ? 'medida na sonda' : 'medida no tráfego recebido') + '</div></div>' +
        '</div>';

    return '<div style="background:var(--card);border:1px solid var(--border);border-left:3px solid ' + e.cor + ';' +
      'border-radius:10px;padding:15px 18px;margin-bottom:12px">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
      '<div style="flex:1;min-width:230px">' +
      '<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">' +
      '<span style="font-size:13.5px;font-weight:700;color:var(--txt1)">' + i.nome + '</span>' +
      chip(e.label, e.cor, e.rgb) +
      (i.ambiente === 'sandbox' ? chip('Sandbox', 'var(--amber)', 'var(--status-amber-rgb)') : '') +
      (abertosAqui.length ? chip(abertosAqui.length + ' incidente(s) aberto(s)', 'var(--red)', 'var(--status-red-rgb)') : '') +
      '</div>' +
      '<div style="font-size:10.5px;color:var(--txt3);margin-top:5px">' +
      '<span style="font-family:var(--font-mono)">' + i.id + '</span> · ' + t.nome + ' · ' +
      (s.sondavel ? 'sonda ativa' : 'observação passiva') + '</div>' +
      '</div>' +
      '<button class="btn" style="font-size:11px;padding:5px 12px;white-space:nowrap" ' +
      'onclick="intgHealthCheck(\'' + i.id + '\')">' +
      (s.sondavel ? 'Executar health check' : 'Verificar credencial') + '</button>' +
      '</div>' +
      metricas +
      '<div id="intg-hc-' + i.id + '" style="display:none;margin-top:11px;font-size:11.5px;padding:9px 12px;border-radius:6px"></div>' +
      (s.taxa !== null ? '<div style="font-size:10.5px;color:var(--txt3);margin-top:10px;font-style:italic">' + s.nota + '</div>' : '') +
      '</div>';
  }

  /* A sonda é simulada, mas o resultado precisa ser coerente com o que a
     conexão já mostra — duas telas discordando sobre o mesmo endpoint é
     pior que nenhuma das duas. */
  window.intgHealthCheck = function (id) {
    var i = porId(id); if (!i) return;
    var box = el('intg-hc-' + id); if (!box) return;
    var s = saude(i);

    box.style.display = 'block';
    box.style.background = 'rgba(var(--blue-rgb),.08)';
    box.style.border = '1px solid rgba(var(--blue-rgb),.22)';
    box.style.color = 'var(--txt2)';
    box.innerHTML = s.sondavel
      ? 'Emitindo evento de teste para <span style="font-family:var(--font-mono)">' + i.webhookUrl + '</span>…'
      : 'Validando a credencial e lendo o tráfego das últimas 24h…';

    setTimeout(function () {
      var ok = s.estado === 'operacional';
      var alerta = s.estado === 'degradado';
      var cor = ok ? 'var(--green)' : alerta ? 'var(--amber)' : 'var(--red)';
      var rgb = ok ? 'var(--status-green-rgb)' : alerta ? 'var(--status-amber-rgb)' : 'var(--status-red-rgb)';
      box.style.background = 'rgba(' + rgb + ',.08)';
      box.style.border = '1px solid rgba(' + rgb + ',.25)';
      box.style.color = cor;

      if (!s.sondavel) {
        box.innerHTML = s.taxa === null
          ? '<strong>Sem tráfego</strong> — a credencial é válida, mas nenhuma chamada chegou. ' +
            'Não há como distinguir integração ociosa de integração morta sem um heartbeat do lado do ERP.'
          : '<strong>Credencial válida</strong> · escopos ' + (i.escopos || []).join(', ') +
            ' · ' + (i.chamadas || 0).toLocaleString('pt-BR') + ' chamadas, ' +
            (i.errosApi || 0) + ' com erro (' + pct(1 - s.taxa) + ' de rejeição).';
        return;
      }
      box.innerHTML = ok
        ? '<strong>200 OK</strong> em ' + s.p50 + ' ms — endpoint respondendo dentro do esperado.'
        : alerta
          ? '<strong>200 OK</strong> em ' + s.p95 + ' ms — acima do limiar de 1s. ' +
            'O endpoint responde, mas a latência já produz retentativas.'
          : '<strong>504 Gateway Timeout</strong> — o endpoint não respondeu em 10s. ' +
            'As guias geradas para esta conexão ficam na fila de reenvio.';
    }, 650);
  };

  window.intgHealthCheckTodos = function () {
    var alvos = conexoes().filter(function (i) { return i.ativo; });
    alvos.forEach(function (i) { window.intgHealthCheck(i.id); });
    if (window.radToast) window.radToast('Health check disparado em ' + alvos.length + ' conexão(ões) ativa(s).');
  };

  // ══════════════════════════════════════════════════════════
  // RENDER — histórico de incidentes
  // ══════════════════════════════════════════════════════════
  var ICONE_EVENTO = {
    deteccao:    { i: '!', c: 'var(--red)' },
    alerta:      { i: '⚑', c: 'var(--amber)' },
    diagnostico: { i: '?', c: 'var(--blue)' },
    nota:        { i: '·', c: 'var(--txt3)' },
    resolucao:   { i: '✓', c: 'var(--green)' }
  };

  function linhaIncidente(inc) {
    var i = porId(inc.integracaoId);
    var sev = SEVERIDADES[inc.severidade] || SEVERIDADES.media;
    var aberto = inc.estado !== 'resolvido';
    var imp = [];
    if (inc.impacto.guias) imp.push(inc.impacto.guias + ' guia(s) · ' + fmtBRL(inc.impacto.valor));
    if (inc.impacto.chamadas) imp.push(inc.impacto.chamadas + ' chamada(s)');

    return '<tr onclick="intgIncidenteDetalhe(\'' + inc.id + '\')" style="cursor:pointer">' +
      '<td class="mono" style="font-size:11px;color:var(--blue)">' + inc.id + '</td>' +
      '<td style="font-size:11.5px"><div style="font-weight:600;color:var(--txt1)">' + inc.titulo + '</div>' +
      '<div style="font-size:10.5px;color:var(--txt3);margin-top:2px">' + (i ? i.nome : inc.integracaoId) + '</div></td>' +
      '<td>' + chip(sev.label, sev.cor, sev.rgb) + '</td>' +
      '<td style="font-size:11px;color:var(--txt2)">' + (CAUSAS[inc.causa] || inc.causa) + '</td>' +
      '<td style="font-size:11px;white-space:nowrap">' + inc.inicio + '</td>' +
      '<td style="font-size:11px;white-space:nowrap">' + duracao(inc) + '</td>' +
      '<td style="font-size:11px;color:var(--txt2)">' + (imp.join(' · ') || '—') + '</td>' +
      '<td>' + (aberto
        ? chip(inc.estado === 'mitigado' ? 'Mitigado' : 'Aberto', 'var(--amber)', 'var(--status-amber-rgb)')
        : chip('Resolvido', 'var(--green)', 'var(--status-green-rgb)')) + '</td>' +
      '</tr>';
  }

  window.intgIncidenteDetalhe = function (id) {
    var inc = seedIncidentes().filter(function (x) { return x.id === id; })[0];
    if (!inc) return;
    var i = porId(inc.integracaoId);
    var sev = SEVERIDADES[inc.severidade] || SEVERIDADES.media;

    var timeline = inc.eventos.map(function (ev, k) {
      var cfg = ICONE_EVENTO[ev.tipo] || ICONE_EVENTO.nota;
      var ultimo = k === inc.eventos.length - 1;
      return '<div style="display:flex;gap:12px;position:relative;padding-bottom:' + (ultimo ? '0' : '16px') + '">' +
        (ultimo ? '' : '<div style="position:absolute;left:10px;top:22px;bottom:0;width:1px;background:var(--border)"></div>') +
        '<div style="width:21px;height:21px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;' +
        'justify-content:center;font-size:11px;font-weight:700;color:' + cfg.c + ';' +
        'background:var(--bg);border:1px solid ' + cfg.c + '">' + cfg.i + '</div>' +
        '<div style="flex:1"><div style="font-size:10.5px;color:var(--txt3);font-family:var(--font-mono)">' + ev.ts + '</div>' +
        '<div style="font-size:12px;color:var(--txt2);line-height:1.55;margin-top:2px">' + ev.texto + '</div></div></div>';
    }).join('');

    var d = document.createElement('div');
    d.id = 'intg-inc-overlay';
    d.setAttribute('onclick', 'if(event.target===this)intgFecharIncidente()');
    d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9300;display:flex;justify-content:flex-end';
    d.innerHTML = '<div style="background:var(--card);border-left:1px solid var(--border);width:520px;max-width:96vw;' +
      'height:100vh;overflow-y:auto;display:flex;flex-direction:column">' +
      '<div style="padding:20px 24px 16px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--card);z-index:2">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">' +
      '<div><div style="font-family:var(--font-mono);font-size:11px;color:var(--blue);margin-bottom:3px">' + inc.id + '</div>' +
      '<div style="font-size:15.5px;font-weight:700;color:var(--txt1);line-height:1.35">' + inc.titulo + '</div>' +
      '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">' +
      chip(sev.label, sev.cor, sev.rgb) +
      chip(CAUSAS[inc.causa] || inc.causa, 'var(--txt2)', 'var(--status-gray-rgb)') +
      (inc.estado === 'resolvido'
        ? chip('Resolvido', 'var(--green)', 'var(--status-green-rgb)')
        : chip('Aberto', 'var(--amber)', 'var(--status-amber-rgb)')) + '</div></div>' +
      '<button onclick="intgFecharIncidente()" style="background:none;border:none;color:var(--txt3);' +
      'font-size:20px;cursor:pointer;line-height:1;padding:0 2px">×</button></div></div>' +

      '<div style="padding:20px 24px;flex:1">' +
      '<div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:13px 15px;' +
      'font-size:11.5px;color:var(--txt2);line-height:1.9;margin-bottom:20px">' +
      '<div><span style="color:var(--txt3)">Conexão</span> · ' + (i ? i.nome : inc.integracaoId) + '</div>' +
      '<div><span style="color:var(--txt3)">Início</span> · ' + inc.inicio + '</div>' +
      '<div><span style="color:var(--txt3)">Fim</span> · ' + (inc.fim || 'em curso') + '</div>' +
      '<div><span style="color:var(--txt3)">Duração</span> · ' + duracao(inc) + '</div>' +
      (inc.impacto.guias
        ? '<div><span style="color:var(--txt3)">Impacto</span> · ' + inc.impacto.guias +
          ' guia(s), ' + fmtBRL(inc.impacto.valor) + '</div>' : '') +
      (inc.impacto.chamadas
        ? '<div><span style="color:var(--txt3)">Impacto</span> · ' + inc.impacto.chamadas + ' chamada(s) rejeitada(s)</div>' : '') +
      '</div>' +

      '<div style="font-size:10px;font-weight:700;color:var(--txt3);text-transform:uppercase;' +
      'letter-spacing:.07em;margin-bottom:12px">Linha do tempo</div>' + timeline +

      (inc.resolucao
        ? '<div style="margin-top:20px;background:rgba(var(--status-green-rgb),.07);' +
          'border:1px solid rgba(var(--status-green-rgb),.2);border-radius:8px;padding:12px 14px">' +
          '<div style="font-size:10px;font-weight:700;color:var(--green);text-transform:uppercase;' +
          'letter-spacing:.06em;margin-bottom:6px">Resolução</div>' +
          '<div style="font-size:11.5px;color:var(--txt2);line-height:1.6">' + inc.resolucao + '</div></div>'
        : '<div style="margin-top:20px;background:rgba(var(--status-amber-rgb),.07);' +
          'border:1px solid rgba(var(--status-amber-rgb),.22);border-radius:8px;padding:12px 14px">' +
          '<div style="font-size:11.5px;color:var(--txt2);line-height:1.6">' +
          'Incidente em curso. O reenvio das entregas afetadas fica no ' +
          '<a href="javascript:void(0)" onclick="intgFecharIncidente();radIntgTab(\'entregas\')" ' +
          'style="color:var(--teal)">log de entregas</a>.</div></div>') +
      '</div></div>';

    document.body.appendChild(d);
  };
  window.intgFecharIncidente = function () {
    var o = el('intg-inc-overlay'); if (o) o.remove();
  };

  // ══════════════════════════════════════════════════════════
  // RENDER — a aba inteira
  // ══════════════════════════════════════════════════════════
  window.intgGestaoRender = function () {
    var wrap = el('rad-intg-gestao-corpo');
    if (!wrap) return;
    if (window.radConexoesRender) { /* garante o seed das conexões */ }

    var fEstado = (el('intg-g-estado') || {}).value || '';
    var lista = conexoes().filter(function (i) {
      return !fEstado || saude(i).estado === fEstado;
    });

    var cartoes = lista.length
      ? lista.map(cartaoSaude).join('')
      : '<div style="text-align:center;color:var(--txt3);padding:24px;font-size:13px">Nenhuma conexão neste estado.</div>';

    var fInc = (el('intg-g-inc') || {}).value || '';
    var incs = seedIncidentes().filter(function (x) {
      return !fInc || (fInc === 'aberto' ? x.estado !== 'resolvido' : x.estado === 'resolvido');
    });

    wrap.innerHTML = kpis() +

      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px">' +
      '<div class="sechdr" style="margin-bottom:0"><h2>Health check</h2>' +
      '<p>Conexão de saída é sondada: o SplitHub emite um evento de teste e mede a resposta. ' +
      'Conexão de entrada não tem o que sondar — quem chama é o ERP —, e ali a leitura vem do tráfego recebido.</p></div>' +
      '<button class="btn btn-t" style="font-size:12px;padding:6px 14px;white-space:nowrap" ' +
      'onclick="intgHealthCheckTodos()">Verificar todas</button></div>' +

      '<div class="sh-fp" style="margin-bottom:14px"><div class="sh-fp-bar">' +
      '<div class="sh-fp-field" style="max-width:220px"><label>Estado</label>' +
      '<select id="intg-g-estado" onchange="intgGestaoRender()">' +
      '<option value="">Todos</option>' +
      Object.keys(ESTADOS).map(function (k) {
        return '<option value="' + k + '"' + (fEstado === k ? ' selected' : '') + '>' + ESTADOS[k].label + '</option>';
      }).join('') +
      '</select></div></div></div>' +

      cartoes +

      '<div class="tcrd" style="margin-top:24px">' +
      '<div class="tcrd-hdr" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
      '<div class="sechdr" style="margin-bottom:0"><h2>Histórico de incidentes</h2>' +
      '<p>O que já quebrou, por quanto tempo e o que se fez. Clique para a linha do tempo.</p></div>' +
      '<select id="intg-g-inc" onchange="intgGestaoRender()" ' +
      'style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 10px;' +
      'color:var(--txt1);font-size:12px;font-family:inherit">' +
      '<option value="">Todos</option>' +
      '<option value="aberto"' + (fInc === 'aberto' ? ' selected' : '') + '>Em curso</option>' +
      '<option value="resolvido"' + (fInc === 'resolvido' ? ' selected' : '') + '>Resolvidos</option>' +
      '</select></div>' +
      '<div class="twrap"><table><thead><tr>' +
      '<th>Incidente</th><th>Ocorrência</th><th>Severidade</th><th>Causa</th>' +
      '<th>Início</th><th>Duração</th><th>Impacto</th><th>Estado</th>' +
      '</tr></thead><tbody>' +
      (incs.length ? incs.map(linhaIncidente).join('')
                   : '<tr><td colspan="8" style="text-align:center;color:var(--txt3);padding:24px">Nenhum incidente neste filtro.</td></tr>') +
      '</tbody></table></div></div>';
  };

})();

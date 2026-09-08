/* ============================================================
   SplitHub — Execução Automática de RAD (parte 2)
   T-03 Integrações · T-04 Execução Programada
   ============================================================ */
(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }
  function setTxt(id, v) { var e = el(id); if (e) e.textContent = v; }
  function fmtBRL(v) {
    return 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtCompacto(v) {
    if (v >= 1e6) return 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M';
    if (v >= 1e3) return 'R$ ' + Math.round(v / 1e3) + 'K';
    return 'R$ ' + (v || 0).toLocaleString('pt-BR');
  }
  function intgPorId(id) {
    return (window._radIntegracoes || []).find(function (i) { return i.id === id; }) || null;
  }
  function orgPorCnpj(cnpj) {
    return (window._orgCnpjs || []).find(function (o) { return o.cnpj === cnpj; }) || null;
  }
  var badge = function () { return window.radBadge.apply(null, arguments); };

  // ══════════════════════════════════════════════════════════
  // T-03 — INTEGRAÇÕES
  // ══════════════════════════════════════════════════════════

  window.radIntgTab = function (tab, btn) {
    ['conexoes', 'entregas', 'comprovantes'].forEach(function (t) {
      var v = el('rad-intg-' + t); if (v) v.classList.toggle('active', t === tab);
    });
    if (btn) {
      btn.closest('.stabs').querySelectorAll('.stab').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
    }
    if (tab === 'entregas') window.radEntregasRender();
    if (tab === 'comprovantes') window.radComprovantesRender();
  };

  /* ── Aba 1: conexões ──
     radConexoesRender, radTestarConexao, radToggleIntegracao e
     radVerVinculados vivem em js/integracoes.js, que generalizou a
     aba para os seis contextos da API e para a emissão de
     credenciais. radRotacionarToken virou intgRotacionar. */

  // ── Aba 2: log de entregas ──
  window.radEntregasRender = function () {
    var tbody = el('t-rad-entregas'); if (!tbody) return;
    var f = (el('rad-entregas-status') || {}).value || '';
    var lista = (window._radEntregas || []).filter(function (e) { return !f || e.status === f; });

    var mapa = { entregue: ['Entregue', 'var(--green)', 'var(--status-green-rgb)'],
                 pendente: ['Pendente', 'var(--amber)', 'var(--status-amber-rgb)'],
                 falha:    ['Falha',    'var(--red)',   'var(--status-red-rgb)'] };

    tbody.innerHTML = lista.map(function (e) {
      var m = mapa[e.status] || mapa.pendente;
      var i = intgPorId(e.integracaoId);
      return '<tr>' +
        '<td class="mono" style="font-size:11px;color:var(--blue)">' + e.id + '</td>' +
        '<td style="font-size:11px">' + (i ? i.nome : e.integracaoId) + '</td>' +
        '<td><span style="font-size:10px;font-family:var(--font-mono);padding:2px 7px;border-radius:4px;' +
          'background:rgba(var(--blue-rgb),.1);color:var(--blue)">' + e.evento + '</span></td>' +
        '<td class="mono" style="font-size:10px;color:var(--txt2)" title="' + e.dfeKey + '">' +
          e.dfeKey.substring(0, 12) + '…' + e.dfeKey.slice(-6) + '</td>' +
        '<td class="r mono" style="font-size:11px">' + e.tentativas + '</td>' +
        '<td class="mono" style="font-size:11px;color:' + (e.httpStatus === 200 ? 'var(--green)' : e.httpStatus ? 'var(--red)' : 'var(--txt3)') + '">' +
          (e.httpStatus || '—') + '</td>' +
        '<td>' + badge(m[0], m[1], m[2]) + '</td>' +
        '<td style="font-size:11px;color:var(--txt2);white-space:nowrap">' + e.ultimaTentativa + '</td>' +
        '<td class="nowrap"><button class="btn" style="font-size:10px;padding:3px 9px" onclick="radVerPayload(\'' + e.id + '\')">Payload</button>' +
          (e.status !== 'entregue' ? ' <button class="btn btn-t" style="font-size:10px;padding:3px 9px" onclick="radReenviar(\'' + e.id + '\')">Reenviar</button>' : '') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="9" style="text-align:center;color:var(--txt3);padding:24px">Nenhuma entrega para este filtro.</td></tr>';

    var falhas = (window._radEntregas || []).filter(function (e) { return e.status === 'falha'; }).length;
    var bar = el('rad-entregas-alerta');
    if (bar) {
      bar.style.display = falhas ? 'flex' : 'none';
      setTxt('rad-entregas-alerta-txt', falhas + ' entrega(s) com falha definitiva. ' +
        'Enquanto não forem reenviadas, o ERP não sabe que há guia a pagar.');
    }
  };

  /* Payload real transmitido — sem isso, depurar divergência com o ERP
     vira troca de e-mails. Estrutura conforme rad.darf_recebida. */
  window.radVerPayload = function (id) {
    var e = (window._radEntregas || []).find(function (x) { return x.id === id; });
    if (!e) return;
    var payload = {
      event: e.evento,
      created_at: '2026-09-08T06:00:12.000Z',
      data: {
        dfe_key: e.dfeKey,
        dfe_type: 'nfe',
        dfe_issue_date: '2026-08-28T00:00:00.000Z',
        acquisition_cnpj: '54.891.237/0001-48',
        supplier_cnpj: '28.447.821/0001-35',
        cbs_guide: {
          darf_type: 'cbs', return_code: 'DARF_GERADO', guide_number: '5952000184213',
          due_date: '2026-09-15', pix_key: '00394460005753',
          barcode: '85810000018-4 42130000000-1 00000000000-0 00000000000-0',
          pdf_link: 'https://api.splithub.com.br/v1/darf/darf_9f21ab.pdf',
          principal_value: 12300.00, penalty_value: 0, interest_value: 0, total_value: 12300.00
        },
        ibs_guide: {
          darf_type: 'ibs', return_code: 'DARF_GERADO', guide_number: '6912000184214',
          due_date: '2026-09-15', pix_key: '50873548000108',
          barcode: '85810000020-5 42140000000-3 00000000000-0 00000000000-0',
          pdf_link: 'https://api.splithub.com.br/v1/darf/darf_9f21ac.pdf',
          principal_value: 20500.00, penalty_value: 0, interest_value: 0, total_value: 20500.00
        },
        fiscal_operation: {
          gross_value: 205000.00, cbs_base: 205000.00, cbs_rate: 0.06, cbs_calculated: 12300.00,
          ibs_base: 205000.00, ibs_rate: 0.10, ibs_calculated: 20500.00,
          total_tributes_retained: 32800.00, net_value_to_supplier: 172200.00
        },
        credit_status_change: {
          previous_status: 'nao_apropriado', current_status: 'nao_apropriado',
          cbs_credit_id: 'RF-CBS-004821', ibs_credit_id: 'RF-IBS-004821',
          retention_date: '2026-09-08'
        }
      }
    };
    var cs = getComputedStyle(document.documentElement), cv = function (n) { return cs.getPropertyValue(n).trim(); };
    var c = { card: cv('--card'), brd: cv('--border'), txt1: cv('--txt1'), txt2: cv('--txt2'), blue: cv('--blue'), teal: cv('--teal') };
    var html = '<div id="rad-payload-overlay" onclick="if(event.target===this)this.remove()" ' +
      'style="position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9400;display:flex;align-items:center;justify-content:center;padding:20px">' +
      '<div style="background:' + c.card + ';border:1px solid ' + c.brd + ';border-radius:12px;width:720px;max-width:96vw;max-height:88vh;display:flex;flex-direction:column">' +
      '<div style="padding:18px 22px;border-bottom:1px solid ' + c.brd + ';display:flex;justify-content:space-between;align-items:center">' +
      '<div><div style="color:' + c.blue + ';font-size:11px;font-family:var(--font-mono)">' + e.id + ' · ' + e.evento + '</div>' +
      '<div style="color:' + c.txt1 + ';font-size:15px;font-weight:700;margin-top:2px">Payload transmitido</div></div>' +
      '<button onclick="document.getElementById(\'rad-payload-overlay\').remove()" style="background:none;border:none;color:' + c.txt2 + ';font-size:22px;cursor:pointer">✕</button></div>' +
      '<div style="overflow:auto;flex:1;padding:16px 22px">' +
      '<pre style="font-family:var(--font-mono);font-size:11px;line-height:1.6;color:' + c.txt2 + ';white-space:pre-wrap;margin:0">' +
      JSON.stringify(payload, null, 2) + '</pre></div>' +
      '<div style="padding:12px 22px;border-top:1px solid ' + c.brd + ';display:flex;justify-content:flex-end;gap:9px">' +
      '<button class="btn" onclick="document.getElementById(\'rad-payload-overlay\').remove()">Fechar</button></div>' +
      '</div></div>';
    var w = document.createElement('div'); w.innerHTML = html; document.body.appendChild(w.firstChild);
  };

  /* A spec diz que o SplitHub reenvia até receber 200 OK, mas não define
     teto de tentativas. O reenvio manual cobre o caso em que a automática
     desistiu — ver lacuna registrada na proposta. */
  window.radReenviar = function (id) {
    var e = (window._radEntregas || []).find(function (x) { return x.id === id; });
    if (!e) return;
    e.tentativas++;
    var sucesso = Math.random() > 0.35;
    e.status = sucesso ? 'entregue' : 'falha';
    e.httpStatus = sucesso ? 200 : 504;
    var ref = window.HOJE_REF || new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    var ag = new Date();
    e.ultimaTentativa = p(ref.getDate()) + '/' + p(ref.getMonth() + 1) + '/' + ref.getFullYear() + ' ' +
      p(ag.getHours()) + ':' + p(ag.getMinutes()) + ':' + p(ag.getSeconds());
    var i = intgPorId(e.integracaoId);
    if (i) { if (sucesso) { i.falhas = Math.max(0, i.falhas - 1); } i.entregas++; }
    window.radEntregasRender();
    window.radConexoesRender();
    if (window.radPoliticasRenderKPIs) window.radPoliticasRenderKPIs();
    window.radToast(sucesso ? 'Entrega confirmada — 200 OK.' : 'Reenvio falhou novamente (504).');
  };

  // ── Aba 3: comprovantes recebidos ──
  window.radComprovantesRender = function () {
    var tbody = el('t-rad-comprovantes'); if (!tbody) return;
    var f = (el('rad-comp-status') || {}).value || '';
    var lista = (window._radComprovantes || []).filter(function (c) { return !f || c.status === f; });

    tbody.innerHTML = lista.map(function (c) {
      var ok = c.status === 'confirmed';
      var i = intgPorId(c.integracaoId);
      return '<tr>' +
        '<td class="mono" style="font-size:11px;color:' + (ok ? 'var(--blue)' : 'var(--txt3)') + '">' + c.id + '</td>' +
        '<td class="mono" style="font-size:11px">' + c.darfId + '</td>' +
        '<td>' + badge(c.tipoPagamento === 'pix' ? 'PIX' : 'Boleto',
                       c.tipoPagamento === 'pix' ? 'var(--teal)' : 'var(--blue)',
                       c.tipoPagamento === 'pix' ? 'var(--teal-rgb)' : 'var(--blue-rgb)') + '</td>' +
        '<td class="r mono" style="font-size:11px;font-weight:600">' + fmtBRL(c.valorPago) + '</td>' +
        '<td style="font-size:11px;color:var(--txt2)">' + (i ? i.nome : '—') + '</td>' +
        '<td style="font-size:11px;color:var(--txt2);white-space:nowrap">' + c.recebidoEm + '</td>' +
        '<td>' + (ok ? badge('201 Created', 'var(--green)', 'var(--status-green-rgb)')
                     : badge('Rejeitado', 'var(--red)', 'var(--status-red-rgb)')) + '</td>' +
        '<td style="font-size:11px;color:' + (ok ? 'var(--txt3)' : 'var(--red)') + '">' + (c.motivo || '—') + '</td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--txt3);padding:24px">Nenhum comprovante para este filtro.</td></tr>';

    var rej = (window._radComprovantes || []).filter(function (c) { return c.status === 'rejeitado'; }).length;
    var bar = el('rad-comp-alerta');
    if (bar) {
      bar.style.display = rej ? 'flex' : 'none';
      setTxt('rad-comp-alerta-txt', rej + ' comprovante(s) rejeitado(s). ' +
        'O ERP considera o pagamento feito, mas o SplitHub não registrou — divergência silenciosa.');
    }
  };

  // ══════════════════════════════════════════════════════════
  // T-04 — EXECUÇÃO PROGRAMADA
  // ══════════════════════════════════════════════════════════

  window.radExecTab = function (tab, btn) {
    ['proxima', 'aprovacao', 'historico'].forEach(function (t) {
      var v = el('rad-exec-' + t); if (v) v.classList.toggle('active', t === tab);
    });
    if (btn) {
      btn.closest('.stabs').querySelectorAll('.stab').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
    }
  };

  window.radExecRender = function () {
    var lotes = window.radLotes ? window.radLotes() : [];
    window._radLotesCache = lotes;
    radExecProximaRender(lotes);
    radExecAprovacaoRender(lotes);
    radExecHistoricoRender();
  };

  // ── Seção 1: próxima execução ──
  function radExecProximaRender(lotes) {
    var wrap = el('rad-exec-proxima-lista'); if (!wrap) return;
    var programados = lotes.filter(function (l) { return l.status === 'programado' || l.status === 'aguardando_aprovacao'; });

    if (!programados.length) {
      wrap.innerHTML = '<div style="text-align:center;color:var(--txt3);padding:28px;font-size:13px">' +
        'Nenhuma execução programada. Ative uma política em <a href="javascript:void(0)" ' +
        'onclick="showAdminSub(\'exec-rad\',document.getElementById(\'subnav-admin-exec-rad\'))" ' +
        'style="color:var(--teal)">Configurações → Execução RAD</a>.</div>';
      return;
    }

    wrap.innerHTML = programados.map(function (l, idx) {
      var pol = (window._radPoliticas || []).find(function (p) { return p.id === l.politicaId; });
      var m = window.radModoCfg(pol.modo);
      var o = window.radOrqCfg(pol.orquestracao);
      return '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:15px 18px;margin-bottom:12px">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:200px">' +
        '<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">' +
        '<span style="font-size:13.5px;font-weight:700;color:var(--txt1)">' + l.politicaNome + '</span>' +
        badge(m.label, m.cor, m.rgb) + badge(o.label, o.cor, o.rgb) + '</div>' +
        '<div style="font-size:11px;color:var(--txt3);margin-top:3px">' +
          '<span style="font-family:var(--font-mono)">' + pol.id + '</span> · ' + l.cobertura + '</div>' +
        '<div style="font-size:11.5px;color:var(--txt2);margin-top:7px">Próxima janela: <strong style="color:var(--txt1)">dias ' +
          pol.diasExecucao.join(', ') + ' às ' + pol.horaExecucao + '</strong> · guias que vencem em até ' + pol.antecedencia + ' dias</div>' +
        '</div>' +
        '<div style="text-align:right;min-width:120px">' +
        '<div style="font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.06em">No lote</div>' +
        '<div style="font-size:20px;font-weight:800;color:var(--teal);margin-top:2px">' + l.qtd + '</div>' +
        '<div style="font-size:12px;font-weight:600;color:var(--txt1)">' + fmtCompacto(l.total) + '</div>' +
        (l.bloqueados.length ? '<div style="font-size:10.5px;color:var(--red);margin-top:4px">' + l.bloqueados.length + ' retida(s)</div>' : '') +
        '</div></div>' +
        (l.excedeAlcada ? '<div style="margin-top:10px;padding:8px 12px;background:rgba(var(--status-amber-rgb),.08);' +
          'border-left:2px solid var(--amber);border-radius:0 5px 5px 0;font-size:11.5px;color:var(--txt2)">' +
          'Excede a alçada de ' + fmtBRL(pol.limiteAutoAprovacao) + ' — irá para a fila de aprovação.</div>' : '') +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;padding-top:11px;border-top:1px solid var(--border)">' +
        '<button class="btn" style="font-size:11px;padding:5px 12px" onclick="radExecExpandir(' + idx + ')">Ver as ' + l.qtd + ' nota(s)</button>' +
        '<button class="btn btn-t" style="font-size:11px;padding:5px 12px" onclick="radExecAntecipar(' + idx + ')">Antecipar execução</button>' +
        '</div>' +
        '<div id="rad-exec-det-' + idx + '" style="display:none;margin-top:12px"></div>' +
        '</div>';
    }).join('');
  }

  window.radExecExpandir = function (idx) {
    var l = (window._radLotesCache || [])[idx];
    var box = el('rad-exec-det-' + idx);
    if (!l || !box) return;
    if (box.style.display === 'block') { box.style.display = 'none'; return; }
    box.style.display = 'block';

    var linhas = l.incluidos.map(function (r, i) {
      return '<tr><td class="mono" style="font-size:10.5px;color:var(--blue)">' + r.rfId + '</td>' +
        '<td style="font-size:11px">' + r.forn + '</td>' +
        '<td style="font-size:11px">' + r.tipoFiscal + '</td>' +
        '<td class="r mono" style="font-size:11px">' + fmtBRL(r.valor) + '</td>' +
        '<td style="font-size:11px;color:var(--txt2)">' + r.dataRF + '</td>' +
        '<td><button class="btn" style="font-size:10px;padding:2px 8px" onclick="radExcluirDoLote(' + idx + ',' + i + ')">Excluir</button></td></tr>';
    }).join('');

    var bloq = l.bloqueados.length
      ? '<div style="margin-top:12px;padding:10px 13px;background:rgba(var(--status-red-rgb),.07);' +
        'border:1px solid rgba(var(--status-red-rgb),.2);border-radius:7px">' +
        '<div style="font-size:11px;font-weight:700;color:var(--amber);margin-bottom:6px">' +
        l.bloqueados.length + ' nota(s) retida(s) por flag de exclusão</div>' +
        '<div style="font-size:11px;color:var(--txt2);line-height:1.55">' +
        l.bloqueados.map(function (b) {
          return b.rfId + ' · ' + b.forn + ' · ' + fmtBRL(b.valor) +
            (b.motivoBloqueio ? ' <span style="color:var(--txt3)">— ' + b.motivoBloqueio + '</span>' : '');
        }).join('<br>') +
        '</div><div style="font-size:10.5px;color:var(--txt3);margin-top:7px;font-style:italic">' +
        'Retidas pela política. Tratar a causa devolve a nota ao pool para a próxima janela.</div></div>'
      : '';

    box.innerHTML = '<div class="twrap" style="max-height:280px;overflow:auto"><table>' +
      '<thead><tr><th>RF</th><th>Fornecedor</th><th>Tipo</th><th class="r">Valor</th><th>Data RF</th><th></th></tr></thead>' +
      '<tbody>' + (linhas || '<tr><td colspan="6" style="text-align:center;color:var(--txt3);padding:16px">Nenhuma nota elegível.</td></tr>') +
      '</tbody></table></div>' + bloq;
  };

  window.radExcluirDoLote = function (idx, i) {
    var l = (window._radLotesCache || [])[idx]; if (!l) return;
    var r = l.incluidos[i]; if (!r) return;
    if (!confirm('Excluir ' + r.rfId + ' (' + fmtBRL(r.valor) + ') do próximo lote?\n\n' +
                 'A nota volta ao pool e pode entrar na janela seguinte.')) return;
    l.incluidos.splice(i, 1);
    l.qtd = l.incluidos.length;
    l.total = l.incluidos.reduce(function (s, x) { return s + x.valor; }, 0);
    radExecProximaRender(window._radLotesCache);
    window.radExecExpandir(idx);
    window.radToast('Nota excluída do lote, com justificativa registrada.');
  };

  window.radExecAntecipar = function (idx) {
    var l = (window._radLotesCache || [])[idx]; if (!l) return;
    var pol = (window._radPoliticas || []).find(function (p) { return p.id === l.politicaId; });
    if (!confirm('Executar a janela agora, fora do calendário?\n\n' +
                 l.qtd + ' guia(s) · ' + fmtBRL(l.total) +
                 (l.excedeAlcada ? '\n\nO lote excede a alçada e irá para aprovação.' : '\n\nDentro da alçada: será gerado e enviado.'))) return;
    if (pol) {
      window.radRegistrarEvento(pol, 'execucao',
        [{ campo: 'Guias', de: '—', para: l.qtd + ' · ' + fmtBRL(l.total) }],
        'Execução antecipada, fora da janela programada.');
      var ref = window.HOJE_REF || new Date();
      var p = function (n) { return String(n).padStart(2, '0'); };
      var ag = new Date();
      pol.ultimaExecucao = p(ref.getDate()) + '/' + p(ref.getMonth() + 1) + '/' + ref.getFullYear() +
        ' ' + p(ag.getHours()) + ':' + p(ag.getMinutes());
    }
    window.radToast(l.excedeAlcada
      ? l.qtd + ' guia(s) geradas — aguardando aprovação.'
      : l.qtd + ' guia(s) geradas e enviadas ao ERP.');
    window.radExecRender();
    if (window.radPoliticasRenderKPIs) window.radPoliticasRenderKPIs();
  };

  // ── Seção 2: aguardando aprovação ──
  function radExecAprovacaoRender(lotes) {
    var wrap = el('rad-exec-aprov-lista'); if (!wrap) return;
    var aguard = lotes.filter(function (l) { return l.status === 'aguardando_aprovacao'; });
    var comBloqueio = lotes.filter(function (l) { return l.bloqueados.length; });

    var h = '';

    if (aguard.length) {
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">' +
        '<span style="font-size:11px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.07em">' +
        'Acima da alçada — ' + aguard.length + '</span>' +
        '<span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:3px;letter-spacing:.04em;' +
        'background:rgba(var(--status-amber-rgb),.14);color:var(--amber)">OPCIONAL · MOCK</span></div>' +
        '<div style="font-size:11px;color:var(--txt3);margin-bottom:10px;line-height:1.5">' +
        'A alçada é uma configuração opcional, desativada por padrão. Nesta versão a fila é montada e exibida, ' +
        'mas aprovar não dispara emissão real de webhook.</div>';
      h += aguard.map(function (l, i) {
        var pol = (window._radPoliticas || []).find(function (p) { return p.id === l.politicaId; });
        return '<div style="background:var(--card);border:1px solid rgba(var(--status-amber-rgb),.3);border-left:3px solid var(--amber);' +
          'border-radius:8px;padding:14px 16px;margin-bottom:10px">' +
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
          '<div><div style="font-size:13px;font-weight:700;color:var(--txt1)">' + l.politicaNome + '</div>' +
          '<div style="font-size:11px;color:var(--txt2);margin-top:4px">' + l.qtd + ' guia(s) · <strong style="color:var(--txt1)">' +
            fmtBRL(l.total) + '</strong> · alçada ' + fmtBRL(pol.limiteAutoAprovacao) + '</div>' +
          '<div style="font-size:10.5px;color:var(--amber);margin-top:4px">Na fila há 2 dias · aprovadores: ' +
            (pol.aprovadores.join(', ') || 'nenhum configurado') + '</div></div>' +
          '<div style="display:flex;gap:8px;align-items:flex-start">' +
          '<button class="btn" style="font-size:11px;padding:5px 12px" onclick="radRecusarLote(' + i + ')">Recusar</button>' +
          '<button class="btn btn-t" style="font-size:11px;padding:5px 14px" onclick="radAprovarLote(' + i + ')">Aprovar e enviar</button>' +
          '</div></div></div>';
      }).join('');
    }

    if (comBloqueio.length) {
      h += '<div style="font-size:11px;font-weight:700;color:var(--txt3);text-transform:uppercase;' +
        'letter-spacing:.07em;margin:18px 0 10px">Retidas por flag de exclusão</div>';
      h += comBloqueio.map(function (l) {
        return '<div style="background:var(--card);border:1px solid rgba(var(--status-amber-rgb),.3);border-left:3px solid var(--amber);' +
          'border-radius:8px;padding:14px 16px;margin-bottom:10px">' +
          '<div style="font-size:13px;font-weight:700;color:var(--txt1)">' + l.politicaNome + '</div>' +
          '<div style="font-size:11px;color:var(--txt2);margin-top:5px">' + l.bloqueados.length +
            ' nota(s) fora do lote pelos critérios da política</div>' +
          '<div style="font-size:11px;color:var(--txt2);margin-top:7px;line-height:1.6">' +
            l.bloqueados.map(function (b) {
              return '<span style="font-family:var(--font-mono);color:var(--blue)">' + b.rfId + '</span> · ' +
                b.forn + ' · ' + fmtBRL(b.valor) +
                (b.motivoBloqueio ? ' <span style="color:var(--txt3)">— ' + b.motivoBloqueio + '</span>' : '');
            }).join('<br>') + '</div>' +
          '<div style="font-size:10.5px;color:var(--txt3);margin-top:8px;font-style:italic">' +
            'Resolver a causa no módulo correspondente devolve a nota ao pool.</div>' +
          '</div>';
      }).join('');
    }

    wrap.innerHTML = h || '<div style="text-align:center;color:var(--txt3);padding:28px;font-size:13px">' +
      'Nada aguardando decisão — que é o estado esperado.<br>' +
      '<span style="font-size:12px">Com as políticas em modo automático, as guias seguem ao ERP sozinhas. ' +
      'As réguas de pagamento são aplicadas lá.</span></div>';
  }

  window.radAprovarLote = function (i) {
    var aguard = (window._radLotesCache || []).filter(function (l) { return l.status === 'aguardando_aprovacao'; });
    var l = aguard[i]; if (!l) return;
    if (!confirm('Aprovar ' + l.qtd + ' guia(s) somando ' + fmtBRL(l.total) + '?\n\n' +
                 'A aprovação dispara a emissão do webhook rad.darf_recebida ao ERP.')) return;
    l.status = 'aprovado';
    window.radToast(l.qtd + ' guia(s) aprovadas — webhook emitido ao ERP.');
    window.radExecRender();
    if (window.radPoliticasRenderKPIs) window.radPoliticasRenderKPIs();
  };

  window.radRecusarLote = function (i) {
    var aguard = (window._radLotesCache || []).filter(function (l) { return l.status === 'aguardando_aprovacao'; });
    var l = aguard[i]; if (!l) return;
    var motivo = prompt('Motivo da recusa (registrado na auditoria):');
    if (motivo === null) return;
    l.status = 'recusado';
    window.radToast('Lote recusado. As notas voltam ao pool para a próxima janela.');
    window.radExecRender();
  };

  // ── Seção 3: histórico e falhas ──
  function radExecHistoricoRender() {
    var tbody = el('t-rad-execucoes');
    if (tbody) {
      var hist = [
        { data: '05/09/2026 06:00', pol: 'POL-0001', guias: 14, valor: 186400.00, entregues: 14, confirmados: 12 },
        { data: '01/09/2026 07:00', pol: 'POL-0002', guias: 6,  valor: 48200.00,  entregues: 5,  confirmados: 5 },
        { data: '20/08/2026 06:00', pol: 'POL-0001', guias: 11, valor: 142900.00, entregues: 11, confirmados: 11 }
      ];
      tbody.innerHTML = hist.map(function (h) {
        var p = (window._radPoliticas || []).find(function (x) { return x.id === h.pol; });
        var pendentes = h.entregues - h.confirmados;
        return '<tr>' +
          '<td style="font-size:11px;white-space:nowrap">' + h.data + '</td>' +
          '<td style="font-size:11px">' + (p ? (p.nome || p.id) : h.pol) + '</td>' +
          '<td class="mono" style="font-size:11px;color:var(--blue)">' + h.pol + '</td>' +
          '<td class="r mono" style="font-size:11px">' + h.guias + '</td>' +
          '<td class="r mono" style="font-size:11px;font-weight:600">' + fmtBRL(h.valor) + '</td>' +
          '<td class="r mono" style="font-size:11px;color:' + (h.entregues === h.guias ? 'var(--green)' : 'var(--amber)') + '">' +
            h.entregues + '/' + h.guias + '</td>' +
          '<td class="r mono" style="font-size:11px;color:' + (pendentes ? 'var(--amber)' : 'var(--green)') + '">' +
            h.confirmados + '/' + h.guias + '</td>' +
          '</tr>';
      }).join('');
    }

    // Fila de return_code com erro — agrupada por causa, cada grupo com seu destino
    var wrap = el('rad-exec-erros'); if (!wrap) return;
    var erros = [
      { code: 'DFE_NAO_ENCONTRADO', itens: [
        { rf: 'RF-IBS-004902', forn: 'Sulpar Implementos S.A.', valor: 3400.00, dfe: '3526…4902' },
        { rf: 'RF-CBS-004902', forn: 'Sulpar Implementos S.A.', valor: 2040.00, dfe: '3526…4902' }
      ] },
      { code: 'VALOR_PARCIAL_SUPERIOR_DFE', itens: [
        { rf: 'RF-IBS-004871', forn: 'Tectra Sistemas Ltda.', valor: 9120.00, dfe: '3526…4871' }
      ] }
    ];
    wrap.innerHTML = erros.map(function (g) {
      var cfg = window.RAD_RETURN_CODES[g.code];
      var total = g.itens.reduce(function (s, i) { return s + i.valor; }, 0);
      return '<div style="background:var(--card);border:1px solid var(--border);border-left:3px solid ' + cfg.cor + ';' +
        'border-radius:8px;padding:14px 16px;margin-bottom:11px">' +
        '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap">' +
        '<div><span style="font-family:var(--font-mono);font-size:11.5px;font-weight:700;color:' + cfg.cor + '">' + g.code + '</span>' +
        '<span style="font-size:12px;color:var(--txt2);margin-left:9px">' + cfg.label + '</span></div>' +
        '<div style="font-size:11px;color:var(--txt2)">' + g.itens.length + ' guia(s) · <strong style="color:var(--txt1)">' +
          fmtBRL(total) + '</strong></div></div>' +
        '<div style="font-size:11px;color:var(--txt2);margin-top:9px;line-height:1.6">' +
          g.itens.map(function (i) {
            return '<span style="font-family:var(--font-mono);color:var(--blue)">' + i.rf + '</span> · ' +
              i.forn + ' · ' + fmtBRL(i.valor);
          }).join('<br>') + '</div>' +
        '<div style="margin-top:10px;padding-top:9px;border-top:1px solid var(--border);font-size:11px;color:var(--txt2)">' +
        '<strong style="color:var(--txt1)">Ação:</strong> ' + cfg.acao + '</div>' +
        '</div>';
    }).join('');
  }

  window.radExecLimpar = function () {
    var e = el('rad-entregas-status'); if (e) e.value = '';
    window.radEntregasRender();
  };

  window.radIntgInit = function () {
    if (window.intgInit) window.intgInit(); else window.radConexoesRender();
    window.radEntregasRender();
    window.radComprovantesRender();
  };

})();

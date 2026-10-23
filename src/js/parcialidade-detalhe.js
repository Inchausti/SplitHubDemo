/* ═══════════════════════════════════════════════════════════════════════════
   Parcialidade — detalhe do DF e do RF
   Branch parcialidade-prototipo · avaliado pelo time em 23/10/2026

   1. Detalhe do DF (proposta B, aprovada): a partição do crédito e os
      registros fiscais viram um quadro só, CBS × IBS, porque falam do mesmo
      RF; e os Valores do documento ganham as parcelas da partição.
   2. Histórico do ciclo, no DF e no RF (proposta 3, aprovada): trilha de
      auditoria filtrável, sobre um modelo de eventos normalizado aqui:
        - com a partição, os movimentos de valor substituem os eventos de
          apropriação e utilização que falavam do RF inteiro;
        - envio e entrega do mesmo webhook ao ERP viram uma linha só;
        - o órgão aparece pelo nome, nunca como "Fisco";
        - o que ainda não aconteceu sai da trilha e vai para "Situação agora".
   3. Aba Apuração assistida, uma por imposto: trilha de auditoria de todos os
      registros da apuração — movimentos de valor e conciliações do tributo.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var P = window.shParcial;
  if (!P) return;
  var X = window.shDetalhe = window.shDetalhe || {};
  X._cache = {};

  /* ── utilitários ──────────────────────────────────────────────────────── */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function r2(v) { return Math.round((+v || 0) * 100) / 100; }
  function money(v) { return typeof window.ff === 'function' ? window.ff(r2(v)) : 'R$ ' + r2(v).toFixed(2).replace('.', ','); }
  function br(s) { var p = String(s || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; }
  function brTs(ts) { if (!ts) return '—'; var h = String(ts).slice(11, 16); return br(ts) + (h ? ' ' + h : ''); }
  function mesAno(s) { var p = String(s || '').slice(0, 7).split('-'); return p.length === 2 ? p[1] + '/' + p[0] : '—'; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function chave(s) { return String(s).replace(/[^\w-]/g, '-'); }
  function cada(lista, fn) { Array.prototype.forEach.call(lista || [], fn); }

  var ORG = { cbs: 'Receita Federal', ibs: 'Comitê Gestor' };
  var ORG_A = { cbs: 'a Receita Federal', ibs: 'o Comitê Gestor' };
  var LEITURA = { cbs: 'consulta diária à Receita Federal, 06:00', ibs: 'arquivo diário do Comitê Gestor, por webhook' };
  function trib(rf) { return rf && rf.tipoFiscal === 'ibs' ? 'ibs' : 'cbs'; }
  function parc(k) { return P.PARC.filter(function (p) { return p.k === k; })[0] || { k: k, rot: k, cor: 'var(--border)' }; }
  function dot(cor) { return '<span class="pp-dot" style="background:' + cor + '"></span>'; }
  function parcTag(k) {
    if (!k) return '<span class="pp-mut">Apuração do documento</span>';
    var p = parc(k);
    return '<span class="pp-parc">' + dot(p.cor) + esc(p.rot) + '</span>';
  }
  function chipTrib(t) { return t ? '<span class="pp-trib pp-trib-' + t + '">' + t.toUpperCase() + '</span>' : '<span class="pp-trib pp-trib-doc">DF</span>'; }
  function cel(v) {
    if (v === null) return '<span class="pp-mut" title="Não informado pelo Comitê Gestor (D-PAR-09)">n/i</span>';
    if (!(v > 0)) return '<span class="pp-mut">—</span>';
    return money(v);
  }
  // vencimento da apropriação: último dia do mês seguinte ao da emissão (RN-CRE-04)
  function vencimento(emissao) {
    var p = String(emissao || '').slice(0, 10).split('-'); if (p.length !== 3) return null;
    var d = new Date(+p[0], +p[1] + 1, 0);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function movsAsc(rf) { return (rf.movimentos || []).slice().sort(function (a, b) { return a.reconhecidoEm < b.reconhecidoEm ? -1 : a.reconhecidoEm > b.reconhecidoEm ? 1 : 0; }); }
  function rfsDe(nf) {
    return (nf.registrosFiscais || []).filter(function (rf) { return rf.balances; })
      .sort(function (a, b) { return trib(a) === trib(b) ? 0 : trib(a) === 'cbs' ? -1 : 1; });
  }
  X.ativo = function (nf) { return !!(nf && nf.tipo === 'entrada' && rfsDe(nf).length); };
  X.irRF = function (id) {
    var o = document.getElementById('nf-detalhe-overlay'); if (o) o.remove();
    if (window.abrirDetalheRF) window.abrirDetalheRF(id);
  };

  /* ── valores do documento: parcela × tributo ──────────────────────────── */
  X.valores = function (nf) {
    var rfs = rfsDe(nf), by = {};
    rfs.forEach(function (rf) { by[trib(rf)] = rf; });
    var linhas = P.PARC.map(function (p) {
      var c = by.cbs ? by.cbs.balances[p.k] : undefined, i = by.ibs ? by.ibs.balances[p.k] : undefined;
      return { p: p, total: r2((c || 0) + (i || 0)), so: c === null ? 'ibs' : i === null ? 'cbs' : '' };
    });
    var ap = { cbs: by.cbs ? r2(by.cbs.valor) : 0, ibs: by.ibs ? r2(by.ibs.valor) : 0 };
    ap.total = r2(ap.cbs + ap.ibs);
    return { rfs: rfs, linhas: linhas, ap: ap, soma: r2(linhas.reduce(function (s, l) { return s + l.total; }, 0)) };
  };
  function notaSo(so) {
    return so === 'cbs' ? '<sup title="O Comitê Gestor não informa esta parcela no IBS">¹</sup>'
      : so === 'ibs' ? '<sup title="Parcela que só existe no IBS">²</sup>' : '';
  }
  // datas do RF lidas da partição (D-PAR-03)
  function datasRF(rf) {
    var ms = movsAsc(rf), ap = ms.filter(function (m) { return m.para === 'available'; });
    var uso = ms.filter(function (m) { return m.para === 'utilized'; });
    return {
      aprop: ap.length ? br(ap[0].reconhecidoEm) + (ap.length > 1 ? ' + ' + (ap.length - 1) + ' fatia(s)' : '') : '<span class="pp-mut">—</span>',
      uso: uso.length ? br(uso[uso.length - 1].reconhecidoEm) : '<span class="pp-mut">—</span>',
      prazo: rf.prazoArt54Prox ? br(rf.prazoArt54Prox) + ' <span class="pp-mut">· ' + money(rf.balances.available) + '</span>' : '<span class="pp-mut">—</span>'
    };
  }
  function metodo(rf, nf) { return rf.metodoPagamento || nf.metodoPagamento || '—'; }
  function btnRF(rf) { return '<button class="pp-btn" onclick="window.shDetalhe.irRF(\'' + esc(rf.id) + '\')">Ver RF →</button>'; }

  /* ── quadro CBS × IBS (proposta B) ────────────────────────────────────── */
  // No detalhe do RF o mesmo quadro sai com a coluna do tributo dele e sem a
  // coluna do documento.
  function quadro(nf, q, rfUnico) {
    var cols = rfUnico ? [rfUnico] : q.rfs, doc = !rfUnico, n = cols.length + (doc ? 2 : 1), mut = '<span class="pp-mut">—</span>';
    var grp = function (t) { return '<tr class="pp-grp"><td colspan="' + n + '">' + t + '</td></tr>'; };
    // livre: célula que quebra linha (datas, selos, marcas); as de valor não quebram
    var lin = function (rot, vals, tot, cls, livre) {
      var td = '<td class="r' + (livre ? '' : ' pp-num') + '">';
      return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + rot + '</td>' + vals.map(function (v) { return td + v + '</td>'; }).join('')
        + (doc ? td + tot + '</td>' : '') + '</tr>';
    };
    var h = '<table class="pp-tab pp-quadro"><thead><tr><th></th>'
      + cols.map(function (rf) {
        var t = trib(rf);
        return '<th class="r"><div class="pp-th-t">' + chipTrib(t) + ORG[t] + '</div>'
          + '<div class="pp-mono">' + esc(rf.id) + '</div>' + P.barra(rf, 6) + '</th>';
      }).join('') + (doc ? '<th class="r">Documento</th>' : '') + '</tr></thead><tbody>';
    h += grp(doc ? 'Valores do documento' : 'Valor')
      + (doc ? lin('Total do documento', cols.map(function () { return mut; }), money(nf.valorTotal || 0))
        + lin('Líquido', cols.map(function () { return mut; }), money(nf.valorLiquido || 0)) : '')
      + lin('Tributo apurado', cols.map(function (rf) { return money(rf.valor); }), money(q.ap.total), 'pp-forte');
    h += grp('Partição do crédito');
    q.linhas.forEach(function (l) {
      if (rfUnico && l.p.k === 'refund_available' && trib(rfUnico) === 'cbs') return;
      h += lin('<span class="pp-parc">' + dot(l.p.cor) + esc(l.p.rot) + (doc ? notaSo(l.so) : '') + '</span>',
        cols.map(function (rf) { return cel(rf.balances[l.p.k]); }), l.total > 0 ? money(l.total) : mut);
    });
    var fecha = Math.abs(q.soma - q.ap.total) < 0.01;
    h += lin('Soma das parcelas', cols.map(function (rf) {
      var ok = Math.abs(P.apurado(rf.balances) - r2(rf.valor)) < 0.01;
      return '<span class="pp-conf ' + (ok ? 'ok' : 'err') + '">' + (ok ? '✓ ' : '✕ ') + '</span>' + money(P.apurado(rf.balances));
    }), '<span class="pp-conf ' + (fecha ? 'ok' : 'err') + '">' + (fecha ? '✓ ' : '✕ ') + '</span>' + money(q.soma), 'pp-forte');
    h += grp('Situação')
      + lin('Status', cols.map(function (rf) { return P.selo(rf, false); }), '<span class="pp-mut" title="D-PAR-04">sem status próprio</span>', '', true)
      + lin('Marcas', cols.map(function (rf) { return rf.flagsFatia && rf.flagsFatia.length ? P.flagsHtml(rf) : mut; }), mut, '', true);
    var ds = cols.map(datasRF);
    h += grp('Datas')
      + lin('Apropriação', ds.map(function (d) { return d.aprop; }), mut, '', true)
      + lin('Último uso', ds.map(function (d) { return d.uso; }), mut, '', true)
      + lin('Limite art. 54 mais próximo', ds.map(function (d) { return d.prazo; }), mut, '', true);
    h += grp('Recolhimento e leitura')
      + lin('Pagamento', cols.map(function (rf) { return esc(metodo(rf, nf)); }), mut, '', true)
      + lin('Leitura do órgão', cols.map(function (rf) { return trib(rf) === 'cbs' ? 'consulta diária' : 'arquivo diário'; }), mut, '', true);
    h += '</tbody>' + (doc ? '<tfoot><tr><td></td>' + cols.map(function (rf) { return '<td class="r">' + btnRF(rf) + '</td>'; }).join('') + '<td></td></tr></tfoot>' : '') + '</table>';
    var t0 = rfUnico ? trib(rfUnico) : null;
    return '<div class="mbox-section-label">' + (doc ? 'Valores e registros fiscais · CBS × IBS' : 'Valor e partição · ' + t0.toUpperCase() + ' · ' + ORG[t0]) + '</div>'
      + '<div class="pp-scroll pp-bloco">' + h + '</div>'
      + '<div class="pp-nota pp-nota-q">' + (doc ? 'n/i: não informado pelo Comitê Gestor. ¹ Só CBS, fora da soma (D-PAR-09). ² Só IBS.'
        : t0 === 'ibs' ? 'n/i: parcela não informada pelo Comitê Gestor (D-PAR-09).' : 'Ressarcimento disponível só existe no IBS.') + '</div>';
  }

  /* ── abas ─────────────────────────────────────────────────────────────── */
  X.alternar = function (btn) {
    var g = btn.getAttribute('data-g'), v = btn.getAttribute('data-v');
    var box = btn.closest('[data-pp-box]'); if (!box) return;
    cada(box.querySelectorAll('[data-g="' + g + '"]'), function (b) { b.classList.toggle('on', b === btn); });
    cada(box.querySelectorAll('[data-' + g + ']'), function (el) {
      if (el.closest('[data-pp-box]') !== box) return;
      el.style.display = el.getAttribute('data-' + g) === v ? '' : 'none';
    });
  };
  function abasBar(tabs, fim) {
    return '<div class="pp-abas">' + tabs.map(function (t, i) {
      return '<button data-g="aba" data-v="' + t[0] + '" class="' + (i ? '' : 'on') + '" onclick="window.shDetalhe.alternar(this)">' + t[1] + '</button>';
    }).join('') + (fim ? '<span class="pp-abas-fim">' + fim + '</span>' : '') + '</div>';
  }

  /* ═══ modelo de eventos ═══════════════════════════════════════════════ */
  var FASE_DE = {
    'INGESTÃO': 'documento', 'VALIDAÇÃO': 'documento', 'GERAÇÃO RF': 'documento',
    'PAGAMENTO': 'recolhimento', 'AVISO AO FORNECEDOR': 'recolhimento', 'RAD ASSUMIDO': 'recolhimento', 'RAD REVERTIDO': 'recolhimento', 'APROPRIAÇÃO': 'recolhimento',
    'UTILIZAÇÃO': 'uso', 'RESSARCIMENTO': 'uso', 'EXTINÇÃO': 'uso',
    'CONC APURAÇÃO': 'conciliacao', 'CONC FINANCEIRA': 'conciliacao', 'CONCILIAÇÃO': 'conciliacao',
    'INCONSISTÊNCIA': 'risco', 'VENCIMENTO': 'risco', 'AGUARDANDO': 'risco', 'GLOSA': 'risco', 'IMPUGNAÇÃO': 'risco', 'GLOSA DEFINITIVA': 'risco',
    'GLOSA REVERTIDA': 'risco', 'PRESCRIÇÃO': 'risco', 'SUSPENSÃO': 'risco', 'RESTABELECIMENTO': 'risco',
    'ENVIO ERP': 'erp', 'ENTREGA ERP': 'erp', 'COMPROVANTE ERP': 'erp', 'ERP': 'erp'
  };
  var TITULO = {
    'INGESTÃO': 'Documento recebido', 'VALIDAÇÃO': 'Documento validado', 'GERAÇÃO RF': 'Registro fiscal gerado',
    'PAGAMENTO': 'Guia paga', 'AVISO AO FORNECEDOR': 'Fornecedor avisado', 'RAD ASSUMIDO': 'Recolhimento assumido via RAD', 'RAD REVERTIDO': 'RAD revertido',
    'APROPRIAÇÃO': 'Apropriação', 'UTILIZAÇÃO': 'Utilização', 'RESSARCIMENTO': 'Ressarcimento', 'EXTINÇÃO': 'Extinção',
    'CONC APURAÇÃO': 'Conciliação com a apuração assistida', 'CONC FINANCEIRA': 'Conciliação financeira', 'CONCILIAÇÃO': 'Conciliação',
    'INCONSISTÊNCIA': 'Inconsistência', 'VENCIMENTO': 'Prazo de apropriação vencido', 'AGUARDANDO': 'Aguardando',
    'GLOSA': 'Glosa', 'IMPUGNAÇÃO': 'Impugnação', 'GLOSA DEFINITIVA': 'Glosa definitiva', 'GLOSA REVERTIDA': 'Glosa revertida',
    'COMPROVANTE ERP': 'Comprovante recebido do ERP'
  };
  var ORIGENS = [['orgao', 'Órgão'], ['financeiro', 'Financeiro'], ['plataforma', 'SplitHub'], ['operador', 'Operador'], ['erp', 'ERP']];
  var ORIGEM_ROT = {}; ORIGENS.forEach(function (o) { ORIGEM_ROT[o[0]] = o[1]; });

  // o órgão pelo nome: Receita Federal e Comitê Gestor nunca viram "Fisco"
  function orgaoTxt(s, t) {
    s = String(s == null ? '' : s);
    if (!t) return s;
    return s.replace(/Comitê Gestor IBS \/ RFB|Comitê Gestor IBS\/RFB|RFB \/ Comitê Gestor/g, ORG[t])
      .replace(/pelo Fisco/g, t === 'cbs' ? 'pela Receita Federal' : 'pelo Comitê Gestor')
      .replace(/\bFisco\b/g, ORG[t]);
  }
  function origemDe(tipo, ator, fase) {
    if (fase === 'erp') return 'erp';
    if (tipo === 'PAGAMENTO') return 'financeiro';
    if (/Receita Federal|Comitê Gestor|SEFAZ|RFB|Fisco/.test(ator)) return 'orgao';
    if (tipo === 'RAD ASSUMIDO' || tipo === 'RAD REVERTIDO' || tipo === 'IMPUGNAÇÃO' || /operador|usuári|Admin|analista/i.test(ator)) return 'operador';
    return 'plataforma';
  }
  function norm(e, rf) {
    var t = rf ? trib(rf) : null, fase = FASE_DE[e.tipo] || 'outros', ator = orgaoTxt(e.ator, t);
    return {
      ts: e.ts && e.ts !== '—' ? String(e.ts) : null, tipo: e.tipo, titulo: TITULO[e.tipo] || e.tipo,
      desc: orgaoTxt(e.desc, t), ator: ator, modulo: e.modulo || '', cls: e.cls || 'ok',
      trib: t, rfId: rf ? rf.id : null, fase: fase, origem: origemDe(e.tipo, ator, fase), valor: 0
    };
  }
  var HORA = { pending: '10:00', available: '11:30', utilized: '14:18', not_appropriable: '10:45', not_usable: '10:45', refund_requested: '15:00', expired: '00:05', suspended: '10:00', restored: '10:00' };
  function movEv(m, rf) {
    var t = trib(rf), ap = r2(rf.valor), parcial = m.valor < ap - 0.005, tipo, titulo, fase;
    var deGlosa = m.de === 'not_appropriable' || m.de === 'not_usable';
    if (m.de === null && m.para === 'pending') { tipo = 'GERAÇÃO RF'; titulo = 'Valor registrado'; fase = 'documento'; }
    else if (deGlosa && (m.para === 'pending' || m.para === 'available')) { tipo = 'GLOSA REVERTIDA'; titulo = 'Glosa revertida'; fase = 'risco'; }
    else if (m.para === 'available') { tipo = 'APROPRIAÇÃO'; titulo = parcial ? 'Apropriação parcial' : 'Apropriação'; fase = 'recolhimento'; }
    else if (m.para === 'utilized') { tipo = /Ressarc/.test(m.causa) ? 'RESSARCIMENTO' : 'UTILIZAÇÃO'; titulo = tipo === 'RESSARCIMENTO' ? 'Uso por ressarcimento' : parcial ? 'Compensação parcial' : 'Compensação'; fase = 'uso'; }
    else if (m.para === 'not_appropriable' || m.para === 'not_usable') { tipo = 'GLOSA'; titulo = parcial ? 'Glosa parcial' : 'Glosa'; fase = 'risco'; }
    else if (m.para === 'refund_requested') { tipo = 'RESSARCIMENTO'; titulo = 'Pedido de ressarcimento'; fase = 'uso'; }
    else if (m.para === 'expired') { tipo = 'PRESCRIÇÃO'; titulo = 'Prescrição'; fase = 'risco'; }
    else if (m.para === 'suspended') { tipo = 'SUSPENSÃO'; titulo = 'Suspensão'; fase = 'risco'; }
    else if (m.para === 'restored') { tipo = 'RESTABELECIMENTO'; titulo = 'Restabelecimento'; fase = 'risco'; }
    else { tipo = 'MOVIMENTO'; titulo = 'Movimento de valor'; fase = 'outros'; }
    var fonte = String(m.fonte || '');
    return {
      ts: m.reconhecidoEm + 'T' + (HORA[m.para] || '09:00'), tipo: tipo, titulo: titulo,
      desc: esc(m.causa) + (m.vinculo ? ' · ' + esc(m.vinculo) : '') + (m.prazoArt54 ? ' · limite do art. 54 desta fatia: ' + br(m.prazoArt54) : ''),
      ator: fonte, modulo: 'Movimentos de valor', cls: tipo === 'GLOSA' || tipo === 'PRESCRIÇÃO' ? 'erro' : 'ok',
      trib: t, rfId: rf.id, fase: fase, origem: /Receita Federal|Comitê Gestor/.test(fonte) ? 'orgao' : 'plataforma',
      valor: m.valor, de: m.de, para: m.para, mov: true
    };
  }
  function mesmoDia(a, b) { return String(a || '').slice(0, 10) === String(b || '').slice(0, 10); }
  function juntarErp(evs) {
    var grupos = {}, out = [];
    evs.forEach(function (e) {
      if (e.tipo !== 'ENVIO ERP' && e.tipo !== 'ENTREGA ERP') { out.push(e); return; }
      var m = /payload (evt_[0-9a-f]+)/.exec(e.desc || ''), k = (m ? m[1] : e.desc) + '|' + e.rfId;
      var g = grupos[k];
      if (!g) {
        g = grupos[k] = { ts: e.ts, tipo: 'ERP', titulo: 'Webhook ao ERP', desc: '', ator: 'SplitHub → ERP · Financeiro', modulo: 'Integrações',
          cls: 'ok', trib: e.trib, rfId: e.rfId, fase: 'erp', origem: 'erp', valor: 0, entrega: 'entregue' };
        out.push(g);
      }
      if (e.ts && (!g.ts || e.ts < g.ts)) g.ts = e.ts;
      if (e.tipo === 'ENVIO ERP') {
        var nome = /Webhook (\S+)/.exec(e.desc || '');
        g.titulo = 'Webhook ' + (nome ? nome[1] : 'ao ERP');
        g.desc = String(e.desc || '').replace(/^Webhook \S+ enviado ao ERP · [A-Z]+ · /, '');
      } else {
        g.entrega = e.cls === 'ok' ? 'entregue' : e.cls === 'pending' ? 'pendente' : 'falhou';
        g.cls = e.cls;
        g.descEntrega = e.desc;
      }
    });
    return out;
  }
  function ordenar(evs, desc) {
    return evs.sort(function (a, b) {
      if (!a.ts && !b.ts) return 0; if (!a.ts) return 1; if (!b.ts) return -1;
      return desc ? (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0) : (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0);
    });
  }

  X.eventos = function (nf, rfAlvo) {
    var out = [], doc = false;
    var rfs = rfAlvo ? [rfAlvo] : (nf.registrosFiscais || []);
    rfs.forEach(function (rf) {
      var brutos = window._rfGerarHistorico ? window._rfGerarHistorico(rf, nf) : [];
      var comPart = !!(rf.balances && rf.movimentos);
      var apropriado = comPart ? movsAsc(rf).filter(function (m) { return m.de === 'pending' && m.para === 'available'; }).reduce(function (s, m) { return s + m.valor; }, 0) : 0;
      var deles = [];
      brutos.forEach(function (e) {
        if (e.tipo === 'INGESTÃO' || e.tipo === 'VALIDAÇÃO') { if (!doc) deles.push(norm(e, null)); return; }
        if (e.dfEvento && !rfAlvo) return;   // espelho de ação do DF: entra uma vez, pelos eventos do próprio DF
        if (comPart && (e.tipo === 'APROPRIAÇÃO' || e.tipo === 'UTILIZAÇÃO')) return;   // falam do RF inteiro: o movimento substitui
        // marcas do RF inteiro (em risco, a prescrever, vencido) contradizem as da fatia: com a
        // partição, a situação sai das marcas da fatia, em "Situação agora" (D-PAR-05)
        if (comPart && (e.tipo === 'AGUARDANDO' || e.tipo === 'VENCIMENTO')) return;
        var n = norm(e, rf);
        // recolhimento parcial: a guia e o comprovante cobrem o que foi apropriado, não o RF inteiro
        if (comPart && (e.tipo === 'PAGAMENTO' || e.tipo === 'COMPROVANTE ERP') && apropriado > 0 && apropriado < r2(rf.valor) - 0.005) {
          n.desc = n.desc.replace(money(rf.valor), money(apropriado)) + ' · recolhimento parcial: ' + money(r2(rf.valor) - apropriado) + ' seguem sem recolhimento';
        }
        deles.push(n);
      });
      doc = true;
      if (comPart) {
        movsAsc(rf).forEach(function (m) {
          var me = movEv(m, rf);
          if (m.de === null) {   // abertura: o valor entra a apropriar junto com o registro fiscal
            var g = deles.filter(function (x) { return x.tipo === 'GERAÇÃO RF'; })[0];
            if (g) { g.valor = m.valor; g.de = null; g.para = 'pending'; g.mov = true; return; }
          }
          // ato do órgão já contado pelo módulo (glosa, ressarcimento): o movimento vira o valor do ato
          var ato = deles.filter(function (x) { return !x.mov && x.tipo === me.tipo && mesmoDia(x.ts, me.ts); })[0];
          if (ato) { ato.valor = me.valor; ato.de = me.de; ato.para = me.para; ato.mov = true; return; }
          deles.push(me);
        });
      }
      out = out.concat(deles);
    });
    if (!rfAlvo) (nf._eventos || []).forEach(function (e) { out.push(norm(e, null)); });
    return ordenar(juntarErp(out), false);
  };

  // O que ainda não aconteceu não é evento: é a situação de agora. Cada ponto de
  // atenção é uma linha só — o que é e o que fazer —; o estado normal entra como
  // informação, sem contar como alerta.
  function dias(iso) { var p = String(iso || '').slice(0, 10).split('-'); if (p.length !== 3) return null; var h = new Date(); h.setHours(0, 0, 0, 0); return Math.round((new Date(+p[0], +p[1] - 1, +p[2]) - h) / 86400000); }
  function curto(s, n) { s = String(s || '').replace(/<[^>]+>/g, ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  X.situacao = function (nf, rfs, evs) {
    var al = [], info = [];
    var ponto = function (nivel, t, titulo, det, ev) { al.push({ nivel: nivel, trib: t, titulo: titulo, det: det }); if (ev) ev.alerta = nivel; };
    rfs.forEach(function (rf) {
      var t = trib(rf), b = rf.balances;
      if (!b) return;
      var fl = (rf.flagsFatia || []).map(function (f) { return f.f; });
      if (b.pending > 0) {
        var ve = vencimento(nf.data || rf.data), d = dias(ve);
        if (fl.indexOf('vencido') >= 0) ponto('alerta', t, 'Apropriação vencida · ' + money(b.pending), 'Venceu em ' + br(ve) + '. Cobrar o fornecedor ou assumir o recolhimento.');
        else if (fl.indexOf('em_risco') >= 0) ponto('atencao', t, 'Apropriação vence em ' + d + ' dia' + (d === 1 ? '' : 's') + ' · ' + money(b.pending), 'Vence em ' + br(ve) + '. Cobrar o fornecedor ou assumir o recolhimento.');
        else info.push({ trib: t, txt: money(b.pending) + ' a apropriar · vence em ' + br(ve) });
      }
      if (b.available > 0) {
        if (fl.indexOf('a_prescrever') >= 0) { var dp = dias(rf.prazoArt54Prox); ponto('atencao', t, 'Prazo do art. 54 em ' + dp + ' dias · ' + money(b.available), 'Limite em ' + br(rf.prazoArt54Prox) + '. Priorizar na compensação.'); }
        else info.push({ trib: t, txt: money(b.available) + ' disponível' + (rf.prazoArt54Prox ? ' · art. 54 até ' + br(rf.prazoArt54Prox) : '') });
      }
      if (b.refund_requested > 0) info.push({ trib: t, txt: money(b.refund_requested) + ' em pedido de ressarcimento' });
      if (fl.indexOf('inconsistencia') >= 0) {
        var rot = (rf._inconsistencias || []).map(function (i) { return i.tipoLabel || i.tipo; }).filter(Boolean);
        ponto('alerta', t, 'Inconsistência aberta', (rot.length ? curto(rot.join(', '), 70) + '. ' : '') + 'Tratar na fila de Inconsistências.');
      }
      var g = window.shGlosa && window.shGlosa.ficha ? window.shGlosa.ficha(rf.id) : null;
      if (g && g.status !== 'revertida') {
        var tipoG = g.status === 'impugnada' ? 'IMPUGNAÇÃO' : g.status === 'definitiva' ? 'GLOSA DEFINITIVA' : 'GLOSA';
        var evG = (evs || []).filter(function (e) { return e.rfId === rf.id && e.tipo === tipoG; })[0];
        if (g.status === 'impugnada') ponto('atencao', t, 'Glosa em impugnação · ' + money(g.valor), 'Processo ' + g.processo + '; valor bloqueado até a decisão.', evG);
        else if (g.status === 'definitiva' || g.status === 'mantida') ponto('alerta', t, 'Glosa definitiva · ' + money(g.valor), 'Perda definitiva' + (g.definitivaEm ? ' desde ' + br(g.definitivaEm) : '') + '.', evG);
        else ponto('alerta', t, 'Glosa aberta · ' + money(g.valor), 'Impugnar até ' + br(g.prazoImpugnacao) + ' (ficha ' + g.id + ').', evG);
      }
    });
    // conciliação: vale o registro mais recente de cada etapa, por tributo
    var ultimo = {};
    (evs || []).forEach(function (e) {
      if ((e.tipo === 'CONC APURAÇÃO' || e.tipo === 'CONC FINANCEIRA') && e.ts) { var k = e.tipo + '|' + e.trib; if (!ultimo[k] || e.ts > ultimo[k].ts) ultimo[k] = e; }
    });
    Object.keys(ultimo).forEach(function (k) {
      var e = ultimo[k], fin = e.tipo === 'CONC FINANCEIRA', id = (/(C(?:APUR|FIN)-[0-9A-F]+)/.exec(e.desc) || [])[1] || '';
      if (e.cls === 'pending') ponto('atencao', e.trib, 'Conciliação ' + (fin ? 'financeira' : 'de apuração') + ' pendente',
        (fin ? 'Falta o comprovante do recolhimento' : 'Documento ainda não lido na apuração do órgão') + (id ? ' (' + id + ').' : '.'), e);
      else if (e.cls === 'erro') ponto('alerta', e.trib, 'Conciliação ' + (fin ? 'financeira' : 'de apuração') + ' com divergência',
        'Não bate com o órgão' + (id ? ' (' + id + ')' : '') + '. Analisar na Conciliação.', e);
    });
    (evs || []).forEach(function (e) {
      if (e.alerta || !e.ts) return;
      if (e.tipo === 'ERP' && e.entrega === 'pendente') ponto('atencao', e.trib, 'ERP sem confirmação', e.titulo.replace('Webhook ', '') + ': reenvio automático em andamento.', e);
      else if (e.tipo === 'ERP' && e.entrega === 'falhou') ponto('alerta', e.trib, 'ERP não recebeu o evento', e.titulo.replace('Webhook ', '') + ': reenviar em Integrações › Log de entregas.', e);
      else if (e.tipo === 'INCONSISTÊNCIA' || (e.cls === 'erro' && ['risco', 'conciliacao', 'erp'].indexOf(e.fase) < 0)) ponto('alerta', e.trib, e.titulo, curto(e.desc, 90), e);
    });
    (evs || []).forEach(function (e) { if (!e.ts && e.tipo === 'AGUARDANDO') info.push({ trib: e.trib, txt: curto(e.desc, 90) }); });
    al.sort(function (a, b) { return (a.nivel === 'alerta' ? 0 : 1) - (b.nivel === 'alerta' ? 0 : 1); });
    return { alertas: al, info: info };
  };

  /* ── peças da trilha ──────────────────────────────────────────────────── */
  function efeitoHtml(e) {
    if (!(e.valor > 0) || e.para === undefined) return '';
    return '<div class="pp-ev-ef">' + parcTag(e.de) + '<span class="pp-seta">→</span>' + parcTag(e.para) + '<b class="pp-num">' + money(e.valor) + '</b></div>';
  }
  function statusErp(e) {
    if (!e.entrega) return '';
    var c = { entregue: 'ok', pendente: 'pending', falhou: 'erro' }[e.entrega];
    return '<span class="pp-st pp-st-' + c + '">' + e.entrega + '</span>';
  }
  var NIVEL = { alerta: ['alerta', 'erro'], atencao: ['atenção', 'pending'] };
  function situacaoHtml(s) {
    if (!s.alertas.length && !s.info.length) return '';
    var n = s.alertas.length;
    return '<div class="pp-pend"><div class="pp-sub pp-sub0">Situação agora · ' + (n ? n + ' ponto' + (n > 1 ? 's' : '') + ' de atenção' : 'nenhum ponto de atenção') + '</div>'
      + s.alertas.map(function (a) {
        return '<div class="pp-pend-i">' + chipTrib(a.trib) + '<span class="pp-st pp-st-' + NIVEL[a.nivel][1] + '">' + NIVEL[a.nivel][0] + '</span>'
          + '<span><strong class="pp-forte-t">' + esc(a.titulo) + '</strong> <span class="pp-mut">— ' + esc(a.det) + '</span></span></div>';
      }).join('')
      + s.info.map(function (x) { return '<div class="pp-pend-i">' + chipTrib(x.trib) + '<span class="pp-mut">' + esc(x.txt) + '</span></div>'; }).join('')
      + '</div>';
  }
  function resumo(evs, s) {
    var mov = evs.filter(function (e) { return e.mov; }).length, erp = evs.filter(function (e) { return e.fase === 'erp'; }).length;
    var n = s.alertas.length;
    return '<div class="pp-resumo">' + evs.length + ' registros · ' + mov + ' movimentos de valor · ' + erp + ' integrações com o ERP'
      + (n ? ' · <span class="pp-alerta">' + n + ' ponto' + (n > 1 ? 's' : '') + ' de atenção</span>' : '') + '</div>';
  }

  /* ── histórico do ciclo: trilha de auditoria (proposta 3) ─────────────── */
  function trilha(c, key) {
    var evs = ordenar(c.evs.slice(), true);
    var tribOps = c.modo === 'df' ? [['todos', 'Todos']].concat(c.rfs.map(function (rf) { return [trib(rf), trib(rf).toUpperCase()]; })).concat([['doc', 'DF']]) : null;
    var usadas = {}; evs.forEach(function (e) { usadas[e.origem] = (usadas[e.origem] || 0) + 1; });
    var tool = '<div class="pp-tool">'
      + (tribOps ? '<span class="pp-seg">' + tribOps.map(function (o, i) { return '<button data-tv="' + o[0] + '" class="' + (i ? '' : 'on') + '" onclick="window.shDetalhe.filtrarTrilha(this)">' + o[1] + '</button>'; }).join('') + '</span>' : '')
      + '<span>' + ORIGENS.filter(function (o) { return usadas[o[0]]; }).map(function (o) { return '<button class="pp-chip on" data-ov="' + o[0] + '" onclick="window.shDetalhe.filtrarTrilha(this)">' + o[1] + ' · ' + usadas[o[0]] + '</button>'; }).join(' ') + '</span>'
      + '<span class="pp-seg"><button class="on" data-ord="desc" onclick="window.shDetalhe.ordemTrilha(this)">Recentes primeiro</button><button data-ord="asc" onclick="window.shDetalhe.ordemTrilha(this)">Antigos primeiro</button></span>'
      + '<button class="pp-btn" onclick="window.shDetalhe.csvEventos(\'' + key + '\')">Exportar CSV</button></div>';
    var rows = evs.map(function (e) {
      return '<tr data-trib="' + (e.trib || 'doc') + '" data-orig="' + e.origem + '" data-ts="' + esc(e.ts || '') + '" onclick="this.classList.toggle(\'aberto\')">'
        + '<td class="pp-num pp-mut">' + brTs(e.ts) + '</td><td>' + chipTrib(e.trib) + '</td><td class="pp-mut">' + ORIGEM_ROT[e.origem] + '</td>'
        + '<td><strong class="pp-forte-t">' + esc(e.titulo) + '</strong> ' + statusErp(e)
        + (e.alerta ? ' <span class="pp-st pp-st-' + NIVEL[e.alerta][1] + '">' + NIVEL[e.alerta][0] + '</span>' : '') + '<div class="pp-ev-desc">' + e.desc + (e.descEntrega ? ' · ' + e.descEntrega : '') + '</div></td>'
        + '<td>' + (e.valor > 0 && e.para !== undefined ? efeitoHtml(e) : '<span class="pp-mut">—</span>') + '</td><td class="pp-mut">' + esc(e.ator) + '</td></tr>';
    }).join('');
    return '<div data-pp-trilha>' + tool + '<div class="pp-scroll"><table class="pp-tab pp-trilha-t"><thead><tr><th>Data e hora</th><th>Tributo</th><th>Origem</th><th>Evento</th><th>Valor e efeito</th><th>Quem registrou</th></tr></thead><tbody>'
      + rows + '</tbody></table></div><div class="pp-nota" data-cont>' + evs.length + ' de ' + evs.length + ' registros · clique numa linha para ler a descrição inteira</div></div>';
  }
  X.filtrarTrilha = function (el) {
    var box = el.closest('[data-pp-trilha]'); if (!box) return;
    if (el.hasAttribute('data-tv')) cada(box.querySelectorAll('[data-tv]'), function (b) { b.classList.toggle('on', b === el); });
    else el.classList.toggle('on');
    var tv = box.querySelector('[data-tv].on'), t = tv ? tv.getAttribute('data-tv') : 'todos';
    var origs = []; cada(box.querySelectorAll('[data-ov].on'), function (b) { origs.push(b.getAttribute('data-ov')); });
    var rows = box.querySelectorAll('tbody tr'), n = 0;
    cada(rows, function (tr) {
      var ok = (t === 'todos' || tr.getAttribute('data-trib') === t) && origs.indexOf(tr.getAttribute('data-orig')) >= 0;
      tr.style.display = ok ? '' : 'none'; if (ok) n++;
    });
    box.querySelector('[data-cont]').textContent = n + ' de ' + rows.length + ' registros · clique numa linha para ler a descrição inteira';
  };
  X.ordemTrilha = function (el) {
    var box = el.closest('[data-pp-trilha]'); if (!box) return;
    cada(box.querySelectorAll('[data-ord]'), function (b) { b.classList.toggle('on', b === el); });
    var desc = el.getAttribute('data-ord') === 'desc', tb = box.querySelector('tbody');
    var rows = Array.prototype.slice.call(tb.rows).sort(function (a, b) {
      var x = a.getAttribute('data-ts'), y = b.getAttribute('data-ts');
      if (!x && !y) return 0; if (!x) return 1; if (!y) return -1;
      return desc ? (x < y ? 1 : x > y ? -1 : 0) : (x < y ? -1 : x > y ? 1 : 0);
    });
    rows.forEach(function (r) { tb.appendChild(r); });
  };
  function baixarCsv(nome, linhas) {
    var txt = linhas.map(function (l) { return l.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(';'); }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' }));
    a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
  }
  function semTags(s) { var d = document.createElement('div'); d.innerHTML = String(s || ''); return d.textContent; }
  X.csvEventos = function (key) {
    var c = X._cache[key]; if (!c) return;
    var linhas = [['data_hora', 'tributo', 'origem', 'fase', 'evento', 'valor', 'de', 'para', 'entrega_erp', 'descricao', 'quem_registrou']];
    c.evs.forEach(function (e) {
      linhas.push([e.ts || '', (e.trib || 'df').toUpperCase(), ORIGEM_ROT[e.origem], e.fase, e.titulo, e.valor > 0 ? e.valor.toFixed(2) : '',
        e.de ? P.rot(e.de) : '', e.para ? P.rot(e.para) : '', e.entrega || '', semTags(e.desc + (e.descEntrega ? ' · ' + e.descEntrega : '')), e.ator]);
    });
    baixarCsv('historico-' + key + '.csv', linhas);
  };
  X.historico = function (key) {
    var c = X._cache[key]; if (!c) return '';
    if (!c.evs.length) return '<div class="pp-mut">Nenhum evento disponível.</div>';
    c.evs.forEach(function (e) { delete e.alerta; });
    var s = X.situacao(c.nf, c.rfs, c.evs);
    return resumo(c.evs, s) + situacaoHtml(s) + trilha(c, key);
  };

  /* ═══ aba Apuração assistida: trilha de auditoria por imposto ═════════ */
  // Todos os registros da apuração do tributo: cada movimento de valor que o
  // órgão reconheceu, com o saldo depois dele, e as conciliações do tributo.
  function registrosApuracao(rf, nf) {
    var saldo = {}, out = [];
    movsAsc(rf).forEach(function (m) {
      if (m.de) saldo[m.de] = r2((saldo[m.de] || 0) - m.valor);
      saldo[m.para] = r2((saldo[m.para] || 0) + m.valor);
      var depois = P.PARC.filter(function (p) { return saldo[p.k] > 0.005; }).map(function (p) { return { k: p.k, v: saldo[p.k] }; });
      out.push({ ts: m.reconhecidoEm + 'T' + (HORA[m.para] || '09:00'), per: mesAno(m.reconhecidoEm), titulo: movEv(m, rf).titulo,
        m: m, depois: depois, fonte: m.fonte, vinculo: m.vinculo, prazo: m.prazoArt54 });
    });
    [['Conciliação de apuração', rf._concRegApur || nf._concRegApur], ['Conciliação financeira', rf._concRegFin || nf._concRegFin]].forEach(function (x) {
      var c = x[1]; if (!c || !c.concTs) return;
      out.push({ ts: String(c.concTs), per: mesAno(c.concTs), titulo: x[0], conc: c, fonte: 'SplitHub · Conciliação', vinculo: c.concId });
    });
    return out.sort(function (a, b) { return a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0; });
  }
  X.apuracaoHtml = function (rf, nf) {
    var t = trib(rf), T = t.toUpperCase(), b = rf.balances;
    if (!b) return '<div class="pp-mut">Este registro não tem partição.</div>';
    var regs = registrosApuracao(rf, nf);
    var stCls = { confirmada: 'ok', inconsistencia: 'erro', pendente: 'pending' };
    var rows = regs.map(function (r) {
      var mov = r.m
        ? '<div class="pp-ev-ef">' + parcTag(r.m.de) + '<span class="pp-seta">→</span>' + parcTag(r.m.para) + '</div>'
        : '<span class="pp-st pp-st-' + (stCls[r.conc.concStatus] || 'pending') + '">' + esc(r.conc.concStatus || '—') + '</span>';
      var depois = r.depois ? r.depois.map(function (d) { return '<div class="pp-parc">' + dot(parc(d.k).cor) + esc(parc(d.k).rot) + ' <span class="pp-num">' + money(d.v) + '</span></div>'; }).join('') : '<span class="pp-mut">—</span>';
      return '<tr><td class="pp-num pp-mut">' + brTs(r.ts) + '<div>apuração ' + r.per + '</div></td>'
        + '<td><strong class="pp-forte-t">' + esc(r.titulo) + '</strong>' + (r.m ? '<div class="pp-ev-desc">' + esc(r.m.causa) + '</div>' : '') + '</td>'
        + '<td>' + mov + '</td><td class="r pp-num">' + (r.m ? money(r.m.valor) : '<span class="pp-mut">—</span>') + '</td>'
        + '<td>' + depois + '</td>'
        + '<td class="pp-mut">' + esc(r.fonte) + (r.vinculo ? '<div>' + esc(r.vinculo) + '</div>' : '') + (r.prazo ? '<div>limite art. 54: ' + br(r.prazo) + '</div>' : '') + '</td></tr>';
    }).join('');
    var fecha = Math.abs(P.apurado(b) - r2(rf.valor)) < 0.01;
    return '<div class="pp-tool">' + chipTrib(t) + '<strong class="pp-forte-t">Apuração assistida · ' + T + ' · ' + ORG[t] + '</strong>'
      + '<span class="pp-mono">' + esc(rf.id) + '</span>' + P.selo(rf, false) + '<span>' + LEITURA[t] + '</span>'
      + '<span class="pp-sp"></span><button class="pp-btn" onclick="window.shParcial.csv(window._rfIndex[\'' + esc(rf.id) + '\'].rf)">Exportar CSV</button></div>'
      + '<div class="pp-scroll"><table class="pp-tab pp-ap-t"><thead><tr><th>Data e apuração</th><th>Registro</th><th>Movimento</th><th class="r">Valor</th><th>Saldo depois</th><th>Fonte e vínculo</th></tr></thead><tbody>'
      + rows + '</tbody></table></div>'
      + '<div class="pp-conf ' + (fecha ? 'ok' : 'err') + '">' + (fecha ? '✓ O saldo depois do último movimento é a partição informada hoje e soma o apurado de ' + money(rf.valor) + '.' : '✕ A partição não fecha com o apurado.') + '</div>';
  };

  /* ═══ montagem dos modais ═════════════════════════════════════════════ */
  // corpo do detalhe do DF de entrada com partição
  X.corpoDF = function (nf, ctx) {
    var q = X.valores(nf), key = chave('df-' + nf.numero);
    var evs = X.eventos(nf, null);
    X._cache[key] = { evs: evs, nf: nf, rfs: q.rfs, modo: 'df' };
    var esq = '<div class="mbox-section-label">Documento Fiscal</div>' + ctx.docHtml
      + '<div class="mbox-divider"></div>' + ctx.chaveHtml + ctx.ctrHtml + ctx.radHtml
      + '<div class="mbox-divider"></div><div class="mbox-section-label">Inconsistências Vinculadas</div>' + ctx.incHtml;
    var tabs = [['hist', 'Histórico do ciclo · ' + evs.length]].concat(q.rfs.map(function (rf) { return ['ap-' + trib(rf), 'Apuração assistida · ' + trib(rf).toUpperCase()]; }));
    var dir = quadro(nf, q)
      + '<div data-pp-box>' + abasBar(tabs)
      + '<div data-aba="hist"><div id="pph-' + key + '">' + X.historico(key) + '</div></div>'
      + q.rfs.map(function (rf) { return '<div data-aba="ap-' + trib(rf) + '" style="display:none">' + X.apuracaoHtml(rf, nf) + '</div>'; }).join('')
      + '</div>';
    return '<div class="pp-body"><div class="mbox-col pp-col-l">' + esq + '</div><div class="mbox-col pp-col-r">' + dir + '</div></div>';
  };
  // histórico do DF sem partição (saída): só a trilha
  X.historicoDF = function (nf) {
    var key = chave('df-' + nf.numero);
    X._cache[key] = { evs: X.eventos(nf, null), nf: nf, rfs: nf.registrosFiscais || [], modo: 'df' };
    return '<div class="mbox-section-label">Histórico do Ciclo</div><div id="pph-' + key + '">' + X.historico(key) + '</div>';
  };
  // coluna direita do detalhe do RF: o mesmo quadro do DF, com a coluna do
  // tributo, e as abas de movimentos, histórico e apuração assistida
  X.colunaRF = function (rf, nf) {
    return (rf.balances ? quadro(nf, X.valores(nf), rf) : '') + abasRF(rf, nf);
  };
  function abasRF(rf, nf) {
    var key = chave('rf-' + rf.id), evs = X.eventos(nf, rf), part = !!rf.balances;
    X._cache[key] = { evs: evs, nf: nf, rfs: [rf], rf: rf, modo: 'rf' };
    var tabs = [];
    if (part) tabs.push(['mov', 'Movimentos de valor']);
    tabs.push(['hist', 'Histórico do ciclo · ' + evs.length]);
    if (part) tabs.push(['ap', 'Apuração assistida · ' + trib(rf).toUpperCase()]);
    return '<div data-pp-box>' + abasBar(tabs)
      + (part ? '<div data-aba="mov">' + P.tabelaMovimentos(rf) + '<div class="pp-nota">Cada linha move uma quantia de uma parcela para outra. Os movimentos de cada parcela somam o saldo dela; a data é a do reconhecimento pelo órgão.</div></div>' : '')
      + '<div data-aba="hist"' + (part ? ' style="display:none"' : '') + '><div id="pph-' + key + '">' + X.historico(key) + '</div></div>'
      + (part ? '<div data-aba="ap" style="display:none">' + X.apuracaoHtml(rf, nf) + '</div>' : '')
      + '</div>';
  }
})();

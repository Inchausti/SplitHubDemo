/* ═══════════════════════════════════════════════════════════════════════════
   Parcialidade — propostas em avaliação para o detalhe do DF e do RF
   Branch parcialidade-prototipo · ambiente de avaliação · pedidos de 23/10/2026

   1. Detalhe do DF. A partição do crédito e os registros fiscais viram um bloco
      só, porque falam do mesmo RF; e os Valores do documento ganham as parcelas
      da partição. Três propostas: A cartões por tributo, B quadro CBS × IBS,
      C livro razão.
   2. Histórico do ciclo, no DF e no RF. Três propostas de organização: 1 por
      fase, 2 raias, 3 trilha de auditoria. As três leem o mesmo modelo de
      eventos, normalizado aqui:
        - com a partição, os movimentos de valor substituem os eventos de
          apropriação e utilização que falavam do RF inteiro;
        - envio e entrega do mesmo webhook ao ERP viram uma linha só;
        - o órgão aparece pelo nome, nunca como "Fisco";
        - o que ainda não aconteceu sai da linha do tempo e vai para
          "Situação agora".
   3. Aba Apuração assistida, uma por imposto: cada movimento explicado pela
      apuração que o reconheceu, com o racional e o saldo depois dele.

   A escolha de proposta fica no navegador de quem avalia (localStorage).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var P = window.shParcial;
  if (!P) return;
  var X = window.shProp = window.shProp || {};
  X._cache = {};

  /* ── utilitários ──────────────────────────────────────────────────────── */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function r2(v) { return Math.round((+v || 0) * 100) / 100; }
  function money(v) { return typeof window.ff === 'function' ? window.ff(r2(v)) : 'R$ ' + r2(v).toFixed(2).replace('.', ','); }
  function br(s) { var p = String(s || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; }
  function brTs(ts) { if (!ts) return '—'; var h = String(ts).slice(11, 16); return br(ts) + (h ? ' ' + h : ''); }
  function mesAno(s) { var p = String(s || '').slice(0, 7).split('-'); return p.length === 2 ? p[1] + '/' + p[0] : '—'; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ls(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* aba anônima */ } }
  function chave(s) { return String(s).replace(/[^\w-]/g, '-'); }
  function cada(lista, fn) { Array.prototype.forEach.call(lista || [], fn); }

  var ORG = { cbs: 'Receita Federal', ibs: 'Comitê Gestor' };
  var ORG_A = { cbs: 'a Receita Federal', ibs: 'o Comitê Gestor' };
  var LEITURA = {
    cbs: 'consulta à API da apuração assistida da Receita Federal, todo dia às 06:00',
    ibs: 'arquivo diário da apuração assistida que o Comitê Gestor envia por webhook'
  };
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

  /* ── valores do documento: parcela × tributo ──────────────────────────── */
  X.valores = function (nf) {
    var rfs = rfsDe(nf), by = {};
    rfs.forEach(function (rf) { by[trib(rf)] = rf; });
    var linhas = P.PARC.map(function (p) {
      var c = by.cbs ? by.cbs.balances[p.k] : undefined, i = by.ibs ? by.ibs.balances[p.k] : undefined;
      return { p: p, cbs: c, ibs: i, total: r2((c || 0) + (i || 0)), so: c === null ? 'ibs' : i === null ? 'cbs' : '' };
    });
    var ap = { cbs: by.cbs ? r2(by.cbs.valor) : 0, ibs: by.ibs ? r2(by.ibs.valor) : 0 };
    ap.total = r2(ap.cbs + ap.ibs);
    return { by: by, rfs: rfs, linhas: linhas, ap: ap, soma: r2(linhas.reduce(function (s, l) { return s + l.total; }, 0)) };
  };

  function kv(rot, val, cls) {
    return '<div class="pp-kv' + (cls ? ' ' + cls : '') + '"><span>' + rot + '</span><span class="pp-num">' + val + '</span></div>';
  }
  function notaSo(so) {
    return so === 'cbs' ? '<sup title="O Comitê Gestor não informa esta parcela no IBS">¹</sup>'
      : so === 'ibs' ? '<sup title="Parcela que só existe no IBS">²</sup>' : '';
  }
  function valoresHtml(nf, q, titulo) {
    var h = '<div class="mbox-section-label">' + titulo + '</div>'
      + kv('Total do documento', money(nf.valorTotal || 0))
      + kv('Líquido', money(nf.valorLiquido || 0))
      + kv('Tributos apurados', money(q.ap.total), 'pp-kv-forte')
      + kv('<span class="pp-ind">CBS · Receita Federal</span>', money(q.ap.cbs))
      + kv('<span class="pp-ind">IBS · Comitê Gestor</span>', money(q.ap.ibs))
      + '<div class="pp-sub">Crédito por parcela · CBS + IBS</div>';
    q.linhas.forEach(function (l) {
      h += kv('<span class="pp-parc">' + dot(l.p.cor) + esc(l.p.rot) + notaSo(l.so) + '</span>',
        l.total > 0 ? money(l.total) : '<span class="pp-mut">—</span>', l.total > 0 ? '' : 'pp-kv-zero');
    });
    var fecha = Math.abs(q.soma - q.ap.total) < 0.01;
    return h + '<div class="pp-conf ' + (fecha ? 'ok' : 'err') + '">'
      + (fecha ? '✓ Soma das parcelas = tributos apurados' : '✕ Soma das parcelas (' + money(q.soma) + ') diferente do apurado — inconsistência') + '</div>'
      + '<div class="pp-nota">¹ Só CBS: o Comitê Gestor não informa a parcela no IBS, que fica fora da soma (D-PAR-09). ² Só IBS.</div>';
  }

  /* ── datas do RF lidas da partição (D-PAR-03) ─────────────────────────── */
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
  function btnRF(rf) { return '<button class="pp-btn" onclick="window.shProp.irRF(\'' + esc(rf.id) + '\')">Ver RF →</button>'; }
  function btnMov(rf) { return '<button class="pp-btn" onclick="window.shProp.irRF(\'' + esc(rf.id) + '\')">Movimentos de valor →</button>'; }
  X.irRF = function (id) {
    var o = document.getElementById('nf-detalhe-overlay'); if (o) o.remove();
    if (window.abrirDetalheRF) window.abrirDetalheRF(id);
  };

  /* ── A · cartões por tributo ──────────────────────────────────────────── */
  function cartaoRF(rf, nf) {
    var t = trib(rf), b = rf.balances, ap = P.apurado(b), d = datasRF(rf);
    var lin = function (p) { return kv('<span class="pp-parc">' + dot(p.cor) + esc(p.rot) + '</span>', cel(b[p.k]), b[p.k] > 0 ? '' : 'pp-kv-zero'); };
    var todas = P.PARC.filter(function (p) { return !(p.k === 'refund_available' && t === 'cbs'); });
    var nz = todas.filter(function (p) { return b[p.k] > 0; });
    var fecha = Math.abs(ap - r2(rf.valor)) < 0.01;
    var dt = function (rot, v) { return '<div class="pp-data">' + rot + '<div>' + v + '</div></div>'; };
    return '<div class="pp-card">'
      + '<div class="pp-card-hdr">' + chipTrib(t) + '<strong>' + ORG[t] + '</strong>' + P.selo(rf, false) + '<span class="pp-sp"></span>' + btnRF(rf) + '</div>'
      + '<div class="pp-card-sub"><span class="pp-mono">' + esc(rf.id) + '</span> · apurado <b class="pp-num">' + money(rf.valor) + '</b> · pagamento ' + esc(metodo(rf, nf)) + '</div>'
      + P.barra(rf, 10)
      + '<div style="margin-top:6px">' + nz.map(lin).join('') + '</div>'
      + '<details class="pp-mais"><summary>Ver as ' + todas.length + ' parcelas</summary>' + todas.map(lin).join('') + '</details>'
      + '<div class="shg3 pp-datas">' + dt('Apropriação', d.aprop) + dt('Último uso', d.uso) + dt('Limite art. 54', d.prazo) + '</div>'
      + (rf.flagsFatia && rf.flagsFatia.length ? '<div style="margin-top:6px">' + P.flagsHtml(rf) + '</div>' : '')
      + '<div class="pp-conf ' + (fecha ? 'ok' : 'err') + '">' + (fecha ? '✓ Parcelas somam o apurado' : '✕ Parcelas somam ' + money(ap) + ', apurado ' + money(rf.valor)) + '</div>'
      + '<div class="pp-acoes">' + btnMov(rf) + '</div>'
      + '</div>';
  }
  function blocoA(nf, q) {
    return '<div class="mbox-section-label">Registros fiscais e partição do crédito</div>'
      + '<div class="shg shg-md pp-bloco">' + q.rfs.map(function (rf) { return cartaoRF(rf, nf); }).join('') + '</div>';
  }

  /* ── B · quadro CBS × IBS ─────────────────────────────────────────────── */
  function blocoB(nf, q) {
    var cols = q.rfs, n = cols.length + 2;
    var grp = function (t) { return '<tr class="pp-grp"><td colspan="' + n + '">' + t + '</td></tr>'; };
    // livre: célula que quebra linha (datas, selos, marcas); as de valor não quebram
    var lin = function (rot, vals, tot, cls, livre) {
      var td = '<td class="r' + (livre ? '' : ' pp-num') + '">';
      return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + rot + '</td>' + vals.map(function (v) { return td + v + '</td>'; }).join('')
        + td + tot + '</td></tr>';
    };
    var mut = '<span class="pp-mut">—</span>';
    var h = '<table class="pp-tab pp-quadro"><thead><tr><th></th>'
      + cols.map(function (rf) {
        var t = trib(rf);
        return '<th class="r"><div class="pp-th-t">' + chipTrib(t) + ORG[t] + '</div>'
          + '<div class="pp-mono">' + esc(rf.id) + '</div>' + P.barra(rf, 6) + '</th>';
      }).join('') + '<th class="r">Documento</th></tr></thead><tbody>';
    h += grp('Valores do documento')
      + lin('Total do documento', cols.map(function () { return mut; }), money(nf.valorTotal || 0))
      + lin('Líquido', cols.map(function () { return mut; }), money(nf.valorLiquido || 0))
      + lin('Tributo apurado', cols.map(function (rf) { return money(rf.valor); }), money(q.ap.total), 'pp-forte');
    h += grp('Partição do crédito');
    q.linhas.forEach(function (l) {
      h += lin('<span class="pp-parc">' + dot(l.p.cor) + esc(l.p.rot) + notaSo(l.so) + '</span>',
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
    h += '</tbody><tfoot><tr><td></td>' + cols.map(function (rf) { return '<td class="r">' + btnRF(rf) + '</td>'; }).join('') + '<td></td></tr></tfoot></table>';
    return '<div class="mbox-section-label">Valores e registros fiscais · CBS × IBS</div>'
      + '<div class="pp-scroll pp-bloco">' + h + '</div>'
      + '<div class="pp-nota" style="margin:-10px 0 16px">n/i: não informado pelo Comitê Gestor. ¹ Só CBS, fora da soma (D-PAR-09). ² Só IBS.</div>';
  }

  /* ── C · livro razão ──────────────────────────────────────────────────── */
  // Convenção: cada parcela é uma conta; entrada na parcela a débito, saída a
  // crédito. A abertura tem por contrapartida o apurado do documento.
  function contas(rf) {
    var map = {};
    movsAsc(rf).forEach(function (m) {
      if (m.para) (map[m.para] = map[m.para] || []).push({ m: m, d: m.valor, c: 0, contra: m.de });
      if (m.de) (map[m.de] = map[m.de] || []).push({ m: m, d: 0, c: m.valor, contra: m.para });
    });
    return P.PARC.filter(function (p) { return map[p.k]; }).map(function (p) { return { p: p, lanc: map[p.k] }; });
  }
  function historico(m) {
    return '<span style="color:var(--txt1)">' + esc(m.causa) + '</span>'
      + (m.vinculo ? '<div class="pp-mut">' + esc(m.vinculo) + '</div>' : '')
      + '<div class="pp-mut">' + esc(m.fonte) + '</div>';
  }
  function razaoRF(rf) {
    var t = trib(rf), b = rf.balances, soma = 0;
    var h = '<div data-trib="' + t + '"><div class="pp-sub">' + chipTrib(t) + ' ' + ORG[t] + ' · <span class="pp-mono">' + esc(rf.id) + '</span></div>';
    contas(rf).forEach(function (c) {
      var s = 0;
      var linhas = c.lanc.map(function (l) {
        s = r2(s + l.d - l.c);
        return '<tr><td class="pp-num pp-mut">' + br(l.m.reconhecidoEm) + '</td><td>' + historico(l.m) + '</td><td>' + parcTag(l.contra) + '</td>'
          + '<td class="r pp-num">' + (l.d ? money(l.d) : '') + '</td><td class="r pp-num">' + (l.c ? money(l.c) : '') + '</td><td class="r pp-num">' + money(s) + '</td></tr>';
      }).join('');
      var ok = Math.abs(s - (b[c.p.k] || 0)) < 0.01;
      soma = r2(soma + s);
      h += '<div class="pp-conta"><div class="pp-conta-h">' + dot(c.p.cor) + esc(c.p.rot) + ' <span class="pp-mut">· ' + t.toUpperCase() + '</span><span class="pp-sp"></span>'
        + '<span class="pp-num">saldo ' + money(s) + '</span><span class="pp-conf ' + (ok ? 'ok' : 'err') + '" style="margin:0" title="Saldo da conta × parcela informada">' + (ok ? '✓' : '✕') + '</span></div>'
        + '<div class="pp-scroll"><table class="pp-tab pp-razao"><thead><tr><th>Data</th><th>Histórico</th><th>Contrapartida</th><th class="r">Débito</th><th class="r">Crédito</th><th class="r">Saldo</th></tr></thead><tbody>'
        + linhas + '</tbody></table></div></div>';
    });
    var fecha = Math.abs(soma - r2(rf.valor)) < 0.01;
    return h + '<div class="pp-prova"><span>Prova: soma dos saldos ' + t.toUpperCase() + '</span><span class="pp-conf ' + (fecha ? 'ok' : 'err') + '" style="margin:0">'
      + money(soma) + (fecha ? ' = apurado ✓' : ' ≠ apurado ' + money(rf.valor)) + '</span></div></div>';
  }
  function diario(rfs) {
    var ls2 = [];
    rfs.forEach(function (rf) { movsAsc(rf).forEach(function (m) { ls2.push({ rf: rf, m: m }); }); });
    ls2.sort(function (a, b) { return a.m.reconhecidoEm < b.m.reconhecidoEm ? -1 : a.m.reconhecidoEm > b.m.reconhecidoEm ? 1 : 0; });
    return '<div class="pp-scroll"><table class="pp-tab pp-razao"><thead><tr><th>Data</th><th>Tributo</th><th>Histórico</th><th>Débito</th><th>Crédito</th><th class="r">Valor</th></tr></thead><tbody>'
      + ls2.map(function (x) {
        return '<tr data-trib="' + trib(x.rf) + '"><td class="pp-num pp-mut">' + br(x.m.reconhecidoEm) + '</td><td>' + chipTrib(trib(x.rf)) + '</td><td>' + historico(x.m) + '</td>'
          + '<td>' + parcTag(x.m.para) + '</td><td>' + parcTag(x.m.de) + '</td><td class="r pp-num">' + money(x.m.valor) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function seg(g, ops, on) {
    return '<span class="pp-seg">' + ops.map(function (o) {
      return '<button data-g="' + g + '" data-v="' + o[0] + '" class="' + (o[0] === on ? 'on' : '') + '" onclick="window.shProp.alternar(this)">' + o[1] + '</button>';
    }).join('') + '</span>';
  }
  function blocoC(nf, q) {
    var rfsLinha = '<div class="pp-rfs">' + q.rfs.map(function (rf) {
      var t = trib(rf);
      return '<div class="pp-rf-linha">' + chipTrib(t) + '<strong>' + ORG[t] + '</strong><span class="pp-mono">' + esc(rf.id) + '</span>' + P.selo(rf, false)
        + '<span class="pp-mut">apurado</span><span class="pp-num">' + money(rf.valor) + '</span><span class="pp-sp"></span>' + btnRF(rf) + '</div>';
    }).join('') + '</div>';
    var tribs = [['todos', 'Ambos']].concat(q.rfs.map(function (rf) { return [trib(rf), trib(rf).toUpperCase()]; }));
    return '<div class="mbox-section-label">Registros fiscais</div>' + rfsLinha
      + '<div data-pp-box class="pp-bloco"><div class="mbox-section-label">Livro razão do crédito</div>'
      + '<div class="pp-tool">' + seg('modo', [['razao', 'Razão por conta'], ['diario', 'Diário']], 'razao') + seg('trib', tribs, 'todos') + '</div>'
      + '<div data-modo="razao">' + q.rfs.map(razaoRF).join('') + '</div>'
      + '<div data-modo="diario" style="display:none">' + diario(q.rfs) + '</div>'
      + '<div class="pp-nota">Cada parcela é uma conta. A entrada na parcela vai a débito e a saída a crédito; a abertura tem por contrapartida o apurado do documento. O saldo de cada conta é a parcela que o órgão informa, e a soma das contas de um tributo é o apurado.</div>'
      + '</div>';
  }

  /* ── alternância genérica (abas, modo, tributo) ───────────────────────── */
  X.alternar = function (btn) {
    var g = btn.getAttribute('data-g'), v = btn.getAttribute('data-v');
    var box = btn.closest('[data-pp-box]'); if (!box) return;
    cada(box.querySelectorAll('[data-g="' + g + '"]'), function (b) { b.classList.toggle('on', b === btn); });
    cada(box.querySelectorAll('[data-' + g + ']'), function (el) {
      if (el.closest('[data-pp-box]') !== box) return;
      el.style.display = v === 'todos' || el.getAttribute('data-' + g) === v ? '' : 'none';
    });
  };

  /* ═══ modelo de eventos ═══════════════════════════════════════════════ */
  var FASES = [
    ['documento', 'Documento e registro'],
    ['recolhimento', 'Recolhimento e apropriação'],
    ['uso', 'Uso do crédito'],
    ['conciliacao', 'Conciliação com a apuração assistida'],
    ['risco', 'Riscos, glosa e prazos'],
    ['erp', 'Integração com o ERP'],
    ['outros', 'Outros registros']
  ];
  var FASE_DE = {
    'INGESTÃO': 'documento', 'VALIDAÇÃO': 'documento', 'GERAÇÃO RF': 'documento',
    'PAGAMENTO': 'recolhimento', 'AVISO AO FORNECEDOR': 'recolhimento', 'RAD ASSUMIDO': 'recolhimento', 'RAD REVERTIDO': 'recolhimento', 'APROPRIAÇÃO': 'recolhimento',
    'UTILIZAÇÃO': 'uso', 'RESSARCIMENTO': 'uso', 'EXTINÇÃO': 'uso',
    'CONC APURAÇÃO': 'conciliacao', 'CONC FINANCEIRA': 'conciliacao', 'CONCILIAÇÃO': 'conciliacao',
    'INCONSISTÊNCIA': 'risco', 'VENCIMENTO': 'risco', 'AGUARDANDO': 'risco', 'GLOSA': 'risco', 'IMPUGNAÇÃO': 'risco', 'GLOSA DEFINITIVA': 'risco',
    'PRESCRIÇÃO': 'risco', 'SUSPENSÃO': 'risco', 'RESTABELECIMENTO': 'risco',
    'ENVIO ERP': 'erp', 'ENTREGA ERP': 'erp', 'COMPROVANTE ERP': 'erp', 'ERP': 'erp'
  };
  var TITULO = {
    'INGESTÃO': 'Documento recebido', 'VALIDAÇÃO': 'Documento validado', 'GERAÇÃO RF': 'Registro fiscal gerado',
    'PAGAMENTO': 'Guia paga', 'AVISO AO FORNECEDOR': 'Fornecedor avisado', 'RAD ASSUMIDO': 'Recolhimento assumido via RAD', 'RAD REVERTIDO': 'RAD revertido',
    'APROPRIAÇÃO': 'Apropriação', 'UTILIZAÇÃO': 'Utilização', 'RESSARCIMENTO': 'Ressarcimento', 'EXTINÇÃO': 'Extinção',
    'CONC APURAÇÃO': 'Conciliação com a apuração assistida', 'CONC FINANCEIRA': 'Conciliação financeira', 'CONCILIAÇÃO': 'Conciliação',
    'INCONSISTÊNCIA': 'Inconsistência', 'VENCIMENTO': 'Prazo de apropriação vencido', 'AGUARDANDO': 'Aguardando',
    'GLOSA': 'Glosa', 'IMPUGNAÇÃO': 'Impugnação', 'GLOSA DEFINITIVA': 'Glosa definitiva', 'COMPROVANTE ERP': 'Comprovante recebido do ERP'
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
    if (m.de === null && m.para === 'pending') { tipo = 'GERAÇÃO RF'; titulo = 'Valor registrado'; fase = 'documento'; }
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
      var apropriado = comPart ? movsAsc(rf).filter(function (m) { return m.para === 'available'; }).reduce(function (s, m) { return s + m.valor; }, 0) : 0;
      var deles = [];
      brutos.forEach(function (e) {
        if (e.tipo === 'INGESTÃO' || e.tipo === 'VALIDAÇÃO') { if (!doc) deles.push(norm(e, null)); return; }
        if (e.dfEvento && !rfAlvo) return;   // espelho de ação do DF: entra uma vez, pelos eventos do próprio DF
        if (comPart && (e.tipo === 'APROPRIAÇÃO' || e.tipo === 'UTILIZAÇÃO')) return;   // falam do RF inteiro: o movimento substitui
        if (comPart && e.tipo === 'AGUARDANDO' && (!e.ts || e.ts === '—')) return;       // vai para "Situação agora"
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
            me.titulo = 'Valor registrado'; me.fase = 'documento';
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

  // o que ainda não aconteceu não é evento: é a situação de agora
  X.pendencias = function (nf, rfs, evs) {
    var out = [];
    rfs.forEach(function (rf) {
      var t = trib(rf), b = rf.balances;
      if (!b) return;
      var fl = (rf.flagsFatia || []).map(function (f) { return f.f; });
      if (b.pending > 0) {
        var ve = vencimento(nf.data || rf.data);
        out.push({ trib: t, cls: fl.indexOf('vencido') >= 0 ? 'erro' : 'pending',
          txt: '<b class="pp-num">' + money(b.pending) + '</b> a apropriar · aguarda ' + ORG_A[t] + ' reconhecer a extinção do débito do fornecedor'
            + (ve ? ' · vencimento da apropriação ' + br(ve) + (fl.indexOf('vencido') >= 0 ? ' (vencido)' : '') : '') });
      }
      if (b.available > 0) out.push({ trib: t, cls: fl.indexOf('a_prescrever') >= 0 ? 'pending' : 'ok',
        txt: '<b class="pp-num">' + money(b.available) + '</b> disponível para compensação' + (rf.prazoArt54Prox ? ' · limite do art. 54 mais próximo ' + br(rf.prazoArt54Prox) : '') });
      if (b.refund_requested > 0) out.push({ trib: t, cls: 'pending', txt: '<b class="pp-num">' + money(b.refund_requested) + '</b> em pedido de ressarcimento · aguarda a decisão' });
      if (fl.indexOf('inconsistencia') >= 0) out.push({ trib: t, cls: 'erro', txt: 'Inconsistência aberta neste tributo · ver Inconsistências vinculadas' });
    });
    (evs || []).forEach(function (e) {
      if (e.tipo === 'ERP' && e.entrega !== 'entregue') out.push({ trib: e.trib, cls: e.entrega === 'falhou' ? 'erro' : 'pending', txt: esc(e.titulo) + ' ' + (e.entrega === 'falhou' ? 'não chegou ao ERP · reenvio manual em Integrações' : 'sem confirmação do ERP · reenvio automático') });
      if (!e.ts && e.tipo === 'AGUARDANDO') out.push({ trib: e.trib, cls: 'pending', txt: e.desc });
    });
    return out;
  };

  /* ── peças de evento ──────────────────────────────────────────────────── */
  function efeitoHtml(e) {
    if (!(e.valor > 0) || e.para === undefined) return '';
    return '<div class="pp-ev-ef">' + parcTag(e.de) + '<span class="pp-seta">→</span>' + parcTag(e.para) + '<b class="pp-num">' + money(e.valor) + '</b></div>';
  }
  function statusErp(e) {
    if (!e.entrega) return '';
    var c = { entregue: 'ok', pendente: 'pending', falhou: 'erro' }[e.entrega];
    return '<span class="pp-st pp-st-' + c + '">' + e.entrega + '</span>';
  }
  function itemHtml(e, o) {
    o = o || {};
    var quando = o.hora ? (e.ts ? String(e.ts).slice(11, 16) : '') : brTs(e.ts);
    return '<div class="pp-ev pp-ev-' + e.cls + '">'
      + '<div class="pp-ev-top">' + (quando ? '<span class="pp-ev-data">' + quando + '</span>' : '') + (o.semTrib ? '' : chipTrib(e.trib)) + '<strong>' + esc(e.titulo) + '</strong>' + statusErp(e) + '</div>'
      + efeitoHtml(e)
      + '<div class="pp-ev-desc">' + e.desc + (e.descEntrega ? '<br><span class="pp-mut">' + e.descEntrega + '</span>' : '') + '</div>'
      + '<div class="pp-ev-ator">' + esc(e.ator) + (e.modulo ? ' · ' + esc(e.modulo) : '') + '</div>'
      + '</div>';
  }
  function pendHtml(pend) {
    if (!pend.length) return '';
    return '<div class="pp-pend"><div class="pp-sub pp-sub0">Situação agora</div>' + pend.map(function (p) {
      return '<div class="pp-pend-i">' + chipTrib(p.trib) + '<span class="pp-st pp-st-' + p.cls + '">' + ({ ok: 'ok', pending: 'atenção', erro: 'alerta' }[p.cls]) + '</span><span>' + p.txt + '</span></div>';
    }).join('') + '</div>';
  }
  function resumo(evs) {
    var mov = evs.filter(function (e) { return e.mov; }).length, erp = evs.filter(function (e) { return e.fase === 'erp'; }).length;
    var al = evs.filter(function (e) { return e.cls === 'erro' || e.cls === 'pending'; }).length;
    return '<div class="pp-resumo">' + evs.length + ' registros · ' + mov + ' movimentos de valor · ' + erp + ' integrações com o ERP'
      + (al ? ' · <span class="pp-alerta">' + al + ' alerta(s)</span>' : '') + '</div>';
  }
  function saldoApos(e, saldos) {
    if (!(e.valor > 0) || e.para === undefined || !e.rfId) return '';
    var s = saldos[e.rfId] = saldos[e.rfId] || {};
    if (e.de) s[e.de] = r2((s[e.de] || 0) - e.valor);
    s[e.para] = r2((s[e.para] || 0) + e.valor);
    var partes = P.PARC.filter(function (p) { return s[p.k] > 0.005; }).map(function (p) { return esc(p.rot) + ' ' + money(s[p.k]); });
    return '<div class="pp-saldo">Saldo depois: ' + (partes.join(' · ') || '—') + '</div>';
  }

  /* ── 1 · por fase ─────────────────────────────────────────────────────── */
  function h1(c, pend) {
    var h = pendHtml(pend), saida = c.nf.tipo === 'saida';
    FASES.forEach(function (f) {
      var lst = c.evs.filter(function (e) { return e.fase === f[0] && e.ts; });
      if (!lst.length) return;
      var al = lst.filter(function (e) { return e.cls === 'erro' || e.cls === 'pending'; }).length;
      var val = lst.reduce(function (s, e) { return s + (e.mov && e.de !== null ? e.valor : 0); }, 0);
      var rot = saida && f[0] === 'uso' ? 'Extinção do débito' : saida && f[0] === 'recolhimento' ? 'Recolhimento' : f[1];
      h += '<details class="pp-fase"' + (f[0] === 'erp' ? '' : ' open') + '><summary><span>' + rot + '</span><span class="pp-mut">'
        + lst.length + ' registro' + (lst.length > 1 ? 's' : '') + (val > 0 ? ' · ' + money(val) + ' movimentados' : '')
        + (al ? ' · <span class="pp-alerta">' + al + ' alerta' + (al > 1 ? 's' : '') + '</span>' : '') + '</span></summary>'
        + '<div class="pp-fase-l">' + lst.map(function (e) { return itemHtml(e); }).join('') + '</div></details>';
    });
    return h;
  }

  /* ── 2 · raias ────────────────────────────────────────────────────────── */
  function h2(c, pend) {
    var lanes, docTeste;
    if (c.modo === 'df') {
      lanes = c.rfs.map(function (rf) {
        var t = trib(rf);
        return { rot: t.toUpperCase() + ' · ' + ORG[t], hdr: chipTrib(t) + ORG[t] + ' ' + P.selo(rf, false), teste: function (e) { return e.trib === t; } };
      });
      docTeste = function (e) { return !e.trib; };
    } else {
      lanes = [
        { rot: 'Movimentos de valor', hdr: 'Movimentos de valor', teste: function (e) { return e.mov; } },
        { rot: 'Atos, conciliação e integrações', hdr: 'Atos, conciliação e integrações', teste: function (e) { return !e.mov; } }
      ];
      docTeste = function () { return false; };
    }
    if (!lanes.length) return h1(c, pend);
    var dias = [], porDia = {};
    c.evs.forEach(function (e) {
      if (!e.ts) return;
      var d = e.ts.slice(0, 10);
      if (!porDia[d]) { porDia[d] = []; dias.push(d); }
      porDia[d].push(e);
    });
    dias.sort();
    var saldos = {};
    var h = pendHtml(pend) + '<div class="pp-raias' + (lanes.length === 1 ? ' pp-raias-1' : '') + '"><div class="pp-raia-h"></div>'
      + lanes.map(function (l) { return '<div class="pp-raia-h">' + l.hdr + '</div>'; }).join('');
    dias.forEach(function (d) {
      var evs = porDia[d], doc = evs.filter(docTeste);
      if (doc.length) h += '<div class="pp-raia-d">' + br(d) + '</div><div class="pp-raia-c pp-raia-full" data-raia="Documento">' + doc.map(function (e) { return itemHtml(e, { hora: true }); }).join('') + '</div>';
      var cols = lanes.map(function (l) { return evs.filter(function (e) { return !docTeste(e) && l.teste(e); }); });
      if (cols.some(function (x) { return x.length; })) {
        h += '<div class="pp-raia-d">' + (doc.length ? '' : br(d)) + '</div>' + cols.map(function (lst, i) {
          return '<div class="pp-raia-c" data-raia="' + esc(lanes[i].rot) + '">' + lst.map(function (e) { return itemHtml(e, { hora: true, semTrib: c.modo === 'df' }) + saldoApos(e, saldos); }).join('') + '</div>';
        }).join('');
      }
    });
    return h + '</div>';
  }

  /* ── 3 · trilha de auditoria ──────────────────────────────────────────── */
  function h3(c, key) {
    var evs = ordenar(c.evs.slice(), true);
    var tribOps = c.modo === 'df' ? [['todos', 'Todos']].concat(c.rfs.map(function (rf) { return [trib(rf), trib(rf).toUpperCase()]; })).concat([['doc', 'DF']]) : null;
    var usadas = {}; evs.forEach(function (e) { usadas[e.origem] = (usadas[e.origem] || 0) + 1; });
    var tool = '<div class="pp-tool">'
      + (tribOps ? '<span class="pp-seg">' + tribOps.map(function (o, i) { return '<button data-tv="' + o[0] + '" class="' + (i ? '' : 'on') + '" onclick="window.shProp.filtrarTrilha(this)">' + o[1] + '</button>'; }).join('') + '</span>' : '')
      + '<span>' + ORIGENS.filter(function (o) { return usadas[o[0]]; }).map(function (o) { return '<button class="pp-chip on" data-ov="' + o[0] + '" onclick="window.shProp.filtrarTrilha(this)">' + o[1] + ' · ' + usadas[o[0]] + '</button>'; }).join(' ') + '</span>'
      + '<span class="pp-seg"><button class="on" data-ord="desc" onclick="window.shProp.ordemTrilha(this)">Recentes primeiro</button><button data-ord="asc" onclick="window.shProp.ordemTrilha(this)">Antigos primeiro</button></span>'
      + '<button class="pp-btn" onclick="window.shProp.csvEventos(\'' + key + '\')">Exportar CSV</button></div>';
    var rows = evs.map(function (e) {
      return '<tr data-trib="' + (e.trib || 'doc') + '" data-orig="' + e.origem + '" data-ts="' + esc(e.ts || '') + '" onclick="this.classList.toggle(\'aberto\')">'
        + '<td class="pp-num pp-mut">' + brTs(e.ts) + '</td><td>' + chipTrib(e.trib) + '</td><td class="pp-mut">' + ORIGEM_ROT[e.origem] + '</td>'
        + '<td><strong style="color:var(--txt1)">' + esc(e.titulo) + '</strong> ' + statusErp(e) + '<div class="pp-ev-desc">' + e.desc + (e.descEntrega ? ' · ' + e.descEntrega : '') + '</div></td>'
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
  X.csvEventos = function (key) {
    var c = X._cache[key]; if (!c) return;
    var tira = function (s) { var d = document.createElement('div'); d.innerHTML = String(s || ''); return d.textContent; };
    var linhas = [['data_hora', 'tributo', 'origem', 'fase', 'evento', 'valor', 'de', 'para', 'entrega_erp', 'descricao', 'quem_registrou']];
    c.evs.forEach(function (e) {
      linhas.push([e.ts || '', (e.trib || 'df').toUpperCase(), ORIGEM_ROT[e.origem], e.fase, e.titulo, e.valor > 0 ? e.valor.toFixed(2) : '',
        e.de ? P.rot(e.de) : '', e.para ? P.rot(e.para) : '', e.entrega || '', tira(e.desc + (e.descEntrega ? ' · ' + e.descEntrega : '')), e.ator]);
    });
    var txt = linhas.map(function (l) { return l.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';'); }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' }));
    a.download = 'historico-' + key + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
  };

  /* ── histórico: seletor e montagem ────────────────────────────────────── */
  function barraHist(key) {
    var v = ls('sh_prop_hist', '1');
    var b = function (k, rot) { return '<button class="' + (v === k ? 'on' : '') + '" onclick="window.shProp.trocarHist(\'' + key + '\',\'' + k + '\')">' + rot + '</button>'; };
    return '<div class="pp-switch-in"><span class="pp-switch-t">Em avaliação</span><span class="pp-seg">' + b('1', '1 · Por fase') + b('2', '2 · Raias') + b('3', '3 · Trilha de auditoria') + '</span></div>';
  }
  X.historico = function (key) {
    var c = X._cache[key]; if (!c) return '';
    var v = ls('sh_prop_hist', '1'), pend = X.pendencias(c.nf, c.rfs, c.evs);
    var corpo = v === '2' ? h2(c, pend) : v === '3' ? pendHtml(pend) + h3(c, key) : h1(c, pend);
    return barraHist(key) + resumo(c.evs) + (c.evs.length ? corpo : '<div class="pp-mut">Nenhum evento disponível.</div>');
  };
  X.trocarHist = function (key, v) {
    lsSet('sh_prop_hist', v);
    var el = document.getElementById('pph-' + key); if (el) el.innerHTML = X.historico(key);
  };
  X.trocarDF = function (numero, v) {
    lsSet('sh_prop_df', v);
    if (window.abrirDetalhesNFporNumero) window.abrirDetalhesNFporNumero(numero);
  };

  /* ═══ aba Apuração assistida, uma por imposto ═════════════════════════ */
  function racional(m, rf, nf) {
    var t = trib(rf), T = t.toUpperCase(), per = mesAno(m.reconhecidoEm), ap = r2(rf.valor), parcial = m.valor < ap - 0.005;
    var base = [], txt;
    if (m.de === null && m.para === 'pending') {
      txt = 'O documento entrou na apuração do adquirente de ' + per + ' com ' + money(m.valor) + ' de ' + T + ' destacado. O crédito existe desde já, mas só pode ser apropriado quando o débito do fornecedor nesta operação for extinto; até lá o valor inteiro fica <b>a apropriar</b>.';
      base = ['LC 214/2025, art. 47'];
    } else if (m.para === 'available') {
      txt = 'Na apuração de ' + per + ', ' + ORG_A[t] + ' reconheceu a extinção de ' + money(m.valor) + ' do débito de ' + T + ' do fornecedor nesta operação. O crédito do adquirente nasce na medida do débito extinto: ' + money(m.valor) + ' passam de <b>a apropriar</b> para <b>disponível</b>'
        + (parcial ? ', e o restante segue a apropriar até um novo recolhimento' : '') + '.'
        + (m.prazoArt54 ? ' O prazo de cinco anos desta fatia conta do primeiro dia do período seguinte ao da apropriação e termina em ' + br(m.prazoArt54) + '.' : '');
      base = ['LC 214/2025, art. 47', 'art. 54 · prazo por fatia (D-PAR-03)'];
    } else if (m.para === 'utilized' && /Ressarc/.test(m.causa)) {
      txt = money(m.valor) + ' do saldo foram ressarcidos ao adquirente' + (m.vinculo ? ' (' + esc(m.vinculo) + ')' : '') + '. O valor passa para <b>utilizado</b> e não abate débito de nenhuma apuração.';
      base = ['ressarcimento · D-PAR-16'];
    } else if (m.para === 'utilized') {
      txt = 'Na apuração de ' + per + ' do adquirente, o débito de ' + T + ' foi compensado com os créditos disponíveis, na ordem do art. 53. ' + money(m.valor) + ' deste documento foram consumidos e passam de <b>disponível</b> para <b>utilizado</b>'
        + (parcial ? '; o que sobrou segue disponível para as próximas apurações' : '') + '.';
      base = ['LC 214/2025, art. 53'];
    } else if (m.para === 'not_appropriable') {
      txt = ORG_A[t].charAt(0).toUpperCase() + ORG_A[t].slice(1) + ' negou ' + money(m.valor) + ' do crédito antes da apropriação. A glosa' + (parcial ? ' parcial' : '') + ' leva o valor de <b>a apropriar</b> para <b>inapropriável</b>, de onde só sai por decisão em contrário.'
        + (t === 'ibs' ? ' No IBS a glosa entra com valor porque a movimentação foi identificada no arquivo do Comitê Gestor.' : '');
      base = ['glosa antes da apropriação (D-PAR-02)'];
    } else if (m.para === 'not_usable') {
      txt = ORG_A[t].charAt(0).toUpperCase() + ORG_A[t].slice(1) + ' negou ' + money(m.valor) + ' de crédito já apropriado. O valor sai de <b>disponível</b> para <b>inutilizável</b> e deixa de poder ser compensado.';
      base = ['glosa depois da apropriação (D-PAR-02)'];
    } else if (m.para === 'refund_requested') {
      txt = 'O adquirente pediu o ressarcimento de ' + money(m.valor) + '. Enquanto o pedido é analisado, o valor fica em <b>em pedido de ressarcimento</b> e não pode ser usado em compensação.';
      base = ['em pedido vira parcela (D-PAR-16)'];
    } else if (m.para === 'expired') {
      txt = 'Passaram cinco anos do primeiro dia do período seguinte ao da apropriação desta fatia sem que ela fosse usada: ' + money(m.valor) + ' prescrevem.';
      base = ['LC 214/2025, art. 54'];
    } else {
      txt = esc(m.causa) + ': ' + money(m.valor) + ' passam de ' + P.rot(m.de) + ' para ' + P.rot(m.para) + '.';
    }
    return { txt: txt, base: base };
  }
  function fatiasHtml(rf) {
    var ms = movsAsc(rf), fat = ms.filter(function (m) { return m.para === 'available'; }).map(function (m) { return { m: m, usado: 0 }; });
    if (!fat.length) return '';
    var saiu = ms.filter(function (m) { return m.de === 'available'; }).reduce(function (s, m) { return s + m.valor; }, 0);
    fat.forEach(function (f) { var u = Math.min(f.m.valor, saiu); f.usado = r2(u); saiu = r2(saiu - u); });
    return '<div class="pp-sub">Fatias apropriadas e prazo do art. 54</div><div class="pp-scroll"><table class="pp-tab" style="min-width:420px"><thead><tr><th>Apropriada em</th><th class="r">Valor</th><th class="r">Já saiu</th><th class="r">Resta</th><th>Limite art. 54</th></tr></thead><tbody>'
      + fat.map(function (f) {
        var resta = r2(f.m.valor - f.usado);
        return '<tr><td class="pp-num">' + br(f.m.reconhecidoEm) + '</td><td class="r pp-num">' + money(f.m.valor) + '</td><td class="r pp-num">' + (f.usado ? money(f.usado) : '—') + '</td><td class="r pp-num">' + (resta > 0 ? money(resta) : '—') + '</td><td>' + (resta > 0 ? br(f.m.prazoArt54) : '<span class="pp-mut">' + br(f.m.prazoArt54) + ' · fatia consumida</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div><div class="pp-nota">A saída de cada fatia é atribuída às mais antigas primeiro. Cada fatia tem o seu prazo (D-PAR-03); o valor a apropriar não tem prazo de prescrição, o risco dele é o vencimento.</div>';
  }
  X.apuracaoHtml = function (rf, nf) {
    var t = trib(rf), T = t.toUpperCase(), b = rf.balances;
    if (!b) return '<div class="pp-mut">Este registro não tem partição.</div>';
    var ms = movsAsc(rf), saldo = {}, pers = [], porPer = {};
    ms.forEach(function (m) {
      var k = String(m.reconhecidoEm).slice(0, 7);
      if (!porPer[k]) { porPer[k] = []; pers.push(k); }
      porPer[k].push(m);
    });
    pers.sort();
    var conc = rf._concRegApur || nf._concRegApur || null;
    var concTxt = conc ? '<span class="pp-st pp-st-' + (conc.concStatus === 'confirmada' ? 'ok' : conc.concStatus === 'inconsistencia' ? 'erro' : 'pending') + '">conciliação ' + esc(conc.concStatus) + '</span> <span class="pp-mono">' + esc(conc.concId || '') + '</span>' : '';
    var h = '<div class="pp-card-hdr">' + chipTrib(t) + '<strong>Apuração assistida · ' + T + ' · ' + ORG[t] + '</strong><span class="pp-mono">' + esc(rf.id) + '</span>' + P.selo(rf, false) + concTxt + '</div>'
      + '<div class="shg4 pp-kpis">'
      + '<div class="pp-kpi"><span>Apurado</span><b>' + money(rf.valor) + '</b></div>'
      + '<div class="pp-kpi"><span>A apropriar</span><b>' + money(b.pending || 0) + '</b></div>'
      + '<div class="pp-kpi"><span>Disponível</span><b>' + money(b.available || 0) + '</b></div>'
      + '<div class="pp-kpi"><span>Movimentos · períodos</span><b>' + ms.length + ' · ' + pers.length + '</b></div></div>'
      + '<div class="pp-ap-como"><b>Como o valor se move.</b> A leitura ' + (t === 'cbs' ? 'da CBS' : 'do IBS') + ' é a ' + LEITURA[t] + '. O SplitHub só grava um movimento quando a Conciliação encontra o reflexo do órgão; sem esse reflexo o valor não se move (C-01). '
      + 'Cada movimento tira uma quantia de uma parcela e a põe em outra, então a soma das parcelas é sempre o apurado.'
      + (t === 'ibs' ? ' O Comitê Gestor não informa as parcelas inutilizável, suspenso, prescrito e restabelecido; elas aparecem como não informadas (D-PAR-09).' : '') + '</div>';
    pers.forEach(function (k) {
      var lst = porPer[k];
      h += '<div class="pp-per"><div class="pp-per-h">Apuração de ' + mesAno(k + '-01') + '<span class="pp-mut">· ' + ORG[t] + ' · ' + lst.length + ' movimento' + (lst.length > 1 ? 's' : '') + '</span></div>';
      lst.forEach(function (m) {
        if (m.de) saldo[m.de] = r2((saldo[m.de] || 0) - m.valor);
        saldo[m.para] = r2((saldo[m.para] || 0) + m.valor);
        var r = racional(m, rf, nf);
        var partes = P.PARC.filter(function (p) { return saldo[p.k] > 0.005; }).map(function (p) { return '<span class="pp-parc">' + dot(p.cor) + esc(p.rot) + ' <b class="pp-num">' + money(saldo[p.k]) + '</b></span>'; });
        h += '<div class="pp-mov"><div class="pp-ev-top"><span class="pp-ev-data">' + br(m.reconhecidoEm) + '</span><strong>' + esc(movEv(m, rf).titulo) + '</strong></div>'
          + '<div class="pp-ev-ef">' + parcTag(m.de) + '<span class="pp-seta">→</span>' + parcTag(m.para) + '<b class="pp-num">' + money(m.valor) + '</b></div>'
          + '<div class="pp-rac"><b>Racional.</b> ' + r.txt + '</div>'
          + (r.base.length ? '<div class="pp-base">' + r.base.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</div>' : '')
          + '<div class="pp-fonte">Fonte: ' + esc(m.fonte) + (m.vinculo ? ' · ' + esc(m.vinculo) : '') + ' · reconhecido em ' + br(m.reconhecidoEm) + '</div>'
          + '<div class="pp-saldos"><span>Saldo depois:</span>' + partes.join('') + '</div></div>';
      });
      h += '</div>';
    });
    var fecha = Math.abs(P.apurado(b) - r2(rf.valor)) < 0.01;
    return h + '<div class="pp-conf ' + (fecha ? 'ok' : 'err') + '">' + (fecha ? '✓ O saldo depois do último movimento é a partição que o órgão informa hoje e soma o apurado.' : '✕ A partição não fecha com o apurado.') + '</div>'
      + fatiasHtml(rf);
  };

  /* ═══ montagem dos modais ═════════════════════════════════════════════ */
  function abasBar(tabs, fim) {
    return '<div class="pp-abas">' + tabs.map(function (t, i) {
      return '<button data-g="aba" data-v="' + t[0] + '" class="' + (i ? '' : 'on') + '" onclick="window.shProp.alternar(this)">' + t[1] + '</button>';
    }).join('') + (fim ? '<span class="pp-abas-fim">' + fim + '</span>' : '') + '</div>';
  }
  X.barraDF = function (nf) {
    var v = ls('sh_prop_df', 'A');
    var b = function (k, rot) { return '<button class="' + (v === k ? 'on' : '') + '" onclick="window.shProp.trocarDF(\'' + esc(nf.numero) + '\',\'' + k + '\')">' + rot + '</button>'; };
    return '<div class="pp-switch"><span class="pp-switch-t">Em avaliação</span><span class="pp-switch-g">Detalhe do documento <span class="pp-seg">'
      + b('A', 'A · Cartões por tributo') + b('B', 'B · Quadro CBS × IBS') + b('C', 'C · Livro razão') + '</span></span>'
      + '<span class="pp-mut">A escolha fica só neste navegador.</span></div>';
  };
  // corpo do detalhe do DF de entrada com partição
  X.corpoDF = function (nf, ctx) {
    var v = ls('sh_prop_df', 'A'); if ('ABC'.indexOf(v) < 0) v = 'A';
    var q = X.valores(nf), key = chave('df-' + nf.numero);
    var evs = X.eventos(nf, null);
    X._cache[key] = { evs: evs, nf: nf, rfs: q.rfs, modo: 'df' };
    var esq = '<div class="mbox-section-label">Documento Fiscal</div>' + ctx.docHtml
      + (v !== 'B' ? '<div class="mbox-divider"></div>' + valoresHtml(nf, q, v === 'C' ? 'Valores · balancete das parcelas' : 'Valores') : '')
      + '<div class="mbox-divider"></div>' + ctx.chaveHtml + ctx.ctrHtml + ctx.radHtml
      + '<div class="mbox-divider"></div><div class="mbox-section-label">Inconsistências Vinculadas</div>' + ctx.incHtml;
    var dir = (v === 'A' ? blocoA(nf, q) : v === 'B' ? blocoB(nf, q) : blocoC(nf, q));
    var tabs = [['hist', 'Histórico do ciclo · ' + evs.length]].concat(q.rfs.map(function (rf) { return ['ap-' + trib(rf), 'Apuração assistida · ' + trib(rf).toUpperCase()]; }));
    dir += '<div data-pp-box>' + abasBar(tabs)
      + '<div data-aba="hist"><div id="pph-' + key + '">' + X.historico(key) + '</div></div>'
      + q.rfs.map(function (rf) { return '<div data-aba="ap-' + trib(rf) + '" style="display:none">' + X.apuracaoHtml(rf, nf) + '</div>'; }).join('')
      + '</div>';
    return '<div class="pp-body"><div class="mbox-col pp-col-l">' + esq + '</div><div class="mbox-col pp-col-r">' + dir + '</div></div>';
  };
  // histórico do DF sem partição (saída): só a proposta de histórico
  X.historicoDF = function (nf) {
    var key = chave('df-' + nf.numero);
    X._cache[key] = { evs: X.eventos(nf, null), nf: nf, rfs: nf.registrosFiscais || [], modo: 'df' };
    return '<div class="mbox-section-label">Histórico do Ciclo</div><div id="pph-' + key + '">' + X.historico(key) + '</div>';
  };
  // coluna direita do detalhe do RF: movimentos, histórico e apuração assistida
  X.abasRF = function (rf, nf) {
    var key = chave('rf-' + rf.id), evs = X.eventos(nf, rf), part = !!rf.balances;
    X._cache[key] = { evs: evs, nf: nf, rfs: [rf], rf: rf, modo: 'rf' };
    var tabs = [];
    if (part) tabs.push(['mov', 'Movimentos de valor']);
    tabs.push(['hist', 'Histórico do ciclo · ' + evs.length]);
    if (part) tabs.push(['ap', 'Apuração assistida · ' + trib(rf).toUpperCase()]);
    var csv = part ? '<button class="pp-btn" onclick="window.shParcial.csv(window._rfIndex[\'' + esc(rf.id) + '\'].rf)">Exportar movimentos</button>' : '';
    return '<div data-pp-box>' + abasBar(tabs, csv)
      + (part ? '<div data-aba="mov">' + P.tabelaMovimentos(rf) + '<div class="pp-nota">Cada linha move uma quantia de uma parcela para outra. Os movimentos de cada parcela somam o saldo dela; a data é a do reconhecimento pelo órgão.</div></div>' : '')
      + '<div data-aba="hist"' + (part ? ' style="display:none"' : '') + '><div id="pph-' + key + '">' + X.historico(key) + '</div></div>'
      + (part ? '<div data-aba="ap" style="display:none">' + X.apuracaoHtml(rf, nf) + '</div>' : '')
      + '</div>';
  };
})();

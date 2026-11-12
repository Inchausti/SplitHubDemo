/* ══ Eventos fiscais — lote 3 (pacote AV-E3) ═══════════════════════════════
   O reflexo dos eventos fora da esteira: o que o PRD de Eventos fiscais (seção
   2.2) e a proposta de telas v1.3 deixaram para o lote 3, sobre os lotes 1 e 2
   (js/eventos-modulo.js e js/eventos-lote2.js).

   eventos_reflexo      Base. O valor de cada registro fiscal passa a ser o
                        saldo após eventos: o escriturado mais o que cada órgão
                        já confirmou (C-01, D-09: divergência nunca aplica valor
                        sozinha). Roda antes do motor do art. 53, que assim
                        compensa sobre o saldo, não sobre o valor original
                        (T-05, "o risco escondido"). Débito com divergência de
                        evento acende a flag inconsistencia e fica retido, fora
                        da fila do art. 53 (D-DB-02).
   eventos_credito      T-04 · Crédito: colunas Fase, Origem do estado, Último
                        evento e Fato gerador na listagem de documentos; a
                        divergência de evento e o evento faltante na coluna de
                        inconsistências; filtros de fase, origem e presença de
                        evento; no detalhe do registro, os quatro marcos do
                        ciclo, com fgConstituidoEm, e a extinção com o evento
                        por trás.
   eventos_debito       T-05 · Débito: coluna Efeito de evento, com o valor
                        riscado e o novo; no detalhe do registro, o efeito de
                        cada evento e as flags.
   eventos_pcont        T-06 · PCONT: aviso de competência a recalcular, com os
                        alertas do período, o impacto por tributo e a janela de
                        ajuste. Nunca reabre a apuração (D-14).
   eventos_conciliacao  T-07 · Conciliação: a terceira ponta. ERP, evento e
                        apuração lado a lado, e a causa da diferença.
   eventos_rad          T-09 · Pagamentos: o 112110 bloqueia assumir o RAD, com
                        exceção justificada e registrada (recomendação da D-16,
                        ainda sem decisão — DV-29); guia emitida vira cobrança
                        suspensa; guia paga vira duplicidade.

   Ficam como estão, por decisão em aberto: o fato gerador segue a emissão,
   porque o efeito do 112150 na competência depende da C-06 e da DV-34; por
   isso a classificação CP/LP/vencidos não muda. A camada de item fica fora
   (D-02). Os webhooks credit.* e debit.* são da API, não do protótipo.
   Tudo simulado e em memória, como os lotes 1 e 2.
   ═══════════════════════════════════════════════════════════════════════════ */
/* @pacote — o estado das flags é reescrito por tools/avaliacao.py promover */
window.shFeature && shFeature.registrar({"id": "AV-E3", "nome": "Eventos fiscais — lote 3: reflexos em crédito, débito, PCONT, conciliação e RAD", "branch": "feat/eventos-lote3", "entrada": "#/eventos", "flags": {"eventos_reflexo": "avaliacao", "eventos_credito": "avaliacao", "eventos_debito": "avaliacao", "eventos_pcont": "avaliacao", "eventos_conciliacao": "avaliacao", "eventos_rad": "avaliacao"}, "rotulos": {"eventos_reflexo": "O registro fiscal passa a valer o saldo após eventos, e o motor do art. 53 compensa sobre ele", "eventos_credito": "Crédito com fase, origem do estado, último evento e fato gerador (T-04)", "eventos_debito": "Débito com o efeito de cada evento e o retido por divergência (T-05)", "eventos_pcont": "Aviso de competência a recalcular no PCONT (T-06)", "eventos_conciliacao": "A terceira ponta da conciliação: o evento (T-07)", "eventos_rad": "O 112110 bloqueia assumir o RAD (T-09, D-16 em aberto)"}});
/* @fim-pacote */
(function () {
  'use strict';

  var F = { base: 'eventos_reflexo', cred: 'eventos_credito', deb: 'eventos_debito', pcont: 'eventos_pcont', conc: 'eventos_conciliacao', rad: 'eventos_rad' };
  function on(f) { return !window.shFeature || (shFeature.ligada('eventos_modulo') && shFeature.ligada(f)); }
  function I() { return window.shEvm && window.shEvm._int; }
  function L2() { return window.shEvmL2 || null; }

  (function () {
    if (document.getElementById('evl3-css')) return;
    var l = document.createElement('link');
    l.id = 'evl3-css'; l.rel = 'stylesheet'; l.href = 'css/eventos-lote3.css?v=1';
    document.head.appendChild(l);
  })();

  /* ── utilitários ──────────────────────────────────────────────────────── */
  var DIA = 864e5, HORA = 36e5, MIN = 6e4;
  var MESES_L = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(v) { return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function sinal(v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + money(Math.abs(v)); }
  function p2(n) { return ('0' + n).slice(-2); }
  function fD(d) { if (d == null || d === '') return '—'; if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4); d = new Date(d); return isNaN(d) ? '—' : p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear(); }
  function fDC(d) { d = new Date(d); return p2(d.getDate()) + '/' + p2(d.getMonth() + 1); }
  function fDH(d) { d = new Date(d); return fD(d) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); }
  function hojeIso() { var d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function rotP(P) { return MESES_L[+P.slice(5, 7) - 1] + '/' + P.slice(0, 4); }
  function T(rf) { return String(rf && rf.tipoFiscal || '').toUpperCase(); }
  function pl(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }
  function toast(m) { var x = I(); if (x) x.toast(m); }
  function usuario() { var x = I(); return x ? x.nomeUsuario() : 'Usuário'; }
  function fechar(id) { var e = document.getElementById(id); if (e) e.remove(); }
  function nfPorNumero(n) { var x = I(); if (!x) return null; return x.nfs().filter(function (nf) { return String(nf.numero) === String(n); })[0] || null; }
  function rfsDe(nf) {
    return (nf && nf.registrosFiscais || []).filter(function (rf) { var t = T(rf); return t === 'CBS' || t === 'IBS'; })
      .sort(function (a, b) { return T(a) === 'CBS' ? -1 : T(b) === 'CBS' ? 1 : 0; });
  }
  function docRot(nf) { return (nf.tipoDF || 'NF-e') + ' ' + nf.numero; }
  // o reflexo roda dentro do processamento da base, antes de _nfListaCompleta ser refeita:
  // a lista que o motor lê vem primeiro, e a cópia anterior só completa o que faltar
  function todas() {
    var vistos = new Set(), out = [];
    [window.nfListaFiltradaGlobal, window._nfListaCompleta].forEach(function (l) {
      (l || []).forEach(function (nf) { if (nf && !vistos.has(nf)) { vistos.add(nf); out.push(nf); } });
    });
    return out;
  }

  /* ══ O modelo: o que os eventos fizeram com cada registro fiscal ════════ */
  var CACHE = null;
  function invalidar() { CACHE = null; }
  function baseDe(rf) { return rf._evl3Base != null ? rf._evl3Base : (Number(rf.valor) || 0); }
  function novoRf(rf, nf) { return { rf: rf, nf: nf, t: T(rf), base: baseDe(rf), aplicado: 0, pendente: 0, evs: [], ultimo: null, div: false, observado: false, vigente: baseDe(rf) }; }
  function modelo() {
    if (CACHE) return CACHE;
    var x = I(), M = { rf: {}, nf: {} };
    if (!x) return M;
    try { if (!x.semear()) return M; } catch (e) { return M; }
    var idx = {};
    todas().forEach(function (nf) { (nf.registrosFiscais || []).forEach(function (rf) { if (!idx[rf.id]) idx[rf.id] = { rf: rf, nf: nf }; }); });
    function nfInfo(n) { return M.nf[n] || (M.nf[n] = { evs: [], ultimo: null, div: false, faltante: [], e112110: null }); }
    x.ST.eventos.forEach(function (ev) {
      if (ev.orfao) return;
      var ni = nfInfo(ev.nf);
      if (!ev.canceladoPor) {
        ni.evs.push(ev);
        if (!ni.ultimo || ev.aut > ni.ultimo.aut) ni.ultimo = ev;
        if (ev.cod === '112110' && ev.lado === 'entrada' && (!ni.e112110 || ev.aut > ni.e112110.aut)) ni.e112110 = ev;
      }
      x.tribsDo(ev).forEach(function (t) {
        var y = ev.trib[t], e = idx[y.rf]; if (!e) return;
        var r = M.rf[y.rf] || (M.rf[y.rf] = novoRf(e.rf, e.nf));
        if (ev.canceladoPor || y.estado === 'cancelada') return;
        r.evs.push({ ev: ev, x: y });
        if (!r.ultimo || ev.aut > r.ultimo.aut) r.ultimo = ev;
        var mov = x.movel(ev);
        if (x.aplicado(y)) { r.observado = true; if (mov) r.aplicado += y.delta || 0; }
        else if (mov) r.pendente += y.delta || 0;
        if (y.estado === 'divergente' && !ev.revertidoPor) { r.div = true; ni.div = true; }
      });
    });
    x.ST.ausentes.forEach(function (a) { nfInfo(a.nf).faltante.push(a); });
    Object.keys(M.rf).forEach(function (id) { var r = M.rf[id]; r.vigente = Math.max(0, r.base + r.aplicado); });
    CACHE = M;
    return M;
  }
  function infoRf(rf, nf) { return modelo().rf[rf.id] || novoRf(rf, nf); }
  function infoNf(n) { return modelo().nf[String(n)] || { evs: [], ultimo: null, div: false, faltante: [], e112110: null }; }

  // origem do estado: deduzido (o produto inferiu) · observado (um evento ou a apuração confirmou) · divergente (o evento diz uma coisa e o órgão outra)
  function origem(r) {
    if (r.div) return 'divergente';
    if (r.observado) return 'observado';
    var s = r.rf.statusCredito || r.rf.status || '';
    if (r.nf.tipo === 'saida' ? (s === 'extinto' || s === 'parcial') : (s === 'apropriado' || s === 'utilizado')) return 'observado';
    return 'deduzido';
  }
  // o fato gerador segue a emissão: o efeito do 112150 na competência espera a C-06 e a DV-34
  function fgEm(nf) { return String(nf.data || '').slice(0, 10) || null; }
  // fases do crédito: originado → apropriável (constituída pelo fato gerador) → apropriado → utilizado
  function fase(r) {
    var s = r.rf.statusCredito || r.rf.status || '';
    if (s === 'glosado') return 'glosado';
    if (s === 'utilizado') return 'utilizado';
    if (s === 'apropriado') return 'apropriado';
    var fg = fgEm(r.nf);
    return fg && fg <= hojeIso() ? 'apropriavel' : 'originado';
  }
  var FASE = { originado: ['originado', 'neu'], apropriavel: ['apropriável', 'wait'], apropriado: ['apropriado', 'ok'], utilizado: ['utilizado', 'ok'], glosado: ['glosado', 'gray'] };
  var ORIG = { deduzido: ['deduzido', 'neu'], observado: ['observado', 'ok'], divergente: ['divergente', 'div'] };
  function ch(rot, cls, trib) { return '<span class="evl3-ch ' + cls + '">' + (trib ? '<span class="evl3-tr">' + trib + '</span>' : '') + esc(rot) + '</span>'; }
  // um chip por documento quando os dois tributos concordam; um por tributo quando não
  function chipsPor(nf, fn, mapa) {
    var rs = rfsDe(nf).map(function (rf) { var r = infoRf(rf, nf); return { t: r.t, k: fn(r) }; });
    if (!rs.length) return '<span class="evl3-mut">—</span>';
    if (rs.every(function (o) { return o.k === rs[0].k; })) return ch(mapa[rs[0].k][0], mapa[rs[0].k][1]);
    return '<span class="evl3-chs">' + rs.map(function (o) { return ch(mapa[o.k][0], mapa[o.k][1], o.t); }).join('') + '</span>';
  }

  /* ══ Base: o saldo após eventos, antes do motor do art. 53 ══════════════ */
  function aplicarBase() {
    var x = I(); if (!x) return 0;
    var ligado = on(F.base), M = null, n = 0;
    if (ligado) { invalidar(); M = modelo(); }
    todas().forEach(function (nf) {
      (nf.registrosFiscais || []).forEach(function (rf) {
        // desfaz o que este pacote fez na passada anterior
        if (rf._evl3Base != null) { rf.valor = rf._evl3Base; if (!ligado) delete rf._evl3Base; }
        if (rf._evl3Marcas) {
          var tiradas = rf._evl3Marcas;
          rf.statusFlags = (rf.statusFlags || []).filter(function (f) { return tiradas.indexOf(f) < 0; });
          rf._evl3Marcas = null;
        }
        rf._evl3Retido = false;
        if (!ligado || !M) return;
        var r = M.rf[rf.id]; if (!r) return;
        if (Math.abs(r.aplicado) > 0.005) {
          if (rf._evl3Base == null) rf._evl3Base = r.base;
          rf.valor = r.vigente; n++;
        }
        // D-DB-02: o débito com divergência de evento fica retido, fora da fila do art. 53
        if (nf.tipo === 'saida' && r.div) {
          var fl = rf.statusFlags = rf.statusFlags || [], add = [];
          if (fl.indexOf('inconsistencia') < 0) { fl.push('inconsistencia'); add.push('inconsistencia'); }
          var extintoFora = rf.status === 'extinto' && rf.metodoExtincao && rf.metodoExtincao !== 'Compensacao';
          if (!extintoFora && fl.indexOf('retido') < 0) { fl.push('retido'); add.push('retido'); }
          rf._evl3Marcas = add; rf._evl3Retido = !extintoFora;
        }
      });
    });
    invalidar();
    return n;
  }
  // o motor do art. 53 roda dentro do processamento da base: o reflexo entra logo antes dele
  function ganchoMotor() {
    var Mo = window.shMotor;
    if (!Mo || typeof Mo.aplicarNaBase !== 'function' || Mo.aplicarNaBase._evl3) return;
    var orig = Mo.aplicarNaBase;
    Mo.aplicarNaBase = function () {
      try { if (on(F.base)) aplicarBase(); } catch (e) { console.error('[eventos lote 3] base', e); }
      return orig.apply(this, arguments);
    };
    Mo.aplicarNaBase._evl3 = true;
  }
  ganchoMotor();

  // eventos semeados antes de a base atribuir o estabelecimento: completa depois
  function completarEmpresa() {
    var x = I(); if (!x || !x.ST.ok) return;
    x.ST.eventos.forEach(function (ev) {
      if (ev.cnpjEmpresa || ev.orfao) return;
      var nf = nfPorNumero(ev.nf); if (nf && nf.cnpjComprador) ev.cnpjEmpresa = nf.cnpjComprador;
    });
  }

  // uma leitura do órgão, uma importação ou uma reversão mudam o saldo: refaz o reflexo e redesenha o que está à vista
  function ativa(id) { var e = document.getElementById(id); return !!(e && e.classList.contains('active')); }
  function atualizar() {
    invalidar();
    if (on(F.base)) { try { aplicarBase(); } catch (e) { console.error('[eventos lote 3] reflexo', e); } }
    try { if (ativa('cred-dfs') && typeof window.creditosDFsRender === 'function') window.creditosDFsRender(); } catch (e) {}
    try { if (ativa('deb-dfs') && typeof window.debitosDFsRender === 'function') window.debitosDFsRender(); } catch (e) {}
    try { if (ativa('conc-evl3')) conc(); } catch (e) {}
    try { if (document.querySelector('#view-pcont.active')) pcont(); } catch (e) {}
  }

  /* ══ T-04 · Crédito ═════════════════════════════════════════════════════ */
  function nfDaLinha(tr) {
    var c = tr.cells && tr.cells[0]; if (!c) return null;
    var s = (c.getAttribute('onclick') || '') + ' ' + c.innerHTML;
    var m = s.match(/abrirDetalhesNFporNumero\(\s*(?:'|&#39;)([^'&]+)(?:'|&#39;)/);
    return m ? nfPorNumero(m[1]) : null;
  }
  function idxColuna(theadId, prefixo) {
    var th = document.querySelectorAll('#' + theadId + ' th'), i;
    for (i = 0; i < th.length; i++) if (String(th[i].textContent || '').trim().indexOf(prefixo) === 0) return i;
    return -1;
  }
  function cabecalho(theadId, cols) {
    var tr = document.querySelector('#' + theadId + ' tr'); if (!tr) return;
    tr.querySelectorAll('th[data-evl3]').forEach(function (e) { e.remove(); });
    if (!cols) return;
    tr.insertAdjacentHTML('beforeend', cols.map(function (c) { return '<th data-evl3="1" data-col-key="evl3_' + c[0] + '"' + (c[2] ? ' title="' + esc(c[2]) + '"' : '') + '>' + esc(c[1]) + '</th>'; }).join(''));
  }
  function badgesInc(ni) {
    var h = '';
    if (ni.div) h += '<span class="evl3-inc">Divergência de evento</span>';
    if (ni.faltante.length) h += '<span class="evl3-inc">Evento faltante</span>';
    return h;
  }
  function anexarInc(tr, i, ni) {
    var b = badgesInc(ni); if (!b || i < 0 || !tr.cells[i] || tr.cells[i].querySelector('.evl3-inc')) return;
    var c = tr.cells[i];
    if (String(c.textContent || '').trim() === '—') c.innerHTML = '';
    c.insertAdjacentHTML('beforeend', b);
  }
  function celUltimo(ni) {
    var ev = ni.ultimo; if (!ev) return '<span class="evl3-mut">—</span>';
    return '<button class="evl3-lk" onclick="event.stopPropagation();shEvm.detalhe(\'' + ev.id + '\')"><code>' + esc(ev.cod) + '</code> ' + fDC(ev.aut) + '</button>';
  }
  function celFG(nf, ni) {
    var e = ni.evs.filter(function (ev) { return ev.cod === '112150'; })[0];
    return fD(fgEm(nf)) + (e ? '<div class="evl3-sub">112150 · nova previsão de entrega; competência em decisão (DV-34)</div>' : '');
  }
  var CF = { fase: '', origem: '', evento: '' };
  function filtrosCredito() {
    var ref = document.getElementById('cred-dfs-extincao'), campo = ref && ref.closest('.sh-fp-field');
    if (!campo || document.getElementById('evl3-cf-fase')) return;
    function sel(id, rot, ops) {
      return '<div class="sh-fp-field" data-evl3="1"><label for="' + id + '">' + rot + '</label><select id="' + id + '" onchange="creditosDFsRender()">'
        + ops.map(function (o) { return '<option value="' + o[0] + '">' + esc(o[1]) + '</option>'; }).join('') + '</select></div>';
    }
    campo.insertAdjacentHTML('afterend',
      sel('evl3-cf-fase', 'Fase do crédito', [['', 'Todas'], ['originado', 'Originado'], ['apropriavel', 'Apropriável'], ['apropriado', 'Apropriado'], ['utilizado', 'Utilizado'], ['glosado', 'Glosado']])
      + sel('evl3-cf-origem', 'Origem do estado', [['', 'Todas'], ['deduzido', 'Deduzido'], ['observado', 'Observado'], ['divergente', 'Divergente']])
      + sel('evl3-cf-evento', 'Presença de evento', [['', 'Todos'], ['com', 'Com evento'], ['sem', 'Sem evento'], ['div', 'Com divergência de evento'], ['falta', 'Com evento faltante']]));
  }
  function lerFiltros() {
    ['fase', 'origem', 'evento'].forEach(function (k) { var e = document.getElementById('evl3-cf-' + k); CF[k] = e ? e.value : ''; });
  }
  function passa(nf, ni) {
    var rs = rfsDe(nf).map(function (rf) { return infoRf(rf, nf); });
    if (CF.fase && !rs.some(function (r) { return fase(r) === CF.fase; })) return false;
    if (CF.origem && !rs.some(function (r) { return origem(r) === CF.origem; })) return false;
    if (CF.evento === 'com' && !ni.evs.length) return false;
    if (CF.evento === 'sem' && ni.evs.length) return false;
    if (CF.evento === 'div' && !ni.div) return false;
    if (CF.evento === 'falta' && !ni.faltante.length) return false;
    return true;
  }
  function credDFs() {
    var tb = document.getElementById('t-cred-dfs-body'); if (!tb) return;
    var ligado = on(F.cred);
    document.querySelectorAll('[data-evl3="1"].sh-fp-field').forEach(function (e) { if (!ligado) e.remove(); });
    if (!ligado) { cabecalho('thead-t-cred-dfs', null); return; }
    invalidar();
    filtrosCredito(); lerFiltros();
    cabecalho('thead-t-cred-dfs', [['fase', 'Fase', 'Originado, apropriável (o fato gerador constituiu), apropriado, utilizado'], ['origem', 'Origem do estado', 'Deduzido pelo produto, observado num evento ou na apuração, ou divergente'], ['ultimo', 'Último evento'], ['fg', 'Fato gerador']]);
    var iInc = idxColuna('thead-t-cred-dfs', 'Inconsist'), filtrando = CF.fase || CF.origem || CF.evento;
    Array.prototype.forEach.call(tb.rows, function (tr) {
      if (tr.cells.length < 4 || tr.querySelector('td[data-evl3]')) return;
      var nf = nfDaLinha(tr);
      if (!nf) { if (filtrando) tr.style.display = 'none'; else tr.insertAdjacentHTML('beforeend', '<td data-evl3="1"></td><td data-evl3="1"></td><td data-evl3="1"></td><td data-evl3="1"></td>'); return; }
      var ni = infoNf(nf.numero);
      if (filtrando && !passa(nf, ni)) { tr.style.display = 'none'; return; }
      tr.insertAdjacentHTML('beforeend',
        '<td data-evl3="1" class="nowrap">' + chipsPor(nf, fase, FASE) + '</td>'
        + '<td data-evl3="1" class="nowrap">' + chipsPor(nf, origem, ORIG) + '</td>'
        + '<td data-evl3="1" class="nowrap">' + celUltimo(ni) + '</td>'
        + '<td data-evl3="1" class="nowrap">' + celFG(nf, ni) + '</td>');
      anexarInc(tr, iInc, ni);
    });
    if (filtrando) {
      // contado no fim: o gancho pode rodar duas vezes sobre a mesma tabela
      var vis = Array.prototype.filter.call(tb.rows, function (tr) { return tr.style.display !== 'none' && tr.querySelector('td[data-evl3]'); }).length;
      var sub = document.getElementById('cred-dfs-sub'); if (sub) sub.textContent = vis + ' DF' + (vis !== 1 ? 's' : '') + ' de entrada · filtro de eventos';
      var cnt = document.getElementById('cred-dfs-contagem'); if (cnt) cnt.textContent = vis + ' registros';
    }
  }

  /* ══ T-05 · Débito ══════════════════════════════════════════════════════ */
  function celEfeito(nf) {
    var linhas = rfsDe(nf).map(function (rf) {
      var r = infoRf(rf, nf), h = '';
      if (Math.abs(r.aplicado) > 0.005) h += '<span class="evl3-s">' + money(r.base) + '</span> → <b>' + money(r.vigente) + '</b>';
      if (Math.abs(r.pendente) > 0.005) h += (h ? ' · ' : '') + '<span class="evl3-mut">previsto ' + sinal(r.pendente) + ', aguardando o órgão</span>';
      if (r.div) h += (h ? ' ' : '') + ch(rf._evl3Retido ? 'divergente · retido' : 'divergente', 'div');
      return h ? '<div><span class="evl3-tr">' + r.t + '</span>' + h + '</div>' : '';
    }).join('');
    return linhas || '<span class="evl3-mut">—</span>';
  }
  function debDFs() {
    var tb = document.getElementById('t-deb-dfs-body'); if (!tb) return;
    if (!on(F.deb)) { cabecalho('thead-t-deb-dfs', null); return; }
    invalidar();
    cabecalho('thead-t-deb-dfs', [['efeito', 'Efeito de evento', 'O valor riscado é o escriturado; o novo, o saldo depois do que o órgão confirmou']]);
    var iInc = idxColuna('thead-t-deb-dfs', 'Inconsist');
    Array.prototype.forEach.call(tb.rows, function (tr) {
      if (tr.cells.length < 4 || tr.querySelector('td[data-evl3]')) return;
      var nf = nfDaLinha(tr);
      tr.insertAdjacentHTML('beforeend', '<td data-evl3="1" class="evl3-cel">' + (nf ? celEfeito(nf) : '') + '</td>');
      if (nf) anexarInc(tr, iInc, infoNf(nf.numero));
    });
  }

  /* ══ Detalhe do registro fiscal (T-04 e T-05) ═══════════════════════════ */
  function marcos(r) {
    var rf = r.rf, ni = infoNf(r.nf.numero), e = ni.e112110, fs = fase(r);
    var ext = rf.dataExtincaoCredito && rf.dataExtincaoCredito !== '—' ? rf.dataExtincaoCredito : null;
    var M = [
      ['Originado', fD(r.nf.data), 'emissão do documento', true],
      ['Fato gerador constituído', fD(fgEm(r.nf)), 'fgConstituidoEm · pela emissão', fs !== 'originado'],
      ['Apropriado', rf.dataApropriacao ? fD(rf.dataApropriacao) : 'aguardando', e ? 'pagamento integral informado pelo emitente · 112110 em ' + fDC(e.aut) : 'extinção do débito do fornecedor', fs === 'apropriado' || fs === 'utilizado'],
      ['Utilizado', ext ? fD(ext) : '—', rf.metodoExtincao ? 'extinção por ' + String(rf.metodoExtincao).toLowerCase() : 'compensação ou ressarcimento', fs === 'utilizado']
    ];
    return '<div class="evl3-marcos">' + M.map(function (m) {
      return '<div class="evl3-marco' + (m[3] ? ' on' : '') + '"><span class="evl3-dot"></span><div><div class="evl3-mt">' + esc(m[0]) + '</div><div class="evl3-mv">' + esc(m[1]) + '</div><div class="evl3-sub">' + esc(m[2]) + '</div></div></div>';
    }).join('') + '</div>';
  }
  function listaEventos(r) {
    var x = I(); if (!x || !r.evs.length) return '';
    return '<div class="evl3-evs">' + r.evs.slice().sort(function (a, b) { return a.ev.aut - b.ev.aut; }).map(function (o) {
      var ev = o.ev, y = o.x, mov = x.movel(ev), ap = x.aplicado(y);
      var ef = !mov ? 'atributo — não muda valor' : ap ? 'aplicado ' + sinal(y.delta || 0) : y.estado === 'divergente' ? 'divergente: o órgão leu ' + money(y.observado) + ', o evento pede ' + money((y.antes || 0) + (y.delta || 0)) : 'previsto ' + sinal(y.delta || 0) + ', não somado';
      return '<div class="evl3-ev"><button class="evl3-lk" onclick="document.getElementById(\'rf-detalhe-overlay\')&&document.getElementById(\'rf-detalhe-overlay\').remove();shEvm.detalhe(\'' + ev.id + '\')"><code>' + esc(ev.cod) + '</code> ' + esc(ev.id) + '</button>'
        + ' <span class="evl3-mut">' + fDC(ev.aut) + '</span> ' + x.chip(y.estado) + '<div class="evl3-sub">' + esc(ef) + '</div></div>';
    }).join('') + '</div>';
  }
  function painelRF() {
    if (!on(F.cred) && !on(F.deb) && !on(F.base)) return;
    var ov = document.getElementById('rf-detalhe-overlay'); if (!ov) return;
    var box = ov.querySelector('.mbox-col'); if (!box || box.querySelector('[data-evl3-rf]')) return;
    var tit = ov.querySelector('.mbox-title'), id = tit ? String(tit.textContent || '').split('·').pop().trim() : '';
    var e = (window._rfIndex || {})[id]; if (!e) return;
    invalidar();
    var r = infoRf(e.rf, e.nf), entrada = e.nf.tipo !== 'saida';
    if (entrada ? !on(F.cred) && !on(F.base) : !on(F.deb) && !on(F.base)) return;
    var DR = window._rfDetailRow || function (l, v) { return '<div class="evl3-dr"><span>' + l + '</span><span>' + v + '</span></div>'; };
    var h = '<div class="mbox-divider"></div><div class="mbox-section-label">Reflexo dos eventos fiscais</div>';
    if (Math.abs(r.aplicado) > 0.005) {
      h += DR('Valor escriturado', '<span class="evl3-s">' + money(r.base) + '</span>')
        + DR('Saldo após eventos', '<b>' + money(r.vigente) + '</b>', 'var(--teal)');
    } else h += DR('Saldo após eventos', money(r.vigente) + ' <span class="evl3-mut">· nenhum evento mudou o valor</span>');
    if (Math.abs(r.pendente) > 0.005) h += DR('Previsto, não somado', sinal(r.pendente) + ' <span class="evl3-mut">· espera o reflexo ' + (r.t === 'CBS' ? 'da Receita Federal' : 'do Comitê Gestor') + '</span>');
    var o = origem(r);
    h += DR('Origem do estado', ch(ORIG[o][0], ORIG[o][1]) + ' <span class="evl3-mut">' + { deduzido: 'o produto inferiu', observado: 'um evento ou a apuração confirmou', divergente: 'o evento diz uma coisa e o órgão outra' }[o] + '</span>');
    if (entrada && (on(F.cred) || on(F.base))) {
      var f = fase(r);
      h += DR('Fase', ch(FASE[f][0], FASE[f][1]));
      h += '<div class="mbox-section-label evl3-mt8">Ciclo do crédito · quatro marcos</div>' + marcos(r);
      var e1 = infoNf(e.nf.numero).e112110;
      if (e1) h += '<div class="evl3-nota">A extinção tem evento por trás: <code>112110</code> autorizado em ' + fDH(e1.aut) + ', protocolo ' + esc(e1.protocolo) + '. É declaração do emitente; a confirmação vem na conciliação.</div>';
    }
    if (!entrada) {
      var fl = e.rf.statusFlags || [];
      if (fl.length && window._statusFlagsBadges) h += DR('Flags', window._statusFlagsBadges({ statusFlags: fl, statusRegistro: e.rf.statusRegistro }));
      if (e.rf._evl3Retido) h += '<div class="evl3-nota red">Retido fora da fila do art. 53: a divergência de evento acende a flag <code>inconsistencia</code> e o débito só volta a compensar quando ela se resolve (D-DB-02).</div>';
    }
    if (on(F.base) && Math.abs(r.aplicado) > 0.005) h += '<div class="evl3-nota">O motor do art. 53 compensa sobre o saldo após eventos, ' + money(r.vigente) + ', e não sobre o escriturado.</div>';
    h += listaEventos(r);
    var d = document.createElement('div');
    d.setAttribute('data-evl3-rf', '1');
    d.innerHTML = h;
    box.appendChild(d);
  }

  /* ══ T-06 · PCONT — competência a recalcular ════════════════════════════ */
  var CAUSA = { 'C-1': 'Deslocamento de competência', 'C-2': 'Evento chegou depois do fechamento', 'C-3': 'Confirmação depois do fechamento', 'C-4': 'Reversão depois do fechamento' };
  function alertasAbertos() {
    var l2 = L2(); if (!l2 || !l2._alertas || !l2.on || !l2.on('eventos_alertas')) return [];
    try { return l2._alertas().filter(function (a) { return a.s && a.s.estado !== 'resolvido'; }); } catch (e) { return []; }
  }
  function pcont() {
    var el = document.getElementById('view-pcont'); if (!el) return;
    var velho = el.querySelector('[data-evl3-pc]'); if (velho) velho.remove();
    if (!on(F.pcont)) return;
    var abertos = alertasAbertos(); if (!abertos.length) return;
    var sel = el.querySelector('.pc-car-c.sel'), P = sel ? sel.getAttribute('data-arg') : '';
    var doP = abertos.filter(function (a) { return a.P === P; });
    var outros = []; abertos.forEach(function (a) { if (a.P !== P && outros.indexOf(a.P) < 0) outros.push(a.P); });
    outros.sort();
    var h = '';
    if (doP.length) {
      var imp = { CBS: 0, IBS: 0 };
      doP.forEach(function (a) { ['CBS', 'IBS'].forEach(function (t) { var v = a.val[t]; if (v && v.st === 'pesa') imp[t] += v.v || 0; }); });
      var j = doP[0].j, dias = Math.ceil((j - Date.now()) / DIA);
      var jan = dias >= 0 ? 'janela de ajuste até <b>' + fD(j) + '</b> — ' + pl(dias, 'dia', 'dias') + '; depois vem o aceite tácito (C-20)' : 'a janela de ajuste terminou em ' + fD(j) + ': aceite tácito';
      h += '<div class="evl3-pc' + (dias < 0 ? ' red' : '') + '"><div class="evl3-pc-t">' + pl(doP.length, 'evento mudou', 'eventos mudaram') + ' o saldo de ' + esc(rotP(P)) + ' depois do fechamento</div>'
        + '<div class="evl3-pc-s">Fechada em ' + fD(doP[0].f) + ' (simulado) · ' + jan + '</div>'
        + '<div class="evl3-pc-s">Impacto: <b>CBS ' + sinal(imp.CBS) + '</b> · <b>IBS ' + sinal(imp.IBS) + '</b>. Os dois não se somam. <b>A apuração não foi reaberta</b> (D-14): cada caso é um alerta, e a decisão fica nele.</div>'
        + '<div class="twrap evl3-tw"><table><thead><tr><th>Documento</th><th>Evento</th><th>Causa</th><th class="r">CBS</th><th class="r">IBS</th><th>Alerta</th></tr></thead><tbody>'
        + doP.map(function (a) {
          var c = function (t) { var v = a.val[t]; return !v || v.st === 'na' ? '<span class="evl3-mut">—</span>' : v.st === 'pesa' ? sinal(v.v || 0) : '<span class="evl3-mut">' + (v.st === 'apurado' ? 'já apurado' : 'aguardando') + '</span>'; };
          return '<tr><td class="nowrap"><button class="evl3-lk" onclick="abrirDetalhesNFporNumero(\'' + esc(a.ev.nf) + '\')">' + esc(a.ev.nf) + '</button></td>'
            + '<td class="nowrap"><button class="evl3-lk" onclick="shEvm.detalhe(\'' + a.ev.id + '\')"><code>' + esc(a.ev.cod) + '</code> ' + esc(a.ev.id) + '</button></td>'
            + '<td>' + esc(CAUSA[a.causa] || a.causa) + '</td><td class="r mono">' + c('CBS') + '</td><td class="r mono">' + c('IBS') + '</td>'
            + '<td class="nowrap"><button class="evl3-lk" onclick="shEvmL2.verAlerta(\'' + a.id + '\')">' + esc(a.id) + '</button> <span class="evl3-mut">' + esc(a.vis === 'fora' ? 'fora da janela' : a.s.estado.replace(/_/g, ' ')) + '</span></td></tr>';
        }).join('') + '</tbody></table></div>'
        + '<div class="evl3-pc-b"><button class="btn" onclick="shEvl3.verAlertasDe(\'' + P + '\')">Ver os alertas de ' + esc(rotP(P)) + '</button></div>'
        + '<div class="evl3-sub">O deslocamento de competência pelo 112150 (causa C-1) ainda não é gerado: espera a C-06 e a DV-34.</div></div>';
    }
    if (outros.length) {
      h += '<div class="evl3-pc-o">Alertas de evento em aberto em outras competências: ' + outros.map(function (q) { return '<button class="evl3-lk" onclick="shEvl3.pcIr(\'' + q + '\')">' + esc(rotP(q)) + '</button>'; }).join(' · ') + '</div>';
    }
    if (!h) return;
    var d = document.createElement('div'); d.setAttribute('data-evl3-pc', '1'); d.innerHTML = h;
    var car = el.querySelector('.pc-car');
    if (car && car.parentNode) car.parentNode.insertBefore(d, car.nextSibling); else el.insertBefore(d, el.firstChild);
  }
  // muda o PCONT para a competência pelos próprios botões dele (ano e cartão)
  function pcIr(P) {
    var el = document.getElementById('view-pcont'); if (!el) return;
    var ano = el.querySelector('[data-act="ano"][data-arg="' + P.slice(0, 4) + '"]');
    if (ano && !ano.classList.contains('on')) ano.click();
    var c = el.querySelector('[data-act="comp"][data-arg="' + P + '"]');
    if (c) c.click(); else toast('A competência ' + rotP(P) + ' não está no PCONT desta empresa.');
  }
  function verAlertasDe(P) {
    var l2 = L2(); if (!l2) return;
    var a = alertasAbertos().filter(function (x) { return x.P === P; })[0]; if (!a) return;
    l2.verAlerta(a.id); l2.fecharAl(); l2.alFiltro('p', P);
  }

  /* ══ T-07 · Conciliação — a terceira ponta ══════════════════════════════ */
  var CAUSAS = {
    conciliado: ['conciliado', 'ok'], aguardando: ['aguardando o órgão', 'neu'], montante: ['refletido em montante', 'wait'],
    nao_refletiu: ['Órgão não refletiu', 'div'], outro_valor: ['Órgão refletiu outro valor', 'div'],
    erp_omitiu: ['ERP omitiu evento', 'red'], escrituracao: ['Escrituração errada', 'div']
  };
  var CC = { t: '', c: '' };
  function linhasConc() {
    var x = I(); if (!x) return [];
    try { if (!x.semear()) return []; } catch (e) { return []; }
    var L = [], comEvento = {};
    x.ST.eventos.forEach(function (ev) {
      if (ev.orfao || ev.canceladoPor || !x.movel(ev)) return;
      var nf = nfPorNumero(ev.nf); if (!nf) return;
      comEvento[ev.nf] = 1;
      x.tribsDo(ev).forEach(function (t) {
        var y = ev.trib[t]; if (!y || y.estado === 'cancelada') return;
        var c = y.estado === 'executada' ? 'conciliado' : y.estado === 'nao_atribuivel' ? 'montante'
          : y.estado === 'divergente' ? (Math.abs((y.observado || 0) - (y.antes || 0)) < 0.005 ? 'nao_refletiu' : 'outro_valor') : 'aguardando';
        L.push({ nf: nf, t: t, erp: y.antes || 0, ev: (y.antes || 0) + (y.delta || 0), apur: y.lido ? y.observado : null, c: c, evento: ev });
      });
    });
    x.ST.ausentes.forEach(function (a) {
      var nf = nfPorNumero(a.nf); if (!nf) return;
      comEvento[a.nf] = 1;
      var s = ((x.CAT[a.cod] || {}).sinal || {})[a.lado] || 0;
      a.tribs.forEach(function (t) {
        var rf = x.rfDe(nf, t); if (!rf) return;
        var b = baseDe(rf);
        L.push({ nf: nf, t: t, erp: b, ev: null, apur: b + s * (a.valores[t] || 0), c: 'erp_omitiu', aus: a });
      });
    });
    (window._concListaGlobal || []).forEach(function (r) {
      if (r.capur_status !== 'inconsistencia' || !r.nf || comEvento[r.nf.numero] || !r.valorDF) return;
      var k = r.valorGov / r.valorDF;
      rfsDe(r.nf).forEach(function (rf) {
        var v = Number(rf.valor) || 0;
        L.push({ nf: r.nf, t: T(rf), erp: v, ev: null, apur: Math.round(v * k * 100) / 100, c: 'escrituracao' });
      });
    });
    return L;
  }
  function conc() {
    var box = document.getElementById('conc-evl3'); if (!box) return;
    if (!on(F.conc)) { box.innerHTML = ''; return; }
    var todas = linhasConc(), cont = {};
    todas.forEach(function (l) { cont[l.c] = (cont[l.c] || 0) + 1; });
    var L = todas.filter(function (l) { return (!CC.t || l.t === CC.t) && (!CC.c || l.c === CC.c); });
    var kp = ['conciliado', 'aguardando', 'nao_refletiu', 'outro_valor', 'erp_omitiu', 'escrituracao'].map(function (k) {
      return '<button class="evl3-kp' + (CC.c === k ? ' on' : '') + '" onclick="shEvl3.concFiltro(\'c\',\'' + (CC.c === k ? '' : k) + '\')"><span class="evl3-kp-l">' + esc(CAUSAS[k][0]) + '</span><span class="evl3-kp-v">' + (cont[k] || 0) + '</span></button>';
    }).join('');
    var v = function (n) { return n == null ? '<em class="evl3-mut">sem evento</em>' : money(n); };
    var linha = function (l) {
      var acao = l.evento ? '<button class="evl3-lk" onclick="shEvm.detalhe(\'' + l.evento.id + '\')"><code>' + esc(l.evento.cod) + '</code> ' + esc(l.evento.id) + '</button>'
        : l.aus ? '<button class="evl3-lk" onclick="shEvm.ausencia(\'' + l.aus.id + '\')">ausência ' + esc(l.aus.cod) + '</button>' : '<span class="evl3-mut">—</span>';
      var dif = function (a, b) { return a != null && b != null && Math.abs(a - b) > 0.005; };
      return '<tr' + (CAUSAS[l.c][1] === 'div' || CAUSAS[l.c][1] === 'red' ? ' class="evl3-tr-div"' : '') + '>'
        + '<td class="nowrap"><button class="evl3-lk" onclick="abrirDetalhesNFporNumero(\'' + esc(l.nf.numero) + '\')">' + esc(docRot(l.nf)) + '</button><div class="evl3-sub">' + esc(l.nf.entidade || '') + '</div></td>'
        + '<td><span class="evl3-tr">' + l.t + '</span></td>'
        + '<td class="r mono">' + money(l.erp) + '</td>'
        + '<td class="r mono">' + (dif(l.ev, l.erp) ? '<b>' + v(l.ev) + '</b>' : v(l.ev)) + '</td>'
        + '<td class="r mono">' + (l.apur == null ? '<span class="evl3-mut">não lido</span>' : dif(l.apur, l.erp) && l.ev == null ? '<b>' + money(l.apur) + '</b>' : money(l.apur)) + '</td>'
        + '<td class="nowrap">' + ch(CAUSAS[l.c][0], CAUSAS[l.c][1]) + '</td><td class="nowrap">' + acao + '</td></tr>';
    };
    box.innerHTML = '<div class="sechdr"><h2>Três pontas: ERP, evento e apuração</h2><p>Com o evento no meio, a causa da diferença deixa de ser adivinhação: evento sem reflexo é do órgão ou do prazo; reflexo sem evento é omissão do ERP; nenhum dos dois é escrituração. Uma linha por tributo — CBS na Receita Federal, IBS no Comitê Gestor.</p></div>'
      + '<div class="evl3-kps">' + kp + '</div>'
      + '<div class="evl3-filtros"><label>Tributo <select onchange="shEvl3.concFiltro(\'t\',this.value)">' + [['', 'CBS e IBS'], ['CBS', 'CBS · Receita Federal'], ['IBS', 'IBS · Comitê Gestor']].map(function (o) { return '<option value="' + o[0] + '"' + (CC.t === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>'
      + (CC.t || CC.c ? '<button class="evl3-lk" onclick="shEvl3.concFiltro()">Limpar filtros</button>' : '') + '<span class="evl3-mut">' + pl(L.length, 'linha', 'linhas') + '</span></div>'
      + '<div class="tcrd"><div class="twrap"><table><thead><tr><th>Documento</th><th>Tributo</th><th class="r">1 · ERP</th><th class="r">2 · Evento</th><th class="r">3 · Apuração</th><th>Causa</th><th>Origem</th></tr></thead><tbody>'
      + (L.length ? L.map(linha).join('') : '<tr><td colspan="7" class="evl3-vazio">Nenhuma linha neste filtro.</td></tr>')
      + '</tbody></table></div></div>'
      + (window._concListaGlobal ? '' : '<div class="evl3-sub">A escrituração errada aparece depois que o confronto da apuração carrega: abra o Dashboard ou a Listagem da conciliação.</div>');
  }
  function montarConc() {
    if (!on(F.conc)) return;
    var v = document.getElementById('view-conciliacao'); if (!v || document.getElementById('conc-evl3')) return;
    var bar = v.querySelector('.stabs'), lista = document.getElementById('conc-lista');
    if (!bar || !lista) return;
    bar.insertAdjacentHTML('beforeend', '<button class="stab" id="evl3-conc-tab" onclick="showSub(\'conc\',\'evl3\',this);shEvl3.conc()">Três pontas · eventos</button>');
    lista.insertAdjacentHTML('afterend', '<div id="conc-evl3" class="sv"></div>');
  }

  /* ══ T-09 · Pagamentos — o 112110 e o RAD ═══════════════════════════════ */
  // as funções do RAD sem o embrulho deste pacote
  var RAD = {};
  function pagoRf(rf) { var s = rf.statusCredito || rf.status; return s === 'apropriado' || s === 'utilizado' || !!(rf.dataPagamento && rf.dataPagamento !== '—'); }
  function e112110(nf) { if (!nf || nf.tipo !== 'entrada') return null; return infoNf(nf.numero).e112110; }
  function radAssumido(nf) { return nf.metodoPagamento === 'RAD' && nf.metodoPagamentoOrigem === 'alteracao_manual'; }
  function guiaGerada(nf) { return rfsDe(nf).some(function (rf) { return rf.conversaoRAD && rf.conversaoRAD.guiaGeradaEm; }) || !!(nf.conversaoRAD && nf.conversaoRAD.guiaGeradaEm); }
  // A: antes de assumir · B: guia emitida e não paga · C: guia paga · D: RAD pago e o evento nunca vem (nada a fazer)
  function cenario(nf) {
    var ev = e112110(nf); if (!ev) return null;
    if (!radAssumido(nf)) return { k: 'A', ev: ev };
    if (rfsDe(nf).some(pagoRf)) return { k: 'C', ev: ev };
    if (guiaGerada(nf)) return { k: 'B', ev: ev };
    return { k: 'A2', ev: ev };   // assumido, guia ainda não gerada: a devolução segue aberta
  }
  function txtEvento(ev) { return 'Evento 112110 autorizado em ' + fDH(ev.aut) + ', protocolo ' + ev.protocolo; }
  function caixa(cls, titulo, corpo) { return '<div class="evl3-rad ' + cls + '"><div class="evl3-rad-t">' + titulo + '</div><div>' + corpo + '</div></div>'; }
  function ganchosRAD() {
    if (typeof window.shRADElegibilidade === 'function' && !window.shRADElegibilidade._evl3) {
      RAD.eleg = window.shRADElegibilidade;
      window.shRADElegibilidade = function (nf, st) {
        var R = RAD.eleg.apply(this, arguments);
        try {
          if (!on(F.rad) || !R || !R.visivel || R.reverter || !R.ok) return R;
          var c = cenario(nf); if (!c || c.k !== 'A') return R;
          if (nf._evl3Exc) { R.avisos = (R.avisos || []).concat(['O fornecedor informou o pagamento integral (' + txtEvento(c.ev) + '). O recolhimento é assumido por exceção, registrada por ' + nf._evl3Exc.por + ': ' + nf._evl3Exc.just]); return R; }
          R.ok = false; R._evl3 = c.ev;
          R.motivo = 'O fornecedor já recolheu: ' + txtEvento(c.ev) + '. Assumir o RAD agora é recolher em duplicidade.';
        } catch (e) { console.error('[eventos lote 3] RAD', e); }
        return R;
      };
      window.shRADElegibilidade._evl3 = true;
    }
    if (typeof window.shRADCelulaAcao === 'function' && !window.shRADCelulaAcao._evl3) {
      RAD.cel = window.shRADCelulaAcao;
      window.shRADCelulaAcao = function (nf, st) {
        try {
          if (on(F.rad)) {
            var el = window.shRADElegibilidade(nf, st);
            if (el && el._evl3) return '<button class="evl3-rad-bt" onclick="event.stopPropagation();shEvl3.radBloqueio(\'' + esc(nf.numero) + '\')" title="' + esc(el.motivo) + '">Assumir RAD · bloqueado</button>';
            var c = cenario(nf);
            if (c && c.k === 'B') return '<button class="evl3-rad-bt" onclick="event.stopPropagation();abrirDetalhesNFporNumero(\'' + esc(nf.numero) + '\')">Cobrança suspensa</button>';
            if (c && c.k === 'C') return '<button class="evl3-rad-bt" onclick="event.stopPropagation();abrirDetalhesNFporNumero(\'' + esc(nf.numero) + '\')">Duplicidade</button>';
          }
        } catch (e) { console.error('[eventos lote 3] RAD', e); }
        return RAD.cel.apply(this, arguments);
      };
      window.shRADCelulaAcao._evl3 = true;
    }
    if (typeof window.shRADBotaoDetalhe === 'function' && !window.shRADBotaoDetalhe._evl3) {
      RAD.bot = window.shRADBotaoDetalhe;
      window.shRADBotaoDetalhe = function (nf) {
        try {
          if (on(F.rad)) {
            var el = window.shRADElegibilidade(nf);
            if (el && el._evl3) return '<button class="evl3-rad-bt" onclick="event.stopPropagation();shEvl3.radBloqueio(\'' + esc(nf.numero) + '\')">Assumir RAD · bloqueado</button>';
          }
        } catch (e) { console.error('[eventos lote 3] RAD', e); }
        return RAD.bot.apply(this, arguments);
      };
      window.shRADBotaoDetalhe._evl3 = true;
    }
    if (typeof window.shRADBlocoMetodo === 'function' && !window.shRADBlocoMetodo._evl3) {
      RAD.bloco = window.shRADBlocoMetodo;
      window.shRADBlocoMetodo = function (o) {
        var h = RAD.bloco.apply(this, arguments);
        try { if (on(F.rad) && o && o.registrosFiscais) h = blocoRAD(o) + h; } catch (e) { console.error('[eventos lote 3] RAD', e); }
        return h;
      };
      window.shRADBlocoMetodo._evl3 = true;
    }
  }
  function blocoRAD(nf) {
    var c = cenario(nf); if (!c) return '';
    var n = esc(nf.numero), ver = '<button class="btn" onclick="shEvm.detalhe(\'' + c.ev.id + '\')">Ver evento</button>';
    if (c.k === 'A') {
      var el = window.shRADElegibilidade(nf);
      if (!el || !el._evl3) return nf._evl3Exc ? caixa('amber', 'Assumido por exceção ao 112110', 'O fornecedor informou o pagamento integral (' + esc(txtEvento(c.ev)) + '). Exceção registrada por ' + esc(nf._evl3Exc.por) + ' em ' + fDH(nf._evl3Exc.em) + ': <em>' + esc(nf._evl3Exc.just) + '</em>') : '';
      return caixa('red', 'O fornecedor já recolheu', esc(txtEvento(c.ev)) + '. Assumir o RAD agora significa <b>recolher em duplicidade</b>.'
        + '<div class="evl3-rad-b"><button class="btn" onclick="shEvl3.radBloqueio(\'' + n + '\')">Assumir RAD · bloqueado</button>' + ver + '<button class="btn" onclick="shEvl3.radReportar(\'' + n + '\')">Reportar divergência</button></div>');
    }
    if (c.k === 'B') return caixa('red', 'Cobrança suspensa', 'O fornecedor informou o pagamento integral depois de a guia ser emitida (' + esc(txtEvento(c.ev)) + '). A guia não deve ser paga: cancele-a, e o recolhimento volta ao fornecedor.'
      + '<div class="evl3-rad-b"><button class="btn btn-t" onclick="shEvl3.radCancelarGuia(\'' + n + '\')">Cancelar a guia</button>' + ver + '</div>');
    if (c.k === 'C') return caixa('red', 'Pagamento em duplicidade', 'A guia do RAD foi paga e o fornecedor também informou o pagamento integral (' + esc(txtEvento(c.ev)) + '). O caminho é <b>restituição ou compensação</b>. A ocorrência é a INC-PAG-10 do catálogo, que o produto ainda não abre.'
      + '<div class="evl3-rad-b">' + ver + '</div>');
    if (c.k === 'A2') return caixa('amber', 'O fornecedor informou o pagamento integral', esc(txtEvento(c.ev)) + '. A guia ainda não foi gerada: devolva o recolhimento ao fornecedor para não pagar duas vezes.');
    return '';
  }
  function overlay(id, largura, titulo, sub, corpo) {
    var x = I(); if (!x) return;
    x.overlay(id, largura, x.cab(id, titulo, '', esc(sub)) + '<div class="evm-corpo">' + corpo + '</div>');
  }
  function radBloqueio(n) {
    var nf = nfPorNumero(n), c = nf && cenario(nf); if (!c) return;
    var ev = c.ev;
    overlay('evl3-rad', 560, 'Assumir recolhimento · bloqueado', docRot(nf) + ' · ' + (nf.entidade || '—'),
      caixa('red', 'O fornecedor já recolheu', 'Evento <code>112110</code> autorizado em <b>' + fDH(ev.aut) + '</b>, protocolo ' + esc(ev.protocolo) + '. Assumir o RAD agora significa <b>recolher em duplicidade</b>.')
      + '<p class="evl3-p">O bloqueio vale na captura do evento, sem esperar o órgão: esperar custa dinheiro, e o bloqueio não muda saldo, só suspende o processo. O 112110 é declaração do emitente; se ela estiver errada, reporte a divergência.</p>'
      + '<div class="evl3-rad-b"><button class="btn" onclick="document.getElementById(\'evl3-rad\').remove();shEvm.detalhe(\'' + ev.id + '\')">Ver evento</button><button class="btn" onclick="shEvl3.radReportar(\'' + esc(nf.numero) + '\')">Reportar divergência</button></div>'
      + '<div class="mbox-divider"></div><div class="mbox-section-label">Assumir mesmo assim · exceção registrada</div>'
      + '<label class="evl3-ck"><input type="checkbox" id="evl3-rad-ciente" onchange="shEvl3.radValidar()"> Sei que o fornecedor informou o pagamento integral e que posso pagar o tributo duas vezes.</label>'
      + '<textarea id="evl3-rad-just" rows="3" class="evl3-ta" placeholder="Por que assumir o recolhimento mesmo com o 112110 (mínimo 20 caracteres)" oninput="shEvl3.radValidar()"></textarea>'
      + '<div class="evl3-rad-f"><span id="evl3-rad-st" class="evl3-mut" role="status" aria-live="polite"></span><button class="btn" onclick="document.getElementById(\'evl3-rad\').remove()">Fechar</button><button class="btn btn-t" onclick="shEvl3.radExcecao(\'' + esc(nf.numero) + '\')">Assumir mesmo assim</button></div>'
      + '<div class="evl3-sub">Recomendação da D-16, ainda sem decisão (DV-29): bloquear, com exceção justificada e registrada.</div>');
    radValidar();
  }
  function radValidar() {
    var ck = document.getElementById('evl3-rad-ciente'), ta = document.getElementById('evl3-rad-just'), st = document.getElementById('evl3-rad-st');
    var n = ta ? ta.value.trim().length : 0, falta = [];
    if (!ck || !ck.checked) falta.push('ciência da duplicidade');
    if (n < 20) falta.push('justificativa (' + n + ' de 20 caracteres)');
    if (st) st.textContent = falta.length ? 'Falta: ' + falta.join(' · ') : 'Tudo preenchido';
    return !falta.length;
  }
  function radExcecao(n) {
    if (!radValidar()) return;
    var just = document.getElementById('evl3-rad-just').value.trim(), x = I();
    var exc = { por: usuario(), em: Date.now(), just: just };
    (x ? x.nfs() : []).forEach(function (nf) { if (String(nf.numero) === String(n)) nf._evl3Exc = exc; });
    var nf = nfPorNumero(n), c = nf && cenario(nf);
    if (c) (c.ev.marcas = c.ev.marcas || []).push({ em: exc.em, txt: 'Recolhimento assumido por exceção ao 112110, por ' + exc.por + ': ' + just });
    fechar('evl3-rad');
    if (typeof window.shRADAbrirAssumir === 'function') window.shRADAbrirAssumir(n);
  }
  function radReportar(n) {
    var nf = nfPorNumero(n), c = nf && cenario(nf); if (!c) return;
    c.ev.revisao = true;
    (c.ev.marcas = c.ev.marcas || []).push({ em: Date.now(), txt: 'Divergência reportada por ' + usuario() + ': o pagamento integral informado pelo fornecedor está em dúvida' });
    fechar('evl3-rad');
    toast('112110 da ' + docRot(nf) + ' marcado para revisão com o fornecedor. O bloqueio segue até a revisão.');
  }
  function radCancelarGuia(n) {
    var x = I(), agora = new Date().toISOString(), quem = usuario(), feito = 0;
    (x ? x.nfs() : []).forEach(function (nf) {
      if (String(nf.numero) !== String(n)) return;
      [nf].concat(nf.registrosFiscais || []).forEach(function (o) {
        var c = o.conversaoRAD; if (!c || !c.guiaGeradaEm) return;
        c.guiaCanceladaEm = agora; c.guiaCanceladaPor = quem; c.guiaCanceladaMotivo = '112110'; c.guiaGeradaEm = null; feito++;
      });
    });
    if (!feito) { toast('Não há guia emitida neste documento.'); return; }
    toast('Guia cancelada: o fornecedor informou o pagamento integral. O recolhimento pode voltar ao fornecedor.');
    ['nf-detalhe-overlay'].forEach(fechar);
    if (typeof window.shRADAbrirReverter === 'function') window.shRADAbrirReverter(n);
  }
  // um exemplo do cenário A: 112110 num documento que ainda pode ter o recolhimento assumido
  function exemploRAD() {
    var x = I(); if (!x || !on(F.rad) || !RAD.eleg || !x.ST.ok || x.ST.eventos.some(function (e) { return e.evl3; })) return;
    var usados = {}; x.ST.eventos.forEach(function (e) { usados[e.nf] = 1; }); x.ST.ausentes.forEach(function (a) { usados[a.nf] = 1; });
    var cand = x.nfs().filter(function (nf) {
      if (nf.tipo !== 'entrada' || usados[nf.numero] || !x.rfDe(nf, 'CBS') || !x.rfDe(nf, 'IBS')) return false;
      try { var el = RAD.eleg(nf); return el && el.visivel && el.ok && !el.reverter; } catch (e) { return false; }
    });
    if (!cand.length) return;
    var nf = cand[x.hash('evl3-rad') % cand.length], agora = Date.now(), aut = agora - 2 * DIA - 3 * HORA;
    var ev = {
      id: 'EV-' + ('000000' + (++x.ST.seq)).slice(-6), cod: '112110', lado: 'entrada', canal: 'API', nf: nf.numero, entidade: nf.entidade, cnpj: nf.cnpj, cnpjEmpresa: nf.cnpjComprador,
      chave: nf.chaveDF, competenciaDoc: x.comp(nf.data + 'T12:00:00'), compIso: String(nf.data).slice(0, 7), aut: aut, capt: aut + 6 * MIN, plan: aut + 7 * MIN,
      protocolo: '1412' + '6' + String(100000000 + x.hash(nf.numero) % 899999999).slice(0, 9) + '07', seq: 1, revisao: false, canceladoPor: null, cancela: null, trib: {}, evl3: true
    };
    x.TRIBS.forEach(function (t) { var rf = x.rfDe(nf, t); ev.trib[t] = { rf: rf.id, antes: Number(rf.valor) || 0, delta: 0, estado: 'executada', lido: null, observado: null, exec: aut }; });
    x.ST.eventos.push(ev);
    x.ST.eventos.sort(function (a, b) { return b.capt - a.capt; });
    invalidar();
  }

  /* ══ Ganchos ════════════════════════════════════════════════════════════ */
  function embrulhar(nome, depois) {
    var f = window[nome]; if (typeof f !== 'function' || f._evl3) return;
    window[nome] = function () {
      var r = f.apply(this, arguments);
      try { depois.apply(this, arguments); } catch (e) { console.error('[eventos lote 3] ' + nome, e); }
      return r;
    };
    window[nome]._evl3 = true;
  }
  function ganchos() {
    ganchoMotor();
    embrulhar('creditosDFsRender', credDFs);
    embrulhar('debitosDFsRender', debDFs);
    embrulhar('abrirDetalheRF', painelRF);
    var P = window.shPcont;
    if (P && typeof P.render === 'function' && !P.render._evl3) {
      var pr = P.render;
      P.render = function () { var r = pr.apply(this, arguments); try { pcont(); } catch (e) { console.error('[eventos lote 3] PCONT', e); } return r; };
      P.render._evl3 = true;
    }
    var E = window.shEvm;
    if (E) ['lerReceita', 'arquivoComite', 'impEnviar'].forEach(function (k) {
      if (typeof E[k] !== 'function' || E[k]._evl3) return;
      var o = E[k];
      E[k] = function () { var r = o.apply(this, arguments); try { atualizar(); } catch (e) { console.error('[eventos lote 3] ' + k, e); } return r; };
      E[k]._evl3 = true;
    });
    ganchosRAD();
    montarConc();
    completarEmpresa();
    exemploRAD();
  }
  // a view do PCONT é redesenhada por cliques internos: o aviso volta depois de cada um
  document.addEventListener('click', function (e) {
    var v = document.getElementById('view-pcont');
    if (v && e.target && v.contains(e.target) && on(F.pcont)) setTimeout(function () { try { if (!v.querySelector('[data-evl3-pc]')) pcont(); } catch (er) {} }, 0);
  }, true);

  window.shEvl3 = {
    on: on, modelo: modelo, aplicarBase: aplicarBase, atualizar: atualizar,
    conc: conc, concFiltro: function (k, v) { if (!k) CC = { t: '', c: '' }; else CC[k] = v || ''; conc(); },
    pcont: pcont, pcIr: pcIr, verAlertasDe: verAlertasDe,
    radBloqueio: radBloqueio, radValidar: radValidar, radExcecao: radExcecao, radReportar: radReportar, radCancelarGuia: radCancelarGuia
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(ganchos, 500); });
  else setTimeout(ganchos, 500);
  window.addEventListener('load', function () { setTimeout(ganchos, 1100); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fechar('evl3-rad'); });
})();

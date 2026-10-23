/* ═══════════════════════════════════════════════════════════════════════════
   Modelo de glosa do crédito — proposta src/docs/proposta-glosa.html (v1.0)

   A glosa deixa de ser uma fatia sorteada do gerador da base e passa a ser
   consequência de uma causa: cada uma diz quem glosou, com que fundamento,
   que evidência sustenta, até quando cabe defesa e em que pé está o
   contencioso. O órgão segue a regra da plataforma — CBS na Receita Federal,
   pela apuração assistida; IBS no Comitê Gestor.

   Na base simulada ficam três glosas, uma por causa, em documentos que já
   carregam a divergência que as justifica, e nenhuma em Split Payment. Cada
   uma atinge um tributo só: o irmão do mesmo documento segue no fluxo, que é
   o caso que mostra os dois órgãos verificando em separado.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var G = window.shGlosa = window.shGlosa || {};

  /* ── catálogo de causas ──────────────────────────────────────────────── */
  G.CAUSAS = {
    'G-01': { nome: 'Alíquota divergente', curto: 'Alíquota divergente',
      desc: 'o tributo destacado no documento não corresponde ao apurado pelo Fisco',
      base: 'LC 214/2025, art. 47 c/c art. 48', recuperavel: 'Sim, com correção do documento ou impugnação' },
    'G-02': { nome: 'Base de cálculo divergente', curto: 'Base divergente',
      desc: 'a base de cálculo declarada difere da apurada pelo Fisco',
      base: 'LC 214/2025, art. 47 c/c art. 48', recuperavel: 'Sim, com correção do documento ou impugnação' },
    'G-03': { nome: 'Crédito sem recolhimento do fornecedor', curto: 'Sem recolhimento',
      desc: 'o débito correspondente não foi extinto pelo emitente',
      base: 'LC 214/2025, art. 47 — o crédito depende da extinção do débito', recuperavel: 'Sim, se o recolhimento vier depois' },
    'G-04': { nome: 'Documento inválido', curto: 'Documento inválido',
      desc: 'chave rejeitada, documento cancelado ou denegado',
      base: 'documento sem validade não sustenta crédito', recuperavel: 'Só com reemissão do documento' },
    'G-05': { nome: 'Operação sem direito a crédito', curto: 'Sem direito a crédito',
      desc: 'uso e consumo pessoal e demais vedações',
      base: 'vedações ao crédito da LC 214/2025', recuperavel: 'Não' }
  };
  G.ORGAO = { IBS: 'Comitê Gestor do IBS', CBS: 'Receita Federal' };
  G.PELO = { IBS: 'pelo Comitê Gestor do IBS', CBS: 'pela Receita Federal' };
  G.PRAZO_DIAS = 30;                       // D-GL-01 · prazo de impugnação
  G.STATUS_LBL = { aberta: 'Aberta', impugnada: 'Impugnada', mantida: 'Mantida', revertida: 'Revertida', definitiva: 'Definitiva' };

  /* As três ocorrências da base simulada. O documento e o tributo são fixos;
     o estado do contencioso segue a cronologia de cada uma. */
  var SPEC = [
    { df: '000022', trib: 'cbs', causa: 'G-02', estado: 'definitiva', por: 'Maria Costa' },
    { df: '000014', trib: 'ibs', causa: 'G-01', estado: 'impugnada', por: 'Ana Ferreira' },
    { df: '000049', trib: 'ibs', causa: 'G-03', estado: 'aberta', por: 'Ana Ferreira' }
  ];

  /* ── datas ───────────────────────────────────────────────────────────── */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function addDias(iso, n) {
    var p = String(iso).slice(0, 10).split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2] + n);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function br(iso) { var p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; }
  function money(v) { return 'R$ ' + (Math.round((v || 0) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function T_(rf) { return String(rf.tipoFiscal || '').toUpperCase(); }

  /* ── aplicação na base ───────────────────────────────────────────────── */
  G.fichas = [];
  G.aplicarNaBase = function () {
    var L = window._nfListaCompleta || window.nfListaFiltradaGlobal || [];
    if (!L.length) return;
    if (G._nf0 === L[0] && G._n === L.length) return;
    G._nf0 = L[0]; G._n = L.length; G.fichas = [];
    var seq = 0;
    SPEC.forEach(function (sp) {
      var nf = null;
      for (var i = 0; i < L.length; i++) { if (L[i].tipo === 'entrada' && String(L[i].numero) === sp.df) { nf = L[i]; break; } }
      if (!nf) return;
      var rf = (nf.registrosFiscais || []).filter(function (x) { return String(x.tipoFiscal).toLowerCase() === sp.trib; })[0];
      if (!rf) return;
      var T = T_(rf), causa = G.CAUSAS[sp.causa];
      var evid = (rf._concRegApur || nf._concRegApur || {});
      // a ciência vem depois da conciliação que apontou a divergência
      var ciencia = addDias(String(evid.concTs || nf.data).slice(0, 10), 15);
      var prazo = addDias(ciencia, G.PRAZO_DIAS);
      var ficha = {
        id: 'GL-2026-' + pad(++seq) + '0'.slice(0, 0) + '', rfId: rf.id, dfNumero: nf.numero,
        doc: (nf.tipoDF || 'NF-e') + ' ' + nf.numero, fornecedor: nf.entidade || '—', cnpj: nf.cnpj || '—',
        tributo: T, valor: rf.valor || 0, causa: sp.causa, causaNome: causa.nome, causaDesc: causa.desc,
        baseLegal: causa.base, recuperavel: causa.recuperavel, orgao: G.ORGAO[T],
        evidencia: evid.concId || null, evidenciaTipo: 'Conciliação de apuração',
        cienciaEm: ciencia, prazoImpugnacao: prazo, status: sp.estado, responsavel: sp.por,
        dataEmissao: nf.data,
        // T-04: a ficha leva o valor negado e a parcela de onde ele saiu
        valorApurado: rf.valor || 0, origem: 'pending', destino: 'not_appropriable', item: null, parcial: false
      };
      ficha.id = 'GL-2026-' + pad(seq);
      if (sp.estado === 'impugnada') {
        ficha.impugnadaEm = addDias(ciencia, 12);
        ficha.processo = 'PA-2026-' + pad(300 + seq * 7);
      }
      if (sp.estado === 'definitiva') ficha.definitivaEm = addDias(prazo, 1);
      // o crédito é negado: não se apropria e não entra em saldo nenhum
      rf.statusCredito = 'glosado'; rf.status = 'glosado';
      rf.metodoExtincao = null; rf.dataExtincaoCredito = null; rf.dataApropriacao = null;
      rf.dataPrevExtincao = null;
      // sem recolhimento do fornecedor não há registro de pagamento
      if (sp.causa === 'G-03') rf.dataPagamento = null;
      rf.motivo = causa.nome;
      rf.glosa = ficha;
      G.fichas.push(ficha);
    });
    // o DF acompanha: com um tributo glosado, o documento deixa de estar íntegro
    G.fichas.forEach(function (f) {
      var nf = null;
      for (var i = 0; i < L.length; i++) { if (String(L[i].numero) === f.dfNumero && L[i].tipo === 'entrada') { nf = L[i]; break; } }
      if (nf) nf._temGlosa = true;
    });
  };

  G.ficha = function (rfId) {
    for (var i = 0; i < G.fichas.length; i++) if (G.fichas[i].rfId === rfId) return G.fichas[i];
    return null;
  };
  G.total = function () { return G.fichas.reduce(function (a, f) { return a + (f.status === 'revertida' ? 0 : f.valor); }, 0); };

  /* ── glosa de parte do crédito (D-PAR-02, T-04) ──────────────────────────
     A ficha nasce do movimento que o órgão informou e leva só a fatia negada;
     o resto do crédito segue no fluxo, com as próprias datas e prazos. Chamada
     pela partição (js/parcialidade.js) ao montar o RF. Revertida, a glosa
     devolve o valor à parcela de onde saiu (D-PAR-13). */
  var ESTADOS_PARCIAL = ['aberta', 'impugnada', 'revertida'];
  G.registrarParcial = function (rf, nf, m) {
    var f = G.ficha(rf.id); if (f) return f;
    var T = T_(rf), seq = G.fichas.length + 1, causa = G.CAUSAS['G-01'];
    var h = 0, s = String(rf.id);
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    var estado = ESTADOS_PARCIAL[Math.abs(h) % ESTADOS_PARCIAL.length];
    var evid = rf._concRegApur || nf._concRegApur || {};
    f = {
      id: 'GL-2026-' + pad(seq), rfId: rf.id, dfNumero: nf.numero, doc: (nf.tipoDF || 'NF-e') + ' ' + nf.numero,
      fornecedor: nf.entidade || '—', cnpj: nf.cnpj || '—', tributo: T, valor: m.valor, valorApurado: rf.valor || 0,
      origem: m.de, destino: m.para, item: null, parcial: m.valor < (rf.valor || 0) - 0.005,
      causa: 'G-01', causaNome: causa.nome, causaDesc: 'o tributo destacado excede, nesta parte, o apurado pelo órgão',
      baseLegal: causa.base, recuperavel: causa.recuperavel, orgao: G.ORGAO[T],
      evidencia: evid.concId || null, evidenciaTipo: 'Conciliação de apuração',
      cienciaEm: m.reconhecidoEm, prazoImpugnacao: addDias(m.reconhecidoEm, G.PRAZO_DIAS),
      status: estado, responsavel: 'Ana Ferreira', dataEmissao: nf.data
    };
    if (estado !== 'aberta') { f.impugnadaEm = addDias(f.cienciaEm, 10); f.processo = 'PA-2026-' + pad(300 + seq * 7); }
    if (estado === 'revertida') f.decisaoEm = addDias(f.cienciaEm, 28);
    G.fichas.push(f);
    return f;
  };
  var PARC_ROT = { pending: 'A apropriar', available: 'Disponível', not_appropriable: 'Inapropriável', not_usable: 'Inutilizável' };
  function trajeto(f) { return (PARC_ROT[f.origem] || f.origem || '—') + ' → ' + (PARC_ROT[f.destino] || f.destino || '—'); }

  /* ── histórico do RF: glosa, impugnação e desfecho ───────────────────── */
  G.historicoRF = function (rf) {
    var f = G.ficha(rf && rf.id); if (!f) return [];
    var F = window._rfFmtTS || function (x) { return x; };
    function ev(ts, tipo, ator, desc, cls) { return { ts: ts, data: F(ts), tipo: tipo, modulo: 'Créditos', ator: ator, desc: desc, cls: cls }; }
    var out = [ev(f.cienciaEm + 'T10:45', 'GLOSA', f.orgao,
      'Crédito de ' + money(f.valor) + (f.parcial ? ' de ' + money(f.valorApurado) : '') + ' de ' + f.tributo + ' glosado ' + G.PELO[f.tributo]
      + ' · ' + trajeto(f) + ' · causa: ' + f.causaNome.toLowerCase()
      + ' — ' + f.causaDesc + ' · fundamento: ' + f.baseLegal
      + (f.evidencia ? ' · evidência: ' + f.evidencia : '')
      + (f.parcial ? ' · só a fatia glosada sai do fluxo; ' + money(f.valorApurado - f.valor) + ' seguem com as datas e os prazos de antes'
                   : ' · o crédito sai do saldo compensável e não pode ser ressarcido')
      + ' · impugnação até ' + br(f.prazoImpugnacao) + ' (' + G.PRAZO_DIAS + ' dias da ciência)', 'erro')];
    if (f.impugnadaEm) out.push(ev(f.impugnadaEm + 'T15:20', 'IMPUGNAÇÃO', f.responsavel,
      'Impugnação da glosa ' + f.id + ' protocolada · processo ' + f.processo + ' · ' + money(f.valor)
      + ' em discussão · o crédito segue bloqueado até a decisão', 'pending'));
    if (f.decisaoEm) out.push(ev(f.decisaoEm + 'T11:00', 'GLOSA REVERTIDA', f.orgao,
      'Glosa ' + f.id + ' revertida por decisão no processo ' + f.processo + ' · ' + money(f.valor)
      + ' voltam para ' + (PARC_ROT[f.origem] || f.origem) + ', a parcela de onde saíram · o prazo do art. 54 segue a apropriação original (D-PAR-13)', 'ok'));
    if (f.definitivaEm) out.push(ev(f.definitivaEm + 'T08:00', 'GLOSA DEFINITIVA', 'SplitHub',
      'Prazo de impugnação encerrado em ' + br(f.prazoImpugnacao) + ' sem defesa · perda definitiva de '
      + money(f.valor) + ' de ' + f.tributo, 'erro'));
    return out;
  };

  /* ── fila de trabalho: a glosa vira ocorrência de inconsistência ─────── */
  G.inconsistencias = function (inc) {
    if (!inc || !G.fichas.length) return;
    G.fichas.forEach(function (f) {
      if (f.status === 'revertida') return;   // decidida a favor: não há o que tratar
      inc.push({
        id: 'INC-' + String(inc.length + 1).padStart(4, '0'), familia: 'glosa',
        tipo: f.parcial ? 'glosa_parcial' : 'glosa_credito', tipoLabel: (f.parcial ? 'Glosa parcial · ' : 'Glosa · ') + G.CAUSAS[f.causa].curto,
        dfId: f.dfNumero, dfNum: f.doc, nfNumero: f.dfNumero, rfId: f.rfId, tipoFiscal: f.tributo,
        origem: 'apuracao', tipoFluxo: 'entrada',
        status: f.status === 'aberta' ? 'aberta' : f.status === 'impugnada' ? 'em_analise' : 'glosada',
        prioridade: 'alta', valor: f.valor, valorTotal: f.valor, valorLiq: f.valor,
        entidade: f.fornecedor, cnpj: f.cnpj, dataISO: f.cienciaEm, data: br(f.cienciaEm),
        statusCredito: f.parcial ? 'parcialmente glosado' : 'glosado', metodoExtincao: null,
        prazo: f.prazoImpugnacao, responsavel: f.responsavel
      });
    });
  };

  /* ── telas: coluna na listagem e ficha no detalhe do RF ──────────────── */
  var COL = { key: 'glosaCausa', label: 'Glosa', tip: 'Causa da glosa, com o órgão que negou o crédito e o estado do contencioso. Vazio significa crédito sem glosa.' };
  function colunas() {
    var T = window.SH_TABLES || {};
    if (T.creditos && !T.creditos._glosa) { T.creditos.cols = T.creditos.cols.concat([COL]); T.creditos._glosa = 1; }
  }
  function celula(rf) {
    var f = G.ficha(rf.id);
    if (!f) return '<span style="color:var(--txt3)">—</span>';
    var cor = f.status === 'revertida' ? 'var(--teal)' : f.status === 'impugnada' ? 'var(--amber)' : 'var(--red)';
    return '<div style="line-height:1.45" title="' + esc(f.causaNome + ' · ' + f.baseLegal + ' · ' + f.orgao) + '">'
      + '<span style="font-size:11px;font-weight:600;color:' + cor + '">' + esc(G.CAUSAS[f.causa].curto) + '</span>'
      + (f.parcial ? '<br><span style="font-size:10px;color:var(--txt2)">' + money(f.valor) + ' de ' + money(f.valorApurado) + '</span>' : '')
      + '<br><span style="font-size:9px;font-weight:700;letter-spacing:.06em;color:' + cor + '">' + esc((G.STATUS_LBL[f.status] || f.status).toUpperCase()) + '</span>'
      + '</div>';
  }
  function pintarLinhas() {
    var tb = document.getElementById('t-creditos'); if (!tb) return;
    Array.prototype.forEach.call(tb.querySelectorAll('tr'), function (tr) {
      if (tr.getAttribute('data-gl') === '1' || tr.cells.length < 4) return;
      var id = String(tr.cells[0].textContent || '').trim();
      var e = (window._rfIndex || {})[id]; if (!e) return;
      var c = tr.insertCell(-1); c.innerHTML = celula(e.rf);
      tr.setAttribute('data-gl', '1');
    });
  }
  // Ficha de glosa no detalhe do RF (T-04): valor glosado de quanto, parcela de
  // origem e destino, item, decisão, o que segue no fluxo e o contencioso
  function painelRF() {
    var box = document.querySelector('#rf-detalhe-overlay .mbox-col'); if (!box) return;
    if (box.querySelector('[data-glosa-ficha]')) return;
    var tit = document.querySelector('#rf-detalhe-overlay .mbox-title');
    var id = tit ? String(tit.textContent || '').split('·').pop().trim() : '';
    var f = G.ficha(id); if (!f) return;
    var DR = window._rfDetailRow;
    var cor = f.status === 'revertida' ? 'var(--p-teal)' : f.status === 'impugnada' ? 'var(--p-amber)' : 'var(--p-red)';
    var segue = (f.valorApurado || f.valor) - f.valor;
    var d = document.createElement('div');
    d.setAttribute('data-glosa-ficha', '1');
    d.innerHTML = '<div class="mbox-divider"></div>'
      + '<div class="mbox-section-label">Ficha de glosa · ' + esc(f.id) + '</div>'
      + DR('Valor glosado', money(f.valor) + (f.parcial ? ' <span style="color:var(--txt2)">de ' + money(f.valorApurado) + '</span>' : ''), 'var(--p-red)')
      + DR('Parcela de origem', esc(trajeto(f)))
      + DR('Item', '— <span style="color:var(--txt2)">(sem segmentação na primeira versão)</span>')
      + DR('Decisão', esc(f.orgao) + ' · ' + br(f.cienciaEm))
      + DR('O que segue', segue > 0.005 ? money(segue) + ' no fluxo, com as datas e os prazos de antes' : 'Nada: todo o apurado foi glosado')
      + DR('Causa', '<span style="color:' + cor + ';font-weight:700">' + esc(f.causaNome) + '</span> · ' + esc(f.baseLegal))
      + (f.evidencia ? DR('Evidência', esc(f.evidenciaTipo) + ' · ' + esc(f.evidencia), null, true) : '')
      + DR('Prazo para contestar', br(f.prazoImpugnacao))
      + DR('Situação', '<span style="color:' + cor + ';font-weight:700">' + esc(G.STATUS_LBL[f.status] || f.status) + '</span>'
          + (f.processo ? ' · processo ' + esc(f.processo) : '') + (f.decisaoEm ? ' · revertida em ' + br(f.decisaoEm) : '') + (f.definitivaEm ? ' · definitiva em ' + br(f.definitivaEm) : ''))
      + DR('Responsável', esc(f.responsavel))
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 8px">'
      + (f.status === 'aberta' ? '<button class="pp-btn" onclick="window.shGlosa.abrirContencioso(\'' + esc(f.rfId) + '\')">Abrir contencioso desta glosa</button>' : '')
      + '<button class="pp-btn" onclick="var b=document.querySelector(\'#rf-detalhe-overlay [data-g=aba][data-v=mov]\');if(b)b.click()">Ver movimentos</button></div>'
      + '<div class="mbox-info-box"><span class="mbox-info-box-label">O que a glosa faz com o crédito</span>'
      + '<span style="color:var(--txt2)">Só a fatia glosada sai do fluxo: vai para inapropriável, se a glosa veio antes da apropriação, ou para inutilizável, se veio depois. '
      + 'Revertida, volta à parcela de onde saiu, e o prazo do art. 54 segue a apropriação original (D-PAR-13).</span></div>';
    box.appendChild(d);
  }
  // abre o contencioso da fatia glosada (simulação: vale até recarregar a página)
  G.abrirContencioso = function (rfId) {
    var f = G.ficha(rfId); if (!f || f.status !== 'aberta') return;
    var d = new Date(), z = function (n) { return n < 10 ? '0' + n : '' + n; };
    f.status = 'impugnada';
    f.impugnadaEm = d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
    f.processo = 'PA-2026-' + pad(300 + G.fichas.indexOf(f) * 7 + 7);
    var o = document.getElementById('rf-detalhe-overlay'); if (o) o.remove();
    if (window.abrirDetalheRF) window.abrirDetalheRF(rfId);
  };

  function ganchos() {
    if (typeof window.renderizarTabelaCreditos === 'function' && !window.renderizarTabelaCreditos._gl) {
      var rc = window.renderizarTabelaCreditos;
      window.renderizarTabelaCreditos = function () {
        var r = rc.apply(this, arguments);
        try { pintarLinhas(); } catch (e) { console.error('[glosa] listagem', e); }
        return r;
      };
      window.renderizarTabelaCreditos._gl = true;
    }
    if (typeof window.abrirDetalheRF === 'function' && !window.abrirDetalheRF._gl) {
      var ad = window.abrirDetalheRF;
      window.abrirDetalheRF = function () {
        var r = ad.apply(this, arguments);
        try { painelRF(); } catch (e) { console.error('[glosa] detalhe', e); }
        return r;
      };
      window.abrirDetalheRF._gl = true;
    }
  }

  colunas();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(ganchos, 60); });
  else setTimeout(ganchos, 60);
})();

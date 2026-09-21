/* ═══════════════════════════════════════════════════════════════════════════
   Conciliação com a apuração assistida — os dois lados que não se encontram

   Duas ocorrências que faltavam na fila de Inconsistências, e que são das
   mais comuns na vida real:

   1. DF sem registro na apuração assistida — o documento existe aqui,
      ingerido do SEFAZ, e o Fisco não o tem na apuração. Sem ele lá, o
      crédito não se apropria (art. 47) e o débito não é reconhecido.

   2. Registro na apuração assistida sem DF — o Fisco tem um documento em
      nome da empresa que nunca entrou aqui. Pode ser DF não ingerido,
      emitido em contingência ou por outro estabelecimento. Enquanto não
      entra, a apuração do SplitHub diverge da do Fisco.

   CBS é conferida na Receita Federal; IBS, no Comitê Gestor.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var C = window.shConcApur = window.shConcApur || {};

  C.TIPOS = {
    apur_df_sem_registro: 'DF sem registro na apuração assistida',
    apur_registro_sem_df: 'Registro na apuração assistida sem DF'
  };
  C.ORGAO = { IBS: 'Comitê Gestor do IBS', CBS: 'Receita Federal' };
  C.DIAS_TOLERANCIA = 30;

  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function br(iso) { var p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; }
  function money(v) { return 'R$ ' + (Math.round((v || 0) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function addDias(iso, n) {
    var p = String(iso || '').slice(0, 10).split('-'); if (p.length !== 3) return null;
    var d = new Date(+p[0], +p[1] - 1, +p[2] + n), z = function (x) { return x < 10 ? '0' + x : '' + x; };
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
  }
  function hoje() {
    var d = new Date(), z = function (x) { return x < 10 ? '0' + x : '' + x; };
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
  }

  /* ── 1. documentos que o Fisco não tem ───────────────────────────────── */
  C.semRegistro = function () {
    var L = window._nfListaCompleta || window.nfListaFiltradaGlobal || [], out = [], H = hoje();
    L.forEach(function (nf) {
      var cr = nf._concRegApur; if (!cr || cr.concStatus !== 'pendente') return;
      var desde = String(cr.concTs || nf.data).slice(0, 10);
      var limite = addDias(desde, C.DIAS_TOLERANCIA);
      if (!limite || limite > H) return;                 // ainda dentro do prazo
      if (hash(nf.numero + 'apur') % 100 >= 55) return;  // parte segue só pendente
      var rfs = (nf.registrosFiscais || []);
      var valor = rfs.reduce(function (a, rf) { return a + (rf.valor || 0); }, 0);
      out.push({ nf: nf, desde: desde, limite: limite, valor: valor, concId: cr.concId, rfs: rfs });
    });
    return out;
  };

  /* ── 2. registros do Fisco que não existem aqui ──────────────────────── */
  var FANTASMAS = [
    { seq: 1, tributo: 'CBS', fluxo: 'entrada', emitente: 'Polisul Química S.A.', cnpj: '24.815.037/0001-92', valor: 318450, per: '2026-05', motivo: 'DF não ingerido — emitente informou a operação na apuração assistida' },
    { seq: 2, tributo: 'IBS', fluxo: 'entrada', emitente: 'Ferroplex Mineração S.A.', cnpj: '37.204.918/0001-40', valor: 402730, per: '2026-07', motivo: 'DF não ingerido — documento emitido em contingência' },
    { seq: 3, tributo: 'IBS', fluxo: 'saida', emitente: 'Induspar Tecnologia (filial)', cnpj: '19.854.203/0002-48', valor: 275900, per: '2026-08', motivo: 'Saída registrada pelo Fisco sem documento correspondente na base' },
    { seq: 4, tributo: 'CBS', fluxo: 'entrada', emitente: 'Celupar S.A.', cnpj: '58.301.476/0001-05', valor: 189240, per: '2026-08', motivo: 'DF rejeitado na ingestão e nunca reenviado' }
  ];
  C.fantasmas = function () {
    return FANTASMAS.map(function (f) {
      var seed = hash(f.emitente + f.per + f.tributo);
      var chave = '3526' + String(f.per).slice(5, 7) + String(f.cnpj).replace(/\D/g, '') + String(seed).slice(0, 10);
      return {
        id: 'APUR-' + String(seed).slice(0, 8),
        chave: chave.slice(0, 44),
        tributo: f.tributo, fluxo: f.fluxo, emitente: f.emitente, cnpj: f.cnpj,
        valor: f.valor, periodo: f.per, motivo: f.motivo,
        detectadoEm: addDias(f.per + '-28', 12),
        orgao: C.ORGAO[f.tributo]
      };
    });
  };

  /* ── fila de inconsistências ─────────────────────────────────────────── */
  C.inconsistencias = function (inc) {
    if (!inc) return;
    C.semRegistro().forEach(function (d) {
      var nf = d.nf, T = (nf.registrosFiscais || [])[0], trib = (T && String(T.tipoFiscal).toUpperCase()) || 'IBS';
      inc.push({
        id: 'INC-' + String(inc.length + 1).padStart(4, '0'), familia: 'apuracao',
        tipo: 'apur_df_sem_registro', tipoLabel: C.TIPOS.apur_df_sem_registro,
        dfId: nf.numero, dfNum: (nf.tipoDF || 'NF-e') + ' ' + nf.numero, nfNumero: nf.numero,
        rfId: null, tipoFiscal: '—', origem: 'apuracao', tipoFluxo: nf.tipo === 'saida' ? 'saida' : 'entrada',
        status: 'aberta', prioridade: d.valor > 400000 ? 'critica' : d.valor > 100000 ? 'alta' : 'media',
        valor: d.valor, valorTotal: nf.valorTotal || d.valor, valorLiq: nf.valorLiquido || d.valor,
        entidade: nf.entidade || '—', cnpj: nf.cnpj || '—',
        dataISO: d.limite, data: br(d.limite),
        statusCredito: nf.tipo === 'entrada' ? 'nao_apropriado' : null, metodoExtincao: null,
        detalhe: 'O documento está na plataforma desde ' + br(nf.data) + ' e não foi localizado na apuração assistida ('
          + (trib === 'IBS' ? C.ORGAO.IBS : C.ORGAO.CBS) + ') em ' + C.DIAS_TOLERANCIA + ' dias · conciliação ' + d.concId
          + ' · sem o registro no Fisco o crédito não se apropria (art. 47)'
      });
    });
    C.fantasmas().forEach(function (f) {
      inc.push({
        id: 'INC-' + String(inc.length + 1).padStart(4, '0'), familia: 'apuracao',
        tipo: 'apur_registro_sem_df', tipoLabel: C.TIPOS.apur_registro_sem_df,
        dfId: f.id, dfNum: 'Chave ' + f.chave.slice(0, 12) + '…', nfNumero: '',
        rfId: null, tipoFiscal: f.tributo, origem: 'apuracao', tipoFluxo: f.fluxo,
        status: 'aberta', prioridade: f.valor > 400000 ? 'critica' : f.valor > 100000 ? 'alta' : 'media',
        valor: f.valor, valorTotal: f.valor, valorLiq: f.valor,
        entidade: f.emitente, cnpj: f.cnpj,
        dataISO: f.detectadoEm, data: br(f.detectadoEm),
        statusCredito: null, metodoExtincao: null,
        detalhe: f.orgao + ' registrou ' + money(f.valor) + ' de ' + f.tributo + ' no período ' + f.periodo
          + ' sem documento correspondente na plataforma · ' + f.motivo + ' · chave ' + f.chave
      });
    });
  };

  /* ── histórico: a ausência no Fisco é evento do RF e do DF ───────────── */
  C.historicoRF = function (rf, nf) {
    if (!rf || !nf) return [];
    var achou = null, lista = C.semRegistro();
    for (var i = 0; i < lista.length; i++) if (lista[i].nf === nf) { achou = lista[i]; break; }
    if (!achou) return [];
    var F = window._rfFmtTS || function (x) { return x; }, T = (rf.tipoFiscal || '').toUpperCase();
    var ts = achou.limite + 'T08:30';
    return [{ ts: ts, data: F(ts), tipo: 'CONC APURAÇÃO', modulo: 'Conciliação', ator: C.ORGAO[T] || 'Fisco',
      desc: 'Documento não localizado na apuração assistida (' + (C.ORGAO[T] || 'Fisco') + ') após '
        + C.DIAS_TOLERANCIA + ' dias · ' + T + ' de ' + money(rf.valor)
        + (nf.tipo === 'entrada' ? ' · sem o registro do Fisco o crédito não pode ser apropriado (art. 47)'
                                 : ' · o débito não é reconhecido na apuração do Fisco')
        + ' · conciliação ' + achou.concId, cls: 'erro' }];
  };

  function gancho() {
    if (typeof window._rfGerarHistorico !== 'function' || window._rfGerarHistorico._capur) return;
    var gh = window._rfGerarHistorico;
    window._rfGerarHistorico = function (rf, nf) {
      var ev = gh.apply(this, arguments);
      try { C.historicoRF(rf, nf).forEach(function (e) { ev.push(e); }); } catch (e) { console.error('[conc-apur] histórico', e); }
      return ev;
    };
    window._rfGerarHistorico._capur = true;
  }
  (function tentar(n) {
    gancho();
    if (!(window._rfGerarHistorico && window._rfGerarHistorico._capur) && (n || 0) < 20) setTimeout(function () { tentar((n || 0) + 1); }, 60);
  })(0);
})();

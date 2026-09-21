/* ═══════════════════════════════════════════════════════════════════════════
   Integração com o ERP — eventos do ciclo de vida do crédito

   Toda mudança de status no ciclo do crédito dispara um webhook para o ERP
   do cliente. Cada disparo deixa dois registros na trilha: o ENVIO, com o
   nome do evento, o identificador do payload e a tentativa, e a ENTREGA,
   com a confirmação do ERP — ou a retentativa, ou a falha.

   A mão inversa também é registrada: o comprovante de recolhimento chega
   do ERP pela integração, e esse recebimento entra na trilha antes de o
   crédito ser apropriado.

   Os eventos entram no histórico do RF; a trilha de auditoria do documento
   agrega os RFs, então o mesmo registro aparece no DF — por isso a
   descrição sempre nomeia o tributo.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var E = window.shErp = window.shErp || {};

  E.EVENTOS = {
    registrado:  { nome: 'credito.registrado',  rotulo: 'o registro do crédito' },
    apropriado:  { nome: 'credito.apropriado',  rotulo: 'a apropriação do crédito' },
    utilizado:   { nome: 'credito.utilizado',   rotulo: 'a utilização do crédito' },
    glosado:     { nome: 'credito.glosado',     rotulo: 'a glosa do crédito' }
  };
  E.INTEGRACAO = 'ERP · Financeiro';

  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function money(v) { return 'R$ ' + (Math.round((v || 0) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function br(iso) { var p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; }
  function somaMin(ts, min) {
    var d = String(ts).slice(0, 10), hm = String(ts).slice(11, 16).split(':');
    var t = (+hm[0]) * 60 + (+hm[1]) + min;
    var h = Math.floor(t / 60) % 24, m = t % 60, z = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d + 'T' + z(h) + ':' + z(m);
  }
  function addDias(iso, n) {
    var p = String(iso || '').slice(0, 10).split('-'); if (p.length !== 3) return null;
    var d = new Date(+p[0], +p[1] - 1, +p[2] + n), z = function (x) { return x < 10 ? '0' + x : '' + x; };
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
  }

  /* Estado da entrega: determinístico por RF e evento, para a demonstração
     ficar estável. Em produção vem do webhook. */
  function entrega(rfId, evento) {
    var q = hash(rfId + '|' + evento) % 100;
    return q < 5 ? 'falha' : q < 13 ? 'pendente' : 'entregue';
  }
  function tentativas(st) { return st === 'falha' ? 4 : st === 'pendente' ? 2 : 1; }

  /* ── o par envio + entrega de um evento ──────────────────────────────── */
  function par(out, rf, T, ts, chave, detalhe) {
    var ev = E.EVENTOS[chave]; if (!ev || !ts) return;
    var F = window._rfFmtTS || function (x) { return x; };
    var id = 'evt_' + hash(rf.id + ev.nome).toString(16).slice(0, 8);
    var st = entrega(rf.id, ev.nome), n = tentativas(st);
    function mk(t, tipo, ator, desc, cls) { return { ts: t, data: F(t), tipo: tipo, modulo: 'Integrações', ator: ator, desc: desc, cls: cls }; }
    out.push(mk(somaMin(ts, 5), 'ENVIO ERP', 'SplitHub · automático',
      'Webhook ' + ev.nome + ' enviado ao ERP · ' + T + ' · ' + detalhe
      + ' · payload ' + id + ' · tentativa 1 de ' + n, 'ok'));
    if (st === 'entregue') {
      out.push(mk(somaMin(ts, 6), 'ENTREGA ERP', E.INTEGRACAO,
        'ERP confirmou ' + ev.rotulo + ' · ' + T + ' · HTTP 200 OK · payload ' + id, 'ok'));
    } else if (st === 'pendente') {
      out.push(mk(somaMin(ts, 6 + 60), 'ENTREGA ERP', 'SplitHub · automático',
        'ERP ainda não confirmou ' + ev.rotulo + ' · ' + T + ' · ' + n + ' tentativas · reenvio automático em andamento · payload ' + id, 'pending'));
    } else {
      out.push(mk(somaMin(ts, 6 + 180), 'ENTREGA ERP', 'SplitHub · automático',
        'Entrega do evento ' + ev.nome + ' falhou depois de ' + n + ' tentativas · ' + T + ' · o ERP não recebeu a mudança de status · reenvio manual em Configurações → Integrações → Log de entregas · payload ' + id, 'erro'));
    }
  }

  /* ── eventos do RF ───────────────────────────────────────────────────── */
  E.historicoRF = function (rf, nf) {
    if (!rf || !nf || nf.tipo !== 'entrada') return [];
    var out = [], T = (rf.tipoFiscal || '').toUpperCase();
    var F = window._rfFmtTS || function (x) { return x; };
    var d0 = String(rf.data || nf.data || '').slice(0, 10);
    var doc = (nf.tipoDF || 'NF-e') + ' ' + nf.numero;
    if (!d0) return out;
    var sc = rf.statusCredito || rf.status || '';

    // 1. o crédito nasce no registro fiscal
    par(out, rf, T, addDias(d0, 2) + 'T10:00', 'registrado',
      'crédito de ' + money(rf.valor) + ' registrado no documento ' + doc + ' · status não apropriado');

    // 2. comprovante do recolhimento chega do ERP pela integração
    if (rf.dataPagamento && rf.dataPagamento !== '—') {
      var dp = String(rf.dataPagamento);
      var iso = dp.indexOf('/') !== -1 ? dp.slice(6, 10) + '-' + dp.slice(3, 5) + '-' + dp.slice(0, 2) : dp.slice(0, 10);
      var hora = dp.length > 10 ? dp.slice(11, 16) : '14:00';
      var met = rf.metodoPagamento || nf.metodoPagamento || 'Fornecedor';
      out.push({ ts: somaMin(iso + 'T' + hora, 20), data: F(somaMin(iso + 'T' + hora, 20)),
        tipo: 'COMPROVANTE ERP', modulo: 'Integrações', ator: E.INTEGRACAO,
        desc: 'Comprovante do recolhimento recebido do ERP pela integração · ' + T + ' · ' + money(rf.valor)
          + ' · método ' + met + ' · arquivo comprovante_' + hash(rf.id + 'cmp').toString(16).slice(0, 8) + '.pdf'
          + ' · conciliado com o pagamento de ' + br(iso), cls: 'ok' });
    }

    // 3. apropriação
    if (rf.dataApropriacao && (sc === 'apropriado' || sc === 'utilizado')) {
      par(out, rf, T, String(rf.dataApropriacao).slice(0, 10) + 'T11:30', 'apropriado',
        'crédito de ' + money(rf.valor) + ' apropriado · art. 47 da LC 214/2025');
    }

    // 4. utilização — compensação ou ressarcimento
    if (sc === 'utilizado' && rf.dataExtincaoCredito) {
      var comoUsou = rf.metodoExtincao === 'Ressarcimento'
        ? 'crédito de ' + money(rf.valor) + ' extinto por ressarcimento — não abateu débito'
        : 'crédito de ' + money(rf.valor) + ' compensado com débito do mesmo tributo · ordem do art. 53';
      par(out, rf, T, String(rf.dataExtincaoCredito).slice(0, 10) + 'T14:18', 'utilizado', comoUsou);
    }

    // 5. glosa
    var gl = (window.shGlosa && window.shGlosa.ficha) ? window.shGlosa.ficha(rf.id) : null;
    if (gl) {
      par(out, rf, T, gl.cienciaEm + 'T10:45', 'glosado',
        'crédito de ' + money(gl.valor) + ' glosado · causa ' + gl.causa + ' — ' + gl.causaNome.toLowerCase() + ' · ' + gl.orgao);
    } else if (sc === 'glosado') {
      par(out, rf, T, addDias(d0, 10) + 'T10:45', 'glosado', 'crédito de ' + money(rf.valor) + ' glosado pelo Fisco');
    }
    return out;
  };

  /* ── integracao que falha vira ocorrencia na fila ────────────────────
     Webhook que o ERP nao recebeu depois de esgotadas as tentativas deixa
     o ERP com um status desatualizado: o SplitHub diz uma coisa e o
     sistema do cliente diz outra. Isso e inconsistencia, nao so log. */
  E.TIPO_INC = 'integracao_erp';
  E.inconsistencias = function (inc) {
    if (!inc) return;
    var L = window._nfListaCompleta || window.nfListaFiltradaGlobal || [];
    L.forEach(function (nf) {
      if (nf.tipo !== 'entrada') return;
      (nf.registrosFiscais || []).forEach(function (rf) {
        (E.historicoRF(rf, nf) || []).forEach(function (e) {
          if (e.tipo !== 'ENTREGA ERP' || e.cls !== 'erro') return;
          var m = (e.desc || '').match(/Webhook (credito\.\w+)|evento (credito\.\w+)/);
          var nome = m ? (m[1] || m[2]) : 'credito.status';
          var v = rf.valor || 0, T = (rf.tipoFiscal || '').toUpperCase();
          inc.push({
            id: 'INC-' + String(inc.length + 1).padStart(4, '0'), familia: 'integracao',
            tipo: E.TIPO_INC, tipoLabel: 'Integração ao ERP falhou',
            dfId: nf.numero, dfNum: (nf.tipoDF || 'NF-e') + ' ' + nf.numero, nfNumero: nf.numero,
            rfId: rf.id, tipoFiscal: T, origem: 'integracao', tipoFluxo: 'entrada',
            status: 'aberta', prioridade: v > 400000 ? 'critica' : v > 100000 ? 'alta' : 'media',
            valor: v, valorTotal: nf.valorTotal || v, valorLiq: nf.valorLiquido || v,
            entidade: nf.entidade || '—', cnpj: nf.cnpj || '—',
            dataISO: String(e.ts).slice(0, 10), data: br(String(e.ts).slice(0, 10)),
            statusCredito: rf.statusCredito || rf.status, metodoExtincao: rf.metodoExtincao || null,
            evento: nome, detalhe: 'O ERP não recebeu ' + nome + ' e segue com o status anterior deste crédito. Reenviar em Configurações → Integrações → Log de entregas.'
          });
        });
      });
    });
  };

  function gancho() {
    if (typeof window._rfGerarHistorico !== 'function' || window._rfGerarHistorico._erp) return;
    var gh = window._rfGerarHistorico;
    window._rfGerarHistorico = function (rf, nf) {
      var ev = gh.apply(this, arguments);
      try { E.historicoRF(rf, nf).forEach(function (e) { ev.push(e); }); } catch (e) { console.error('[erp] histórico', e); }
      return ev;
    };
    window._rfGerarHistorico._erp = true;
  }
  (function tentar(n) {
    gancho();
    if (!(window._rfGerarHistorico && window._rfGerarHistorico._erp) && (n || 0) < 20) setTimeout(function () { tentar((n || 0) + 1); }, 60);
  })(0);
})();

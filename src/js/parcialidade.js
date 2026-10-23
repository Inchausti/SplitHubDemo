/* ═══════════════════════════════════════════════════════════════════════════
   Parcialidade do crédito — lote 1 do protótipo (branch parcialidade-prototipo)
   PRD de Crédito 3.3 · proposta-parcialidade-aprovacao.html, Parte 9

   O crédito de cada RF deixa de ter um rótulo e passa a ter uma partição do
   valor apurado (balances), formada por movimentos. O status é calculado da
   partição, pela precedência da API. Neste lote o modelo convive com o
   statusCredito legado, que os demais módulos ainda leem: as telas do lote —
   listagens de crédito, detalhe do documento e detalhe do RF — já usam a
   partição. Os lotes 2 e 3 levam o resto.

   Decisões: D-PAR-01 (nomes da API), D-PAR-02 (glosa parcial), D-PAR-03
   (prazo por fatia apropriada), D-PAR-04 (selo por tributo), D-PAR-05
   (marcas sobre a fatia), D-PAR-09 (nulo do IBS), C-01.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var P = window.shParcial = window.shParcial || {};

  /* ── vocabulário (glossário do Ciclo de vida 1.16) ────────────────────── */
  P.PARC = [
    { k: 'pending',          rot: 'A apropriar',                cor: 'var(--amber)' },
    { k: 'available',        rot: 'Disponível',                 cor: 'var(--teal-alt)' },
    { k: 'utilized',         rot: 'Utilizado',                  cor: 'var(--teal-dark)' },
    { k: 'not_appropriable', rot: 'Inapropriável',              cor: 'var(--red)' },
    { k: 'not_usable',       rot: 'Inutilizável',               cor: 'var(--status-red)' },
    { k: 'suspended',        rot: 'Suspenso',                   cor: 'var(--gray)' },
    { k: 'expired',          rot: 'Prescrito',                  cor: 'var(--txt3)' },
    { k: 'restored',         rot: 'Restabelecido',              cor: 'var(--status-blue)' },
    { k: 'refund_requested', rot: 'Em pedido de ressarcimento', cor: 'var(--violet)' },
    { k: 'refund_available', rot: 'Ressarcimento disponível',   cor: 'var(--blue)' }
  ];
  var ROT = {};
  P.PARC.forEach(function (p) { ROT[p.k] = p.rot; });
  P.rot = function (k) { return ROT[k] || k; };

  // o Comitê Gestor não informa estas parcelas no IBS (D-PAR-09); na CBS, refund_available
  var NULO_IBS = ['not_usable', 'suspended', 'expired', 'restored'];
  var NULO_CBS = ['refund_available'];

  P.STATUS = {
    cancelled: 'Cancelado', disallowed: 'Glosado', expired: 'Prescrito', utilized: 'Utilizado',
    partially_utilized: 'Parcialmente utilizado', appropriated: 'Apropriado',
    partially_appropriated: 'Parcialmente apropriado', not_appropriated: 'Não apropriado'
  };
  var ORGAO = { cbs: 'Receita Federal', ibs: 'Comitê Gestor' };

  /* ── utilitários ──────────────────────────────────────────────────────── */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function r2(v) { return Math.round((+v || 0) * 100) / 100; }
  function money(v) { return typeof window.ff === 'function' ? window.ff(v) : 'R$ ' + r2(v).toFixed(2).replace('.', ','); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = String(s || '').slice(0, 10).split('-'); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null; }
  function addDias(s, n) { var d = parse(s); if (!d) return s; d.setDate(d.getDate() + n); return iso(d); }
  function br(s) { var p = String(s || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; }
  function hash(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  // art. 54: cinco anos do primeiro dia do período seguinte ao da apropriação (RN-CRE-26)
  function prazoArt54(dataAprop) { var d = parse(dataAprop); if (!d) return null; return iso(new Date(d.getFullYear() + 5, d.getMonth() + 1, 1)); }
  // vencimento da apropriação: último dia do mês seguinte ao da emissão (RN-CRE-04)
  function vencimento(emissao) { var d = parse(emissao); if (!d) return null; return new Date(d.getFullYear(), d.getMonth() + 2, 0); }

  function zera(trib) {
    var b = {};
    P.PARC.forEach(function (p) { b[p.k] = 0; });
    (trib === 'ibs' ? NULO_IBS : NULO_CBS).forEach(function (k) { b[k] = null; });
    return b;
  }
  P.apurado = function (b) { var s = 0; P.PARC.forEach(function (p) { if (b[p.k]) s += b[p.k]; }); return r2(s); };

  /* ── status calculado, pela precedência da API (RF-CRE-076) ───────────── */
  P.derivar = function (b, cancelado) {
    var v = function (k) { return b[k] || 0; };
    var ap = P.apurado(b);
    if (cancelado) return 'cancelled';
    if (ap > 0 && v('not_appropriable') + v('not_usable') >= ap - 0.005) return 'disallowed';
    var naoUsado = ap - v('utilized') - v('not_appropriable') - v('not_usable');
    if (v('expired') > 0 && naoUsado - v('expired') <= 0.005) return 'expired';
    if (v('utilized') > 0 && v('available') === 0 && v('pending') === 0) return 'utilized';
    if (v('utilized') > 0 && v('available') > 0) return 'partially_utilized';
    if (v('available') + v('not_usable') + v('refund_requested') > 0 && v('pending') === 0 && v('utilized') === 0) return 'appropriated';
    if ((v('available') > 0 || v('utilized') > 0 || v('refund_requested') > 0) && v('pending') > 0) return 'partially_appropriated';
    return 'not_appropriated';
  };

  /* ── montagem da base: partição e movimentos por RF ───────────────────── */
  // Casos da base simulada, escolhidos pelo número do documento, sobre RFs que o
  // protótipo de hoje mostra com rótulo inteiro — é exatamente o que a partição corrige:
  //   P1 recolhimento parcial (RF "apropriado", ~35%): 40% ainda a apropriar
  //   P2 uso parcial (RF "utilizado", ~20%): 30% ainda disponível
  //   P3 os quatro momentos (RF "utilizado", ~8%): a apropriar, disponível, utilizado e glosa parcial
  function caso(nf, sc) {
    var h = hash(nf.numero || nf.chaveDF || '') % 100;
    if (sc === 'apropriado') return h < 35 ? 'P1' : '';
    if (sc === 'utilizado') return h < 20 ? 'P2' : h < 28 ? 'P3' : '';
    return '';
  }

  function mov(lista, em, de, para, valor, causa, fonte, vinculo, prazo) {
    if (!(valor > 0)) return;
    lista.push({ reconhecidoEm: em, de: de, para: para, valor: r2(valor), causa: causa, fonte: fonte, vinculo: vinculo || '', prazoArt54: prazo || null });
  }

  function montar(rf, nf) {
    var trib = rf.tipoFiscal === 'ibs' ? 'ibs' : 'cbs';
    var v = r2(rf.valor);
    var sc = rf.statusCredito || rf.status || 'nao_apropriado';
    var c = caso(nf, sc);
    var b = zera(trib);
    var movs = [];
    var fonte = ORGAO[trib] + (trib === 'cbs' ? ' · consulta' : ' · arquivo diário');
    var emi = String(nf.data || rf.data || '').slice(0, 10);
    var dAprop = String(rf.dataApropriacao || addDias(emi, 20)).slice(0, 10);
    var dUso = String(rf.dataExtincaoCredito || addDias(dAprop, 30)).slice(0, 10);
    var res = rf.ressarcimento || null;
    var causaUso = res && res.marca === 'ressarcido' ? 'Ressarcimento' : 'Compensação · ordem do art. 53';
    var vincUso = res && res.marca === 'ressarcido' ? (res.ref || 'Pedido de ressarcimento') : 'Apuração ' + dUso.slice(5, 7) + '/' + dUso.slice(0, 4);
    mov(movs, emi, null, 'pending', v, 'Documento registrado', fonte);

    if (sc === 'glosado') {
      var g = rf.glosa || {};
      mov(movs, String(g.cienciaEm || addDias(emi, 25)).slice(0, 10), 'pending', 'not_appropriable', v,
        'Glosa · ' + (g.causaNome || 'negativa do órgão'), trib === 'ibs' ? fonte + ' · movimentação identificada' : fonte, g.id || '');
      b.not_appropriable = v;
    } else if (sc === 'apropriado') {
      var a = c === 'P1' ? r2(v * 0.6) : v;
      mov(movs, dAprop, 'pending', 'available', a, c === 'P1' ? 'Extinção parcial do débito do fornecedor' : 'Extinção do débito do fornecedor', fonte, '', prazoArt54(dAprop));
      b.available = a; b.pending = r2(v - a);
    } else if (sc === 'utilizado') {
      if (c === 'P2') {
        var u = r2(v * 0.7);
        mov(movs, dAprop, 'pending', 'available', v, 'Extinção do débito do fornecedor', fonte, '', prazoArt54(dAprop));
        mov(movs, dUso, 'available', 'utilized', u, causaUso, 'Apuração assistida', vincUso);
        b.utilized = u; b.available = r2(v - u);
      } else if (c === 'P3') {
        var pend = r2(v * 0.3), inap = r2(v * 0.1), ut = r2(v * 0.5);
        var apr = r2(v - pend - inap);
        mov(movs, dAprop, 'pending', 'available', apr, 'Extinção parcial do débito do fornecedor', fonte, '', prazoArt54(dAprop));
        mov(movs, dUso, 'available', 'utilized', ut, causaUso, 'Apuração assistida', vincUso);
        mov(movs, addDias(dAprop, 10), 'pending', 'not_appropriable', inap, 'Glosa parcial',
          trib === 'ibs' ? fonte + ' · movimentação identificada' : fonte, 'Ficha de glosa');
        b.pending = pend; b.available = r2(apr - ut); b.utilized = ut;
        b.not_appropriable = inap;
        // a glosa parcial tem ficha própria (T-04); revertida, o valor volta à
        // parcela de onde saiu, por movimento com causa decisão (D-PAR-13)
        var mg = movs[movs.length - 1];
        var fg = window.shGlosa && window.shGlosa.registrarParcial ? window.shGlosa.registrarParcial(rf, nf, mg) : null;
        if (fg) {
          mg.vinculo = 'Ficha ' + fg.id;
          if (fg.status === 'revertida' && fg.decisaoEm) {
            mov(movs, fg.decisaoEm, 'not_appropriable', 'pending', inap, 'Glosa revertida · decisão', fonte, 'Ficha ' + fg.id);
            b.not_appropriable = 0; b.pending = r2(pend + inap);
          }
        }
      } else {
        mov(movs, dAprop, 'pending', 'available', v, 'Extinção do débito do fornecedor', fonte, '', prazoArt54(dAprop));
        mov(movs, dUso, 'available', 'utilized', v, causaUso, 'Apuração assistida', vincUso);
        b.utilized = v;
      }
    } else {
      b.pending = v;
    }
    // em pedido de ressarcimento é parcela (D-PAR-16); reservado segue marca
    if (res && res.marca === 'em_pedido' && b.available > 0) {
      mov(movs, String(res.data || addDias(dAprop, 40)).slice(0, 10), 'available', 'refund_requested', b.available, 'Pedido de ressarcimento', ORGAO[trib], res.ref || '');
      b.refund_requested = b.available; b.available = 0;
    }
    rf.balances = b;
    rf.movimentos = movs;
    rf.statusParcial = P.derivar(b, false);
    rf.casoParcial = c;
    // prazo do art. 54 mais próximo entre as fatias com saldo disponível
    rf.prazoArt54Prox = null;
    if ((b.available || 0) > 0) {
      movs.forEach(function (m) { if (m.para === 'available' && m.prazoArt54 && (!rf.prazoArt54Prox || m.prazoArt54 < rf.prazoArt54Prox)) rf.prazoArt54Prox = m.prazoArt54; });
    }
    marcas(rf, nf);
  }

  /* ── marcas sobre a fatia (RN-CRE-25, D-PAR-05) ───────────────────────── */
  var SEV = { inconsistencia: 4, vencido: 3, em_risco: 2, a_prescrever: 1 };
  function marcas(rf, nf) {
    var b = rf.balances, hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var f = [];
    if ((b.pending || 0) > 0) {
      var ve = vencimento(nf.data || rf.data);
      if (ve) {
        var dias = Math.round((ve - hoje) / 86400000);
        if (dias < 0) f.push({ f: 'vencido', valor: b.pending });
        else if (dias <= 10) f.push({ f: 'em_risco', valor: b.pending });
      }
    }
    if ((b.available || 0) > 0 && rf.prazoArt54Prox) {
      var dp = Math.round((parse(rf.prazoArt54Prox) - hoje) / 86400000);
      if (dp <= 180) f.push({ f: 'a_prescrever', valor: b.available });
    }
    if ((rf.statusFlags || []).indexOf('inconsistencia') >= 0) f.push({ f: 'inconsistencia', valor: null });
    rf.flagsFatia = f;
    // o RF apropriado em parte não perde mais o alerta: o legado zerava as marcas
    var sc = rf.statusCredito || rf.status;
    if ((sc === 'apropriado' || sc === 'utilizado') && (b.pending || 0) > 0) {
      var arr = (rf.statusFlags || []).slice();
      f.forEach(function (x) { if (arr.indexOf(x.f) < 0) arr.push(x.f); });
      rf.statusFlags = arr;
      rf.statusRegistro = arr.reduce(function (best, x) { return (SEV[x] || 0) > (SEV[best] || 0) ? x : best; }, arr[0] || null);
    }
  }

  /* ── confronto com o órgão, parcela a parcela (T-06, C-01) ─────────────
     Pela C-01 o SplitHub só grava movimento a partir do dado do órgão, então
     as partições batem. A divergência simulada é a que a conciliação já
     aponta no documento: o órgão moveu um valor que não tem contrapartida no
     SplitHub — uma glosa ainda não registrada aqui — ou apurou menos. */
  function concDe(rf, nf, k) { return rf[k] || nf[k] || null; }
  P.orgao = function (rf, nf) {
    var b = rf.balances; if (!b) return null;
    var semReg = window.shConcApur && window.shConcApur.semRegistro ? window.shConcApur.semRegistro() : [];
    for (var i = 0; i < semReg.length; i++) if (semReg[i].nf === nf) return { sem: true };
    var o = {}; P.PARC.forEach(function (p) { o[p.k] = b[p.k]; });
    var c = concDe(rf, nf, '_concRegApur'), div = null;
    if (c && c.concStatus === 'inconsistencia') {
      var x = r2(rf.valor * 0.05);
      if ((b.pending || 0) >= x) { o.pending = r2(o.pending - x); o.not_appropriable = r2((o.not_appropriable || 0) + x); div = { tipo: 'mov', de: 'pending', para: 'not_appropriable', valor: x }; }
      else {
        var k = ['available', 'utilized', 'not_appropriable'].filter(function (q) { return (b[q] || 0) >= x; })[0];
        if (k) { o[k] = r2(o[k] - x); div = { tipo: 'apurado', parc: k, valor: x }; }
      }
    }
    return { b: o, apurado: P.apurado(o), div: div, conc: c };
  };
  // pago contra extinção reconhecida, em valor, por tributo (CFIN)
  P.cfin = function (rf, nf) {
    var b = rf.balances || {};
    var rec = r2((rf.movimentos || []).filter(function (m) { return m.de === 'pending' && m.para === 'available'; }).reduce(function (s, m) { return s + m.valor; }, 0));
    var comp = !!(rf.dataPagamento && rf.dataPagamento !== '—');
    var c = concDe(rf, nf, '_concRegFin'), pago = comp ? rec : 0;
    if (comp && c && c.concStatus === 'inconsistencia') pago = r2(rec + r2(rf.valor * 0.05));
    return { pago: pago, reconhecido: rec, comprovante: comp, diverge: comp && Math.abs(pago - rec) > 0.005, conc: c };
  };

  /* ── divergência vira card na fila de inconsistências ──────────────────
     Uma por tributo e por etapa, com os dois valores e o vínculo ao DF e ao
     RF. Se a fila já tem o card da etapa para o RF, ele recebe o detalhe; se
     não tem (o legado pulava RF apropriado, utilizado ou glosado), nasce
     aqui. Glosa e integração com o ERP têm card pelos próprios módulos. */
  var ETAPA = function (tipo) { return /^capur_|^mov_orgao|^mov_nao/.test(tipo) ? 'CAPUR' : /^cfin_|^reconhecido_/.test(tipo) ? 'CFIN' : tipo === 'particao_nao_fecha' ? 'PART' : null; };
  P.divergencias = function (rf, nf) {
    var t = rf.tipoFiscal === 'ibs' ? 'ibs' : 'cbs', T = t.toUpperCase(), org = ORGAO[t], out = [];
    var o = P.orgao(rf, nf);
    if (o && o.div) {
      var dv = o.div;
      out.push(dv.tipo === 'mov'
        ? { etapa: 'CAPUR', tipo: 'mov_orgao_sem_contrapartida', valor: dv.valor,
            resumo: 'Órgão: ' + money(dv.valor) + ' em ' + P.rot(dv.para) + '; aqui em ' + P.rot(dv.de) + '.',
            detalhe: org + ' informa ' + money(dv.valor) + ' de ' + T + ' em ' + P.rot(dv.para) + ' que o SplitHub mantém em ' + P.rot(dv.de) + ' — glosa ainda não registrada aqui. Nenhum dos valores foi aplicado.' }
        : { etapa: 'CAPUR', tipo: 'capur_' + t + '_divergente', valor: dv.valor,
            resumo: 'Órgão apurou ' + money(dv.valor) + ' a menos em ' + P.rot(dv.parc) + '.',
            detalhe: org + ' apurou ' + money(dv.valor) + ' a menos de ' + T + ' (' + P.rot(dv.parc) + ': SplitHub ' + money(rf.balances[dv.parc]) + ' × órgão ' + money(o.b[dv.parc]) + '). Nenhum dos valores foi aplicado.' });
    }
    var f = P.cfin(rf, nf);
    if (f.diverge) out.push({ etapa: 'CFIN', tipo: 'reconhecido_diferente_pago', valor: r2(f.pago - f.reconhecido),
      resumo: 'Pago ' + money(f.pago) + ' × reconhecido ' + money(f.reconhecido) + '.',
      detalhe: 'Pago ' + money(f.pago) + ' de ' + T + ', reconhecido por ' + org + ' ' + money(f.reconhecido) + '. Diferença de ' + money(f.pago - f.reconhecido) + '.' });
    if (Math.abs(P.apurado(rf.balances) - r2(rf.valor)) > 0.01) out.push({ etapa: 'PART', tipo: 'particao_nao_fecha', valor: r2(Math.abs(P.apurado(rf.balances) - rf.valor)),
      resumo: 'Parcelas somam ' + money(P.apurado(rf.balances)) + '; apurado ' + money(rf.valor) + '.',
      detalhe: 'As parcelas de ' + T + ' somam ' + money(P.apurado(rf.balances)) + ' e o apurado é ' + money(rf.valor) + '.' });
    return out;
  };
  P.inconsistencias = function (inc) {
    if (!inc) return;
    var L = window.nfListaFiltradaGlobal || window._nfListaCompleta || [];
    var prio = function (v) { return v > 500000 ? 'critica' : v > 100000 ? 'alta' : v > 20000 ? 'media' : 'baixa'; };
    L.forEach(function (nf) {
      if (nf.tipo !== 'entrada') return;
      (nf.registrosFiscais || []).forEach(function (rf) {
        if (!rf.balances) return;
        P.divergencias(rf, nf).forEach(function (d) {
          var ja = inc.filter(function (i) { return i.rfId === rf.id && ETAPA(i.tipo) === d.etapa; })[0];
          if (ja) {
            ja.detalhe = d.detalhe; ja.resumo = d.resumo; ja.divergencia = d;
            if (ja.status === 'resolvida') ja.status = 'aberta';   // o órgão ainda informa a divergência
            return;
          }
          var dp = String(nf.data || '').split('-');
          inc.push({
            id: 'INC-' + String(inc.length + 1).padStart(4, '0'), tipo: d.tipo, tipoLabel: null, familia: null,
            dfId: (nf.tipoDF || 'NF-e') + ' ' + nf.numero, dfNum: (nf.tipoDF || 'NF-e') + ' ' + nf.numero, nfNumero: nf.numero,
            rfId: rf.id, tipoFiscal: String(rf.tipoFiscal || '').toUpperCase(), origem: 'rf', tipoFluxo: 'entrada',
            status: 'aberta', prioridade: prio(d.valor), valor: d.valor, valorTotal: nf.valorTotal || 0, valorLiq: nf.valorLiquido || 0,
            entidade: nf.entidade || '—', cnpj: nf.cnpj || '—', dataISO: String(nf.data || ''), data: dp.length === 3 ? dp[2] + '/' + dp[1] + '/' + dp[0] : '—',
            contratoId: rf.contratoId || nf.contratoId || null, statusCredito: rf.statusCredito || rf.status || null,
            statusRegistro: rf.statusRegistro || null, metodoPagamento: rf.metodoPagamento || null, metodoExtincao: rf.metodoExtincao || null,
            dataApropriacao: rf.dataApropriacao || null, dataPrevExtincao: rf.dataPrevExtincao || null, dataExtincaoCredito: rf.dataExtincaoCredito || null,
            detalhe: d.detalhe, resumo: d.resumo, divergencia: d
          });
        });
      });
    });
  };

  /* ── Conciliação parcela a parcela (T-06) ──────────────────────────────
     Um painel por tributo, cada um contra o seu órgão: parcela do SplitHub,
     parcela do órgão, diferença e situação; e o financeiro, pago contra
     extinção reconhecida. Nenhum dos valores divergentes é aplicado sozinho. */
  function cardDa(rf, re) { return (rf._inconsistencias || []).filter(function (i) { return re.test(i.tipo); })[0] || null; }
  // parcelas divergentes por tributo: o Δ e o filtro da lista da Conciliação
  P.divergentesPor = function (nf) {
    var n = { cbs: 0, ibs: 0 };
    (nf.registrosFiscais || []).forEach(function (rf) {
      var o = rf.balances && P.orgao(rf, nf); if (!o || o.sem) return;
      var t = rf.tipoFiscal === 'ibs' ? 'ibs' : 'cbs';
      P.PARC.forEach(function (p) { if (rf.balances[p.k] !== null && o.b[p.k] !== null && Math.abs((rf.balances[p.k] || 0) - (o.b[p.k] || 0)) > 0.005) n[t]++; });
    });
    return n;
  };
  P.divergentes = function (nf) { var n = P.divergentesPor(nf); return n.cbs + n.ibs; };
  P.confrontoHtml = function (nf) {
    var rfs = (nf.registrosFiscais || []).filter(function (rf) { return rf.balances; })
      .sort(function (a, b) { return a.tipoFiscal === 'cbs' ? -1 : b.tipoFiscal === 'cbs' ? 1 : 0; });
    if (!rfs.length) return '';
    var capDiverge = {};
    return '<div class="shg shg-lg pp-bloco">' + rfs.map(function (rf) {
      var t = rf.tipoFiscal === 'ibs' ? 'ibs' : 'cbs', T = t.toUpperCase(), org = ORGAO[t], b = rf.balances, o = P.orgao(rf, nf), f = P.cfin(rf, nf);
      var hdr = '<div class="pp-card-hdr"><span class="pp-trib pp-trib-' + t + '">' + T + '</span><strong>Confronto com ' + (t === 'cbs' ? 'a ' : 'o ') + org + '</strong>'
        + '<span class="pp-mono">' + esc(rf.id) + '</span></div>';
      if (o && o.sem) {
        return '<div class="pp-card">' + hdr + '<div class="pp-ev-desc">Sem leitura do órgão: o documento não foi localizado na apuração assistida dentro da espera. Nada se move até o órgão refletir (C-01).</div></div>';
      }
      var linhas = [{ rot: 'Apurado', s: r2(rf.valor), o: o.apurado, k: '_ap' }].concat(P.PARC.filter(function (p) {
        return !(p.k === 'refund_available' && t === 'cbs') && ((b[p.k] || 0) > 0 || (o.b[p.k] || 0) > 0);
      }).map(function (p) { return { rot: p.rot, s: b[p.k], o: o.b[p.k], k: p.k, cor: p.cor }; }));
      var nulas = t === 'ibs' ? P.PARC.filter(function (p) { return b[p.k] === null; }).length : 0;
      var nDiv = 0;
      var rows = linhas.map(function (l) {
        var nulo = l.s === null || l.o === null;
        var d = nulo ? null : r2((l.o || 0) - (l.s || 0));
        var div = d !== null && Math.abs(d) > 0.005;
        if (div && l.k !== '_ap') nDiv++;
        var sit = nulo ? '<span class="pp-mut">Não informado (D-PAR-09)</span>'
          : !div ? '<span class="pp-conf ok" style="margin:0">Confere</span>'
          : l.k === 'not_appropriable' && d > 0 ? '<span class="pp-st pp-st-erro">glosa ainda não registrada aqui</span>'
          : '<span class="pp-st pp-st-erro">divergente</span>';
        var cel = function (v) { return v === null ? '<span class="pp-mut">n/i</span>' : v > 0 ? money(v) : '<span class="pp-mut">—</span>'; };
        return '<tr' + (div ? ' class="pp-div"' : '') + '><td>' + (l.cor ? '<span class="pp-parc"><span class="pp-dot" style="background:' + l.cor + '"></span>' + esc(l.rot) + '</span>' : '<strong class="pp-forte-t">' + esc(l.rot) + '</strong>') + '</td>'
          + '<td class="r pp-num">' + cel(l.s) + '</td><td class="r pp-num">' + cel(l.o) + '</td>'
          + '<td class="r pp-num">' + (d === null ? '<span class="pp-mut">—</span>' : div ? (d > 0 ? '+' : '−') + money(Math.abs(d)) : '<span class="pp-mut">—</span>') + '</td><td>' + sit + '</td></tr>';
      }).join('')
        + (nulas ? '<tr><td colspan="5" class="pp-mut">' + nulas + ' parcelas não informadas pelo Comitê Gestor · sem diferença calculada (D-PAR-09)</td></tr>' : '');
      capDiverge[t] = nDiv > 0;
      var cC = cardDa(rf, /^capur_|^mov_/), cF = cardDa(rf, /^cfin_|^reconhecido_/);
      var ref = function (c) { return c ? ' <button class="pp-ref" onclick="window.kbAbrirCard && window.kbAbrirCard(\'' + esc(c.id) + '\')">' + esc(c.id) + '</button>' : ''; };
      var fin = !f.comprovante ? '<span class="pp-mut">Sem comprovante do recolhimento ainda.</span>'
        : capDiverge[t] ? '<span class="pp-mut">Pago ' + money(f.pago) + ' · aguarda a conciliação de apuração deste tributo.</span>'
        : f.diverge ? '<span class="pp-st pp-st-erro">divergente</span> Pago ' + money(f.pago) + ' · reconhecido ' + money(f.reconhecido) + ref(cF)
        : '<span class="pp-conf ok" style="margin:0">Confere</span> Pago ' + money(f.pago) + ' · reconhecido ' + money(f.reconhecido);
      return '<div class="pp-card">' + hdr
        + '<div class="pp-scroll"><table class="pp-tab pp-conf-t"><thead><tr><th>Parcela</th><th class="r">SplitHub</th><th class="r">' + org + '</th><th class="r">Diferença</th><th>Situação</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        + (nDiv ? '<div class="pp-nota">' + nDiv + ' parcela' + (nDiv > 1 ? 's' : '') + ' divergente' + (nDiv > 1 ? 's' : '') + ' · nenhum dos valores foi aplicado' + ref(cC) + '</div>' : '')
        + '<div class="pp-sub">Financeiro · pago × extinção reconhecida</div><div class="pp-ev-desc">' + fin + '</div>'
        + '</div>';
    }).join('') + '</div>';
  };

  P.aplicarNaBase = function () {
    var L = window.nfListaFiltradaGlobal || window._nfListaCompleta || [];
    var n = 0;
    L.forEach(function (nf) {
      if (nf.tipo !== 'entrada') return;
      (nf.registrosFiscais || []).forEach(function (rf) { montar(rf, nf); n++; });
    });
    P._aplicado = n;
  };

  /* ── telas ────────────────────────────────────────────────────────────── */
  var COR_ST = {
    not_appropriated: '--amber-rgb', partially_appropriated: '--teal-rgb', appropriated: '--teal-rgb',
    partially_utilized: '--teal-rgb', utilized: '--teal-rgb', disallowed: '--status-red-rgb', expired: '--status-red-rgb', cancelled: '--blue-rgb'
  };
  P.selo = function (rf, comTributo) {
    var st = rf.statusParcial || 'not_appropriated';
    var rgb = COR_ST[st] || '--blue-rgb';
    var lbl = (comTributo ? String(rf.tipoFiscal || '').toUpperCase() + ' · ' : '') + (P.STATUS[st] || st);
    var cor = st === 'disallowed' || st === 'expired' ? 'var(--status-red)' : st === 'not_appropriated' ? 'var(--amber)' : 'var(--teal)';
    return '<span title="' + esc(P.STATUS[st] || st) + '" style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:.03em;padding:1px 7px;border-radius:3px;white-space:nowrap;'
      + 'color:' + cor + ';background:rgba(var(' + rgb + '),.1);border:1px solid rgba(var(' + rgb + '),.3)">' + esc(lbl) + '</span>';
  };
  P.barra = function (rf, alto) {
    var b = rf.balances || {}, ap = P.apurado(b) || 1;
    var seg = P.PARC.filter(function (p) { return b[p.k] > 0; }).map(function (p) {
      return '<span title="' + esc(p.rot + ' ' + money(b[p.k])) + '" style="display:block;flex:' + (b[p.k] / ap) + ' 0 0;background:' + p.cor + ';min-width:2px"></span>';
    }).join('');
    return '<div role="img" aria-label="Partição" style="display:flex;height:' + (alto || 6) + 'px;border-radius:3px;overflow:hidden;background:var(--border);margin-top:3px;min-width:90px">' + seg + '</div>';
  };
  function rfsDe(nf) {
    var rfs = (nf.registrosFiscais || []).filter(function (rf) { return rf.balances; });
    return rfs.sort(function (a, b) { return a.tipoFiscal === 'cbs' ? -1 : b.tipoFiscal === 'cbs' ? 1 : 0; });
  }
  // listagem de documentos: um selo e uma barra por tributo (RF-CRE-077)
  P.celulaDF = function (nf) {
    var rfs = rfsDe(nf);
    if (!rfs.length) return '<span style="color:var(--txt3)">—</span>';
    return rfs.map(function (rf) { return '<div style="margin:2px 0 4px">' + P.selo(rf, true) + P.barra(rf, 5) + '</div>'; }).join('');
  };
  P.aApropriar = function (nf) {
    return rfsDe(nf).reduce(function (s, rf) { return s + (rf.balances.pending || 0); }, 0);
  };
  P.flagsHtml = function (rf) {
    var cfg = { vencido: ['Vencido', '--status-red-rgb', 'var(--status-red)'], em_risco: ['Em risco', '--amber-rgb', 'var(--amber)'], a_prescrever: ['A prescrever', '--amber-rgb', 'var(--amber)'], inconsistencia: ['Inconsistência', '--status-red-rgb', 'var(--status-red)'] };
    return (rf.flagsFatia || []).map(function (x) {
      var c = cfg[x.f] || [x.f, '--blue-rgb', 'var(--blue)'];
      return '<span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:3px;white-space:nowrap;display:inline-block;margin:1px 1px 0 0;color:' + c[2] + ';background:rgba(var(' + c[1] + '),.1);border:1px solid rgba(var(' + c[1] + '),.3)">'
        + c[0] + (x.valor != null ? ' · ' + money(x.valor) : '') + '</span>';
    }).join('');
  };
  P.selosDF = function (nf) {
    return rfsDe(nf).map(function (rf) { return P.selo(rf, true); }).join(' ');
  };

  // detalhe do documento: um painel por tributo (T-02, RF-CRE-081)
  P.painel = function (rf, nf) {
    var b = rf.balances, trib = rf.tipoFiscal === 'ibs' ? 'ibs' : 'cbs';
    var ap = P.apurado(b), v = r2(rf.valor);
    var linhas = P.PARC.filter(function (p) { return p.k !== 'refund_available' || trib === 'ibs'; }).map(function (p) {
      var val = b[p.k];
      var dir = val === null ? '<em style="color:var(--txt3)">não informado</em>' : money(val);
      return '<div style="display:flex;justify-content:space-between;gap:8px;font-size:11.5px;padding:3px 0;border-bottom:1px solid var(--border)">'
        + '<span style="display:flex;align-items:center;gap:6px;color:var(--txt2)"><span style="width:8px;height:8px;border-radius:2px;background:' + p.cor + ';display:inline-block"></span>' + p.rot + '</span>'
        + '<span style="font-family:var(--font-mono,monospace);color:var(--txt1)">' + dir + '</span></div>';
    }).join('');
    var fecha = Math.abs(ap - v) < 0.01;
    var conf = fecha
      ? '<span style="color:var(--green);font-weight:700">Soma das parcelas = apurado</span>'
      : '<span style="color:var(--status-red);font-weight:700">Soma das parcelas (' + money(ap) + ') diferente do apurado (' + money(v) + ') — inconsistência</span>';
    var prazo = rf.prazoArt54Prox ? ' · limite art. 54 mais próximo: ' + money(b.available) + ' em ' + br(rf.prazoArt54Prox) : '';
    var leitura = trib === 'cbs' ? 'consulta à Receita Federal de hoje, 06:00' : 'arquivo diário do Comitê Gestor de hoje';
    var nulos = trib === 'ibs' ? ' · ' + NULO_IBS.length + ' parcelas não informadas pelo Comitê Gestor' : '';
    return '<div style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;background:var(--card);min-width:0">'
      + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px"><strong style="font-size:12px;color:var(--txt1)">' + trib.toUpperCase() + ' · ' + ORGAO[trib] + '</strong>'
      + '<span style="font-size:11px;color:var(--txt3)">apurado ' + money(v) + '</span>' + P.selo(rf, false) + '</div>'
      + P.barra(rf, 10) + '<div style="margin-top:6px">' + linhas + '</div>'
      + '<div style="font-size:10.5px;color:var(--txt3);margin-top:6px;line-height:1.5">' + conf + prazo + nulos + ' · ' + leitura + '</div>'
      + (rf.flagsFatia && rf.flagsFatia.length ? '<div style="margin-top:6px">' + P.flagsHtml(rf) + '</div>' : '')
      + '<div style="margin-top:8px"><button onclick="window.shParcial.abrirMovimentos(\'' + esc(rf.id) + '\')" style="background:none;border:1px solid var(--border);border-radius:4px;color:var(--teal);cursor:pointer;font-size:10.5px;font-weight:700;padding:3px 8px">Movimentos de valor →</button></div>'
      + '</div>';
  };
  P.secaoDF = function (nf) {
    var rfs = rfsDe(nf);
    if (!rfs.length) return '';
    return '<div class="mbox-section-label">Partição do crédito por tributo</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:10px;margin-bottom:16px">'
      + rfs.map(function (rf) { return P.painel(rf, nf); }).join('') + '</div>';
  };

  // histórico de movimentos (T-03, RF-CRE-082)
  P.tabelaMovimentos = function (rf) {
    var ms = (rf.movimentos || []).slice().sort(function (a, b) { return a.reconhecidoEm < b.reconhecidoEm ? -1 : 1; });
    if (!ms.length) return '<div style="color:var(--txt3);font-size:12px">Sem movimentos.</div>';
    var th = 'style="text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--txt3);padding:6px 8px;border-bottom:1px solid var(--border);white-space:nowrap"';
    var td = 'style="font-size:11.5px;padding:6px 8px;border-bottom:1px solid var(--border);vertical-align:top;color:var(--txt2)"';
    var parc = function (k) {
      if (!k) return '—';
      var p = P.PARC.filter(function (x) { return x.k === k; })[0] || { cor: 'var(--border)', rot: k };
      return '<span style="display:inline-flex;align-items:center;gap:5px;white-space:nowrap"><span style="width:8px;height:8px;border-radius:2px;background:' + p.cor + ';display:inline-block"></span>' + p.rot + '</span>';
    };
    var sub = 'style="display:block;font-size:10.5px;color:var(--txt3);margin-top:2px"';
    return '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:440px"><thead><tr>'
      + ['Reconhecido em', 'De → para', 'Valor', 'Causa · fonte · vínculo'].map(function (h) { return '<th ' + th + '>' + h + '</th>'; }).join('')
      + '</tr></thead><tbody>'
      + ms.map(function (m) {
        return '<tr><td ' + td + '>' + br(m.reconhecidoEm) + '</td>'
          + '<td ' + td + '>' + parc(m.de) + '<span style="display:block;color:var(--txt3);font-size:10px;margin:1px 0 1px 2px">↓</span>' + parc(m.para) + '</td>'
          + '<td ' + td.replace('color:var(--txt2)', 'color:var(--txt1);font-family:var(--font-mono,monospace);white-space:nowrap') + '>' + money(m.valor) + '</td>'
          + '<td ' + td + '><span style="color:var(--txt1)">' + esc(m.causa) + '</span>'
          + '<span ' + sub + '>' + esc(m.fonte) + '</span>'
          + (m.vinculo ? '<span ' + sub + '>' + esc(m.vinculo) + '</span>' : '')
          + (m.prazoArt54 ? '<span ' + sub + '>Limite art. 54: ' + br(m.prazoArt54) + '</span>' : '')
          + '</td></tr>';
      }).join('')
      + '</tbody></table></div>';
  };
  P.csv = function (rf) {
    var linhas = [['reconhecido_em', 'de', 'para', 'valor', 'causa', 'fonte', 'vinculo', 'prazo_art54']];
    (rf.movimentos || []).forEach(function (m) { linhas.push([m.reconhecidoEm, m.de || '', m.para, m.valor.toFixed(2), m.causa, m.fonte, m.vinculo || '', m.prazoArt54 || '']); });
    var txt = linhas.map(function (l) { return l.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(';'); }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' }));
    a.download = 'movimentos-' + rf.id + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
  };
  // abas do detalhe do RF: Movimentos de valor | Eventos
  P.abas = function (rf, eventosHtml, nEventos) {
    var id = 'rfmov-' + String(rf.id).replace(/[^\w-]/g, '');
    var bt = function (k, rot, on) {
      return '<button data-aba="' + k + '" onclick="window.shParcial.trocarAba(\'' + id + '\',\'' + k + '\')" style="background:none;border:none;border-bottom:2px solid ' + (on ? 'var(--teal)' : 'transparent')
        + ';color:' + (on ? 'var(--txt1)' : 'var(--txt3)') + ';font-weight:700;font-size:12px;padding:6px 2px;margin-right:16px;cursor:pointer">' + rot + '</button>';
    };
    return '<div id="' + id + '">'
      + '<div style="display:flex;align-items:center;border-bottom:1px solid var(--border);margin-bottom:12px">' + bt('mov', 'Movimentos de valor', true) + bt('ev', 'Eventos · ' + nEventos, false)
      + '<button onclick="window.shParcial.csv(window._rfIndex[\'' + esc(rf.id) + '\'].rf)" style="margin-left:auto;background:none;border:1px solid var(--border);border-radius:4px;color:var(--teal);cursor:pointer;font-size:10.5px;font-weight:700;padding:3px 8px">Exportar CSV</button></div>'
      + '<div data-painel="mov">' + P.tabelaMovimentos(rf)
      + '<div style="font-size:10.5px;color:var(--txt3);margin-top:8px">Cada linha move uma quantia de uma parcela para outra. Os movimentos de cada parcela somam o saldo dela; a data é a do reconhecimento pelo órgão.</div></div>'
      + '<div data-painel="ev" style="display:none">' + eventosHtml + '</div></div>';
  };
  P.trocarAba = function (id, k) {
    var box = document.getElementById(id); if (!box) return;
    Array.prototype.forEach.call(box.querySelectorAll('[data-painel]'), function (el) { el.style.display = el.getAttribute('data-painel') === k ? '' : 'none'; });
    Array.prototype.forEach.call(box.querySelectorAll('[data-aba]'), function (el) {
      var on = el.getAttribute('data-aba') === k;
      el.style.borderBottomColor = on ? 'var(--teal)' : 'transparent';
      el.style.color = on ? 'var(--txt1)' : 'var(--txt3)';
    });
  };
  P.abrirMovimentos = function (rfId) {
    var o = document.getElementById('nf-detalhe-overlay'); if (o) o.remove();
    if (window.abrirDetalheRF) window.abrirDetalheRF(rfId);
  };
  P.resumoRF = function (rf) {
    var b = rf.balances || {};
    return P.selo(rf, false) + P.barra(rf, 6)
      + '<div style="font-size:10.5px;color:var(--txt3);margin-top:4px">'
      + ['pending', 'available', 'utilized', 'not_appropriable'].filter(function (k) { return b[k] > 0; }).map(function (k) { return P.rot(k) + ' ' + money(b[k]); }).join(' · ')
      + '</div>';
  };
})();

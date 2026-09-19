/* ═══════════════════════════════════════════════════════════════════════════
   Motor de compensação (art. 53 da LC 214/2025) — VERSÃO DE VALIDAÇÃO
   Branch motor-art53 · roda só localmente.

   Primeira entrega: o motor calcula sobre uma CÓPIA da base e gera o relatório
   "antes × depois". Nenhuma tela, indicador ou registro do app é alterado.

   Ordem de uso do crédito (art. 53): 1º saldo a recolher vencido; 2º débitos
   do mesmo período; o que sobra é saldo credor (compensa depois ou é ressarcido).
   Split Payment e RAD extinguem débitos antes do crédito.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var M = window.shMotor = window.shMotor || {};
  // Decisões de 18/09/2026: split fora por enquanto; preservar meses devedores —
  // o saldo que sai para ressarcimento (plano do módulo) deixa de compensar.
  M.opcoes = M.opcoes || { split: 0, periodo: 'emissao', vencidos: 'preservar', ressarcimento: 'modulo', pedido: 'modulo' };

  var MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function perAdd(k, n) { var p = k.split('-'); var d = new Date(+p[0], +p[1] - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  // Plano de ressarcimento do módulo (mesmos períodos e proporções da base simulada),
  // agora sobre o saldo credor que o motor apura.
  function plano(T, ref) {
    if (T === 'CBS') return [
      { p: perAdd(ref, -4), tipo: 'pedido', frac: 0.6, status: 'pago', id: 'PED-CBS-' + perAdd(ref, -4) },
      { p: perAdd(ref, -2), tipo: 'pedido', frac: 0.7, status: 'em_analise', id: 'PED-CBS-' + perAdd(ref, -2) },
      { p: perAdd(ref, -1), tipo: 'intencao', frac: 1, status: 'declarada', id: 'INT-CBS-' + perAdd(ref, -1) }];
    return [
      { p: perAdd(ref, -4), tipo: 'pedido', frac: 0.6, status: 'pago', parcial: true, id: 'PED-IBS-' + perAdd(ref, -4) },
      { p: perAdd(ref, -2), tipo: 'pedido', frac: 0.5, status: 'em_analise', id: 'PED-IBS-' + perAdd(ref, -2) }];
  }
  function perLbl(k) { var p = k.split('-'); return MES[+p[1] - 1] + '/' + p[0]; }
  function fimMes(k) { var p = k.split('-'); var d = new Date(+p[0], +p[1], 0); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function br(iso) { var p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; }
  function money(v) { return 'R$ ' + (Math.round((v || 0) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function mi(v) { return (Math.round((v || 0) / 1e4) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function T_(rf) { return String(rf.tipoFiscal || '').toUpperCase(); }
  function sc(rf) { return rf.statusCredito || rf.status || ''; }

  /* ── cópia da base, sem o ressarcimento aplicado ─────────────────────── */
  function copiaBase() {
    var viva = window._nfListaCompleta || window.nfListaFiltradaGlobal || [];
    var L = JSON.parse(JSON.stringify(viva, function (k, v) {
      if (k === '_inconsistencias' || k === '_resEventos' || k === '_eventos') return undefined;
      return v;
    }));
    // O motor parte da base antes do ressarcimento: o ressarcimento passa a
    // depender do saldo credor que o motor apura.
    L.forEach(function (nf) {
      if (nf._resOrigDF) { var o = nf._resOrigDF; nf.status = o.status; nf.statusCredito = o.statusCredito; nf.metodoExtincao = o.metodoExtincao; nf.dataExtincaoCredito = o.dataExtincaoCredito; delete nf._resOrigDF; }
      (nf.registrosFiscais || []).forEach(function (rf) {
        if (rf._resOrig) { var r = rf._resOrig; rf.statusCredito = r.statusCredito; rf.status = r.status; rf.metodoExtincao = r.metodoExtincao; rf.dataExtincaoCredito = r.dataExtincaoCredito; rf.dataExtincao = r.dataExtincao; delete rf._resOrig; }
        delete rf.ressarcimento;
      });
    });
    return L;
  }

  /* ── Split Payment nas vendas ───────────────────────────────────────────
     Uma parcela determinística das NFs de saída passa a ter os débitos
     extintos na liquidação, por split. Cenários (vencido, inconsistência) e
     débitos já extintos por RAD não mudam. */
  function aplicarSplit(L, pct) {
    var n = 0;
    L.forEach(function (nf) {
      if (nf.tipo !== 'saida' || (hash('split' + nf.numero) % 100) >= pct) return;
      (nf.registrosFiscais || []).forEach(function (rf) {
        var st = rf.status;
        var livre = st === 'nao_extinto' || (st === 'extinto' && rf.metodoExtincao === 'Compensacao');
        if (!livre) return;
        var dt = window.shSomaDias ? window.shSomaDias(nf.data, 5) : nf.data;
        rf.status = 'extinto'; rf.metodoExtincao = 'Split Payment';
        rf.dataExtincao = window.shFmtDataHora ? window.shFmtDataHora(dt) : br(dt);
        rf._motor = 'split'; n++;
      });
    });
    return n;
  }

  /* ── o motor ─────────────────────────────────────────────────────────── */
  function motor(L, op) {
    var livro = [], porMes = {}, cenarioComCredito = 0;
    ['CBS', 'IBS'].forEach(function (T) {
      var creds = [], debs = [];
      L.forEach(function (nf) {
        (nf.registrosFiscais || []).forEach(function (rf) {
          if (T_(rf) !== T) return;
          if (nf.tipo === 'entrada') {
            var s = sc(rf);
            if (s !== 'apropriado' && s !== 'utilizado') return;
            var per = (op.periodo === 'apropriacao' && rf.dataApropriacao ? String(rf.dataApropriacao) : String(rf.data || nf.data)).slice(0, 7);
            creds.push({ rf: rf, nf: nf, per: per, ord: String(rf.dataApropriacao || rf.data || '') + rf.id, saldo: rf.valor || 0 });
          } else {
            var st = rf.status;
            var cobre = st === 'nao_extinto' || (st === 'extinto' && rf.metodoExtincao === 'Compensacao') || (op.vencidos === 'compensar' && st === 'vencido');
            if (!cobre) return;
            debs.push({ rf: rf, nf: nf, per: String(nf.data || rf.data).slice(0, 7), ord: String(nf.data || '') + rf.id, falta: rf.valor || 0, orig: st });
          }
        });
      });
      creds.sort(function (a, b) { return a.per < b.per ? -1 : a.per > b.per ? 1 : (a.ord < b.ord ? -1 : 1); });
      debs.sort(function (a, b) { return a.per < b.per ? -1 : a.per > b.per ? 1 : (a.ord < b.ord ? -1 : 1); });
      var meses = {};
      creds.forEach(function (c) { meses[c.per] = 1; }); debs.forEach(function (d) { meses[d.per] = 1; });
      var ks = Object.keys(meses).sort();
      var fila = [];   // débitos em aberto, do mais antigo para o mais novo (art. 53, 1º e 2º)
      var ci = 0, pool = [];
      ks.forEach(function (k) {
        while (ci < creds.length && creds[ci].per <= k) pool.push(creds[ci++]);
        // deferimento parcial: o não reconhecido volta a compensar a partir da decisão
        pool.forEach(function (c) { if (c.volta === k) { c.saldo = c.rf.valor || 0; c.res = null; c.volta = null; c.voltou = true; c.rf._disponivelDesde = k; } });
        debs.forEach(function (d) { if (d.per === k) fila.push(d); });
        var comp = 0;
        for (var i = 0; i < fila.length; i++) {
          var d = fila[i];
          while (d.falta > 0.005) {
            var c = null; for (var j = 0; j < pool.length; j++) { if (pool[j].saldo > 0.005) { c = pool[j]; break; } }
            if (!c) break;
            var v = Math.min(d.falta, c.saldo);
            c.saldo -= v; d.falta -= v; comp += v;
            if (c.saldo <= 0.005 && !c.fim) c.fim = k;
            if (d.falta <= 0.005) d.fim = k;
            livro.push({ tributo: T, mes: k, cred: c.rf.id, credDF: c.nf.numero, deb: d.rf.id, debDF: d.nf.numero, valor: v });
          }
        }
        // O que o crédito não cobriu é o tributo a recolher DO MÊS: vai para guia e não
        // espera crédito futuro. Só o débito vencido e não pago segue na fila (art. 53, 1º).
        var aRecolherMes = fila.filter(function (d) { return d.falta > 0.005 && d.orig !== 'vencido'; }).reduce(function (s, d) { return s + d.falta; }, 0);
        fila = fila.filter(function (d) { return d.falta > 0.005 && d.orig === 'vencido'; });
        // fim do período: o saldo que vai para ressarcimento sai do caminho da compensação
        var saiu = 0;
        if (op.ressarcimento === 'modulo') plano(T, op.ref).forEach(function (pl) {
          if (pl.p !== k) return;
          var livres = pool.filter(function (c) { return !c.res && c.saldo >= (c.rf.valor || 0) - 0.005 && c.saldo > 0.005; });
          var alvo = livres.reduce(function (s, c) { return s + c.saldo; }, 0) * (op.pedido === 'integral' ? 1 : pl.frac), acum = 0, sel = [];
          livres.forEach(function (c) { if (acum < alvo - 0.005 || !sel.length) { sel.push(c); acum += c.saldo; } });
          sel.forEach(function (c, i) {
            c.res = { id: pl.id, tipo: pl.tipo, status: pl.status, per: k }; saiu += c.saldo; c.saldo = 0;
            if (pl.parcial && i === sel.length - 1 && sel.length > 1) c.volta = perAdd(k, 3);
          });
        });
        var saldo = pool.reduce(function (s, c) { return s + Math.max(0, c.saldo); }, 0);
        porMes[T + '|' + k] = { tributo: T, mes: k, compensado: comp, saldoCredor: saldo, aRecolher: aRecolherMes, vencidoAberto: fila.reduce(function (s, d) { return s + d.falta; }, 0), ressarcimento: saiu };
      });
      // grava o resultado na cópia
      creds.forEach(function (c) {
        var usado = (c.rf.valor || 0) - Math.max(0, c.saldo);
        c.rf._valorCompensado = usado;
        if (c.res) {
          if (c.res.status === 'pago') { c.rf.statusCredito = 'utilizado'; c.rf.status = 'utilizado'; c.rf.metodoExtincao = 'Ressarcimento'; c.rf.dataExtincaoCredito = fimMes(perAdd(c.res.per, 3)); c.rf._valorCompensado = 0; }
          else { c.rf.statusCredito = 'apropriado'; c.rf.status = 'apropriado'; c.rf.metodoExtincao = null; c.rf.dataExtincaoCredito = null; c.rf._valorCompensado = 0; c.rf.ressarcimento = { marca: c.res.tipo === 'intencao' ? 'reservado' : 'em_pedido', ref: c.res.id, tributo: T }; }
          return;
        }
        if (c.saldo <= 0.005) { c.rf.statusCredito = 'utilizado'; c.rf.status = 'utilizado'; c.rf.metodoExtincao = 'Compensacao'; c.rf.dataExtincaoCredito = fimMes(c.fim); }
        else { c.rf.statusCredito = 'apropriado'; c.rf.status = 'apropriado'; c.rf.metodoExtincao = null; c.rf.dataExtincaoCredito = null; if (usado > 0.005) c.rf._parcial = true; }
      });
      debs.forEach(function (d) {
        var usado = (d.rf.valor || 0) - d.falta;
        d.rf._valorCompensado = usado;
        if (d.falta <= 0.005) { d.rf.status = 'extinto'; d.rf.metodoExtincao = 'Compensacao'; d.rf.dataExtincao = br(fimMes(d.fim)) + ' 18:00'; }
        else { d.rf.status = d.orig === 'vencido' ? 'vencido' : 'nao_extinto'; d.rf.metodoExtincao = null; d.rf.dataExtincao = '—'; if (usado > 0.005) d.rf._parcial = true; }
      });
    });
    // débitos de cenário preservados (vencido/inconsistência) em mês com crédito sobrando
    L.forEach(function (nf) {
      if (nf.tipo !== 'saida') return;
      (nf.registrosFiscais || []).forEach(function (rf) {
        if (rf.status !== 'vencido' && rf.status !== 'inconsistencia') return;
        var pm = porMes[T_(rf) + '|' + String(nf.data).slice(0, 7)];
        if (pm && pm.saldoCredor > 0.005) cenarioComCredito++;
      });
    });
    return { livro: livro, porMes: porMes, cenarioComCredito: cenarioComCredito };
  }

  /* ── indicadores, com as mesmas regras das telas ─────────────────────── */
  function indicadores(L) {
    var o = {
      credTotal: 0, credAprop: 0, credUtil: 0, credComp: 0, credRes: 0, credNao: 0, credGlos: 0, credInc: 0, credParcial: 0, credParcialN: 0,
      debTotal: 0, debExt: 0, debRAD: 0, debSplit: 0, debComp: 0, debAberto: 0, debVenc: 0, debInc: 0,
      cen: { radSemComprovante: 0, credVencidos: 0, credEmRisco: 0, credAPrescrever: 0, glosados: 0, debVencidos: 0, debInconsist: 0, dfParcial: 0, ressarcidos: 0 },
      trib: { CBS: {}, IBS: {} }
    };
    ['CBS', 'IBS'].forEach(function (T) { o.trib[T] = { credComp: 0, debComp: 0, debAberto: 0, saldoParado: 0, splitRad: 0, deb: 0 }; });
    L.forEach(function (nf) {
      var sts = [];
      (nf.registrosFiscais || []).forEach(function (rf) {
        var v = rf.valor || 0, T = T_(rf), t = o.trib[T] || {};
        if (nf.tipo === 'entrada') {
          var s = sc(rf); sts.push(s);
          o.credTotal += v;
          if (s === 'apropriado' || s === 'utilizado') o.credAprop += v;
          if (s === 'utilizado') { o.credUtil += v; if (rf.metodoExtincao === 'Ressarcimento') { o.credRes += v; o.cen.ressarcidos++; } else { o.credComp += v; t.credComp = (t.credComp || 0) + v; } }
          if (s === 'apropriado') { t.saldoParado = (t.saldoParado || 0) + v - (rf._valorCompensado || 0); if (rf._parcial) { o.credParcial += rf._valorCompensado || 0; o.credParcialN++; t.credComp += rf._valorCompensado || 0; o.credComp += 0; } }
          if (s === 'nao_apropriado') o.credNao += v;
          if (s === 'glosado') { o.credGlos += v; o.cen.glosados++; }
          if (rf.statusRegistro === 'inconsistencia') o.credInc += v;
          if (rf.statusRegistro === 'vencido') o.cen.credVencidos++;
          if (rf.statusRegistro === 'em_risco') o.cen.credEmRisco++;
          if (rf.statusRegistro === 'a_prescrever') o.cen.credAPrescrever++;
          if (rf.inconsistencia === 'Sem Comprovante' || (rf.statusRegistro === 'inconsistencia' && rf.metodoPagamento === 'RAD' && s === 'nao_apropriado')) o.cen.radSemComprovante++;
        } else {
          o.debTotal += v; t.deb += v;
          if (rf.status === 'extinto') {
            o.debExt += v;
            if (rf.metodoExtincao === 'RAD') { o.debRAD += v; t.splitRad += v; }
            else if (rf.metodoExtincao === 'Split Payment') { o.debSplit += v; t.splitRad += v; }
            else if (rf.metodoExtincao === 'Compensacao') { o.debComp += v; t.debComp += v; }
          } else if (rf.status === 'nao_extinto') { o.debAberto += v - (rf._valorCompensado || 0); t.debAberto += v - (rf._valorCompensado || 0); }
          if (rf.status !== 'extinto' && rf._valorCompensado) t.debComp += rf._valorCompensado;
          if (rf.status === 'vencido') { o.debVenc += v; o.cen.debVencidos++; }
          if (rf.status === 'inconsistencia') { o.debInc += v; o.cen.debInconsist++; }
        }
      });
      if (nf.tipo === 'entrada' && sts.length && sts.some(function (s) { return s === 'utilizado'; }) && !sts.every(function (s) { return s === 'utilizado'; })) o.cen.dfParcial++;
    });
    return o;
  }

  // Conformidade: meses com crédito parado e débito do mesmo tributo em aberto
  function conformidade(L, periodo) {
    var r = { CBS: 0, IBS: 0 };
    ['CBS', 'IBS'].forEach(function (T) {
      var ms = {};
      L.forEach(function (nf) {
        (nf.registrosFiscais || []).forEach(function (rf) {
          if (T_(rf) !== T) return;
          var k = (nf.tipo === 'entrada' && periodo === 'apropriacao' && rf.dataApropriacao ? String(rf.dataApropriacao) : String(nf.data || rf.data)).slice(0, 7); ms[k] = ms[k] || { cred: 0, deb: 0 };
          // crédito disponível para compensar: apropriado, sem reserva nem pedido de
          // ressarcimento, a partir de quando voltou a compensar (deferimento parcial)
          if (nf.tipo === 'entrada' && sc(rf) === 'apropriado' && !(rf.ressarcimento && rf.ressarcimento.marca !== 'ressarcido')) {
            if (rf._disponivelDesde && rf._disponivelDesde > k) { k = rf._disponivelDesde; ms[k] = ms[k] || { cred: 0, deb: 0 }; }
            ms[k].cred += (rf.valor || 0) - (rf._valorCompensado || 0);
          }
          // débito a recolher DO MÊS (o de meses anteriores foi a guia)
          if (nf.tipo === 'saida' && rf.status === 'nao_extinto') ms[k].deb += (rf.valor || 0) - (rf._valorCompensado || 0);
        });
      });
      var cred = 0;
      Object.keys(ms).sort().forEach(function (k) { cred += ms[k].cred; if (cred > 0.005 && ms[k].deb > 0.005) r[T]++; });
    });
    return r;
  }

  /* ── cálculo completo ────────────────────────────────────────────────── */
  M.calcular = function () {
    var op = M.opcoes;
    var hoje = window._nfListaCompleta || [];
    var base = copiaBase();
    op.ref = (window.shRes && window.shRes.ref) || '2026-09';
    var nSplit = aplicarSplit(base, op.split);
    var mt = motor(base, op);
    var res = {
      op: JSON.parse(JSON.stringify(op)), nSplit: nSplit, mt: mt,
      hoje: indicadores(hoje), motor: indicadores(base),
      confHoje: conformidade(hoje, 'emissao'), confMotor: conformidade(base, op.periodo), base: base
    };
    // ressarcimento: saldo credor disponível hoje (módulo) × pelo motor (mês de referência)
    var ref = (window.shRes && window.shRes.ref) || '2026-09';
    res.ref = ref;
    res.resHoje = {}; res.resMotor = {}; res.mesesCredores = {};
    ['CBS', 'IBS'].forEach(function (T) {
      try { res.resHoje[T] = window.shRes && window.shRes.resumo ? window.shRes.resumo(T).disponivel : null; } catch (e) { res.resHoje[T] = null; }
      var pm = mt.porMes[T + '|' + ref]; res.resMotor[T] = pm ? pm.saldoCredor : 0;
      res.mesesDevedores = res.mesesDevedores || {};
      res.mesesDevedores[T] = Object.keys(mt.porMes).filter(function (k) { return k.indexOf(T + '|') === 0 && mt.porMes[k].aRecolher > 0.005; }).map(function (k) { return perLbl(k.split('|')[1]); });
      res.mesesCredores[T] = Object.keys(mt.porMes).filter(function (k) { return k.indexOf(T + '|') === 0 && mt.porMes[k].saldoCredor > 0.005 && mt.porMes[k].aRecolher <= 0.005; }).length;
    });
    // equilíbrio do livro: crédito compensado = débito compensado
    res.livroCred = {}; res.livroDeb = {};
    ['CBS', 'IBS'].forEach(function (T) {
      res.livroCred[T] = mt.livro.filter(function (x) { return x.tributo === T; }).reduce(function (s, x) { return s + x.valor; }, 0);
    });
    M.ultimo = res;
    return res;
  };

  /* ── relatório ───────────────────────────────────────────────────────── */
  function css() {
    if (document.getElementById('mt-css')) return;
    var s = document.createElement('style'); s.id = 'mt-css';
    s.textContent = [
      '@media (max-width:768px){.mt-previa{bottom:74px!important}}',
      '.mt-previa{position:fixed;bottom:14px;right:14px;z-index:1500;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:var(--purple);border-radius:20px;padding:4px 10px;box-shadow:0 2px 8px rgba(0,0,0,.25);pointer-events:none}',
      '.mt-aviso{border:1px dashed var(--purple);background:color-mix(in srgb,var(--purple) 7%,transparent);border-radius:10px;padding:11px 14px;margin-bottom:16px;font-size:12px;color:var(--txt2);line-height:1.55}',
      '.mt-aviso b{color:var(--txt1)}',
      '.mt-op{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;margin-bottom:16px}',
      '.mt-op label{display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--txt3);font-weight:600}',
      '.mt-op select{background:var(--card);border:1px solid var(--border);border-radius:6px;color:var(--txt1);font:inherit;font-size:12.5px;padding:6px 8px}',
      '.mt-eq{color:var(--txt3)}',
      '.mt-up{color:var(--amber);font-weight:700}',
      '.mt-ok{color:var(--green);font-weight:700}',
      '.mt-bad{color:var(--red);font-weight:700}',
      '.mt-sec{font-family:var(--font-brand);font-size:15px;font-weight:700;color:var(--p-teal);margin:22px 0 8px}',
      '.mt-note{font-size:11.5px;color:var(--txt3);margin:6px 0 0;line-height:1.5}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function dif(a, b, unid) {
    var d = (b || 0) - (a || 0);
    if (Math.abs(d) < (unid === 'n' ? 0.5 : 5000)) return '<span class="mt-eq">igual</span>';
    var s = unid === 'n' ? (d > 0 ? '+' : '') + Math.round(d) : (d > 0 ? '+' : '−') + mi(Math.abs(d));
    return '<span class="mt-up">' + s + '</span>';
  }
  function linha(tela, nome, a, b, unid, nota) {
    var f = unid === 'n' ? function (x) { return x == null ? '—' : String(Math.round(x)); } : function (x) { return x == null ? '—' : mi(x); };
    return '<tr><td class="nowrap">' + tela + '</td><td>' + nome + (nota ? '<div class="mt-note">' + nota + '</div>' : '') + '</td><td class="r mono">' + f(a) + '</td><td class="r mono">' + f(b) + '</td><td class="r mono nowrap">' + dif(a, b, unid) + '</td></tr>';
  }
  function tabela(titulo, sub, corpo, cols) {
    return '<div class="tcrd"><div class="tcrd-hdr"><div class="sechdr" style="margin-bottom:0"><h2>' + titulo + '</h2><p>' + sub + '</p></div></div>'
      + '<div class="twrap" style="--twrap-h:none"><table><thead><tr>' + cols.map(function (c) { return '<th' + (/^(Hoje|Com o motor|Diferença|R\$|Valor)/.test(c) ? ' class="r"' : '') + '>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' + corpo + '</tbody></table></div></div>';
  }

  M.render = function () {
    css();
    var el = document.getElementById('view-validacao-motor'); if (!el) return;
    if (!(window._nfListaCompleta || []).length) { el.innerHTML = '<div class="pg-sub">Carregando a base…</div>'; setTimeout(M.render, 600); return; }
    var r = M.calcular(), h = r.hoje, m = r.motor, op = r.op;
    var H = '';
    H += '<div class="pg-hdr"><div><div class="pg-title">Validação do motor de compensação</div><div class="pg-sub">Versão local · branch motor-art53 · relatório “antes × depois” · as telas do app seguem sem o motor</div></div>'
      + '<div class="hdr-act"><button class="btn" onclick="shMotor.baixarCSV()">↓ CSV do relatório</button><button class="btn" onclick="shMotor.baixarLivro()">↓ Livro do motor</button></div></div>';
    H += '<div class="mt-aviso"><b>Nada foi alterado no app.</b> O motor roda sobre uma cópia da base carregada agora e compara com o que as telas mostram. '
      + (/[?&]estavel=1/.test(location.search) ? '<b>Base estável ligada</b> — os números se repetem a cada recarga.' : 'Para números que se repetem a cada recarga, abra com <code>?estavel=1</code>.') + '</div>';
    H += '<div class="mt-note" style="margin:-6px 0 14px"><b>Decisões registradas:</b> split fora por enquanto (18/09/2026) · '
      + 'meses devedores preservados pelo plano de ressarcimento do módulo, com pedidos parciais — dois meses: CBS nov/26 e IBS jun/26 (19/09/2026). '
      + 'As opções abaixo servem para comparar; o padrão é o decidido.</div>';
    H += '<div class="mt-op">'
      + '<label>Vendas por Split Payment<select id="mt-split" onchange="shMotor.set(\'split\',+this.value)">' + [0, 25, 50, 75].map(function (p) { return '<option value="' + p + '"' + (op.split === p ? ' selected' : '') + '>' + p + '% das NFs de saída</option>'; }).join('') + '</select></label>'
      + '<label>Período do crédito<select onchange="shMotor.set(\'periodo\',this.value)"><option value="emissao"' + (op.periodo === 'emissao' ? ' selected' : '') + '>Mês de emissão (como hoje)</option><option value="apropriacao"' + (op.periodo === 'apropriacao' ? ' selected' : '') + '>Mês da apropriação (art. 47)</option></select></label>'
      + '<label>Ressarcimento<select onchange="shMotor.set(\'ressarcimento\',this.value)"><option value="modulo"' + (op.ressarcimento === 'modulo' ? ' selected' : '') + '>Seguir o plano do módulo</option><option value="nenhum"' + (op.ressarcimento === 'nenhum' ? ' selected' : '') + '>Sem ressarcimento</option></select></label>'
      + '<label>Pedidos de ressarcimento<select onchange="shMotor.set(\'pedido\',this.value)"><option value="modulo"' + (op.pedido !== 'integral' ? ' selected' : '') + '>Como no módulo (parciais)</option><option value="integral"' + (op.pedido === 'integral' ? ' selected' : '') + '>Integrais</option></select></label>'
      + '<label>Débitos vencidos<select onchange="shMotor.set(\'vencidos\',this.value)"><option value="preservar"' + (op.vencidos === 'preservar' ? ' selected' : '') + '>Preservar o cenário</option><option value="compensar"' + (op.vencidos === 'compensar' ? ' selected' : '') + '>Compensar (art. 53, 1º)</option></select></label>'
      + '</div>';

    // 1. conformidade
    var cT = ['CBS', 'IBS'].map(function (T) {
      var eq = Math.abs((m.trib[T].credComp) - (m.trib[T].debComp)) < 1;
      return '<tr><td>' + T + '</td><td class="r mono">' + mi(h.trib[T].credComp) + ' × ' + mi(h.trib[T].debComp) + '</td><td class="r mono">' + mi(m.trib[T].credComp) + ' × ' + mi(m.trib[T].debComp) + '</td><td>' + (eq ? '<span class="mt-ok">Casa</span>' : '<span class="mt-bad">Não casa</span>') + '</td>'
        + '<td class="r mono">' + r.confHoje[T] + '</td><td class="r mono">' + r.confMotor[T] + '</td></tr>';
    }).join('');
    H += '<div class="mt-sec">1. Conformidade com o art. 53</div>';
    H += tabela('Crédito compensado × débito extinto por compensação', 'R$ milhões · e meses com crédito parado e débito do mesmo tributo em aberto', cT,
      ['Tributo', 'Hoje (crédito × débito)', 'Com o motor', 'Resultado', 'Meses em desacordo · hoje', 'Com o motor']);
    H += '<p class="mt-note">Débitos de cenário preservados (vencidos ou com inconsistência) em mês com crédito sobrando: <b>' + r.mt.cenarioComCredito + '</b>. '
      + (op.vencidos === 'preservar' ? 'Com “Compensar”, os vencidos entram na ordem do art. 53.' : '') + '</p>';

    // 2. indicadores por tela
    var L2 = ''
      + linha('Início', 'Total originado', h.credTotal, m.credTotal)
      + linha('Início', 'Apropriados', h.credAprop, m.credAprop)
      + linha('Início', 'A apropriar', h.credNao, m.credNao)
      + linha('Crédito', 'Utilizados', h.credUtil, m.credUtil, null, 'Com o motor: só o que abateu débito; o ressarcimento volta a depender do saldo credor')
      + linha('Crédito', 'Utilizados · compensados', h.credComp, m.credComp)
      + linha('Crédito', 'Utilizados · ressarcidos', h.credRes, m.credRes)
      + linha('Crédito', 'Compensação parcial (valor)', 0, m.credParcial, null, m.credParcialN + ' RFs usados em parte — status segue Apropriado')
      + linha('Crédito', 'Glosados', h.credGlos, m.credGlos)
      + linha('Crédito', 'Com inconsistência', h.credInc, m.credInc)
      + linha('Débito', 'Total', h.debTotal, m.debTotal)
      + linha('Débito', 'Extinto · RAD', h.debRAD, m.debRAD)
      + linha('Débito', 'Extinto · Split Payment', h.debSplit, m.debSplit, null, r.nSplit + ' RFs de saída passam ao split')
      + linha('Débito', 'Extinto · compensação', h.debComp, m.debComp)
      + linha('Débito', 'A recolher', h.debAberto, m.debAberto)
      + linha('Débito', 'Vencidos', h.debVenc, m.debVenc)
      + linha('Débito', 'Com inconsistência', h.debInc, m.debInc)
      + ['CBS', 'IBS'].map(function (T) { return linha('Ressarcimento', 'Saldo credor disponível · ' + T + ' · ' + perLbl(r.ref), r.resHoje[T], r.resMotor[T]); }).join('')
      + ['CBS', 'IBS'].map(function (T) { return linha('Ressarcimento', 'Meses credores · ' + T, null, r.mesesCredores[T], 'n'); }).join('')
      + ['CBS', 'IBS'].map(function (T) { return linha('Débito · Apuração', 'Meses devedores (tributo a recolher) · ' + T, null, r.mesesDevedores[T].length, 'n', r.mesesDevedores[T].join(', ') || 'nenhum'); }).join('')
      + linha('Analytics · FCT', 'Posição (crédito apropriado − débito)', h.credAprop - h.debTotal, m.credAprop - m.debTotal, null, 'Não depende de status — não muda')
      + linha('Pagamentos · Conciliação', 'Créditos pagos (apropriado ou utilizado)', h.credAprop, m.credAprop, null, 'Regra “pago” não muda');
    H += '<div class="mt-sec">2. Indicadores por tela</div>';
    H += tabela('Hoje × com o motor', 'R$ milhões, salvo contagens · mesmas regras das telas', L2, ['Tela', 'Indicador', 'Hoje', 'Com o motor', 'Diferença']);

    // 3. cenários de demonstração
    var cen = [['RAD sem comprovante', 'radSemComprovante'], ['Créditos vencidos', 'credVencidos'], ['Créditos em risco', 'credEmRisco'], ['Créditos a prescrever', 'credAPrescrever'],
      ['Glosados', 'glosados'], ['Débitos vencidos', 'debVencidos'], ['Débitos com inconsistência', 'debInconsist'], ['DFs parcialmente utilizados', 'dfParcial'], ['RFs ressarcidos', 'ressarcidos']];
    H += '<div class="mt-sec">3. Cenários de demonstração</div>';
    H += tabela('Quantos casos continuam existindo', 'Contagem de RFs ou DFs', cen.map(function (c) { return linha('Roteiro', c[0], h.cen[c[1]], m.cen[c[1]], 'n'); }).join(''), ['Uso', 'Cenário', 'Hoje', 'Com o motor', 'Diferença']);
    H += '<p class="mt-note">RFs ressarcidos vão a zero porque o motor parte da base sem o ressarcimento: os pedidos serão refeitos sobre o saldo credor legítimo quando o motor for ligado.</p>';

    // 4. livro do motor por mês
    var lm = '';
    ['CBS', 'IBS'].forEach(function (T) {
      Object.keys(r.mt.porMes).filter(function (k) { return k.indexOf(T + '|') === 0; }).sort().forEach(function (k) {
        var p = r.mt.porMes[k];
        var st = p.saldoCredor > 0.005 && p.aRecolher <= 0.005 ? '<span class="mt-ok">credor</span>' : p.aRecolher > 0.005 && p.saldoCredor <= 0.005 ? '<span class="mt-up">a recolher</span>' : p.aRecolher > 0.005 ? '<span class="mt-bad">os dois</span>' : '<span class="mt-eq">zerado</span>';
        lm += '<tr><td>' + T + '</td><td>' + perLbl(p.mes) + '</td><td class="r mono">' + mi(p.compensado) + '</td><td class="r mono">' + (p.ressarcimento ? mi(p.ressarcimento) : '—') + '</td><td class="r mono">' + mi(p.aRecolher) + '</td><td class="r mono">' + mi(p.saldoCredor) + '</td><td>' + st + '</td></tr>';
      });
    });
    H += '<div class="mt-sec">4. Livro do motor, mês a mês</div>';
    H += tabela('Compensação por tributo e mês', 'R$ milhões · a recolher e saldo credor acumulados no fim do mês · o que vai para ressarcimento deixa de compensar', lm, ['Tributo', 'Mês', 'Compensado no mês', 'Para ressarcimento', 'A recolher', 'Saldo credor', 'Posição']);

    // 5. exemplo de vínculo
    var ex = r.mt.livro.slice(0), porCred = {};
    ex.forEach(function (x) { (porCred[x.cred] = porCred[x.cred] || []).push(x); });
    var alvo = Object.keys(porCred).sort(function (a, b) { return porCred[b].length - porCred[a].length; })[0];
    if (alvo) {
      var li = porCred[alvo].map(function (x) { return '<tr><td class="mono">' + x.deb + '</td><td>NF ' + esc(x.debDF) + '</td><td>' + perLbl(x.mes) + '</td><td class="r mono">' + money(x.valor) + '</td></tr>'; }).join('');
      H += '<div class="mt-sec">5. Exemplo de vínculo crédito → débitos</div>';
      H += tabela('Crédito ' + alvo + ' · NF ' + esc(porCred[alvo][0].credDF), 'Débitos que este crédito abateu, na ordem do art. 53', li, ['RF do débito', 'Documento', 'Apuração', 'Valor']);
    }
    H += '<p class="mt-note">Próxima entrega, depois da sua validação: o painel com as chaves para ligar o motor nas telas, uma mudança por vez.</p>';
    el.innerHTML = H;
  };

  M.set = function (k, v) { M.opcoes[k] = v; M.render(); };

  function baixar(nome, texto) {
    var b = new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nome; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  M.baixarCSV = function () {
    var r = M.ultimo || M.calcular(), h = r.hoje, m = r.motor;
    var linhas = [['indicador', 'hoje', 'com_motor']];
    Object.keys(h).forEach(function (k) { if (typeof h[k] === 'number') linhas.push([k, h[k].toFixed(2), m[k].toFixed(2)]); });
    Object.keys(h.cen).forEach(function (k) { linhas.push(['cenario_' + k, h.cen[k], m.cen[k]]); });
    baixar('validacao-motor-' + r.op.split + 'split-' + r.op.periodo + '.csv', linhas.map(function (l) { return l.join(';'); }).join('\n'));
  };
  M.baixarLivro = function () {
    var r = M.ultimo || M.calcular();
    var linhas = [['tributo', 'mes', 'rf_credito', 'nf_credito', 'rf_debito', 'nf_debito', 'valor']].concat(r.mt.livro.map(function (x) { return [x.tributo, x.mes, x.cred, x.credDF, x.deb, x.debDF, x.valor.toFixed(2)]; }));
    baixar('livro-motor.csv', linhas.map(function (l) { return l.join(';'); }).join('\n'));
  };

  /* ── gancho de navegação e selo de prévia ────────────────────────────── */
  function iniciar() {
    css();
    if (!document.querySelector('.mt-previa')) { var p = document.createElement('div'); p.className = 'mt-previa'; p.textContent = 'Prévia local · motor-art53'; document.body.appendChild(p); }
    if (typeof window.showView === 'function' && !window.showView._mt) {
      var sv = window.showView;
      window.showView = function (id) {
        var r = sv.apply(this, arguments);
        if (id === 'validacao-motor') { var t = document.getElementById('ah-title'); if (t) t.textContent = 'Validação do motor'; setTimeout(M.render, 0); }
        return r;
      };
      window.showView._mt = true;
      Object.keys(sv).forEach(function (k) { window.showView[k] = sv[k]; });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(iniciar, 50); });
  else setTimeout(iniciar, 50);
})();

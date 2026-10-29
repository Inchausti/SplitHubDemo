/* ══ PCONT — pagamento do saldo pelo contribuinte ═══════════════════════════
   Proposta aprovada em 29/10/2026 (docs/proposta-modulo-pcont.html v1.1,
   R-274): painel da competência com duas peças do fechamento guiado.
     · empresa do grupo econômico: cada CNPJ raiz tem a sua apuração, centralizada
       na matriz, e tudo no módulo é gerado para a empresa escolhida
     · competência: carrossel com a etapa de cada tributo e o prazo; visão
       consolidada (saldos lado a lado, nunca somados, e o desembolso de caixa)
       e análise por tributo: SplitHub × ente × diferença, com detalhamento até
       a nota e o conta corrente da operação
     · linha do tempo por competência e por ente (E1 a E8)
     · divergências por tributo e natureza, com o chamado e a decisão registrada
     · guias: DARF da CBS emitido aqui; guia do IBS registrada do portal até o
       Comitê Gestor emitir por API; envio ao ERP (pcont.guide_issued) e
       comprovante de volta (POST /v1/pcont/proofs)
     · histórico por tributo e competência, com o retrato do demonstrativo
   A CBS é da Receita Federal e o IBS do Comitê Gestor: nunca "Fisco".
   2026 é informativo (art. 348): os números vêm do cálculo do SplitHub e não
   se emite guia. 2027 é um exercício simulado para a avaliação.
   Com a flag ligada, a Apuração IBS/CBS sai do menu e o PCONT faz o cálculo
   dela: recalcular, fechar e reabrir por tributo, resumos e listagens.
   Auditoria: toda ação de usuário, do ERP e do sistema entra numa trilha
   só de acréscimo, encadeada por hash, com quem, quando, antes e depois.
   Painel executivo (flag pcont_painel): o grupo econômico e cada empresa numa
   tela, com os mesmos dados do PCONT. Soma entre empresas só dentro do mesmo
   tributo; entre tributos, só o desembolso de caixa.
   Pacote AV-PC; estado em memória, como os demais módulos do protótipo.
   ═══════════════════════════════════════════════════════════════════════════ */
/* @pacote — o estado das flags é reescrito por tools/avaliacao.py promover */
window.shFeature && shFeature.registrar({"id": "AV-PC", "nome": "PCONT · pagamento do saldo", "branch": "feat/pcont", "entrada": "#/pcont", "flags": {"pcont": "avaliacao", "pcont_painel": "avaliacao"}, "rotulos": {"pcont": "Módulo PCONT no lugar da Apuração IBS/CBS", "pcont_painel": "Painel executivo do grupo econômico e das empresas"}});
/* @fim-pacote */
(function () {
  'use strict';

  function entregue(k) { return !window.shFeature || shFeature.entrega(k); }
  if (!entregue('pcont')) return;
  // a folha de estilo vem com o módulo: o index.html só carrega o script
  (function () { if (document.getElementById('pc-css')) return; var l = document.createElement('link'); l.id = 'pc-css'; l.rel = 'stylesheet'; l.href = 'css/pcont.css?v=2'; document.head.appendChild(l); })();

  /* ── utilidades ───────────────────────────────────────────────────────── */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(v) { return (Math.round(v * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('-', '−'); }
  function fmtS(v) { return (v > 0 ? '+' : '') + fmt(v); }
  function fmtDC(v) { return fmt(Math.abs(v)) + (v >= 0 ? ' D' : ' C'); }
  function p2(n) { return ('0' + n).slice(-2); }
  function dt(y, m, d, h, mi) { return new Date(y, m - 1, d, h || 0, mi || 0); }
  function fD(d) { return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear(); }
  function fDC(d) { return p2(d.getDate()) + '/' + p2(d.getMonth() + 1); }
  function fDH(d) { return fD(d) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); }
  function diasEntre(a, b) { return Math.round((dt(b.getFullYear(), b.getMonth() + 1, b.getDate()) - dt(a.getFullYear(), a.getMonth() + 1, a.getDate())) / 864e5); }
  var MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function rot(c) { return MES[c.mes - 1].charAt(0).toUpperCase() + MES[c.mes - 1].slice(1) + '/' + String(c.ano).slice(2); }
  function rotL(c) { return MES[c.mes - 1] + '/' + c.ano; }
  var FERIADOS = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'];
  function util(d) { var w = d.getDay(); return w !== 0 && w !== 6 && FERIADOS.indexOf(p2(d.getMonth() + 1) + '-' + p2(d.getDate())) < 0; }
  // vencimento: último dia útil do mês seguinte (art. 45)
  function vencimento(ano, mes) {
    var d = dt(mes === 12 ? ano + 1 : ano, mes === 12 ? 1 : mes + 1, 1); d = dt(d.getFullYear(), d.getMonth() + 2, 0);
    while (!util(d)) d.setDate(d.getDate() - 1);
    return d;
  }
  function seguinte(ano, mes, dia) { return dt(mes === 12 ? ano + 1 : ano, mes === 12 ? 1 : mes + 1, dia); }
  function quem() { var n = document.querySelector('#app-header .ah-uname'); return (n && n.textContent.trim()) || window.CONTRATO_USUARIO_ATUAL || 'Usuário'; }
  function perfil() { var p = document.getElementById('ah-perfil-label'); return (p && p.textContent.trim()) || ''; }
  function toast(msg) {
    var t = document.getElementById('pc-toast'); if (t) t.remove();
    t = document.createElement('div'); t.id = 'pc-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { if (t.parentNode) t.remove(); }, 4500);
  }

  var ENTE = { CBS: 'Receita Federal', IBS: 'Comitê Gestor' };
  var GUIA = { CBS: 'DARF', IBS: 'documento de arrecadação' };
  var FONTE = { CBS: 'API de apuração da CBS', IBS: 'arquivo da apuração · webhook do Comitê Gestor' };
  var TRIS = ['CBS', 'IBS'];

  /* ── empresas do grupo econômico ──────────────────────────────────────── */
  // cada CNPJ raiz é uma empresa com apuração própria, centralizada na matriz
  function empresas() {
    var lista = (window._orgCnpjs || []).filter(function (x) { return x.status !== 'inativo'; }), por = {}, ordem = [];
    lista.forEach(function (x) {
      var raiz = x.cnpj.slice(0, 10);
      if (!por[raiz]) { por[raiz] = { raiz: raiz, razao: x.razao, grupo: x.grupoNome || '', matriz: null, estab: 0 }; ordem.push(raiz); }
      por[raiz].estab++;
      if (x.tipo === 'Matriz') por[raiz].matriz = x;
    });
    if (!ordem.length) { por['54.891.237'] = { raiz: '54.891.237', razao: 'Induspar Tecnologia S.A.', grupo: 'Grupo Induspar', matriz: { cnpj: '54.891.237/0001-48', uf: 'PR' }, estab: 1 }; ordem.push('54.891.237'); }
    return ordem.map(function (r, i) { var e = por[r]; e.fator = i === 0 ? 1 : (i === 1 ? 0.25 : 0.1); e.base = i; e.principal = i === 0; return e; });
  }
  function empresa() { var l = empresas(); return l.filter(function (e) { return e.raiz === S.empresa; })[0] || l[0]; }

  /* ── dados: competências por empresa ──────────────────────────────────── */
  var REF = { 2027: dt(2027, 4, 20, 8, 0), 2026: (function () { var h = new Date(); return h.getFullYear() === 2026 ? h : dt(2026, 12, 31); })() };
  var DADOS = {}; // raiz → { 2026: [comp], 2027: [comp] }
  var CLI = ['Cliente Gama', 'Cliente Delta', 'Cliente Épsilon', 'Cliente Zeta', 'Cliente Eta'];
  var FORN = ['Fornecedor Ômega', 'Fornecedor Sigma', 'Fornecedor Kappa', 'Fornecedor Lambda', 'Fornecedor Teta'];
  var MES_F = { 1: 0.92, 2: 0.96, 3: 1, 4: 1, 5: 1, 6: 1.02, 7: 1, 8: 1.04, 9: 1, 10: 1.06, 11: 1, 12: 1.08 };

  function arred(v) { return Math.round(v / 10) * 10; }
  function doc(num, data, parte, sh, en, extra) { var d = { num: num, data: data, parte: parte, sh: sh, en: en }; if (extra) Object.keys(extra).forEach(function (k) { d[k] = extra[k]; }); return d; }
  function linhasVazias() {
    return [
      { id: 'deb', nome: 'Débitos', op: '+', nat: 'debito', origens: [{ nome: 'Fornecimentos', docs: [] }] },
      { id: 'rdeb', nome: 'Redutores de débitos', op: '−', nat: 'debito', origens: [{ nome: 'Devoluções de venda', docs: [] }] },
      { id: 'cred', nome: 'Créditos apropriados', op: '−', nat: 'credito', origens: [{ nome: 'Por aquisição', docs: [] }, { nome: 'Presumido', docs: [] }] },
      { id: 'rcred', nome: 'Redutores de créditos apropriados', op: '+', nat: 'credito', origens: [{ nome: 'Estornos de crédito', docs: [] }] },
      { id: 'ant', nome: 'Créditos de apurações anteriores usados nesta', op: '−', nat: 'credito', origens: [{ nome: 'Saldo credor transportado', docs: [] }] },
      { id: 'ext', nome: 'Extinções por RAD e split', op: '−', nat: 'debito', origens: [{ nome: 'RAD dos clientes', docs: [] }, { nome: 'Split · informado pelo ente', docs: [], split: true }] },
      { id: 'pcont', nome: 'Pagamentos pelo contribuinte (PCONT)', op: '−', nat: 'debito', origens: [{ nome: 'Guias pagas e processadas', docs: [] }] }
    ];
  }
  function linha(T, id) { return T.linhas.filter(function (l) { return l.id === id; })[0]; }

  // exercício simulado: valores redondos a partir da escala da empresa e do tributo
  function gerarT(emp, ano, mes, tri, cen) {
    var s = emp.fator * MES_F[mes] * (tri === 'IBS' ? 0.01 : 1) * (ano === 2026 ? 0.1 : 1);
    function v(x) { return arred(x * s); }
    var ult = dt(ano, mes + 1, 0).getDate();
    function dia(i, n) { return Math.min(ult, 1 + Math.floor(i * (ult - 1) / n)); }
    function data(d) { return p2(d) + '/' + p2(mes) + '/' + ano; }
    var T = { tri: tri, ente: ENTE[tri], linhas: linhasVazias(), aApropriar: [], eventos: [], decisoes: {}, guias: [], fechada: false, reabertas: 0 };
    var base = 2000 + emp.base * 1000 + mes * 40;
    var deb = linha(T, 'deb').origens[0].docs;
    for (var i = 0; i < 20; i++) {
      var num = 'NF-e ' + (base + i + 1).toLocaleString('pt-BR');
      var vv = v(500000), ve = vv;
      if (cen === 'div_ibs' && tri === 'IBS' && i === 3) ve = arred(vv * 1.2);
      deb.push(doc(num, data(dia(i, 20)), CLI[Math.floor(i / 4)], vv, ve, ve !== vv ? { tipo: 'INC-CONC-01', motivo: 'O Comitê Gestor apurou IBS maior que o destacado no documento' } : null));
    }
    linha(T, 'rdeb').origens[0].docs.push(doc('NF-e ' + (base + 31).toLocaleString('pt-BR'), data(dia(6, 20)), CLI[1], v(100000), v(100000)), doc('NF-e ' + (base + 32).toLocaleString('pt-BR'), data(dia(14, 20)), CLI[3], v(100000), v(100000)));
    var cmp = linha(T, 'cred').origens[0].docs, fb = 1000 + emp.base * 1000 + mes * 30;
    var divCbs = cen === 'div_cbs' && tri === 'CBS';
    cmp.push(doc('NF-e ' + (fb + 1).toLocaleString('pt-BR'), data(5), 'Fornecedor Alfa', v(150000), divCbs ? 0 : v(150000), divCbs ? { tipo: 'INC-CONC-12', motivo: 'Guia RAD paga em ' + p2(10) + '/' + p2(mes) + ' com comprovante, sem reflexo na Receita Federal', rad: 'RAD-' + p2(mes) + '10' } : { rad: 'RAD-' + p2(mes) + '10' }));
    cmp.push(doc('NF-e ' + (fb + 2).toLocaleString('pt-BR'), data(Math.min(ult, 18)), 'Fornecedor Beta', v(50000), divCbs ? 0 : v(50000), divCbs ? { tipo: 'INC-CONC-12', motivo: 'Guia RAD paga em 18/' + p2(mes) + ' com comprovante, sem reflexo na Receita Federal', rad: 'RAD-' + p2(mes) + '18' } : { rad: 'RAD-' + p2(mes) + '18' }));
    for (var j = 0; j < 11; j++) cmp.push(doc('NF-e ' + (fb + 3 + j).toLocaleString('pt-BR'), data(dia(j, 11)), FORN[j % 5], j === 10 ? v(300000) : v(500000), j === 10 ? v(300000) : v(500000)));
    linha(T, 'cred').origens[1].docs.push(doc('Crédito presumido', data(ult), 'Apuração do período', v(500000), v(500000)));
    linha(T, 'rcred').origens[0].docs.push(doc('ND ' + (fb + 40).toLocaleString('pt-BR'), data(dia(9, 20)), 'Estorno por perda em estoque', v(100000), v(100000)));
    var ant = rotL({ ano: mes === 1 ? ano - 1 : ano, mes: mes === 1 ? 12 : mes - 1 });
    linha(T, 'ant').origens[0].docs.push(doc('Saldo credor de ' + ant, data(1), 'Transporte do período anterior', v(500000), v(500000)));
    var rad = linha(T, 'ext').origens[0].docs;
    rad.push(doc(deb[4].num, data(Math.min(ult, dia(4, 20) + 5)), deb[4].parte, v(500000), v(500000)), doc(deb[9].num, data(Math.min(ult, dia(9, 20) + 5)), deb[9].parte, v(500000), v(500000)));
    if (divCbs) rad.push(doc(deb[0].num, data(8), deb[0].parte, 0, v(100000), { tipo: 'INC-CONC-13', motivo: 'RAD de ' + deb[0].parte + ' que o SplitHub não recebeu: comprovante não importado' }));
    for (var k = 0; k < 3; k++) T.aApropriar.push(doc('NF-e ' + (fb + 20 + k).toLocaleString('pt-BR'), data(dia(k + 5, 10)), FORN[(k + 2) % 5], v(500000), v(500000)));
    return T;
  }

  // 2026 da empresa principal: o cálculo do SplitHub (apurData), com a leitura do ente simulada igual
  function deApurData(ano, mes, tri) {
    var k = MES[mes - 1] + '/' + ano, ad = window.apurData && window.apurData[k];
    if (!ad) return null;
    var T = { tri: tri, ente: ENTE[tri], linhas: linhasVazias(), aApropriar: [], eventos: [], decisoes: {}, guias: [], fechada: ad.status === 'concluida', reabertas: 0, doCalculo: true };
    (ad.debitos || []).filter(function (x) { return x.tributo === tri; }).forEach(function (x) {
      linha(T, 'deb').origens[0].docs.push(doc(x.doc, x.data, x.cliente, x.total, x.total));
      if (x.extinto > 0 && x.mec === 'rad') linha(T, 'ext').origens[0].docs.push(doc(x.doc, x.data, x.cliente, x.extinto, x.extinto));
      if (x.extinto > 0 && x.mec === 'split') linha(T, 'ext').origens[1].docs.push(doc(x.doc, x.data, x.cliente, x.extinto, x.extinto));
    });
    (ad.creditos || []).filter(function (x) { return x.tributo === tri && !x.saldoAnterior; }).forEach(function (x) {
      if (x.aprop > 0) linha(T, 'cred').origens[0].docs.push(doc(x.doc, x.data, x.forn, x.aprop, x.aprop));
      if (x.naoAprop > 0) T.aApropriar.push(doc(x.doc, x.data, x.forn, x.naoAprop, x.naoAprop, { motivo: x.motivo }));
    });
    var si = tri === 'IBS' ? ad.ibsSaldoInicial : ad.cbsSaldoInicial;
    if (si > 0) linha(T, 'ant').origens[0].docs.push(doc('Saldo credor anterior', '01/' + p2(mes) + '/' + ano, 'Transporte do período anterior', si, si));
    return T;
  }

  function usaCalculo(emp) { return emp.principal && !!window.apurData && Object.keys(window.apurData).some(function (k) { return /\/2026$/.test(k); }); }
  function vazio(tri) { return { tri: tri, ente: ENTE[tri], linhas: linhasVazias(), aApropriar: [], eventos: [], decisoes: {}, guias: [], fechada: false, reabertas: 0, doCalculo: true }; }
  function novaComp(emp, ano, mes) {
    var c = { id: ano + '-' + p2(mes), ano: ano, mes: mes, venc: vencimento(ano, mes), entrega: seguinte(ano, mes, 15), informativo: ano === 2026, tributos: {} };
    var cen = ano === 2027 && mes === 3 ? (emp.principal ? 'div_cbs' : 'div_ibs') : 'normal';
    TRIS.forEach(function (t) {
      c.tributos[t] = ano === 2026 && usaCalculo(emp) ? (deApurData(ano, mes, t) || vazio(t)) : gerarT(emp, ano, mes, t, cen);
      c.tributos[t].comp = c;
    });
    return c;
  }

  function dados(emp) {
    if (DADOS[emp.raiz]) return DADOS[emp.raiz];
    if (emp.principal && window.sincronizarApuracao && (window.nfListaFiltradaGlobal || []).length) { try { window.sincronizarApuracao(); } catch (e) {} }
    var D = { 2026: [], 2027: [] }, m;
    for (m = 1; m <= 12; m++) D[2026].push(novaComp(emp, 2026, m));
    for (m = 1; m <= 6; m++) D[2027].push(novaComp(emp, 2027, m));
    D.aud = [];
    DADOS[emp.raiz] = D;
    divergencias(D, emp, [2026, 2027]);
    historicoInicial(D, emp);
    eventos2026(D);
    return D;
  }
  function comps() { return dados(empresa())[S.ano]; }
  function comp() { var l = comps(); return l.filter(function (c) { return c.id === S.comp; })[0] || l[0]; }

  // o que já aconteceu até a data de referência do exercício
  function ref(c) { return REF[c.ano]; }
  function visivel(d, c) { var p = d.data.split('/'); return dt(+p[2], +p[1], +p[0]) <= ref(c); }
  function docsV(o, c) { return o.docs.filter(function (d) { return visivel(d, c); }); }
  function somaLinha(l, c, lado) { var s = 0; l.origens.forEach(function (o) { docsV(o, c).forEach(function (d) { s += d[lado]; }); }); return s; }
  function saldo(T, lado, semPcont) {
    var c = T.comp, s = 0;
    T.linhas.forEach(function (l) { if (semPcont && l.id === 'pcont') return; var v = somaLinha(l, c, lado); s += l.op === '+' ? v : -v; });
    return s;
  }
  function temDados(c) { return dt(c.ano, c.mes, 1) <= ref(c) && TRIS.some(function (t) { return somaLinha(linha(c.tributos[t], 'deb'), c, 'sh') > 0; }); }

  /* ── divergências e chamados ──────────────────────────────────────────── */
  var NAT = { credito: 'Crédito · DF de entrada', debito: 'Débito · DF de saída' };
  var DECISOES = {
    'INC-CONC-12': [['aguardar', 'Aguardar o reflexo'], ['aceitar', 'Aceitar o valor do ente'], ['ajustar', 'Ajustar no portal']],
    'INC-CONC-13': [['importar', 'Importar o comprovante do cliente'], ['aceitar', 'Aceitar o valor do ente']],
    'INC-CONC-01': [['corrigir', 'Corrigir o documento pelo ERP'], ['aceitar', 'Aceitar o valor do ente'], ['ajustar', 'Ajustar no portal']],
    'INC-CONC-02': [['corrigir', 'Corrigir o documento pelo ERP'], ['aceitar', 'Aceitar o valor do ente'], ['ajustar', 'Ajustar no portal']]
  };
  var TIPO_NOME = { 'INC-CONC-01': 'Valor de IBS divergente da apuração', 'INC-CONC-02': 'Valor de CBS divergente da apuração', 'INC-CONC-12': 'Movimento não refletido pelo órgão', 'INC-CONC-13': 'Movimento do órgão sem contrapartida' };
  function divergencias(D, emp, anos) {
    var n = 100 + emp.base * 100 + (anos.indexOf(2027) < 0 ? 50 : 0);
    anos.forEach(function (a) {
      D[a].forEach(function (c) {
        var seq = 0; c.divs = [];
        TRIS.forEach(function (t) {
          var T = c.tributos[t];
          T.linhas.forEach(function (l) {
            l.origens.forEach(function (o) {
              o.docs.forEach(function (d) {
                if (d.sh === d.en || o.split) return;
                seq++; n++;
                var dv = { id: 'DV-' + p2(seq), tri: t, T: T, linha: l, origem: o, doc: d, tipo: d.tipo || (t === 'IBS' ? 'INC-CONC-01' : 'INC-CONC-02'), motivo: d.motivo || '',
                  chamado: { id: 'INC-' + ('000' + n).slice(-4), estado: 'aberta', resp: null, terceiro: null, sla: null } };
                d.dv = dv; c.divs.push(dv);
              });
            });
          });
        });
      });
    });
  }
  function difDv(dv) { return dv.doc.en - dv.doc.sh; }
  function efeitoDv(dv) { return dv.linha.op === '+' ? difDv(dv) : -difDv(dv); }
  function abertas(c, t) { return (c.divs || []).filter(function (dv) { return dv.chamado.estado !== 'resolvida' && (!t || dv.tri === t) && visivel(dv.doc, c); }); }
  function semDecisao(c, t) { return abertas(c, t).filter(function (dv) { return !dv.T.decisoes[dv.id]; }); }
  // o saldo do ente "após os ajustes": desconta o efeito das divergências que a pessoa vai ajustar no portal
  function saldoEnteAjustado(T) {
    var s = saldo(T, 'en');
    abertas(T.comp, T.tri).forEach(function (dv) { var d = T.decisoes[dv.id]; if (d && d.op === 'ajustar') s -= efeitoDv(dv); });
    return s;
  }

  /* ── etapa de cada tributo na competência ─────────────────────────────── */
  function guiaAtiva(T) { return T.guias.filter(function (g) { return g.status !== 'cancelada' && g.status !== 'substituida'; })[0] || null; }
  function etapa(T) {
    var c = T.comp, r = ref(c), g = guiaAtiva(T);
    if (!temDados(c)) return { k: 'sem', rot: 'Sem dados', cls: 'cz', chip: 'gray' };
    if (g) {
      if (g.status === 'processada') return saldo(T, 'en') > 0.005 ? { k: 'parcial', rot: 'Paga parcialmente', cls: 'aj', chip: 'amber' } : { k: 'proc', rot: 'Processada', cls: 'ok', chip: 'green' };
      if (g.status === 'paga') return { k: 'paga', rot: 'Paga · aguardando o ente', cls: 'te', chip: 'teal' };
      var venceu = r > dt(c.venc.getFullYear(), c.venc.getMonth() + 1, c.venc.getDate(), 23, 59);
      if (venceu) return { k: 'atraso', rot: 'Guia vencida', cls: 'at', chip: 'red' };
      return { k: 'guia', rot: g.status === 'enviada' ? 'Guia no ERP' : 'Guia emitida', cls: 'ap', chip: 'blue' };
    }
    var fimMes = dt(c.ano, c.mes + 1, 0, 23, 59);
    if (r <= fimMes) return { k: 'apur', rot: 'Em apuração', cls: 'ap', chip: 'blue' };
    if (r < c.entrega) {
      if (T.tri === 'IBS' && r <= seguinte(c.ano, c.mes, 5)) return { k: 'cons', rot: 'Recepção residual', cls: 'ap', chip: 'blue' };
      return { k: 'cons', rot: 'Entrega da apuração', cls: 'ap', chip: 'blue' };
    }
    var fimVenc = dt(c.venc.getFullYear(), c.venc.getMonth() + 1, c.venc.getDate(), 23, 59);
    if (c.informativo) return r <= fimVenc ? { k: 'aj', rot: 'Ajustes · informativa', cls: 'aj', chip: 'amber' } : { k: 'info', rot: 'Informativa', cls: 'cz', chip: 'gray' };
    if (saldoEnteAjustado(T) <= 0) return { k: 'zero', rot: 'Sem saldo a recolher', cls: 'ok', chip: 'green' };
    if (r <= fimVenc) { var n = diasEntre(r, c.venc); return { k: 'aj', rot: 'Realizar ajustes · ' + (n === 0 ? 'vence hoje' : n + ' dia' + (n > 1 ? 's' : '')), cls: 'aj', chip: 'amber' }; }
    return { k: 'atraso', rot: 'Vencida · em atraso', cls: 'at', chip: 'red' };
  }

  /* ── imputação: o que um pagamento extingue (ordem cronológica, art. 26) ── */
  function imputacao(T, valorPago) {
    var c = T.comp, vend = docsV(linha(T, 'deb').origens[0], c).slice().sort(function (a, b) { return ord(a) - ord(b); });
    var radPor = {}; linha(T, 'ext').origens.forEach(function (o) { docsV(o, c).forEach(function (d) { radPor[d.num] = (radPor[d.num] || 0) + d.en; }); });
    var pool = somaLinha(linha(T, 'cred'), c, 'en') - somaLinha(linha(T, 'rcred'), c, 'en') + somaLinha(linha(T, 'ant'), c, 'en') + somaLinha(linha(T, 'rdeb'), c, 'en');
    var notas = vend.map(function (d) { var aberto = Math.max(0, d.en - (radPor[d.num] || 0)); var comp = Math.min(aberto, pool); pool -= comp; return { d: d, aberto: aberto - comp }; }).filter(function (x) { return x.aberto > 0; });
    var resta = valorPago, extintas = 0, emAberto = [];
    notas.forEach(function (x) { var paga = Math.min(x.aberto, resta); resta -= paga; if (paga >= x.aberto - 0.005) extintas++; else emAberto.push({ d: x.d, falta: x.aberto - paga }); });
    var clientesTodos = {}; notas.forEach(function (x) { clientesTodos[x.d.parte] = 1; });
    var clientesAbertos = {}; emAberto.forEach(function (x) { clientesAbertos[x.d.parte] = 1; });
    return { notas: notas.length, extintas: extintas, emAberto: emAberto, clientes: Object.keys(clientesTodos).length, clientesAbertos: Object.keys(clientesAbertos), sobra: Math.max(0, resta) };
  }
  function ord(d) { var p = d.data.split('/'); return +p[2] * 10000 + +p[1] * 100 + +p[0]; }

  /* ── histórico já vivido no exercício simulado ────────────────────────── */
  function evento(T, q, etapaId, txt) { T.eventos.push({ q: q, e: etapaId, txt: txt }); T.eventos.sort(function (a, b) { return a.q - b.q; }); }
  /* ── auditoria: trilha só de acréscimo, encadeada por hash ────────────── */
  var ACAO = { decisao: 'Decisão de divergência', chamado: 'Chamado', emitir: 'Emissão de guia', registrar: 'Registro de guia do portal', erp: 'Envio ao ERP', comprovante: 'Comprovante de pagamento', processar: 'Processamento pelo ente', devolucao: 'Excedente devolvido', cancelar: 'Cancelamento de guia', substituir: 'Substituição de guia', fechar: 'Fechamento da apuração', reabrir: 'Reabertura da apuração', recalcular: 'Recálculo', exportar: 'Exportação', leitura: 'Leitura dos entes' };
  function hash(txt) { var h = 2166136261; for (var i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return ('0000000' + h.toString(16)).slice(-8); }
  function conteudo(r) { return [r.seq, +r.q, r.quem, r.perfil, r.origem, r.acao, r.comp, r.tri, r.alvo, r.antes, r.depois, r.motivo].join('|'); }
  function auditar(D, r) {
    var ant = D.aud.length ? D.aud[D.aud.length - 1].hash : '00000000';
    ['perfil', 'origem', 'comp', 'tri', 'alvo', 'antes', 'depois', 'motivo'].forEach(function (k) { if (r[k] == null) r[k] = ''; });
    if (!r.origem) r.origem = 'Tela';
    r.seq = D.aud.length + 1; r.anterior = ant; r.hash = hash(ant + '|' + conteudo(r));
    D.aud.push(Object.freeze(r));
  }
  function integra(D) { var ant = '00000000'; return D.aud.every(function (r) { var ok = r.anterior === ant && r.hash === hash(ant + '|' + conteudo(r)); ant = r.hash; return ok; }); }
  // ação feita agora, na data de referência do exercício da competência
  function aud(acao, c, tri, alvo, antes, depois, motivo, origem, autor) {
    var q = new Date(c ? ref(c) : REF[S.ano]), h = new Date(); q.setHours(h.getHours(), h.getMinutes(), h.getSeconds());
    auditar(dados(empresa()), { q: q, quem: autor || quem(), perfil: autor ? '' : perfil(), origem: origem || 'Tela', acao: acao, comp: c ? c.id : '', tri: tri, alvo: alvo, antes: antes, depois: depois, motivo: motivo });
  }

  function novaGuia(T, valor, origem, emissao, base) {
    var c = T.comp, n = (T.comp.ano * 100 + c.mes) % 10000;
    var g = { id: 'PC-' + c.id.replace('-', '') + '-' + T.tri, tipo: T.tri === 'CBS' ? 'DARF' : 'Documento de arrecadação', origem: origem, valor: valor, venc: c.venc, emitida: emissao, status: 'emitida', base: base,
      linha: (T.tri === 'CBS' ? '8582' : '8583') + ' ' + ('0000000' + Math.round(valor)).slice(-11) + ' ' + p2(c.mes) + c.ano + n + ' 00000 ' + String(Math.round(valor * 7) % 100000000).padStart(8, '0'),
      retrato: retrato(T) };
    T.guias.forEach(function (x) { if (x.status === 'emitida' || x.status === 'enviada') x.status = 'substituida'; });
    T.guias.unshift(g);
    return g;
  }
  function retrato(T) {
    return { em: new Date(ref(T.comp)), linhas: T.linhas.map(function (l) { return { nome: l.nome, op: l.op, sh: somaLinha(l, T.comp, 'sh'), en: somaLinha(l, T.comp, 'en') }; }), saldoSh: saldo(T, 'sh'), saldoEn: saldo(T, 'en'), divs: abertas(T.comp, T.tri).length };
  }
  function historicoInicial(D, emp) {
    var cham = 90 + emp.base * 100, sem = [];
    function s_(q, quem_, perfil_, origem, acao, c, t, alvo, antes, depois, motivo) { sem.push({ q: q, quem: quem_, perfil: perfil_, origem: origem, acao: acao, comp: c.id, tri: t, alvo: alvo, antes: antes, depois: depois, motivo: motivo }); }
    var ANA = 'Ana Souza', ANAP = 'Analista fiscal';
    D[2027].forEach(function (c) {
      TRIS.forEach(function (t) {
        var T = c.tributos[t], sh = saldo(T, 'sh'), e = c.entrega, nv = docsV(linha(T, 'deb').origens[0], c).length, nc = docsV(linha(T, 'cred').origens[0], c).length;
        if (!temDados(c)) return;
        evento(T, dt(c.ano, c.mes + 1, 0, 23, 0), 'E1', '<b>' + nv + '</b> notas de venda e <b>' + nc + '</b> de compra processadas pela ' + ENTE[t] + ' no mês');
        if (c.mes <= 2) {
          var en0 = sh + (c.mes === 2 && t === 'CBS' ? arred(50000 * emp.fator) : 0);
          evento(T, dt(e.getFullYear(), e.getMonth() + 1, 16, 8, 0), 'E3', 'Apuração entregue pela ' + ENTE[t] + ' · saldo <b>' + fmt(en0) + '</b> · SplitHub <b>' + fmt(sh) + '</b>' + (en0 !== sh ? ' · DV-01 aberta, chamado <b>INC-' + ('000' + cham).slice(-4) + '</b>' : ''));
          s_(dt(e.getFullYear(), e.getMonth() + 1, 16, 8, 0), 'Sistema · ' + ENTE[t], '', 'Sistema', 'leitura', c, t, 'apuração assistida', '', 'saldo ' + fmt(en0) + (en0 !== sh ? ' · 1 divergência' : ''), '');
          if (en0 !== sh) {
            s_(dt(e.getFullYear(), e.getMonth() + 1, 16, 8, 1), 'Sistema', '', 'Sistema', 'chamado', c, t, 'DV-01 · INC-' + ('000' + cham).slice(-4), '', 'aberto automaticamente', 'diferença de ' + fmt(en0 - sh));
            s_(dt(e.getFullYear(), e.getMonth() + 1, 20, 15, 0), ANA, ANAP, 'Tela', 'decisao', c, t, 'DV-01 · INC-' + ('000' + cham).slice(-4), 'sem decisão', 'Ajustar no portal', 'estorno lançado em duplicidade');
            s_(dt(e.getFullYear(), e.getMonth() + 1, 24, 8, 0), 'Sistema · ' + ENTE[t], '', 'Sistema', 'chamado', c, t, 'DV-01 · INC-' + ('000' + cham).slice(-4), 'em análise', 'resolvida', 'ajuste refletido na leitura');
            evento(T, dt(e.getFullYear(), e.getMonth() + 1, 22, 10, 0), 'E4', 'INC-' + ('000' + cham).slice(-4) + ' resolvido: ajuste de ' + fmt(sh - en0) + ' feito no portal da ' + ENTE[t] + ', por Ana Souza');
            evento(T, dt(e.getFullYear(), e.getMonth() + 1, 24, 8, 0), 'E4', 'Nova leitura · saldo <b>' + fmt(sh) + '</b>, igual ao do SplitHub');
          }
          var emis = dt(e.getFullYear(), e.getMonth() + 1, 25, 9, 0);
          var g = novaGuia(T, sh, t === 'CBS' ? 'splithub' : 'portal', emis, 'ente');
          g.retrato.em = emis; g.retrato.saldoEn = sh; g.retrato.divs = 0;
          evento(T, emis, 'E6', (t === 'CBS' ? 'DARF emitido pelo SplitHub' : 'Guia emitida no portal do Comitê Gestor e registrada') + ' · <b>' + fmt(sh) + '</b> · vence ' + fD(c.venc));
          s_(emis, ANA, ANAP, 'Tela', t === 'CBS' ? 'emitir' : 'registrar', c, t, g.id, '', fmt(sh) + ' · saldo do ente', '');
          s_(dt(emis.getFullYear(), emis.getMonth() + 1, emis.getDate(), 9, 5), ANA, ANAP, 'Tela', 'erp', c, t, g.id, 'emitida', 'no ERP · pcont.guide_issued', '');
          g.status = 'enviada'; g.erp = emis; evento(T, dt(emis.getFullYear(), emis.getMonth() + 1, emis.getDate(), 9, 5), 'E6', 'Enviada ao ERP (<code>pcont.guide_issued</code>)');
          var pago = dt(c.venc.getFullYear(), c.venc.getMonth() + 1, c.venc.getDate() - (t === 'CBS' ? 0 : 1), 11, 0);
          g.status = 'paga'; g.pagoEm = pago; evento(T, pago, 'E6', 'Comprovante recebido do ERP (<code>POST /v1/pcont/proofs</code>)');
          s_(pago, 'ERP · integração', '', 'API', 'comprovante', c, t, g.id, 'no ERP', 'paga · POST /v1/pcont/proofs', '');
          var proc = new Date(pago); proc.setDate(proc.getDate() + 1); proc.setHours(8, 0);
          var im = imputacao(T, sh);
          g.status = 'processada'; g.procEm = proc; g.extintas = im.extintas; g.clientes = im.clientes;
          evento(T, proc, 'E7', 'A ' + ENTE[t] + ' processou o pagamento: <b>' + im.extintas + '</b> notas extintas, crédito liberado para <b>' + im.clientes + '</b> clientes');
          s_(proc, 'Sistema · ' + ENTE[t], '', 'Sistema', 'processar', c, t, g.id, 'paga', 'processada · ' + im.extintas + ' notas extintas', '');
          linha(T, 'pcont').origens[0].docs.push(doc(g.id, fD(dt(c.ano, c.mes + 1, 0)), 'Guia ' + g.tipo + ' · processada em ' + fD(proc), sh, sh));
          if (c.mes === 1 && t === 'CBS') {
            var exc = arred(10000 * emp.fator), dvl = new Date(proc); dvl.setDate(dvl.getDate() + 3);
            g.excedente = exc; g.devolvidoEm = dvl;
            evento(T, dvl, 'E8', 'RAD de cliente processado depois do pagamento: excedente de <b>' + fmt(exc) + '</b> devolvido em ' + fD(dvl) + ' (art. 27, § 1º)');
            s_(dvl, 'Sistema · ' + ENTE[t], '', 'Sistema', 'devolucao', c, t, g.id, '', fmt(exc) + ' devolvido', 'art. 27, § 1º');
          }
          cham++;
        } else if (c.mes === 3) {
          var en = saldo(T, 'en'), ab = abertas(c, t);
          evento(T, dt(2027, 4, 16, 8, 0), 'E3', 'Apuração entregue em 15/04 · ' + ENTE[t] + ' <b>' + fmt(en) + '</b> × SplitHub <b>' + fmt(sh) + '</b>' + (ab.length ? ' · ' + ab.length + ' divergência' + (ab.length > 1 ? 's' : '') + ': ' + ab.map(function (dv) { return '<b>' + dv.chamado.id + '</b>'; }).join(', ') : ' · sem divergência'));
          s_(dt(2027, 4, 16, 8, 0), 'Sistema · ' + ENTE[t], '', 'Sistema', 'leitura', c, t, 'apuração assistida', '', 'saldo ' + fmt(en) + ' · ' + ab.length + ' divergência(s)', '');
          ab.forEach(function (dv) { s_(dt(2027, 4, 16, 8, 1), 'Sistema', '', 'Sistema', 'chamado', c, t, dv.id + ' · ' + dv.chamado.id, '', 'aberto automaticamente', dv.tipo + ' · diferença de ' + fmt(difDv(dv))); });
          ab.forEach(function (dv, i) {
            dv.chamado.terceiro = dv.tipo === 'INC-CONC-12' ? ENTE[t] : (dv.tipo === 'INC-CONC-13' ? 'ERP' : 'Sistema do cliente');
            dv.chamado.estado = i === 0 ? 'aguardando emitente' : (i === 1 ? 'em análise' : 'aberta');
            dv.chamado.resp = i === 2 ? null : 'Ana Souza';
            dv.chamado.sla = dt(2027, 4, 28 - i);
          });
          if (ab[0] && ab[0].tipo === 'INC-CONC-12') { T.decisoes[ab[0].id] = { op: 'aguardar', por: 'Ana Souza', em: dt(2027, 4, 18, 14, 0), nota: '' }; evento(T, dt(2027, 4, 18, 14, 0), 'E4', ab[0].id + ': decisão "Aguardar o reflexo", por Ana Souza'); s_(dt(2027, 4, 18, 14, 0), ANA, ANAP, 'Tela', 'decisao', c, t, ab[0].id + ' · ' + ab[0].chamado.id, 'sem decisão', 'Aguardar o reflexo', 'guia RAD paga com comprovante'); }
        }
      });
    });
    sem.sort(function (a, b) { return a.q - b.q; }).forEach(function (r) { auditar(D, r); });
  }
  // 2026 informativo: só a entrega simulada do ente, sem guia
  function eventos2026(D) {
    D[2026].forEach(function (c) {
      if (!temDados(c)) return;
      TRIS.forEach(function (t) {
        var T = c.tributos[t];
        evento(T, dt(c.ano, c.mes + 1, 0, 23, 0), 'E1', 'Documentos do mês ' + (T.doCalculo ? 'calculados pelo SplitHub (antes Apuração IBS/CBS)' : 'processados'));
        if (ref(c) >= c.entrega) evento(T, dt(c.entrega.getFullYear(), c.entrega.getMonth() + 1, 16, 8, 0), 'E3', 'Leitura simulada da ' + ENTE[t] + ': saldo igual ao do SplitHub. 2026 é informativo, sem recolhimento (art. 348)');
      });
    });
  }

  /* ── estado da tela ───────────────────────────────────────────────────── */
  var S = { empresa: null, ano: 2027, comp: '2027-03', aba: 'comp', modo: 'cons', abertas: { cred: true }, divTri: 'todos', divNat: 'todas', tlTri: 'CBS', histTri: 'todos', audQuem: 'todos', audAcao: 'todas', audComp: 'todas', audTri: 'todos', base: { CBS: 'ente', IBS: 'ente' }, outro: { CBS: 0, IBS: 0 }, ultimaExec: dt(2027, 4, 20, 8, 10) };

  /* ── tela ─────────────────────────────────────────────────────────────── */
  function root() { return document.getElementById('view-pcont'); }
  function render() {
    var el = root(); if (!el) return;
    if (!S.empresa) S.empresa = empresas()[0].raiz;
    var emp = empresa(), c = comp();
    if (c.id !== S.comp) S.comp = c.id;
    var nd = (c.divs || []).filter(function (dv) { return visivel(dv.doc, c); });
    el.innerHTML =
      '<div class="pc-hdr"><div><div class="pg-title">PCONT</div><div class="pg-sub">Apuração do mês por tributo: o SplitHub ao lado da Receita Federal (CBS) e do Comitê Gestor (IBS). Última execução do SplitHub: ' + fDH(S.ano === 2027 ? S.ultimaExec : REF[2026]) + '</div></div>'
      + '<div class="pc-hdr-d"><button class="btn" data-act="regras">Regras da apuração</button><button class="btn" data-act="recalcular">↻ Recalcular</button><button class="btn" data-act="exportar">↓ Exportar</button>'
      + '<button class="btn btn-t" data-act="irGuia" data-arg="CBS">Gerar guia CBS</button><button class="btn pc-btn-off" data-act="ibsRoadmap" title="O Comitê Gestor ainda não emite por API">Gerar guia IBS · em breve</button></div></div>'
      + barraEmpresa(emp)
      + '<div class="pc-car">' + comps().map(cartao).join('') + '</div>'
      + '<div class="stabs pc-tabs">' + [['comp', 'Competência'], ['tl', 'Linha do tempo'], ['div', 'Divergências' + (nd.length ? ' · ' + abertas(c).length : '')], ['guias', 'Guias e pagamentos'], ['hist', 'Histórico'], ['aud', 'Auditoria']].map(function (a) { return '<button class="stab' + (S.aba === a[0] ? ' active' : '') + '" data-act="aba" data-arg="' + a[0] + '">' + a[1] + '</button>'; }).join('') + '</div>'
      + '<div class="pc-corpo">' + ({ comp: abaComp, tl: abaLinhaTempo, div: abaDiv, guias: abaGuias, hist: abaHist, aud: abaAud }[S.aba])(c, emp) + '</div>';
    // a competência escolhida fica à vista no carrossel, sem rolar a página
    var car = el.querySelector('.pc-car'), sel = el.querySelector('.pc-car-c.sel');
    if (car && sel) car.scrollLeft = Math.max(0, sel.offsetLeft - car.offsetLeft - (car.clientWidth - sel.offsetWidth) / 2);
  }
  function barraEmpresa(emp) {
    var l = empresas(), m = emp.matriz || {};
    return '<div class="pc-emp"><label>Empresa do grupo<select data-ch="empresa">' + l.map(function (e) { return '<option value="' + esc(e.raiz) + '"' + (e.raiz === emp.raiz ? ' selected' : '') + '>' + esc(e.razao) + ' · ' + esc(e.raiz) + '</option>'; }).join('') + '</select></label>'
      + '<div class="pc-emp-i">Matriz · recolhimento centralizado<b>' + esc(m.cnpj || '—') + ' · ' + esc(m.uf || '') + '</b></div>'
      + '<div class="pc-emp-i">Estabelecimentos ativos<b>' + emp.estab + '</b></div>'
      + '<div class="pc-emp-i">' + (S.ano === 2027 ? 'Data de referência' : 'Hoje') + '<b>' + fD(REF[S.ano]) + (S.ano === 2027 ? ' · simulada' : '') + '</b></div>'
      + '<div class="pc-emp-f"><div class="pc-anos">' + [[2027, '2027 · simulado'], [2026, '2026 · informativo']].map(function (a) { return '<button data-act="ano" data-arg="' + a[0] + '"' + (S.ano === a[0] ? ' class="on"' : '') + '>' + a[1] + '</button>'; }).join('') + '</div>'
      + (S.ano === 2027 ? '<button class="btn pc-btn-sm" data-act="leitura" title="Avança a data de referência para a próxima leitura diária dos entes">Simular nova leitura dos entes</button>' : '') + '</div></div>'
      + (emp.principal || S.ano === 2027 ? '' : '<div class="pc-alerta info">2026 desta empresa usa dados de exemplo: a base do protótipo traz os documentos da ' + esc(empresas()[0].razao) + '.</div>')
      + (S.ano === 2026 ? '<div class="pc-alerta info">2026 é ano de teste: quem cumpre as obrigações acessórias está dispensado de recolher (LC 214, art. 348, § 1º). O módulo mostra o confronto e o histórico, sem emissão de guia.</div>' : '');
  }
  function cartao(c) {
    var vazio = !temDados(c);
    return '<button class="pc-car-c' + (c.id === S.comp ? ' sel' : '') + (vazio ? ' vazio' : '') + '"' + (vazio ? ' disabled' : ' data-act="comp" data-arg="' + c.id + '"') + '><div class="pc-car-m">' + rot(c) + '</div>'
      + TRIS.map(function (t) { var e = etapa(c.tributos[t]); return '<div class="pc-car-t ' + e.cls + '"><b>' + t + '</b><span>' + esc(e.rot) + '</span></div>'; }).join('') + '</button>';
  }

  /* aba Competência */
  function abaComp(c) {
    var seg = '<div class="pc-seg">' + [['cons', 'Consolidado'], ['CBS', 'CBS · Receita Federal'], ['IBS', 'IBS · Comitê Gestor']].map(function (s) { return '<button data-act="modo" data-arg="' + s[0] + '"' + (S.modo === s[0] ? ' class="on"' : '') + '>' + s[1] + '</button>'; }).join('') + '</div>';
    var info = '<span class="pc-info">Vencimento <b>' + fD(c.venc) + '</b> · entrega da apuração até <b>' + fD(c.entrega) + '</b> (dia 20 com DeRE)</span>';
    if (S.modo === 'cons') {
      return '<div class="pc-linha">' + seg + info + '</div><div class="pc-duo">' + TRIS.map(function (t) { return cartaoTributo(c.tributos[t]); }).join('') + '</div>' + desembolso(c)
        + '<div class="pc-nota">Os saldos de CBS e IBS não se somam: cada tributo tem ente, guia e pagamento próprios. O desembolso é só a soma de caixa das guias.</div>';
    }
    var T = c.tributos[S.modo];
    return '<div class="pc-linha">' + seg + '<div class="pc-hdr-d"><button class="btn pc-btn-sm" data-act="exportar">↓ Exportar</button>'
      + (T.fechada ? '<button class="btn pc-btn-sm" data-act="reabrir" data-arg="' + T.tri + '">↺ Reabrir</button><span class="pc-chip green">Apuração do SplitHub fechada</span>' : '<button class="btn btn-t pc-btn-sm" data-act="fechar" data-arg="' + T.tri + '">Fechar apuração ' + T.tri + '</button>') + '</div></div>'
      + demonstrativo(T) + '<div class="pc-t">Apropriação de créditos</div>' + apropriacao(T)
      + '<div class="pc-nota">Diferença = ' + ENTE[T.tri] + ' − SplitHub. "D" indica saldo devedor e "C", saldo credor (a recuperar). Fonte do ente: ' + FONTE[T.tri] + (T.doCalculo ? '. Coluna SplitHub: o cálculo que era da Apuração IBS/CBS.' : '.') + '</div>';
  }
  function cartaoTributo(T) {
    var c = T.comp, e = etapa(T), sh = saldo(T, 'sh'), en = saldo(T, 'en'), d = en - sh, ab = abertas(c, T.tri), g = guiaAtiva(T);
    return '<div class="pc-card"><div class="pc-card-h"><span class="pc-card-n">' + T.tri + ' · ' + ENTE[T.tri] + '</span><span class="pc-chip ' + e.chip + '">' + esc(e.rot) + '</span></div>'
      + '<div class="pc-r"><span>Saldo a recolher · SplitHub</span><b>' + fmtDC(sh) + '</b></div>'
      + '<div class="pc-r"><span>Saldo a recolher · ' + ENTE[T.tri] + '</span><b>' + fmtDC(en) + '</b></div>'
      + '<div class="pc-r"><span>Diferença</span><b class="' + (d ? 'dif' : 'zero') + '">' + fmtS(d) + '</b></div>'
      + '<div class="pc-r"><span>Divergências</span><b class="txt">' + (ab.length ? ab.length + ' aberta' + (ab.length > 1 ? 's' : '') + ' · ' + semDecisao(c, T.tri).length + ' sem decisão' : 'nenhuma') + '</b></div>'
      + '<div class="pc-r"><span>Guia</span><b class="txt">' + (g ? esc(g.tipo) + ' · ' + fmt(g.valor) + ' · ' + rotStatus(g) : (c.informativo ? 'não se aplica em 2026' : (T.tri === 'IBS' ? 'registrar a guia do portal' : 'não emitida'))) + '</b></div>'
      + '<div class="pc-f">Fonte: ' + FONTE[T.tri] + (temDados(c) && ref(c) >= c.entrega ? ' · lida em ' + fDH(ultimaLeitura(c)) : ' · prévia') + '</div>'
      + '<button class="pc-a" data-act="modo" data-arg="' + T.tri + '">Analisar ' + T.tri + ' →</button></div>';
  }
  function ultimaLeitura(c) { var r = new Date(ref(c)); r.setHours(8, 0); return r; }
  function rotStatus(g) { return { emitida: 'emitida', enviada: 'no ERP', paga: 'paga', processada: 'processada', cancelada: 'cancelada', substituida: 'substituída' }[g.status] || g.status; }
  function valorSugerido(T) { var g = guiaAtiva(T); return g ? g.valor : Math.max(0, saldoEnteAjustado(T)); }
  function desembolso(c) {
    if (c.informativo) return '';
    var linhas = TRIS.map(function (t) { var T = c.tributos[t], g = guiaAtiva(T); return { t: t, v: valorSugerido(T), g: g }; });
    var tot = linhas.reduce(function (s, x) { return s + x.v; }, 0);
    return '<div class="pc-card pc-mt"><div class="pc-card-h"><span class="pc-card-n">Desembolso da competência · 2 guias</span><span class="pc-chip gray">caixa</span></div>'
      + linhas.map(function (x) { return '<div class="pc-r"><span>' + x.t + ' · ' + ENTE[x.t] + ' · ' + GUIA[x.t] + ' · vence ' + fD(c.venc) + (x.g ? ' · ' + rotStatus(x.g) : ' · valor sugerido') + '</span><b>' + fmt(x.v) + '</b></div>'; }).join('')
      + '<div class="pc-r"><span><b>Total a desembolsar</b></span><b>' + fmt(tot) + '</b></div>'
      + '<div class="pc-f">Soma de caixa de duas guias pagas a entes distintos (D-PC-11). Não é saldo e não entra em apuração: os saldos continuam separados nos cartões acima.</div></div>';
  }
  function demonstrativo(T) {
    var c = T.comp, sh = saldo(T, 'sh'), en = saldo(T, 'en'), sh0 = saldo(T, 'sh', true), en0 = saldo(T, 'en', true);
    function linhaHtml(l) {
      var a = somaLinha(l, c, 'sh'), b = somaLinha(l, c, 'en'), d = b - a, nd = abertas(c, T.tri).filter(function (dv) { return dv.linha === l; }).length, aberta = S.abertas[l.id];
      var h = '<tr><td class="l min"><button class="pc-cv" data-act="linha" data-arg="' + l.id + '" aria-label="Abrir a linha">' + (aberta ? '⌄' : '›') + '</button><span class="pc-op">' + l.op + '</span>' + l.nome + '</td><td>' + fmt(a) + '</td><td>' + fmt(b) + '</td><td class="' + (d ? 'dif' : 'z') + '">' + fmt(d) + '</td><td>' + (nd ? '<span class="pc-dv">' + nd + '</span>' : '') + '</td></tr>';
      if (aberta) l.origens.forEach(function (o, i) {
        var x = docsV(o, c).reduce(function (s, dd) { return s + dd.sh; }, 0), y = docsV(o, c).reduce(function (s, dd) { return s + dd.en; }, 0), no = abertas(c, T.tri).filter(function (dv) { return dv.origem === o; }).length;
        h += '<tr class="n2 clic" data-act="origem" data-arg="' + l.id + '|' + i + '"><td class="l">' + esc(o.nome) + ' <span class="pc-sub">' + docsV(o, c).length + ' lançamento' + (docsV(o, c).length === 1 ? '' : 's') + ' · abrir</span></td><td>' + fmt(x) + '</td><td>' + fmt(y) + '</td><td class="' + (y - x ? 'dif' : 'z') + '">' + fmt(y - x) + '</td><td>' + (no ? '<span class="pc-dv">' + no + '</span>' : '') + '</td></tr>';
      });
      return h;
    }
    return '<div class="pc-tw"><table class="pc-tb"><thead><tr><th class="l">' + T.tri + ' · ' + rotL(c) + '</th><th>SplitHub (R$)</th><th>' + ENTE[T.tri] + ' (R$)</th><th>Diferença (R$)</th><th>Divergências</th></tr></thead><tbody>'
      + '<tr class="res"><td class="l">Resultado da apuração</td><td>' + fmtDC(sh0) + '</td><td>' + fmtDC(en0) + '</td><td class="' + (en0 - sh0 ? 'dif' : 'z') + '">' + fmt(en0 - sh0) + '</td><td>' + (abertas(c, T.tri).length ? '<span class="pc-dv">' + abertas(c, T.tri).length + '</span>' : '') + '</td></tr>'
      + T.linhas.map(linhaHtml).join('')
      + '<tr class="res"><td class="l">Saldo a recolher atualizado</td><td>' + fmtDC(sh) + '</td><td>' + fmtDC(en) + '</td><td class="' + (en - sh ? 'dif' : 'z') + '">' + fmt(en - sh) + '</td><td></td></tr>'
      + '</tbody></table></div>';
  }
  function apropriacao(T) {
    var c = T.comp, a = 0, b = 0;
    T.aApropriar.filter(function (d) { return visivel(d, c); }).forEach(function (d) { a += d.sh; b += d.en; });
    // o que o SplitHub já apropriou e o ente ainda vê "a apropriar"
    abertas(c, T.tri).forEach(function (dv) { if (dv.linha.id === 'cred' && difDv(dv) < 0) b += -difDv(dv); });
    var n = abertas(c, T.tri).filter(function (dv) { return dv.linha.id === 'cred'; }).length;
    return '<div class="pc-tw"><table class="pc-tb"><thead><tr><th class="l">' + T.tri + ' · ' + rotL(c) + '</th><th>SplitHub (R$)</th><th>' + ENTE[T.tri] + ' (R$)</th><th>Diferença (R$)</th><th>Divergências</th></tr></thead><tbody>'
      + '<tr class="clic" data-act="aapropriar"><td class="l">Créditos a apropriar <span class="pc-sub">abrir</span></td><td>' + fmt(a) + '</td><td>' + fmt(b) + '</td><td class="' + (b - a ? 'dif' : 'z') + '">' + fmt(b - a) + '</td><td>' + (n ? '<span class="pc-dv">' + n + '</span>' : '') + '</td></tr>'
      + '</tbody></table></div>';
  }

  /* aba Linha do tempo */
  function abaLinhaTempo(c) {
    var ult = dt(c.ano, c.mes + 1, 0).getDate(), tot = ult + 15 + 15 + 10, r = ref(c);
    function pos(d) { var x = diasEntre(dt(c.ano, c.mes, 1), d); return Math.max(0, Math.min(100, (x / tot) * 100)); }
    function cls(ini, fim, at) { if (r > fim) return at ? 'e-at' : 'e-ok'; if (r >= ini) return 'e-ag'; return 'e-fu'; }
    var fimMes = dt(c.ano, c.mes, ult, 23, 59), ent = c.entrega, fimV = dt(c.venc.getFullYear(), c.venc.getMonth() + 1, c.venc.getDate(), 23, 59);
    function faixa(t) {
      var T = c.tributos[t], g = guiaAtiva(T), pagou = g && (g.status === 'paga' || g.status === 'processada');
      var ajCls = cls(ent, fimV); var pgCls = pagou ? 'e-ok' : (r > fimV && !c.informativo ? 'e-at' : (r >= ent ? 'e-ag' : 'e-fu'));
      var h = '<div class="' + (r > fimMes ? 'e-ok' : 'e-ag') + '" style="flex:' + ult + '">Em apuração<i>01 a ' + p2(ult) + '/' + p2(c.mes) + '</i></div>';
      if (t === 'IBS') h += '<div class="' + cls(seguinte(c.ano, c.mes, 1), seguinte(c.ano, c.mes, 5)) + '" style="flex:5">Recepção<i>até 05</i></div><div class="' + cls(seguinte(c.ano, c.mes, 6), ent) + '" style="flex:10">Entrega<i>' + fDC(ent) + '</i></div>';
      else h += '<div class="' + cls(seguinte(c.ano, c.mes, 1), ent) + '" style="flex:15">Consolidação e entrega<i>' + fDC(ent) + '</i></div>';
      h += '<div class="' + ajCls + '" style="flex:15">Realizar ajustes<i>' + (abertas(c, t).length ? abertas(c, t).length + ' divergência(s)' : 'sem divergência') + '</i></div>';
      h += '<div class="' + (c.informativo ? 'e-fu' : pgCls) + '" style="flex:10">' + (c.informativo ? 'Sem recolhimento' : 'Venc. e pagamento') + '<i>' + fDC(c.venc) + '</i></div>';
      return h;
    }
    var hoje = pos(r);
    var trilhos = '<div class="pc-trilhos"><div class="pc-trilhos-in">'
      + '<div class="pc-trilho"><span></span><div class="pc-eixo"><span style="flex:' + ult + '">01/' + p2(c.mes) + '</span><span style="flex:15">' + fDC(seguinte(c.ano, c.mes, 1)) + '</span><span style="flex:15">' + fDC(ent) + '</span><span style="flex:10">' + fDC(c.venc) + '</span></div></div>'
      + TRIS.map(function (t) { return '<div class="pc-trilho"><div class="pc-trilho-n">' + t + '<span>' + ENTE[t] + '</span></div><div class="pc-faixa">' + faixa(t) + (hoje > 0 && hoje < 100 ? '<span class="pc-hoje" style="left:' + hoje.toFixed(1) + '%">' + (t === 'CBS' ? '<span>' + (c.ano === 2027 ? 'referência ' : 'hoje ') + fDC(r) + '</span>' : '') + '</span>' : '') + '</div></div>'; }).join('')
      + '</div></div>';
    var seg = '<div class="pc-seg">' + TRIS.map(function (t) { return '<button data-act="tlTri" data-arg="' + t + '"' + (S.tlTri === t ? ' class="on"' : '') + '>' + t + ' · ' + ENTE[t] + '</button>'; }).join('') + '</div>';
    var T = c.tributos[S.tlTri], e = etapa(T);
    return trilhos + '<div class="pc-linha pc-mt">' + seg + '<span class="pc-info">Etapa atual: <b>' + esc(e.rot) + '</b></span></div>' + etapas(T);
  }
  function etapas(T) {
    var c = T.comp, r = ref(c), g = guiaAtiva(T), ult = dt(c.ano, c.mes + 1, 0).getDate(), fimV = dt(c.venc.getFullYear(), c.venc.getMonth() + 1, c.venc.getDate(), 23, 59);
    var pagou = g && (g.status === 'paga' || g.status === 'processada'), proc = g && g.status === 'processada';
    function st(ok, ag, at) { return ok ? 'ok' : (at ? 'at' : (ag ? 'ag' : '')); }
    function evs(id) { return T.eventos.filter(function (x) { return x.e === id; }).map(function (x) { return '<li><span class="pc-q">' + fDH(x.q) + '</span>' + x.txt + '</li>'; }).join(''); }
    var E = [
      ['E1', 'Em apuração', '01/' + p2(c.mes) + ' a ' + p2(ult) + '/' + p2(c.mes) + '/' + c.ano, st(r > dt(c.ano, c.mes, ult, 23, 59), r >= dt(c.ano, c.mes, 1)), 'O ente recebe os documentos e processa todo dia' + (T.tri === 'IBS' ? ' (a cada 4 horas no piloto)' : '') + '.', ''],
      ['E2', 'Consolidação', (T.tri === 'IBS' ? 'recepção residual até ' + fDC(seguinte(c.ano, c.mes, 5)) + ' · ' : '') + 'até ' + fD(c.entrega), st(r >= c.entrega, r > dt(c.ano, c.mes, ult, 23, 59)), T.tri === 'IBS' ? 'O Comitê Gestor ainda recebe documentos do mês até o dia 5.' : 'A Receita Federal não publica a janela de consolidação.', ''],
      ['E3', 'Entrega da apuração assistida', fD(c.entrega) + ' · dia 20 com DeRE', st(r >= c.entrega, false), '', 'Art. 46, I e II'],
      ['E4', 'Realizar ajustes', fDC(c.entrega) + ' a ' + fD(c.venc), st(r > fimV || pagou, r >= c.entrega && r <= fimV), abertas(c, T.tri).length ? semDecisao(c, T.tri).length + ' de ' + abertas(c, T.tri).length + ' divergência(s) sem decisão' : '', 'Art. 46, §§ 2º e 3º'],
      ['E5', 'Vencimento', fD(c.venc), st(r > fimV || pagou, false, r > fimV && !pagou && !c.informativo && saldoEnteAjustado(T) > 0), c.informativo ? 'Informativa: sem recolhimento em 2026.' : (r > fimV && !pagou && saldoEnteAjustado(T) > 0 ? 'Venceu sem pagamento: saldo do ente presumido correto e encargos simulados.' : 'Sem pagamento até o fim do dia, o saldo do ente é presumido correto.'), 'Art. 45; art. 46, § 7º'],
      ['E6', 'Pagamento', g ? 'guia ' + rotStatus(g) : (c.informativo ? 'não se aplica' : 'a fazer'), st(pagou, !!g), g ? '' : (c.informativo ? '' : 'Guia a emitir · valor sugerido <b>' + fmt(valorSugerido(T)) + '</b>'), 'Art. 27'],
      ['E7', 'Extinção confirmada', proc ? fD(g.procEm) : (c.informativo ? 'não se aplica' : 'a fazer'), st(proc, pagou && !proc), proc ? '' : (c.informativo ? '' : 'Esperado: <b>' + imputacao(T, valorSugerido(T)).extintas + '</b> notas extintas e crédito liberado para <b>' + imputacao(T, valorSugerido(T)).clientes + '</b> clientes'), 'Art. 26; LC 214, art. 47'],
      ['E8', 'Depois do vencimento', 'se houver', st(false, false), 'Excedente devolvido, encargos ou ajuste fora do prazo aparecem aqui.', '']
    ];
    return '<ol class="pc-etapas">' + E.map(function (x, i) {
      var lista = evs(x[0]) + (x[4] ? '<li>' + x[4] + '</li>' : '');
      return '<li class="pc-etapa ' + x[3] + '"><div class="pc-etapa-m"><b>' + (x[3] === 'ok' ? '✓' : i + 1) + '</b>' + (i < E.length - 1 ? '<i></i>' : '') + '</div><div class="pc-etapa-c"><div class="pc-etapa-h"><b>' + x[0] + ' · ' + x[1] + '</b><span>' + x[2] + '</span></div>' + (lista ? '<ul>' + lista + '</ul>' : '') + (x[5] ? '<div class="pc-base">' + x[5] + '</div>' : '') + '</div></li>';
    }).join('') + '</ol>';
  }

  /* aba Divergências */
  function abaDiv(c) {
    var segT = '<div class="pc-seg">' + [['todos', 'Todos os tributos'], ['CBS', 'CBS · Receita Federal'], ['IBS', 'IBS · Comitê Gestor']].map(function (s) { return '<button data-act="divTri" data-arg="' + s[0] + '"' + (S.divTri === s[0] ? ' class="on"' : '') + '>' + s[1] + '</button>'; }).join('') + '</div>';
    var segN = '<div class="pc-seg">' + [['todas', 'Toda natureza'], ['credito', NAT.credito], ['debito', NAT.debito]].map(function (s) { return '<button data-act="divNat" data-arg="' + s[0] + '"' + (S.divNat === s[0] ? ' class="on"' : '') + '>' + s[1] + '</button>'; }).join('') + '</div>';
    var todas = (c.divs || []).filter(function (dv) { return visivel(dv.doc, c); });
    var mat = '<div class="pc-tw pc-mt"><table class="pc-tb pc-mat"><thead><tr><th class="l">Por tributo e natureza</th><th>' + NAT.credito + '</th><th>' + NAT.debito + '</th><th>No saldo do ente</th></tr></thead><tbody>'
      + TRIS.map(function (t) {
        function cel(n) { var l = abertas(c, t).filter(function (dv) { return dv.linha.nat === n; }); var s = l.reduce(function (a, dv) { return a + difDv(dv); }, 0); return '<td data-act="matriz" data-arg="' + t + '|' + n + '" class="' + (S.divTri === t && S.divNat === n ? 'sel ' : '') + (l.length ? '' : 'z') + '">' + (l.length ? l.length + ' · ' + fmt(s) : '0') + '</td>'; }
        var ef = abertas(c, t).reduce(function (a, dv) { return a + efeitoDv(dv); }, 0);
        return '<tr><td class="l"><b>' + t + '</b> · ' + ENTE[t] + '</td>' + cel('credito') + cel('debito') + '<td class="' + (ef ? 'dif' : 'z') + '">' + fmtS(ef) + '</td></tr>';
      }).join('') + '</tbody></table></div><div class="pc-nota">Cada célula filtra a lista. Não há total: CBS e IBS não se somam.</div>';
    var lista = todas.filter(function (dv) { return (S.divTri === 'todos' || dv.tri === S.divTri) && (S.divNat === 'todas' || dv.linha.nat === S.divNat); });
    var tab = lista.length ? '<div class="pc-tw pc-mt"><table class="pc-tb larga"><thead><tr><th class="l">Divergência</th><th class="l">Natureza</th><th>SplitHub (R$)</th><th>Ente (R$)</th><th>Diferença (R$)</th><th>No saldo do ente</th><th class="l">Tipo</th><th class="l">Decisão</th><th class="l">Chamado</th></tr></thead><tbody>'
      + lista.map(function (dv) {
        var d = dv.T.decisoes[dv.id], res = dv.chamado.estado === 'resolvida';
        return '<tr class="clic" data-act="dv" data-arg="' + dv.id + '"><td class="l"><b>' + dv.id + '</b> · ' + dv.tri + ' · ' + esc(dv.linha.nome) + '<span class="pc-sub">' + esc(dv.doc.num) + ' · ' + esc(dv.doc.parte) + (dv.motivo ? ' · ' + esc(dv.motivo) : '') + '</span></td>'
          + '<td class="l"><span class="pc-dv ' + (dv.linha.nat === 'credito' ? 'inf' : 'gr') + '">' + (dv.linha.nat === 'credito' ? 'Crédito · entrada' : 'Débito · saída') + '</span></td>'
          + '<td>' + fmt(dv.doc.sh) + '</td><td>' + fmt(dv.doc.en) + '</td><td class="' + (difDv(dv) ? 'dif' : 'z') + '">' + fmt(difDv(dv)) + '</td><td>' + fmtS(efeitoDv(dv)) + '</td>'
          + '<td class="l"><span class="pc-mono">' + dv.tipo + '</span></td>'
          + '<td class="l">' + (res ? '<span class="pc-dv ok">resolvida</span>' : (d ? esc(nomeDecisao(dv, d.op)) + '<span class="pc-sub">' + esc(d.por) + ' · ' + fDC(d.em) + '</span>' : '<span class="pc-dv">sem decisão</span>')) + '</td>'
          + '<td class="l"><span class="pc-cham">' + dv.chamado.id + '</span><span class="pc-sub">' + esc(dv.chamado.estado) + (dv.chamado.terceiro ? ' · ' + esc(dv.chamado.terceiro) : '') + (dv.chamado.resp ? ' · ' + esc(dv.chamado.resp) : ' · sem responsável') + (dv.chamado.sla ? ' · SLA ' + fDC(dv.chamado.sla) : '') + '</span></td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="pc-alerta ok pc-mt">Nenhuma divergência ' + (todas.length ? 'com estes filtros' : 'nesta competência') + '.</div>';
    var alerta = '';
    var cbs = c.tributos.CBS;
    if (!c.informativo && abertas(c).length && ref(c) <= c.venc) alerta = '<div class="pc-alerta">Se nada mudar até ' + fD(c.venc) + ', cada ente presume corretos os próprios saldos (art. 46, § 7º): ' + TRIS.map(function (t) { return ENTE[t] + ' ' + fmtDC(saldo(c.tributos[t], 'en')); }).join(' · ') + '.</div>';
    return '<div class="pc-linha">' + segT + segN + '</div>' + mat + tab + alerta + '<div class="pc-nota">Toda divergência abre o chamado sozinha em Inconsistências (D-PC-05), um por tributo e documento. Clique numa linha para registrar a decisão.</div>';
  }
  function nomeDecisao(dv, op) { var o = (DECISOES[dv.tipo] || []).filter(function (x) { return x[0] === op; })[0]; return o ? o[1] : op; }

  /* aba Guias e pagamentos */
  function abaGuias(c) {
    return '<div class="pc-duo">' + TRIS.map(function (t) { return cartaoGuia(c.tributos[t]); }).join('') + '</div>' + desembolso(c);
  }
  function cartaoGuia(T) {
    var c = T.comp, g = guiaAtiva(T), t = T.tri, h = '<div class="pc-card"><div class="pc-card-h"><span class="pc-card-n">Guia ' + t + ' · ' + ENTE[t] + ' · ' + GUIA[t] + '</span>';
    if (c.informativo) return h + '<span class="pc-chip gray">2026 informativo</span></div><div class="pc-alerta info">Sem emissão em 2026: dispensa do art. 348, § 1º. A emissão começa nas competências de 2027 (D-PC-13).</div><div class="pc-r"><span>Saldo do ente</span><b>' + fmtDC(saldo(T, 'en')) + '</b></div></div>';
    if (!temDados(c) || etapa(T).k === 'apur' || etapa(T).k === 'cons') return h + '<span class="pc-chip blue">' + esc(etapa(T).rot) + '</span></div><div class="pc-alerta info">A guia sai depois da entrega da apuração assistida, em ' + fD(c.entrega) + '.</div></div>';
    if (g) return h + '<span class="pc-chip ' + ({ emitida: 'blue', enviada: 'blue', paga: 'teal', processada: 'green' }[g.status] || 'gray') + '">' + rotStatus(g) + '</span></div>' + blocoGuia(T, g);
    if (saldoEnteAjustado(T) <= 0) return h + '<span class="pc-chip green">sem saldo</span></div><div class="pc-alerta ok">O saldo do ente após os ajustes não é devedor: não há guia a emitir.</div></div>';
    h += '<span class="pc-chip gray">não emitida</span></div>';
    var en = saldoEnteAjustado(T), sh = saldo(T, 'sh'), b = S.base[t], val = b === 'ente' ? en : (b === 'sh' ? sh : (S.outro[t] || 0));
    h += '<div class="pc-opc">'
      + '<label class="' + (b === 'ente' ? 'on' : '') + '"><span><input type="radio" name="pc-base-' + t + '" data-ch="base" data-arg="' + t + '|ente"' + (b === 'ente' ? ' checked' : '') + '> Saldo da ' + ENTE[t] + ', após os ajustes</span><b>' + fmt(en) + '</b></label>'
      + '<label class="' + (b === 'sh' ? 'on' : '') + '"><span><input type="radio" name="pc-base-' + t + '" data-ch="base" data-arg="' + t + '|sh"' + (b === 'sh' ? ' checked' : '') + '> Saldo do SplitHub</span><b>' + fmt(Math.max(0, sh)) + '</b></label>'
      + '<label class="' + (b === 'outro' ? 'on' : '') + '"><span><input type="radio" name="pc-base-' + t + '" data-ch="base" data-arg="' + t + '|outro"' + (b === 'outro' ? ' checked' : '') + '> Outro valor (pagamento parcial)</span><input type="number" min="0" step="1000" data-ch="outro" data-arg="' + t + '" value="' + (S.outro[t] || '') + '" placeholder="valor"></label></div>';
    var im = imputacao(T, val);
    h += '<div class="pc-r"><span>O que extingue (ordem cronológica, art. 26)</span><b class="txt">' + im.extintas + ' de ' + im.notas + ' notas de venda em aberto</b></div>'
      + '<div class="pc-r"><span>Clientes cujo crédito depende desta guia</span><b>' + im.clientes + '</b></div>'
      + '<div class="pc-r"><span>Vencimento</span><b>' + fD(c.venc) + '</b></div>';
    if (im.emAberto.length) h += '<div class="pc-alerta red">Pagando <b>' + fmt(val) + '</b>, ficam em aberto <b>' + im.emAberto.length + '</b> nota(s) de venda, de ' + im.clientesAbertos.map(esc).join(', ') + '. O crédito desses clientes não se apropria até o restante ser pago.</div>';
    if (val > en && b !== 'ente') h += '<div class="pc-alerta info">O valor passa do saldo do ente. Excedente só volta em até 3 dias úteis quando RAD ou split extinguem os débitos depois do pagamento (art. 27, § 1º).</div>';
    var sd = semDecisao(c, t).length;
    if (sd) h += '<div class="pc-alerta">' + sd + ' divergência(s) sem decisão. A guia sai mesmo assim, com uma justificativa que fica no histórico.</div>';
    if (ref(c) > c.venc) h += encargos(T, val);
    h += '<div class="pc-btns">' + (t === 'CBS' ? '<button class="btn btn-t pc-btn-sm" data-act="emitir" data-arg="CBS">Emitir DARF</button>' : '<button class="btn btn-t pc-btn-sm" data-act="registrarPortal">Registrar guia emitida no portal</button><button class="btn pc-btn-sm pc-btn-off" data-act="ibsRoadmap">Gerar guia IBS · em breve</button>') + '</div>';
    if (t === 'IBS') h += '<div class="pc-alerta info">O Comitê Gestor ainda não oferece a emissão por API: a etapa de saldo e documento de arrecadação não tem especificação nem data. Até lá, a guia é emitida no portal do Comitê Gestor e registrada aqui (D-PC-07).</div>';
    return h + '</div>';
  }
  function encargos(T, val) {
    var c = T.comp, dias = Math.max(0, diasEntre(c.venc, ref(c))), multa = Math.min(0.2, dias * 0.0033) * val, juros = val * 0.01;
    return '<div class="pc-alerta red">Vencida há ' + dias + ' dia(s). Encargos simulados (D-PC-10): multa de ' + fmt(multa) + ' (0,33% ao dia, limitada a 20%) e juros de ' + fmt(juros) + ' (1% no mês do pagamento; a Selic entra na versão com cálculo).</div>';
  }
  function blocoGuia(T, g) {
    var c = T.comp, h = '<div class="pc-guia"><b>' + esc(g.tipo) + ' · ' + T.tri + ' · competência ' + p2(c.mes) + '/' + c.ano + '</b>' + (g.origem === 'portal' ? ' <span class="pc-chip gray">registrada do portal</span>' : '')
      + '<span class="pc-sub">valor ' + fmt(g.valor) + ' · vencimento ' + fD(g.venc) + ' · emitida em ' + fDH(g.emitida) + (g.pagoEm ? ' · paga em ' + fD(g.pagoEm) : '') + (g.procEm ? ' · processada em ' + fD(g.procEm) : '') + '</span>'
      + '<div class="pc-cb">' + esc(g.linha) + '</div>' + (g.arquivo ? '<span class="pc-sub">PDF: ' + esc(g.arquivo) + '</span>' : '') + (g.just ? '<span class="pc-sub">Justificativa: ' + esc(g.just) + '</span>' : '') + '</div>';
    var en = saldoEnteAjustado(T);
    if ((g.status === 'emitida' || g.status === 'enviada') && Math.abs(en - g.valor) > 0.005 && g.base === 'ente') h += '<div class="pc-alerta">O saldo do ente após os ajustes mudou para <b>' + fmt(en) + '</b> depois da emissão. <button class="pc-a" data-act="substituir" data-arg="' + T.tri + '">Substituir a guia →</button></div>';
    if (g.status === 'processada') {
      h += '<div class="pc-r pc-mt"><span>Notas de venda extintas</span><b>' + g.extintas + '</b></div><div class="pc-r"><span>Clientes com crédito liberado</span><b>' + g.clientes + '</b></div>';
      if (g.excedente) h += '<div class="pc-r"><span>Excedente devolvido em ' + fD(g.devolvidoEm) + '</span><b>' + fmt(g.excedente) + '</b></div>';
      if (saldo(T, 'en') < -0.005) h += '<div class="pc-alerta info">O pagamento passou do saldo atual da ' + ENTE[T.tri] + ' em <b>' + fmt(-saldo(T, 'en')) + '</b>, que fica como saldo a recuperar. A devolução em até 3 dias úteis só vale quando RAD ou split extinguem os débitos depois do pagamento (art. 27, § 1º).</div>';
      if (saldo(T, 'en') > 0.005) h += '<div class="pc-alerta red">Pagamento parcial: restam <b>' + fmt(saldo(T, 'en')) + '</b> em aberto na ' + ENTE[T.tri] + '. <button class="pc-a" data-act="complementar" data-arg="' + T.tri + '">Emitir a guia do restante →</button></div>';
    }
    if (g.status !== 'paga' && g.status !== 'processada' && ref(c) > c.venc) h += encargos(T, g.valor);
    h += '<div class="pc-btns">';
    if (g.status === 'emitida') h += '<button class="btn btn-t pc-btn-sm" data-act="erp" data-arg="' + T.tri + '">Enviar ao ERP</button><button class="btn pc-btn-sm" data-act="cancelar" data-arg="' + T.tri + '">Cancelar guia</button>';
    if (g.status === 'enviada') h += '<button class="btn btn-t pc-btn-sm" data-act="comprovante" data-arg="' + T.tri + '">Registrar comprovante do ERP</button><button class="btn pc-btn-sm" data-act="payload" data-arg="' + T.tri + '">Ver o que foi ao ERP</button><button class="btn pc-btn-sm" data-act="cancelar" data-arg="' + T.tri + '">Cancelar guia</button>';
    if (g.status === 'paga') h += '<button class="btn btn-t pc-btn-sm" data-act="processar" data-arg="' + T.tri + '">Simular processamento do ente</button><button class="btn pc-btn-sm" data-act="payload" data-arg="' + T.tri + '">Ver o que foi ao ERP</button>';
    if (g.status === 'processada') h += '<button class="btn pc-btn-sm" data-act="payload" data-arg="' + T.tri + '">Ver o que foi ao ERP</button><button class="btn pc-btn-sm" data-act="histDet" data-arg="' + c.id + '|' + T.tri + '">Ver no histórico</button>';
    return h + '</div></div>';
  }

  /* aba Histórico */
  function abaHist() {
    var D = dados(empresa()), linhas = [];
    [2027, 2026].forEach(function (a) { D[a].slice().reverse().forEach(function (c) { TRIS.forEach(function (t) { c.tributos[t].guias.forEach(function (g) { linhas.push({ c: c, t: t, g: g }); }); }); }); });
    var seg = '<div class="pc-seg">' + [['todos', 'Todos'], ['CBS', 'CBS · Receita Federal'], ['IBS', 'IBS · Comitê Gestor']].map(function (s) { return '<button data-act="histTri" data-arg="' + s[0] + '"' + (S.histTri === s[0] ? ' class="on"' : '') + '>' + s[1] + '</button>'; }).join('') + '</div>';
    var l = linhas.filter(function (x) { return S.histTri === 'todos' || x.t === S.histTri; });
    var porComp = {};
    l.forEach(function (x) { if (x.g.status === 'cancelada' || x.g.status === 'substituida') return; porComp[x.c.id] = (porComp[x.c.id] || 0) + x.g.valor; });
    return '<div class="pc-linha">' + seg + '<span class="pc-info">' + esc(empresa().razao) + ' · ' + l.length + ' guia(s)</span></div>'
      + (l.length ? '<div class="pc-tw"><table class="pc-tb larga"><thead><tr><th class="l">Competência · tributo</th><th class="l">Guia</th><th>Valor (R$)</th><th>Vencimento</th><th>Pago em</th><th class="l">Estado</th><th class="l">ERP</th></tr></thead><tbody>'
        + l.map(function (x) {
          var g = x.g;
          return '<tr class="clic" data-act="histDet" data-arg="' + x.c.id + '|' + x.t + '"><td class="l"><b>' + rot(x.c) + '</b> · ' + x.t + ' · ' + ENTE[x.t] + '</td><td class="l">' + esc(g.tipo) + (g.origem === 'portal' ? ' · registrada do portal' : ' · emitida pelo SplitHub') + '</td><td>' + fmt(g.valor) + '</td><td>' + fD(g.venc) + '</td><td>' + (g.pagoEm ? fD(g.pagoEm) : '—') + '</td>'
            + '<td class="l"><span class="pc-dv ' + (g.status === 'processada' ? 'ok' : (g.status === 'cancelada' || g.status === 'substituida' ? 'gr' : 'inf')) + '">' + rotStatus(g) + '</span>' + (g.excedente ? '<span class="pc-sub">excedente de ' + fmt(g.excedente) + ' devolvido em ' + fD(g.devolvidoEm) + '</span>' : '') + '</td>'
            + '<td class="l">' + (g.pagoEm ? 'comprovante ✓' : (g.erp ? 'enviada' : '—')) + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="pc-alerta info">Nenhuma guia ainda para esta empresa.</div>')
      + '<div class="pc-nota">Clique numa linha para ver a linha do tempo da competência e o retrato do demonstrativo no momento da emissão.</div>';
  }

  /* aba Auditoria */
  function filtroAud(D, c) {
    return D.aud.filter(function (r) { return (S.audQuem === 'todos' || r.quem === S.audQuem) && (S.audAcao === 'todas' || r.acao === S.audAcao) && (S.audComp === 'todas' || r.comp === c.id) && (S.audTri === 'todos' || r.tri === S.audTri); }).slice().reverse();
  }
  function abaAud(c) {
    var D = dados(empresa()), quems = [], acoes = [];
    D.aud.forEach(function (r) { if (quems.indexOf(r.quem) < 0) quems.push(r.quem); if (acoes.indexOf(r.acao) < 0) acoes.push(r.acao); });
    var l = filtroAud(D, c), ok = integra(D);
    function sel(k, opts) { return '<select data-ch="' + k + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (S[k] === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; }
    return '<div class="pc-filtros">'
      + '<label>Usuário ' + sel('audQuem', [['todos', 'Todos']].concat(quems.map(function (x) { return [x, x]; }))) + '</label>'
      + '<label>Ação ' + sel('audAcao', [['todas', 'Todas']].concat(acoes.map(function (x) { return [x, ACAO[x] || x]; }))) + '</label>'
      + '<label>Competência ' + sel('audComp', [['todas', 'Todas'], ['atual', rotL(c)]]) + '</label>'
      + '<label>Tributo ' + sel('audTri', [['todos', 'Todos'], ['CBS', 'CBS · Receita Federal'], ['IBS', 'IBS · Comitê Gestor']]) + '</label>'
      + '<button class="btn pc-btn-sm" data-act="audCsv">↓ CSV</button></div>'
      + '<div class="pc-alerta ' + (ok ? 'ok' : 'red') + '">' + (ok ? '✓ Trilha íntegra' : '✕ Trilha com quebra de encadeamento') + ': <b>' + D.aud.length + '</b> registro(s) de ' + esc(empresa().razao) + '. Cada registro leva o hash do anterior; nada se edita nem se apaga. Último hash <span class="pc-mono">' + (D.aud.length ? D.aud[D.aud.length - 1].hash : '—') + '</span>.</div>'
      + (l.length ? '<div class="pc-tw"><table class="pc-tb larga"><thead><tr><th>#</th><th class="l">Data e hora</th><th class="l">Quem</th><th class="l">Origem</th><th class="l">Ação</th><th class="l">Competência · tributo</th><th class="l">Alvo</th><th class="l">Antes → depois</th><th class="l">Motivo</th><th class="l">Hash</th></tr></thead><tbody>'
        + l.map(function (r) {
          var cp = r.comp ? rotL({ ano: +r.comp.slice(0, 4), mes: +r.comp.slice(5, 7) }) : '—';
          return '<tr><td>' + r.seq + '</td><td class="l"><span class="pc-mono">' + fDH(r.q) + '</span></td><td class="l"><b>' + esc(r.quem) + '</b>' + (r.perfil ? '<span class="pc-sub">' + esc(r.perfil) + '</span>' : '') + '</td>'
            + '<td class="l"><span class="pc-dv ' + (r.origem === 'Tela' ? 'inf' : (r.origem === 'API' ? 'ok' : 'gr')) + '">' + esc(r.origem) + '</span></td><td class="l">' + esc(ACAO[r.acao] || r.acao) + '</td><td class="l">' + cp + (r.tri ? ' · ' + r.tri : '') + '</td>'
            + '<td class="l"><span class="pc-mono">' + esc(r.alvo) + '</span></td><td class="l">' + (r.antes ? esc(r.antes) + ' → ' : '') + esc(r.depois) + '</td><td class="l">' + esc(r.motivo) + '</td><td class="l"><span class="pc-mono">' + r.hash + '</span></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="pc-alerta info">Nenhum registro com estes filtros.</div>')
      + '<div class="pc-nota">Entram as ações na tela, as chamadas do ERP pela API e os eventos do sistema (leituras dos entes, chamados abertos e resolvidos, processamento). Navegar e filtrar não entram.</div>';
  }

  /* ── modais ───────────────────────────────────────────────────────────── */
  function modal(id, titulo, sub, corpo, rodape, estreito) {
    fechar(id);
    document.body.insertAdjacentHTML('beforeend', '<div id="' + id + '" class="moverlay" onclick="if(event.target===this)this.remove()"><div class="mbox pc-mbox' + (estreito ? ' estreito' : '') + '" role="dialog" aria-modal="true" aria-labelledby="' + id + '-t">'
      + '<div class="mbox-hdr"><div style="min-width:0"><div class="mbox-title" id="' + id + '-t">' + titulo + '</div>' + (sub ? '<div class="mbox-sub">' + sub + '</div>' : '') + '</div><button class="mbox-close" aria-label="Fechar" onclick="document.getElementById(\'' + id + '\').remove()">✕</button></div>'
      + '<div class="mbox-col" id="' + id + '-c">' + corpo + '</div>' + (rodape ? '<div class="pc-mrod">' + rodape + '</div>' : '') + '</div></div>');
    var m = document.getElementById(id); m.addEventListener('click', clique); m.addEventListener('change', mudanca); m.addEventListener('input', mudanca);
  }
  function fechar(id) { var e = document.getElementById(id); if (e) e.remove(); }

  var DET = { tri: null, linha: null, origem: null, busca: '', soDiv: false, doc: null };
  function detalhe() {
    var c = comp(), T = c.tributos[DET.tri], docs, titulo;
    if (DET.linha === 'aapropriar') {
      docs = T.aApropriar.filter(function (d) { return visivel(d, c); }).slice();
      abertas(c, T.tri).forEach(function (dv) { if (dv.linha.id === 'cred' && difDv(dv) < 0) docs.push({ num: dv.doc.num, data: dv.doc.data, parte: dv.doc.parte, sh: 0, en: -difDv(dv), dv: dv, espelho: true }); });
      titulo = 'Créditos a apropriar · ' + T.tri + ' · ' + rotL(c);
    } else {
      var l = linha(T, DET.linha), o = l.origens[DET.origem]; docs = docsV(o, c); titulo = l.nome + ' › ' + o.nome + ' · ' + T.tri + ' · ' + rotL(c);
    }
    var q = DET.busca.toLowerCase();
    var f = docs.filter(function (d) { return (!DET.soDiv || d.sh !== d.en) && (!q || (d.num + ' ' + d.parte).toLowerCase().indexOf(q) >= 0); });
    var grupos = {}, ordem = [];
    f.forEach(function (d) { if (!grupos[d.parte]) { grupos[d.parte] = []; ordem.push(d.parte); } grupos[d.parte].push(d); });
    var corpo = '<div class="pc-filtros"><input type="search" placeholder="Buscar documento ou contraparte" data-ch="detBusca" value="' + esc(DET.busca) + '"><label><input type="checkbox" data-ch="detDiv"' + (DET.soDiv ? ' checked' : '') + '> Só com divergência</label><span class="pc-info">' + f.length + ' de ' + docs.length + ' lançamento(s)</span></div>'
      + '<div class="pc-tw"><table class="pc-tb"><thead><tr><th class="l">Contraparte · documento</th><th>SplitHub (R$)</th><th>' + ENTE[T.tri] + ' (R$)</th><th>Diferença (R$)</th><th class="l">Chamado</th></tr></thead><tbody>'
      + ordem.map(function (p) {
        var g = grupos[p], a = g.reduce(function (s, d) { return s + d.sh; }, 0), b = g.reduce(function (s, d) { return s + d.en; }, 0);
        return '<tr class="res"><td class="l">' + esc(p) + ' · ' + g.length + ' lançamento(s)</td><td>' + fmt(a) + '</td><td>' + fmt(b) + '</td><td class="' + (b - a ? 'dif' : 'z') + '">' + fmt(b - a) + '</td><td></td></tr>'
          + g.map(function (d) { var i = docs.indexOf(d); return '<tr class="n2 clic" data-act="docCC" data-arg="' + i + '"><td class="l">' + esc(d.num) + ' · ' + esc(d.data) + (d.espelho ? ' <span class="pc-sub">apropriado no SplitHub, a apropriar no ente</span>' : '') + '</td><td>' + fmt(d.sh) + '</td><td>' + fmt(d.en) + '</td><td class="' + (d.en - d.sh ? 'dif' : 'z') + '">' + fmt(d.en - d.sh) + '</td><td class="l">' + (d.dv ? '<span class="pc-cham">' + d.dv.chamado.id + '</span>' : '') + '</td></tr>'; }).join('');
      }).join('') + '</tbody></table></div>';
    if (DET.doc != null && docs[DET.doc]) corpo += contaCorrente(T, docs[DET.doc], DET.linha);
    DET.docs = docs;
    var ex = document.getElementById('pc-det');
    if (ex) { document.getElementById('pc-det-c').innerHTML = corpo; return; }
    modal('pc-det', esc(titulo), esc(empresa().razao) + ' · clique num documento para ver o conta corrente da operação', corpo, '<button class="btn pc-btn-sm" data-act="detCsv">↓ CSV</button><button class="btn pc-btn-sm" onclick="document.getElementById(\'pc-det\').remove()">Fechar</button>');
  }
  function contaCorrente(T, d, lid) {
    var en = T.ente, linhas = [];
    function L(q, a, b, x) { linhas.push('<div class="d">' + q + '</div><div>' + a + '</div><div' + (x ? ' class="x"' : '') + '>' + b + '</div>'); }
    var dc = d.data.slice(0, 5);
    if (lid === 'deb' || lid === 'ext' || lid === 'rdeb') {
      var nota = linha(T, 'deb').origens[0].docs.filter(function (x) { return x.num === d.num; })[0] || d;
      L(nota.data.slice(0, 5), 'Fornecimento para ' + esc(nota.parte) + ': débito de ' + fmt(nota.sh), 'Fornecimento: débito de ' + fmt(nota.en), nota.sh !== nota.en);
      linha(T, 'ext').origens.forEach(function (o) { o.docs.filter(function (x) { return x.num === nota.num && visivel(x, T.comp); }).forEach(function (x) { L(x.data.slice(0, 5), x.sh ? 'Extinção por RAD de ' + fmt(x.sh) : 'Sem registro de RAD', x.en ? 'Extinção por RAD de ' + fmt(x.en) : 'Sem registro de RAD', x.sh !== x.en); }); });
      var g = guiaAtiva(T);
      if (g && g.status === 'processada') L(fDC(g.procEm), 'Pagamento PCONT (' + esc(g.id) + ') na ordem cronológica', 'Pagamento por período de apuração', false);
      else L('—', 'Compensação com créditos e PCONT seguem a ordem cronológica (art. 26)', 'Débito em aberto até a extinção', false);
    } else if (lid === 'cred' || lid === 'aapropriar') {
      L(dc, 'Aquisição de ' + esc(d.parte) + ': crédito destacado de ' + fmt(Math.max(d.sh, d.en)), 'Aquisição: crédito destacado de ' + fmt(Math.max(d.sh, d.en)), false);
      if (d.rad) L(d.rad.slice(-2) + '/' + p2(T.comp.mes), 'Guia ' + esc(d.rad) + ' paga com comprovante: extinção por RAD e <b>crédito apropriado</b>', d.en ? 'Extinção por RAD: crédito apropriado' : 'Sem registro de RAD', !d.en);
      L(fDC(ultimaLeitura(T.comp)), d.sh ? 'Crédito apropriado de ' + fmt(d.sh) : 'Crédito a apropriar: débito do fornecedor ainda não extinto', d.en ? 'Crédito apropriado de ' + fmt(d.en) : 'Crédito <b>a apropriar</b>', d.sh !== d.en);
    } else {
      L(dc, esc(d.parte) + ': ' + fmt(d.sh), esc(d.parte) + ': ' + fmt(d.en), d.sh !== d.en);
    }
    var dv = d.dv;
    return '<div class="pc-t">Conta corrente da operação · ' + esc(d.num) + '</div><div class="pc-cc"><div class="h">Data</div><div class="h">SplitHub</div><div class="h">' + en + '</div>' + linhas.join('') + '</div>'
      + (dv ? '<div class="pc-btns"><button class="btn btn-t pc-btn-sm" data-act="dv" data-arg="' + dv.id + '">Abrir ' + dv.id + ' · ' + dv.chamado.id + '</button><button class="btn pc-btn-sm" data-act="irConc">Abrir na Conciliação</button></div>' : '<div class="pc-btns"><button class="btn pc-btn-sm" data-act="irConc">Abrir na Conciliação</button></div>');
  }

  function modalDv(id) {
    var c = comp(), dv = (c.divs || []).filter(function (x) { return x.id === id; })[0]; if (!dv) return;
    fechar('pc-det');
    var d = dv.T.decisoes[dv.id], ops = DECISOES[dv.tipo] || [], res = dv.chamado.estado === 'resolvida';
    var corpo = '<div class="pc-r"><span>Tributo · linha</span><b class="txt">' + dv.tri + ' · ' + esc(dv.linha.nome) + ' · ' + NAT[dv.linha.nat] + '</b></div>'
      + '<div class="pc-r"><span>Documento</span><b class="txt">' + esc(dv.doc.num) + ' · ' + esc(dv.doc.parte) + ' · ' + esc(dv.doc.data) + '</b></div>'
      + '<div class="pc-r"><span>SplitHub · ' + ENTE[dv.tri] + '</span><b>' + fmt(dv.doc.sh) + ' · ' + fmt(dv.doc.en) + '</b></div>'
      + '<div class="pc-r"><span>Diferença · no saldo do ente</span><b class="dif">' + fmt(difDv(dv)) + ' · ' + fmtS(efeitoDv(dv)) + '</b></div>'
      + '<div class="pc-r"><span>Tipo</span><b class="txt">' + dv.tipo + ' · ' + esc(TIPO_NOME[dv.tipo] || '') + '</b></div>'
      + (dv.motivo ? '<div class="pc-r"><span>Motivo</span><b class="txt">' + esc(dv.motivo) + '</b></div>' : '')
      + '<div class="pc-t">Chamado ' + dv.chamado.id + '</div>'
      + '<div class="pc-r"><span>Estado</span><b class="txt">' + esc(dv.chamado.estado) + '</b></div>'
      + '<div class="pc-r"><span>Responsável</span><b class="txt">' + esc(dv.chamado.resp || 'sem responsável') + '</b></div>'
      + '<div class="pc-r"><span>Terceiro</span><b class="txt">' + esc(dv.chamado.terceiro || '—') + '</b></div>'
      + '<div class="pc-r"><span>SLA</span><b class="txt">' + (dv.chamado.sla ? fD(dv.chamado.sla) : '—') + '</b></div>';
    if (!res && !c.informativo) {
      corpo += '<div class="pc-t">Decisão antes da guia</div><div class="pc-esc" id="pc-dv-esc">' + ops.map(function (o) { return '<button data-act="dvEsc" data-arg="' + o[0] + '"' + (d && d.op === o[0] ? ' class="on"' : '') + '>' + o[1] + '</button>'; }).join('') + '</div>'
        + '<label class="pc-campo pc-mt">Observação<textarea id="pc-dv-nota" placeholder="Opcional">' + esc(d ? d.nota : '') + '</textarea></label>'
        + (d ? '<div class="pc-nota">Registrada por ' + esc(d.por) + ' em ' + fDH(d.em) + '.</div>' : '')
        + '<div class="pc-nota">"Ajustar no portal" desconta a diferença do valor sugerido da guia, como saldo do ente após os ajustes, e o reflexo aparece na próxima leitura simulada. "Aguardar o reflexo", "Importar o comprovante" e "Corrigir o documento" também se resolvem na próxima leitura. "Aceitar o valor do ente" encerra o chamado com o valor do ente.</div>';
    }
    modal('pc-dv', dv.id + ' · ' + dv.tri + ' · ' + rotL(c), esc(empresa().razao), corpo,
      (!res && !c.informativo ? '<button class="btn pc-btn-sm" data-act="irInc">Abrir em Inconsistências</button><button class="btn btn-t pc-btn-sm" data-act="dvSalvar" data-arg="' + dv.id + '">Registrar decisão</button>' : '<button class="btn pc-btn-sm" data-act="irInc">Abrir em Inconsistências</button>'), true);
    DVESC = d ? d.op : null;
  }
  var DVESC = null;

  function modalHist(cid, t) {
    var D = dados(empresa()), c = D[2027].concat(D[2026]).filter(function (x) { return x.id === cid; })[0]; if (!c) return;
    var T = c.tributos[t], g = T.guias.filter(function (x) { return x.status !== 'cancelada' && x.status !== 'substituida'; })[0] || T.guias[0], r = g ? g.retrato : retrato(T);
    var corpo = '<div class="pc-duo"><div><div class="pc-t">Linha do tempo</div>' + (T.eventos.length ? '<ul class="pc-etapas" style="gap:6px">' + T.eventos.map(function (x) { return '<li style="font-size:12px;color:var(--txt2)"><span class="pc-q">' + fDH(x.q) + '</span>' + x.txt + '</li>'; }).join('') + '</ul>' : '<div class="pc-nota">Sem eventos.</div>') + '</div>'
      + '<div class="pc-card"><div class="pc-card-h"><span class="pc-card-n">Retrato no pagamento</span><span class="pc-chip gray">congelado em ' + fD(r.em) + '</span></div>'
      + r.linhas.map(function (l) { return '<div class="pc-r"><span><span class="pc-op">' + l.op + '</span>' + esc(l.nome) + '</span><b>' + fmt(l.en) + '</b></div>'; }).join('')
      + '<div class="pc-r"><span><b>Saldo do ente · SplitHub</b></span><b>' + fmt(r.saldoEn) + ' · ' + fmt(r.saldoSh) + '</b></div><div class="pc-r"><span>Divergências na data</span><b class="txt">' + (r.divs || 'nenhuma') + '</b></div>'
      + '<div class="pc-f">O demonstrativo, as divergências e as decisões ficam como estavam na emissão da guia, mesmo que o ente mude depois.</div></div></div>';
    modal('pc-hist', t + ' · ' + ENTE[t] + ' · ' + rotL(c), esc(empresa().razao) + (g ? ' · ' + esc(g.tipo) + ' ' + fmt(g.valor) + ' · ' + rotStatus(g) : ''), corpo, '<button class="btn pc-btn-sm" onclick="document.getElementById(\'pc-hist\').remove()">Fechar</button>');
  }

  function payload(T, g) {
    var c = T.comp, im = imputacao(T, g.valor);
    var LIN = { deb: 'debits', rdeb: 'debit_reducers', cred: 'appropriated_credits', rcred: 'credit_reducers', ant: 'prior_period_credits', ext: 'rad_split_extinctions', pcont: 'taxpayer_payments' };
    return {
      event: 'pcont.guide_issued',
      company: { cnpj_root: empresa().raiz, head_office: (empresa().matriz || {}).cnpj || null },
      guide: { id: g.id, tax: T.tri, authority: T.tri === 'CBS' ? 'RECEITA_FEDERAL' : 'COMITE_GESTOR', period: c.id, type: T.tri === 'CBS' ? 'DARF' : 'DOCUMENTO_ARRECADACAO', source: g.origem === 'portal' ? 'AUTHORITY_PORTAL' : 'SPLITHUB', amount: g.valor, due_date: c.venc.toISOString().slice(0, 10), barcode: g.linha, pdf_url: '/v1/pcont/guides/' + g.id + '/pdf' },
      settlement: { basis: g.base === 'sh' ? 'SPLITHUB_BALANCE' : (g.base === 'outro' ? 'CUSTOM_AMOUNT' : 'AUTHORITY_BALANCE'), splithub_balance: g.retrato.saldoSh, authority_balance: g.retrato.saldoEn, difference: g.retrato.saldoEn - g.retrato.saldoSh,
        lines: T.linhas.map(function (l) { return { line: LIN[l.id], splithub: somaLinha(l, c, 'sh'), authority: somaLinha(l, c, 'en') }; }),
        open_divergences: abertas(c, T.tri).map(function (dv) { return { id: dv.id, ticket: dv.chamado.id, nature: dv.linha.nat === 'credito' ? 'credit' : 'debit', difference: difDv(dv) }; }), authority_read_at: ultimaLeitura(c).toISOString() },
      allocation: { documents_extinguished: im.extintas, documents_left_open: im.emAberto.length, documents_url: '/v1/pcont/guides/' + g.id + '/allocation' }
    };
  }
  function modalPayload(t) {
    var T = comp().tributos[t], g = guiaAtiva(T) || T.guias[0]; if (!g) return;
    modal('pc-pay', 'Enviado ao ERP · <code>pcont.guide_issued</code>', esc(g.tipo) + ' · ' + t + ' · ' + rotL(comp()), '<pre class="pc-json">' + esc(JSON.stringify(payload(T, g), null, 2)) + '</pre><div class="pc-nota">O ERP também consulta <code>GET /v1/pcont/settlements</code>, <code>/divergences</code> e <code>/guides/{id}/allocation</code>, e devolve o comprovante em <code>POST /v1/pcont/proofs</code>.</div>', '<button class="btn pc-btn-sm" onclick="document.getElementById(\'pc-pay\').remove()">Fechar</button>');
  }

  /* ── ações ────────────────────────────────────────────────────────────── */
  function T_(t) { return comp().tributos[t]; }
  function emitir(t, just) {
    var T = T_(t), c = T.comp, b = S.base[t], en = saldoEnteAjustado(T), val = b === 'ente' ? en : (b === 'sh' ? Math.max(0, saldo(T, 'sh')) : (S.outro[t] || 0));
    if (!(val > 0)) { toast('Informe um valor maior que zero.'); return; }
    var g = novaGuia(T, val, 'splithub', new Date(ref(c)), b); g.just = just || '';
    aud('emitir', c, t, g.id, '', fmt(val) + ' · ' + (b === 'ente' ? 'saldo do ente após os ajustes' : (b === 'sh' ? 'saldo do SplitHub' : 'valor informado')), just);
    evento(T, new Date(ref(c)), 'E6', 'DARF emitido pelo SplitHub · <b>' + fmt(val) + '</b> · vence ' + fD(c.venc) + (b !== 'ente' ? ' · valor ' + (b === 'sh' ? 'do SplitHub' : 'informado') : '') + (just ? ' · justificativa: ' + esc(just) : ''));
    toast('DARF emitido: ' + fmt(val) + '. Envie ao ERP para pagamento.'); render();
  }
  function pedirJust(acao, t) {
    var n = semDecisao(comp(), t).length;
    modal('pc-just', 'Emitir com ' + n + ' divergência(s) sem decisão', 'A justificativa fica no histórico da competência', '<label class="pc-campo">Justificativa<textarea id="pc-just-t" placeholder="Por que emitir antes de decidir"></textarea></label>', '<button class="btn pc-btn-sm" onclick="document.getElementById(\'pc-just\').remove()">Voltar</button><button class="btn btn-t pc-btn-sm" data-act="justOk" data-arg="' + acao + '|' + t + '">Emitir</button>', true);
  }
  function registrarPortal() {
    var T = T_('IBS'), c = T.comp, v = saldoEnteAjustado(T);
    modal('pc-portal', 'Registrar guia do IBS emitida no portal', 'Comitê Gestor · competência ' + rotL(c), '<div class="pc-alerta info">Emita a guia no portal do Comitê Gestor e registre aqui: o histórico, o ERP e o acompanhamento passam a funcionar como na guia emitida pelo SplitHub.</div>'
      + '<label class="pc-campo">Linha digitável<input id="pc-pt-linha" value="8583 ' + ('0000000' + Math.round(v)).slice(-11) + ' ' + p2(c.mes) + c.ano + ' 00000 00000000"></label>'
      + '<label class="pc-campo">Valor (R$)<input id="pc-pt-valor" type="number" min="0" step="10" value="' + v + '"></label>'
      + '<label class="pc-campo">Vencimento<input id="pc-pt-venc" value="' + fD(c.venc) + '" disabled></label>'
      + '<label class="pc-campo">PDF da guia (opcional)<input id="pc-pt-pdf" type="file" accept="application/pdf"></label>',
      '<button class="btn pc-btn-sm" onclick="document.getElementById(\'pc-portal\').remove()">Cancelar</button><button class="btn btn-t pc-btn-sm" data-act="portalOk">Registrar</button>', true);
  }
  function portalOk(just) {
    var T = T_('IBS'), c = T.comp, v = parseFloat(document.getElementById('pc-pt-valor').value) || 0, ln = document.getElementById('pc-pt-linha').value.trim(), f = document.getElementById('pc-pt-pdf').files[0];
    if (!(v > 0) || !ln) { toast('Informe a linha digitável e o valor.'); return; }
    if (semDecisao(c, 'IBS').length && just == null) { PEND = { v: v, ln: ln, f: f ? f.name : '' }; fechar('pc-portal'); pedirJust('portal', 'IBS'); return; }
    var dados_ = PEND || { v: v, ln: ln, f: f ? f.name : '' }; PEND = null;
    var g = novaGuia(T, dados_.v, 'portal', new Date(ref(c)), Math.abs(dados_.v - saldoEnteAjustado(T)) < 0.005 ? 'ente' : 'outro'); g.linha = dados_.ln; g.arquivo = dados_.f; g.just = just || '';
    aud('registrar', c, 'IBS', g.id, '', fmt(dados_.v) + ' · guia do portal do Comitê Gestor' + (dados_.f ? ' · PDF ' + dados_.f : ''), just);
    evento(T, new Date(ref(c)), 'E6', 'Guia emitida no portal do Comitê Gestor e registrada · <b>' + fmt(dados_.v) + '</b> · vence ' + fD(c.venc));
    fechar('pc-portal'); toast('Guia do IBS registrada.'); render();
  }
  var PEND = null;
  function avancarLeitura() {
    var r = REF[2027], n = new Date(r); n.setDate(n.getDate() + 1); while (!util(n)) n.setDate(n.getDate() + 1); n.setHours(8, 0); REF[2027] = n; S.ultimaExec = new Date(n.getTime() + 600000);
    var mudou = [];
    aud('leitura', null, '', 'leitura simulada dos entes', fDH(r), fDH(n), 'simulação do protótipo');
    dados(empresa())[2027].forEach(function (c) {
      (c.divs || []).forEach(function (dv) {
        if (dv.chamado.estado === 'resolvida' || !visivel(dv.doc, c)) return;
        var d = dv.T.decisoes[dv.id]; if (!d) return;
        var txt = '';
        if (d.op === 'aguardar' || d.op === 'ajustar') { dv.doc.en = dv.doc.sh; txt = d.op === 'aguardar' ? 'refletido pela ' + ENTE[dv.tri] : 'ajuste feito no portal refletido'; }
        else if (d.op === 'importar' || d.op === 'corrigir') { dv.doc.sh = dv.doc.en; txt = d.op === 'importar' ? 'comprovante do cliente importado' : 'documento corrigido pelo ERP'; }
        else if (d.op === 'aceitar') txt = 'valor do ente aceito';
        dv.chamado.estado = 'resolvida';
        auditar(dados(empresa()), { q: new Date(n), quem: 'Sistema · ' + ENTE[dv.tri], origem: 'Sistema', acao: 'chamado', comp: c.id, tri: dv.tri, alvo: dv.id + ' · ' + dv.chamado.id, antes: nomeDecisao(dv, d.op), depois: 'resolvida', motivo: txt });
        evento(dv.T, new Date(n), 'E4', 'Leitura de ' + fDH(n) + ': ' + dv.id + ' ' + txt + ' · chamado <b>' + dv.chamado.id + '</b> resolvido');
        mudou.push(dv.id);
      });
    });
    toast('Leitura simulada de ' + fDH(n) + (mudou.length ? ': ' + mudou.join(', ') + ' resolvida(s).' : ': sem mudança nos saldos.')); render();
  }

  function clique(ev) {
    var b = ev.target.closest('[data-act]'); if (!b) return;
    var a = b.getAttribute('data-act'), arg = b.getAttribute('data-arg');
    var c = comp();
    switch (a) {
      case 'aba': S.aba = arg; break;
      case 'ano': S.ano = +arg; var l = comps().filter(temDados); S.comp = (l[l.length - (S.ano === 2027 ? 2 : 1)] || comps()[0]).id; break;
      case 'comp': S.comp = arg; break;
      case 'modo': S.modo = arg; S.aba = 'comp'; break;
      case 'linha': S.abertas[arg] = !S.abertas[arg]; break;
      case 'origem': var p = arg.split('|'); DET = { tri: S.modo, linha: p[0], origem: +p[1], busca: '', soDiv: false, doc: null }; detalhe(); return;
      case 'aapropriar': DET = { tri: S.modo, linha: 'aapropriar', origem: 0, busca: '', soDiv: false, doc: null }; detalhe(); return;
      case 'docCC': DET.doc = +arg; detalhe(); var cc = document.querySelector('#pc-det .pc-cc'); if (cc) cc.scrollIntoView({ block: 'center', behavior: 'smooth' }); return;
      case 'detCsv': aud('exportar', c, DET.tri, 'detalhamento · CSV', '', (DET.docs || []).length + ' lançamento(s)'); csv('pcont-' + DET.tri + '-' + c.id + '-detalhe.csv', [['Contraparte', 'Documento', 'Data', 'SplitHub', ENTE[DET.tri], 'Diferença']].concat((DET.docs || []).map(function (d) { return [d.parte, d.num, d.data, d.sh, d.en, d.en - d.sh]; }))); return;
      case 'tlTri': S.tlTri = arg; break;
      case 'divTri': S.divTri = arg; break;
      case 'divNat': S.divNat = arg; break;
      case 'matriz': var m = arg.split('|'); S.divTri = m[0]; S.divNat = m[1]; break;
      case 'histTri': S.histTri = arg; break;
      case 'histDet': var h = arg.split('|'); modalHist(h[0], h[1]); return;
      case 'dv': modalDv(arg); return;
      case 'dvEsc': DVESC = arg; document.querySelectorAll('#pc-dv-esc button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-arg') === arg); }); return;
      case 'dvSalvar':
        if (!DVESC) { toast('Escolha uma decisão.'); return; }
        var dv = (c.divs || []).filter(function (x) { return x.id === arg; })[0], nota = (document.getElementById('pc-dv-nota') || {}).value || '';
        var antes = dv.T.decisoes[dv.id] ? nomeDecisao(dv, dv.T.decisoes[dv.id].op) : 'sem decisão';
        dv.T.decisoes[dv.id] = { op: DVESC, por: quem(), em: new Date(ref(c)), nota: nota };
        aud('decisao', c, dv.tri, dv.id + ' · ' + dv.chamado.id, antes, nomeDecisao(dv, DVESC) + (DVESC === 'aceitar' ? ' · chamado resolvido' : ''), nota);
        if (DVESC === 'aceitar') { dv.chamado.estado = 'resolvida'; evento(dv.T, new Date(ref(c)), 'E4', dv.id + ': valor do ente aceito, por ' + quem() + ' · chamado <b>' + dv.chamado.id + '</b> resolvido'); }
        else { if (dv.chamado.estado === 'aberta') dv.chamado.estado = 'em análise'; if (!dv.chamado.resp) dv.chamado.resp = quem(); evento(dv.T, new Date(ref(c)), 'E4', dv.id + ': decisão "' + nomeDecisao(dv, DVESC) + '", por ' + quem() + (nota ? ' · ' + esc(nota) : '')); }
        fechar('pc-dv'); toast('Decisão registrada em ' + dv.id + '.'); break;
      case 'irInc': fechar('pc-dv'); var bi = document.getElementById('nav-inconsist-btn'); if (bi) bi.click(); toast('Os chamados do PCONT são simulados neste protótipo.'); return;
      case 'irConc': fechar('pc-det'); var bc = document.getElementById('nav-conciliacao-btn'); if (bc) bc.click(); return;
      case 'irGuia': S.aba = 'guias'; break;
      case 'ibsRoadmap': toast('A emissão da guia do IBS entra quando o Comitê Gestor publicar a etapa de saldo e documento de arrecadação. Até lá: registrar a guia do portal.'); return;
      case 'emitir': if (semDecisao(c, arg).length) { pedirJust('emitir', arg); return; } emitir(arg); return;
      case 'justOk': var j = (document.getElementById('pc-just-t') || {}).value || ''; if (!j.trim()) { toast('Escreva a justificativa.'); return; } fechar('pc-just'); var k = arg.split('|'); if (k[0] === 'emitir') emitir(k[1], j.trim()); else portalOk(j.trim()); return;
      case 'registrarPortal': registrarPortal(); return;
      case 'portalOk': portalOk(); return;
      case 'erp': var g1 = guiaAtiva(T_(arg)); aud('erp', c, arg, g1.id, rotStatus(g1), 'no ERP · pcont.guide_issued'); g1.status = 'enviada'; g1.erp = new Date(ref(c)); evento(T_(arg), new Date(ref(c)), 'E6', 'Enviada ao ERP (<code>pcont.guide_issued</code>), com a apuração do mês e a decomposição'); modalPayload(arg); break;
      case 'payload': modalPayload(arg); return;
      case 'comprovante': var g2 = guiaAtiva(T_(arg)); aud('comprovante', c, arg, g2.id, rotStatus(g2), 'paga · POST /v1/pcont/proofs', 'simulado por ' + quem(), 'API', 'ERP · integração'); g2.status = 'paga'; g2.pagoEm = new Date(ref(c)); evento(T_(arg), new Date(ref(c)), 'E6', 'Comprovante recebido do ERP (<code>POST /v1/pcont/proofs</code>)'); toast('Comprovante registrado.'); break;
      case 'processar':
        var T3 = T_(arg), g3 = guiaAtiva(T3), im = imputacao(T3, g3.valor), pr = new Date(ref(c)); pr.setDate(pr.getDate() + 1); pr.setHours(8, 0);
        g3.status = 'processada'; g3.procEm = pr; g3.extintas = im.extintas; g3.clientes = im.clientes;
        aud('processar', c, arg, g3.id, 'paga', 'processada · ' + im.extintas + ' notas extintas', 'simulado por ' + quem(), 'Sistema', 'Sistema · ' + ENTE[arg]);
        linha(T3, 'pcont').origens[0].docs.push(doc(g3.id, fD(dt(c.ano, c.mes + 1, 0)), 'Guia ' + g3.tipo + ' · processada em ' + fD(pr), g3.valor, g3.valor));
        evento(T3, pr, 'E7', 'A ' + ENTE[arg] + ' processou o pagamento: <b>' + im.extintas + '</b> notas extintas, crédito liberado para <b>' + im.clientes + '</b> clientes' + (im.emAberto.length ? ' · <b>' + im.emAberto.length + '</b> nota(s) ainda em aberto' : ''));
        toast('Pagamento processado pela ' + ENTE[arg] + '.'); break;
      case 'complementar': S.base[arg] = 'ente'; if (arg === 'CBS') emitir('CBS', ''); else registrarPortal(); return;
      case 'cancelar': var g4 = guiaAtiva(T_(arg)); aud('cancelar', c, arg, g4.id, rotStatus(g4), 'cancelada · pcont.guide_cancelled'); g4.status = 'cancelada'; evento(T_(arg), new Date(ref(c)), 'E6', 'Guia ' + esc(g4.id) + ' cancelada antes do pagamento (<code>pcont.guide_cancelled</code>)'); toast('Guia cancelada.'); break;
      case 'substituir': var g5 = guiaAtiva(T_(arg)); aud('substituir', c, arg, g5 ? g5.id : '', g5 ? fmt(g5.valor) : '', 'substituída pelo novo saldo do ente', 'saldo do ente mudou depois da emissão'); S.base[arg] = 'ente'; evento(T_(arg), new Date(ref(c)), 'E6', 'Guia substituída: o saldo do ente mudou depois da emissão (<code>pcont.guide_replaced</code>)'); if (arg === 'CBS') emitir('CBS', 'substituição pelo novo saldo do ente'); else { guiaAtiva(T_(arg)).status = 'substituida'; registrarPortal(); } return;
      case 'fechar': fecharApuracao(arg); return;
      case 'fecharOk': var tt = arg, Tf = T_(tt), jf = (document.getElementById('pc-fe-t') || {}).value || ''; if (abertas(c, tt).length && !jf.trim()) { toast('Escreva a justificativa.'); return; } Tf.fechada = true; aud('fechar', c, tt, 'Apuração ' + tt + ' do SplitHub', 'aberta', 'fechada', jf); evento(Tf, new Date(ref(c)), 'E4', 'Apuração ' + tt + ' do SplitHub fechada por ' + quem() + (jf ? ' · ' + esc(jf) : '')); sincApur(c); fechar('pc-fe'); toast('Apuração ' + tt + ' fechada.'); break;
      case 'reabrir': var Tr = T_(arg); aud('reabrir', c, arg, 'Apuração ' + arg + ' do SplitHub', 'fechada', 'aberta'); Tr.fechada = false; Tr.reabertas++; evento(Tr, new Date(ref(c)), 'E4', 'Apuração ' + arg + ' do SplitHub reaberta por ' + quem()); sincApur(c); toast('Apuração ' + arg + ' reaberta.'); break;
      case 'recalcular': recalcular(); return;
      case 'exportar': aud('exportar', c, S.modo === 'cons' ? '' : S.modo, 'demonstrativo · CSV', '', S.modo === 'cons' ? 'CBS e IBS' : S.modo); exportar(); return;
      case 'audCsv': var Da = dados(empresa()), la = filtroAud(Da, c); aud('exportar', c, '', 'trilha de auditoria · CSV', '', la.length + ' registro(s)'); csv('pcont-auditoria-' + empresa().raiz.replace(/\D/g, '') + '.csv', [['#', 'Data e hora', 'Quem', 'Perfil', 'Origem', 'Ação', 'Competência', 'Tributo', 'Alvo', 'Antes', 'Depois', 'Motivo', 'Hash', 'Hash anterior']].concat(la.map(function (r) { return [r.seq, fDH(r.q), r.quem, r.perfil, r.origem, ACAO[r.acao] || r.acao, r.comp, r.tri, r.alvo, r.antes, r.depois, r.motivo, r.hash, r.anterior]; }))); render(); return;
      case 'regras': regras(); return;
      case 'leitura': avancarLeitura(); return;
      default: return;
    }
    render();
  }
  function mudanca(ev) {
    var el = ev.target, k = el.getAttribute && el.getAttribute('data-ch'); if (!k) return;
    if (k === 'empresa' && ev.type === 'change') { S.empresa = el.value; var l = comps().filter(temDados); S.comp = (l[l.length - (S.ano === 2027 ? 2 : 1)] || comps()[0]).id; render(); }
    if (k === 'base' && ev.type === 'change') { var p = el.getAttribute('data-arg').split('|'); S.base[p[0]] = p[1]; render(); }
    if (k === 'outro' && ev.type === 'change') { var t = el.getAttribute('data-arg'); S.outro[t] = parseFloat(el.value) || 0; S.base[t] = 'outro'; render(); }
    if (k === 'detBusca' && ev.type === 'input') { DET.busca = el.value; DET.doc = null; var pos = el.selectionStart; detalhe(); var n = document.querySelector('#pc-det [data-ch="detBusca"]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }
    if (k === 'detDiv' && ev.type === 'change') { DET.soDiv = el.checked; DET.doc = null; detalhe(); }
    if (/^aud(Quem|Acao|Comp|Tri)$/.test(k) && ev.type === 'change') { S[k] = el.value; render(); }
  }
  function fecharApuracao(t) {
    var c = comp(), n = abertas(c, t).length;
    modal('pc-fe', 'Fechar a apuração ' + t + ' do SplitHub · ' + rotL(c), 'Trava a coluna SplitHub desta competência; reabrir pede registro', (n ? '<div class="pc-alerta">' + n + ' divergência(s) aberta(s) com a ' + ENTE[t] + '. Fechar mesmo assim pede justificativa.</div><label class="pc-campo">Justificativa<textarea id="pc-fe-t"></textarea></label>' : '<div class="pc-alerta ok">Sem divergência aberta com a ' + ENTE[t] + '.</div>'),
      '<button class="btn pc-btn-sm" onclick="document.getElementById(\'pc-fe\').remove()">Voltar</button><button class="btn btn-t pc-btn-sm" data-act="fecharOk" data-arg="' + t + '">Fechar apuração ' + t + '</button>', true);
  }
  // 2026 da empresa principal: o status volta para o cálculo de onde veio (apurData)
  function sincApur(c) {
    if (!c.informativo || !empresa().principal || !window.apurData) return;
    var k = MES[c.mes - 1] + '/' + c.ano; if (!window.apurData[k]) return;
    window.apurData[k].status = TRIS.every(function (t) { return c.tributos[t].fechada; }) ? 'concluida' : 'calculada';
  }
  function recalcular() {
    aud('recalcular', comp(), '', S.ano === 2026 ? 'cálculo do SplitHub · 2026' : 'exercício 2027', '', 'recalculado');
    if (S.ano === 2026 && empresa().principal) {
      try { if (window.sincronizarApuracao) window.sincronizarApuracao(); } catch (e) {}
      var D = DADOS[empresa().raiz], fechadas = {};
      D[2026].forEach(function (c) { TRIS.forEach(function (t) { if (c.tributos[t].fechada) fechadas[c.id + t] = 1; }); });
      D[2026] = []; for (var m = 1; m <= 12; m++) D[2026].push(novaComp(empresa(), 2026, m));
      D[2026].forEach(function (c) { TRIS.forEach(function (t) { if (fechadas[c.id + t]) c.tributos[t].fechada = true; }); });
      divergencias(D, empresa(), [2026]);
      eventos2026(D);
      toast('Recalculado a partir dos documentos do SplitHub. Competências fechadas mantêm os números.');
    } else { S.ultimaExec = new Date(REF[2027].getTime() + 600000); toast('Recalculado às ' + p2(S.ultimaExec.getHours()) + ':' + p2(S.ultimaExec.getMinutes()) + ': sem mudança nos documentos.'); }
    render();
  }
  function csv(nome, linhas) {
    var txt = linhas.map(function (l) { return l.map(function (x) { var s = typeof x === 'number' ? String(Math.round(x * 100) / 100).replace('.', ',') : String(x); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';'); }).join('\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' })); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportar() {
    var c = comp(), tris = S.modo === 'cons' ? TRIS : [S.modo], linhas = [['Empresa', 'Competência', 'Tributo', 'Ente', 'Linha', 'SplitHub', 'Ente (valor)', 'Diferença']];
    tris.forEach(function (t) {
      var T = c.tributos[t];
      T.linhas.forEach(function (l) { var a = somaLinha(l, c, 'sh'), b = somaLinha(l, c, 'en'); linhas.push([empresa().razao, rotL(c), t, ENTE[t], l.op + ' ' + l.nome, a, b, b - a]); });
      linhas.push([empresa().razao, rotL(c), t, ENTE[t], '= Saldo a recolher', saldo(T, 'sh'), saldo(T, 'en'), saldo(T, 'en') - saldo(T, 'sh')]);
    });
    csv('pcont-' + empresa().raiz.replace(/\D/g, '') + '-' + c.id + '.csv', linhas);
  }
  function regras() {
    modal('pc-regras', 'Regras da apuração', 'LC 214/2025, Decreto 12.955/2026 (CBS) e Resolução CGIBS 6/2026 (IBS)',
      '<ul class="pc-etapas" style="gap:8px;list-style:disc;margin-left:18px">'
      + ['<b>Saldo</b> = débitos − redutores de débitos − créditos apropriados + redutores de créditos − créditos de apurações anteriores − extinções por RAD, split e pagamento (art. 44). Positivo é saldo a recolher; negativo, a recuperar.',
        '<b>Um tributo, um ente:</b> a CBS é apurada e paga à Receita Federal, por DARF; o IBS ao Comitê Gestor, por documento de arrecadação. Os saldos nunca se somam.',
        '<b>Empresa:</b> a apuração é por CNPJ raiz, centralizada na matriz, que recolhe por todos os estabelecimentos.',
        '<b>Prazos:</b> o ente entrega a apuração até o dia 15 (dia 20 com DeRE); ajustes até o vencimento, que é o último dia útil do mês seguinte (arts. 45 e 46).',
        '<b>Confissão:</b> confirmar ou ajustar é confissão de dívida; sem manifestação, o saldo do ente é presumido correto (art. 46, §§ 6º e 7º).',
        '<b>Ordem do pagamento:</b> o pagamento extingue os débitos na ordem cronológica dos documentos; o que faltar fica nas últimas notas do mês, cujos clientes não apropriam o crédito (art. 26; LC 214, art. 47).',
        '<b>Valor da guia:</b> o saldo do ente após os ajustes (D-PC-04); a pessoa pode trocar, com a simulação do que fica em aberto.',
        '<b>Divergência:</b> qualquer diferença num documento (tolerância zero, D-PC-06) abre um chamado em Inconsistências (D-PC-05) e pede uma decisão antes da guia, sem bloquear.',
        '<b>Atraso:</b> multa de 0,33% ao dia, limitada a 20%, mais Selic (art. 27). No protótipo, simulados (D-PC-10).',
        '<b>2026:</b> ano de teste, sem recolhimento para quem cumpre as obrigações acessórias (art. 348, § 1º).'].map(function (x) { return '<li style="font-size:12.5px;color:var(--txt2);line-height:1.55">' + x + '</li>'; }).join('') + '</ul>',
      '<a class="btn pc-btn-sm" href="docs/proposta-modulo-pcont.html" target="_blank" rel="noopener">Proposta aprovada ↗</a><button class="btn pc-btn-sm" onclick="document.getElementById(\'pc-regras\').remove()">Fechar</button>', true);
  }

  /* ── Painel executivo da apuração assistida (flag pcont_painel) ───────── */
  // grupo econômico e empresas (CNPJ raiz). Soma entre empresas só no mesmo
  // tributo — CBS com CBS, IBS com IBS; entre tributos, só o caixa das guias.
  var P = { ano: 2027, comp: '2027-03', emp: 'todas', tabela: {} };
  function pEmpresas() { var l = empresas(); return P.emp === 'todas' ? l : l.filter(function (e) { return e.raiz === P.emp; }); }
  function pComp(emp, id) { return dados(emp)[P.ano].filter(function (c) { return c.id === id; })[0]; }
  function pComps() { return dados(empresas()[0])[P.ano]; }
  function situacaoGuia(T) {
    var g = guiaAtiva(T), e = etapa(T);
    if (g) return g.status;
    if (T.comp.informativo) return 'info';
    if (e.k === 'zero') return 'zero';
    if (e.k === 'apur' || e.k === 'cons' || e.k === 'sem') return 'antes';
    return 'aemitir';
  }
  function agregar(id) {
    var A = { CBS: { sh: 0, en: 0, enAj: 0, divs: 0, efeito: 0 }, IBS: { sh: 0, en: 0, enAj: 0, divs: 0, efeito: 0 }, desemb: 0, divs: [], credNao: 0, guias: { aemitir: [0, 0], emitida: [0, 0], enviada: [0, 0], paga: [0, 0], processada: [0, 0] }, linhas: [], semDecisao: 0 };
    pEmpresas().forEach(function (emp) {
      var c = pComp(emp, id); if (!c || !temDados(c)) return;
      var linhaEmp = { emp: emp, c: c, t: {} };
      TRIS.forEach(function (t) {
        var T = c.tributos[t], ab = abertas(c, t), sh = saldo(T, 'sh', true), en = saldo(T, 'en', true), enAj = saldoEnteAjustado(T), s = situacaoGuia(T);
        A[t].sh += sh; A[t].en += en; A[t].enAj += Math.max(0, enAj); A[t].divs += ab.length; A[t].efeito += ab.reduce(function (x, dv) { return x + efeitoDv(dv); }, 0);
        ab.forEach(function (dv) { A.divs.push({ emp: emp, dv: dv }); if (dv.linha.nat === 'credito' && difDv(dv) < 0) A.credNao += -difDv(dv); });
        A.semDecisao += semDecisao(c, t).length;
        if (!c.informativo) { var v = valorSugerido(T); if (A.guias[s]) { A.guias[s][0]++; A.guias[s][1] += v; } if (s !== 'zero' && s !== 'antes') A.desemb += v; }
        linhaEmp.t[t] = { T: T, sh: sh, en: en, e: etapa(T), s: s, ab: ab.length };
      });
      A.linhas.push(linhaEmp);
    });
    return A;
  }
  function compacto(v) { var a = Math.abs(v); return a >= 1e6 ? (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi' : (a >= 1e3 ? (v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : fmt(v)); }
  var SIT = { aemitir: 'A emitir', emitida: 'Emitida', enviada: 'No ERP', paga: 'Paga', processada: 'Processada', info: 'Informativa', zero: 'Sem saldo', antes: 'Antes da entrega', cancelada: 'Cancelada', substituida: 'Substituída' };
  var ICO = { ok: '✓', aj: '!', ap: '…', at: '✕', cz: '–', te: '$' };

  function painel() {
    var el = document.getElementById('view-pcont-painel'); if (!el) return;
    var lista = pComps(); if (!lista.some(function (c) { return c.id === P.comp; })) { var cd = lista.filter(temDados); P.comp = (cd[cd.length - (P.ano === 2027 ? 2 : 1)] || lista[0]).id; }
    var c0 = lista.filter(function (c) { return c.id === P.comp; })[0], A = agregar(P.comp), grupo = (empresas()[0] || {}).grupo || 'Grupo econômico';
    el.innerHTML = '<div class="pc-hdr"><div><div class="pg-title">Painel executivo</div><div class="pg-sub">Apuração assistida do ' + esc(grupo) + ': o grupo e cada empresa (CNPJ raiz), com a Receita Federal (CBS) e o Comitê Gestor (IBS). ' + (P.ano === 2027 ? 'Exercício simulado, referência ' + fD(REF[2027]) : '2026 informativo') + '.</div></div>'
      + '<div class="pc-hdr-d"><button class="btn" data-pa="exportar">↓ Exportar</button><button class="btn btn-t" data-pa="pcont">Abrir o PCONT</button></div></div>'
      + '<div class="pc-emp"><div class="pc-anos">' + [[2027, '2027 · simulado'], [2026, '2026 · informativo']].map(function (a) { return '<button data-pa="ano" data-arg="' + a[0] + '"' + (P.ano === a[0] ? ' class="on"' : '') + '>' + a[1] + '</button>'; }).join('') + '</div>'
      + '<label>Competência<select data-pch="comp">' + lista.filter(temDados).map(function (c) { return '<option value="' + c.id + '"' + (c.id === P.comp ? ' selected' : '') + '>' + rotL(c) + '</option>'; }).join('') + '</select></label>'
      + '<label>Empresa<select data-pch="emp"><option value="todas">Todas as empresas do grupo</option>' + empresas().map(function (e) { return '<option value="' + esc(e.raiz) + '"' + (P.emp === e.raiz ? ' selected' : '') + '>' + esc(e.razao) + ' · ' + esc(e.raiz) + '</option>'; }).join('') + '</select></label>'
      + '<div class="pc-emp-i">Vencimento<b>' + fD(c0.venc) + (P.ano === 2027 && REF[2027] <= c0.venc ? ' · em ' + diasEntre(REF[2027], c0.venc) + ' dias' : '') + '</b></div></div>'
      + kpis(A, c0) + alertas(A, c0)
      + '<div class="pp-card"><div class="pp-card-h"><span class="pp-card-n">Empresas do grupo · ' + rotL(c0) + '</span><span class="pc-info">clique numa empresa para abrir o PCONT dela</span></div>' + tabelaEmpresas(A, c0) + '</div>'
      + '<div class="pc-duo pc-mt">' + TRIS.map(function (t) { return cartaoGrafico('evo-' + t, 'Saldo a recolher por mês · ' + t + ' · ' + ENTE[t], 'Resultado da apuração, antes do PCONT, das empresas selecionadas', evolucao(t), tabelaEvolucao(t), true); }).join('') + '</div>'
      + '<div class="pc-duo pc-mt">' + TRIS.map(function (t) { return cartaoGrafico('cascata-' + t, 'Composição do saldo da ' + ENTE[t] + ' · ' + t + ' · ' + rotL(c0), 'Como os débitos viram o saldo a recolher, somando as empresas', cascata(t), tabelaCascata(t), false); }).join('') + '</div>'
      + '<div class="pp-card pc-mt"><div class="pp-card-h"><span class="pp-card-n">Etapa de cada empresa por competência</span><span class="pc-info">' + P.ano + '</span></div>' + mapaEtapas() + '</div>'
      + '<div class="pc-duo pc-mt">' + cartaoDivergencias(A) + cartaoGuias(A, c0) + '</div>'
      + '<div class="pc-nota">CBS e IBS não se somam: cada tributo tem o seu ente. Os totais do grupo somam as empresas dentro do mesmo tributo; o desembolso é a única soma entre tributos, e é de caixa (D-PC-11).</div>'
      + '<div id="pp-tip" role="tooltip" hidden></div>';
  }
  function kpis(A, c) {
    function tile(rot, val, sub, cls) { return '<div class="pp-kpi' + (cls ? ' ' + cls : '') + '"><span class="pp-kpi-r">' + rot + '</span><b>' + val + '</b><span class="pp-kpi-s">' + sub + '</span></div>'; }
    var nDiv = A.divs.length, nCred = A.divs.filter(function (x) { return x.dv.linha.nat === 'credito'; }).length;
    var aEmitir = A.guias.aemitir[0], pend = aEmitir + A.guias.emitida[0] + A.guias.enviada[0];
    return '<div class="pp-kpis">'
      + TRIS.map(function (t) { var d = A[t].en - A[t].sh; return tile(t + ' a recolher · ' + ENTE[t], fmt(Math.max(0, A[t].enAj)), 'SplitHub ' + fmt(A[t].sh) + ' · diferença <span class="' + (d ? 'pp-dif' : 'pp-ok') + '">' + fmtS(d) + '</span>'); }).join('')
      + (c.informativo ? tile('Desembolso da competência', '—', '2026 informativo: sem recolhimento') : tile('Desembolso da competência', fmt(A.desemb), 'caixa das guias de CBS e IBS · ' + pend + ' guia(s) pendente(s)'))
      + tile('Divergências abertas', String(nDiv), nCred + ' de crédito · ' + (nDiv - nCred) + ' de débito · ' + A.semDecisao + ' sem decisão', nDiv ? 'pp-alerta' : '')
      + tile('Crédito não reconhecido pelos entes', fmt(A.credNao), 'apropriado no SplitHub e "a apropriar" no ente: vira caixa a mais', A.credNao ? 'pp-alerta' : '')
      + tile('Empresas no grupo', String(pEmpresas().length), A.linhas.length + ' com apuração em ' + rotL(c)) + '</div>';
  }
  function alertas(A, c) {
    var l = [];
    A.linhas.forEach(function (x) {
      TRIS.forEach(function (t) {
        var y = x.t[t]; if (!y) return;
        if (y.e.k === 'atraso') l.push(['red', '✕', esc(x.emp.razao) + ': ' + t + ' vencida sem pagamento à ' + ENTE[t] + '.']);
        else if (y.e.k === 'aj' && !c.informativo) l.push(['amber', '!', esc(x.emp.razao) + ': ' + t + ' em ajustes, ' + esc(y.e.rot.split('· ')[1] || '') + ' · guia ' + SIT[y.s].toLowerCase() + (y.ab ? ' · ' + y.ab + ' divergência(s)' : '') + '.']);
        if (y.s === 'paga') l.push(['blue', '…', esc(x.emp.razao) + ': ' + t + ' paga, aguardando o processamento da ' + ENTE[t] + '.']);
      });
    });
    A.divs.slice(0, 4).forEach(function (x) { l.push(['red', '!', esc(x.emp.razao) + ': ' + x.dv.id + ' · ' + x.dv.tri + ' · ' + esc(x.dv.linha.nome) + ' · diferença ' + fmt(difDv(x.dv)) + ' · chamado <b>' + x.dv.chamado.id + '</b> (' + esc(x.dv.chamado.estado) + ').']); });
    if (!l.length) l.push(['green', '✓', 'Nenhuma pendência nas empresas selecionadas em ' + rotL(c) + '.']);
    return '<div class="pp-card pc-mt"><div class="pp-card-h"><span class="pp-card-n">O que pede atenção</span></div><ul class="pp-alertas">' + l.slice(0, 8).map(function (a) { return '<li class="' + a[0] + '"><span class="pp-ico" aria-hidden="true">' + a[1] + '</span><span>' + a[2] + '</span></li>'; }).join('') + '</ul></div>';
  }
  function tabelaEmpresas(A, c) {
    var h = '<div class="pc-tw"><table class="pc-tb larga"><thead><tr><th class="l">Empresa</th>' + TRIS.map(function (t) { return '<th>' + t + ' · SplitHub</th><th>' + t + ' · ' + ENTE[t] + '</th><th>Diferença</th><th class="l">Etapa ' + t + '</th>'; }).join('') + '<th>Divergências</th><th>Desembolso</th></tr></thead><tbody>';
    A.linhas.forEach(function (x) {
      var nd = TRIS.reduce(function (s, t) { return s + x.t[t].ab; }, 0), des = c.informativo ? 0 : TRIS.reduce(function (s, t) { var y = x.t[t]; return s + (y.s !== 'zero' && y.s !== 'antes' ? valorSugerido(y.T) : 0); }, 0);
      h += '<tr class="clic" data-pa="empresa" data-arg="' + esc(x.emp.raiz) + '"><td class="l min"><b>' + esc(x.emp.razao) + '</b><span class="pc-sub">' + esc(x.emp.raiz) + ' · matriz ' + esc((x.emp.matriz || {}).uf || '') + ' · ' + x.emp.estab + ' estabelecimento(s)</span></td>'
        + TRIS.map(function (t) { var y = x.t[t], d = y.en - y.sh; return '<td>' + fmtDC(y.sh) + '</td><td>' + fmtDC(y.en) + '</td><td class="' + (d ? 'dif' : 'z') + '">' + fmt(d) + '</td><td class="l"><span class="pc-chip ' + y.e.chip + '">' + esc(y.e.rot) + '</span><span class="pc-sub">guia: ' + SIT[y.s].toLowerCase() + '</span></td>'; }).join('')
        + '<td>' + (nd ? '<span class="pc-dv">' + nd + '</span>' : '0') + '</td><td>' + (c.informativo ? '—' : fmt(des)) + '</td></tr>';
    });
    if (A.linhas.length > 1) h += '<tr class="res"><td class="l">Grupo · soma por tributo</td>' + TRIS.map(function (t) { var d = A[t].en - A[t].sh; return '<td>' + fmtDC(A[t].sh) + '</td><td>' + fmtDC(A[t].en) + '</td><td class="' + (d ? 'dif' : 'z') + '">' + fmt(d) + '</td><td></td>'; }).join('') + '<td>' + A.divs.length + '</td><td>' + (c.informativo ? '—' : fmt(A.desemb)) + '</td></tr>';
    return h + '</tbody></table></div>';
  }
  function cartaoGrafico(id, titulo, sub, grafico, tabela, legenda) {
    var tab = P.tabela[id];
    return '<div class="pp-card"><div class="pp-card-h"><span class="pp-card-n">' + titulo + '</span><button class="btn pc-btn-sm" data-pa="tabela" data-arg="' + id + '" aria-pressed="' + (tab ? 'true' : 'false') + '">' + (tab ? 'Ver gráfico' : 'Ver tabela') + '</button></div><div class="pc-info">' + sub + '</div>'
      + (legenda && !tab ? '<div class="pp-leg"><span><i class="pp-sw sh"></i>SplitHub</span><span><i class="pp-sw en"></i>Ente do tributo</span></div>' : '')
      + '<div class="pp-graf">' + (tab ? tabela : grafico) + '</div></div>';
  }
  function serieMensal(t) {
    return pComps().filter(temDados).map(function (c0) {
      var sh = 0, en = 0;
      pEmpresas().forEach(function (emp) { var c = pComp(emp, c0.id); if (!c || !temDados(c)) return; sh += saldo(c.tributos[t], 'sh', true); en += saldo(c.tributos[t], 'en', true); });
      return { c: c0, sh: sh, en: en };
    });
  }
  function barra(x, y0, w, v, esc_, cls, tip) {
    var h = Math.abs(v) * esc_, y = v >= 0 ? y0 - h : y0, r = Math.min(4, w / 2, h);
    var d = v >= 0 ? 'M' + x + ',' + y0 + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + y0 + 'Z'
      : 'M' + x + ',' + y0 + 'V' + (y0 + h - r) + 'Q' + x + ',' + (y0 + h) + ' ' + (x + r) + ',' + (y0 + h) + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + (y0 + h) + ' ' + (x + w) + ',' + (y0 + h - r) + 'V' + y0 + 'Z';
    return h < 0.5 ? '' : '<path class="' + cls + '" d="' + d + '" data-tip="' + esc(tip) + '"></path>';
  }
  function eixoY(max, min, W, H, top, base) {
    var passos = 4, out = '', amp = max - min || 1;
    for (var i = 0; i <= passos; i++) { var v = min + amp * i / passos, y = base - (v - min) / amp * (base - top); out += '<line class="pp-grade" x1="56" x2="' + W + '" y1="' + y + '" y2="' + y + '"></line><text class="pp-eixo" x="50" y="' + (y + 3) + '" text-anchor="end">' + compacto(v) + '</text>'; }
    return out;
  }
  function evolucao(t) {
    var s = serieMensal(t); if (!s.length) return '<div class="pc-nota">Sem dados.</div>';
    var W = 560, H = 230, top = 16, base = 196, max = Math.max.apply(null, s.map(function (x) { return Math.max(x.sh, x.en, 0); })), min = Math.min(0, Math.min.apply(null, s.map(function (x) { return Math.min(x.sh, x.en); })));
    max = max || 1; var amp = max - min, k = (base - top) / amp, y0 = base - (0 - min) * k, slot = (W - 64) / s.length, bw = Math.min(26, slot / 2 - 4);
    var out = '<svg class="pp-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Saldo a recolher por mês, ' + t + '">' + eixoY(max, min, W, H, top, base);
    s.forEach(function (x, i) {
      var cx = 64 + slot * i + slot / 2, sel = x.c.id === P.comp;
      out += barra(cx - bw - 1, y0, bw, x.sh, k, 'pp-b sh', rot(x.c) + ' · SplitHub · ' + t + ': ' + fmtDC(x.sh)) + barra(cx + 1, y0, bw, x.en, k, 'pp-b en', rot(x.c) + ' · ' + ENTE[t] + ' · ' + t + ': ' + fmtDC(x.en));
      out += '<text class="pp-eixo' + (sel ? ' sel' : '') + '" x="' + cx + '" y="' + (H - 18) + '" text-anchor="middle">' + rot(x.c) + '</text>';
      if (sel) out += '<text class="pp-rot" x="' + cx + '" y="' + (Math.min(y0, base) - Math.max(x.sh, x.en, 0) * k - 6) + '" text-anchor="middle">' + compacto(x.en) + '</text>';
    });
    out += '<line class="pp-base" x1="56" x2="' + W + '" y1="' + y0 + '" y2="' + y0 + '"></line></svg>';
    return out;
  }
  function tabelaEvolucao(t) {
    return '<div class="pc-tw"><table class="pc-tb"><thead><tr><th class="l">Competência</th><th>SplitHub</th><th>' + ENTE[t] + '</th><th>Diferença</th></tr></thead><tbody>' + serieMensal(t).map(function (x) { return '<tr><td class="l">' + rotL(x.c) + '</td><td>' + fmtDC(x.sh) + '</td><td>' + fmtDC(x.en) + '</td><td class="' + (x.en - x.sh ? 'dif' : 'z') + '">' + fmt(x.en - x.sh) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  var CASCATA = [['deb', 'Débitos'], ['rdeb', 'Redutores'], ['cred', 'Créditos'], ['rcred', 'Estornos'], ['ant', 'Anteriores'], ['ext', 'RAD e split'], ['pcont', 'PCONT']];
  function passosCascata(t) {
    var v = {}; CASCATA.forEach(function (p) { v[p[0]] = { sh: 0, en: 0 }; });
    pEmpresas().forEach(function (emp) { var c = pComp(emp, P.comp); if (!c || !temDados(c)) return; CASCATA.forEach(function (p) { var l = linha(c.tributos[t], p[0]); v[p[0]].sh += somaLinha(l, c, 'sh'); v[p[0]].en += somaLinha(l, c, 'en'); }); });
    var acc = 0, passos = CASCATA.map(function (p) { var l = linhasVazias().filter(function (x) { return x.id === p[0]; })[0], s = l.op === '+' ? 1 : -1, de = acc; acc += s * v[p[0]].en; return { rot: p[1], de: de, ate: acc, v: s * v[p[0]].en, sh: s * v[p[0]].sh }; });
    passos.push({ rot: 'Saldo', de: 0, ate: acc, v: acc, total: true, sh: passos.reduce(function (a, x) { return a + x.sh; }, 0) });
    return passos;
  }
  function cascata(t) {
    var ps = passosCascata(t), W = 560, H = 230, top = 16, base = 196;
    var max = Math.max.apply(null, ps.map(function (p) { return Math.max(p.de, p.ate); })), min = Math.min(0, Math.min.apply(null, ps.map(function (p) { return Math.min(p.de, p.ate); })));
    max = max || 1; var k = (base - top) / (max - min), y = function (v) { return base - (v - min) * k; }, slot = (W - 64) / ps.length, bw = Math.min(40, slot - 10);
    var out = '<svg class="pp-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Composição do saldo, ' + t + '">' + eixoY(max, min, W, H, top, base);
    ps.forEach(function (p, i) {
      var x = 64 + slot * i + (slot - bw) / 2, a = y(Math.max(p.de, p.ate)), b = y(Math.min(p.de, p.ate)), h = Math.max(1, b - a);
      out += '<rect class="pp-b ' + (p.total ? 'en' : 'cx') + '" x="' + x + '" y="' + a + '" width="' + bw + '" height="' + h + '" rx="3" data-tip="' + esc(p.rot + ' · ' + ENTE[t] + ': ' + (p.total ? fmtDC(p.v) : fmtS(p.v)) + ' · SplitHub: ' + (p.total ? fmtDC(p.sh) : fmtS(p.sh))) + '"></rect>';
      if (i < ps.length - 1 && !p.total) out += '<line class="pp-liga" x1="' + (x + bw) + '" x2="' + (x + slot) + '" y1="' + y(p.ate) + '" y2="' + y(p.ate) + '"></line>';
      out += '<text class="pp-eixo" x="' + (x + bw / 2) + '" y="' + (H - 18) + '" text-anchor="middle">' + p.rot + '</text>';
      if (p.total || i === 0) out += '<text class="pp-rot" x="' + (x + bw / 2) + '" y="' + (a - 6) + '" text-anchor="middle">' + compacto(p.v) + '</text>';
    });
    return out + '</svg>';
  }
  function tabelaCascata(t) {
    return '<div class="pc-tw"><table class="pc-tb"><thead><tr><th class="l">Passo</th><th>' + ENTE[t] + '</th><th>SplitHub</th></tr></thead><tbody>' + passosCascata(t).map(function (p) { return '<tr' + (p.total ? ' class="res"' : '') + '><td class="l">' + p.rot + '</td><td>' + (p.total ? fmtDC(p.v) : fmtS(p.v)) + '</td><td>' + (p.total ? fmtDC(p.sh) : fmtS(p.sh)) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function mapaEtapas() {
    var cs = pComps();
    var h = '<div class="pc-tw"><table class="pc-tb pp-mapa"><thead><tr><th class="l">Empresa · tributo</th>' + cs.map(function (c) { return '<th>' + rot(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
    pEmpresas().forEach(function (emp) {
      TRIS.forEach(function (t) {
        h += '<tr><td class="l"><b>' + esc(emp.razao) + '</b> · ' + t + '<span class="pc-sub">' + ENTE[t] + '</span></td>' + cs.map(function (c0) {
          var c = pComp(emp, c0.id), e = c ? etapa(c.tributos[t]) : { cls: 'cz', rot: 'Sem dados' };
          return '<td class="pp-cel ' + e.cls + (c0.id === P.comp ? ' sel' : '') + '" data-tip="' + esc(emp.razao + ' · ' + t + ' · ' + rotL(c0) + ': ' + e.rot) + '"><span aria-hidden="true">' + ICO[e.cls] + '</span> ' + esc(e.rot.split(' · ')[0]) + '</td>';
        }).join('') + '</tr>';
      });
    });
    return h + '</tbody></table></div><div class="pp-leg">' + [['ok', 'Processada ou sem saldo'], ['te', 'Paga, aguardando o ente'], ['ap', 'Em apuração, entrega ou guia emitida'], ['aj', 'Ajustes'], ['at', 'Em atraso'], ['cz', 'Sem dados ou informativa']].map(function (x) { return '<span><i class="pp-sq ' + x[0] + '"><b aria-hidden="true">' + ICO[x[0]] + '</b></i>' + x[1] + '</span>'; }).join('') + '</div>';
  }
  function cartaoDivergencias(A) {
    var linhas = [];
    TRIS.forEach(function (t) { ['credito', 'debito'].forEach(function (n) { var l = A.divs.filter(function (x) { return x.dv.tri === t && x.dv.linha.nat === n; }); linhas.push({ t: t, n: n, q: l.length, v: l.reduce(function (s, x) { return s + Math.abs(difDv(x.dv)); }, 0) }); }); });
    var max = Math.max.apply(null, linhas.map(function (x) { return x.v; })) || 1;
    return '<div class="pp-card"><div class="pp-card-h"><span class="pp-card-n">Divergências por tributo e natureza</span><button class="btn pc-btn-sm" data-pa="divs">Ver no PCONT</button></div><div class="pc-info">Valor absoluto das diferenças abertas</div>'
      + '<div class="pp-barras">' + linhas.map(function (x) { return '<div class="pp-barra" data-tip="' + esc(x.t + ' · ' + NAT[x.n] + ': ' + x.q + ' divergência(s), ' + fmt(x.v)) + '"><span class="pp-barra-r">' + x.t + ' · ' + (x.n === 'credito' ? 'Crédito · DF de entrada' : 'Débito · DF de saída') + '</span><span class="pp-barra-t"><i style="width:' + (x.v / max * 100).toFixed(1) + '%"></i></span><span class="pp-barra-v">' + x.q + ' · ' + fmt(x.v) + '</span></div>'; }).join('') + '</div>'
      + '<div class="pc-nota">Crédito não reconhecido pelos entes: <b>' + fmt(A.credNao) + '</b>.</div></div>';
  }
  function cartaoGuias(A, c) {
    if (c.informativo) return '<div class="pp-card"><div class="pp-card-h"><span class="pp-card-n">Guias da competência</span></div><div class="pc-alerta info">2026 é informativo: sem guia (art. 348, § 1º).</div></div>';
    var est = ['aemitir', 'emitida', 'enviada', 'paga', 'processada'];
    return '<div class="pp-card"><div class="pp-card-h"><span class="pp-card-n">Guias da competência · ' + rotL(c) + '</span><button class="btn pc-btn-sm" data-pa="guias">Ver no PCONT</button></div><div class="pc-info">Empresas × tributos, pelo valor sugerido ou emitido</div>'
      + '<div class="pp-funil">' + est.map(function (s) { var g = A.guias[s]; return '<div class="pp-etp' + (g[0] ? ' on' : '') + '"><span>' + SIT[s] + '</span><b>' + g[0] + '</b><i>' + fmt(g[1]) + '</i></div>'; }).join('') + '</div>'
      + '<div class="pc-nota">A CBS sai em DARF pelo SplitHub; a guia do IBS é registrada do portal do Comitê Gestor até a emissão por API existir.</div></div>';
  }
  function tip(ev) {
    var t = document.getElementById('pp-tip'); if (!t) return;
    var a = ev.target.closest && ev.target.closest('[data-tip]');
    if (!a || !document.getElementById('view-pcont-painel').contains(a)) { t.hidden = true; return; }
    t.textContent = a.getAttribute('data-tip'); t.hidden = false;
    var x = Math.min(window.innerWidth - t.offsetWidth - 12, ev.clientX + 14), y = ev.clientY + 16;
    if (y + t.offsetHeight > window.innerHeight - 8) y = ev.clientY - t.offsetHeight - 12;
    t.style.left = Math.max(8, x) + 'px'; t.style.top = y + 'px';
  }
  function cliquePainel(ev) {
    var b = ev.target.closest('[data-pa]'); if (!b) return;
    var a = b.getAttribute('data-pa'), arg = b.getAttribute('data-arg');
    if (a === 'ano') { P.ano = +arg; P.comp = ''; }
    else if (a === 'tabela') P.tabela[arg] = !P.tabela[arg];
    else if (a === 'empresa' || a === 'pcont' || a === 'divs' || a === 'guias') {
      if (a === 'empresa') S.empresa = arg; else if (P.emp !== 'todas') S.empresa = P.emp;
      S.ano = P.ano; S.comp = P.comp; S.aba = a === 'divs' ? 'div' : (a === 'guias' ? 'guias' : 'comp'); S.modo = 'cons';
      abrir(); return;
    } else if (a === 'exportar') {
      var A = agregar(P.comp), c = pComps().filter(function (x) { return x.id === P.comp; })[0];
      csv('painel-apuracao-' + P.comp + '.csv', [['Empresa', 'CNPJ raiz', 'Tributo', 'Ente', 'SplitHub', 'Ente (valor)', 'Diferença', 'Etapa', 'Guia']].concat([].concat.apply([], A.linhas.map(function (x) { return TRIS.map(function (t) { var y = x.t[t]; return [x.emp.razao, x.emp.raiz, t, ENTE[t], y.sh, y.en, y.en - y.sh, y.e.rot, SIT[y.s]]; }); }))));
      return;
    } else return;
    painel();
  }
  function mudaPainel(ev) {
    var el = ev.target, k = el.getAttribute && el.getAttribute('data-pch'); if (!k || ev.type !== 'change') return;
    if (k === 'comp') P.comp = el.value; if (k === 'emp') P.emp = el.value;
    painel();
  }
  function abrirPainel(btn, mobile) { showView('pcont-painel', btn || document.getElementById('nav-pcont-painel-btn'), !!mobile); painel(); }

  /* ── entrada no app: menu, rota e a Apuração IBS/CBS aposentada ───────── */
  function abrir(btn, mobile) {
    showView('pcont', btn || document.getElementById('nav-pcont-btn'), !!mobile);
    render();
  }
  function montar() {
    if (document.getElementById('view-pcont')) return;
    var antiga = document.getElementById('view-apuracao'), grupo = document.getElementById('nav-sub-group-apuracao');
    var v = document.createElement('div'); v.id = 'view-pcont'; v.className = 'view';
    if (antiga && antiga.parentNode) antiga.parentNode.insertBefore(v, antiga.nextSibling); else (document.querySelector('.main') || document.body).appendChild(v);
    v.addEventListener('click', clique); v.addEventListener('change', mudanca); v.addEventListener('input', mudanca);
    if (grupo) {
      var b = document.createElement('button'); b.className = 'nav-sub-btn'; b.id = 'nav-pcont-btn'; b.title = 'PCONT'; b.setAttribute('data-view', 'pcont');
      b.innerHTML = '<span class="nav-sub-dot"></span><span class="nav-label"> PCONT</span>';
      b.onclick = function () { abrir(this); };
      grupo.insertBefore(b, grupo.firstChild);
    }
    if (entregue('pcont_painel')) {
      var vp = document.createElement('div'); vp.id = 'view-pcont-painel'; vp.className = 'view';
      v.parentNode.insertBefore(vp, v);
      vp.addEventListener('click', cliquePainel); vp.addEventListener('change', mudaPainel);
      vp.addEventListener('mousemove', tip); vp.addEventListener('mouseleave', function () { var t = document.getElementById('pp-tip'); if (t) t.hidden = true; });
      if (grupo) {
        var bp = document.createElement('button'); bp.className = 'nav-sub-btn'; bp.id = 'nav-pcont-painel-btn'; bp.title = 'Painel executivo'; bp.setAttribute('data-view', 'pcont-painel');
        bp.innerHTML = '<span class="nav-sub-dot"></span><span class="nav-label"> Painel executivo</span>';
        bp.onclick = function () { abrirPainel(this); };
        grupo.insertBefore(bp, grupo.firstChild);
      }
    }
    var velho = document.getElementById('nav-apuracao-btn'); if (velho) velho.style.display = 'none';
    var inf = document.querySelector('#bottom-nav [data-view="apuracao"]'); if (inf) inf.setAttribute('data-view', 'pcont');
    // quem chamava a Apuração IBS/CBS (atalhos, rota #/apuracao, barra inferior) agora abre o PCONT
    window.abrirApuracao = function (btn, mobile) { abrir(btn && btn.closest && btn.closest('#sidebar') ? document.getElementById('nav-pcont-btn') : null, mobile); };
  }
  window.shPcont = { abrir: abrir, render: render, abrirPainel: abrirPainel, painel: painel };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();

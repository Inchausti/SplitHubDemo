/* ══ Eventos fiscais — lote 2 (pacote AV-E2) ═══════════════════════════════
   O que o PRD de Eventos fiscais v1.1 (seções 04 e 15) e a proposta de telas
   v1.3 deixaram para o lote 2, sobre a esteira do lote 1 (js/eventos-modulo.js,
   pacote AV-EF) e o pedido de evento do AV-EV (js/eventos-acao.js):

   eventos_documento        T-03 · detalhe do DF com as abas Eventos fiscais e
                            Linha do tempo fiscal (DV-24). A aba Itens fica fora
                            (D-02): o Alcance é só informação.
   eventos_inconsistencias  T-08 · família I no catálogo (D-13), uma ocorrência
                            por tributo: divergência, sem reflexo, ausência
                            passada a espera, órfão além do prazo e reflexo não
                            atribuível. O aviso de divergência leva à ocorrência
                            (DV-22) e o clique na ausência vencida a abre (DV-13).
                            O sétimo contexto da API em Integrações (DV-28).
   eventos_alertas          T-08 · aba Alertas de competência (D-14): efeito
                            confirmado × período fechado. Nada reabre sozinho.
   eventos_estados          DV-15 · não atribuível, revertida e aguardando
                            documento, com a fila de órfãos (C-12); DV-21 · o
                            aviso da variação não atribuível com os outros
                            eventos da janela; DV-32 · a solicitação do AV-EV
                            entra na esteira, e a esteira mostra as em andamento.

   Ficam como estão no app, por decisão em aberto: DV-09 (ordem da esteira),
   DV-19 (payload), DV-29 (RAD), DV-33 (espera de 30 dias) e DV-34 (texto do
   211110 e do 112150 — por isso a causa C-1 dos alertas não é gerada).
   Tudo simulado e em memória, como o lote 1.
   ═══════════════════════════════════════════════════════════════════════════ */
/* @pacote — o estado das flags é reescrito por tools/avaliacao.py promover */
window.shFeature && shFeature.registrar({"id": "AV-E2", "nome": "Eventos fiscais — lote 2: documento, ocorrências, alertas e estados", "branch": "feat/eventos-lote2", "entrada": "#/eventos", "flags": {"eventos_documento": "aprovada", "eventos_inconsistencias": "aprovada", "eventos_alertas": "aprovada", "eventos_estados": "aprovada"}, "rotulos": {"eventos_documento": "Detalhe do DF com as abas Eventos fiscais e Linha do tempo fiscal (T-03)", "eventos_inconsistencias": "Família I em Inconsistências, uma ocorrência por tributo, e o contexto de eventos em Integrações", "eventos_alertas": "Aba Alertas de competência em Inconsistências (D-14)", "eventos_estados": "Não atribuível, revertida, aguardando documento e as solicitações do AV-EV na esteira"}, "alvos": {"eventos_alertas": ["#itab-alertas"]}});
/* @fim-pacote */
(function () {
  'use strict';

  function on(f) { return !window.shFeature || (shFeature.ligada('eventos_modulo') && shFeature.ligada(f)); }
  function int() { return window.shEvm && window.shEvm._int; }

  (function () {
    if (document.getElementById('evl-css')) return;
    var l = document.createElement('link');
    l.id = 'evl-css'; l.rel = 'stylesheet'; l.href = 'css/eventos-lote2.css?v=1';
    document.head.appendChild(l);
  })();

  var FECHA_DIA = 3;   // simulação: a apuração da competência fecha no dia 3 do mês seguinte (DA-02 em aberto)
  var MESES_L = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var ITEM_COD = ['112120', '112130', '112140', '211110', '211124', '211130', '211140', '211150'];   // os oito que endereçam item
  var SIT_EVF = {
    pedido: ['pedido ao autor', 'amber'], solicitada: ['solicitada', 'blue'], entregue: ['entregue ao ERP', 'blue'],
    autorizada: ['autorizada', 'teal'], emitida: ['nota emitida', 'teal'], aguardando_aceite: ['aguardando aceite', 'amber'],
    aplicada: ['aplicada', 'teal'], rejeitada: ['rejeitada', 'red'], cancelada: ['cancelada', 'gray']
  };

  /* ── utilitários ──────────────────────────────────────────────────────── */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function p2(n) { return ('0' + n).slice(-2); }
  function ym(ts) { var d = new Date(ts); return d.getFullYear() + '-' + p2(d.getMonth() + 1); }
  function inicio(P) { return new Date(+P.slice(0, 4), +P.slice(5, 7) - 1, 1).getTime(); }
  function anterior(P) { var d = new Date(+P.slice(0, 4), +P.slice(5, 7) - 2, 15); return ym(d); }
  function rotP(P) { return MESES_L[+P.slice(5, 7) - 1] + '/' + P.slice(0, 4); }
  // fechamento simulado da competência P e o fim da janela de ajuste: último dia útil do mês seguinte (C-20)
  function fech(P) { return new Date(+P.slice(0, 4), +P.slice(5, 7), FECHA_DIA, 18, 0, 0).getTime(); }
  function janela(P) {
    var d = new Date(+P.slice(0, 4), +P.slice(5, 7) + 1, 0);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
    d.setHours(23, 59, 0, 0); return d.getTime();
  }
  function ultimoFechado(agora) {
    var d = new Date(agora), P = ym(new Date(d.getFullYear(), d.getMonth() - 1, 15));
    return fech(P) <= agora ? P : anterior(P);
  }
  function fDHA(ts) { var d = new Date(ts); return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); }
  function fmtCnpj(s) { s = String(s).replace(/\D/g, ''); return s.slice(0, 2) + '.' + s.slice(2, 5) + '.' + s.slice(5, 8) + '/' + s.slice(8, 12) + '-' + s.slice(12, 14); }
  function chaveCurta(ch) { var d = String(ch || '').replace(/\D/g, ''); return d.slice(0, 4) + '…' + d.slice(-4); }
  function semTag(s) { return String(s == null ? '' : s).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"); }
  function evPorId(id) { var I = int(); return I ? I.ST.eventos.filter(function (e) { return e.id === id; })[0] || null : null; }
  function nfPorNumero(n) { var I = int(); return I ? I.nfs().filter(function (x) { return String(x.numero) === String(n); })[0] || null : null; }
  function visiveis() { var I = int(), v = {}; (window.nfListaFiltradaGlobal || (I ? I.nfs() : [])).forEach(function (nf) { v[nf.numero] = nf; }); return v; }
  function toast(m) { var I = int(); if (I) I.toast(m); }
  function usuario() { var I = int(); return I ? I.nomeUsuario() : 'Usuário'; }
  // chave fictícia de 44 posições, com dígito verificador pelo módulo 11
  function chaveFake(aut, cnpj, n) {
    var d = new Date(aut), b = '41' + String(d.getFullYear()).slice(2) + p2(d.getMonth() + 1) + cnpj + '55' + '001' + ('000000000' + n).slice(-9) + '1' + ('00000000' + (n * 7919 % 99999999)).slice(-8);
    var s = 0, w = 2; for (var i = b.length - 1; i >= 0; i--) { s += +b[i] * w; w = w === 9 ? 2 : w + 1; }
    var r = s % 11; return b + (r < 2 ? 0 : 11 - r);
  }

  /* ══ Exemplos (chamado de dentro do semear do lote 1) ═══════════════════ */
  function semear(I, usados, agora) {
    var ST = I.ST, DIA = I.DIA, HORA = I.HORA, MIN = I.MIN, ult = I.ultimaLeitura06(agora);
    function novoId() { return 'EV-' + ('000000' + (++ST.seq)).slice(-6); }
    function doc(lado, ate, sal) {
      var l = I.candidatos(lado, usados, agora).filter(function (nf) { return !ate || nf.data <= I.iso(ate); });
      if (!l.length) return null;
      var nf = l[I.hash(sal) % l.length]; usados.push(nf.numero); return nf;
    }
    function evento(cod, nf, canal, aut, capt, k) {
      return { id: novoId(), cod: cod, lado: nf.tipo, canal: canal, nf: nf.numero, entidade: nf.entidade, cnpj: nf.cnpj, cnpjEmpresa: nf.cnpjComprador, chave: nf.chaveDF,
        competenciaDoc: I.comp(nf.data + 'T12:00:00'), compIso: String(nf.data).slice(0, 7), aut: aut, capt: capt, plan: capt + MIN,
        protocolo: '14126' + String(100000000 + I.hash(cod + nf.numero + k) % 899999999).slice(0, 9) + p2(k), seq: 1, revisao: false,
        canceladoPor: null, cancela: null, trib: {}, marcas: [] };
    }
    function trib(ev, nf, t, frac, estado, exec, lido) {
      var rf = I.rfDe(nf, t); if (!rf) return null;
      var c = I.CAT[ev.cod], antes = Number(rf.valor) || 0;
      var d = c.efeito === 'valor' ? (c.sinal[ev.lado] || 0) * I.redondo(antes * frac) : 0;
      var x = { rf: rf.id, antes: antes, delta: d, estado: estado, lido: null, observado: null, exec: null };
      if (estado === 'executada' || estado === 'nao_atribuivel') { x.exec = exec; x.lido = exec; x.observado = antes + d; }
      else if (estado === 'aguardando') { x.lido = lido; x.observado = antes; }
      ev.trib[t] = x; return x;
    }
    var cedo = function (t) { return Math.min(t, agora - HORA); };

    if (on('eventos_estados')) {
      // DV-15 / DV-21 · não atribuível: dois eventos no mesmo documento, a CBS confirmada na mesma leitura
      var nfA = doc('entrada', null, 'l2-na');
      if (nfA) {
        var lc = ult - 2 * DIA;
        var a1 = evento('211124', nfA, 'API', ult - 5 * DIA + 3 * HORA, ult - 5 * DIA + 3 * HORA + 9 * MIN, 41);
        trib(a1, nfA, 'CBS', 0.1, 'nao_atribuivel', lc); trib(a1, nfA, 'IBS', 0.1, 'executada', a1.capt + DIA);
        var a2 = evento('112140', nfA, 'API', ult - 3 * DIA + 5 * HORA, ult - 3 * DIA + 5 * HORA + 12 * MIN, 42);
        trib(a2, nfA, 'CBS', 0.2, 'nao_atribuivel', lc); trib(a2, nfA, 'IBS', 0.2, 'executada', a2.capt + DIA);
        ST.eventos.push(a1, a2);
      }
      // DV-15 · revertida: o 110001 cancela um evento já executado num período fechado (é também a causa C-4)
      var Pv = anterior(ultimoFechado(agora)), autO = inicio(Pv) + 10 * DIA + 10 * HORA;
      var nfR = doc('entrada', autO, 'l2-rev');
      if (nfR) {
        var o = evento('211150', nfR, 'API', autO, autO + 8 * MIN, 43);
        trib(o, nfR, 'CBS', 0.2, 'executada', autO + 2 * DIA); trib(o, nfR, 'IBS', 0.2, 'executada', autO + 2 * DIA + 3 * HORA);
        var autR = agora - 3 * DIA - 2 * HORA;
        var r = evento('110001', nfR, 'API', autR, autR + 15 * MIN, 44);
        r.cancela = o.id; r.reverte = true; r.protocolo = o.protocolo.slice(0, -2) + '98';
        ['CBS', 'IBS'].forEach(function (t) {
          var y = o.trib[t]; if (!y) return;
          var antes = y.antes + y.delta, x = { rf: y.rf, antes: antes, delta: -y.delta, estado: 'aguardando', lido: ST.leitura[t], observado: antes, exec: null };
          if (t === 'CBS') { x.estado = 'executada'; x.exec = Math.max(r.capt + HORA, ult); x.lido = x.exec; x.observado = antes - y.delta; }
          r.trib[t] = x;
        });
        o.revertidoPor = r.id; o.revertidoEm = r.aut;
        o.marcas.push({ em: r.aut, txt: 'Revertido pelo ' + r.id + ' (110001): o valor aplicado volta quando cada órgão refletir o cancelamento' });
        ST.eventos.push(o, r);
      }
      // DV-15 · aguardando documento: a fila de órfãos (C-12) — um dentro da espera, outro além dela
      ST.eventos.push(orfaoSeed(I, novoId, '211124', agora - 4 * DIA - 5 * HORA, 'API', { CBS: 1000, IBS: 2000 }, 51));
      ST.eventos.push(orfaoSeed(I, novoId, '211140', agora - 36 * DIA - 2 * HORA, 'CSV', { CBS: 500, IBS: 1000 }, 52));
    }

    if (on('eventos_inconsistencias')) {
      // sem reflexo: a janela de 8 dias da CBS fechou e a Receita Federal não moveu nada
      var nfS = doc('entrada', null, 'l2-sr');
      if (nfS) {
        var s = evento('211140', nfS, 'API', ult - 14 * DIA + 4 * HORA, ult - 14 * DIA + 4 * HORA + 10 * MIN, 45);
        var xs = trib(s, nfS, 'CBS', 0.1, 'divergente', null); if (xs) { xs.semReflexo = true; xs.lido = ult; xs.observado = xs.antes; }
        trib(s, nfS, 'IBS', 0.1, 'executada', s.capt + DIA);
        ST.eventos.push(s);
      }
      // ausência passada a espera de 30 dias: vira ocorrência (DV-13)
      var nfU = doc('entrada', null, 'l2-aus');
      if (nfU && I.rfDe(nfU, 'CBS')) {
        var v = I.redondo((Number(I.rfDe(nfU, 'CBS').valor) || 0) * 0.1);
        ST.ausentes.push({ id: 'AUS-' + p2(ST.ausentes.length + 1), cod: '211128', lado: 'entrada', nf: nfU.numero, entidade: nfU.entidade, chave: nfU.chaveDF,
          tribs: ['CBS'], valores: { CBS: v }, desde: ult - 36 * DIA,
          indicio: 'A Receita Federal reduziu a CBS deste documento em ' + I.money(v) + ' e, passados 36 dias, nenhum evento chegou que explique a redução.', revisao: false, pedido: null });
      }
    }

    if (on('eventos_alertas')) {
      var Pf = ultimoFechado(agora), f = fech(Pf);
      // C-2 · o evento chegou depois do fechamento (CSV atrasado)
      var a2t = inicio(Pf) + 19 * DIA + 10 * HORA, nf2 = doc('entrada', a2t, 'l2-c2');
      if (nf2) {
        var c2 = evento('211124', nf2, 'CSV', a2t, cedo(f + DIA + 2 * HORA), 46);
        c2.arquivo = { nome: 'eventos-' + I.iso(c2.capt) + '.csv', hash: '', linhas: [2, 3], por: 'Carga do ERP', em: c2.capt };
        trib(c2, nf2, 'CBS', 0.1, 'executada', cedo(c2.capt + DIA)); trib(c2, nf2, 'IBS', 0.1, 'executada', cedo(c2.capt + DIA + 3 * HORA));
        ST.eventos.push(c2);
      }
      // C-3 · planejado com o período aberto; o IBS confirmou antes do fechamento, a CBS depois
      var a3t = f - 4 * DIA, nf3 = doc('entrada', a3t, 'l2-c3');
      if (nf3) {
        var c3 = evento('211140', nf3, 'API', a3t, a3t + 10 * MIN, 47);
        trib(c3, nf3, 'IBS', 0.1, 'executada', a3t + 2 * DIA); trib(c3, nf3, 'CBS', 0.1, 'executada', cedo(f + 2 * DIA));
        ST.eventos.push(c3);
      }
    }
  }
  function orfaoSeed(I, novoId, cod, capt, canal, soma, n) {
    var cnpjE = '45123678000112', aut = capt - (canal === 'CSV' ? 20 * I.HORA : 11 * I.MIN);
    return novoOrfaoBase(I, { id: novoId(), cod: cod, canal: canal, aut: aut, capt: capt, chave: chaveFake(aut, cnpjE, 990000 + n),
      protocolo: '14126' + String(100000000 + I.hash(cod + n) % 899999999).slice(0, 9) + p2(n), seq: 1, soma: soma, emitente: cnpjE });
  }
  function novoOrfaoBase(I, o) {
    var c = I.CAT[o.cod];
    var ev = { id: o.id, cod: o.cod, lado: c.autor === 'destinatario' ? 'entrada' : null, canal: o.canal, nf: null,
      entidade: o.emitente ? 'Emitente ' + fmtCnpj(o.emitente) + ' · pela chave' : 'Documento ainda não recebido', cnpj: o.emitente ? fmtCnpj(o.emitente) : '', cnpjEmpresa: null,
      chave: o.chave, competenciaDoc: '—', compIso: '', aut: o.aut, capt: o.capt, plan: null, protocolo: o.protocolo, seq: o.seq,
      revisao: false, canceladoPor: null, cancela: null, trib: {}, orfao: true, soma: o.soma || { CBS: 0, IBS: 0 }, detalhe: o.detalhe, arquivo: o.arquivo,
      marcas: [{ em: o.capt, txt: 'A chave não corresponde a nenhum documento da base: o evento entrou na fila de órfãos (C-12) e espera o documento' }] };
    return ev;
  }
  // o órfão que chegou pelo CSV (o lote 1 passa o grupo avaliado)
  function novoOrfao(d, g, arq) {
    var I = int(); if (!I || !on('eventos_estados')) return null;
    var chave = String(d.chave || ''), emit = chave.length === 44 ? chave.slice(6, 20) : '';
    return novoOrfaoBase(I, { id: 'EV-' + ('000000' + (++I.ST.seq)).slice(-6), cod: d.cod, canal: 'CSV', aut: d.aut, capt: arq.em, chave: chave,
      protocolo: d.protocolo, seq: d.seq, soma: d.soma, detalhe: d.detalhe, arquivo: arq, emitente: emit });
  }

  /* ══ Estados novos: revertida, não atribuível, órfão (DV-15, DV-21) ══════ */
  function reverter(alvo, ev) {
    var I = int();
    ev.reverte = true; alvo.revertidoPor = ev.id; alvo.revertidoEm = ev.aut;
    I.tribsDo(alvo).forEach(function (t) {
      var y = alvo.trib[t], x = ev.trib[t]; if (!x) return;
      if (I.aplicado(y)) x.delta = -y.delta;
      else { x.delta = 0; y.estado = 'cancelada'; }   // a parte que ainda esperava o órgão só se interrompe
    });
    (alvo.marcas = alvo.marcas || []).push({ em: ev.aut, txt: 'Revertido pelo ' + ev.id + ' (110001): o valor aplicado volta quando cada órgão refletir o cancelamento' });
  }
  function executado(ev) { var I = int(); return I.CAT[ev.cod].efeito === 'valor' && I.tribsDo(ev).some(function (t) { return I.aplicado(ev.trib[t]); }); }

  // depois de cada leitura: imputação na CBS, sem reflexo depois da janela e o reflexo que volta ao AV-EV
  function aposLeitura(t, agora, r) {
    var I = int(); if (!I) return;
    if (t === 'CBS') {
      var porNf = {};
      I.ST.eventos.forEach(function (ev) {
        var x = ev.trib.CBS;
        if (!x || ev.canceladoPor || !I.movel(ev) || x.estado !== 'executada' || x.exec !== agora) return;
        (porNf[ev.nf] = porNf[ev.nf] || []).push(ev);
      });
      Object.keys(porNf).forEach(function (n) {
        var g = porNf[n]; if (g.length < 2) return;
        g.forEach(function (ev) {
          ev.trib.CBS.estado = 'nao_atribuivel';
          (ev.marcas = ev.marcas || []).push({ em: agora, txt: 'CBS: ' + g.length + ' eventos do documento confirmados na mesma leitura da Receita Federal — o montante fecha, a imputação não' });
        });
        r.ok -= g.length; r.na = (r.na || 0) + g.length;
      });
      if (on('eventos_inconsistencias')) {
        I.ST.eventos.forEach(function (ev) {
          var x = ev.trib.CBS;
          if (!x || ev.canceladoPor || !I.movel(ev) || x.estado !== 'aguardando' || !ev.plan || agora - ev.plan < 8 * I.DIA) return;
          x.estado = 'divergente'; x.semReflexo = true; x.lido = agora; x.observado = x.antes;
          (ev.marcas = ev.marcas || []).push({ em: agora, txt: 'CBS: a janela de 8 dias fechou sem reflexo na Receita Federal' });
        });
      }
    }
    // DV-32: o reflexo do evento pedido fecha o ajuste da solicitação no AV-EV
    var E = window._evfState;
    if (E && window.shEvf && window.shEvf.refletir) {
      I.ST.eventos.forEach(function (ev) {
        var x = ev.trib[t];
        if (!ev.requestId || !x || !I.aplicado(x) || x.exec !== agora) return;
        E.ajustes.filter(function (a) { return a.solic === ev.requestId && a.tributo === t && a.sit === 'aguardando_orgao'; })
          .forEach(function (a) { SINC = true; try { window.shEvf.refletir(a.id); } finally { SINC = false; } });
      });
    }
    refazerOcorrencias();
  }

  function faixa(ev, e) {
    var I = int(), c = I.CAT[ev.cod];
    if (e === 'aguardando_documento') {
      var dias = Math.floor((Date.now() - ev.capt) / I.DIA), vencido = dias >= I.ESPERA_AUSENCIA;
      var oc = vencido && on('eventos_inconsistencias') ? linkOc(docKeys(ev), 'a ocorrência') : '';
      return '<div class="evm-faixa amber"><b>Aguardando o documento.</b> O evento está autorizado, mas a chave <span class="evm-mono">' + esc(chaveCurta(ev.chave)) + '</span> ainda não corresponde a nenhum documento da base. '
        + 'Ele fica na fila de órfãos (C-12) e, quando o documento chegar pela ingestão, é correlacionado pela chave e segue o ciclo, na data da autorização. '
        + (vencido ? '<b>Passou da espera de ' + I.ESPERA_AUSENCIA + ' dias' + (oc ? ':</b> ' + oc + '.' : '.</b>') : 'Espera: ' + dias + ' de ' + I.ESPERA_AUSENCIA + ' dias.') + '</div>';
    }
    if (e === 'revertida') {
      var rv = evPorId(ev.revertidoPor), st = rv ? I.tribsDo(rv).filter(function (t) { return rv.trib[t].delta; }).map(function (t) {
        var x = rv.trib[t]; return t + ' ' + (I.aplicado(x) ? 'já voltou' : 'aguarda ' + I.ORGAO[t].o + ' ' + I.ORGAO[t].nome);
      }) : [];
      return '<div class="evm-faixa neutra">Revertido pelo <b><a href="#" onclick="shEvm.detalhe(\'' + esc(ev.revertidoPor) + '\');return false">' + esc(ev.revertidoPor) + '</a></b> (110001) em ' + I.fDH(ev.revertidoEm) + '. '
        + 'O evento tinha sido executado: o valor que ele aplicou volta pelo cancelamento, que espera o órgão como qualquer valor' + (st.length ? ' — ' + st.join('; ') : '') + '. '
        + 'A esteira guarda as duas linhas, a execução e a reversão.</div>';
    }
    if (ev.cod === '110001' && ev.reverte) {
      return '<div class="evm-faixa blue">Reverte o <b><a href="#" onclick="shEvm.detalhe(\'' + esc(ev.cancela) + '\');return false">' + esc(ev.cancela) + '</a></b>, que já tinha sido executado. '
        + 'O cancelamento leva de volta o valor aplicado, ' + I.tribsDo(ev).filter(function (t) { return ev.trib[t].delta; }).map(function (t) { return t + ' ' + semTag(I.delta(ev.trib[t].delta)); }).join(' e ')
        + ', e só muda o saldo quando o órgão de cada tributo refletir.</div>';
    }
    if (e === 'nao_atribuivel') return faixaNaoAtribuivel(ev);
    return null;
  }
  // DV-21: o aviso traz os outros eventos do documento na mesma janela da CBS
  function faixaNaoAtribuivel(ev) {
    var I = int(), x = ev.trib.CBS, leitura = x.exec;
    var outros = I.ST.eventos.filter(function (e) {
      return e.nf === ev.nf && e.id !== ev.id && !e.canceladoPor && I.movel(e) && e.trib.CBS && e.aut <= leitura && e.aut >= leitura - 8 * I.DIA;
    });
    var grupo = [ev].concat(outros.filter(function (e) { return e.trib.CBS.estado === 'nao_atribuivel' && e.trib.CBS.exec === leitura; }));
    var soma = grupo.reduce(function (s, e) { return s + e.trib.CBS.delta; }, 0);
    var oc = on('eventos_inconsistencias') ? linkOc(['NA|' + ev.nf + '|' + leitura], 'a ocorrência') : '';
    return '<div class="evm-faixa amber"><b>Variação não atribuível na CBS.</b> Na leitura da Receita Federal de ' + I.fDH(leitura) + ', a CBS do documento moveu ' + semTag(I.delta(soma))
      + ', a soma do previsto para ' + grupo.length + ' eventos. A Receita Federal informa o saldo do documento, não o lançamento: não dá para dizer quanto é de cada evento. '
      + 'O valor foi aplicado em montante, e o produto registra a ambiguidade em vez de escolher um evento.'
      + '<div class="evl-na-lista"><div class="evl-na-t">Outros eventos do documento na janela da CBS</div>'
      + (outros.length ? '<ul>' + outros.map(function (e) {
        return '<li><a href="#" onclick="shEvm.detalhe(\'' + e.id + '\');return false">' + e.id + '</a> · <span class="evm-mono">' + e.cod + '</span> ' + esc(I.CAT[e.cod].nome)
          + ' · autorizado ' + I.fDH(e.aut) + ' · CBS ' + semTag(I.delta(e.trib.CBS.delta)) + ' · ' + esc(I.ROT_EST[e.trib.CBS.estado] || e.trib.CBS.estado) + '</li>';
      }).join('') + '</ul>' : '<span class="evm-small">Nenhum outro evento na janela.</span>') + '</div>'
      + 'No IBS, o extrato do Comitê Gestor traz uma linha por lançamento, e a confirmação é por evento.' + (oc ? ' Uma ocorrência informativa para o documento: ' + oc + '.' : '') + '</div>';
  }
  function botoesDetalhe(ev) {
    if (ev.orfao) return '<button class="evm-btn" onclick="shEvmL2.correlacionar(\'' + ev.id + '\')" title="Simulação: um documento da base chega pela ingestão com a chave deste evento">Simular a chegada do documento</button>';
    return '';
  }
  // simulação da ingestão: um documento da base passa a ser o deste órfão
  function correlacionar(id) {
    var I = int(), ev = evPorId(id); if (!I || !ev || !ev.orfao) return;
    var usados = I.ST.eventos.map(function (e) { return e.nf; }).filter(Boolean).concat(I.ST.ausentes.map(function (a) { return a.nf; }));
    var lado = ev.lado || 'entrada', cand = I.candidatos(lado, usados, Date.now()).filter(function (nf) { return nf.data <= I.iso(ev.aut); });
    if (!cand.length) cand = I.candidatos(lado, usados, Date.now());
    if (!cand.length) { toast('Nenhum documento livre na base para simular a chegada.'); return; }
    var nf = cand[I.hash(ev.id) % cand.length], c = I.CAT[ev.cod], agora = Date.now(), antiga = ev.chave;
    ev.nf = nf.numero; ev.entidade = nf.entidade; ev.cnpj = nf.cnpj; ev.cnpjEmpresa = nf.cnpjComprador; ev.lado = nf.tipo; ev.chave = nf.chaveDF;
    ev.competenciaDoc = I.comp(nf.data + 'T12:00:00'); ev.compIso = String(nf.data).slice(0, 7);
    ev.orfao = false; ev.correlacionadoEm = agora; ev.plan = agora;
    I.TRIBS.forEach(function (t) {
      var rf = I.rfDe(nf, t); if (!rf) return;
      var d = c.efeito === 'valor' ? ((c.sinal && c.sinal[nf.tipo]) || 0) * Math.round((ev.soma[t] || 0) * 100) / 100 : 0;
      ev.trib[t] = { rf: rf.id, antes: Number(rf.valor) || 0, delta: d, estado: c.efeito === 'valor' ? 'planejada' : 'executada', lido: null, observado: null, exec: c.efeito === 'valor' ? null : ev.aut };
    });
    ev.marcas.push({ em: agora, txt: 'Simulação: o documento ' + (nf.tipoDF || 'NF-e') + ' ' + nf.numero + ' chegou pela ingestão e o evento foi correlacionado (chave ' + chaveCurta(antiga) + ' → ' + chaveCurta(nf.chaveDF) + '). Entra na data da autorização, capturado com atraso' });
    I.encadear();
    refazerOcorrencias();
    toast(ev.id + ' correlacionado com a ' + (nf.tipoDF || 'NF-e') + ' ' + nf.numero + ': sai da fila de órfãos e passa a planejada.');
    I.render(); I.detalhe(id);
  }

  /* ══ DV-32 · as solicitações do AV-EV na esteira ═════════════════════════ */
  var SINC = false;
  function sincronizar() {
    var I = int(), E = window._evfState; if (!I || !E || !on('eventos_estados')) return;
    var novos = 0;
    E.solic.slice().reverse().forEach(function (s) {
      if (!s.prot || s.cod === 'NC' || s.cod === 'ND' || !I.CAT[s.cod]) return;
      if (I.ST.eventos.some(function (e) { return e.requestId === s.id; })) return;
      var nf = nfPorNumero(s.nf); if (!nf) return;
      var c = I.CAT[s.cod], lado = nf.tipo;
      if (s.cod !== '110001' && !(c.acao && c.acao[lado])) return;
      var aut = (s.linha.filter(function (l) { return l.t === 'Autorizado'; })[0] || {}).em, agora = Date.now();
      aut = aut ? new Date(aut).getTime() : agora;
      var ev = { id: 'EV-' + ('000000' + (++I.ST.seq)).slice(-6), cod: s.cod, lado: lado, canal: 'API', nf: nf.numero, entidade: nf.entidade, cnpj: nf.cnpj, cnpjEmpresa: nf.cnpjComprador, chave: nf.chaveDF,
        competenciaDoc: I.comp(nf.data + 'T12:00:00'), compIso: String(nf.data).slice(0, 7), aut: aut, capt: Math.max(aut + I.MIN, agora - I.MIN), plan: agora,
        protocolo: s.prot, seq: 1 + I.ST.eventos.filter(function (e) { return e.nf === nf.numero && e.cod === s.cod; }).length, revisao: false, canceladoPor: null, cancela: null,
        trib: {}, requestId: s.id, incId: s.incId || null,
        marcas: [{ em: aut, txt: 'Pedido pelo SplitHub na solicitação ' + s.id + (s.incId ? ', a partir da ocorrência ' + s.incId : ', no detalhe do documento') + (s.modo === 'direto' ? ' — transmitido direto à SEFAZ' : ' — o ERP devolveu o autorizado em POST /v1/fiscal-events, com o request_id') }] };
      var ef = {}; (s.efeito || []).forEach(function (l) { if (l.tributo && l.valor) ef[l.tributo] = (Number(l.depois) || 0) - (Number(l.antes) || 0); });
      I.TRIBS.forEach(function (t) {
        var rf = I.rfDe(nf, t); if (!rf) return;
        if (c.efeito === 'valor' && !(t in ef)) return;   // o pedido só move o tributo que a solicitação declarou
        ev.trib[t] = { rf: rf.id, antes: Number(rf.valor) || 0, delta: c.efeito === 'valor' ? Math.round((ef[t] || 0) * 100) / 100 : 0, estado: 'planejada', lido: null, observado: null, exec: null };
      });
      if (s.cod === '110001' && s.ref) {
        var alvo = I.ST.eventos.filter(function (e) { return e.requestId === s.ref; })[0];
        if (alvo && !alvo.canceladoPor && !alvo.revertidoPor) {
          ev.cancela = alvo.id;
          Object.keys(ev.trib).forEach(function (t) { if (!alvo.trib[t]) delete ev.trib[t]; });   // o cancelamento só alcança o que o evento cancelado tinha
          if (executado(alvo)) reverter(alvo, ev); else { alvo.canceladoPor = ev.id; alvo.canceladoEm = ev.aut; }
        }
      }
      I.tribsDo(ev).forEach(function (t) {
        var x = ev.trib[t];
        if (!(I.movel(ev) && !(ev.reverte && !x.delta))) { x.estado = 'executada'; x.exec = ev.aut; }
      });
      I.ST.eventos.push(ev); novos++;
    });
    if (novos) { I.encadear(); I.ST.eventos.sort(function (a, b) { return b.capt - a.capt; }); }
  }
  // o reflexo marcado no AV-EV executa o tributo do evento na esteira
  function ganchoRefletir() {
    if (!window.shEvf || !window.shEvf.refletir || window.shEvf.refletir._evl) return;
    var orig = window.shEvf.refletir;
    window.shEvf.refletir = function (ajId) {
      var a = (window._evfState && window._evfState.ajustes || []).filter(function (x) { return x.id === ajId; })[0];
      var r = orig.apply(this, arguments);
      if (SINC || !a || !on('eventos_estados')) return r;
      var I = int(); if (!I) return r;
      sincronizar();
      var ev = I.ST.eventos.filter(function (e) { return e.requestId === a.solic; })[0], x = ev && ev.trib[a.tributo];
      if (x && (x.estado === 'planejada' || x.estado === 'aguardando')) {
        var agora = Date.now(); x.estado = 'executada'; x.exec = agora; x.lido = agora; x.observado = x.antes + x.delta;
        I.encadear();
        try { if (document.getElementById('view-eventos') && document.getElementById('view-eventos').classList.contains('active')) I.render(); } catch (e) {}
      }
      return r;
    };
    window.shEvf.refletir._evl = true;
  }

  /* ══ Abas novas da esteira: Solicitações e Fila de órfãos ════════════════ */
  function abas() {
    var I = int(), E = window._evfState, and = E ? E.solic.filter(function (s) { return ['aplicada', 'rejeitada', 'cancelada'].indexOf(s.sit) < 0; }).length : 0;
    var orf = I ? I.ST.eventos.filter(function (e) { return e.orfao; }).length : 0;
    return [['solicitacoes', 'Solicitações' + (and ? ' · ' + and : '')], ['orfaos', 'Fila de órfãos' + (orf ? ' · ' + orf : '')]];
  }
  function tabela(aba) {
    var I = int(); if (!I) return null;
    if (aba === 'solicitacoes') {
      var E = window._evfState, L = E ? E.solic : [];
      var and = L.filter(function (s) { return ['aplicada', 'rejeitada', 'cancelada'].indexOf(s.sit) < 0; }).length;
      var html = '<table><thead><tr><th>Solicitação</th><th>Evento pedido</th><th>Documento</th><th>Caminho</th><th>Situação</th><th>Inconsistência</th><th>Na esteira</th></tr></thead><tbody>'
        + (L.length ? L.map(function (s) {
          var ev = I.ST.eventos.filter(function (e) { return e.requestId === s.id; })[0], sit = SIT_EVF[s.sit] || [s.sit, 'gray'];
          var nome = I.CAT[s.cod] ? I.CAT[s.cod].nome : s.cod === 'NC' ? 'Nota de crédito — tipo 04' : s.cod === 'ND' ? 'Nota de débito — tipo 06' : ((window.shEvf && window.shEvf._cat || []).filter(function (o) { return o.cod === s.cod; })[0] || {}).nome || s.cod;
          var est = ev ? '<a href="#" onclick="event.stopPropagation();shEvm.detalhe(\'' + ev.id + '\');return false">' + ev.id + '</a> ' + I.chip(I.estadoEv(ev))
            : s.cod === 'NC' || s.cod === 'ND' ? '<span class="evm-small">a nota entra pela ingestão de documentos</span>'
            : s.caminho === 'pedido' ? '<span class="evm-small">quando o autor registrar o evento</span>'
            : !I.CAT[s.cod] ? '<span class="evm-small">a esteira ainda não trata o ' + esc(s.cod) + '</span>'
            : s.sit === 'rejeitada' ? '<span class="evm-small">não entra: rejeitado</span>' : '<span class="evm-small">entra quando autorizado</span>';
          return '<tr class="evm-linha" tabindex="0" onclick="shEvf.acompanhar(\'' + s.id + '\')" onkeydown="if(event.key===\'Enter\')shEvf.acompanhar(\'' + s.id + '\')">'
            + '<td class="evm-mono">' + esc(s.id) + '<div class="evm-small">' + esc(s.por || '') + '</div></td>'
            + '<td><span class="evm-mono">' + esc(s.cod) + '</span> <span class="evm-small">' + esc(nome) + '</span></td>'
            + '<td><span class="evm-mono">' + esc(s.nf) + '</span></td>'
            + '<td class="evm-small">' + (s.caminho === 'pedido' ? 'Pedido ao autor' : s.modo === 'direto' ? 'Direto na SEFAZ' : 'Pelo ERP') + '</td>'
            + '<td><span class="evl-sit ' + sit[1] + '">' + esc(sit[0]) + '</span></td>'
            + '<td>' + (s.incId ? '<a href="#" class="evm-mono" onclick="event.stopPropagation();shEvmL2.abrirInc(\'' + esc(s.incId) + '\');return false">' + esc(s.incId) + '</a>' : '<span class="evm-small">detalhe do documento</span>') + '</td>'
            + '<td>' + est + '</td></tr>';
        }).join('') : '<tr><td colspan="7" class="evm-vazio">Nenhuma solicitação ainda. Peça um evento a partir de uma ocorrência, no módulo de Inconsistências, ou do detalhe de um documento.</td></tr>')
        + '</tbody></table>';
      return { html: html, n: and, titulo: 'Solicitações', sub: 'em andamento · eventos e notas que o SplitHub pediu ao ERP ou ao autor; o autorizado entra na esteira com o request_id' };
    }
    if (aba === 'orfaos') {
      var O = I.ST.eventos.filter(function (e) { return e.orfao; }).sort(function (a, b) { return a.capt - b.capt; });
      var h = '<table><thead><tr><th>Evento</th><th>Tipo</th><th>Chave do documento</th><th>Recebido</th><th>Espera</th><th>Ocorrência</th></tr></thead><tbody>'
        + (O.length ? O.map(function (e) {
          var dias = Math.floor((Date.now() - e.capt) / I.DIA), venc = dias >= I.ESPERA_AUSENCIA;
          return '<tr class="evm-linha" tabindex="0" onclick="shEvm.detalhe(\'' + e.id + '\')" onkeydown="if(event.key===\'Enter\')shEvm.detalhe(\'' + e.id + '\')">'
            + '<td class="evm-mono">' + e.id + '<div class="evm-small">' + e.canal + '</div></td>'
            + '<td><span class="evm-mono">' + e.cod + '</span> <span class="evm-small">' + esc(I.CAT[e.cod].nome) + '</span></td>'
            + '<td><span class="evm-mono">' + esc(chaveCurta(e.chave)) + '</span><div class="evm-small">' + esc(e.entidade) + '</div></td>'
            + '<td class="evm-small evm-nw">' + I.fDH(e.capt) + '</td>'
            + '<td><span class="evl-sit ' + (venc ? 'red' : 'amber') + '">' + dias + ' de ' + I.ESPERA_AUSENCIA + ' dias</span></td>'
            + '<td>' + (venc && on('eventos_inconsistencias') ? linkOc(docKeys(e), 'prazo vencido') : '<span class="evm-small">' + (venc ? 'prazo vencido' : 'dentro da espera') + '</span>') + '</td></tr>';
        }).join('') : '<tr><td colspan="6" class="evm-vazio">Nenhum evento esperando documento.</td></tr>')
        + '</tbody></table>';
      return { html: h, n: O.length, titulo: 'Fila de órfãos', sub: 'eventos que chegaram antes do documento · espera de ' + I.ESPERA_AUSENCIA + ' dias; depois dela, ocorrência' };
    }
    return null;
  }

  /* ══ T-08 · Ocorrências da família I ═════════════════════════════════════ */
  var PISO = { evt_valor_divergente: 'media', evt_nao_refletido: 'alta', evt_nao_atribuivel: 'baixa', evt_ausente: 'media', evt_documento_ausente: 'media' };
  var NIVEL = ['baixa', 'media', 'alta', 'critica'];
  function prio(tipo, v) {
    if (tipo === 'evt_nao_atribuivel') return 'baixa';   // informativa: o montante fechou e já foi aplicado
    var pv = v > 500000 ? 'critica' : v > 100000 ? 'alta' : v > 20000 ? 'media' : 'baixa';
    return NIVEL[Math.max(NIVEL.indexOf(pv), NIVEL.indexOf(PISO[tipo] || 'baixa'))];
  }
  function inconsistencias(inc) {
    if (!inc || !on('eventos_inconsistencias')) return;
    var I = int(); if (!I || !I.semear()) return;
    sincronizar();
    var vis = visiveis();
    function add(o, nf, rfId, t, tipo, valor, quando, detalhe, resumo, extra) {
      var d = new Date(quando || Date.now()), dIso = I.iso(d);
      var x = {
        id: 'INC-' + String(inc.length + 1).padStart(4, '0'), tipo: tipo, tipoLabel: null, familia: null,
        dfId: nf ? (nf.tipoDF || 'NF-e') + ' ' + nf.numero : 'Chave ' + chaveCurta(o.chave), dfNum: nf ? (nf.tipoDF || 'NF-e') + ' ' + nf.numero : 'Chave ' + chaveCurta(o.chave),
        nfNumero: nf ? nf.numero : '', rfId: rfId || null, tipoFiscal: t || '—', origem: rfId ? 'rf' : 'df', tipoFluxo: (nf && nf.tipo) || o.lado || 'entrada',
        status: 'aberta', prioridade: prio(tipo, valor), valor: valor, valorTotal: nf ? nf.valorTotal || 0 : 0, valorLiq: nf ? nf.valorLiquido || 0 : 0,
        entidade: (nf && nf.entidade) || o.entidade || '—', cnpj: (nf && nf.cnpj) || o.cnpj || '—', dataISO: dIso, data: dIso.split('-').reverse().join('/'),
        contratoId: nf ? nf.contratoId || null : null, statusCredito: null, statusRegistro: null, metodoPagamento: null, metodoExtincao: null,
        dataApropriacao: null, dataPrevExtincao: null, dataExtincaoCredito: null, detalhe: detalhe, resumo: resumo
      };
      for (var k in extra) x[k] = extra[k];
      inc.push(x);
    }
    // divergência e sem reflexo: uma por tributo, por evento (dossiê 7.5)
    I.ST.eventos.forEach(function (ev) {
      if (ev.canceladoPor || ev.orfao || !vis[ev.nf]) return;
      var nf = vis[ev.nf];
      I.tribsDo(ev).forEach(function (t) {
        var x = ev.trib[t]; if (x.estado !== 'divergente') return;
        var org = I.ORGAO[t], esperado = x.antes + x.delta;
        var tipo = x.semReflexo ? 'evt_nao_refletido' : 'evt_valor_divergente';
        var v = Math.round(Math.abs((x.observado == null ? x.antes : x.observado) - esperado) * 100) / 100;
        var det = x.semReflexo
          ? 'O ' + ev.cod + ' (' + I.CAT[ev.cod].nome + ', ' + ev.id + ') previa ' + semTag(I.delta(x.delta)) + ' de ' + t + ', e ' + org.o + ' ' + org.nome + ' não moveu nada até o fim da janela. Nada foi aplicado.'
          : 'O ' + ev.cod + ' (' + I.CAT[ev.cod].nome + ', ' + ev.id + ') previa ' + t + ' de ' + I.money(esperado) + ', e ' + org.o + ' ' + org.nome + ' mostra ' + I.money(x.observado) + '. Nada foi aplicado — divergência nunca aplica valor sozinha.';
        add(ev, nf, x.rf, t, tipo, v, x.lido, det, t + ': esperado ' + I.money(esperado) + ' × ' + org.curto + ' ' + I.money(x.observado), { evKey: ev.id + '|' + t, evento: ev.id });
      });
    });
    // não atribuível: uma por documento e por leitura da CBS — abrir uma por evento culparia eventos inocentes
    var grupos = {};
    I.ST.eventos.forEach(function (ev) {
      var x = ev.trib.CBS; if (!x || x.estado !== 'nao_atribuivel' || ev.canceladoPor || !vis[ev.nf]) return;
      var k = 'NA|' + ev.nf + '|' + x.exec; (grupos[k] = grupos[k] || []).push(ev);
    });
    Object.keys(grupos).forEach(function (k) {
      var g = grupos[k], nf = vis[g[0].nf], x0 = g[0].trib.CBS, soma = g.reduce(function (s, e) { return s + e.trib.CBS.delta; }, 0);
      add(g[0], nf, x0.rf, 'CBS', 'evt_nao_atribuivel', Math.abs(soma), x0.exec,
        'Na leitura da Receita Federal de ' + I.fDH(x0.exec) + ', a CBS do documento moveu ' + semTag(I.delta(soma)) + ', o montante de ' + g.length + ' eventos (' + g.map(function (e) { return e.id + ' · ' + e.cod; }).join(', ') + '). O montante fechou e foi aplicado; a imputação a cada evento não é observável.',
        'CBS: ' + g.length + ' eventos numa leitura', { evKey: k, evento: g[0].id, eventos: g.map(function (e) { return e.id; }) });
    });
    // ausência passada a espera: uma por tributo
    I.ST.ausentes.forEach(function (a) {
      if (!vis[a.nf] || Date.now() - a.desde < I.ESPERA_AUSENCIA * I.DIA) return;
      var nf = vis[a.nf], dias = Math.floor((Date.now() - a.desde) / I.DIA);
      a.tribs.forEach(function (t) {
        var rf = I.rfDe(nf, t);
        add(a, nf, rf ? rf.id : null, t, 'evt_ausente', a.valores[t] || 0, a.desde + I.ESPERA_AUSENCIA * I.DIA,
          'Esperado o ' + a.cod + ' (' + I.CAT[a.cod].nome + ') há ' + dias + ' dias. ' + a.indicio, t + ': ' + a.cod + ' não chegou', { evKey: a.id + '|' + t, ausencia: a.id });
      });
    });
    // órfão além da espera: o documento nunca chegou — também uma por tributo, com o valor de cada um
    I.ST.eventos.forEach(function (ev) {
      if (!ev.orfao || Date.now() - ev.capt < I.ESPERA_AUSENCIA * I.DIA) return;
      I.TRIBS.forEach(function (t) {
        if (!ev.soma || !ev.soma[t]) return;
        add(ev, null, null, t, 'evt_documento_ausente', ev.soma[t], ev.capt + I.ESPERA_AUSENCIA * I.DIA,
          'O ' + ev.cod + ' (' + ev.id + ') chegou ' + (ev.canal === 'CSV' ? 'por CSV' : 'pela API') + ' em ' + I.fD(ev.capt) + ' com a chave ' + chaveCurta(ev.chave) + ', declarando ' + I.money(ev.soma[t]) + ' de ' + t + ', e o documento não foi ingerido em ' + I.ESPERA_AUSENCIA + ' dias. Verifique se o documento foi enviado; se a chave for de documento de terceiro, o evento não é desta empresa.',
          t + ': documento da chave ' + chaveCurta(ev.chave) + ' não chegou', { evKey: ev.id + '|DOC|' + t, evento: ev.id });
      });
    });
    contarAlertas();
  }
  function docKeys(ev) { return ['CBS', 'IBS'].map(function (t) { return ev.id + '|DOC|' + t; }); }
  function ocPorChave(k) { return (window._inconsistenciasGlobal || []).filter(function (i) { return i.evKey === k; })[0] || null; }
  var refazendo = false;
  function garantirOcorrencias(ks) {
    if (ks.some(function (k) { return ocPorChave(k); }) || refazendo || typeof window.renderizarRFsInconsistencias !== 'function') return;
    refazerOcorrencias();
  }
  function refazerOcorrencias() {
    if (refazendo || !on('eventos_inconsistencias') || typeof window.renderizarRFsInconsistencias !== 'function') return;
    refazendo = true;
    try { window.renderizarRFsInconsistencias(); } catch (e) { console.error('[eventos lote 2] ocorrências', e); }
    refazendo = false;
  }
  function linkOc(ks, vazio) {
    garantirOcorrencias(ks);
    var ls = ks.map(ocPorChave).filter(Boolean);
    if (!ls.length) return esc(vazio || '');
    return ls.map(function (i) {
      return '<a href="#" class="evl-tag oc" onclick="shEvmL2.ocorrencia(\'' + esc(i.evKey) + '\');return false" title="' + esc(window.IncCatalogo ? IncCatalogo.label(i.tipo) : i.tipo) + '">' + esc(i.id) + (i.tipoFiscal && i.tipoFiscal !== '—' ? ' · ' + esc(i.tipoFiscal) : '') + '</a>';
    }).join(' ');
  }
  // DV-22: o aviso de divergência leva à ocorrência de cada tributo
  function linkDivergencia(ev, div) {
    var l = linkOc(div.map(function (t) { return ev.id + '|' + t; }), '');
    return l ? 'A ocorrência da família I · Eventos fiscais foi aberta, uma por tributo: ' + l + '. O tratamento acontece no módulo de Inconsistências.'
      : 'A ocorrência da família I · Eventos fiscais abre na próxima atualização do módulo de Inconsistências.';
  }
  // DV-13: passada a espera, o clique na ausência abre a ocorrência
  function abrirAusencia(a) {
    var I = int(); if (!I || Date.now() - a.desde < I.ESPERA_AUSENCIA * I.DIA || a.tribs.length !== 1) return null;
    return 'shEvmL2.ocorrencia(\'' + a.id + '|' + a.tribs[0] + '\')';
  }
  function linksAusencia(a) { var l = linkOc(a.tribs.map(function (t) { return a.id + '|' + t; }), ''); return l ? 'a ausência virou ocorrência — ' + l : 'a ausência pede tratamento'; }
  function ocorrencia(k) {
    garantirOcorrencias([k]);
    var i = ocPorChave(k);
    if (!i) { toast('A ocorrência não está na lista atual de Inconsistências — confira o filtro de empresa.'); return; }
    ['evm-det', 'evm-aus', 'evm-pl', 'nf-detalhe-overlay', 'rf-detalhe-overlay'].forEach(function (id) { var e = document.getElementById(id); if (e) e.remove(); });
    if (typeof window.kbAbrirCard === 'function') window.kbAbrirCard(i.id);
  }
  function abrirInc(id) {
    ['evm-det', 'evm-aus', 'evm-pl'].forEach(function (x) { var e = document.getElementById(x); if (e) e.remove(); });
    if (typeof window.kbAbrirCard === 'function') window.kbAbrirCard(id);
  }

  // o card da ocorrência mostra de onde ela veio, com o caminho de volta ao evento
  function blocoCard(inc) {
    var I = int(); if (!I) return '';
    var h = '<div class="evl-card"><div class="evl-card-t">' + (inc.ausencia ? 'Evento esperado' : 'Evento fiscal de origem') + '</div>';
    if (inc.ausencia) {
      var a = I.ST.ausentes.filter(function (x) { return x.id === inc.ausencia; })[0];
      if (a) h += '<div class="evm-small"><span class="evm-mono">' + a.cod + '</span> ' + esc(I.CAT[a.cod].nome) + ' · visto pelo órgão desde ' + I.fD(a.desde) + '</div>'
        + '<div class="evl-card-b"><button class="evm-btn" onclick="shEvmL2.fecharCard();shEvm.ausencia(\'' + a.id + '\')">Ver a ausência</button>'
        + (on('eventos_documento') ? '<button class="evm-btn" onclick="shEvmL2.fecharCard();shEvmL2.docAba(\'' + esc(a.nf) + '\')">Ver no documento</button>' : '') + '</div>';
    } else {
      var ids = inc.eventos || [inc.evento];
      h += '<div class="twrap" style="--twrap-h:none"><table><thead><tr><th>Evento</th><th>Tributo · órgão</th><th class="r">Esperado</th><th class="r">Lido</th><th>Situação</th></tr></thead><tbody>'
        + ids.map(evPorId).filter(Boolean).map(function (ev) {
          var t = inc.tipoFiscal !== '—' ? inc.tipoFiscal : null, x = t && ev.trib[t];
          return '<tr><td><a href="#" onclick="shEvmL2.fecharCard();shEvm.detalhe(\'' + ev.id + '\');return false">' + ev.id + '</a> <span class="evm-mono">' + ev.cod + '</span><div class="evm-small">' + esc(I.CAT[ev.cod].nome) + '</div></td>'
            + '<td>' + (t ? t + ' · ' + I.ORGAO[t].nome : '<span class="evm-small">sem documento</span>') + '</td>'
            + '<td class="evm-num">' + (x ? I.money(x.antes + x.delta) : '—') + '</td><td class="evm-num">' + (x && x.observado != null ? I.money(x.observado) : '—') + '</td>'
            + '<td>' + I.chip(x ? x.estado : I.estadoEv(ev)) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
        + '<div class="evl-card-b"><button class="evm-btn" onclick="shEvmL2.fecharCard();shEvm.detalhe(\'' + esc(ids[0]) + '\')">Abrir o evento</button>'
        + (on('eventos_documento') && inc.nfNumero ? '<button class="evm-btn" onclick="shEvmL2.fecharCard();shEvmL2.docAba(\'' + esc(inc.nfNumero) + '\')">Ver no documento</button>' : '') + '</div>';
    }
    return h + '<div class="evm-small">Nenhum módulo resolve ocorrência de outro (RN-INC-10): o evento e o documento só apontam para cá.</div></div>';
  }
  function injetarCard(incId) {
    if (!on('eventos_inconsistencias')) return;
    var m = document.getElementById('kb-card-modal'); if (!m) return;
    var inc = (window._inconsistenciasGlobal || []).filter(function (i) { return i.id === incId; })[0];
    var old = m.querySelector('[data-evl-card]'); if (old) old.remove();
    if (!inc || !/^evt_/.test(inc.tipo)) return;
    var rot = Array.prototype.filter.call(m.querySelectorAll('div'), function (d) { return d.children.length === 0 && d.textContent === 'Ações sugeridas'; })[0];
    if (rot) rot.insertAdjacentHTML('beforebegin', '<div data-evl-card>' + blocoCard(inc) + '</div>');
  }
  function fecharCard() { var m = document.getElementById('kb-card-modal'); if (m) m.style.display = 'none'; }

  // texto e ações sugeridas do card, pelos mapas globais do módulo de Inconsistências
  function mapasCard() {
    var D = window._incDescricaoMap, A = window._incAcoesMap; if (!D || !A) return;
    var resolver = { label: 'Marcar como resolvida', icon: '✅', desc: 'O órgão corrigiu, o evento chegou ou a causa foi tratada por outro caminho', nextStatus: 'resolvida' };
    D.evt_valor_divergente = 'O órgão do tributo moveu o saldo do documento num valor diferente do que o evento declarou. Divergência nunca aplica valor sozinha: o registro fica como estava até o tratamento. Costuma ser alíquota ou quantidade — compare o valor do evento com a base de cálculo do órgão.';
    D.evt_nao_refletido = 'A janela de confirmação fechou e o órgão do tributo não moveu nada do que o evento prometia. Confira se o evento consta no ambiente nacional; se constar, o chamado é com o órgão, dentro da janela de ajuste.';
    D.evt_nao_atribuivel = 'Informativa. Dois ou mais eventos do documento foram confirmados na mesma leitura da Receita Federal: o montante fechou e foi aplicado, mas a CBS não diz quanto é de cada evento. Confira o total; no IBS, o extrato por lançamento confirma evento a evento.';
    D.evt_ausente = 'O órgão do tributo moveu o saldo do documento e nenhum evento explica o movimento, passada a espera de 30 dias. O evento pode existir e não ter chegado ao SplitHub, ou ter sido emitido pela contraparte.';
    D.evt_documento_ausente = 'Um evento chegou com uma chave que não corresponde a nenhum documento da base e ficou na fila de órfãos além da espera. O efeito não é calculado enquanto o documento não chegar.';
    A.evt_valor_divergente = [
      { label: 'Encaminhar ao órgão do tributo', icon: '✉', desc: 'Chamado à Receita Federal (CBS) ou ao Comitê Gestor (IBS), dentro da janela de ajuste', nextStatus: 'aguardando_emitente' },
      { label: 'Analisar a base de cálculo', icon: '🔍', desc: 'Compare o valor do evento com a base do órgão', nextStatus: 'em_analise' }, resolver];
    A.evt_nao_refletido = [
      { label: 'Conferir no ambiente nacional', icon: '🔍', desc: 'O evento consta na SEFAZ? Sem ele, o órgão não tem o que refletir', nextStatus: 'em_analise' },
      { label: 'Abrir chamado no órgão', icon: '✉', desc: 'Com o protocolo do evento, dentro da janela de ajuste', nextStatus: 'aguardando_emitente' }, resolver];
    A.evt_nao_atribuivel = [{ label: 'Conferir o total', icon: '🔍', desc: 'A soma dos eventos da janela bate com o movimento da CBS', nextStatus: 'em_analise' }, resolver];
    A.evt_ausente = [
      { label: 'Pedir o reenvio ao ERP', icon: '↻', desc: 'Se o evento existe, o ERP envia pela API ou por CSV', nextStatus: 'aguardando_emitente' },
      { label: 'Buscar no ambiente nacional', icon: '🔍', desc: 'O evento pode ter sido registrado pela contraparte', nextStatus: 'em_analise' }, resolver];
    A.evt_documento_ausente = [
      { label: 'Verificar a ingestão', icon: '🔍', desc: 'O documento foi enviado? Reenvie pela ingestão de documentos', nextStatus: 'em_analise' },
      { label: 'Pedir o documento ao ERP', icon: '✉', desc: 'Com a chave do evento', nextStatus: 'aguardando_emitente' }, resolver];
  }

  /* ══ T-08 · Integrações: o sétimo contexto da API ═══════════════════════ */
  function contextoApi() {
    var C = window.INTG_CATALOGO; if (!C || !on('eventos_inconsistencias')) return;
    if (C.some(function (t) { return t.v === 'eventos_erp'; })) return;
    C.push({
      v: 'eventos_erp', nome: 'Eventos fiscais', direcao: 'ambas', doc: 'em-breve.html', icone: '⇄',
      resumo: 'O ERP ou o sistema fiscal envia os eventos autorizados — os da Reforma e o cancelamento —, e recebe os comandos quando o SplitHub pede um evento ou uma nota de ajuste.',
      endpoints: ['POST /v1/fiscal-events', 'POST /v1/fiscal-events/batch', 'GET /v1/fiscal-events/{id}'],
      eventos: [
        { v: 'fiscal_event.requested', desc: 'O SplitHub pede ao ERP a emissão de um evento, com o request_id' },
        { v: 'adjustment_note.requested', desc: 'Pedido de nota de crédito (tipo 04) ou de débito (tipo 06)' },
        { v: 'fiscal_event.authorized', desc: 'Modo direto: a SEFAZ autorizou o evento que o SplitHub transmitiu, com o XML' },
        { v: 'fiscal_event.rejected', desc: 'Modo direto: a SEFAZ rejeitou, com o motivo' }
      ],
      escopos: [
        { v: 'fiscal_events:write', label: 'Enviar eventos', desc: 'POST individual e em lote' },
        { v: 'fiscal_events:read', label: 'Consultar eventos', desc: 'GET por id' }
      ],
      notas: [
        'Rotas em inglês, decisão de 05/10/2026 (proposta da API v1.5). A referência pública ainda não está nos docs da plataforma.',
        'Idempotente pela chave natural: chave de acesso, código e sequência.',
        'Evento sem documento entra na fila de órfãos e espera a ingestão do documento.',
        'O modo de emissão, a credencial da SEFAZ e a qualidade de serviço ficam em Configurações › Eventos fiscais.'
      ],
      exemplo: 'POST /v1/fiscal-events'
    });
  }

  /* ══ T-03 · Documento: abas Eventos fiscais e Linha do tempo fiscal ══════ */
  function vocab(ev, t) {
    var I = int(), x = ev.trib[t];
    if (ev.orfao) return ['aguardando documento', 'amber'];
    if (!x) return ['não aplicável', 'na'];
    if (ev.canceladoPor) return ['cancelado', 'na'];
    if (!I.movel(ev)) return ['sem saldo a mover', 'na'];
    if (x.estado === 'cancelada') return ['interrompido', 'na'];
    if (x.estado === 'executada') return ['conciliado', 'ok'];
    if (x.estado === 'nao_atribuivel') return ['não atribuível', 'amber'];
    if (x.estado === 'divergente') return x.semReflexo ? ['sem reflexo', 'red'] : ['divergente', 'red', 'previsto ' + I.money(x.antes + x.delta) + ' · observado ' + I.money(x.observado)];
    if (!x.delta) return ['sem saldo a mover', 'na'];
    return ['aguardando', 'blue'];
  }
  function voc(v) { return '<span class="evl-voc ' + v[1] + '">' + esc(v[0]) + '</span>' + (v[2] ? '<div class="evm-small">' + esc(v[2]) + '</div>' : ''); }
  function alcance(ev) {
    if (ITEM_COD.indexOf(ev.cod) < 0) return 'documento';
    var it = ev.detalhe && ev.detalhe.items;
    if (it && it.length) return (it.length === 1 ? 'item ' : 'itens ') + it.map(function (i) { return i.item_number; }).join(', ');
    return 'item ' + (1 + int().hash(ev.id) % 8);
  }
  function evsDoc(nf) { var I = int(); return I.ST.eventos.filter(function (e) { return e.nf === nf.numero; }).sort(function (a, b) { return a.aut - b.aut; }); }
  function ocsDoc(nf) {
    return (window._inconsistenciasGlobal || []).filter(function (i) {
      return /^evt_/.test(i.tipo) && String(i.nfNumero) === String(nf.numero) && ((window._kanbanState || {})[i.id] || i.status) !== 'resolvida';
    });
  }
  // compacto (AV-DF, D-DF-02): cinco colunas — autor, data e alcance dentro do Evento, a fase
  // dentro do Efeito —, a linha abre o detalhe por órgão, e vira cartão em coluna estreita
  function abaEventos(nf, compacto) {
    var I = int(), evs = evsDoc(nf), aus = I.ST.ausentes.filter(function (a) { return a.nf === nf.numero; });
    var ocOn = on('eventos_inconsistencias'), alOn = on('eventos_alertas'), ALS_ = alOn ? alertasLista() : [];
    var abertas = ocOn ? ocsDoc(nf).length : 0;
    if (compacto) return abaEventosCompacta(nf, evs, aus, ocOn, ALS_, abertas);
    var linhas = evs.map(function (ev) {
      var c = I.CAT[ev.cod], e = I.estadoEv(ev);
      var ef = ev.cod === '110001' ? (ev.reverte ? I.tribsDo(ev).filter(function (t) { return ev.trib[t].delta; }).map(function (t) { return '<div>' + t + ' ' + I.delta(ev.trib[t].delta) + '</div>'; }).join('') : '<span class="evm-small">cancela o ' + esc(ev.cancela) + '</span>')
        : I.movel(ev) ? I.tribsDo(ev).map(function (t) { return '<div' + (ev.canceladoPor ? ' class="evl-risc"' : '') + '>' + t + ' ' + (ev.canceladoPor ? semTag(I.delta(ev.trib[t].delta)) : I.delta(ev.trib[t].delta)) + '</div>'; }).join('')
        : '<span class="evm-small">' + (ev.cod === '211130' ? 'prazo do art. 40, I' : 'sem saldo a mover') + '</span>';
      var oc = ocOn ? linkOc(['CBS', 'IBS'].map(function (t) { return ev.id + '|' + t; }).concat(ev.trib.CBS && ev.trib.CBS.estado === 'nao_atribuivel' ? ['NA|' + ev.nf + '|' + ev.trib.CBS.exec] : []), '') : '';
      var al = ALS_.filter(function (a) { return a.ev.id === ev.id; }).map(function (a) { return '<a href="#" class="evl-tag al" onclick="shEvmL2.verAlerta(\'' + a.id + '\');return false" title="Alerta de competência · ' + esc(rotP(a.P)) + '">' + a.id + ' · alerta</a>'; }).join(' ');
      return '<tr><td><a href="#" class="evm-mono" onclick="shEvm.detalhe(\'' + ev.id + '\');return false">' + ev.cod + '</a> <span class="evm-small">' + esc(c.nome) + '</span>'
        + '<div class="evm-small">' + ev.id + (ev.correlacionadoEm ? ' · capturado com atraso' : '') + (ev.requestId ? ' · pedido pelo SplitHub' : '') + '</div></td>'
        + '<td class="evm-small">' + esc(I.AUTOR[c.autor]) + '<div class="evm-nw">' + I.fDH(ev.aut) + '</div></td>'
        + '<td class="evm-small">' + alcance(ev) + '</td>'
        + '<td class="evm-num">' + ef + '</td>'
        + '<td>' + I.chip(e) + '</td>'
        + '<td>' + voc(vocab(ev, 'CBS')) + '</td><td>' + voc(vocab(ev, 'IBS')) + '</td>'
        + '<td>' + ((oc + ' ' + al).trim() || '<span class="evm-muted">—</span>') + '</td></tr>';
    });
    aus.forEach(function (a) {
      var dias = Math.floor((Date.now() - a.desde) / I.DIA), c = I.CAT[a.cod];
      var oc = ocOn && dias >= I.ESPERA_AUSENCIA ? linkOc(a.tribs.map(function (t) { return a.id + '|' + t; }), '') : '';
      linhas.push('<tr><td><a href="#" class="evm-mono" onclick="shEvm.ausencia(\'' + a.id + '\');return false">' + a.cod + '</a> <span class="evm-small">esperado · ' + esc(c.nome) + '</span></td>'
        + '<td class="evm-small">' + esc(I.AUTOR[c.autor]) + '<div>não chegou</div></td><td class="evm-small">—</td><td class="evm-num">—</td><td>' + I.chip('ausente') + '</td>'
        + ['CBS', 'IBS'].map(function (t) { return '<td>' + (a.tribs.indexOf(t) >= 0 ? voc(['ausente', 'amber']) : voc(['não aplicável', 'na'])) + '</td>'; }).join('')
        + '<td>' + (oc || '<span class="evm-small">espera ' + dias + ' de ' + I.ESPERA_AUSENCIA + ' dias</span>') + '</td></tr>');
    });
    return '<div class="evl-doc-sub">Chave <span class="evm-mono">' + esc(chaveCurta(nf.chaveDF)) + '</span> · competência ' + I.comp(nf.data + 'T12:00:00') + ' · ' + evs.length + ' evento' + (evs.length === 1 ? '' : 's') + ' fiscais'
      + (ocOn ? ' · ' + abertas + ' ocorrência' + (abertas === 1 ? '' : 's') + ' aberta' + (abertas === 1 ? '' : 's') : '') + '</div>'
      + (linhas.length ? '<div class="twrap" style="--twrap-h:none"><table class="evl-t"><thead><tr><th>Evento</th><th>Autor · autorização</th><th>Alcance</th><th class="r">Efeito previsto</th><th>Fase da ação</th><th>CBS · Receita Federal</th><th>IBS · Comitê Gestor</th><th>Ocorrência</th></tr></thead><tbody>'
        + linhas.join('') + '</tbody></table></div>'
        + '<div class="evm-small evl-nota">Ordem da autorização no órgão — a aba é histórico. Uma ocorrência por tributo, porque são dois órgãos, dois prazos e dois caminhos; o clique abre a ocorrência, que se trata em Inconsistências. O Alcance é só informação: a primeira versão não segmenta por item (D-02).</div>'
        : '<div class="evm-vazio">Nenhum evento fiscal recebido para este documento.</div>');
  }
  function efeitoEv(ev) {
    var I = int();
    if (ev.cod === '110001') return ev.reverte ? I.tribsDo(ev).filter(function (t) { return ev.trib[t].delta; }).map(function (t) { return '<div>' + t + ' ' + I.delta(ev.trib[t].delta) + '</div>'; }).join('') : '<span class="evm-small">cancela o ' + esc(ev.cancela) + '</span>';
    if (I.movel(ev)) return I.tribsDo(ev).map(function (t) { return '<div' + (ev.canceladoPor ? ' class="evl-risc"' : '') + '>' + t + ' ' + (ev.canceladoPor ? semTag(I.delta(ev.trib[t].delta)) : I.delta(ev.trib[t].delta)) + '</div>'; }).join('');
    return '<span class="evm-small">' + (ev.cod === '211130' ? 'prazo do art. 40, I' : 'sem saldo a mover') + '</span>';
  }
  // o detalhe por órgão que a linha abre: o que cada um precisa confirmar e o que leu.
  // No RF (AV-RF, D-RF-04), só o órgão do tributo, com os atalhos para a esteira e o documento.
  function porOrgao(ev, so) {
    var I = int();
    return '<div class="evl-x-g' + (so ? ' um' : '') + '">' + (so ? [so] : ['CBS', 'IBS']).map(function (t) {
      var x = ev.trib[t], o = I.ORGAO[t];
      var cab = '<div class="evl-x-t">' + t + ' · ' + o.nome + '</div>';
      if (!x) return '<div class="evl-x-c">' + cab + '<div class="evm-small">O evento não toca este tributo.</div></div>';
      var v = vocab(ev, t);
      return '<div class="evl-x-c">' + cab
        + '<div class="evl-x-r"><span>Antes</span><b class="evm-num">' + I.money(x.antes) + '</b></div>'
        + '<div class="evl-x-r"><span>Previsto</span><b class="evm-num">' + I.money(x.antes + x.delta) + '</b></div>'
        + '<div class="evl-x-r"><span>Lido no órgão</span><b class="evm-num">' + (x.observado != null ? I.money(x.observado) : '—') + '</b></div>'
        + '<div class="evl-x-r"><span>Quando</span><b>' + (x.exec ? I.fDH(x.exec) : x.lido ? I.fDH(x.lido) : 'aguardando a leitura') + '</b></div>'
        + '<div class="evl-x-r"><span>Situação</span><b>' + voc(v) + '</b></div></div>';
    }).join('') + '</div>'
      + (so ? '<div class="evl-x-a"><button class="evm-btn" onclick="shEvm.detalhe(\'' + ev.id + '\')">Abrir na esteira</button> '
          + '<button class="evm-btn" onclick="shEvmL2.verNoDoc(\'' + esc(ev.nf) + '\',\'' + ev.id + '\')">Ver no documento</button></div>'
        : '<div class="evl-x-a"><button class="evm-btn" onclick="shEvm.detalhe(\'' + ev.id + '\')">Abrir o evento ' + ev.id + '</button></div>');
  }
  // RF (AV-RF, D-RF-04): quatro colunas — o efeito previsto e a confirmação só deste tributo
  function efeitoT(ev, T) {
    var I = int(), x = ev.trib[T];
    if (ev.cod === '110001' && !ev.reverte) return '<span class="evm-small">cancela o ' + esc(ev.cancela) + '</span>';
    if (!x) return '<span class="evm-small">não toca o ' + T + '</span>';
    if (ev.cod === '110001' || I.movel(ev)) return x.delta ? '<div' + (ev.canceladoPor ? ' class="evl-risc"' : '') + '>' + (ev.canceladoPor ? semTag(I.delta(x.delta)) : I.delta(x.delta)) + '</div>' : '<span class="evm-small">sem saldo a mover</span>';
    return '<span class="evm-small">' + (ev.cod === '211130' ? 'prazo do art. 40, I' : 'sem saldo a mover') + '</span>';
  }
  function ocsDocT(nf, T) { return ocsDoc(nf).filter(function (i) { return String(i.tipoFiscal || '').toUpperCase() === T; }); }
  function abaEventosRF(nf, T) {
    var I = int(), evs = evsDoc(nf), aus = I.ST.ausentes.filter(function (a) { return a.nf === nf.numero; });
    var ocOn = on('eventos_inconsistencias'), ALS_ = on('eventos_alertas') ? alertasLista() : [], o = I.ORGAO[T], L = [];
    evs.forEach(function (ev) {
      var c = I.CAT[ev.cod];
      var oc = ocOn ? linkOc([ev.id + '|' + T].concat(T === 'CBS' && ev.trib.CBS && ev.trib.CBS.estado === 'nao_atribuivel' ? ['NA|' + ev.nf + '|' + ev.trib.CBS.exec] : []), '') : '';
      var al = ALS_.filter(function (a) { return a.ev.id === ev.id && a.val[T] && a.val[T].st === 'pesa'; }).map(function (a) { return '<a href="#" class="evl-tag al" onclick="shEvmL2.verAlerta(\'' + a.id + '\');return false" title="Alerta de competência · ' + esc(rotP(a.P)) + '">' + a.id + ' · alerta</a>'; }).join(' ');
      L.push('<tr class="evl-r" data-ev="' + ev.id + '" onclick="shEvmL2.expandir(this, event)">'
        + '<td data-l="Evento"><span class="evl-seta">▸</span><a href="#" class="evm-mono" onclick="shEvm.detalhe(\'' + ev.id + '\');return false">' + ev.cod + '</a> <span class="evl-nome">' + esc(c.nome) + '</span>'
        + '<div class="evm-small">' + ev.id + ' · ' + esc(I.AUTOR[c.autor]) + ' · ' + I.fDH(ev.aut) + ' · ' + alcance(ev) + '</div></td>'
        + '<td data-l="Efeito previsto no ' + T + '" class="evm-num">' + efeitoT(ev, T) + '<div class="evl-fase">' + I.chip(I.estadoEv(ev)) + '</div></td>'
        + '<td data-l="' + T + ' · ' + o.nome + '">' + voc(vocab(ev, T)) + '</td>'
        + '<td data-l="Ocorrência">' + ((oc + ' ' + al).trim() || '<span class="evm-muted">—</span>') + '</td></tr>'
        + '<tr class="evl-x" data-ev-x="' + ev.id + '" hidden><td colspan="4">' + porOrgao(ev, T) + '</td></tr>');
    });
    aus.forEach(function (a) {
      var dias = Math.floor((Date.now() - a.desde) / I.DIA), c = I.CAT[a.cod], toca = a.tribs.indexOf(T) >= 0;
      var oc = ocOn && toca && dias >= I.ESPERA_AUSENCIA ? linkOc([a.id + '|' + T], '') : '';
      L.push('<tr class="evl-r evl-aus"><td data-l="Evento"><a href="#" class="evm-mono" onclick="shEvm.ausencia(\'' + a.id + '\');return false">' + a.cod + '</a> <span class="evl-nome">esperado · ' + esc(c.nome) + '</span>'
        + '<div class="evm-small">' + esc(I.AUTOR[c.autor]) + ' · não chegou</div></td>'
        + '<td data-l="Efeito previsto no ' + T + '" class="evm-num">—<div class="evl-fase">' + I.chip('ausente') + '</div></td>'
        + '<td data-l="' + T + ' · ' + o.nome + '">' + (toca ? voc(['ausente', 'amber']) : voc(['não aplicável', 'na'])) + '</td>'
        + '<td data-l="Ocorrência">' + (oc || (toca ? '<span class="evm-small">espera ' + dias + ' de ' + I.ESPERA_AUSENCIA + ' dias</span>' : '<span class="evm-muted">—</span>')) + '</td></tr>');
    });
    var abertas = ocOn ? ocsDocT(nf, T).length : 0;
    var sub = '<div class="evl-doc-sub">' + evs.length + ' evento' + (evs.length === 1 ? '' : 's') + ' fiscais do documento' + (aus.length ? ' · ' + aus.length + ' esperado' + (aus.length === 1 ? '' : 's') : '')
      + (ocOn ? ' · ' + abertas + ' ocorrência' + (abertas === 1 ? '' : 's') + ' aberta' + (abertas === 1 ? '' : 's') + ' no ' + T : '') + ' · competência ' + I.comp(nf.data + 'T12:00:00') + '</div>';
    if (!L.length) return sub + '<div class="evm-vazio">Nenhum evento fiscal recebido para este documento. O primeiro pode ser emitido pelo botão Emitir evento ou nota, acima.</div>';
    return sub + '<div class="evl-tc-w"><table class="evl-tc evl-tc4"><thead><tr><th>Evento</th><th class="r">Efeito previsto no ' + T + '</th><th>' + T + ' · ' + o.nome + '</th><th>Ocorrência</th></tr></thead><tbody>'
      + L.join('') + '</tbody></table></div>'
      + '<div class="evm-small evl-nota">Os eventos do documento, com o que cada um prevê neste tributo e o que ' + o.o + ' ' + o.nome + ' confirmou. Clique numa linha para ver o detalhe no órgão. O outro tributo fica no registro dele.</div>';
  }
  function abaEventosCompacta(nf, evs, aus, ocOn, ALS_, abertas) {
    var I = int(), L = [];
    evs.forEach(function (ev) {
      var c = I.CAT[ev.cod];
      var oc = ocOn ? linkOc(['CBS', 'IBS'].map(function (t) { return ev.id + '|' + t; }).concat(ev.trib.CBS && ev.trib.CBS.estado === 'nao_atribuivel' ? ['NA|' + ev.nf + '|' + ev.trib.CBS.exec] : []), '') : '';
      var al = ALS_.filter(function (a) { return a.ev.id === ev.id; }).map(function (a) { return '<a href="#" class="evl-tag al" onclick="shEvmL2.verAlerta(\'' + a.id + '\');return false" title="Alerta de competência · ' + esc(rotP(a.P)) + '">' + a.id + ' · alerta</a>'; }).join(' ');
      L.push('<tr class="evl-r" data-ev="' + ev.id + '" onclick="shEvmL2.expandir(this, event)">'
        + '<td data-l="Evento"><span class="evl-seta">▸</span><a href="#" class="evm-mono" onclick="shEvm.detalhe(\'' + ev.id + '\');return false">' + ev.cod + '</a> <span class="evl-nome">' + esc(c.nome) + '</span>'
        + '<div class="evm-small">' + esc(I.AUTOR[c.autor]) + ' · ' + I.fDH(ev.aut) + ' · ' + alcance(ev) + '</div>'
        + '<div class="evm-small">' + ev.id + (ev.correlacionadoEm ? ' · capturado com atraso' : '') + (ev.requestId ? ' · pedido pelo SplitHub' : '') + '</div></td>'
        + '<td data-l="Efeito previsto" class="evm-num">' + efeitoEv(ev) + '<div class="evl-fase">' + I.chip(I.estadoEv(ev)) + '</div></td>'
        + '<td data-l="CBS · Receita Federal">' + voc(vocab(ev, 'CBS')) + '</td><td data-l="IBS · Comitê Gestor">' + voc(vocab(ev, 'IBS')) + '</td>'
        + '<td data-l="Ocorrência">' + ((oc + ' ' + al).trim() || '<span class="evm-muted">—</span>') + '</td></tr>'
        + '<tr class="evl-x" data-ev-x="' + ev.id + '" hidden><td colspan="5">' + porOrgao(ev) + '</td></tr>');
    });
    aus.forEach(function (a) {
      var dias = Math.floor((Date.now() - a.desde) / I.DIA), c = I.CAT[a.cod];
      var oc = ocOn && dias >= I.ESPERA_AUSENCIA ? linkOc(a.tribs.map(function (t) { return a.id + '|' + t; }), '') : '';
      L.push('<tr class="evl-r evl-aus"><td data-l="Evento"><a href="#" class="evm-mono" onclick="shEvm.ausencia(\'' + a.id + '\');return false">' + a.cod + '</a> <span class="evl-nome">esperado · ' + esc(c.nome) + '</span>'
        + '<div class="evm-small">' + esc(I.AUTOR[c.autor]) + ' · não chegou</div></td>'
        + '<td data-l="Efeito previsto" class="evm-num">—<div class="evl-fase">' + I.chip('ausente') + '</div></td>'
        + ['CBS', 'IBS'].map(function (t) { return '<td data-l="' + t + ' · ' + I.ORGAO[t].nome + '">' + (a.tribs.indexOf(t) >= 0 ? voc(['ausente', 'amber']) : voc(['não aplicável', 'na'])) + '</td>'; }).join('')
        + '<td data-l="Ocorrência">' + (oc || '<span class="evm-small">espera ' + dias + ' de ' + I.ESPERA_AUSENCIA + ' dias</span>') + '</td></tr>');
    });
    var sub = '<div class="evl-doc-sub">' + evs.length + ' evento' + (evs.length === 1 ? '' : 's') + ' fiscais' + (aus.length ? ' · ' + aus.length + ' esperado' + (aus.length === 1 ? '' : 's') : '')
      + (ocOn ? ' · ' + abertas + ' ocorrência' + (abertas === 1 ? '' : 's') + ' aberta' + (abertas === 1 ? '' : 's') : '') + ' · competência ' + I.comp(nf.data + 'T12:00:00') + '</div>';
    if (!L.length) return sub + '<div class="evm-vazio">Nenhum evento fiscal recebido para este documento. O primeiro pode ser emitido pelo botão Emitir evento ou nota, acima.</div>';
    return sub + '<div class="evl-tc-w"><table class="evl-tc"><thead><tr><th>Evento</th><th class="r">Efeito previsto</th><th>CBS · Receita Federal</th><th>IBS · Comitê Gestor</th><th>Ocorrência</th></tr></thead><tbody>'
      + L.join('') + '</tbody></table></div>'
      + '<div class="evm-small evl-nota">Ordem da autorização no órgão. Clique numa linha para ver o que cada órgão precisa confirmar. Uma ocorrência por tributo; o clique abre a ocorrência em Inconsistências. O Alcance é só informação (D-02).</div>';
  }
  function expandir(tr, e) {
    if (e && e.target && e.target.closest && e.target.closest('a,button')) return;
    var x = tr.parentNode.querySelector('[data-ev-x="' + tr.getAttribute('data-ev') + '"]'); if (!x) return;
    var abrir = x.hidden; x.hidden = !abrir; tr.classList.toggle('aberto', abrir);
  }
  // so (AV-RF, D-RF-07): só o que é deste tributo — os eventos do documento ficam todos,
  // a ação planejada, a confirmação e a divergência só deste órgão
  function linhaDoTempo(nf, so) {
    var I = int(), it = [], tl = so ? so.toLowerCase() : null;
    try {
      if (window.shDetalhe && window.shDetalhe.eventos) window.shDetalhe.eventos(nf, null).forEach(function (e) {
        if (tl && e.trib && e.trib !== tl) return;
        var ts = e.ts ? Date.parse(String(e.ts).length === 16 ? e.ts + ':00' : e.ts) : NaN; if (isNaN(ts)) return;
        it.push({ ts: ts, mk: 'produto', t: semTag(e.titulo), d: semTag(e.desc) });
      });
    } catch (e) {}
    evsDoc(nf).forEach(function (ev) {
      var c = I.CAT[ev.cod];
      it.push({ ts: ev.aut, mk: 'fiscal', t: ev.cod + ' · ' + c.nome + ' autorizado na SEFAZ', d: I.AUTOR[c.autor] + ' · protocolo ' + ev.protocolo + ' · ' + ev.id
        + (ev.correlacionadoEm ? ' · capturado com atraso: correlacionado em ' + I.fDH(ev.correlacionadoEm) : '') + (ev.canceladoPor ? ' · cancelado pelo ' + ev.canceladoPor : '') + (ev.revertidoPor ? ' · revertido pelo ' + ev.revertidoPor : ''), ev: ev.id });
      if (!ev.plan || ev.canceladoPor) return;
      if (!I.movel(ev)) { it.push({ ts: ev.aut, mk: 'exec', t: ev.cod === '110001' ? 'Cancelamento registrado' : 'Atributo registrado', d: I.acaoEv(ev) + ' · vale na autorização', ev: ev.id }); return; }
      var ts = I.tribsDo(ev).filter(function (t) { return ev.trib[t].delta && (!so || t === so); });
      if (so && !ts.length) return;
      var esp = ts.filter(function (t) { return !I.aplicado(ev.trib[t]); }).map(function (t) { return I.ORGAO[t].o + ' ' + I.ORGAO[t].nome; });
      it.push({ ts: ev.plan, mk: 'plan', t: I.acaoEv(ev), d: 'previsto ' + ts.map(function (t) { return t + ' ' + semTag(I.delta(ev.trib[t].delta)); }).join(' · ') + (esp.length ? ' · aguardando ' + esp.join(' e ') : ''), ev: ev.id });
      ts.forEach(function (t) {
        var x = ev.trib[t], o = I.ORGAO[t];
        if (I.aplicado(x)) it.push({ ts: x.exec, mk: 'exec', t: t + ' confirmada ' + o.pelo + ' ' + o.nome, d: (x.estado === 'nao_atribuivel' ? 'aplicado em montante, sem imputação · ' : 'valor aplicado · ') + semTag(I.delta(x.delta)) + ' · ' + ev.id, ev: ev.id });
        else if (x.estado === 'divergente') it.push({ ts: x.lido, mk: 'produto', t: t + ': ' + (x.semReflexo ? 'sem reflexo na janela' : 'valor diferente do previsto'), d: o.nome + ' mostra ' + I.money(x.observado) + ' · nada aplicado · ' + ev.id, ev: ev.id });
      });
    });
    I.ST.ausentes.filter(function (a) { return a.nf === nf.numero && (!so || a.tribs.indexOf(so) >= 0); }).forEach(function (a) {
      it.push({ ts: a.desde, mk: 'produto', t: 'Ausência detectada: ' + a.cod + ' esperado', d: a.indicio });
    });
    it.sort(function (a, b) { return b.ts - a.ts; });
    if (!it.length) return '<div class="pp-mut">Nenhum evento' + (so ? ' deste tributo' : '') + ' neste documento.</div>';
    var MK = { fiscal: 'Evento fiscal · ato de terceiro', produto: 'Evento do produto', plan: 'Ação planejada', exec: 'Ação executada' };
    return '<div class="evl-leg">' + Object.keys(MK).map(function (k) { return '<span><i class="evl-mk ' + k + '"></i>' + MK[k] + '</span>'; }).join('') + '</div>'
      + '<ol class="evl-tl">' + it.map(function (i) {
        return '<li><i class="evl-mk ' + i.mk + '" title="' + MK[i.mk] + '"></i><div class="evl-min0"><div class="evl-tl-h"><span class="evl-tl-q">' + fDHA(i.ts) + '</span>'
          + (i.ev ? '<a href="#" onclick="shEvm.detalhe(\'' + i.ev + '\');return false">' + esc(i.t) + '</a>' : '<b>' + esc(i.t) + '</b>') + '</div>'
          + (i.d ? '<div class="evm-small">' + esc(i.d) + '</div>' : '') + '</div></li>';
      }).join('') + '</ol>'
      + '<div class="evm-small evl-nota">Mais recente primeiro. O círculo cheio é o que a SEFAZ, a Receita Federal ou o Comitê Gestor fizeram; o vazado, o que o produto registrou; o losango vazado é o previsto, e o cheio, o que já vale.</div>';
  }
  // detalhe do RF com abas no topo (AV-RF): preenche as abas do tributo, como no DF
  function injetarRF(n, T) {
    if (!on('eventos_documento')) return;
    var ov = document.getElementById('rf-detalhe-overlay'), I = int(); if (!ov || !I || !I.semear()) return;
    var nf = nfPorNumero(n); if (!nf) return;
    sincronizar();
    var sEv = ov.querySelector('[data-evl-slot="eventos"]'); if (!sEv) return;
    var nEv = evsDoc(nf).length + I.ST.ausentes.filter(function (a) { return a.nf === nf.numero; }).length;
    sEv.innerHTML = abaEventosRF(nf, T);
    var sTl = ov.querySelector('[data-evl-slot="tempo"]'); if (sTl) sTl.innerHTML = linhaDoTempo(nf, T);
    var rot = ov.querySelector('[data-evaj-n]'); if (rot) rot.textContent = nEv ? ' · ' + nEv : '';
  }
  // "Ver no documento": fecha o RF e abre o detalhe do DF na aba de eventos, com a linha marcada
  function verNoDoc(n, id) {
    var o = document.getElementById('rf-detalhe-overlay'); if (o) o.remove();
    if (typeof window.abrirDetalhesNFporNumero !== 'function') return;
    window.abrirDetalhesNFporNumero(n);
    var ov = document.getElementById('nf-detalhe-overlay'), box = ov && ov.querySelector('[data-pp-box]');
    if (box && window.shDetalheDF && shDetalheDF.on()) { shDetalheDF.verEvento(box, id); return; }
    if (on('eventos_documento')) selecionarAba('evl-eventos');
  }
  function injetarDF(n) {
    if (!on('eventos_documento')) return;
    var ov = document.getElementById('nf-detalhe-overlay'), I = int(); if (!ov || !I || !I.semear()) return;
    var nf = nfPorNumero(n); if (!nf) return;
    sincronizar();
    ov.querySelectorAll('[data-evl]').forEach(function (e) { e.remove(); });
    // detalhe com abas no topo (AV-DF): as abas já existem; aqui só se preenchem, com a tabela compacta
    var sEv = ov.querySelector('[data-evl-slot="eventos"]');
    if (sEv) {
      var nEv = evsDoc(nf).length + I.ST.ausentes.filter(function (a) { return a.nf === nf.numero; }).length;
      sEv.innerHTML = abaEventos(nf, true);
      var sTl = ov.querySelector('[data-evl-slot="tempo"]'); if (sTl) sTl.innerHTML = linhaDoTempo(nf);
      var rot = ov.querySelector('[data-evaj-n]'); if (rot) rot.textContent = nEv ? ' · ' + nEv : '';
      return;
    }
    var box = ov.querySelector('.pp-col-r [data-pp-box]');
    if (!box) {
      // detalhe sem partição: a coluna da direita ganha a barra de abas, com o histórico na primeira
      var corpo = ov.querySelector('.mbox') && ov.querySelector('.mbox').lastElementChild, dir = corpo && corpo.lastElementChild;
      if (!dir || !dir.classList.contains('mbox-col')) return;
      if (!dir.querySelector('[data-pp-box]')) {
        var hist = document.createElement('div'); hist.setAttribute('data-aba', 'hist');
        while (dir.firstChild) hist.appendChild(dir.firstChild);
        var b = document.createElement('div'); b.setAttribute('data-pp-box', '');
        b.innerHTML = '<div class="pp-abas"><button data-g="aba" data-v="hist" class="on" onclick="window.shDetalhe.alternar(this)">Histórico do ciclo</button></div>';
        b.appendChild(hist); dir.appendChild(b);
      }
      box = dir.querySelector('[data-pp-box]');
    }
    var bar = box.querySelector('.pp-abas'); if (!bar) return;
    var ocN = on('eventos_inconsistencias') ? ocsDoc(nf).length : 0;
    var fim = bar.querySelector('.pp-abas-fim');
    var btns = '<button data-evl data-g="aba" data-v="evl-eventos" onclick="window.shDetalhe.alternar(this)">Eventos fiscais' + (ocN ? ' <span class="evl-badge" title="ocorrências abertas">' + ocN + '</span>' : '') + '</button>'
      + '<button data-evl data-g="aba" data-v="evl-tempo" onclick="window.shDetalhe.alternar(this)">Linha do tempo fiscal</button>';
    if (fim) fim.insertAdjacentHTML('beforebegin', btns); else bar.insertAdjacentHTML('beforeend', btns);
    box.insertAdjacentHTML('beforeend', '<div data-evl data-aba="evl-eventos" style="display:none" class="evl-aba">' + abaEventos(nf) + '</div>'
      + '<div data-evl data-aba="evl-tempo" style="display:none" class="evl-aba">' + linhaDoTempo(nf) + '</div>');
  }
  function selecionarAba(v) {
    var b = document.querySelector('#nf-detalhe-overlay [data-g="aba"][data-v="' + v + '"]');
    if (b && window.shDetalhe) window.shDetalhe.alternar(b);
  }
  function docAba(n, v) {
    ['evm-det', 'evm-aus', 'evm-pl'].forEach(function (x) { var e = document.getElementById(x); if (e) e.remove(); });
    if (typeof window.abrirDetalhesNFporNumero === 'function') window.abrirDetalhesNFporNumero(n);
    selecionarAba(v || 'evl-eventos');
  }

  /* ══ T-08 · Alertas de competência (D-14) ═══════════════════════════════ */
  var ALC = {}, ALSEQ = 0, ALS = {}, ALF = { p: '', c: '', e: '' };
  var CAUSA = { 'C-1': 'Deslocamento de competência', 'C-2': 'Evento chegou depois do fechamento', 'C-3': 'Confirmação depois do fechamento', 'C-4': 'Reversão depois do fechamento' };
  var EST_AL = { aberto: ['aberto', 'amber'], em_analise: ['em análise', 'blue'], aguardando_apuracao: ['aguardando apuração', 'blue'], aguardando_externo: ['aguardando ação externa', 'blue'], resolvido: ['resolvido', 'ok'], fora: ['fora da janela', 'red'] };
  function alertasLista() {
    var I = int(); if (!I || !on('eventos_alertas') || !I.semear()) return [];
    var vis = visiveis(), agora = Date.now(), L = [];
    I.ST.eventos.forEach(function (ev) {
      if (ev.canceladoPor || ev.orfao || !vis[ev.nf] || !I.movel(ev)) return;
      var P;
      if (ev.reverte) { var o = evPorId(ev.cancela); if (!o) return; P = ym(o.aut); } else P = ym(ev.aut);
      var f = fech(P); if (f > agora) return;   // período ainda aberto: a apuração ainda vai rodar
      var val = {}, pesa = false;
      I.tribsDo(ev).forEach(function (t) {
        var x = ev.trib[t];
        if (!x.delta || x.estado === 'cancelada') val[t] = { st: 'na' };
        else if (I.aplicado(x) && x.exec > f) { val[t] = { st: 'pesa', v: x.delta }; pesa = true; }
        else if (I.aplicado(x)) val[t] = { st: 'apurado' };
        else val[t] = { st: 'aguardando' };
      });
      if (!pesa) return;
      L.push({ k: ev.id + '|' + P, ev: ev, P: P, f: f, j: janela(P), causa: ev.reverte ? 'C-4' : (ev.correlacionadoEm || ev.capt) > f ? 'C-2' : 'C-3', val: val });
    });
    L.sort(function (a, b) { return a.P < b.P ? -1 : a.P > b.P ? 1 : a.ev.aut - b.ev.aut; });
    L.forEach(function (a) {
      if (!ALC[a.k]) ALC[a.k] = 'AL-' + ('00' + (++ALSEQ)).slice(-3);
      a.id = ALC[a.k];
      a.s = ALS[a.k] || (ALS[a.k] = { estado: 'aberto', resp: '', trilha: [{ em: Math.max.apply(null, Object.keys(a.val).map(function (t) { return a.val[t].st === 'pesa' ? a.ev.trib[t].exec : 0; })), txt: 'Alerta aberto: efeito confirmado depois do fechamento de ' + rotP(a.P), por: 'SplitHub' }] });
      a.vis = (a.s.estado === 'aberto' || a.s.estado === 'em_analise') && agora > a.j ? 'fora' : a.s.estado;
    });
    return L;
  }
  function abertoAl(a) { return a.s.estado !== 'resolvido'; }
  function contarAlertas() {
    var b = document.getElementById('itab-alertas'); if (!b) return;
    var n = alertasLista().filter(abertoAl).length;
    b.innerHTML = 'Alertas' + (n ? ' <span class="evl-badge">' + n + '</span>' : '');
  }
  function montarAlertas() {
    if (!on('eventos_alertas')) return;
    var bar = document.querySelector('#view-inconsistencias .analytics-tabs'), lista = document.getElementById('inconsistencias-lista');
    if (!bar || !lista) return;
    if (!document.getElementById('itab-alertas')) bar.insertAdjacentHTML('beforeend', '<button class="atab" id="itab-alertas" onclick="showInconsistTab(\'alertas\',this);shEvmL2.alertas()">Alertas</button>');
    if (!document.getElementById('inc-alertas')) lista.insertAdjacentHTML('beforeend', '<div id="inc-alertas" class="sv"></div>');
    contarAlertas();
  }
  function somaT(L, t) { return L.reduce(function (s, a) { return s + (a.val[t] && a.val[t].st === 'pesa' ? a.val[t].v : 0); }, 0); }
  function celT(a, t) {
    var I = int(), v = a.val[t];
    if (!v) return '<span class="evm-muted">—</span>';
    if (v.st === 'pesa') return I.delta(v.v);
    return '<span class="evm-small">' + (v.st === 'apurado' ? 'já apurado' : v.st === 'aguardando' ? 'aguardando o órgão' : '—') + '</span>';
  }
  function renderAlertas() {
    var root = document.getElementById('inc-alertas'), I = int(); if (!root || !I) return;
    var L = alertasLista(), agora = Date.now();
    contarAlertas();
    var abertos = L.filter(abertoAl), per = {};
    abertos.forEach(function (a) { per[a.P] = 1; });
    var fechando = abertos.filter(function (a) { return a.vis !== 'fora' && a.j - agora <= 7 * I.DIA && a.j >= agora; }).length;
    var fora = abertos.filter(function (a) { return a.vis === 'fora'; }).length;
    var F = L.filter(function (a) { return (!ALF.p || a.P === ALF.p) && (!ALF.c || a.causa === ALF.c) && (!ALF.e || a.vis === ALF.e); });
    var periodos = L.map(function (a) { return a.P; }).filter(function (x, i, arr) { return arr.indexOf(x) === i; }).sort().reverse();
    var opt = function (v, r, s) { return '<option value="' + esc(v) + '"' + (s === v ? ' selected' : '') + '>' + esc(r) + '</option>'; };
    var h = '<div class="evl-al-intro">Eventos que mexem em apuração já fechada. O dado está certo — o órgão confirmou —; o que falta é decidir o que fazer com o período. <b>Nada reabre sozinho</b> (D-14): o produto lista, mede o impacto por tributo e espera a decisão de quem responde pela apuração.</div>'
      + '<div class="kgrid k5">'
      + '<div class="kcard"><div class="klbl">Alertas abertos</div><div class="kval">' + abertos.length + '</div><div class="ksub">em ' + Object.keys(per).length + ' período' + (Object.keys(per).length === 1 ? '' : 's') + '</div></div>'
      + '<div class="kcard"><div class="klbl">Impacto CBS</div><div class="kval evl-kv">' + I.delta(somaT(abertos, 'CBS')) + '</div><div class="ksub">Receita Federal · nos períodos fechados</div></div>'
      + '<div class="kcard"><div class="klbl">Impacto IBS</div><div class="kval evl-kv">' + I.delta(somaT(abertos, 'IBS')) + '</div><div class="ksub">Comitê Gestor · nunca somado à CBS</div></div>'
      + '<div class="kcard amber"><div class="klbl">Janela fecha em até 7 dias</div><div class="kval">' + fechando + '</div><div class="ksub">ainda dá para ajustar</div></div>'
      + '<div class="kcard red"><div class="klbl">Fora da janela</div><div class="kval">' + fora + '</div><div class="ksub">aceite tácito do órgão</div></div>'
      + '</div>'
      + '<div class="evl-fl">'
      + '<label>Período<select onchange="shEvmL2.alFiltro(\'p\',this.value)">' + opt('', 'Todos', ALF.p) + periodos.map(function (p) { return opt(p, rotP(p), ALF.p); }).join('') + '</select></label>'
      + '<label>Causa<select onchange="shEvmL2.alFiltro(\'c\',this.value)">' + opt('', 'Todas', ALF.c) + Object.keys(CAUSA).map(function (c) { return opt(c, c + ' · ' + CAUSA[c], ALF.c); }).join('') + '</select></label>'
      + '<label>Estado<select onchange="shEvmL2.alFiltro(\'e\',this.value)">' + opt('', 'Todos', ALF.e) + Object.keys(EST_AL).map(function (e) { return opt(e, EST_AL[e][0], ALF.e); }).join('') + '</select></label>'
      + '</div>';
    var grupos = periodos.filter(function (p) { return F.some(function (a) { return a.P === p; }); });
    var corpo = grupos.map(function (P) {
      var G = F.filter(function (a) { return a.P === P; }), Ga = L.filter(function (a) { return a.P === P && abertoAl(a); });
      var j = janela(P), dentro = agora <= j, dias = Math.ceil((j - agora) / I.DIA);
      var refazer = dentro && Ga.some(function (a) { return a.s.estado === 'aberto' || a.s.estado === 'em_analise'; });
      var refazendoP = Ga.some(function (a) { return a.s.estado === 'aguardando_apuracao'; });
      var encaminhar = !dentro && Ga.some(function (a) { return a.s.estado === 'aberto' || a.s.estado === 'em_analise'; });
      return '<tr class="evl-al-grp"><td colspan="9"><div class="evl-al-gh"><div class="evl-min0"><b>' + esc(rotP(P)) + '</b> · fechado em ' + I.fD(fech(P)) + ' · '
        + (dentro ? 'janela de ajuste até ' + I.fD(j) + ' — ' + dias + ' dia' + (dias === 1 ? '' : 's') : '<span class="evl-red">janela encerrada em ' + I.fD(j) + ' — aceite tácito</span>')
        + ' · CBS ' + I.delta(somaT(Ga, 'CBS')) + ' · IBS ' + I.delta(somaT(Ga, 'IBS')) + '</div><div class="evl-al-ga">'
        + (refazer ? '<button class="evm-btn" onclick="shEvmL2.alPeriodo(\'' + P + '\',\'refazer\')">Refazer a apuração de ' + esc(rotP(P)) + '</button>' : '')
        + (refazendoP ? '<button class="evm-btn" onclick="shEvmL2.alPeriodo(\'' + P + '\',\'refeita\')" title="Simulação: a apuração do período foi refeita e confirmada no PCONT">Registrar a apuração refeita</button>' : '')
        + (encaminhar ? '<button class="evm-btn" onclick="shEvmL2.alAbrir(\'' + G[0].id + '\',\'encaminhar\')">Encaminhar ' + esc(rotP(P)) + ' para retificação</button>' : '')
        + '</div></div></td></tr>'
        + G.map(function (a) {
          var ev = a.ev, c = I.CAT[ev.cod], e = EST_AL[a.vis] || EST_AL.aberto;
          return '<tr class="evm-linha" tabindex="0" onclick="shEvmL2.alAbrir(\'' + a.id + '\')" onkeydown="if(event.key===\'Enter\')shEvmL2.alAbrir(\'' + a.id + '\')">'
            + '<td class="evm-mono">' + a.id + '</td>'
            + '<td><span class="evl-sit gray" title="' + esc(CAUSA[a.causa]) + '">' + a.causa + '</span></td>'
            + '<td><a href="#" class="evm-mono" onclick="event.stopPropagation();shEvmL2.docAba(\'' + esc(ev.nf) + '\');return false">' + esc(ev.nf) + '</a><div class="evm-small">' + esc(ev.entidade) + '</div></td>'
            + '<td><a href="#" class="evm-mono" onclick="event.stopPropagation();shEvm.detalhe(\'' + ev.id + '\');return false">' + ev.cod + '</a>' + (ev.reverte ? ' <span class="evm-small">→ ' + esc(ev.cancela) + '</span>' : '') + '<div class="evm-small">' + ev.id + ' · ' + esc(c.nome) + '</div></td>'
            + '<td class="evm-small">' + esc(rotP(a.P)) + '</td>'
            + '<td class="evm-num">' + celT(a, 'CBS') + '</td><td class="evm-num">' + celT(a, 'IBS') + '</td>'
            + '<td><span class="evl-sit ' + e[1] + '">' + e[0] + '</span></td>'
            + '<td class="evm-small">' + esc(a.s.resp || '—') + '</td></tr>';
        }).join('');
    }).join('');
    h += '<div class="tcrd"><div class="tcrd-hdr"><div class="sechdr" style="margin-bottom:0"><h2>Alertas de competência</h2><p>' + F.length + ' de ' + L.length + ' · agrupados por período, porque a ação é por período</p></div></div>'
      + '<div class="twrap"><table><thead><tr><th>Alerta</th><th>Causa</th><th>Documento</th><th>Evento</th><th>Competência</th><th class="r">CBS</th><th class="r">IBS</th><th>Estado</th><th>Responsável</th></tr></thead><tbody>'
      + (corpo || '<tr><td colspan="9" class="evm-vazio">' + (L.length ? 'Nenhum alerta neste filtro.' : 'Nenhum evento mexeu em período fechado.') + '</td></tr>')
      + '</tbody></table></div></div>'
      + '<div class="evm-small evl-nota">Os valores são o efeito confirmado sobre o crédito de cada período, CBS e IBS separados. <b>Já apurado</b>: aquele tributo confirmou antes do fechamento, e só o outro pesa. '
      + 'Fechamento simulado no dia ' + FECHA_DIA + ' do mês seguinte, enquanto a DA-02 não decide de onde vem a data; a janela de ajuste vai até o último dia útil do mês seguinte à competência (C-20). '
      + 'A causa C-1 (112150) espera a C-06 e a DV-34; o alerta que expira fica <b>fora da janela</b> e não abre ocorrência sozinho enquanto a DA-01 estiver em aberto.</div>';
    root.innerHTML = h;
  }
  function alFiltro(k, v) { ALF[k] = v; renderAlertas(); }
  function alPor(id) { return alertasLista().filter(function (a) { return a.id === id; })[0] || null; }
  function trilhaAl(a, txt) { a.s.trilha.push({ em: Date.now(), txt: txt, por: usuario() }); }
  function alPeriodo(P, acao) {
    var L = alertasLista().filter(function (a) { return a.P === P; });
    if (acao === 'refazer') {
      var n = 0;
      L.forEach(function (a) { if (a.s.estado === 'aberto' || a.s.estado === 'em_analise') { a.s.estado = 'aguardando_apuracao'; trilhaAl(a, 'Escolhido refazer a apuração de ' + rotP(P) + ': fecha quando o período for refeito'); n++; } });
      toast(n + ' alerta' + (n === 1 ? '' : 's') + ' de ' + rotP(P) + ' aguardando a apuração. A apuração refeita é confirmada por uma pessoa no PCONT.');
    } else if (acao === 'refeita') {
      L.forEach(function (a) { if (a.s.estado === 'aguardando_apuracao') { a.s.estado = 'resolvido'; trilhaAl(a, 'Apuração de ' + rotP(P) + ' refeita e confirmada'); } });
      toast('Apuração de ' + rotP(P) + ' refeita: os alertas do período se fecharam.');
    }
    renderAlertas();
  }
  function alAbrir(id, foco) {
    var I = int(), a = alPor(id); if (!I || !a) return;
    var ev = a.ev, c = I.CAT[ev.cod], e = EST_AL[a.vis] || EST_AL.aberto, dentro = Date.now() <= a.j, st = a.s.estado;
    var acoes = '';
    if (st === 'aberto') acoes += '<button class="evm-btn" onclick="shEvmL2.alAcao(\'' + id + '\',\'assumir\')">Assumir</button>';
    if (st !== 'resolvido' && st !== 'aguardando_externo') acoes += '<button class="evm-btn" onclick="shEvmL2.alAcao(\'' + id + '\',\'manter\')">Manter e justificar</button>';
    if (dentro && (st === 'aberto' || st === 'em_analise')) acoes += '<button class="evm-btn pri" onclick="shEvmL2.fecharAl();shEvmL2.alPeriodo(\'' + a.P + '\',\'refazer\')">Refazer a apuração de ' + esc(rotP(a.P)) + '</button>';
    if (!dentro && (st === 'aberto' || st === 'em_analise')) acoes += '<button class="evm-btn pri" onclick="shEvmL2.alAcao(\'' + id + '\',\'encaminhar\')">Encaminhar para retificação</button>';
    if (st === 'aguardando_externo') acoes += '<button class="evm-btn pri" onclick="shEvmL2.alAcao(\'' + id + '\',\'retorno\')">Registrar o retorno</button>';
    var precisaTexto = st !== 'resolvido';
    I.overlay('evl-al', 760, I.cab('evl-al', a.id + ' · ' + esc(CAUSA[a.causa]), '<span class="evl-sit ' + e[1] + '">' + e[0] + '</span>',
      '<span>' + esc(rotP(a.P)) + ' · fechado em ' + I.fD(a.f) + '</span><span>' + (dentro ? 'janela até ' + I.fD(a.j) : 'janela encerrada em ' + I.fD(a.j)) + '</span><span>NF-e <span class="evm-mono">' + esc(ev.nf) + '</span> · ' + esc(ev.entidade) + '</span>')
      + '<div class="evm-corpo">'
      + '<div class="evm-faixa ' + (dentro ? 'amber' : 'red') + '">' + textoCausa(a) + '</div>'
      + '<div class="twrap" style="--twrap-h:none"><table><thead><tr><th>Evento</th><th>Tributo · órgão</th><th class="r">Efeito no período</th><th>Confirmado em</th></tr></thead><tbody>'
      + I.tribsDo(ev).map(function (t) {
        var x = ev.trib[t];
        return '<tr><td><a href="#" onclick="shEvmL2.fecharAl();shEvm.detalhe(\'' + ev.id + '\');return false">' + ev.id + '</a> <span class="evm-mono">' + ev.cod + '</span><div class="evm-small">' + esc(c.nome) + '</div></td>'
          + '<td>' + t + ' · ' + I.ORGAO[t].nome + '</td><td class="evm-num">' + celT(a, t) + '</td><td class="evm-small">' + (I.aplicado(x) && x.exec ? I.fDH(x.exec) : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>'
      + '<div><div class="evm-rot">Trilha</div><div class="twrap" style="--twrap-h:none"><table><tbody>'
      + a.s.trilha.slice().sort(function (x, y) { return x.em - y.em; }).map(function (t) { return '<tr><td class="evm-small evm-nw">' + I.fDH(t.em) + '</td><td>' + esc(t.txt) + '<div class="evm-small">' + esc(t.por) + '</div></td></tr>'; }).join('')
      + '</tbody></table></div></div>'
      + (precisaTexto ? '<div class="evl-campo"><label for="evl-al-txt">Justificativa, encaminhamento ou retorno</label><textarea id="evl-al-txt" rows="3" placeholder="Obrigatório para manter, encaminhar e registrar o retorno: o que foi feito, a quem e quando"></textarea></div>' : '')
      + '</div><div class="evm-pe">' + acoes + '</div>');
    if (foco === 'encaminhar') { var tx = document.getElementById('evl-al-txt'); if (tx) tx.focus(); }
  }
  function textoCausa(a) {
    var I = int(), ev = a.ev;
    if (a.causa === 'C-4') return '<b>Reversão depois do fechamento.</b> O ' + esc(ev.cancela) + ' foi executado em ' + esc(rotP(a.P)) + ', e o 110001 que o cancela foi confirmado depois do fechamento: a execução volta, e o período fechado tinha contado com ela.';
    if (a.causa === 'C-2') return '<b>O evento chegou depois do fechamento.</b> Autorizado em ' + I.fD(ev.aut) + ', dentro de ' + esc(rotP(a.P)) + ', e recebido ' + (ev.canal === 'CSV' ? 'por CSV' : 'pela API') + ' em ' + I.fD(ev.correlacionadoEm || ev.capt) + ', com o período já fechado. O efeito é da competência do evento.';
    return '<b>Confirmação depois do fechamento.</b> A ação foi planejada com ' + esc(rotP(a.P)) + ' aberto, e o órgão só confirmou depois. Pode acontecer num tributo e não no outro: o que confirmou antes já está apurado.';
  }
  function alAcao(id, acao) {
    var a = alPor(id); if (!a) return;
    var txt = ((document.getElementById('evl-al-txt') || {}).value || '').trim();
    if (acao !== 'assumir' && !txt) { var t = document.getElementById('evl-al-txt'); if (t) { t.focus(); t.classList.add('evl-falta'); } toast('Escreva o texto: ele fica na trilha, com autor e data.'); return; }
    if (acao === 'assumir') { a.s.estado = 'em_analise'; a.s.resp = usuario(); trilhaAl(a, 'Assumido'); }
    else if (acao === 'manter') { a.s.estado = 'resolvido'; trilhaAl(a, 'Mantido como está · ' + txt); }
    else if (acao === 'encaminhar') {
      alertasLista().filter(function (x) { return x.P === a.P && (x.s.estado === 'aberto' || x.s.estado === 'em_analise'); }).forEach(function (x) { x.s.estado = 'aguardando_externo'; trilhaAl(x, 'Encaminhado para retificação · ' + txt); });
    }
    else if (acao === 'retorno') { a.s.estado = 'resolvido'; trilhaAl(a, 'Retorno registrado · ' + txt); }
    renderAlertas();
    if (acao === 'assumir') alAbrir(id); else fecharAl();
    toast({ assumir: a.id + ' em análise, com ' + usuario() + '.', manter: a.id + ' mantido, com a justificativa na trilha.', encaminhar: 'Alertas de ' + rotP(a.P) + ' aguardando ação externa.', retorno: a.id + ' resolvido com o retorno.' }[acao]);
  }
  function fecharAl() { var e = document.getElementById('evl-al'); if (e) e.remove(); }
  function abrirAlertas() {
    var nb = document.getElementById('nav-inconsist-btn');
    ['evm-det', 'evm-aus', 'evm-pl', 'nf-detalhe-overlay', 'rf-detalhe-overlay'].forEach(function (x) { var e = document.getElementById(x); if (e) e.remove(); });
    if (typeof window.showView === 'function') window.showView('inconsistencias', nb);
    montarAlertas();
    var b = document.getElementById('itab-alertas');
    if (b && typeof window.showInconsistTab === 'function') window.showInconsistTab('alertas', b);
    renderAlertas();
  }
  function verAlerta(id) {
    abrirAlertas();
    var a = alPor(id); if (!a) return;
    ALF = { p: '', c: '', e: '' }; renderAlertas(); alAbrir(id);
  }

  /* ══ Ganchos ═════════════════════════════════════════════════════════════ */
  function ganchos() {
    mapasCard();
    contextoApi();
    montarAlertas();
    ganchoRefletir();
    if (typeof window.abrirDetalhesNFporNumero === 'function' && !window.abrirDetalhesNFporNumero._evl) {
      var df = window.abrirDetalhesNFporNumero;
      window.abrirDetalhesNFporNumero = function (n) {
        var r = df.apply(this, arguments);
        try { injetarDF(n); } catch (e) { console.error('[eventos lote 2] documento', e); }
        return r;
      };
      window.abrirDetalhesNFporNumero._evl = true;
    }
    if (typeof window.kbAbrirCard === 'function' && !window.kbAbrirCard._evl) {
      var kb = window.kbAbrirCard;
      window.kbAbrirCard = function (id) {
        var r = kb.apply(this, arguments);
        try { injetarCard(id); } catch (e) { console.error('[eventos lote 2] card', e); }
        return r;
      };
      window.kbAbrirCard._evl = true;
    }
    if (window.shEvm && window.shEvm.verDocumento && !window.shEvm.verDocumento._evl) {
      var vd = window.shEvm.verDocumento;
      window.shEvm.verDocumento = function (n) { vd(n); if (on('eventos_documento')) selecionarAba('evl-eventos'); };
      window.shEvm.verDocumento._evl = true;
    }
  }

  window.shEvmL2 = {
    on: on, semear: semear, inconsistencias: inconsistencias, sincronizar: sincronizar, abas: abas, tabela: tabela,
    faixa: faixa, linkDivergencia: linkDivergencia, abrirAusencia: abrirAusencia, linksAusencia: linksAusencia,
    botoesDetalhe: botoesDetalhe, aposLeitura: aposLeitura, novoOrfao: novoOrfao, reverter: reverter, executado: executado,
    ocorrencia: ocorrencia, abrirInc: abrirInc, correlacionar: correlacionar, docAba: docAba, fecharCard: fecharCard,
    alertas: renderAlertas, alFiltro: alFiltro, alPeriodo: alPeriodo, alAbrir: alAbrir, alAcao: alAcao, fecharAl: fecharAl, verAlerta: verAlerta,
    expandir: expandir, injetarRF: injetarRF, verNoDoc: verNoDoc,
    chaveExemplo: function (ref) { return chaveFake(ref - 3 * 864e5, '45123678000112', 990700 + (int() ? int().ST.seq : 0)); },
    _alertas: alertasLista
  };

  // depois dos ganchos do AV-EV (200 ms): o embrulho daqui fica por fora
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(ganchos, 400); });
  else setTimeout(ganchos, 400);
  window.addEventListener('load', function () { setTimeout(function () { ganchos(); contarAlertas(); }, 900); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fecharAl(); });
})();

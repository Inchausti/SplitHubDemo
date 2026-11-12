/* @pacote — o estado das flags é reescrito por tools/avaliacao.py promover */
window.shFeature && shFeature.registrar({"id": "AV-GS", "nome": "Atendimento das inconsistências — grupos, sorteio e exigências", "branch": "feat/grupos-sla", "entrada": "#/inconsistencias/kanban", "flags": {"atendimento_grupos": "avaliacao", "atendimento_exigencias": "avaliacao"}, "rotulos": {"atendimento_grupos": "Grupos de atendimento, regras de roteamento e sorteio pela menor carga: Configurações › Atendimento, grupo e responsável no kanban e no card, recortes e ações de atribuição", "atendimento_exigencias": "Exigências em toda passagem de estado do chamado, no kanban e no card"}});
/* @fim-pacote */

/* ══ Atendimento das inconsistências — lote 1 ═══════════════════════════════
   Implementa a proposta de gestão de inconsistências v2.2 (R-314) e o PRD de
   Inconsistências v1.6 (R-315), com as decisões de 12/11/2026:
     · grupos com membros da gestão de usuários, gestor e ausência com data de
       volta; regras de roteamento por família ou tipo e por tipo de DF, com a
       mais específica vencendo e depois a ordem da lista (D-03); grupo padrão
       com a marca sem regra (D-02); matriz de cobertura e teste de combinação
     · todo chamado recebe grupo pela regra e responsável pelo sorteio entre os
       elegíveis de menor carga, com o acaso só desempatando (D-01). Elegível é
       quem pode operar a família e enxerga o CNPJ (D-16, D-17); sem elegível
       disponível, o chamado espera na fila do grupo e o gestor é avisado (D-04)
     · kanban com família, tributo, grupo e responsável no card, recortes Meus,
       Do meu grupo e Todos, e o rótulo Aguardando terceiro (D-24)
     · assumir, reatribuir, transferir com motivo (D-06) e devolver, com a
       origem de cada atribuição no histórico; membro removido tem os chamados
       sorteados de novo (D-05)
     · exigências em toda passagem de estado (D-18): responsável, terceiro e o
       que se espera, resposta, desfecho e efeito revertido, ficha de glosa
   O SLA, a listagem, o dashboard e o evento pedido do card são o lote 2. O
   estado vive em memória e é recriado a cada carregamento, como no resto do
   protótipo. O CNPJ do estabelecimento de cada chamado é derivado do id: as
   ocorrências do protótipo não guardam o estabelecimento da organização.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function on() { return !window.shFeature || shFeature.ligada('atendimento_grupos'); }
  function onExig() { return on() && (!window.shFeature || shFeature.ligada('atendimento_exigencias')); }

  /* ── Utilitários ─────────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtD(d) { var x = d instanceof Date ? d : new Date(d); return pad(x.getDate()) + '/' + pad(x.getMonth() + 1) + '/' + x.getFullYear(); }
  function fmtDH(d) { var x = d instanceof Date ? d : new Date(d); return fmtD(x) + ' ' + pad(x.getHours()) + ':' + pad(x.getMinutes()); }
  function dm(d) { return fmtD(d).slice(0, 5); }
  function maisDias(n) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d; }
  function isoDia(d) { var x = d instanceof Date ? d : new Date(d); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); }
  function fechar(id) { var e = document.getElementById(id); if (e) e.remove(); }
  function el(id) { return document.getElementById(id); }
  function plural(n, s, p) { return n + ' ' + (n === 1 ? s : p); }
  function lista(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1]; }

  function toast(msg, erro) {
    fechar('at-toast');
    var t = document.createElement('div');
    t.id = 'at-toast';
    t.className = 'at-toast' + (erro ? ' erro' : '');
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 4500);
  }

  // acaso com semente: a distribuição da ativação é a mesma a cada carregamento
  var semente = 20261112;
  function acaso() { semente = (semente * 1103515245 + 12345) & 0x7fffffff; return semente / 0x7fffffff; }

  function K() { return window.IncCatalogo || null; }
  function letra(f) { var k = K(); return k && k.FAMILIAS[f] ? k.FAMILIAS[f].letra : '?'; }
  function famLabel(f) { var k = K(); return k && k.FAMILIAS[f] ? k.FAMILIAS[f].label : f; }
  function tipoLabel(t) { var k = K(); return k ? k.label(t) : t; }
  function tiposDaFamilia(f) { var k = K(); return k ? k.lista().filter(function (t) { return k.familia(t) === f; }) : []; }
  function familias() { var k = K(); return k ? k.porFamilia().map(function (x) { return x.chave; }) : []; }

  /* ── Pessoas: vêm da gestão de usuários (js/usuarios.js) ─────────────────── */
  var PERFIL_ROT = { administrador: 'Administrador', fiscal: 'Fiscal', tesouraria: 'Tesouraria', leitura: 'Leitura' };
  var PERFIL_CLS = { administrador: 'adm', fiscal: 'fis', tesouraria: 'tes', leitura: 'lei' };
  function usuarios() { return (window._usuState && window._usuState.usuarios) || []; }
  function pessoa(id) { return id ? usuarios().filter(function (u) { return u.id === id; })[0] || null : null; }
  function ativo(u) { return !!u && u.estado === 'ativo'; }
  function podeSerMembro(u) { return ativo(u) && ['administrador', 'fiscal', 'tesouraria'].indexOf(u.perfil) >= 0; }
  function iniciais(nome) {
    var p = String(nome || '?').split(/\s+/).filter(Boolean);
    return ((p[0] || '?').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase();
  }
  function av(u, cls) {
    return '<span class="at-av ' + (u ? PERFIL_CLS[u.perfil] || 'off' : 'off') + (cls ? ' ' + cls : '') + '" title="' + esc(u ? u.nome : 'Sem responsável') + '">'
      + esc(u ? iniciais(u.nome) : '—') + '</span>';
  }
  function vendo() { return pessoa(AT.viewer) || usuarios()[0] || null; }

  /* ── Estabelecimento, tipo de DF e tributo do chamado ────────────────────── */
  var DFS = ['NF-e', 'NFC-e', 'NFCom', 'NF3-e', 'NFS-e', 'CT-e', 'NFAg', 'NFGás', 'MDF-e', 'BP-e'];
  function cnpjsAtivos() { return (window._orgCnpjs || []).filter(function (c) { return c.status === 'ativo'; }); }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function estab(inc) { var l = cnpjsAtivos(); return l.length ? l[hash(inc.id + '|' + (inc.nfNumero || '')) % l.length].cnpj : null; }
  function estabRot(cnpj) {
    var c = (window._orgCnpjs || []).filter(function (x) { return x.cnpj === cnpj; })[0];
    return c ? c.cnpj + ' · ' + c.razao.split(' ')[0] + ' ' + c.uf : (cnpj || '—');
  }
  function tipoDF(inc) {
    var t = String(inc.dfNum || inc.dfId || '').split(/\s+/)[0].toLowerCase();
    for (var i = 0; i < DFS.length; i++) if (DFS[i].toLowerCase() === t) return DFS[i];
    return 'NF-e';
  }
  function trib(inc) { var t = String(inc.tipoFiscal || '').toUpperCase(); return t === 'IBS' || t === 'CBS' ? t : '—'; }
  function orgao(t) { return t === 'CBS' ? 'Receita Federal' : t === 'IBS' ? 'Comitê Gestor' : '—'; }
  function escopoRot(u) {
    if (!u) return '—';
    if (u.perfil === 'administrador' || !u.escopo) return 'Toda a organização';
    var nomes = {};
    u.escopo.forEach(function (c) { var o = (window._orgCnpjs || []).filter(function (x) { return x.cnpj === c; })[0]; if (o) nomes[o.razao.split(' ')[0]] = 1; });
    return plural(u.escopo.length, 'CNPJ', 'CNPJs') + ' · ' + Object.keys(nomes).join(' e ');
  }

  /* ── Estado ──────────────────────────────────────────────────────────────── */
  var AT = window._atState = {
    grupos: [], regras: [], padraoId: null, ch: {}, viewer: null,
    recorte: 'meus', fGrupo: '', fTrib: '', soFila: false, soSemRegra: false,
    aba: 'grupos', seqG: 0, seqR: 0, semeado: false, ativado: false, p: null
  };
  var ROT = { aberta: 'Aberta', em_analise: 'Em análise', aguardando_emitente: 'Aguardando terceiro', resolvida: 'Resolvida', glosada: 'Glosada' };
  var ABERTOS = ['aberta', 'em_analise', 'aguardando_emitente'];

  function grupo(id) { return AT.grupos.filter(function (g) { return g.id === id; })[0] || null; }
  function regra(id) { return AT.regras.filter(function (r) { return r.id === id; })[0] || null; }
  function incPorId(id) { return (window._inconsistenciasGlobal || []).filter(function (i) { return i.id === id; })[0] || null; }
  function estado(id) {
    var s = (window._kanbanState && window._kanbanState[id]) || (incPorId(id) || {}).status || 'aberta';
    return ROT[s] ? s : 'aberta';
  }
  function aberto(id) { return ABERTOS.indexOf(estado(id)) >= 0; }
  function chamados() { return Object.keys(AT.ch).map(function (k) { return AT.ch[k]; }); }
  function hist(c, tipo, origem, txt, autor, em) {
    c.hist.unshift({ em: em || new Date(), tipo: tipo, origem: origem, txt: txt, autor: autor || 'SplitHub' });
  }

  function semear() {
    if (AT.semeado) return true;
    var us = usuarios();
    if (!us.length) return false;
    var id = {};
    us.forEach(function (u) { id[u.nome] = u.id; });
    var J = id['José da Silva'], M = id['Maria Costa'], R = id['Rafael Lima'], A = id['Ana Ferreira'];
    function m(uid, aus) { return { usuarioId: uid, ausenteAte: aus || null, desde: maisDias(-30) }; }
    function g(nome, desc, gestor, membros, padrao) {
      var x = { id: 'G-' + pad(++AT.seqG), nome: nome, descricao: desc, gestorId: gestor, ativo: true,
        membros: membros.filter(function (y) { return y.usuarioId; }) };
      AT.grupos.push(x);
      if (padrao) AT.padraoId = x.id;
      return x;
    }
    var g1 = g('Fiscal — Confronto', 'Confronto com o órgão: valor e alíquota, registro sem par, movimento sem contrapartida e partição', M, [m(M), m(R)]);
    var g2 = g('Tesouraria — Recolhimento', 'Recolhimento e comprovação: guia paga sem comprovante, comprovante divergente e reconhecido diferente do pago', A, [m(A), m(J)]);
    var g3 = g('Cadastro e Ingestão', 'Documento que não passou na entrada: chave inválida, CNPJ divergente e RF duplicado', R, [m(R), m(J)]);
    var g4 = g('Fiscal — Ciclo do crédito', 'Glosa total e parcial do crédito', M, [m(M), m(R)]);
    var g5 = g('Serviços tomados', 'Tudo o que é serviço tomado, na NFS-e', J, [m(R, maisDias(8))]);
    g('Fila geral', 'Recebe o que nenhuma regra cobre', M, [m(M), m(J)], true);
    function r(gr, o) { AT.regras.push({ id: 'R-' + pad(++AT.seqR), grupoId: gr.id, familias: o.f || [], tipos: o.t || [], dfs: o.d || [], ativa: true }); }
    r(g4, { t: ['glosa_credito', 'glosa_parcial'] });
    r(g5, { d: ['NFS-e'] });
    r(g1, { f: ['fisco'] });
    r(g2, { f: ['financeiro'] });
    r(g3, { f: ['documento'] });
    r(g1, { f: ['fisco'], d: ['NFS-e'] });
    AT.viewer = J || us[0].id;
    AT.semeado = true;
    return true;
  }

  /* ── Roteamento (D-03) ───────────────────────────────────────────────────── */
  function temTipo(r) { return r.familias.length > 0 || r.tipos.length > 0; }
  function nCrit(r) { return (temTipo(r) ? 1 : 0) + (r.dfs.length ? 1 : 0); }
  function casa(r, fam, tipo, df) {
    if (!nCrit(r)) return false;
    if (temTipo(r) && r.familias.indexOf(fam) < 0 && r.tipos.indexOf(tipo) < 0) return false;
    if (r.dfs.length && df && r.dfs.indexOf(df) < 0) return false;
    if (r.dfs.length && !df) return false;
    return true;
  }
  function rotear(fam, tipo, df) {
    var casam = AT.regras.filter(function (r) { var g = grupo(r.grupoId); return r.ativa && g && g.ativo && casa(r, fam, tipo, df); });
    var venc = casam.slice().sort(function (a, b) { return nCrit(b) - nCrit(a) || AT.regras.indexOf(a) - AT.regras.indexOf(b); })[0] || null;
    return { casam: casam, regra: venc, grupoId: venc ? venc.grupoId : AT.padraoId };
  }
  function descCrit(r) {
    var p = [];
    if (temTipo(r)) p.push(r.familias.length ? 'família' : (r.tipos.length > 1 ? 'tipos' : 'tipo'));
    if (r.dfs.length) p.push('DF');
    return p.join(' e ');
  }
  function rotCrit(r) {
    var a = r.familias.map(function (f) { return 'família ' + letra(f); }).concat(r.tipos.map(tipoLabel));
    return (a.length ? a.join(', ') : '') + (r.dfs.length ? (a.length ? ' · ' : '') + r.dfs.join(', ') : '');
  }
  function porQueVenceu(res) {
    if (!res.regra) return 'nenhuma regra casou';
    if (res.casam.length < 2) return 'só ela casou';
    var outras = res.casam.filter(function (r) { return r !== res.regra; });
    var maisEsp = outras.every(function (r) { return nCrit(r) < nCrit(res.regra); });
    return maisEsp ? 'a mais específica' : 'está antes na lista';
  }

  /* ── Elegibilidade (D-16, D-17) e carga (D-01) ───────────────────────────── */
  function ausente(m) { return !!m.ausenteAte && new Date(m.ausenteAte) > new Date(); }
  function motivoFora(u, c) {
    if (!u) return 'usuário não encontrado';
    if (!ativo(u)) return 'não está ativo';
    if (!podeSerMembro(u)) return 'o perfil ' + (PERFIL_ROT[u.perfil] || u.perfil) + ' não age';
    if (u.perfil === 'tesouraria' && c.familia !== 'financeiro') return 'Tesouraria só opera a família D';
    if (u.perfil !== 'administrador' && u.escopo && c.cnpj && u.escopo.indexOf(c.cnpj) < 0) return 'o CNPJ ' + c.cnpj + ' não está no escopo';
    return '';
  }
  function elegiveis(g, c) {
    var ok = [], fora = [];
    (g ? g.membros : []).forEach(function (m) {
      var u = pessoa(m.usuarioId);
      var mot = ausente(m) ? 'ausente até ' + dm(m.ausenteAte) : motivoFora(u, c);
      if (mot) fora.push({ u: u, motivo: mot }); else ok.push(u);
    });
    return { ok: ok, fora: fora };
  }
  function membroElegivel(u, c) {
    var g = grupo(c.grupoId);
    if (!u || !g) return false;
    var m = g.membros.filter(function (x) { return x.usuarioId === u.id; })[0];
    return !!m && !ausente(m) && !motivoFora(u, c);
  }
  function carga(uid) {
    var n = 0;
    chamados().forEach(function (c) { if (c.respId === uid && aberto(c.id)) n++; });
    return n;
  }
  function sortear(c, g) {
    var e = elegiveis(g, c);
    if (!e.ok.length) return { uid: null, e: e, cargas: [] };
    var cargas = e.ok.map(function (u) { return { u: u, n: carga(u.id) }; });
    var min = Math.min.apply(null, cargas.map(function (x) { return x.n; }));
    var menores = cargas.filter(function (x) { return x.n === min; });
    var pick = menores[Math.floor(acaso() * menores.length) % menores.length];
    return { uid: pick.u.id, e: e, cargas: cargas, empate: menores.length };
  }
  function nAbertos(n) { return n + (n === 1 ? ' aberto' : ' abertos'); }
  function textoSorteio(s, g) {
    if (!s.uid) {
      var gest = pessoa(g && g.gestorId);
      return 'Ninguém elegível disponível: o chamado fica na fila do grupo, sem responsável, e o gestor' + (gest ? ', ' + gest.nome + ',' : '') + ' foi avisado.';
    }
    var esc1 = pessoa(s.uid), n = s.cargas.filter(function (x) { return x.u.id === s.uid; })[0].n;
    if (s.cargas.length === 1) return 'Única elegível disponível: ' + esc1.nome + ', com ' + nAbertos(n) + '.';
    var lst = lista(s.cargas.map(function (x) { return x.u.nome + ' (' + nAbertos(x.n) + ')'; }));
    if (s.empate > 1) return 'Elegíveis: ' + lst + '. Empate na menor carga, ' + nAbertos(n) + ': o acaso escolheu ' + esc1.nome + '.';
    return 'Elegíveis: ' + lst + '. ' + esc1.nome + ' tinha a menor carga e recebeu.';
  }
  function textoFora(e) {
    return e.fora.length ? ' Ficaram fora: ' + e.fora.map(function (f) { return (f.u ? f.u.nome : '—') + ' — ' + f.motivo; }).join('; ') + '.' : '';
  }
  function curtoSorteio(s) {
    if (!s.uid) return 'fila do grupo — ninguém elegível disponível, gestor avisado';
    var u = pessoa(s.uid), n = s.cargas.filter(function (x) { return x.u.id === s.uid; })[0].n;
    var outros = s.cargas.filter(function (x) { return x.u.id !== s.uid; }).map(function (x) { return x.u.nome + ', ' + x.n; });
    return 'sorteio pela menor carga: ' + u.nome + ' (' + nAbertos(n) + (outros.length ? '; ' + outros.join('; ') : '') + ')';
  }

  /* ── Criação: grupo pela regra, responsável pelo sorteio ─────────────────── */
  function criar(inc, ativacao) {
    var c = { id: inc.id, familia: inc.familia, tipo: inc.tipo, df: tipoDF(inc), tributo: trib(inc), cnpj: estab(inc),
      hist: [], terceiro: null, resposta: '', desfecho: '', efeito: '', ficha: '', transferido: false };
    var r = rotear(c.familia, c.tipo, c.df);
    c.grupoId = r.grupoId;
    c.regraId = r.regra ? r.regra.id : null;
    c.semRegra = !r.regra;
    AT.ch[inc.id] = c;
    var g = grupo(c.grupoId);
    var s = sortear(c, g);
    c.respId = s.uid;
    var rot = r.regra
      ? 'Roteado pela regra ' + r.regra.id + ' (' + rotCrit(r.regra) + ')' + (r.casam.length > 1 ? ' — casaram ' + lista(r.casam.map(function (x) { return x.id; })) + '; venceu a ' + r.regra.id + ', ' + porQueVenceu(r) : '') + ' → ' + g.nome + '.'
      : 'Nenhuma regra casou: foi para o grupo padrão, ' + (g ? g.nome : '—') + ', com a marca sem regra.';
    c.explic = rot + ' ' + textoSorteio(s, g) + textoFora(s.e);
    hist(c, 'ATRIBUIÇÃO', ativacao ? 'ativacao' : 'regra',
      (ativacao ? 'Ativação do atendimento · ' : 'Atribuição automática · ')
      + (r.regra ? r.regra.id + ' → ' + g.nome : 'sem regra → ' + (g ? g.nome : '—') + ', o grupo padrão') + ' · ' + curtoSorteio(s));
    return c;
  }
  function garantir() {
    if (!semear()) return false;
    var lst = window._inconsistenciasGlobal || [];
    var primeira = !AT.ativado;
    lst.forEach(function (inc) {
      var c = AT.ch[inc.id];
      if (!c || c.tipo !== inc.tipo) criar(inc, primeira);
    });
    if (lst.length) AT.ativado = true;
    menuAviso();
    return true;
  }

  /* ── Redistribuição (D-04, D-05) ─────────────────────────────────────────── */
  function sortearDeNovo(c, origem, motivo, autor) {
    var g = grupo(c.grupoId), ant = pessoa(c.respId);
    c.respId = null;   // o próprio chamado não conta na carga de quem o tinha
    var s = sortear(c, g);
    c.respId = s.uid;
    if (!s.uid && estado(c.id) === 'em_analise') aplicarEstado(c, 'aberta', 'sem responsável, volta à fila do grupo', 'redistribuicao', 'SplitHub');
    hist(c, 'ATRIBUIÇÃO', origem, motivo + (ant && motivo.indexOf(ant.nome) < 0 ? ' · antes: ' + ant.nome : '') + ' · ' + curtoSorteio(s), autor || 'SplitHub');
    return s.uid;
  }
  function sortearFila(g, motivo) {
    var n = 0;
    chamados().forEach(function (c) {
      if (c.grupoId !== g.id || c.respId || !aberto(c.id)) return;
      var s = sortear(c, g);
      if (!s.uid) return;   // continua na fila: nada novo a registrar
      c.respId = s.uid;
      hist(c, 'ATRIBUIÇÃO', 'redistribuicao', 'Fila do grupo sorteada — ' + motivo + ' · ' + curtoSorteio(s));
      n++;
    });
    return n;
  }

  /* ── Estado do chamado ───────────────────────────────────────────────────── */
  function aplicarEstado(c, para, txt, origem, autor) {
    var de = estado(c.id);
    if (window._kanbanState) window._kanbanState[c.id] = para;
    var inc = incPorId(c.id);
    if (inc) inc.status = para;
    hist(c, 'ESTADO', origem || 'pessoa', ROT[de] + ' → ' + ROT[para] + (txt ? ' · ' + txt : ''), autor || (vendo() || {}).nome);
  }
  function atribuir(c, uid, origem, txt) {
    c.respId = uid;
    hist(c, 'ATRIBUIÇÃO', origem, txt, (vendo() || {}).nome);
  }
  function redesenhar(incId) {
    try { window.renderizarKanbanInconsistencias(); } catch (e) {}
    var m = el('kb-card-modal');
    if (incId && m && m.style.display !== 'none' && m._incId === incId) window.kbAbrirCard(incId);
    if (el('admin-atendimento') && el('admin-atendimento').classList.contains('active')) render();
  }

  /* ── Recortes do kanban ──────────────────────────────────────────────────── */
  function noEscopo(u, c) { return !u || u.perfil === 'administrador' || !u.escopo || !c.cnpj || u.escopo.indexOf(c.cnpj) >= 0; }
  function gruposDe(uid) {
    return AT.grupos.filter(function (g) { return g.gestorId === uid || g.membros.some(function (m) { return m.usuarioId === uid; }); }).map(function (g) { return g.id; });
  }
  function noRecorte(c, recorte, u) {
    if (!noEscopo(u, c)) return false;
    if (recorte === 'meus') return !!u && c.respId === u.id;
    if (recorte === 'grupo') return !!u && gruposDe(u.id).indexOf(c.grupoId) >= 0;
    return true;
  }
  function passa(inc) {
    var c = AT.ch[inc.id];
    if (!c) return true;
    var u = vendo();
    if (!noRecorte(c, AT.recorte, u)) return false;
    if (AT.fGrupo && c.grupoId !== AT.fGrupo) return false;
    if (AT.fTrib && c.tributo !== AT.fTrib) return false;
    if (AT.soFila && c.respId) return false;
    if (AT.soSemRegra && !c.semRegra) return false;
    return true;
  }
  function barra() {
    var f = el('inc-kb-filters');
    if (!f || !f.parentNode) return;
    var b = el('at-kb-barra');
    if (!b) { b = document.createElement('div'); b.id = 'at-kb-barra'; b.className = 'at-barra'; f.parentNode.insertBefore(b, f); }
    var u = vendo(), lst = window._inconsistenciasGlobal || [];
    function n(rec) { return lst.filter(function (i) { var c = AT.ch[i.id]; return c && noRecorte(c, rec, u); }).length; }
    var segs = [['meus', 'Meus'], ['grupo', 'Do meu grupo'], ['todos', 'Todos']].map(function (r) {
      return '<button type="button" class="' + (AT.recorte === r[0] ? 'on' : '') + '" aria-pressed="' + (AT.recorte === r[0]) + '" onclick="shAt.recorte(\'' + r[0] + '\')">' + r[1] + ' · ' + n(r[0]) + '</button>';
    }).join('');
    var gopts = '<option value="">Grupo: todos</option>' + AT.grupos.map(function (g) {
      return '<option value="' + g.id + '"' + (AT.fGrupo === g.id ? ' selected' : '') + '>' + esc(g.nome) + (g.id === AT.padraoId ? ' (padrão)' : '') + '</option>';
    }).join('');
    var topts = [['', 'Tributo: todos'], ['CBS', 'CBS · Receita Federal'], ['IBS', 'IBS · Comitê Gestor'], ['—', 'Sem tributo (família A)']].map(function (o) {
      return '<option value="' + o[0] + '"' + (AT.fTrib === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('');
    var vopts = usuarios().filter(ativo).map(function (x) {
      return '<option value="' + x.id + '"' + (u && u.id === x.id ? ' selected' : '') + '>' + esc(x.nome) + ' · ' + PERFIL_ROT[x.perfil] + '</option>';
    }).join('');
    b.innerHTML = '<div class="at-barra-l">'
      + '<div class="at-seg" role="group" aria-label="Recorte do kanban">' + segs + '</div>'
      + '<select class="at-sel" aria-label="Filtrar por grupo" onchange="shAt.filtro(\'fGrupo\',this.value)">' + gopts + '</select>'
      + '<select class="at-sel" aria-label="Filtrar por tributo" onchange="shAt.filtro(\'fTrib\',this.value)">' + topts + '</select>'
      + '<label class="at-ck"><input type="checkbox"' + (AT.soFila ? ' checked' : '') + ' onchange="shAt.filtro(\'soFila\',this.checked)"> Na fila do grupo</label>'
      + '<label class="at-ck"><input type="checkbox"' + (AT.soSemRegra ? ' checked' : '') + ' onchange="shAt.filtro(\'soSemRegra\',this.checked)"> Sem regra</label>'
      + '</div><div class="at-barra-r"><label class="at-vercomo">Ver como <select class="at-sel" onchange="shAt.verComo(this.value)">' + vopts + '</select></label>'
      + '<span class="at-proto" title="No produto, é quem está logado">só no protótipo</span></div>';
  }
  function decorar() {
    var board = el('inc-kanban-board');
    if (!board) return;
    board.querySelectorAll('span').forEach(function (s) { if (s.textContent === 'Ag. Emitente') s.textContent = 'Ag. Terceiro'; });
    board.querySelectorAll('.kb-card').forEach(function (card) {
      var m = /kbAbrirCard\('([^']+)'\)/.exec(card.getAttribute('onclick') || '');
      var c = m && AT.ch[m[1]];
      if (!c) return;
      var g = grupo(c.grupoId), u = pessoa(c.respId);
      card.classList.toggle('at-fila', !c.respId);
      var ter = estado(c.id) === 'aguardando_emitente' && c.terceiro
        ? '<div class="at-card-ter">' + esc(c.terceiro.nome) + ' · desde ' + dm(c.terceiro.desde) + '</div>' : '';
      card.insertAdjacentHTML('beforeend', ter + '<div class="at-card-row">'
        + '<span class="at-chip fam" title="' + esc(famLabel(c.familia)) + '">' + letra(c.familia) + '</span>'
        + (c.tributo !== '—' ? '<span class="at-chip ' + c.tributo.toLowerCase() + '">' + c.tributo + '</span>' : '')
        + '<span class="at-card-grp">' + esc(g ? g.nome : '—') + '</span>'
        + (c.semRegra && !c.transferido ? '<span class="at-chip amb">sem regra</span>' : '')
        + (u ? av(u, 'sm') : '<span class="at-nafila">na fila</span>')
        + '</div>');
    });
  }

  /* ── Card do chamado ─────────────────────────────────────────────────────── */
  function podeGerir(u, c) { var g = grupo(c.grupoId); return !!u && ativo(u) && (u.perfil === 'administrador' || (g && g.gestorId === u.id)); }
  function acoesCard(c) {
    var u = vendo(), st = estado(c.id), b = [], nota = '';
    function bt(rot, fn, cls) { b.push('<button type="button" class="btn at-btn' + (cls ? ' ' + cls : '') + '" onclick="shAt.' + fn + '(\'' + c.id + '\')">' + rot + '</button>'); }
    if (!u || u.perfil === 'leitura') return '<div class="at-nota">Perfil Leitura consulta e exporta; não age sobre o chamado.</div>';
    if (st === 'resolvida' || st === 'glosada') return '<div class="at-nota">' + (st === 'glosada' ? 'Chamado glosado não reabre: a reversão vive no contencioso, no módulo de Crédito.' : 'Chamado resolvido. Só o produto o reabre, quando a mesma causa volta no mesmo documento e tributo.') + '</div>';
    var eleg = membroElegivel(u, c);
    if (eleg && (st === 'aberta' || !c.respId) && c.respId !== u.id) bt(c.respId ? 'Assumir' : 'Pegar da fila', 'assumir', 'btn-t');
    else if (eleg && st === 'aberta' && c.respId === u.id) bt('Assumir', 'assumir', 'btn-t');
    if (podeGerir(u, c)) bt('Reatribuir no grupo', 'reatribuir');
    if (c.respId === u.id || podeGerir(u, c)) bt('Transferir de grupo', 'transferir');
    if (c.respId === u.id && (st === 'aberta' || st === 'em_analise')) bt('Devolver à fila', 'devolver');
    if (!b.length) {
      var g = grupo(c.grupoId);
      nota = 'Você vê este chamado, mas não age sobre ele: ' + (eleg ? 'ele já está com o responsável.' : 'não é membro elegível do grupo ' + esc(g ? g.nome : '') + ', nem gestor do grupo ou administrador.') + ' Troque em “Ver como”, no kanban, para testar outro perfil.';
    }
    return (b.length ? '<div class="at-acoes">' + b.join('') + '</div>' : '') + (nota ? '<div class="at-nota">' + nota + '</div>' : '');
  }
  function blocoCard(c) {
    var g = grupo(c.grupoId), u = pessoa(c.respId), st = estado(c.id);
    function kv(k, v) { return '<div class="at-kv"><span>' + k + '</span><b>' + v + '</b></div>'; }
    var extra = '';
    if (c.terceiro && st === 'aguardando_emitente') extra += kv('Terceiro', esc(c.terceiro.nome) + ' · desde ' + dm(c.terceiro.desde)) + kv('O que se espera', esc(c.terceiro.esperado));
    if (c.resposta) extra += kv('Resposta do terceiro', esc(c.resposta));
    if (c.desfecho && (st === 'resolvida')) extra += kv('Desfecho', esc(c.desfecho)) + kv('Efeito revertido', esc(c.efeito));
    if (c.ficha && st === 'glosada') extra += kv('Ficha de glosa', esc(c.ficha));
    return '<div class="at-sec-t">Atendimento</div>'
      + kv('Grupo', esc(g ? g.nome : '—') + (c.semRegra && !c.transferido ? ' <span class="at-chip amb">sem regra</span>' : ''))
      + kv('Responsável', u ? av(u, 'sm') + ' ' + esc(u.nome) : '<span class="at-nafila">Na fila do grupo</span>')
      + kv('Tributo · órgão', c.tributo === '—' ? 'Sem tributo — falha de documento' : c.tributo + ' · ' + orgao(c.tributo))
      + kv('Estabelecimento', esc(estabRot(c.cnpj)))
      + extra
      + '<div class="at-explic">' + esc(c.explic) + '</div>'
      + acoesCard(c);
  }
  function linhaHist(h) {
    var cls = h.tipo === 'ESTADO' ? 'est' : h.tipo === 'AVISO' ? 'av' : h.tipo === 'TRANSFERÊNCIA' ? 'tr' : '';
    var ic = h.tipo === 'ESTADO' ? '⇢' : h.tipo === 'AVISO' ? '!' : '→';
    var ORIG = { regra: 'regra', ativacao: 'ativação', sorteio: 'sorteio', manual: 'ação manual', transferencia: 'transferência', redistribuicao: 'redistribuição', devolucao: 'devolução', reabertura: 'reabertura', pessoa: 'pessoa', produto: 'produto' };
    return '<div class="at-h"><div class="at-h-dot ' + cls + '">' + ic + '</div><div class="at-h-b">'
      + '<div class="at-h-top"><span class="at-h-chip ' + cls + '">' + h.tipo + '</span><span class="at-h-data">' + fmtDH(h.em) + '</span></div>'
      + '<div class="at-h-txt">' + esc(h.txt) + '</div>'
      + '<div class="at-h-por">Inconsistências · ' + esc(h.autor) + ' · origem: ' + (ORIG[h.origem] || h.origem) + '</div></div></div>';
  }
  function injetarCard(incId) {
    var modal = el('kb-card-modal');
    if (!modal || modal.style.display === 'none') return;
    var c = AT.ch[incId];
    if (!c) { garantir(); c = AT.ch[incId]; }
    if (!c) return;
    modal.querySelectorAll('option').forEach(function (o) { if (o.textContent === 'Ag. Emitente') o.textContent = 'Ag. Terceiro'; });
    modal.querySelectorAll('span').forEach(function (s) { if (s.textContent === 'AG. EMITENTE') s.textContent = 'AG. TERCEIRO'; });
    var box = el('at-cardbox');
    var sel = modal.querySelector('select[onchange*="_kbMudarResponsavel"]');
    if (sel && !box) {
      var linhaAv = sel.previousElementSibling, titulo = linhaAv && linhaAv.previousElementSibling;
      box = document.createElement('div');
      box.id = 'at-cardbox';
      box.className = 'at-cardbox';
      sel.parentNode.insertBefore(box, sel);
      sel.remove();
      if (linhaAv) linhaAv.remove();
      if (titulo && /Respons/.test(titulo.textContent)) titulo.remove();
    }
    if (box) box.innerHTML = blocoCard(c);
    var tl = el('kb-timeline-' + incId);
    if (tl && !tl.querySelector('.at-h')) {
      tl.insertAdjacentHTML('afterbegin', c.hist.map(linhaHist).join(''));
      var cnt = el('kb-timeline-count-' + incId);
      if (cnt) {
        var n = parseInt(cnt.getAttribute('data-count') || '0', 10) + c.hist.length;
        cnt.textContent = 'Histórico do Ciclo · ' + plural(n, 'evento', 'eventos');
      }
    }
  }

  /* ── Pedidos (modal) ─────────────────────────────────────────────────────── */
  function modal(titulo, sub, corpo, botao, larg) {
    fechar('at-modal');
    document.body.insertAdjacentHTML('beforeend', '<div id="at-modal" class="moverlay at-ov" onclick="if(event.target===this)shAt.cancelar()">'
      + '<div class="mbox at-mbox" style="--at-w:' + (larg || 520) + 'px" role="dialog" aria-modal="true" aria-labelledby="at-modal-t">'
      + '<div class="mbox-hdr"><div class="at-min0"><div class="mbox-title" id="at-modal-t">' + titulo + '</div><div class="mbox-sub">' + sub + '</div></div>'
      + '<button type="button" class="mbox-close" aria-label="Fechar" onclick="shAt.cancelar()">✕</button></div>'
      + '<div class="mbox-col at-col">' + corpo + '</div>'
      + '<div class="at-rodape"><span id="at-falta" class="at-falta" role="status" aria-live="polite"></span>'
      + '<button type="button" class="btn" onclick="shAt.cancelar()">' + (botao ? 'Cancelar' : 'Fechar') + '</button>'
      + (botao ? '<button type="button" class="btn btn-t" id="at-ok" onclick="shAt.confirmar()">' + esc(botao) + '</button>' : '')
      + '</div></div></div>');
    var f = document.querySelector('#at-modal .at-in');
    if (f) setTimeout(function () { try { f.focus(); } catch (e) {} }, 30);
  }
  function campo(id, rot, tipo, ph, valor, extra) {
    var ctl = tipo === 'textarea'
      ? '<textarea id="' + id + '" class="at-in" rows="3" placeholder="' + esc(ph || '') + '" oninput="shAt.validar()">' + esc(valor || '') + '</textarea>'
      : '<input id="' + id + '" class="at-in" type="' + (tipo || 'text') + '" placeholder="' + esc(ph || '') + '" value="' + esc(valor || '') + '" oninput="shAt.validar()">';
    return '<div class="at-campo"><label for="' + id + '">' + rot + '</label>' + ctl + (extra || '') + '</div>';
  }
  function val(id) { var e = el(id); return e ? String(e.value || '').trim() : ''; }
  function ctxChamado(c) {
    var inc = incPorId(c.id) || {}, g = grupo(c.grupoId), u = pessoa(c.respId);
    return '<div class="at-ctx"><b>' + esc(c.id) + '</b> · ' + esc(inc.tipoLabel || tipoLabel(c.tipo)) + (c.tributo !== '—' ? ' · ' + c.tributo + ' · ' + orgao(c.tributo) : '')
      + '<br>' + esc(inc.dfNum || '') + ' · ' + esc(g ? g.nome : '—') + ' · ' + (u ? esc(u.nome) : 'na fila do grupo') + '</div>';
  }
  function bloqueio(c, titulo, msg, ir) {
    AT.p = { incId: c.id, ir: ir || null };
    modal(titulo, esc(c.id) + ' · ' + ROT[estado(c.id)], ctxChamado(c) + '<div class="at-caixa amb">' + esc(msg) + '</div>', ir ? ROTULO_IR[ir] : null, 480);
  }
  var ROTULO_IR = { assumir: 'Assumir agora', retomar: 'Registrar a resposta' };

  function passagem(de, para) {
    if (de === para) return null;
    if (de === 'glosada') return { nao: 'Chamado glosado não reabre: a reversão vive no contencioso, no módulo de Crédito.' };
    if (de === 'resolvida') return { nao: 'Chamado resolvido é final. Só o produto o reabre, quando a mesma causa volta no mesmo documento e tributo.' };
    if (para === 'em_analise') return de === 'aberta' ? { k: 'assumir' } : { k: 'retomar' };
    if (para === 'aguardando_emitente') return { k: 'aguardar' };
    if (para === 'resolvida') return de === 'em_analise' ? { k: 'resolver' }
      : de === 'aberta' ? { nao: 'Resolver exige o chamado em análise, com responsável: assuma primeiro.', ir: 'assumir' }
      : { nao: 'Registre antes a resposta do terceiro: o chamado volta a Em análise e, de lá, é resolvido.', ir: 'retomar' };
    if (para === 'glosada') return de === 'aberta' ? { nao: 'Glosar exige o chamado em análise ou aguardando terceiro: assuma primeiro.', ir: 'assumir' } : { k: 'glosar' };
    if (para === 'aberta') return de === 'em_analise' ? { k: 'devolver' } : { nao: 'Para devolver o chamado à fila, registre antes a resposta do terceiro.', ir: 'retomar' };
    return { nao: 'Passagem que a máquina de estados não tem.' };
  }
  var TITULO = { assumir: 'Assumir', aguardar: 'Aguardar o terceiro', retomar: 'Retomar', resolver: 'Resolver', glosar: 'Glosar', devolver: 'Devolver à fila' };

  function pedir(incId, para, via) {
    garantir();
    var c = AT.ch[incId];
    if (!c) return false;
    var de = estado(incId), p = passagem(de, para), u = vendo();
    if (!p) return false;
    var tit = (p.k ? TITULO[p.k] : 'Mover') + ' ' + esc(incId);
    if (!u || u.perfil === 'leitura') { bloqueio(c, tit, 'Perfil Leitura consulta e exporta; não muda o estado do chamado.'); return true; }
    if (p.nao) {
      var podeIr = p.ir === 'assumir' ? membroElegivel(u, c) : p.ir === 'retomar' ? c.respId === u.id : false;
      bloqueio(c, 'Não dá para mover ' + esc(incId) + ' para ' + ROT[para], p.nao, podeIr ? p.ir : null);
      return true;
    }
    var eleg = membroElegivel(u, c), g = grupo(c.grupoId), resp = pessoa(c.respId);
    var assumeJunto = false;
    if (p.k === 'assumir') {
      if (!eleg) { bloqueio(c, tit, 'Só membro elegível do grupo ' + (g ? g.nome : '') + ' assume este chamado' + (motivoFora(u, c) ? ': ' + motivoFora(u, c) : g && !g.membros.some(function (m) { return m.usuarioId === u.id; }) ? ': você não é membro do grupo' : '') + '.'); return true; }
    } else if (p.k === 'glosar') {
      if (c.respId !== u.id) { bloqueio(c, tit, resp ? 'Só o responsável, ' + resp.nome + ', glosa este chamado.' : 'O chamado está na fila do grupo: assuma primeiro.', !resp && eleg ? 'assumir' : null); return true; }
      if (['administrador', 'fiscal'].indexOf(u.perfil) < 0) { bloqueio(c, tit, 'Glosar exige perfil Administrador ou Fiscal.'); return true; }
    } else if (c.respId !== u.id) {
      if (!c.respId && p.k === 'aguardar' && eleg) assumeJunto = true;
      else { bloqueio(c, tit, resp ? 'Só o responsável, ' + resp.nome + ', faz esta passagem.' : 'O chamado está na fila do grupo: assuma primeiro.', !resp && eleg ? 'assumir' : null); return true; }
    }
    AT.p = { incId: incId, k: p.k, de: de, para: para, via: via || '', assumeJunto: assumeJunto };
    var sub = ROT[de] + ' → ' + ROT[para] + (via ? ' · ' + esc(via) : '');
    var corpo = ctxChamado(c), botao = TITULO[p.k], larg = 520;
    if (p.k === 'assumir') {
      corpo += '<p class="at-p">' + (resp && resp.id === u.id
        ? 'O sorteio já pôs o chamado com você. Assumir o leva a Em análise: daqui o prazo corre contra uma pessoa, não contra a fila.'
        : 'Você passa a ser o responsável e o chamado vai para Em análise.' + (resp ? ' Hoje ele está com ' + esc(resp.nome) + ', pelo sorteio; passa para você.' : ''))
        + '</p>';
    } else if (p.k === 'aguardar') {
      var ops = [['emitente', 'Emitente'], ['fornecedor', 'Fornecedor'], ['destinatario', 'Destinatário'], ['sistema_cliente', 'Sistema do cliente (ERP)'], ['sefaz', 'SEFAZ autorizadora']];
      if (c.tributo !== 'IBS') ops.push(['receita_federal', 'Receita Federal — CBS']);
      if (c.tributo !== 'CBS') ops.push(['comite_gestor', 'Comitê Gestor — IBS']);
      corpo += '<div class="at-campo"><label for="at-f-ter">Quem é o terceiro</label><select id="at-f-ter" class="at-in" onchange="shAt.validar()"><option value="">Escolha…</option>'
        + ops.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select></div>'
        + campo('at-f-esp', 'O que se espera dele', 'textarea', 'Por exemplo: a carta de correção com a alíquota certa, ou o reflexo do evento na apuração')
        + '<p class="at-nota">O prazo interno pausa e o retorno do terceiro passa a ser medido no lote 2, com o SLA.'
        + (assumeJunto ? ' O chamado está na fila do grupo: você passa a ser o responsável, como em assumir.' : '') + '</p>';
    } else if (p.k === 'retomar') {
      corpo += (c.terceiro ? '<div class="at-ctx">Aguardando <b>' + esc(c.terceiro.nome) + '</b> desde ' + dm(c.terceiro.desde) + '<br>Esperado: ' + esc(c.terceiro.esperado) + '</div>' : '')
        + campo('at-f-resp', 'Resposta do terceiro', 'textarea', 'O que o terceiro respondeu ou fez');
    } else if (p.k === 'resolver') {
      corpo += campo('at-f-desf', 'Desfecho', 'textarea', 'O que eliminou a causa')
        + campo('at-f-efeito', 'Efeito revertido', 'textarea', 'Como o crédito ou o débito ficou depois — por exemplo, partição refeita com a leitura de 10/11');
    } else if (p.k === 'glosar') {
      var inc = incPorId(incId) || {};
      var fichas = ((window.shGlosa && window.shGlosa.fichas) || []).filter(function (f) { return (inc.rfId && f.rfId === inc.rfId) || (inc.nfNumero && String(f.dfNumero) === String(inc.nfNumero)); });
      corpo += '<label class="at-ck at-campo"><input type="checkbox" id="at-f-def" onchange="shAt.validar()"> A decisão ' + (c.tributo === '—' ? 'do órgão' : c.tributo === 'CBS' ? 'da Receita Federal' : 'do Comitê Gestor') + ' é definitiva</label>'
        + (fichas.length
          ? '<div class="at-campo"><label for="at-f-ficha">Ficha de glosa vinculada</label><select id="at-f-ficha" class="at-in" onchange="shAt.validar()"><option value="">Escolha…</option>'
            + fichas.map(function (f) { return '<option value="' + esc(f.id) + '">' + esc(f.id) + ' · R$ ' + Number(f.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + '</option>'; }).join('') + '</select></div>'
          : campo('at-f-ficha', 'Ficha de glosa vinculada', 'text', 'GL-2026-0001', '', '<div class="at-nota">Nenhuma ficha deste documento no módulo de Crédito. Informe o número da ficha registrada lá.</div>'))
        + '<p class="at-nota">O valor sai do fluxo de apropriação pela ficha, não pelo chamado.</p>';
    } else if (p.k === 'devolver') {
      corpo += '<p class="at-p">O chamado sai do seu nome e volta à fila do grupo ' + esc(g ? g.nome : '') + ', sem responsável, em Aberta.</p>';
    }
    modal(tit, sub, corpo, botao, larg);
    validar();
    return true;
  }
  function faltas() {
    var p = AT.p, f = [];
    if (!p || !p.k) return f;
    if (p.k === 'aguardar') { if (!val('at-f-ter')) f.push('quem é o terceiro'); if (!val('at-f-esp')) f.push('o que se espera'); }
    if (p.k === 'retomar' && !val('at-f-resp')) f.push('a resposta do terceiro');
    if (p.k === 'resolver') { if (!val('at-f-desf')) f.push('desfecho'); if (!val('at-f-efeito')) f.push('efeito revertido'); }
    if (p.k === 'glosar') {
      if (!(el('at-f-def') || {}).checked) f.push('decisão definitiva');
      var fi = val('at-f-ficha');
      if (!fi) f.push('ficha de glosa'); else if (!/^GL-\d{4}-\d{4}$/i.test(fi)) f.push('número da ficha no formato GL-AAAA-NNNN');
    }
    return f;
  }
  function validar() {
    var f = faltas(), st = el('at-falta'), ok = el('at-ok');
    if (st) { st.textContent = f.length ? 'Falta: ' + lista(f) + '.' : (AT.p && AT.p.k ? 'Pode ' + TITULO[AT.p.k].toLowerCase() + '.' : ''); st.className = 'at-falta' + (f.length ? '' : ' ok'); }
    if (ok) ok.disabled = f.length > 0;
  }
  function confirmar() {
    var p = AT.p;
    if (!p) return fechar('at-modal');
    var c = AT.ch[p.incId];
    if (!c) return fechar('at-modal');
    // assumir (de aberta) e retomar (de aguardando) são as duas passagens a em análise
    if (p.ir) { fechar('at-modal'); AT.p = null; return pedir(c.id, 'em_analise'); }
    if (faltas().length) return validar();
    var u = vendo(), via = p.via ? ' · via ' + p.via : '';
    if (p.k === 'assumir') {
      var ant = pessoa(c.respId);
      if (c.respId !== u.id) atribuir(c, u.id, 'manual', (ant ? 'Assumido por ' + u.nome + ' · antes: ' + ant.nome : 'Pego da fila do grupo por ' + u.nome));
      aplicarEstado(c, 'em_analise', 'responsável: ' + u.nome + via);
    } else if (p.k === 'aguardar') {
      var sel = el('at-f-ter'), nome = sel.options[sel.selectedIndex].text.replace(/ — (CBS|IBS)$/, '');
      var inc = incPorId(c.id) || {};
      if (['emitente', 'fornecedor', 'destinatario'].indexOf(sel.value) >= 0 && inc.entidade) nome += ' — ' + inc.entidade;
      if (p.assumeJunto) atribuir(c, u.id, 'manual', 'Pego da fila do grupo por ' + u.nome + ' ao aguardar o terceiro');
      c.terceiro = { tipo: sel.value, nome: nome, esperado: val('at-f-esp'), desde: new Date(), origem: 'pessoa' };
      aplicarEstado(c, 'aguardando_emitente', 'terceiro: ' + nome + ' · esperado: ' + c.terceiro.esperado + via);
    } else if (p.k === 'retomar') {
      c.resposta = val('at-f-resp');
      aplicarEstado(c, 'em_analise', 'resposta de ' + (c.terceiro ? c.terceiro.nome : 'terceiro') + ': ' + c.resposta + via);
    } else if (p.k === 'resolver') {
      c.desfecho = val('at-f-desf'); c.efeito = val('at-f-efeito');
      aplicarEstado(c, 'resolvida', 'desfecho: ' + c.desfecho + ' · efeito revertido: ' + c.efeito + via);
    } else if (p.k === 'glosar') {
      c.ficha = val('at-f-ficha').toUpperCase();
      aplicarEstado(c, 'glosada', 'decisão definitiva ' + (c.tributo === 'CBS' ? 'da Receita Federal' : c.tributo === 'IBS' ? 'do Comitê Gestor' : 'do órgão') + ' · ficha ' + c.ficha + via);
    } else if (p.k === 'devolver') {
      devolverJa(c);
    }
    toast({
      assumir: c.id + ' assumido por ' + u.nome + ' — Em análise.',
      aguardar: c.id + ' aguardando ' + (c.terceiro ? c.terceiro.nome : 'o terceiro') + '.',
      retomar: c.id + ' de volta a Em análise, com a resposta registrada.',
      resolver: c.id + ' resolvido.',
      glosar: c.id + ' glosado com a ficha ' + c.ficha + '.',
      devolver: c.id + ' devolvido à fila do grupo.'
    }[p.k]);
    fechar('at-modal');
    AT.p = null;
    redesenhar(c.id);
  }
  function devolverJa(c) {
    var u = vendo();
    atribuir(c, null, 'devolucao', 'Devolvido à fila do grupo por ' + u.nome);
    if (estado(c.id) === 'em_analise') aplicarEstado(c, 'aberta', 'sem responsável, na fila do grupo');
  }
  function cancelar() {
    var p = AT.p;
    fechar('at-modal');
    AT.p = null;
    redesenhar(p && p.incId);
  }

  /* ── Ações de atribuição (seção 08) ──────────────────────────────────────── */
  function assumir(incId) {
    var c = AT.ch[incId], u = vendo();
    if (!c || !u) return;
    if (estado(incId) === 'aberta') {
      if (onExig()) return pedir(incId, 'em_analise');
      var ant = pessoa(c.respId);
      if (c.respId !== u.id) atribuir(c, u.id, 'manual', ant ? 'Assumido por ' + u.nome + ' · antes: ' + ant.nome : 'Pego da fila do grupo por ' + u.nome);
      aplicarEstado(c, 'em_analise', 'responsável: ' + u.nome);
    } else {
      atribuir(c, u.id, 'manual', 'Pego da fila do grupo por ' + u.nome);
    }
    toast(incId + ' agora está com ' + u.nome + '.');
    redesenhar(incId);
  }
  function reatribuir(incId) {
    var c = AT.ch[incId];
    if (!c) return;
    var g = grupo(c.grupoId), e = elegiveis(g, c), outros = e.ok.filter(function (u) { return u.id !== c.respId; });
    AT.p = { incId: incId, k: 'reatribuir' };
    var corpo = ctxChamado(c) + (outros.length
      ? '<div class="at-campo"><label for="at-f-para">Para quem, no grupo ' + esc(g.nome) + '</label><select id="at-f-para" class="at-in">'
        + outros.map(function (u) { return '<option value="' + u.id + '">' + esc(u.nome) + ' · ' + nAbertos(carga(u.id)) + '</option>'; }).join('') + '</select></div>'
        + '<p class="at-nota">Só aparece quem é elegível: membro disponível do grupo, que opera a família e enxerga o CNPJ ' + esc(c.cnpj || '') + '.' + textoFora(e) + '</p>'
      : '<div class="at-caixa amb">Ninguém mais no grupo é elegível para este chamado.' + esc(textoFora(e)) + '</div>');
    modal('Reatribuir ' + esc(incId), 'No mesmo grupo · gestor do grupo ou administrador', corpo, outros.length ? 'Reatribuir' : null);
    var ok = el('at-ok');
    if (ok) ok.onclick = function () {
      var para = pessoa(val('at-f-para')), ant = pessoa(c.respId);
      atribuir(c, para.id, 'manual', 'Reatribuído no grupo por ' + vendo().nome + ': ' + (ant ? ant.nome : 'fila do grupo') + ' → ' + para.nome);
      fechar('at-modal'); AT.p = null;
      toast(incId + ' reatribuído para ' + para.nome + '.');
      redesenhar(incId);
    };
  }
  function transferir(incId) {
    var c = AT.ch[incId];
    if (!c) return;
    var g = grupo(c.grupoId);
    var dest = AT.grupos.filter(function (x) { return x.ativo && x.id !== c.grupoId; });
    AT.p = { incId: incId, k: 'transferir' };
    var corpo = ctxChamado(c)
      + '<div class="at-campo"><label for="at-f-gr">Grupo de destino</label><select id="at-f-gr" class="at-in" onchange="shAt.validarTransf()"><option value="">Escolha…</option>'
      + dest.map(function (x) { var e = elegiveis(x, c); return '<option value="' + x.id + '">' + esc(x.nome) + ' · ' + (e.ok.length ? plural(e.ok.length, 'elegível', 'elegíveis') + ' para este chamado' : 'ninguém elegível — fica na fila') + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="at-campo"><label for="at-f-mot">Motivo</label><textarea id="at-f-mot" class="at-in" rows="3" placeholder="Por que o chamado sai de ' + esc(g ? g.nome : '') + '" oninput="shAt.validarTransf()"></textarea></div>'
      + '<p class="at-nota">O responsável no destino sai do sorteio entre os elegíveis de menor carga. O estado continua o mesmo; se ninguém for elegível, o chamado espera na fila do destino. O prazo é do chamado: transferir não reinicia o SLA (D-12).</p>';
    modal('Transferir ' + esc(incId), 'De ' + esc(g ? g.nome : '—') + ' · sempre com motivo (D-06)', corpo, 'Transferir');
    validarTransf();
    el('at-ok').onclick = function () {
      if (!val('at-f-gr') || !val('at-f-mot')) return validarTransf();
      var para = grupo(val('at-f-gr')), ant = pessoa(c.respId), de = g;
      c.grupoId = para.id;
      c.transferido = true;
      c.respId = null;   // o próprio chamado não conta na carga de quem o tinha
      var s = sortear(c, para);
      c.respId = s.uid;
      if (!s.uid && estado(c.id) === 'em_analise') aplicarEstado(c, 'aberta', 'sem elegível no destino, na fila do grupo', 'transferencia');
      hist(c, 'TRANSFERÊNCIA', 'transferencia', (de ? de.nome : '—') + ' → ' + para.nome + ' por ' + vendo().nome + ' · motivo: ' + val('at-f-mot') + (ant ? ' · antes: ' + ant.nome : '') + ' · ' + curtoSorteio(s), vendo().nome);
      c.explic = 'Transferido de ' + (de ? de.nome : '—') + ' para ' + para.nome + '. ' + textoSorteio(s, para) + textoFora(s.e);
      fechar('at-modal'); AT.p = null;
      toast(incId + ' transferido para ' + para.nome + (s.uid ? ' · com ' + pessoa(s.uid).nome : ' · na fila do grupo') + '.');
      redesenhar(incId);
    };
  }
  function validarTransf() {
    var f = [];
    if (!val('at-f-gr')) f.push('grupo de destino');
    if (!val('at-f-mot')) f.push('motivo');
    var st = el('at-falta'), ok = el('at-ok');
    if (st) { st.textContent = f.length ? 'Falta: ' + lista(f) + '.' : 'Pode transferir.'; st.className = 'at-falta' + (f.length ? '' : ' ok'); }
    if (ok) ok.disabled = f.length > 0;
  }
  function devolver(incId) {
    var c = AT.ch[incId];
    if (!c) return;
    if (onExig() && estado(incId) === 'em_analise') return pedir(incId, 'aberta');
    AT.p = { incId: incId, k: 'devolver' };
    var g = grupo(c.grupoId);
    modal('Devolver ' + esc(incId) + ' à fila', esc(g ? g.nome : ''), ctxChamado(c) + '<p class="at-p">O chamado sai do seu nome e volta à fila do grupo, sem responsável.</p>', 'Devolver à fila');
  }

  /* ── Ganchos no kanban e no card ─────────────────────────────────────────── */
  function ganchosKanban() {
    var rk = window.renderizarKanbanInconsistencias;
    if (typeof rk === 'function' && !rk._at) {
      window.renderizarKanbanInconsistencias = function () {
        if (!on() || !garantir()) return rk.apply(this, arguments);
        var todos = window._inconsistenciasGlobal || [];
        window._inconsistenciasGlobal = todos.filter(passa);
        try { rk.apply(this, arguments); } finally { window._inconsistenciasGlobal = todos; }
        barra();
        decorar();
      };
      window.renderizarKanbanInconsistencias._at = true;
    }
    var drop = window._kbDrop;
    if (typeof drop === 'function' && !drop._at) {
      window._kbDrop = function (e, colId) {
        if (!onExig()) return drop.apply(this, arguments);
        e.preventDefault();
        pedir(e.dataTransfer.getData('text/plain'), colId);
        try { window.renderizarKanbanInconsistencias(); } catch (x) {}
      };
      window._kbDrop._at = true;
    }
    var mover = window._kbMoverColuna;
    if (typeof mover === 'function' && !mover._at) {
      window._kbMoverColuna = function (incId, colId) {
        if (!onExig()) return mover.apply(this, arguments);
        if (!pedir(incId, colId)) redesenhar(incId);
      };
      window._kbMoverColuna._at = true;
    }
    var exec = window._kbExecutarAcao;
    if (typeof exec === 'function' && !exec._at) {
      window._kbExecutarAcao = function (incId, i) {
        var m = el('kb-card-modal'), a = m && m._acoes && m._acoes[i];
        if (!onExig() || !a) return exec.apply(this, arguments);
        var para = a.nextStatus || 'em_analise';
        if (para === estado(incId)) { toast('Ação registrada: ' + a.label + '.'); return; }
        pedir(incId, para, 'ação sugerida “' + a.label + '”');
      };
      window._kbExecutarAcao._at = true;
    }
    var kb = window.kbAbrirCard;
    if (typeof kb === 'function' && !kb._at) {
      window.kbAbrirCard = function (id) {
        var r = kb.apply(this, arguments);
        if (on()) try { injetarCard(id); } catch (e) { console.error('[atendimento] card', e); }
        return r;
      };
      window.kbAbrirCard._at = true;
      ['_evf', '_evl'].forEach(function (k) { if (kb[k]) window.kbAbrirCard[k] = true; });
    }
  }

  /* ── Configurações › Atendimento ─────────────────────────────────────────── */
  function k(lbl, v, sub, cls) {
    return '<div class="kcard"><div class="klbl">' + lbl + '</div><div class="kval' + (cls ? ' ' + cls : '') + '">' + v + '</div><div class="ksub">' + sub + '</div></div>';
  }
  function naoCobertos() {
    return familias().map(function (f) {
      var tipos = tiposDaFamilia(f).filter(function (t) { return !rotear(f, t, 'NF-e').regra; });
      return { f: f, tipos: tipos, toda: tipos.length && tipos.length === tiposDaFamilia(f).length };
    }).filter(function (x) { return x.tipos.length; });
  }
  function menuAviso() {
    var b = el('at-menu-badge');
    if (!b) return;
    var n = naoCobertos().reduce(function (a, x) { return a + x.tipos.length; }, 0);
    b.hidden = !n;
    b.textContent = n;
    b.title = n ? plural(n, 'tipo do catálogo', 'tipos do catálogo') + ' sem regra de roteamento' : '';
  }
  function abertosDo(gid, semResp) {
    return chamados().filter(function (c) { return c.grupoId === gid && aberto(c.id) && (!semResp || !c.respId); }).length;
  }
  function elegAgora(g) { return g.membros.filter(function (m) { return podeSerMembro(pessoa(m.usuarioId)) && !ausente(m); }).length; }

  function render() {
    var root = el('at-root');
    if (!root || !on()) return;
    if (!garantir()) { root.innerHTML = '<div class="crd">Carregando…</div>'; return; }
    var ch = chamados(), ab = ch.filter(function (c) { return aberto(c.id); });
    var semResp = ab.filter(function (c) { return !c.respId; });
    var semRegra = ab.filter(function (c) { return c.semRegra && !c.transferido; });
    var gAtivos = AT.grupos.filter(function (g) { return g.ativo; });
    var pad0 = grupo(AT.padraoId);
    var gruposFila = {};
    semResp.forEach(function (c) { gruposFila[c.grupoId] = 1; });
    var abas = [['grupos', 'Grupos'], ['regras', 'Regras de roteamento'], ['semregra', 'Chamados sem regra'], ['matriz', 'Matriz de cobertura']];
    var corpo = AT.aba === 'regras' ? abaRegras() : AT.aba === 'semregra' ? abaSemRegra() : AT.aba === 'matriz' ? abaMatriz() : abaGrupos();
    root.innerHTML = '<div class="kgrid k4">'
      + k('Grupos ativos', gAtivos.length, 'padrão: ' + esc(pad0 ? pad0.nome : '—'))
      + k('Regras de roteamento', AT.regras.filter(function (r) { return r.ativa; }).length, plural(AT.regras.length, 'regra', 'regras') + ' na lista')
      + k('Abertos sem responsável', semResp.length, semResp.length ? 'na fila de ' + plural(Object.keys(gruposFila).length, 'grupo', 'grupos') : 'todos com alguém', semResp.length ? 'at-kv-amb' : '')
      + k('Abertos sem regra', semRegra.length, 'no grupo padrão, ' + esc(pad0 ? pad0.nome : '—'), semRegra.length ? 'at-kv-amb' : '')
      + '</div>'
      + '<div class="crd"><div class="sechdr"><h2>Atendimento das inconsistências</h2>'
      + '<p>Para onde vai cada chamado e quem o recebe: o grupo vem da regra; o responsável, do sorteio entre os elegíveis de menor carga. Vale para os próximos chamados; os já criados ficam onde estão.</p></div>'
      + '<div class="at-tabs" role="tablist">' + abas.map(function (a) {
        return '<button type="button" role="tab" class="at-tab' + (AT.aba === a[0] ? ' on' : '') + '" aria-selected="' + (AT.aba === a[0]) + '" onclick="shAt.aba(\'' + a[0] + '\')">' + a[1] + '</button>';
      }).join('') + '</div>'
      + '<div id="at-aba">' + corpo + '</div></div>';
  }

  function abaGrupos() {
    var semEleg = AT.grupos.filter(function (g) { return g.ativo && !elegAgora(g); });
    var linhas = AT.grupos.map(function (g) {
      var gest = pessoa(g.gestorId), eAg = elegAgora(g), regs = AT.regras.filter(function (r) { return r.grupoId === g.id; });
      var sit = !g.ativo ? '<span class="at-sit off">Inativo</span>' : !eAg ? '<span class="at-sit amb">Sem elegíveis</span>' : '<span class="at-sit ok">Ativo</span>';
      return '<tr><td><div class="at-gnome">' + esc(g.nome) + (g.id === AT.padraoId ? ' <span class="at-chip">padrão</span>' : '') + '</div><div class="at-gdesc">' + esc(g.descricao || '') + '</div></td>'
        + '<td>' + (gest ? esc(gest.nome) : '—') + '</td>'
        + '<td><div class="at-avs">' + g.membros.map(function (m) { var u = pessoa(m.usuarioId); return av(u, ausente(m) ? 'aus' : ''); }).join('') + '</div></td>'
        + '<td class="r">' + eAg + ' de ' + g.membros.length + '</td>'
        + '<td>' + (regs.length ? regs.map(function (r) { return '<span class="at-chip' + (r.ativa ? '' : ' off') + '">' + r.id + '</span>'; }).join(' ') : (g.id === AT.padraoId ? '<span class="at-sub">quando nenhuma regra casa</span>' : '<span class="at-sub">nenhuma</span>')) + '</td>'
        + '<td class="r">' + abertosDo(g.id) + '</td>'
        + '<td class="r">' + abertosDo(g.id, true) + '</td>'
        + '<td>' + sit + '</td>'
        + '<td class="r"><button type="button" class="btn at-btn" onclick="shAt.editarGrupo(\'' + g.id + '\')">Editar</button></td></tr>';
    }).join('');
    var cargas = usuarios().filter(ativo).map(function (u) {
      var gs = gruposDe(u.id).map(function (id) { return grupo(id).nome; });
      return '<tr><td><div class="at-pessoa">' + av(u) + '<span>' + esc(u.nome) + '</span></div></td><td>' + PERFIL_ROT[u.perfil] + '</td><td>' + esc(escopoRot(u)) + '</td>'
        + '<td>' + (podeSerMembro(u) ? (gs.length ? esc(gs.join(' · ')) : '<span class="at-sub">em nenhum grupo</span>') : '<span class="at-sub">não pode ser membro: o perfil não age</span>') + '</td>'
        + '<td class="r">' + (podeSerMembro(u) ? carga(u.id) : '—') + '</td></tr>';
    }).join('');
    return '<div class="at-tool"><p>Os membros vêm da lista de usuários, com o perfil e o escopo de cada um. Administrador e Fiscal operam todas as famílias; Tesouraria só a família D; Leitura não entra em grupo.</p>'
      + '<button type="button" class="btn btn-t at-btn" onclick="shAt.editarGrupo(\'\')">+ Novo grupo</button></div>'
      + '<div class="twrap"><table><thead><tr><th>Grupo</th><th>Gestor</th><th>Membros</th><th class="r">Elegíveis agora</th><th>Regras</th><th class="r">Abertos</th><th class="r">Sem responsável</th><th>Situação</th><th></th></tr></thead><tbody>' + linhas + '</tbody></table></div>'
      + semEleg.map(function (g) {
        var aus = g.membros.filter(ausente).map(function (m) { return pessoa(m.usuarioId).nome + ' está ausente até ' + dm(m.ausenteAte); });
        var gest = pessoa(g.gestorId);
        return '<div class="at-caixa amb">' + esc(g.nome) + ' está sem ninguém elegível' + (aus.length ? ': ' + esc(lista(aus)) : '') + '. ' + plural(abertosDo(g.id, true), 'chamado aguarda', 'chamados aguardam') + ' na fila do grupo; o gestor' + (gest ? ', ' + esc(gest.nome) + ',' : '') + ' foi avisado. Quando alguém elegível volta ou entra, a fila é sorteada.</div>';
      }).join('')
      + '<h3 class="at-h3">Carga de cada pessoa</h3><p class="at-p">Chamados abertos com a pessoa — aberta, em análise e aguardando terceiro —, somados em todos os grupos. É o número que o sorteio compara (D-01).</p>'
      + '<div class="twrap"><table><thead><tr><th>Pessoa</th><th>Perfil</th><th>Escopo</th><th>Grupos</th><th class="r">Abertos com ela</th></tr></thead><tbody>' + cargas + '</tbody></table></div>';
  }

  function celFamTipo(r) {
    var a = r.familias.map(function (f) { return '<span class="at-chip fam">' + letra(f) + '</span> família inteira (' + tiposDaFamilia(f).length + ')'; })
      .concat(r.tipos.map(function (t) { return '<span class="at-chip fam">' + letra(K() ? K().familia(t) : '') + '</span> ' + esc(tipoLabel(t)); }));
    return a.length ? a.join('<br>') : '<span class="at-sub">qualquer</span>';
  }
  function abaRegras() {
    var cont = {};
    chamados().forEach(function (c) { if (c.regraId) cont[c.regraId] = (cont[c.regraId] || 0) + 1; });
    var pad0 = grupo(AT.padraoId);
    var linhas = AT.regras.map(function (r, i) {
      var g = grupo(r.grupoId);
      return '<tr class="' + (r.ativa ? '' : 'at-tr-off') + '"><td><b>' + r.id + '</b></td>'
        + '<td class="at-nowrap"><button type="button" class="at-ord" aria-label="Subir ' + r.id + '"' + (i ? '' : ' disabled') + ' onclick="shAt.moverRegra(\'' + r.id + '\',-1)">↑</button>'
        + '<button type="button" class="at-ord" aria-label="Descer ' + r.id + '"' + (i < AT.regras.length - 1 ? '' : ' disabled') + ' onclick="shAt.moverRegra(\'' + r.id + '\',1)">↓</button></td>'
        + '<td>' + celFamTipo(r) + '</td><td>' + (r.dfs.length ? esc(r.dfs.join(', ')) : '<span class="at-sub">qualquer</span>') + '</td>'
        + '<td>' + nCrit(r) + ' — ' + descCrit(r) + '</td><td>' + esc(g ? g.nome : '—') + (g && !g.ativo ? ' <span class="at-sub">grupo inativo</span>' : '') + '</td>'
        + '<td class="r">' + (cont[r.id] || 0) + '</td><td>' + (r.ativa ? '<span class="at-sit ok">Ativa</span>' : '<span class="at-sit off">Inativa</span>') + '</td>'
        + '<td class="r"><button type="button" class="btn at-btn" onclick="shAt.editarRegra(\'' + r.id + '\')">Editar</button></td></tr>';
    }).join('');
    var semR = chamados().filter(function (c) { return c.semRegra; }).length;
    linhas += '<tr class="at-tr-padrao"><td>—</td><td></td><td colspan="3">Nenhuma regra casou</td><td>' + esc(pad0 ? pad0.nome : '—') + '</td><td class="r">' + semR + '</td><td><span class="at-sit">Padrão</span></td><td></td></tr>';
    return '<div class="at-tool"><p>Ordem de avaliação: a regra mais específica vence — dois critérios ganham de um —; no empate, vence a que está antes na lista (D-03). Escolher a família inteira inclui os tipos que o catálogo ganhar depois.</p>'
      + '<button type="button" class="btn btn-t at-btn" onclick="shAt.editarRegra(\'\')">+ Nova regra</button></div>'
      + testeHtml()
      + '<div class="twrap"><table><thead><tr><th>#</th><th>Ordem</th><th>Família ou tipo</th><th>Tipo de DF</th><th>Critérios</th><th>Grupo</th><th class="r">Chamados</th><th>Situação</th><th></th></tr></thead><tbody>' + linhas + '</tbody></table></div>'
      + '<p class="at-nota">“Chamados” conta os que a regra roteou desde a ativação. Regra que nunca casa é candidata a sair. Tributo e órgão não são critério: entram como filtro no kanban (D-20).</p>';
  }
  function opcoesTipo(sel) {
    var k0 = K();
    if (!k0) return '';
    return k0.porFamilia().map(function (f) {
      return '<optgroup label="' + f.letra + ' · ' + esc(f.label) + '">' + tiposDaFamilia(f.chave).map(function (t) {
        return '<option value="' + t + '"' + (sel === t ? ' selected' : '') + '>' + esc(tipoLabel(t)) + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
  }
  function testeHtml() {
    var t = AT.tTipo || 'capur_ibs_divergente', d = AT.tDF || 'NFS-e';
    return '<div class="at-teste"><div class="at-lbl">Testar uma combinação</div><div class="at-teste-f">'
      + '<select class="at-sel" aria-label="Tipo de inconsistência" onchange="shAt.teste(\'tTipo\',this.value)">' + opcoesTipo(t) + '</select>'
      + '<select class="at-sel" aria-label="Tipo de DF" onchange="shAt.teste(\'tDF\',this.value)">' + DFS.map(function (x) { return '<option' + (x === d ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>'
      + '<div class="at-teste-res" id="at-teste-res">' + resultadoTeste(t, d) + '</div></div>';
  }
  function resultadoTeste(t, d) {
    var f = K() ? K().familia(t) : null, r = rotear(f, t, d), g = grupo(r.grupoId);
    var txt = r.casam.length
      ? 'Casa' + (r.casam.length > 1 ? 'm ' : ' ') + lista(r.casam.map(function (x) { return x.id + ' (' + descCrit(x) + ')'; })) + '. Vence <b>' + r.regra.id + '</b>, ' + porQueVenceu(r) + ' → <b>' + esc(g.nome) + '</b>.'
      : 'Nenhuma regra casa → <b>' + esc(g ? g.nome : '—') + '</b>, o grupo padrão, com a marca sem regra.';
    var hip = { familia: f, cnpj: null };
    var e = elegiveis(g, hip), cg = e.ok.map(function (u) { return { u: u, n: carga(u.id) }; });
    var min = cg.length ? Math.min.apply(null, cg.map(function (x) { return x.n; })) : 0;
    var menores = cg.filter(function (x) { return x.n === min; });
    return txt + '<br>' + (cg.length
      ? 'Elegíveis hoje: ' + esc(lista(cg.map(function (x) { return x.u.nome + ' (' + nAbertos(x.n) + ')'; }))) + '. O próximo chamado vai para ' + esc(menores.length > 1 ? 'um entre ' + lista(menores.map(function (x) { return x.u.nome; })) + ', pelo acaso' : menores[0].u.nome) + '. O escopo é conferido pelo CNPJ de cada chamado.'
      : 'Ninguém elegível disponível no grupo: o chamado fica na fila e o gestor é avisado.') + textoFora(e);
  }

  function combos() {
    var por = {};
    chamados().forEach(function (c) {
      if (!c.semRegra) return;
      var key = c.tipo + '|' + c.df;
      var x = por[key] = por[key] || { tipo: c.tipo, familia: c.familia, df: c.df, n: 0, ab: 0, ult: null, grupos: {} };
      x.n++;
      if (aberto(c.id)) x.ab++;
      var inc = incPorId(c.id) || {};
      if (!x.ult || String(inc.dataISO || '') > String(x.ult.dataISO || '')) x.ult = inc;
      x.grupos[c.grupoId] = 1;
    });
    return Object.keys(por).map(function (k1) { return por[k1]; }).filter(function (x) { return !rotear(x.familia, x.tipo, x.df).regra; })
      .sort(function (a, b) { return b.ab - a.ab || b.n - a.n; });
  }
  function abaSemRegra() {
    var todos = chamados(), sem = todos.filter(function (c) { return c.semRegra; });
    var ab = sem.filter(function (c) { return aberto(c.id); }).length;
    var cs = combos(), nc = naoCobertos();
    var pct = todos.length ? Math.round(sem.length * 100 / todos.length) : 0;
    var gopts = AT.grupos.filter(function (g) { return g.ativo; }).map(function (g) {
      return '<option value="' + g.id + '"' + (g.id === AT.padraoId ? ' selected' : '') + '>' + esc(g.nome) + (elegAgora(g) ? '' : ' — sem elegíveis') + '</option>';
    }).join('');
    var linhas = cs.map(function (x) {
      var ult = x.ult || {};
      return '<tr><td><span class="at-chip fam">' + letra(x.familia) + '</span> ' + esc(tipoLabel(x.tipo)) + '</td><td>' + x.df + '</td><td class="r">' + x.n + '</td><td class="r">' + x.ab + '</td>'
        + '<td>' + (ult.data ? esc(String(ult.data).slice(0, 5)) + ' · ' : '') + esc(ult.dfNum || '—') + '</td>'
        + '<td>' + Object.keys(x.grupos).map(function (id) { return esc(grupo(id).nome); }).join(', ') + '</td>'
        + '<td class="r"><button type="button" class="btn at-btn" onclick="shAt.editarRegra(\'\',\'' + x.tipo + '\',\'' + x.df + '\')">Criar regra</button></td></tr>';
    }).join('') || '<tr><td colspan="7" class="at-vazio">Nenhuma combinação descoberta: toda combinação que já gerou chamado tem regra.</td></tr>';
    return '<div class="shg3 at-mini">'
      + '<div class="at-minik"><span>Chamados sem regra</span><b>' + sem.length + '</b><small>' + nAbertos(ab) + '</small></div>'
      + '<div class="at-minik"><span>Combinações descobertas</span><b>' + cs.length + '</b><small>tipo × DF sem nenhuma regra</small></div>'
      + '<div class="at-minik"><span>Parcela do total</span><b>' + pct + '%</b><small>' + sem.length + ' de ' + todos.length + ' chamados</small></div></div>'
      + '<div class="at-padrao"><label for="at-padrao-sel"><b>Grupo padrão</b><small>Recebe o que nenhuma regra cobre. A troca vale para os próximos chamados (D-02).</small></label>'
      + '<select id="at-padrao-sel" class="at-sel" onchange="shAt.padrao(this.value)">' + gopts + '</select>'
      + '<span class="at-sub">Distribuição: sorteio entre os elegíveis de menor carga</span></div>'
      + (nc.length ? '<div class="at-caixa amb"><b>Tipos do catálogo que nenhuma regra cobre</b> — o aviso fica no menu Atendimento até alguém criar a regra: '
        + nc.map(function (x) { return letra(x.f) + ' · ' + esc(famLabel(x.f)) + (x.toda ? ' — família inteira (' + x.tipos.length + ')' : ': ' + esc(x.tipos.map(tipoLabel).join(', '))); }).join('; ') + '.</div>' : '')
      + '<div class="twrap"><table><thead><tr><th>Tipo de inconsistência</th><th>Tipo de DF</th><th class="r">Chamados</th><th class="r">Abertos</th><th>Último</th><th>Foi para</th><th></th></tr></thead><tbody>' + linhas + '</tbody></table></div>'
      + '<p class="at-nota">“Criar regra” abre o editor com o tipo e o tipo de DF da linha preenchidos — falta escolher o grupo. A linha some quando uma regra passa a cobrir a combinação; os chamados já criados ficam onde estão, com a marca sem regra.</p>';
  }

  function abaMatriz() {
    var usados = {};
    AT.regras.forEach(function (r) { r.dfs.forEach(function (d) { usados[d] = 1; }); });
    var cols = ['NF-e', 'CT-e', 'NFS-e'];
    Object.keys(usados).forEach(function (d) { if (cols.indexOf(d) < 0) cols.push(d); });
    var demais = DFS.filter(function (d) { return cols.indexOf(d) < 0; })[0];
    var colsAll = cols.concat(demais ? [demais] : []);
    var head = '<tr><th>Família e tipos</th>' + cols.map(function (d) { return '<th>' + d + '</th>'; }).join('') + (demais ? '<th>Demais DF</th>' : '') + '</tr>';
    var corpo = familias().map(function (f) {
      var tipos = tiposDaFamilia(f), grp = {};
      tipos.forEach(function (t) {
        var sig = colsAll.map(function (d) { var r = rotear(f, t, d); return r.grupoId + (r.regra ? '' : '*'); }).join('|');
        (grp[sig] = grp[sig] || []).push(t);
      });
      var sigs = Object.keys(grp);
      return '<tr class="at-mfam"><td colspan="' + (colsAll.length + 1) + '"><span class="at-chip fam">' + letra(f) + '</span> ' + esc(famLabel(f)) + '</td></tr>'
        + sigs.map(function (sig) {
          var ts = grp[sig], cel = sig.split('|');
          var nome = sigs.length === 1 ? 'Família inteira (' + ts.length + ')' : (ts.length > 3 ? plural(ts.length, 'tipo', 'tipos') + ': ' : '') + ts.map(tipoLabel).join(' · ');
          return '<tr><td class="at-mtipo">' + esc(nome) + '</td>' + cel.map(function (x, i) {
            var sem = x.slice(-1) === '*', g = grupo(sem ? x.slice(0, -1) : x);
            return '<td class="' + (sem ? 'amb' : '') + '"' + (sem ? ' role="button" tabindex="0" title="Criar a regra para esta combinação" onclick="shAt.editarRegra(\'\',\'' + ts[0] + '\',\'' + colsAll[i] + '\')"' : '') + '>' + esc(g ? g.nome : '—') + '</td>';
          }).join('') + '</tr>';
        }).join('');
    }).join('');
    return '<p class="at-p">Para onde vai cada chamado, família × tipo de DF, resultado das regras ativas. Células em amarelo caem no grupo padrão por falta de regra — clicar nelas cria a regra. A coluna “Demais DF” vale para os tipos de DF que nenhuma regra cita.</p>'
      + '<div class="twrap"><table class="at-matriz"><thead>' + head + '</thead><tbody>' + corpo + '</tbody></table></div>';
  }

  /* ── Editar grupo (T-02) ─────────────────────────────────────────────────── */
  function editarGrupo(gid) {
    var g = grupo(gid);
    AT.dg = g ? JSON.parse(JSON.stringify(g)) : { id: null, nome: '', descricao: '', gestorId: '', ativo: true, membros: [] };
    AT.dgOrig = g ? g.membros.map(function (m) { return m.usuarioId; }) : [];
    desenharGrupo();
  }
  function lerGrupo() {
    var d = AT.dg;
    if (!d || !el('at-g-nome')) return;
    d.nome = val('at-g-nome'); d.descricao = val('at-g-desc'); d.gestorId = val('at-g-gest');
    d.ativo = !!(el('at-g-ativo') || {}).checked;
  }
  function desenharGrupo() {
    var d = AT.dg, eh = d.id === AT.padraoId;
    var cand = usuarios().filter(function (u) { return podeSerMembro(u) && !d.membros.some(function (m) { return m.usuarioId === u.id; }); });
    var foraPerfil = usuarios().filter(function (u) { return ativo(u) && !podeSerMembro(u); });
    var regs = d.id ? AT.regras.filter(function (r) { return r.grupoId === d.id; }) : [];
    var linhas = d.membros.map(function (m, i) {
      var u = pessoa(m.usuarioId), aus = !!m.ausenteAte;
      var n = d.id ? chamados().filter(function (c) { return c.grupoId === d.id && c.respId === m.usuarioId && aberto(c.id); }).length : 0;
      return '<tr><td><div class="at-pessoa">' + av(u) + '<span>' + esc(u ? u.nome : '—') + (u && d.gestorId === u.id ? ' <span class="at-sub">gestor</span>' : '') + '</span></div></td>'
        + '<td>' + (u ? PERFIL_ROT[u.perfil] : '—') + '</td><td>' + esc(escopoRot(u)) + '</td>'
        + '<td><div class="at-disp"><select class="at-sel" aria-label="Disponibilidade de ' + esc(u ? u.nome : '') + '" onchange="shAt.dgAus(' + i + ',this.value)"><option value="">Disponível</option><option value="a"' + (aus ? ' selected' : '') + '>Ausente até</option></select>'
        + (aus ? '<input type="date" class="at-sel" aria-label="Data de volta" value="' + isoDia(m.ausenteAte) + '" onchange="shAt.dgVolta(' + i + ',this.value)">' : '') + '</div></td>'
        + '<td class="r">' + n + '</td>'
        + '<td class="r"><button type="button" class="btn at-btn at-btn-red" onclick="shAt.dgRemover(' + i + ')">Remover</button></td></tr>';
    }).join('') || '<tr><td colspan="6" class="at-vazio">Nenhum membro ainda.</td></tr>';
    var removidos = AT.dgOrig.filter(function (id) { return !d.membros.some(function (m) { return m.usuarioId === id; }); });
    var avisoRem = removidos.map(function (id) {
      var n = chamados().filter(function (c) { return c.grupoId === d.id && c.respId === id && aberto(c.id); }).length;
      return n ? plural(n, 'chamado aberto', 'chamados abertos') + ' de ' + pessoa(id).nome + ' neste grupo ' + (n === 1 ? 'é sorteado' : 'são sorteados') + ' de novo entre os elegíveis' : '';
    }).filter(Boolean);
    var tes = d.membros.map(function (m) { return pessoa(m.usuarioId); }).filter(function (u) { return u && u.perfil === 'tesouraria'; });
    var corpo = '<div class="shg2 at-g2">'
      + '<div class="at-campo"><label for="at-g-nome">Nome</label><input id="at-g-nome" class="at-in" value="' + esc(d.nome) + '" oninput="shAt.validarGrupo()"></div>'
      + '<div class="at-campo"><label for="at-g-gest">Gestor</label><select id="at-g-gest" class="at-in" onchange="shAt.validarGrupo()"><option value="">Escolha…</option>'
      + usuarios().filter(podeSerMembro).map(function (u) { return '<option value="' + u.id + '"' + (d.gestorId === u.id ? ' selected' : '') + '>' + esc(u.nome) + ' · ' + PERFIL_ROT[u.perfil] + '</option>'; }).join('') + '</select></div></div>'
      + '<div class="at-campo"><label for="at-g-desc">Descrição</label><textarea id="at-g-desc" class="at-in" rows="2">' + esc(d.descricao) + '</textarea></div>'
      + '<label class="at-ck at-campo"><input type="checkbox" id="at-g-ativo"' + (d.ativo ? ' checked' : '') + (eh ? ' disabled' : '') + ' onchange="shAt.validarGrupo()"> Grupo ativo' + (eh ? ' — é o grupo padrão e não pode ser desativado' : '') + '</label>'
      + '<div class="at-lbl at-campo">Membros</div>'
      + '<div class="twrap" style="--twrap-h:none"><table><thead><tr><th>Membro</th><th>Perfil</th><th>Escopo</th><th>Disponibilidade</th><th class="r">Abertos aqui</th><th></th></tr></thead><tbody>' + linhas + '</tbody></table></div>'
      + '<div class="at-add"><select id="at-g-add" class="at-sel" aria-label="Usuário a adicionar"><option value="">+ Adicionar usuário…</option>'
      + cand.map(function (u) { return '<option value="' + u.id + '">' + esc(u.nome) + ' · ' + PERFIL_ROT[u.perfil] + '</option>'; }).join('') + '</select>'
      + '<button type="button" class="btn at-btn" onclick="shAt.dgAdd()">Adicionar</button>'
      + '<span class="at-sub">só Administrador, Fiscal e Tesouraria' + (foraPerfil.length ? ' — ' + esc(lista(foraPerfil.map(function (u) { return u.nome; }))) + ', de perfil Leitura, não aparece' : '') + '</span></div>'
      + (tes.length ? '<div class="at-caixa info">' + esc(lista(tes.map(function (u) { return u.nome; }))) + ' tem perfil Tesouraria: neste grupo recebe só a família D. Se uma regra trouxer outra família para cá, fica fora do sorteio desses chamados.</div>' : '')
      + (avisoRem.length ? '<div class="at-caixa amb">Ao salvar, ' + esc(lista(avisoRem)) + ' (D-05).</div>' : '')
      + '<div class="at-kv"><span>Distribuição</span><b>Sorteio entre os elegíveis de menor carga</b></div>'
      + '<div class="at-kv"><span>Regras que alimentam o grupo</span><b>' + (regs.length ? regs.map(function (r) { return r.id + ' — ' + esc(rotCrit(r)); }).join('<br>') : eh ? 'é o padrão: recebe o que nenhuma regra cobre' : 'nenhuma — recebe só por transferência') + '</b></div>'
      + '<p class="at-nota">Ausência tem data de volta; ao chegar a data, o membro volta ao sorteio sozinho. Ausente mantém os chamados que já tem (D-05).</p>';
    modal(d.id ? 'Editar grupo · ' + esc(d.nome) : 'Novo grupo', 'Configurações › Atendimento › Grupos', corpo, 'Salvar grupo', 760);
    el('at-ok').onclick = salvarGrupo;
    validarGrupo();
  }
  function faltasGrupo() {
    lerGrupo();
    var d = AT.dg, f = [];
    if (!d.nome) f.push('nome');
    if (!d.gestorId) f.push('gestor');
    if (AT.grupos.some(function (g) { return g.id !== d.id && g.nome.toLowerCase() === d.nome.toLowerCase(); })) f.push('um nome que nenhum outro grupo use');
    if (d.id === AT.padraoId && !d.membros.some(function (m) { return podeSerMembro(pessoa(m.usuarioId)) && !ausente(m); })) f.push('ao menos um membro disponível — é o grupo padrão');
    d.membros.forEach(function (m) { if (m.ausenteAte && new Date(m.ausenteAte) <= new Date()) f.push('data de volta futura para ' + pessoa(m.usuarioId).nome); });
    if (d.id && !d.ativo && abertosDo(d.id)) f.push('transferir antes os ' + abertosDo(d.id) + ' chamados abertos, para desativar');
    return f;
  }
  function validarGrupo() {
    var f = faltasGrupo(), st = el('at-falta'), ok = el('at-ok');
    if (st) { st.textContent = f.length ? 'Falta: ' + lista(f) + '.' : 'Pode salvar.'; st.className = 'at-falta' + (f.length ? '' : ' ok'); }
    if (ok) ok.disabled = f.length > 0;
  }
  function salvarGrupo() {
    if (faltasGrupo().length) return validarGrupo();
    var d = AT.dg, autor = (vendo() || {}).nome, g = d.id ? grupo(d.id) : null;
    var antes = g ? g.membros.map(function (m) { return { id: m.usuarioId, aus: ausente(m) }; }) : [];
    if (!g) { g = { id: 'G-' + pad(++AT.seqG), membros: [] }; AT.grupos.push(g); }
    var removidos = antes.filter(function (a) { return !d.membros.some(function (m) { return m.usuarioId === a.id; }); });
    var voltaram = d.membros.filter(function (m) {
      var a = antes.filter(function (x) { return x.id === m.usuarioId; })[0];
      return !ausente(m) && (!a || a.aus);
    });
    g.nome = d.nome; g.descricao = d.descricao; g.gestorId = d.gestorId; g.ativo = d.ativo;
    g.membros = d.membros.map(function (m) { return { usuarioId: m.usuarioId, ausenteAte: m.ausenteAte ? new Date(m.ausenteAte) : null, desde: m.desde ? new Date(m.desde) : new Date() }; });
    var red = 0;
    removidos.forEach(function (a) {
      chamados().forEach(function (c) {
        if (c.grupoId === g.id && c.respId === a.id && aberto(c.id)) { sortearDeNovo(c, 'redistribuicao', 'Redistribuído — ' + pessoa(a.id).nome + ' saiu do grupo ' + g.nome, autor); red++; }
      });
    });
    var fila = voltaram.length ? sortearFila(g, lista(voltaram.map(function (m) { return pessoa(m.usuarioId).nome; })) + (voltaram.length > 1 ? ' voltaram ou entraram' : ' voltou ou entrou')) : 0;
    fechar('at-modal');
    AT.dg = null;
    toast('Grupo ' + g.nome + ' salvo' + (red ? ' · ' + plural(red, 'chamado sorteado', 'chamados sorteados') + ' de novo' : '') + (fila ? ' · ' + plural(fila, 'chamado saiu', 'chamados saíram') + ' da fila' : '') + '.');
    menuAviso();
    render();
  }
  function dgAus(i, v) { lerGrupo(); AT.dg.membros[i].ausenteAte = v ? maisDias(7) : null; desenharGrupo(); }
  function dgVolta(i, v) { lerGrupo(); if (v) { var p = v.split('-'); AT.dg.membros[i].ausenteAte = new Date(+p[0], +p[1] - 1, +p[2]); } desenharGrupo(); }
  function dgRemover(i) { lerGrupo(); var m = AT.dg.membros.splice(i, 1)[0]; if (m && AT.dg.gestorId === m.usuarioId) AT.dg.gestorId = ''; desenharGrupo(); }
  function dgAdd() {
    var id = val('at-g-add');
    if (!id) return;
    lerGrupo();
    AT.dg.membros.push({ usuarioId: id, ausenteAte: null, desde: new Date() });
    desenharGrupo();
  }

  /* ── Editar regra ────────────────────────────────────────────────────────── */
  function editarRegra(rid, tipo, df) {
    var r = regra(rid);
    AT.dr = r ? JSON.parse(JSON.stringify(r)) : { id: null, grupoId: '', familias: [], tipos: tipo ? [tipo] : [], dfs: df ? [df] : [], ativa: true };
    var d = AT.dr;
    var fams = familias().map(function (f) {
      var toda = d.familias.indexOf(f) >= 0;
      return '<div class="at-rfam"><label class="at-ck"><input type="checkbox" data-fam="' + f + '"' + (toda ? ' checked' : '') + ' onchange="shAt.drFam(this)"> <b>' + letra(f) + ' · ' + esc(famLabel(f)) + '</b> — família inteira (' + tiposDaFamilia(f).length + ')</label>'
        + '<div class="shg at-rtipos" style="--shg-min:200px">' + tiposDaFamilia(f).map(function (t) {
          return '<label class="at-ck"><input type="checkbox" data-tipo="' + t + '"' + (d.tipos.indexOf(t) >= 0 || toda ? ' checked' : '') + (toda ? ' disabled' : '') + ' onchange="shAt.validarRegra()"> ' + esc(tipoLabel(t)) + '</label>';
        }).join('') + '</div></div>';
    }).join('');
    var corpo = '<div class="at-lbl">Família ou tipo de inconsistência <span class="at-sub">— vazio é “qualquer”</span></div>' + fams
      + '<div class="at-lbl at-campo">Tipo de DF <span class="at-sub">— vazio é “qualquer”</span></div><div class="shg at-rdfs" style="--shg-min:96px">'
      + DFS.map(function (x) { return '<label class="at-ck"><input type="checkbox" data-df="' + x + '"' + (d.dfs.indexOf(x) >= 0 ? ' checked' : '') + ' onchange="shAt.validarRegra()"> ' + x + '</label>'; }).join('') + '</div>'
      + '<div class="shg2 at-g2"><div class="at-campo"><label for="at-r-gr">Grupo</label><select id="at-r-gr" class="at-in" onchange="shAt.validarRegra()"><option value="">Escolha…</option>'
      + AT.grupos.filter(function (g) { return g.ativo; }).map(function (g) { return '<option value="' + g.id + '"' + (d.grupoId === g.id ? ' selected' : '') + '>' + esc(g.nome) + '</option>'; }).join('') + '</select></div>'
      + '<label class="at-ck at-campo at-ck-fim"><input type="checkbox" id="at-r-ativa"' + (d.ativa ? ' checked' : '') + '> Regra ativa</label></div>'
      + '<div class="at-teste-res" id="at-r-prev"></div>';
    modal(d.id ? 'Editar regra ' + d.id : 'Nova regra de roteamento', 'Pelo menos um critério; os dois vazios não são permitidos', corpo, 'Salvar regra', 720);
    el('at-ok').onclick = salvarRegra;
    validarRegra();
  }
  function lerRegra() {
    var d = AT.dr;
    d.familias = [].slice.call(document.querySelectorAll('#at-modal input[data-fam]:checked')).map(function (x) { return x.getAttribute('data-fam'); });
    d.tipos = [].slice.call(document.querySelectorAll('#at-modal input[data-tipo]:checked:not(:disabled)')).map(function (x) { return x.getAttribute('data-tipo'); });
    d.dfs = [].slice.call(document.querySelectorAll('#at-modal input[data-df]:checked')).map(function (x) { return x.getAttribute('data-df'); });
    d.grupoId = val('at-r-gr');
    d.ativa = !!(el('at-r-ativa') || {}).checked;
  }
  function drFam(cb) {
    var f = cb.getAttribute('data-fam');
    document.querySelectorAll('#at-modal input[data-tipo]').forEach(function (x) {
      if (K() && K().familia(x.getAttribute('data-tipo')) === f) { x.disabled = cb.checked; if (cb.checked) x.checked = true; }
    });
    validarRegra();
  }
  function validarRegra() {
    lerRegra();
    var d = AT.dr, f = [];
    if (!d.familias.length && !d.tipos.length && !d.dfs.length) f.push('pelo menos um critério');
    if (!d.grupoId) f.push('grupo');
    var st = el('at-falta'), ok = el('at-ok'), pv = el('at-r-prev');
    if (st) { st.textContent = f.length ? 'Falta: ' + lista(f) + '.' : 'Pode salvar. Vale para os próximos chamados.'; st.className = 'at-falta' + (f.length ? '' : ' ok'); }
    if (ok) ok.disabled = f.length > 0;
    if (pv) {
      var n = chamados().filter(function (c) { return casa(d, c.familia, c.tipo, c.df); }).length;
      pv.textContent = f.length ? '' : 'Critérios: ' + nCrit(d) + ' — ' + descCrit(d) + '. Dos chamados de hoje, ' + plural(n, 'casaria', 'casariam') + ' com ela — eles ficam onde estão.';
    }
  }
  function salvarRegra() {
    validarRegra();
    var d = AT.dr;
    if (el('at-ok') && el('at-ok').disabled) return;
    var r = d.id ? regra(d.id) : null;
    if (!r) { r = { id: 'R-' + pad(++AT.seqR) }; AT.regras.push(r); }
    r.grupoId = d.grupoId; r.familias = d.familias; r.tipos = d.tipos; r.dfs = d.dfs; r.ativa = d.ativa;
    fechar('at-modal');
    AT.dr = null;
    toast('Regra ' + r.id + ' salva → ' + grupo(r.grupoId).nome + '.');
    if (AT.aba === 'semregra' || AT.aba === 'matriz') AT.aba = 'regras';
    menuAviso();
    render();
  }
  function moverRegra(rid, delta) {
    var i = AT.regras.indexOf(regra(rid)), j = i + delta;
    if (i < 0 || j < 0 || j >= AT.regras.length) return;
    var x = AT.regras[i]; AT.regras[i] = AT.regras[j]; AT.regras[j] = x;
    render();
  }

  /* ── Menu, rota e início ─────────────────────────────────────────────────── */
  function css() {
    if (el('at-css')) return;
    var l = document.createElement('link');
    l.id = 'at-css'; l.rel = 'stylesheet'; l.href = 'css/atendimento.css?v=1';
    document.head.appendChild(l);
  }
  function menu() {
    var ref = el('subnav-admin-usuarios');
    if (ref && !el('subnav-admin-atendimento')) {
      ref.insertAdjacentHTML('afterend', '<button class="nav-sub-btn" id="subnav-admin-atendimento" title="Atendimento" onclick="showAdminSub(\'atendimento\',this)">'
        + '<span class="nav-sub-dot"></span><span class="nav-label"> Atendimento</span><span class="at-menu-badge" id="at-menu-badge" hidden></span></button>');
      el('subnav-admin-atendimento').addEventListener('click', function () { setTimeout(render, 0); });
    }
    var sv = el('admin-usuarios');
    if (sv && !el('admin-atendimento')) sv.insertAdjacentHTML('afterend', '<div id="admin-atendimento" class="sv"><div id="at-root"></div></div>');
  }
  function rota() {
    if ((location.hash || '').indexOf('#/atendimento') !== 0) return false;
    var lp = el('lp-screen');
    if (lp && lp.style.display !== 'none') return true;
    var b = el('subnav-admin-atendimento');
    if (b) b.click();
    return true;
  }
  function ganchos() {
    if (!on()) return;
    css();
    menu();
    ganchosKanban();
    garantir();
    var ap = window.shAplicarRota;
    if (typeof ap === 'function' && !ap._at) {
      window.shAplicarRota = function () { if (rota()) return; return ap.apply(this, arguments); };
      window.shAplicarRota._at = true;
    }
    window.addEventListener('hashchange', rota);
    setTimeout(rota, 500);
  }

  window.shAt = {
    on: on, onExig: onExig, estado: AT, garantir: garantir, rotear: rotear, sortear: sortear, carga: carga, render: render,
    recorte: function (r) { AT.recorte = r; window.renderizarKanbanInconsistencias(); },
    filtro: function (k1, v) { AT[k1] = v; window.renderizarKanbanInconsistencias(); },
    verComo: function (id) { AT.viewer = id; window.renderizarKanbanInconsistencias(); toast('Vendo como ' + (pessoa(id) || {}).nome + ' — só no protótipo.'); },
    pedir: pedir, validar: validar, confirmar: confirmar, cancelar: cancelar,
    assumir: assumir, reatribuir: reatribuir, transferir: transferir, validarTransf: validarTransf,
    devolver: devolver,
    aba: function (a) { AT.aba = a; render(); },
    teste: function (k1, v) { AT[k1] = v; var r = el('at-teste-res'); if (r) r.innerHTML = resultadoTeste(AT.tTipo || 'capur_ibs_divergente', AT.tDF || 'NFS-e'); },
    padrao: function (gid) { var g = grupo(gid); if (!g) return; AT.padraoId = gid; toast('Grupo padrão: ' + g.nome + '. Vale para os próximos chamados.'); render(); },
    editarGrupo: editarGrupo, validarGrupo: validarGrupo, dgAus: dgAus, dgVolta: dgVolta, dgRemover: dgRemover, dgAdd: dgAdd,
    editarRegra: editarRegra, validarRegra: validarRegra, drFam: drFam, moverRegra: moverRegra
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(ganchos, 300); });
  else setTimeout(ganchos, 300);
})();

/* ══ Backoffice da plataforma — administração global ════════════════════════
   O SplitHub serve várias organizações (tenants). Este painel é da operação
   da plataforma, não de uma organização:
     · organizações: lista, cadastro de uma nova, situação e implantação
     · feature flags: catálogo da plataforma, desligamento global (kill switch),
       padrão por plano e exceção por organização, sempre com motivo
     · saúde das integrações de cada organização, com incidente
     · usuários da plataforma, com perfil global e o que cada perfil pode
     · planos e trilha de auditoria do backoffice
   No app da organização, Configurações › Organização mostra os recursos
   liberados e leva o pedido de liberação ao backoffice.
   As flags valem no app na hora: a organização aberta no protótipo é a
   Induspar Tecnologia, e o que estiver desligado para ela some da navegação.
   São a segunda camada das flags: a entrega (features.js) decide se o
   recurso existe no ambiente; o backoffice decide quem usa.
   Estado em memória, como os demais módulos do protótipo.
   Pacote AV-BO: backoffice_plataforma liga o painel; flags_por_organizacao
   faz o app obedecer às flags de cada organização.
   ═══════════════════════════════════════════════════════════════════════════ */
/* @pacote — o estado das flags é reescrito por tools/avaliacao.py promover */
window.shFeature && shFeature.registrar({"id": "AV-BO", "nome": "Backoffice da plataforma", "branch": "feat/backoffice", "entrada": "#/backoffice", "flags": {"backoffice_plataforma": "avaliacao", "flags_por_organizacao": "avaliacao"}, "rotulos": {"backoffice_plataforma": "Organizações, cadastro, catálogo de flags, planos e trilha", "flags_por_organizacao": "O app obedece às flags da organização aberta"}, "alvos": {"backoffice_plataforma": ["#sb-backoffice"]}});
/* @fim-pacote */
(function () {
  'use strict';

  function entregue(k) { return !window.shFeature || shFeature.entrega(k); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fechar(id) { var e = document.getElementById(id); if (e) e.remove(); }
  function agora() { return new Date(); }
  function fmtD(d) { var x = new Date(d); return ('0' + x.getDate()).slice(-2) + '/' + ('0' + (x.getMonth() + 1)).slice(-2) + '/' + x.getFullYear(); }
  function fmtDH(d) { var x = new Date(d); return fmtD(x) + ' ' + ('0' + x.getHours()).slice(-2) + ':' + ('0' + x.getMinutes()).slice(-2); }
  function dias(n) { var d = agora(); d.setDate(d.getDate() + n); return d; }
  /* ── Usuários da plataforma e perfis globais ──────────────────────────── */
  // perfil global: vale para todas as organizações; não se confunde com os cinco perfis de dentro da organização
  var PERFIS = {
    admin: { nome: 'Administrador da plataforma', desc: 'Tudo, inclusive os usuários da plataforma e o desligamento global de flag.', pode: ['org', 'flag_org', 'flag_global', 'plano', 'usuarios', 'saude'] },
    operacao: { nome: 'Operação', desc: 'Cadastra e mantém organizações: plano, situação, implantação, exceções de flag e saúde das integrações.', pode: ['org', 'flag_org', 'plano', 'saude'] },
    suporte: { nome: 'Suporte', desc: 'Acompanha a saúde das integrações, verifica e trata incidente. Lê o resto.', pode: ['saude'] },
    auditoria: { nome: 'Auditoria', desc: 'Só leitura, trilha incluída.', pode: [] }
  };
  var ACOES = [['org', 'Cadastrar organização, mudar a situação e a implantação'], ['plano', 'Mudar o plano'], ['flag_org', 'Exceção de flag por organização e pedidos de liberação'],
    ['flag_global', 'Desligar ou religar uma flag na plataforma'], ['saude', 'Verificar integrações e tratar incidente'], ['usuarios', 'Gerir os usuários da plataforma']];
  function opAtual() { return ST.operadores.filter(function (o) { return o.id === ST.op; })[0]; }
  function op() { var o = opAtual(); return o ? o.nome + ' · ' + PERFIS[o.perfil].nome : '—'; }
  function pode(acao) { var o = opAtual(); return !!o && o.sit === 'ativo' && PERFIS[o.perfil].pode.indexOf(acao) >= 0; }
  function exigir(acao) {
    if (pode(acao)) return true;
    var o = opAtual();
    toast('O perfil ' + (o ? PERFIS[o.perfil].nome : '—') + ' não permite: ' + ACOES.filter(function (a) { return a[0] === acao; })[0][1].toLowerCase() + '.', true);
    return false;
  }
  function toast(msg, erro) {
    fechar('bo-toast');
    var t = document.createElement('div');
    // razão social que termina em "Ltda." não ganha ponto dobrado no fim da frase
    t.id = 'bo-toast'; t.className = 'bo-toast' + (erro ? ' erro' : ''); t.setAttribute('role', 'status'); t.textContent = msg.replace(/\.{2,}/g, '.');
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 4500);
  }
  function overlay(id, largura, miolo) {
    fechar(id);
    document.body.insertAdjacentHTML('beforeend', '<div id="' + id + '" class="moverlay bo-ov" onclick="if(event.target===this)this.remove()">'
      + '<div class="mbox bo-mbox" style="--bo-w:' + largura + 'px" role="dialog" aria-modal="true" aria-labelledby="' + id + '-t">' + miolo + '</div></div>');
  }
  function cab(id, icone, titulo, sub) {
    return '<div class="mbox-hdr"><div class="bo-hdr-l"><div class="mbox-icon blue">' + icone + '</div><div class="bo-min0">'
      + '<div class="mbox-title" id="' + id + '-t">' + titulo + '</div><div class="mbox-sub">' + sub + '</div></div></div>'
      + '<button class="mbox-close" aria-label="Fechar" onclick="document.getElementById(\'' + id + '\').remove()">✕</button></div>';
  }
  function rodape(id, legenda, botao, onclick) {
    return '<div class="bo-rodape"><span id="' + id + '-st" class="bo-rodape-st">' + legenda + '</span>'
      + '<button class="btn" onclick="document.getElementById(\'' + id + '\').remove()">Cancelar</button>'
      + '<button class="btn btn-t" onclick="' + onclick + '">' + esc(botao) + '</button></div>';
  }

  /* ── Catálogo de feature flags ────────────────────────────────────────── */
  // estagio: nucleo | ga | beta | avaliacao | fora
  // alvo: o que some do app da organização quando a flag está desligada
  var FLAGS = [
    { k: 'creditos', nome: 'Créditos IBS/CBS', mod: 'Crédito', estagio: 'nucleo', desc: 'O ciclo do crédito por tributo: listagem, partição, prazos e detalhe.', alvo: [] },
    { k: 'debitos', nome: 'Débitos IBS/CBS', mod: 'Débito', estagio: 'nucleo', desc: 'O débito por documento de saída e a partição por tributo.', alvo: [] },
    { k: 'conciliacao', nome: 'Conciliação', mod: 'Conciliação', estagio: 'nucleo', desc: 'O confronto com a Receita Federal e o Comitê Gestor.', alvo: [] },
    { k: 'apuracao', nome: 'Apuração IBS/CBS', mod: 'Apuração', estagio: 'nucleo', desc: 'O fechamento da competência por tributo, com a ordem do art. 53.', alvo: [] },
    { k: 'inconsistencias', nome: 'Inconsistências', mod: 'Inconsistências', estagio: 'nucleo', desc: 'A fila do que não bate, com responsável e histórico.', alvo: [] },
    { k: 'pagamentos_rad', nome: 'Pagamentos RAD', mod: 'Pagamentos', estagio: 'ga', desc: 'Guias de recolhimento pelo adquirente e comprovantes.', alvo: ['#nav-pagamentos-btn'] },
    { k: 'execucao_rad', nome: 'Execução RAD automática', mod: 'Execução RAD', estagio: 'ga', desc: 'Políticas que geram as guias sem ação humana.', alvo: ['#subnav-admin-exec-rad'], dep: ['pagamentos_rad'] },
    { k: 'portal_fornecedor', nome: 'Portal do Fornecedor', mod: 'Portal', estagio: 'ga', desc: 'Acesso do fornecedor por convite, restrito ao próprio CNPJ.', alvo: ['#nav-fornecedor-btn'] },
    { k: 'ressarcimento', nome: 'Ressarcimento', mod: 'Ressarcimento', estagio: 'beta', desc: 'Intenção, pedido, decisão e recebimento do saldo credor.', alvo: ['#nav-ressarcimento-btn', '#dash-res-card'] },
    { k: 'eventos_fiscais', nome: 'Evento fiscal e nota de ajuste', mod: 'Inconsistências', estagio: 'avaliacao', desc: 'Emitir evento da Reforma ou comandar nota de ajuste a partir da inconsistência ou do documento.', alvo: ['#subnav-admin-eventos'], dep: ['inconsistencias'] },
    { k: 'eventos_modo_direto', nome: 'Transmissão direta à SEFAZ', mod: 'Eventos fiscais', estagio: 'avaliacao', desc: 'O SplitHub transmite o evento com o certificado da organização.', alvo: [], dep: ['eventos_fiscais'] },
    { k: 'escopo_cnpj', nome: 'Escopo por CNPJ', mod: 'Usuários', estagio: 'ga', desc: 'Usuário restrito a CNPJs selecionados.', alvo: [] },
    { k: 'automacoes', nome: 'Automações', mod: 'Automações', estagio: 'ga', desc: 'Régua de cobrança e relatórios agendados.', alvo: ['#subnav-admin-automacoes'] },
    { k: 'analytics', nome: 'Analytics', mod: 'Analytics', estagio: 'ga', desc: 'Inteligência, fluxo de caixa tributário e apuração assistida.', alvo: ['#nav-analytics-btn'] },
    { k: 'integracoes_api', nome: 'Integrações por API', mod: 'Integrações', estagio: 'ga', desc: 'Conexões com o ERP pela API pública e webhooks.', alvo: ['#subnav-admin-integracoes'] },
    { k: 'assistente', nome: 'Assistente Tributário', mod: 'Analytics', estagio: 'beta', desc: 'Perguntas sobre a legislação, com citação.', alvo: [], globalOff: 'Desabilitado no protótipo em 26/10/2026' },
    { k: 'split_payment', nome: 'Split payment', mod: 'Contratos', estagio: 'fora', desc: 'Recolhimento na liquidação financeira. Fora da primeira versão.', alvo: [], globalOff: 'Fora da primeira versão, decisão de 05/10/2026' }
  ];
  var EST = { nucleo: ['núcleo', 'teal'], ga: ['disponível', 'teal'], beta: ['beta', 'blue'], avaliacao: ['em avaliação', 'amber'], fora: ['fora da 1ª versão', 'gray'] };
  function flag(k) { return FLAGS.filter(function (f) { return f.k === k; })[0]; }

  var PLANOS = [
    { k: 'essencial', nome: 'Essencial', desc: 'O ciclo do crédito e do débito, com RAD e integração por API.', liga: ['pagamentos_rad', 'integracoes_api'] },
    { k: 'completo', nome: 'Completo', desc: 'Tudo o que está disponível, com os módulos em beta.', liga: ['pagamentos_rad', 'execucao_rad', 'portal_fornecedor', 'ressarcimento', 'escopo_cnpj', 'automacoes', 'analytics', 'integracoes_api', 'eventos_fiscais', 'eventos_modo_direto'] },
    { k: 'personalizado', nome: 'Personalizado', desc: 'Parte do Essencial; cada recurso é ligado por exceção.', liga: ['pagamentos_rad', 'integracoes_api'] }
  ];
  function plano(k) { return PLANOS.filter(function (p) { return p.k === k; })[0]; }

  /* ── Estado ───────────────────────────────────────────────────────────── */
  var ST = window._boState = {
    seq: 0, trilha: [], global: {}, tenants: [], atual: 'ten_induspar', pedidos: [], incidentes: [], saude: {},
    op: 'op1',
    operadores: [
      { id: 'op1', nome: 'Ana Souza', email: 'ana.souza@splithub.com.br', perfil: 'admin', sit: 'ativo', mfa: true, ultimo: dias(0) },
      { id: 'op2', nome: 'Bruno Lima', email: 'bruno.lima@splithub.com.br', perfil: 'operacao', sit: 'ativo', mfa: true, ultimo: dias(-1) },
      { id: 'op3', nome: 'Carla Duarte', email: 'carla.duarte@splithub.com.br', perfil: 'suporte', sit: 'ativo', mfa: true, ultimo: dias(-2) },
      { id: 'op4', nome: 'Diego Ramos', email: 'diego.ramos@splithub.com.br', perfil: 'auditoria', sit: 'ativo', mfa: true, ultimo: dias(-9) },
      { id: 'op5', nome: 'Elisa Prado', email: 'elisa.prado@splithub.com.br', perfil: 'operacao', sit: 'inativo', mfa: true, ultimo: dias(-60), motivo: 'Saiu da operação em 08/2026' }
    ]
  };
  FLAGS.forEach(function (f) { ST.global[f.k] = { on: !f.globalOff, motivo: f.globalOff || '' }; });
  function log(tenant, acao, det, por) { ST.trilha.unshift({ em: agora(), por: por || op(), tenant: tenant, acao: acao, det: det || '' }); }
  function tenant(id) { return ST.tenants.filter(function (t) { return t.id === id; })[0]; }
  // as primeiras `feitas` etapas já concluídas
  function checklist(feitas) {
    return [{ t: 'CNPJs da organização carregados' }, { t: 'Fornecedores e contratos cadastrados' }, { t: 'Importação dos documentos configurada' },
      { t: 'Integração com o ERP e modo de eventos definidos' }, { t: 'Credencial da SEFAZ, se o modo for direto', opc: true }, { t: 'Casos da F1 do caderno de testes aprovados' }]
      .map(function (c, i) { c.ok = i < feitas; return c; });
  }
  function semear() {
    if (ST.tenants.length) return;
    function T(id, nome, raiz, pl, sit, amb, cnpjs, usuarios, criada, over) {
      ST.tenants.push({ id: id, nome: nome, raiz: raiz, plano: pl, sit: sit, amb: amb, cnpjs: cnpjs, usuarios: usuarios, criada: criada, over: over || {}, admin: null, checklist: null });
    }
    T('ten_induspar', 'Induspar Tecnologia S.A.', '54.891.237', 'completo', 'ativa', 'Produção', 9, 8, dias(-210));
    T('ten_metalsul', 'Metalsul Componentes Ltda.', '12.345.678', 'essencial', 'implantacao', 'Homologação', 4, 2, dias(-12));
    T('ten_ferroplex', 'Ferroplex Mineração S.A.', '23.456.789', 'completo', 'ativa', 'Produção', 14, 21, dias(-150), { ressarcimento: { on: false, motivo: 'Fora do contrato atual', por: op(), em: dias(-40) } });
    T('ten_varejosul', 'Varejo Sul Comércio S.A.', '34.567.890', 'personalizado', 'suspensa', 'Produção', 32, 15, dias(-300), { portal_fornecedor: { on: true, motivo: 'Incluído no aditivo de 2026', por: op(), em: dias(-90) } });
    tenant('ten_metalsul').checklist = checklist(3);
    ST.tenants.forEach(semearSaude);
    ST.pedidos.push({ id: 'PL-0001', tenant: 'ten_metalsul', flag: 'automacoes', por: 'Administrador da organização', em: dias(-2), sit: 'aberto', motivo: 'Régua de cobrança dos fornecedores' });
    log('—', 'Catálogo de flags carregado', FLAGS.length + ' flags');
  }

  /* ── Saúde das integrações por organização ────────────────────────────── */
  // req: o recurso que precisa estar ligado para a integração existir na organização
  var INTEG = [
    { k: 'erp', nome: 'ERP do cliente', sub: 'API pública: entrada de documentos e retorno' },
    { k: 'hooks', nome: 'Webhooks ao cliente', sub: 'Avisos e comandos ao sistema do cliente' },
    { k: 'ingestao', nome: 'Ingestão de documentos', sub: 'Leitura dos DFs e fila de processamento' },
    { k: 'rfb', nome: 'Receita Federal · CBS', sub: 'Consulta de apuração e eventos da CBS' },
    { k: 'cg', nome: 'Comitê Gestor · IBS', sub: 'Arquivos do IBS entregues por webhook' },
    { k: 'psp', nome: 'PSP · adquirente', sub: 'Recolhimento e comprovantes do RAD', req: 'pagamentos_rad' },
    { k: 'sefaz', nome: 'SEFAZ · SVRS', sub: 'Transmissão direta de eventos', req: 'eventos_modo_direto' },
    { k: 'cert', nome: 'Certificado e-CNPJ', sub: 'Validade da credencial da organização' }
  ];
  var SST = { ok: ['ok', 'teal'], degradado: ['degradada', 'amber'], falha: ['em falha', 'red'], pausado: ['pausada', 'gray'], nao_config: ['não configurada', 'gray'], na: ['não se aplica', 'gray'] };
  function semearSaude(t) {
    var s = ST.saude[t.id] = {};
    INTEG.forEach(function (i, n) {
      var c = { st: 'ok', p95: 300 + n * 70, suc: 99.8, fila: 0, ultima: new Date(agora().getTime() - (5 + n) * 60000), erro: '', hist: [] };
      if (t.sit === 'suspensa') c.st = 'pausado';
      if (t.sit === 'implantacao' && (i.k === 'erp' || i.k === 'hooks')) c.st = 'nao_config';
      if (i.k === 'cert') { c.vence = t.id === 'ten_induspar' ? dias(21) : dias(180); c.p95 = null; c.suc = null; }
      s[i.k] = c;
    });
    if (t.id === 'ten_induspar') { s.hooks.st = 'degradado'; s.hooks.p95 = 4200; s.hooks.suc = 97.1; s.hooks.fila = 38; s.hooks.erro = 'Tempo de resposta acima do limite de 3 s em 12% das entregas'; }
    if (t.id === 'ten_ferroplex') {
      s.cg.st = 'falha'; s.cg.suc = 62.0; s.cg.fila = 14; s.cg.erro = 'Sem arquivo do Comitê Gestor há 3 h · 3 tentativas sem resposta';
      ST.incidentes.push({ id: 'INC-PLT-0012', tenant: t.id, integ: 'cg', aberto: new Date(agora().getTime() - 3 * 3600000), sit: 'aberto', det: s.cg.erro });
    }
    INTEG.forEach(function (i) {
      var c = s[i.k], st = i.k === 'cert' ? estadoInteg(t, i) : c.st;
      for (var h = 6; h >= 1; h--) c.hist.push({ em: new Date(c.ultima.getTime() - h * 3600000), st: st === 'falha' && h > 3 ? 'ok' : st, ms: c.p95 });
    });
  }
  function integAplica(t, i) { return !i.req || efetiva(t, i.req).on; }
  function estadoInteg(t, i) {
    var c = (ST.saude[t.id] || {})[i.k]; if (!c) return 'nao_config';
    if (!integAplica(t, i)) return 'na';
    if (i.k === 'cert' && c.st === 'ok' && c.vence && (c.vence - agora()) / 86400000 <= 30) return 'degradado';
    return c.st;
  }

  /* ── Regra da flag efetiva ────────────────────────────────────────────── */
  // ordem: entrega > global desligada > núcleo > dependência > exceção da organização > plano
  function efetiva(t, k, _vis) {
    var f = flag(k), g = ST.global[k];
    if (!entregue(k)) return { on: false, fonte: 'entrega', rot: 'não liberada neste ambiente — pacote em avaliação' };
    if (!g.on) return { on: false, fonte: 'global', rot: 'desligada na plataforma' };
    if (f.estagio === 'nucleo') return { on: true, fonte: 'nucleo', rot: 'núcleo — sempre ligada' };
    _vis = _vis || {};
    if (f.dep && !_vis[k]) {
      _vis[k] = true;
      var falta = f.dep.filter(function (d) { return !efetiva(t, d, _vis).on; });
      if (falta.length) return { on: false, fonte: 'dependencia', rot: 'depende de ' + falta.map(function (d) { return flag(d).nome; }).join(', ') };
    }
    var o = t.over[k];
    if (o) return { on: o.on, fonte: 'excecao', rot: (o.on ? 'ligada' : 'desligada') + ' por exceção · ' + o.motivo };
    var on = plano(t.plano).liga.indexOf(k) >= 0;
    return { on: on, fonte: 'plano', rot: (on ? 'ligada' : 'desligada') + ' pelo plano ' + plano(t.plano).nome };
  }
  // flag fora do catálogo (as de plataforma, como o próprio backoffice) não é por organização
  function ligada(k) { semear(); var t = tenant(ST.atual); return !t || !flag(k) || efetiva(t, k).on; }
  function contagem(t) { return FLAGS.filter(function (f) { return efetiva(t, f.k).on; }).length; }

  /* ── Efeito no app da organização aberta ──────────────────────────────── */
  // o backoffice entrega a regra por organização ao features.js, que esconde os alvos
  function ligarCamada() {
    if (!window.shFeature) return;
    var m = {}; FLAGS.forEach(function (f) { if (f.alvo.length) m[f.k] = f.alvo; });
    shFeature.alvos(m);
    if (entregue('backoffice_plataforma') && entregue('flags_por_organizacao')) shFeature.porOrganizacao(ligada);
    else shFeature.aplicar();
  }
  function aplicarNoApp() { if (window.shFeature) shFeature.aplicar(); }

  /* ── Tela ─────────────────────────────────────────────────────────────── */
  var ABA = 'orgs';
  function entrar() {
    if (location.hash === '#/backoffice') abrir(); else location.hash = '#/backoffice';
  }
  function abrir() {
    semear();
    if (!entregue('backoffice_plataforma')) { toast('O backoffice não está liberado neste ambiente.', true); return; }
    var r = document.getElementById('bo-root');
    if (!r) { r = document.createElement('div'); r.id = 'bo-root'; r.className = 'bo-root'; document.body.appendChild(r); }
    r.hidden = false;
    document.body.classList.add('bo-aberto');
    render();
  }
  function sair() {
    var r = document.getElementById('bo-root'); if (r) r.hidden = true;
    document.body.classList.remove('bo-aberto');
    if (location.hash === '#/backoffice') history.replaceState(null, '', location.pathname + location.search + '#/inicio');
    aplicarNoApp(); renderRecursosApp();
  }
  function aba(k) { ABA = k; render(); }
  function render() {
    var r = document.getElementById('bo-root'); if (!r || r.hidden) return;
    var nInc = ST.incidentes.filter(function (i) { return i.sit === 'aberto'; }).length;
    var abas = [['orgs', 'Organizações'], ['saude', 'Saúde das integrações' + (nInc ? ' · ' + nInc : '')], ['flags', 'Feature flags'], ['planos', 'Planos'], ['usuarios', 'Usuários da plataforma'], ['trilha', 'Trilha de auditoria']];
    var ativos = ST.operadores.filter(function (o) { return o.sit === 'ativo'; });
    var h = '<header class="bo-top"><div class="bo-marca"><b>SplitHub</b><span>Backoffice da plataforma</span></div>'
      + '<div class="bo-top-d"><label class="bo-op" for="bo-ver-como">Sessão · só no protótipo, troca o usuário</label><select id="bo-ver-como" class="bo-in bo-sel" onchange="shBo.verComo(this.value)">'
      + ativos.map(function (o) { return '<option value="' + o.id + '"' + (o.id === ST.op ? ' selected' : '') + '>' + esc(o.nome + ' · ' + PERFIS[o.perfil].nome) + '</option>'; }).join('') + '</select>'
      + '<button class="btn bo-btn-sm" onclick="shBo.sair()">Voltar ao app · ' + esc(tenant(ST.atual).nome.split(' ')[0]) + '</button></div></header>'
      + '<main class="bo-main"><div class="stabs bo-tabs">' + abas.map(function (a) { return '<button class="stab' + (ABA === a[0] ? ' active' : '') + '" onclick="shBo.aba(\'' + a[0] + '\')">' + a[1] + '</button>'; }).join('') + '</div>';
    if (ABA === 'orgs') h += telaOrgs();
    else if (ABA === 'saude') h += telaSaude();
    else if (ABA === 'flags') h += telaFlags();
    else if (ABA === 'planos') h += telaPlanos();
    else if (ABA === 'usuarios') h += telaUsuarios();
    else h += telaTrilha();
    r.innerHTML = h + '</main>';
  }
  var SIT = { implantacao: ['em implantação', 'amber'], ativa: ['ativa', 'teal'], suspensa: ['suspensa', 'red'], encerrada: ['encerrada', 'gray'] };
  function chip(c, t) { return '<span class="bo-chip ' + c + '">' + esc(t) + '</span>'; }
  // a camada de entrega: o que ainda está num pacote em avaliação
  function entregaChip(k) {
    var e = window.shFeature && shFeature.estado(k);
    if (!e) return '<span class="bo-sub">no app</span>';
    var pac = (shFeature.pacotes ? Object.keys(shFeature.pacotes()).filter(function (p) { return k in shFeature.pacotes()[p].flags; })[0] : '') || '';
    return e === 'aprovada' ? chip('teal', 'aprovada · ' + pac) : (e === 'rejeitada' ? chip('red', 'rejeitada') : chip('amber', 'em avaliação · ' + pac));
  }
  function telaOrgs() {
    var T = ST.tenants, n = function (s) { return T.filter(function (t) { return t.sit === s; }).length; };
    function k(l, v, s) { return '<div class="kcard"><div class="klbl">' + l + '</div><div class="kval">' + v + '</div><div class="ksub">' + s + '</div></div>'; }
    return '<div class="bo-hdr"><div><h2>Organizações</h2><p>Cada organização é um tenant: dados isolados, usuários próprios e os recursos que o plano e as exceções ligam.</p></div>'
      + (pode('org') ? '<button class="btn btn-t" onclick="shBo.nova()">+ Nova organização</button>' : '') + '</div>'
      + '<div class="kgrid k4">' + k('Organizações', T.length, 'na plataforma') + k('Ativas', n('ativa'), 'em produção') + k('Em implantação', n('implantacao'), 'em homologação') + k('Suspensas', n('suspensa'), 'sem acesso dos usuários') + '</div>'
      + '<div class="bo-tw bo-mt"><table class="bo-t"><thead><tr><th>Organização</th><th>CNPJ raiz</th><th>Plano</th><th>Situação</th><th>Ambiente</th><th class="r">Recursos ligados</th><th class="r">CNPJs</th><th class="r">Usuários</th><th>Desde</th><th></th></tr></thead><tbody>'
      + T.map(function (t) {
        var np = ST.pedidos.filter(function (p) { return p.tenant === t.id && p.sit === 'aberto'; }).length;
        return '<tr class="bo-tr-click" onclick="shBo.org(\'' + t.id + '\')"><td><b>' + esc(t.nome) + '</b>' + (t.id === ST.atual ? ' ' + chip('blue', 'aberta no app') : '') + (np ? ' ' + chip('amber', np + ' pedido' + (np > 1 ? 's' : '')) : '') + '</td><td class="bo-mono">' + esc(t.raiz) + '</td>'
          + '<td>' + esc(plano(t.plano).nome) + (Object.keys(t.over).length ? ' <span class="bo-sub">+ ' + Object.keys(t.over).length + ' exceção' + (Object.keys(t.over).length > 1 ? 'ões' : '') + '</span>' : '') + '</td>'
          + '<td>' + chip(SIT[t.sit][1], SIT[t.sit][0]) + '</td><td>' + esc(t.amb) + '</td><td class="r">' + contagem(t) + ' de ' + FLAGS.length + '</td><td class="r">' + t.cnpjs + '</td><td class="r">' + t.usuarios + '</td><td>' + fmtD(t.criada) + '</td>'
          + '<td class="r"><button class="btn bo-btn-sm" onclick="event.stopPropagation();shBo.org(\'' + t.id + '\')">Abrir</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function telaFlags() {
    return '<div class="bo-hdr"><div><h2>Feature flags da plataforma</h2><p>O plano define o padrão; a organização pode ter exceção; a plataforma pode desligar um recurso para todos. Recurso do núcleo fica sempre ligado.</p></div></div>'
      + '<div class="bo-tw"><table class="bo-t"><thead><tr><th>Flag</th><th>Módulo</th><th>Estágio</th><th>Entrega</th><th>Na plataforma</th><th>Nos planos</th><th>Depende de</th><th class="r">Organizações com ela</th></tr></thead><tbody>'
      + FLAGS.map(function (f) {
        var g = ST.global[f.k], nOn = ST.tenants.filter(function (t) { return efetiva(t, f.k).on; }).length;
        var pls = f.estagio === 'nucleo' ? 'todos' : (PLANOS.filter(function (p) { return p.ativo !== false && p.liga.indexOf(f.k) >= 0; }).map(function (p) { return p.nome; }).join(', ') || '—');
        return '<tr class="bo-tr-click" onclick="shBo.flag(\'' + f.k + '\')"><td><b>' + esc(f.nome) + '</b><span class="bo-sub bo-mono">' + esc(f.k) + '</span></td><td>' + esc(f.mod) + '</td><td>' + chip(EST[f.estagio][1], EST[f.estagio][0]) + '</td><td>' + entregaChip(f.k) + '</td>'
          + '<td>' + (g.on ? chip('teal', 'ligada') : chip('red', 'desligada')) + '</td><td class="bo-sub2">' + esc(pls) + '</td>'
          + '<td>' + esc((f.dep || []).map(function (d) { return flag(d).nome; }).join(', ') || '—') + '</td><td class="r">' + nOn + ' de ' + ST.tenants.length + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function telaPlanos() {
    var ed = pode('plano');
    return '<div class="bo-hdr"><div><h2>Planos</h2><p>O plano é o conjunto padrão de recursos de uma organização. Crie quantos precisar; mudar um plano muda todas as organizações nele, exceto onde há exceção. Preço e limites de uso estão na proposta do backoffice.</p></div>'
      + (ed ? '<button class="btn btn-t" onclick="shBo.planoEditar()">+ Novo plano</button>' : '') + '</div>'
      + '<div class="bo-planos">' + PLANOS.map(function (p) {
        var n = ST.tenants.filter(function (t) { return t.plano === p.k; }).length, apos = p.ativo === false;
        return '<div class="bo-plano' + (apos ? ' bo-plano-off' : '') + '"><div class="bo-plano-h"><b>' + esc(p.nome) + (apos ? ' ' + chip('gray', 'aposentado') : '') + '</b><span class="bo-sub">' + n + ' organizaç' + (n === 1 ? 'ão' : 'ões') + '</span></div><p class="bo-p">' + esc(p.desc) + '</p>'
          + '<div class="bo-tags">' + FLAGS.filter(function (f) { return f.estagio === 'nucleo' || p.liga.indexOf(f.k) >= 0; }).map(function (f) { return '<span class="bo-tag">' + esc(f.nome) + '</span>'; }).join('') + '</div>'
          + (ed && !apos ? '<div class="bo-acoes bo-mt"><button class="btn bo-btn-sm" onclick="shBo.planoEditar(\'' + p.k + '\')">Editar</button><button class="btn bo-btn-sm" onclick="shBo.planoEditar(null,\'' + p.k + '\')">Duplicar</button>'
            + (n ? '' : '<button class="btn bo-btn-sm bo-btn-red" onclick="shBo.planoAposentar(\'' + p.k + '\')">Aposentar</button>') + '</div>' : '')
          + (p.por ? '<span class="bo-sub bo-mt">' + esc(p.por) + '</span>' : '') + '</div>';
      }).join('') + '</div>';
  }

  /* ── Planos: criar, editar, duplicar, aposentar ───────────────────────── */
  // recurso fora da primeira versão não entra em plano; núcleo entra em todos
  function flagsDePlano() { return FLAGS.filter(function (f) { return f.estagio !== 'nucleo' && f.estagio !== 'fora'; }); }
  function planoEditar(k, base) {
    if (!exigir('plano')) return;
    var p = k ? plano(k) : null, src = p || (base ? plano(base) : null), id = 'bo-plano-ov';
    ST._plano = { k: k || null };
    overlay(id, 640, cab(id, '▦', p ? 'Editar plano · ' + esc(p.nome) : 'Novo plano', p ? 'Muda todas as organizações neste plano, exceto onde há exceção' : (base ? 'A partir de ' + esc(plano(base).nome) : 'Escolha os recursos'))
      + '<div class="mbox-col bo-col"><div class="bo-duo"><div class="bo-campo"><label for="bo-pl-nome">Nome</label><input id="bo-pl-nome" class="bo-in" value="' + esc(p ? p.nome : (base ? plano(base).nome + ' — cópia' : '')) + '" oninput="shBo.planoImpacto()"></div>'
      + '<div class="bo-campo"><label for="bo-pl-desc">Descrição</label><input id="bo-pl-desc" class="bo-in" value="' + esc(src ? src.desc : '') + '"></div></div>'
      + '<div class="bo-sec">Recursos · o núcleo vem em todos os planos</div><div class="bo-ck">'
      + flagsDePlano().map(function (f) {
        return '<label class="bo-ck-l"><input type="checkbox" data-pl="' + f.k + '"' + (src && src.liga.indexOf(f.k) >= 0 ? ' checked' : '') + ' onchange="shBo.planoImpacto()"> ' + esc(f.nome)
          + ' <span class="bo-sub">' + esc(EST[f.estagio][0]) + (f.dep ? ' · depende de ' + esc(f.dep.map(function (d) { return flag(d).nome; }).join(', ')) : '') + '</span></label>';
      }).join('') + '</div>'
      + '<div id="bo-pl-imp"></div>'
      + '<div class="bo-campo"><label for="bo-pl-mot">Motivo</label><textarea id="bo-pl-mot" class="bo-in" rows="2" placeholder="Fica na trilha de auditoria"></textarea></div></div>'
      + rodape(id, p ? 'O impacto aparece acima.' : 'Nome, recursos e motivo.', p ? 'Salvar plano' : 'Criar plano', 'shBo.planoSalvar()'));
    planoImpacto();
  }
  function planoLido() {
    var liga = Array.prototype.map.call(document.querySelectorAll('#bo-plano-ov input[data-pl]:checked'), function (c) { return c.getAttribute('data-pl'); });
    return { nome: (document.getElementById('bo-pl-nome').value || '').trim(), desc: (document.getElementById('bo-pl-desc').value || '').trim(), liga: liga, mot: (document.getElementById('bo-pl-mot') || {}).value };
  }
  function planoImpacto() {
    var box = document.getElementById('bo-pl-imp'); if (!box) return;
    var v = planoLido(), k = ST._plano.k, h = '';
    var semDep = v.liga.filter(function (x) { var f = flag(x); return f.dep && f.dep.some(function (d) { return flag(d).estagio !== 'nucleo' && v.liga.indexOf(d) < 0; }); });
    if (semDep.length) h += '<div class="bo-caixa bo-caixa-amb"><div class="bo-caixa-t">Dependência</div>' + semDep.map(function (x) { return esc(flag(x).nome) + ' depende de ' + esc(flag(x).dep.map(function (d) { return flag(d).nome; }).join(', ')); }).join('; ') + '. Sem ela, fica desligado nas organizações.</div>';
    if (k) {
      var p = plano(k), ganha = v.liga.filter(function (x) { return p.liga.indexOf(x) < 0; }), perde = p.liga.filter(function (x) { return v.liga.indexOf(x) < 0; });
      var orgs = ST.tenants.filter(function (t) { return t.plano === k; });
      if (ganha.length || perde.length) h += '<div class="bo-caixa"><div class="bo-caixa-t">Impacto em ' + orgs.length + ' organizaç' + (orgs.length === 1 ? 'ão' : 'ões') + '</div>'
        + (ganha.length ? 'Ganham: ' + esc(ganha.map(function (x) { return flag(x).nome; }).join(', ')) + '. ' : '') + (perde.length ? 'Perdem: ' + esc(perde.map(function (x) { return flag(x).nome; }).join(', ')) + '. ' : '')
        + (orgs.length ? esc(orgs.map(function (t) { return t.nome; }).join(', ').replace(/\.$/, '')) + '. Exceções de cada organização continuam valendo.' : '') + '</div>';
    }
    box.innerHTML = h;
  }
  function planoSalvar() {
    var v = planoLido(), k = ST._plano.k, st = document.getElementById('bo-plano-ov-st');
    var dup = PLANOS.some(function (p) { return p.k !== k && p.nome.toLowerCase() === v.nome.toLowerCase(); });
    var erro = !v.nome ? 'Dê um nome ao plano.' : (dup ? 'Já existe um plano com este nome.' : (!(v.mot || '').trim() ? 'Informe o motivo.' : ''));
    if (erro) { st.textContent = erro; st.className = 'bo-rodape-st amb'; return; }
    var assin = 'por ' + opAtual().nome + ' em ' + fmtD(agora());
    if (k) {
      var p = plano(k), antes = p.liga.slice();
      p.nome = v.nome; p.desc = v.desc; p.liga = v.liga; p.por = 'Alterado ' + assin;
      log('—', 'Plano alterado', p.nome + ' · ' + v.liga.length + ' recursos além do núcleo (antes ' + antes.length + ') · ' + v.mot.trim());
    } else {
      var novo = { k: 'pl_' + v.nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + (PLANOS.length + 1), nome: v.nome, desc: v.desc, liga: v.liga, por: 'Criado ' + assin };
      PLANOS.push(novo);
      log('—', 'Plano criado', novo.nome + ' · ' + v.liga.length + ' recursos além do núcleo · ' + v.mot.trim());
    }
    fechar('bo-plano-ov'); toast(k ? 'Plano salvo. As organizações nele já refletem.' : 'Plano ' + v.nome + ' criado.'); depois();
  }
  function planoAposentar(k) {
    if (!exigir('plano')) return;
    var p = plano(k);
    if (ST.tenants.some(function (t) { return t.plano === k; })) { toast('Há organizações neste plano. Mude-as de plano antes.', true); return; }
    pedirMotivo('Aposentar o plano ' + p.nome, 'Some do cadastro e da troca de plano; a trilha fica', function (m) {
      p.ativo = false; p.por = 'Aposentado por ' + opAtual().nome + ' em ' + fmtD(agora());
      log('—', 'Plano aposentado', p.nome + ' · ' + m); render();
    });
  }
  function telaSaude() {
    var cel = [], T = ST.tenants;
    T.forEach(function (t) { INTEG.forEach(function (i) { cel.push(estadoInteg(t, i)); }); });
    var n = function (s) { return cel.filter(function (x) { return x === s; }).length; };
    var mon = cel.filter(function (x) { return ['ok', 'degradado', 'falha'].indexOf(x) >= 0; }).length;
    var cert = T.filter(function (t) { var c = (ST.saude[t.id] || {}).cert; return c && c.vence && (c.vence - agora()) / 86400000 <= 30 && t.sit !== 'suspensa'; }).length;
    function k(l, v, s) { return '<div class="kcard"><div class="klbl">' + l + '</div><div class="kval">' + v + '</div><div class="ksub">' + s + '</div></div>'; }
    var abertos = ST.incidentes.filter(function (i) { return i.sit === 'aberto'; });
    return '<div class="bo-hdr"><div><h2>Saúde das integrações</h2><p>Cada integração de cada organização, verificada a cada 5 minutos: ERP, webhooks, ingestão, Receita Federal, Comitê Gestor, PSP, SEFAZ e certificado. Os limites vêm da qualidade de serviço por ator configurada na organização.</p></div>'
      + (pode('saude') ? '<button class="btn btn-t" onclick="shBo.verificar()">Verificar todas agora</button>' : '') + '</div>'
      + '<div class="kgrid k4">' + k('Monitoradas', mon, 'integrações ativas') + k('Saudáveis', n('ok'), 'dentro dos limites') + k('Degradadas', n('degradado'), 'lentas ou com fila · ' + cert + ' certificado' + (cert === 1 ? '' : 's') + ' a vencer em 30 dias') + k('Em falha', n('falha'), abertos.length + ' incidente' + (abertos.length === 1 ? '' : 's') + ' aberto' + (abertos.length === 1 ? '' : 's')) + '</div>'
      + (abertos.length ? '<div class="bo-sec">Incidentes abertos</div><div class="bo-tl bo-inc">' + abertos.map(function (i) {
        var t = tenant(i.tenant), it = INTEG.filter(function (x) { return x.k === i.integ; })[0];
        return '<div class="bo-tl-l"><span class="bo-tl-q">' + fmtDH(i.aberto) + '</span><span class="bo-min0"><b>' + esc(i.id) + ' · ' + esc(t.nome) + ' · ' + esc(it.nome) + '</b><span class="bo-sub">' + esc(i.det) + '</span></span>'
          + (pode('saude') ? '<button class="btn bo-btn-sm" onclick="shBo.resolverInc(\'' + i.id + '\')">Encerrar</button>' : '') + '</div>';
      }).join('') + '</div>' : '')
      + '<div class="bo-sec">Por organização · toque na linha para o detalhe</div>'
      + '<div class="bo-tw"><table class="bo-t bo-t-saude"><thead><tr><th>Organização</th>' + INTEG.map(function (i) { return '<th>' + esc(i.nome) + '</th>'; }).join('') + '</tr></thead><tbody>'
      + T.map(function (t) {
        return '<tr class="bo-tr-click" onclick="shBo.saude(\'' + t.id + '\')"><td><b>' + esc(t.nome) + '</b><span class="bo-sub">' + SIT[t.sit][0] + '</span></td>'
          + INTEG.map(function (i) { var s = estadoInteg(t, i); return '<td>' + chip(SST[s][1], SST[s][0]) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  function telaUsuarios() {
    var U = ST.operadores;
    return '<div class="bo-hdr"><div><h2>Usuários da plataforma</h2><p>Quem opera o backoffice. O perfil global vale para todas as organizações e não dá acesso aos dados de nenhuma: a entrada no ambiente de uma organização é outro recurso, com consentimento dela. MFA obrigatório; e-mail do domínio da SplitHub.</p></div>'
      + (pode('usuarios') ? '<button class="btn btn-t" onclick="shBo.convidarOp()">+ Convidar usuário</button>' : '') + '</div>'
      + '<div class="bo-tw"><table class="bo-t"><thead><tr><th>Usuário</th><th>Perfil global</th><th>MFA</th><th>Situação</th><th>Último acesso</th><th></th></tr></thead><tbody>'
      + U.map(function (o) {
        var sit = o.sit === 'ativo' ? chip('teal', 'ativo') : (o.sit === 'convidado' ? chip('amber', 'convite até ' + fmtD(o.expira)) : chip('gray', 'inativo'));
        var ac = !pode('usuarios') ? '' : (o.sit === 'ativo' ? '<button class="btn bo-btn-sm" onclick="shBo.perfilOp(\'' + o.id + '\')">Trocar perfil</button> <button class="btn bo-btn-sm bo-btn-red" onclick="shBo.desativarOp(\'' + o.id + '\')">Desativar</button>'
          : (o.sit === 'convidado' ? '<button class="btn bo-btn-sm" onclick="shBo.primeiroAcesso(\'' + o.id + '\')">Simular primeiro acesso</button>' : '<button class="btn bo-btn-sm" onclick="shBo.reativarOp(\'' + o.id + '\')">Reativar</button>'));
        return '<tr><td><b>' + esc(o.nome) + '</b>' + (o.id === ST.op ? ' ' + chip('blue', 'você') : '') + '<span class="bo-sub">' + esc(o.email) + '</span></td><td>' + esc(PERFIS[o.perfil].nome) + '</td>'
          + '<td>' + (o.mfa ? chip('teal', 'configurado') : chip('amber', 'pendente')) + '</td><td>' + sit + (o.motivo && o.sit === 'inativo' ? '<span class="bo-sub">' + esc(o.motivo) + '</span>' : '') + '</td>'
          + '<td>' + (o.ultimo ? fmtD(o.ultimo) : '—') + '</td><td class="r">' + ac + '</td></tr>';
      }).join('') + '</tbody></table></div>'
      + '<div class="bo-sec">O que cada perfil global pode</div><div class="bo-tw"><table class="bo-t"><thead><tr><th>Ação</th>' + Object.keys(PERFIS).map(function (p) { return '<th class="bo-c">' + esc(PERFIS[p].nome) + '</th>'; }).join('') + '</tr></thead><tbody>'
      + '<tr><td>Ver organizações, flags, saúde e trilha</td>' + Object.keys(PERFIS).map(function () { return '<td class="bo-c">●</td>'; }).join('') + '</tr>'
      + ACOES.map(function (a) { return '<tr><td>' + esc(a[1]) + '</td>' + Object.keys(PERFIS).map(function (p) { return '<td class="bo-c">' + (PERFIS[p].pode.indexOf(a[0]) >= 0 ? '●' : '—') + '</td>'; }).join('') + '</tr>'; }).join('')
      + '</tbody></table></div>';
  }
  function telaTrilha() {
    return '<div class="bo-hdr"><div><h2>Trilha de auditoria</h2><p>Toda mudança feita no backoffice, com quem, quando e por quê.</p></div></div>'
      + '<div class="bo-tl">' + ST.trilha.map(function (l) {
        return '<div class="bo-tl-l"><span class="bo-tl-q">' + fmtDH(l.em) + '</span><span class="bo-min0"><b>' + esc(l.acao) + '</b><span class="bo-sub">' + esc(l.tenant) + ' · ' + esc(l.det) + ' · ' + esc(l.por) + '</span></span></div>';
      }).join('') + '</div>';
  }

  /* ── Detalhe da organização ───────────────────────────────────────────── */
  function org(id) {
    var t = tenant(id); if (!t) return;
    var oid = 'bo-org-ov';
    var flags = FLAGS.map(function (f) {
      var e = efetiva(t, f.k), muda = ['nucleo', 'global', 'dependencia', 'entrega'].indexOf(e.fonte) < 0 && pode('flag_org');
      return '<tr><td><b>' + esc(f.nome) + '</b><span class="bo-sub">' + esc(f.mod) + ' · ' + esc(EST[f.estagio][0]) + '</span></td>'
        + '<td>' + (e.on ? chip('teal', 'ligada') : chip('gray', 'desligada')) + '</td><td class="bo-sub2">' + esc(e.rot) + '</td>'
        + '<td class="r">' + (muda ? '<button class="btn bo-btn-sm" onclick="shBo.trocar(\'' + t.id + '\',\'' + f.k + '\',' + (!e.on) + ')">' + (e.on ? 'Desligar' : 'Ligar') + '</button>'
          + (t.over[f.k] ? ' <button class="btn bo-btn-sm" onclick="shBo.voltarPlano(\'' + t.id + '\',\'' + f.k + '\')">Voltar ao plano</button>' : '') : '') + '</td></tr>';
    }).join('');
    var acoes = !pode('org') ? [] : ({ implantacao: [['ativar', 'Ativar em produção']], ativa: [['suspender', 'Suspender']], suspensa: [['reativar', 'Reativar']], encerrada: [] }[t.sit] || []);
    var ck = t.checklist, peds = ST.pedidos.filter(function (p) { return p.tenant === t.id && p.sit === 'aberto'; });
    overlay(oid, 860, cab(oid, '🏢', esc(t.nome), 'CNPJ raiz ' + esc(t.raiz) + ' · ' + esc(plano(t.plano).nome) + ' · ' + SIT[t.sit][0] + ' · ' + esc(t.amb))
      + '<div class="mbox-col bo-col">'
      + '<div class="bo-kv"><span>Plano</span><b><select class="bo-in bo-sel"' + (pode('plano') ? '' : ' disabled') + ' onchange="shBo.mudarPlano(\'' + t.id + '\',this.value)">' + PLANOS.filter(function (p) { return p.ativo !== false || p.k === t.plano; }).map(function (p) { return '<option value="' + p.k + '"' + (p.k === t.plano ? ' selected' : '') + '>' + p.nome + '</option>'; }).join('') + '</select></b></div>'
      + (t.admin ? '<div class="bo-kv"><span>Administrador inicial</span><b>' + esc(t.admin.nome) + ' · ' + esc(t.admin.email) + ' · convite até ' + fmtD(t.admin.expira) + '</b></div>' : '')
      + '<div class="bo-sec">Recursos · ' + contagem(t) + ' de ' + FLAGS.length + ' ligados</div>'
      + '<div class="bo-tw"><table class="bo-t"><thead><tr><th>Recurso</th><th>Estado</th><th>Por quê</th><th></th></tr></thead><tbody>' + flags + '</tbody></table></div>'
      + (peds.length ? '<div class="bo-sec">Pedidos de liberação da organização</div><div class="bo-tl">' + peds.map(function (p) {
        return '<div class="bo-tl-l"><span class="bo-tl-q">' + fmtDH(p.em) + '</span><span class="bo-min0"><b>' + esc(p.id) + ' · ' + esc(flag(p.flag).nome) + '</b><span class="bo-sub">' + esc(p.por) + ' · ' + esc(p.motivo) + '</span></span>'
          + (pode('flag_org') ? '<span class="bo-acoes"><button class="btn bo-btn-sm" onclick="shBo.liberarPedido(\'' + p.id + '\')">Liberar</button><button class="btn bo-btn-sm" onclick="shBo.recusarPedido(\'' + p.id + '\')">Recusar</button></span>' : '') + '</div>';
      }).join('') + '</div>' : '')
      + '<div class="bo-sec">Saúde das integrações</div><div class="bo-tags bo-tags-click" onclick="shBo.saude(\'' + t.id + '\')">' + INTEG.map(function (i) { var s = estadoInteg(t, i); return '<span class="bo-tag">' + esc(i.nome) + ' ' + chip(SST[s][1], SST[s][0]) + '</span>'; }).join('') + '</div>'
      + (ck ? '<div class="bo-sec">Implantação</div><div class="bo-ck">' + ck.map(function (c, i) {
        return '<label class="bo-ck-l"><input type="checkbox"' + (c.ok ? ' checked' : '') + (pode('org') ? '' : ' disabled') + ' onchange="shBo.marcar(\'' + t.id + '\',' + i + ',this.checked)"> ' + esc(c.t) + (c.opc ? ' <span class="bo-sub">opcional</span>' : '') + '</label>';
      }).join('') + '</div>' : '')
      + '<div class="bo-sec">Situação</div><div class="bo-acoes">' + (acoes.length ? acoes.map(function (a) { return '<button class="btn bo-btn-sm' + (a[0] === 'suspender' ? ' bo-btn-red' : '') + '" onclick="shBo.situacao(\'' + t.id + '\',\'' + a[0] + '\')">' + a[1] + '</button>'; }).join('') : '<span class="bo-sub">sem ação</span>')
      + (t.id !== ST.atual ? ' <button class="btn bo-btn-sm" onclick="shBo.abrirNoApp(\'' + t.id + '\')">Ver o app como esta organização</button>' : '') + '</div>'
      + '<div class="bo-sec">Trilha desta organização</div><div class="bo-tl">' + (ST.trilha.filter(function (l) { return l.tenant === t.nome; }).map(function (l) {
        return '<div class="bo-tl-l"><span class="bo-tl-q">' + fmtDH(l.em) + '</span><span class="bo-min0"><b>' + esc(l.acao) + '</b><span class="bo-sub">' + esc(l.det) + '</span></span></div>';
      }).join('') || '<span class="bo-sub">sem mudanças nesta sessão</span>') + '</div>'
      + '</div><div class="bo-rodape"><button class="btn" onclick="document.getElementById(\'' + oid + '\').remove()">Fechar</button></div>');
  }

  // toda mudança pede motivo
  function pedirMotivo(titulo, sub, cb) {
    var id = 'bo-mot-ov';
    ST._cb = cb;
    overlay(id, 440, cab(id, '✎', titulo, sub)
      + '<div class="mbox-col bo-col"><div class="bo-campo"><label for="bo-mot">Motivo</label><textarea id="bo-mot" class="bo-in" rows="2" placeholder="Fica na trilha de auditoria"></textarea></div></div>'
      + rodape(id, 'O motivo é obrigatório.', 'Confirmar', 'shBo._confirmar()'));
    setTimeout(function () { var e = document.getElementById('bo-mot'); if (e) e.focus(); }, 30);
  }
  function _confirmar() {
    var m = ((document.getElementById('bo-mot') || {}).value || '').trim();
    if (!m) { var st = document.getElementById('bo-mot-ov-st'); if (st) { st.textContent = 'Informe o motivo.'; st.className = 'bo-rodape-st amb'; } return; }
    fechar('bo-mot-ov');
    var cb = ST._cb; ST._cb = null; if (cb) cb(m);
  }
  function depois(t) { render(); aplicarNoApp(); renderRecursosApp(); if (t && document.getElementById('bo-org-ov')) org(t.id); }
  function trocar(id, k, on) {
    if (!exigir('flag_org')) return;
    var t = tenant(id), f = flag(k);
    pedirMotivo((on ? 'Ligar ' : 'Desligar ') + f.nome, t.nome + ' · exceção ao plano ' + plano(t.plano).nome, function (m) {
      t.over[k] = { on: on, motivo: m, por: op(), em: agora() };
      log(t.nome, (on ? 'Recurso ligado' : 'Recurso desligado') + ' por exceção', f.nome + ' · ' + m);
      toast(f.nome + (on ? ' ligado' : ' desligado') + ' para ' + t.nome + (t.id === ST.atual ? '. O app já reflete.' : '.'));
      depois(t);
    });
  }
  function voltarPlano(id, k) {
    if (!exigir('flag_org')) return;
    var t = tenant(id), f = flag(k);
    pedirMotivo('Voltar ao plano: ' + f.nome, t.nome, function (m) {
      delete t.over[k];
      log(t.nome, 'Exceção removida', f.nome + ' volta ao padrão do plano ' + plano(t.plano).nome + ' · ' + m);
      depois(t);
    });
  }
  function mudarPlano(id, p) {
    var t = tenant(id), de = plano(t.plano).nome;
    if (!exigir('plano')) { org(id); return; }
    pedirMotivo('Mudar o plano', t.nome + ' · ' + de + ' → ' + plano(p).nome, function (m) {
      t.plano = p; log(t.nome, 'Plano alterado', de + ' → ' + plano(p).nome + ' · ' + m); depois(t);
    });
    var s = document.querySelector('#bo-org-ov .bo-sel'); if (s) s.value = t.plano;
  }
  function situacao(id, a) {
    if (!exigir('org')) return;
    var t = tenant(id);
    var falta = a === 'ativar' && t.checklist ? t.checklist.filter(function (c) { return !c.ok && !c.opc; }) : [];
    if (falta.length) { toast('Faltam ' + falta.length + ' etapas da implantação para ativar: ' + falta.map(function (c) { return c.t.charAt(0).toLowerCase() + c.t.slice(1); }).join('; ') + '.', true); return; }
    var mapa = { ativar: ['ativa', 'Produção', 'Organização ativada em produção'], suspender: ['suspensa', t.amb, 'Organização suspensa'], reativar: ['ativa', t.amb, 'Organização reativada'] }[a];
    pedirMotivo(mapa[2], t.nome, function (m) {
      t.sit = mapa[0]; t.amb = mapa[1]; log(t.nome, mapa[2], m);
      toast(mapa[2] + ': ' + t.nome + '.'); depois(t);
    });
  }
  function marcar(id, i, ok) {
    var t = tenant(id); if (!t || !t.checklist) return;
    if (!exigir('org')) { org(id); return; }
    t.checklist[i].ok = ok; log(t.nome, ok ? 'Etapa de implantação concluída' : 'Etapa de implantação reaberta', t.checklist[i].t);
  }
  function abrirNoApp(id) {
    var t = tenant(id); ST.atual = id; log(t.nome, 'App aberto como esta organização', 'visão do protótipo');
    toast('O app passa a refletir os recursos de ' + t.nome + '. Os dados de exemplo continuam os da Induspar.');
    fechar('bo-org-ov'); render(); aplicarNoApp(); renderRecursosApp();
  }

  /* ── Flag: detalhe e desligamento global ──────────────────────────────── */
  function verFlag(k) {
    var f = flag(k), g = ST.global[k], id = 'bo-flag-ov';
    overlay(id, 760, cab(id, '⚑', esc(f.nome), esc(f.k) + ' · ' + esc(f.mod) + ' · ' + EST[f.estagio][0])
      + '<div class="mbox-col bo-col"><p class="bo-p">' + esc(f.desc) + '</p>'
      + '<div class="bo-kv"><span>Entrega</span><b>' + entregaChip(k) + '</b></div>'
      + '<div class="bo-kv"><span>Na plataforma</span><b>' + (g.on ? chip('teal', 'ligada') : chip('red', 'desligada') + ' <span class="bo-sub">' + esc(g.motivo) + '</span>') + '</b></div>'
      + '<div class="bo-kv"><span>Depende de</span><b>' + esc((f.dep || []).map(function (d) { return flag(d).nome; }).join(', ') || '—') + '</b></div>'
      + '<div class="bo-kv"><span>No app, quando desligada</span><b>' + (f.alvo.length ? 'some da navegação' : (f.estagio === 'nucleo' ? 'não se aplica — núcleo' : 'efeito dentro do módulo, na versão final')) + '</b></div>'
      + (f.estagio !== 'nucleo' && pode('flag_global') ? '<div class="bo-acoes bo-mt"><button class="btn bo-btn-sm' + (g.on ? ' bo-btn-red' : '') + '" onclick="shBo.global(\'' + k + '\',' + (!g.on) + ')">' + (g.on ? 'Desligar para todas as organizações' : 'Religar na plataforma') + '</button></div>' : '')
      + '<div class="bo-sec">Organizações</div><div class="bo-tw"><table class="bo-t"><thead><tr><th>Organização</th><th>Estado</th><th>Por quê</th><th></th></tr></thead><tbody>'
      + ST.tenants.map(function (t) {
        var e = efetiva(t, k), muda = ['nucleo', 'global', 'dependencia', 'entrega'].indexOf(e.fonte) < 0 && pode('flag_org');
        return '<tr><td><b>' + esc(t.nome) + '</b></td><td>' + (e.on ? chip('teal', 'ligada') : chip('gray', 'desligada')) + '</td><td class="bo-sub2">' + esc(e.rot) + '</td>'
          + '<td class="r">' + (muda ? '<button class="btn bo-btn-sm" onclick="shBo.trocar(\'' + t.id + '\',\'' + k + '\',' + (!e.on) + ')">' + (e.on ? 'Desligar' : 'Ligar') + '</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>'
      + '<div class="bo-rodape"><button class="btn" onclick="document.getElementById(\'' + id + '\').remove()">Fechar</button></div>');
  }
  function global(k, on) {
    if (!exigir('flag_global')) return;
    var f = flag(k);
    pedirMotivo((on ? 'Religar ' : 'Desligar ') + f.nome + ' na plataforma', on ? 'Volta a valer o plano e as exceções de cada organização' : 'Vale para todas as organizações, por cima do plano e das exceções', function (m) {
      ST.global[k] = { on: on, motivo: on ? '' : m };
      log('todas', on ? 'Flag religada na plataforma' : 'Flag desligada na plataforma', f.nome + ' · ' + m);
      toast(f.nome + (on ? ' religada' : ' desligada') + ' na plataforma.');
      render(); aplicarNoApp(); verFlag(k);
    });
  }

  /* ── Nova organização ─────────────────────────────────────────────────── */
  function nova() {
    if (!exigir('org')) return;
    var id = 'bo-nova-ov';
    function c(i, r, ph, t) { return '<div class="bo-campo"><label for="' + i + '">' + r + '</label><input id="' + i + '" class="bo-in" type="' + (t || 'text') + '" placeholder="' + esc(ph || '') + '" oninput="shBo.validarNova()"></div>'; }
    overlay(id, 640, cab(id, '+', 'Nova organização', 'Cadastro de tenant · nasce em implantação, no ambiente de homologação')
      + '<div class="mbox-col bo-col">'
      + '<div class="bo-sec">1 · Empresa</div><div class="bo-duo">' + c('bo-n-razao', 'Razão social', 'Como no cartão CNPJ') + c('bo-n-fantasia', 'Nome fantasia', 'Opcional') + '</div>'
      + '<div class="bo-duo">' + c('bo-n-raiz', 'CNPJ raiz — 8 dígitos', '00.000.000') + '<div class="bo-campo"><label for="bo-n-seg">Segmento</label><select id="bo-n-seg" class="bo-in"><option>Indústria</option><option>Comércio</option><option>Serviços</option><option>Telecom</option><option>Agro</option></select></div></div>'
      + '<div class="bo-sec">2 · Estabelecimentos</div><div class="bo-campo"><label for="bo-n-cnpjs">CNPJs da organização — um por linha; a lista completa vem na implantação, por CSV</label><textarea id="bo-n-cnpjs" class="bo-in" rows="3" placeholder="00.000.000/0001-00" oninput="shBo.validarNova()"></textarea></div>'
      + '<div class="bo-sec">3 · Administrador inicial</div><div class="bo-duo">' + c('bo-n-adm', 'Nome', 'Quem administra a organização') + c('bo-n-email', 'E-mail', 'nome@empresa.com.br', 'email') + '</div>'
      + '<div class="bo-sub">Recebe o convite de 7 dias e cria a própria senha no primeiro acesso, como os demais usuários.</div>'
      + '<div class="bo-sec">4 · Plano e recursos</div><div class="bo-planos-op">' + PLANOS.filter(function (p) { return p.ativo !== false; }).map(function (p, i) {
        return '<label class="bo-popt"><input type="radio" name="bo-n-plano" value="' + p.k + '"' + (i === 0 ? ' checked' : '') + ' onchange="shBo.validarNova()"><span class="bo-min0"><b>' + p.nome + '</b><small>' + esc(p.desc) + '</small></span></label>';
      }).join('') + '</div>'
      + '<div class="bo-sub">As exceções por recurso são feitas depois, no detalhe da organização.</div>'
      + '<div id="bo-n-resumo"></div></div>'
      + rodape(id, 'Preencha a empresa, o CNPJ raiz e o administrador.', 'Criar organização', 'shBo.criar()'));
    setTimeout(function () { var e = document.getElementById('bo-n-razao'); if (e) e.focus(); validarNova(); }, 30);
  }
  function valNova() {
    var g = function (i) { return ((document.getElementById(i) || {}).value || '').trim(); };
    var razao = g('bo-n-razao'), raiz = g('bo-n-raiz'), adm = g('bo-n-adm'), email = g('bo-n-email').toLowerCase();
    var cnpjs = g('bo-n-cnpjs').split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
    var pl = (document.querySelector('input[name="bo-n-plano"]:checked') || {}).value || 'essencial';
    var falta = [];
    if (!razao) falta.push('razão social');
    var dig = raiz.replace(/\D/g, '');
    if (dig.length !== 8) falta.push('CNPJ raiz com 8 dígitos');
    else if (ST.tenants.some(function (t) { return t.raiz.replace(/\D/g, '') === dig; })) falta.push('CNPJ raiz que ainda não seja de outra organização');
    var ruins = cnpjs.filter(function (c) { return c.replace(/\D/g, '').slice(0, 8) !== dig; });
    if (cnpjs.length && dig.length === 8 && ruins.length) falta.push('estabelecimentos da mesma raiz (' + ruins.length + ' fora)');
    if (!adm) falta.push('nome do administrador');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) falta.push('e-mail do administrador');
    return { ok: !falta.length, falta: falta, razao: razao, raiz: dig, adm: adm, email: email, cnpjs: cnpjs, plano: pl, fantasia: g('bo-n-fantasia') };
  }
  function validarNova() {
    var v = valNova(), st = document.getElementById('bo-nova-ov-st'), res = document.getElementById('bo-n-resumo');
    if (st) { st.textContent = v.ok ? 'Tudo preenchido' : 'Falta: ' + v.falta.join(', '); st.className = 'bo-rodape-st ' + (v.ok ? 'ok' : 'amb'); }
    if (res) {
      var on = FLAGS.filter(function (f) { return ST.global[f.k].on && (f.estagio === 'nucleo' || plano(v.plano).liga.indexOf(f.k) >= 0); }).length;
      res.innerHTML = v.razao ? '<div class="bo-caixa"><div class="bo-caixa-t">Resumo</div><b>' + esc(v.razao) + '</b> nasce <b>em implantação</b>, em homologação, no plano <b>' + esc(plano(v.plano).nome) + '</b>, com ' + on + ' recursos ligados e '
        + (v.cnpjs.length || 0) + ' estabelecimento' + (v.cnpjs.length === 1 ? '' : 's') + ' cadastrado' + (v.cnpjs.length === 1 ? '' : 's') + '. ' + (v.email ? esc(v.email) + ' recebe o convite de administrador.' : '') + '</div>' : '';
    }
    return v;
  }
  function criar() {
    var v = validarNova(); if (!v.ok) return;
    ST.seq += 1;
    var raizF = v.raiz.slice(0, 2) + '.' + v.raiz.slice(2, 5) + '.' + v.raiz.slice(5, 8);
    var t = { id: 'ten_' + v.raiz, nome: v.razao, raiz: raizF, plano: v.plano, sit: 'implantacao', amb: 'Homologação', cnpjs: v.cnpjs.length, usuarios: 1, criada: agora(), over: {},
      admin: { nome: v.adm, email: v.email, expira: dias(7) },
      checklist: checklist(v.cnpjs.length > 0 ? 1 : 0) };
    ST.tenants.push(t);
    semearSaude(t);
    INTEG.forEach(function (i) { if (i.k !== 'cert') ST.saude[t.id][i.k].st = 'nao_config'; });
    log(t.nome, 'Organização criada', 'CNPJ raiz ' + raizF + ' · plano ' + plano(v.plano).nome + ' · ' + v.cnpjs.length + ' estabelecimentos · em implantação');
    log(t.nome, 'Convite de administrador enviado', v.adm + ' · ' + v.email + ' · vale 7 dias (simulado)');
    fechar('bo-nova-ov');
    toast(t.nome + ' criada em implantação. Convite enviado a ' + v.email + ' (simulado).');
    render(); org(t.id);
  }

  /* ── Sessão (protótipo) e usuários da plataforma ──────────────────────── */
  function verComo(id) { ST.op = id; log('—', 'Sessão trocada no protótipo', op()); toast('Agora como ' + op() + '.'); render(); }
  function adminsAtivos() { return ST.operadores.filter(function (o) { return o.perfil === 'admin' && o.sit === 'ativo'; }); }
  function operador(id) { return ST.operadores.filter(function (o) { return o.id === id; })[0]; }
  function convidarOp() {
    if (!exigir('usuarios')) return;
    var id = 'bo-op-ov';
    overlay(id, 520, cab(id, '+', 'Convidar usuário da plataforma', 'Convite de 7 dias · MFA no primeiro acesso')
      + '<div class="mbox-col bo-col"><div class="bo-duo"><div class="bo-campo"><label for="bo-o-nome">Nome</label><input id="bo-o-nome" class="bo-in"></div>'
      + '<div class="bo-campo"><label for="bo-o-email">E-mail — domínio splithub.com.br</label><input id="bo-o-email" class="bo-in" type="email" placeholder="nome@splithub.com.br"></div></div>'
      + '<div class="bo-campo"><label for="bo-o-perfil">Perfil global</label><select id="bo-o-perfil" class="bo-in">' + Object.keys(PERFIS).map(function (p) { return '<option value="' + p + '"' + (p === 'suporte' ? ' selected' : '') + '>' + esc(PERFIS[p].nome) + '</option>'; }).join('') + '</select></div>'
      + '<div class="bo-sub bo-mt">O perfil global não abre os dados de nenhuma organização.</div></div>'
      + rodape(id, 'Nome, e-mail e perfil.', 'Enviar convite', 'shBo.criarOp()'));
  }
  function criarOp() {
    var g = function (i) { return ((document.getElementById(i) || {}).value || '').trim(); };
    var nome = g('bo-o-nome'), email = g('bo-o-email').toLowerCase(), perfil = g('bo-o-perfil'), st = document.getElementById('bo-op-ov-st');
    var erro = !nome ? 'Informe o nome.' : (!/^[^@\s]+@splithub\.com\.br$/.test(email) ? 'Use um e-mail do domínio splithub.com.br.' : (ST.operadores.some(function (o) { return o.email === email; }) ? 'Já existe um usuário com este e-mail.' : ''));
    if (erro) { if (st) { st.textContent = erro; st.className = 'bo-rodape-st amb'; } return; }
    var o = { id: 'op' + (ST.operadores.length + 1), nome: nome, email: email, perfil: perfil, sit: 'convidado', mfa: false, expira: dias(7), ultimo: null };
    ST.operadores.push(o);
    log('—', 'Usuário da plataforma convidado', nome + ' · ' + email + ' · ' + PERFIS[perfil].nome + ' · convite até ' + fmtD(o.expira));
    fechar('bo-op-ov'); toast('Convite enviado a ' + email + ' (simulado).'); render();
  }
  function primeiroAcesso(id) {
    var o = operador(id); if (!o) return;
    o.sit = 'ativo'; o.mfa = true; o.ultimo = agora(); delete o.expira;
    log('—', 'Primeiro acesso de usuário da plataforma', o.nome + ' · senha criada e MFA configurado (simulado)', o.nome);
    render();
  }
  function perfilOp(id) {
    if (!exigir('usuarios')) return;
    var o = operador(id), oid = 'bo-perf-ov';
    ST._opPerf = id;
    overlay(oid, 460, cab(oid, '⇄', 'Trocar perfil global', esc(o.nome) + ' · hoje ' + esc(PERFIS[o.perfil].nome))
      + '<div class="mbox-col bo-col"><div class="bo-campo"><label for="bo-p-novo">Novo perfil</label><select id="bo-p-novo" class="bo-in">' + Object.keys(PERFIS).filter(function (p) { return p !== o.perfil; }).map(function (p) { return '<option value="' + p + '">' + esc(PERFIS[p].nome) + '</option>'; }).join('') + '</select></div>'
      + '<div class="bo-campo"><label for="bo-p-mot">Motivo</label><textarea id="bo-p-mot" class="bo-in" rows="2"></textarea></div></div>'
      + rodape(oid, 'O motivo fica na trilha.', 'Trocar perfil', 'shBo.salvarPerfilOp()'));
  }
  function salvarPerfilOp() {
    var o = operador(ST._opPerf), novo = document.getElementById('bo-p-novo').value, m = document.getElementById('bo-p-mot').value.trim(), st = document.getElementById('bo-perf-ov-st');
    if (!m) { st.textContent = 'Informe o motivo.'; st.className = 'bo-rodape-st amb'; return; }
    if (o.perfil === 'admin' && adminsAtivos().length === 1) { st.textContent = 'É o último administrador ativo da plataforma. Promova outro antes.'; st.className = 'bo-rodape-st amb'; return; }
    var de = PERFIS[o.perfil].nome; o.perfil = novo;
    log('—', 'Perfil global trocado', o.nome + ' · ' + de + ' → ' + PERFIS[novo].nome + ' · ' + m);
    fechar('bo-perf-ov'); render();
  }
  function desativarOp(id) {
    if (!exigir('usuarios')) return;
    var o = operador(id);
    if (id === ST.op) { toast('Você não pode desativar a própria conta.', true); return; }
    if (o.perfil === 'admin' && adminsAtivos().length === 1) { toast('É o último administrador ativo da plataforma.', true); return; }
    pedirMotivo('Desativar ' + o.nome, 'As sessões abertas são encerradas na hora', function (m) {
      o.sit = 'inativo'; o.motivo = m; log('—', 'Usuário da plataforma desativado', o.nome + ' · sessões encerradas · ' + m); render();
    });
  }
  function reativarOp(id) {
    if (!exigir('usuarios')) return;
    var o = operador(id);
    pedirMotivo('Reativar ' + o.nome, 'Volta com o perfil ' + PERFIS[o.perfil].nome, function (m) {
      o.sit = 'ativo'; delete o.motivo; log('—', 'Usuário da plataforma reativado', o.nome + ' · ' + m); render();
    });
  }

  /* ── Saúde: detalhe, verificação e incidente ──────────────────────────── */
  function verSaude(tid) {
    var t = tenant(tid), s = ST.saude[tid], id = 'bo-saude-ov';
    overlay(id, 900, cab(id, '♥', 'Saúde das integrações · ' + esc(t.nome), SIT[t.sit][0] + ' · ' + esc(t.amb) + ' · verificação a cada 5 minutos')
      + '<div class="mbox-col bo-col"><div class="bo-tw"><table class="bo-t"><thead><tr><th>Integração</th><th>Situação</th><th class="r">p95</th><th class="r">Sucesso 24 h</th><th class="r">Fila</th><th>Última verificação</th><th>Últimas 6 h</th></tr></thead><tbody>'
      + INTEG.map(function (i) {
        var c = s[i.k], e = estadoInteg(t, i), hist = c.hist.slice(-6);
        var det = i.k === 'cert' ? (c.vence ? 'vence em ' + fmtD(c.vence) : '—') : (c.erro || '');
        return '<tr><td><b>' + esc(i.nome) + '</b><span class="bo-sub">' + esc(i.sub) + (det ? ' · ' + esc(det) : '') + '</span></td><td>' + chip(SST[e][1], SST[e][0]) + '</td>'
          + '<td class="r">' + (c.p95 && ['ok', 'degradado', 'falha'].indexOf(e) >= 0 ? c.p95 + ' ms' : '—') + '</td><td class="r">' + (c.suc != null && ['ok', 'degradado', 'falha'].indexOf(e) >= 0 ? String(c.suc).replace('.', ',') + '%' : '—') + '</td>'
          + '<td class="r">' + (['ok', 'degradado', 'falha'].indexOf(e) >= 0 ? c.fila : '—') + '</td><td>' + fmtDH(c.ultima) + '</td>'
          + '<td><span class="bo-hist">' + hist.map(function (h) { return '<i class="bo-hd ' + (SST[h.st] || SST.ok)[1] + '" title="' + fmtDH(h.em) + ' · ' + (SST[h.st] || SST.ok)[0] + '"></i>'; }).join('') + '</span></td></tr>';
      }).join('') + '</tbody></table></div>'
      + '<div class="bo-sub bo-mt">Os limites de tempo e de retentativa são os da qualidade de serviço por ator, em Configurações › Eventos fiscais da organização. Receita Federal e Comitê Gestor são verificados em separado.</div></div>'
      + '<div class="bo-rodape">' + (pode('saude') ? '<button class="btn" onclick="shBo.verificar(\'' + tid + '\')">Verificar agora</button>' : '') + '<button class="btn" onclick="document.getElementById(\'' + id + '\').remove()">Fechar</button></div>');
  }
  function verificar(tid) {
    if (!exigir('saude')) return;
    var alvo = tid ? [tenant(tid)] : ST.tenants, rec = 0, falhas = 0;
    alvo.forEach(function (t) {
      INTEG.forEach(function (i) {
        var c = ST.saude[t.id][i.k], e = estadoInteg(t, i);
        if (['ok', 'degradado', 'falha'].indexOf(e) < 0) return;
        c.ultima = agora();
        if (c.st === 'degradado' && i.k !== 'cert') { c.st = 'ok'; c.p95 = 900; c.suc = 99.5; c.fila = 0; c.erro = ''; rec++; }
        if (c.st === 'falha') { c.tent = (c.tent || 3) + 1; c.erro = c.erro.replace(/\d+ tentativas/, c.tent + ' tentativas'); falhas++; }
        c.hist.push({ em: agora(), st: i.k === 'cert' ? estadoInteg(t, i) : c.st, ms: c.p95 });
      });
    });
    log(tid ? tenant(tid).nome : 'todas', 'Verificação de integrações', rec + ' normalizada' + (rec === 1 ? '' : 's') + ' · ' + falhas + ' ainda em falha');
    toast('Verificação concluída: ' + rec + ' normalizada' + (rec === 1 ? '' : 's') + ', ' + falhas + ' em falha.');
    render(); if (tid && document.getElementById('bo-saude-ov')) verSaude(tid);
  }
  function resolverInc(iid) {
    if (!exigir('saude')) return;
    var inc = ST.incidentes.filter(function (i) { return i.id === iid; })[0], t = tenant(inc.tenant);
    pedirMotivo('Encerrar ' + inc.id, t.nome, function (m) {
      inc.sit = 'encerrado'; inc.fim = agora();
      var c = ST.saude[t.id][inc.integ]; c.st = 'ok'; c.suc = 99.0; c.fila = 0; c.erro = ''; c.hist.push({ em: agora(), st: 'ok', ms: c.p95 });
      log(t.nome, 'Incidente de integração encerrado', inc.id + ' · ' + m); render();
    });
  }

  /* ── No app da organização: recursos liberados e pedido de liberação ──── */
  var POR_QUE = {
    nucleo: function () { return 'Incluído em todos os planos'; },
    plano: function (e, t) { return (e.on ? 'Incluído' : 'Não incluído') + ' no plano ' + plano(t.plano).nome; },
    excecao: function (e, t, k) { return e.on ? 'Liberado pela SplitHub' : 'Desligado por acordo · ' + t.over[k].motivo; },
    global: function () { return 'Indisponível no momento'; },
    dependencia: function (e) { return e.rot.charAt(0).toUpperCase() + e.rot.slice(1); },
    entrega: function () { return 'Em avaliação — ainda não disponível'; }
  };
  function renderRecursosApp() {
    var sv = document.getElementById('admin-organizacao'); if (!sv) return;
    var old = document.getElementById('bo-app-rec');
    if (!entregue('backoffice_plataforma') || !entregue('flags_por_organizacao')) { if (old) old.remove(); return; }
    semear();
    var t = tenant(ST.atual);
    var h = '<div class="sechdr"><h2>Recursos da organização</h2><p>O que a SplitHub liberou para ' + esc(t.nome) + ', no plano ' + esc(plano(t.plano).nome) + '. O que não estiver liberado pode ser pedido à operação da plataforma.</p></div>'
      + '<div class="bo-tw bo-mt"><table class="bo-t"><thead><tr><th>Recurso</th><th>Situação</th><th>Por quê</th><th></th></tr></thead><tbody>'
      + FLAGS.map(function (f) {
        var e = efetiva(t, f.k), ped = ST.pedidos.filter(function (p) { return p.tenant === t.id && p.flag === f.k; }).slice(-1)[0];
        var ac = '';
        if (!e.on && (e.fonte === 'plano' || e.fonte === 'excecao')) {
          ac = ped && ped.sit === 'aberto' ? chip('amber', 'pedido em análise') : '<button class="btn bo-btn-sm" onclick="shBo.pedirLiberacao(\'' + f.k + '\')">Pedir liberação</button>'
            + (ped && ped.sit === 'recusado' ? '<span class="bo-sub">último pedido recusado: ' + esc(ped.resposta) + '</span>' : '');
        }
        return '<tr><td><b>' + esc(f.nome) + '</b><span class="bo-sub">' + esc(f.desc) + '</span></td><td>' + (e.on ? chip('teal', 'liberado') : chip('gray', 'não liberado')) + '</td>'
          + '<td class="bo-sub2">' + esc(POR_QUE[e.fonte](e, t, f.k)) + '</td><td class="r">' + ac + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    if (!old) { old = document.createElement('div'); old.id = 'bo-app-rec'; old.className = 'crd bo-app-rec'; var kg = sv.querySelector('.kgrid'); if (kg) kg.insertAdjacentElement('afterend', old); else sv.prepend(old); }
    old.innerHTML = h;
  }
  function pedirLiberacao(k) {
    var t = tenant(ST.atual), f = flag(k), id = 'bo-ped-ov';
    ST._ped = k;
    overlay(id, 460, cab(id, '↗', 'Pedir liberação · ' + esc(f.nome), esc(t.nome) + ' · vai para a operação da SplitHub')
      + '<div class="mbox-col bo-col"><div class="bo-campo"><label for="bo-ped-mot">Para que a organização vai usar</label><textarea id="bo-ped-mot" class="bo-in" rows="3"></textarea></div>'
      + '<div class="bo-sub bo-mt">A liberação pode mudar o plano ou o contrato. A resposta aparece aqui.</div></div>'
      + rodape(id, 'Conte o uso pretendido.', 'Enviar pedido', 'shBo._enviarPedido()'));
  }
  function _enviarPedido() {
    var m = (document.getElementById('bo-ped-mot').value || '').trim(), st = document.getElementById('bo-ped-ov-st');
    if (!m) { st.textContent = 'Conte o uso pretendido.'; st.className = 'bo-rodape-st amb'; return; }
    var t = tenant(ST.atual), k = ST._ped, p = { id: 'PL-' + ('000' + (ST.pedidos.length + 1)).slice(-4), tenant: t.id, flag: k, por: 'Administrador da organização', em: agora(), sit: 'aberto', motivo: m };
    ST.pedidos.push(p);
    log(t.nome, 'Pedido de liberação recebido', p.id + ' · ' + flag(k).nome + ' · ' + m, 'Administrador da organização');
    fechar('bo-ped-ov'); toast('Pedido ' + p.id + ' enviado à operação da SplitHub.'); renderRecursosApp(); render();
  }
  function pedido(pid) { return ST.pedidos.filter(function (p) { return p.id === pid; })[0]; }
  function liberarPedido(pid) {
    if (!exigir('flag_org')) return;
    var p = pedido(pid), t = tenant(p.tenant), f = flag(p.flag);
    pedirMotivo('Liberar ' + f.nome, t.nome + ' · ' + p.id + ' · exceção ao plano ' + plano(t.plano).nome, function (m) {
      t.over[p.flag] = { on: true, motivo: p.id + ' · ' + m, por: op(), em: agora() };
      p.sit = 'liberado'; p.resposta = m;
      log(t.nome, 'Pedido de liberação atendido', p.id + ' · ' + f.nome + ' ligado por exceção · ' + m);
      toast(f.nome + ' liberado para ' + t.nome + '.'); depois(t);
    });
  }
  function recusarPedido(pid) {
    if (!exigir('flag_org')) return;
    var p = pedido(pid), t = tenant(p.tenant), f = flag(p.flag);
    pedirMotivo('Recusar o pedido ' + p.id, t.nome + ' · ' + f.nome + ' · a organização vê o motivo', function (m) {
      p.sit = 'recusado'; p.resposta = m;
      log(t.nome, 'Pedido de liberação recusado', p.id + ' · ' + f.nome + ' · ' + m); depois(t);
    });
  }

  /* ── Entrada ──────────────────────────────────────────────────────────── */
  window.shBo = {
    entrar: entrar, abrir: abrir, sair: sair, aba: aba, org: org, flag: verFlag, trocar: trocar, voltarPlano: voltarPlano, mudarPlano: mudarPlano,
    situacao: situacao, marcar: marcar, abrirNoApp: abrirNoApp, global: global, nova: nova, validarNova: validarNova, criar: criar,
    planoEditar: planoEditar, planoImpacto: planoImpacto, planoSalvar: planoSalvar, planoAposentar: planoAposentar,
    verComo: verComo, convidarOp: convidarOp, criarOp: criarOp, primeiroAcesso: primeiroAcesso, perfilOp: perfilOp, salvarPerfilOp: salvarPerfilOp,
    desativarOp: desativarOp, reativarOp: reativarOp, saude: verSaude, verificar: verificar, resolverInc: resolverInc,
    pedirLiberacao: pedirLiberacao, _enviarPedido: _enviarPedido, liberarPedido: liberarPedido, recusarPedido: recusarPedido, recursosApp: renderRecursosApp,
    _confirmar: _confirmar, ligada: ligada, aplicarNoApp: aplicarNoApp, _efetiva: efetiva
  };
  // a rota #/backoffice está em rotas.js
  function inicio() {
    semear(); ligarCamada(); renderRecursosApp();
    var sub = document.getElementById('subnav-admin-organizacao');
    if (sub && !sub._bo) { sub.addEventListener('click', function () { setTimeout(renderRecursosApp, 30); }); sub._bo = true; }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(inicio, 300); });
  else setTimeout(inicio, 300);
})();

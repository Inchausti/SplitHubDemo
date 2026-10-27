/* ══ Backoffice da plataforma — administração global ════════════════════════
   O SplitHub serve várias organizações (tenants). Este painel é da operação
   da plataforma, não de uma organização:
     · organizações: lista, cadastro de uma nova, situação e implantação
     · feature flags: catálogo da plataforma, desligamento global (kill switch),
       padrão por plano e exceção por organização, sempre com motivo
     · planos e trilha de auditoria do backoffice
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
  var OPERADOR = 'Ana Souza · operação da plataforma';
  function toast(msg, erro) {
    fechar('bo-toast');
    var t = document.createElement('div');
    t.id = 'bo-toast'; t.className = 'bo-toast' + (erro ? ' erro' : ''); t.setAttribute('role', 'status'); t.textContent = msg;
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
    seq: 0, trilha: [], global: {}, tenants: [], atual: 'ten_induspar'
  };
  FLAGS.forEach(function (f) { ST.global[f.k] = { on: !f.globalOff, motivo: f.globalOff || '' }; });
  function log(tenant, acao, det) { ST.trilha.unshift({ em: agora(), por: OPERADOR, tenant: tenant, acao: acao, det: det || '' }); }
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
    T('ten_ferroplex', 'Ferroplex Mineração S.A.', '23.456.789', 'completo', 'ativa', 'Produção', 14, 21, dias(-150), { ressarcimento: { on: false, motivo: 'Fora do contrato atual', por: OPERADOR, em: dias(-40) } });
    T('ten_varejosul', 'Varejo Sul Comércio S.A.', '34.567.890', 'personalizado', 'suspensa', 'Produção', 32, 15, dias(-300), { portal_fornecedor: { on: true, motivo: 'Incluído no aditivo de 2026', por: OPERADOR, em: dias(-90) } });
    tenant('ten_metalsul').checklist = checklist(3);
    log('—', 'Catálogo de flags carregado', FLAGS.length + ' flags');
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
    aplicarNoApp();
  }
  function aba(k) { ABA = k; render(); }
  function render() {
    var r = document.getElementById('bo-root'); if (!r || r.hidden) return;
    var abas = [['orgs', 'Organizações'], ['flags', 'Feature flags'], ['planos', 'Planos'], ['trilha', 'Trilha de auditoria']];
    var h = '<header class="bo-top"><div class="bo-marca"><b>SplitHub</b><span>Backoffice da plataforma</span></div>'
      + '<div class="bo-top-d"><span class="bo-op">' + esc(OPERADOR) + '</span><button class="btn bo-btn-sm" onclick="shBo.sair()">Voltar ao app · ' + esc(tenant(ST.atual).nome.split(' ')[0]) + '</button></div></header>'
      + '<main class="bo-main"><div class="stabs bo-tabs">' + abas.map(function (a) { return '<button class="stab' + (ABA === a[0] ? ' active' : '') + '" onclick="shBo.aba(\'' + a[0] + '\')">' + a[1] + '</button>'; }).join('') + '</div>';
    if (ABA === 'orgs') h += telaOrgs();
    else if (ABA === 'flags') h += telaFlags();
    else if (ABA === 'planos') h += telaPlanos();
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
      + '<button class="btn btn-t" onclick="shBo.nova()">+ Nova organização</button></div>'
      + '<div class="kgrid k4">' + k('Organizações', T.length, 'na plataforma') + k('Ativas', n('ativa'), 'em produção') + k('Em implantação', n('implantacao'), 'em homologação') + k('Suspensas', n('suspensa'), 'sem acesso dos usuários') + '</div>'
      + '<div class="bo-tw bo-mt"><table class="bo-t"><thead><tr><th>Organização</th><th>CNPJ raiz</th><th>Plano</th><th>Situação</th><th>Ambiente</th><th class="r">Recursos ligados</th><th class="r">CNPJs</th><th class="r">Usuários</th><th>Desde</th><th></th></tr></thead><tbody>'
      + T.map(function (t) {
        return '<tr class="bo-tr-click" onclick="shBo.org(\'' + t.id + '\')"><td><b>' + esc(t.nome) + '</b>' + (t.id === ST.atual ? ' ' + chip('blue', 'aberta no app') : '') + '</td><td class="bo-mono">' + esc(t.raiz) + '</td>'
          + '<td>' + esc(plano(t.plano).nome) + (Object.keys(t.over).length ? ' <span class="bo-sub">+ ' + Object.keys(t.over).length + ' exceção' + (Object.keys(t.over).length > 1 ? 'ões' : '') + '</span>' : '') + '</td>'
          + '<td>' + chip(SIT[t.sit][1], SIT[t.sit][0]) + '</td><td>' + esc(t.amb) + '</td><td class="r">' + contagem(t) + ' de ' + FLAGS.length + '</td><td class="r">' + t.cnpjs + '</td><td class="r">' + t.usuarios + '</td><td>' + fmtD(t.criada) + '</td>'
          + '<td class="r"><button class="btn bo-btn-sm" onclick="event.stopPropagation();shBo.org(\'' + t.id + '\')">Abrir</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function telaFlags() {
    return '<div class="bo-hdr"><div><h2>Feature flags da plataforma</h2><p>O plano define o padrão; a organização pode ter exceção; a plataforma pode desligar um recurso para todos. Recurso do núcleo fica sempre ligado.</p></div></div>'
      + '<div class="bo-tw"><table class="bo-t"><thead><tr><th>Flag</th><th>Módulo</th><th>Estágio</th><th>Entrega</th><th>Na plataforma</th><th>Essencial</th><th>Completo</th><th>Depende de</th><th class="r">Organizações com ela</th></tr></thead><tbody>'
      + FLAGS.map(function (f) {
        var g = ST.global[f.k], nOn = ST.tenants.filter(function (t) { return efetiva(t, f.k).on; }).length;
        var pd = function (p) { return f.estagio === 'nucleo' ? '●' : (plano(p).liga.indexOf(f.k) >= 0 ? '●' : '—'); };
        return '<tr class="bo-tr-click" onclick="shBo.flag(\'' + f.k + '\')"><td><b>' + esc(f.nome) + '</b><span class="bo-sub bo-mono">' + esc(f.k) + '</span></td><td>' + esc(f.mod) + '</td><td>' + chip(EST[f.estagio][1], EST[f.estagio][0]) + '</td><td>' + entregaChip(f.k) + '</td>'
          + '<td>' + (g.on ? chip('teal', 'ligada') : chip('red', 'desligada')) + '</td><td class="bo-c">' + pd('essencial') + '</td><td class="bo-c">' + pd('completo') + '</td>'
          + '<td>' + esc((f.dep || []).map(function (d) { return flag(d).nome; }).join(', ') || '—') + '</td><td class="r">' + nOn + ' de ' + ST.tenants.length + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function telaPlanos() {
    return '<div class="bo-hdr"><div><h2>Planos</h2><p>O plano é o conjunto padrão de recursos. A edição de planos, preços e limites está na proposta do backoffice como recurso futuro.</p></div></div>'
      + '<div class="bo-planos">' + PLANOS.map(function (p) {
        var n = ST.tenants.filter(function (t) { return t.plano === p.k; }).length;
        return '<div class="bo-plano"><div class="bo-plano-h"><b>' + esc(p.nome) + '</b><span class="bo-sub">' + n + ' organizaç' + (n === 1 ? 'ão' : 'ões') + '</span></div><p class="bo-p">' + esc(p.desc) + '</p>'
          + '<div class="bo-tags">' + FLAGS.filter(function (f) { return f.estagio === 'nucleo' || p.liga.indexOf(f.k) >= 0; }).map(function (f) { return '<span class="bo-tag">' + esc(f.nome) + '</span>'; }).join('') + '</div></div>';
      }).join('') + '</div>';
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
      var e = efetiva(t, f.k), pode = ['nucleo', 'global', 'dependencia', 'entrega'].indexOf(e.fonte) < 0;
      return '<tr><td><b>' + esc(f.nome) + '</b><span class="bo-sub">' + esc(f.mod) + ' · ' + esc(EST[f.estagio][0]) + '</span></td>'
        + '<td>' + (e.on ? chip('teal', 'ligada') : chip('gray', 'desligada')) + '</td><td class="bo-sub2">' + esc(e.rot) + '</td>'
        + '<td class="r">' + (pode ? '<button class="btn bo-btn-sm" onclick="shBo.trocar(\'' + t.id + '\',\'' + f.k + '\',' + (!e.on) + ')">' + (e.on ? 'Desligar' : 'Ligar') + '</button>'
          + (t.over[f.k] ? ' <button class="btn bo-btn-sm" onclick="shBo.voltarPlano(\'' + t.id + '\',\'' + f.k + '\')">Voltar ao plano</button>' : '') : '') + '</td></tr>';
    }).join('');
    var acoes = { implantacao: [['ativar', 'Ativar em produção']], ativa: [['suspender', 'Suspender']], suspensa: [['reativar', 'Reativar']], encerrada: [] }[t.sit] || [];
    var ck = t.checklist;
    overlay(oid, 860, cab(oid, '🏢', esc(t.nome), 'CNPJ raiz ' + esc(t.raiz) + ' · ' + esc(plano(t.plano).nome) + ' · ' + SIT[t.sit][0] + ' · ' + esc(t.amb))
      + '<div class="mbox-col bo-col">'
      + '<div class="bo-kv"><span>Plano</span><b><select class="bo-in bo-sel" onchange="shBo.mudarPlano(\'' + t.id + '\',this.value)">' + PLANOS.map(function (p) { return '<option value="' + p.k + '"' + (p.k === t.plano ? ' selected' : '') + '>' + p.nome + '</option>'; }).join('') + '</select></b></div>'
      + (t.admin ? '<div class="bo-kv"><span>Administrador inicial</span><b>' + esc(t.admin.nome) + ' · ' + esc(t.admin.email) + ' · convite até ' + fmtD(t.admin.expira) + '</b></div>' : '')
      + '<div class="bo-sec">Recursos · ' + contagem(t) + ' de ' + FLAGS.length + ' ligados</div>'
      + '<div class="bo-tw"><table class="bo-t"><thead><tr><th>Recurso</th><th>Estado</th><th>Por quê</th><th></th></tr></thead><tbody>' + flags + '</tbody></table></div>'
      + (ck ? '<div class="bo-sec">Implantação</div><div class="bo-ck">' + ck.map(function (c, i) {
        return '<label class="bo-ck-l"><input type="checkbox"' + (c.ok ? ' checked' : '') + ' onchange="shBo.marcar(\'' + t.id + '\',' + i + ',this.checked)"> ' + esc(c.t) + (c.opc ? ' <span class="bo-sub">opcional</span>' : '') + '</label>';
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
  function depois(t) { render(); aplicarNoApp(); if (t && document.getElementById('bo-org-ov')) org(t.id); }
  function trocar(id, k, on) {
    var t = tenant(id), f = flag(k);
    pedirMotivo((on ? 'Ligar ' : 'Desligar ') + f.nome, t.nome + ' · exceção ao plano ' + plano(t.plano).nome, function (m) {
      t.over[k] = { on: on, motivo: m, por: OPERADOR, em: agora() };
      log(t.nome, (on ? 'Recurso ligado' : 'Recurso desligado') + ' por exceção', f.nome + ' · ' + m);
      toast(f.nome + (on ? ' ligado' : ' desligado') + ' para ' + t.nome + (t.id === ST.atual ? '. O app já reflete.' : '.'));
      depois(t);
    });
  }
  function voltarPlano(id, k) {
    var t = tenant(id), f = flag(k);
    pedirMotivo('Voltar ao plano: ' + f.nome, t.nome, function (m) {
      delete t.over[k];
      log(t.nome, 'Exceção removida', f.nome + ' volta ao padrão do plano ' + plano(t.plano).nome + ' · ' + m);
      depois(t);
    });
  }
  function mudarPlano(id, p) {
    var t = tenant(id), de = plano(t.plano).nome;
    pedirMotivo('Mudar o plano', t.nome + ' · ' + de + ' → ' + plano(p).nome, function (m) {
      t.plano = p; log(t.nome, 'Plano alterado', de + ' → ' + plano(p).nome + ' · ' + m); depois(t);
    });
    var s = document.querySelector('#bo-org-ov .bo-sel'); if (s) s.value = t.plano;
  }
  function situacao(id, a) {
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
    t.checklist[i].ok = ok; log(t.nome, ok ? 'Etapa de implantação concluída' : 'Etapa de implantação reaberta', t.checklist[i].t);
  }
  function abrirNoApp(id) {
    var t = tenant(id); ST.atual = id; log(t.nome, 'App aberto como esta organização', 'visão do protótipo');
    toast('O app passa a refletir os recursos de ' + t.nome + '. Os dados de exemplo continuam os da Induspar.');
    fechar('bo-org-ov'); render(); aplicarNoApp();
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
      + (f.estagio !== 'nucleo' ? '<div class="bo-acoes bo-mt"><button class="btn bo-btn-sm' + (g.on ? ' bo-btn-red' : '') + '" onclick="shBo.global(\'' + k + '\',' + (!g.on) + ')">' + (g.on ? 'Desligar para todas as organizações' : 'Religar na plataforma') + '</button></div>' : '')
      + '<div class="bo-sec">Organizações</div><div class="bo-tw"><table class="bo-t"><thead><tr><th>Organização</th><th>Estado</th><th>Por quê</th><th></th></tr></thead><tbody>'
      + ST.tenants.map(function (t) {
        var e = efetiva(t, k), pode = ['nucleo', 'global', 'dependencia', 'entrega'].indexOf(e.fonte) < 0;
        return '<tr><td><b>' + esc(t.nome) + '</b></td><td>' + (e.on ? chip('teal', 'ligada') : chip('gray', 'desligada')) + '</td><td class="bo-sub2">' + esc(e.rot) + '</td>'
          + '<td class="r">' + (pode ? '<button class="btn bo-btn-sm" onclick="shBo.trocar(\'' + t.id + '\',\'' + k + '\',' + (!e.on) + ')">' + (e.on ? 'Desligar' : 'Ligar') + '</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>'
      + '<div class="bo-rodape"><button class="btn" onclick="document.getElementById(\'' + id + '\').remove()">Fechar</button></div>');
  }
  function global(k, on) {
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
    var id = 'bo-nova-ov';
    function c(i, r, ph, t) { return '<div class="bo-campo"><label for="' + i + '">' + r + '</label><input id="' + i + '" class="bo-in" type="' + (t || 'text') + '" placeholder="' + esc(ph || '') + '" oninput="shBo.validarNova()"></div>'; }
    overlay(id, 640, cab(id, '+', 'Nova organização', 'Cadastro de tenant · nasce em implantação, no ambiente de homologação')
      + '<div class="mbox-col bo-col">'
      + '<div class="bo-sec">1 · Empresa</div><div class="bo-duo">' + c('bo-n-razao', 'Razão social', 'Como no cartão CNPJ') + c('bo-n-fantasia', 'Nome fantasia', 'Opcional') + '</div>'
      + '<div class="bo-duo">' + c('bo-n-raiz', 'CNPJ raiz — 8 dígitos', '00.000.000') + '<div class="bo-campo"><label for="bo-n-seg">Segmento</label><select id="bo-n-seg" class="bo-in"><option>Indústria</option><option>Comércio</option><option>Serviços</option><option>Telecom</option><option>Agro</option></select></div></div>'
      + '<div class="bo-sec">2 · Estabelecimentos</div><div class="bo-campo"><label for="bo-n-cnpjs">CNPJs da organização — um por linha; a lista completa vem na implantação, por CSV</label><textarea id="bo-n-cnpjs" class="bo-in" rows="3" placeholder="00.000.000/0001-00" oninput="shBo.validarNova()"></textarea></div>'
      + '<div class="bo-sec">3 · Administrador inicial</div><div class="bo-duo">' + c('bo-n-adm', 'Nome', 'Quem administra a organização') + c('bo-n-email', 'E-mail', 'nome@empresa.com.br', 'email') + '</div>'
      + '<div class="bo-sub">Recebe o convite de 7 dias e cria a própria senha no primeiro acesso, como os demais usuários.</div>'
      + '<div class="bo-sec">4 · Plano e recursos</div><div class="bo-planos-op">' + PLANOS.map(function (p, i) {
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
    log(t.nome, 'Organização criada', 'CNPJ raiz ' + raizF + ' · plano ' + plano(v.plano).nome + ' · ' + v.cnpjs.length + ' estabelecimentos · em implantação');
    log(t.nome, 'Convite de administrador enviado', v.adm + ' · ' + v.email + ' · vale 7 dias (simulado)');
    fechar('bo-nova-ov');
    toast(t.nome + ' criada em implantação. Convite enviado a ' + v.email + ' (simulado).');
    render(); org(t.id);
  }

  /* ── Entrada ──────────────────────────────────────────────────────────── */
  window.shBo = {
    entrar: entrar, abrir: abrir, sair: sair, aba: aba, org: org, flag: verFlag, trocar: trocar, voltarPlano: voltarPlano, mudarPlano: mudarPlano,
    situacao: situacao, marcar: marcar, abrirNoApp: abrirNoApp, global: global, nova: nova, validarNova: validarNova, criar: criar,
    _confirmar: _confirmar, ligada: ligada, aplicarNoApp: aplicarNoApp, _efetiva: efetiva
  };
  // a rota #/backoffice está em rotas.js
  function inicio() { semear(); ligarCamada(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(inicio, 300); });
  else setTimeout(inicio, 300);
})();

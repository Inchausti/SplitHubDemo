/* ══ Gestão de usuários ═════════════════════════════════════════════════════
   Implementa a proposta de Gestão de usuários e acessos (v1.3, 26/10/2026),
   com as decisões tomadas:
     · cinco perfis — Administrador, Fiscal, Tesouraria, Leitura e Fornecedor
       (D-USR-02); o Fornecedor tem a seção própria, Acessos de fornecedores
     · convite de 7 dias, com primeiro acesso em que a pessoa cria a própria
       senha (D-USR-04)
     · escopo por CNPJ (D-USR-05): toda a organização ou CNPJs selecionados;
       o Administrador tem sempre a organização inteira. Aqui o escopo é
       atribuído e registrado; o recorte das telas vem com o login de verdade
     · desativar encerra as sessões e não apaga ninguém; a organização nunca
       fica sem administrador ativo
     · sem MFA e sem bloqueio por tentativas neste momento (D-USR-03, D-USR-07);
       sessão de 30 minutos sem uso e 12 horas no máximo
     · a troca de perfil Cliente ↔ Fornecedor é só do protótipo (D-USR-06)

   O envio de e-mail é simulado, como em acesso-fornecedor.js. O estado vive em
   memória e é recriado a cada carregamento. O login do protótipo continua o
   acesso de demonstração — a autenticação real é do produto.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fechar(id) { var e = document.getElementById(id); if (e) e.remove(); }
  function hoje() { return new Date(); }
  function fmtD(d) {
    if (!d) return '—';
    var x = (d instanceof Date) ? d : new Date(d);
    return ('0' + x.getDate()).slice(-2) + '/' + ('0' + (x.getMonth() + 1)).slice(-2) + '/' + x.getFullYear();
  }
  function fmtDH(d) {
    var x = (d instanceof Date) ? d : new Date(d);
    return fmtD(x) + ' ' + ('0' + x.getHours()).slice(-2) + ':' + ('0' + x.getMinutes()).slice(-2);
  }
  function maisDias(n) { var d = hoje(); d.setDate(d.getDate() + n); return d; }
  function maisHoras(n) { var d = hoje(); d.setHours(d.getHours() + n); return d; }
  function diasAte(d) { return Math.ceil((new Date(d) - hoje()) / 86400000); }
  function diasDesde(d) { return Math.floor((hoje() - new Date(d)) / 86400000); }

  function toast(msg, tipo, link) {
    fechar('usu-toast');
    var t = document.createElement('div');
    t.id = 'usu-toast';
    t.className = 'usu-toast' + (tipo === 'erro' ? ' erro' : '');
    t.setAttribute('role', 'status');
    t.innerHTML = '<span class="usu-toast-msg">' + esc(msg) + '</span>'
      + (link ? '<button class="btn btn-t usu-btn-sm" onclick="' + link.onclick + '">' + esc(link.rotulo) + '</button>' : '');
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, link ? 7000 : 4500);
  }

  function cabecalho(id, icone, titulo, sub) {
    return '<div class="mbox-hdr"><div class="usu-hdr-l">'
      + '<div class="mbox-icon blue">' + icone + '</div><div class="usu-min0">'
      + '<div class="mbox-title" id="' + id + '-titulo">' + esc(titulo) + '</div>'
      + '<div class="mbox-sub">' + esc(sub) + '</div></div></div>'
      + '<button class="mbox-close" aria-label="Fechar" onclick="document.getElementById(\'' + id + '\').remove()">✕</button></div>';
  }
  function rodape(id, legenda, botaoId, rotulo, cls, onclick) {
    return '<div class="usu-rodape">'
      + '<span id="' + botaoId + '-status" class="usu-rodape-st" role="status" aria-live="polite">' + legenda + '</span>'
      + '<button class="btn" onclick="document.getElementById(\'' + id + '\').remove()">Cancelar</button>'
      + '<button class="' + cls + '" id="' + botaoId + '" onclick="' + onclick + '">' + esc(rotulo) + '</button></div>';
  }
  function caixa(tipo, titulo, corpo) {
    return '<div class="usu-caixa ' + tipo + '"><div class="usu-caixa-t">' + esc(titulo) + '</div>'
      + '<div class="usu-caixa-c">' + corpo + '</div></div>';
  }
  function overlay(id, largura, miolo) {
    fechar(id);
    document.body.insertAdjacentHTML('beforeend',
      '<div id="' + id + '" class="moverlay" onclick="if(event.target===this)this.remove()">'
      + '<div class="mbox usu-mbox" style="--usu-w:' + largura + 'px" role="dialog" aria-modal="true" aria-labelledby="' + id + '-titulo">'
      + miolo + '</div></div>');
  }

  /* ── Perfis (D-USR-02) ─────────────────────────────────────────────────── */
  var PERFIS = {
    administrador: { rot: 'Administrador', cls: 'adm', desc: 'Tudo, inclusive usuários, perfis, contratos, integrações e políticas de RAD.', poder: 'fazer tudo, inclusive gerir usuários, perfis e configurações' },
    fiscal:        { rot: 'Fiscal',        cls: 'fis', desc: 'Opera Crédito, Débito, Conciliação, Inconsistências e Apuração; lê o resto.', poder: 'operar Crédito, Débito, Conciliação, Inconsistências e Apuração, e ler o resto' },
    tesouraria:    { rot: 'Tesouraria',    cls: 'tes', desc: 'Opera Pagamentos RAD — execução, aprovação e comprovantes; lê os módulos fiscais.', poder: 'operar Pagamentos RAD e ler os módulos fiscais' },
    leitura:       { rot: 'Leitura',       cls: 'lei', desc: 'Consulta e exporta tudo, sem nenhuma ação com efeito.', poder: 'consultar e exportar tudo, sem nenhuma ação com efeito' }
  };
  var PERFIL_FORNECEDOR = { rot: 'Fornecedor', cls: 'for', desc: 'Só o Portal do Fornecedor e os CNPJs do próprio acesso — ver Acessos de fornecedores, abaixo.' };
  var ESTADOS = {
    ativo:     { rot: 'Ativo',             cls: 'ok' },
    convidado: { rot: 'Convidado',         cls: 'conv' },
    expirado:  { rot: 'Convite expirado',  cls: 'exp' },
    inativo:   { rot: 'Desativado',        cls: 'ina' },
    cancelado: { rot: 'Convite cancelado', cls: 'ina' }
  };
  var VALIDADE_CONVITE = 7;          // dias (D-USR-04)
  var SEM_ACESSO_DIAS = 90;
  var SENHA_MIN = 12;
  var SESSAO_SEM_USO_MIN = 30;       // D-USR-07
  var SESSAO_MAX_H = 12;

  /* ── Escopo (D-USR-05) ───────────────────────────────────────────────────
     null = toda a organização, inclusive CNPJ cadastrado depois; senão, a
     lista de CNPJs. A apuração e o saldo credor são da empresa (raiz do CNPJ):
     quem tem só parte dos CNPJs de uma empresa não vê a apuração dela. */
  function cnpjsAtivos() {
    return (window._orgCnpjs || []).filter(function (c) { return c.status === 'ativo'; });
  }
  function raiz(cnpj) { return String(cnpj).slice(0, 10); }
  function empresas() {
    var por = {}, ordem = [];
    cnpjsAtivos().forEach(function (c) {
      var r = raiz(c.cnpj);
      if (!por[r]) { por[r] = { raiz: r, nome: c.razao.replace(/\s+(S\.A\.|S\/A|Ltda\.?)$/i, ''), cnpjs: [] }; ordem.push(r); }
      por[r].cnpjs.push(c);
    });
    return ordem.map(function (r) { return por[r]; });
  }
  function cnpjsDaEmpresa(r) {
    return cnpjsAtivos().filter(function (c) { return raiz(c.cnpj) === r; }).map(function (c) { return c.cnpj; });
  }
  function lerEscopo(lista) {
    if (!lista) return { rotulo: 'Toda a organização', parciais: [] };
    var partes = [], parciais = [];
    empresas().forEach(function (e) {
      var n = e.cnpjs.filter(function (c) { return lista.indexOf(c.cnpj) >= 0; }).length;
      if (!n) return;
      if (n === e.cnpjs.length) partes.push(e.nome);
      else { partes.push(n + (n > 1 ? ' CNPJs' : ' CNPJ') + ' da ' + e.nome); parciais.push(e.nome); }
    });
    return { rotulo: partes.join(' + ') || 'Nenhum CNPJ', parciais: parciais };
  }
  function chaveEscopo(lista) { return lista ? lista.slice().sort().join('|') : '*'; }
  function avisoApuracao(nome, lista) {
    var p = lerEscopo(lista).parciais;
    return p.length
      ? caixa('amb', 'Apuração', 'Com só parte dos CNPJs da ' + esc(p.join(' e da ')) + ', ' + esc(nome || 'a pessoa')
        + ' não vê a apuração nem o saldo credor dessa empresa: os dois são da empresa inteira.')
      : '';
  }

  /* ── Estado ──────────────────────────────────────────────────────────────── */
  var ST = window._usuState = { usuarios: [], seq: 0 };
  function novoId() { ST.seq += 1; return 'USR-' + ('000' + ST.seq).slice(-4); }
  function eu() { return ST.usuarios[0]; }
  function porId(id) { return ST.usuarios.filter(function (u) { return u.id === id; })[0] || null; }
  function registrar(u, acao, detalhe, autor, quando) {
    u.historico.unshift({ quando: quando || new Date(), autor: autor || eu().nome, acao: acao, detalhe: detalhe || '' });
  }
  function estado(u) {
    if (u.estado === 'convidado' && new Date(u.expiraEm) < hoje()) return 'expirado';
    return u.estado;
  }
  function adminsAtivos() {
    return ST.usuarios.filter(function (u) { return u.perfil === 'administrador' && estado(u) === 'ativo'; });
  }

  function semear() {
    if (ST.usuarios.length) return;
    function u(nome, email, perfil, est, o) {
      var x = {
        id: novoId(), nome: nome, email: email, perfil: perfil, estado: est, escopo: o.escopo && o.escopo.length ? o.escopo : null,
        criadoEm: o.criadoEm || maisDias(-120), criadoPor: o.criadoPor || 'José da Silva',
        expiraEm: o.expiraEm || null, ultimoAcesso: o.ultimoAcesso || null, sessoes: o.sessoes || 0,
        desativadoEm: o.desativadoEm || null, desativadoPor: o.desativadoPor || null, motivo: o.motivo || null,
        reenvios: 0, historico: []
      };
      ST.usuarios.push(x);
      return x;
    }
    var j = u('José da Silva', 'jose.silva@induspar.com.br', 'administrador', 'ativo', { criadoEm: maisDias(-200), criadoPor: 'Implantação', ultimoAcesso: hoje(), sessoes: 1 });
    registrar(j, 'Acesso criado na implantação', 'Administrador', 'Implantação', maisDias(-200));
    var m = u('Maria Costa', 'maria.costa@induspar.com.br', 'administrador', 'ativo', { criadoEm: maisDias(-190), ultimoAcesso: maisHoras(-3), sessoes: 1 });
    registrar(m, 'Aceitou o convite', 'Administrador', 'Maria Costa', maisDias(-189));
    var induspar = cnpjsDaEmpresa('54.891.237'), systec = cnpjsDaEmpresa('67.432.109');
    var r = u('Rafael Lima', 'rafael.lima@induspar.com.br', 'fiscal', 'ativo', { criadoEm: maisDias(-84), ultimoAcesso: maisHoras(-20), sessoes: 2, escopo: induspar });
    registrar(r, 'Aceitou o convite', 'Fiscal · ' + lerEscopo(r.escopo).rotulo, 'Rafael Lima', maisDias(-83));
    var a = u('Ana Ferreira', 'ana.ferreira@induspar.com.br', 'tesouraria', 'ativo', { criadoEm: maisDias(-60), ultimoAcesso: maisDias(-9), sessoes: 1 });
    registrar(a, 'Aceitou o convite', 'Fiscal', 'Ana Ferreira', maisDias(-59));
    registrar(a, 'Perfil alterado', 'Fiscal → Tesouraria · assumiu a operação de RAD', 'Maria Costa', maisDias(-30));
    var p = u('Paulo Torres', 'paulo.torres@induspar.com.br', 'leitura', 'ativo', { criadoEm: maisDias(-150), ultimoAcesso: maisDias(-103), escopo: systec });
    registrar(p, 'Aceitou o convite', 'Leitura · ' + lerEscopo(p.escopo).rotulo, 'Paulo Torres', maisDias(-149));
    var ju = u('Júlia Mendes', 'julia.mendes@induspar.com.br', 'fiscal', 'convidado', { criadoEm: maisDias(-5), expiraEm: maisDias(2), criadoPor: 'Maria Costa',
      escopo: induspar.filter(function (c) { return /\/000[67]-/.test(c); }) });
    registrar(ju, 'Convite enviado', 'Fiscal · ' + lerEscopo(ju.escopo).rotulo + ' · vale 7 dias', 'Maria Costa', maisDias(-5));
    var b = u('Bruno Alves', 'bruno.alves@induspar.com.br', 'leitura', 'convidado', { criadoEm: maisDias(-10), expiraEm: maisDias(-3) });
    registrar(b, 'Convite enviado', 'Leitura · vale 7 dias', 'José da Silva', maisDias(-10));
    var c = u('Carlos Barros', 'carlos.barros@induspar.com.br', 'leitura', 'inativo', { criadoEm: maisDias(-300), ultimoAcesso: maisDias(-116), desativadoEm: maisDias(-116), desativadoPor: 'Maria Costa', motivo: 'Saiu da empresa' });
    registrar(c, 'Aceitou o convite', 'Leitura', 'Carlos Barros', maisDias(-299));
    registrar(c, 'Desativado', 'Saiu da empresa · sessões encerradas', 'Maria Costa', maisDias(-116));
  }

  /* ── Listagem ────────────────────────────────────────────────────────────── */
  function avatar(u) {
    var ini = u.nome.split(/\s+/).filter(Boolean);
    var txt = (ini[0] || '?').charAt(0) + (ini.length > 1 ? ini[ini.length - 1].charAt(0) : '');
    var est = estado(u);
    return '<span class="usu-av ' + (est === 'ativo' ? PERFIS[u.perfil].cls : 'off') + '">' + esc(txt.toUpperCase()) + '</span>';
  }
  function seloPerfil(perfil) {
    var p = PERFIS[perfil] || PERFIL_FORNECEDOR;
    return '<span class="usu-perfil ' + p.cls + '">' + esc(p.rot) + '</span>';
  }
  function celulaEstado(u) {
    var est = estado(u), e = ESTADOS[est], sub = '';
    if (est === 'convidado') { var n = diasAte(u.expiraEm); sub = n <= 0 ? 'expira hoje' : 'expira em ' + n + (n === 1 ? ' dia' : ' dias'); }
    else if (est === 'expirado') sub = 'expirou em ' + fmtD(u.expiraEm);
    else if (est === 'inativo') sub = 'por ' + esc(u.desativadoPor || '—') + ' em ' + fmtD(u.desativadoEm);
    return '<span class="usu-est ' + e.cls + '"><span class="usu-dot"></span>' + e.rot + '</span>'
      + (sub ? '<span class="usu-sub">' + sub + '</span>' : '');
  }
  function celulaEscopo(u) {
    var l = lerEscopo(u.escopo);
    return '<span class="usu-esc">' + esc(l.rotulo) + '</span>'
      + (l.parciais.length ? '<span class="usu-sub amb">sem a apuração da ' + esc(l.parciais.join(' e da ')) + '</span>' : '');
  }
  function celulaAcesso(u) {
    if (!u.ultimoAcesso) return '<span class="usu-sub">nunca entrou</span>';
    var d = diasDesde(u.ultimoAcesso);
    var x = new Date(u.ultimoAcesso), ontem = maisDias(-1), hora = fmtDH(x).slice(11);
    var txt = fmtD(x) === fmtD(hoje()) ? 'hoje ' + hora : fmtD(x) === fmtD(ontem) ? 'ontem ' + hora : fmtDH(x);
    return esc(txt) + (estado(u) === 'ativo' && d >= SEM_ACESSO_DIAS ? '<span class="usu-sub amb">há ' + d + ' dias</span>' : '');
  }
  function acoes(u) {
    var est = estado(u), b = [];
    function bt(rot, fn, cls) { b.push('<button class="btn usu-btn-sm' + (cls ? ' ' + cls : '') + '" onclick="shUsu.' + fn + '(\'' + u.id + '\')">' + rot + '</button>'); }
    if (est === 'convidado') { bt('Ver e-mail', 'verEmail'); bt('Reenviar', 'reenviar'); bt('Cancelar', 'cancelar', 'usu-btn-red'); }
    else if (est === 'expirado') { bt('Reenviar', 'reenviar'); bt('Cancelar', 'cancelar', 'usu-btn-red'); }
    else if (est === 'ativo') bt('Editar', 'editar');
    else if (est === 'inativo') bt('Reativar', 'reativar', 'usu-btn-teal');
    return '<div class="usu-acoes">' + b.join('') + '</div>';
  }

  function render() {
    var kp = document.getElementById('usu-kpis');
    var tb = document.getElementById('usu-tbody');
    if (!kp || !tb) return;
    semear();
    var todos = ST.usuarios;
    var ativos = todos.filter(function (u) { return estado(u) === 'ativo'; });
    var conv = todos.filter(function (u) { return estado(u) === 'convidado'; });
    var vencendo = conv.filter(function (u) { return diasAte(u.expiraEm) <= 2; });
    var semAcesso = ativos.filter(function (u) { return u.ultimoAcesso && diasDesde(u.ultimoAcesso) >= SEM_ACESSO_DIAS; });
    var adm = adminsAtivos();
    function k(lbl, val, sub, cls) {
      return '<div class="kcard"><div class="klbl">' + lbl + '</div><div class="kval' + (cls ? ' ' + cls : '') + '">' + val + '</div><div class="ksub">' + sub + '</div></div>';
    }
    kp.innerHTML = k('Usuários ativos', ativos.length, 'de ' + todos.filter(function (u) { return u.estado !== 'cancelado'; }).length + ' acessos')
      + k('Administradores', adm.length, adm.length < 2 ? 'abaixo do mínimo recomendado de 2' : 'mínimo recomendado: 2', adm.length < 2 ? 'usu-kv-amb' : '')
      + k('Convites pendentes', conv.length, vencendo.length ? vencendo.length + ' expira' + (vencendo.length > 1 ? 'm' : '') + ' em até 2 dias' : 'vale ' + VALIDADE_CONVITE + ' dias', conv.length ? 'usu-kv-amb' : '')
      + k('Sem acesso há ' + SEM_ACESSO_DIAS + ' dias', semAcesso.length, semAcesso.length ? 'candidatos à revisão de acessos' : 'nenhum');

    var q = ((document.getElementById('usu-busca') || {}).value || '').trim().toLowerCase();
    var fp = (document.getElementById('usu-f-perfil') || {}).value || '';
    var fe = (document.getElementById('usu-f-estado') || {}).value || '';
    var lista = todos.filter(function (u) {
      var est = estado(u);
      if (q && (u.nome + ' ' + u.email).toLowerCase().indexOf(q) < 0) return false;
      if (fp && u.perfil !== fp) return false;
      if (fe === 'ativo' && est !== 'ativo') return false;
      if (fe === 'convite' && est !== 'convidado' && est !== 'expirado') return false;
      if (fe === 'inativo' && est !== 'inativo' && est !== 'cancelado') return false;
      return true;
    });
    var cnt = document.getElementById('usu-count');
    if (cnt) cnt.textContent = lista.length + ' de ' + todos.length;
    tb.innerHTML = lista.length ? lista.map(function (u) {
      var est = estado(u);
      return '<tr class="' + (est === 'inativo' || est === 'cancelado' ? 'usu-tr-off' : '') + '">'
        + '<td><div class="usu-pessoa">' + avatar(u) + '<div class="usu-min0"><div class="usu-nome">' + esc(u.nome)
        + (u === eu() ? ' <span class="usu-voce">você</span>' : '') + '</div><div class="usu-email">' + esc(u.email) + '</div></div></div></td>'
        + '<td>' + seloPerfil(u.perfil) + '</td>'
        + '<td>' + celulaEscopo(u) + '</td>'
        + '<td>' + celulaEstado(u) + '</td>'
        + '<td>' + celulaAcesso(u) + '</td>'
        + '<td class="r">' + acoes(u) + '</td></tr>';
    }).join('') : '<tr><td colspan="6" class="usu-vazio">Nenhum usuário neste recorte.</td></tr>';

    var pf = document.getElementById('usu-perfis');
    if (pf && !pf.childElementCount) {
      pf.innerHTML = Object.keys(PERFIS).map(function (key) { return PERFIS[key]; }).concat([PERFIL_FORNECEDOR]).map(function (p) {
        return '<div class="usu-pcard"><span class="usu-perfil ' + p.cls + '">' + esc(p.rot) + '</span><div class="usu-pdesc">' + esc(p.desc) + '</div></div>';
      }).join('');
    }
  }

  /* ── Convidar (D-USR-04) ─────────────────────────────────────────────────── */
  function campo(id, rot, tipo, ph, extra) {
    return '<div class="sh-fp-field usu-campo"><label for="' + id + '">' + rot + '</label>'
      + '<input id="' + id + '" type="' + tipo + '" class="usu-input" placeholder="' + (ph || '') + '" ' + (extra || '') + '></div>';
  }
  function cartoesPerfil(nome, sel, onchange) {
    return '<div class="usu-pcards">' + Object.keys(PERFIS).map(function (key) {
      var p = PERFIS[key];
      return '<label class="usu-popt"><input type="radio" name="' + nome + '" value="' + key + '"' + (key === sel ? ' checked' : '')
        + ' onchange="' + onchange + '"><span class="usu-popt-b"><b>' + esc(p.rot) + '</b><small>' + esc(p.desc) + '</small></span></label>';
    }).join('') + '</div>';
  }
  function perfilMarcado(nome) {
    var r = document.querySelector('input[name="' + nome + '"]:checked');
    return r ? r.value : '';
  }

  /* Seletor de escopo: pref nomeia os campos ('usu-c' no convite, 'usu-e' no detalhe) */
  function seletorEscopo(pref, lista, onchange) {
    var todos = !lista;
    function op(valor, rot, desc, marcado) {
      return '<label class="usu-popt"><input type="radio" name="' + pref + '-esc" value="' + valor + '"' + (marcado ? ' checked' : '')
        + ' onchange="' + onchange + '"><span class="usu-popt-b"><b>' + rot + '</b><small>' + desc + '</small></span></label>';
    }
    return '<fieldset class="usu-fs" id="' + pref + '-esc-fs">'
      + '<div class="usu-pcards">'
      + op('org', 'Toda a organização', 'Todos os CNPJs, inclusive os cadastrados depois.', todos)
      + op('sel', 'CNPJs selecionados', 'Só os marcados. CNPJ novo precisa ser acrescentado.', !todos)
      + '</div><div id="' + pref + '-esc-lista" class="usu-esc-lista"' + (todos ? ' hidden' : '') + '>'
      + empresas().map(function (e) {
        return '<div class="usu-esc-emp"><label class="usu-esc-h"><input type="checkbox" data-emp="' + e.raiz + '" onchange="shUsu.marcarEmpresa(this, \'' + pref + '\');' + onchange + '">'
          + '<b>' + esc(e.nome) + '</b><span class="usu-sub">empresa inteira · ' + e.cnpjs.length + ' CNPJs</span></label>'
          + '<div class="usu-esc-cnpjs">' + e.cnpjs.map(function (c) {
            return '<label class="usu-esc-c"><input type="checkbox" name="' + pref + '-cnpj" value="' + esc(c.cnpj) + '" data-raiz="' + e.raiz + '"'
              + (lista && lista.indexOf(c.cnpj) >= 0 ? ' checked' : '') + ' onchange="' + onchange + '">'
              + '<span>' + esc(c.tipo) + ' · ' + esc(c.uf) + '<small>' + esc(c.cnpj) + '</small></span></label>';
          }).join('') + '</div></div>';
      }).join('')
      + '</div></fieldset><div id="' + pref + '-esc-nota"></div>';
  }
  function escopoMarcado(pref) {
    var r = document.querySelector('input[name="' + pref + '-esc"]:checked');
    if (!r || r.value === 'org') return null;
    return Array.prototype.map.call(document.querySelectorAll('input[name="' + pref + '-cnpj"]:checked'), function (i) { return i.value; });
  }
  function marcarEmpresa(el, pref) {
    var alvo = 'input[name="' + pref + '-cnpj"][data-raiz="' + el.getAttribute('data-emp') + '"]';
    Array.prototype.forEach.call(document.querySelectorAll(alvo), function (i) { i.checked = el.checked; });
  }
  /* Ajusta o seletor ao perfil: o Administrador tem sempre a organização inteira (RN-USR-08) */
  function ajustarEscopo(pref, perfil, fixo) {
    var fs = document.getElementById(pref + '-esc-fs'); if (!fs) return;
    var adm = perfil === 'administrador';
    if (adm) { var o = fs.querySelector('input[value="org"]'); if (o) o.checked = true; }
    fs.disabled = adm || !!fixo;
    var lst = document.getElementById(pref + '-esc-lista');
    if (lst) lst.hidden = escopoMarcado(pref) === null;
    Array.prototype.forEach.call(fs.querySelectorAll('input[data-emp]'), function (h) {
      var itens = fs.querySelectorAll('input[name="' + pref + '-cnpj"][data-raiz="' + h.getAttribute('data-emp') + '"]');
      var n = Array.prototype.filter.call(itens, function (i) { return i.checked; }).length;
      h.checked = n === itens.length;
      h.indeterminate = n > 0 && n < itens.length;
    });
    var nota = document.getElementById(pref + '-esc-nota');
    if (nota) nota.innerHTML = adm ? '<p class="usu-p usu-sub usu-mt">O Administrador tem sempre a organização inteira.</p>'
      : fixo ? '<p class="usu-p usu-sub usu-mt">Ninguém altera o próprio escopo — nem um administrador.</p>' : '';
  }

  function convidar() {
    var id = 'usu-convite-overlay';
    overlay(id, 600, cabecalho(id, '✉', 'Convidar usuário', 'Induspar Tecnologia')
      + '<div class="mbox-col usu-col">'
      + campo('usu-c-nome', 'Nome', 'text', 'Nome de quem vai acessar', 'oninput="shUsu.validarConvite()"')
      + campo('usu-c-email', 'E-mail', 'email', 'nome@induspar.com.br', 'oninput="shUsu.validarConvite()"')
      + '<div class="mbox-section-label usu-mt">Perfil</div>'
      + cartoesPerfil('usu-c-perfil', '', 'shUsu.validarConvite()')
      + '<div class="mbox-section-label usu-mt">Escopo</div>'
      + seletorEscopo('usu-c', null, 'shUsu.validarConvite()')
      + '<div id="usu-c-resumo"></div>'
      + caixa('teal', 'A senha é de quem recebe',
        'O convite vale <strong>' + VALIDADE_CONVITE + ' dias</strong> e só pode ser usado uma vez. A própria pessoa cria a senha ao aceitar — ninguém da organização vê ou escolhe a senha de outro usuário.')
      + '</div>'
      + rodape(id, 'Preencha nome, e-mail e perfil.', 'usu-c-ok', 'Enviar convite', 'btn btn-t', 'shUsu.confirmarConvite()'));
    setTimeout(function () { var e = document.getElementById('usu-c-nome'); if (e) e.focus(); validarConvite(); }, 30);
  }

  function validarConvite(tentativa) {
    var nome = ((document.getElementById('usu-c-nome') || {}).value || '').trim();
    var email = ((document.getElementById('usu-c-email') || {}).value || '').trim().toLowerCase();
    var perfil = perfilMarcado('usu-c-perfil');
    var falta = [], aviso = '';
    if (!nome) falta.push('nome');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) falta.push('e-mail válido');
    else {
      var existe = ST.usuarios.filter(function (u) { return u.email === email && u.estado !== 'cancelado'; })[0];
      if (existe) {
        falta.push('e-mail que ainda não esteja na organização');
        aviso = estado(existe) === 'inativo' ? 'Este e-mail é de ' + existe.nome + ', desativado — use Reativar na lista.' : 'Este e-mail já é de ' + existe.nome + '.';
      }
    }
    if (!perfil) falta.push('perfil');
    ajustarEscopo('usu-c', perfil);
    var escopo = escopoMarcado('usu-c');
    if (escopo && !escopo.length) falta.push('ao menos um CNPJ no escopo');
    var res = document.getElementById('usu-c-resumo');
    if (res) {
      var primeiro = nome.split(/\s+/)[0];
      res.innerHTML = perfil && nome
        ? caixa('blue', 'Resumo', '<strong>' + esc(primeiro) + '</strong> vai poder ' + esc(PERFIS[perfil].poder) + '. Escopo: <strong>'
          + esc(lerEscopo(escopo).rotulo) + '</strong>.') + (escopo && escopo.length ? avisoApuracao(primeiro, escopo) : '')
        : '';
    }
    var st = document.getElementById('usu-c-ok-status');
    if (st) {
      st.textContent = aviso || (falta.length ? 'Falta: ' + falta.join(', ') : 'Tudo preenchido');
      st.className = 'usu-rodape-st ' + (falta.length ? 'amb' : 'ok');
    }
    if (tentativa && falta.length) {
      var alvo = !nome ? 'usu-c-nome' : (/e-mail/.test(falta[0]) ? 'usu-c-email' : null);
      var e = alvo && document.getElementById(alvo);
      if (e) { e.classList.add('usu-erro'); e.focus(); }
    }
    return !falta.length;
  }

  function confirmarConvite() {
    if (!validarConvite(true)) return;
    var nome = document.getElementById('usu-c-nome').value.trim();
    var email = document.getElementById('usu-c-email').value.trim().toLowerCase();
    var perfil = perfilMarcado('usu-c-perfil');
    var escopo = perfil === 'administrador' ? null : escopoMarcado('usu-c');
    var u = {
      id: novoId(), nome: nome, email: email, perfil: perfil, estado: 'convidado', escopo: escopo,
      criadoEm: hoje(), criadoPor: eu().nome, expiraEm: maisDias(VALIDADE_CONVITE), ultimoAcesso: null, sessoes: 0,
      desativadoEm: null, desativadoPor: null, motivo: null, reenvios: 0, historico: []
    };
    ST.usuarios.push(u);
    registrar(u, 'Convite enviado', PERFIS[perfil].rot + ' · ' + lerEscopo(escopo).rotulo + ' · vale ' + VALIDADE_CONVITE + ' dias');
    fechar('usu-convite-overlay');
    render();
    toast('Convite enviado para ' + email + '.', 'ok', { rotulo: 'Ver e-mail', onclick: "shUsu.verEmail('" + u.id + "')" });
  }

  /* ── E-mail e primeiro acesso (simulados) ────────────────────────────────── */
  function verEmail(uid) {
    var u = porId(uid); if (!u) return;
    var id = 'usu-email-overlay';
    overlay(id, 560, cabecalho(id, '✉', 'E-mail de convite', 'Para: ' + u.email)
      + '<div class="mbox-col usu-col">'
      + caixa('amb', 'Envio simulado', 'Não há infraestrutura de e-mail no protótipo. Esta é a mensagem que seria enviada — e o botão abre o primeiro acesso como o convidado o veria.')
      + '<div class="usu-email-box"><div class="usu-email-top">SplitHub</div><div class="usu-email-body">'
      + '<div class="usu-email-h">Você foi convidado para a conta da Induspar Tecnologia</div>'
      + '<p>' + esc(u.criadoPor) + ' criou um acesso para você no SplitHub, com o perfil <strong>' + esc(PERFIS[u.perfil].rot) + '</strong>'
      + ' e o escopo <strong>' + esc(lerEscopo(u.escopo).rotulo) + '</strong>.</p>'
      + '<button class="btn btn-t" onclick="shUsu.abrirAceite(\'' + u.id + '\')">Criar minha senha</button>'
      + '<p class="usu-sub">O link vale até ' + fmtD(u.expiraEm) + ' e só pode ser usado uma vez. Se você não esperava este convite, ignore esta mensagem.</p>'
      + '</div></div></div>'
      + '<div class="usu-rodape"><button class="btn" onclick="document.getElementById(\'' + id + '\').remove()">Fechar</button></div>');
  }

  function abrirAceite(uid) {
    var u = porId(uid); if (!u) return;
    fechar('usu-email-overlay');
    var id = 'usu-aceite-overlay';
    if (estado(u) !== 'convidado') {   // usado, cancelado ou expirado: a mesma resposta, de propósito
      overlay(id, 420, cabecalho(id, '⚠', 'Link inválido', 'Primeiro acesso')
        + '<div class="mbox-col"><p class="usu-p">Este link não pode ser usado. Peça um novo convite a quem administra os acessos.</p></div>'
        + '<div class="usu-rodape"><button class="btn" onclick="document.getElementById(\'' + id + '\').remove()">Fechar</button></div>');
      return;
    }
    overlay(id, 440, cabecalho(id, '🔑', 'Crie sua senha', 'Primeiro acesso · visão do convidado')
      + '<div class="mbox-col usu-col">'
      + '<p class="usu-p"><strong>' + esc(u.criadoPor) + '</strong> convidou você para a conta da <strong>Induspar Tecnologia</strong> com o perfil <strong>' + esc(PERFIS[u.perfil].rot) + '</strong>.</p>'
      + campo('usu-a-email', 'E-mail', 'text', '', 'value="' + esc(u.email) + '" disabled')
      + campo('usu-a-senha', 'Crie sua senha', 'password', '', 'oninput="shUsu.validarSenha()"')
      + campo('usu-a-senha2', 'Confirme a senha', 'password', '', 'oninput="shUsu.validarSenha()"')
      + '<div id="usu-a-req" class="usu-req"></div>'
      + '</div>'
      + rodape(id, 'Ninguém da organização vê esta senha.', 'usu-a-ok', 'Criar senha e entrar', 'btn btn-t', "shUsu.confirmarAceite('" + u.id + "')"));
    setTimeout(function () { var e = document.getElementById('usu-a-senha'); if (e) e.focus(); validarSenha(); }, 30);
  }

  function validarSenha() {
    var s = (document.getElementById('usu-a-senha') || {}).value || '';
    var s2 = (document.getElementById('usu-a-senha2') || {}).value || '';
    var regras = [
      { ok: s.length >= SENHA_MIN, txt: SENHA_MIN + ' caracteres ou mais' },
      { ok: /[a-zA-Z]/.test(s) && /\d/.test(s), txt: 'letras e números' },
      { ok: !!s && s === s2, txt: 'as duas iguais' }
    ];
    var el = document.getElementById('usu-a-req');
    if (el) el.innerHTML = regras.map(function (r) { return '<div class="' + (r.ok ? 'ok' : '') + '">' + (r.ok ? '✓' : '○') + ' ' + r.txt + '</div>'; }).join('');
    var falta = regras.filter(function (r) { return !r.ok; });
    var st = document.getElementById('usu-a-ok-status');
    if (st) {
      st.textContent = falta.length ? 'Falta: ' + falta.map(function (r) { return r.txt; }).join(', ') : 'Ninguém da organização vê esta senha.';
      st.className = 'usu-rodape-st ' + (falta.length ? 'amb' : '');
    }
    return !falta.length;
  }

  function confirmarAceite(uid) {
    if (!validarSenha()) { toast('A senha ainda não atende aos requisitos.', 'erro'); return; }
    var u = porId(uid);
    if (!u || estado(u) !== 'convidado') { toast('Este convite não está mais válido.', 'erro'); return; }
    u.estado = 'ativo';
    u.ultimoAcesso = hoje();
    u.sessoes = 1;
    registrar(u, 'Aceitou o convite e criou a senha', PERFIS[u.perfil].rot, u.nome);
    fechar('usu-aceite-overlay');
    render();
    toast(u.nome + ' agora tem acesso à conta.', 'ok');
  }

  /* ── Reenviar, cancelar, reativar ────────────────────────────────────────── */
  function reenviar(uid) {
    var u = porId(uid); if (!u) return;
    u.estado = 'convidado';
    u.expiraEm = maisDias(VALIDADE_CONVITE);
    u.reenvios += 1;
    registrar(u, 'Convite reenviado', 'link novo, vale até ' + fmtD(u.expiraEm) + '; o anterior perdeu a validade');
    render();
    toast('Convite reenviado para ' + u.email + '. O link anterior não vale mais.', 'ok', { rotulo: 'Ver e-mail', onclick: "shUsu.verEmail('" + u.id + "')" });
  }
  function cancelar(uid) {
    var u = porId(uid); if (!u) return;
    u.estado = 'cancelado';
    u.desativadoEm = hoje();
    u.desativadoPor = eu().nome;
    registrar(u, 'Convite cancelado', 'o link deixa de valer');
    render();
    toast('Convite de ' + u.email + ' cancelado.', 'ok');
  }
  function reativar(uid) {
    var u = porId(uid); if (!u) return;
    var id = 'usu-reat-overlay';
    overlay(id, 480, cabecalho(id, '↺', 'Reativar acesso', u.nome)
      + '<div class="mbox-col usu-col">'
      + '<p class="usu-p">' + esc(u.nome) + ' volta a entrar com o perfil <strong>' + esc(PERFIS[u.perfil].rot) + '</strong> e o escopo <strong>'
      + esc(lerEscopo(u.escopo).rotulo) + '</strong>, os mesmos de antes da desativação. A senha anterior continua valendo.</p>'
      + '<div class="sh-fp-field usu-campo"><label for="usu-r-motivo">Motivo</label><textarea id="usu-r-motivo" class="usu-input" rows="2" placeholder="Por que o acesso volta"></textarea></div>'
      + '</div>'
      + rodape(id, 'A reativação fica na trilha.', 'usu-r-ok', 'Reativar', 'btn btn-t', "shUsu.confirmarReativar('" + u.id + "')"));
  }
  function confirmarReativar(uid) {
    var u = porId(uid); if (!u) return;
    var mot = ((document.getElementById('usu-r-motivo') || {}).value || '').trim();
    if (!mot) { var e = document.getElementById('usu-r-motivo'); if (e) { e.classList.add('usu-erro'); e.focus(); } return; }
    u.estado = 'ativo';
    u.desativadoEm = null; u.desativadoPor = null; u.motivo = null;
    registrar(u, 'Reativado', PERFIS[u.perfil].rot + ' · ' + mot);
    fechar('usu-reat-overlay');
    render();
    toast(u.nome + ' foi reativado.', 'ok');
  }

  /* ── Detalhe e edição ────────────────────────────────────────────────────── */
  function editar(uid) {
    var u = porId(uid); if (!u) return;
    var id = 'usu-det-overlay', proprio = u === eu();
    var hist = u.historico.map(function (h) {
      return '<div class="usu-hist"><span class="usu-hist-q">' + fmtDH(h.quando) + '</span><span class="usu-min0"><b>' + esc(h.acao) + '</b>'
        + (h.detalhe ? ' · ' + esc(h.detalhe) : '') + '<span class="usu-sub">por ' + esc(h.autor) + '</span></span></div>';
    }).join('');
    function kv(k, v) { return '<div class="usu-kvl"><span>' + k + '</span><b>' + v + '</b></div>'; }
    overlay(id, 620, cabecalho(id, '👤', u.nome, u.email)
      + '<div class="mbox-col usu-col">'
      + kv('Estado', celulaEstado(u)) + kv('Entrada', 'E-mail e senha') + kv('Último acesso', celulaAcesso(u))
      + kv('Sessões abertas', u.sessoes ? u.sessoes + (u.sessoes > 1 ? ' sessões' : ' sessão') : 'nenhuma')
      + kv('Sessão expira', SESSAO_SEM_USO_MIN + ' min sem uso · ' + SESSAO_MAX_H + ' h no máximo')
      + '<div class="mbox-section-label usu-mt">Perfil</div>'
      + (proprio ? '<p class="usu-p usu-sub">Ninguém altera o próprio perfil — nem um administrador.</p>' : '')
      + '<fieldset class="usu-fs"' + (proprio ? ' disabled' : '') + '>' + cartoesPerfil('usu-e-perfil', u.perfil, "shUsu.validarEdicao('" + u.id + "')") + '</fieldset>'
      + '<div class="mbox-section-label usu-mt">Escopo</div>'
      + seletorEscopo('usu-e', u.escopo, "shUsu.validarEdicao('" + u.id + "')")
      + '<div id="usu-e-apur"></div>'
      + '<div class="sh-fp-field usu-campo"><label for="usu-e-motivo">Motivo da alteração</label>'
      + '<textarea id="usu-e-motivo" class="usu-input" rows="2" placeholder="Obrigatório ao trocar perfil ou escopo" oninput="shUsu.validarEdicao(\'' + u.id + '\')"' + (proprio ? ' disabled' : '') + '></textarea></div>'
      + '<div class="mbox-section-label usu-mt">Ações</div>'
      + '<div class="usu-acoes l">'
      + '<button class="btn usu-btn-sm" onclick="shUsu.redefinirSenha(\'' + u.id + '\')">Redefinir senha</button>'
      + '<button class="btn usu-btn-sm" onclick="shUsu.encerrarSessoes(\'' + u.id + '\')"' + (u.sessoes ? '' : ' disabled') + '>Encerrar sessões</button>'
      + (proprio ? '' : '<button class="btn usu-btn-sm usu-btn-red" onclick="shUsu.desativar(\'' + u.id + '\')">Desativar</button>')
      + '</div>'
      + '<div class="mbox-section-label usu-mt">Histórico</div><div class="usu-hists">' + (hist || '<span class="usu-sub">sem registros</span>') + '</div>'
      + '</div>'
      + rodape(id, proprio ? 'Seu próprio acesso: só ações de senha e sessão.' : 'Sem alterações.', 'usu-e-ok', 'Salvar', 'btn btn-t', "shUsu.salvarEdicao('" + u.id + "')"));
    ajustarEscopo('usu-e', u.perfil, proprio);
    var ap = document.getElementById('usu-e-apur');
    if (ap) ap.innerHTML = avisoApuracao(u.nome.split(/\s+/)[0], u.escopo);
  }
  function validarEdicao(uid) {
    var u = porId(uid); if (!u) return false;
    var novo = perfilMarcado('usu-e-perfil') || u.perfil;
    ajustarEscopo('usu-e', novo, u === eu());
    var escopo = novo === 'administrador' ? null : escopoMarcado('usu-e');
    var mot = ((document.getElementById('usu-e-motivo') || {}).value || '').trim();
    var mudouPerfil = novo !== u.perfil, mudouEscopo = chaveEscopo(escopo) !== chaveEscopo(u.escopo);
    var ap = document.getElementById('usu-e-apur');
    if (ap) ap.innerHTML = escopo && escopo.length ? avisoApuracao(u.nome.split(/\s+/)[0], escopo) : '';
    var st = document.getElementById('usu-e-ok-status'), msg = 'Sem alterações.', ok = true, cls = '';
    if (mudouPerfil && u.perfil === 'administrador' && adminsAtivos().length <= 1) { msg = 'A organização não pode ficar sem administrador ativo.'; ok = false; cls = 'amb'; }
    else if (escopo && !escopo.length) { msg = 'Marque ao menos um CNPJ no escopo.'; ok = false; cls = 'amb'; }
    else if ((mudouPerfil || mudouEscopo) && !mot) { msg = 'Informe o motivo da alteração.'; ok = false; cls = 'amb'; }
    else if (mudouPerfil || mudouEscopo) {
      msg = [mudouPerfil ? PERFIS[u.perfil].rot + ' → ' + PERFIS[novo].rot : '', mudouEscopo ? 'escopo: ' + lerEscopo(escopo).rotulo : '']
        .filter(Boolean).join(' · ') + ' · vale na próxima ação do usuário.';
      cls = 'ok';
    }
    if (st) { st.textContent = msg; st.className = 'usu-rodape-st ' + cls; }
    return ok;
  }
  function salvarEdicao(uid) {
    var u = porId(uid); if (!u) return;
    if (u === eu()) { fechar('usu-det-overlay'); return; }
    if (!validarEdicao(uid)) {
      var e = document.getElementById('usu-e-motivo');
      if (e && !e.value.trim()) { e.classList.add('usu-erro'); e.focus(); }
      return;
    }
    var novo = perfilMarcado('usu-e-perfil') || u.perfil;
    var escopo = novo === 'administrador' ? null : escopoMarcado('usu-e');
    var mot = document.getElementById('usu-e-motivo').value.trim(), feito = [];
    if (novo !== u.perfil) {
      registrar(u, 'Perfil alterado', PERFIS[u.perfil].rot + ' → ' + PERFIS[novo].rot + ' · ' + mot);
      u.perfil = novo;
      feito.push('perfil ' + PERFIS[novo].rot);
    }
    if (chaveEscopo(escopo) !== chaveEscopo(u.escopo)) {
      registrar(u, 'Escopo alterado', lerEscopo(u.escopo).rotulo + ' → ' + lerEscopo(escopo).rotulo + ' · ' + mot);
      u.escopo = escopo;
      feito.push('escopo ' + lerEscopo(escopo).rotulo);
    }
    if (feito.length) toast(u.nome + ': ' + feito.join(' e ') + '.', 'ok');
    fechar('usu-det-overlay');
    render();
  }
  function redefinirSenha(uid) {
    var u = porId(uid); if (!u) return;
    registrar(u, 'Redefinição de senha enviada', 'link de uso único por e-mail');
    toast('Link de redefinição de senha enviado para ' + u.email + ' (simulado).', 'ok');
    editar(uid);
  }
  function encerrarSessoes(uid) {
    var u = porId(uid); if (!u || !u.sessoes) return;
    registrar(u, 'Sessões encerradas', u.sessoes + (u.sessoes > 1 ? ' sessões' : ' sessão'));
    u.sessoes = 0;
    toast('Sessões de ' + u.nome + ' encerradas.', 'ok');
    render();
    editar(uid);
  }
  function desativar(uid) {
    var u = porId(uid); if (!u) return;
    fechar('usu-det-overlay');
    var id = 'usu-desat-overlay';
    if (u.perfil === 'administrador' && adminsAtivos().length <= 1) {
      overlay(id, 440, cabecalho(id, '⚠', 'Não é possível desativar', u.nome)
        + '<div class="mbox-col"><p class="usu-p">' + esc(u.nome) + ' é o último administrador ativo. A organização não pode ficar sem administrador: promova outra pessoa antes.</p></div>'
        + '<div class="usu-rodape"><button class="btn" onclick="document.getElementById(\'' + id + '\').remove()">Fechar</button></div>');
      return;
    }
    overlay(id, 480, cabecalho(id, '⏻', 'Desativar acesso', u.nome)
      + '<div class="mbox-col usu-col">'
      + caixa('red', 'Vale na hora', (u.sessoes ? 'Encerra agora ' + (u.sessoes > 1 ? 'as ' + u.sessoes + ' sessões abertas' : 'a sessão aberta') + '. ' : '')
        + esc(u.nome.split(/\s+/)[0]) + ' some da operação, não da auditoria: tudo o que fez continua na trilha.')
      + '<div class="sh-fp-field usu-campo"><label for="usu-d-motivo">Motivo</label><textarea id="usu-d-motivo" class="usu-input" rows="2" placeholder="Por exemplo: saiu da empresa"></textarea></div>'
      + '</div>'
      + rodape(id, 'O motivo fica na trilha.', 'usu-d-ok', 'Desativar', 'btn usu-btn-red', "shUsu.confirmarDesativar('" + u.id + "')"));
  }
  function confirmarDesativar(uid) {
    var u = porId(uid); if (!u) return;
    var mot = ((document.getElementById('usu-d-motivo') || {}).value || '').trim();
    if (!mot) { var e = document.getElementById('usu-d-motivo'); if (e) { e.classList.add('usu-erro'); e.focus(); } return; }
    var n = u.sessoes;
    u.estado = 'inativo';
    u.sessoes = 0;
    u.desativadoEm = hoje(); u.desativadoPor = eu().nome; u.motivo = mot;
    registrar(u, 'Desativado', mot + (n ? ' · ' + n + (n > 1 ? ' sessões encerradas' : ' sessão encerrada') : ''));
    fechar('usu-desat-overlay');
    render();
    toast(u.nome + ' foi desativado.', 'ok');
  }

  window.shUsu = {
    render: render, convidar: convidar, validarConvite: validarConvite, confirmarConvite: confirmarConvite,
    verEmail: verEmail, abrirAceite: abrirAceite, validarSenha: validarSenha, confirmarAceite: confirmarAceite,
    reenviar: reenviar, cancelar: cancelar, reativar: reativar, confirmarReativar: confirmarReativar,
    editar: editar, validarEdicao: validarEdicao, salvarEdicao: salvarEdicao, redefinirSenha: redefinirSenha,
    encerrarSessoes: encerrarSessoes, desativar: desativar, confirmarDesativar: confirmarDesativar,
    marcarEmpresa: marcarEmpresa
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();

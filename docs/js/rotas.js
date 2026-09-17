/* ═══════════════════════════════════════════════════════════════════════════
   Rotas — links diretos para as telas do SplitHub
   Formato: index.html#/<tela>[/<aba>][?<id-do-filtro>=<valor>&origem=ciclo]
   Ex.:     index.html#/conciliacao/lista?uni-apur=pendente&origem=ciclo
   A rota clica nos mesmos botões que o usuário clicaria, para que cada tela
   rode as próprias inicializações. Usada pela proposta de ciclo de vida.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function btn(sel) { return document.querySelector(sel); }
  function clicar(sel) { var b = btn(sel); if (b) b.click(); return !!b; }
  function view(id) { return clicar('.nav-btn[onclick^="showView(\'' + id + '\',this)"]'); }
  function sub(ns, id) { return clicar('.stab[onclick^="showSub(\'' + ns + '\',\'' + id + '\',this)"]'); }
  function admin(id) { return clicar('#subnav-admin-' + id); }

  var ROTAS = {
    'inicio':                   function () { view('dashboard'); },
    'ingestao':                 function () { admin('ingestao'); },
    'ingestao/lista':           function () { admin('ingestao'); setTimeout(function () { sub('ingv', 'lista'); }, 60); },
    'contratos':                function () { admin('contratos'); },
    'fornecedores':             function () { admin('fornecedores'); },
    'organizacao':              function () { admin('organizacao'); },
    'integracoes':              function () { admin('integracoes'); },
    'automacoes':               function () { admin('automacoes'); },
    'execucao-rad':             function () { admin('exec-rad'); },
    'pagamentos':               function () { view('pagamentos'); sub('pag', 'imp'); },
    'pagamentos/execucao':      function () { view('pagamentos'); sub('pag', 'exec'); },
    'conciliacao':              function () { view('conciliacao'); sub('conc', 'dash'); },
    'conciliacao/lista':        function () { view('conciliacao'); sub('conc', 'lista'); },
    'creditos':                 function () { view('creditos'); sub('cred', 'visao'); },
    'creditos/rfs':             function () { view('creditos'); sub('cred', 'listagem'); },
    'creditos/dfs':             function () { view('creditos'); sub('cred', 'dfs'); },
    'debitos':                  function () { view('debitos'); sub('deb', 'visao'); },
    'debitos/rfs':              function () { view('debitos'); sub('deb', 'rfs'); },
    'debitos/dfs':              function () { view('debitos'); sub('deb', 'dfs'); },
    'apuracao':                 function () {
      clicar('.atab[onclick="showAnalyticsTab(\'apuracao\')"]');
      try { if (window.sincronizarApuracao) window.sincronizarApuracao(); else if (window.apurRenderAll) window.apurRenderAll(); } catch (e) {}
      sub('apur', 'resumo');
    },
    'apuracao/creditos':        function () { ROTAS['apuracao'](); setTimeout(function () { sub('apur', 'creditos-tab'); }, 60); },
    'apuracao/debitos':         function () { ROTAS['apuracao'](); setTimeout(function () { sub('apur', 'debitos-tab'); }, 60); },
    'inconsistencias':          function () { view('inconsistencias'); clicar('[onclick^="showInconsistTab(\'visao\'"]'); },
    'inconsistencias/listagem': function () { view('inconsistencias'); clicar('[onclick^="showInconsistTab(\'listagem\'"]'); },
    'inconsistencias/kanban':   function () { view('inconsistencias'); clicar('[onclick^="showInconsistTab(\'kanban\'"]'); },
    'portal-fornecedor':        function () { var b = document.getElementById('nav-fornecedor-btn'); if (b && window.showView) window.showView('fornecedor', b); },
    'analytics':                function () { view('inteligencia'); }
  };

  function ler() {
    var h = location.hash || '';
    if (h.indexOf('#/') !== 0) return null;
    var partes = h.slice(2).split('?');
    var q = {};
    (partes[1] || '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      q[decodeURIComponent(i < 0 ? kv : kv.slice(0, i))] = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1));
    });
    return { rota: partes[0].replace(/\/$/, ''), q: q };
  }

  function filtros(q) {
    Object.keys(q).forEach(function (id) {
      if (id === 'origem') return;
      var el = document.getElementById(id);
      if (!el) return;
      el.value = q[id];
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function voltar(q) {
    var old = document.getElementById('sh-rota-voltar');
    if (old) old.remove();
    if (q.origem !== 'ciclo') return;
    var a = document.createElement('a');
    a.id = 'sh-rota-voltar';
    a.href = 'docs/proposta-ciclo-vida.html';
    a.textContent = '← Voltar ao ciclo de vida';
    a.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:9000;' +
      'background:var(--teal);color:var(--on-primary-dark,#fff);font:600 12px/1 inherit;padding:10px 16px;' +
      'border-radius:999px;text-decoration:none;box-shadow:0 4px 16px rgba(0,0,0,.25)';
    document.body.appendChild(a);
  }

  function aplicar() {
    var r = ler();
    if (!r) return;
    var lp = document.getElementById('lp-screen');
    if (lp && lp.style.display !== 'none') return; // aplica depois do login
    var fn = ROTAS[r.rota];
    if (!fn) { console.warn('[rotas] rota desconhecida:', r.rota); return; }
    try { fn(); } catch (e) { console.warn('[rotas]', e); }
    setTimeout(function () { filtros(r.q); }, 250);
    voltar(r.q);
    window.scrollTo(0, 0);
  }

  window.shRotas = Object.keys(ROTAS);
  window.shAplicarRota = aplicar;
  window.addEventListener('hashchange', aplicar);
  window.addEventListener('load', function () { setTimeout(aplicar, 400); });
})();

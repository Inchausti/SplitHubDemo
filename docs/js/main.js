// ──────────────────────────────────────────────────────────
// SPLITHUB DASHBOARD - MAIN APPLICATION SCRIPT
// ──────────────────────────────────────────────────────────

// ─── THEME TOGGLE ───
function toggleTheme() {
  const root = document.documentElement;
  const currentTheme = root.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  root.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

(function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
})();

// ─── SIDEBAR MOBILE ───
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  sidebar.classList.toggle('drawer-open');
  overlay.classList.toggle('open');
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  sidebar.classList.remove('drawer-open');
  overlay.classList.remove('open');
}

// ─── VIEW NAVIGATION ───
function showView(viewName, btnElement, isMobile = false) {
  const views = document.querySelectorAll('.view');
  views.forEach(v => v.classList.remove('active'));

  const selectedView = document.getElementById(`view-${viewName}`);
  if (selectedView) {
    selectedView.classList.add('active');
  }

  document.querySelectorAll('.bnav-btn, .nav-btn').forEach(b => b.classList.remove('active'));

  // Recolhe os submenus (ex.: Configurações) ao trocar de módulo.
  // Quem abre um submenu — showAdminSub — expande o grupo depois desta chamada.
  document.querySelectorAll('.nav-sub-group').forEach(g => g.classList.remove('expanded'));
  document.querySelectorAll('.nav-sub-btn').forEach(b => b.classList.remove('active'));

  if (btnElement) {
    btnElement.classList.add('active');
  }
  // O menu lateral e a barra inferior acompanham um ao outro; item de grupo
  // (Crédito, Apuração Assistida) deixa o grupo aberto e o pai marcado.
  const lateral = btnElement && btnElement.closest('#sidebar') ? btnElement : navItem('#sidebar', viewName);
  if (lateral) navMarcar(lateral);
  const inferior = navItem('#bottom-nav', viewName);
  if (inferior) inferior.classList.add('active');

  closeSidebar();

  if (viewName === 'inteligencia') {
    setTimeout(function() {
      try { if (window.atualizarInteligencia) window.atualizarInteligencia(); } catch(e) {}
    }, 50);
  }
  if (viewName === 'dashboard') {
    setTimeout(function() {
      try { if (window.atualizarDashboard) window.atualizarDashboard(); } catch(e) {}
    }, 50);
  }
  if (viewName === 'fct') {
    setTimeout(function() {
      try { if (window.renderizarFCT) window.renderizarFCT(); } catch(e) {}
    }, 60);
  }
}

// ─── GRUPOS DO MENU (Crédito, Apuração Assistida, Configurações) ───
function navItem(raiz, viewName) {
  return document.querySelector(raiz + ' [data-view="' + viewName + '"]') ||
    document.querySelector(raiz + ' [onclick^="showView(\'' + viewName + '\',"]');
}

function navMarcar(btn) {
  btn.classList.add('active');
  const grupo = btn.closest('.nav-sub-group');
  if (!grupo) return;
  grupo.classList.add('expanded');
  const pai = document.querySelector('[data-grupo="' + grupo.id + '"]');
  if (pai) pai.classList.add('active');
}

// O clique no grupo abre o primeiro item visível
function navGrupo(pai) {
  const grupo = document.getElementById(pai.dataset.grupo);
  const primeiro = grupo && Array.from(grupo.querySelectorAll('.nav-sub-btn')).find(b => b.style.display !== 'none');
  if (primeiro) primeiro.click();
}

// Apuração IBS/CBS: saiu das abas do Analytics para Apuração Assistida (R-271)
function abrirApuracao(btn, isMobile) {
  showView('apuracao', btn || document.getElementById('nav-apuracao-btn'), !!isMobile);
  setTimeout(function() {
    try { if (window.sincronizarApuracao) window.sincronizarApuracao(); else if (window.apurRenderAll) window.apurRenderAll(); } catch(e) {}
  }, 0);
}

// Menu recolhido: passar o mouse num grupo mostra os itens ao lado do ícone
(function() {
  let fly = null;
  function fechar() { if (fly) { fly.remove(); fly = null; } }
  function recolhido(pai) {
    const l = pai.querySelector('.nav-label');
    return !!l && getComputedStyle(l).display === 'none';
  }
  function abrir(pai) {
    fechar();
    const grupo = document.getElementById(pai.dataset.grupo);
    if (!grupo || !recolhido(pai)) return;
    const r = pai.getBoundingClientRect();
    fly = document.createElement('div');
    fly.className = 'nav-flyout';
    fly.style.top = r.top + 'px';
    fly.style.left = (r.right + 6) + 'px';
    const t = document.createElement('div');
    t.className = 'nav-flyout-t';
    t.textContent = pai.title;
    fly.appendChild(t);
    grupo.querySelectorAll('.nav-sub-btn').forEach(function(b) {
      if (b.style.display === 'none') return;
      const i = document.createElement('button');
      i.type = 'button';
      i.className = 'nav-flyout-i' + (b.classList.contains('active') ? ' active' : '');
      i.textContent = b.textContent.trim();
      i.onclick = function() { fechar(); b.click(); };
      fly.appendChild(i);
    });
    fly.addEventListener('mouseleave', fechar);
    document.body.appendChild(fly);
  }
  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('#sidebar [data-grupo]').forEach(function(pai) {
      pai.addEventListener('mouseenter', function() { abrir(pai); });
      pai.addEventListener('mouseleave', function(e) { if (fly && !fly.contains(e.relatedTarget)) fechar(); });
    });
  });
})();

// ─── SUBMENU TOGGLE ───
function showAnalyticsSub(viewName, btnElement) {
  const group = document.getElementById('nav-sub-group-analytics');
  const parentBtn = document.getElementById('nav-analytics-btn');

  if (!group.classList.contains('expanded')) {
    group.classList.add('expanded');
  }

  showView(viewName, btnElement);

  const buttons = document.querySelectorAll('#nav-sub-group-analytics .nav-sub-btn');
  buttons.forEach(b => b.classList.remove('active'));
  btnElement.classList.add('active');
  parentBtn.classList.add('active');
}

function showAdminSub(id, btnElement) {
  const parentBtn = document.getElementById('nav-admin-btn');

  // Navegar para view-admin (não view-contratos / view-fornecedores)
  showView('admin', parentBtn);

  // Expandir nav group
  document.querySelectorAll('.nav-sub-group').forEach(g => g.classList.remove('expanded'));
  const group = document.getElementById('nav-sub-group-admin');
  if (group) group.classList.add('expanded');

  // Marcar sub-botão ativo
  document.querySelectorAll('.nav-sub-btn').forEach(b => b.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');

  // Ativar stab correspondente
  document.querySelectorAll('#view-admin .stab').forEach(b => b.classList.remove('active'));
  const stab = document.querySelector('#view-admin .stab[onclick*="\'' + id + '\'"]');
  if (stab) stab.classList.add('active');

  // Alternar sv
  document.querySelectorAll('[id^="admin-"]').forEach(sv => sv.classList.remove('active'));
  const sv = document.getElementById('admin-' + (id || 'contratos'));
  if (sv) sv.classList.add('active');

  closeSidebar();

  if (id === 'contratos') {
    setTimeout(function() {
      if (typeof contratosRenderTabela === 'function') contratosRenderTabela();
      if (typeof contratosRenderKPIs === 'function') contratosRenderKPIs();
      if (typeof contratosPopulateSelect === 'function') contratosPopulateSelect();
    }, 0);
  }
  if (id === 'fornecedores') {
    setTimeout(function() {
      if (typeof adminFornRenderTabela === 'function') adminFornRenderTabela();
      if (typeof adminFornRenderKPIs === 'function') adminFornRenderKPIs();
    }, 0);
  }
  if (id === 'organizacao') {
    setTimeout(function() { if (window.orgRenderTabela) window.orgRenderTabela(); }, 0);
  }
  if (id === 'exec-rad') {
    setTimeout(function() { if (window.radInit) window.radInit(); }, 0);
  }
  if (id === 'integracoes') {
    setTimeout(function() { if (window.radIntgInit) window.radIntgInit(); }, 0);
  }
  if (id === 'ingestao') {
    setTimeout(function() { if (window.ingestaoInit) window.ingestaoInit(); }, 0);
  }
  if (id === 'automacoes') {
    setTimeout(function() { if (window.automInit) window.automInit(); }, 0);
  }
}

function showInconsistSub(id, btnElement) {
  const parentBtn = document.getElementById('nav-inconsist-btn');

  // Always navigate to the main inconsistências view
  showView('inconsistencias', parentBtn);
  // Garantir que a view fique visível mesmo se showView falhar internamente
  const vInc = document.getElementById('view-inconsistencias');
  if (vInc) vInc.classList.add('active');

  // Expandir grupo de nav (expandNavGroup não existe no main.js — inline)
  document.querySelectorAll('.nav-sub-group').forEach(g => g.classList.remove('expanded'));
  const group = document.getElementById('nav-sub-group-inconsist');
  if (group) group.classList.add('expanded');

  // Marcar sub-botão ativo
  document.querySelectorAll('.nav-sub-btn').forEach(b => b.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');

  // Alternar sub-view (lista ou kanban)
  document.querySelectorAll('[id^="inconsistencias-"]').forEach(sv => sv.classList.remove('active'));
  const subView = document.getElementById('inconsistencias-' + (id || 'lista'));
  if (subView) subView.classList.add('active');

  closeSidebar();

  if (!id || id === 'lista') {
    setTimeout(function() {
      try { if (typeof inconsistRenderTabela === 'function') inconsistRenderTabela(); } catch(e) {}
      if (window.renderizarRFsInconsistencias) window.renderizarRFsInconsistencias();
    }, 0);
  } else if (id === 'kanban') {
    setTimeout(function() {
      if (window.renderizarKanbanInconsistencias) window.renderizarKanbanInconsistencias();
    }, 0);
  }
}

// ─── TAB SWITCHING ───
function showSub(groupName, tabName, btnElement) {
  document.querySelectorAll(`.sv`).forEach(tab => {
    if (tab.id === `${groupName}-${tabName}`) {
      tab.classList.add('active');
    } else if (tab.id.startsWith(`${groupName}-`)) {
      tab.classList.remove('active');
    }
  });

  const tabButtons = document.querySelectorAll('.stab');
  tabButtons.forEach(b => b.classList.remove('active'));
  if (btnElement) {
    btnElement.classList.add('active');
  }
}

// ─── COMPANY EDITING ───
function editCompanyName(element) {
  const currentName = element.textContent;
  const newName = prompt('Editar empresa:', currentName);
  if (newName && newName.trim()) {
    element.textContent = newName;
  }
}

// ─── SETTINGS MODAL ───
function openSettings() {
  const overlay = document.getElementById('settings-overlay');
  if (!overlay) return;
  overlay.classList.add('open');
}

function closeSettings() {
  const overlay = document.getElementById('settings-overlay');
  if (overlay) {
    overlay.classList.remove('open');
  }
}

// ─── CNPJ FILTER ───
// dashCnpjToggleDropdown sobrescrito em data-sync-fixed.js (usa _orgCnpjs)

// ─── CREDITOS FUNCTIONS ───
function creditosVerRegistrosRisco() {
  alert('Exibindo registros em risco...');
}

function debitosVerDetalheExtincao() {
  alert('Exibindo detalhamento por tipo...');
}

function creditosVerRelatorioPerdas() {
  alert('Gerando relatório de perdas...');
}

function creditosLimparFiltro() {
  if (window._filtrosCreditos) {
    window._filtrosCreditos.status = '';
    window._filtrosCreditos.statusMulti = [];
  }
  var chip = document.getElementById('creditos-filtro-chip');
  if (chip) chip.style.display = 'none';
  if (window.renderizarTabelaCreditos) window.renderizarTabelaCreditos();
}

// ─── FCT (FLUXO DE CAIXA TRIBUTÁRIO) ───
function fctSetTributo(tipo, btn) {
  document.querySelectorAll('.fct-tab-tributo .stab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  window._fctTributo = tipo;
  try { window.renderizarFCT && window.renderizarFCT(); } catch(e) {}
}

function fctSetGranularidade(gran, btn) {
  document.querySelectorAll('.fct-tab-gran .stab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function fctSimular() {
  const resultado = document.getElementById('fct-sim-resultado');
  resultado.style.display = 'block';
}

// ─── UTILITY FUNCTIONS ───
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0
  }).format(value);
}

function formatDate(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(date));
}

// ─── INITIALIZATION ───
document.addEventListener('DOMContentLoaded', function() {
  // Close settings when clicking overlay
  const settingsOverlay = document.getElementById('settings-overlay');
  if (settingsOverlay) {
    settingsOverlay.addEventListener('click', function(e) {
      if (e.target === this) {
        closeSettings();
      }
    });
  }

  // Close sidebar when clicking outside
  document.addEventListener('click', function(e) {
    const sidebar = document.getElementById('sidebar');
    const hamburger = document.getElementById('hamburger');
    if (sidebar && !sidebar.contains(e.target) && !hamburger.contains(e.target)) {
      closeSidebar();
    }
  });

  console.log('✓ SplitHub Dashboard initialized');
});

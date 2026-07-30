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

  if (isMobile) {
    const buttons = document.querySelectorAll('.bnav-btn');
    buttons.forEach(b => b.classList.remove('active'));
  } else {
    const buttons = document.querySelectorAll('.nav-btn');
    buttons.forEach(b => b.classList.remove('active'));
  }

  if (btnElement) {
    btnElement.classList.add('active');
  }

  closeSidebar();
}

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

function showAdminSub(viewName, btnElement) {
  const group = document.getElementById('nav-sub-group-admin');
  const parentBtn = document.getElementById('nav-admin-btn');

  if (!group.classList.contains('expanded')) {
    group.classList.add('expanded');
  }

  showView(viewName, btnElement);

  const buttons = document.querySelectorAll('#nav-sub-group-admin .nav-sub-btn');
  buttons.forEach(b => b.classList.remove('active'));
  btnElement.classList.add('active');
  parentBtn.classList.add('active');
}

function showInconsistSub(viewName, btnElement) {
  const group = document.getElementById('nav-sub-group-inconsist');
  const parentBtn = document.getElementById('nav-inconsist-btn');

  if (!group.classList.contains('expanded')) {
    group.classList.add('expanded');
  }

  showView(viewName, btnElement);

  const buttons = document.querySelectorAll('#nav-sub-group-inconsist .nav-sub-btn');
  buttons.forEach(b => b.classList.remove('active'));
  btnElement.classList.add('active');
  parentBtn.classList.add('active');
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
function dashCnpjToggleDropdown(event) {
  event.stopPropagation();
  const panel = document.getElementById('cnpj-filter-panel');
  const list = document.getElementById('cnpj-filter-list');

  panel.classList.toggle('open');

  if (panel.classList.contains('open') && list.children.length === 0) {
    const cnpjs = [
      { cnpj: '01.123.456/0001-99', name: 'Indústria ABC Ltda' },
      { cnpj: '17.197.585/0001-21', name: 'Randon S.A.' },
      { cnpj: '17.197.757/0001-00', name: 'Marcopolo S.A.' },
      { cnpj: '33.592.510/0001-62', name: 'Vale S.A.' }
    ];

    list.innerHTML = cnpjs.map(item => `
      <label class="cnpj-filter-item">
        <input type="checkbox" checked>
        <div>${item.name}<br><span class="cfi-cnpj">${item.cnpj}</span></div>
      </label>
    `).join('');
  }

  document.addEventListener('click', function closePicker(e) {
    if (!document.getElementById('cnpj-filter').contains(e.target)) {
      panel.classList.remove('open');
      document.removeEventListener('click', closePicker);
    }
  });
}

function dashCnpjSelecionarTodos() {
  const checkboxes = document.querySelectorAll('#cnpj-filter-list input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = true);
}

function dashCnpjLimpar() {
  const checkboxes = document.querySelectorAll('#cnpj-filter-list input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = false);
}

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
  document.getElementById('creditos-filtro-chip').style.display = 'none';
}

// ─── FCT (FLUXO DE CAIXA TRIBUTÁRIO) ───
function fctSetTributo(tipo, btn) {
  document.querySelectorAll('.fct-tab-tributo .stab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
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

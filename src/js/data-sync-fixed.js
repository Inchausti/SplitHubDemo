/**
 * Data Sync Manager - Versão Corrigida
 * Sincroniza 500 NFs de entrada com o dashboard
 * Gera R$ 50.000.000 em créditos apropriados (10% de R$ 500M)
 */

/* ── Paleta global de gráficos — espelho de window.PALETTE em index.html ──
   Para mudar o tema do app inteiro: edite PALETTE aqui + --p-* no :root do CSS. */
var PALETTE = window.PALETTE || {
  teal:     '#1d9e75',
  tealDark: '#0f6e56',
  blue:     '#185fa5',
  amber:    '#ba7517',
  red:      '#a32d2d',
  gray:     '#888780'
};

/* ── Status semântico — única fonte de verdade para badges/chips/gráficos ──
   Alterar PALETTE acima propaga automaticamente para todos os indicadores. */
var _hexRgb = function(hex) {
  var h = hex.replace('#','');
  return parseInt(h.slice(0,2),16)+','+parseInt(h.slice(2,4),16)+','+parseInt(h.slice(4,6),16);
};
var STATUS = window.STATUS = {
  ok:    PALETTE.teal,
  info:  PALETTE.blue,
  warn:  PALETTE.amber,
  bad:   PALETTE.red,
  muted: PALETTE.gray,
  /* mapas derivados */
  colors: {
    'a_apropriar':   PALETTE.gray,
    'nao_apropriado':PALETTE.amber,
    'apropriado':    PALETTE.teal,
    'utilizado':     PALETTE.teal,
    'glosado':       PALETTE.gray,
    'inconsistencia':PALETTE.red,
    'em_risco':      PALETTE.amber,
    'a_prescrever':  PALETTE.red,
    'vencido':       PALETTE.red,
    'extinto':       PALETTE.teal,
    'nao_extinto':   PALETTE.gray,
    'confirmado':    PALETTE.teal,
    'aguardando':    PALETTE.amber,
    'perdido':       PALETTE.red,
    'vencendo':      PALETTE.amber,
    'atrasado':      PALETTE.red,
    'pendente':      PALETTE.amber,
    'pago':          PALETTE.teal
  },
  rgb: function(hex) { return _hexRgb(hex || PALETTE.gray); }
};

// Auxiliar multi-select período — suporta f.mesAnoArr (array) E f.mesAno (string)
/* ── Estrutura global de listagens ─────────────────────────────────────────
   Fonte única de verdade para colunas das tabelas principais.
   Adicionar coluna = 1 linha no array de cols.
   shRenderThead(key) gera o <thead> automaticamente a partir do config.      */
window.SH_TABLES = {
  creditos: {
    id: 't-creditos',
    cols: [
      { label: 'RF' },
      { label: 'Tipo Fiscal' },
      { label: 'Tipo de DFe' },
      { label: 'Nota Fiscal' },
      { label: 'Fornecedor' },
      { label: 'Data NF' },
      { label: 'Valor Total',        cls: 'r' },
      { label: 'Valor Líquido',      cls: 'r' },
      { label: 'CBS',                cls: 'r' },
      { label: 'IBS',                cls: 'r' },
      { label: 'Crédito',            cls: 'r' },
      { label: 'Pagamento' },
      { label: 'Status Crédito' },
      { label: 'Status RF' },
      { label: 'Contrato' },
      { label: 'Método de Pagamento' },
      { thHtml: '<span style="display:inline-flex;align-items:center;gap:5px">Método de Extinção'
          + '<span style="position:relative;display:inline-flex" class="ctr-tip-wrap">'
          + '<span style="width:14px;height:14px;border-radius:50%;background:rgba(73,197,177,.15);border:1px solid rgba(73,197,177,.35);display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:var(--teal);cursor:default;line-height:1;flex-shrink:0">?</span>'
          + '<span class="ctr-tip" style="display:none;position:absolute;right:0;top:22px;width:340px;background:var(--sidebar);border:1px solid var(--border);border-radius:8px;padding:14px 16px;z-index:9900;box-shadow:0 8px 24px rgba(0,0,0,.28);pointer-events:none;font-weight:400;text-transform:none;letter-spacing:0">'
          + '<div style="font-size:11px;font-weight:700;color:var(--txt1);margin-bottom:10px">Métodos de extinção do crédito tributário</div>'
          + '<div style="display:flex;flex-direction:column;gap:9px;font-size:11px;line-height:1.55">'
          + '<div><span style="display:inline-block;background:rgba(73,197,177,.12);color:var(--teal);border:1px solid rgba(73,197,177,.3);border-radius:3px;padding:1px 7px;font-size:10px;font-weight:700;margin-bottom:3px">Split Payment</span><br><span style="color:var(--txt2)">Extinção automática no momento da liquidação financeira da NF. O sistema financeiro retém e repassa o valor do IBS/CBS diretamente ao Fisco sem ação do contribuinte — mecanismo padrão da LC 214/2025.</span></div>'
          + '<div><span style="display:inline-block;background:rgba(59,130,246,.12);color:var(--blue);border:1px solid rgba(59,130,246,.3);border-radius:3px;padding:1px 7px;font-size:10px;font-weight:700;margin-bottom:3px">Compensação</span><br><span style="color:var(--txt2)">O crédito acumulado é usado para abater débitos de IBS/CBS apurados no período. Realizado na declaração periódica do contribuinte junto ao Comitê Gestor do IBS / Receita Federal.</span></div>'
          + '<div><span style="display:inline-block;background:rgba(34,197,94,.12);color:var(--green);border:1px solid rgba(34,197,94,.3);border-radius:3px;padding:1px 7px;font-size:10px;font-weight:700;margin-bottom:3px">Ressarcimento</span><br><span style="color:var(--txt2)">Quando os créditos superam os débitos apurados (ex: exportadores, setores com alíquota zero na saída), o saldo é ressarcido em dinheiro pelo Fisco dentro do prazo regulamentado.</span></div>'
          + '<div><span style="display:inline-block;background:rgba(139,92,246,.12);color:var(--purple);border:1px solid rgba(139,92,246,.3);border-radius:3px;padding:1px 7px;font-size:10px;font-weight:700;margin-bottom:3px">Transferência</span><br><span style="color:var(--txt2)">Cessão do saldo credor para outro contribuinte da cadeia, mediante autorização do Comitê Gestor. Aplicável a setores com acúmulo estrutural de créditos e relação contratual estabelecida.</span></div>'
          + '</div></span></span></span>' }
    ]
  },
  debitos: {
    id: 't-debitos',
    cols: [
      { label: 'RF' },
      { label: 'Tipo Fiscal' },
      { label: 'Tipo de DFe' },
      { label: 'Nota Fiscal' },
      { label: 'Cliente' },
      { label: 'Data NF' },
      { label: 'Valor Total',    cls: 'r' },
      { label: 'Valor Líquido', cls: 'r' },
      { label: 'CBS',           cls: 'r' },
      { label: 'IBS',           cls: 'r' },
      { label: 'Débito',        cls: 'r' },
      { label: 'Extinção' },
      { label: 'Status' },
      { label: 'Status RF' },
      { label: 'Método de Extinção' }
    ]
  },
  dashDfCp: {
    id: 'dash-df-cp',
    cols: [
      { label: 'DF' },
      { label: 'Fornecedor' },
      { label: 'Valor IBS+CBS', cls: 'r' },
      { label: 'Data NF' },
      { label: 'Situação' }
    ]
  },
  dashDfLp: {
    id: 'dash-df-lp',
    cols: [
      { label: 'DF' },
      { label: 'Fornecedor' },
      { label: 'Valor IBS+CBS', cls: 'r' },
      { label: 'Data NF' },
      { label: 'Situação' }
    ]
  },
  pagamentos: {
    id: 't-impostos',
    cols: [
      { thHtml: '<input type="checkbox" id="pag-chk-all" onchange="window.pagToggleAll(this)" title="Selecionar todos pendentes" style="cursor:pointer;width:15px;height:15px">', cls: 'tc', style: 'width:36px;text-align:center' },
      { label: 'RF' },
      { label: 'Documento Fiscal' },
      { label: 'Fornecedor' },
      { label: 'Tipo Fiscal' },
      { label: 'Tipo de DFe' },
      { label: 'Método' },
      { label: 'Valor',      cls: 'r' },
      { label: 'Data RF' },
      { label: 'Pagamento' },
      { label: 'Status' },
      { label: 'Ação' }
    ]
  },
  inconsistencias: {
    id: 't-inc-rfs',
    cols: [
      { label: 'ID' },
      { label: 'DF Vinculado' },
      { label: 'Fluxo' },
      { label: 'RF Vinculado' },
      { label: 'Tipo Fiscal' },
      { label: 'Entidade' },
      { label: 'Valor',               cls: 'r' },
      { label: 'Tipo Inconsistência' },
      { label: 'Origem' },
      { label: 'Status' },
      { label: 'Prioridade' },
      { label: 'Data' }
    ]
  },
  contratos: {
    id: 't-contratos',
    cols: [
      { label: 'Contrato' },
      { label: 'CNPJ' },
      { label: 'Fornecedor' },
      { label: 'Início' },
      { label: 'Fim' },
      { label: 'Método de Pagamento' },
      { label: 'Prazo pagto.' },
      { label: 'Status' },
      { label: 'NFs vinculadas', cls: 'r' }
    ]
  },
  fornecedores: {
    id: 't-adm-fornecedores',
    cols: [
      { label: 'Grupo / CNPJ' },
      { label: 'Razão Social' },
      { label: 'Tipo' },
      { label: 'Status' },
      { label: 'Score',          cls: 'r' },
      { label: 'Contrato' },
      { label: 'Multi-contratos' },
      { label: 'Vol. compras',   cls: 'r' },
      { label: 'Créditos',       cls: 'r' },
      { label: 'Pend.' },
      { label: '' }
    ]
  },
  organizacao: {
    id: 't-org-cnpjs',
    cols: [
      { label: 'CNPJ' },
      { label: 'Razão Social' },
      { label: 'IE' },
      { label: 'UF' },
      { label: 'Tipo' },
      { label: 'Status' },
      { label: 'Ações', style: 'text-align:center' }
    ]
  }
};

window.shRenderThead = function(key) {
  var cfg = window.SH_TABLES[key];
  if (!cfg) return;
  var tbody = document.getElementById(cfg.id);
  if (!tbody) return;
  var table = tbody.closest('table');
  if (!table) return;
  var old = table.querySelector('thead');
  if (old) old.remove();
  var thead = document.createElement('thead');
  var tr = document.createElement('tr');
  cfg.cols.forEach(function(col) {
    var th = document.createElement('th');
    if (col.cls) th.className = col.cls;
    if (col.style) th.setAttribute('style', col.style);
    if (col.thHtml) { th.innerHTML = col.thHtml; }
    else { th.textContent = col.label; }
    tr.appendChild(th);
  });
  thead.appendChild(tr);
  table.insertBefore(thead, table.firstChild);
};

/* ── Global filter panel builder — design C-1 Teal ── */
window.shBuildFilterPanel = function(cfg) {
  if (document.getElementById(cfg.wrapperId)) return;
  if (!cfg.anchor) return;

  function mkField(f) {
    var inp;
    if (f.type === 'select') {
      var opts = '<option value="">Todos</option>' + (f.options || []).map(function(o) {
        return '<option value="' + o.value + '">' + o.label + '</option>';
      }).join('');
      inp = '<select id="' + f.id + '" onchange="window.' + cfg.onFilter + '()">' + opts + '</select>';
    } else {
      inp = '<input id="' + f.id + '" type="' + f.type + '"'
        + (f.placeholder !== undefined ? ' placeholder="' + f.placeholder + '"' : '')
        + (f.min         !== undefined ? ' min="' + f.min + '"'                 : '')
        + ' oninput="window.' + cfg.onFilter + '()">';
    }
    return '<div class="sh-fp-field"><label>' + f.label + '</label>' + inp + '</div>';
  }

  var fields = (cfg.fields || []).map(mkField).join('');
  var h = '<div id="' + cfg.wrapperId + '" class="sh-fp">'
    + '<div class="sh-fp-bar">'
    +   '<div class="sh-fp-sw"><span class="sh-fp-sw-ico">⌕</span>'
    +   '<input id="' + cfg.prefix + '-busca" type="text" placeholder="' + (cfg.searchPlaceholder || 'Pesquisar…') + '" oninput="window.' + cfg.onFilter + '()"></div>'
    +   '<button id="' + cfg.prefix + '-toggle-btn" class="sh-fp-btn" onclick="window.shToggleFilterPanel(\'' + cfg.prefix + '\')">'
    +     '⧉ Filtros <span class="sh-fp-badge" id="' + cfg.prefix + '-badge" data-count="0">0</span></button>'
    + '</div>'
    + '<div class="sh-fp-panel" id="' + cfg.prefix + '-corpo" style="display:none">'
    +   '<div class="sh-fp-grid">' + fields + '</div>'
    +   '<div class="sh-fp-footer">'
    +     '<button class="sh-fp-clear" onclick="window.' + cfg.onClear + '()">✕ Limpar filtros</button>'
    +     '<span class="sh-fp-count" id="' + cfg.countId + '">— registros</span>'
    +     '<button class="sh-fp-apply" onclick="window.' + cfg.onFilter + '()">Aplicar</button>'
    +   '</div>'
    + '</div></div>';

  cfg.anchor.insertAdjacentHTML('beforebegin', h);
};

window.shToggleFilterPanel = function(prefix) {
  var panel = document.getElementById(prefix + '-corpo');
  var btn   = document.getElementById(prefix + '-toggle-btn');
  if (!panel) return;
  var isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (btn) btn.classList.toggle('open', !isOpen);
};

window.dashRenderDFsApropriar = function() {
  var cpRows = [], lpRows = [];
  var srLabel = { em_risco: 'Em Risco', vencido: 'Vencido', inconsistencia: 'Inconsistência', a_prescrever: 'A Prescrever' };
  var srRgb   = { em_risco: _hexRgb(PALETTE.amber), vencido: _hexRgb(PALETTE.red), inconsistencia: _hexRgb(PALETTE.red), a_prescrever: _hexRgb(PALETTE.red) };

  var hoje = new Date(); hoje.setHours(0,0,0,0);
  var mesAtual = hoje.getFullYear() * 100 + (hoje.getMonth() + 1); // YYYYMM

  // vencimento = último dia do mês seguinte à emissão
  function calcVencimento(dataISO) {
    if (!dataISO) return null;
    var p = dataISO.split('-');
    if (p.length < 2) return null;
    var y = parseInt(p[0], 10), m = parseInt(p[1], 10);
    return new Date(y, m + 1, 0);
  }

  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'entrada') return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      var sc = rf.statusCredito || rf.status || '';
      if (sc !== 'nao_apropriado') return;
      var sr   = rf.statusRegistro || null;
      var v    = rf.valor || 0;
      var dp   = (rf.data || '').split('-');
      var venc = calcVencimento(rf.data);
      if (!venc) return;
      var mesVenc = venc.getFullYear() * 100 + (venc.getMonth() + 1);
      // Excluir DFs com vencimento em meses anteriores ao atual
      if (mesVenc < mesAtual) return;
      var row = {
        nf:   (nf.tipoDF || 'NF-e') + ' ' + (rf.nfVinculada || nf.numero || ''),
        forn: rf.entidade || nf.entidade || '—',
        valor: v,
        data: dp.length === 3 ? dp[2]+'/'+dp[1]+'/'+dp[0] : '—',
        sr: sr
      };
      // CP: vencimento no mês atual; LP: vencimento em meses futuros
      if (mesVenc === mesAtual) cpRows.push(row);
      else lpRows.push(row);
    });
  });

  function buildRow(r) {
    var srBadge = r.sr
      ? '<span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;background:rgba('+srRgb[r.sr]+',.12);color:rgba('+srRgb[r.sr]+',1);border:1px solid rgba('+srRgb[r.sr]+',.28)">'+(srLabel[r.sr]||r.sr)+'</span>'
      : '';
    return '<tr>'
      + '<td class="mono nowrap" style="font-size:11px">' + r.nf + '</td>'
      + '<td class="trunc">' + r.forn + '</td>'
      + '<td class="r mono">' + ff(r.valor) + '</td>'
      + '<td class="nowrap" style="color:var(--txt2)">' + r.data + '</td>'
      + '<td class="nowrap">' + srBadge + '</td>'
      + '</tr>';
  }

  var empty = function(msg) { return '<tr><td colspan="5" style="text-align:center;color:var(--txt3);padding:20px">'+msg+'</td></tr>'; };
  var cpSorted = cpRows.sort(function(a,b){return b.valor-a.valor;}).slice(0,10);
  var lpSorted = lpRows.sort(function(a,b){return b.valor-a.valor;}).slice(0,10);

  var tbCp = document.getElementById('dash-df-cp');
  var tbLp = document.getElementById('dash-df-lp');
  if (tbCp) tbCp.innerHTML = cpSorted.length ? cpSorted.map(buildRow).join('') : empty('Nenhum DF com risco imediato');
  if (tbLp) tbLp.innerHTML = lpSorted.length ? lpSorted.map(buildRow).join('') : empty('Nenhum DF pendente');
};

window._matchPeriodo = function(dateStr, f) {
  var d = dateStr || '';
  if (f.mesAnoArr && f.mesAnoArr.length) return f.mesAnoArr.some(function(m){ return d.startsWith(m); });
  if (f.mesAno) return d.startsWith(f.mesAno);
  return true;
};

// Função auxiliar de formatação
function ff(val) {
  if (!val && val !== 0) return '—';
  return 'R$ ' + val.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

// Formatação que retorna vazio quando o valor é zero
function ffz(val) {
  if (!val || val === 0) return '—';
  return 'R$ ' + val.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

// Fechar modal de detalhes da NF
window.nfFecharDetalhes = function() {
  var modal = document.getElementById('nf-modal');
  if (modal) modal.style.display = 'none';
};

// Contratos por CNPJ dos fornecedores reais das NFs geradas
var _contratosData = [
  {id:'CT-0001',cnpj:'14.382.976/0001-09',inicio:'2025-08-01',fim:'2026-06-30',rad:false,prazo:'30'},
  {id:'CT-0002',cnpj:'28.447.821/0001-35',inicio:'2025-10-01',fim:'2026-09-30',rad:true, prazo:'60'},
  {id:'CT-0003',cnpj:'52.039.781/0001-74',inicio:'2025-07-01',fim:'2026-12-31',rad:false,prazo:'90'},
  {id:'CT-0004',cnpj:'73.612.590/0001-41',inicio:'2025-11-01',fim:'2026-10-31',rad:true, prazo:'30'},
  {id:'CT-0005',cnpj:'19.854.203/0001-67',inicio:'2026-01-01',fim:'2026-12-31',rad:false,prazo:'60'},
  {id:'CT-0006',cnpj:'38.291.045/0001-52',inicio:'2025-09-01',fim:'2026-08-31',rad:false,prazo:'30'},
  {id:'CT-0007',cnpj:'61.874.320/0001-88',inicio:'2025-12-01',fim:'2026-11-30',rad:true, prazo:'90'},
  {id:'CT-0008',cnpj:'47.193.825/0001-16',inicio:'2026-01-01',fim:'2026-06-30',rad:false,prazo:'60'},
  {id:'CT-0009',cnpj:'86.340.217/0001-63',inicio:'2025-06-01',fim:'2026-05-31',rad:true, prazo:'120'},
  {id:'CT-0010',cnpj:'93.475.862/0001-29',inicio:'2026-01-01',fim:'2026-12-31',rad:false,prazo:'30'}
];

function _brToISOLocal(br) {
  if (!br || br.indexOf('-') !== -1) return br || '';
  var p = br.split('/');
  return p.length === 3 ? p[2]+'-'+p[1]+'-'+p[0] : br;
}

function buscarContrato(cnpj, dataISO) {
  // Usa window.contratosGlobal (fonte única) se disponível; fallback para _contratosData
  var lista = (window.contratosGlobal && window.contratosGlobal.length)
    ? window.contratosGlobal : _contratosData;
  for (var i = 0; i < lista.length; i++) {
    var c = lista[i];
    var ini = _brToISOLocal(c.inicio), fim = _brToISOLocal(c.fim);
    if (c.cnpj === cnpj && dataISO >= ini && dataISO <= fim) return c;
  }
  return null;
}

// Função auxiliar de badges
function bdg(status) {
  var labels = {
    // ── Status do Crédito ──
    'a_apropriar':   'A Apropriar',
    'nao_apropriado':'Não Apropriado',
    'apropriado':    'Apropriado',
    'utilizado':     'Utilizado',
    'glosado':       'Glosado',
    // ── Status do Registro ──
    'inconsistencia':'Inconsistência',
    'em_risco':      'Em risco',
    'a_prescrever':  'A Prescrever',
    'vencido':       'Vencido',
    // ── Saída ──
    'extinto':       'Extinto',
    'nao_extinto':   'Não Extinto',
    // ── Pagamentos ──
    'confirmado':    'Confirmado',
    'aguardando':    'Aguardando',
    'perdido':       'Perdido',
    'vencendo':      'Vencendo',
    'atrasado':      'Atrasado',
    'pendente':      'Pendente',
    'pago':          'Pago'
  };
  var cor = STATUS.colors[status] || STATUS.muted;
  var text = labels[status] || (status.charAt(0).toUpperCase() + status.slice(1));
  var rgb = STATUS.rgb(cor);
  return '<span style="background:transparent;color:' + cor + ';border:1px solid rgba(' + rgb + ',.3);border-radius:3px;padding:2px 7px;font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase">' + text + '</span>';
}

// ============================================================
// SISTEMA UNIVERSAL DE PAGINAÇÃO — 25 itens por página (fixo)
// ============================================================
var _PAG_SIZE = 25;
window._paginacao = {};

var _PAG_ALL_TBODIES = [
  't-recent','t-impostos','t-forn','t-creditos','t-debitos',
  't-gestao-rfs','t-listagem-nfs','t-rad-prazo',
  't-apur-resumo','t-apur-cred','t-apur-deb',
  't-contratos','t-adm-fornecedores',
  't-inc-tipo','t-inc-fornecedores','t-inconsistencias','t-inc-rfs'
];

function _pagBtnStyle(dis) {
  return 'background:var(--card);border:1px solid var(--brd);border-radius:6px;'
    + 'padding:4px 12px;font-size:11px;cursor:' + (dis ? 'default' : 'pointer') + ';'
    + 'color:' + (dis ? 'var(--txt3)' : 'var(--txt1)') + ';opacity:' + (dis ? '.4' : '1');
}

window.paginarTabela = function(tbodyId) {
  var tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  var rows = Array.from(tbody.querySelectorAll('tr'));
  if (!rows.length) return;

  var state = window._paginacao[tbodyId];
  if (!state) { state = { pagina: 1 }; window._paginacao[tbodyId] = state; }
  var totalPags = Math.max(1, Math.ceil(rows.length / _PAG_SIZE));
  state.pagina = Math.max(1, Math.min(state.pagina, totalPags));

  var ini = (state.pagina - 1) * _PAG_SIZE;
  var fim = Math.min(ini + _PAG_SIZE, rows.length);

  rows.forEach(function(r, i) { r.style.display = (i >= ini && i < fim) ? '' : 'none'; });

  // Injetar ou atualizar controles
  var ctrlId = 'pag-ctrl-' + tbodyId;
  var ctrl = document.getElementById(ctrlId);
  if (!ctrl) {
    ctrl = document.createElement('div');
    ctrl.id = ctrlId;
    var tbl = tbody.closest('table');
    var wrap = tbl ? (tbl.parentElement || tbl) : tbody;
    wrap.insertAdjacentElement('afterend', ctrl);
  }
  ctrl.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 4px 2px;font-size:11px;color:var(--txt2)';

  var prevDis = state.pagina <= 1;
  var nextDis = state.pagina >= totalPags;
  ctrl.innerHTML =
    '<span>' + (ini + 1) + '–' + fim + ' de ' + rows.length + ' registros</span>'
    + '<div style="display:flex;gap:8px;align-items:center">'
    + '<button ' + (prevDis ? 'disabled ' : '') + 'onclick="window.paginaIr(\'' + tbodyId + '\',' + (state.pagina - 1) + ')" style="' + _pagBtnStyle(prevDis) + '">‹ Anterior</button>'
    + '<span style="font-weight:600;color:var(--txt1);min-width:70px;text-align:center">Pág. ' + state.pagina + ' / ' + totalPags + '</span>'
    + '<button ' + (nextDis ? 'disabled ' : '') + 'onclick="window.paginaIr(\'' + tbodyId + '\',' + (state.pagina + 1) + ')" style="' + _pagBtnStyle(nextDis) + '">Próxima ›</button>'
    + '</div>';
};

window.paginaIr = function(tbodyId, pag) {
  if (!window._paginacao[tbodyId]) window._paginacao[tbodyId] = {};
  window._paginacao[tbodyId].pagina = pag;
  window.paginarTabela(tbodyId);
};

window.iniciarPaginacaoUniversal = function() {
  // Ocultar controles de paginação antigos do HTML para evitar duplicidade
  ['nf-btn-prev','nf-btn-prox','nf-pag-atual','nf-pag-total','nf-pag-info',
   'rf-btn-prev','rf-btn-prox','rf-pag-atual','rf-pag-total','rf-pag-info'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { var p = el.parentElement; if (p) p.style.display = 'none'; }
  });

  _PAG_ALL_TBODIES.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    window.paginarTabela(id);
    var obs = new MutationObserver(function() {
      // Reset para pág 1 apenas quando conteúdo muda (não quando show/hide de rows)
      if (!window._paginacao[id]) window._paginacao[id] = {};
      window._paginacao[id].pagina = 1;
      window.paginarTabela(id);
    });
    obs.observe(el, { childList: true });
  });
};

// Renderizar listagem de NFs (Conciliação) — apenas NFs de entrada
window.renderizarListaNFs = function() {
  var lista = (window.nfListaFiltradaGlobal || []).filter(function(nf) { return nf.tipo === 'entrada'; });

  var _dfColorsMap = {
    'NF-e':   ['24,95,165','#185fa5'], 'NFC-e':  ['99,102,241','#6366F1'],
    'NFCom':  ['16,185,129','#10B981'], 'NF3-e':  ['20,184,166','#14B8A6'],
    'NFS-e':  ['29,158,117','#1d9e75'], 'CT-e':   ['186,117,23','#ba7517'],
    'NFAg':   ['132,204,22','#84CC16'],'NFGás':  ['234,179,8','#EAB308'],
    'MDF-e':  ['168,85,247','#A855F7'],'BP-e':   ['29,158,117','var(--teal)']
  };

  var h = '';
  lista.forEach(function(r) {
    var _dfT = r.tipoDF || 'NF-e';
    var _dc = _dfColorsMap[_dfT] || _dfColorsMap['NF-e'];
    var tipoBadge = '<span style="background:rgba(' + _dc[0] + ',.12);color:' + _dc[1] + ';border:1px solid rgba(' + _dc[0] + ',.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">' + _dfT + '</span>';

    var statusMap = {
      'nao_apropriado': ['244,63,94','#a32d2d','Não Apropriado'],
      'apropriado':     ['186,117,23','#ba7517','Apropriado'],
      'utilizado':      ['29,158,117','#1d9e75','Utilizado'],
      'nao_extinto':    ['244,63,94','#a32d2d','Não Extinto'],
      'extinto':        ['29,158,117','#1d9e75','Extinto']
    };
    var sm = statusMap[r.status] || ['167,168,170','#A7A8AA', r.status || '—'];
    var statusBadge = '<span style="background:rgba(' + sm[0] + ',.12);color:' + sm[1] + ';border:1px solid rgba(' + sm[0] + ',.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">' + sm[2] + '</span>';

    var dataParts = r.data.split('-');
    var dataFormatada = dataParts[2] + '/' + dataParts[1] + '/' + dataParts[0];

    var chave = r.chaveDF || '';
    var chaveTrunc = chave ? (chave.slice(0,4) + ' ' + chave.slice(4,8) + ' ' + chave.slice(8,12) + ' …') : '—';
    var numLabel = _dfT + ' ' + r.numero;

    h += '<tr>'
      + '<td class="mono nowrap"><button onclick="window.abrirDetalhesNFporNumero(\'' + r.numero + '\')" style="background:none;border:none;color:#185fa5;cursor:pointer;font-weight:600;padding:0;text-decoration:underline;font-family:inherit;font-size:11px">' + numLabel + '</button></td>'
      + '<td class="nowrap">' + tipoBadge + '</td>'
      + '<td class="trunc">' + r.entidade + '</td>'
      + '<td class="mono" style="color:var(--txt2)">' + r.cnpj + '</td>'
      + '<td class="r mono">' + ff(r.valorTotal) + '</td>'
      + '<td class="r mono" style="color:var(--txt2)">' + ff(r.valorLiquido) + '</td>'
      + '<td class="r mono" style="color:var(--txt2)">' + ffz(r.cbs) + '</td>'
      + '<td class="r mono" style="color:var(--txt2)">' + ffz(r.ibs) + '</td>'
      + '<td class="nowrap">' + statusBadge + '</td>'
      + '<td class="nowrap" style="color:var(--txt2)">' + dataFormatada + '</td>'
      + '<td class="mono" style="font-size:10px;color:var(--txt3)" title="' + chave + ' (' + chave.length + ' dígitos)">' + chaveTrunc + '</td>'
      + '</tr>';
  });

  if (!lista.length) {
    h = '<tr><td colspan="11" style="text-align:center;color:var(--txt3);padding:24px">Nenhuma NF encontrada para este filtro.</td></tr>';
  }

  var tbody = document.getElementById('t-listagem-nfs');
  if (tbody) tbody.innerHTML = h;

  var sub = document.getElementById('nf-count-sub');
  if (sub) sub.textContent = lista.length + ' de ' + (window.nfTotalGlobal || lista.length) + ' NFs exibidas';

  console.log('[data-sync-fixed] Listagem de NFs renderizada com', lista.length, 'registros');
};

// Abrir detalhe da NF — overlay completo com histórico consolidado
window.abrirDetalhesNFporNumero = function(nfNumero) {
  var lista = window.nfListaFiltradaGlobal || [];
  var r = null;
  for (var i = 0; i < lista.length; i++) {
    if (lista[i].numero === nfNumero) { r = lista[i]; break; }
  }
  if (!r) return;

  var F = window._rfFmt || function(s){ return s; };
  var A = window._rfAddDays || function(iso, n){ return iso; };
  var DR = window._rfDetailRow || function(l, v){ return '<div>' + l + ': ' + v + '</div>'; };

  var dataParts = (r.data || '').split('-');
  var dataFmt = dataParts.length === 3 ? dataParts[2]+'/'+dataParts[1]+'/'+dataParts[0] : (r.data || '—');
  var tipoLabel = r.tipo === 'entrada' ? 'Entrada' : 'Saída';
  var tipoColor = r.tipo === 'entrada' ? '#1d9e75' : '#185fa5';

  // ── Status badge da NF ──────────────────────────────────────────────────
  var stLabs = { nao_apropriado:'Não Apropriado', apropriado:'Apropriado', utilizado:'Utilizado',
    nao_extinto:'Não Extinto', extinto:'Extinto' };
  var stRgbs = { nao_apropriado:_hexRgb(PALETTE.amber), apropriado:_hexRgb(PALETTE.teal), utilizado:_hexRgb(PALETTE.teal),
    nao_extinto:_hexRgb(PALETTE.gray), extinto:_hexRgb(PALETTE.teal) };
  var stKey = r.status || 'nao_apropriado';
  var stLab = stLabs[stKey] || stKey;
  var stRgb = stRgbs[stKey] || '167,168,170';

  // ── Registros Fiscais ───────────────────────────────────────────────────
  var rfsCss = { ibs:PALETTE.blue, cbs:PALETTE.amber };
  var rfsHtml = '';
  (r.registrosFiscais || []).forEach(function(rf) {
    var tfLbl = rf.tipoFiscal === 'ibs' ? 'IBS' : 'CBS';
    var tfCor = rfsCss[rf.tipoFiscal] || '#A7A8AA';
    var stRfLab = stLabs[rf.statusCredito || rf.status] || (rf.statusCredito || rf.status || '—');
    var stRfRgb = stRgbs[rf.statusCredito || rf.status] || '167,168,170';
    var stRgLab = rf.statusRegistro ? ({ inconsistencia:'Inconsistência', em_risco:'Em risco', vencido:'Vencido', a_prescrever:'A Prescrever' }[rf.statusRegistro] || rf.statusRegistro) : null;
    var stRgRgb = rf.statusRegistro ? ({ inconsistencia:_hexRgb(PALETTE.red), em_risco:_hexRgb(PALETTE.amber), vencido:_hexRgb(PALETTE.red), a_prescrever:_hexRgb(PALETTE.red) }[rf.statusRegistro] || _hexRgb(PALETTE.gray)) : null;
    rfsHtml += '<div style="background:rgba(24,95,165,.04);border:1px solid rgba(24,95,165,.15);border-radius:8px;padding:12px;margin-bottom:10px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
      + '<div style="display:flex;align-items:center;gap:8px">'
      + '<span style="background:rgba(' + (tfCor==='#185fa5'?'24,95,165':'186,117,23') + ',.15);color:' + tfCor + ';border:1px solid rgba(' + (tfCor==='#185fa5'?'24,95,165':'186,117,23') + ',.35);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">' + tfLbl + '</span>'
      + '<span style="font-size:11px;font-family:monospace;color:var(--txt2)">' + rf.id + '</span>'
      + '</div>'
      + '<button onclick="document.getElementById(\'nf-detalhe-overlay\').remove();window.abrirDetalheRF(\'' + rf.id + '\')" style="background:rgba(24,95,165,.08);border:1px solid rgba(24,95,165,.2);border-radius:4px;color:#185fa5;cursor:pointer;font-size:10px;font-weight:700;padding:3px 8px">Ver RF →</button>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px">'
      + '<div style="color:var(--txt3)">Valor: <span style="color:var(--txt1);font-weight:600">' + ff(rf.valor) + '</span></div>'
      + '<div style="color:var(--txt3)">NF Total: <span style="color:var(--txt1)">' + ff(rf.valorTotalNF || 0) + '</span></div>'
      + '<div style="display:flex;align-items:center;gap:4px">Status: <span style="background:rgba(' + stRfRgb + ',.12);color:rgba(' + stRfRgb + ',1);border:1px solid rgba(' + stRfRgb + ',.3);border-radius:3px;padding:1px 6px;font-size:10px;font-weight:600">' + stRfLab + '</span></div>'
      + (stRgLab ? '<div style="display:flex;align-items:center;gap:4px">RF: <span style="background:rgba(' + stRgRgb + ',.12);color:rgba(' + stRgRgb + ',1);border:1px solid rgba(' + stRgRgb + ',.3);border-radius:3px;padding:1px 6px;font-size:10px;font-weight:600">' + stRgLab + '</span></div>' : '<div></div>')
      + ((rf.statusCredito||rf.status)==='utilizado'&&rf.metodoExtincao ? '<div style="color:var(--txt3)">Extinção: <span style="color:var(--teal);font-weight:600">' + rf.metodoExtincao + '</span></div>' : '')
      + ((rf.statusCredito||rf.status)==='utilizado'&&rf.dataExtincao ? '<div style="color:var(--txt3)">Data: <span style="color:var(--txt1)">' + rf.dataExtincao + '</span></div>' : '')
      + '</div>'
      + '</div>';
  });

  // ── Timeline NF: agrega eventos de todos os RFs ─────────────────────────
  var evRgba  = { 'INGESTÃO':'29,158,117', 'VALIDAÇÃO':'29,158,117', 'GERAÇÃO RF':'24,95,165',
    'INCONSISTÊNCIA':'163,45,45', 'VENCIMENTO':'163,45,45', 'AGUARDANDO':'186,117,23',
    'APROPRIAÇÃO':'29,158,117', 'PAGAMENTO':'29,158,117', 'UTILIZAÇÃO':'139,92,246', 'EXTINÇÃO':'167,168,170', 'CONCILIAÇÃO':'139,92,246',
    'CONC APURAÇÃO':'24,95,165', 'CONC FINANCEIRA':'29,158,117' };
  var evIcons = { 'INGESTÃO':'↓', 'VALIDAÇÃO':'✓', 'GERAÇÃO RF':'◉', 'INCONSISTÊNCIA':'!',
    'VENCIMENTO':'✕', 'AGUARDANDO':'…', 'APROPRIAÇÃO':'✓', 'PAGAMENTO':'$', 'UTILIZAÇÃO':'◆', 'EXTINÇÃO':'■', 'CONCILIAÇÃO':'⇌',
    'CONC APURAÇÃO':'⇌', 'CONC FINANCEIRA':'⇌' };

  var allEvents = [];
  var d0 = r.data || '';

  // Eventos da NF (comuns a todos os RFs)
  var FTS = window._rfFmtTS, MK = window._rfMkTS;
  if (d0) {
    allEvents.push({ ts: MK(d0,'08:32'), data: FTS(MK(d0,'08:32')), tipo: 'INGESTÃO', modulo: 'Ingestão de DFs', ator: 'SEFAZ',
      desc: (r.tipoDF || 'NF-e') + ' ' + r.numero + ' recebida e registrada na plataforma SplitHub · emitente: ' + (r.entidade || '—'), cls: 'ok' });
    allEvents.push({ ts: MK(A(d0,1),'09:15'), data: FTS(MK(A(d0,1),'09:15')), tipo: 'VALIDAÇÃO', modulo: 'Ingestão de DFs', ator: 'SplitHub',
      desc: 'Schema XML e dados fiscais validados · documento aceito · ' + tipoLabel, cls: 'ok' });
  }

  // Eventos por RF
  (r.registrosFiscais || []).forEach(function(rf, ri) {
    if (!window._rfGerarHistorico) return;
    var evs = window._rfGerarHistorico(rf, r);
    // Skip INGESTÃO e VALIDAÇÃO — já adicionamos no nível NF
    evs.slice(2).forEach(function(ev) {
      var tfSuffix = rf.tipoFiscal ? ' · ' + rf.tipoFiscal.toUpperCase() : '';
      allEvents.push({
        ts: ev.ts || '—',
        data: ev.data,
        tipo: ev.tipo,
        modulo: ev.modulo,
        ator: ev.ator,
        desc: ev.desc + (ev.tipo === 'GERAÇÃO RF' ? tfSuffix : ''),
        cls: ev.cls
      });
    });
  });

  // Ordenar decrescente por timestamp (mais recente primeiro)
  allEvents.sort(function(a, b) {
    var ta = a.ts || '—', tb = b.ts || '—';
    if (ta === '—' && tb === '—') return 0;
    if (ta === '—') return 1;
    if (tb === '—') return -1;
    return ta > tb ? -1 : ta < tb ? 1 : 0;
  });

  var tlH = '';
  allEvents.forEach(function(ev, i) {
    var rgba = evRgba[ev.tipo] || '167,168,170';
    var isLast = i === allEvents.length - 1;
    var dotRgba = ev.cls === 'erro' ? '163,45,45' : ev.cls === 'pending' ? '186,117,23' : rgba;
    var icon = evIcons[ev.tipo] || '◯';
    tlH += '<div style="display:flex;gap:12px">'
      + '<div style="display:flex;flex-direction:column;align-items:center;width:28px;flex-shrink:0">'
      + '<div style="width:28px;height:28px;border-radius:50%;background:rgba(' + dotRgba + ',.15);border:1.5px solid rgba(' + dotRgba + ',.6);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:rgba(' + dotRgba + ',1)">' + icon + '</div>'
      + (!isLast ? '<div style="width:1px;flex:1;background:rgba(128,128,128,.2);margin:3px 0;min-height:20px"></div>' : '')
      + '</div>'
      + '<div style="flex:1;padding-bottom:' + (isLast ? '0' : '22') + 'px">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">'
      + '<span style="background:rgba(' + rgba + ',.12);color:rgba(' + rgba + ',1);border:1px solid rgba(' + rgba + ',.3);border-radius:3px;padding:1px 7px;font-size:9px;font-weight:700;letter-spacing:.07em">' + ev.tipo + '</span>'
      + '<span style="font-size:10px;color:var(--txt3);font-family:monospace">' + ev.data + '</span>'
      + '</div>'
      + '<div style="font-size:12px;color:var(--txt1);line-height:1.55;margin-bottom:3px">' + ev.desc + '</div>'
      + '<div style="font-size:10px;color:var(--txt2)">' + ev.modulo + ' · ' + ev.ator + '</div>'
      + '</div>'
      + '</div>';
  });

  // ── Montar overlay ──────────────────────────────────────────────────────
  var chaveFormatada = r.chaveDF ? r.chaveDF.replace(/(.{4})(?=.)/g, '$1 ') : '—';

  // Contrato vigente na data da NF
  var ctrAtivo = window.getContratoAtivo ? window.getContratoAtivo(r.cnpj, r.data) : null;
  var ctrHtml = '';
  if (ctrAtivo) {
    var ctrModelo = ctrAtivo.modelo === 'adquirente'
      ? '<span style="color:#185fa5;font-weight:600">Adquirente recolhe</span>'
      : '<span style="color:var(--teal);font-weight:600">Fornecedor recolhe</span>';
    var ctrRAD = ctrAtivo.rad
      ? '<span style="background:rgba(24,95,165,.1);color:#185fa5;border:1px solid rgba(24,95,165,.25);border-radius:3px;padding:1px 6px;font-size:10px;font-weight:600;margin-left:4px">RAD</span>' : '';
    ctrHtml = '<div style="height:1px;background:var(--brd);margin:12px 0"></div>'
      + '<div style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Contrato</div>'
      + '<div style="background:rgba(73,197,177,.06);border:1px solid rgba(73,197,177,.2);border-radius:6px;padding:10px 12px;font-size:11px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
      + '<span style="font-weight:700;color:var(--teal);font-family:monospace">' + ctrAtivo.id + '</span>'
      + ctrRAD
      + '</div>'
      + DR('Vigência', (ctrAtivo.inicio||'—') + ' → ' + (ctrAtivo.fim||'—'))
      + DR('Prazo pgto.', (ctrAtivo.prazo||'—') + ' dias')
      + '<div style="margin-top:6px;font-size:10px;color:var(--txt3)">Modelo: ' + ctrModelo + '</div>'
      + '</div>';
  } else {
    ctrHtml = '<div style="height:1px;background:var(--brd);margin:12px 0"></div>'
      + '<div style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Contrato</div>'
      + '<div style="font-size:11px;color:var(--txt3);font-style:italic">Nenhum contrato vigente na data da NF.</div>';
  }
  var html = '<div id="nf-detalhe-overlay" class="moverlay" onclick="if(event.target===this)document.getElementById(\'nf-detalhe-overlay\').remove()">'
    + '<div class="mbox" style="width:900px">'

    // Header
    + '<div class="mbox-hdr">'
    + '<div style="display:flex;align-items:center;gap:12px">'
    + '<div class="mbox-icon">🧾</div>'
    + '<div>'
    + '<div class="mbox-title">' + (r.tipoDF || 'NF-e') + ' ' + r.numero + '</div>'
    + '<div class="mbox-sub">' + (r.entidade || '—') + ' · ' + (r.cnpj || '—') + ' · ' + dataFmt + '</div>'
    + '</div>'
    + '</div>'
    + '<button onclick="document.getElementById(\'nf-detalhe-overlay\').remove()" class="mbox-close">✕</button>'
    + '</div>'

    // Body: two columns
    + '<div style="display:flex;flex:1;overflow:hidden">'

    // Left panel
    + '<div class="mbox-col" style="width:300px;flex-shrink:0;border-right:1px solid var(--brd)">'
    + '<div class="mbox-section-label">Documento Fiscal</div>'
    + DR('Número', (r.tipoDF || 'NF-e') + ' ' + r.numero)
    + DR('Tipo', '<span style="color:' + tipoColor + ';font-weight:700">' + tipoLabel + '</span>')
    + DR('Emitente', r.entidade || '—')
    + DR('CNPJ', r.cnpj || '—', null, true)
    + DR('Data', dataFmt)
    + DR('Status', '<span style="background:rgba(' + stRgb + ',.12);color:rgba(' + stRgb + ',1);border:1px solid rgba(' + stRgb + ',.3);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">' + stLab + '</span>')
    + '<div class="mbox-divider"></div>'
    + '<div class="mbox-section-label">Valores</div>'
    + DR('Total', ff(r.valorTotal || 0))
    + DR('Líquido', ff(r.valorLiquido || 0))
    + DR('CBS', ffz(r.cbs || 0), 'var(--p-amber)')
    + DR('IBS', ffz(r.ibs || 0), 'var(--p-blue)')
    + '<div class="mbox-divider"></div>'
    + '<div class="mbox-section-label" style="margin-bottom:4px">Chave DF</div>'
    + '<div style="font-size:9px;font-family:monospace;color:var(--txt3);word-break:break-all;line-height:1.7;margin-bottom:14px">' + chaveFormatada + '</div>'
    + ctrHtml
    + '<div class="mbox-divider"></div>'
    + '<div class="mbox-section-label">Registros Fiscais</div>'
    + rfsHtml
    + '<div class="mbox-divider"></div>'
    + '<div class="mbox-section-label">Inconsistências Vinculadas</div>'
    + window._incRenderVinculadasHtml(r._inconsistencias && r._inconsistencias.length ? r._inconsistencias : (window._inconsistenciasGlobal||[]).filter(function(i){ return i.nfNumero === r.numero || i.dfNum === ((r.tipoDF||'NF-e')+' '+r.numero); }))
    + '</div>'

    // Right panel: timeline
    + '<div class="mbox-col" style="flex:1">'
    + '<div class="mbox-section-label">Histórico do Ciclo · ' + allEvents.length + ' evento' + (allEvents.length !== 1 ? 's' : '') + '</div>'
    + (tlH || '<div style="color:var(--txt3);font-size:12px">Nenhum evento disponível.</div>')
    + '</div>'
    + '</div>'
    + '</div>'
    + '</div>';

  var existing = document.getElementById('nf-detalhe-overlay');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', html);
};

// ── Detalhe RF: índice + histórico do ciclo ────────────────────────────────

window._rfAddDays = function(iso, n) {
  var d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n);
  return d.toISOString().substring(0, 10);
};
// Formata data ISO → DD/MM/AAAA
window._rfFmt = function(iso) {
  if (!iso || iso === '—') return '—';
  var p = (iso.split('T')[0] || iso).split('-');
  return p.length === 3 ? p[2]+'/'+p[1]+'/'+p[0] : iso;
};
// Formata datetime ISO → DD/MM/AAAA HH:MM (timestamp)
window._rfFmtTS = function(iso) {
  if (!iso || iso === '—') return '—';
  var parts = iso.split('T');
  var datePart = parts[0].split('-');
  var timePart = (parts[1] || '').substring(0, 5);
  if (datePart.length !== 3) return iso;
  return datePart[2]+'/'+datePart[1]+'/'+datePart[0] + (timePart ? ' ' + timePart : '');
};
// Monta ISO datetime: iso date + hh:mm fixo
window._rfMkTS = function(isoDate, hhmm) {
  if (!isoDate || isoDate === '—') return '—';
  return isoDate + 'T' + (hhmm || '00:00');
};
window._rfDetailRow = function(label, value, color, mono) {
  var valStyle = 'font-size:12px;font-weight:500;color:' + (color || 'var(--txt1)') + ';' + (mono ? 'font-family:monospace;font-size:10px' : '');
  return '<div class="mbox-field">'
    + '<div class="mbox-field-label">' + label + '</div>'
    + '<div class="mbox-field-value" style="' + valStyle + '">' + (value || '—') + '</div>'
    + '</div>';
};

window._rfGerarHistorico = function(rf, nf) {
  var ev = [];
  var d0 = rf.data || nf.data || '';
  if (!d0) return ev;
  var A = window._rfAddDays, F = window._rfFmtTS, MK = window._rfMkTS;
  var isSaida = nf.tipo === 'saida';

  function mkEv(ts, tipo, modulo, ator, desc, cls) {
    return { ts: ts, data: (ts === '—' ? '—' : F(ts)), tipo: tipo, modulo: modulo, ator: ator, desc: desc, cls: cls };
  }

  ev.push(mkEv(MK(d0,'08:32'),          'INGESTÃO',      'Ingestão de DFs',          'SEFAZ',
    'Documento ' + (nf.tipoDF || 'NF-e') + ' ' + nf.numero + ' recebido e registrado na plataforma SplitHub', 'ok'));

  ev.push(mkEv(MK(A(d0,1),'09:15'),     'VALIDAÇÃO',     'Ingestão de DFs',          'SplitHub',
    'Schema XML e dados fiscais validados · emitente/destinatário conferidos · documento aceito', 'ok'));

  ev.push(mkEv(MK(A(d0,2),'10:00'),     'GERAÇÃO RF',    isSaida ? 'Débitos' : 'Créditos', 'SplitHub',
    'RF ' + rf.id + ' gerado · ' + (rf.tipoFiscal || '').toUpperCase() + ' · alíquota de transição 2026 · Art. 48 LC 214/2025', 'ok'));

  // Conciliação de Apuração — valores fiscais vs. Apuração Assistida Gov
  var _concRA = rf._concRegApur || nf._concRegApur || null;
  if (_concRA) {
    var _clsA = _concRA.concStatus === 'confirmada' ? 'ok' : _concRA.concStatus === 'inconsistencia' ? 'erro' : 'pending';
    var _lblA = { confirmada:'Confirmada', inconsistencia:'Inconsistência', pendente:'Pendente' }[_concRA.concStatus] || _concRA.concStatus;
    ev.push(mkEv(_concRA.concTs, 'CONC APURAÇÃO', 'Conciliação', 'SplitHub',
      'Conciliação de Apuração · valores calculados × Apuração Assistida Gov · status: ' + _lblA + ' · ' + _concRA.concId + ' · ' + (rf.tipoFiscal || '').toUpperCase(), _clsA));
  }
  // Conciliação Financeira — liquidação, segregação IBS/CBS e comprovantes
  var _concRF = rf._concRegFin || nf._concRegFin || null;
  if (_concRF) {
    var _clsF = _concRF.concStatus === 'confirmada' ? 'ok' : _concRF.concStatus === 'inconsistencia' ? 'erro' : 'pending';
    var _lblF = { confirmada:'Confirmada', inconsistencia:'Inconsistência', pendente:'Pendente' }[_concRF.concStatus] || _concRF.concStatus;
    ev.push(mkEv(_concRF.concTs, 'CONC FINANCEIRA', 'Conciliação', 'SplitHub',
      'Conciliação Financeira · liquidação financeira e segregação IBS/CBS · status: ' + _lblF + ' · ' + _concRF.concId + ' · ' + (rf.tipoFiscal || '').toUpperCase(), _clsF));
  }

  var _sc_hist = rf.statusCredito || rf.status || '';
  var _sr_hist = rf.statusRegistro || null;

  if (_sr_hist === 'inconsistencia') {
    ev.push(mkEv(MK(A(d0,3),'14:27'),   'INCONSISTÊNCIA','Inconsistências',           'SplitHub',
      (rf.inconsistencia || 'Divergência') + ' identificada · registro encaminhado para revisão manual', 'erro'));
  }
  if (_sr_hist === 'a_prescrever') {
    ev.push(mkEv(MK(A(d0,5),'09:00'),   'AGUARDANDO',    'Créditos',                 'SplitHub',
      'Crédito não apropriado com prazo de 5 anos próximo ao vencimento · ação urgente necessária', 'pending'));
  }
  if (_sr_hist === 'em_risco') {
    ev.push(mkEv(MK(A(d0,5),'09:00'),   'AGUARDANDO',    'Créditos',                 'SplitHub',
      'Registro sinalizado como em risco · pendência de validação fiscal', 'pending'));
  }
  if (_sr_hist === 'vencido') {
    ev.push(mkEv(MK(A(d0,30),'23:59'),  'VENCIMENTO',    'Créditos',                 'SplitHub',
      'Prazo regulamentar de apropriação expirado · RF classificado como vencido', 'erro'));
  }
  if (_sc_hist === 'nao_apropriado' && !_sr_hist) {
    ev.push(mkEv('—',                   'AGUARDANDO',    'Créditos',                 'Comitê Gestor IBS / RFB',
      'Aguardando reconhecimento de crédito pelo órgão competente', 'pending'));
  }
  if (_sc_hist === 'glosado') {
    ev.push(mkEv(MK(A(d0,10),'10:45'), 'INCONSISTÊNCIA','Créditos',                  'Fisco',
      'Crédito glosado pelo Fisco · direito ao crédito negado · requer impugnação', 'erro'));
  }
  if (_sc_hist === 'apropriado' || _sc_hist === 'utilizado' || _sc_hist === 'extinto') {
    ev.push(mkEv(MK(A(d0,15),'11:30'), 'APROPRIAÇÃO',   'Créditos',                 'Comitê Gestor IBS / RFB',
      'Crédito de ' + ff(rf.valor) + ' reconhecido e apropriado · ' + (rf.tipoFiscal || '').toUpperCase() + ' · Art. 48 LC 214/2025', 'ok'));
  }
  if (rf.dataPagamento && rf.dataPagamento !== '—') {
    // dataPagamento pode já ter hora (DD/MM/AAAA HH:MM) — extrair e reformat
    var dpRaw = rf.dataPagamento;
    var dpISO = dpRaw.indexOf('/') !== -1
      ? dpRaw.substring(6,10)+'-'+dpRaw.substring(3,5)+'-'+dpRaw.substring(0,2)
      : dpRaw.substring(0,10);
    var dpHora = dpRaw.length > 10 ? dpRaw.substring(11,16) : '14:00';
    var dpTS = dpISO + 'T' + dpHora;
    var _mpEv = rf.metodoPagamento || nf.metodoPagamento || 'Fornecedor';
    var _evDesc = 'Guia ' + (rf.tipoFiscal === 'ibs' ? 'IBS' : 'DARF CBS') + ' quitada · ' + ff(rf.valor) + ' · via ' + _mpEv
      + (_mpEv === 'Fornecedor' ? ' · confirmação via Apuração Assistida' : '');
    ev.push(mkEv(dpTS, 'PAGAMENTO', 'Pagamentos', _mpEv, _evDesc, 'ok'));
  }
  if (_sc_hist === 'utilizado') {
    var _utilValor = ff(rf.valor || 0);
    var _utilDesc = 'Crédito de ' + _utilValor + ' aplicado como abatimento em débito tributário · método: ' + (rf.metodoExtincao || 'Compensação');
    // Vincular deterministicamente a NFs de saída com base no ID do RF
    if (rf._dfsSaidaAbatidos && rf._dfsSaidaAbatidos.length) {
      var _saidaRefs = rf._dfsSaidaAbatidos.map(function(s){ return 'DF ' + s.numero + ' (' + ff(s.valor) + ')'; }).join(', ');
      _utilDesc += ' · DFs de saída abatidas: ' + _saidaRefs;
    } else {
      var _saidaNFs = (window.nfListaFiltradaGlobal || []).filter(function(n){ return n.tipo === 'saida'; });
      if (_saidaNFs.length > 0) {
        var _rfSeed = parseInt((rf.id || '').replace(/\D/g,''), 10) || 1;
        var _sIdx1 = _rfSeed % _saidaNFs.length;
        var _sIdx2 = (_rfSeed * 7 + 3) % _saidaNFs.length;
        var _refs = [_saidaNFs[_sIdx1]];
        if (_sIdx2 !== _sIdx1) _refs.push(_saidaNFs[_sIdx2]);
        // Fracionar valor abatido entre as saídas selecionadas
        var _totalAbat = rf.valor || 0;
        var _saidaStr = _refs.map(function(sn, i) {
          var frac = _refs.length > 1 ? (i === 0 ? Math.round(_totalAbat * 0.6) : _totalAbat - Math.round(_totalAbat * 0.6)) : _totalAbat;
          return 'DF ' + sn.numero + ' (' + ff(frac) + ')';
        }).join(', ');
        _utilDesc += ' · DFs de saída envolvidas: ' + _saidaStr;
      }
    }
    ev.push(mkEv(MK(A(d0,20),'14:18'), 'UTILIZAÇÃO', 'Pagamentos', 'SplitHub', _utilDesc, 'ok'));
  }
  if (isSaida && rf.dataExtincao && rf.dataExtincao !== '—') {
    var dExtISO = rf.dataExtincao.indexOf('/') !== -1
      ? rf.dataExtincao.substring(6,10)+'-'+rf.dataExtincao.substring(3,5)+'-'+rf.dataExtincao.substring(0,2)
      : rf.dataExtincao;
    ev.push(mkEv(MK(dExtISO,'16:45'),  'EXTINÇÃO',      'Débitos',                  rf.metodoExtincao || 'SplitHub',
      'Débito extinto · ciclo tributário encerrado · método: ' + (rf.metodoExtincao || 'Split Payment'), 'ok'));
  } else if (rf.status === 'extinto') {
    ev.push(mkEv(MK(A(d0,25),'16:45'), 'EXTINÇÃO',      isSaida ? 'Débitos' : 'Créditos', 'SplitHub',
      isSaida ? 'Débito extinto · ciclo tributário encerrado' : 'Crédito integralmente utilizado · ciclo do RF encerrado', 'ok'));
  }
  return ev;
};

window.abrirDetalheRF = function(rfId) {
  var entry = (window._rfIndex || {})[rfId];
  if (!entry) { console.warn('[SplitHub] RF não encontrado no índice:', rfId); return; }
  var rf = entry.rf, nf = entry.nf;
  var eventos = window._rfGerarHistorico(rf, nf);

  var tfLabel = rf.tipoFiscal === 'ibs' ? 'IBS' : 'CBS';
  var tfColor = rf.tipoFiscal === 'ibs' ? PALETTE.blue : PALETTE.amber;
  // Status do Crédito
  var stCredLabs = { nao_apropriado:'Não Apropriado', apropriado:'Apropriado', utilizado:'Utilizado', glosado:'Glosado' };
  var stCredRgbs = { nao_apropriado:_hexRgb(PALETTE.amber), apropriado:_hexRgb(PALETTE.teal), utilizado:_hexRgb(PALETTE.teal), glosado:_hexRgb(PALETTE.gray) };
  // Status do Registro
  var stRegLabs  = { inconsistencia:'Inconsistência', em_risco:'Em risco', a_prescrever:'A Prescrever', vencido:'Vencido' };
  var stRegRgbs  = { inconsistencia:_hexRgb(PALETTE.red), em_risco:_hexRgb(PALETTE.amber), a_prescrever:_hexRgb(PALETTE.red), vencido:_hexRgb(PALETTE.red) };
  // Saída (status de débito)
  var stDebLabs  = { extinto:'Extinto', nao_extinto:'Não Extinto' };
  var stDebRgbs  = { extinto:'29,158,117', nao_extinto:'167,168,170' };
  var rfSt  = rf.statusCredito || rf.status || 'nao_apropriado';
  var rfSR  = rf.statusRegistro || null;
  var stLab = stCredLabs[rfSt] || stDebLabs[rfSt] || rfSt;
  var stRgb = stCredRgbs[rfSt] || stDebRgbs[rfSt] || '167,168,170';
  var stRegLab = rfSR ? (stRegLabs[rfSR] || rfSR) : null;
  var stRegRgb = rfSR ? (stRegRgbs[rfSR] || '167,168,170') : null;

  var evRgba  = { 'INGESTÃO':'29,158,117', 'VALIDAÇÃO':'29,158,117', 'GERAÇÃO RF':'24,95,165', 'INCONSISTÊNCIA':'163,45,45', 'VENCIMENTO':'163,45,45', 'AGUARDANDO':'186,117,23', 'APROPRIAÇÃO':'29,158,117', 'PAGAMENTO':'29,158,117', 'UTILIZAÇÃO':'139,92,246', 'EXTINÇÃO':'167,168,170', 'CONCILIAÇÃO':'139,92,246', 'CONC APURAÇÃO':'24,95,165', 'CONC FINANCEIRA':'29,158,117' };
  var evIcons = { 'INGESTÃO':'↓', 'VALIDAÇÃO':'✓', 'GERAÇÃO RF':'◉', 'INCONSISTÊNCIA':'!', 'VENCIMENTO':'✕', 'AGUARDANDO':'…', 'APROPRIAÇÃO':'✓', 'PAGAMENTO':'$', 'UTILIZAÇÃO':'◆', 'EXTINÇÃO':'■', 'CONCILIAÇÃO':'⇌', 'CONC APURAÇÃO':'⇌', 'CONC FINANCEIRA':'⇌' };

  // Ordenar decrescente por timestamp (mais recente primeiro)
  eventos.sort(function(a, b) {
    var ta = a.ts || '—', tb = b.ts || '—';
    if (ta === '—' && tb === '—') return 0;
    if (ta === '—') return 1;
    if (tb === '—') return -1;
    return ta > tb ? -1 : ta < tb ? 1 : 0;
  });

  var tlH = '';
  eventos.forEach(function(ev, i) {
    var rgba = evRgba[ev.tipo] || '167,168,170';
    var isLast = i === eventos.length - 1;
    var dotRgba = ev.cls === 'erro' ? '163,45,45' : ev.cls === 'pending' ? '186,117,23' : rgba;
    var icon = evIcons[ev.tipo] || '◯';
    tlH += '<div style="display:flex;gap:12px">'
      + '<div style="display:flex;flex-direction:column;align-items:center;width:28px;flex-shrink:0">'
      + '<div style="width:28px;height:28px;border-radius:50%;background:rgba(' + dotRgba + ',.15);border:1.5px solid rgba(' + dotRgba + ',.6);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:rgba(' + dotRgba + ',1)">' + icon + '</div>'
      + (!isLast ? '<div style="width:1px;flex:1;background:rgba(128,128,128,.2);margin:3px 0;min-height:20px"></div>' : '')
      + '</div>'
      + '<div style="flex:1;padding-bottom:' + (isLast ? '0' : '22') + 'px">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">'
      + '<span style="background:rgba(' + rgba + ',.12);color:rgba(' + rgba + ',1);border:1px solid rgba(' + rgba + ',.3);border-radius:3px;padding:1px 7px;font-size:9px;font-weight:700;letter-spacing:.07em">' + ev.tipo + '</span>'
      + '<span style="font-size:10px;color:var(--txt3);font-family:monospace">' + ev.data + '</span>'
      + '</div>'
      + '<div style="font-size:12px;color:var(--txt1);line-height:1.55;margin-bottom:3px">' + ev.desc + '</div>'
      + '<div style="font-size:10px;color:var(--txt2)">' + ev.modulo + ' · ' + ev.ator + '</div>'
      + '</div>'
      + '</div>';
  });

  var dpNF = (nf.data || '').split('-');
  var nfDataFmt = dpNF.length === 3 ? dpNF[2]+'/'+dpNF[1]+'/'+dpNF[0] : (nf.data || '—');
  var DR = window._rfDetailRow;

  var html = '<div id="rf-detalhe-overlay" class="moverlay" onclick="if(event.target===this)document.getElementById(\'rf-detalhe-overlay\').remove()">'
    + '<div class="mbox" style="width:860px">'

    // Header
    + '<div class="mbox-hdr">'
    + '<div style="display:flex;align-items:center;gap:12px">'
    + '<div class="mbox-icon blue">📋</div>'
    + '<div><div class="mbox-title">Registro Fiscal · ' + rf.id + '</div>'
    + '<div class="mbox-sub">' + (nf.tipoDF || 'NF-e') + ' ' + nf.numero + ' · ' + (nf.entidade || '—') + '</div></div>'
    + '</div>'
    + '<button onclick="document.getElementById(\'rf-detalhe-overlay\').remove()" class="mbox-close">✕</button>'
    + '</div>'

    // Body
    + '<div style="display:flex;flex:1;overflow:hidden">'

    // Left panel: dados do RF
    + '<div class="mbox-col" style="width:280px;flex-shrink:0;border-right:1px solid var(--brd)">'
    + '<div class="mbox-section-label">Dados do Registro</div>'
    + DR('ID do RF', rf.id, 'var(--p-blue)')
    + DR('Tipo Fiscal', '<span style="color:' + tfColor + ';font-weight:700">' + tfLabel + '</span>')
    + DR('Valor', ff(rf.valor), 'var(--p-teal)')
    + DR('Status Crédito', '<span style="background:rgba(' + stRgb + ',.12);color:rgba(' + stRgb + ',1);border:1px solid rgba(' + stRgb + ',.3);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">' + stLab + '</span>')
    + (stRegLab ? DR('Status Registro', '<span style="background:rgba(' + stRegRgb + ',.12);color:rgba(' + stRegRgb + ',1);border:1px solid rgba(' + stRegRgb + ',.3);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">' + stRegLab + '</span>') : '')
    + '<div class="mbox-divider"></div>'
    + '<div class="mbox-section-label">Documento Fiscal</div>'
    + DR('NF Vinculada', (nf.tipoDF || 'DF') + ' ' + nf.numero)
    + DR('Emitente', nf.entidade || '—')
    + DR('CNPJ', nf.cnpj || '—', null, true)
    + DR('Data NF', nfDataFmt)
    + DR('Valor Total NF', ff(rf.valorTotalNF || nf.valorTotal || 0))
    + DR('Tipo', nf.tipo === 'saida' ? 'Saída' : 'Entrada')
    + '<div class="mbox-divider"></div>'
    + DR('Método Pagamento', rf.metodoPagamento || nf.metodoPagamento || '—')
    + ((rf.metodoPagamento || nf.metodoPagamento || '') === 'Fornecedor'
        ? '<div class="mbox-info-box"><span class="mbox-info-box-label">Apuração Assistida</span>'
          + '<span style="color:var(--txt2)">Quando o método de pagamento é <strong>Fornecedor</strong>, o valor e a elegibilidade do IBS/CBS são confirmados a partir da <strong>Apuração Assistida</strong>. '
          + 'O SplitHub acolhe esses dados para validar e registrar o pagamento nesta etapa de conciliação financeira.</span>'
          + '</div>'
        : '')
    + (rf.dataPagamento && rf.dataPagamento !== '—' ? DR('Data Pagamento', rf.dataPagamento) : '')
    + (rfSt === 'utilizado' && rf.metodoExtincao ? DR('Método Extinção', rf.metodoExtincao, 'var(--p-teal)') : '')
    + (rfSt === 'utilizado' && rf.dataExtincao ? DR('Data Extinção', rf.dataExtincao) : '')
    + (rf.inconsistencia ? DR('Inconsistência', rf.inconsistencia, 'var(--p-red)') : '')
    + '<div class="mbox-divider"></div>'
    + '<div class="mbox-section-label">Inconsistências Vinculadas</div>'
    + window._incRenderVinculadasHtml(rf._inconsistencias && rf._inconsistencias.length ? rf._inconsistencias : (window._inconsistenciasGlobal||[]).filter(function(i){ return i.rfId === rf.id; }))
    + '</div>'

    // Right panel: timeline
    + '<div class="mbox-col" style="flex:1">'
    + '<div class="mbox-section-label">Histórico do Ciclo · ' + eventos.length + ' evento' + (eventos.length !== 1 ? 's' : '') + '</div>'
    + tlH
    + '</div>'
    + '</div>'
    + '</div>'
    + '</div>';

  var existing = document.getElementById('rf-detalhe-overlay');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', html);
};

// Estado dos filtros da tabela de créditos
window._filtrosCreditos = {
  mesAno: '', mesAnoArr: [],
  busca: '', tipoFiscal: '', status: '', contrato: '',
  metodo: '', pagamento: '', dataNFDe: '', dataNFAte: '',
  credMin: '', credMax: '', tipoDFe: '', metodoExtincao: ''
};

window.injetarFiltrosCreditos = function() {
  var tcrd = document.querySelector('#view-creditos .tcrd') || document.querySelector('.tcrd');
  if (!tcrd) return;
  var contratos = (_contratosData || []).map(function(c) { return { value: c.id, label: c.id }; });
  window.shBuildFilterPanel({
    wrapperId: 'filtros-creditos-avancado',
    anchor: tcrd,
    prefix: 'fc',
    searchPlaceholder: 'Pesquisar RF / NF / Fornecedor…',
    onFilter: 'creditosFiltrarGrid',
    onClear: 'creditosLimparFiltrosGrid',
    countId: 'fc-contagem',
    fields: [
      { label: 'Tipo Fiscal',         id: 'fc-tipo',            type: 'select', options: [{value:'IBS',label:'IBS'},{value:'CBS',label:'CBS'}] },
      { label: 'Status do Crédito',   id: 'fc-status',          type: 'select', options: [{value:'nao_apropriado',label:'Não Apropriado'},{value:'apropriado',label:'Apropriado'},{value:'utilizado',label:'Utilizado'},{value:'glosado',label:'Glosado'}] },
      { label: 'Status do Registro',  id: 'fc-status-registro', type: 'select', options: [{value:'inconsistencia',label:'Inconsistência'},{value:'em_risco',label:'Em risco'},{value:'a_prescrever',label:'A Prescrever'},{value:'vencido',label:'Vencido'}] },
      { label: 'Contrato',            id: 'fc-contrato',        type: 'select', options: contratos.concat([{value:'__sem__',label:'Sem contrato'}]) },
      { label: 'Método de Pagamento', id: 'fc-metodo',          type: 'select', options: [{value:'RAD',label:'RAD'},{value:'Fornecedor',label:'Fornecedor'}] },
      { label: 'Pagamento',           id: 'fc-pagamento',       type: 'select', options: [{value:'com',label:'Com pagamento'},{value:'sem',label:'Sem pagamento'}] },
      { label: 'Data NF — de',   id: 'fc-data-de',         type: 'date' },
      { label: 'Data NF — até', id: 'fc-data-ate',    type: 'date' },
      { label: 'Crédito — mín (R$)', id: 'fc-cred-min', type: 'number', placeholder: '0', min: 0 },
      { label: 'Crédito — máx (R$)', id: 'fc-cred-max', type: 'number', placeholder: '∞', min: 0 },
      { label: 'Tipo de DFe',         id: 'fc-tipo-dfe',        type: 'select', options: [{value:'entrada',label:'Entrada'},{value:'saida',label:'Saída'}] },
      { label: 'Método Extinção',      id: 'fc-metodo-extincao', type: 'select', options: [{value:'Split Payment',label:'Split Payment'},{value:'Compensacao',label:'Compensação'},{value:'Ressarcimento',label:'Ressarcimento'},{value:'Transferencia',label:'Transferência'},{value:'RAD',label:'RAD'}] }
    ]
  });
};

window.creditosToggleFiltros = function() { window.shToggleFilterPanel('fc'); };

window.creditosFiltrarGrid = function() {
  var f = window._filtrosCreditos;
  f.busca          = (document.getElementById('fc-busca')           || {}).value || '';
  f.tipoFiscal     = (document.getElementById('fc-tipo')            || {}).value || '';
  f.status         = (document.getElementById('fc-status')          || {}).value || '';
  f.statusRegistro = (document.getElementById('fc-status-registro') || {}).value || '';
  f.contrato       = (document.getElementById('fc-contrato')        || {}).value || '';
  f.metodo         = (document.getElementById('fc-metodo')          || {}).value || '';
  f.pagamento  = (document.getElementById('fc-pagamento')|| {}).value || '';
  f.dataNFDe   = (document.getElementById('fc-data-de') || {}).value || '';
  f.dataNFAte  = (document.getElementById('fc-data-ate')|| {}).value || '';
  f.credMin       = (document.getElementById('fc-cred-min')         || {}).value || '';
  f.credMax       = (document.getElementById('fc-cred-max')         || {}).value || '';
  f.tipoDFe       = (document.getElementById('fc-tipo-dfe')         || {}).value || '';
  f.metodoExtincao= (document.getElementById('fc-metodo-extincao')  || {}).value || '';
  window.renderizarTabelaCreditos();
};

window.creditosFiltrarMesAno = function() {
  var arr = (window._periodoSel || {}).cred || [];
  window._filtrosCreditos.mesAnoArr = arr;
  window._filtrosCreditos.mesAno = '';
  var mesLabels = {
    '2025-10':'out/2025','2025-11':'nov/2025','2025-12':'dez/2025',
    '2026-01':'jan/2026','2026-02':'fev/2026','2026-03':'mar/2026','2026-04':'abr/2026',
    '2026-05':'mai/2026','2026-06':'jun/2026','2026-07':'jul/2026','2026-08':'ago/2026',
    '2026-09':'set/2026','2026-10':'out/2026','2026-11':'nov/2026','2026-12':'dez/2026'
  };
  var label = arr.length === 1 ? (mesLabels[arr[0]] || arr[0]) : arr.length > 1 ? arr.length + ' períodos' : 'Origem fato gerador';
  var sub = document.getElementById('cred-periodo-sub');
  if (sub) sub.textContent = 'Posição IBS + CBS · Art. 48 LC 214/2025 · ' + label;
  window.renderizarTabelaCreditos();
  try { window.renderizarComposicaoCreditos(window._composicaoFiltro || ''); } catch(e) {}
  try { window.atualizarPerdaAcumulada(); } catch(e) {}
};

window.creditosLimparFiltrosGrid = function() {
  ['fc-busca','fc-tipo','fc-status','fc-status-registro','fc-contrato','fc-metodo','fc-pagamento','fc-data-de','fc-data-ate','fc-cred-min','fc-cred-max','fc-tipo-dfe','fc-metodo-extincao'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var selMes = document.getElementById('cred-mes-ano');
  if (selMes) selMes.value = '';
  var sub = document.getElementById('cred-periodo-sub');
  if (sub) sub.textContent = 'Posição IBS + CBS · Art. 48 LC 214/2025 · Origem fato gerador';
  window._filtrosCreditos = {
    mesAno:'', mesAnoArr:[], busca:'', tipoFiscal:'', status:'', contrato:'',
    metodo:'', pagamento:'', dataNFDe:'', dataNFAte:'',
    credMin:'', credMax:'', tipoDFe:'', metodoExtincao:''
  };
  window._periodoSel = window._periodoSel || {}; window._periodoSel.cred = [];
  window.renderizarTabelaCreditos();
  try { window.renderizarComposicaoCreditos(window._composicaoFiltro || ''); } catch(e) {}
  try { window.atualizarPerdaAcumulada(); } catch(e) {}
};

// Renderizar tabela de créditos
window.renderizarTabelaCreditos = function() {
  var h = "";
  var listaRFs = [];

  if (window.nfListaFiltradaGlobal && window.nfListaFiltradaGlobal.length > 0) {
    window.nfListaFiltradaGlobal.forEach(function(nf) {
      if (nf.tipo === 'entrada' && nf.registrosFiscais && nf.registrosFiscais.length) {
        nf.registrosFiscais.forEach(function(rf) {
          var tipoFiscalLabel = rf.tipoFiscal === 'ibs' ? 'IBS' : 'CBS';
          var valorLiq = rf.valorLiquidoNF || 0;
          // Usar rf.valor (sincronizado com alíquota do imposto) ao invés de recomputar
          var credVal = rf.valor || 0;
          var cbsVal = rf.tipoFiscal === 'cbs' ? credVal : 0;
          var ibsVal = rf.tipoFiscal === 'ibs' ? credVal : 0;
          var _sc = rf.statusCredito || rf.status || 'nao_apropriado';
          var _eApropriado = _sc === 'apropriado' || _sc === 'utilizado';
          var _temPag = rf.dataPagamento && rf.dataPagamento !== '—';
          var _dp = (rf.data || '').split('-');
          var _pagVal;
          if (_temPag) {
            _pagVal = rf.dataPagamento;
          } else if (_eApropriado && _dp.length === 3) {
            _pagVal = String(Math.min(parseInt(_dp[2], 10) + 5, 28)).padStart(2,'0') + '/' + _dp[1] + '/' + _dp[0] + ' 09:00';
          } else {
            _pagVal = '—';
          }
          listaRFs.push({
            rfId: rf.id,
            rf: rf.id,
            tipoFiscal: tipoFiscalLabel,
            tipoNF: rf.tipoNF || nf.tipo || 'entrada',
            nf: (nf.tipoDF || 'NF-e') + ' ' + (rf.nfVinculada || nf.numero || ''),
            nfNumero: rf.nfVinculada || nf.numero || '',
            forn: rf.entidade,
            cnpj: rf.cnpj,
            dataNF: rf.data,
            data: rf.data.split('-').reverse().join('/'),
            valorTotal: rf.valorTotalNF,
            valorLiq: valorLiq,
            cbs: cbsVal,
            ibs: ibsVal,
            cred: credVal,
            pag: _pagVal,
            isPago: _eApropriado || _temPag,
            status: _sc,
            statusCredito: _sc,
            statusRegistro: rf.statusRegistro || null,
            inconsistencia: rf.inconsistencia || null,
            contratoId: rf.contratoId || nf.contratoId || null,
            metodoPagamento: rf.metodoPagamento || nf.metodoPagamento || null,
            metodoExtincao: rf.metodoExtincao || null
          });
        });
      }
    });
  }

  // Aplicar filtros
  var f = window._filtrosCreditos || {};
  if (f.mesAno || (f.mesAnoArr && f.mesAnoArr.length) || f.busca || f.tipoFiscal || f.status || f.contrato || f.metodo ||
      f.pagamento || f.dataNFDe || f.dataNFAte || f.credMin || f.credMax || f.tipoDFe ||
      (f.statusMulti && f.statusMulti.length)) {
    var busca = (f.busca || '').toLowerCase();
    listaRFs = listaRFs.filter(function(r) {
      if (!window._matchPeriodo(r.dataNF, f)) return false;
      if (busca && !(r.rf.toLowerCase().includes(busca) || r.nf.toLowerCase().includes(busca) || r.forn.toLowerCase().includes(busca))) return false;
      if (f.tipoFiscal && r.tipoFiscal !== f.tipoFiscal) return false;
      if (f.status && (r.statusCredito || r.status) !== f.status) return false;
      if (f.statusRegistro && r.statusRegistro !== f.statusRegistro) return false;
      if (f.statusMulti && f.statusMulti.length && !f.statusMulti.includes(r.statusCredito || r.status)) return false;
      if (f.tipoDFe && r.tipoNF !== f.tipoDFe) return false;
      if (f.contrato === '__sem__' && r.contratoId) return false;
      if (f.contrato && f.contrato !== '__sem__' && r.contratoId !== f.contrato) return false;
      if (f.metodo && r.metodoPagamento !== f.metodo) return false;
      if (f.pagamento === 'com' && r.pag === '—') return false;
      if (f.pagamento === 'sem' && r.pag !== '—') return false;
      if (f.dataNFDe && r.dataNF < f.dataNFDe) return false;
      if (f.dataNFAte && r.dataNF > f.dataNFAte) return false;
      if (f.credMin !== '' && r.cred < parseFloat(f.credMin)) return false;
      if (f.credMax !== '' && r.cred > parseFloat(f.credMax)) return false;
      if (f.metodoExtincao && r.metodoExtincao !== f.metodoExtincao) return false;
      return true;
    });
  }

  // Atualizar contagem
  var contagemEl = document.getElementById('fc-contagem');
  if (contagemEl) contagemEl.textContent = listaRFs.length + ' registro' + (listaRFs.length !== 1 ? 's' : '');

  if (!listaRFs.length) {
    h = '<tr><td colspan="17" style="text-align:center;color:var(--txt3);padding:24px">Nenhum crédito encontrado para este filtro.</td></tr>';
  } else {
    listaRFs.forEach(function(r) {
      var _tfC = r.tipoFiscal === 'IBS' ? '#60A5FA' : '#FBB84A';
      var tipoFiscalBadge = '<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;letter-spacing:.06em;color:'+_tfC+'">'
        + '<span style="width:5px;height:5px;border-radius:50%;background:'+_tfC+';display:inline-block;flex-shrink:0"></span>'
        + r.tipoFiscal + '</span>';
      var nfTipoBadgeCred = r.tipoNF === 'saida'
        ? '<span style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:2px 7px;border-radius:3px;border:1px solid rgba(186,117,23,.28);color:#ba7517;background:transparent">Saída</span>'
        : '<span style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:2px 7px;border-radius:3px;border:1px solid rgba(29,158,117,.28);color:#1d9e75;background:transparent">Entrada</span>';
      var nfNumero = r.nfNumero || '';
      var nfLink = nfNumero
        ? '<span class="mono" style="font-size:11px;color:#185fa5;cursor:pointer;text-decoration:underline" onclick="window.abrirDetalhesNFporNumero(\'' + nfNumero + '\')">' + r.nf + '</span>'
        : '<span style="color:var(--txt3)">—</span>';
      var contratoCell = r.contratoId
        ? '<span class="mono" style="font-size:11px;color:#1d9e75;font-weight:600;cursor:pointer;text-decoration:underline" onclick="if(window.contratosAbrirDetalhe)contratosAbrirDetalhe(\'' + r.contratoId + '\')">' + r.contratoId + '</span>'
        : '<span style="color:var(--txt3)">—</span>';
      var _metC = r.metodoPagamento === 'RAD' ? '#60A5FA' : r.metodoPagamento === 'Fornecedor' ? '#A78BFA' : null;
      var metodoCell = _metC
        ? '<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;letter-spacing:.06em;color:'+_metC+'">'
          + '<span style="width:5px;height:5px;border-radius:50%;background:'+_metC+';display:inline-block"></span>'
          + r.metodoPagamento + '</span>'
        : '<span style="color:var(--txt3)">—</span>';
      var pagCell = r.isPago
        ? '<a href="javascript:void(0)" onclick="window.abrirComprovanteRF(\'' + r.rfId + '\')" title="Ver comprovante PIX" style="color:var(--teal);font-weight:600;text-decoration:underline dotted;cursor:pointer">' + r.pag + '</a>'
        : '<span style="color:var(--txt3)">—</span>';
      var rfIdLink = '<button onclick="window.abrirDetalheRF(\'' + r.rfId + '\')" style="background:none;border:none;color:#185fa5;cursor:pointer;font-size:11px;font-weight:600;padding:0;text-decoration:underline dotted;font-family:monospace">' + r.rf + '</button>';
      var statusCredBadge = bdg(r.statusCredito || r.status);
      var statusRegBadge  = r.statusRegistro ? bdg(r.statusRegistro) : '';
      var incBadge = r.inconsistencia ? '<br><span style="font-size:10px;color:#a32d2d;font-style:italic">' + r.inconsistencia + '</span>' : '';
      var _metExtMap = {
        'Split Payment': { cor: '29,158,117',  lbl: 'Split Payment' },
        'Compensacao':   { cor: '24,95,165',  lbl: 'Compensação'   },
        'Ressarcimento': { cor: '29,158,117',   lbl: 'Ressarcimento' },
        'Transferencia': { cor: '139,92,246',  lbl: 'Transferência' },
        'RAD':           { cor: '186,117,23',  lbl: 'RAD'           }
      };
      var sc = r.statusCredito || r.status || '';
      var metExtCell;
      if (sc === 'utilizado') {
        var _meKey = r.metodoExtincao || 'Compensacao';
        var _me = _metExtMap[_meKey] || { cor: '29,158,117', lbl: _meKey };
        metExtCell = '<span style="background:rgba(' + _me.cor + ',.12);color:rgba(' + _me.cor + ',1);border:1px solid rgba(' + _me.cor + ',.28);border-radius:3px;padding:2px 7px;font-size:10px;font-weight:700;letter-spacing:.05em">' + _me.lbl + '</span>';
      } else {
        metExtCell = '<span style="color:var(--txt3)">—</span>';
      }
      h += '<tr><td class="mono nowrap">' + rfIdLink + '</td><td class="nowrap">' + tipoFiscalBadge + '</td><td class="nowrap">' + nfTipoBadgeCred + '</td><td class="mono nowrap">' + nfLink + '</td><td class="trunc">' + r.forn + '</td><td class="nowrap" style="color:var(--txt2)">' + r.data + '</td><td class="r mono">' + ff(r.valorTotal) + '</td><td class="r mono" style="color:var(--txt2)">' + ff(r.valorLiq) + '</td><td class="r mono" style="color:var(--txt2)">' + ffz(r.cbs) + '</td><td class="r mono" style="color:var(--txt2)">' + ffz(r.ibs) + '</td><td class="r mono" style="font-weight:600">' + ff(r.cred) + '</td><td class="nowrap">' + pagCell + '</td><td class="nowrap">' + statusCredBadge + '</td><td class="nowrap">' + statusRegBadge + incBadge + '</td><td class="nowrap">' + contratoCell + '</td><td class="nowrap">' + metodoCell + '</td><td class="nowrap">' + metExtCell + '</td></tr>';
    });
  }

  var tabelaEl = document.getElementById("t-creditos");
  if (tabelaEl) {
    tabelaEl.innerHTML = h;
    console.log('[data-sync-fixed] Tabela de créditos renderizada com', listaRFs.length, 'linhas');
  } else {
    console.warn('[data-sync-fixed] Elemento #t-creditos não encontrado');
  }

  // Atualizar KPIs totalizadores com base na lista filtrada
  try { window.atualizarKPIsCreditos(listaRFs); } catch(e) {}

  // Atualizar gráfico de composição para refletir os filtros ativos
  try { window.renderizarComposicaoCreditos(window._composicaoFiltro || ''); } catch(e) {}

  // Atualizar gráfico de método de pagamento
  try { window.renderizarPagamentosMetodo(); } catch(e) {}
};

window.atualizarKPIsCreditos = function(listaRFs) {
  var aprop = 0, naoAprop = 0, glosado = 0, emRisco = 0, vencido = 0, util = 0, inconsist = 0, aPrescrever = 0;
  var naoApropCP = 0, naoApropLP = 0;
  var _hoje = new Date(); _hoje.setHours(0,0,0,0);
  var _mesAtual = _hoje.getFullYear() * 100 + (_hoje.getMonth() + 1);
  function _vencKPI(dataISO) {
    if (!dataISO) return null;
    var p = dataISO.split('-');
    if (p.length < 2) return null;
    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) + 1, 0);
  }
  (listaRFs || []).forEach(function(r) {
    var v  = r.cred || 0;
    var sc = r.statusCredito || r.status || '';
    var sr = r.statusRegistro || null;
    if      (sc === 'apropriado')      { aprop    += v; }
    else if (sc === 'utilizado')       { aprop    += v; util += v; }
    else if (sc === 'nao_apropriado')  {
      naoAprop += v;
      var venc = _vencKPI(r.dataNF);
      if (venc) {
        var _mv = venc.getFullYear() * 100 + (venc.getMonth() + 1);
        if (_mv === _mesAtual) naoApropCP += v;
        else if (_mv > _mesAtual) naoApropLP += v;
        // _mv < _mesAtual: vencido, não contabiliza em CP nem LP
      }
    }
    else if (sc === 'glosado')         { glosado  += v; }
    if      (sr === 'em_risco')        { emRisco      += v; }
    if      (sr === 'vencido')         { vencido      += v; }
    if      (sr === 'inconsistencia')  { inconsist    += v; }
    if      (sr === 'a_prescrever')    { aPrescrever  += v; }
  });
  var total = aprop + naoAprop + glosado;
  var fmt = function(v) {
    if (v >= 1e6) return 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M';
    if (v >= 1e3) return 'R$ ' + Math.round(v / 1e3) + 'K';
    return ff(v);
  };
  var pct = function(v, base) { return base > 0 ? (v / base * 100).toFixed(1).replace('.', ',') + '%' : '0,0%'; };
  var set = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
  var totalCred = aprop + naoAprop; // glosado excluído do aproveitável
  set('cred-total',         fmt(totalCred));
  // Status do Crédito
  set('cred-aprop',         fmt(aprop));
  set('cred-aprop-sub',     pct(aprop, totalCred) + ' do total · IBS+CBS apropriados');
  set('cred-nao-aprop',     fmt(naoAprop));
  set('cred-nao-aprop-sub', pct(naoAprop, totalCred) + ' do total · aguardando apropriação');
  set('cred-nao-aprop-cp',  fmt(naoApropCP));
  set('cred-nao-aprop-cp-sub', 'Vencimento em até 30 dias');
  set('cred-nao-aprop-mp',  fmt(naoApropLP));
  set('cred-nao-aprop-mp-sub', 'Vencimento superior a 30 dias');
  set('cred-util',          fmt(util));
  set('cred-util-sub',      aprop > 0 ? pct(util, aprop) + ' dos apropriados — abateram débito' : '—');
  set('cred-aguard',        fmt(naoAprop));
  set('cred-aguard-sub',    pct(naoAprop, totalCred) + ' — apropriação pendente');
  set('cred-glosado',       fmt(glosado));
  set('cred-glosado-sub',   pct(glosado, total) + ' — anulados pelo Fisco');
  // Status do Registro
  set('cred-risco',         fmt(emRisco));
  set('cred-risco-sub',     pct(emRisco, totalCred) + ' — créditos em risco');
  set('cred-inconsist',     fmt(inconsist));
  set('cred-inconsist-sub', pct(inconsist, totalCred) + ' do total · requer revisão');
  set('cred-perda',         fmt(vencido));
  set('cred-perda-sub',     pct(vencido, totalCred) + ' — vencidos sem quitação');
  set('cred-prescrever',    fmt(aPrescrever));
  set('cred-prescrever-sub',pct(aPrescrever, totalCred) + ' — prazo de 5 anos próximo');
};

window.atualizarPerdaAcumulada = function() {
  var totalVencido = 0;
  var countRFs = 0;
  var _fC = window._filtrosCreditos || {};
  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'entrada') return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      if (!window._matchPeriodo(rf.data, _fC)) return;
      if ((rf.statusRegistro || rf.status) === 'vencido') {
        totalVencido += rf.valor || 0;
        countRFs++;
      }
    });
  });

  var elVal = document.getElementById('cred-perda');
  var elSub = document.getElementById('cred-perda-sub');
  if (elVal) {
    if (totalVencido >= 1e6) {
      elVal.textContent = 'R$ ' + (totalVencido / 1e6).toFixed(1).replace('.', ',') + 'M';
    } else if (totalVencido >= 1e3) {
      elVal.textContent = 'R$ ' + Math.round(totalVencido / 1e3) + 'K';
    } else {
      elVal.textContent = ff(totalVencido);
    }
  }
  if (elSub) {
    elSub.textContent = countRFs + ' RF' + (countRFs !== 1 ? 's' : '') + ' vencidos · IBS + CBS';
  }
};

// ============================================================
// KPIs DASHBOARD — derivados de nfListaFiltradaGlobal
// ============================================================

// ── DASHBOARD — seletor de período multi-mês ──────────────────────────────
window._dashMesesSelecionados = ['2026-04']; // estado inicial: Abril
var _dashMesesLabels = {
  '2026-01':'Jan 2026','2026-02':'Fev 2026','2026-03':'Mar 2026','2026-04':'Abr 2026',
  '2026-05':'Mai 2026','2026-06':'Jun 2026','2026-07':'Jul 2026','2026-08':'Ago 2026',
  '2026-09':'Set 2026','2026-10':'Out 2026','2026-11':'Nov 2026','2026-12':'Dez 2026'
};

window.dashPeriodoInit = function() {
  var list = document.getElementById('dash-periodo-list');
  if (!list) return;
  var sel = window._dashMesesSelecionados || [];
  var html = '';
  Object.keys(_dashMesesLabels).forEach(function(k) {
    var chk = sel.indexOf(k) !== -1 ? 'checked' : '';
    html += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;padding:3px 0">'
      + '<input type="checkbox" value="' + k + '" ' + chk + ' onchange="window.dashPeriodoAplicar&&window.dashPeriodoAplicar()">'
      + _dashMesesLabels[k] + '</label>';
  });
  list.innerHTML = html;
  window.dashPeriodoAtualizarBotao();
};

window.dashPeriodoToggle = function(e) {
  e.stopPropagation();
  var panel = document.getElementById('dash-periodo-panel');
  if (!panel) return;
  var open = panel.style.display !== 'none';
  if (open) { panel.style.display = 'none'; return; }
  if (!document.getElementById('dash-periodo-list').children.length) window.dashPeriodoInit();
  panel.style.display = 'block';
  setTimeout(function() {
    document.addEventListener('click', function _c(ev) {
      if (!panel.contains(ev.target)) { panel.style.display = 'none'; document.removeEventListener('click', _c); }
    });
  }, 0);
};

window.dashPeriodoToggleAll = function(checked) {
  var list = document.getElementById('dash-periodo-list');
  if (list) list.querySelectorAll('input[type=checkbox]').forEach(function(cb) { cb.checked = checked; });
  window.dashPeriodoAplicar();
};

window.dashPeriodoAplicar = function() {
  var list = document.getElementById('dash-periodo-list');
  var sel = [];
  if (list) list.querySelectorAll('input[type=checkbox]:checked').forEach(function(cb) { sel.push(cb.value); });
  sel.sort();
  window._dashMesesSelecionados = sel;
  var allCb = document.getElementById('dash-periodo-all');
  if (allCb) allCb.checked = (sel.length === 12);
  window.dashPeriodoAtualizarBotao();
  try { window.atualizarKPIsDashboard(); } catch(e) {}
  try { window.atualizarDashboard(); } catch(e) {}
};

window.dashPeriodoAtualizarBotao = function() {
  var btn = document.getElementById('dash-periodo-btn');
  var sub = document.getElementById('dash-periodo-sub');
  var sel = window._dashMesesSelecionados || [];
  var todos = !sel.length || sel.length >= 12;
  var label = todos ? 'Origem fato gerador' : sel.length === 1 ? (_dashMesesLabels[sel[0]] || sel[0]) : sel.length + ' períodos';
  if (btn) btn.textContent = label + ' ▾';
  if (sub) sub.textContent = 'Período: ' + label + ' · Última atualização: 24/04/2026 às 11:47';
};

window.atualizarKPIsDashboard = function() {
  if (!window._ingDadosGlobal || !window._ingDadosGlobal.length) { try { window.ingestaoInit && window.ingestaoInit(); } catch(e) {} }
  var mesesSel = window._dashMesesSelecionados || [];
  var todosMeses = !mesesSel.length || mesesSel.length >= 12;
  // fallback: primeiro mês selecionado para funções que ainda usam mês único
  var mes = todosMeses ? '04' : mesesSel[0].substring(5);

  // --- CRÉDITOS (entrada, período selecionado) ---
  var aprop = 0, total = 0, bad = 0, risco = 0;
  // --- DÉBITOS (saída, período selecionado) ---
  var debTotal = 0, debExtinto = 0, debVencido = 0;
  // --- PAGAMENTOS (entrada) ---
  var pagPago = 0, pagPendente = 0, pagAtrasado = 0;
  // --- CONCILIAÇÃO (todos os períodos) ---
  var concNFs = 0, concRFs = 0, concTFOk = 0, concInconsist = 0;
  function _inPeriod(date) {
    if (todosMeses) return true;
    return mesesSel.some(function(p) { return date.startsWith(p); });
  }
  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    var nfTemPeriodo = todosMeses || (nf.registrosFiscais || []).some(function(rf) { return _inPeriod(rf.data || ''); });
    if (nfTemPeriodo) concNFs++;
    (nf.registrosFiscais || []).forEach(function(rf) {
      var rfDate = rf.data || '';
      var inPeriod = _inPeriod(rfDate);
      if (!inPeriod) return;
      concRFs++;
      var temPag = rf.dataPagamento && rf.dataPagamento !== '—';
      var temExt = rf.dataExtincao  && rf.dataExtincao  !== '—';
      if (temPag || temExt) concTFOk++;
      // inconsistencia vem de statusRegistro
      var sc = rf.statusCredito || rf.status || '';
      var sr = rf.statusRegistro || null;
      if (sr === 'inconsistencia') concInconsist++;
      var v = rf.valor || 0;
      if (nf.tipo === 'entrada') {
        total += v;
        if (sc === 'apropriado' || sc === 'utilizado') aprop += v;
        if (sc === 'nao_apropriado' || sc === 'glosado') bad += v;
        if (sr === 'vencido' || sr === 'em_risco' || sr === 'a_prescrever') risco += v;
        // Pagamentos
        var eAprop = sc === 'apropriado' || sc === 'utilizado';
        if (temPag || eAprop)        pagPago     += v;
        else if (sr === 'vencido')   pagAtrasado += v;
        else if (sr === 'em_risco' || sr === 'a_prescrever') pagAtrasado += v;
        else                         pagPendente += v;
      } else if (nf.tipo === 'saida') {
        debTotal += v;
        var stDeb = rf.status || '';
        if (stDeb === 'extinto')  debExtinto += v;
        if (stDeb === 'vencido')  debVencido += v;
      }
    });
  });

  // --- INCONSISTÊNCIAS filtradas pelo período selecionado ---
  var incTotal = 0, incIng = 0, incCred = 0, incDeb = 0, incPag = 0;
  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (!_inPeriod(nf.data || '')) return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      if ((rf.statusRegistro || rf.status) !== 'inconsistencia') return;
      incTotal++;
      if (nf.tipo === 'saida') { incDeb++; }
      else if (rf.inconsistencia === 'Vencido') { incPag++; }
      else { incCred++; }
    });
  });
  var ingFalhas = ['erro_layout','erro_dados','rejeitado','duplicado'];
  (window._ingDadosGlobal || []).forEach(function(d) {
    if (ingFalhas.indexOf(d.status) !== -1) { incTotal++; incIng++; }
  });

  function fmtM(v) {
    if (v >= 1e6) return 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M';
    if (v >= 1e3) return 'R$ ' + Math.round(v / 1e3) + 'K';
    return 'R$ ' + v.toLocaleString('pt-BR');
  }
  function setEl(id, val) { var e = document.getElementById(id); if (e) e.textContent = val; }
  function setStyle(id, prop, val) { var e = document.getElementById(id); if (e) e.style[prop] = val; }

  // --- HERO ---
  var heroPct = total > 0 ? (aprop / total * 100) : 0;
  var heroPctStr = heroPct.toFixed(1).replace('.', ',') + '%';
  var heroColor = heroPct >= 75 ? 'var(--teal)' : heroPct >= 50 ? 'var(--amber)' : 'var(--red)';
  var heroBadge = heroPct >= 75 ? 'Saudável' : heroPct >= 50 ? 'Atenção' : 'Crítico';
  var heroBg    = heroPct >= 75 ? 'rgba(73,197,177,.12)'  : heroPct >= 50 ? 'rgba(186,117,23,.12)' : 'rgba(244,63,94,.12)';
  var heroBdr   = heroPct >= 75 ? 'rgba(73,197,177,.25)'  : heroPct >= 50 ? 'rgba(186,117,23,.25)' : 'rgba(244,63,94,.25)';
  var heroFill  = heroPct >= 75 ? 'linear-gradient(90deg,'+PALETTE.teal+','+PALETTE.tealDark+')' : heroPct >= 50 ? 'var(--amber)' : 'var(--red)';
  setEl('dash-hero-pct',       heroPctStr);
  setEl('dash-hero-total',     fmtM(total));
  setEl('dash-hero-aprop-val', fmtM(aprop));
  setEl('dash-hero-bad',       fmtM(bad));
  setEl('dash-hero-risco-val', fmtM(risco));
  setStyle('dash-hero-pct',  'color', heroColor);
  setStyle('dash-hero-fill', 'width', Math.min(100, heroPct) + '%');
  setStyle('dash-hero-fill', 'background', heroFill);
  var badgeEl = document.getElementById('dash-hero-badge');
  if (badgeEl) { badgeEl.textContent = heroBadge; badgeEl.style.background = heroBg; badgeEl.style.color = heroColor; badgeEl.style.borderColor = heroBdr; }

  // --- CARD CRÉDITO ---
  var credPct = total > 0 ? (aprop / total * 100).toFixed(1).replace('.', ',') + '%' : '—';
  setEl('dash-cred-aprop',  fmtM(aprop));
  setEl('dash-cred-risco',  fmtM(risco));
  setEl('dash-cred-pct',    credPct);
  setStyle('dash-cred-bar', 'width', total > 0 ? Math.min(100, aprop / total * 100) + '%' : '0%');
  // backward compat IDs
  if (total > 0) {
    setEl('dash-cred-apropriar', (bad / total * 100).toFixed(1).replace('.', ',') + '%');
    var d = (typeof _dashMeses !== 'undefined' && _dashMeses[mes]) ? _dashMeses[mes] : {};
    setEl('dash-cred-apropriar-sub', (d.upApropriar || '') + ' — ' + fmtM(bad) + ' não apropriados');
  }

  // --- CARD DÉBITO ---
  var debPct = debTotal > 0 ? (debExtinto / debTotal * 100).toFixed(1).replace('.', ',') + '%' : '—';
  setEl('dash-deb-total',   fmtM(debTotal));
  setEl('dash-deb-pct',     debPct);
  setEl('dash-deb-vencido', fmtM(debVencido));
  setStyle('dash-deb-bar', 'width', debTotal > 0 ? Math.min(100, debExtinto / debTotal * 100) + '%' : '0%');

  // --- CARD PAGAMENTO ---
  setEl('dash-pag-pago',     fmtM(pagPago));
  setEl('dash-pag-avencer',  fmtM(pagPendente));
  setEl('dash-pag-atrasado', fmtM(pagAtrasado));

  // --- CARD CONCILIAÇÃO ---
  var concPct = concRFs > 0 ? (concTFOk / concRFs * 100).toFixed(1).replace('.', ',') + '%' : '—';
  setEl('dash-conc-nf',  concNFs.toLocaleString('pt-BR'));
  setEl('dash-conc-pct', concPct);
  setEl('dash-conc-div', concInconsist.toLocaleString('pt-BR'));
  setStyle('dash-conc-bar', 'width', concRFs > 0 ? Math.min(100, concTFOk / concRFs * 100) + '%' : '0%');

  // --- CARD INCONSISTÊNCIAS ---
  setEl('dash-inc-total', incTotal.toLocaleString('pt-BR'));
  setEl('dash-inc-ing',   incIng.toLocaleString('pt-BR'));
  setEl('dash-inc-cred',  incCred.toLocaleString('pt-BR'));
  setEl('dash-inc-deb',   incDeb.toLocaleString('pt-BR'));
  setEl('dash-inc-pag',   incPag.toLocaleString('pt-BR'));
};

// ============================================================
// ESTATÍSTICAS DE CONCILIAÇÃO — derivadas de nfListaFiltradaGlobal
// ============================================================

// ============================================================
// ============================================================
// DASHBOARD — sincronização com dados globais reais
// ============================================================

window.atualizarDashboard = function() {
  var lista = window.nfListaFiltradaGlobal || [];
  if (!lista.length) return;

  var mesesISO    = ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12'];
  var mesesLabels = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  var finalOk = { apropriado: 1, utilizado: 1, extinto: 1 };

  // ── 1. Evolução de Créditos IBS+CBS ──
  var aprop  = mesesISO.map(function() { return 0; });
  var aApropr = mesesISO.map(function() { return 0; });
  var emRisco = mesesISO.map(function() { return 0; });

  lista.forEach(function(nf) {
    if (nf.tipo !== 'entrada') return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      var mes = (rf.data || '').substring(0, 7);
      var idx = mesesISO.indexOf(mes);
      if (idx < 0) return;
      var v = (rf.valor || 0) / 1e6;
      var _sc = rf.statusCredito || rf.status || '';
      var _sr = rf.statusRegistro || null;
      if (_sc === 'apropriado' || _sc === 'utilizado') aprop[idx] += v;
      else if (_sc === 'nao_apropriado')               aApropr[idx] += v;
      if (_sr === 'vencido' || _sr === 'em_risco' || _sr === 'a_prescrever' || _sr === 'inconsistencia') emRisco[idx] += v;
    });
  });
  var rnd = function(v) { return Math.round(v * 100) / 100; };
  if (typeof svgLine === 'function') {
    svgLine('cCreditos', [
      { data: aprop.map(rnd),   color: 'var(--teal)',  fill: true, dots: true, label: 'Apropriados' },
      { data: aApropr.map(rnd), color: 'var(--amber)', dash: true,             label: 'A Apropriar'  },
      { data: emRisco.map(rnd), color: 'var(--red)',   dots: true, w: 1.5,    label: 'Em Risco'     }
    ], mesesLabels, 200);
  }
  // atualiza subtítulo
  var subCred = document.getElementById('dash-sub-creditos');
  if (subCred) subCred.textContent = 'R$ milhões · IBS+CBS · Jan–Dez 2026 · NFs de entrada';

  // ── 2. Pagamentos Executados — RAD vs Fornecedor ──
  var pagRAD  = mesesISO.map(function() { return 0; });
  var pagForn = mesesISO.map(function() { return 0; });

  // Build contract lookup once
  var _ctMap2 = {};
  if (window._contratosData) {
    window._contratosData.forEach(function(c) { _ctMap2[c.id] = c; });
  }

  lista.forEach(function(nf) {
    (nf.registrosFiscais || []).forEach(function(rf) {
      if (rf.status !== 'utilizado' && rf.status !== 'apropriado') return;
      var mes = (rf.data || '').substring(0, 7);
      var idx = mesesISO.indexOf(mes);
      if (idx < 0) return;
      var v = (rf.valor || 0) / 1e6;
      var ct = _ctMap2[nf.contratoId];
      if (ct && ct.rad) pagRAD[idx]  += v;
      else               pagForn[idx] += v;
    });
  });
  if (typeof svgBar === 'function') {
    svgBar('cPagamentos', [
      { data: pagRAD.map(rnd),  color: 'var(--blue)', label: 'Via RAD'       },
      { data: pagForn.map(rnd), color: 'var(--teal)', label: 'Via Fornecedor' }
    ], mesesLabels, 200);
  }
  var subPag = document.getElementById('dash-sub-pagamentos');
  if (subPag) subPag.textContent = 'R$ milhões · RAD + Fornecedor · Jan–Dez 2026';

  // ── 3. Últimas transações ──
  var tbody = document.getElementById('t-recent');

  // Coletar todos os RFs com pagamento ou data recente, ordenar desc
  var rfs = [];
  lista.forEach(function(nf) {
    (nf.registrosFiscais || []).forEach(function(rf) {
      rfs.push({
        id:        rf.id || '—',
        entidade:  nf.entidade || '—',
        tipo:      rf.tipoFiscal === 'ibs' ? 'Guia IBS' : 'DARF CBS',
        valor:     rf.valor || 0,
        data:      rf.dataPagamento && rf.dataPagamento !== '—' ? rf.dataPagamento : (rf.data || '—'),
        status:    rf.status || '—',
        pago:      rf.dataPagamento && rf.dataPagamento !== '—'
      });
    });
  });
  // ordenar: pagos mais recentes primeiro, depois por data RF
  rfs.sort(function(a, b) {
    var da = a.data === '—' ? '0' : a.data;
    var db = b.data === '—' ? '0' : b.data;
    return db.localeCompare(da);
  });

  var statusMap = {
    apropriado:    { label: 'Apropriado',    c: '#1d9e75' },
    utilizado:     { label: 'Utilizado',     c: '#1d9e75' },
    extinto:       { label: 'Extinto',       c: '#1d9e75' },
    nao_apropriado:{ label: 'A Apropriar',    c: '#ba7517' },
    em_risco:      { label: 'Em Risco',       c: '#ba7517' },
    vencido:       { label: 'Vencido',       c: '#a32d2d' },
    inconsistencia:{ label: 'Inconsistência',c: '#a32d2d' }
  };
  var fmtV = function(v) {
    if (v >= 1e6) return 'R$ ' + (v/1e6).toFixed(1).replace('.',',') + 'M';
    if (v >= 1e3) return 'R$ ' + Math.round(v/1e3) + 'K';
    return 'R$ ' + v.toFixed(2).replace('.',',');
  };

  var rows = '';
  rfs.slice(0, 10).forEach(function(r) {
    var badge = bdg(r.status);
    var tipoDot = '<span style="font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--txt1)">'+r.tipo+'</span>';
    rows += '<tr>'
      + '<td class="mono" style="font-size:11px;color:var(--txt2)">' + r.id + '</td>'
      + '<td style="color:var(--txt2)">' + r.entidade + '</td>'
      + '<td>' + tipoDot + '</td>'
      + '<td class="r mono" style="font-weight:600">' + fmtV(r.valor) + '</td>'
      + '<td style="font-size:11px;color:var(--txt3)">' + r.data + '</td>'
      + '<td>' + badge + '</td>'
      + '</tr>';
  });
  if (tbody) tbody.innerHTML = rows || '<tr><td colspan="6" style="text-align:center;color:var(--txt3);padding:20px">Sem transações</td></tr>';

  // ── 4. Top 5 Best / Worst fornecedores ──
  // Score = mesma fórmula do módulo Analytics: good / (good + bad×2) × 100
  // Rank composto = score ponderado pela representatividade do volume inadimplente
  var byForn = {};
  lista.forEach(function(nf) {
    if (nf.tipo !== 'entrada') return;
    var forn = nf.entidade || 'Desconhecido';
    if (!byForn[forn]) byForn[forn] = { good: 0, bad: 0, total: 0, pendente: 0 };
    byForn[forn].total += nf.valorTotal || 0;
    (nf.registrosFiscais || []).forEach(function(rf) {
      var v = rf.valor || 0;
      var sc = rf.statusCredito || rf.status || '';
      var sr = rf.statusRegistro || null;
      if (sc === 'apropriado' || sc === 'utilizado' || sc === 'extinto') byForn[forn].good++;
      if (sr === 'inconsistencia' || sr === 'vencido' || sr === 'em_risco') byForn[forn].bad++;
      if (sc === 'nao_apropriado') byForn[forn].pendente += v;
    });
  });

  var totalPendenteGlobal = 0;
  var fornArr = Object.keys(byForn).map(function(nome) {
    var d = byForn[nome];
    var denom = d.good + d.bad * 2;
    var qualScore = denom > 0 ? Math.max(5, Math.min(100, Math.round(d.good / denom * 100))) : 75;
    totalPendenteGlobal += d.pendente;
    return { nome: nome, qualScore: qualScore, total: d.total, pendente: d.pendente, good: d.good, bad: d.bad };
  }).filter(function(f) { return f.total > 0 || f.pendente > 0; });

  // Score composto: combina qualScore (qualidade) com peso do volume inadimplente
  // composto pior = (100 - qualScore) × sharePendente — quanto pior a qualidade E maior a exposição
  // composto melhor = qualScore × (1 - sharePendente*0.5) — qualidade alta com baixa exposição
  fornArr.forEach(function(f) {
    var sharePend = totalPendenteGlobal > 0 ? f.pendente / totalPendenteGlobal : 0;
    f.sharePend = sharePend;
    f.compostoRisco  = (100 - f.qualScore) * (1 + sharePend * 5);
    f.compostoSaude  = f.qualScore * (1 - sharePend * 0.5);
  });

  var worst5 = fornArr.slice().sort(function(a, b) { return b.compostoRisco - a.compostoRisco; }).slice(0, 5);
  var best5  = fornArr.slice().sort(function(a, b) { return b.compostoSaude - a.compostoSaude; }).slice(0, 5);

  function renderTop5(elId, arr, isWorst) {
    var el = document.getElementById(elId);
    if (!el) return;
    var fmtV2 = function(v) {
      return v >= 1e6 ? 'R$ ' + (v/1e6).toFixed(1).replace('.',',') + 'M'
           : v >= 1e3 ? 'R$ ' + Math.round(v/1e3) + 'K' : 'R$ ' + v.toFixed(0);
    };
    var maxPend = Math.max.apply(null, arr.map(function(f) { return f.pendente; })) || 1;
    var html = '';
    arr.forEach(function(f) {
      var qs = f.qualScore;
      var barPct = f.pendente / maxPend * 100;
      var scoreColor = qs >= 80 ? PALETTE.teal : qs >= 60 ? PALETTE.amber : PALETTE.red;
      var barColor = isWorst ? PALETTE.red : PALETTE.teal;
      var sharePct = (f.sharePend * 100).toFixed(1);
      html += '<div style="background:var(--bg2);border-radius:6px;padding:8px 10px">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">'
        + '<span style="font-size:12px;font-weight:600;color:var(--txt1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:155px" title="' + f.nome + '">' + f.nome + '</span>'
        + '<span style="font-size:13px;font-weight:700;color:' + scoreColor + ';margin-left:8px;flex-shrink:0;font-family:\'IBM Plex Mono\',monospace">' + qs + '</span>'
        + '</div>'
        + '<div style="display:flex;gap:8px;align-items:center;margin-bottom:3px">'
        + '<div style="flex:1;background:var(--border);border-radius:2px;height:4px;overflow:hidden">'
        + '<div style="width:' + Math.min(100, barPct).toFixed(1) + '%;height:100%;background:' + barColor + ';border-radius:2px"></div>'
        + '</div>'
        + '<span style="font-size:10px;color:var(--txt3);flex-shrink:0;white-space:nowrap">' + fmtV2(f.pendente) + ' pend</span>'
        + '</div>'
        + '<div style="font-size:10px;color:var(--txt3)">'
        + sharePct + '% do inadimplente total · vol. ' + fmtV2(f.total)
        + '</div>'
        + '</div>';
    });
    el.innerHTML = html || '<div style="font-size:11px;color:var(--txt3)">Sem dados</div>';
  }

  renderTop5('dash-top5-best',  best5,  false);
  renderTop5('dash-top5-worst', worst5, true);
};

// Tooltip global para gráficos SVG
window._svgTipShow = function(evt, raw) {
  var tip = document.getElementById('_svgTip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = '_svgTip';
    tip.style.cssText = 'position:fixed;pointer-events:none;display:none;background:#1a1d23;color:#e8e9ea;font-size:12px;padding:8px 12px;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.5);z-index:9999;white-space:nowrap;font-family:Montserrat,sans-serif;line-height:1.9;border:1px solid rgba(255,255,255,.08)';
    document.body.appendChild(tip);
  }
  var parts = raw.split('|');
  var html = '<div style="font-weight:700;color:#fff;margin-bottom:4px;font-size:13px">' + parts[0] + '</div>';
  for (var i = 1; i + 2 < parts.length; i += 3) {
    var cor = parts[i], nome = parts[i+1], rawVal = parts[i+2];
    var val = (rawVal === '' || isNaN(+rawVal) || rawVal.indexOf('/') !== -1) ? rawVal : 'R$ ' + rawVal;
    html += '<div style="display:flex;align-items:center;gap:6px">'
      + '<span style="display:inline-block;width:8px;height:8px;border-radius:2px;flex-shrink:0;background:' + cor + '"></span>'
      + '<span style="color:#adb5bd">' + nome + '</span>'
      + '<span style="font-weight:600;color:#fff;margin-left:auto;padding-left:16px">' + val + '</span>'
      + '</div>';
  }
  tip.innerHTML = html;
  tip.style.display = 'block';
  var x = evt.clientX + 16, y = evt.clientY - 20;
  tip.style.left = x + 'px';
  tip.style.top  = y + 'px';
  var r = tip.getBoundingClientRect();
  if (r.right  > window.innerWidth  - 8) tip.style.left = (evt.clientX - r.width  - 16) + 'px';
  if (r.bottom > window.innerHeight - 8) tip.style.top  = (evt.clientY - r.height + 8)  + 'px';
};
window._svgTipHide = function() {
  var tip = document.getElementById('_svgTip');
  if (tip) tip.style.display = 'none';
};

// INTELIGÊNCIA — sincronização com dados globais reais

// Fallback: define svgLine/svgBar caso o bloco inline do HTML não tenha carregado
if (typeof svgLine !== 'function') {
  window.svgLine = function(id, datasets, labels, H, opts) {
    var el = document.getElementById(id); if (!el) return;
    var padT=16, padB=26, padR=10;
    var fmtFn=(opts&&opts.fmt)||function(v){var neg=v<0;v=Math.abs(v);var s=v>=1?v.toFixed(1).replace('.',',')+'M':v>=0.001?Math.round(v*1000)+'K':'0';return neg?'−'+s:s;};
    var allFb=[];datasets.forEach(function(d){allFb=allFb.concat(d.data);});
    var dMinFb=allFb.length?Math.min.apply(null,allFb):0,dMaxFb=allFb.length?Math.max.apply(null,allFb):1;
    var minV=(opts&&opts.min!==undefined)?opts.min:dMinFb;
    var maxV=(opts&&opts.max!==undefined)?opts.max:dMaxFb;
    if(maxV<=minV)maxV=minV+1;
    var rng=maxV-minV;
    var padL=Math.max(36, fmtFn(maxV).length*6+10);
    var cw=(el.parentElement&&el.parentElement.offsetWidth)||el.offsetWidth||440;
    var W=cw>50?cw:440, plotW=W-padL-padR, plotH=H-padT-padB, n=labels.length;
    function xp(i){return Math.round(padL+(i/(n-1||1))*plotW);}
    function yp(v){var c=Math.max(minV,Math.min(maxV,v));return Math.round(padT+(1-(c-minV)/rng)*plotH);}
    var s='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:'+H+'px;display:block">';
    s+='<clipPath id="cpfb_'+id+'"><rect x="'+padL+'" y="'+padT+'" width="'+plotW+'" height="'+plotH+'"/></clipPath>';
    [0.25,0.5,0.75,1].forEach(function(f){
      var v=minV+rng*f,gy=yp(v);
      s+='<line x1="'+padL+'" y1="'+gy+'" x2="'+(W-padR)+'" y2="'+gy+'" stroke="rgba(128,128,128,0.1)" stroke-width="1"/>';
      s+='<text x="'+(padL-5)+'" y="'+(gy+3)+'" text-anchor="end" fill="var(--txt3)" font-size="9" font-family="Montserrat,sans-serif">'+fmtFn(v)+'</text>';
    });
    if(minV<0&&maxV>0){var gy0=yp(0);s+='<line x1="'+padL+'" y1="'+gy0+'" x2="'+(W-padR)+'" y2="'+gy0+'" stroke="rgba(128,128,128,0.3)" stroke-width="1" stroke-dasharray="3 2"/>';}
    datasets.forEach(function(ds){
      var pts=ds.data.map(function(v,i){return xp(i)+','+yp(v);}).join(' ');
      if(ds.fill){var fp=pts+' '+xp(n-1)+','+yp(minV)+' '+xp(0)+','+yp(minV);s+='<polygon points="'+fp+'" fill="'+ds.color+'" fill-opacity="0.18" stroke="none" clip-path="url(#cpfb_'+id+')"/>';}
      var da=ds.dash?'stroke-dasharray="5 3"':(ds.dash2?'stroke-dasharray="2 4"':'');
      s+='<polyline points="'+pts+'" fill="none" stroke="'+ds.color+'" stroke-width="'+(ds.w||2)+'" '+da+' stroke-linejoin="round" stroke-linecap="round" clip-path="url(#cpfb_'+id+')"/>';
      if(ds.dots){ds.data.forEach(function(v,i){s+='<circle cx="'+xp(i)+'" cy="'+yp(v)+'" r="3" fill="'+ds.color+'" pointer-events="none" clip-path="url(#cpfb_'+id+')"/>';});}
    });
    labels.forEach(function(l,i){s+='<text x="'+xp(i)+'" y="'+(H-6)+'" text-anchor="middle" fill="var(--txt3)" font-size="10" font-family="Montserrat,sans-serif">'+l+'</text>';});
    var zW=Math.max(14,Math.floor(plotW/n));
    for(var ci=0;ci<n;ci++){
      var tp=[labels[ci]];datasets.forEach(function(ds){tp.push(ds.color,ds.label||'Valor',fmtFn(ds.data[ci]||0));});
      var enc=tp.join('|').replace(/'/g,'&apos;');
      s+='<rect x="'+(xp(ci)-Math.floor(zW/2))+'" y="'+padT+'" width="'+zW+'" height="'+plotH+'" fill="transparent" style="cursor:crosshair" onmousemove="_svgTipShow(event,\''+enc+'\')" onmouseleave="_svgTipHide()"/>';
    }
    s+='</svg>';
    el.style.cssText='display:block;width:100%'; el.innerHTML=s;
  };
}
if (typeof svgBar !== 'function') {
  window.svgBar = function(id, datasets, labels, H) {
    var el = document.getElementById(id); if (!el) return;
    var padT=8,padB=26,padL=8,padR=8;
    var cw=(el.parentElement&&el.parentElement.offsetWidth)||el.offsetWidth||440;
    var W=cw>50?cw:440, plotW=W-padL-padR, plotH=H-padT-padB, n=labels.length;
    var stk=[];for(var ki=0;ki<n;ki++){var sm=0;datasets.forEach(function(d){sm+=d.data[ki]||0;});stk.push(sm);}
    var maxV=Math.max.apply(null,stk)||1;
    var bW=Math.floor(plotW/n*0.52);
    function xp(i){return Math.round(padL+(i+0.5)*plotW/n);}
    function fmtTip(v){return (v>=1?v.toFixed(2).replace('.',','):v.toFixed(3).replace('.',','))+'M';}
    var s='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:'+H+'px;display:block;overflow:visible">';
    labels.forEach(function(l,i){s+='<text x="'+xp(i)+'" y="'+(H-6)+'" text-anchor="middle" fill="var(--txt3)" font-size="10" font-family="Montserrat,sans-serif">'+l+'</text>';});
    for(var bi=0;bi<n;bi++){
      var yBase=H-padB;
      var tipParts=[labels[bi]];
      datasets.forEach(function(ds){tipParts.push(ds.color,ds.label||'Valor',fmtTip(ds.data[bi]||0));});
      var tipStr=tipParts.join('|').replace(/"/g,'&quot;');
      datasets.slice().reverse().forEach(function(ds){
        var bH=Math.max(1,Math.round((ds.data[bi]||0)/maxV*plotH));
        var x=xp(bi)-Math.floor(bW/2);var y=yBase-bH;
        s+='<rect x="'+x+'" y="'+y+'" width="'+bW+'" height="'+bH+'" fill="'+ds.color+'" rx="2" class="_svgBar" data-tip="'+tipStr+'" style="cursor:pointer;transition:opacity .15s"/>';
        yBase=y;
      });
      // invisible full-height zone for easier hover
      var zW=Math.max(bW+8,Math.floor(plotW/n));
      s+='<rect x="'+(xp(bi)-Math.floor(zW/2))+'" y="'+padT+'" width="'+zW+'" height="'+plotH+'" fill="transparent" class="_svgZone" data-tip="'+tipStr+'" style="cursor:pointer"/>';
    }
    s+='</svg>';
    el.style.cssText='display:block;width:100%'; el.innerHTML=s;
    el.querySelectorAll('._svgBar,._svgZone').forEach(function(r){
      r.addEventListener('mouseenter',function(e){if(window._svgTipShow)window._svgTipShow(e,r.getAttribute('data-tip'));if(r.classList.contains('_svgBar'))r.style.opacity='0.8';});
      r.addEventListener('mousemove', function(e){if(window._svgTipShow)window._svgTipShow(e,r.getAttribute('data-tip'));});
      r.addEventListener('mouseleave',function(){if(window._svgTipHide)window._svgTipHide();if(r.classList.contains('_svgBar'))r.style.opacity='1';});
    });
  };
}
// ============================================================

window.atualizarInteligencia = function() {
  var lista = window.nfListaFiltradaGlobal || [];
  if (!lista.length) return;

  var fmtM = function(v) {
    if (Math.abs(v) >= 1e9) return 'R$ ' + (v/1e9).toFixed(2).replace('.',',') + 'B';
    if (Math.abs(v) >= 1e6) return 'R$ ' + (v/1e6).toFixed(1).replace('.',',') + 'M';
    if (Math.abs(v) >= 1e3) return 'R$ ' + Math.round(v/1e3) + 'K';
    return 'R$ ' + v.toFixed(0);
  };
  var setEl = function(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
  var finalOk = { apropriado: 1, utilizado: 1, extinto: 1 };

  // ── 1. KPIs executivos ──────────────────────────────────
  var totalCred = 0, apropCred = 0, riscoCred = 0, pendCred = 0;
  lista.forEach(function(nf) {
    if (nf.tipo !== 'entrada') return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      var v = rf.valor || 0;
      totalCred += v;
      var _sc = rf.statusCredito || rf.status || '';
      var _sr = rf.statusRegistro || null;
      if (finalOk[_sc])                                              apropCred += v;
      else if (_sr === 'vencido' || _sr === 'em_risco' || _sr === 'inconsistencia')  riscoCred += v;
      else if (_sc === 'nao_apropriado')                                              pendCred  += v;
    });
  });
  var pct = totalCred > 0 ? Math.round(apropCred / totalCred * 100) : 0;

  setEl('intel-aprov-pct',     pct + '%');
  setEl('intel-aprov-sub',     fmtM(apropCred) + ' de ' + fmtM(totalCred) + ' disponível');
  setEl('intel-aprov-val',     fmtM(apropCred));
  setEl('intel-aprov-val-sub', pct + '% do total disponível');
  setEl('intel-risco-val',     fmtM(riscoCred));
  setEl('intel-risco-sub',     'requerem ação imediata · art. 48 LC 214');
  setEl('intel-pend-val',      fmtM(pendCred));
  setEl('intel-pend-sub',      'aguardando emissão/pagamento de guia');

  // ── 2. Evolução mensal (últimos 6 meses com dados) ──────
  var byMonth = {};
  lista.forEach(function(nf) {
    if (nf.tipo !== 'entrada') return;
    var mes = (nf.data || '2026-01').substring(0, 7);
    if (!byMonth[mes]) byMonth[mes] = { aprop: 0, pend: 0, risco: 0 };
    (nf.registrosFiscais || []).forEach(function(rf) {
      var v = rf.valor || 0;
      var _sc2 = rf.statusCredito || rf.status || '';
      var _sr2 = rf.statusRegistro || null;
      if (finalOk[_sc2])                                              byMonth[mes].aprop += v;
      else if (_sr2 === 'vencido' || _sr2 === 'em_risco' || _sr2 === 'inconsistencia')  byMonth[mes].risco += v;
      else                                                            byMonth[mes].pend  += v;
    });
  });
  var meses  = Object.keys(byMonth).sort().slice(-6);
  var labM   = meses.map(function(m) { return m.substring(5,7) + '/' + m.substring(2,4); });
  var dAprop = meses.map(function(m) { return +(byMonth[m].aprop / 1e6).toFixed(2); });
  var dPend  = meses.map(function(m) { return +(byMonth[m].pend  / 1e6).toFixed(2); });
  var dRisco = meses.map(function(m) { return +(byMonth[m].risco / 1e6).toFixed(2); });
  if (typeof svgBar === 'function' && meses.length) {
    svgBar('cAprovMensal', [
      { data: dAprop, color: PALETTE.teal,  label: 'Apropriado' },
      { data: dPend,  color: PALETTE.amber, label: 'A Apropriar' },
      { data: dRisco, color: PALETTE.red,   label: 'Em Risco'   }
    ], labM, 200);
  }

  // ── 3. Volume financeiro NFs — Contratos RAD ────────────
  var radMap = {};
  lista.forEach(function(nf) {
    var metodoPag = (nf.metodoPagamento || '').toLowerCase();
    if (metodoPag !== 'rad') return;
    var ent = nf.entidade || '—';
    if (!radMap[ent]) radMap[ent] = { vol90: 0, vol120: 0, total: 0, nfs: 0 };
    var vol = nf.valorTotal || 0;
    // distribuir entre 90/120 dias deterministicamente pelo hash
    var h = 0; var s = (nf.numero || ent); for(var ci=0;ci<s.length;ci++) h = ((h<<5)-h+s.charCodeAt(ci))|0;
    if (Math.abs(h) % 2 === 0) radMap[ent].vol90  += vol;
    else                        radMap[ent].vol120 += vol;
    radMap[ent].total += vol; radMap[ent].nfs++;
  });
  var radLista = Object.keys(radMap).map(function(e){ return { nome: e, vol90: radMap[e].vol90, vol120: radMap[e].vol120, total: radMap[e].total, nfs: radMap[e].nfs }; });
  radLista.sort(function(a,b){ return b.total - a.total; });
  var radTop = radLista.slice(0, 8);
  if (radTop.length) {
    var radLabels = radTop.map(function(r){ return r.nome.split(' ')[0]; });
    var rad90  = radTop.map(function(r){ return +(r.vol90  / 1e6).toFixed(2); });
    var rad120 = radTop.map(function(r){ return +(r.vol120 / 1e6).toFixed(2); });
    if (typeof svgBar === 'function') svgBar('cRadPrazo', [{ data: rad90, color: 'var(--teal)', label: '90d' }, { data: rad120, color: 'var(--blue)', label: '120d' }], radLabels, 200);
    var tbody = document.getElementById('t-rad-prazo');
    if (tbody) {
      var rows = '';
      radTop.forEach(function(r) {
        var fmtV = function(v){ return v>=1e6? 'R$ '+(v/1e6).toFixed(1).replace('.',',')+'M' : v>=1e3? 'R$ '+Math.round(v/1e3)+'K' : 'R$ '+v.toFixed(0); };
        rows += '<tr><td>' + r.nome + '</td><td>—</td><td>' + r.nfs + ' NF(s)</td><td>90/120 dias</td><td class="r">' + fmtV(r.total) + '</td></tr>';
      });
      tbody.innerHTML = rows;
    }
  } else {
    var elcR = document.getElementById('cRadPrazo');
    if (elcR) elcR.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--txt3);font-size:12px">Nenhum contrato RAD encontrado.</div>';
  }

  // ── 4. Score de risco por fornecedor (de RFs reais) ─────
  var scoreMap = {};
  lista.forEach(function(nf) {
    var ent = nf.entidade || '—';
    if (!scoreMap[ent]) scoreMap[ent] = { good: 0, bad: 0, vol: 0 };
    scoreMap[ent].vol += nf.valorTotal || 0;
    (nf.registrosFiscais || []).forEach(function(rf) {
      var _sc3 = rf.statusCredito || rf.status || '';
      var _sr3 = rf.statusRegistro || null;
      if (finalOk[_sc3]) scoreMap[ent].good++;
      if (_sr3 === 'inconsistencia' || _sr3 === 'vencido' || _sr3 === 'em_risco') scoreMap[ent].bad++;
    });
  });
  var scoreLista = Object.keys(scoreMap).map(function(ent) {
    var d = scoreMap[ent];
    var denom = d.good + d.bad * 2;
    var rawScore = denom > 0 ? Math.round(d.good / denom * 100) : 75;
    return { nome: ent, score: Math.max(5, Math.min(100, rawScore)), vol: d.vol };
  });
  scoreLista.sort(function(a, b) { return b.vol - a.vol; });
  var sbEl = document.getElementById('score-bars');
  if (sbEl) {
    var h = '';
    scoreLista.slice(0, 10).forEach(function(r) {
      var c = r.score >= 80 ? '#1d9e75' : r.score >= 60 ? '#ba7517' : '#a32d2d';
      var nome = r.nome.length > 18 ? r.nome.substring(0,17) + '…' : r.nome;
      h += '<div class="srow"><span class="sname">' + nome + '</span>'
         + '<div class="strk"><div class="sfil" style="width:' + r.score + '%;background:' + c + '"></div></div>'
         + '<span class="snum" style="color:' + c + '">' + r.score + '</span></div>';
    });
    sbEl.innerHTML = h || '<div style="color:var(--txt3);font-size:12px;padding:12px 0">Sem dados</div>';
  }

  // ── 5. Mapa de Risco: Score × Prazo de pagamento ────────
  (function() {
    var el = document.getElementById('cMapaRisco');
    if (!el) return;

    // Mapa contratoId → prazo
    var contratos = window._contratosData || [];
    var contMap = {};
    contratos.forEach(function(c) { contMap[c.id] = +c.prazo || 0; });

    // Prazo por fornecedor (via contratoId na NF)
    var fornPrazo = {};
    lista.forEach(function(nf) {
      if (!nf.contratoId || fornPrazo[nf.entidade]) return;
      var p = contMap[nf.contratoId];
      if (p) fornPrazo[nf.entidade] = p;
    });

    // Volume médio últimos 3 meses por fornecedor (NFs de entrada)
    var byMesEnt = {};
    lista.forEach(function(nf) {
      if (nf.tipo !== 'entrada') return;
      var mes = (nf.data || '').substring(0, 7);
      if (!mes) return;
      if (!byMesEnt[mes]) byMesEnt[mes] = {};
      var ent = nf.entidade || '—';
      byMesEnt[mes][ent] = (byMesEnt[mes][ent] || 0) + (nf.valorTotal || 0);
    });
    var ultMeses = Object.keys(byMesEnt).sort().slice(-3);
    var volMedio = {};
    Object.keys(fornPrazo).forEach(function(ent) {
      var soma = 0, cnt = 0;
      ultMeses.forEach(function(m) { if (byMesEnt[m] && byMesEnt[m][ent]) { soma += byMesEnt[m][ent]; cnt++; } });
      volMedio[ent] = cnt > 0 ? soma / cnt : 0;
    });

    // Montar pontos: score de scoreLista + prazo + volMedio
    var scoreIdx = {};
    scoreLista.forEach(function(r) { scoreIdx[r.nome] = r.score; });
    var pontos = Object.keys(fornPrazo).map(function(ent) {
      return {
        nome: ent,
        prazo: fornPrazo[ent],
        score: scoreIdx[ent] || 75,
        vol: volMedio[ent] || 0
      };
    }).filter(function(p) { return p.prazo > 0; });

    if (!pontos.length) { el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--txt3);font-size:12px">Sem fornecedores com contrato vinculado</div>'; return; }

    // SVG scatter — X = Score, Y = Prazo (invertido: maior prazo = mais exposto = topo)
    var H = 320, padT = 28, padB = 46, padL = 54, padR = 28;
    var W = (el.parentElement && el.parentElement.offsetWidth > 100 ? el.parentElement.offsetWidth : 560);
    var plotW = W - padL - padR, plotH = H - padT - padB;

    var xMin = 0,  xMax = 105;   // score 0–100
    var yMin = 20, yMax = 130;   // prazo dias (20 a 130, eixo Y invertido: alto = mais crítico)

    // X = score (maior = melhor), Y = prazo (maior = mais para baixo = zona crítica inferior)
    function xp(score) { return Math.round(padL + (score - xMin) / (xMax - xMin) * plotW); }
    // Prazo alto = parte inferior do gráfico (cenário crítico embaixo)
    function ypp(prazo) { return Math.round(padT + ((prazo - yMin) / (yMax - yMin)) * plotH); }

    var maxVol = Math.max.apply(null, pontos.map(function(p) { return p.vol; })) || 1;
    function rDot(vol) { return Math.round(4 + Math.sqrt(vol / maxVol) * 8); }

    // Defs: filtro blur para glow suave
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:' + H + 'px;display:block">';
    s += '<defs>'
       + '<filter id="glow-r" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
       + '<filter id="glow-g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
       + '</defs>';

    // Quadrante crítico: score < 70 e prazo > 60 — canto INFERIOR esquerdo
    var qCritX1 = padL,      qCritX2 = xp(70);
    var qCritY1 = ypp(60),   qCritY2 = H - padB;
    s += '<rect x="' + qCritX1 + '" y="' + qCritY1 + '" width="' + (qCritX2 - qCritX1) + '" height="' + (qCritY2 - qCritY1) + '" fill="rgba(244,63,94,0.08)"/>';
    s += '<text x="' + (qCritX1 + 8) + '" y="' + (qCritY2 - 8) + '" fill="var(--red)" font-size="10" font-weight="700" font-family="Montserrat,sans-serif" opacity="0.75">⚠ CRÍTICO</text>';

    // Quadrante saudável: score ≥ 70 e prazo ≤ 60 — canto SUPERIOR direito
    var qSaudX1 = xp(70),    qSaudX2 = W - padR;
    var qSaudY1 = padT,      qSaudY2 = ypp(60);
    s += '<rect x="' + qSaudX1 + '" y="' + qSaudY1 + '" width="' + (qSaudX2 - qSaudX1) + '" height="' + (qSaudY2 - qSaudY1) + '" fill="rgba(29,158,117,0.07)"/>';
    s += '<text x="' + (qSaudX2 - 8) + '" y="' + (qSaudY1 + 16) + '" text-anchor="end" fill="var(--green)" font-size="10" font-weight="700" font-family="Montserrat,sans-serif" opacity="0.75">✓ SAUDÁVEL</text>';

    // Grid linhas verticais (score 20,40,60,70,80,100)
    [20, 40, 60, 80, 100].forEach(function(v) {
      var gx = xp(v);
      s += '<line x1="' + gx + '" y1="' + padT + '" x2="' + gx + '" y2="' + (H - padB) + '" stroke="rgba(128,128,128,0.1)" stroke-width="1"/>';
      s += '<text x="' + gx + '" y="' + (H - padB + 16) + '" text-anchor="middle" fill="var(--txt3)" font-size="10" font-family="Montserrat,sans-serif">' + v + '</text>';
    });

    // Grid linhas horizontais (prazo 30,60,90,120)
    [30, 60, 90, 120].forEach(function(v) {
      var gy = ypp(v);
      s += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="rgba(128,128,128,0.1)" stroke-width="1"/>';
      s += '<text x="' + (padL - 6) + '" y="' + (gy + 4) + '" text-anchor="end" fill="var(--txt3)" font-size="10" font-family="Montserrat,sans-serif">' + v + 'd</text>';
    });

    // Linhas de threshold
    s += '<line x1="' + xp(70) + '" y1="' + padT + '" x2="' + xp(70) + '" y2="' + (H - padB) + '" stroke="rgba(186,117,23,0.65)" stroke-width="1.5" stroke-dasharray="6 4"/>';
    s += '<text x="' + (xp(70) + 3) + '" y="' + (padT + 10) + '" fill="var(--amber)" font-size="9" font-weight="700" font-family="Montserrat,sans-serif">score 70</text>';

    s += '<line x1="' + padL + '" y1="' + ypp(60) + '" x2="' + (W - padR) + '" y2="' + ypp(60) + '" stroke="rgba(186,117,23,0.65)" stroke-width="1.5" stroke-dasharray="6 4"/>';
    s += '<text x="' + (W - padR - 3) + '" y="' + (ypp(60) - 4) + '" text-anchor="end" fill="var(--amber)" font-size="9" font-weight="700" font-family="Montserrat,sans-serif">60d</text>';

    // Eixos
    s += '<line x1="' + padL + '" y1="' + (H - padB) + '" x2="' + (W - padR) + '" y2="' + (H - padB) + '" stroke="rgba(128,128,128,0.2)" stroke-width="1"/>';
    s += '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (H - padB) + '" stroke="rgba(128,128,128,0.2)" stroke-width="1"/>';

    // Labels eixos
    s += '<text x="' + (padL + plotW / 2) + '" y="' + (H - 4) + '" text-anchor="middle" fill="var(--txt3)" font-size="11" font-family="Montserrat,sans-serif">Score de Aproveitamento →</text>';
    s += '<text transform="rotate(-90,' + (padL - 42) + ',' + (padT + plotH / 2) + ')" x="' + (padL - 42) + '" y="' + (padT + plotH / 2 + 4) + '" text-anchor="middle" fill="var(--txt3)" font-size="11" font-family="Montserrat,sans-serif">Prazo Contratual (dias) ↓</text>';

    // Pontos — maiores atrás, dots suavizados com halo + glow
    var fmtV2 = function(v) { return v >= 1e6 ? 'R$ ' + (v/1e6).toFixed(1).replace('.',',') + 'M' : v >= 1e3 ? 'R$ ' + Math.round(v/1e3) + 'K' : 'R$ 0'; };
    pontos.slice().sort(function(a, b) { return b.vol - a.vol; }).forEach(function(p) {
      var cx = xp(p.score), cy = ypp(p.prazo), r = rDot(p.vol);
      var critico = p.score < 70 && p.prazo > 60;
      var atencao = p.score < 70 && p.prazo <= 60;
      var cor = critico ? 'var(--red)' : atencao ? 'var(--amber)' : 'var(--green)';
      var filterId = critico ? 'glow-r' : 'glow-g';
      var tipData = [p.nome + ' · prazo ' + p.prazo + 'd', cor, 'Score', p.score + '/100', cor, 'Vol. médio 3m', fmtV2(p.vol).replace('R$ ','')].join('|');
      var enc = tipData.replace(/'/g, '&apos;');

      // Halo externo suave
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + 4) + '" fill="' + cor + '" opacity="0.06"/>';
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + 1) + '" fill="' + cor + '" opacity="0.12"/>';
      // Dot principal
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + cor + '" opacity="0.60" filter="url(#' + filterId + ')" style="cursor:pointer" onmousemove="_svgTipShow(event,\'' + enc + '\')" onmouseleave="_svgTipHide()"/>';

      // Label (todos os pontos)
      var lbl = p.nome.split(' ')[0];
      var lblY = cy + r + 11;
      if (lblY > H - padB - 2) lblY = cy - r - 4;
      s += '<text x="' + cx + '" y="' + lblY + '" text-anchor="middle" fill="' + cor + '" font-size="8" font-weight="600" font-family="Montserrat,sans-serif" opacity="0.85">' + lbl + '</text>';
    });

    s += '</svg>';
    el.style.cssText = 'display:block;width:100%';
    el.innerHTML = s;
  })();

  // ── 6. Projeção de recuperação ───────────────────────────
  var projEl = document.getElementById('intel-projecao');
  if (projEl) {
    var novoPct = totalCred > 0 ? Math.round((apropCred + pendCred) / totalCred * 100) : pct;
    projEl.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:14px">'
      + '<div style="background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2);border-radius:10px;padding:14px 18px">'
      + '<div style="font-size:11px;color:var(--txt3);margin-bottom:4px">Se todos os créditos pendentes fossem regularizados</div>'
      + '<div style="font-size:22px;font-weight:700;color:'+PALETTE.blue+'">' + fmtM(pendCred) + '</div>'
      + '<div style="font-size:11px;color:var(--txt3);margin-top:4px">adicionais · aproveitamento subiria de <strong style="color:var(--txt1)">'
      + pct + '%</strong> para <strong style="color:#1d9e75">' + novoPct + '%</strong></div>'
      + '</div>'
      + '<div style="background:rgba(244,63,94,.06);border:1px solid rgba(244,63,94,.2);border-radius:10px;padding:14px 18px">'
      + '<div style="font-size:11px;color:var(--txt3);margin-bottom:4px">Crédito em risco de perda definitiva (vencidos + inconsistentes)</div>'
      + '<div style="font-size:22px;font-weight:700;color:var(--red)">' + fmtM(riscoCred) + '</div>'
      + '<div style="font-size:11px;color:var(--txt3);margin-top:4px">art. 48 LC 214 — perda irreversível se não quitado</div>'
      + '</div></div>';
  }

  // ── 6. Alertas dinâmicos gerados de dados reais ─────────
  var alertsEl = document.getElementById('intel-alerts');
  if (!alertsEl) return;
  var alertas = [];
  var hoje = '04/08';

  // Crítico: vencidos por fornecedor
  var vencMap = {};
  lista.forEach(function(nf) {
    if (nf.tipo !== 'entrada') return;
    (nf.registrosFiscais||[]).forEach(function(rf) {
      if ((rf.statusRegistro || rf.status) !== 'vencido') return;
      var e = nf.entidade;
      if (!vencMap[e]) vencMap[e] = { val: 0, n: 0 };
      vencMap[e].val += rf.valor || 0; vencMap[e].n++;
    });
  });
  Object.keys(vencMap).sort(function(a,b){return vencMap[b].val-vencMap[a].val;}).slice(0,3).forEach(function(ent) {
    var d = vencMap[ent];
    alertas.push({ sev:'CRÍTICO', color:'var(--red)', bg:'rgba(244,63,94,.15)',
      msg: ent + ' — ' + d.n + ' RF(s) vencido(s). Crédito de ' + fmtM(d.val) + ' em risco de perda definitiva (art. 48 LC 214). Ação imediata necessária.' });
  });

  // Atenção: inconsistências
  var incMap = {};
  lista.forEach(function(nf) {
    (nf.registrosFiscais||[]).forEach(function(rf) {
      if ((rf.statusRegistro || rf.status) !== 'inconsistencia') return;
      var e = nf.entidade;
      if (!incMap[e]) incMap[e] = { val: 0, n: 0 };
      incMap[e].val += rf.valor || 0; incMap[e].n++;
    });
  });
  Object.keys(incMap).sort(function(a,b){return incMap[b].val-incMap[a].val;}).slice(0,3).forEach(function(ent) {
    var d = incMap[ent];
    alertas.push({ sev:'ATENÇÃO', color:'var(--amber)', bg:'rgba(186,117,23,.15)',
      msg: ent + ' — ' + d.n + ' inconsistência(s) em RF detectada(s) (' + fmtM(d.val) + '). Regularizar para garantir aproveitamento do crédito.' });
  });

  // Atenção: maiores volumes pendentes de pagamento
  var pendMap = {};
  lista.forEach(function(nf) {
    if (nf.tipo !== 'entrada') return;
    (nf.registrosFiscais||[]).forEach(function(rf) {
      if (rf.status !== 'nao_apropriado') return;
      var e = nf.entidade;
      if (!pendMap[e]) pendMap[e] = { val: 0, n: 0 };
      pendMap[e].val += rf.valor || 0; pendMap[e].n++;
    });
  });
  Object.keys(pendMap).sort(function(a,b){return pendMap[b].val-pendMap[a].val;}).slice(0,2).forEach(function(ent) {
    var d = pendMap[ent];
    alertas.push({ sev:'ATENÇÃO', color:'var(--amber)', bg:'rgba(186,117,23,.15)',
      msg: ent + ' — ' + d.n + ' RF(s) com crédito não apropriad (' + fmtM(d.val) + '). Emitir guia DARF/IBS para regularizar.' });
  });

  // Info: aproveitamento geral
  var nível = pct >= 75 ? 'Índice saudável.' : pct >= 50 ? 'Requer atenção.' : 'Índice crítico — ação necessária.';
  alertas.push({ sev:'INFO', color:'var(--blue)', bg:'rgba(24,95,165,.15)',
    msg: 'Aproveitamento geral: ' + pct + '% (' + fmtM(apropCred) + ' de ' + fmtM(totalCred) + '). ' + nível });

  // Info: melhor fornecedor
  if (scoreLista.length && scoreLista[0].score >= 80) {
    alertas.push({ sev:'INFO', color:'var(--teal)', bg:'rgba(73,197,177,.15)',
      msg: scoreLista[0].nome + ' — melhor score de risco (' + scoreLista[0].score + '/100). Histórico de pagamentos consistente, créditos em dia.' });
  }

  var htmlA = '';
  alertas.forEach(function(a) {
    htmlA += '<div class="arow" style="border-left-color:' + a.color + '">'
           + '<span class="asev" style="background:' + a.bg + ';color:' + a.color + '">' + a.sev + '</span>'
           + '<div class="amsg">' + a.msg + '</div>'
           + '<span class="atim">' + hoje + '</span></div>';
  });
  alertsEl.innerHTML = htmlA || '<div style="text-align:center;padding:24px;color:var(--txt3);font-size:12px">Nenhum alerta detectado.</div>';
};

// ============================================================
// CONCILIAÇÃO — hash determinístico + dados de apuração + financeira
// ============================================================

function _concHash(str) {
  var h = 0;
  for (var i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// capur_status: 'conciliado' | 'inconsistencia' | 'pendente' | 'estornado'
// cfin_status:  'conciliado' | 'inconsistencia' | 'pendente' | 'estornado'
var _capurDist = ['conciliado','conciliado','conciliado','conciliado','conciliado','conciliado','conciliado','inconsistencia','inconsistencia','pendente'];

function _concBuildLista(filtroMes) {
  var lista = window.nfListaFiltradaGlobal || [];
  var result = [];
  var concArr = (window._periodoSel || {}).conc || [];
  lista.forEach(function(nf, idx) {
    var dataBase = nf.data || '2026-01-15';
    if (concArr.length) { if (!concArr.some(function(m){ return dataBase.startsWith(m); })) return; }
    else if (filtroMes && !dataBase.startsWith(filtroMes)) return;

    var seed = _concHash((nf.numero || '') + (nf.cnpj || '') + idx);
    var capur_status = _capurDist[seed % 10];
    var protocolo = 'APU2026-' + String(seed % 999999 + 1).padStart(6, '0');

    // Valor total da DF vem direto do registro NF
    var valorDF = nf.valorTotal || 0;
    var valorGov = capur_status === 'inconsistencia'
      ? valorDF * (1 + ((seed % 7) - 3) * 0.003)
      : valorDF;
    var deltaValor = valorGov - valorDF;

    var apurDia = String((seed % 28) + 1).padStart(2, '0');
    var dataApur = dataBase.substring(0, 7) + '-' + apurDia;

    // RF IBS e CBS a partir dos registrosFiscais globais
    var ibsRF = null, cbsRF = null;
    (nf.registrosFiscais || []).forEach(function(rf) {
      if (rf.tipoFiscal === 'ibs' && !ibsRF) ibsRF = rf;
      if (rf.tipoFiscal === 'cbs' && !cbsRF) cbsRF = rf;
    });

    // Conciliação Financeira: usa status e dataPagamento reais dos RFs
    var _finalStatus = { apropriado: 1, utilizado: 1, extinto: 1 };
    var ibsPago = ibsRF && (
      (ibsRF.dataPagamento && ibsRF.dataPagamento !== '—') ||
      _finalStatus[ibsRF.status]
    );
    var cbsPago = cbsRF && (
      (cbsRF.dataPagamento && cbsRF.dataPagamento !== '—') ||
      _finalStatus[cbsRF.status]
    );
    var ibsInc = ibsRF && ibsRF.status === 'inconsistencia';
    var cbsInc = cbsRF && cbsRF.status === 'inconsistencia';

    var cfin_status;
    var comprovante = false;
    var proxAcao;
    if (capur_status === 'pendente') {
      // CAPUR pendente — CFIN aguarda resolução da apuração
      cfin_status = 'pendente';
      proxAcao = 'Aguardar conclusão da CAPUR';
    } else {
      // CAPUR conciliada ou divergente — avalia comprovantes IBS + CBS do DF
      var paidCount = (ibsPago ? 1 : 0) + (cbsPago ? 1 : 0);
      var incCount  = (ibsInc  ? 1 : 0) + (cbsInc  ? 1 : 0);
      if (paidCount === 2 && incCount === 0)      cfin_status = 'conciliado';
      else if (incCount > 0)                      cfin_status = 'inconsistencia';
      else                                        cfin_status = 'pendente';
      comprovante = ibsPago && cbsPago;
      proxAcao = cfin_status === 'conciliado'    ? '—'
        : cfin_status === 'inconsistencia'       ? 'Resolver inconsistência de pagamento'
        : 'Aguardar comprovantes IBS + CBS';
    }

    // ── Conciliação de Apuração (valores fiscais calculados vs. Apuração Assistida Gov) ─
    var apurSeed   = _concHash((nf.numero || '') + (nf.cnpj || '') + 'APUR' + idx);
    var concIdApur = 'CAPUR-' + (apurSeed >>> 0).toString(16).toUpperCase().padStart(8, '0');
    var apurHora   = String(9 + (apurSeed % 4)).padStart(2,'0') + ':' + String((apurSeed % 59) + 1).padStart(2,'0');
    var apurConcStatus = capur_status === 'conciliado' ? 'confirmada' : capur_status === 'inconsistencia' ? 'inconsistencia' : 'pendente';
    var concRegApur = { concId: concIdApur, concTs: dataApur + 'T' + apurHora, concStatus: apurConcStatus, tipo: 'apuracao' };

    // ── Conciliação Financeira (liquidação, segregação IBS/CBS, comprovantes) ─────────
    // Ocorre ~15 dias após a apuração — só é gerada quando apuração não está pendente
    var concRegFin = null;
    if (capur_status !== 'pendente') {
      var finSeed    = _concHash((nf.numero || '') + (nf.cnpj || '') + 'FIN' + idx);
      var concIdFin  = 'CFIN-' + (finSeed >>> 0).toString(16).toUpperCase().padStart(8, '0');
      var finHora    = String(13 + (finSeed % 4)).padStart(2,'0') + ':' + String((finSeed % 59) + 1).padStart(2,'0');
      var finConcStatus = cfin_status === 'conciliado' ? 'confirmada' : cfin_status === 'inconsistencia' ? 'inconsistencia' : 'pendente';
      var dataFinISO = window._rfAddDays ? window._rfAddDays(dataApur, 15) : dataApur;
      concRegFin = { concId: concIdFin, concTs: dataFinISO + 'T' + finHora, concStatus: finConcStatus, tipo: 'financeira' };
    }

    // Anexar ao NF e RFs para que _rfGerarHistorico os encontre
    nf._concRegApur = concRegApur;
    nf._concRegFin  = concRegFin;
    if (ibsRF) { ibsRF._concRegApur = concRegApur; ibsRF._concRegFin = concRegFin; }
    if (cbsRF) { cbsRF._concRegApur = concRegApur; cbsRF._concRegFin = concRegFin; }
    // Compat: manter _concReg apontando para o registro mais completo disponível
    nf._concReg = concRegFin || concRegApur;
    if (ibsRF) ibsRF._concReg = nf._concReg;
    if (cbsRF) cbsRF._concReg = nf._concReg;

    result.push({
      nf: nf, idx: idx,
      capur_status: capur_status, protocolo: protocolo,
      valorDF: valorDF, valorGov: valorGov, deltaValor: deltaValor, dataApur: dataApur,
      ibsRF: ibsRF, cbsRF: cbsRF,
      ibsPago: !!ibsPago, cbsPago: !!cbsPago, ibsInc: ibsInc, cbsInc: cbsInc,
      cfin_status: cfin_status, comprovante: comprovante, proxAcao: proxAcao,
      concRegApur: concRegApur, concRegFin: concRegFin,
      concReg: concRegFin || concRegApur
    });
  });
  return result;
}

window._concListaGlobal = [];
window._concApurFiltrada = [];
window._concApurPag = 1;
var _concApurIpp = 25;
window._concFinFiltrada = [];
window._concFinPag = 1;
var _concFinIpp = 25;

function _concSetEl(id, val) { var e = document.getElementById(id); if (e) e.textContent = val; }
function _concFmt(v) {
  if (Math.abs(v) >= 1e6) return 'R$ ' + (v/1e6).toFixed(2).replace('.',',') + 'M';
  if (Math.abs(v) >= 1e3) return 'R$ ' + (v/1e3).toFixed(1).replace('.',',') + 'K';
  return 'R$ ' + v.toFixed(2).replace('.',',');
}

function _concRFDetail(nf, ibsRF, cbsRF) {
  var fmtV = function(v) { return v ? 'R$ ' + (v/1).toLocaleString('pt-BR', {minimumFractionDigits:2,maximumFractionDigits:2}) : '—'; };
  var stColor = STATUS.colors;
  function rfCard(rf, label) {
    if (!rf) return '<div style="flex:1;background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:8px;padding:12px 14px;min-width:220px">'
      + '<div style="font-size:10px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">' + label + '</div>'
      + '<div style="font-size:11px;color:var(--txt3)">Sem RF vinculado</div></div>';
    var sc = stColor[rf.statusCredito || rf.status] || '#A7A8AA';
    var pago = rf.dataPagamento && rf.dataPagamento !== '—';
    var rfId = rf.id || '—';
    var canOpen = rfId !== '—' && window._rfIndex && window._rfIndex[rfId];
    var clickAttr = canOpen
      ? 'onclick="event.stopPropagation();if(window.abrirDetalheRF)window.abrirDetalheRF(\'' + rfId + '\')" style="flex:1;background:rgba(255,255,255,.03);border:1px solid var(--border);border-left:3px solid ' + sc + ';border-radius:8px;padding:12px 14px;min-width:220px;cursor:pointer;transition:border-color .15s" onmouseenter="this.style.borderColor=\'' + sc + '\'" onmouseleave="this.style.borderColor=\'var(--border)\'"'
      : 'style="flex:1;background:rgba(255,255,255,.03);border:1px solid var(--border);border-left:3px solid ' + sc + ';border-radius:8px;padding:12px 14px;min-width:220px"';
    return '<div ' + clickAttr + '>'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
      + '<span style="font-size:10px;font-weight:700;color:' + sc + ';text-transform:uppercase;letter-spacing:.07em">' + label + '</span>'
      + '<span style="background:' + sc + ';color:#fff;font-size:9px;padding:2px 7px;border-radius:10px;font-weight:700">' + (rf.statusCredito || rf.status || '—') + '</span>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:11px">'
      + '<span style="color:var(--txt3)">ID RF</span>'
      + '<span style="color:#185fa5;font-family:monospace;font-weight:700' + (canOpen ? ';text-decoration:underline dotted' : '') + '">' + rfId + '</span>'
      + '<span style="color:var(--txt3)">Valor</span><span style="color:var(--txt1);font-weight:600">' + fmtV(rf.valor) + '</span>'
      + '<span style="color:var(--txt3)">Data RF</span><span style="color:var(--txt2)">' + (rf.data || '—') + '</span>'
      + '<span style="color:var(--txt3)">Pagamento</span><span style="color:' + (pago ? '#1d9e75' : 'var(--txt3)') + ';font-weight:' + (pago ? '600' : '400') + '">' + (pago ? rf.dataPagamento : 'Pendente') + '</span>'
      + (rf.inconsistencia ? ('<span style="color:var(--txt3)">Inconsistência</span><span style="color:#a32d2d;font-size:10px">' + rf.inconsistencia + '</span>') : '')
      + '</div>'
      + (canOpen ? '<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border);font-size:11px;color:#185fa5;font-weight:600">Ver detalhes do RF →</div>' : '')
      + '</div>';
  }
  var nfTotal = 'R$ ' + ((nf.valorTotal||0)/1).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  return '<div style="padding:10px 16px 14px">'
    + '<div style="font-size:10px;color:var(--txt3);margin-bottom:8px">Valor total NF: <strong style="color:var(--txt1)">' + nfTotal + '</strong>'
    + ' · IBS: <strong style="color:var(--txt1)">' + fmtV(nf.ibs) + '</strong>'
    + ' · CBS: <strong style="color:var(--txt1)">' + fmtV(nf.cbs) + '</strong>'
    + ' · Data: <strong style="color:var(--txt1)">' + (nf.data||'—') + '</strong></div>'
    + '<div style="display:flex;gap:10px;flex-wrap:wrap">'
    + rfCard(ibsRF, 'RF — IBS')
    + rfCard(cbsRF, 'RF — CBS')
    + '</div></div>';
}

function _capurBadge(s) {
  var map = { conciliado:'var(--green)', inconsistencia:'var(--red)', pendente:'var(--amber)', estornado:'#6B7280' };
  var lbl = { conciliado:'CAPUR OK', inconsistencia:'Inconsistência CAPUR', pendente:'Ag. Apuração', estornado:'Estornado' };
  return '<span style="background:'+(map[s]||'#555')+';color:#fff;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:700">'+(lbl[s]||s)+'</span>';
}
function _cfinBadge(s) {
  var map = { conciliado:'var(--green)', inconsistencia:'var(--red)', pendente:'var(--amber)', estornado:'#6B7280' };
  var lbl = { conciliado:'CFIN OK', inconsistencia:'Inconsistência CFIN', pendente:'Ag. Comprovantes', estornado:'Estornado' };
  return '<span style="background:'+(map[s]||'#555')+';color:#fff;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:700">'+(lbl[s]||s)+'</span>';
}
// Compat — aliases para código legado
var _apurBadge = _capurBadge;
var _finBadge  = _cfinBadge;
function _rfStatusBadge(rf) {
  if (!rf) return '<span style="color:var(--txt3);font-size:10px">—</span>';
  var _rfSC = rf.statusCredito || rf.status || '';
  var _rfSR = rf.statusRegistro || null;
  var credColor = {apropriado:'var(--green)',utilizado:'var(--teal)',glosado:'#8B5CF6',nao_apropriado:'var(--amber)'}[_rfSC] || '#555';
  var regColor  = {em_risco:'#ba7517',vencido:'var(--red)',inconsistencia:'#a32d2d',a_prescrever:'#FB923C'}[_rfSR] || null;
  var html = '<span style="background:'+credColor+';color:#fff;font-size:10px;padding:2px 7px;border-radius:10px">'+(_rfSC||'—')+'</span>';
  if (_rfSR) html += ' <span style="background:'+regColor+';color:#fff;font-size:10px;padding:2px 7px;border-radius:10px">'+_rfSR+'</span>';
  return html;
}

window.atualizarEstatisticasConciliacao = function() {
  var filtroMes = '';
  var sel = document.getElementById('conc-mes-select');
  if (sel) filtroMes = sel.value || '';
  window._concListaGlobal = _concBuildLista(filtroMes);
  var lista = window._concListaGlobal;

  var totalDFs = lista.length;
  var apurConf = 0, apurDiv = 0;
  var finComp = 0, finInc = 0, finPend = 0;
  var credAprop = 0;
  lista.forEach(function(r) {
    if (r.capur_status === 'conciliado') apurConf++;
    if (r.capur_status === 'inconsistencia') apurDiv++;
    if (r.cfin_status === 'conciliado')      finComp++;
    if (r.cfin_status === 'inconsistencia')  finInc++;
    if (r.cfin_status === 'pendente')    finPend++;
    if (r.capur_status === 'conciliado' && r.cfin_status === 'conciliado') credAprop++;
  });

  var pctApur = totalDFs > 0 ? Math.round(apurConf / totalDFs * 100) : 0;
  var pctFin  = totalDFs > 0 ? Math.round(finComp  / totalDFs * 100) : 0;
  var pctCred = totalDFs > 0 ? Math.round(credAprop / totalDFs * 100) : 0;

  _concSetEl('conc-dfe',    totalDFs.toLocaleString('pt-BR'));
  _concSetEl('conc-dfe-sub','NF-e · entrada e saída processadas');
  _concSetEl('conc-kpi-apur', apurConf.toLocaleString('pt-BR') + ' (' + pctApur + '%)');
  _concSetEl('conc-kpi-apur-sub', 'de ' + totalDFs + ' DFs na Apuração Assistida');
  _concSetEl('conc-kpi-fin', finComp.toLocaleString('pt-BR') + ' (' + pctFin + '%)');
  _concSetEl('conc-kpi-fin-sub', 'IBS + CBS quitados com comprovante');
  _concSetEl('conc-rf',    credAprop.toLocaleString('pt-BR') + ' (' + pctCred + '%)');
  _concSetEl('conc-rf-sub','apuração + financeira completos');
  _concSetEl('conc-div',   (apurDiv + finInc).toLocaleString('pt-BR'));
  _concSetEl('conc-div-sub', apurDiv + ' apuração · ' + finInc + ' financeira');

  // Pipeline
  _concSetEl('pipe-dfe',  totalDFs.toLocaleString('pt-BR'));
  _concSetEl('pipe-apur', apurConf.toLocaleString('pt-BR'));
  var ibsPagoCount = lista.filter(function(r){ return r.ibsPago; }).length;
  var cbsPagoCount = lista.filter(function(r){ return r.cbsPago; }).length;
  _concSetEl('pipe-ibs',  ibsPagoCount.toLocaleString('pt-BR'));
  _concSetEl('pipe-cbs',  cbsPagoCount.toLocaleString('pt-BR'));
  _concSetEl('pipe-cred', credAprop.toLocaleString('pt-BR'));
  _concSetEl('pipe-apur-div', apurDiv);
  _concSetEl('pipe-fin-inc',  finInc);
  _concSetEl('pipe-pend',     finPend);

  // Inicializa tab unificada
  window._concUniFiltrada = lista.slice();
  window._concUniPag = 1;
  _concUnifiedRender();
};

var _concUniIpp = 20;

function _concUnifiedRender() {
  var lista = window._concUniFiltrada || [];
  var pag = window._concUniPag || 1;
  var total = Math.ceil(lista.length / _concUniIpp) || 1;
  if (pag > total) pag = total;
  window._concUniPag = pag;
  var start = (pag - 1) * _concUniIpp;
  var slice = lista.slice(start, start + _concUniIpp);
  _concSetEl('uni-sub', lista.length + ' DFs');
  _concSetEl('uni-pag-cur', pag);
  _concSetEl('uni-pag-tot', total);
  var prev = document.getElementById('uni-btn-prev');
  var prox = document.getElementById('uni-btn-prox');
  if (prev) { prev.disabled = pag <= 1; prev.style.opacity = pag <= 1 ? '.5' : '1'; }
  if (prox) { prox.disabled = pag >= total; prox.style.opacity = pag >= total ? '.5' : '1'; }
  var tbody = document.getElementById('t-conc-uni');
  if (!tbody) return;
  if (!slice.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--txt3);padding:24px">Nenhum registro encontrado.</td></tr>';
    return;
  }
  var fmtV = function(v) { return v ? 'R$ ' + (v/1).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—'; };
  var stColor = STATUS.colors;
  function rfChip(rf, label) {
    if (!rf) return '';
    var rfId = rf.id || '—';
    var canOpen = rfId !== '—' && window._rfIndex && window._rfIndex[rfId];
    var click = canOpen ? 'onclick="event.stopPropagation();if(window.abrirDetalheRF)window.abrirDetalheRF(\'' + rfId + '\')" style="cursor:pointer"' : '';
    return '<span ' + click + ' style="display:inline-flex;align-items:center;gap:5px;border:1px solid var(--border);border-radius:6px;padding:3px 9px;font-size:11px;font-family:monospace;color:var(--blue);background:rgba(24,95,165,.07)' + (canOpen ? ';cursor:pointer' : '') + '">'
      + label + ' · ' + rfId + '</span>';
  }
  function stageApur(r) {
    var delta = r.deltaValor;
    var deltaStr = Math.abs(delta) < 1 ? '—' : (delta > 0 ? '+' : '') + _concFmt(delta);
    var deltaColor = Math.abs(delta) > 5 ? (delta > 0 ? '#ba7517' : '#a32d2d') : 'var(--txt3)';
    return '<div style="flex:1;border:1px solid var(--border);border-left:3px solid #185fa5;border-radius:8px;padding:10px 12px;min-width:200px">'
      + '<div style="font-size:10px;font-weight:700;color:#185fa5;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Etapa 1 — Conciliação Apuração</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:11px">'
      + '<span style="color:var(--txt3)">Valor DF</span><span style="font-weight:600">' + _concFmt(r.valorDF) + '</span>'
      + '<span style="color:var(--txt3)">Valor Gov</span><span style="font-weight:600">' + _concFmt(r.valorGov) + '</span>'
      + '<span style="color:var(--txt3)">Δ Valor</span><span style="color:' + deltaColor + ';font-weight:600">' + deltaStr + '</span>'
      + '<span style="color:var(--txt3)">Protocolo</span><span style="font-family:monospace;font-size:10px;color:#8B5CF6">' + r.protocolo + '</span>'
      + '<span style="color:var(--txt3)">Data</span><span>' + r.dataApur + '</span>'
      + '<span style="color:var(--txt3)">Status</span><span>' + _capurBadge(r.capur_status) + '</span>'
      + '</div></div>';
  }
  function stageFin(r) {
    var blocked = r.capur_status === 'pendente';
    var borderColor = blocked ? '#6B7280' : '#10B981';
    var titleColor  = blocked ? '#6B7280' : '#10B981';
    if (blocked) {
      return '<div style="flex:1;border:1px solid var(--border);border-left:3px solid ' + borderColor + ';border-radius:8px;padding:10px 12px;min-width:200px;opacity:.6">'
        + '<div style="font-size:10px;font-weight:700;color:' + titleColor + ';text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Etapa 2 — Conciliação Financeira</div>'
        + '<div style="display:flex;align-items:center;gap:8px;padding:10px 0">'
        + '<span style="font-size:16px">🔒</span>'
        + '<div>'
        + '<div style="font-size:12px;font-weight:600;color:var(--txt2)">Etapa bloqueada</div>'
        + '<div style="font-size:11px;color:var(--txt3);margin-top:2px">' + r.proxAcao + '</div>'
        + '</div></div></div>';
    }
    var nf = r.nf;
    var ibsVal = r.ibsRF ? fmtV(r.ibsRF.valor || nf.ibs || 0) : (nf.ibs ? fmtV(nf.ibs) : '—');
    var cbsVal = r.cbsRF ? fmtV(r.cbsRF.valor || nf.cbs || 0) : (nf.cbs ? fmtV(nf.cbs) : '—');
    var ibsSc = r.ibsRF ? (stColor[r.ibsRF.status] || '#888') : '#888';
    var cbsSc = r.cbsRF ? (stColor[r.cbsRF.status] || '#888') : '#888';
    var ibsSt = r.ibsRF ? (r.ibsRF.status || '—') : '—';
    var cbsSt = r.cbsRF ? (r.cbsRF.status || '—') : '—';
    var compr = r.comprovante ? '<span style="color:var(--green);font-weight:600">✓ Recebido</span>' : '<span style="color:var(--txt3)">Aguardando</span>';
    return '<div style="flex:1;border:1px solid var(--border);border-left:3px solid ' + borderColor + ';border-radius:8px;padding:10px 12px;min-width:200px">'
      + '<div style="font-size:10px;font-weight:700;color:' + titleColor + ';text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Etapa 2 — Conciliação Financeira</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:11px">'
      + '<span style="color:var(--txt3)">IBS</span><span style="font-weight:600">' + ibsVal + '</span>'
      + '<span style="color:var(--txt3)">Status IBS</span><span><span style="background:' + ibsSc + ';color:#fff;font-size:9px;padding:2px 6px;border-radius:8px">' + ibsSt + '</span></span>'
      + '<span style="color:var(--txt3)">CBS</span><span style="font-weight:600">' + cbsVal + '</span>'
      + '<span style="color:var(--txt3)">Status CBS</span><span><span style="background:' + cbsSc + ';color:#fff;font-size:9px;padding:2px 6px;border-radius:8px">' + cbsSt + '</span></span>'
      + '<span style="color:var(--txt3)">Comprovante</span><span>' + compr + '</span>'
      + '<span style="color:var(--txt3)">Próxima ação</span><span style="color:var(--txt2)">' + r.proxAcao + '</span>'
      + '</div></div>';
  }
  var html = '';
  slice.forEach(function(r) {
    var nf = r.nf;
    var tipoBadge = nf.tipo === 'entrada'
      ? '<span style="color:var(--teal);font-size:10px;font-weight:700">' + (nf.tipoDF || 'ENTRADA') + '</span>'
      : '<span style="color:var(--blue);font-size:10px;font-weight:700">' + (nf.tipoDF || 'SAÍDA') + '</span>';
    var nfLabel = ((nf.tipoDF || '') + ' ' + (nf.numero || '')).trim() || '—';
    var delta = r.deltaValor;
    var deltaStr = Math.abs(delta) < 1 ? '—' : (delta > 0 ? '+' : '') + _concFmt(delta);
    var deltaColor = Math.abs(delta) > 5 ? (delta > 0 ? 'color:#ba7517' : 'color:#a32d2d') : 'color:var(--txt3)';
    var detail = '<div style="padding:10px 16px 14px">'
      + '<div style="font-size:10px;color:var(--txt3);margin-bottom:10px">Valor total NF: <strong style="color:var(--txt1)">' + fmtV(nf.valorTotal||0) + '</strong>'
      + ' · IBS: <strong style="color:var(--txt1)">' + fmtV(nf.ibs) + '</strong>'
      + ' · CBS: <strong style="color:var(--txt1)">' + fmtV(nf.cbs) + '</strong>'
      + ' · Fornecedor: <strong style="color:var(--txt1)">' + (nf.entidade||'—') + '</strong></div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">'
      + stageApur(r)
      + stageFin(r)
      + '</div>'
      + '<div style="border-top:1px solid var(--border);padding-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">'
      + rfChip(r.ibsRF, 'IBS')
      + rfChip(r.cbsRF, 'CBS')
      + (function concChips(ra, rf2) {
          function chip(c, label) {
            if (!c) return '';
            var cCol = c.concStatus==='confirmada'?'29,158,117':c.concStatus==='inconsistencia'?'163,45,45':'186,117,23';
            var cLbl = {confirmada:'Confirmada',inconsistencia:'Inconsistência',pendente:'Pendente'}[c.concStatus]||c.concStatus;
            var ts = window._rfFmtTS ? window._rfFmtTS(c.concTs) : c.concTs;
            return '<span style="display:inline-flex;align-items:center;gap:5px;border:1px solid rgba('+cCol+',.3);border-radius:6px;padding:3px 9px;font-size:11px;font-family:monospace;background:rgba('+cCol+',.08);color:rgba('+cCol+',1)" title="'+label+'">'
              + '⇌ <span style="font-size:9px;opacity:.7">'+label+'</span> ' + c.concId + ' · ' + cLbl + ' · ' + ts
              + '</span>';
          }
          return chip(ra, 'Conc. Apuração') + chip(rf2, 'Conc. Financeira');
        })(r.concRegApur, r.concRegFin)
      + '</div></div>';
    var nfNum = nf.numero || '';
    var verDFBtn = nfNum
      ? '<button onclick="event.stopPropagation();if(window.abrirDetalhesNFporNumero)window.abrirDetalhesNFporNumero(\'' + nfNum + '\')" style="background:rgba(73,197,177,.1);border:1px solid rgba(73,197,177,.3);border-radius:5px;color:var(--teal);cursor:pointer;font-size:10px;font-weight:700;padding:3px 9px;white-space:nowrap">Ver DF</button>'
      : '<span style="color:var(--txt3)">—</span>';
    html += '<tr style="cursor:pointer" onclick="(function(el){var nx=el.nextElementSibling;nx.style.display=nx.style.display===\'none\'?\'table-row\':\'none\';})(this)">'
      + '<td style="font-weight:600;color:var(--txt1);white-space:nowrap"><span style="color:var(--txt3);font-size:10px;margin-right:4px">▶</span>' + nfLabel + '</td>'
      + '<td>' + tipoBadge + '</td>'
      + '<td style="color:var(--txt2)">' + (nf.entidade || '—') + '</td>'
      + '<td class="r" style="font-family:monospace">' + _concFmt(r.valorDF) + '</td>'
      + '<td class="r" style="font-family:monospace;' + deltaColor + '">' + deltaStr + '</td>'
      + '<td>' + _capurBadge(r.capur_status) + '</td>'
      + '<td>' + _cfinBadge(r.cfin_status) + '</td>'
      + '<td>' + verDFBtn + '</td>'
      + '</tr>'
      + '<tr style="display:none;background:rgba(73,197,177,.04)">'
      + '<td colspan="8" style="padding:0">' + detail + '</td></tr>';
  });
  tbody.innerHTML = html;
}

window.concUnifiedFiltrar = function() {
  var busca  = (document.getElementById('uni-busca') || {}).value || '';
  var tipo   = (document.getElementById('uni-tipo')  || {}).value || '';
  var apur   = (document.getElementById('uni-apur')  || {}).value || '';
  var fin    = (document.getElementById('uni-fin')   || {}).value || '';
  busca = busca.toLowerCase();
  window._concUniFiltrada = (window._concListaGlobal || []).filter(function(r) {
    var nf = r.nf;
    if (tipo && nf.tipo      !== tipo) return false;
    if (apur && r.capur_status !== apur) return false;
    if (fin  && r.cfin_status  !== fin)  return false;
    if (busca) {
      var hay = [(nf.numero||''),(nf.entidade||''),(nf.cnpj||''),(nf.tipoDF||''),r.protocolo].join(' ').toLowerCase();
      if (hay.indexOf(busca) === -1) return false;
    }
    return true;
  });
  window._concUniPag = 1;
  _concUnifiedRender();
};

window.concUnifiedPag = function(dir) {
  var total = Math.ceil((window._concUniFiltrada || []).length / _concUniIpp) || 1;
  window._concUniPag = Math.max(1, Math.min(total, (window._concUniPag || 1) + dir));
  _concUnifiedRender();
};

window.concUnifiedLimpar = function() {
  ['uni-busca','uni-tipo','uni-apur','uni-fin'].forEach(function(id) {
    var e = document.getElementById(id); if (e) e.value = '';
  });
  window._concUniFiltrada = (window._concListaGlobal || []).slice();
  window._concUniPag = 1;
  _concUnifiedRender();
};

window.conciliacaoFiltrarMes = function() {
  window.atualizarEstatisticasConciliacao();
};

window.conciliacaoInit = function() {
  window.atualizarEstatisticasConciliacao();
};

// ============================================================
// INCONSISTÊNCIAS — RFs de crédito com status inconsistencia
// ============================================================

window.creditosIrParaInconsistencias = function() {
  var btn = document.getElementById('subnav-inconsist-lista');
  if (typeof showInconsistSub === 'function') {
    showInconsistSub('lista', btn || document.getElementById('nav-inconsist-btn'));
  }
  setTimeout(function() {
    try { if (typeof inconsistRenderTabela === 'function') inconsistRenderTabela(); } catch(e) {}
    try { window.renderizarRFsInconsistencias(); } catch(e) {}
    // Expande o painel de filtros para evidenciar os filtros ativos
    var filtroCorpo = document.getElementById('inc-rf-corpo');
    if (filtroCorpo && filtroCorpo.style.display === 'none') {
      filtroCorpo.style.display = 'block';
      var btn = document.getElementById('inc-rf-toggle-btn');
      if (btn) btn.classList.add('open');
    }
    // Rola até a tabela
    var tabela = document.getElementById('t-inc-rfs');
    if (tabela) tabela.closest('.tcrd').scrollIntoView({behavior:'smooth', block:'start'});
  }, 100);
};

// ============================================================
// GESTÃO DE INCONSISTÊNCIAS — listagem, KPIs e gráficos
// ============================================================

window._rfIncGlobal  = [];
window._rfIncFiltrado = [];
window._rfIncPagina  = 1;
window._rfIncIpp     = 25;

var _incCores = (function(P){ return {
  'capur_ibs_divergente':P.red,   'capur_cbs_divergente':P.red,
  'capur_ibs_aliquota':P.amber,   'capur_cbs_aliquota':P.amber,
  'prazo_expirado':P.red,
  'cfin_ibs_split':P.blue,        'cfin_cbs_split':P.blue,
  'cfin_ibs_valor':P.amber,       'cfin_cbs_valor':P.amber,
  'chave_invalida':P.red,         'cnpj_divergente':P.amber,         'duplicidade_rf':P.gray
}; })(PALETTE);

function _incFmtM(v) {
  if (v >= 1e6) return 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M';
  if (v >= 1e3) return 'R$ ' + Math.round(v / 1e3) + 'K';
  return ff(v);
}

function _incSvgBar(el, dados, corFn, W, barH, gap, padL, padR) {
  if (!el || !dados.length) { if (el) el.innerHTML = '<div style="text-align:center;color:var(--txt3);font-size:12px;padding:20px 0">Sem dados.</div>'; return; }
  var maxVal = Math.max.apply(null, dados.map(function(d){return d.v;})) || 1;
  var padT = 8, padB = 4;
  var totalH = padT + dados.length * (barH + gap) - gap + padB;
  var s = '<svg viewBox="0 0 ' + W + ' ' + totalH + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">';
  dados.forEach(function(d, i) {
    var y = padT + i * (barH + gap);
    var bw = Math.max(4, Math.round((d.v / maxVal) * (W - padL - padR)));
    var cor = typeof corFn === 'function' ? corFn(d) : corFn;
    s += '<text x="' + (padL - 6) + '" y="' + (y + barH / 2 + 4) + '" text-anchor="end" fill="#A7A8AA" font-size="10" font-family="Montserrat,sans-serif">' + (d.label||'').slice(0,24) + '</text>';
    s += '<rect x="' + padL + '" y="' + y + '" width="' + (W - padL - padR) + '" height="' + barH + '" rx="3" fill="rgba(139,92,246,.07)"/>';
    s += '<rect x="' + padL + '" y="' + y + '" width="' + bw + '" height="' + barH + '" rx="3" fill="' + cor + '" opacity=".85"/>';
    var vlbl = d.fmt || _incFmtM(d.v);
    s += '<text x="' + (W - 2) + '" y="' + (y + barH / 2 + 4) + '" text-anchor="end" fill="'+PALETTE.blue+'" font-size="10" font-weight="700" font-family="Montserrat,sans-serif">' + vlbl + '</text>';
  });
  s += '</svg>';
  el.innerHTML = s;
}

function _incSvgDuo(el, items, W, barH) {
  if (!el) return;
  var maxV = Math.max.apply(null, items.map(function(d){return d.v;})) || 1;
  var gap = 18, padT = 6, padB = 4, padL = 52, padR = 60;
  var totalH = padT + items.length * (barH + gap) - gap + padB;
  var s = '<svg viewBox="0 0 ' + W + ' ' + totalH + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">';
  items.forEach(function(d, i) {
    var y = padT + i * (barH + gap);
    var bw = Math.max(4, Math.round((d.v / maxV) * (W - padL - padR)));
    s += '<text x="' + (padL - 6) + '" y="' + (y + barH / 2 + 4) + '" text-anchor="end" fill="' + d.cor + '" font-size="11" font-weight="700" font-family="Montserrat,sans-serif">' + d.label + '</text>';
    s += '<rect x="' + padL + '" y="' + y + '" width="' + (W - padL - padR) + '" height="' + barH + '" rx="3" fill="' + d.cor + '" opacity=".10"/>';
    s += '<rect x="' + padL + '" y="' + y + '" width="' + bw + '" height="' + barH + '" rx="3" fill="' + d.cor + '" opacity=".80"/>';
    s += '<text x="' + (W - 2) + '" y="' + (y + barH / 2 + 4) + '" text-anchor="end" fill="' + d.cor + '" font-size="10" font-weight="700" font-family="Montserrat,sans-serif">' + _incFmtM(d.v) + '</text>';
  });
  s += '</svg>';
  el.innerHTML = s;
}

function _incSvgMensal(el, mapa, W) {
  if (!el) return;
  var meses = Object.keys(mapa).sort();
  if (!meses.length) { el.innerHTML = '<div style="text-align:center;color:var(--txt3);font-size:12px;padding:20px 0">Sem dados.</div>'; return; }
  var vals = meses.map(function(m){return mapa[m];});
  var maxV = Math.max.apply(null, vals) || 1;
  var barW = Math.floor((W - 20) / meses.length) - 4;
  var H = 90, padB = 22, padT = 8;
  var areaH = H - padB - padT;
  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">';
  meses.forEach(function(m, i) {
    var v = mapa[m];
    var bh = Math.max(4, Math.round((v / maxV) * areaH));
    var x = 10 + i * (barW + 4);
    var y = padT + areaH - bh;
    s += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + bh + '" rx="2" fill="'+PALETTE.blue+'" opacity=".75"/>';
    s += '<text x="' + (x + barW / 2) + '" y="' + (H - 6) + '" text-anchor="middle" fill="#A7A8AA" font-size="9" font-family="Montserrat,sans-serif">' + m.slice(5) + '</text>';
    if (v > 0) s += '<text x="' + (x + barW / 2) + '" y="' + (y - 3) + '" text-anchor="middle" fill="'+PALETTE.blue+'" font-size="9" font-weight="700" font-family="Montserrat,sans-serif">' + v + '</text>';
  });
  s += '</svg>';
  el.innerHTML = s;
}

// Reconstrói window.inconsistencias a partir dos RFs com status='inconsistencia' em nfListaFiltradaGlobal.
// Preserva status 'resolvida' de entradas existentes (alteradas manualmente pelo usuário).
window._sincronizarInconsistencias = function() {
  var _rfTipoToInc = {
    'Vencido':                  'imposto_vencido',
    'Valor imposto divergente': 'cbs_incorreto',
    'Não conciliado':           'nf_erro',
    'Sem Comprovante':          'nf_erro'
  };
  var _incTipoSev = { nf_erro:'alta', nf_duplicada:'media', imposto_vencido:'alta', cbs_incorreto:'media' };
  var existMap = {};
  (window.inconsistencias || []).forEach(function(e) { existMap[e.nf] = e; });
  var nova = [];
  var seq = 1;
  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    var rfInc = (nf.registrosFiscais || []).find(function(rf) { return (rf.statusRegistro || rf.status) === 'inconsistencia'; });
    if (!rfInc) return;
    var rfTipo   = rfInc.inconsistencia || '';
    var incTipo  = _rfTipoToInc[rfTipo] || 'nf_erro';
    var nfLabel  = (nf.tipoDF || 'NF-e') + ' ' + nf.numero;
    var prev     = existMap[nfLabel];
    var parts    = (nf.data || '').split('-');
    var dataFmt  = parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : (nf.data || '');
    nova.push({
      id:         prev ? prev.id : 'INC-' + String(seq).padStart(4, '0'),
      tipo:       incTipo,
      nf:         nfLabel,
      forn:       nf.entidade || '',
      cnpj:       nf.cnpj || '',
      data:       dataFmt,
      valorNF:    nf.valorTotal || 0,
      severidade: _incTipoSev[incTipo] || 'media',
      status:     prev ? prev.status : 'aberta',
      detalhe:    rfTipo || 'Inconsistência identificada'
    });
    seq++;
  });
  if (nova.length > 0) window.inconsistencias = nova;
};

window.renderizarRFsInconsistencias = function() {
  // 1. Geração DF-cêntrica — sincronização dinâmica com nfListaFiltradaGlobal
  // Cada inconsistência vira 1 card; DF é a entidade primária, RF é referência opcional.
  var lista = [];
  var _capurIbsTipos = ['capur_ibs_divergente', 'capur_ibs_aliquota'];
  var _capurCbsTipos = ['capur_cbs_divergente', 'capur_cbs_aliquota'];
  var _cfinIbsTipos  = ['cfin_ibs_split',       'cfin_ibs_valor'];
  var _cfinCbsTipos  = ['cfin_cbs_split',        'cfin_cbs_valor'];
  var _incLblLocal = {
    capur_ibs_divergente:'Valor IBS divergente da apuração', capur_cbs_divergente:'Valor CBS divergente da apuração',
    capur_ibs_aliquota:'Alíquota IBS incorreta',             capur_cbs_aliquota:'Alíquota CBS incorreta',
    prazo_expirado:'Prazo de apuração expirado',
    cfin_ibs_split:'Split IBS não executado',                cfin_cbs_split:'Split CBS não executado',
    cfin_ibs_valor:'Comprovante IBS divergente',             cfin_cbs_valor:'Comprovante CBS divergente',
    chave_invalida:'Chave de acesso inválida',               cnpj_divergente:'CNPJ divergente',
    duplicidade_rf:'RF duplicado'
  };
  window._incTipoLbl = _incLblLocal;

  // Usa _concBuildLista para derivar capur_status e cfin_status de cada DF
  var concLista = _concBuildLista('');
  concLista.forEach(function(r) {
    var nf   = r.nf;
    var seed = _concHash((nf.numero || '') + (nf.cnpj || '') + r.idx);
    var dp   = (nf.data || '').split('-');
    var dataFmt = dp.length === 3 ? dp[2]+'/'+dp[1]+'/'+dp[0] : '—';
    var tipoNF  = nf.tipo || 'entrada';
    var dfLabel = (nf.tipoDF || 'NF-e') + ' ' + nf.numero;

    // ── CAPUR inconsistências ──────────────────────────────────────────────
    if (r.capur_status === 'inconsistencia') {
      var afeta = seed % 3; // 0=só IBS, 1=só CBS, 2=ambos
      if (afeta !== 1) {
        var tipoCI = _capurIbsTipos[seed % _capurIbsTipos.length];
        lista.push({
          id: (r.ibsRF ? r.ibsRF.id : nf.numero) + '_CAPUR_IBS',
          rfId: r.ibsRF ? r.ibsRF.id : null, nfId: nf.numero,
          tf: 'IBS', tipoNF: tipoNF, etapa: 'CAPUR',
          nfVinc: dfLabel, forn: nf.entidade || '—', cnpj: nf.cnpj || '—',
          valor: r.ibsRF ? (r.ibsRF.valor || 0) : Math.round((nf.valorTotal || 0) * 0.09),
          dataISO: nf.data || '', data: dataFmt,
          inc: tipoCI, tipoLabel: _incLblLocal[tipoCI]
        });
      }
      if (afeta !== 0) {
        var tipoCB = _capurCbsTipos[(seed + 1) % _capurCbsTipos.length];
        lista.push({
          id: (r.cbsRF ? r.cbsRF.id : nf.numero) + '_CAPUR_CBS',
          rfId: r.cbsRF ? r.cbsRF.id : null, nfId: nf.numero,
          tf: 'CBS', tipoNF: tipoNF, etapa: 'CAPUR',
          nfVinc: dfLabel, forn: nf.entidade || '—', cnpj: nf.cnpj || '—',
          valor: r.cbsRF ? (r.cbsRF.valor || 0) : Math.round((nf.valorTotal || 0) * 0.086),
          dataISO: nf.data || '', data: dataFmt,
          inc: tipoCB, tipoLabel: _incLblLocal[tipoCB]
        });
      }
    }

    // ── CFIN inconsistências ───────────────────────────────────────────────
    if (r.cfin_status === 'inconsistencia') {
      if (r.ibsInc && r.ibsRF) {
        var tipoCFI = _cfinIbsTipos[(seed + 2) % _cfinIbsTipos.length];
        lista.push({
          id: r.ibsRF.id + '_CFIN_IBS',
          rfId: r.ibsRF.id, nfId: nf.numero,
          tf: 'IBS', tipoNF: tipoNF, etapa: 'CFIN',
          nfVinc: dfLabel, forn: nf.entidade || '—', cnpj: nf.cnpj || '—',
          valor: r.ibsRF.valor || 0,
          dataISO: nf.data || '', data: dataFmt,
          inc: tipoCFI, tipoLabel: _incLblLocal[tipoCFI]
        });
      }
      if (r.cbsInc && r.cbsRF) {
        var tipoCFC = _cfinCbsTipos[(seed + 3) % _cfinCbsTipos.length];
        lista.push({
          id: r.cbsRF.id + '_CFIN_CBS',
          rfId: r.cbsRF.id, nfId: nf.numero,
          tf: 'CBS', tipoNF: tipoNF, etapa: 'CFIN',
          nfVinc: dfLabel, forn: nf.entidade || '—', cnpj: nf.cnpj || '—',
          valor: r.cbsRF.valor || 0,
          dataISO: nf.data || '', data: dataFmt,
          inc: tipoCFC, tipoLabel: _incLblLocal[tipoCFC]
        });
      }
      // CFIN pendente sem RF inconsistente = prazo expirado no DF
      if (!r.ibsInc && !r.cbsInc) {
        lista.push({
          id: nf.numero + '_CFIN_PRAZO',
          rfId: null, nfId: nf.numero,
          tf: '—', tipoNF: tipoNF, etapa: 'CFIN',
          nfVinc: dfLabel, forn: nf.entidade || '—', cnpj: nf.cnpj || '—',
          valor: nf.valorTotal || 0,
          dataISO: nf.data || '', data: dataFmt,
          inc: 'prazo_expirado', tipoLabel: _incLblLocal['prazo_expirado']
        });
      }
    }
  });

  // 1b. Ingestão — DF direto, sem RF vinculado
  var _ingStatusToInc = { erro_layout:'chave_invalida', erro_dados:'cnpj_divergente', rejeitado:'chave_invalida', duplicado:'duplicidade_rf' };
  var ingFalhas = ['erro_layout','erro_dados','rejeitado','duplicado'];
  (window._ingDadosGlobal || []).forEach(function(d) {
    if (ingFalhas.indexOf(d.status) === -1) return;
    var dp = (d.dataEmissao || '').split('-');
    var incKey = _ingStatusToInc[d.status] || 'chave_invalida';
    lista.push({
      id:        'ING-' + d.id,
      rfId:      null,
      tf:        '—', tipoNF: 'ingestao', etapa: 'Ingestão',
      nfVinc:    d.tipo + ' ' + (d.chave ? d.chave.slice(0,8) + '…' : '—'),
      forn:      d.emitente || '—', cnpj: d.cnpj || '—',
      valor:     d.valor || 0,
      dataISO:   d.dataEmissao || '',
      data:      dp.length === 3 ? dp[2]+'/'+dp[1]+'/'+dp[0] : '—',
      inc:       incKey, tipoLabel: _incLblLocal[incKey]
    });
  });

  window._rfIncGlobal = lista;

  // --- Construir _inconsistenciasGlobal (novo modelo) ---
  var _tipoIncMap = {
    // CAPUR — por imposto
    'Valor IBS divergente':        'capur_ibs_divergente',
    'Valor CBS divergente':        'capur_cbs_divergente',
    'Alíquota IBS incorreta':      'capur_ibs_aliquota',
    'Alíquota CBS incorreta':      'capur_cbs_aliquota',
    'Prazo de apuração expirado':  'prazo_expirado',
    // CFIN — por imposto
    'Split IBS não executado':     'cfin_ibs_split',
    'Split CBS não executado':     'cfin_cbs_split',
    'Comprovante IBS divergente':  'cfin_ibs_valor',
    'Comprovante CBS divergente':  'cfin_cbs_valor',
    // Ingestão
    'Falha de Layout':             'chave_invalida',
    'Inconsistência de Dados':     'cnpj_divergente',
    'Rejeitado SEFAZ':             'chave_invalida',
    'Documento Duplicado':         'duplicidade_rf',
    // Legado (compat)
    'Divergência de Valor':        'capur_ibs_divergente',
    'Valor imposto divergente':    'capur_ibs_aliquota',
    'Não conciliado':              'capur_ibs_divergente',
    'Sem Comprovante':             'cfin_ibs_split',
    'Vencido':                     'prazo_expirado'
  };
  var _tipoIncLbl = {
    'capur_ibs_divergente': 'Valor IBS divergente da apuração',
    'capur_cbs_divergente': 'Valor CBS divergente da apuração',
    'capur_ibs_aliquota':   'Alíquota IBS incorreta',
    'capur_cbs_aliquota':   'Alíquota CBS incorreta',
    'prazo_expirado':       'Prazo de apuração expirado',
    'cfin_ibs_split':       'Split IBS não executado',
    'cfin_cbs_split':       'Split CBS não executado',
    'cfin_ibs_valor':       'Comprovante IBS divergente',
    'cfin_cbs_valor':       'Comprovante CBS divergente',
    'chave_invalida':       'Chave de acesso inválida',
    'cnpj_divergente':      'CNPJ divergente',
    'duplicidade_rf':       'RF duplicado'
  };
  var _incStatuses = ['aberta','aberta','em_analise','aguardando_emitente','aberta','resolvida','glosada','aberta','em_analise','aberta'];
  var _incPrios = function(v){ return v > 500000 ? 'critica' : v > 100000 ? 'alta' : v > 20000 ? 'media' : 'baixa'; };
  var incGlobal = [];
  lista.forEach(function(r, i) {
    var tipo   = _tipoIncLbl[r.inc] ? r.inc : (_tipoIncMap[r.inc || ''] || r.inc || 'capur_ibs_divergente');
    var origem = r.rfId ? 'rf' : 'df';
    incGlobal.push({
      id:         'INC-' + String(incGlobal.length + 1).padStart(4,'0'),
      tipo:       tipo,
      tipoLabel:  _tipoIncLbl[tipo] || (r.tipoLabel || r.inc || 'Inconsistência'),
      dfId:       r.nfVinc || '—',
      dfNum:      r.nfVinc || '—',
      nfNumero:   r.nfId   || '',
      rfId:       r.rfId || null,
      tipoFiscal: r.tf || '—',
      origem:     origem,
      tipoFluxo:  r.tipoNF === 'ingestao' ? 'entrada' : (r.tipoNF || 'entrada'),
      status:     _incStatuses[i % _incStatuses.length],
      prioridade: _incPrios(r.valor),
      valor:      r.valor,
      entidade:   r.forn,
      cnpj:       r.cnpj,
      dataISO:    r.dataISO,
      data:       r.data
    });
  });
  window._inconsistenciasGlobal = incGlobal;

  // Back-references: anotar _inconsistencias em cada NF e RF
  var _nfIdx = {};
  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    nf._inconsistencias = [];
    _nfIdx[nf.numero] = nf;
    (nf.registrosFiscais || []).forEach(function(rf) { rf._inconsistencias = []; });
  });
  incGlobal.forEach(function(inc) {
    var nf = _nfIdx[inc.nfNumero];
    if (!nf) return;
    nf._inconsistencias.push(inc);
    if (inc.rfId) {
      (nf.registrosFiscais || []).forEach(function(rf) {
        if (rf.id === inc.rfId) rf._inconsistencias.push(inc);
      });
    }
  });

  // 2. KPIs ciclo de vida
  function setEl(id, v){ var e=document.getElementById(id); if(e) e.textContent=v; }
  var _stCnt = { aberta:0, em_analise:0, aguardando_emitente:0, resolvida:0, glosada:0 };
  var _volAberto = 0;
  incGlobal.forEach(function(inc) {
    _stCnt[inc.status] = (_stCnt[inc.status]||0) + 1;
    if (inc.status==='aberta'||inc.status==='em_analise'||inc.status==='aguardando_emitente') _volAberto += inc.valor;
  });
  setEl('inc-st-aberta',  _stCnt.aberta);
  setEl('inc-st-aberta-sub', _stCnt.aberta === 1 ? 'aguardando triagem' : 'aguardando triagem');
  setEl('inc-st-analise', _stCnt.em_analise);
  setEl('inc-st-aguard',  _stCnt.aguardando_emitente);
  setEl('inc-st-resol',   _stCnt.resolvida);
  setEl('inc-st-glosada', _stCnt.glosada);
  setEl('inc-vol-aberto', _incFmtM(_volAberto));
  setEl('inc-vol-aberto-sub', (_stCnt.aberta+_stCnt.em_analise+_stCnt.aguardando_emitente) + ' inconsistências abertas');

  // KPIs secundários
  var totalRFs = lista.length;
  var volTotal  = lista.reduce(function(s, r){ return s + r.valor; }, 0);
  var cntEnt    = lista.filter(function(r){ return r.tipoNF === 'entrada' || r.tipoNF === 'ingestao'; }).length;
  var cntSai    = lista.filter(function(r){ return r.tipoNF === 'saida'; }).length;
  setEl('inc2-total',  totalRFs);
  setEl('inc2-total-sub', incGlobal.length + ' inconsistências · ' + lista.filter(function(r){return r.etapa==='Ingestão';}).length + ' de Ingestão');
  setEl('inc2-volume', _incFmtM(volTotal));
  setEl('inc2-volume-sub', totalRFs > 0 ? 'Média ' + _incFmtM(Math.round(volTotal / totalRFs)) + ' por registro' : 'Soma dos valores');
  setEl('inc2-entrada', cntEnt);
  setEl('inc2-entrada-sub', 'Créditos · ' + lista.filter(function(r){return r.tipoNF==='entrada'&&r.tf==='IBS';}).length + ' IBS · ' + lista.filter(function(r){return r.tipoNF==='entrada'&&r.tf==='CBS';}).length + ' CBS');
  setEl('inc2-saida', cntSai);
  setEl('inc2-saida-sub', 'Débitos · ' + lista.filter(function(r){return r.tipoNF==='saida'&&r.tf==='IBS';}).length + ' IBS · ' + lista.filter(function(r){return r.tipoNF==='saida'&&r.tf==='CBS';}).length + ' CBS');

  // 3. Chart 1 — Top 5 fornecedores
  var mapForn = {};
  lista.forEach(function(r){ mapForn[r.forn] = (mapForn[r.forn]||0) + r.valor; });
  var top5Forn = Object.keys(mapForn).map(function(k){return {label:k,v:mapForn[k]};}).sort(function(a,b){return b.v-a.v;}).slice(0,5);
  _incSvgBar(document.getElementById('c-inc-top5-forn'), top5Forn, function(){return PALETTE.teal;}, 560, 20, 12, 180, 70);

  // 4. Chart 2 — Por tipo de inconsistência
  var mapTipo = {};
  lista.forEach(function(r){ var k=r.inc||'Sem tipo'; mapTipo[k]=(mapTipo[k]||0)+r.valor; });
  var tiposDados = Object.keys(mapTipo).map(function(k){return {label:_tipoIncLbl[k]||k,v:mapTipo[k],cor:_incCores[k]||PALETTE.teal};}).sort(function(a,b){return b.v-a.v;});
  _incSvgBar(document.getElementById('c-inc-tipos'), tiposDados, function(d){return d.cor;}, 560, 20, 12, 180, 70);

  // 5. Chart 3 — IBS vs CBS
  var volIBS = lista.filter(function(r){return r.tf==='IBS';}).reduce(function(s,r){return s+r.valor;},0);
  var volCBS = lista.filter(function(r){return r.tf==='CBS';}).reduce(function(s,r){return s+r.valor;},0);
  _incSvgDuo(document.getElementById('c-inc-ibs-cbs'), [
    {label:'IBS', v:volIBS, cor:PALETTE.teal},
    {label:'CBS', v:volCBS, cor:PALETTE.blue}
  ], 280, 22);

  // 6. Chart 4 — Entrada vs Saída
  var volEnt = lista.filter(function(r){return r.tipoNF==='entrada';}).reduce(function(s,r){return s+r.valor;},0);
  var volSai = lista.filter(function(r){return r.tipoNF==='saida';}).reduce(function(s,r){return s+r.valor;},0);
  _incSvgDuo(document.getElementById('c-inc-ent-sai'), [
    {label:'Entrada', v:volEnt, cor:PALETTE.teal},
    {label:'Saída',   v:volSai, cor:PALETTE.amber}
  ], 280, 22);

  // 7. Chart 5 — Evolução mensal (contagem de RFs)
  var mapMes = {};
  lista.forEach(function(r){ var m=(r.dataISO||'').slice(0,7); if(m) mapMes[m]=(mapMes[m]||0)+1; });
  _incSvgMensal(document.getElementById('c-inc-mensal'), mapMes, 280);

  // 8. Renderizar listagem filtrada
  window.incRfFiltrar();
};

window.incRfToggleFiltros = function() { window.shToggleFilterPanel('inc-rf'); };

window.incRfFiltrar = function() {
  var busca    = ((document.getElementById('inc-rf-busca')       ||{}).value||'').toLowerCase();
  var tipoNF   = (document.getElementById('inc-rf-tipo-nf')      ||{}).value||'';
  var tipoFisc = (document.getElementById('inc-rf-tipo-fiscal')  ||{}).value||'';
  var incTipo  = (document.getElementById('inc-rf-inc-tipo')     ||{}).value||'';
  var status   = (document.getElementById('inc-rf-etapa')        ||{}).value||'';
  var dataDe   = (document.getElementById('inc-rf-data-de')      ||{}).value||'';
  var dataAte  = (document.getElementById('inc-rf-data-ate')     ||{}).value||'';
  var valMin    = (document.getElementById('inc-rf-valor-min')   ||{}).value||'';
  var valMax    = (document.getElementById('inc-rf-valor-max')   ||{}).value||'';
  var prioridade= (document.getElementById('inc-rf-prioridade')  ||{}).value||'';
  var origem    = (document.getElementById('inc-rf-origem')      ||{}).value||'';

  var lista = (window._inconsistenciasGlobal || []).filter(function(inc) {
    if (tipoNF    && inc.tipoFluxo !== tipoNF)                                             return false;
    if (tipoFisc  && inc.tipoFiscal && inc.tipoFiscal !== '—' && inc.tipoFiscal.toLowerCase() !== tipoFisc) return false;
    if (incTipo   && inc.tipo !== incTipo && inc.tipoLabel !== incTipo)                    return false;
    if (status    && inc.status !== status)                                                return false;
    if (dataDe    && inc.dataISO < dataDe)                                                 return false;
    if (dataAte   && inc.dataISO > dataAte)                                                return false;
    if (valMin !== '' && inc.valor < parseFloat(valMin))                                   return false;
    if (valMax !== '' && inc.valor > parseFloat(valMax))                                   return false;
    if (prioridade && inc.prioridade !== prioridade)                                       return false;
    if (origem     && inc.origem !== origem)                                               return false;
    if (busca) {
      var s = (inc.id + inc.dfNum + inc.entidade + inc.cnpj + (inc.rfId||'')).toLowerCase();
      if (s.indexOf(busca) < 0) return false;
    }
    return true;
  });

  window._rfIncFiltrado = lista;
  window._rfIncPagina = 1;
  var cnt = document.getElementById('inc-rf-contagem');
  if (cnt) cnt.textContent = lista.length + ' inconsistência' + (lista.length !== 1 ? 's' : '');
  window._incRfRenderPagina();
};

window.incRfLimparFiltros = function() {
  ['inc-rf-busca','inc-rf-tipo-nf','inc-rf-tipo-fiscal','inc-rf-inc-tipo','inc-rf-etapa','inc-rf-data-de','inc-rf-data-ate','inc-rf-valor-min','inc-rf-valor-max','inc-rf-prioridade','inc-rf-origem'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.value = '';
  });
  window.incRfFiltrar();
};

window._incRfRenderPagina = function() {
  var lista     = window._rfIncFiltrado || [];
  var ipp       = window._rfIncIpp;
  var pagAtual  = window._rfIncPagina;
  var totalPag  = Math.ceil(lista.length / ipp) || 1;
  if (pagAtual > totalPag) pagAtual = window._rfIncPagina = totalPag;
  var ini = (pagAtual - 1) * ipp;
  var pag = lista.slice(ini, ini + ipp);

  var _stBadgeCfg = {
    aberta:               ['165,72,83',  'Aberta'],
    em_analise:           ['170,122,50', 'Em Análise'],
    aguardando_emitente:  ['62,108,176', 'Ag. Emitente'],
    resolvida:            ['52,168,153', 'Resolvida'],
    glosada:              ['105,112,122','Glosada']
  };
  var _prioCfg = {
    critica: ['165,72,83','CRÍTICA'],  alta: ['170,122,50','ALTA'],
    media:   ['62,108,176','MÉDIA'],   baixa: ['105,112,122','BAIXA']
  };
  function _badge(rgb, lbl) {
    return '<span style="font-size:9px;font-weight:700;letter-spacing:.06em;padding:2px 7px;border-radius:3px;background:rgba('+rgb+',.12);color:rgba('+rgb+',1);border:1px solid rgba('+rgb+',.28)">'+lbl+'</span>';
  }
  var h = '';
  pag.forEach(function(inc) {
    var sc = _stBadgeCfg[inc.status] || ['167,168,170', inc.status];
    var pc = _prioCfg[inc.prioridade] || ['167,168,170', inc.prioridade];
    var fluxoBadge = inc.tipoFluxo === 'entrada'
      ? '<span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;border:1px solid rgba(29,158,117,.28);color:rgba(29,158,117,1);background:rgba(29,158,117,.1)">↓ Entrada</span>'
      : '<span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;border:1px solid rgba(244,63,94,.28);color:rgba(244,63,94,1);background:rgba(244,63,94,.1)">↑ Saída</span>';
    var rfCell = inc.rfId
      ? '<button onclick="window.abrirDetalheRF(\''+inc.rfId+'\')" style="background:none;border:none;color:rgba(26,107,90,1);cursor:pointer;font-size:10px;font-weight:600;padding:0;text-decoration:underline dotted;font-family:monospace">'+inc.rfId+' · '+inc.tipoFiscal+'</button>'
      : '<span style="color:var(--txt3);font-size:11px">— DF direto</span>';
    var dfNum = inc.dfNum.replace(/^[^\s]+\s*/,'');
    var dfCell = '<button onclick="if(window.abrirDetalhesNFporNumero)abrirDetalhesNFporNumero(\''+dfNum+'\')" style="background:none;border:none;color:rgba(26,75,140,1);cursor:pointer;font-size:11px;font-weight:600;padding:0;text-decoration:underline dotted;font-family:monospace">'+inc.dfNum+'</button>';
    h += '<tr>'
      + '<td class="mono nowrap" style="font-size:10px;color:rgba(90,26,140,1);font-weight:700">'+inc.id+'</td>'
      + '<td class="nowrap">'+dfCell+'</td>'
      + '<td class="nowrap">'+fluxoBadge+'</td>'
      + '<td class="nowrap">'+rfCell+'</td>'
      + '<td class="nowrap" style="font-size:11px;color:var(--txt2)">'+inc.tipoFiscal+'</td>'
      + '<td class="trunc" style="max-width:150px">'+inc.entidade+'</td>'
      + '<td class="r mono" style="color:var(--txt2)">'+ff(inc.valor)+'</td>'
      + '<td style="font-size:11px;color:var(--txt1)">'+inc.tipoLabel+'</td>'
      + '<td class="nowrap">'+_badge(inc.origem==='df'?'24,95,165':'26,107,90', inc.origem==='df'?'DF':'RF')+'</td>'
      + '<td class="nowrap">'+_badge(sc[0],sc[1])+'</td>'
      + '<td class="nowrap">'+_badge(pc[0],pc[1])+'</td>'
      + '<td class="nowrap" style="font-size:11px;color:var(--txt2)">'+inc.data+'</td>'
      + '</tr>';
  });
  if (!pag.length) h = '<tr><td colspan="12" style="text-align:center;color:var(--txt3);padding:24px">Nenhuma inconsistência encontrada para este filtro.</td></tr>';

  var tbody = document.getElementById('t-inc-rfs');
  if (tbody) tbody.innerHTML = h;

  function setEl(id, v){ var e=document.getElementById(id); if(e) e.textContent=v; }
  setEl('inc-rf-count-sub', lista.length + ' inconsistência' + (lista.length!==1?'s':'') + ' · entrada e saída');
  setEl('inc-rf-pag-atual', pagAtual);
  setEl('inc-rf-pag-total', totalPag);

  var btnP = document.getElementById('inc-rf-btn-prev');
  var btnN = document.getElementById('inc-rf-btn-prox');
  if (btnP) { btnP.disabled = pagAtual <= 1; btnP.style.opacity = pagAtual <= 1 ? '0.5' : '1'; btnP.style.cursor = pagAtual <= 1 ? 'not-allowed' : 'pointer'; }
  if (btnN) { btnN.disabled = pagAtual >= totalPag; btnN.style.opacity = pagAtual >= totalPag ? '0.5' : '1'; btnN.style.cursor = pagAtual >= totalPag ? 'not-allowed' : 'pointer'; }
};

// Mapa de ações disponíveis por tipo de inconsistência
var _incAcoesMap = {
  'Não conciliado':           [{ label: 'Conciliar RF manualmente',          icon: '🔗', cor: '#1d9e75' }, { label: 'Encaminhar para análise fiscal',      icon: '🔍', cor: '#185fa5' }, { label: 'Notificar fornecedor',               icon: '✉️', cor: '#8B5CF6' }],
  'Valor imposto divergente': [{ label: 'Corrigir valor do imposto',          icon: '✏️', cor: '#ba7517' }, { label: 'Solicitar nota de crédito ao fornecedor', icon: '📋', cor: '#185fa5' }, { label: 'Abrir chamado na SEFAZ',             icon: '🏛️', cor: '#8B5CF6' }],
  'Vencido':                  [{ label: 'Emitir nova guia de pagamento',      icon: '📄', cor: '#a32d2d' }, { label: 'Solicitar prorrogação de prazo',     icon: '📅', cor: '#ba7517' }, { label: 'Regularizar junto ao Fisco',         icon: '🏛️', cor: '#8B5CF6' }],
  'Sem Comprovante':          [{ label: 'Anexar comprovante de pagamento',    icon: '📎', cor: '#1d9e75' }, { label: 'Solicitar comprovante ao fornecedor', icon: '✉️', cor: '#185fa5' }, { label: 'Reprocessar após anexo',             icon: '🔄', cor: '#1d9e75' }],
  'Falha de Layout':          [{ label: 'Reprocessar documento',              icon: '🔄', cor: '#1d9e75' }, { label: 'Solicitar reenvio ao fornecedor',    icon: '✉️', cor: '#185fa5' }, { label: 'Corrigir layout e reimportar',       icon: '✏️', cor: '#ba7517' }],
  'Inconsistência de Dados':  [{ label: 'Corrigir dados do documento',       icon: '✏️', cor: '#ba7517' }, { label: 'Revalidar após correção',            icon: '✅', cor: '#1d9e75' }, { label: 'Encaminhar para revisão manual',    icon: '🔍', cor: '#185fa5' }],
  'Rejeitado SEFAZ':          [{ label: 'Corrigir e reenviar à SEFAZ',       icon: '🏛️', cor: '#a32d2d' }, { label: 'Solicitar manifestação do destinatário', icon: '📋', cor: '#ba7517' }, { label: 'Cancelar e emitir novo documento',  icon: '❌', cor: '#8B5CF6' }],
  'Documento Duplicado':      [{ label: 'Anular documento duplicado',         icon: '🗑️', cor: '#a32d2d' }, { label: 'Manter original e descartar',       icon: '✅', cor: '#1d9e75' }, { label: 'Encaminhar para auditoria',          icon: '🔍', cor: '#8B5CF6' }]
};

window._incAbrirAcao = function(id) {
  var r = (window._rfIncGlobal || []).filter(function(x){ return x.id === id; })[0];
  if (!r) return;

  var tipo    = r.inc || 'capur_ibs_divergente';
  var tipoLbl = (window._incTipoLbl && window._incTipoLbl[tipo]) || r.tipoLabel || tipo;
  var acoes   = _incAcoesMap[tipo] || [{ label: 'Encaminhar para análise', icon: '🔍', cor: '#185fa5' }];
  var incCor  = _incCores[tipo] || '#8B5CF6';
  var fmtV = function(v){ if(v>=1e6) return 'R$ '+(v/1e6).toFixed(2).replace('.',',')+'M'; if(v>=1e3) return 'R$ '+Math.round(v/1e3)+'K'; return 'R$ '+v.toFixed(2).replace('.',','); };

  var acoesHtml = acoes.map(function(a, i) {
    return '<button onclick="window._incExecutarAcao(\'' + id + '\',' + i + ')" style="display:flex;align-items:center;gap:10px;width:100%;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:12px 14px;cursor:pointer;text-align:left;font-family:inherit;transition:border-color .15s;margin-bottom:8px" onmouseenter="this.style.borderColor=\'' + a.cor + '\'" onmouseleave="this.style.borderColor=\'var(--border)\'">'
      + '<span style="font-size:20px;width:28px;flex-shrink:0">' + a.icon + '</span>'
      + '<div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--txt1)">' + a.label + '</div>'
      + '<div style="font-size:11px;color:var(--txt2);margin-top:2px">Clicar para iniciar o processo de correção</div></div>'
      + '<span style="font-size:11px;font-weight:700;color:' + a.cor + ';background:' + a.cor.replace('#','rgba(').replace(/^rgba\(([^)]+)\)$/, 'rgba($1,.12)') + ';padding:3px 9px;border-radius:4px">Iniciar</span>'
      + '</button>';
  }).join('');

  var html = '<div id="_incAcaoOverlay" onclick="if(event.target===this)window._incFecharAcao()" style="position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px">'
    + '<div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,.7)">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--border)">'
    + '<div><div style="font-size:15px;font-weight:700;color:var(--txt1)">Ações de Correção</div>'
    + '<div style="font-size:12px;color:var(--txt2);margin-top:2px">' + r.id + ' · ' + (r.forn||'—') + '</div></div>'
    + '<button onclick="window._incFecharAcao()" style="background:none;border:none;color:var(--txt2);font-size:20px;cursor:pointer;line-height:1;padding:4px">✕</button>'
    + '</div>'
    + '<div style="padding:16px 20px;border-bottom:1px solid var(--border);display:grid;grid-template-columns:1fr 1fr;gap:12px">'
    + '<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--txt3);margin-bottom:4px">Inconsistência</div><div style="font-size:13px;font-weight:700;color:' + incCor + '">' + tipoLbl + '</div></div>'
    + '<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--txt3);margin-bottom:4px">Valor RF</div><div style="font-size:13px;font-weight:700;color:var(--txt1)">' + fmtV(r.valor) + '</div></div>'
    + '<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--txt3);margin-bottom:4px">Etapa</div><div style="font-size:13px;color:var(--txt1)">' + (r.etapa||'—') + '</div></div>'
    + '<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--txt3);margin-bottom:4px">Data</div><div style="font-size:13px;color:var(--txt1)">' + (r.data||'—') + '</div></div>'
    + '</div>'
    + '<div style="padding:18px 20px">'
    + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--txt3);margin-bottom:12px">Selecione a ação de correção</div>'
    + acoesHtml
    + '<button onclick="window._incFecharAcao()" style="width:100%;background:none;border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--txt2);font-size:13px;cursor:pointer;font-family:inherit;margin-top:4px">Cancelar</button>'
    + '</div></div></div>';

  var el = document.getElementById('_incAcaoOverlay');
  if (el) el.remove();
  document.body.insertAdjacentHTML('beforeend', html);
};

window._incFecharAcao = function() {
  var el = document.getElementById('_incAcaoOverlay');
  if (el) el.remove();
};

window._incExecutarAcao = function(id, acaoIdx) {
  var r = (window._rfIncGlobal || []).filter(function(x){ return x.id === id; })[0];
  if (!r) return;
  var tipo  = r.inc || 'capur_ibs_divergente';
  var acoes = _incAcoesMap[tipo] || [];
  var acao = acoes[acaoIdx] || { label: 'Ação', icon: '✅' };

  window._incFecharAcao();

  // Mover para "Em Análise" no kanban
  if (window._kanbanState && r.id.indexOf('ING-') < 0) {
    window._kanbanState[r.id] = 'analise';
  }

  // Toast de confirmação
  var toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:28px;right:24px;background:#1a1d23;border:1px solid rgba(139,92,246,.4);border-left:4px solid #8B5CF6;border-radius:8px;padding:14px 18px;z-index:10001;font-family:Montserrat,sans-serif;min-width:300px;box-shadow:0 8px 24px rgba(0,0,0,.5);animation:_slideIn .2s ease';
  toast.innerHTML = '<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:4px">' + acao.icon + ' Ação iniciada com sucesso</div>'
    + '<div style="font-size:11px;color:#adb5bd">' + acao.label + ' · ' + r.id + '</div>'
    + '<div style="font-size:11px;color:#8B5CF6;margin-top:6px">Registro encaminhado para acompanhamento</div>';
  document.body.appendChild(toast);
  setTimeout(function(){ if(toast.parentNode) toast.parentNode.removeChild(toast); }, 4000);
};

window.incRfProximaPagina = function() {
  var totalPag = Math.ceil((window._rfIncFiltrado||[]).length / window._rfIncIpp) || 1;
  if (window._rfIncPagina < totalPag) { window._rfIncPagina++; window._incRfRenderPagina(); }
};

window.incRfPaginaAnterior = function() {
  if (window._rfIncPagina > 1) { window._rfIncPagina--; window._incRfRenderPagina(); }
};

// ============================================================
// KANBAN DE INCONSISTÊNCIAS
// ============================================================

window._kanbanState = {};

var _kbColunas = [
  { id: 'identificado',   label: 'Identificado',       cor: '#a32d2d', icon: '🔴' },
  { id: 'analise',        label: 'Em Análise',          cor: '#ba7517', icon: '🔍' },
  { id: 'tratamento',     label: 'Em Tratamento',       cor: '#185fa5', icon: '🔧' },
  { id: 'aguardando',     label: 'Aguardando Retorno',  cor: '#8B5CF6', icon: '⏳' },
  { id: 'resolvido',      label: 'Resolvido',           cor: '#1d9e75', icon: '✅' }
];

var _kbIncCores = {
  'Não conciliado':          '#a32d2d',
  'Valor imposto divergente':'#ba7517',
  'Vencido':                 '#EF4444',
  'Sem Comprovante':         '#8B5CF6'
};

window._kbRfsData = {};
window._kanbanResponsavel = {};
window._kbHistoricoAtribuicao = {};
window._kbFilterTipos = new Set();
window._kbFilterDFs = new Set();

var _kbUsuarios = [
  { id: 'nenhum', nome: 'Sem responsável', iniciais: '—', cor: '#6B7280' },
  { id: 'js',     nome: 'José da Silva',   iniciais: 'JS', cor: '#1d9e75' },
  { id: 'mc',     nome: 'Maria Costa',     iniciais: 'MC', cor: '#185fa5' },
  { id: 'rl',     nome: 'Rafael Lima',     iniciais: 'RL', cor: '#7C3AED' },
  { id: 'af',     nome: 'Ana Ferreira',    iniciais: 'AF', cor: '#D97706' },
  { id: 'pt',     nome: 'Paulo Torres',    iniciais: 'PT', cor: '#059669' }
];

window._kbToggleFilter = function(type, value) {
  var set = type === 'tipo' ? window._kbFilterTipos : window._kbFilterDFs;
  if (set.has(value)) set.delete(value); else set.add(value);
  window.renderizarKanbanInconsistencias();
};

window._kbMudarResponsavel = function(incId, userId) {
  var anterior = window._kanbanResponsavel[incId] || 'nenhum';
  if (anterior === userId) return;
  window._kanbanResponsavel[incId] = userId;

  var usr = _kbUsuarios.find(function(u) { return u.id === userId; }) || _kbUsuarios[0];
  var ant = _kbUsuarios.find(function(u) { return u.id === anterior; }) || _kbUsuarios[0];
  var now = new Date();
  var pad = function(n) { return n < 10 ? '0'+n : ''+n; };
  var dataFmt = pad(now.getDate())+'/'+pad(now.getMonth()+1)+'/'+now.getFullYear()
    + ' ' + pad(now.getHours())+':'+pad(now.getMinutes());
  if (!window._kbHistoricoAtribuicao[incId]) window._kbHistoricoAtribuicao[incId] = [];
  window._kbHistoricoAtribuicao[incId].push({
    userId: userId,
    nomeNovo: usr.nome,
    nomeAnterior: ant.nome,
    dataFmt: dataFmt,
    ts: now.toISOString()
  });

  // Atualiza avatar no modal se estiver aberto
  var av = document.getElementById('kb-resp-avatar-'+incId);
  if (av) {
    av.textContent  = usr.iniciais;
    av.style.background = usr.cor;
    av.title = usr.nome;
  }
  var lbl = document.getElementById('kb-resp-label-'+incId);
  if (lbl) lbl.textContent = usr.nome;

  // Adiciona evento na timeline do modal
  var tl = document.getElementById('kb-timeline-'+incId);
  if (tl) {
    var novos = window._kbHistoricoAtribuicao[incId];
    var entrada = novos[novos.length - 1];
    var html = '<div style="display:flex;gap:12px;margin-bottom:16px">'
      + '<div style="display:flex;flex-direction:column;align-items:center;width:28px;flex-shrink:0">'
      + '<div style="width:28px;height:28px;border-radius:50%;background:rgba(170,122,50,.15);border:1.5px solid rgba(170,122,50,.6);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:rgba(170,122,50,1)">→</div>'
      + '</div>'
      + '<div style="flex:1">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">'
      + '<span style="background:rgba(170,122,50,.12);color:rgba(170,122,50,1);border:1px solid rgba(170,122,50,.3);border-radius:3px;padding:1px 7px;font-size:9px;font-weight:700;letter-spacing:.07em">ATRIBUIÇÃO</span>'
      + '<span style="font-size:10px;color:var(--txt3);font-family:monospace">'+entrada.dataFmt+'</span>'
      + '</div>'
      + '<div style="font-size:12px;color:var(--txt1);line-height:1.55;margin-bottom:3px">'
      + (userId === 'nenhum'
          ? 'Responsável removido · antes: '+entrada.nomeAnterior
          : 'Atribuído para <strong>'+entrada.nomeNovo+'</strong>'+(anterior !== 'nenhum' ? ' · antes: '+entrada.nomeAnterior : ''))
      + '</div>'
      + '<div style="font-size:10px;color:var(--txt2)">Inconsistências · Usuário atual</div>'
      + '</div></div>';
    tl.insertAdjacentHTML('afterbegin', html);
    var cnt = document.getElementById('kb-timeline-count-'+incId);
    if (cnt) {
      var n = parseInt(cnt.dataset.count || '0') + 1;
      cnt.dataset.count = n;
      cnt.textContent = 'Histórico do Ciclo · '+n+' evento'+(n !== 1 ? 's' : '');
    }
  }

  window.renderizarKanbanInconsistencias();
};

window.renderizarKanbanInconsistencias = function() {
  var board = document.getElementById('inc-kanban-board');
  if (!board) return;

  var incList = window._inconsistenciasGlobal || [];

  // Filtros
  var filtersEl = document.getElementById('inc-kb-filters');
  var _kbFiltroFluxo = window._kbFiltroFluxo || '';
  var _kbFiltroPrio  = window._kbFiltroPrio  || '';
  if (filtersEl) {
    var fluxoOpts = [['','Todos'],['entrada','↓ Entrada'],['saida','↑ Saída']];
    var prioOpts  = [['','Todas prioridades'],['critica','Crítica'],['alta','Alta'],['media','Média'],['baixa','Baixa']];
    filtersEl.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px">'
      + fluxoOpts.map(function(o){
          var act = _kbFiltroFluxo === o[0];
          var c = o[0]==='entrada'?'29,158,117':o[0]==='saida'?'244,63,94':'167,168,170';
          return '<button onclick="window._kbFiltroFluxo=\''+o[0]+'\';window.renderizarKanbanInconsistencias()" '
            +'style="font-size:10px;font-weight:700;padding:4px 11px;border-radius:20px;border:1px solid rgba('+c+','+(act?'1':'.3')+');background:rgba('+c+','+(act?'.15':'0')+');color:rgba('+c+',1);cursor:pointer;font-family:inherit">'+o[1]+'</button>';
        }).join('')
      + '&nbsp;&nbsp;'
      + prioOpts.map(function(o){
          var act = _kbFiltroPrio === o[0];
          return '<button onclick="window._kbFiltroPrio=\''+o[0]+'\';window.renderizarKanbanInconsistencias()" '
            +'style="font-size:10px;font-weight:600;padding:4px 11px;border-radius:20px;border:1px solid var(--brd);background:'+(act?'var(--teal)':'transparent')+';color:'+(act?'#fff':'var(--txt3)')+';cursor:pointer;font-family:inherit">'+o[1]+'</button>';
        }).join('')
      + '</div>';
  }

  // Aplicar filtros
  var lista = incList.filter(function(inc) {
    if (_kbFiltroFluxo && inc.tipoFluxo !== _kbFiltroFluxo) return false;
    if (_kbFiltroPrio  && inc.prioridade !== _kbFiltroPrio)  return false;
    return true;
  });

  // Badge total
  var badge = document.getElementById('inc-kb-total-badge');
  if (badge) badge.textContent = lista.length + (lista.length === 1 ? ' inconsistência' : ' inconsistências');

  // Colunas do ciclo de vida
  var kbCols = [
    { id:'aberta',              label:'Aberta',         cor:'165,72,83'   },
    { id:'em_analise',          label:'Em Análise',     cor:'170,122,50'  },
    { id:'aguardando_emitente', label:'Ag. Emitente',   cor:'62,108,176'  },
    { id:'resolvida',           label:'Resolvida',      cor:'52,168,153'  },
    { id:'glosada',             label:'Glosada',        cor:'105,112,122' }
  ];

  var _prioCor = { critica:'165,72,83', alta:'170,122,50', media:'62,108,176', baixa:'105,112,122' };
  var _prioLbl = { critica:'CRÍTICA', alta:'ALTA', media:'MÉDIA', baixa:'BAIXA' };

  function _kbBadge(rgb, lbl, sm) {
    var sz = sm ? '9px' : '10px';
    return '<span style="font-size:'+sz+';font-weight:700;padding:2px 6px;border-radius:3px;background:rgba('+rgb+',.12);color:rgba('+rgb+',1);border:1px solid rgba('+rgb+',.28);letter-spacing:.05em">'+lbl+'</span>';
  }

  // Agrupar
  var grupos = {};
  kbCols.forEach(function(c){ grupos[c.id] = []; });
  lista.forEach(function(inc){
    var st = window._kanbanState[inc.id] || inc.status;
    if (!grupos[st]) st = 'aberta';
    grupos[st].push(inc);
  });

  var html = '';
  kbCols.forEach(function(col) {
    var cards = grupos[col.id] || [];
    var cardsHtml = '';
    cards.forEach(function(inc) {
      var safeId = inc.id.replace(/'/g,"\\'");
      var fluxoRgb = inc.tipoFluxo === 'entrada' ? '29,158,117' : '244,63,94';
      var fluxoLbl = inc.tipoFluxo === 'entrada' ? '↓ Entrada' : '↑ Saída';
      var tfRgb    = inc.tipoFiscal === 'IBS' ? '24,95,165' : '186,117,23';
      var origemRgb = inc.origem === 'df' ? '24,95,165' : '26,107,90';
      var origemLbl = inc.origem === 'df' ? 'DF' : 'RF';
      var dfNum = (inc.dfNum||'').replace(/^[^\s]+\s*/,'');
      cardsHtml += '<div class="kb-card" draggable="true"'
        + ' ondragstart="window._kbDragStart(event,\''+safeId+'\')"'
        + ' onclick="window.kbAbrirCard(\''+safeId+'\')"'
        + ' style="background:var(--card);border:1px solid var(--brd);border-radius:10px;padding:12px 14px;margin-bottom:10px;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.08);transition:box-shadow .15s,transform .15s"'
        + ' onmouseenter="this.style.boxShadow=\'0 4px 16px rgba(0,0,0,.22)\';this.style.transform=\'translateY(-2px)\'"'
        + ' onmouseleave="this.style.boxShadow=\'0 1px 4px rgba(0,0,0,.08)\';this.style.transform=\'\'">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
        + '<span style="font-size:9px;font-family:monospace;color:rgba(90,26,140,1);font-weight:700">'+inc.id+'</span>'
        + _kbBadge(_prioCor[inc.prioridade]||'167,168,170', _prioLbl[inc.prioridade]||inc.prioridade, true)
        + '</div>'
        + '<div style="font-size:11px;font-weight:700;color:var(--txt1);margin-bottom:4px;line-height:1.4">'+inc.tipoLabel+'</div>'
        + '<div style="font-size:10px;color:var(--txt3);margin-bottom:2px">📄 '+inc.dfNum+'</div>'
        + (inc.rfId ? '<div style="font-size:10px;color:var(--txt3);margin-bottom:6px">RF: <span style="font-family:monospace">'+inc.rfId+'</span> · '+inc.tipoFiscal+'</div>'
                    : '<div style="font-size:10px;color:var(--txt3);margin-bottom:6px">inconsistência direta no DF</div>')
        + '<div style="font-size:12px;font-weight:600;color:var(--txt2);margin-bottom:8px">'+ff(inc.valor)+'</div>'
        + '<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">'
        + _kbBadge(fluxoRgb, fluxoLbl, true)
        + _kbBadge(origemRgb, origemLbl, true)
        + (function() {
            var rid = window._kanbanResponsavel[inc.id] || 'nenhum';
            if (rid === 'nenhum') return '<span style="font-size:10px;color:var(--txt3);margin-left:auto">'+inc.data+'</span>';
            var ru = _kbUsuarios.find(function(u) { return u.id === rid; }) || _kbUsuarios[0];
            return '<span style="font-size:10px;color:var(--txt3);margin-left:auto">'+inc.data+'</span>'
              + '<div title="'+ru.nome+'" style="width:20px;height:20px;border-radius:50%;background:'+ru.cor+';display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#fff;flex-shrink:0;margin-left:4px">'+ru.iniciais+'</div>';
          })()
        + '</div>'
        + '</div>';
    });

    html += '<div style="flex:0 0 230px;min-width:230px">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:10px 14px;background:var(--card);border:1px solid var(--brd);border-radius:10px;border-top:3px solid rgba('+col.cor+',1)">'
      + '<span style="font-size:12px;font-weight:700;color:var(--txt1);flex:1">'+col.label+'</span>'
      + '<span style="background:rgba('+col.cor+',.12);color:rgba('+col.cor+',1);border-radius:10px;padding:2px 8px;font-size:11px;font-weight:700">'+cards.length+'</span>'
      + '</div>'
      + '<div id="kb-col-'+col.id+'" data-col="'+col.id+'"'
      + ' ondragover="window._kbDragOver(event)"'
      + ' ondragleave="window._kbDragLeave(event)"'
      + ' ondrop="window._kbDrop(event,\''+col.id+'\')"'
      + ' style="min-height:400px;padding:4px;border:2px dashed transparent;border-radius:10px;transition:border-color .15s,background .15s">'
      + cardsHtml
      + '</div></div>';
  });

  board.innerHTML = html;
};

window._kbDragStart = function(e, rfId) {
  e.dataTransfer.setData('text/plain', rfId);
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(function() { if (e.target) e.target.style.opacity = '0.45'; }, 0);
};

window._kbDragOver = function(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  var col = e.currentTarget;
  col.style.borderColor = 'var(--teal)';
  col.style.background = 'rgba(45,212,191,.06)';
};

window._kbDragLeave = function(e) {
  var col = e.currentTarget;
  col.style.borderColor = 'transparent';
  col.style.background = '';
};

window._kbDrop = function(e, colId) {
  e.preventDefault();
  var incId = e.dataTransfer.getData('text/plain');
  if (!incId) return;
  window._kanbanState[incId] = colId;
  window.renderizarKanbanInconsistencias();
};

if (!window._kbFiltroFluxo) window._kbFiltroFluxo = '';
if (!window._kbFiltroPrio)  window._kbFiltroPrio  = '';

// ── Modal de detalhe do card kanban ──────────────────────────
var _kbAcoesMap = {
  'Não conciliado': [
    { label: 'Solicitar Conciliação Manual', icon: '🔄', desc: 'Abre processo de conciliação manual no SplitHub' },
    { label: 'Comparar com NF Original',     icon: '📄', desc: 'Exibe os dados originais da NF para comparação' },
    { label: 'Enviar para Contabilidade',    icon: '📊', desc: 'Escala para a equipe de contabilidade' }
  ],
  'Valor imposto divergente': [
    { label: 'Solicitar Retificação de NF',  icon: '✏️', desc: 'Inicia processo de nota retificadora' },
    { label: 'Recalcular IBS/CBS',           icon: '🧮', desc: 'Aplica as alíquotas vigentes e gera diferença' },
    { label: 'Enviar para Contabilidade',    icon: '📊', desc: 'Escala para a equipe de contabilidade' }
  ],
  'Vencido': [
    { label: 'Gerar DARF com Multa',         icon: '💸', desc: 'Calcula multa e juros SELIC e gera guia' },
    { label: 'Negociar Parcelamento',        icon: '🤝', desc: 'Abre pedido de parcelamento na Receita' },
    { label: 'Consultar Situação Fiscal',    icon: '🔍', desc: 'Verifica pendências na Receita Federal' }
  ],
  'Sem Comprovante': [
    { label: 'Solicitar Comprovante',        icon: '📩', desc: 'Notifica o fornecedor por e-mail' },
    { label: 'Registrar Comprovante Manual', icon: '📎', desc: 'Faz upload de comprovante alternativo' },
    { label: 'Marcar Comprovante Dispensado',icon: '✔️', desc: 'Registra dispensa de comprovação' }
  ],
  'Falha de Layout': [
    { label: 'Reenviar Documento',           icon: '🔁', desc: 'Solicita reemissão ao emissor' },
    { label: 'Corrigir Layout Manualmente',  icon: '🛠️', desc: 'Abre editor de campos do documento' }
  ],
  'Inconsistência de Dados': [
    { label: 'Validar CNPJ / CFOP',          icon: '🔎', desc: 'Consulta Receita Federal e SINTEGRA' },
    { label: 'Solicitar Correção ao Emissor', icon: '📨', desc: 'Notifica o emissor da NF' },
    { label: 'Enviar para Contabilidade',    icon: '📊', desc: 'Escala para a equipe de contabilidade' }
  ],
  'Rejeitado SEFAZ': [
    { label: 'Reenviar à SEFAZ',             icon: '🔁', desc: 'Tenta nova autorização eletrônica' },
    { label: 'Consultar Motivo de Rejeição', icon: '🔍', desc: 'Exibe código e descrição do erro SEFAZ' },
    { label: 'Emitir NF Substituta',         icon: '📄', desc: 'Abre emissão de NF corretiva' }
  ],
  'Documento Duplicado': [
    { label: 'Cancelar Duplicata',           icon: '🗑️', desc: 'Remove o registro duplicado' },
    { label: 'Mesclar Registros',            icon: '🔗', desc: 'Une os dois RFs em um único registro' },
    { label: 'Marcar como Aceito',           icon: '✔️', desc: 'Aceita a duplicidade como intencional' }
  ]
};

var _incDescricaoMap = {
  // CAPUR
  capur_ibs_divergente: 'O valor de IBS declarado no Documento Fiscal diverge do valor calculado pela Apuração Assistida da Plataforma Centralizada do CG-IBS. A diferença pode indicar alíquota incorreta, base de cálculo divergente ou retificação de NF pendente.',
  capur_cbs_divergente: 'O valor de CBS declarado no Documento Fiscal diverge do valor calculado pela Apuração Assistida da RFB. A diferença pode indicar alíquota incorreta, base de cálculo divergente ou retificação de NF pendente.',
  capur_ibs_aliquota:   'A alíquota de IBS aplicada na operação não corresponde à alíquota regulamentar vigente definida pelo Comitê Gestor do IBS para este tipo de operação e período. O recalculo é necessário para eliminar sub ou super recolhimento.',
  capur_cbs_aliquota:   'A alíquota de CBS aplicada na operação não corresponde à alíquota regulamentar vigente definida pela RFB para este tipo de operação e período. O recalculo é necessário para eliminar sub ou super recolhimento.',
  prazo_expirado:       'O prazo regulamentar para apuração e extinção do crédito IBS/CBS está vencido ou próximo do vencimento. Ação urgente necessária para evitar a prescrição e eventual autuação fiscal.',
  // CFIN
  cfin_ibs_split:       'O split payment de IBS esperado para esta operação não foi confirmado pela instituição financeira. Nenhum comprovante de recolhimento IBS foi recebido ou processado pela Plataforma Centralizada.',
  cfin_cbs_split:       'O split payment de CBS esperado para esta operação não foi confirmado pela instituição financeira. Nenhum comprovante de recolhimento CBS foi recebido ou processado pela Plataforma Centralizada.',
  cfin_ibs_valor:       'O valor do split payment de IBS confirmado pela instituição financeira diverge do valor de IBS apurado pela Plataforma Centralizada. A diferença pode indicar erro no comprovante ou falha na liquidação.',
  cfin_cbs_valor:       'O valor do split payment de CBS confirmado pela instituição financeira diverge do valor de CBS apurado pela Plataforma Centralizada. A diferença pode indicar erro no comprovante ou falha na liquidação.',
  // Ingestão
  chave_invalida:       'A chave de acesso do documento fiscal é inválida ou não consta na base de dados da SEFAZ. O documento pode ter sido emitido com erro de digitação ou se tratar de documento inidôneo.',
  cnpj_divergente:      'O CNPJ do emitente registrado no Registro Fiscal diverge do constante no Documento Fiscal. Pode indicar cessão indevida de crédito tributário ou erro de cadastro no sistema.',
  duplicidade_rf:       'Foi identificado mais de um Registro Fiscal para o mesmo Documento Fiscal e tipo de imposto. A duplicidade pode causar duplo recolhimento ou aproveitamento indevido de crédito de IBS/CBS.'
};

window._incComentarios = window._incComentarios || {};

function _incRenderComentarios(incId) {
  var comments = window._incComentarios[incId] || [];
  if (!comments.length) {
    return '<div style="font-size:11px;color:var(--txt3);padding:4px 0 10px">Nenhum comentário ainda.</div>';
  }
  return comments.map(function(c) {
    return '<div style="background:var(--inp);border:1px solid var(--brd);border-radius:7px;padding:9px 12px;margin-bottom:8px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">'
      + '<span style="font-size:11px;font-weight:700;color:var(--txt1)">'+c.usuario+'</span>'
      + '<span style="font-size:10px;color:var(--txt3);font-family:monospace">'+c.dataFmt+'</span>'
      + '</div>'
      + '<div style="font-size:12px;color:var(--txt2);line-height:1.5">'+c.texto+'</div>'
      + '</div>';
  }).join('');
}

window._incRenderVinculadasHtml = function(incs) {
  if (!incs || !incs.length) {
    return '<div style="font-size:11px;color:var(--txt3);font-style:italic;margin-bottom:4px">Nenhuma inconsistência vinculada.</div>';
  }
  var stRgbs = { aberta:_hexRgb(PALETTE.red), em_analise:_hexRgb(PALETTE.amber), aguardando_emitente:_hexRgb(PALETTE.blue), resolvida:_hexRgb(PALETTE.teal), glosada:_hexRgb(PALETTE.gray) };
  var stLabs = { aberta:'Aberta', em_analise:'Em Análise', aguardando_emitente:'Ag. Emitente', resolvida:'Resolvida', glosada:'Glosada' };
  var prioRGBs = { critica:_hexRgb(PALETTE.red), alta:_hexRgb(PALETTE.amber), media:_hexRgb(PALETTE.blue), baixa:_hexRgb(PALETTE.gray) };
  var prioLbls = { critica:'Crítica', alta:'Alta', media:'Média', baixa:'Baixa' };
  var fv = function(v) { return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  return incs.map(function(inc) {
    var st     = (window._kanbanState && window._kanbanState[inc.id]) || inc.status || 'aberta';
    var rgb    = stRgbs[st]  || '167,168,170';
    var lbl    = stLabs[st]  || st;
    var prioRgb = prioRGBs[inc.prioridade] || '100,116,139';
    var prioLbl = prioLbls[inc.prioridade] || '—';
    return '<div onclick="var _o=document.getElementById(\'nf-detalhe-overlay\');if(_o)_o.remove();var _r=document.getElementById(\'rf-detalhe-overlay\');if(_r)_r.remove();window.kbAbrirCard(\''+inc.id+'\')" style="cursor:pointer;background:rgba(244,63,94,.04);border:1px solid rgba('+rgb+',.3);border-radius:6px;padding:9px 12px;margin-bottom:7px;transition:border-color .15s" onmouseenter="this.style.borderColor=\'rgba(244,63,94,.6)\'" onmouseleave="this.style.borderColor=\'rgba('+rgb+',.3)\'">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">'
      + '<span style="font-size:10px;font-family:monospace;color:var(--txt3)">'+inc.id+'</span>'
      + '<span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:3px;background:rgba('+rgb+',.12);color:rgba('+rgb+',1);border:1px solid rgba('+rgb+',.28)">'+lbl+'</span>'
      + '</div>'
      + '<div style="font-size:12px;font-weight:600;color:var(--txt1);margin-bottom:2px">'+inc.tipoLabel+'</div>'
      + '<div style="font-size:11px;color:var(--txt3)"><span style="color:rgba('+prioRgb+',1);font-weight:600">'+prioLbl+'</span> · '+fv(inc.valor)+'</div>'
      + '</div>';
  }).join('');
};

window._incAdicionarComentario = function(incId) {
  var input = document.getElementById('inc-comment-input-'+incId);
  var texto = input && input.value.trim();
  if (!texto) return;
  if (!window._incComentarios[incId]) window._incComentarios[incId] = [];
  var now = new Date();
  var pad = function(n) { return n < 10 ? '0'+n : ''+n; };
  var dataFmt = pad(now.getDate())+'/'+pad(now.getMonth()+1)+'/'+now.getFullYear()
    + ' ' + pad(now.getHours())+':'+pad(now.getMinutes());
  window._incComentarios[incId].push({ texto: texto, usuario: 'Usuário atual', dataFmt: dataFmt });
  input.value = '';
  var listEl = document.getElementById('inc-comments-list-'+incId);
  if (listEl) listEl.innerHTML = _incRenderComentarios(incId);
};

var _incAcoesMap = {
  // CAPUR — valor por imposto
  capur_ibs_divergente: [
    { label: 'Recalcular IBS',              icon: '🔢', desc: 'Aplica alíquota IBS vigente e confronta com Apuração Assistida', nextStatus: 'em_analise' },
    { label: 'Solicitar Retificação de NF', icon: '📝', desc: 'Notifica o emitente para corrigir o valor IBS na NF',           nextStatus: 'aguardando_emitente' },
    { label: 'Enviar para Contabilidade',   icon: '📊', desc: 'Escala para revisão pela equipe contábil',                       nextStatus: 'em_analise' }
  ],
  capur_cbs_divergente: [
    { label: 'Recalcular CBS',              icon: '🔢', desc: 'Aplica alíquota CBS vigente e confronta com Apuração Assistida', nextStatus: 'em_analise' },
    { label: 'Solicitar Retificação de NF', icon: '📝', desc: 'Notifica o emitente para corrigir o valor CBS na NF',           nextStatus: 'aguardando_emitente' },
    { label: 'Enviar para Contabilidade',   icon: '📊', desc: 'Escala para revisão pela equipe contábil',                       nextStatus: 'em_analise' }
  ],
  // CAPUR — alíquota por imposto
  capur_ibs_aliquota: [
    { label: 'Recalcular Alíquota IBS',     icon: '🔢', desc: 'Aplica alíquota IBS regulamentar vigente para a operação',      nextStatus: 'em_analise' },
    { label: 'Solicitar Retificação',       icon: '📝', desc: 'Notifica o emitente para corrigir a alíquota IBS aplicada',     nextStatus: 'aguardando_emitente' }
  ],
  capur_cbs_aliquota: [
    { label: 'Recalcular Alíquota CBS',     icon: '🔢', desc: 'Aplica alíquota CBS regulamentar vigente para a operação',      nextStatus: 'em_analise' },
    { label: 'Solicitar Retificação',       icon: '📝', desc: 'Notifica o emitente para corrigir a alíquota CBS aplicada',     nextStatus: 'aguardando_emitente' }
  ],
  // Prazo
  prazo_expirado: [
    { label: 'Gerar DARF com Multa',        icon: '💰', desc: 'Calcula multa e juros e gera DARF para pagamento',              nextStatus: 'em_analise' },
    { label: 'Negociar Parcelamento',       icon: '📅', desc: 'Abre processo de parcelamento do débito',                        nextStatus: 'aguardando_emitente' }
  ],
  // CFIN — split por imposto
  cfin_ibs_split: [
    { label: 'Verificar Split IBS no Banco',icon: '🏦', desc: 'Consulta extrato do split IBS na instituição financeira',       nextStatus: 'em_analise' },
    { label: 'Solicitar Comprovante IBS',   icon: '📩', desc: 'Notifica a IF para envio do comprovante de recolhimento IBS',   nextStatus: 'aguardando_emitente' }
  ],
  cfin_cbs_split: [
    { label: 'Verificar Split CBS no Banco',icon: '🏦', desc: 'Consulta extrato do split CBS na instituição financeira',       nextStatus: 'em_analise' },
    { label: 'Solicitar Comprovante CBS',   icon: '📩', desc: 'Notifica a IF para envio do comprovante de recolhimento CBS',   nextStatus: 'aguardando_emitente' }
  ],
  // CFIN — valor divergente por imposto
  cfin_ibs_valor: [
    { label: 'Conferir Comprovante IBS',    icon: '🔍', desc: 'Confronta valor recolhido IBS com o apurado pela Plataforma',   nextStatus: 'em_analise' },
    { label: 'Solicitar Estorno IBS',       icon: '↩️', desc: 'Solicita à IF estorno e reemissão do comprovante IBS correto',  nextStatus: 'aguardando_emitente' }
  ],
  cfin_cbs_valor: [
    { label: 'Conferir Comprovante CBS',    icon: '🔍', desc: 'Confronta valor recolhido CBS com o apurado pela Plataforma',   nextStatus: 'em_analise' },
    { label: 'Solicitar Estorno CBS',       icon: '↩️', desc: 'Solicita à IF estorno e reemissão do comprovante CBS correto',  nextStatus: 'aguardando_emitente' }
  ],
  // Ingestão
  chave_invalida: [
    { label: 'Solicitar Reemissão',         icon: '📝', desc: 'Notifica o emitente para reemitir o documento fiscal',          nextStatus: 'aguardando_emitente' },
    { label: 'Consultar Chave na SEFAZ',    icon: '🔍', desc: 'Verifica validade da chave de acesso na SEFAZ',                 nextStatus: 'em_analise' }
  ],
  cnpj_divergente: [
    { label: 'Validar CNPJ na Receita',     icon: '🔎', desc: 'Consulta situação do CNPJ na Receita Federal',                  nextStatus: 'em_analise' },
    { label: 'Solicitar Correção',          icon: '📨', desc: 'Notifica o emitente para corrigir o CNPJ',                      nextStatus: 'aguardando_emitente' },
    { label: 'Enviar para Contabilidade',   icon: '📊', desc: 'Escala para revisão pela equipe contábil',                       nextStatus: 'em_analise' }
  ],
  duplicidade_rf: [
    { label: 'Cancelar RF Duplicado',       icon: '🗑️', desc: 'Remove o registro fiscal duplicado',                            nextStatus: 'resolvida' },
    { label: 'Mesclar Registros',           icon: '🔗', desc: 'Une os dois RFs em um único registro',                           nextStatus: 'em_analise' },
    { label: 'Marcar como Aceito',          icon: '✔️', desc: 'Aceita a duplicidade como intencional',                         nextStatus: 'resolvida' }
  ]
};

window.kbAbrirCard = function(incId) {
  var inc = (window._inconsistenciasGlobal || []).find(function(i) { return i.id === incId; });
  if (!inc) return;

  var modal = document.getElementById('kb-card-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'kb-card-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.72);z-index:1200;display:flex;align-items:center;justify-content:center;padding:16px';
    modal.onclick = function(e) { if (e.target === modal) modal.style.display = 'none'; };
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';

  var fmtV = function(v) {
    return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  var fmtD = function(d) {
    if (!d) return '—';
    var p = d.split('-'); return p.length === 3 ? p[2]+'/'+p[1]+'/'+p[0] : d;
  };
  var A = window._rfAddDays, F = window._rfFmtTS, MK = window._rfMkTS;

  var stCols = [
    { id:'aberta',              label:'Aberta',       rgb:'165,72,83'   },
    { id:'em_analise',          label:'Em Análise',   rgb:'170,122,50'  },
    { id:'aguardando_emitente', label:'Ag. Emitente', rgb:'62,108,176'  },
    { id:'resolvida',           label:'Resolvida',    rgb:'52,168,153'  },
    { id:'glosada',             label:'Glosada',      rgb:'105,112,122' }
  ];

  var statusAtual = window._kanbanState[incId] || inc.status || 'aberta';
  var stInfo = stCols.find(function(c) { return c.id === statusAtual; }) || stCols[0];

  function _badge2(rgb, lbl) {
    return '<span style="font-size:10px;font-weight:700;letter-spacing:.05em;padding:2px 8px;border-radius:3px;background:rgba('+rgb+',.12);color:rgba('+rgb+',1);border:1px solid rgba('+rgb+',.28)">'+lbl+'</span>';
  }
  function _item2(label, value, rgb, mono) {
    return '<div><div style="font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">'+label+'</div>'
      + '<div style="font-weight:600;font-size:13px;color:'+(rgb?'rgba('+rgb+',1)':'var(--txt1)')+(mono?';font-family:monospace':'')+'">'+(value||'—')+'</div></div>';
  }

  var prioRGB   = { critica:'165,72,83', alta:'170,122,50', media:'62,108,176', baixa:'105,112,122' };
  var prioLabel = { critica:'Crítica',   alta:'Alta',        media:'Média',      baixa:'Baixa' };
  var prioRgb   = prioRGB[inc.prioridade]  || '100,116,139';
  var tipoFisCor = inc.tipoFiscal === 'IBS' ? '24,95,165' : '45,212,191';
  var fluxoCor   = inc.tipoFluxo  === 'entrada' ? '29,158,117' : '186,117,23';
  var fluxoLabel = inc.tipoFluxo  === 'entrada' ? '↓ Entrada' : '↑ Saída';
  var origemRGB  = inc.origem === 'df' ? '24,95,165' : '45,212,191';
  var origemLabel= inc.origem === 'df' ? 'DF direto' : 'Via RF';

  var colOpts = stCols.map(function(c) {
    return '<option value="'+c.id+'"'+(c.id===statusAtual?' selected':'')+'>'+c.label+'</option>';
  }).join('');

  // ── Timeline no padrão do histórico de DF/RF ─────────────────────────────
  var d0 = inc.dataISO || '';
  function mkEv(ts, tipo, modulo, ator, desc, cls) {
    return { ts: ts, data: (ts === '—' ? '—' : F(ts)), tipo: tipo, modulo: modulo, ator: ator, desc: desc, cls: cls };
  }
  var incEvRgba  = { 'ABERTURA':'165,72,83', 'VALIDAÇÃO':'52,168,153', 'ATRIBUIÇÃO':'170,122,50', 'NOTIFICAÇÃO':'62,108,176', 'RESOLUÇÃO':'52,168,153', 'GLOSA':'105,112,122' };
  var incEvIcons = { 'ABERTURA':'!', 'VALIDAÇÃO':'✓', 'ATRIBUIÇÃO':'→', 'NOTIFICAÇÃO':'✉', 'RESOLUÇÃO':'✓', 'GLOSA':'✕' };

  var eventos = [];
  eventos.push(mkEv(MK(d0,'08:47'), 'ABERTURA', 'Inconsistências', 'SplitHub',
    inc.id + ' aberta · ' + inc.tipoLabel + ' vinculada ao ' + inc.dfNum
    + (inc.rfId ? ' · RF ' + inc.rfId : ' · DF direto')
    + ' · ' + (inc.tipoFiscal || '').toUpperCase(), 'erro'));

  eventos.push(mkEv(MK(d0,'08:49'), 'VALIDAÇÃO', 'Inconsistências', 'SplitHub',
    'Dados validados · fluxo '+(inc.tipoFluxo||'—')+' · origem '+(inc.origem === 'df' ? 'DF direto' : 'via RF')
    + ' · prioridade '+(inc.prioridade||'—'), 'ok'));

  if (statusAtual !== 'aberta') {
    eventos.push(mkEv(MK(A(d0,1),'09:15'), 'ATRIBUIÇÃO', 'Inconsistências', 'SplitHub',
      'Responsável atribuído · análise iniciada · inconsistência em avaliação', 'pending'));
  }
  if (statusAtual === 'aguardando_emitente' || statusAtual === 'resolvida' || statusAtual === 'glosada') {
    eventos.push(mkEv(MK(A(d0,2),'10:30'), 'NOTIFICAÇÃO', 'Inconsistências', 'SplitHub',
      'Emitente '+inc.entidade+' notificado · aguardando retificação ou confirmação', 'pending'));
  }
  if (statusAtual === 'resolvida') {
    eventos.push(mkEv(MK(A(d0,4),'14:22'), 'RESOLUÇÃO', 'Inconsistências', 'SplitHub',
      'Inconsistência resolvida · dados corrigidos · RF reprocessado com sucesso · crédito '+(inc.tipoFiscal||'').toUpperCase()+' preservado', 'ok'));
  }
  if (statusAtual === 'glosada') {
    eventos.push(mkEv(MK(A(d0,5),'16:58'), 'GLOSA', 'Créditos', 'Fisco',
      'Prazo de regularização expirado · crédito glosado · '+(inc.rfId ? 'RF '+inc.rfId : 'DF '+inc.dfNum)+' inelegível', 'erro'));
  }

  // Ordenar decrescente (mais recente primeiro)
  eventos.sort(function(a, b) {
    var ta = a.ts || '—', tb = b.ts || '—';
    if (ta === '—' && tb === '—') return 0;
    if (ta === '—') return 1;
    if (tb === '—') return -1;
    return ta > tb ? -1 : ta < tb ? 1 : 0;
  });

  var timelineHtml = '';
  eventos.forEach(function(ev, i) {
    var rgba    = incEvRgba[ev.tipo]  || '167,168,170';
    var dotRgba = ev.cls === 'erro' ? '163,45,45' : ev.cls === 'pending' ? '186,117,23' : rgba;
    var icon    = incEvIcons[ev.tipo] || '◯';
    var isLast  = i === eventos.length - 1;
    timelineHtml += '<div style="display:flex;gap:12px">'
      + '<div style="display:flex;flex-direction:column;align-items:center;width:28px;flex-shrink:0">'
      + '<div style="width:28px;height:28px;border-radius:50%;background:rgba('+dotRgba+',.15);border:1.5px solid rgba('+dotRgba+',.6);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:rgba('+dotRgba+',1)">'+icon+'</div>'
      + (!isLast ? '<div style="width:1px;flex:1;background:rgba(128,128,128,.2);margin:3px 0;min-height:20px"></div>' : '')
      + '</div>'
      + '<div style="flex:1;padding-bottom:'+(isLast?'0':'22')+'px">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">'
      + '<span style="background:rgba('+rgba+',.12);color:rgba('+rgba+',1);border:1px solid rgba('+rgba+',.3);border-radius:3px;padding:1px 7px;font-size:9px;font-weight:700;letter-spacing:.07em">'+ev.tipo+'</span>'
      + '<span style="font-size:10px;color:var(--txt3);font-family:monospace">'+ev.data+'</span>'
      + '</div>'
      + '<div style="font-size:12px;color:var(--txt1);line-height:1.55;margin-bottom:3px">'+ev.desc+'</div>'
      + '<div style="font-size:10px;color:var(--txt2)">'+ev.modulo+' · '+ev.ator+'</div>'
      + '</div>'
      + '</div>';
  });

  var DR = window._rfDetailRow;
  var descricao = _incDescricaoMap[inc.tipo] || 'Inconsistência identificada pelo motor de validação SplitHub. Verifique os dados vinculados ao Documento Fiscal e tome as ações necessárias.';

  var acoes = _incAcoesMap[inc.tipo] || [
    { label: 'Enviar para Contabilidade', icon: '📊', desc: 'Escala para revisão pela equipe contábil',  nextStatus: 'em_analise' },
    { label: 'Marcar como Resolvida',     icon: '✅', desc: 'Move inconsistência para coluna Resolvida', nextStatus: 'resolvida' }
  ];
  var acoesHtml = acoes.map(function(a, i) {
    return '<button onclick="window._kbExecutarAcao(\''+incId+'\','+i+')" style="display:flex;align-items:flex-start;gap:9px;width:100%;background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:9px 12px;cursor:pointer;text-align:left;font-family:inherit;transition:border-color .15s" onmouseenter="this.style.borderColor=\'var(--teal)\'" onmouseleave="this.style.borderColor=\'var(--brd)\'">'
      + '<span style="font-size:16px;flex-shrink:0;margin-top:1px">'+a.icon+'</span>'
      + '<div><div style="font-size:12px;font-weight:600;color:var(--txt1);margin-bottom:1px">'+a.label+'</div>'
      + '<div style="font-size:11px;color:var(--txt3)">'+a.desc+'</div></div>'
      + '</button>';
  }).join('');

  modal.innerHTML = '<div style="background:var(--card);border:1px solid var(--brd);border-radius:12px;width:100%;max-width:920px;max-height:90vh;display:flex;flex-direction:column">'

    // ── Header ──────────────────────────────────────────────────────────────
    + '<div style="padding:16px 20px;border-bottom:1px solid var(--brd);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">'
    +   '<div style="display:flex;align-items:center;gap:12px">'
    +     '<div style="width:34px;height:34px;border-radius:8px;background:rgba(244,63,94,.12);border:1px solid rgba(244,63,94,.25);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:rgba(244,63,94,1)">⚠</div>'
    +     '<div>'
    +       '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;flex-wrap:wrap">'
    +         '<span style="font-size:10px;font-family:monospace;color:var(--txt3)">'+inc.id+'</span>'
    +         _badge2(prioRgb, (prioLabel[inc.prioridade]||'—').toUpperCase())
    +         _badge2(stInfo.rgb, stInfo.label.toUpperCase())
    +       '</div>'
    +       '<div style="font-size:14px;font-weight:700;color:var(--txt1)">'+inc.tipoLabel+'</div>'
    +       '<div style="font-size:11px;color:var(--txt2)">'+inc.entidade+' · <span style="font-family:monospace">'+inc.cnpj+'</span></div>'
    +     '</div>'
    +   '</div>'
    +   '<button onclick="document.getElementById(\'kb-card-modal\').style.display=\'none\'" style="background:none;border:none;cursor:pointer;color:var(--txt2);font-size:20px;padding:4px 8px;border-radius:6px;line-height:1">✕</button>'
    + '</div>'

    // ── Body: dois painéis ───────────────────────────────────────────────────
    + '<div style="display:flex;flex:1;overflow:hidden">'

    // ── Painel esquerdo ──────────────────────────────────────────────────────
    + '<div style="width:320px;flex-shrink:0;border-right:1px solid var(--brd);padding:18px;overflow-y:auto">'

    + '<div style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.07em;margin-bottom:14px">Dados da Inconsistência</div>'
    + DR('DF Vinculado',   '<span style="display:flex;align-items:center;gap:8px"><span style="font-family:monospace;color:rgba(24,95,165,1)">'+inc.dfNum+'</span>'+(inc.nfNumero?'<button onclick="document.getElementById(\'kb-card-modal\').style.display=\'none\';if(window.abrirDetalhesNFporNumero)window.abrirDetalhesNFporNumero(\''+inc.nfNumero+'\')" style="background:rgba(24,95,165,.1);border:1px solid rgba(24,95,165,.3);border-radius:4px;color:rgba(24,95,165,1);cursor:pointer;font-size:10px;font-weight:700;padding:2px 8px">Ver DF</button>':'')+'</span>')
    + DR('RF Vinculado',   inc.rfId ? '<span style="display:flex;align-items:center;gap:8px"><span style="font-family:monospace;color:rgba(45,212,191,1)">'+inc.rfId+'</span><button onclick="document.getElementById(\'kb-card-modal\').style.display=\'none\';if(window.abrirDetalheRF)window.abrirDetalheRF(\''+inc.rfId+'\')" style="background:rgba(45,212,191,.1);border:1px solid rgba(45,212,191,.3);border-radius:4px;color:rgba(26,107,90,1);cursor:pointer;font-size:10px;font-weight:700;padding:2px 8px">Ver RF</button></span>' : '<span style="color:var(--txt3);font-style:italic">DF direto</span>')
    + DR('Valor',          fmtV(inc.valor), '#ba7517')
    + DR('Fluxo',          fluxoLabel)
    + DR('Tipo Fiscal',    '<span style="color:rgba('+tipoFisCor+',1);font-weight:700">'+inc.tipoFiscal+'</span>')
    + DR('Origem',         origemLabel)
    + DR('Data Detecção',  fmtD(inc.dataISO))

    + '<div style="height:1px;background:var(--brd);margin:14px 0"></div>'
    + '<div style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Descrição do Problema</div>'
    + '<div style="font-size:12px;color:var(--txt2);line-height:1.65;background:rgba(244,63,94,.04);border:1px solid rgba(244,63,94,.15);border-radius:8px;padding:12px 14px">'+descricao+'</div>'

    + '<div style="height:1px;background:var(--brd);margin:14px 0"></div>'
    + '<div style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Status / Mover coluna</div>'
    + '<select id="kb-col-select" onchange="window._kbMoverColuna(\''+incId+'\',this.value)" style="width:100%;background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:8px 12px;font-size:13px;color:var(--txt1);font-family:inherit;outline:none;cursor:pointer">'
    +   colOpts
    + '</select>'

    + (function() {
        var respAtual = window._kanbanResponsavel[incId] || 'nenhum';
        var respUser  = _kbUsuarios.find(function(u) { return u.id === respAtual; }) || _kbUsuarios[0];
        var respOpts  = _kbUsuarios.map(function(u) {
          return '<option value="'+u.id+'"'+(u.id===respAtual?' selected':'')+'>'+u.nome+'</option>';
        }).join('');
        return '<div style="height:1px;background:var(--brd);margin:14px 0"></div>'
          + '<div style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Responsável</div>'
          + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'
          +   '<div id="kb-resp-avatar-'+incId+'" title="'+respUser.nome+'" style="width:28px;height:28px;border-radius:50%;background:'+respUser.cor+';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0">'+respUser.iniciais+'</div>'
          +   '<span id="kb-resp-label-'+incId+'" style="font-size:13px;color:var(--txt1);font-weight:500">'+respUser.nome+'</span>'
          + '</div>'
          + '<select onchange="window._kbMudarResponsavel(\''+incId+'\',this.value)" style="width:100%;background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:8px 12px;font-size:13px;color:var(--txt1);font-family:inherit;outline:none;cursor:pointer">'
          +   respOpts
          + '</select>';
      })()

    + '<div style="height:1px;background:var(--brd);margin:14px 0"></div>'
    + '<div style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px">Ações sugeridas</div>'
    + '<div style="display:flex;flex-direction:column;gap:7px">'+acoesHtml+'</div>'

    + '<div style="height:1px;background:var(--brd);margin:14px 0"></div>'
    + '<div style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px">Comentários</div>'
    + '<div id="inc-comments-list-'+incId+'">'+_incRenderComentarios(incId)+'</div>'
    + '<div style="margin-top:4px">'
    +   '<textarea id="inc-comment-input-'+incId+'" placeholder="Adicionar comentário..." style="width:100%;background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:9px 12px;font-size:12px;color:var(--txt1);font-family:inherit;resize:vertical;min-height:64px;outline:none;box-sizing:border-box"></textarea>'
    +   '<button onclick="window._incAdicionarComentario(\''+incId+'\')" style="margin-top:6px;width:100%;background:rgba(45,212,191,1);border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;color:#fff;cursor:pointer;font-family:inherit">Comentar</button>'
    + '</div>'

    + '</div>'

    // ── Painel direito: histórico ────────────────────────────────────────────
    + '<div style="flex:1;padding:18px;overflow-y:auto">'
    +   (function() {
            var totalEv = eventos.length + (window._kbHistoricoAtribuicao[incId] || []).length;
            return '<div id="kb-timeline-count-'+incId+'" data-count="'+totalEv+'" style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.07em;margin-bottom:16px">Histórico do Ciclo · '+totalEv+' evento'+(totalEv !== 1 ? 's' : '')+'</div>';
          })()
    +   '<div id="kb-timeline-'+incId+'">'
    +     (function() {
            var hist = window._kbHistoricoAtribuicao[incId] || [];
            var histHtml = hist.map(function(h) {
              return '<div style="display:flex;gap:12px;margin-bottom:16px">'
                + '<div style="display:flex;flex-direction:column;align-items:center;width:28px;flex-shrink:0">'
                + '<div style="width:28px;height:28px;border-radius:50%;background:rgba(170,122,50,.15);border:1.5px solid rgba(170,122,50,.6);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:rgba(170,122,50,1)">→</div>'
                + '</div>'
                + '<div style="flex:1">'
                + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">'
                + '<span style="background:rgba(170,122,50,.12);color:rgba(170,122,50,1);border:1px solid rgba(170,122,50,.3);border-radius:3px;padding:1px 7px;font-size:9px;font-weight:700;letter-spacing:.07em">ATRIBUIÇÃO</span>'
                + '<span style="font-size:10px;color:var(--txt3);font-family:monospace">'+h.dataFmt+'</span>'
                + '</div>'
                + '<div style="font-size:12px;color:var(--txt1);line-height:1.55;margin-bottom:3px">'
                + (h.userId === 'nenhum'
                    ? 'Responsável removido · antes: '+h.nomeAnterior
                    : 'Atribuído para <strong>'+h.nomeNovo+'</strong> · antes: '+h.nomeAnterior)
                + '</div>'
                + '<div style="font-size:10px;color:var(--txt2)">Inconsistências · Usuário atual</div>'
                + '</div></div>';
            }).join('');
            return histHtml + timelineHtml;
          })()
    +   '</div>'
    + '</div>'

    + '</div>'
    + '</div>';

  modal.style.display = 'flex';
  modal._acoes = acoes;
  modal._incId = incId;
};

function _kbDetalheItem(label, value, cor, bold) {
  return '<div>'
    + '<div style="font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">'+label+'</div>'
    + '<div style="color:'+(cor||'var(--txt1)')+';font-weight:'+(bold?'700':'500')+';font-size:13px">'+value+'</div>'
    + '</div>';
}

window._kbMoverColuna = function(incId, colId) {
  window._kanbanState[incId] = colId;
  window.renderizarKanbanInconsistencias();
};

window._kbExecutarAcao = function(incId, aIdx) {
  var modal = document.getElementById('kb-card-modal');
  var acoes = modal && modal._acoes;
  var acao  = acoes && acoes[aIdx];
  if (!acao) return;

  window._kanbanState[incId] = acao.nextStatus || 'em_analise';

  var btn = document.querySelectorAll('#kb-card-modal button')[aIdx + 1];
  if (btn) {
    btn.innerHTML = '<span style="color:var(--teal);font-weight:700;font-size:13px">✓ Ação registrada — card movido</span>';
    btn.disabled = true;
    setTimeout(function() {
      modal.style.display = 'none';
      window.renderizarKanbanInconsistencias();
    }, 1000);
  } else {
    modal.style.display = 'none';
    window.renderizarKanbanInconsistencias();
  }
};
// ─────────────────────────────────────────────────────────────

// ============================================================
// MÓDULO GESTÃO DE DÉBITOS — NFs de saída · IBS + CBS
// ============================================================

window._enriquecerNFsSaida = function() {
  // Alíquotas definidas por imposto
  var ALIQ_CBS = 0.08; // 8%
  var ALIQ_IBS = 0.10; // 10%

  var meses = ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06',
               '2026-07','2026-08','2026-09','2026-10','2026-11','2026-12'];
  var diasNoMes = [31,28,31,30,31,30,31,31,30,31,30,31];
  var statusDist = [
    'extinto','extinto','extinto','extinto','extinto',
    'nao_extinto','nao_extinto','nao_extinto',
    'vencido','vencido',
    'inconsistencia','inconsistencia'
  ];
  var metodos = ['RAD','RAD','Compensacao'];

  // Pré-calcular valores escalados: sum(débitos saída) = sum(créditos entrada) × 1.15
  var _totalCred = 0;
  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'entrada') return;
    (nf.registrosFiscais || []).forEach(function(rf) { _totalCred += (rf.valor || 0); });
  });
  if (!_totalCred) _totalCred = 76271081;
  var _targetLiq = Math.round(_totalCred * 1.15 / (ALIQ_CBS + ALIQ_IBS));
  // LCG seed determinístico (evita overflow do XOR anterior)
  var _vliqBase = [], _lcg = 1013904223;
  for (var _j = 0; _j < 100; _j++) {
    _lcg = (_lcg * 1664525 + 1013904223) >>> 0;
    _vliqBase.push(500000 + (_lcg % 800001));
  }
  var _sumBase = _vliqBase.reduce(function(s, v) { return s + v; }, 0);
  var _scale   = _targetLiq / _sumBase;

  var idx = 0;
  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'saida') return;

    // Valores determinísticos sincronizados com as alíquotas
    var vliq  = Math.round(_vliqBase[idx % 100] * _scale);
    var cbs   = Math.floor(vliq * ALIQ_CBS);
    var ibs   = Math.floor(vliq * ALIQ_IBS);
    var vbrut = vliq + cbs + ibs;

    // Distribuição de datas pelos 12 meses de 2026
    var mesIdx  = (idx * 7 + 3) % 12;
    var mes     = meses[mesIdx];
    var maxDia  = diasNoMes[mesIdx];
    var dia     = 1 + ((idx * 11 + 7) % maxDia);
    var dayStr  = dia < 10 ? '0' + dia : '' + dia;
    var dataISO = mes + '-' + dayStr;
    var stRF    = statusDist[idx % statusDist.length];

    // Atualizar NF com valores sincronizados
    nf.data         = dataISO;
    nf.status       = (stRF === 'extinto') ? 'extinto' : 'nao_extinto';
    nf.valorLiquido = vliq;
    nf.cbs          = cbs;
    nf.ibs          = ibs;
    nf.valorTotal   = vbrut;

    var _saidaIncTiposIBS = ['Valor IBS divergente','Alíquota IBS incorreta','Prazo de apuração expirado','Split IBS não executado','Comprovante IBS divergente'];
    var _saidaIncTiposCBS = ['Valor CBS divergente','Alíquota CBS incorreta','Prazo de apuração expirado','Split CBS não executado','Comprovante CBS divergente'];
    (nf.registrosFiscais || []).forEach(function(rf, ri) {
      rf.data           = dataISO;
      rf.status         = stRF;
      var _tiposRF = rf.tipoFiscal === 'ibs' ? _saidaIncTiposIBS : _saidaIncTiposCBS;
      rf.inconsistencia = stRF === 'inconsistencia' ? _tiposRF[(idx) % _tiposRF.length] : null;
      rf.metodoExtincao = metodos[(idx + ri) % metodos.length];
      // Sincronizar valor do RF com alíquota do imposto correspondente
      rf.valor          = rf.tipoFiscal === 'cbs' ? cbs : ibs;
      rf.valorTotalNF   = vbrut;
      rf.valorLiquidoNF = vliq;
      rf.tipoNF         = 'saida';
      if (stRF === 'extinto') {
        var extDay    = Math.min(dia + 5, maxDia);
        var extDayStr = extDay < 10 ? '0' + extDay : '' + extDay;
        var mp = mes.split('-');
        rf.dataExtincao = extDayStr + '/' + mp[1] + '/' + mp[0] + ' 09:00';
      } else {
        rf.dataExtincao = '—';
      }
    });
    idx++;
  });
};

window._filtrosDebitos = {
  mesAno: '', mesAnoArr: [], busca: '', tipoFiscal: '', status: '',
  metodo: '', extincao: '', dataNFDe: '', dataNFAte: '',
  debMin: '', debMax: '', tipoDFe: '', statusRegistro: ''
};

window.injetarFiltrosDebitos = function() {
  var tcrd = document.querySelector('#deb-rfs .tcrd');
  if (!tcrd) return;
  window.shBuildFilterPanel({
    wrapperId: 'filtros-debitos-avancado',
    anchor: tcrd,
    prefix: 'fd',
    searchPlaceholder: 'Pesquisar RF / NF / Cliente…',
    onFilter: 'debitosFiltrarGrid',
    onClear: 'debitosLimparFiltrosGrid',
    countId: 'fd-contagem',
    fields: [
      { label: 'Tipo Fiscal',       id: 'fd-tipo',     type: 'select', options: [{value:'IBS',label:'IBS'},{value:'CBS',label:'CBS'}] },
      { label: 'Status',            id: 'fd-status',   type: 'select', options: [{value:'extinto',label:'Extinto'},{value:'nao_extinto',label:'Não Extinto'},{value:'vencido',label:'Vencido'},{value:'inconsistencia',label:'Inconsistência'}] },
      { label: 'Método de Extinção',id: 'fd-metodo',   type: 'select', options: [{value:'RAD',label:'RAD'},{value:'Compensacao',label:'Compensação'}] },
      { label: 'Extinção',          id: 'fd-extincao', type: 'select', options: [{value:'com',label:'Com extinção'},{value:'sem',label:'Sem extinção'}] },
      { label: 'Data NF — de',  id: 'fd-data-de',  type: 'date' },
      { label: 'Data NF — até', id: 'fd-data-ate', type: 'date' },
      { label: 'Débito — mín (R$)', id: 'fd-deb-min', type: 'number', placeholder: '0', min: 0 },
      { label: 'Débito — máx (R$)', id: 'fd-deb-max', type: 'number', placeholder: '∞', min: 0 },
      { label: 'Tipo de DFe',        id: 'fd-tipo-dfe',  type: 'select', options: [{value:'entrada',label:'Entrada'},{value:'saida',label:'Saída'}] },
      { label: 'Status do Registro', id: 'fd-status-reg', type: 'select', options: [{value:'inconsistencia',label:'Inconsistência'},{value:'em_risco',label:'Em risco'},{value:'a_prescrever',label:'A Prescrever'},{value:'vencido',label:'Vencido'}] }
    ]
  });
};

window.debitosToggleFiltros = function() { window.shToggleFilterPanel('fd'); };

window.debitosFiltrarGrid = function() {
  var f = window._filtrosDebitos;
  f.busca      = (document.getElementById('fd-busca')    || {}).value || '';
  f.tipoFiscal = (document.getElementById('fd-tipo')     || {}).value || '';
  f.status     = (document.getElementById('fd-status')   || {}).value || '';
  f.metodo     = (document.getElementById('fd-metodo')   || {}).value || '';
  f.extincao   = (document.getElementById('fd-extincao') || {}).value || '';
  f.dataNFDe   = (document.getElementById('fd-data-de') || {}).value || '';
  f.dataNFAte  = (document.getElementById('fd-data-ate')|| {}).value || '';
  f.debMin        = (document.getElementById('fd-deb-min')   || {}).value || '';
  f.debMax        = (document.getElementById('fd-deb-max')   || {}).value || '';
  f.tipoDFe       = (document.getElementById('fd-tipo-dfe')  || {}).value || '';
  f.statusRegistro= (document.getElementById('fd-status-reg')|| {}).value || '';
  window.renderizarTabelaDebitos();
};

window.debitosFiltrarMesAno = function() {
  var arr = (window._periodoSel || {}).deb || [];
  window._filtrosDebitos.mesAnoArr = arr;
  window._filtrosDebitos.mesAno = '';
  var mesLabels = {
    '2025-10':'out/2025','2025-11':'nov/2025','2025-12':'dez/2025',
    '2026-01':'jan/2026','2026-02':'fev/2026','2026-03':'mar/2026','2026-04':'abr/2026',
    '2026-05':'mai/2026','2026-06':'jun/2026','2026-07':'jul/2026','2026-08':'ago/2026',
    '2026-09':'set/2026','2026-10':'out/2026','2026-11':'nov/2026','2026-12':'dez/2026'
  };
  var label = arr.length === 1 ? (mesLabels[arr[0]] || arr[0]) : arr.length > 1 ? arr.length + ' períodos' : 'Origem fato gerador';
  var sub = document.getElementById('deb-periodo-sub');
  if (sub) sub.textContent = 'Posição IBS + CBS · Art. 153-A LC 214/2025 · ' + label;
  window.renderizarTabelaDebitos();
  try { window.renderizarComposicaoDebitos(window._composicaoDebitosFiltro || ''); } catch(e) {}
  try { window.atualizarPerdaAcumuladaDebitos(); } catch(e) {}
  try { window.renderizarExtincaoMetodo(); } catch(e) {}
};

window.debitosLimparFiltrosGrid = function() {
  ['fd-busca','fd-tipo','fd-status','fd-metodo','fd-extincao','fd-data-de','fd-data-ate','fd-deb-min','fd-deb-max','fd-tipo-dfe','fd-status-reg'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  var selMes = document.getElementById('deb-mes-ano');
  if (selMes) selMes.value = '';
  var sub = document.getElementById('deb-periodo-sub');
  if (sub) sub.textContent = 'Posição IBS + CBS · Art. 153-A LC 214/2025 · Origem fato gerador';
  window._filtrosDebitos = {
    mesAno: '', mesAnoArr: [], busca: '', tipoFiscal: '', status: '',
    metodo: '', extincao: '', dataNFDe: '', dataNFAte: '',
    debMin: '', debMax: '', tipoDFe: '', statusRegistro: ''
  };
  window._periodoSel = window._periodoSel || {}; window._periodoSel.deb = [];
  window.renderizarTabelaDebitos();
  try { window.renderizarComposicaoDebitos(window._composicaoDebitosFiltro || ''); } catch(e) {}
  try { window.atualizarPerdaAcumuladaDebitos(); } catch(e) {}
  try { window.renderizarExtincaoMetodo(); } catch(e) {}
};

window.renderizarTabelaDebitos = function() {
  var listaRFs = [];
  var f    = window._filtrosDebitos || {};
  var busca = (f.busca || '').toLowerCase();
  var stCoresMap  = {'extinto':'29,158,117','nao_extinto':'167,168,170','vencido':'186,117,23','inconsistencia':'244,63,94'};
  var stHexMap    = {'extinto':'#1d9e75','nao_extinto':'#A7A8AA','vencido':'#ba7517','inconsistencia':'#a32d2d'};
  var stLblMap    = {'extinto':'Extinto','nao_extinto':'Não Extinto','vencido':'Vencido','inconsistencia':'Inconsistência'};
  var metCoresMap = {'RAD':'#8B5CF6','Compensacao':'#14B8A6'};
  var metLblMap   = {'RAD':'RAD','Compensacao':'Compensação'};

  if (window.nfListaFiltradaGlobal) {
    window.nfListaFiltradaGlobal.forEach(function(nf) {
      if (nf.tipo !== 'saida' || !nf.registrosFiscais) return;
      nf.registrosFiscais.forEach(function(rf) {
        var valorLiq = rf.valorLiquidoNF || nf.valorLiquido || 0;
        // Usar rf.valor (sincronizado com alíquota do imposto) ao invés de recomputar
        var debVal   = rf.valor || 0;
        var cbsVal   = rf.tipoFiscal === 'cbs' ? debVal : 0;
        var ibsVal   = rf.tipoFiscal === 'ibs' ? debVal : 0;
        var dp       = (rf.data || '').split('-');
        listaRFs.push({
          rf:   rf.id || '—',
          tf:   rf.tipoFiscal === 'ibs' ? 'IBS' : 'CBS',
          tipoNF: rf.tipoNF || nf.tipo || 'saida',
          nf:   (nf.tipoDF || 'NF-e') + ' ' + (rf.nfVinculada || nf.numero || ''),
          nfNumero: rf.nfVinculada || nf.numero || '',
          dataNF: rf.data || '',
          data: dp.length === 3 ? dp[2]+'/'+dp[1]+'/'+dp[0] : '—',
          cliente:   rf.entidade || nf.entidade || '—',
          valorTotal: rf.valorTotalNF  || nf.valorTotal   || 0,
          valorLiq:   valorLiq,
          cbs: cbsVal, ibs: ibsVal, deb: debVal,
          extincao:        rf.dataExtincao   || '—',
          status:          rf.status         || 'nao_extinto',
          statusRegistro:  rf.statusRegistro || null,
          metodoExtincao:  rf.metodoExtincao || '—'
        });
      });
    });
  }

  listaRFs = listaRFs.filter(function(r) {
    if (!window._matchPeriodo(r.dataNF, f)) return false;
    if (busca) {
      var s = r.rf.toLowerCase() + r.nf.toLowerCase() + r.cliente.toLowerCase();
      if (!s.includes(busca)) return false;
    }
    if (f.tipoFiscal && r.tf !== f.tipoFiscal) return false;
    if (f.status     && r.status !== f.status) return false;
    if (f.tipoDFe    && r.tipoNF !== f.tipoDFe) return false;
    if (f.metodo     && r.metodoExtincao !== f.metodo) return false;
    if (f.extincao === 'com' && r.extincao === '—') return false;
    if (f.extincao === 'sem' && r.extincao !== '—') return false;
    if (f.dataNFDe   && r.dataNF < f.dataNFDe) return false;
    if (f.dataNFAte  && r.dataNF > f.dataNFAte) return false;
    if (f.debMin !== '' && r.deb < parseFloat(f.debMin)) return false;
    if (f.debMax !== '' && r.deb > parseFloat(f.debMax)) return false;
    if (f.statusRegistro && r.statusRegistro !== f.statusRegistro) return false;
    return true;
  });

  var cnt = document.getElementById('fd-contagem');
  if (cnt) cnt.textContent = listaRFs.length + ' registros';

  var h = '';
  listaRFs.forEach(function(r) {
    var tfBadge = '<span style="font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--txt1)">'+r.tf+'</span>';
    var mCor = metCoresMap[r.metodoExtincao] || 'var(--txt3)';
    var mLbl = metLblMap[r.metodoExtincao]   || r.metodoExtincao;
    var mBadge = (r.metodoExtincao && r.metodoExtincao !== '—')
      ? '<span style="color:'+mCor+';font-weight:600;font-size:11px">'+mLbl+'</span>'
      : '<span style="color:var(--txt3);font-size:11px">—</span>';
    var nfTipoBadgeDeb = r.tipoNF === 'entrada'
      ? '<span style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:2px 7px;border-radius:3px;border:1px solid rgba(29,158,117,.28);color:#1d9e75;background:transparent">Entrada</span>'
      : '<span style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:2px 7px;border-radius:3px;border:1px solid rgba(186,117,23,.28);color:#ba7517;background:transparent">Saída</span>';
    var stBadge  = bdg(r.status);
    var stRgBadge = r.statusRegistro ? bdg(r.statusRegistro) : '<span style="color:var(--txt3)">—</span>';
    h += '<tr>'
      + '<td class="mono nowrap"><button onclick="window.abrirDetalheRF(\'' + r.rf + '\')" style="background:none;border:none;color:#185fa5;cursor:pointer;font-size:11px;font-weight:600;padding:0;text-decoration:underline dotted;font-family:monospace">' + r.rf + '</button></td>'
      + '<td class="nowrap">' + tfBadge + '</td>'
      + '<td class="nowrap">' + nfTipoBadgeDeb + '</td>'
      + '<td class="mono nowrap" style="color:#185fa5;font-weight:600;cursor:pointer;text-decoration:underline" onclick="if(window.abrirDetalhesNFporNumero)abrirDetalhesNFporNumero(\'' + (r.nfNumero||'') + '\')">' + r.nf + '</td>'
      + '<td class="trunc">' + r.cliente + '</td>'
      + '<td class="nowrap" style="color:var(--txt2)">' + r.data + '</td>'
      + '<td class="r mono">' + ff(r.valorTotal) + '</td>'
      + '<td class="r mono" style="color:var(--txt2)">' + ff(r.valorLiq) + '</td>'
      + '<td class="r mono" style="color:var(--txt2)">' + ffz(r.cbs) + '</td>'
      + '<td class="r mono" style="color:var(--txt2)">' + ffz(r.ibs) + '</td>'
      + '<td class="r mono" style="font-weight:600">' + ff(r.deb) + '</td>'
      + '<td class="nowrap" style="color:var(--txt2)">' + r.extincao + '</td>'
      + '<td class="nowrap">' + stBadge + '</td>'
      + '<td class="nowrap">' + stRgBadge + '</td>'
      + '<td class="nowrap">' + mBadge + '</td>'
      + '</tr>';
  });

  if (!listaRFs.length) {
    h = '<tr><td colspan="14" style="text-align:center;color:var(--txt3);padding:24px">Nenhum RF de débito encontrado para este filtro.</td></tr>';
  }

  var tbody = document.getElementById('t-debitos');
  if (tbody) tbody.innerHTML = h;

  window.atualizarKPIsDebitos(listaRFs);
  try { window.renderizarComposicaoDebitos(window._composicaoDebitosFiltro || ''); } catch(e) {}
  try { window.renderizarExtincaoMetodo(); } catch(e) {}
};

window.debitosDFsRender = function() {
  var el = document.getElementById('t-deb-dfs-body');
  if (!el) return;
  var nfs = (window.nfListaFiltradaGlobal || []).filter(function(nf){ return nf.tipo === 'saida'; });

  var busca    = ((document.getElementById('deb-dfs-busca')    ||{}).value||'').toLowerCase();
  var filtSt   = (document.getElementById('deb-dfs-status')   ||{}).value||'';
  var filtTp   = (document.getElementById('deb-dfs-tipo')     ||{}).value||'';
  var filtMe   = (document.getElementById('deb-dfs-metodo')   ||{}).value||'';
  var filtExt  = (document.getElementById('deb-dfs-extincao') ||{}).value||'';
  var dataDe   = (document.getElementById('deb-dfs-data-de')  ||{}).value||'';
  var dataAte  = (document.getElementById('deb-dfs-data-ate') ||{}).value||'';
  var valMin   = (document.getElementById('deb-dfs-valor-min')||{}).value||'';
  var valMax   = (document.getElementById('deb-dfs-valor-max')||{}).value||'';
  var debMin   = (document.getElementById('deb-dfs-deb-min')  ||{}).value||'';
  var debMax   = (document.getElementById('deb-dfs-deb-max')  ||{}).value||'';

  function _dfDebSt(rfs) {
    var inc=false,vec=false,ext=false,nao=false;
    rfs.forEach(function(rf){
      var s=rf.status||'nao_extinto';
      if(s==='inconsistencia')inc=true;
      else if(s==='vencido')vec=true;
      else if(s==='extinto')ext=true;
      else nao=true;
    });
    if(inc)return'inconsistencia';
    if(vec)return'vencido';
    if(ext&&!nao)return'extinto';
    if(ext)return'extinto';
    return'nao_extinto';
  }

  if(busca){nfs=nfs.filter(function(nf){var s=(nf.entidade||'')+(nf.cnpj||'')+String(nf.numero||'');return s.toLowerCase().indexOf(busca)>=0;});}
  if(filtTp){nfs=nfs.filter(function(nf){return (nf.tipoDF||'').indexOf(filtTp)>=0;});}
  if(filtSt){nfs=nfs.filter(function(nf){return _dfDebSt(nf.registrosFiscais||[])===filtSt;});}
  if(filtMe){nfs=nfs.filter(function(nf){return (nf.registrosFiscais||[]).some(function(rf){return rf.metodoExtincao===filtMe;});});}
  if(dataDe||dataAte){nfs=nfs.filter(function(nf){var d=nf.data||'';return (!dataDe||d>=dataDe)&&(!dataAte||d<=dataAte);});}
  if(filtExt){nfs=nfs.filter(function(nf){var hasExt=(nf.registrosFiscais||[]).some(function(rf){return rf.dataExtincao&&rf.dataExtincao!=='—';});if(filtExt==='com')return hasExt;return !hasExt;});}
  if(valMin!==''||valMax!==''){nfs=nfs.filter(function(nf){var v=nf.valorTotal||0;return (valMin===''||v>=parseFloat(valMin))&&(valMax===''||v<=parseFloat(valMax));});}
  if(debMin!==''||debMax!==''){nfs=nfs.filter(function(nf){var ibs=0,cbs=0;(nf.registrosFiscais||[]).forEach(function(rf){if(rf.tipoFiscal==='ibs')ibs+=rf.valor||0;else cbs+=rf.valor||0;});var d2=ibs+cbs;return (debMin===''||d2>=parseFloat(debMin))&&(debMax===''||d2<=parseFloat(debMax));});}

  var sub=document.getElementById('deb-dfs-sub');
  if(sub)sub.textContent=nfs.length+' DF'+(nfs.length!==1?'s':'')+' de saída';
  var cnt=document.getElementById('ddf-contagem');
  if(cnt)cnt.textContent=nfs.length+' registro'+(nfs.length!==1?'s':'');

  if(!nfs.length){
    el.innerHTML='<tr><td colspan="13" style="text-align:center;color:var(--txt3);padding:24px">Nenhum DF encontrado para este filtro.</td></tr>';
    return;
  }

  var _metCor={'RAD':'139,92,246','Compensacao':'29,158,117'};
  var _metLbl={'RAD':'RAD','Compensacao':'Compensação'};
  var _stCor={'extinto':'29,158,117','nao_extinto':'167,168,170','vencido':'186,117,23','inconsistencia':'244,63,94'};
  var _stLbl={'extinto':'Extinto','nao_extinto':'Não Extinto','vencido':'Vencido','inconsistencia':'Inconsistência'};

  var h='';
  nfs.forEach(function(nf){
    var rfs=nf.registrosFiscais||[];
    var ibs=0,cbs=0,metExt=null,dataExt='—';
    rfs.forEach(function(rf){
      if(rf.tipoFiscal==='ibs')ibs+=rf.valor||0;
      else cbs+=rf.valor||0;
      if(!metExt&&rf.metodoExtincao&&rf.metodoExtincao!=='—')metExt=rf.metodoExtincao;
      if(dataExt==='—'&&rf.dataExtincao&&rf.dataExtincao!=='—')dataExt=rf.dataExtincao;
    });
    var deb=ibs+cbs;
    var dfSt=_dfDebSt(rfs);
    var nfNum=String(nf.numero||'—');
    var tipoDF=nf.tipoDF||'NF-e';
    var dataRaw=nf.data||'—';
    var data=dataRaw.indexOf('-')>0?dataRaw.split('-').reverse().join('/'):dataRaw;
    var valor=nf.valorTotal||0;
    var stRgb=_stCor[dfSt]||'167,168,170';
    var stBadge='<span style="font-size:10px;font-weight:700;letter-spacing:.05em;padding:2px 8px;border-radius:3px;background:rgba('+stRgb+',.12);color:rgb('+stRgb+');border:1px solid rgba('+stRgb+',.28)">'+(_stLbl[dfSt]||dfSt)+'</span>';
    var tipoBadge='<span style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:2px 7px;border-radius:3px;border:1px solid rgba(186,117,23,.28);color:var(--amber);background:transparent">'+tipoDF+'</span>';
    var mRgb=metExt?(_metCor[metExt]||'167,168,170'):null;
    var metBadge=mRgb?'<span style="font-size:10px;font-weight:700;letter-spacing:.05em;padding:2px 7px;border-radius:3px;background:rgba('+mRgb+',.12);color:rgba('+mRgb+',1);border:1px solid rgba('+mRgb+',.28)">'+(_metLbl[metExt]||metExt)+'</span>':'<span style="color:var(--txt3)">—</span>';
    h+='<tr>';
    h+='<td class="mono nowrap" style="color:var(--blue);font-size:11px;cursor:pointer;text-decoration:underline" onclick="if(window.abrirDetalhesNFporNumero)abrirDetalhesNFporNumero(\''+nfNum+'\')">'+tipoDF+' '+nfNum+'</td>';
    h+='<td class="nowrap">'+tipoBadge+'</td>';
    h+='<td class="trunc" style="max-width:160px">'+(nf.entidade||'—')+'</td>';
    h+='<td class="mono nowrap" style="font-size:11px;color:var(--txt2)">'+(nf.cnpj||'—')+'</td>';
    h+='<td class="nowrap" style="font-size:12px;color:var(--txt2)">'+data+'</td>';
    h+='<td class="r mono" style="font-weight:600">'+ff(valor)+'</td>';
    h+='<td class="r mono" style="color:var(--txt2)">'+ff(ibs)+'</td>';
    h+='<td class="r mono" style="color:var(--txt2)">'+ff(cbs)+'</td>';
    h+='<td class="r mono" style="color:var(--red);font-weight:700">'+ff(deb)+'</td>';
    h+='<td class="nowrap" style="font-size:11px;color:var(--txt2)">'+dataExt+'</td>';
    h+='<td class="nowrap">'+stBadge+'</td>';
    h+='<td class="nowrap">'+metBadge+'</td>';
    h+='<td class="r mono" style="color:var(--txt2)">'+rfs.length+'</td>';
    h+='</tr>';
  });
  el.innerHTML=h;
};

window.debitoDFsToggleFiltros = function() { window.shToggleFilterPanel('deb-dfs'); };

window.debitoDFsLimparFiltros = function() {
  ['deb-dfs-busca','deb-dfs-status','deb-dfs-tipo','deb-dfs-metodo','deb-dfs-extincao','deb-dfs-data-de','deb-dfs-data-ate','deb-dfs-valor-min','deb-dfs-valor-max','deb-dfs-deb-min','deb-dfs-deb-max'].forEach(function(id){
    var el=document.getElementById(id); if(el)el.value='';
  });
  window.debitosDFsRender();
};

window.injetarFiltrosDebitosDFs = function() {
  var anchor = document.getElementById('tbl-debitos-dfs');
  if (!anchor) return;
  window.shBuildFilterPanel({
    wrapperId: 'deb-dfs-wrapper',
    anchor: anchor.closest('.twrap') || anchor,
    prefix: 'deb-dfs',
    searchPlaceholder: 'Buscar por NF, fornecedor, CNPJ…',
    onFilter: 'debitosDFsRender',
    onClear: 'debitoDFsLimparFiltros',
    countId: 'deb-dfs-contagem',
    fields: [
      { id:'deb-dfs-status', type:'select', label:'Status', options:[{value:'confirmado',label:'Confirmado'},{value:'pendente',label:'Pendente'},{value:'divergente',label:'Divergente'}] },
      { id:'deb-dfs-tipo', type:'select', label:'Tipo DF', options:[{value:'entrada',label:'Entrada'},{value:'saida',label:'Saída'}] },
      { id:'deb-dfs-metodo', type:'select', label:'Método', options:[{value:'split',label:'Split Payment'},{value:'rad',label:'RAD'},{value:'credito',label:'Créditos'}] }
    ]
  });
};

window.injetarFiltrosInconsistencias = function() {
  /* Inconsistências usa painel estático em index.html — nada a injetar */
};

window.creditosDFsLimpar = function() {
  ['cred-dfs-busca','cred-dfs-status','cred-dfs-tipo','cred-dfs-credito','cred-dfs-metodo','cred-dfs-extincao','cred-dfs-data-de','cred-dfs-data-ate','cred-dfs-valor-min','cred-dfs-valor-max','cred-dfs-cred-min','cred-dfs-cred-max'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.value = '';
  });
  if (typeof creditosDFsRender === 'function') creditosDFsRender();
};

window.atualizarKPIsDebitos = function(listaRFs) {
  var total = 0, extinto = 0, naoExtinto = 0, vencido = 0, inconsist = 0;
  (listaRFs || []).forEach(function(r) {
    var v = r.deb || 0;
    total += v;
    if (r.status === 'extinto')        extinto    += v;
    if (r.status === 'nao_extinto')    naoExtinto += v;
    if (r.status === 'vencido')        vencido    += v;
    if (r.status === 'inconsistencia') inconsist  += v;
  });
  var fmt = function(v) {
    if (v >= 1e6) return 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M';
    if (v >= 1e3) return 'R$ ' + Math.round(v / 1e3) + 'K';
    return ff(v);
  };
  var set = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
  set('deb-total',           fmt(total));
  set('deb-extinto',         fmt(extinto));
  set('deb-extinto-sub',     total > 0 ? (extinto/total*100).toFixed(1).replace('.',',') + '% do total — extinção confirmada' : '—');
  set('deb-nao-extinto',     fmt(naoExtinto));
  set('deb-nao-extinto-sub', total > 0 ? (naoExtinto/total*100).toFixed(1).replace('.',',') + '% — aguardando extinção' : '—');
  set('deb-vencido',         fmt(vencido));
  set('deb-vencido-sub',     total > 0 ? (vencido/total*100).toFixed(1).replace('.',',') + '% — prazo de extinção vencido' : '—');
  set('deb-inconsist',       fmt(inconsist));
  set('deb-inconsist-sub',   total > 0 ? (inconsist/total*100).toFixed(1).replace('.',',') + '% — requer revisão manual' : '—');
  set('deb-aguard',          fmt(naoExtinto));
  set('deb-aguard-sub',      total > 0 ? (naoExtinto/total*100).toFixed(1).replace('.',',') + '% — recolhimento pendente' : '—');
};

window.atualizarPerdaAcumuladaDebitos = function() {
  var totalVencido = 0, countRFs = 0;
  var _fD = window._filtrosDebitos || {};
  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'saida') return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      if (!window._matchPeriodo(rf.data, _fD)) return;
      if ((rf.statusRegistro || rf.status) === 'vencido') { totalVencido += rf.valor || 0; countRFs++; }
    });
  });
  var elVal = document.getElementById('deb-perda');
  var elSub = document.getElementById('deb-perda-sub');
  if (elVal) {
    if (totalVencido >= 1e6)      elVal.textContent = 'R$ ' + (totalVencido/1e6).toFixed(1).replace('.',',') + 'M';
    else if (totalVencido >= 1e3) elVal.textContent = 'R$ ' + Math.round(totalVencido/1e3) + 'K';
    else                          elVal.textContent = ff(totalVencido);
  }
  if (elSub) elSub.textContent = countRFs + ' RF' + (countRFs !== 1 ? 's' : '') + ' vencidos · IBS + CBS';
};

window._composicaoDebitosFiltro = '';

window.renderizarComposicaoDebitos = function(filtroTipo) {
  if (filtroTipo !== undefined) window._composicaoDebitosFiltro = filtroTipo;
  var filtro = window._composicaoDebitosFiltro || '';
  var mesesLabels = ['Out','Nov','Dez','Jan','Fev','Mar','Abr'];
  var mesesISO    = ['2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04'];
  var statusList  = ['extinto','nao_extinto','vencido','inconsistencia'];
  var statusCores = {'extinto':PALETTE.teal,'nao_extinto':PALETTE.gray,'vencido':PALETTE.amber,'inconsistencia':PALETTE.red};
  var statusLabels = {'extinto':'Extinto','nao_extinto':'Não Extinto','vencido':'Vencido','inconsistencia':'Inconsistência'};

  var agg = {};
  mesesISO.forEach(function(m) {
    agg[m] = {};
    statusList.forEach(function(s) { agg[m][s] = 0; });
  });

  var f = window._filtrosDebitos || {};
  var busca = (f.busca || '').toLowerCase();

  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'saida') return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      if (filtro && rf.tipoFiscal !== filtro) return;
      if (!window._matchPeriodo(rf.data, f)) return;
      if (busca) {
        var s = (rf.id||'').toLowerCase() + ('nf-'+(rf.nfVinculada||'')).toLowerCase() + (rf.entidade||'').toLowerCase();
        if (!s.includes(busca)) return;
      }
      if (f.tipoFiscal && rf.tipoFiscal !== f.tipoFiscal.toLowerCase()) return;
      if (f.status    && rf.status !== f.status) return;
      if (f.metodo    && rf.metodoExtincao !== f.metodo) return;
      if (f.dataNFDe  && rf.data < f.dataNFDe) return;
      if (f.dataNFAte && rf.data > f.dataNFAte) return;
      var mes    = (rf.data||'').substring(0,7);
      if (!agg[mes]) return;
      var debVal = rf.valor || 0;
      if (f.debMin !== '' && debVal < parseFloat(f.debMin)) return;
      if (f.debMax !== '' && debVal > parseFloat(f.debMax)) return;
      var valM = Math.round(debVal/1e6*1000)/1000;
      var st   = rf.status || 'nao_extinto';
      if (agg[mes][st] !== undefined) agg[mes][st] += valM;
    });
  });

  var datasets = statusList.map(function(st) {
    return { label: statusLabels[st], color: statusCores[st],
      data: mesesISO.map(function(m) { return Math.round((agg[m][st]||0)*100)/100; }) };
  });
  _svgStackedBar('cDebComposicao', datasets, mesesLabels, 200);

  var totais = {};
  statusList.forEach(function(s) { totais[s] = mesesISO.reduce(function(a,m){return a+(agg[m][s]||0);},0); });
  var totalGeral = statusList.reduce(function(a,s){return a+totais[s];},0);
  var sub = document.getElementById('cDebComposicao-sub');
  if (sub) {
    sub.textContent = totalGeral > 0
      ? 'R$ milhões · Extinto ' + (totais['extinto']/totalGeral*100).toFixed(0) + '% · IBS + CBS · por status · mês a mês'
      : 'R$ milhões · IBS + CBS · por status de RF · mês a mês';
  }

  ['btn-deb-todos','btn-deb-ibs','btn-deb-cbs'].forEach(function(id) {
    var btn = document.getElementById(id); if (!btn) return;
    var active = (id==='btn-deb-todos'&&!filtro)||(id==='btn-deb-ibs'&&filtro==='ibs')||(id==='btn-deb-cbs'&&filtro==='cbs');
    btn.style.background  = active ? 'var(--teal)' : 'transparent';
    btn.style.color       = active ? '#fff' : 'var(--txt2)';
    btn.style.borderColor = active ? 'var(--teal)' : 'var(--brd)';
  });
};

window.renderizarExtincaoMetodo = function() {
  var mesesLabels = ['Out','Nov','Dez','Jan','Fev','Mar','Abr'];
  var mesesISO    = ['2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04'];
  var f    = window._filtrosDebitos || {};
  var busca = (f.busca || '').toLowerCase();
  var radPorMes  = [0,0,0,0,0,0,0];
  var compPorMes = [0,0,0,0,0,0,0];

  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'saida') return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      if (!rf.dataExtincao || rf.dataExtincao === '—') return;
      if (!window._matchPeriodo(rf.data, f)) return;
      if (busca) {
        var s = (rf.id||'').toLowerCase() + ('nf-'+(rf.nfVinculada||'')).toLowerCase() + (rf.entidade||'').toLowerCase();
        if (!s.includes(busca)) return;
      }
      if (f.tipoFiscal && rf.tipoFiscal !== f.tipoFiscal.toLowerCase()) return;
      if (f.status    && rf.status !== f.status) return;
      if (f.metodo    && rf.metodoExtincao !== f.metodo) return;
      if (f.dataNFDe  && rf.data < f.dataNFDe) return;
      if (f.dataNFAte && rf.data > f.dataNFAte) return;
      var mes = (rf.data||'').substring(0,7);
      var idx = mesesISO.indexOf(mes); if (idx < 0) return;
      var valorLiq = rf.valorLiquidoNF || 0;
      var debVal   = rf.tipoFiscal === 'cbs' ? Math.floor(valorLiq*0.08) : Math.floor(valorLiq*0.10);
      if (f.debMin !== '' && debVal < parseFloat(f.debMin)) return;
      if (f.debMax !== '' && debVal > parseFloat(f.debMax)) return;
      var valM = Math.round(debVal/1e6*1000)/1000;
      if (rf.metodoExtincao === 'RAD') radPorMes[idx]  += valM;
      else                             compPorMes[idx] += valM;
    });
  });

  var round2 = function(v) { return Math.round(v*100)/100; };
  _svgStackedBar('cDebMetodo', [
    { label:'RAD',         color:PALETTE.teal, data:radPorMes.map(round2)  },
    { label:'Compensação', color:PALETTE.blue, data:compPorMes.map(round2) }
  ], mesesLabels, 200);

  var tRad  = radPorMes.reduce(function(a,b){return a+b;},0);
  var tComp = compPorMes.reduce(function(a,b){return a+b;},0);
  var tot   = tRad + tComp;
  var sub   = document.getElementById('cDebMetodo-sub');
  if (sub) {
    sub.textContent = tot > 0
      ? 'R$ milhões · RAD '+(tRad/tot*100).toFixed(0)+'% · Compensação '+(tComp/tot*100).toFixed(0)+'% · extinções realizadas'
      : 'R$ milhões · RAD vs Compensação · extinções realizadas · mês a mês';
  }
};

class DataSyncManagerFixed {
  constructor() {
    this.nfsEntrada = [];
    this.creditosGerados = [];
    this.init();
  }

  init() {
    // Gerar 500 NFs de entrada
    this.gerarNFsEntrada();
    // Gerar créditos a partir das NFs
    this.gerarCreditosDeNFs();
    // Atualizar o array global creditos
    this.atualizarArrayCreditos();
    // Dashboard é atualizado após nfListaFiltradaGlobal ser populado em _postProcessarDados()
    console.log('✓ Data Sync Manager inicializado');
    console.log(`  - ${this.nfsEntrada.length} NFs de entrada geradas`);
    console.log(`  - ${this.creditosGerados.length} registros de crédito gerados`);
    console.log(`  - Total em créditos: R$ ${this.creditosGerados.reduce((s, c) => s + c.cred, 0).toLocaleString('pt-BR')}`);
  }

  gerarNFsEntrada() {
    const fornecedores = [
      { nome: 'Ferroplex Mineração S.A.', cnpj: '28.447.821/0001-35' },
      { nome: 'Sulpar Implementos S.A.', cnpj: '14.382.976/0001-09' },
      { nome: 'Transcarro S.A.', cnpj: '19.854.203/0001-67' },
      { nome: 'Tectra Sistemas Ltda', cnpj: '38.291.045/0001-52' },
      { nome: 'Eletropar Ind. Ltda', cnpj: '61.874.320/0001-88' },
      { nome: 'Aeroprime Ind. S.A.', cnpj: '52.039.781/0001-74' },
      { nome: 'Petral Distribuidora Ltda', cnpj: '73.612.590/0001-41' },
      { nome: 'Polisul Química S.A.', cnpj: '86.340.217/0001-63' },
      { nome: 'Celupar S.A.', cnpj: '47.193.825/0001-16' },
      { nome: 'Essenzia Cosméticos S.A.', cnpj: '93.475.862/0001-29' }
    ];

    const somaTotal = 500000000; // R$ 500M
    const valorBase = Math.floor(somaTotal / 100);
    let somaAcumulada = 0;

    for (let i = 1; i <= 100; i++) {
      let valor;

      if (i === 100) {
        valor = somaTotal - somaAcumulada;
      } else {
        const variacao = 0.8 + Math.random() * 0.4;
        valor = Math.floor(valorBase * variacao);
        if (somaAcumulada + valor > somaTotal) {
          valor = somaTotal - somaAcumulada - (100 - i) * valorBase;
        }
      }

      somaAcumulada += valor;
      const fornecedor = fornecedores[i % fornecedores.length];
      // Distribuição determinística pelos 12 meses de 2026
      const _diasNoMes = [31,28,31,30,31,30,31,31,30,31,30,31];
      const mesIdx = (i * 7 + 3) % 12;
      const mes    = mesIdx + 1;
      const dia    = 1 + ((i * 11 + 7) % _diasNoMes[mesIdx]);

      this.nfsEntrada.push({
        id: i,
        numero: String(i).padStart(6, '0'),
        fornecedor: fornecedor.nome,
        cnpj: fornecedor.cnpj,
        data: `2026-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
        valor: valor
      });
    }
  }

  gerarCreditosDeNFs() {
    this.creditosGerados = this.nfsEntrada.map((nf, idx) => {
      const cred = Math.floor(nf.valor * 0.10); // 10% de crédito
      const cbs = Math.floor(cred * 0.50);
      const ibs = cred - cbs;

      const statuses = ['confirmado', 'confirmado', 'confirmado', 'confirmado', 'confirmado', 'aguardando', 'em_risco', 'perdido'];
      const status = statuses[idx % statuses.length];

      const dataObj = new Date(nf.data);
      const pag = status === 'confirmado' ? `${String(dataObj.getDate()).padStart(2, '0')}/${String(dataObj.getMonth() + 1).padStart(2, '0')} ${String(Math.floor(Math.random() * 23)).padStart(2, '0')}:${String(Math.floor(Math.random() * 59)).padStart(2, '0')}` : '—';

      return {
        rf: `RF-${String(28844 + idx).padStart(6, '0')}`,
        nf: `NF-e ${String(idx + 1).padStart(8, '0')}`,
        forn: nf.fornecedor,
        data: nf.data.split('-').reverse().join('/'),
        valorNF: nf.valor,
        cred: cred,
        cbs: cbs,
        ibs: ibs,
        status: status,
        pag: pag
      };
    });
  }

  atualizarArrayCreditos() {
    // Adicionar os créditos gerados ao array global
    if (typeof creditos !== 'undefined') {
      // Limpar array anterior (manter apenas os dados gerados)
      creditos.length = 0;
      // Adicionar novos créditos
      this.creditosGerados.forEach(c => creditos.push(c));
      console.log(`✓ Array creditos atualizado com ${creditos.length} registros`);
    }
  }

  sincronizar() {
    // Dashboard — KPIs + gráficos
    try { window.atualizarKPIsDashboard  && window.atualizarKPIsDashboard();  } catch(e) {}
    try { window.atualizarDashboard      && window.atualizarDashboard();      } catch(e) {}
    try { window.atualizarInteligencia   && window.atualizarInteligencia();   } catch(e) {}

    // Crédito — tabela já chama atualizarKPIsCreditos + renderizarComposicaoCreditos + atualizarPerdaAcumulada
    try { window.renderizarTabelaCreditos && window.renderizarTabelaCreditos(); } catch(e) {}
    try { window.renderVencimentoCalendar && window.renderVencimentoCalendar(); } catch(e) {}
    try { window.dashRenderDFsApropriar && window.dashRenderDFsApropriar(); } catch(e) {}

    // NFs — listagem conciliação
    try { window.renderizarListaNFs && window.renderizarListaNFs(); } catch(e) {}

    // Pagamentos — tabela já chama atualizarKPIsPagamentos + renderizarPagamentosMetodo
    try { window.renderizarTabelaPagamentos && window.renderizarTabelaPagamentos(); } catch(e) {}
    try { if (typeof pagamentosRenderKPIs   === 'function') pagamentosRenderKPIs();   } catch(e) {}
    try { if (typeof fornecedoresRenderKPIs === 'function') fornecedoresRenderKPIs(); } catch(e) {}

    // Débitos — tabela já chama atualizarKPIsDebitos + renderizarComposicaoDebitos + renderizarExtincaoMetodo
    try { window.renderizarTabelaDebitos && window.renderizarTabelaDebitos(); } catch(e) {}

    // Inconsistências — reconstrói array dinâmico, depois renderiza KPIs + dashboard + tabela + RFs
    try { window._sincronizarInconsistencias && window._sincronizarInconsistencias(); } catch(e) {}
    try { if (typeof inconsistRenderKPIs       === 'function') inconsistRenderKPIs();       } catch(e) {}
    try { if (typeof inconsistRenderDashboard  === 'function') inconsistRenderDashboard();  } catch(e) {}
    try { if (typeof inconsistRenderTabela     === 'function') inconsistRenderTabela();     } catch(e) {}
    try { window.renderizarRFsInconsistencias  && window.renderizarRFsInconsistencias();   } catch(e) {}
    try { window.renderizarTop5Inconsistencias && window.renderizarTop5Inconsistencias();  } catch(e) {}
    try { window.renderizarTop10Empresas       && window.renderizarTop10Empresas();        } catch(e) {}
    try { window.renderizarAgeingCreditos      && window.renderizarAgeingCreditos();       } catch(e) {}
    try { window.renderizarFCT                        && window.renderizarFCT();                         } catch(e) {}
    try { window.renderizarEvolucaoAcumuladaCreditos  && window.renderizarEvolucaoAcumuladaCreditos();   } catch(e) {}

    // Conciliação — KPIs de apuração + tabela de DFs
    try { window.atualizarEstatisticasConciliacao && window.atualizarEstatisticasConciliacao(); } catch(e) {}
    try { if (typeof conciliacaoRenderDFs === 'function') conciliacaoRenderDFs(); } catch(e) {}

    // Apuração IBS/CBS — sincroniza apenas se o módulo estiver visível para não re-renderizar desnecessariamente
    try { if (window.sincronizarApuracao && document.getElementById('view-apuracao') && document.getElementById('view-apuracao').classList.contains('active')) window.sincronizarApuracao(); } catch(e) {}
  }

  // Getter para acessar os créditos
  getCreditos() {
    return this.creditosGerados;
  }

  // Getter para acessar as NFs
  getNFsEntrada() {
    return this.nfsEntrada;
  }

  // Getter para totalizações
  getTotalizacoes() {
    const totalEntrada = this.nfsEntrada.reduce((s, nf) => s + nf.valor, 0);
    const totalCreditos = this.creditosGerados.reduce((s, c) => s + c.cred, 0);
    const apropriados = this.creditosGerados
      .filter(c => c.status === 'confirmado')
      .reduce((s, c) => s + c.cred, 0);
    const aguardando = this.creditosGerados
      .filter(c => c.status === 'aguardando')
      .reduce((s, c) => s + c.cred, 0);
    const risco = this.creditosGerados
      .filter(c => c.status === 'em_risco')
      .reduce((s, c) => s + c.cred, 0);

    return {
      totalEntrada,
      totalCreditos,
      apropriados,
      aguardando,
      risco
    };
  }
}

// ============================================================
// TOOLTIP COMPARTILHADO — cria o div uma vez e reutiliza
// ============================================================
function _ensureChartTooltip() {
  if (document.getElementById('chart-tooltip')) return;
  var t = document.createElement('div');
  t.id = 'chart-tooltip';
  t.style.cssText = 'position:fixed;display:none;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 12px;font-size:12px;font-family:Montserrat,sans-serif;color:var(--txt1);pointer-events:none;z-index:9999;white-space:nowrap;box-shadow:0 6px 20px rgba(0,0,0,.3);line-height:1.5';
  document.body.appendChild(t);
  document.addEventListener('mousemove', function(e) {
    var tt = document.getElementById('chart-tooltip');
    if (tt && tt.style.display !== 'none') {
      tt.style.left = (e.clientX + 14) + 'px';
      tt.style.top  = (e.clientY - 8)  + 'px';
    }
  });
}

// ============================================================
// GRÁFICO DE COMPOSIÇÃO DE CRÉDITOS — Pilha por status · mês a mês
// ============================================================
function _svgStackedBar(id, datasets, labels, H) {
  var el = document.getElementById(id);
  if (!el) return;
  _ensureChartTooltip();

  var padT = 10, padB = 28, padL = 44, padR = 12;
  var cw = (el.parentElement && el.parentElement.offsetWidth) || 440;
  var W = cw > 60 ? cw : 440;
  var plotW = W - padL - padR, plotH = H - padT - padB, n = labels.length;

  // Calcular máximo de pilha para escala Y
  var stacks = [];
  for (var i = 0; i < n; i++) {
    var sum = 0;
    datasets.forEach(function(d) { sum += (d.data[i] || 0); });
    stacks.push(sum);
  }
  var maxV = Math.max.apply(null, stacks) || 1;

  var bW = Math.max(8, Math.floor(plotW / n * 0.55));

  function xp(i) { return Math.round(padL + (i + 0.5) * plotW / n); }

  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:' + H + 'px;display:block">';

  // Grid lines Y (4 linhas)
  for (var g = 0; g <= 4; g++) {
    var yg = Math.round(padT + (1 - g / 4) * plotH);
    var val = (maxV * g / 4).toFixed(1);
    s += '<line x1="' + padL + '" y1="' + yg + '" x2="' + (W - padR) + '" y2="' + yg + '" stroke="rgba(167,168,170,.15)" stroke-width="1"/>';
    s += '<text x="' + (padL - 5) + '" y="' + (yg + 4) + '" text-anchor="end" fill="var(--txt3)" font-size="9" font-family="Montserrat,sans-serif">' + val + '</text>';
  }

  // Barras empilhadas — cada rect recebe data-* para o tooltip
  for (var i = 0; i < n; i++) {
    var yBase = padT + plotH;
    for (var di = datasets.length - 1; di >= 0; di--) {
      var v = datasets[di].data[i] || 0;
      if (v <= 0) continue;
      var bH = Math.max(2, Math.round(v / maxV * plotH));
      var bY = yBase - bH;
      var dsLabel = datasets[di].label || '';
      s += '<rect x="' + (xp(i) - Math.floor(bW / 2)) + '" y="' + bY + '" width="' + bW + '" height="' + bH + '"'
         + ' fill="' + datasets[di].color + '" rx="2" style="cursor:pointer"'
         + ' data-label="' + dsLabel + '" data-month="' + labels[i] + '" data-val="' + v.toFixed(2) + '" data-color="' + datasets[di].color + '"'
         + '/>';
      yBase = bY;
    }
    var total = stacks[i].toFixed(1);
    s += '<text x="' + xp(i) + '" y="' + (padT + plotH + padB - 4) + '" text-anchor="middle" fill="var(--txt3)" font-size="9" font-family="Montserrat,sans-serif">' + labels[i] + '</text>';
    s += '<text x="' + xp(i) + '" y="' + (yBase - 4) + '" text-anchor="middle" fill="#A7A8AA" font-size="8" font-family="Montserrat,sans-serif">' + total + '</text>';
  }

  s += '</svg>';
  el.style.cssText = 'display:block;width:100%';
  el.innerHTML = s;

  // Anexar eventos de tooltip após injetar o SVG no DOM
  el.querySelectorAll('rect[data-label]').forEach(function(rect) {
    rect.addEventListener('mouseenter', function(e) {
      var tt = document.getElementById('chart-tooltip');
      if (!tt) return;
      var color = rect.getAttribute('data-color');
      var valStr = rect.getAttribute('data-val').replace('.', ',');
      tt.innerHTML = '<span style="color:#A7A8AA;font-size:11px">' + rect.getAttribute('data-label') + ' · ' + rect.getAttribute('data-month') + '</span>'
        + '<br/><span style="font-weight:700;font-size:14px;color:' + color + '">R$ ' + valStr + 'M</span>';
      tt.style.display = 'block';
      tt.style.left = (e.clientX + 14) + 'px';
      tt.style.top  = (e.clientY - 8)  + 'px';
    });
    rect.addEventListener('mouseleave', function() {
      var tt = document.getElementById('chart-tooltip');
      if (tt) tt.style.display = 'none';
    });
  });
}

// ============================================================
// CRÉDITOS — top 5 RFs com inconsistência por volume financeiro
// ============================================================

window.renderizarTop5Inconsistencias = function() {
  var el = document.getElementById('c-top5-inconsist');
  if (!el) return;

  var lista = [];
  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'entrada') return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      if ((rf.statusRegistro || rf.status) === 'inconsistencia') {
        lista.push({
          id: rf.id || '—',
          forn: (rf.entidade || nf.entidade || '—').slice(0, 22),
          tipo: rf.tipoFiscal === 'ibs' ? 'IBS' : 'CBS',
          valor: rf.valor || 0
        });
      }
    });
  });

  if (!lista.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--txt3);font-size:12px;padding:24px 0">Nenhuma inconsistência encontrada.</div>';
    return;
  }

  lista.sort(function(a, b) { return b.valor - a.valor; });
  var top5 = lista.slice(0, 5);
  var maxVal = top5[0].valor;

  var W = 560, barH = 20, gap = 14, padL = 170, padR = 80, padT = 8, padB = 4;
  var totalH = padT + top5.length * (barH + gap) - gap + padB;

  var tipoCor = { IBS: '#185fa5', CBS: '#ba7517' };

  var s = '<svg viewBox="0 0 ' + W + ' ' + totalH + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">';

  top5.forEach(function(r, i) {
    var y = padT + i * (barH + gap);
    var barW = Math.max(4, Math.round((r.valor / maxVal) * (W - padL - padR)));
    var cor = tipoCor[r.tipo] || '#a32d2d';
    var valM = (r.valor / 1e6).toFixed(2).replace('.', ',');

    // Label esquerda: RF ID + fornecedor
    s += '<text x="' + (padL - 8) + '" y="' + (y + barH / 2 + 4) + '" text-anchor="end" fill="#A7A8AA" font-size="10" font-family="Montserrat,sans-serif">'
      + r.id + ' · ' + r.forn + '</text>';

    // Barra de fundo
    s += '<rect x="' + padL + '" y="' + y + '" width="' + (W - padL - padR) + '" height="' + barH + '" rx="4" fill="rgba(244,63,94,.08)"/>';

    // Barra colorida
    s += '<rect x="' + padL + '" y="' + y + '" width="' + barW + '" height="' + barH + '" rx="4" fill="' + cor + '" opacity=".85"/>';

    // Badge tipo
    s += '<rect x="' + (padL + barW + 6) + '" y="' + (y + 3) + '" width="26" height="14" rx="3" fill="' + cor + '" opacity=".18"/>';
    s += '<text x="' + (padL + barW + 19) + '" y="' + (y + 13) + '" text-anchor="middle" fill="' + cor + '" font-size="9" font-weight="700" font-family="Montserrat,sans-serif">' + r.tipo + '</text>';

    // Valor à direita
    s += '<text x="' + (W - 4) + '" y="' + (y + barH / 2 + 4) + '" text-anchor="end" fill="var(--red)" font-size="10" font-weight="700" font-family="Montserrat,sans-serif">R$ ' + valM + 'M</text>';
  });

  s += '</svg>';
  el.innerHTML = s;
};

// ============================================================
// CONCILIAÇÃO — filtros da tabela de Registros Fiscais
// ============================================================

window.renderizarTop10Empresas = function() {
  var el = document.getElementById('c-top10-empresas');
  if (!el) return;

  // Acumula por fornecedor: total originado + volume pendente (nao_apropriado)
  var mapa = {};
  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'entrada') return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      var nome = rf.entidade || nf.entidade || '—';
      var v    = rf.valor || 0;
      var sc   = rf.statusCredito || rf.status || '';
      if (!mapa[nome]) mapa[nome] = { nome: nome, total: 0, pendente: 0 };
      mapa[nome].total += v;
      if (sc === 'nao_apropriado') mapa[nome].pendente += v;
    });
  });

  var lista = Object.values(mapa).filter(function(e) { return e.total > 0; });

  if (!lista.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--txt3);font-size:12px;padding:24px 0">Nenhum registro encontrado.</div>';
    return;
  }

  // Score financeiro = % pendente sobre total (0–10)
  lista.forEach(function(e) {
    e.pct   = e.total > 0 ? e.pendente / e.total : 0;   // 0..1
    e.score = Math.round(e.pct * 10 * 10) / 10;         // 0.0..10.0
  });

  lista.sort(function(a, b) { return b.total - a.total; });
  var top10  = lista.slice(0, 10);
  var maxVal = top10[0].total;

  function scoreColor(pct) {
    if (pct < 0.15) return '#1d9e75';   // verde  — até 15% pendente
    if (pct < 0.35) return '#ba7517';   // âmbar  — 15–35%
    if (pct < 0.60) return '#F97316';   // laranja — 35–60%
    return '#a32d2d';                    // vermelho — >60%
  }
  function scoreLabel(pct) {
    if (pct < 0.15) return 'Baixo';
    if (pct < 0.35) return 'Médio';
    if (pct < 0.60) return 'Alto';
    return 'Crítico';
  }
  function fmtM(v) { return 'R$ ' + (v / 1e6).toFixed(2).replace('.', ',') + 'M'; }

  var W = 560, barH = 14, gap = 12, padL = 120, padR = 130, padT = 6, padB = 18;
  var barW = W - padL - padR;
  var totalH = padT + top10.length * (barH + gap) - gap + padB;

  var s = '<svg viewBox="0 0 ' + W + ' ' + totalH + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">';

  top10.forEach(function(r, i) {
    var y      = padT + i * (barH + gap);
    var wTot   = Math.max(4, Math.round(barW));
    var wAprop = Math.max(0, Math.round((1 - r.pct) * barW * (r.total / maxVal)));
    var wPend  = Math.max(0, Math.round(r.pct       * barW * (r.total / maxVal)));
    var wFundo = Math.max(4, Math.round((r.total / maxVal) * barW));
    var cor    = scoreColor(r.pct);

    // label fornecedor
    s += '<text x="' + (padL - 6) + '" y="' + (y + barH / 2 + 4) + '" text-anchor="end" fill="#A7A8AA" font-size="9" font-family="Montserrat,sans-serif">' + r.nome.slice(0, 18) + '</text>';

    // trilho de fundo (volume total proporcional ao maior)
    s += '<rect x="' + padL + '" y="' + y + '" width="' + wFundo + '" height="' + barH + '" rx="3" fill="rgba(167,168,170,.1)"/>';

    // segmento apropriado (teal)
    if (wAprop > 0) {
      s += '<rect x="' + padL + '" y="' + y + '" width="' + wAprop + '" height="' + barH + '" rx="3" fill="var(--teal)" opacity=".75"/>';
    }
    // segmento pendente (cor do score) — empilhado após apropriado
    if (wPend > 0) {
      var xPend = padL + wAprop;
      s += '<rect x="' + xPend + '" y="' + y + '" width="' + wPend + '" height="' + barH + '" rx="3" fill="' + cor + '" opacity=".85"/>';
    }

    // volume total
    var xVal = padL + wFundo + 5;
    s += '<text x="' + xVal + '" y="' + (y + barH / 2 + 4) + '" fill="#A7A8AA" font-size="9" font-weight="600" font-family="Montserrat,sans-serif">' + fmtM(r.total) + '</text>';

    // % pendente + score badge
    var pctStr = (r.pct * 100).toFixed(1).replace('.', ',') + '%';
    s += '<text x="' + (W - 2) + '" y="' + (y + barH / 2 + 4) + '" text-anchor="end" fill="' + cor + '" font-size="9" font-weight="700" font-family="Montserrat,sans-serif">' + pctStr + ' · ' + scoreLabel(r.pct) + '</text>';
  });

  // legenda
  var ly = totalH - 10;
  s += '<rect x="' + padL + '" y="' + ly + '" width="10" height="6" rx="1" fill="var(--teal)" opacity=".75"/>';
  s += '<text x="' + (padL + 13) + '" y="' + (ly + 5) + '" fill="#A7A8AA" font-size="8" font-family="Montserrat,sans-serif">Apropriado/Utilizado</text>';
  s += '<rect x="' + (padL + 105) + '" y="' + ly + '" width="10" height="6" rx="1" fill="var(--amber)" opacity=".85"/>';
  s += '<text x="' + (padL + 118) + '" y="' + (ly + 5) + '" fill="#A7A8AA" font-size="8" font-family="Montserrat,sans-serif">Não Apropriado</text>';

  s += '</svg>';
  el.innerHTML = s;
};

// ============================================================
// AGEING DE CRÉDITOS NÃO APROPRIADOS
// ============================================================

window.renderizarAgeingCreditos = function() {
  var barsEl = document.getElementById('cred-ageing-bars');
  if (!barsEl) return;

  var hoje = new Date('2026-08-10'); // data de referência do sistema
  var faixas = [
    { label: '0 – 30 dias',    min: 0,   max: 30,  color: PALETTE.teal,  bg: 'rgba(29,158,117,.15)'  },
    { label: '31 – 90 dias',   min: 31,  max: 90,  color: PALETTE.blue,  bg: 'rgba(24,95,165,.15)'   },
    { label: '91 – 180 dias',  min: 91,  max: 180, color: PALETTE.amber, bg: 'rgba(186,117,23,.15)'  },
    { label: '181 – 365 dias', min: 181, max: 365, color: PALETTE.red,   bg: 'rgba(163,45,45,.15)'   },
    { label: '> 365 dias',     min: 366, max: Infinity, color: PALETTE.gray, bg: 'rgba(136,135,128,.15)' }
  ];
  var totais = [0, 0, 0, 0, 0];
  var cnts   = [0, 0, 0, 0, 0];

  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'entrada') return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      var sc = rf.statusCredito || rf.status || '';
      if (sc !== 'nao_apropriado') return;
      var dataStr = rf.data || nf.data || '';
      if (!dataStr) return;
      var partes = dataStr.split('-');
      if (partes.length < 3) return;
      var dataRF = new Date(partes[0], parseInt(partes[1]) - 1, parseInt(partes[2]));
      var dias = Math.floor((hoje - dataRF) / 86400000);
      for (var i = 0; i < faixas.length; i++) {
        if (dias >= faixas[i].min && dias <= faixas[i].max) {
          totais[i] += rf.valor || 0;
          cnts[i]++;
          break;
        }
      }
    });
  });

  var totalGeral = totais.reduce(function(s, v) { return s + v; }, 0);
  if (totalGeral === 0) {
    barsEl.innerHTML = '<div style="text-align:center;color:var(--txt3);font-size:12px;padding:24px 0">Nenhum crédito pendente encontrado.</div>';
    return;
  }

  function fmtV(v) {
    return v >= 1e6 ? 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M'
         : v >= 1e3 ? 'R$ ' + Math.round(v / 1e3) + 'K'
         : 'R$ 0';
  }

  var barsHtml = '';
  faixas.forEach(function(f, i) {
    var pct = totalGeral > 0 ? (totais[i] / totalGeral * 100) : 0;
    var pctStr = pct.toFixed(1).replace('.', ',') + '%';
    barsHtml += '<div style="display:grid;grid-template-columns:130px 1fr 90px 70px;align-items:center;gap:10px">'
      + '<div style="font-size:11px;color:var(--txt2);white-space:nowrap">' + f.label + '</div>'
      + '<div style="background:var(--sidebar);border-radius:4px;height:8px;overflow:hidden">'
      +   '<div style="height:100%;border-radius:4px;background:' + f.color + ';width:' + pct.toFixed(1) + '%;transition:width .6s ease"></div>'
      + '</div>'
      + '<div style="font-size:12px;font-weight:700;font-family:\'IBM Plex Mono\',monospace;color:' + f.color + ';text-align:right;white-space:nowrap">' + fmtV(totais[i]) + '</div>'
      + '<div style="font-size:11px;color:var(--txt3);text-align:right;white-space:nowrap">' + pctStr + ' · ' + cnts[i] + ' RF</div>'
      + '</div>';
  });
  barsEl.innerHTML = barsHtml;

  // KPIs por faixa
  faixas.forEach(function(f, i) {
    var el  = document.getElementById('age-kpi-' + i);
    var elP = document.getElementById('age-pct-' + i);
    var pct = totalGeral > 0 ? (totais[i] / totalGeral * 100) : 0;
    if (el)  el.textContent  = fmtV(totais[i]);
    if (elP) elP.textContent = pct.toFixed(1).replace('.', ',') + '% · ' + cnts[i] + ' RF';
  });
};

// ============================================================
// FLUXO DE CAIXA TRIBUTÁRIO — sincronizado com nfListaFiltradaGlobal
// ============================================================

window._fctTributo = 'ambos';

window.renderizarFCT = function() {
  // Re-agenda se os containers ainda não tiverem largura (view oculta)
  var _chk = document.getElementById('cFCT');
  if (_chk && _chk.parentElement && _chk.parentElement.offsetWidth < 10) {
    setTimeout(window.renderizarFCT, 80);
    return;
  }
  var tributo = window._fctTributo || 'ambos';

  var byMonth = {};
  var _nfFatContado = {};

  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    var mes = (nf.data || '').substring(0, 7);
    if (!mes) return;
    if (!byMonth[mes]) byMonth[mes] = { cAprop: 0, cCond: 0, cRisco: 0, cGlosado: 0, dBruto: 0, faturamento: 0 };

    // Faturamento bruto: soma valorTotal da NF de saída uma vez por NF
    if (nf.tipo === 'saida' && !_nfFatContado[nf.id || mes + nf.entidade]) {
      _nfFatContado[nf.id || mes + nf.entidade] = true;
      byMonth[mes].faturamento += nf.valorTotal || 0;
    }

    (nf.registrosFiscais || []).forEach(function(rf) {
      var rfTrib = (rf.tributo || rf.tipoFiscal || '').toLowerCase();
      if (tributo !== 'ambos' && rfTrib && rfTrib !== tributo) return;
      var v  = rf.valor || 0;
      var sc = rf.statusCredito || rf.status || '';
      var sr = rf.statusRegistro || null;

      if (nf.tipo === 'entrada') {
        if (sc === 'apropriado' || sc === 'utilizado') {
          byMonth[mes].cAprop += v;
        } else if (sc === 'glosado') {
          byMonth[mes].cGlosado += v;
        } else if (sc === 'nao_apropriado') {
          if (sr === 'em_risco' || sr === 'a_prescrever' || sr === 'vencido') byMonth[mes].cRisco += v;
          else byMonth[mes].cCond += v;
        } else if (sr === 'em_risco' || sr === 'a_prescrever' || sr === 'vencido') {
          // RF com statusRegistro de risco mas statusCredito não-nao_apropriado — conta como risco
          byMonth[mes].cRisco += v;
        }
      } else if (nf.tipo === 'saida') {
        byMonth[mes].dBruto += v;
      }
    });
  });

  var meses = Object.keys(byMonth).sort();
  if (!meses.length) return;

  function fmM(v) {
    var neg = v < 0; v = Math.abs(v);
    var s = v >= 1e6 ? 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M'
          : v >= 1e3 ? 'R$ ' + Math.round(v / 1e3) + 'K'
          : 'R$ 0';
    return neg ? '−' + s : s;
  }
  function set(id, val, color) {
    var e = document.getElementById(id);
    if (!e) return;
    e.textContent = val;
    if (color) e.style.color = color;
  }

  var totCAprop = 0, totCCond = 0, totCRisco = 0, totCGlosado = 0, totD = 0;
  meses.forEach(function(m) {
    totCAprop   += byMonth[m].cAprop;
    totCCond    += byMonth[m].cCond;
    totCRisco   += byMonth[m].cRisco;
    totCGlosado += byMonth[m].cGlosado;
    totD        += byMonth[m].dBruto;
  });
  var recolhLiq = Math.max(0, totD - totCAprop);
  var posicao   = totCAprop - totD;

  set('fct-k-cred-conf',  fmM(totCAprop));
  set('fct-k-cred-cond',  fmM(totCCond + totCRisco + totCGlosado));
  set('fct-k-debito',     fmM(totD));
  set('fct-k-liq',        fmM(recolhLiq));
  set('fct-k-posicao',    fmM(posicao), posicao >= 0 ? '#1d9e75' : '#a32d2d');
  set('fct-k-liq-sub',    recolhLiq === 0 ? 'posição credora' : 'após uso de créditos');
  set('fct-k-posicao-sub', posicao >= 0 ? 'posição credora ↑' : 'posição devedora ↓');

  var labels  = meses.map(function(m) { return m.substring(5,7) + '/' + m.substring(2,4); });
  var dAprop  = meses.map(function(m) { return +(byMonth[m].cAprop / 1e6).toFixed(2); });
  var dDebito = meses.map(function(m) { return +(byMonth[m].dBruto / 1e6).toFixed(2); });
  var dLiq    = meses.map(function(m) { return +(Math.max(0, byMonth[m].dBruto - byMonth[m].cAprop) / 1e6).toFixed(2); });
  var dCCond    = meses.map(function(m) { return +(byMonth[m].cCond    / 1e6).toFixed(2); });
  var dCRisco   = meses.map(function(m) { return +(byMonth[m].cRisco   / 1e6).toFixed(2); });
  var dCGlosado = meses.map(function(m) { return +(byMonth[m].cGlosado / 1e6).toFixed(2); });

  if (typeof svgLine === 'function') {
    // Gráfico principal: crédito × débito × líquido
    svgLine('cFCT', [
      { data: dAprop,  color: 'var(--teal)',  fill: true,  dots: false, w: 2,   label: 'Crédito Apropriado' },
      { data: dDebito, color: 'var(--red)',   fill: false, dots: false, w: 2,   label: 'Débito Bruto', dash: true },
      { data: dLiq,    color: 'var(--amber)', fill: false, dots: true,  w: 1.5, label: 'Recolhimento Líquido' }
    ], labels, 200, { min: 0 });

    // Posição líquida acumulada
    var acum = 0, dAcum = [];
    meses.forEach(function(m) { acum += byMonth[m].cAprop - byMonth[m].dBruto; dAcum.push(+(acum / 1e6).toFixed(2)); });
    svgLine('cFCTSaldo', [
      { data: dAcum, color: acum >= 0 ? 'var(--green)' : 'var(--red)', fill: true, dots: true, w: 2.5, label: 'Saldo acumulado' }
    ], labels, 140, {});

    // Créditos pendentes por mês (condicionado + em risco + glosado)
    svgLine('cFCTVenc', [
      { data: dCCond,    color: 'var(--amber)', fill: true, dots: true, w: 2,   label: 'Condicionado' },
      { data: dCRisco,   color: 'var(--red)',   fill: true, dots: true, w: 1.5, label: 'Em Risco' },
      { data: dCGlosado, color: '#8B5CF6',      fill: true, dots: true, w: 1.5, label: 'Glosado' }
    ], labels, 140, { min: 0 });

    // Alíquota efetiva mensal
    var dAliq    = meses.map(function(m) {
      var fat = byMonth[m].faturamento;
      if (!fat) return 0;
      return +((Math.max(0, byMonth[m].dBruto - byMonth[m].cAprop) / fat * 100).toFixed(2));
    });
    var dNominal = meses.map(function() { return 26.5; });
    // Range centrado nos dados: piso 4pp abaixo do menor valor, teto 4pp acima do maior (≥ 26.5)
    var aliqInduspars = dAliq.filter(function(v){ return v > 0; });
    var aliqMin = aliqInduspars.length ? Math.max(0, Math.min.apply(null, aliqInduspars) - 4) : 0;
    var aliqMax = Math.max(26.5, Math.max.apply(null, dAliq)) + 4;
    svgLine('cFCTAliq', [
      { data: dAliq,    color: 'var(--teal)', fill: true,  dots: true, w: 2.5, label: 'Alíquota Efetiva %' },
      { data: dNominal, color: 'var(--txt3)', fill: false, dots: false, w: 1.5, label: 'Referência 26,5%', dash: true }
    ], labels, 170, {
      min: aliqMin, max: aliqMax,
      fmt: function(v) { return (v < 0 ? '−' : '') + Math.abs(v).toFixed(1).replace('.', ',') + '%'; }
    });

    // KPIs alíquota
    var aliqTotal = 0, aliqN = 0;
    dAliq.forEach(function(v) { if (v > 0) { aliqTotal += v; aliqN++; } });
    var aliqMedia = aliqN ? +(aliqTotal / aliqN).toFixed(1) : 0;
    set('fct-aliq-media', aliqMedia.toFixed(1).replace('.', ',') + '%');
    var economia = +(26.5 - aliqMedia).toFixed(1);
    var eEl = document.getElementById('fct-aliq-economia');
    if (eEl) {
      eEl.textContent = (economia > 0 ? '−' : '+') + Math.abs(economia).toFixed(1).replace('.', ',') + 'pp vs ref.';
      eEl.style.color = economia > 0 ? '#1d9e75' : '#a32d2d';
    }
  }

  // Tabela mensal
  var tbody = document.getElementById('fct-t-body');
  if (tbody) {
    var rows = '';
    meses.forEach(function(m) {
      var d   = byMonth[m];
      var liq = Math.max(0, d.dBruto - d.cAprop);
      var pos = d.cAprop - d.dBruto;
      var posCor = pos >= 0 ? '#1d9e75' : '#a32d2d';
      var statusTxt = pos >= 0
        ? '<span style="color:#1d9e75;font-weight:700;font-size:10px">● Credor</span>'
        : '<span style="color:#a32d2d;font-weight:700;font-size:10px">● Devedor</span>';
      var aliqMes = d.faturamento > 0 ? (Math.max(0, d.dBruto - d.cAprop) / d.faturamento * 100).toFixed(1) + '%' : '—';
      rows += '<tr>'
        + '<td class="nowrap">' + m.substring(5,7) + '/' + m.substring(0,4) + '</td>'
        + '<td class="r mono" style="color:#1d9e75">' + fmM(d.cAprop) + '</td>'
        + '<td class="r mono" style="color:#ba7517">' + fmM(d.cCond)  + '</td>'
        + '<td class="r mono" style="color:#a32d2d">' + fmM(d.cRisco) + '</td>'
        + '<td class="r mono" style="color:#8B5CF6">' + fmM(d.cGlosado) + '</td>'
        + '<td class="r mono">' + fmM(d.dBruto) + '</td>'
        + '<td class="r mono" style="color:#ba7517">' + fmM(liq) + '</td>'
        + '<td class="r mono" style="color:' + posCor + ';font-weight:700">' + fmM(pos) + '</td>'
        + '<td class="r mono" style="color:var(--teal)">' + aliqMes + '</td>'
        + '<td>' + statusTxt + '</td>'
        + '</tr>';
    });
    tbody.innerHTML = rows;
  }

  // Ranking crédito condicionado por fornecedor
  var riskEl = document.getElementById('fct-risk-list');
  if (riskEl) {
    var fornMap = {};
    (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
      if (nf.tipo !== 'entrada') return;
      (nf.registrosFiscais || []).forEach(function(rf) {
        var sc = rf.statusCredito || rf.status || '';
        if (sc !== 'nao_apropriado') return;
        var rfTrib = (rf.tributo || '').toLowerCase();
        if (tributo !== 'ambos' && rfTrib && rfTrib !== tributo) return;
        var nome = rf.entidade || nf.entidade || '—';
        if (!fornMap[nome]) fornMap[nome] = 0;
        fornMap[nome] += rf.valor || 0;
      });
    });
    var fornList = Object.keys(fornMap).map(function(k) { return { nome: k, v: fornMap[k] }; });
    fornList.sort(function(a, b) { return b.v - a.v; });
    fornList = fornList.slice(0, 6);
    var maxFV = fornList.length ? fornList[0].v : 1;
    var html = '';
    fornList.forEach(function(e, i) {
      var pct = (e.v / maxFV * 100).toFixed(0);
      var cor = i < 2 ? '#a32d2d' : i < 4 ? '#ba7517' : '#1d9e75';
      html += '<div style="margin-bottom:10px">'
        + '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">'
        + '<span class="trunc" style="color:var(--txt2);display:inline-block;max-width:150px">' + e.nome + '</span>'
        + '<span style="color:' + cor + ';font-weight:700;white-space:nowrap">' + fmM(e.v) + '</span>'
        + '</div>'
        + '<div style="background:var(--sidebar);border-radius:3px;height:5px"><div style="height:100%;background:' + cor + ';border-radius:3px;width:' + pct + '%"></div></div>'
        + '</div>';
    });
    riskEl.innerHTML = html || '<div style="font-size:12px;color:var(--txt3);text-align:center;padding:16px">Nenhum crédito condicionado.</div>';
  }

  // Alertas de descasamento
  var alertEl = document.getElementById('fct-alertas');
  if (alertEl) {
    var alertas = [];
    meses.forEach(function(m) {
      var d   = byMonth[m];
      var pos = d.cAprop - d.dBruto;
      if (pos < 0) alertas.push({ m: m, pos: pos, risco: d.cRisco });
    });
    if (!alertas.length) {
      alertEl.innerHTML = '<div style="padding:16px;text-align:center;font-size:12px;color:var(--txt3)">Nenhum descasamento detectado no período.</div>';
    } else {
      alertEl.innerHTML = alertas.map(function(a) {
        return '<div class="aitem" style="border-left-color:var(--red)">'
          + '<div class="atitle">' + a.m.substring(5,7) + '/' + a.m.substring(0,4) + ' — Posição devedora: ' + fmM(a.pos) + '</div>'
          + '<div class="atext">Débito superou créditos apropriados no mês. ' + (a.risco > 0 ? fmM(a.risco) + ' em risco adicional de prescrição.' : '') + '</div>'
          + '</div>';
      }).join('');
    }
  }
};

// ============================================================
// GESTÃO DE PAGAMENTOS — filtro global de mês + tabela dinâmica
// ============================================================

window._filtrosPagamentos = { mesAno: '', mesAnoArr: [], tipo: '', status: '', busca: '', valorMin: '', valorMax: '', dataRFDe: '', dataRFAte: '', pagamento: '', tipoDFe: '', metodo: '' };

window.injetarFiltrosPagamentos = function() {
  var tcrd = document.querySelector('#pag-imp .tcrd');
  if (!tcrd) return;
  window.shBuildFilterPanel({
    wrapperId: 'filtros-pagamentos-avancado',
    anchor: tcrd,
    prefix: 'fp',
    searchPlaceholder: 'Pesquisar RF / Fornecedor / CNPJ…',
    onFilter: 'pagamentosFiltrarGrid',
    onClear: 'pagamentosLimparFiltros',
    countId: 'fp-contagem',
    fields: [
      { label: 'Tipo',         id: 'fp-tipo',      type: 'select', options: [{value:'Guia IBS',label:'Guia IBS'},{value:'DARF CBS',label:'DARF CBS'}] },
      { label: 'Status',       id: 'fp-status',    type: 'select', options: [{value:'pago',label:'Pago'},{value:'pendente',label:'Pendente'},{value:'atrasado',label:'Atrasado'},{value:'vencendo',label:'Em risco'}] },
      { label: 'Pagamento',    id: 'fp-pagamento', type: 'select', options: [{value:'com',label:'Com pagamento'},{value:'sem',label:'Sem pagamento'}] },
      { label: 'Data RF — de',  id: 'fp-data-de',   type: 'date' },
      { label: 'Data RF — até', id: 'fp-data-ate',  type: 'date' },
      { label: 'Valor — mín (R$)', id: 'fp-valor-min', type: 'number', placeholder: '0', min: 0 },
      { label: 'Valor — máx (R$)', id: 'fp-valor-max', type: 'number', placeholder: '∞', min: 0 },
      { label: 'Tipo de DFe',  id: 'fp-tipo-dfe',  type: 'select', options: [{value:'entrada',label:'Entrada'},{value:'saida',label:'Saída'}] },
      { label: 'Método',       id: 'fp-metodo',    type: 'select', options: [{value:'Fornecedor',label:'Fornecedor'},{value:'RAD',label:'RAD'}] }
    ]
  });
};

window.pagamentosToggleFiltros = function() { window.shToggleFilterPanel('fp'); };

window.pagamentosFiltrarGrid = function() {
  var f = window._filtrosPagamentos;
  f.busca    = (document.getElementById('fp-busca')     || {}).value || '';
  f.tipo     = (document.getElementById('fp-tipo')      || {}).value || '';
  f.status   = (document.getElementById('fp-status')    || {}).value || '';
  f.pagamento= (document.getElementById('fp-pagamento') || {}).value || '';
  f.dataRFDe = (document.getElementById('fp-data-de')   || {}).value || '';
  f.dataRFAte= (document.getElementById('fp-data-ate')  || {}).value || '';
  f.valorMin = (document.getElementById('fp-valor-min') || {}).value || '';
  f.valorMax = (document.getElementById('fp-valor-max') || {}).value || '';
  f.tipoDFe  = (document.getElementById('fp-tipo-dfe')  || {}).value || '';
  f.metodo   = (document.getElementById('fp-metodo')    || {}).value || '';
  window.renderizarTabelaPagamentos();
};

window.pagamentosLimparFiltros = function() {
  ['fp-busca','fp-tipo','fp-status','fp-pagamento','fp-data-de','fp-data-ate','fp-valor-min','fp-valor-max','fp-tipo-dfe','fp-metodo'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  window._filtrosPagamentos = { mesAno: '', mesAnoArr: (window._filtrosPagamentos.mesAnoArr||[]).slice(), tipo: '', status: '', busca: '', valorMin: '', valorMax: '', dataRFDe: '', dataRFAte: '', pagamento: '', tipoDFe: '', metodo: '' };
  window.renderizarTabelaPagamentos();
};

window.pagamentosFiltrarMesAno = function() {
  var arr = (window._periodoSel || {}).pag || [];
  window._filtrosPagamentos.mesAnoArr = arr;
  window._filtrosPagamentos.mesAno = '';
  var mesLabels = {
    '2025-10':'out/2025','2025-11':'nov/2025','2025-12':'dez/2025',
    '2026-01':'jan/2026','2026-02':'fev/2026','2026-03':'mar/2026','2026-04':'abr/2026',
    '2026-05':'mai/2026','2026-06':'jun/2026','2026-07':'jul/2026','2026-08':'ago/2026',
    '2026-09':'set/2026','2026-10':'out/2026','2026-11':'nov/2026','2026-12':'dez/2026'
  };
  var label = arr.length === 1 ? (mesLabels[arr[0]] || arr[0]) : arr.length > 1 ? arr.length + ' períodos' : 'Origem fato gerador';
  var sub = document.getElementById('pag-periodo-sub');
  if (sub) sub.textContent = 'Impostos (DARF/Guia IBS) e fornecedores · ' + label;
  window.renderizarTabelaPagamentos();
};

window.renderizarTabelaPagamentos = function() {
  var f     = window._filtrosPagamentos;
  var busca = (f.busca || '').toLowerCase();
  var tipo  = f.tipo  || '';
  var stFlt = f.status || '';

  var stCoresMap = { pendente:'29,158,117', vencendo:'186,117,23', atrasado:'244,63,94', pago:'29,158,117' };
  var stHexMap   = { pendente:'#1d9e75', vencendo:'#ba7517', atrasado:'#a32d2d', pago:'#1d9e75' };
  var stLblMap   = { pendente:'Pendente', vencendo:'Em risco', atrasado:'Atrasado', pago:'Pago' };

  var rows = [];
  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'entrada') return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      if (!window._matchPeriodo(rf.data, f)) return;

      var tipoCol = rf.tipoFiscal === 'ibs' ? 'Guia IBS' : 'DARF CBS';
      if (tipo && tipoCol !== tipo) return;

      var temPag      = rf.dataPagamento && rf.dataPagamento !== '—';
      var _scP = rf.statusCredito || rf.status || '';
      var _srP = rf.statusRegistro || null;
      var eApropriado = _scP === 'apropriado' || _scP === 'utilizado';
      var rfSt;
      if (temPag || eApropriado)               rfSt = 'pago';
      else if (_srP === 'vencido')             rfSt = 'atrasado';
      else if (_srP === 'em_risco')            rfSt = 'vencendo';
      else if (_srP === 'inconsistencia')      rfSt = 'vencendo';
      else if (_srP === 'a_prescrever')        rfSt = 'vencendo';
      else                                     rfSt = 'pendente';
      if (stFlt && rfSt !== stFlt) return;

      // filtro pagamento com/sem
      if (f.pagamento === 'com' && rfSt !== 'pago') return;
      if (f.pagamento === 'sem' && rfSt === 'pago') return;

      var valor = rf.valor || 0;
      if (f.valorMin !== '' && valor < parseFloat(f.valorMin)) return;
      if (f.valorMax !== '' && valor > parseFloat(f.valorMax)) return;
      if (f.tipoDFe && (rf.tipoNF || nf.tipo || 'entrada') !== f.tipoDFe) return;
      if (f.metodo  && (rf.metodoPagamento || nf.metodoPagamento || '') !== f.metodo) return;

      var dataRFIso = rf.data || '';
      if (f.dataRFDe  && dataRFIso < f.dataRFDe)  return;
      if (f.dataRFAte && dataRFIso > f.dataRFAte) return;

      if (busca) {
        var s = (rf.id || '').toLowerCase() + (rf.entidade || '').toLowerCase() + (rf.cnpj || '').toLowerCase() + (nf.numero || '').toLowerCase();
        if (!s.includes(busca)) return;
      }

      var dp = dataRFIso.split('-');
      var dataFmt = dp.length === 3 ? dp[2] + '/' + dp[1] + '/' + dp[0] : '—';
      var pagFmt;
      if (temPag) {
        pagFmt = rf.dataPagamento;
      } else if (eApropriado && dp.length === 3) {
        var diaNum = Math.min(parseInt(dp[2], 10) + 5, 28);
        pagFmt = String(diaNum).padStart(2,'0') + '/' + dp[1] + '/' + dp[0] + ' 09:00';
      } else {
        pagFmt = '—';
      }

      rows.push({
        rfId: rf.id || '',
        rf: rf.id || '—', forn: rf.entidade || nf.entidade || '—',
        cnpj: rf.cnpj || nf.cnpj || '—',
        nfVinc: (nf.tipoDF || 'NF-e') + ' ' + (nf.numero || '—'),
        nfNumero: nf.numero || '',
        tipo: tipoCol, tipoNF: nf.tipo || 'entrada', valor: valor,
        dataRF: dataFmt, dataRFIso: dataRFIso, pagamento: pagFmt, status: rfSt,
        metodo: rf.metodoPagamento || nf.metodoPagamento || '—'
      });
    });
  });

  var cnt = document.getElementById('fp-contagem');
  if (cnt) cnt.textContent = rows.length + ' registro' + (rows.length !== 1 ? 's' : '');

  window._pagImpRows = rows;
  var h = '';
  rows.forEach(function(r, idx) {
    var badge  = bdg(r.status);
    var tipoBadge = '<span style="font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--txt1)">'+r.tipo+'</span>';
    var detBtn = '<button onclick="window.abrirDetalheRF(\''+r.rfId+'\')" style="background:rgba(24,95,165,.08);border:1px solid rgba(24,95,165,.2);border-radius:4px;color:#185fa5;cursor:pointer;font-size:10px;font-weight:700;padding:3px 8px">Ver</button>';
    var act = r.status !== 'pago'
      ? '<div style="display:flex;gap:4px;align-items:center"><button class="btn btn-t" style="font-size:11px;padding:4px 10px" onclick="window.abrirGuiaDARF('+idx+')">Gerar Guia</button>' + detBtn + '</div>'
      : '<div style="display:flex;gap:4px;align-items:center"><span style="font-size:11px;color:var(--txt3)">Concluído</span>' + detBtn + '</div>';
    var nfTipoBadgePag = r.tipoNF === 'entrada'
      ? '<span style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:2px 7px;border-radius:3px;border:1px solid rgba(29,158,117,.28);color:#1d9e75;background:transparent">Entrada</span>'
      : '<span style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:2px 7px;border-radius:3px;border:1px solid rgba(186,117,23,.28);color:#ba7517;background:transparent">Saída</span>';
    var metodoBadge = r.metodo ? '<span style="font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--txt1)">'+r.metodo+'</span>' : '<span style="color:var(--txt3)">—</span>';
    var chkCell = r.status !== 'pago'
      ? '<td style="text-align:center"><input type="checkbox" class="pag-chk" data-idx="'+idx+'" onchange="window.pagAtualizarSelecao()" style="cursor:pointer;width:15px;height:15px"></td>'
      : '<td></td>';
    var nfCell = r.nfNumero
      ? '<span style="font-size:11px;color:#185fa5;cursor:pointer;text-decoration:underline dotted;font-weight:600;white-space:nowrap" onclick="if(window.abrirDetalhesNFporNumero)window.abrirDetalhesNFporNumero(\'' + r.nfNumero + '\')">' + r.nfVinc + '</span>'
      : '<span style="color:var(--txt3)">—</span>';
    h += '<tr>'
      + chkCell
      + '<td class="mono nowrap"><button onclick="window.abrirDetalheRF(\''+r.rfId+'\')" style="background:none;border:none;color:#185fa5;cursor:pointer;font-size:11px;font-weight:600;padding:0;text-decoration:underline dotted;font-family:monospace">' + r.rf + '</button></td>'
      + '<td class="mono nowrap">' + nfCell + '</td>'
      + '<td class="trunc" style="vertical-align:middle"><div style="font-weight:500">' + r.forn + '</div><div style="font-size:10px;color:var(--txt2)">' + r.cnpj + '</div></td>'
      + '<td class="nowrap">' + tipoBadge + '</td>'
      + '<td class="nowrap">' + nfTipoBadgePag + '</td>'
      + '<td class="nowrap">' + metodoBadge + '</td>'
      + '<td class="r mono" style="font-weight:600">' + ff(r.valor) + '</td>'
      + '<td class="nowrap" style="color:var(--txt2)">' + r.dataRF + '</td>'
      + '<td class="nowrap">' + (r.status === 'pago'
          ? '<a href="javascript:void(0)" onclick="window.abrirComprovanteRF(\'' + r.rfId + '\')" title="Ver comprovante PIX" style="color:var(--teal);font-weight:600;text-decoration:underline dotted;cursor:pointer">' + r.pagamento + '</a>'
          : '<span style="color:var(--txt2)">—</span>') + '</td>'
      + '<td class="nowrap" style="vertical-align:middle">' + badge + '</td>'
      + '<td class="nowrap" style="vertical-align:middle;white-space:nowrap">' + act + '</td>'
      + '</tr>';
  });

  if (!rows.length) {
    h = '<tr><td colspan="12" style="text-align:center;color:var(--txt3);padding:24px">Nenhum pagamento encontrado para este filtro.</td></tr>';
  }
  var tbody = document.getElementById('t-impostos');
  if (tbody) tbody.innerHTML = h;

  // reset seleção ao re-renderizar
  window.pagAtualizarSelecao();
  var chkAll = document.getElementById('pag-chk-all');
  if (chkAll) chkAll.checked = false;

  window.atualizarKPIsPagamentos();
  if (window.renderizarEvolucaoAcumuladaCreditos) window.renderizarEvolucaoAcumuladaCreditos();
};

// ── Seleção múltipla e geração em lote ──────────────────────
window.pagAtualizarSelecao = function() {
  var chks = document.querySelectorAll('.pag-chk:checked');
  var bar  = document.getElementById('pag-lote-bar');
  var info = document.getElementById('pag-lote-info');
  var valEl= document.getElementById('pag-lote-valor');
  if (!bar) return;
  var total = 0;
  chks.forEach(function(c) {
    var idx = parseInt(c.getAttribute('data-idx'), 10);
    var r = (window._pagImpRows || [])[idx];
    if (r) total += r.valor || 0;
  });
  if (chks.length > 0) {
    bar.style.display = 'flex';
    info.textContent  = chks.length + ' selecionado' + (chks.length > 1 ? 's' : '');
    valEl.textContent = 'R$ ' + total.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  } else {
    bar.style.display = 'none';
  }
};

window.pagToggleAll = function(chkAll) {
  document.querySelectorAll('.pag-chk').forEach(function(c) { c.checked = chkAll.checked; });
  window.pagAtualizarSelecao();
};

window.pagLimparSelecao = function() {
  document.querySelectorAll('.pag-chk').forEach(function(c) { c.checked = false; });
  var chkAll = document.getElementById('pag-chk-all');
  if (chkAll) chkAll.checked = false;
  window.pagAtualizarSelecao();
};

window.pagGerarGuiaLote = function() {
  var chks = document.querySelectorAll('.pag-chk:checked');
  if (!chks.length) return;
  var selecionados = [];
  var totalGeral = 0;
  chks.forEach(function(c) {
    var idx = parseInt(c.getAttribute('data-idx'), 10);
    var r = (window._pagImpRows || [])[idx];
    if (r) { selecionados.push(r); totalGeral += r.valor || 0; }
  });

  // montar modal
  var modal = document.getElementById('pag-lote-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'pag-lote-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.72);z-index:1200;display:flex;align-items:center;justify-content:center;padding:16px';
    modal.onclick = function(e){ if(e.target===modal) modal.style.display='none'; };
    document.body.appendChild(modal);
  }

  var fmtV = function(v) { return 'R$ ' + v.toLocaleString('pt-BR', {minimumFractionDigits:2,maximumFractionDigits:2}); };
  var rows = selecionados.map(function(r) {
    var cor = r.tipo === 'Guia IBS' ? '#185fa5' : '#ba7517';
    return '<tr style="border-bottom:1px solid var(--brd)">'
      + '<td style="padding:8px 12px;font-size:12px;color:#185fa5;font-weight:600;font-family:monospace;cursor:pointer;text-decoration:underline dotted" onclick="if(window.abrirDetalheRF)window.abrirDetalheRF(\'' + r.rfId + '\')">' + r.rf + '</td>'
      + '<td style="padding:8px 12px;font-size:12px;color:var(--txt1)">' + r.forn + '</td>'
      + '<td style="padding:8px 12px"><span style="font-size:11px;font-weight:600;color:'+cor+'">' + r.tipo + '</span></td>'
      + '<td style="padding:8px 12px;text-align:right;font-size:12px;font-weight:600;font-family:monospace;color:var(--txt1)">' + fmtV(r.valor) + '</td>'
      + '</tr>';
  }).join('');

  modal.innerHTML = '<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;width:100%;max-width:640px;max-height:88vh;overflow:hidden;display:flex;flex-direction:column">'
    + '<div style="padding:20px 24px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">'
    +   '<div><div style="font-size:17px;font-weight:700;color:var(--txt1)">Gerar Guias em Lote</div>'
    +   '<div style="font-size:12px;color:var(--txt3);margin-top:3px">' + selecionados.length + ' guia(s) · Total: ' + fmtV(totalGeral) + '</div></div>'
    +   '<button onclick="document.getElementById(\'pag-lote-modal\').style.display=\'none\'" style="background:none;border:none;color:var(--txt2);font-size:24px;cursor:pointer;line-height:1;padding:0">×</button>'
    + '</div>'
    + '<div style="overflow-y:auto;flex:1;padding:16px 24px">'
    +   '<table style="width:100%;border-collapse:collapse"><thead><tr style="border-bottom:1px solid var(--brd)">'
    +     '<th style="padding:6px 12px;font-size:11px;color:var(--txt3);text-align:left;font-weight:600">RF</th>'
    +     '<th style="padding:6px 12px;font-size:11px;color:var(--txt3);text-align:left;font-weight:600">Fornecedor</th>'
    +     '<th style="padding:6px 12px;font-size:11px;color:var(--txt3);text-align:left;font-weight:600">Tipo</th>'
    +     '<th style="padding:6px 12px;font-size:11px;color:var(--txt3);text-align:right;font-weight:600">Valor</th>'
    +   '</tr></thead><tbody>' + rows + '</tbody>'
    +   '<tfoot><tr><td colspan="3" style="padding:12px 12px;font-size:13px;font-weight:700;color:var(--txt1)">Total geral</td>'
    +   '<td style="padding:12px 12px;text-align:right;font-size:14px;font-weight:700;color:var(--teal);font-family:monospace">' + fmtV(totalGeral) + '</td></tr></tfoot>'
    +   '</table>'
    + '</div>'
    + '<div style="padding:14px 24px 20px;border-top:1px solid var(--border);display:flex;gap:10px;justify-content:flex-end">'
    +   '<button onclick="document.getElementById(\'pag-lote-modal\').style.display=\'none\'" style="background:none;border:1px solid var(--border);border-radius:8px;color:var(--txt2);font-size:13px;font-family:inherit;padding:9px 20px;cursor:pointer">Cancelar</button>'
    +   '<button onclick="window._pagConfirmarLote()" style="background:var(--teal);border:none;border-radius:8px;color:#0E1210;font-size:13px;font-weight:700;font-family:inherit;padding:9px 22px;cursor:pointer">Confirmar Geração</button>'
    + '</div>'
    + '</div>';
  modal.style.display = 'flex';
};

window._pagConfirmarLote = function() {
  var chks = document.querySelectorAll('.pag-chk:checked');
  var n = chks.length;
  document.getElementById('pag-lote-modal').style.display = 'none';
  // Feedback visual
  var bar = document.getElementById('pag-lote-bar');
  if (bar) {
    var info = document.getElementById('pag-lote-info');
    if (info) info.textContent = n + ' guia(s) gerada(s) com sucesso!';
    setTimeout(function() { window.pagLimparSelecao(); }, 2000);
  }
};
// ─────────────────────────────────────────────────────────────

window.atualizarKPIsPagamentos = function() {
  var f = window._filtrosPagamentos;
  var pendente = 0, cntPend = 0;
  var vencendo = 0, cntVenc = 0, lastVenc = null;
  var atrasado = 0, cntAtr  = 0, lastAtr  = null;
  var pago     = 0, cntPago = 0;

  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'entrada') return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      if (!window._matchPeriodo(rf.data, f)) return;
      var temPag      = rf.dataPagamento && rf.dataPagamento !== '—';
      var sc          = rf.statusCredito || rf.status || '';
      var sr          = rf.statusRegistro || null;
      var eApropriado = sc === 'apropriado' || sc === 'utilizado';
      var v = rf.valor || 0;
      if (temPag || eApropriado)                                              { pago     += v; cntPago++; }
      else if (sr === 'vencido')                                              { atrasado += v; cntAtr++;  lastAtr  = rf.entidade || nf.entidade; }
      else if (sr === 'em_risco' || sr === 'a_prescrever' || sr === 'inconsistencia') { vencendo += v; cntVenc++; lastVenc = rf.entidade || nf.entidade; }
      else                                                                    { pendente += v; cntPend++; }
    });
  });

  function fmtM(v) {
    if (v >= 1e6) return 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M';
    if (v >= 1e3) return 'R$ ' + Math.round(v / 1e3) + 'K';
    return 'R$ ' + v.toLocaleString('pt-BR');
  }
  function setEl(id, val) { var e = document.getElementById(id); if (e) e.textContent = val; }

  setEl('pag-avencer',     fmtM(pendente));
  setEl('pag-avencer-sub', cntPend + ' guias pendentes');
  setEl('pag-vencendo',     fmtM(vencendo));
  setEl('pag-vencendo-sub', cntVenc + (cntVenc === 1 && lastVenc ? ' guia — ' + lastVenc : ' guias · requer atenção'));
  setEl('pag-atrasado',     fmtM(atrasado));
  setEl('pag-atrasado-sub', cntAtr  + (cntAtr  === 1 && lastAtr  ? ' guia — ' + lastAtr  : ' guias vencidas'));
  setEl('pag-pago',         fmtM(pago));
  setEl('pag-pago-sub',     cntPago + ' guias executadas');
};

// ============================================================
// EVOLUÇÃO ACUMULADA DE CRÉDITOS — Apropriados vs A Apropriar
// ============================================================

window.renderizarEvolucaoAcumuladaCreditos = function() {
  var _el = document.getElementById('cPagEvolAcum');
  if (_el && _el.parentElement && _el.parentElement.offsetWidth < 10) {
    setTimeout(window.renderizarEvolucaoAcumuladaCreditos, 150);
    return;
  }

  var byMonth = {};
  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'entrada') return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      var mes = (rf.data || nf.data || '').substring(0, 7);
      if (!mes) return;
      if (!byMonth[mes]) byMonth[mes] = { aprop: 0, pend: 0 };
      var v = rf.valor || 0;
      var sc = rf.statusCredito || rf.status || '';
      if (sc === 'apropriado' || sc === 'utilizado') byMonth[mes].aprop += v;
      else if (sc === 'nao_apropriado') byMonth[mes].pend += v;
    });
  });

  var meses = Object.keys(byMonth).sort();
  if (!meses.length) return;

  var acumAprop = 0, acumPend = 0;
  var dAprop = [], dTotal = [], dPend = [], labels = [];
  meses.forEach(function(m) {
    acumAprop += byMonth[m].aprop;
    acumPend  += byMonth[m].pend;
    dAprop.push(acumAprop / 1e6);
    dTotal.push((acumAprop + acumPend) / 1e6);
    dPend.push(acumPend / 1e6);
    labels.push(m.substring(5, 7) + '/' + m.substring(2, 4));
  });

  // Stacked-area SVG customizado
  var el = document.getElementById('cPagEvolAcum');
  if (!el) return;
  var H = 200, padT = 14, padB = 26, padL = 8, padR = 8;
  var W = (el.parentElement && el.parentElement.offsetWidth > 50 ? el.parentElement.offsetWidth : 440);
  var plotW = W - padL - padR, plotH = H - padT - padB;
  var n = labels.length;
  var maxV = Math.max.apply(null, dTotal) || 1;

  function xp(i) { return Math.round(padL + (i / Math.max(n - 1, 1)) * plotW); }
  function yp(v) { return Math.round(padT + (1 - v / maxV) * plotH); }
  function fv(v) { return v >= 1 ? v.toFixed(1).replace('.', ',') + 'M' : Math.round(v * 1000) + 'K'; }

  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:' + H + 'px;display:block">';

  // Grid lines horizontais subtis
  [0.25, 0.5, 0.75].forEach(function(f) {
    var gy = Math.round(padT + plotH * (1 - f));
    s += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="rgba(128,128,128,0.12)" stroke-width="1"/>';
    s += '<text x="' + (padL + 3) + '" y="' + (gy - 3) + '" fill="var(--txt3)" font-size="9" font-family="Montserrat,sans-serif">' + fv(maxV * f) + '</text>';
  });

  // Área pendente (topo — âmbar), entre curva total e curva aprop
  var ptTotal = dTotal.map(function(v, i) { return xp(i) + ',' + yp(v); });
  var ptAprop = dAprop.map(function(v, i) { return xp(i) + ',' + yp(v); });
  var pendFill = ptTotal.join(' ') + ' ' + ptAprop.slice().reverse().join(' ');
  s += '<polygon points="' + pendFill + '" fill="var(--amber)" fill-opacity="0.22" stroke="none"/>';

  // Área apropriada (base — verde)
  var apropFill = ptAprop.join(' ') + ' ' + xp(n - 1) + ',' + yp(0) + ' ' + xp(0) + ',' + yp(0);
  s += '<polygon points="' + apropFill + '" fill="var(--teal)" fill-opacity="0.22" stroke="none"/>';

  // Linhas de contorno
  s += '<polyline points="' + ptTotal.join(' ') + '" fill="none" stroke="var(--amber)" stroke-width="1.5" stroke-dasharray="5 3" stroke-linejoin="round" stroke-linecap="round"/>';
  s += '<polyline points="' + ptAprop.join(' ') + '" fill="none" stroke="var(--teal)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';

  // Delta mês a mês — colchete vertical + label entre as duas curvas
  var minGapPx = 10; // altura mínima para mostrar label
  var stepLabel = n > 8 ? 2 : 1; // mostrar label a cada N meses se muitos meses
  for (var di = 0; di < n; di++) {
    var yA = yp(dAprop[di]);
    var yT = yp(dTotal[di]);
    var gapPx = yA - yT; // distância em pixels entre as duas curvas
    var cx = xp(di);
    // Linha vertical pontilhada no centro do gap
    s += '<line x1="' + cx + '" y1="' + yT + '" x2="' + cx + '" y2="' + yA
       + '" stroke="var(--amber)" stroke-width="1" stroke-dasharray="2 2" opacity="0.55"/>';
    // Marcadores nas extremidades do gap
    s += '<circle cx="' + cx + '" cy="' + yA + '" r="2.5" fill="var(--teal)"/>';
    s += '<circle cx="' + cx + '" cy="' + yT + '" r="2" fill="var(--amber)" opacity="0.85"/>';
    // Label do delta (só quando gap grande o suficiente e no step configurado)
    if (gapPx >= minGapPx && di % stepLabel === 0 && dPend[di] > 0) {
      var midY = Math.round((yA + yT) / 2);
      var txtX = cx + (cx > W * 0.75 ? -4 : 4);
      var anchor = cx > W * 0.75 ? 'end' : 'start';
      s += '<rect x="' + (txtX - (anchor === 'end' ? 26 : 0)) + '" y="' + (midY - 7) + '" width="26" height="10" rx="3" fill="var(--amber)" fill-opacity="0.18"/>';
      var deltaPct = dTotal[di] > 0 ? Math.round(dPend[di] / dTotal[di] * 100) : 0;
      s += '<text x="' + txtX + '" y="' + (midY + 3) + '" text-anchor="' + anchor
         + '" fill="var(--amber)" font-size="8.5" font-weight="700" font-family="Montserrat,sans-serif">'
         + deltaPct + '%</text>';
    }
  }

  // Dots e label no ponto final da linha aprop
  var li = n - 1;
  var lxOff = xp(li) > W * 0.75 ? -6 : 6;
  var lAnchor = xp(li) > W * 0.75 ? 'end' : 'start';
  s += '<text x="' + (xp(li) + lxOff) + '" y="' + (yp(dAprop[li]) - 8) + '" text-anchor="' + lAnchor + '" fill="var(--green)" font-size="11" font-weight="700" font-family="Montserrat,sans-serif">' + fv(dAprop[li]) + '</text>';

  // Labels eixo X
  labels.forEach(function(l, i) {
    s += '<text x="' + xp(i) + '" y="' + (H - 6) + '" text-anchor="middle" fill="var(--txt3)" font-size="10" font-family="Montserrat,sans-serif">' + l + '</text>';
  });

  // Hover zones
  var zW = Math.max(16, Math.floor(plotW / (n || 1)));
  for (var ci = 0; ci < n; ci++) {
    var tp = [labels[ci], '#1d9e75', 'Apropriado Acum.', fv(dAprop[ci]), '#ba7517', 'A Apropriar Acum.', fv(dPend[ci])];
    var enc = tp.join('|').replace(/'/g, '&apos;');
    s += '<rect x="' + (xp(ci) - Math.floor(zW / 2)) + '" y="' + padT + '" width="' + zW + '" height="' + plotH + '" fill="transparent" style="cursor:crosshair" onmousemove="_svgTipShow(event,\'' + enc + '\')" onmouseleave="_svgTipHide()"/>';
  }

  s += '</svg>';
  el.style.cssText = 'display:block;width:100%';
  el.innerHTML = s;

  // KPIs
  function fm(v) {
    return v >= 1e6 ? 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M'
         : v >= 1e3 ? 'R$ ' + Math.round(v / 1e3) + 'K'
         : 'R$ ' + Math.round(v);
  }
  var gap = acumAprop + acumPend > 0 ? Math.round(acumAprop / (acumAprop + acumPend) * 100) : 0;
  var elA = document.getElementById('pag-evol-aprop');
  var elP = document.getElementById('pag-evol-pend');
  var elG = document.getElementById('pag-evol-gap');
  var elX = document.getElementById('pag-evol-pct');
  if (elA) elA.textContent = fm(acumAprop);
  if (elP) elP.textContent = fm(acumPend);
  if (elG) elG.textContent = fm(acumAprop - acumPend);
  if (elX) elX.textContent = gap + '%';
};

// ============================================================
// COMPROVANTE DE PAGAMENTO PIX — modal com dados do RF
// ============================================================

window.fecharComprovanteRF = function() {
  var ov = document.getElementById('comprovante-modal-overlay');
  if (ov) ov.style.display = 'none';
};

window.imprimirComprovanteRF = function() {
  window.print();
};

window.abrirComprovanteRF = function(rfId) {
  // Localizar o RF e sua NF em nfListaFiltradaGlobal
  var rfEncontrado = null, nfEncontrada = null;
  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (rfEncontrado) return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      if (rf.id === rfId) { rfEncontrado = rf; nfEncontrada = nf; }
    });
  });
  if (!rfEncontrado) return;

  var rf  = rfEncontrado;
  var nf  = nfEncontrada;
  var isIBS = rf.tipoFiscal === 'ibs';

  // --- Recebedor conforme tributo ---
  var recNome  = isIBS ? 'CG-IBS — Comitê Gestor do IBS'         : 'RFB — Receita Federal do Brasil';
  var recCNPJ  = isIBS ? '50.873.548/0001-08'                     : '00.394.460/0057-53';
  var recChave = isIBS ? '50873548000108 (CNPJ)'                  : '00394460005753 (CNPJ)';
  var recBanco = 'Banco do Brasil S.A.';

  // --- Pagador (empresa) ---
  var pagNome  = 'Induspar Soluções em Pagamentos';
  var pagCNPJ  = '01.123.456/0001-99';
  var pagBanco = 'BTG Pactual S.A.';
  var pagConta = '0001 / 234567-8';

  // --- Valor ---
  var valor = rf.valor || 0;

  // --- Período de apuração ---
  var mesLabels = {
    '2025-10':'out/2025','2025-11':'nov/2025','2025-12':'dez/2025',
    '2026-01':'jan/2026','2026-02':'fev/2026','2026-03':'mar/2026','2026-04':'abr/2026',
    '2026-05':'mai/2026','2026-06':'jun/2026','2026-07':'jul/2026','2026-08':'ago/2026',
    '2026-09':'set/2026','2026-10':'out/2026','2026-11':'nov/2026','2026-12':'dez/2026'
  };
  var mesPart  = (rf.data || '').substring(0, 7);
  var periodo  = mesLabels[mesPart] || mesPart;

  // --- Data/hora do pagamento ---
  var dataPag  = rf.dataPagamento || '—';

  // --- E2EId determinístico (E + ISPB(8) + YYYYMMDDHHMMSS(14) + 10chars) ---
  var ispb = '01526114'; // BTG Pactual
  var dp   = (dataPag || '').split(' ');
  var dp0  = (dp[0] || '').split('/');
  var dp1  = (dp[1] || '09:00').split(':');
  var dtPart = dp0.length === 3
    ? dp0[2] + dp0[1] + dp0[0] + dp1[0] + dp1[1] + '00'
    : '20260424090000';
  var seed = rfId.replace(/\D/g, '');
  var n = parseInt(seed.slice(-8)) || 12345678;
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var rndPart = '';
  for (var i = 0; i < 10; i++) { rndPart += chars[n % chars.length]; n = Math.floor(n / 37) + i * 13 + 7; }
  var e2eId = 'E' + ispb + dtPart + rndPart;

  // --- Autenticação bancária ---
  var authSeed = parseInt(seed.slice(-6)) || 987654;
  var authPart = '';
  for (var j = 0; j < 12; j++) { authPart += chars[authSeed % chars.length]; authSeed = Math.floor(authSeed / 29) + j * 17 + 3; }
  var auth = 'BTG' + authPart;

  // --- Tipo de tributo + referência ---
  var tipoLabel = isIBS ? 'Guia IBS' : 'DARF CBS';
  var refLabel  = (isIBS ? 'Guia IBS' : 'DARF CBS') + ' · Split Payment · Art. 48 LC 214/2025';

  // --- NF vinculada ---
  var nfNum = 'NF-e ' + (rf.nfVinculada || nf.numero || '—');

  // --- População dos elementos do modal ---
  function setEl(id, val) { var e = document.getElementById(id); if (e) e.textContent = val; }

  document.getElementById('cmp-tipo-label').textContent = tipoLabel + ' · Split Payment LC 214/2025';
  setEl('cmp-valor', 'R$ ' + valor.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}));
  setEl('cmp-datetime', dataPag);

  setEl('cmp-pag-nome',  pagNome);
  setEl('cmp-pag-cnpj',  pagCNPJ);
  setEl('cmp-pag-banco', pagBanco);
  setEl('cmp-pag-conta', pagConta);

  setEl('cmp-rec-nome',  recNome);
  setEl('cmp-rec-cnpj',  recCNPJ);
  setEl('cmp-rec-chave', recChave);
  setEl('cmp-rec-banco', recBanco);

  setEl('cmp-det-tipo',    tipoLabel);
  setEl('cmp-det-periodo', periodo);
  setEl('cmp-det-rf',      rf.id || '—');
  setEl('cmp-det-nf',      nfNum);
  setEl('cmp-det-ref',     refLabel);

  setEl('cmp-e2e',  e2eId);
  setEl('cmp-auth', auth);

  // Exibir modal
  var ov = document.getElementById('comprovante-modal-overlay');
  if (ov) ov.style.display = 'flex';
};

// ============================================================
// GRÁFICO DE MÉTODO DE PAGAMENTO — RAD vs Fornecedor · mês a mês
// ============================================================
window.renderizarPagamentosMetodo = function() {
  var mesesLabels = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  var mesesISO    = ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12'];
  var f = window._filtrosCreditos || {};
  var busca = (f.busca || '').toLowerCase();

  var radPorMes  = [0,0,0,0,0,0,0,0,0,0,0,0];
  var fornPorMes = [0,0,0,0,0,0,0,0,0,0,0,0];

  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'entrada') return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      // Filtros globais
      if (!window._matchPeriodo(rf.data, f)) return;
      if (busca) {
        var rid = (rf.id || '').toLowerCase(), rn = ('nf-'+(rf.nfVinculada||'')).toLowerCase(), re = (rf.entidade||'').toLowerCase();
        if (!rid.includes(busca) && !rn.includes(busca) && !re.includes(busca)) return;
      }
      if (f.tipoFiscal && rf.tipoFiscal !== f.tipoFiscal.toLowerCase()) return;
      if (f.status    && rf.status !== f.status) return;
      if (f.contrato === '__sem__' && rf.contratoId) return;
      if (f.contrato && f.contrato !== '__sem__' && rf.contratoId !== f.contrato) return;
      if (f.metodo   && rf.metodoPagamento !== f.metodo) return;
      if (f.dataNFDe && rf.data < f.dataNFDe) return;
      if (f.dataNFAte && rf.data > f.dataNFAte) return;

      var credVal = rf.valor || 0;
      if (f.credMin !== '' && credVal < parseFloat(f.credMin)) return;
      if (f.credMax !== '' && credVal > parseFloat(f.credMax)) return;

      var mes = rf.data ? rf.data.substring(0, 7) : null;
      var idx = mesesISO.indexOf(mes);
      if (idx < 0) return;

      var valM = Math.round(credVal / 1e6 * 1000) / 1000;
      if (rf.metodoPagamento === 'RAD') radPorMes[idx]  += valM;
      else                               fornPorMes[idx] += valM;
    });
  });

  var round2 = function(v) { return Math.round(v * 100) / 100; };
  var datasets = [
    { label: 'RAD',        color: PALETTE.teal, data: radPorMes.map(round2)  },
    { label: 'Fornecedor', color: PALETTE.blue, data: fornPorMes.map(round2) }
  ];

  _svgStackedBar('cPagMetodo', datasets, mesesLabels, 200);

  // Subtítulo dinâmico com proporção total
  var totalRad  = radPorMes.reduce(function(a,b){return a+b;},0);
  var totalForn = fornPorMes.reduce(function(a,b){return a+b;},0);
  var total = totalRad + totalForn;
  var sub = document.getElementById('cPagMetodo-sub');
  if (sub) {
    if (total > 0) {
      sub.textContent = 'R$ milhões · RAD ' + (totalRad/total*100).toFixed(0) + '% · Fornecedor ' + (totalForn/total*100).toFixed(0) + '% · créditos IBS+CBS';
    } else {
      sub.textContent = 'R$ milhões · RAD vs Fornecedor · créditos IBS+CBS · mês a mês';
    }
  }
};

window._composicaoFiltro = '';

window.renderizarComposicaoCreditos = function(filtroTipo) {
  if (filtroTipo !== undefined) window._composicaoFiltro = filtroTipo;
  var filtro = window._composicaoFiltro || '';

  var mesesLabels = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  var mesesISO    = ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12'];

  var statusList = ['apropriado','utilizado','nao_apropriado','vencido','inconsistencia'];
  var statusCores = {
    'apropriado':    PALETTE.teal,
    'utilizado':     PALETTE.blue,
    'nao_apropriado':PALETTE.gray,
    'vencido':       PALETTE.amber,
    'inconsistencia':PALETTE.red
  };

  // Inicializar acumuladores por mês e status
  var agg = {};
  mesesISO.forEach(function(m) {
    agg[m] = {};
    statusList.forEach(function(s) { agg[m][s] = 0; });
  });

  // Aplicar os mesmos filtros ativos na tabela de créditos
  var f = window._filtrosCreditos || {};
  var busca = (f.busca || '').toLowerCase();

  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    (nf.registrosFiscais || []).forEach(function(rf) {
      // Filtro de tipo (botões do próprio gráfico)
      if (filtro && rf.tipoFiscal !== filtro) return;

      // Mesmos filtros do grid
      if (busca) {
        var rfId = (rf.id || '').toLowerCase();
        var nfNum = ('nf-' + (rf.nfVinculada || '')).toLowerCase();
        var forn  = (rf.entidade || '').toLowerCase();
        if (!rfId.includes(busca) && !nfNum.includes(busca) && !forn.includes(busca)) return;
      }
      if (f.tipoFiscal && rf.tipoFiscal !== f.tipoFiscal.toLowerCase()) return;
      if (f.status    && rf.status !== f.status) return;
      if (f.contrato === '__sem__' && rf.contratoId) return;
      if (f.contrato && f.contrato !== '__sem__' && rf.contratoId !== f.contrato) return;
      if (f.metodo   && rf.metodoPagamento !== f.metodo) return;
      if (f.pagamento === 'com' && rf.dataPagamento === '—') return;
      if (f.pagamento === 'sem' && rf.dataPagamento !== '—') return;
      if (!window._matchPeriodo(rf.data, f)) return;
      if (f.dataNFDe && rf.data < f.dataNFDe) return;
      if (f.dataNFAte && rf.data > f.dataNFAte) return;
      var credVal = rf.valor || 0;
      if (f.credMin !== '' && credVal < parseFloat(f.credMin)) return;
      if (f.credMax !== '' && credVal > parseFloat(f.credMax)) return;

      var mes = rf.data ? rf.data.substring(0, 7) : null;
      if (!mes || !agg[mes]) return;
      var st = rf.status || 'nao_apropriado';
      agg[mes][st] = (agg[mes][st] || 0) + (rf.valor || 0);
    });
  });

  // Converter para milhões, montar datasets (ordem: topo→base = apropriado→inconsistencia)
  var statusLabels = { 'apropriado':'Apropriado', 'utilizado':'Utilizado', 'nao_apropriado':'Não Apropriado', 'vencido':'Vencido', 'inconsistencia':'Inconsistência' };
  var datasets = statusList.map(function(st) {
    return {
      label: statusLabels[st] || st,
      color: statusCores[st],
      data: mesesISO.map(function(m) { return Math.round((agg[m][st] || 0) / 1e6 * 100) / 100; })
    };
  });

  // Renderizar gráfico de pilha em SVG
  _svgStackedBar('cComposicao', datasets, mesesLabels, 220);

  // Atualizar subtítulo
  var sub = document.getElementById('cComposicao-sub');
  if (sub) {
    sub.textContent = filtro === 'ibs' ? 'R$ milhões · IBS · por status de RF · mês a mês'
                    : filtro === 'cbs' ? 'R$ milhões · CBS · por status de RF · mês a mês'
                    : 'R$ milhões · IBS + CBS · por status de RF · mês a mês';
  }

  // Atualizar estado ativo dos botões de filtro
  ['btn-comp-todos','btn-comp-ibs','btn-comp-cbs'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var ativo = (id === 'btn-comp-todos' && !filtro) ||
                (id === 'btn-comp-ibs'   && filtro === 'ibs') ||
                (id === 'btn-comp-cbs'   && filtro === 'cbs');
    el.style.background = ativo ? 'var(--teal)' : 'transparent';
    el.style.color = ativo ? '#fff' : 'var(--txt2)';
    el.style.borderColor = ativo ? 'var(--teal)' : 'var(--brd)';
  });
};

// Instanciar quando o documento está pronto
document.addEventListener('DOMContentLoaded', function() {
  // Gerar theads das tabelas principais a partir do config SH_TABLES
  ['creditos','debitos','inconsistencias','dashDfCp','dashDfLp','pagamentos','contratos','fornecedores','organizacao'].forEach(window.shRenderThead);

  // Scripts inline executam antes de DOMContentLoaded — delay zero é suficiente
  setTimeout(function() {
    console.log('[data-sync-fixed] Iniciando sincronização');
    const dataSyncFixed = new DataSyncManagerFixed();
    window.dataSyncFixed = dataSyncFixed; // Expor globalmente

    // Função de pós-processamento global — roda após nfListaFiltradaGlobal ser populado
    function _popularFiltrosMes() {
      var mesesSet = {};
      var mesLabels = {
        '2025-10':'out/2025','2025-11':'nov/2025','2025-12':'dez/2025',
        '2026-01':'jan/2026','2026-02':'fev/2026','2026-03':'mar/2026','2026-04':'abr/2026',
        '2026-05':'mai/2026','2026-06':'jun/2026','2026-07':'jul/2026','2026-08':'ago/2026',
        '2026-09':'set/2026','2026-10':'out/2026','2026-11':'nov/2026','2026-12':'dez/2026'
      };
      (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
        (nf.registrosFiscais || []).forEach(function(rf) {
          var mes = (rf.data || '').substring(0, 7);
          if (mes) mesesSet[mes] = true;
        });
      });
      var meses = Object.keys(mesesSet).sort();
      ['pag-mes-ano','cred-mes-ano','deb-mes-ano'].forEach(function(id) {
        var sel = document.getElementById(id);
        if (!sel) return;
        var cur = sel.value;
        sel.innerHTML = '<option value="">Origem fato gerador</option>';
        meses.forEach(function(m) {
          var opt = document.createElement('option');
          opt.value = m;
          opt.textContent = mesLabels[m] || m;
          sel.appendChild(opt);
        });
        if (cur) sel.value = cur;
      });
    }

    function _postProcessarDados() {
      try { window._renderGESelects && window._renderGESelects(); } catch(e) {}
      try { window._enriquecerNFsSaida(); } catch(e) { console.error('[data-sync-fixed] Erro _enriquecerNFsSaida:', e); }
      try {
        // Atribuir cnpjComprador round-robin pelos CNPJs ativos da Induspar
        var _ativosOrg = (window._orgCnpjs || []).filter(function(c) { return c.status === 'ativo'; });
        if (_ativosOrg.length > 0) {
          (window.nfListaFiltradaGlobal || []).forEach(function(nf, i) {
            nf.cnpjComprador = _ativosOrg[i % _ativosOrg.length].cnpj;
          });
        }
        window._nfListaCompleta = (window.nfListaFiltradaGlobal || []).slice();
      } catch(e) {}
      try {
        window._rfIndex = {};
        (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
          (nf.registrosFiscais || []).forEach(function(rf) { window._rfIndex[rf.id] = { rf: rf, nf: nf }; });
        });
      } catch(e) {}
      try { _popularFiltrosMes(); } catch(e) { console.error('[data-sync-fixed] Erro _popularFiltrosMes:', e); }
      try { window.renderizarListaNFs(); } catch(e) {}
      try { window.injetarFiltrosCreditos(); window.renderizarTabelaCreditos(); } catch(e) {}
      try { window.injetarFiltrosPagamentos(); window.renderizarTabelaPagamentos(); } catch(e) {}
      try { window._sincronizarInconsistencias(); } catch(e) {}
      try { window.renderizarRFsInconsistencias(); } catch(e) {}
      try { window.renderizarTop5Inconsistencias(); } catch(e) {}
      try { window.renderizarTop10Empresas(); } catch(e) {}
      try { window.injetarFiltrosDebitos(); window.injetarFiltrosDebitosDFs(); window.renderizarTabelaDebitos(); window.renderizarComposicaoDebitos(''); window.renderizarExtincaoMetodo(); window.atualizarPerdaAcumuladaDebitos(); } catch(e) {}
      try { window.renderizarComposicaoCreditos(''); } catch(e) {}
      try { window.renderizarPagamentosMetodo(); } catch(e) {}
      try { window.atualizarPerdaAcumulada(); } catch(e) {}
      try { window.atualizarKPIsDashboard(); } catch(e) {}
      try { window.atualizarEstatisticasConciliacao(); } catch(e) {}
      try { window.iniciarPaginacaoUniversal(); } catch(e) {}
      try { window.atualizarDashboard(); } catch(e) {}
      try { window.atualizarInteligencia(); } catch(e) {}
    }

    // Tentar chamar nfRenderLista se disponível, caso contrário popula nfListaFiltradaGlobal manualmente
    console.log('[data-sync-fixed] typeof nfRenderLista:', typeof nfRenderLista);
    if (typeof nfRenderLista === 'function') {
      console.log('[data-sync-fixed] Chamando nfRenderLista()');
      try {
        nfRenderLista();
        console.log('[data-sync-fixed] nfRenderLista() concluída com sucesso');
        _postProcessarDados();
      } catch(e) {
        console.error('[data-sync-fixed] Erro ao chamar nfRenderLista():', e);
      }
    } else {
      console.log('[data-sync-fixed] AVISO: nfRenderLista NÃO está disponível');

      // Popula nfListaFiltradaGlobal manualmente com os dados de dataSyncFixed
      if (typeof window !== 'undefined' && window.dataSyncFixed) {
        console.log('[data-sync-fixed] Populando nfListaFiltradaGlobal manualmente...');

        if (typeof nfListaFiltradaGlobal === 'undefined') {
          window.nfListaFiltradaGlobal = [];
        }
        if (typeof nfTotalGlobal === 'undefined') {
          window.nfTotalGlobal = 0;
        }
        // Inicializar contador de RF
        window._rfIdCounter = 0;

        // Geradores locais de Tipo DF e Chave DF (espelham index.html para o path de fallback)
        var _dfTiposLoc=['NF-e','NF-e','NF-e','NFC-e','NFCom','NF3-e','NFS-e','CT-e','CT-e','NFAg','NFGás','MDF-e','BP-e'];
        var _dfModLoc={'NF-e':'55','NFC-e':'65','NFCom':'62','NF3-e':'66','CT-e':'57','NFAg':'01','NFGás':'59','MDF-e':'58','BP-e':'63'};
        function _getTipoDFLoc(numero){var n=parseInt(numero,10)||1;return _dfTiposLoc[n%_dfTiposLoc.length];}
        function _gerarChaveDFLoc(tipoDF,cnpj,numero,data){
          var cnpjD=(cnpj||'').replace(/\D/g,'').padEnd(14,'0').slice(0,14);
          var parts=(data||'2026-01-01').split('-');
          var aamm=(parts[0]||'2026').slice(2)+(parts[1]||'01');
          var seed=parseInt(numero,10)||1;
          var nNF=String(seed).padStart(9,'0');
          var cNF=String((seed*31337+12345)%100000000).padStart(8,'0');
          if(tipoDF==='NFS-e'){
            var cMun='3550308';var cServ=String((seed*7+1)%100000).padStart(5,'0');
            var nNFS=String((seed*137+42)%1000000000000000).padStart(15,'0').slice(0,15);
            var comp=aamm+'01';var dvNFS=String((seed*31+17)%1000).padStart(3,'0');
            return cMun+cServ+nNFS+cnpjD+comp+dvNFS;
          }
          var mod=_dfModLoc[tipoDF]||'55';
          var base='35'+aamm+cnpjD+mod+'001'+nNF+'1'+cNF;
          var w=[2,3,4,5,6,7,8,9];var sum=0;
          for(var i=base.length-1,wi=0;i>=0;i--,wi++)sum+=parseInt(base[i],10)*w[wi%8];
          var rem=sum%11;return base+((rem===0||rem===1)?'0':String(11-rem));
        }

        // Coletar NFs de entrada
        var nfsEntrada = window.dataSyncFixed.getNFsEntrada();
        // Meses para distribuição das NFs (correspondente aos demais gráficos do dashboard)
        var _mesesSpread = ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12'];
        var _diasNoMesEnt = [31,28,31,30,31,30,31,31,30,31,30,31];
        nfsEntrada.forEach(function(nf, idx) {
          var statusCreditos = ['nao_apropriado','nao_apropriado','apropriado','apropriado','apropriado','utilizado','utilizado','utilizado'];
          var statusCred = statusCreditos[idx % statusCreditos.length];

          // Espalhar datas dos RFs pelos 12 meses de 2026
          var mesIdx = (idx * 7 + 3) % 12;
          var maxDiaEnt = _diasNoMesEnt[mesIdx];
          var dia = String(1 + ((idx * 11 + 7) % maxDiaEnt)).padStart(2, '0');
          var dataEfetiva = _mesesSpread[mesIdx] + '-' + dia;

          var valorLiquido = Math.floor(nf.valor / 1.18);
          var cbs = Math.floor(valorLiquido * 0.08);
          var ibs = Math.floor(valorLiquido * 0.10);
          var valorBruto = valorLiquido + cbs + ibs;

          var contrato = buscarContrato(nf.cnpj, dataEfetiva);
          var contratoId = contrato ? contrato.id : null;
          var rad = contrato && contrato.rad !== undefined
            ? contrato.rad
            : (Math.random() < 0.5);
          var metodoPagamento = rad ? 'RAD' : 'Fornecedor';

          var _tipoDFEnt = _getTipoDFLoc(nf.numero);
          var nfRecord = {
            numero: nf.numero,
            tipo: 'entrada',
            subTipo: 'nf',
            tipoDF: _tipoDFEnt,
            entidade: nf.fornecedor,
            cnpj: nf.cnpj,
            valorTotal: valorBruto,
            valorLiquido: valorLiquido,
            cbs: cbs,
            ibs: ibs,
            data: dataEfetiva,
            status: statusCred,
            contratoId: contratoId,
            metodoPagamento: metodoPagamento,
            chaveDF: _gerarChaveDFLoc(_tipoDFEnt, nf.cnpj, nf.numero, dataEfetiva),
            registrosFiscais: []
          };

          var statusSemPagBuild = ['a_apropriar', 'utilizado', 'a_apropriar', 'glosado'];
          var _metExtCred = ['Split Payment','Compensacao','Ressarcimento','Transferencia'];
          function gerarRFPag() {
            var tem = Math.random() < 0.6;
            var dat = '—';
            if (tem) {
              var d = String(Math.floor(Math.random()*28)+1).padStart(2,'0');
              var h = String(Math.floor(Math.random()*24)).padStart(2,'0');
              var m = String(Math.floor(Math.random()*60)).padStart(2,'0');
              dat = d + '/04/2026 ' + h + ':' + m;
            }
            var st = tem ? 'apropriado' : statusSemPagBuild[Math.floor(Math.random() * statusSemPagBuild.length)];
            var metExt = (st === 'utilizado') ? _metExtCred[Math.floor(Math.random() * _metExtCred.length)] : null;
            return { dataPagamento: dat, rfStatus: st, incTipo: null, metodoExtincao: metExt };
          }

          // Criar registro fiscal para IBS
          var pagIBS = gerarRFPag();
          nfRecord.registrosFiscais.push({
            id: 'RF-' + String(++window._rfIdCounter).padStart(8, '0'),
            tipo: 'entrada',
            subTipo: 'fiscal',
            tipoFiscal: 'ibs',
            nfVinculada: nf.numero,
            entidade: nf.fornecedor,
            cnpj: nf.cnpj,
            valor: ibs,
            status: pagIBS.rfStatus,
            statusCredito: pagIBS.rfStatus,
            inconsistencia: pagIBS.incTipo,
            dataPagamento: pagIBS.dataPagamento,
            metodoExtincao: pagIBS.metodoExtincao || null,
            data: dataEfetiva,
            valorTotalNF: valorBruto,
            valorLiquidoNF: valorLiquido,
            contratoId: contratoId,
            metodoPagamento: metodoPagamento
          });

          // Criar registro fiscal para CBS
          var pagCBS = gerarRFPag();
          nfRecord.registrosFiscais.push({
            id: 'RF-' + String(++window._rfIdCounter).padStart(8, '0'),
            tipo: 'entrada',
            subTipo: 'fiscal',
            tipoFiscal: 'cbs',
            nfVinculada: nf.numero,
            entidade: nf.fornecedor,
            cnpj: nf.cnpj,
            valor: cbs,
            status: pagCBS.rfStatus,
            statusCredito: pagCBS.rfStatus,
            inconsistencia: pagCBS.incTipo,
            dataPagamento: pagCBS.dataPagamento,
            metodoExtincao: pagCBS.metodoExtincao || null,
            data: dataEfetiva,
            valorTotalNF: valorBruto,
            valorLiquidoNF: valorLiquido,
            contratoId: contratoId,
            metodoPagamento: metodoPagamento
          });

          window.nfListaFiltradaGlobal.push(nfRecord);
        });

        // Gerar NFs de saída (100 clientes) — datas 2026 inteiro, montante total = 15% acima das entradas (~R$575M)
        var _clientesSaida = ['Eletropar Motores','MercadoNET S.A.','Aeroprime Ind. S.A.','Tectra Sistemas Ltda','Sulpar Implementos S.A.','Bebpar Bebidas S.A.','Lojamax S.A.','Sidepar Aços S.A.','Transcarro S.A.','Essenzia Cosméticos S.A.'];
        var _mesesSaida2026 = ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12'];
        var _statusSaida   = ['extinto','extinto','extinto','extinto','extinto','nao_extinto','nao_extinto','nao_extinto','vencido','inconsistencia'];
        var _metodosSaida  = ['RAD','RAD','Compensacao'];
        // Tipos de DF válidos para saída (Decreto 7.212/2010, LC 214/2025)
        var _tiposDFSaida  = ['NF-e','NF-e','NF-e','NFC-e','CT-e','CT-e','NFCom','NF3-e','BP-e','MDF-e'];

        // Pré-calcular vliq base com variação pseudo-aleatória, depois escalar para sum(valorTotal)=575M
        // Entrada total ≈ R$500M; saída = entrada × 1.15 = R$575M
        // valorTotal = vliq * (1 + ALIQ_IBS + ALIQ_CBS) = vliq * 1.18
        // → sum(vliq) = 575M / 1.18 ≈ 487.288.136
        var _vliqBase = [];
        for (var _sj = 1; _sj <= 100; _sj++) {
          var _seed = (_sj * 73856093 ^ _sj * 19349663 ^ _sj * 83492791) >>> 0;
          _vliqBase.push(500000 + (_seed % 800001)); // range 500K–1.3M
        }
        var _sumVliqBase = _vliqBase.reduce(function(s,v){ return s+v; }, 0);
        var _targetSumVliq = Math.round(500000000 * 1.15 / 1.18);
        var _scaleSaida = _targetSumVliq / _sumVliqBase;

        for (var _si = 1; _si <= 100; _si++) {
          var _vliq   = Math.round(_vliqBase[_si - 1] * _scaleSaida);
          var _cbs    = Math.floor(_vliq * ALIQ_CBS);
          var _ibs    = Math.floor(_vliq * ALIQ_IBS);
          var _vbrut  = _vliq + _cbs + _ibs;
          var _nsNum  = String(_si + 500000).padStart(6, '0');
          // Data: hash multi-semente para distribuição uniforme e aleatória pelos 12 meses
          var _hDate  = ((_si * 1664525 + 1013904223) ^ (_si * 22695477 + 1)) >>> 0;
          var _mesIdx = _hDate % 12;
          var _mes    = _mesesSaida2026[_mesIdx];
          var _diasNoMes = [31,28,31,30,31,30,31,31,30,31,30,31][_mesIdx];
          var _hDia   = ((_si * 6364136223846793005 + 1442695040888963407) ^ _hDate) >>> 0;
          var _dia    = String(1 + (_hDia % _diasNoMes)).padStart(2, '0');
          var _dataS  = _mes + '-' + _dia;
          var _stS    = _statusSaida[(_si - 1) % _statusSaida.length];
          var _metS   = _stS === 'extinto' ? _metodosSaida[(_si - 1) % _metodosSaida.length] : '—';
          var _extDay = String(Math.min(parseInt(_dia) + 5, _diasNoMes)).padStart(2, '0');
          var _mp     = _mes.split('-');
          var _dtExt  = _stS === 'extinto' ? (_extDay + '/' + _mp[1] + '/' + _mp[0] + ' 09:00') : '—';
          var _rfIncTiposIBS = ['Valor IBS divergente','Alíquota IBS incorreta','Prazo de apuração expirado','Split IBS não executado','Comprovante IBS divergente'];
          var _rfIncTiposCBS = ['Valor CBS divergente','Alíquota CBS incorreta','Prazo de apuração expirado','Split CBS não executado','Comprovante CBS divergente'];

          var _tipoDFSai = _tiposDFSaida[(_hDate >> 4) % _tiposDFSaida.length];
          var _cnpjSai = '12.345.678/000' + String(_si % 100).padStart(2, '0');
          var _nfS = {
            numero: _nsNum, tipo: 'saida', subTipo: 'nf',
            tipoDF: _tipoDFSai,
            entidade: _clientesSaida[_si % _clientesSaida.length],
            cnpj: _cnpjSai,
            valorTotal: _vbrut, valorLiquido: _vliq, cbs: _cbs, ibs: _ibs,
            data: _dataS, status: _stS === 'extinto' ? 'extinto' : 'nao_extinto',
            contratoId: null,
            chaveDF: _gerarChaveDFLoc(_tipoDFSai, _cnpjSai, _nsNum, _dataS),
            registrosFiscais: []
          };

          // RF IBS — mesma estrutura de RF de entrada (dataPagamento → dataExtincao, metodoPagamento → metodoExtincao)
          _nfS.registrosFiscais.push({
            id: 'RF-' + String(++window._rfIdCounter).padStart(8, '0'),
            tipo: 'saida', subTipo: 'fiscal', tipoFiscal: 'ibs',
            nfVinculada: _nsNum, entidade: _nfS.entidade, cnpj: _nfS.cnpj,
            valor: _ibs,
            status: _stS,
            inconsistencia: _stS === 'inconsistencia' ? _rfIncTiposIBS[(_si - 1) % _rfIncTiposIBS.length] : null,
            dataExtincao: _dtExt,
            metodoExtincao: _metS,
            contratoId: null,
            data: _dataS,
            valorTotalNF: _vbrut, valorLiquidoNF: _vliq
          });

          // RF CBS — mesma estrutura de RF de entrada
          _nfS.registrosFiscais.push({
            id: 'RF-' + String(++window._rfIdCounter).padStart(8, '0'),
            tipo: 'saida', subTipo: 'fiscal', tipoFiscal: 'cbs',
            nfVinculada: _nsNum, entidade: _nfS.entidade, cnpj: _nfS.cnpj,
            valor: _cbs,
            status: _stS,
            inconsistencia: _stS === 'inconsistencia' ? _rfIncTiposCBS[(_si - 1) % _rfIncTiposCBS.length] : null,
            dataExtincao: _dtExt,
            metodoExtincao: _metS,
            contratoId: null,
            data: _dataS,
            valorTotalNF: _vbrut, valorLiquidoNF: _vliq
          });

          window.nfListaFiltradaGlobal.push(_nfS);
        }

        window.nfTotalGlobal = window.nfListaFiltradaGlobal.length;
        console.log('[data-sync-fixed] nfListaFiltradaGlobal populado com', window.nfListaFiltradaGlobal.length, 'registros');

        // Enriquecer cada RF com tipoNF da NF pai (entrada | saida)
        window.nfListaFiltradaGlobal.forEach(function(nf) {
          (nf.registrosFiscais || []).forEach(function(rf) {
            rf.tipoNF = nf.tipo || 'entrada';
          });
        });

        // Pré-gerar registros de conciliação (apuração + financeira) para todas as DFs
        // para que fiquem disponíveis em históricos de DF e RF antes de o módulo de
        // Conciliação ser visitado pelo usuário
        if (typeof _concBuildLista === 'function') {
          _concBuildLista('');
        }
      }

      _postProcessarDados();
    }

    // Sincronizar a cada 30 segundos
    setInterval(() => {
      dataSyncFixed.sincronizar();
    }, 30000);

    console.log('✓ Sistema de sincronização de dados ativo');
    // Refresh dashboard KPIs after ingestão data is available
    setTimeout(function() {
      try { window.atualizarKPIsDashboard && window.atualizarKPIsDashboard(); } catch(e) {}
    }, 500);
  }, 0);
});

// ============================================================
// GESTÃO ORGANIZAÇÃO — CRUD de CNPJs compradores (Induspar)
// ============================================================

// ── Seletor de Empresa Ativa (Sidebar + Filtro Dashboard) ─────────────────
// _empresasAtivas: array de ids selecionados; vazio = todos

window._empresasAtivas = [];

window._sbLabelAtual = function() {
  var ids = window._empresasAtivas || [];
  if (!ids.length) return null; // todos
  var cnpjs = (window._orgCnpjs || []).filter(function(c) { return ids.indexOf(c.id) >= 0; });
  if (cnpjs.length === 1) return cnpjs[0];
  return { razao: ids.length + ' CNPJs selecionados', cnpj: ids.length + ' estabelecimentos', uf: '', tipo: '' };
};

window._sbAtualizarLabel = function() {
  var ids = window._empresasAtivas || [];
  var nameEl = document.getElementById('co-name');
  var subEl  = document.getElementById('co-cnpj-sub');
  var dashBtn = document.getElementById('cnpj-filter-btn');
  var ahBtn   = document.getElementById('ah-ge-btn');
  if (!ids.length) {
    if (nameEl)  nameEl.textContent  = 'Induspar Tecnologia S.A.';
    if (subEl)   subEl.textContent   = 'Todos os estabelecimentos';
    if (dashBtn) dashBtn.textContent = 'Todos os CNPJs ▾';
    if (ahBtn)   ahBtn.textContent   = 'Grupo Econômico ▾';
  } else if (ids.length === 1) {
    var c = (window._orgCnpjs || []).filter(function(x) { return x.id === ids[0]; })[0];
    if (c) {
      if (nameEl)  nameEl.textContent  = c.razao;
      if (subEl)   subEl.textContent   = c.cnpj + ' · ' + c.uf + ' · ' + c.tipo;
      if (dashBtn) dashBtn.textContent = c.cnpj + ' ▾';
      if (ahBtn)   ahBtn.textContent   = c.razao + ' ▾';
    }
  } else {
    if (nameEl)  nameEl.textContent  = 'Induspar Tecnologia S.A.';
    if (subEl)   subEl.textContent   = ids.length + ' estabelecimentos selecionados';
    if (dashBtn) dashBtn.textContent = ids.length + ' CNPJs ▾';
    if (ahBtn)   ahBtn.textContent   = ids.length + ' CNPJs ▾';
  }
};

window.sbRenderDropdown = function() {
  var lista = document.getElementById('sb-empresa-lista');
  if (!lista) return;
  var ids = window._empresasAtivas || [];
  var allSel = !ids.length;
  var h = '<div onclick="window.sbSelecionarTodos()" style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;background:' + (allSel ? 'rgba(73,197,177,.1)' : 'transparent') + ';border-left:2px solid ' + (allSel ? '#1d9e75' : 'transparent') + '">'
    + '<span style="font-size:13px;color:#1d9e75;width:16px;text-align:center">' + (allSel ? '✓' : '') + '</span>'
    + '<div style="flex:1"><div style="font-size:12px;font-weight:' + (allSel ? '700' : '500') + ';color:var(--txt1)">Todos os estabelecimentos</div>'
    + '<div style="font-size:10px;color:var(--txt2)">Visão consolidada do grupo econômico</div></div></div>';

  (window._orgCnpjs || []).forEach(function(c) {
    var isAt = ids.indexOf(c.id) >= 0;
    var isIn = c.status === 'inativo';
    var tCor = c.tipo === 'Matriz' ? '#1d9e75' : '#185fa5';
    var bgItem = isAt ? 'rgba(73,197,177,.12)' : 'transparent';
    h += '<div onclick="event.stopPropagation();window.sbToggleEmpresaItem(' + c.id + ')" style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;background:' + bgItem + ';border-left:2px solid ' + (isAt ? '#1d9e75' : 'transparent') + ';opacity:' + (isIn ? '0.5' : '1') + ';transition:background .15s">'
      + '<span style="font-size:13px;color:#1d9e75;width:16px;text-align:center;flex-shrink:0">' + (isAt ? '✓' : '') + '</span>'
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-size:12px;font-weight:' + (isAt ? '700' : '500') + ';color:' + (isIn ? 'var(--txt3)' : 'var(--txt1)') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + c.razao + ' <span style="font-size:9px;font-weight:400;color:var(--txt2)">' + c.uf + (isIn ? ' · Inativo' : '') + '</span></div>'
      + '<div style="font-size:10px;color:var(--txt2);font-family:monospace;margin-top:1px">' + c.cnpj + '</div>'
      + '</div>'
      + '<span style="font-size:9px;font-weight:700;color:' + tCor + ';background:rgba(73,197,177,.1);border-radius:3px;padding:1px 5px;flex-shrink:0">' + c.tipo + '</span>'
      + '</div>';
  });
  lista.innerHTML = h;
};

window.sbToggleEmpresa = function(event) {
  event.stopPropagation();
  var dd = document.getElementById('sb-empresa-dropdown');
  if (!dd) return;
  var isOpen = dd.style.display !== 'none';
  if (isOpen) {
    dd.style.display = 'none';
    var ch = document.getElementById('sb-empresa-chevron');
    if (ch) ch.style.transform = '';
  } else {
    window.sbRenderDropdown();
    dd.style.display = 'block';
    var ch = document.getElementById('sb-empresa-chevron');
    if (ch) ch.style.transform = 'rotate(180deg)';
    setTimeout(function() {
      document.addEventListener('click', function _sbClose(e) {
        var el = document.getElementById('sb-empresa-dropdown');
        var btn = document.getElementById('sb-empresa-btn');
        if (el && !el.contains(e.target) && btn && !btn.contains(e.target)) {
          el.style.display = 'none';
          var ch2 = document.getElementById('sb-empresa-chevron');
          if (ch2) ch2.style.transform = '';
          document.removeEventListener('click', _sbClose);
        }
      });
    }, 0);
  }
};

window.sbToggleEmpresaItem = function(id) {
  var ids = window._empresasAtivas || [];
  var idx = ids.indexOf(id);
  if (idx >= 0) { ids.splice(idx, 1); } else { ids.push(id); }
  window._empresasAtivas = ids;
  // re-render ambos os dropdowns sem fechar
  window.sbRenderDropdown();
  window._dashCnpjRenderList();
  window._sbAtualizarLabel();
  window._aplicarFiltroCnpjEmpresa();
};

window.sbSelecionarTodos = function() {
  window._empresasAtivas = [];
  // fechar ambos os dropdowns ao selecionar todos
  var sbDd = document.getElementById('sb-empresa-dropdown');
  if (sbDd) sbDd.style.display = 'none';
  var ch = document.getElementById('sb-empresa-chevron');
  if (ch) ch.style.transform = '';
  var panel = document.getElementById('cnpj-filter-panel');
  if (panel) panel.classList.remove('open');
  window._sbAtualizarLabel();
  window._aplicarFiltroCnpjEmpresa();
};

// Renderiza a lista do filtro GE no dashboard e no header
window._dashCnpjRenderList = function() {
  var ids = window._empresasAtivas || [];
  var allSel = !ids.length;
  var h = '<div onclick="window.sbSelecionarTodos()" class="cnpj-filter-item" style="border-left:2px solid ' + (allSel ? '#1d9e75' : 'transparent') + '">'
    + '<span style="font-size:13px;color:#1d9e75;width:16px;display:inline-block;text-align:center">' + (allSel ? '✓' : '') + '</span>'
    + '<div><div style="font-weight:' + (allSel ? '700' : '500') + ';color:var(--txt1)">Todos os estabelecimentos</div>'
    + '<span class="cfi-cnpj">Visão consolidada do grupo</span></div></div>';
  (window._orgCnpjs || []).forEach(function(c) {
    var isAt = ids.indexOf(c.id) >= 0;
    var isIn = c.status === 'inativo';
    h += '<div onclick="event.stopPropagation();window.sbToggleEmpresaItem(' + c.id + ')" class="cnpj-filter-item" style="background:' + (isAt ? 'rgba(73,197,177,.08)' : '') + ';border-left:2px solid ' + (isAt ? '#1d9e75' : 'transparent') + ';opacity:' + (isIn ? '0.5' : '1') + '">'
      + '<span style="font-size:13px;color:#1d9e75;width:16px;display:inline-block;text-align:center">' + (isAt ? '✓' : '') + '</span>'
      + '<div style="flex:1"><div style="font-weight:' + (isAt ? '700' : '500') + ';color:' + (isIn ? 'var(--txt3)' : 'var(--txt1)') + '">' + c.razao + ' <span style="font-size:9px;color:var(--txt2)">' + c.uf + ' · ' + c.tipo + '</span></div>'
      + '<span class="cfi-cnpj">' + c.cnpj + (isIn ? ' · Inativo' : '') + '</span></div>'
      + '</div>';
  });
  var list = document.getElementById('cnpj-filter-list');
  if (list) list.innerHTML = h;
  var ahList = document.getElementById('ah-ge-list');
  if (ahList) ahList.innerHTML = h;
};

window._aplicarFiltroCnpjEmpresa = function() {
  if (!window._nfListaCompleta) {
    window._nfListaCompleta = (window.nfListaFiltradaGlobal || []).slice();
  }
  var ids = window._empresasAtivas || [];
  if (!ids.length) {
    window.nfListaFiltradaGlobal = window._nfListaCompleta.slice();
  } else {
    var cnpjsSel = (window._orgCnpjs || []).filter(function(c) { return ids.indexOf(c.id) >= 0; }).map(function(c) { return c.cnpj; });
    window.nfListaFiltradaGlobal = (window._nfListaCompleta || []).filter(function(nf) {
      return cnpjsSel.indexOf(nf.cnpjComprador) >= 0;
    });
  }
  try { window._rfIndex = {}; (window.nfListaFiltradaGlobal||[]).forEach(function(nf){ (nf.registrosFiscais||[]).forEach(function(rf){ window._rfIndex[rf.id]={rf:rf,nf:nf}; }); }); } catch(e) {}
  try { window.atualizarDashboard(); } catch(e) {}
  try { window.atualizarKPIsDashboard(); } catch(e) {}
  try { window.renderizarListaNFs(); } catch(e) {}
  try { window.renderizarTabelaCreditos(); } catch(e) {}
  try { window.renderizarTabelaPagamentos(); } catch(e) {}
  try { window.renderizarRFsInconsistencias(); } catch(e) {}
  try { window.renderizarTabelaDebitos(); } catch(e) {}
  try { window.atualizarInteligencia(); } catch(e) {}

  // — filtra arrays mock (impostos/creditos/inconsistencias) por adqCnpj —
  try {
    var _impostosAll = window._impostos_all;
    var _creditosAll = window._creditos_all;
    var _inconsistAll = window._inconsistencias_all;
    if (_impostosAll && _creditosAll && _inconsistAll) {
      if (!cnpjsSel || !cnpjsSel.length) {
        window.impostos = _impostosAll.slice();
        window.creditos = _creditosAll.slice();
        window.inconsistencias = _inconsistAll.slice();
      } else {
        var _flt = function(arr){ return arr.filter(function(r){ return cnpjsSel.indexOf(r.adqCnpj) >= 0; }); };
        window.impostos = _flt(_impostosAll);
        window.creditos = _flt(_creditosAll);
        window.inconsistencias = _flt(_inconsistAll);
      }
    }
  } catch(e) {}

  // — re-renderiza módulo ativo —
  try {
    var _av = document.querySelector('.view.active');
    if (_av) {
      var _vid = _av.id.replace('view-','');
      if (_vid === 'pagamentos') {
        if (window.pagamentosRenderKPIs) pagamentosRenderKPIs();
        var _h=''; var _imp=window.impostos||[];
        for(var _i=0;_i<_imp.length;_i++){var _r=_imp[_i];var _act=['pendente','vencendo','atrasado'].indexOf(_r.status)>=0?'<button class="btn btn-t" style="font-size:11px;padding:4px 10px">Pagar via Pix</button>':'<span style="color:var(--txt3)">Concluído</span>';_h+='<tr><td class="mono nowrap" style="color:var(--txt3)">'+_r.id+'</td><td class="mono nowrap" style="color:var(--blue);cursor:pointer;text-decoration:underline dotted" onclick="if(window.abrirDetalheRF)window.abrirDetalheRF(\''+_r.rfId+'\')">'+_r.rf+'</td><td class="trunc"><div style="font-weight:500">'+_r.forn+'</div><div style="font-size:10px;color:var(--txt3)">'+_r.cnpj+'</div></td><td class="nowrap"><span class="tyb">'+_r.tipo+'</span></td><td class="r mono" style="font-weight:600">'+ff(_r.valor)+'</td><td class="nowrap">'+_r.venc+'</td><td class="nowrap">'+bdg(_r.status)+'</td><td class="nowrap">'+_act+'</td></tr>';}
        var _ti=document.getElementById('t-impostos');if(_ti)_ti.innerHTML=_h;
      }
      if (_vid === 'creditos') { if(window.creditosRenderKPIs)creditosRenderKPIs(); if(window.creditosRenderTabela)creditosRenderTabela(); }
      if (_vid === 'inconsistencias') { try{inconsistRenderDashboard();}catch(e){} try{inconsistRenderTabela();}catch(e){} }
      if (_vid === 'fornecedores' || _vid === 'admin') { if(window.fornecedoresRenderKPIs)fornecedoresRenderKPIs(); if(window.adminFornRenderKPIs)adminFornRenderKPIs(); if(window.adminFornRenderTable)adminFornRenderTable(); }
      if (_vid === 'dashboard') { try{buildCharts();}catch(e){} try{dashRenderCreditKPIs();}catch(e){} }
    }
  } catch(e) {}

  // — atualiza painel GE do header —
  try { if(window._dashCnpjRenderList) window._dashCnpjRenderList(); } catch(e) {}
};

// ── Filtro Grupo Econômico — aparece no header de cada módulo ──────────────

window._renderGESelects = function() {
  var opts = '<option value="">Grupo Econômico — Todos</option>';
  (window._orgCnpjs || []).forEach(function(c) {
    var label = c.uf + ' · ' + c.tipo + ' · ' + c.cnpj;
    if (c.status === 'inativo') label += ' (inativo)';
    opts += '<option value="' + c.id + '">' + label + '</option>';
  });
  document.querySelectorAll('.ge-filter').forEach(function(sel) {
    var cur = sel.value;
    sel.innerHTML = opts;
    sel.value = cur;
  });
};

window.filtrarGrupoEconomico = function(id) {
  window._empresasAtivas = id ? [parseInt(id, 10)] : [];
  // Sincroniza todos os ge-filter selects
  document.querySelectorAll('.ge-filter').forEach(function(sel) { sel.value = id; });
  // Sincroniza dropdown dashboard
  try { window._sbAtualizarLabel(); } catch(e) {}
  window._aplicarFiltroCnpjEmpresa();
};

// Repopular filtro dashboard com CNPJs da organização
window.dashCnpjToggleDropdown = function(event) {
  event.stopPropagation();
  var panel = document.getElementById('cnpj-filter-panel');
  if (!panel) return;
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) {
    window._dashCnpjRenderList();
    document.addEventListener('click', function _ddClose(e) {
      var filter = document.getElementById('cnpj-filter');
      if (filter && !filter.contains(e.target)) {
        panel.classList.remove('open');
        document.removeEventListener('click', _ddClose);
      }
    });
  }
};

// ── Gestão Organização — CNPJs compradores (Induspar) ──────────────────────

window._orgCnpjs = [
  // ── Grupo Induspar (raiz 54.891.237) ───────────────────────────────
  { id:1, cnpj:'54.891.237/0001-48', razao:'Induspar Tecnologia S.A.', ie:'9029-6',     uf:'PR', tipo:'Matriz', status:'ativo',   grupoId:'g-induspar', grupoNome:'Grupo Induspar' },
  { id:2, cnpj:'54.891.237/0002-29', razao:'Induspar Tecnologia S.A.', ie:'9029-6/002', uf:'SP', tipo:'Filial', status:'ativo',   grupoId:'g-induspar', grupoNome:'Grupo Induspar' },
  { id:3, cnpj:'54.891.237/0003-00', razao:'Induspar Tecnologia S.A.', ie:'9029-6/003', uf:'MG', tipo:'Filial', status:'ativo',   grupoId:'g-induspar', grupoNome:'Grupo Induspar' },
  { id:4, cnpj:'54.891.237/0004-81', razao:'Induspar Tecnologia S.A.', ie:'9029-6/004', uf:'SC', tipo:'Filial', status:'inativo', grupoId:'g-induspar', grupoNome:'Grupo Induspar' },
  { id:5, cnpj:'54.891.237/0005-62', razao:'Induspar Tecnologia S.A.', ie:'9029-6/005', uf:'RJ', tipo:'Filial', status:'ativo',   grupoId:'g-induspar', grupoNome:'Grupo Induspar' },
  { id:6, cnpj:'54.891.237/0006-43', razao:'Induspar Tecnologia S.A.', ie:'9029-6/006', uf:'RS', tipo:'Filial', status:'ativo',   grupoId:'g-induspar', grupoNome:'Grupo Induspar' },
  { id:7, cnpj:'54.891.237/0007-24', razao:'Induspar Tecnologia S.A.', ie:'9029-6/007', uf:'BA', tipo:'Filial', status:'ativo',   grupoId:'g-induspar', grupoNome:'Grupo Induspar' },
  // ── Systec Digital (raiz 67.432.109) — coligada com raiz CNPJ distinta ─
  { id:8, cnpj:'67.432.109/0001-73', razao:'Systec Digital Ltda.',      ie:'SY-0001',    uf:'SP', tipo:'Matriz', status:'ativo',   grupoId:'g-induspar', grupoNome:'Grupo Induspar' },
  { id:9, cnpj:'67.432.109/0002-54', razao:'Systec Digital Ltda.',      ie:'SY-0002',    uf:'PR', tipo:'Filial', status:'ativo',   grupoId:'g-induspar', grupoNome:'Grupo Induspar' },
];
window._orgNextId = 8;
window._orgEditId = null;

window.orgRenderTabela = function() {
  var busca = (document.getElementById('org-busca')||{value:''}).value.toLowerCase();
  var filtUF = (document.getElementById('org-filtro-uf')||{value:''}).value;
  var filtTipo = (document.getElementById('org-filtro-tipo')||{value:''}).value;
  var filtStatus = (document.getElementById('org-filtro-status')||{value:''}).value;

  var lista = (window._orgCnpjs || []).filter(function(r) {
    if (busca && !(r.cnpj+' '+r.razao+' '+r.ie).toLowerCase().includes(busca)) return false;
    if (filtUF && r.uf !== filtUF) return false;
    if (filtTipo && r.tipo !== filtTipo) return false;
    if (filtStatus && r.status !== filtStatus) return false;
    return true;
  });

  var ativos = (window._orgCnpjs||[]).filter(function(r){return r.status==='ativo';}).length;
  var matrizes = (window._orgCnpjs||[]).filter(function(r){return r.tipo==='Matriz';}).length;
  var filiais = (window._orgCnpjs||[]).filter(function(r){return r.tipo==='Filial';}).length;
  function setEl(id,v){var e=document.getElementById(id);if(e)e.textContent=v;}
  setEl('org-total',  window._orgCnpjs.length);
  setEl('org-ativos', ativos);
  setEl('org-matrizes', matrizes);
  setEl('org-filiais', filiais);
  setEl('org-ativos-sub', ativos + ' de ' + window._orgCnpjs.length + ' habilitados');
  setEl('org-count-sub', lista.length + ' CNPJ' + (lista.length!==1?'s':'') + ' exibido' + (lista.length!==1?'s':''));

  var tbody = document.getElementById('t-org-cnpjs');
  if (!tbody) return;
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--txt3)">Nenhum CNPJ encontrado com os filtros aplicados.</td></tr>';
    return;
  }
  // Agrupar por grupoId (suporta CNPJs com raízes distintas no mesmo grupo)
  var _orgGruposVis = [];
  var _orgGrupoMap = {};
  lista.forEach(function(r) {
    var gid = r.grupoId || 'sem-grupo';
    if (!_orgGrupoMap[gid]) { _orgGrupoMap[gid] = []; _orgGruposVis.push(gid); }
    _orgGrupoMap[gid].push(r);
  });

  var rows = '';
  _orgGruposVis.forEach(function(gid) {
    var membros = _orgGrupoMap[gid];
    var gnome = membros[0].grupoNome || gid;
    // Raízes distintas no grupo
    var raizes = [];
    membros.forEach(function(m) { var r = m.cnpj.substring(0,10); if (raizes.indexOf(r) < 0) raizes.push(r); });
    var raizLabel = raizes.length > 1 ? raizes.length + ' raízes CNPJ' : 'raiz ' + raizes[0];
    rows += '<tr style="background:rgba(96,165,250,.06);border-top:2px solid rgba(96,165,250,.2)">'
      + '<td colspan="7" style="padding:8px 14px">'
      + '<div style="display:flex;align-items:center;gap:10px">'
      + '<span style="background:rgba(96,165,250,.15);color:var(--blue);border:1px solid rgba(96,165,250,.3);border-radius:4px;padding:2px 9px;font-size:10px;font-weight:700;letter-spacing:.06em">GRUPO</span>'
      + '<span style="font-size:13px;font-weight:700;color:var(--txt1)">'+gnome+'</span>'
      + '<span style="font-size:11px;color:var(--txt3)">'+membros.length+' CNPJs · '+raizLabel+'</span>'
      + '</div></td></tr>';
    membros.forEach(function(r) {
      var sCor   = r.status === 'ativo' ? '#1d9e75' : 'var(--txt3)';
      var sSrgb  = r.status === 'ativo' ? '29,158,117' : '167,168,170';
      var sLabel = r.status === 'ativo' ? 'Ativo' : 'Inativo';
      var tipoCor = r.tipo === 'Matriz' ? '#60A5FA' : '#A78BFA';
      var tipoSrgb = r.tipo === 'Matriz' ? '96,165,250' : '167,139,250';
      rows += '<tr>'
        + '<td class="mono" style="font-size:11px">' + r.cnpj + '</td>'
        + '<td style="font-size:12px;font-weight:500;color:var(--txt1)">' + r.razao + '</td>'
        + '<td class="mono" style="font-size:11px">' + r.ie + '</td>'
        + '<td><span style="font-size:11px;font-weight:700;color:var(--txt2)">' + r.uf + '</span></td>'
        + '<td><span style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:2px 7px;border-radius:3px;border:1px solid rgba('+tipoSrgb+',.3);color:'+tipoCor+';background:transparent">' + r.tipo + '</span></td>'
        + '<td><span style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:2px 7px;border-radius:3px;border:1px solid rgba('+sSrgb+',.3);color:'+sCor+';background:transparent">' + sLabel + '</span></td>'
        + '<td style="text-align:center;white-space:nowrap">'
        + '<button onclick="window.orgAbrirModal(' + r.id + ')" style="background:none;border:1px solid var(--brd);border-radius:5px;padding:3px 10px;font-size:11px;color:var(--txt2);cursor:pointer;margin-right:6px">✏ Editar</button>'
        + '<button onclick="window.orgAbrirDet(' + r.id + ')" style="background:none;border:1px solid var(--brd);border-radius:5px;padding:3px 10px;font-size:11px;color:var(--txt2);cursor:pointer;margin-right:6px">⊙ Detalhes</button>'
        + '<button onclick="window.orgExcluir(' + r.id + ')" style="background:none;border:1px solid rgba(244,63,94,.4);border-radius:5px;padding:3px 10px;font-size:11px;color:var(--red);cursor:pointer">✕</button>'
        + '</td></tr>';
    });
  });
  tbody.innerHTML = rows || '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--txt3)">Nenhum CNPJ encontrado.</td></tr>';
};

window.orgAbrirModal = function(id) {
  window._orgEditId = id;
  var r = id ? (window._orgCnpjs||[]).find(function(x){return x.id===id;}) : null;
  var ov = document.getElementById('org-modal-overlay');
  if (!ov) return;
  document.getElementById('org-modal-titulo').textContent = id ? 'Editar CNPJ' : 'Novo CNPJ';
  document.getElementById('org-form-cnpj').value   = r ? r.cnpj   : '';
  document.getElementById('org-form-razao').value  = r ? r.razao  : '';
  document.getElementById('org-form-ie').value     = r ? r.ie     : '';
  document.getElementById('org-form-uf').value     = r ? r.uf     : 'PR';
  document.getElementById('org-form-tipo').value   = r ? r.tipo   : 'Filial';
  document.getElementById('org-form-status').value = r ? r.status : 'ativo';
  ov.style.display = 'flex';
};

window.orgFecharModal = function() {
  var ov = document.getElementById('org-modal-overlay');
  if (ov) ov.style.display = 'none';
  window._orgEditId = null;
};

// ── Auditoria de organização ─────────────────────────────────────────
if (!window._orgAudit) window._orgAudit = {};

// Seed auditoria para CNPJs pré-carregados
(function() {
  var _seedDatas = [
    '10/01/2025 às 08:30:00','15/02/2025 às 10:15:22','20/03/2025 às 14:42:07',
    '05/04/2025 às 09:00:55','12/05/2025 às 11:33:40','18/06/2025 às 16:05:18','22/07/2025 às 08:50:30'
  ];
  (window._orgCnpjs || []).forEach(function(r, i) {
    var key = 'org_' + r.id;
    if (!window._orgAudit[key]) {
      window._orgAudit[key] = [{
        acao: 'Cadastro criado',
        data: _seedDatas[i % _seedDatas.length],
        usuario: 'Migração inicial',
        campos: { cnpj: r.cnpj, razao: r.razao, ie: r.ie, uf: r.uf, tipo: r.tipo, status: r.status }
      }];
    }
  });
})();

window.orgAbrirDet = function(id) {
  var r = (window._orgCnpjs || []).find(function(x) { return x.id === id; });
  if (!r) return;
  var tipoCor = r.tipo === 'Matriz' ? '#8B5CF6' : '#A7A8AA';
  var sCor = r.status === 'ativo' ? 'var(--teal)' : 'var(--txt3)';
  var sLabel = r.status === 'ativo' ? 'Ativo' : 'Inativo';
  document.getElementById('org-det-title').textContent = r.razao;
  document.getElementById('org-det-sub').textContent = 'CNPJ: ' + r.cnpj;
  function row(lbl, val) {
    return '<div style="display:flex;gap:8px;padding:9px 0;border-bottom:1px solid var(--border)">'
      + '<span style="min-width:160px;font-size:11px;color:var(--txt3);text-transform:uppercase;letter-spacing:.05em;line-height:1.6">' + lbl + '</span>'
      + '<span style="font-size:13px;color:var(--txt1);font-weight:500">' + val + '</span></div>';
  }
  var campos = '<div style="margin-bottom:22px">'
    + '<div style="font-size:12px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Dados cadastrais</div>'
    + row('CNPJ', '<span class="mono">' + r.cnpj + '</span>')
    + row('Razão social', r.razao)
    + row('Inscrição Estadual', r.ie || '—')
    + row('UF', r.uf)
    + row('Tipo', '<span style="background:' + tipoCor + '22;color:' + tipoCor + ';border:1px solid ' + tipoCor + '44;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">' + r.tipo + '</span>')
    + row('Status', '<span style="color:' + sCor + ';font-weight:600">' + sLabel + '</span>')
    + '</div>';
  var key = 'org_' + r.id;
  var audit = (window._orgAudit[key] || []);
  var auditHtml = '<div><div style="font-size:12px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">Histórico de auditoria</div>';
  if (!audit.length) {
    auditHtml += '<div style="font-size:12px;color:var(--txt3);padding:16px 0">Nenhum registro de auditoria disponível.</div>';
  } else {
    auditHtml += '<div style="display:flex;flex-direction:column;gap:12px">';
    [].concat(audit).reverse().forEach(function(ev, i, arr) {
      var icon = ev.acao.indexOf('criado') !== -1 ? '🗂' : '✏️';
      var camposHtml = '';
      if (ev.campos && typeof ev.campos === 'object') {
        Object.keys(ev.campos).forEach(function(k) {
          var v = ev.campos[k];
          if (v && typeof v === 'object' && 'de' in v) {
            camposHtml += '<div style="margin-top:4px;font-size:11px;color:var(--txt3)"><b style="color:var(--txt2)">' + k + ':</b> '
              + '<span style="text-decoration:line-through;color:var(--red)">' + v.de + '</span>'
              + ' → <span style="color:var(--teal)">' + v.para + '</span></div>';
          } else {
            camposHtml += '<div style="margin-top:4px;font-size:11px;color:var(--txt3)"><b style="color:var(--txt2)">' + k + ':</b> ' + String(v) + '</div>';
          }
        });
      }
      auditHtml += '<div style="display:flex;gap:12px;align-items:flex-start">'
        + '<div style="display:flex;flex-direction:column;align-items:center">'
        + '<div style="width:32px;height:32px;border-radius:50%;background:' + (i===0?'var(--teal)':'var(--bg)') + ';border:2px solid ' + (i===0?'var(--teal)':'var(--border)') + ';display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0">' + icon + '</div>'
        + (i < arr.length - 1 ? '<div style="width:2px;flex:1;min-height:20px;background:var(--border);margin-top:4px"></div>' : '')
        + '</div>'
        + '<div style="flex:1;padding-bottom:8px">'
        + '<div style="font-size:13px;font-weight:600;color:var(--txt1)">' + ev.acao + '</div>'
        + '<div style="font-size:11px;color:var(--txt3);margin-top:2px">' + ev.data + ' · ' + ev.usuario + '</div>'
        + camposHtml + '</div></div>';
    });
    auditHtml += '</div>';
  }
  auditHtml += '</div>';
  document.getElementById('org-det-body').innerHTML = campos + auditHtml;
  document.getElementById('org-det-overlay').style.display = 'flex';
};

window.orgFecharDet = function() {
  var ov = document.getElementById('org-det-overlay');
  if (ov) ov.style.display = 'none';
};

window.orgSalvar = function() {
  var cnpj   = (document.getElementById('org-form-cnpj')||{value:''}).value.trim();
  var razao  = (document.getElementById('org-form-razao')||{value:''}).value.trim();
  var ie     = (document.getElementById('org-form-ie')||{value:''}).value.trim();
  var uf     = (document.getElementById('org-form-uf')||{value:'PR'}).value;
  var tipo   = (document.getElementById('org-form-tipo')||{value:'Filial'}).value;
  var status = (document.getElementById('org-form-status')||{value:'ativo'}).value;
  if (!cnpj || !razao) { alert('CNPJ e Razão Social são obrigatórios.'); return; }
  var agora = new Date();
  var ts = agora.toLocaleDateString('pt-BR') + ' às ' + agora.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  if (!window._orgAudit) window._orgAudit = {};
  var id = window._orgEditId;
  if (id) {
    var idx = (window._orgCnpjs||[]).findIndex(function(x){return x.id===id;});
    if (idx > -1) {
      var old = window._orgCnpjs[idx];
      var alteracoes = {};
      if (old.razao !== razao) alteracoes.razao = {de: old.razao, para: razao};
      if (old.ie !== ie)       alteracoes.ie    = {de: old.ie,    para: ie};
      if (old.uf !== uf)       alteracoes.uf    = {de: old.uf,    para: uf};
      if (old.tipo !== tipo)   alteracoes.tipo  = {de: old.tipo,  para: tipo};
      if (old.status !== status) alteracoes.status = {de: old.status, para: status};
      window._orgCnpjs[idx] = {id:id, cnpj:cnpj, razao:razao, ie:ie, uf:uf, tipo:tipo, status:status};
      var key = 'org_' + id;
      if (!window._orgAudit[key]) window._orgAudit[key] = [];
      window._orgAudit[key].push({acao:'Cadastro editado', data:ts, usuario:'Usuário atual', campos:alteracoes});
    }
  } else {
    var newId = window._orgNextId++;
    window._orgCnpjs.push({id:newId, cnpj:cnpj, razao:razao, ie:ie, uf:uf, tipo:tipo, status:status});
    var key2 = 'org_' + newId;
    window._orgAudit[key2] = [{acao:'Cadastro criado', data:ts, usuario:'Usuário atual', campos:{cnpj:cnpj, razao:razao, ie:ie, uf:uf, tipo:tipo, status:status}}];
  }
  window.orgFecharModal();
  window.orgRenderTabela();
};

window.orgExcluir = function(id) {
  if (!confirm('Remover este CNPJ da organização?')) return;
  window._orgCnpjs = (window._orgCnpjs||[]).filter(function(x){return x.id!==id;});
  window.orgRenderTabela();
};

// ============================================================
// DASHBOARD — Filtro de mês (Visão Geral)
// ============================================================

// pct = % de créditos não apropriados (nao_apropriado + inconsistencia + vencido) sobre total
// usado como fallback para meses sem dados reais
var _dashMeses = {
  '01':{ label:'Janeiro 2026',   aprop:'R$ 38,1M', apropriar:'R$ 3,8M',  risco:'R$ 1,8M', aliq:'9,14%', delta:'4,26 pp',  upAprop:'▲ 4,2%', upApropriar:'▼ 8,3%',  pct:'32,3%' },
  '02':{ label:'Fevereiro 2026', aprop:'R$ 41,3M', apropriar:'R$ 3,0M',  risco:'R$ 2,1M', aliq:'9,18%', delta:'4,22 pp',  upAprop:'▲ 5,1%', upApropriar:'▼ 9,1%',  pct:'28,9%' },
  '03':{ label:'Março 2026',     aprop:'R$ 47,9M', apropriar:'R$ 2,4M',  risco:'R$ 3,4M', aliq:'9,21%', delta:'4,19 pp',  upAprop:'▲ 5,8%', upApropriar:'▼ 10,4%', pct:'21,8%' },
  '04':{ label:'Abril 2026',     aprop:'R$ 54,3M', apropriar:'R$ 3,0M',  risco:'R$ 5,2M', aliq:'9,27%', delta:'4,13 pp',  upAprop:'▲ 6,8%', upApropriar:'▼ 12,1%', pct:'29,2%' },
  '05':{ label:'Maio 2026',      aprop:'R$ 49,8M', apropriar:'R$ 8,9M',  risco:'R$ 4,1M', aliq:'9,24%', delta:'4,16 pp',  upAprop:'▲ 3,2%', upApropriar:'▼ 7,8%',  pct:'20,5%' },
  '06':{ label:'Junho 2026',     aprop:'R$ 52,1M', apropriar:'R$ 9,4M',  risco:'R$ 3,7M', aliq:'9,22%', delta:'4,18 pp',  upAprop:'▲ 4,7%', upApropriar:'▼ 8,5%',  pct:'21,3%' },
  '07':{ label:'Julho 2026',     aprop:'R$ 45,6M', apropriar:'R$ 11,1M', risco:'R$ 2,9M', aliq:'9,19%', delta:'4,21 pp',  upAprop:'▲ 2,9%', upApropriar:'▼ 9,7%',  pct:'22,8%' },
  '08':{ label:'Agosto 2026',    aprop:'R$ 48,3M', apropriar:'R$ 10,6M', risco:'R$ 3,2M', aliq:'9,23%', delta:'4,17 pp',  upAprop:'▲ 3,8%', upApropriar:'▼ 10,2%', pct:'21,7%' },
  '09':{ label:'Setembro 2026',  aprop:'R$ 51,7M', apropriar:'R$ 8,4M',  risco:'R$ 4,8M', aliq:'9,25%', delta:'4,15 pp',  upAprop:'▲ 5,4%', upApropriar:'▼ 11,3%', pct:'23,4%' },
  '10':{ label:'Outubro 2026',   aprop:'R$ 56,2M', apropriar:'R$ 6,8M',  risco:'R$ 5,9M', aliq:'9,29%', delta:'4,11 pp',  upAprop:'▲ 7,3%', upApropriar:'▼ 13,2%', pct:'25,1%' },
  '11':{ label:'Novembro 2026',  aprop:'R$ 58,9M', apropriar:'R$ 5,9M',  risco:'R$ 6,7M', aliq:'9,31%', delta:'4,09 pp',  upAprop:'▲ 8,1%', upApropriar:'▼ 14,7%', pct:'24,6%' },
  '12':{ label:'Dezembro 2026',  aprop:'R$ 61,4M', apropriar:'R$ 4,7M',  risco:'R$ 7,3M', aliq:'9,34%', delta:'4,06 pp',  upAprop:'▲ 9,4%', upApropriar:'▼ 16,3%', pct:'23,2%' },
};

// Calcula % de créditos não apropriados (nao_apropriado + inconsistencia + vencido) sobre o total
// para o mês informado (formato '04' = abril 2026). Retorna null se sem dados.
function _dashComputarApropriarPct(mes) {
  var prefix = '2026-' + mes;
  var total = 0, bad = 0, badVal = 0;
  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'entrada') return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      if (!(rf.data || '').startsWith(prefix)) return;
      var v = rf.valor || 0;
      total += v;
      var _scD = rf.statusCredito || rf.status || '';
      var _srD = rf.statusRegistro || null;
      var isBad = _scD === 'nao_apropriado' || _srD === 'inconsistencia' || _srD === 'vencido' || _srD === 'em_risco' || _srD === 'a_prescrever';
      if (isBad) { bad += v; badVal += v; }
    });
  });
  if (total === 0) return null;
  var pct = (bad / total * 100);
  var pctStr = pct.toFixed(1).replace('.', ',') + '%';
  var fmM = function(v) { return 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M'; };
  return { pct: pctStr, valor: fmM(badVal), total: fmM(total) };
}

window.dashFiltrarMes = function(mes) {
  var d = _dashMeses[mes];
  if (!d) return;
  function setEl(id,v){var e=document.getElementById(id);if(e)e.textContent=v;}

  setEl('dash-cred-aprop-sub',  d.upAprop + ' — Apropriados via Plataforma');
  setEl('dash-periodo-sub', 'Período: ' + d.label + ' · Última atualização: 24/' + mes + '/2026 às 11:47');

  // KPIs de crédito calculados dos dados reais filtrados pelo mês
  if (window.atualizarKPIsDashboard) window.atualizarKPIsDashboard();

  // Fallback para meses sem dados reais
  var computed = _dashComputarApropriarPct(mes);
  if (!computed) {
    setEl('dash-cred-aprop',    d.aprop);
    setEl('dash-cred-risco',    d.risco);
    setEl('dash-cred-apropriar', d.pct);
    setEl('dash-cred-apropriar-sub', d.upApropriar + ' — ' + d.apropriar + ' não apropriados');
  }

  // Atualizar alíquota efetiva
  var kval = document.querySelector('#view-dashboard .kgrid .kcard:last-child .kval');
  if (kval) kval.textContent = d.aliq;
  var ksub = document.querySelector('#view-dashboard .kgrid .kcard:last-child .ksub');
  if (ksub) ksub.textContent = '▼ ' + d.delta + ' abaixo da alíquota de mercado';
  var labels = document.querySelectorAll('#view-dashboard .kgrid .kcard:last-child [style*="Efetiva"]');
  labels.forEach(function(el){ el.textContent = 'Efetiva ' + d.aliq; });
};

// ── DASHBOARD LINKS → Créditos e Pagamentos ──────────────────────────────

window.dashIrParaCreditos = function() {
  var btn = document.querySelector('.nav-btn[onclick*="creditos"]');
  if (typeof showView === 'function') showView('creditos', btn);
  // Limpar filtros — card mostra visão geral do módulo
  creditosFiltroStatus = null;
  creditosFiltroForn   = null;
  var chip = document.getElementById('creditos-filtro-chip');
  if (chip) chip.style.display = 'none';
  if (typeof creditosRenderTabela === 'function') creditosRenderTabela();
  setTimeout(function() {
    if (typeof _credIrListagem === 'function') _credIrListagem();
  }, 100);
};

window.dashIrParaPagamentosRisco = function() {
  var btn = document.querySelector('.nav-btn[onclick*="pagamentos"]');
  if (typeof showView === 'function') showView('pagamentos', btn);
  // Filtrar por pendente (a vencer / atrasados) — detalhe destacado no card
  if (!window._filtrosPagamentos) window._filtrosPagamentos = {};
  window._filtrosPagamentos.status = 'pendente';
  var sel = document.getElementById('pag-filtro-status');
  if (sel) sel.value = 'pendente';
  if (window.renderizarTabelaPagamentos) window.renderizarTabelaPagamentos();
  if (window.atualizarKPIsPagamentos) window.atualizarKPIsPagamentos();
  if (window.renderizarEvolucaoAcumuladaCreditos) window.renderizarEvolucaoAcumuladaCreditos();
};

window.dashIrParaDebitos = function() {
  var btn = document.querySelector('.nav-btn[onclick*="debitos"]');
  if (typeof showView === 'function') showView('debitos', btn);
  // Filtrar por vencido — detalhe destacado no card
  if (!window._filtrosDebitos) window._filtrosDebitos = {};
  window._filtrosDebitos.status = 'vencido';
  var sel = document.getElementById('fd-status');
  if (sel) sel.value = 'vencido';
  if (window.renderizarTabelaDebitos) window.renderizarTabelaDebitos();
};

window.dashIrParaConciliacao = function() {
  var btn = document.querySelector('.nav-btn[onclick*="conciliacao"]');
  if (typeof showView === 'function') showView('conciliacao', btn);
  try { if (window.conciliacaoInit) window.conciliacaoInit(); } catch(e) {}
};

window.dashIrParaInconsistencias = function() {
  var btn = document.getElementById('nav-inconsist-btn') || document.querySelector('.nav-btn[onclick*="inconsist"]');
  if (typeof showView === 'function') showView('inconsistencias', btn);
  try { if (window.ingestaoInit) window.ingestaoInit(); } catch(e) {}
  try { if (window.renderizarRFsInconsistencias) window.renderizarRFsInconsistencias(); } catch(e) {}
};

/* ── MODAL GUIA DARF/IBS ── */

function _darfRng(seed) {
  var s = (seed ^ 0xDEADBEEF) >>> 0;
  return function() {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
    s = (s ^ (s >>> 16)) >>> 0;
    return s / 0xffffffff;
  };
}

function _darfSeed(str) {
  var h = 5381;
  for (var i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function _darfFmt(v) {
  return 'R$ ' + v.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
}

window.abrirGuiaDARF = function(idx) {
  var r = (window._pagImpRows || [])[idx];
  if (!r) return;

  var isIBS    = r.tipo === 'Guia IBS';
  var codRec   = isIBS ? '6912' : '5952';
  var nomeTrib = isIBS ? 'IBS — Imposto sobre Bens e Serviços' : 'CBS — Contribuição sobre Bens e Serviços';
  var seed     = _darfSeed(r.rfId || r.rf || String(idx));
  var rng      = _darfRng(seed);

  var docNum   = String(Math.floor(rng() * 900000000) + 100000000);
  var dp       = (r.dataRFIso || '').split('-');
  var periodo  = dp.length === 3 ? dp[1] + '/' + dp[0] : '—';
  var vencimento = '—';
  if (dp.length === 3) {
    var dv2 = new Date(+dp[0], +dp[1] - 1, +dp[2] + 15);
    vencimento = String(dv2.getDate()).padStart(2,'0') + '/' + String(dv2.getMonth()+1).padStart(2,'0') + '/' + dv2.getFullYear();
  }

  var s1 = codRec + '0' + String(Math.floor(rng()*99999+10000));
  var s2 = String(Math.floor(rng()*9999999+1000000)) + '0';
  var s3 = String(Math.floor(rng()*9999999+1000000)) + '0';
  var dvN  = String(Math.floor(rng() * 9) + 1);
  var val14 = String(Math.round(r.valor * 100)).padStart(14, '0');
  var linha = s1.substring(0,5) + '.' + s1.substring(5) + ' ' +
              s2.substring(0,6) + '.' + s2.substring(6) + ' ' +
              s3.substring(0,6) + '.' + s3.substring(6) + ' ' +
              dvN + ' ' + val14;

  var valorStr = r.valor.toFixed(2);
  var pixPayload = '00020126580014br.gov.bcb.pix0136' +
    docNum.substring(0,8) + '-' + codRec + '-' + (dp[0]||'2026') + (dp[1]||'01') +
    '5204' + codRec + '5303986' +
    '54' + String(valorStr.length).padStart(2,'0') + valorStr +
    '5802BR5920RECEITA FEDERAL BR6008BRASILIA' +
    (isIBS ? '62070904IBS' : '62080804DARF') +
    '6304' + Math.floor(rng()*0xFFFF).toString(16).toUpperCase().padStart(4,'0');

  var badge = document.getElementById('darf-tipo-badge');
  badge.textContent = isIBS ? 'Guia IBS' : 'DARF CBS';
  badge.style.cssText = isIBS
    ? 'display:inline-block;border-radius:4px;padding:2px 10px;font-size:11px;font-weight:700;letter-spacing:.04em;margin-bottom:8px;background:rgba(24,95,165,.15);color:#185fa5;border:1px solid rgba(24,95,165,.3)'
    : 'display:inline-block;border-radius:4px;padding:2px 10px;font-size:11px;font-weight:700;letter-spacing:.04em;margin-bottom:8px;background:rgba(186,117,23,.15);color:#ba7517;border:1px solid rgba(186,117,23,.3)';

  document.getElementById('darf-modal-title').textContent = 'Guia de Recolhimento';
  document.getElementById('darf-modal-sub').textContent   = nomeTrib;
  document.getElementById('darf-cod-receita').textContent = codRec;
  document.getElementById('darf-periodo').textContent     = periodo;
  document.getElementById('darf-cnpj').textContent        = r.cnpj;
  document.getElementById('darf-numero').textContent      = docNum;
  document.getElementById('darf-rf').textContent          = r.rf;
  document.getElementById('darf-forn').textContent        = r.forn;
  document.getElementById('darf-vencimento').textContent  = vencimento;
  document.getElementById('darf-valor-imp').textContent   = _darfFmt(r.valor);
  document.getElementById('darf-total').textContent       = _darfFmt(r.valor);
  document.getElementById('darf-linha-digitavel').textContent = linha;
  document.getElementById('darf-pix-payload').textContent = pixPayload;

  window._darfLinha   = linha;
  window._darfPix     = pixPayload;
  window._darfAtual   = r;
  window._darfSeedVal = seed;

  var modal = document.getElementById('darf-modal');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  setTimeout(function() {
    window.darfTab('barcode');
    _darfDrawBarcode(seed);
    _darfDrawQR(seed);
  }, 50);
};

window.fecharGuiaDARF = function() {
  document.getElementById('darf-modal').style.display = 'none';
  document.body.style.overflow = '';
};

window.darfTab = function(tab) {
  var isBarcode = tab === 'barcode';
  document.getElementById('darf-panel-barcode').style.display = isBarcode ? 'block' : 'none';
  document.getElementById('darf-panel-pix').style.display     = isBarcode ? 'none'  : 'block';
  var btnB = document.getElementById('darf-tab-btn-barcode');
  var btnP = document.getElementById('darf-tab-btn-pix');
  btnB.style.borderBottomColor = isBarcode ? 'var(--teal)' : 'transparent';
  btnB.style.color             = isBarcode ? 'var(--teal)' : 'var(--txt2)';
  btnB.style.fontWeight        = isBarcode ? '600' : '400';
  btnP.style.borderBottomColor = isBarcode ? 'transparent' : 'var(--teal)';
  btnP.style.color             = isBarcode ? 'var(--txt2)' : 'var(--teal)';
  btnP.style.fontWeight        = isBarcode ? '400' : '600';
  if (!isBarcode) setTimeout(function(){ _darfDrawQR(window._darfSeedVal || 0); }, 30);
};

window.copiarLinhaDigitavel = function() {
  var btn = document.getElementById('darf-copy-btn');
  navigator.clipboard.writeText(window._darfLinha || '').then(function() {
    if (btn) { btn.textContent = 'Copiado!'; setTimeout(function(){ btn.textContent = 'Copiar'; }, 2000); }
  });
};

window.copiarChavePix = function() {
  var btn = document.getElementById('darf-pix-copy-btn');
  navigator.clipboard.writeText(window._darfPix || '').then(function() {
    if (btn) { btn.textContent = 'Copiado!'; setTimeout(function(){ btn.textContent = 'Copiar payload'; }, 2000); }
  });
};

function _darfDrawBarcode(seed) {
  var cv = document.getElementById('darf-barcode-canvas');
  if (!cv) return;
  var W   = cv.parentElement ? Math.max(200, cv.parentElement.offsetWidth - 32) : 500;
  var H   = 72;
  var dpr = window.devicePixelRatio || 1;
  cv.width  = W * dpr;
  cv.height = H * dpr;
  cv.style.width  = W + 'px';
  cv.style.height = H + 'px';
  var ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  var rng     = _darfRng(seed);
  var numBars = 92;
  var widths  = [];
  for (var i = 0; i < numBars; i++) widths.push(Math.floor(rng() * 3) + 1);
  var sum   = widths.reduce(function(a,b){return a+b;}, 0);
  var avail = W - 28;
  var x     = 14;
  ctx.fillStyle = '#111111';
  ctx.fillRect(x, 6, 2, H-14); x += 3;
  ctx.fillRect(x, 6, 1, H-14); x += 3;
  for (var i = 0; i < numBars; i++) {
    var bw = Math.max(1, Math.round(widths[i] * avail / sum));
    if (i % 2 === 0) ctx.fillRect(x, 6, bw, (i % 12 < 2) ? H-14 : H-26);
    x += bw;
  }
  x = W - 16;
  ctx.fillRect(x, 6, 1, H-14); x += 2;
  ctx.fillRect(x, 6, 2, H-14);
}

function _darfDrawQR(seed) {
  var cv = document.getElementById('darf-qr-canvas');
  if (!cv) return;
  var size = 160;
  var dpr  = window.devicePixelRatio || 1;
  cv.width  = size * dpr;
  cv.height = size * dpr;
  cv.style.width  = size + 'px';
  cv.style.height = size + 'px';
  var ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);

  var cells = 25;
  var cs    = Math.floor((size - 8) / cells);
  var ox    = Math.floor((size - cells * cs) / 2);
  var oy    = ox;
  var rng   = _darfRng(seed);
  var grid  = [];
  for (var row = 0; row < cells; row++) {
    grid[row] = [];
    for (var col = 0; col < cells; col++) grid[row][col] = rng() > 0.48 ? 1 : 0;
  }

  function applyFinder(fr, fc) {
    for (var dr = -1; dr <= 7; dr++) {
      for (var dc = -1; dc <= 7; dc++) {
        var rr = fr+dr, cc = fc+dc;
        if (rr < 0 || rr >= cells || cc < 0 || cc >= cells) continue;
        if (dr === -1 || dr === 7 || dc === -1 || dc === 7) { grid[rr][cc] = 0; }
        else grid[rr][cc] = (dr===0||dr===6||dc===0||dc===6||(dr>=2&&dr<=4&&dc>=2&&dc<=4)) ? 1 : 0;
      }
    }
  }
  applyFinder(0, 0); applyFinder(0, cells-7); applyFinder(cells-7, 0);
  for (var ti = 8; ti < cells-8; ti++) { grid[6][ti] = ti%2===0?1:0; grid[ti][6] = ti%2===0?1:0; }

  ctx.fillStyle = '#111111';
  for (var row = 0; row < cells; row++) for (var col = 0; col < cells; col++) if (grid[row][col]) ctx.fillRect(ox+col*cs, oy+row*cs, cs, cs);
}

window.downloadGuiaDARF = function() {
  var r = window._darfAtual;
  if (!r) return;
  var isIBS    = r.tipo === 'Guia IBS';
  var codRec   = isIBS ? '6912' : '5952';
  var nomeTrib = isIBS ? 'IBS — Imposto sobre Bens e Serviços' : 'CBS — Contribuição sobre Bens e Serviços';
  var doc     = document.getElementById('darf-numero').textContent;
  var periodo = document.getElementById('darf-periodo').textContent;
  var venc    = document.getElementById('darf-vencimento').textContent;
  var total   = document.getElementById('darf-total').textContent;
  var linha   = window._darfLinha || '—';
  var bcCV    = document.getElementById('darf-barcode-canvas');
  var qrCV    = document.getElementById('darf-qr-canvas');
  var bcImg   = bcCV ? bcCV.toDataURL('image/png') : '';
  var qrImg   = qrCV ? qrCV.toDataURL('image/png') : '';
  var dataNow = new Date().toLocaleDateString('pt-BR');
  var badgeCSS = isIBS ? 'background:#dbeafe;color:#1d4ed8' : 'background:#fef3c7;color:#92400e';

  var html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Guia ' + (isIBS?'IBS':'DARF CBS') + ' – ' + doc + '</title>' +
    '<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1a1a1a;padding:24px;max-width:680px;margin:0 auto}' +
    'h1{font-size:16px;font-weight:700;margin-bottom:2px}.sub{font-size:11px;color:#666;margin-bottom:16px}' +
    '.badge{display:inline-block;border-radius:3px;padding:2px 8px;font-size:10px;font-weight:700;margin-bottom:10px;' + badgeCSS + '}' +
    '.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 20px;margin-bottom:16px}' +
    '.field label{font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#888;display:block;margin-bottom:2px}' +
    '.field span{font-size:12px;font-weight:600;font-family:monospace}' +
    '.total-box{background:#f0faf8;border:1px solid #a7f3d0;border-radius:6px;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}' +
    '.total-box .lbl{font-size:13px;font-weight:600}.total-box .val{font-size:18px;font-weight:700;color:#059669;font-family:monospace}' +
    'hr{border:none;border-top:1px solid #e5e7eb;margin:14px 0}' +
    '.stitle{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#888;margin-bottom:8px;font-weight:600}' +
    '.bc-img{width:100%;height:68px;border:1px solid #e5e7eb;border-radius:4px;object-fit:fill}' +
    '.linha{font-family:monospace;font-size:11px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:8px 10px;margin-top:8px;word-break:break-all;line-height:1.7}' +
    '.pix-row{display:flex;gap:16px;align-items:flex-start;margin-top:6px}' +
    '.pix-row img{width:110px;height:110px;border:1px solid #e5e7eb;border-radius:4px}' +
    '.pix-payload{font-family:monospace;font-size:9px;color:#555;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:6px 8px;word-break:break-all;line-height:1.6;flex:1}' +
    '.footer{margin-top:20px;font-size:9px;color:#aaa;text-align:center;border-top:1px solid #e5e7eb;padding-top:10px}' +
    '@media print{button{display:none}}' +
    '</style></head><body>' +
    '<div class="badge">' + (isIBS?'Guia IBS':'DARF CBS') + '</div>' +
    '<h1>Guia de Recolhimento</h1>' +
    '<div class="sub">' + nomeTrib + ' &nbsp;&middot;&nbsp; Emitido em ' + dataNow + '</div>' +
    '<div class="grid">' +
    '<div class="field"><label>Código de Receita</label><span>' + codRec + '</span></div>' +
    '<div class="field"><label>Período de Apuração</label><span>' + periodo + '</span></div>' +
    '<div class="field"><label>CNPJ do Contribuinte</label><span>' + r.cnpj + '</span></div>' +
    '<div class="field"><label>Número do Documento</label><span>' + doc + '</span></div>' +
    '<div class="field"><label>Referência RF</label><span>' + r.rf + '</span></div>' +
    '<div class="field"><label>Fornecedor</label><span style="font-weight:500">' + r.forn + '</span></div>' +
    '<div class="field"><label>Data de Vencimento</label><span>' + venc + '</span></div>' +
    '<div class="field"><label>Valor do Imposto</label><span>' + total + '</span></div>' +
    '<div class="field"><label>Multa</label><span style="color:#999">R$ 0,00</span></div>' +
    '<div class="field"><label>Juros / Encargos</label><span style="color:#999">R$ 0,00</span></div>' +
    '</div>' +
    '<div class="total-box"><span class="lbl">Total a Recolher</span><span class="val">' + total + '</span></div>' +
    '<hr><div class="stitle">Código de Barras</div>' +
    '<img class="bc-img" src="' + bcImg + '">' +
    '<div class="linha">' + linha + '</div>' +
    '<hr><div class="stitle">Pagamento via PIX</div>' +
    '<div class="pix-row"><img src="' + qrImg + '"><div class="pix-payload">' + (window._darfPix || '—') + '</div></div>' +
    '<div class="footer">Gerado pelo SplitHub &nbsp;&middot;&nbsp; Induspar Tecnologia &nbsp;&middot;&nbsp; IBS/CBS — LC 214/2025 &nbsp;&middot;&nbsp; Documento sem validade fiscal sem autenticação da Receita Federal.</div>' +
    '</body></html>';

  var win = window.open('', '_blank', 'width=740,height=920');
  if (!win) { alert('Permita pop-ups para baixar o PDF.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(function() { win.print(); }, 700);
};

/* ═══════════════════════════════════════════════════════════
   MÓDULO INGESTÃO DE DFs
   ═══════════════════════════════════════════════════════════ */
(function() {
  var _ingDados = [];
  var _ingFiltrados = [];
  var _ingPagina = 1;
  var _ingPorPagina = 25;
  var _ingIniciado = false;

  var _emitentes = [
    { nome: 'Sulpar Implementos S.A.', cnpj: '14.382.976/0001-09' },
    { nome: 'Eletropar S.A.', cnpj: '61.874.320/0001-06' },
    { nome: 'Transcarro S.A.', cnpj: '19.854.203/0001-12' },
    { nome: 'Polisul Química S.A.', cnpj: '86.340.217/0001-28' },
    { nome: 'Aeroprime Ind. S.A.', cnpj: '52.039.781/0001-15' },
    { nome: 'Sidepar S.A.', cnpj: '40.825.163/0001-53' },
    { nome: 'Celupar S.A.', cnpj: '47.193.825/0001-31' },
    { nome: 'Movpar Locações S.A.', cnpj: '25.718.346/0001-80' },
    { nome: 'Bebpar Bebidas S.A.', cnpj: '34.629.580/0001-97' },
    { nome: 'Agropar Alimentos S.A.', cnpj: '57.480.139/0001-42' },
    { nome: 'Petrolink S.A.', cnpj: '62.914.073/0001-77' },
    { nome: 'Viapar Turismo S.A.', cnpj: '71.362.845/0001-24' },
    { nome: 'Ferropar Logística S.A.', cnpj: '83.097.412/0001-58' },
    { nome: 'Translogic S.A.', cnpj: '94.156.823/0001-91' },
    { nome: 'Cimentar Indústrias S.A.', cnpj: '15.283.640/0001-62' }
  ];

  var _tipos = ['NF-e Entrada', 'NF-e Entrada', 'NF-e Entrada', 'NF-e Saída', 'NF-e Saída', 'NFC-e', 'NFCom', 'NF3-e', 'NFS-e', 'CT-e', 'CT-e', 'NFAg', 'NFGás', 'MDF-e', 'BP-e'];
  var _cfops = ['1101', '1102', '1201', '1401', '2101', '5101', '5102', '5201', '6101', '7101'];
  var _statusDist = [
    'importado','importado','importado','importado','importado','importado','importado','importado','importado',
    'importado','importado','importado','importado','importado','importado','importado',
    'inconsistencia','inconsistencia',
    'inconsistencia','inconsistencia'
  ];

  function _rng(seed) {
    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function() { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; };
  }

  function _fmtBRL(v) {
    return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function _fmtData(d) {
    var p = d.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  var _ingModCodes = {'NF-e Entrada':'55','NF-e Saída':'55','NFC-e':'65','NFCom':'62','NF3-e':'66','CT-e':'57','NFAg':'01','NFGás':'59','MDF-e':'58','BP-e':'63'};

  function _chave(rnd, emit, seq, tipo) {
    var cnpj = emit.cnpj.replace(/\D/g, '');
    var aamm = '2601';
    var nNF = String(seq + 1).padStart(9, '0');
    var cNF = String(Math.floor(rnd() * 90000000) + 10000000).padStart(8, '0');
    if (tipo === 'NFS-e') {
      var cMun = '3550308';
      var cServ = String(Math.floor(rnd() * 100000)).padStart(5, '0');
      var nNFS = String(Math.floor(rnd() * 1e14)).padStart(15, '0').slice(0, 15);
      var comp = aamm + '01';
      var dvNFS = String(Math.floor(rnd() * 1000)).padStart(3, '0');
      return cMun + cServ + nNFS + cnpj + comp + dvNFS;
    }
    var mod = _ingModCodes[tipo] || '55';
    var base = '35' + aamm + cnpj + mod + '001' + nNF + '1' + cNF;
    var w = [2,3,4,5,6,7,8,9]; var sum = 0;
    for (var i = base.length-1, wi=0; i>=0; i--, wi++) sum += parseInt(base[i],10) * w[wi%8];
    var rem = sum % 11;
    return base + ((rem===0||rem===1) ? '0' : String(11-rem));
  }

  function _validacoesParaStatus(status, rnd) {
    var schemaNFe = { tipo: 'Schema XML NF-e 4.0', ok: true, mensagem: 'Estrutura válida conforme XSD 4.0' };
    var campos = { tipo: 'Campos obrigatórios', ok: true, mensagem: 'Todos os campos obrigatórios presentes' };
    var cnpjV = { tipo: 'CNPJ emitente (Receita Federal)', ok: true, mensagem: 'CNPJ ativo e regular' };
    var dup = { tipo: 'Chave de acesso (unicidade)', ok: true, mensagem: 'Chave de acesso única no banco' };

    if (status === 'importado') {
      return [schemaNFe, campos, cnpjV, dup];
    }
    if (status === 'inconsistencia') {
      var errTipos = [
        [{ tipo: 'Falha de Layout',      categoria: 'layout',      ok: false, mensagem: 'Estrutura XML inválida — elemento obrigatório ausente ou malformado' }, campos, cnpjV, dup],
        [schemaNFe, campos, { tipo: 'CNPJ Inválido',     categoria: 'dados',       ok: false, mensagem: 'CNPJ do emitente não localizado na Receita Federal' }, dup],
        [schemaNFe, { tipo: 'Campo Ausente',      categoria: 'layout',      ok: false, mensagem: 'Campo obrigatório ausente no grupo do emitente' }, cnpjV, dup],
        [schemaNFe, campos, cnpjV, { tipo: 'Duplicidade',         categoria: 'dados',       ok: false, mensagem: 'Chave de acesso já registrada na plataforma' }],
        [{ tipo: 'Rejeição SEFAZ',       categoria: 'layout',      ok: false, mensagem: 'Código 228 — assinatura digital inválida' }, campos, cnpjV, dup],
        [schemaNFe, campos, { tipo: 'Alíquota Inválida',   categoria: 'dados',       ok: false, mensagem: 'Alíquota CBS fora do intervalo regulatório (LC 214/2025)' }, dup],
        [schemaNFe, { tipo: 'Namespace Inválido',   categoria: 'layout',      ok: false, mensagem: 'Versão do schema NF-e incompatível com o padrão SEFAZ' }, cnpjV, dup]
      ];
      return errTipos[Math.floor(rnd() * errTipos.length)];
    }
    if (status === 'erro_layout') {
      var erros = [
        { tipo: 'Schema XML NF-e 4.0', ok: false, mensagem: 'Elemento <infNFe> malformado na linha 47' },
        { tipo: 'Schema XML NF-e 4.0', ok: false, mensagem: 'Namespace inválido: esperado NF-e 4.00, recebido 3.10' },
        { tipo: 'Campos obrigatórios', ok: false, mensagem: 'Campo <CNPJ> ausente em <emit>' },
        { tipo: 'Schema XML NF-e 4.0', ok: false, mensagem: 'Atributo versão fora do padrão SEFAZ' }
      ];
      var e = erros[Math.floor(rnd() * erros.length)];
      return [e, campos, cnpjV, dup];
    }
    if (status === 'erro_dados') {
      var errosDados = [
        { tipo: 'CNPJ emitente (Receita Federal)', ok: false, mensagem: 'CNPJ 00.000.000/0001-00 não localizado na RF' },
      ];
      var ed = errosDados[Math.floor(rnd() * errosDados.length)];
      return [schemaNFe, campos, ed, dup];
    }
    if (status === 'rejeitado') {
      return [
        { tipo: 'Schema XML NF-e 4.0', ok: true, mensagem: 'Estrutura válida' },
        campos,
        { tipo: 'Assinatura digital (SEFAZ)', ok: false, mensagem: 'Código 228 — Rejeição: assinatura inválida do XML' },
        cnpjV,
        { tipo: 'Alíquota CBS/IBS', ok: null, mensagem: 'Não verificado — documento rejeitado' },
        dup
      ];
    }
    if (status === 'duplicado') {
      return [
        schemaNFe,
        campos,
        cnpjV,
        { tipo: 'Alíquota CBS/IBS', ok: true, mensagem: 'Alíquota válida' },
        { tipo: 'Chave de acesso (unicidade)', ok: false, mensagem: 'Chave já existente — documento recebido em ' + _fmtData('2026-0' + (Math.floor(rnd()*6)+1) + '-' + String(Math.floor(rnd()*27)+1).padStart(2,'0')) }
      ];
    }
    return [schemaNFe, campos, cnpjV, dup];
  }

  function _derivaValidacoes(status, vals) {
    var layout = null, validade = null, dados = null;
    vals.forEach(function(v) {
      // Suporta campo categoria explícito (novo) e matching por nome (legado)
      var cat = v.categoria ||
        (v.tipo.indexOf('Schema') !== -1 || v.tipo.indexOf('Campos') !== -1 || v.tipo.indexOf('estrutura') !== -1 || v.tipo.indexOf('Assinatura') !== -1 || v.tipo.indexOf('Namespace') !== -1 || v.tipo.indexOf('Layout') !== -1 || v.tipo.indexOf('Ausente') !== -1 || v.tipo.indexOf('Rejeição') !== -1 ? 'layout' :
        (v.tipo.indexOf('CNPJ') !== -1 || v.tipo.indexOf('CFOP') !== -1 || v.tipo.indexOf('Alíquota') !== -1 || v.tipo.indexOf('unicidade') !== -1 || v.tipo.indexOf('Duplicidade') !== -1 || v.tipo.indexOf('Inválido') !== -1 ? 'dados' : null));
      if (cat === 'layout') {
        if (layout === null) layout = v.ok;
        else if (v.ok === false) layout = false;
      } else if (cat === 'dados') {
        if (dados === null) dados = v.ok;
        else if (v.ok === false) dados = false;
      } else if (v.tipo.indexOf('certif') !== -1 || v.tipo.indexOf('Validade') !== -1) {
        if (validade === null) validade = v.ok;
        else if (v.ok === false) validade = false;
      }
    });
    return { valLayout: layout, valValidade: validade, valDados: dados };
  }

  function _fmtIngData(data, offsetDays, rng) {
    var p = (data || '2026-01-01').split('-');
    var dia = Math.min(parseInt(p[2], 10) + offsetDays, 28);
    var hh = String(Math.floor(rng() * 24)).padStart(2, '0');
    var mm = String(Math.floor(rng() * 60)).padStart(2, '0');
    return String(dia).padStart(2, '0') + '/' + p[1] + '/' + p[0] + ' ' + hh + ':' + mm;
  }

  function _tipoIngDisplay(tipoDF, direcao) {
    if (tipoDF === 'NF-e' || tipoDF === 'NFC-e') {
      return tipoDF + (direcao === 'entrada' ? ' Entrada' : ' Saída');
    }
    return tipoDF;
  }

  function _gerarDadosDeGlobais() {
    var nfs = window.nfListaFiltradaGlobal || [];
    var dados = [];

    // ── Base: todos os DFs globais como "integrado" ──
    nfs.forEach(function(nf, idx) {
      var rng = _rng(idx * 1337 + 42);
      var dataIngestao = _fmtIngData(nf.data, 1 + Math.floor(rng() * 2), rng);
      var cfop = _cfops[idx % _cfops.length];
      var tipo = _tipoIngDisplay(nf.tipoDF || 'NF-e', nf.tipo || 'entrada');
      var validacoes = _validacoesParaStatus('importado', rng);
      var vDeriv = _derivaValidacoes('importado', validacoes);

      dados.push({
        id: idx,
        chave: nf.chaveDF || '',
        tipo: tipo,
        emitente: nf.entidade,
        cnpj: nf.cnpj,
        valor: nf.valorTotal,
        cfop: cfop,
        dataEmissao: nf.data,
        dataIngestao: dataIngestao,
        status: 'importado',
        valLayout: vDeriv.valLayout,
        valValidade: vDeriv.valValidade,
        valDados: vDeriv.valDados,
        validacoes: validacoes,
        nfNumero: nf.numero  // referência para lookup de histórico
      });
    });

    // ── Extra 20%: inconsistências ──
    var extraCount = Math.ceil(nfs.length * 0.20);

    for (var i = 0; i < extraCount; i++) {
      var rng2 = _rng(20260000 + i * 7331 + 99);
      var status = 'inconsistencia';
      var emit = _emitentes[i % _emitentes.length];
      var tipoBaseIdx = i % _tipos.length;
      var tipoBase = _tipos[tipoBaseIdx];
      var tipoKey = tipoBase.replace(' Entrada','').replace(' Saída','');
      var mesNum = (i % 8) + 1;
      var dia = String((i * 3 + 7) % 28 + 1).padStart(2, '0');
      var dEmissao = '2026-' + String(mesNum).padStart(2, '0') + '-' + dia;
      var rng2b = _rng(i * 4441 + 17);
      var dataIngestao = _fmtIngData(dEmissao, 1, rng2b);
      var cfop = _cfops[(i + 3) % _cfops.length];
      var valor = Math.round((500000 + ((i * 73856093 ^ i * 19349663) >>> 0) % 490001) * 100) / 100;

      var chave;
      if (status === 'duplicado') {
        // Referencia chave de um DF já integrado
        chave = dados[i % dados.length].chave;
      } else {
        chave = _chave(rng2, emit, dados.length + i, tipoKey);
      }

      var validacoes = _validacoesParaStatus('inconsistencia', rng2);
      var vDeriv = _derivaValidacoes(status, validacoes);

      dados.push({
        id: dados.length,
        chave: chave,
        tipo: tipoBase,
        emitente: emit.nome,
        cnpj: emit.cnpj,
        valor: valor,
        cfop: cfop,
        dataEmissao: dEmissao,
        dataIngestao: dataIngestao,
        status: status,
        valLayout: vDeriv.valLayout,
        valValidade: vDeriv.valValidade,
        valDados: vDeriv.valDados,
        validacoes: validacoes,
        nfNumero: String(900000 + i + 1).padStart(6, '0')
      });
    }

    // Re-indexar IDs
    dados.forEach(function(d, i) { d.id = i; });
    return dados;
  }

  function _valChip(v) {
    if (v === true) return '<span style="color:var(--green);font-weight:700;font-size:15px">✓</span>';
    if (v === false) return '<span style="color:var(--red);font-weight:700;font-size:15px">✗</span>';
    return '<span style="color:var(--amber);font-size:13px">⏳</span>';
  }

  function _statusLabel(s) {
    var m = {
      importado:      { lbl: 'Importado',      bg: 'rgba(29,158,117,.12)',   col: 'var(--green)', bdr: 'rgba(29,158,117,.25)' },
      inconsistencia: { lbl: 'Inconsistência', bg: 'rgba(139,92,246,.12)', col: '#8B5CF6',       bdr: 'rgba(139,92,246,.25)' }
    };
    var c = m[s] || { lbl: s, bg: 'rgba(167,168,170,.12)', col: 'var(--txt2)', bdr: 'rgba(167,168,170,.25)' };
    return '<span style="display:inline-block;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;background:' + c.bg + ';color:' + c.col + ';border:1px solid ' + c.bdr + '">' + c.lbl + '</span>';
  }

  function _tipoLabel(tipo) {
    var m = {
      'NF-e Entrada':['rgba(24,95,165,.12)','#185fa5'],
      'NF-e Saída':  ['rgba(73,197,177,.12)','var(--teal)'],
      'NFC-e Entrada':['rgba(99,102,241,.12)','#6366F1'],
      'NFC-e Saída': ['rgba(99,102,241,.12)','#6366F1'],
      'NFCom':       ['rgba(16,185,129,.12)','#10B981'],
      'NF3-e':       ['rgba(20,184,166,.12)','#14B8A6'],
      'NFS-e':       ['rgba(29,158,117,.12)','#1d9e75'],
      'CT-e':        ['rgba(186,117,23,.12)','#ba7517'],
      'NFAg':        ['rgba(132,204,22,.12)','#84CC16'],
      'NFGás':       ['rgba(234,179,8,.12)','#EAB308'],
      'MDF-e':       ['rgba(168,85,247,.12)','#A855F7'],
      'BP-e':        ['rgba(73,197,177,.12)','var(--teal)']
    };
    var key = tipo; // try exact match first
    if (!m[key]) {
      // try prefix match (e.g. "NFCom Entrada" → "NFCom")
      for (var k in m) { if (tipo.indexOf(k) === 0) { key = k; break; } }
    }
    var c = m[key] || ['rgba(167,168,170,.12)','var(--txt2)'];
    return '<span style="display:inline-block;border-radius:3px;padding:1px 7px;font-size:11px;font-weight:600;background:' + c[0] + ';color:' + c[1] + '">' + tipo + '</span>';
  }

  function _renderKPIs(dados) {
    var total = dados.length;
    var ok = dados.filter(function(d) { return d.status === 'importado'; }).length;
    var inc = dados.filter(function(d) { return d.status === 'inconsistencia'; }).length;
    var taxa = total > 0 ? Math.round((ok / total) * 100) : 0;

    function _el(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

    _el('ing-total', total);
    _el('ing-ok', ok);
    _el('ing-erro', inc);
    _el('ing-dup', 0);
    _el('ing-taxa', taxa + '%');

    _el('pipe-ing-receb', total);
    _el('pipe-ing-triagem', total);
    _el('pipe-ing-layout', total);
    _el('pipe-ing-dados', ok);
    _el('pipe-ing-integ', ok);
    _el('pipe-ing-err-lay', inc);
    _el('pipe-ing-err-dat', 0);
    _el('pipe-ing-err-dup', 0);
    _el('pipe-ing-err-rej', 0);
  }

  function _renderChart(dados) {
    var el = document.getElementById('cIngestao');
    if (!el) return;

    var byDay = {};
    dados.forEach(function(d) {
      var k = d.dataEmissao;
      if (!byDay[k]) byDay[k] = { ok: 0, inc: 0 };
      if (d.status === 'importado') byDay[k].ok++;
      else byDay[k].inc++;
    });

    var keys = Object.keys(byDay).sort().slice(-7);
    var okArr = [], incArr = [];
    var labels = [];
    keys.forEach(function(k) {
      var p = k.split('-');
      labels.push(p[2] + '/' + p[1]);
      okArr.push(byDay[k].ok);
      incArr.push(byDay[k].inc);
    });

    if (typeof _svgStackedBar === 'function') {
      _svgStackedBar('cIngestao', [
        { label: 'Importados', data: okArr, color: PALETTE.teal },
        { label: 'Inconsistências', data: incArr, color: PALETTE.red }
      ], labels, 148);
    }
  }

  function _renderTabela() {
    var tbody = document.getElementById('t-ingestao');
    if (!tbody) return;

    var total = _ingFiltrados.length;
    var totalPags = Math.max(1, Math.ceil(total / _ingPorPagina));
    if (_ingPagina > totalPags) _ingPagina = totalPags;

    var start = (_ingPagina - 1) * _ingPorPagina;
    var slice = _ingFiltrados.slice(start, start + _ingPorPagina);

    var _tipoCorMap = {
      'NF-e':'#185fa5','NFC-e':'#6366F1','NFCom':'#10B981','NF3-e':'#14B8A6',
      'CT-e':'#ba7517','NFS-e':'#8B5CF6','NFAg':'#1d9e75','NFGás':'#0EA5E9',
      'MDF-e':'#8A92A3','BP-e':'#EC4899'
    };
    var html = '';
    slice.forEach(function(d) {
      var chaveShort = d.chave ? (d.chave.substring(0, 8) + '…' + d.chave.slice(-8)) : '—';
      var tipoBase = d.tipo.replace(' Entrada','').replace(' Saída','');
      var tCor = _tipoCorMap[tipoBase] || '#8A92A3';
      var tipoBadge = '<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;background:' + tCor + '22;color:' + tCor + ';border:1px solid ' + tCor + '44;display:inline-block;margin-bottom:2px">' + tipoBase + '</span>';
      var nfNumCell = d.nfNumero
        ? '<span class="mono" style="font-size:11px;color:#185fa5;cursor:pointer;text-decoration:underline;white-space:nowrap" onclick="event.stopPropagation();if(window.abrirDetalhesNFporNumero)window.abrirDetalhesNFporNumero(\'' + d.nfNumero + '\')">' + tipoBase + ' ' + d.nfNumero + '</span>'
        : '<span style="color:var(--txt3)">—</span>';
      // Célula de inconsistência: primeiro item com ok===false
      var incCell;
      if (d.status === 'inconsistencia' && d.validacoes && d.validacoes.length) {
        var falha = null;
        for (var vi = 0; vi < d.validacoes.length; vi++) {
          if (d.validacoes[vi].ok === false) { falha = d.validacoes[vi]; break; }
        }
        if (falha) {
          incCell = '<span style="font-size:11px;font-weight:600;color:#8B5CF6;white-space:normal">' + falha.tipo + '</span>';
        } else {
          incCell = '<span style="color:var(--txt3);font-size:11px">—</span>';
        }
      } else {
        incCell = '<span style="color:var(--txt3);font-size:11px">—</span>';
      }

      html += '<tr style="white-space:nowrap">' +
        '<td>' + nfNumCell + '</td>' +
        '<td class="mono" style="font-size:11px;color:var(--txt2)">' + chaveShort + '</td>' +
        '<td>' + _tipoLabel(d.tipo) + '</td>' +
        '<td style="font-size:12px;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + d.emitente + '</td>' +
        '<td class="r mono" style="font-size:12px">' + _fmtBRL(d.valor) + '</td>' +
        '<td style="font-size:12px">' + _fmtData(d.dataEmissao) + '</td>' +
        '<td style="font-size:11px;color:var(--txt2)">' + d.dataIngestao + '</td>' +
        '<td style="text-align:center">' + _valChip(d.valLayout) + '</td>' +
        '<td style="text-align:center">' + _valChip(d.valDados) + '</td>' +
        '<td>' + _statusLabel(d.status) + '</td>' +
        '<td style="white-space:normal">' + incCell + '</td>' +
        '<td><button class="btn" style="font-size:11px;padding:4px 10px;border-radius:6px" onclick="abrirIngModal(' + d.id + ')">Detalhar</button></td>' +
        '</tr>';
    });

    if (!html) {
      html = '<tr><td colspan="13" style="text-align:center;color:var(--txt3);padding:40px">Nenhum documento encontrado para os filtros selecionados.</td></tr>';
    }

    tbody.innerHTML = html;

    document.getElementById('ing-pag-atual').textContent = _ingPagina;
    document.getElementById('ing-pag-total').textContent = totalPags;
    document.getElementById('ing-pag-info').textContent = '(' + total + ' DF' + (total !== 1 ? 's' : '') + ')';
    document.getElementById('ing-count-sub').textContent = total + ' DF' + (total !== 1 ? 's' : '') + ' no período';

    var prevBtn = document.getElementById('ing-btn-prev');
    var proxBtn = document.getElementById('ing-btn-prox');
    if (prevBtn) {
      prevBtn.disabled = _ingPagina <= 1;
      prevBtn.style.opacity = _ingPagina <= 1 ? '0.4' : '1';
      prevBtn.style.cursor = _ingPagina <= 1 ? 'not-allowed' : 'pointer';
    }
    if (proxBtn) {
      proxBtn.disabled = _ingPagina >= totalPags;
      proxBtn.style.opacity = _ingPagina >= totalPags ? '0.4' : '1';
      proxBtn.style.cursor = _ingPagina >= totalPags ? 'not-allowed' : 'pointer';
    }
  }

  var _ingStatusInconsistencia = ['inconsistencia'];

  function _aplicarFiltros() {
    var busca      = (document.getElementById('ing-busca')            || {}).value || '';
    var filtTipo   = (document.getElementById('ing-filtro-tipo')      || {}).value || '';
    var filtStatus = (document.getElementById('ing-filtro-status')    || {}).value || '';
    var filtVal    = (document.getElementById('ing-filtro-val')       || {}).value || '';
    var dataDe     = (document.getElementById('ing-filtro-data-de')   || {}).value || '';
    var dataAte    = (document.getElementById('ing-filtro-data-ate')  || {}).value || '';

    busca = busca.toLowerCase();

    _ingFiltrados = _ingDados.filter(function(d) {
      if (busca && d.chave.toLowerCase().indexOf(busca) === -1 &&
          d.emitente.toLowerCase().indexOf(busca) === -1 &&
          d.cnpj.toLowerCase().indexOf(busca) === -1) return false;
      if (filtTipo && d.tipo !== filtTipo) return false;
      if (filtStatus === 'inconsistencia_todos') {
        if (_ingStatusInconsistencia.indexOf(d.status) === -1) return false;
      } else if (filtStatus && d.status !== filtStatus) {
        return false;
      }
      if (filtVal === 'ok'   && (d.valLayout === false || d.valValidade === false || d.valDados === false)) return false;
      if (filtVal === 'erro' && d.valLayout !== false && d.valValidade !== false && d.valDados !== false)   return false;
      if (dataDe  && d.dataEmissao < dataDe)  return false;
      if (dataAte && d.dataEmissao > dataAte) return false;
      return true;
    });
  }

  window.ingestaoInit = function() {
    // Garantir que nfListaFiltradaGlobal está populada
    if (!(window.nfListaFiltradaGlobal || []).length) {
      try { if (typeof nfRenderLista === 'function') nfRenderLista(); } catch(e) {}
    }
    var nfsAtual = (window.nfListaFiltradaGlobal || []).length;
    if (!_ingIniciado || nfsAtual > 0 || !_ingDados.length) {
      _ingDados = _gerarDadosDeGlobais();
      _ingIniciado = nfsAtual > 0;
    }
    window._ingDadosGlobal = _ingDados;
    _ingFiltrados = _ingDados.slice();
    _ingPagina = 1;
    _renderKPIs(_ingDados);
    _renderChart(_ingDados);
    _renderTabela();
  };

  window.ingestaoFiltrar = function() {
    _aplicarFiltros();
    _ingPagina = 1;
    _renderTabela();
  };

  window.ingestaoLimparFiltros = function() {
    ['ing-busca','ing-filtro-tipo','ing-filtro-status','ing-filtro-val','ing-filtro-data-de','ing-filtro-data-ate'].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    _ingFiltrados = _ingDados.slice();
    _ingPagina = 1;
    _renderTabela();
  };

  window.ingestaoPaginaAnterior = function() {
    if (_ingPagina > 1) { _ingPagina--; _renderTabela(); }
  };

  window.ingestaoProximaPagina = function() {
    var totalPags = Math.ceil(_ingFiltrados.length / _ingPorPagina);
    if (_ingPagina < totalPags) { _ingPagina++; _renderTabela(); }
  };

  window.abrirIngModal = function(idx) {
    var d = _ingDados[idx];
    if (!d) return;

    // Guardar referência para o visualizador
    window._ingModalDadosAtual = d;

    var tipoBase = d.tipo.replace(' Entrada','').replace(' Saída','');
    var badge = document.getElementById('ing-modal-tipo-badge');
    if (badge) badge.textContent = d.tipo;

    var chaveEl = document.getElementById('ing-modal-chave');
    if (chaveEl) chaveEl.textContent = d.chave ? (d.chave.substring(0,8) + ' ' + d.chave.substring(8,20) + '…') : '—';

    function _set(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
    function _fmtBRL2(v) { return v != null ? 'R$ ' + Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—'; }

    // Buscar NF completa para campos extras
    var nfRef = (window.nfListaFiltradaGlobal || []).find(function(n){ return n.numero === d.nfNumero; }) || {};

    // Campos emitente
    _set('ing-modal-emit', d.emitente || '—');
    _set('ing-modal-cnpj', d.cnpj || '—');
    _set('ing-modal-ie', d.ie || '111.111.111.111');
    _set('ing-modal-emit-uf', d.uf ? (d.uf) : 'São Paulo · SP');

    // Destinatário
    var destNome = d.nomeDest || (nfRef.tipo === 'saida' ? (nfRef.entidade || 'Cliente') : 'Induspar Tecnologia S.A.');
    var destCnpj = d.cnpjDest || (nfRef.tipo === 'saida' ? (nfRef.cnpj || '—') : '76.535.764/0001-43');
    _set('ing-modal-dest', destNome);
    _set('ing-modal-cnpj-dest', destCnpj);

    // Operação
    _set('ing-modal-emissao', _fmtData(d.dataEmissao));
    _set('ing-modal-ingestao', d.dataIngestao);
    _set('ing-modal-cfop', d.cfop);
    var serieNum = (d.serie || '001') + ' / ' + (d.numero || d.nfNumero || d.chave.substring(25,34) || '—');
    _set('ing-modal-serie-num', serieNum);
    var direcaoLabel = d.tipo.indexOf('Saída') > -1 ? 'Saída (1)' : 'Entrada (0)';
    _set('ing-modal-direcao', direcaoLabel);
    var natOpMap = { '5102':'Venda de mercadoria','6102':'Venda de mercad. interestadual','5101':'Venda de produção','1102':'Compra de mercadoria','2102':'Compra interestadual','3102':'Compra do exterior','5152':'Transf. de mercad. remetente','1152':'Transf. de mercad. destinatário' };
    _set('ing-modal-nat-op', d.natOp || natOpMap[d.cfop] || 'Venda de mercadoria adquirida');

    // Valores
    _set('ing-modal-valor', _fmtBRL2(d.valor || nfRef.valorTotal));
    _set('ing-modal-vliq', _fmtBRL2(nfRef.valorLiquido || Math.round((d.valor||0)/1.18)));
    _set('ing-modal-cbs', _fmtBRL2(d.cbs || nfRef.cbs || Math.round((d.valor||0)/1.18*0.08)));
    _set('ing-modal-ibs', _fmtBRL2(d.ibs || nfRef.ibs || Math.round((d.valor||0)/1.18*0.10)));

    // Chave
    _set('ing-modal-chave-full', d.chave || '—');

    // Botão visualizar — label dinâmico por tipo
    var docAuxLabels = { 'NF-e':'DANFE','NFC-e':'DANFCE','CT-e':'DACTE','NFS-e':'Nota Fiscal de Serviços','NFCom':'DANFCOM','NF3-e':'DANF3e','MDF-e':'DAMDFE','NFAg':'DANFAg','NFGás':'DANFGÁS' };
    var lblBtn = document.getElementById('ing-modal-btn-visualizar-lbl');
    if (lblBtn) lblBtn.textContent = 'Visualizar ' + (docAuxLabels[tipoBase] || 'Documento');

    var statusBar = document.getElementById('ing-modal-status-bar');
    if (statusBar) {
      var sConf = {
        importado:      { icon: '✓', txt: 'Documento importado com sucesso — todos os critérios de validação aprovados.', bg: 'rgba(29,158,117,.12)', col: 'var(--green)' },
        inconsistencia: { icon: '✗', txt: 'Documento com inconsistência — validação falhou, veja o detalhe abaixo.', bg: 'rgba(139,92,246,.12)', col: '#8B5CF6' }
      };
      var sc = sConf[d.status] || sConf.importado;
      statusBar.style.background = sc.bg;
      statusBar.style.color = sc.col;
      statusBar.innerHTML = '<span style="font-size:18px">' + sc.icon + '</span><span>' + sc.txt + '</span>';
    }

    // ── Seção de detalhe da inconsistência ────────────────────────────────
    var incWrap = document.getElementById('ing-modal-inconsist-wrap');
    var incEl   = document.getElementById('ing-modal-inconsist');
    if (incWrap && incEl) {
      if (d.status === 'inconsistencia' && d.validacoes && d.validacoes.length) {
        var falhaInc = null;
        for (var fi = 0; fi < d.validacoes.length; fi++) {
          if (d.validacoes[fi].ok === false) { falhaInc = d.validacoes[fi]; break; }
        }
        if (falhaInc) {
          var catCor2 = falhaInc.categoria === 'dados' ? '#185fa5' : '#ba7517';
          var catBg2  = falhaInc.categoria === 'dados' ? 'rgba(24,95,165,.1)' : 'rgba(186,117,23,.1)';
          var catBdr2 = falhaInc.categoria === 'dados' ? 'rgba(24,95,165,.25)' : 'rgba(186,117,23,.25)';
          incEl.innerHTML =
            '<div style="display:flex;flex-direction:column;gap:8px;padding:12px;background:rgba(139,92,246,.06);border:1px solid rgba(139,92,246,.2);border-radius:8px">' +
              '<div style="display:flex;align-items:center;gap:8px">' +
                '<span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:4px;background:' + catBg2 + ';color:' + catCor2 + ';border:1px solid ' + catBdr2 + ';text-transform:uppercase;letter-spacing:.05em">' + (falhaInc.categoria === 'dados' ? 'Dados' : 'Layout') + '</span>' +
                '<span style="font-size:12px;font-weight:700;color:#8B5CF6">' + falhaInc.tipo + '</span>' +
              '</div>' +
              '<div style="font-size:12px;color:var(--txt1);line-height:1.5">' + falhaInc.mensagem + '</div>' +
            '</div>';
          incWrap.style.display = '';
        } else {
          incWrap.style.display = 'none';
        }
      } else {
        incWrap.style.display = 'none';
      }
    }

    var valDiv = document.getElementById('ing-modal-validacoes');
    if (valDiv) {
      var vhtml = '';
      d.validacoes.forEach(function(v) {
        var ico = v.ok === true ? '✓' : (v.ok === false ? '✗' : '⏳');
        var col = v.ok === true ? 'var(--green)' : (v.ok === false ? 'var(--red)' : 'var(--amber)');
        var bg = v.ok === true ? 'rgba(29,158,117,.06)' : (v.ok === false ? 'rgba(244,63,94,.06)' : 'rgba(186,117,23,.06)');
        vhtml += '<div style="display:flex;align-items:flex-start;gap:12px;padding:10px 14px;border-radius:7px;border:1px solid var(--border);background:' + bg + '">' +
          '<span style="color:' + col + ';font-weight:700;font-size:16px;line-height:1.2;flex-shrink:0">' + ico + '</span>' +
          '<div><div style="font-size:12px;font-weight:600;color:var(--txt1);margin-bottom:2px">' + v.tipo + '</div>' +
          '<div style="font-size:11px;color:var(--txt2)">' + v.mensagem + '</div></div>' +
          '</div>';
      });
      valDiv.innerHTML = vhtml;
    }

    // ── Trilha de auditoria ───────────────────────────────────────────────
    var histEl    = document.getElementById('ing-modal-historico');
    var histTitEl = document.getElementById('ing-modal-hist-titulo');
    if (histEl) {
      var evRgba  = { 'INGESTÃO':'29,158,117','VALIDAÇÃO':'29,158,117','GERAÇÃO RF':'24,95,165',
        'INCONSISTÊNCIA':'163,45,45','VENCIMENTO':'163,45,45','AGUARDANDO':'186,117,23',
        'APROPRIAÇÃO':'29,158,117','PAGAMENTO':'29,158,117','UTILIZAÇÃO':'139,92,246',
        'EXTINÇÃO':'167,168,170','CONCILIAÇÃO':'139,92,246',
        'CONC APURAÇÃO':'24,95,165','CONC FINANCEIRA':'29,158,117' };
      var evIcons = { 'INGESTÃO':'↓','VALIDAÇÃO':'✓','GERAÇÃO RF':'◉','INCONSISTÊNCIA':'!',
        'VENCIMENTO':'✕','AGUARDANDO':'…','APROPRIAÇÃO':'✓','PAGAMENTO':'$','UTILIZAÇÃO':'◆',
        'EXTINÇÃO':'■','CONCILIAÇÃO':'⇌',
        'CONC APURAÇÃO':'⇌','CONC FINANCEIRA':'⇌' };

      var allEvs = [];

      // Eventos de ingestão (sempre presentes, independente do status)
      var MK = window._rfMkTS, FTS = window._rfFmtTS, A = window._rfAddDays;
      var d0 = d.dataEmissao;

      allEvs.push({ ts: MK(d0,'08:32'), data: FTS(MK(d0,'08:32')),
        tipo:'INGESTÃO', modulo:'Ingestão de DFs', ator:'SEFAZ',
        desc: (d.tipo||'NF-e') + ' recebida · chave: ' + d.chave.substring(0,14) + '…' +
              ' · emitente: ' + d.emitente, cls:'ok' });

      if (d.status === 'importado') {
        allEvs.push({ ts: MK(A(d0,1),'09:15'), data: FTS(MK(A(d0,1),'09:15')),
          tipo:'VALIDAÇÃO', modulo:'Ingestão de DFs', ator:'SplitHub',
          desc:'Schema XML · dados fiscais · emitente/destinatário — todos aprovados · documento importado', cls:'ok' });
      } else if (d.status === 'inconsistencia') {
        var falhaHist = null;
        if (d.validacoes) {
          for (var hi = 0; hi < d.validacoes.length; hi++) {
            if (d.validacoes[hi].ok === false) { falhaHist = d.validacoes[hi]; break; }
          }
        }
        var falhaHistDesc = falhaHist
          ? 'Inconsistência detectada · Tipo: ' + falhaHist.tipo +
            ' · Categoria: ' + (falhaHist.categoria === 'dados' ? 'Dados' : 'Layout') +
            ' · ' + falhaHist.mensagem
          : 'Inconsistência detectada · documento suspenso para revisão';
        var falhaHistTS = MK(A(d0,1),'09:18');
        allEvs.push({ ts: falhaHistTS, data: FTS(falhaHistTS),
          tipo:'INCONSISTÊNCIA', modulo:'Ingestão de DFs', ator:'SplitHub',
          desc: falhaHistDesc, cls:'erro' });
      }

      // Histórico completo dos RFs (apenas DFs integrados com NF vinculada)
      if (d.nfNumero && window._rfGerarHistorico) {
        var nfObj = (window.nfListaFiltradaGlobal || []).find(function(n){ return n.numero === d.nfNumero; });
        if (nfObj && nfObj.registrosFiscais) {
          nfObj.registrosFiscais.forEach(function(rf) {
            var evs = window._rfGerarHistorico(rf, nfObj);
            // Pular INGESTÃO e VALIDAÇÃO — já adicionados no nível DF
            evs.slice(2).forEach(function(ev) {
              var tfSuf = rf.tipoFiscal ? ' · ' + rf.tipoFiscal.toUpperCase() : '';
              allEvs.push({ ts: ev.ts || '—', data: ev.data,
                tipo: ev.tipo, modulo: ev.modulo, ator: ev.ator,
                desc: ev.desc + (ev.tipo === 'GERAÇÃO RF' ? tfSuf : ''), cls: ev.cls });
            });
          });
        }
      }

      // Ordenar decrescente
      allEvs.sort(function(a,b){
        var ta=a.ts||'—',tb=b.ts||'—';
        if(ta==='—'&&tb==='—')return 0; if(ta==='—')return 1; if(tb==='—')return -1;
        return ta>tb?-1:ta<tb?1:0;
      });

      if (histTitEl) histTitEl.textContent = 'Trilha de Auditoria · ' + allEvs.length + ' evento' + (allEvs.length!==1?'s':'');

      var tlH = '';
      allEvs.forEach(function(ev, i) {
        var rgba    = evRgba[ev.tipo]  || '167,168,170';
        var dotRgba = ev.cls==='erro'  ? '163,45,45' : ev.cls==='pending' ? '186,117,23' : rgba;
        var icon    = evIcons[ev.tipo] || '◯';
        var isLast  = i === allEvs.length - 1;
        tlH += '<div style="display:flex;gap:12px">'
          + '<div style="display:flex;flex-direction:column;align-items:center;width:28px;flex-shrink:0">'
          + '<div style="width:28px;height:28px;border-radius:50%;background:rgba('+dotRgba+',.15);border:1.5px solid rgba('+dotRgba+',.6);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:rgba('+dotRgba+',1)">'+icon+'</div>'
          + (!isLast ? '<div style="width:1px;flex:1;background:rgba(128,128,128,.2);margin:3px 0;min-height:20px"></div>' : '')
          + '</div>'
          + '<div style="flex:1;padding-bottom:'+(isLast?'0':'22')+'px">'
          + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">'
          + '<span style="background:rgba('+rgba+',.12);color:rgba('+rgba+',1);border:1px solid rgba('+rgba+',.3);border-radius:3px;padding:1px 7px;font-size:9px;font-weight:700;letter-spacing:.07em">'+ev.tipo+'</span>'
          + '<span style="font-size:10px;color:var(--txt3);font-family:monospace">'+ev.data+'</span>'
          + '</div>'
          + '<div style="font-size:12px;color:var(--txt1);line-height:1.55;margin-bottom:3px">'+ev.desc+'</div>'
          + '<div style="font-size:10px;color:var(--txt2)">'+ev.modulo+' · '+ev.ator+'</div>'
          + '</div>'
          + '</div>';
      });
      histEl.innerHTML = tlH || '<div style="color:var(--txt3);font-size:12px;font-style:italic">Nenhum evento disponível.</div>';
    }

    // ── Registros Fiscais vinculados ──────────────────────────────────────
    var rfsWrap = document.getElementById('ing-modal-rfs-wrap');
    var rfsEl   = document.getElementById('ing-modal-rfs');
    if (rfsEl && d.nfNumero) {
      var nfRef = (window.nfListaFiltradaGlobal || []).find(function(n) { return n.numero === d.nfNumero; });
      var rfs   = nfRef && nfRef.registrosFiscais ? nfRef.registrosFiscais : [];
      if (rfs.length) {
        var rfsHtml = '';
        rfs.forEach(function(rf) {
          var fiscalCor  = rf.tipoFiscal === 'ibs' ? '#185fa5' : '#ba7517';
          var fiscalLabel = (rf.tipoFiscal || '').toUpperCase();
          var valorFmt   = rf.valor != null ? 'R$ ' + rf.valor.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) : '—';
          var stMap = { integrado:'Integrado', utilizado:'Utilizado', apropriado:'Apropriado',
            nao_apropriado:'Não aprop.', vencido:'Vencido', inconsistencia:'Inconsistência',
            em_risco:'Em risco', extinto:'Extinto', nao_extinto:'Não extinto' };
          var stLabel = stMap[rf.statusCredito || rf.statusRegistro || rf.status || ''] || (rf.statusCredito || rf.status || '—');
          rfsHtml += '<div onclick="(function(){var fn=window.abrirDetalheRF||window.rfAbrirDetalhe;if(typeof fn===\'function\')fn(\'' + (rf.id||'') + '\');})()" '
            + 'style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:7px;cursor:pointer;background:var(--card);transition:border-color .12s" '
            + 'onmouseover="this.style.borderColor=\'' + fiscalCor + '\'" onmouseout="this.style.borderColor=\'var(--border)\'">'
            + '<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;background:' + fiscalCor + '22;color:' + fiscalCor + ';border:1px solid ' + fiscalCor + '44;flex-shrink:0">' + fiscalLabel + '</span>'
            + '<span class="mono" style="font-size:11px;color:var(--blue);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (rf.id || '—') + '</span>'
            + '<span style="font-size:11px;font-weight:600;color:' + fiscalCor + ';font-family:monospace;flex-shrink:0">' + valorFmt + '</span>'
            + '<span style="font-size:10px;color:var(--txt3);flex-shrink:0">' + stLabel + '</span>'
            + '<span style="font-size:14px;color:var(--txt3);flex-shrink:0">›</span>'
            + '</div>';
        });
        rfsEl.innerHTML = rfsHtml;
        if (rfsWrap) rfsWrap.style.display = 'block';
      } else {
        if (rfsWrap) rfsWrap.style.display = 'none';
      }
    } else {
      if (rfsWrap) rfsWrap.style.display = 'none';
    }

    var modal = document.getElementById('ing-modal');
    if (modal) { modal.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
  };

  window.fecharIngModal = function() {
    var modal = document.getElementById('ing-modal');
    if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; }
  };

  window._abrirVisualizadorDF = function() {
    var d = window._ingModalDadosAtual;
    if (!d) return;
    var nfRef = (window.nfListaFiltradaGlobal || []).find(function(n){ return n.numero === d.nfNumero; }) || {};
    var tipoBase = d.tipo.replace(' Entrada','').replace(' Saída','');
    var isEntrada = d.tipo.indexOf('Entrada') > -1 || d.tipo.indexOf('entrada') > -1;
    var ff = function(v){ return v != null ? 'R$ ' + Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) : 'R$ 0,00'; };
    var vliq = nfRef.valorLiquido || Math.round((d.valor||0)/1.18);
    var cbs  = nfRef.cbs || Math.round(vliq*0.08);
    var ibs  = nfRef.ibs || Math.round(vliq*0.10);
    var vtotal = d.valor || nfRef.valorTotal || (vliq+cbs+ibs);
    var dataParts = (d.dataEmissao||'2026-01-01').split('-');
    var dataFmt = dataParts[2]+'/'+dataParts[1]+'/'+dataParts[0];
    var chaveFormatada = (d.chave||'').replace(/(.{4})/g,'$1 ').trim();
    var serieNum = (d.nfNumero || d.chave.substring(25,34) || '000000001');
    var natOpMap = {'5102':'Venda de mercadoria adquirida ou recebida de terceiros','6102':'Venda de mercadoria adquirida interestadual','5101':'Venda de produção do estabelecimento','1102':'Compra para comercialização','2102':'Compra interestadual para comercialização','3102':'Compra para industrialização - importação'};
    var natOp = natOpMap[d.cfop] || 'Venda de mercadoria adquirida ou recebida de terceiros';
    var destNome = nfRef.tipo === 'saida' ? (nfRef.entidade || 'Cliente') : 'Induspar Tecnologia S.A.';
    var destCnpj = nfRef.tipo === 'saida' ? (nfRef.cnpj || '—') : '76.535.764/0001-43';

    var docLabels = {
      'NF-e':   { titulo:'DANFE',    sub:'Documento Auxiliar da Nota Fiscal Eletrônica',    cor:'#1a56c4' },
      'NFC-e':  { titulo:'DANFCE',   sub:'Documento Auxiliar da Nota Fiscal de Consumidor', cor:'#2563eb' },
      'CT-e':   { titulo:'DACTE',    sub:'Documento Auxiliar do Conhecimento de Transporte',cor:'#0891b2' },
      'NFS-e':  { titulo:'NFS-e',    sub:'Nota Fiscal de Serviços Eletrônica',              cor:'#6d28d9' },
      'NFCom':  { titulo:'DANFCOM',  sub:'Documento Auxiliar da Nota Fiscal de Comunicação',cor:'#047857' },
      'NF3-e':  { titulo:'DANF3e',   sub:'Documento Auxiliar da NF de Energia Elétrica',   cor:'#b45309' },
      'MDF-e':  { titulo:'DAMDFE',   sub:'Documento Auxiliar do Manifesto de Documentos',   cor:'#475569' },
      'NFAg':   { titulo:'DANFAg',   sub:'Documento Auxiliar da NF Agropecuária',           cor:'#15803d' }
    };
    var dl = docLabels[tipoBase] || { titulo:'DANFE', sub:'Documento Auxiliar da Nota Fiscal Eletrônica', cor:'#1a56c4' };

    // Itens mockados baseados no CFOP e valor
    var itemDesc = {
      '5102':'Mercadoria para comercialização','6102':'Mercadoria interestadual','5101':'Produto industrializado',
      '1102':'Mercadoria adquirida','2102':'Mercadoria interestadual adquirida','3102':'Mercadoria importada',
      '5152':'Mercadoria em transferência','1152':'Mercadoria recebida em transferência'
    }[d.cfop] || 'Mercadoria diversa';
    var nItems = 3;
    var vUnitBase = Math.round(vliq / nItems);
    var itensHtml = '';
    for (var i = 1; i <= nItems; i++) {
      var vUnit = i < nItems ? vUnitBase : (vliq - vUnitBase*(nItems-1));
      var qtd = Math.floor(10 + i*7);
      var ncm = ['8471.30.19','3004.90.99','7308.90.10','8544.49.00','3901.10.10'][i%5];
      itensHtml += '<tr style="border-bottom:1px solid #e5e7eb">'
        + '<td style="padding:5px 6px;font-size:11px">' + String(i).padStart(3,'0') + '</td>'
        + '<td style="padding:5px 6px;font-size:11px">' + ncm + '</td>'
        + '<td style="padding:5px 6px;font-size:11px">' + itemDesc + ' — lote ' + String(2026000+i) + '</td>'
        + '<td style="padding:5px 6px;font-size:11px;text-align:center">UN</td>'
        + '<td style="padding:5px 6px;font-size:11px;text-align:right">' + qtd + '</td>'
        + '<td style="padding:5px 6px;font-size:11px;text-align:right">R$ ' + (vUnit/qtd).toFixed(2).replace('.',',') + '</td>'
        + '<td style="padding:5px 6px;font-size:11px;text-align:right">R$ ' + vUnit.toLocaleString('pt-BR',{minimumFractionDigits:2}) + '</td>'
        + '</tr>';
    }

    var html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">'
      + '<title>' + dl.titulo + ' – ' + tipoBase + ' ' + serieNum + '</title>'
      + '<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;color:#1f2937;background:#f3f4f6;padding:20px}'
      + '.page{background:#fff;max-width:900px;margin:0 auto;border:1px solid #d1d5db;padding:0}'
      + '.hdr{background:' + dl.cor + ';color:#fff;display:flex;align-items:stretch}'
      + '.hdr-logo{width:160px;padding:14px 16px;border-right:1px solid rgba(255,255,255,.3);display:flex;flex-direction:column;justify-content:center}'
      + '.hdr-logo .co{font-size:13px;font-weight:700;line-height:1.3}.hdr-logo .cnpj{font-size:10px;opacity:.8;margin-top:4px}'
      + '.hdr-center{flex:1;padding:12px 16px;text-align:center}'
      + '.hdr-center .doc{font-size:22px;font-weight:700;letter-spacing:2px}'
      + '.hdr-center .docsub{font-size:9px;opacity:.85;margin-top:3px;text-transform:uppercase;letter-spacing:.05em}'
      + '.hdr-right{width:140px;padding:12px 14px;border-left:1px solid rgba(255,255,255,.3);display:flex;flex-direction:column;justify-content:center;align-items:center}'
      + '.hdr-right .entrada-saida{font-size:11px;font-weight:700;border:2px solid rgba(255,255,255,.6);border-radius:4px;padding:4px 8px;margin-bottom:6px}'
      + '.hdr-right .nfnum{font-size:11px;font-weight:700}.hdr-right .nflbl{font-size:9px;opacity:.8}'
      + '.nat-op{background:#f0f4ff;border-bottom:2px solid ' + dl.cor + ';padding:7px 14px;font-size:11px}'
      + '.nat-op strong{color:' + dl.cor + '}'
      + '.blk{border:1px solid #d1d5db;margin:10px 10px 0}'
      + '.blk-hdr{background:#e8edf6;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:4px 8px;color:#374151;border-bottom:1px solid #d1d5db}'
      + '.blk-body{padding:8px 10px;display:grid;gap:6px}'
      + '.row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}'
      + '.row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}'
      + '.field{}'
      + '.field label{display:block;font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}'
      + '.field span{font-size:11px;color:#111827;font-weight:600}'
      + 'table{width:100%;border-collapse:collapse}'
      + 'thead th{background:#e8edf6;padding:5px 6px;font-size:10px;text-align:left;border-bottom:2px solid ' + dl.cor + ';color:#374151}'
      + '.totals{margin:10px;border:2px solid ' + dl.cor + ';border-radius:4px;overflow:hidden}'
      + '.totals-hdr{background:' + dl.cor + ';color:#fff;padding:7px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}'
      + '.totals-body{display:grid;grid-template-columns:repeat(4,1fr);}'
      + '.tval{padding:10px 12px;text-align:center;border-right:1px solid #d1d5db}'
      + '.tval:last-child{border-right:none}.tval label{display:block;font-size:9px;color:#6b7280;text-transform:uppercase;margin-bottom:4px}'
      + '.tval span{font-size:14px;font-weight:700;color:#111827}'
      + '.tval.highlight span{color:' + dl.cor + '}'
      + '.chave-box{margin:10px;border:1px solid #d1d5db;border-radius:4px;padding:8px 12px}'
      + '.chave-box label{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:4px}'
      + '.chave-box .chave{font-family:monospace;font-size:11px;letter-spacing:.12em;word-break:break-all;color:#1f2937}'
      + '.barcode{height:28px;background:repeating-linear-gradient(90deg,#1f2937 0px,#1f2937 2px,#fff 2px,#fff 4px);margin-top:6px;border-radius:2px}'
      + '.inf-comp{margin:10px;font-size:10px;color:#374151;line-height:1.6;padding:8px 10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px}'
      + '.footer{margin:10px;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#9ca3af;padding-bottom:10px}'
      + '@media print{body{background:#fff;padding:0}.page{border:none;max-width:100%}}'
      + '</style>'
      + '<script>window.onload=function(){window.print();}<\/script>'
      + '</head><body>'
      + '<div class="page">'
      // HEADER
      + '<div class="hdr">'
      + '<div class="hdr-logo"><div class="co">' + (d.emitente||'Emitente') + '</div><div class="cnpj">CNPJ: ' + (d.cnpj||'—') + '</div><div class="cnpj" style="margin-top:2px">IE: 111.111.111.111</div></div>'
      + '<div class="hdr-center"><div class="doc">' + dl.titulo + '</div><div class="docsub">' + dl.sub + '</div>'
      + '<div style="margin-top:10px;font-size:10px;opacity:.85">Emitido em ' + dataFmt + ' · CFOP ' + d.cfop + '</div></div>'
      + '<div class="hdr-right"><div class="entrada-saida">' + (isEntrada ? '0 - ENTRADA' : '1 - SAÍDA') + '</div>'
      + '<div class="nflbl">Série / Número</div><div class="nfnum">001 / ' + serieNum + '</div></div>'
      + '</div>'
      // NATUREZA
      + '<div class="nat-op"><strong>Natureza da Operação:</strong> ' + natOp + '</div>'
      // EMITENTE
      + '<div class="blk"><div class="blk-hdr">Emitente</div><div class="blk-body">'
      + '<div class="row2">'
      + '<div class="field"><label>Razão Social / Nome</label><span>' + (d.emitente||'—') + '</span></div>'
      + '<div class="row2"><div class="field"><label>CNPJ</label><span>' + (d.cnpj||'—') + '</span></div>'
      + '<div class="field"><label>IE</label><span>111.111.111.111</span></div></div></div>'
      + '<div class="row3"><div class="field"><label>Município</label><span>São Paulo</span></div>'
      + '<div class="field"><label>UF</label><span>SP</span></div>'
      + '<div class="field"><label>CEP</label><span>04795-100</span></div></div></div></div>'
      // DESTINATÁRIO
      + '<div class="blk"><div class="blk-hdr">Destinatário / Remetente</div><div class="blk-body">'
      + '<div class="row2"><div class="field"><label>Razão Social / Nome</label><span>' + destNome + '</span></div>'
      + '<div class="row2"><div class="field"><label>CNPJ / CPF</label><span>' + destCnpj + '</span></div>'
      + '<div class="field"><label>Data Emissão</label><span>' + dataFmt + '</span></div></div></div>'
      + '<div class="row3"><div class="field"><label>Município</label><span>Curitiba</span></div>'
      + '<div class="field"><label>UF</label><span>PR</span></div>'
      + '<div class="field"><label>CEP</label><span>81200-240</span></div></div></div></div>'
      // ITENS
      + '<div class="blk"><div class="blk-hdr">Dados dos Produtos / Serviços</div>'
      + '<table><thead><tr><th style="width:40px">#</th><th style="width:80px">NCM</th><th>Descrição</th><th style="width:40px">UN</th><th style="width:55px;text-align:right">Qtd</th><th style="width:80px;text-align:right">V. Unit.</th><th style="width:100px;text-align:right">V. Total</th></tr></thead>'
      + '<tbody>' + itensHtml + '</tbody></table></div>'
      // TOTAIS
      + '<div class="totals"><div class="totals-hdr">Resumo Tributário — IBS / CBS (LC 214/2025)</div>'
      + '<div class="totals-body">'
      + '<div class="tval"><label>Valor Líquido</label><span>' + ff(vliq) + '</span></div>'
      + '<div class="tval"><label>CBS (8%)</label><span style="color:#b45309">' + ff(cbs) + '</span></div>'
      + '<div class="tval"><label>IBS (10%)</label><span style="color:#1d4ed8">' + ff(ibs) + '</span></div>'
      + '<div class="tval highlight"><label>Valor Total NF</label><span>' + ff(vtotal) + '</span></div>'
      + '</div></div>'
      // CHAVE
      + '<div class="chave-box"><label>Chave de Acesso (44 dígitos)</label>'
      + '<div class="chave">' + chaveFormatada + '</div>'
      + '<div class="barcode"></div></div>'
      // INF COMPLEMENTAR
      + '<div class="inf-comp"><strong>Informações Complementares:</strong> Documento fiscal eletrônico emitido conforme LC 214/2025 (IBS/CBS). '
      + 'CFOP: ' + d.cfop + ' · Natureza: ' + natOp + '. '
      + 'Ingestão SplitHub em ' + (d.dataIngestao||dataFmt) + '.</div>'
      // FOOTER
      + '<div class="footer"><span>Gerado pelo SplitHub — Plataforma IBS/CBS Induspar Tecnologia</span><span>' + dl.titulo + ' · ' + dataFmt + '</span></div>'
      + '</div>'
      + '</body></html>';

    var w = window.open('', '_blank', 'width=960,height=760,scrollbars=yes');
    if (w) { w.document.open(); w.document.write(html); w.document.close(); }
  };

  // ── Confirmar importação CSV posicional (precisa do closure) ─────────────
  window.ingUploadConfirmar = function(linhas) {
    if (!linhas || !linhas.length) return;
    if (!_ingIniciado) { window.ingestaoInit(); return; }
    var now = new Date();
    var mm  = String(now.getMonth()+1).padStart(2,'0');
    var dd  = String(now.getDate()).padStart(2,'0');
    var hh  = String(now.getHours()).padStart(2,'0');
    var mn  = String(now.getMinutes()).padStart(2,'0');
    var dIngestao = dd + '/' + mm + '/' + now.getFullYear() + ' ' + hh + ':' + mn;
    linhas.forEach(function(r) {
      var newId      = _ingDados.length;
      var rnd2       = _rng(Date.now() % 2147483647 + newId);
      var validacoes = _validacoesParaStatus('importado', rnd2);
      var vDeriv     = _derivaValidacoes('importado', validacoes);
      _ingDados.unshift({
        id: newId, chave: r.chave, tipo: r.tipoDF, emitente: r.emitente,
        cnpj: r.cnpj, ie: r.ie || '', uf: r.uf || '',
        cnpjDest: r.cnpjDest || '', nomeDest: r.nomeDest || '',
        valor: r.valor, ibs: r.ibs || 0, cbs: r.cbs || 0,
        cfop: r.cfop || '1102', serie: r.serie || '001', numero: r.numero || '',
        natOp: r.natOp || '',
        dataEmissao: r.dataEmissao, dataIngestao: dIngestao,
        status: 'importado',
        valLayout: vDeriv.valLayout, valValidade: vDeriv.valValidade, valDados: vDeriv.valDados,
        validacoes: validacoes, nfNumero: r.numero || ''
      });
    });
    _ingDados.forEach(function(d, i) { d.id = i; });
    window._ingDadosGlobal = _ingDados;
    _ingFiltrados = _ingDados.slice();
    _ingPagina = 1;
    _renderKPIs(_ingDados);
    _renderTabela();
    ingUploadFechar();
    var toast = document.createElement('div');
    toast.textContent = linhas.length + ' DF' + (linhas.length > 1 ? 's importadas' : ' importada') + ' com sucesso';
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#0B7A6E;color:#fff;padding:12px 20px;border-radius:8px;font-size:13px;font-weight:600;z-index:2000;box-shadow:0 4px 16px rgba(0,0,0,.2)';
    document.body.appendChild(toast);
    setTimeout(function(){ toast.remove(); }, 3000);
  };

  window.ingestaoSimularImportacao = function() {
    if (!_ingIniciado) { window.ingestaoInit(); return; }
    var rnd = _rng(Date.now() % 2147483647);
    var emit = _emitentes[Math.floor(rnd() * _emitentes.length)];
    var tipo = _tipos[Math.floor(rnd() * _tipos.length)];
    var valor = Math.round((rnd() * 200000 + 5000) * 100) / 100;
    var cfop = _cfops[Math.floor(rnd() * _cfops.length)];
    var now = new Date();
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var dd = String(now.getDate()).padStart(2, '0');
    var hh = String(now.getHours()).padStart(2, '0');
    var min = String(now.getMinutes()).padStart(2, '0');
    var dEmissao = now.getFullYear() + '-' + mm + '-' + dd;
    var dIngestao = dd + '/' + mm + '/' + now.getFullYear() + ' ' + hh + ':' + min;
    var newId = _ingDados.length;
    var chave = _chave(rnd, emit, newId, tipo);
    var status = 'pendente';
    var validacoes = _validacoesParaStatus(status, rnd);
    var vDeriv = _derivaValidacoes(status, validacoes);

    var novoDF = {
      id: newId,
      chave: chave,
      tipo: tipo,
      emitente: emit.nome,
      cnpj: emit.cnpj,
      valor: valor,
      cfop: cfop,
      dataEmissao: dEmissao,
      dataIngestao: dIngestao,
      status: status,
      valLayout: vDeriv.valLayout,
      valValidade: vDeriv.valValidade,
      valDados: vDeriv.valDados,
      validacoes: validacoes
    };

    _ingDados.unshift(novoDF);
    _ingDados.forEach(function(d, i) { d.id = i; });
    window._ingDadosGlobal = _ingDados;
    _ingFiltrados = _ingDados.slice();
    _ingPagina = 1;
    _renderKPIs(_ingDados);
    _renderTabela();
  };
})();


// ── Upload CSV (semicolon) — funções globais ─────────────────────────────
window._ingUploadLinhas = [];

window.ingUploadAbrir = function() {
  var modal = document.getElementById('ing-upload-modal');
  if (!modal) return;
  document.getElementById('ing-upload-input').value = '';
  document.getElementById('ing-upload-preview').style.display = 'none';
  document.getElementById('ing-upload-error').style.display = 'none';
  document.getElementById('ing-upload-confirmar').style.display = 'none';
  document.getElementById('ing-upload-erros-badge').style.display = 'none';
  document.getElementById('ing-upload-dropzone').style.borderColor = '';
  window._ingUploadLinhas = [];
  modal.style.display = 'flex';
};

window.ingUploadFechar = function() {
  var modal = document.getElementById('ing-upload-modal');
  if (modal) modal.style.display = 'none';
};

window.ingUploadDrop = function(ev) {
  ev.preventDefault();
  document.getElementById('ing-upload-dropzone').style.borderColor = '';
  var f = ev.dataTransfer && ev.dataTransfer.files[0];
  if (f) ingUploadArquivo(f);
};

window.ingUploadArquivo = function(file) {
  if (!file) return;
  document.getElementById('ing-upload-error').style.display = 'none';
  document.getElementById('ing-upload-preview').style.display = 'none';
  document.getElementById('ing-upload-confirmar').style.display = 'none';
  var reader = new FileReader();
  reader.onload = function(e) { ingUploadParsear(e.target.result); };
  reader.readAsText(file, 'UTF-8');
};

window.ingUploadParsear = function(text) {
  var linhas = text.split(/\r?\n/).filter(function(l) { return l.trim().length > 0; });
  var detalhe = [], erros = [];
  // col indices: chave(0) tipo_df(1) cnpj_emit(2) ie_emit(3) uf_emit(4) nome_emit(5)
  //              cnpj_dest(6) nome_dest(7) cfop(8) serie(9) numero(10) nat_op(11)
  //              valor_total(12) valor_ibs(13) valor_cbs(14) data_emissao(15)
  linhas.forEach(function(linha, i) {
    if (i === 0) return; // skip header
    var cols = linha.split(';');
    if (cols.length < 13) { erros.push('Linha ' + (i+1) + ': esperado ≥ 13 colunas, encontrado ' + cols.length); return; }
    var chave        = (cols[0] || '').trim();
    var tipoDF       = (cols[1] || 'NF-e Entrada').trim();
    var cnpj         = (cols[2] || '').trim();
    var ie           = (cols[3] || '').trim();
    var uf           = (cols[4] || '').trim();
    var emitente     = (cols[5] || 'Emitente não informado').trim();
    var cnpjDest     = (cols[6] || '').trim();
    var nomeDest     = (cols[7] || '').trim();
    var cfop         = (cols[8] || '').trim();
    var serie        = (cols[9] || '').trim();
    var numero       = (cols[10] || '').trim();
    var natOp        = (cols[11] || '').trim();
    var valorStr     = (cols[12] || '').trim().replace('.', '').replace(',', '.');
    var ibsStr       = (cols[13] || '').trim().replace('.', '').replace(',', '.');
    var cbsStr       = (cols[14] || '').trim().replace('.', '').replace(',', '.');
    var dataRaw      = (cols[15] || '').trim();
    var valor = parseFloat(valorStr);
    if (isNaN(valor) || valor <= 0) { erros.push('Linha ' + (i+1) + ': valor_total inválido ("' + cols[12] + '")'); return; }
    // data DD/MM/AAAA → AAAA-MM-DD
    var dataEmissao;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataRaw)) {
      dataEmissao = dataRaw.substring(6,10) + '-' + dataRaw.substring(3,5) + '-' + dataRaw.substring(0,2);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dataRaw)) {
      dataEmissao = dataRaw;
    } else { erros.push('Linha ' + (i+1) + ': data_emissao inválida ("' + dataRaw + '") — use DD/MM/AAAA'); return; }
    detalhe.push({
      chave: chave, tipoDF: tipoDF, cnpj: cnpj, ie: ie, uf: uf, emitente: emitente,
      cnpjDest: cnpjDest, nomeDest: nomeDest, cfop: cfop, serie: serie, numero: numero,
      natOp: natOp, valor: valor, ibs: parseFloat(ibsStr) || 0, cbs: parseFloat(cbsStr) || 0,
      dataEmissao: dataEmissao
    });
  });

  var errEl = document.getElementById('ing-upload-error');
  if (detalhe.length === 0) {
    errEl.textContent = erros.length ? erros.join(' · ') : 'Nenhum registro de detalhe (tipo 2) encontrado no arquivo.';
    errEl.style.display = '';
    return;
  }

  window._ingUploadLinhas = detalhe;

  var tbody = document.getElementById('ing-upload-tbody');
  var rows = '';
  detalhe.forEach(function(r, i) {
    var fmtVal = 'R$ ' + r.valor.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
    var fmtDt  = r.dataEmissao.split('-').reverse().join('/');
    rows += '<tr style="border-bottom:1px solid var(--border)">'
      + '<td style="padding:7px 12px;color:var(--txt3);font-size:11px">' + (i+1) + '</td>'
      + '<td style="padding:7px 12px;font-weight:600;font-size:12px">' + r.tipoDF + '</td>'
      + '<td style="padding:7px 12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">' + r.emitente + '</td>'
      + '<td style="padding:7px 12px;font-family:monospace;font-size:11px">' + (r.cfop || '—') + '</td>'
      + '<td style="padding:7px 12px;text-align:right;font-family:monospace;font-size:12px">' + fmtVal + '</td>'
      + '<td style="padding:7px 12px;font-size:12px">' + fmtDt + '</td>'
      + '<td style="padding:7px 12px"><span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:4px;background:rgba(29,158,117,.1);color:var(--green);border:1px solid rgba(29,158,117,.2)">Importado</span></td>'
      + '</tr>';
  });
  tbody.innerHTML = rows;

  document.getElementById('ing-upload-count').textContent = detalhe.length + ' registro' + (detalhe.length !== 1 ? 's' : '') + ' encontrado' + (detalhe.length !== 1 ? 's' : '');
  document.getElementById('ing-upload-preview').style.display = '';

  var badge = document.getElementById('ing-upload-erros-badge');
  if (erros.length > 0) {
    badge.textContent = erros.length + ' linha' + (erros.length > 1 ? 's' : '') + ' com erro ignorada' + (erros.length > 1 ? 's' : '');
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }

  var btnConf = document.getElementById('ing-upload-confirmar');
  btnConf.textContent = 'Importar ' + detalhe.length + ' DF' + (detalhe.length > 1 ? 's' : '');
  btnConf.style.display = '';
};

// Patch showView para garantir que atualizarInteligencia seja chamada
// independente da versão do HTML em cache
(function() {
  function _patchShowView() {
    if (typeof showView !== 'function') return;
    var _orig = showView;
    window.showView = function(id, btn, fromBottomNav) {
      _orig.call(this, id, btn, fromBottomNav);
      if (id === 'inteligencia') {
        setTimeout(function() {
          try { if (window.atualizarInteligencia) window.atualizarInteligencia(); } catch(e) {}
        }, 50);
      }
    };
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _patchShowView);
  } else {
    _patchShowView();
  }
})();

// ============================================================
// MÓDULO AUTOMAÇÕES
// ============================================================

window._automState = {
  abaAtiva: 'relatorios',
  relatorios: [
    { id:'REL-001', nome:'Créditos IBS+CBS — Mensal', modulo:'creditos', destinatarios:['fiscal@positivo.com','controladoria@positivo.com'], recorrencia:'mensal', diaHora:'1 · 08:00', formato:'PDF', ativo:true,  ultimoEnvio:'01/06/2026', proximoEnvio:'01/07/2026' },
    { id:'REL-002', nome:'Inconsistências — Semanal',  modulo:'inconsistencias', destinatarios:['compliance@positivo.com'], recorrencia:'semanal', diaHora:'Segunda · 07:00', formato:'Excel', ativo:true,  ultimoEnvio:'24/06/2026', proximoEnvio:'01/07/2026' },
    { id:'REL-003', nome:'Pagamentos Executados — Quinzenal', modulo:'pagamentos', destinatarios:['tesouraria@positivo.com','cfo@positivo.com'], recorrencia:'quinzenal', diaHora:'1 e 15 · 09:00', formato:'PDF', ativo:false, ultimoEnvio:'15/06/2026', proximoEnvio:'— (inativo)' }
  ],
  itsm: {
    configurado: true, sistema:'ServiceNow', urlBase:'https://positivo.service-now.com/api/now/table/', authTipo:'bearer',
    token:'••••••••••••••••••••••••',
    eventos: [
      { id:'nova_inconsistencia',  label:'Nova inconsistência detectada',     ativo:true,  ultimoEvento:'30/06/2026 14:22', totalEnviados:47 },
      { id:'status_alterado',      label:'Status de RF alterado',             ativo:true,  ultimoEvento:'30/06/2026 10:05', totalEnviados:218 },
      { id:'rf_vencido',           label:'RF próximo ao vencimento (7 dias)', ativo:true,  ultimoEvento:'29/06/2026 08:00', totalEnviados:12 },
      { id:'conciliacao_pendente', label:'Conciliação pendente há 30+ dias',  ativo:false, ultimoEvento:'—',               totalEnviados:0 }
    ],
    camposTitulo:'[SplitHub] {{tipo}} — RF {{rf_id}} · {{fornecedor}}',
    camposPrioridade:'2',
    camposCategoria:'Tributário IBS/CBS',
    historico:[
      { ts:'30/06 14:22', evento:'Nova inconsistência', rf:'RF-00000082', status:'201 Created', ticket:'INC0041872' },
      { ts:'30/06 10:05', evento:'Status alterado',     rf:'RF-00000061', status:'201 Created', ticket:'INC0041803' },
      { ts:'29/06 08:01', evento:'RF vencimento',       rf:'RF-00000035', status:'201 Created', ticket:'INC0041654' },
      { ts:'28/06 14:18', evento:'Nova inconsistência', rf:'RF-00000077', status:'422 Error',   ticket:'—'          }
    ]
  },
  cobranca: [
    { id:'COB-001', nome:'Alerta pré-vencimento (7 dias)',  gatilho:'pre', diasGatilho:7,  maxEnvios:2, intervalo:3, canal:'email', assunto:'[Ação necessária] Imposto IBS+CBS vence em {{dias_vencimento}} dias — {{fornecedor}}', corpo:'Prezado(a) {{contato_fornecedor}},\n\nInformamos que o Registro Fiscal {{rf_id}} referente ao imposto {{tipo_fiscal}} no valor de {{valor_rf}} vence em {{data_vencimento}} ({{dias_vencimento}} dias).\n\nPara evitar penalidades, solicite a regularização junto ao seu departamento fiscal.\n\nAtenciosamente,\nEquipe Fiscal · Induspar Tecnologia', ativo:true,  totalEnviados:34, ultimoDisparo:'28/06/2026' },
    { id:'COB-002', nome:'Cobrança pós-vencimento',         gatilho:'pos', diasGatilho:1,  maxEnvios:4, intervalo:5, canal:'email', assunto:'[URGENTE] Imposto IBS+CBS vencido — RF {{rf_id}} · {{fornecedor}}', corpo:'Prezado(a) {{contato_fornecedor}},\n\nO Registro Fiscal {{rf_id}} ({{tipo_fiscal}} — {{valor_rf}}) encontra-se VENCIDO desde {{data_vencimento}}.\n\nSolicite regularização imediata para evitar glosa do crédito tributário.\n\nAtenciosamente,\nEquipe Fiscal · Induspar Tecnologia', ativo:true,  totalEnviados:19, ultimoDisparo:'30/06/2026' }
  ]
};

var _automCor = { bg:'var(--bg)', card:'var(--card)', brd:'var(--border)', txt1:'var(--txt1)', txt2:'var(--txt2)', txt3:'var(--txt3)', teal:'#1d9e75', blue:'#185fa5', green:'#1d9e75', red:'#a32d2d', amber:'#ba7517', purple:'#8B5CF6' };
var _ac = _automCor;

var _automModLabels = { creditos:'Créditos', debitos:'Débitos', inconsistencias:'Inconsistências', pagamentos:'Pagamentos', consolidado:'Consolidado (Visão Geral)' };
var _automModCores  = { creditos:_ac.teal, debitos:_ac.blue, inconsistencias:_ac.red, pagamentos:_ac.green, consolidado:_ac.purple };

function _automFmt(v) { return v >= 1e6 ? 'R$ '+(v/1e6).toFixed(1).replace('.',',')+'M' : v >= 1e3 ? 'R$ '+Math.round(v/1e3)+'K' : 'R$ '+v; }

function _automBadge(txt, cor, bg) {
  bg = bg || cor.replace('#','').length === 6 ? cor + '22' : 'rgba(99,99,99,.15)';
  return '<span style="background:' + cor + '22;color:' + cor + ';border:1px solid ' + cor + '44;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">' + txt + '</span>';
}

function _automToggle(tipo, id, field) {
  var arr = window._automState[tipo];
  var item = arr.filter(function(x){ return x.id === id; })[0];
  if (item) { item[field] = !item[field]; window.automInit(); }
}

function _automExcluir(tipo, id) {
  window._automState[tipo] = window._automState[tipo].filter(function(x){ return x.id !== id; });
  window.automInit();
}

// ── Renderizadores de aba ───────────────────────────────────────

function _automRenderRelatorios(root) {
  var rels = window._automState.relatorios;
  var h = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">'
    + '<div><div style="font-size:15px;font-weight:700;color:' + _ac.txt1 + '">Relatórios Agendados</div>'
    + '<div style="font-size:12px;color:' + _ac.txt2 + ';margin-top:2px">Envio automático de relatórios por e-mail com filtros e recorrência configuráveis</div></div>'
    + '<button onclick="window._automAbrirModalRel()" style="background:' + _ac.teal + ';color:#0a0a0a;border:none;border-radius:7px;padding:9px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">+ Novo Relatório</button>'
    + '</div>';

  if (!rels.length) {
    h += '<div style="text-align:center;padding:48px;color:' + _ac.txt3 + ';font-size:13px">Nenhum relatório agendado. Clique em "+ Novo Relatório" para criar.</div>';
  } else {
    h += '<div style="display:flex;flex-direction:column;gap:12px">';
    rels.forEach(function(r) {
      var modCor = _automModCores[r.modulo] || _ac.txt2;
      var modLbl = _automModLabels[r.modulo] || r.modulo;
      var recBadge = { diaria:'Diária', semanal:'Semanal', quinzenal:'Quinzenal', mensal:'Mensal' }[r.recorrencia] || r.recorrencia;
      h += '<div style="background:' + _ac.card + ';border:1px solid ' + _ac.brd + ';border-left:3px solid ' + modCor + ';border-radius:8px;padding:16px 18px">'
        + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">'
        + '<div style="flex:1">'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'
        + '<span style="font-size:13px;font-weight:700;color:' + _ac.txt1 + '">' + r.nome + '</span>'
        + _automBadge(modLbl, modCor)
        + _automBadge(recBadge, _ac.purple)
        + _automBadge(r.formato, _ac.txt2)
        + (r.ativo ? _automBadge('Ativo', _ac.green) : _automBadge('Inativo', _ac.txt3))
        + '</div>'
        + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px">'
        + '<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:' + _ac.txt3 + ';margin-bottom:3px">Destinatários</div><div style="font-size:12px;color:' + _ac.txt2 + '">' + r.destinatarios.join(', ') + '</div></div>'
        + '<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:' + _ac.txt3 + ';margin-bottom:3px">Agendamento</div><div style="font-size:12px;color:' + _ac.txt2 + '">' + r.diaHora + '</div></div>'
        + '<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:' + _ac.txt3 + ';margin-bottom:3px">Próximo envio</div><div style="font-size:12px;color:' + _ac.txt1 + ';font-weight:600">' + r.proximoEnvio + '</div></div>'
        + '</div>'
        + '</div>'
        + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0">'
        + '<label style="display:flex;align-items:center;gap:7px;cursor:pointer">'
        + '<span style="font-size:11px;color:' + _ac.txt2 + '">' + (r.ativo ? 'Ativo' : 'Inativo') + '</span>'
        + '<div onclick="window._automToggle(\'relatorios\',\'' + r.id + '\',\'ativo\')" style="width:36px;height:20px;border-radius:10px;background:' + (r.ativo ? _ac.teal : _ac.brd) + ';position:relative;cursor:pointer;transition:background .2s">'
        + '<div style="position:absolute;top:3px;left:' + (r.ativo ? '18' : '3') + 'px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .2s"></div></div>'
        + '</label>'
        + '<div style="display:flex;gap:6px">'
        + '<button onclick="window._automAbrirModalRel(\'' + r.id + '\')" style="background:none;border:1px solid ' + _ac.brd + ';border-radius:5px;padding:4px 10px;font-size:11px;color:' + _ac.txt2 + ';cursor:pointer;font-family:inherit">Editar</button>'
        + '<button onclick="window._automExcluir(\'relatorios\',\'' + r.id + '\')" style="background:none;border:1px solid rgba(244,63,94,.3);border-radius:5px;padding:4px 10px;font-size:11px;color:' + _ac.red + ';cursor:pointer;font-family:inherit">Excluir</button>'
        + '</div>'
        + '</div>'
        + '</div>'
        + '<div style="font-size:11px;color:' + _ac.txt3 + ';border-top:1px solid ' + _ac.brd + ';padding-top:10px;margin-top:4px">Último envio: ' + r.ultimoEnvio + ' · ID: ' + r.id + '</div>'
        + '</div>';
    });
    h += '</div>';
  }
  root.innerHTML = h;
}

function _automRenderITSM(root) {
  var cfg = window._automState.itsm;
  var sistemasCores = { ServiceNow:_ac.green, 'Jira Service Desk':_ac.blue, Zendesk:'#F79009', Custom:_ac.txt2 };
  var sisCor = sistemasCores[cfg.sistema] || _ac.txt2;
  var h = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">'
    + '<div><div style="font-size:15px;font-weight:700;color:' + _ac.txt1 + '">Integração ITSM</div>'
    + '<div style="font-size:12px;color:' + _ac.txt2 + ';margin-top:2px">Envio de eventos de inconsistências para sistema externo via API REST (padrão ITSM de mercado)</div></div>'
    + (cfg.configurado ? '<div style="display:flex;align-items:center;gap:8px">' + _automBadge('● Conectado · ' + cfg.sistema, _ac.green) + '<button onclick="window._automTestarConexao()" style="background:none;border:1px solid ' + _ac.brd + ';border-radius:5px;padding:6px 12px;font-size:11px;color:' + _ac.txt2 + ';cursor:pointer;font-family:inherit">Testar conexão</button></div>' : '')
    + '</div>';

  // Config panel
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">';
  h += _automFieldCard('Sistema ITSM', cfg.sistema, sisCor, true);
  h += _automFieldCard('URL Base da API', cfg.urlBase, _ac.blue, false, true);
  h += _automFieldCard('Autenticação', cfg.authTipo === 'bearer' ? 'Bearer Token' : cfg.authTipo, _ac.txt2);
  h += _automFieldCard('Credencial', cfg.token, _ac.txt3);
  h += _automFieldCard('Título do Ticket', cfg.camposTitulo, _ac.txt2, false, true);
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
    + _automFieldCard('Prioridade padrão', {1:'1 – Crítica',2:'2 – Alta',3:'3 – Média',4:'4 – Baixa'}[cfg.camposPrioridade]||cfg.camposPrioridade, _ac.amber)
    + _automFieldCard('Categoria', cfg.camposCategoria, _ac.teal)
    + '</div>';
  h += '</div>';
  h += '<button onclick="window._automAbrirModalITSM()" style="background:' + _ac.blue + '22;border:1px solid ' + _ac.blue + '44;color:' + _ac.blue + ';border-radius:7px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;margin-bottom:20px">✏️ Editar configuração</button>';

  // Eventos
  h += '<div style="font-size:13px;font-weight:700;color:' + _ac.txt1 + ';margin-bottom:12px">Eventos mapeados</div>';
  h += '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">';
  cfg.eventos.forEach(function(ev) {
    h += '<div style="background:' + _ac.card + ';border:1px solid ' + _ac.brd + ';border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:14px">'
      + '<div onclick="ev_toggle_' + ev.id + '()" id="ev-tog-' + ev.id + '" style="width:36px;height:20px;border-radius:10px;background:' + (ev.ativo ? _ac.teal : _ac.brd) + ';position:relative;cursor:pointer;flex-shrink:0;transition:background .2s" onclick="window._automToggleEvento(\'' + ev.id + '\')">'
      + '<div style="position:absolute;top:3px;left:' + (ev.ativo ? '18' : '3') + 'px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .2s"></div></div>'
      + '<div style="flex:1">'
      + '<div style="font-size:12px;font-weight:600;color:' + _ac.txt1 + '">' + ev.label + '</div>'
      + '<div style="font-size:11px;color:' + _ac.txt3 + ';margin-top:2px">Último envio: ' + ev.ultimoEvento + ' · Total: ' + ev.totalEnviados + ' eventos</div>'
      + '</div>'
      + (ev.ativo ? _automBadge('Ativo', _ac.green) : _automBadge('Inativo', _ac.txt3))
      + '</div>';
  });
  h += '</div>';

  // Histórico
  h += '<div style="font-size:13px;font-weight:700;color:' + _ac.txt1 + ';margin-bottom:10px">Histórico de envios recentes</div>';
  h += '<div class="twrap"><table><thead><tr><th>Timestamp</th><th>Evento</th><th>RF</th><th>HTTP Status</th><th>Ticket criado</th></tr></thead><tbody>';
  cfg.historico.forEach(function(row) {
    var ok = row.status.indexOf('201') >= 0;
    h += '<tr>'
      + '<td class="mono" style="font-size:11px;color:' + _ac.txt3 + '">' + row.ts + '</td>'
      + '<td style="font-size:12px">' + row.evento + '</td>'
      + '<td class="mono" style="color:' + _ac.blue + ';font-size:11px">' + row.rf + '</td>'
      + '<td>' + _automBadge(row.status, ok ? _ac.green : _ac.red) + '</td>'
      + '<td class="mono" style="color:' + _ac.teal + ';font-size:11px">' + row.ticket + '</td>'
      + '</tr>';
  });
  h += '</tbody></table></div>';
  root.innerHTML = h;

  // Bind toggle events
  cfg.eventos.forEach(function(ev) {
    var tog = document.getElementById('ev-tog-' + ev.id);
    if (tog) tog.onclick = function() { window._automToggleEvento(ev.id); };
  });
}

function _automFieldCard(label, val, cor, badge, mono) {
  return '<div style="background:' + _ac.card + ';border:1px solid ' + _ac.brd + ';border-radius:7px;padding:12px 14px">'
    + '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:' + _ac.txt3 + ';margin-bottom:5px">' + label + '</div>'
    + (badge ? _automBadge(val, cor) : '<div style="font-size:' + (mono ? '11px' : '12px') + ';color:' + cor + ';font-family:' + (mono ? 'monospace' : 'inherit') + ';word-break:break-all">' + val + '</div>')
    + '</div>';
}

function _automRenderCobranca(root) {
  var regras = window._automState.cobranca;
  var h = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">'
    + '<div><div style="font-size:15px;font-weight:700;color:' + _ac.txt1 + '">Régua de Cobrança</div>'
    + '<div style="font-size:12px;color:' + _ac.txt2 + ';margin-top:2px">Envio automático de alertas aos fornecedores com impostos próximos ao vencimento ou vencidos</div></div>'
    + '<button onclick="window._automAbrirModalCob()" style="background:' + _ac.amber + ';color:#0a0a0a;border:none;border-radius:7px;padding:9px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">+ Nova Régua</button>'
    + '</div>';

  // Estatísticas rápidas
  var totalEnv = regras.reduce(function(s,r){ return s+r.totalEnviados; }, 0);
  var ativas = regras.filter(function(r){ return r.ativo; }).length;
  h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">'
    + _automKpiMini('Réguas ativas', ativas + '/' + regras.length, _ac.amber)
    + _automKpiMini('Alertas enviados (total)', totalEnv.toString(), _ac.blue)
    + _automKpiMini('Fornecedores em cobrança', '6', _ac.red)
    + '</div>';

  if (!regras.length) {
    h += '<div style="text-align:center;padding:48px;color:' + _ac.txt3 + ';font-size:13px">Nenhuma régua configurada.</div>';
  } else {
    h += '<div style="display:flex;flex-direction:column;gap:14px">';
    regras.forEach(function(r) {
      var gatCor = r.gatilho === 'pre' ? _ac.amber : _ac.red;
      var gatLbl = r.gatilho === 'pre' ? r.diasGatilho + ' dias antes do vencimento' : 'Vencido há ' + r.diasGatilho + '+ dias';
      h += '<div style="background:' + _ac.card + ';border:1px solid ' + _ac.brd + ';border-left:3px solid ' + gatCor + ';border-radius:8px;padding:16px 18px">'
        + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px">'
        + '<div>'
        + '<div style="font-size:13px;font-weight:700;color:' + _ac.txt1 + ';margin-bottom:6px">' + r.nome + '</div>'
        + '<div style="display:flex;flex-wrap:wrap;gap:6px">'
        + _automBadge(gatLbl, gatCor)
        + _automBadge('Máx. ' + r.maxEnvios + ' envio' + (r.maxEnvios > 1 ? 's' : ''), _ac.blue)
        + _automBadge('A cada ' + r.intervalo + ' dias', _ac.purple)
        + _automBadge(r.canal === 'email' ? '✉️ E-mail' : r.canal, _ac.txt2)
        + (r.ativo ? _automBadge('Ativa', _ac.green) : _automBadge('Inativa', _ac.txt3))
        + '</div>'
        + '</div>'
        + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0">'
        + '<label style="display:flex;align-items:center;gap:7px;cursor:pointer">'
        + '<span style="font-size:11px;color:' + _ac.txt2 + '">' + (r.ativo ? 'Ativa' : 'Inativa') + '</span>'
        + '<div onclick="window._automToggle(\'cobranca\',\'' + r.id + '\',\'ativo\')" style="width:36px;height:20px;border-radius:10px;background:' + (r.ativo ? _ac.teal : _ac.brd) + ';position:relative;cursor:pointer;transition:background .2s">'
        + '<div style="position:absolute;top:3px;left:' + (r.ativo ? '18' : '3') + 'px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .2s"></div></div>'
        + '</label>'
        + '<div style="display:flex;gap:6px">'
        + '<button onclick="window._automAbrirModalCob(\'' + r.id + '\')" style="background:none;border:1px solid ' + _ac.brd + ';border-radius:5px;padding:4px 10px;font-size:11px;color:' + _ac.txt2 + ';cursor:pointer;font-family:inherit">Editar</button>'
        + '<button onclick="window._automExcluir(\'cobranca\',\'' + r.id + '\')" style="background:none;border:1px solid rgba(244,63,94,.3);border-radius:5px;padding:4px 10px;font-size:11px;color:' + _ac.red + ';cursor:pointer;font-family:inherit">Excluir</button>'
        + '</div>'
        + '</div>'
        + '</div>'
        // Template preview
        + '<div style="background:var(--card);border:1px solid var(--border);border-radius:6px;padding:12px 14px;margin-bottom:10px">'
        + '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:' + _ac.txt3 + ';margin-bottom:6px">Template de e-mail</div>'
        + '<div style="font-size:11px;font-weight:600;color:' + _ac.txt1 + ';margin-bottom:4px">Assunto: ' + r.assunto + '</div>'
        + '<div style="font-size:11px;color:' + _ac.txt2 + ';white-space:pre-line;line-height:1.6;max-height:80px;overflow:hidden">' + r.corpo.substring(0, 200) + (r.corpo.length > 200 ? '…' : '') + '</div>'
        + '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px">'
        + ['{{fornecedor}}','{{rf_id}}','{{tipo_fiscal}}','{{valor_rf}}','{{data_vencimento}}','{{dias_vencimento}}','{{contato_fornecedor}}'].map(function(v){ return '<code style="background:rgba(73,197,177,.1);color:' + _ac.teal + ';border-radius:3px;padding:1px 5px;font-size:10px">' + v + '</code>'; }).join('')
        + '</div></div>'
        + '<div style="font-size:11px;color:' + _ac.txt3 + '">Último disparo: ' + r.ultimoDisparo + ' · Total enviados: ' + r.totalEnviados + ' · ID: ' + r.id + '</div>'
        + '</div>';
    });
    h += '</div>';
  }
  root.innerHTML = h;
}

function _automKpiMini(label, val, cor) {
  return '<div style="background:' + _ac.card + ';border:1px solid ' + _ac.brd + ';border-top:2px solid ' + cor + ';border-radius:8px;padding:14px 16px">'
    + '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:' + _ac.txt3 + ';margin-bottom:6px">' + label + '</div>'
    + '<div style="font-size:22px;font-weight:700;color:' + cor + ';font-family:\'Montserrat\',sans-serif">' + val + '</div>'
    + '</div>';
}

// ── automInit — ponto de entrada ────────────────────────────────

window.automInit = function() {
  var sv = document.getElementById('admin-automacoes');
  if (!sv) return;
  var aba = window._automState.abaAtiva;

  // Header + tabs
  var tabsCfg = [
    { id:'relatorios', label:'📧  Relatórios Agendados' },
    { id:'itsm',       label:'🔗  Integração ITSM'     },
    { id:'cobranca',   label:'🔔  Régua de Cobrança'   }
  ];

  var tabsHtml = tabsCfg.map(function(t) {
    var active = t.id === aba;
    return '<button onclick="window._automSetAba(\'' + t.id + '\')" style="padding:9px 18px;font-size:13px;font-weight:' + (active ? '700' : '500') + ';color:' + (active ? _ac.teal : _ac.txt2) + ';background:' + (active ? 'rgba(73,197,177,.08)' : 'transparent') + ';border:none;border-bottom:2px solid ' + (active ? _ac.teal : 'transparent') + ';cursor:pointer;font-family:inherit;white-space:nowrap;transition:color .15s">' + t.label + '</button>';
  }).join('');

  var root = document.getElementById('autom-root');
  if (!root) return;
  root.innerHTML = '<div style="border-bottom:1px solid ' + _ac.brd + ';margin-bottom:24px;display:flex;gap:4px">' + tabsHtml + '</div>'
    + '<div id="autom-content"></div>';

  var content = document.getElementById('autom-content');
  if (aba === 'relatorios') _automRenderRelatorios(content);
  else if (aba === 'itsm')   _automRenderITSM(content);
  else                       _automRenderCobranca(content);
};

window._automSetAba = function(id) {
  window._automState.abaAtiva = id;
  window.automInit();
};

window._automToggle = function(tipo, id, field) {
  var arr = window._automState[tipo];
  var item = arr.filter(function(x){ return x.id === id; })[0];
  if (item) { item[field] = !item[field]; window.automInit(); }
};

window._automToggleEvento = function(evId) {
  var ev = (window._automState.itsm.eventos || []).filter(function(e){ return e.id === evId; })[0];
  if (ev) { ev.ativo = !ev.ativo; window.automInit(); }
};

window._automExcluir = function(tipo, id) {
  window._automState[tipo] = window._automState[tipo].filter(function(x){ return x.id !== id; });
  window.automInit();
};

window._automTestarConexao = function() {
  var toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:28px;right:24px;background:var(--card);border:1px solid rgba(29,158,117,.4);border-left:4px solid #1d9e75;border-radius:8px;padding:14px 18px;z-index:10001;font-family:Montserrat,sans-serif;min-width:280px;box-shadow:0 8px 24px rgba(0,0,0,.3)';
  toast.innerHTML = '<div style="font-size:13px;font-weight:700;color:var(--txt1);margin-bottom:3px">✅ Conexão bem-sucedida</div><div style="font-size:11px;color:var(--txt2)">ServiceNow · HTTP 200 · latência 142ms</div>';
  document.body.appendChild(toast);
  setTimeout(function(){ if(toast.parentNode) toast.parentNode.removeChild(toast); }, 3500);
};

// ── Modais de criação/edição ────────────────────────────────────

window._automAbrirModalRel = function(id) {
  var r = id ? (window._automState.relatorios.filter(function(x){ return x.id === id; })[0]) : null;
  var titulo = r ? 'Editar Relatório' : 'Novo Relatório Agendado';
  var v = r || { nome:'', modulo:'creditos', destinatarios:[], recorrencia:'mensal', diaHora:'1 · 08:00', formato:'PDF', ativo:true };
  var html = _automOverlay(titulo,
    _automCampo('Nome do relatório', '<input id="am-nome" value="' + (v.nome||'') + '" style="' + _automInputStyle() + '">')
    + _automCampo('Módulo / dados',
      '<select id="am-modulo" style="' + _automInputStyle() + '">'
      + ['creditos','debitos','inconsistencias','pagamentos','consolidado'].map(function(m){ return '<option value="' + m + '"' + (v.modulo===m?' selected':'') + '>' + (_automModLabels[m]||m) + '</option>'; }).join('')
      + '</select>')
    + _automCampo('Destinatários (e-mails, separados por vírgula)', '<input id="am-dest" value="' + (v.destinatarios||[]).join(', ') + '" placeholder="email@empresa.com, outro@empresa.com" style="' + _automInputStyle() + '">')
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
    + _automCampo('Recorrência',
      '<select id="am-rec" style="' + _automInputStyle() + '">'
      + ['diaria','semanal','quinzenal','mensal'].map(function(x){ return '<option value="' + x + '"' + (v.recorrencia===x?' selected':'') + '>' + {diaria:'Diária',semanal:'Semanal',quinzenal:'Quinzenal',mensal:'Mensal'}[x] + '</option>'; }).join('')
      + '</select>')
    + _automCampo('Dia / hora', '<input id="am-hora" value="' + (v.diaHora||'') + '" placeholder="1 · 08:00" style="' + _automInputStyle() + '">')
    + '</div>'
    + _automCampo('Formato',
      '<select id="am-fmt" style="' + _automInputStyle() + '">'
      + ['PDF','Excel','CSV'].map(function(x){ return '<option' + (v.formato===x?' selected':'') + '>' + x + '</option>'; }).join('')
      + '</select>'),
    'window._automSalvarRel(\'' + (id||'') + '\')'
  );
  document.getElementById('_automOverlay') && document.getElementById('_automOverlay').remove();
  document.body.insertAdjacentHTML('beforeend', html);
};

window._automSalvarRel = function(id) {
  var nome = document.getElementById('am-nome').value.trim();
  var dest = document.getElementById('am-dest').value.split(',').map(function(e){ return e.trim(); }).filter(Boolean);
  if (!nome || !dest.length) { alert('Nome e destinatário são obrigatórios.'); return; }
  var obj = {
    id:          id || 'REL-' + String(Date.now()).slice(-3),
    nome:        nome,
    modulo:      document.getElementById('am-modulo').value,
    destinatarios: dest,
    recorrencia: document.getElementById('am-rec').value,
    diaHora:     document.getElementById('am-hora').value,
    formato:     document.getElementById('am-fmt').value,
    ativo:       true, ultimoEnvio:'—', proximoEnvio:'Calculando…'
  };
  if (id) {
    var idx = window._automState.relatorios.findIndex(function(x){ return x.id === id; });
    if (idx >= 0) window._automState.relatorios[idx] = obj;
  } else {
    window._automState.relatorios.push(obj);
  }
  document.getElementById('_automOverlay').remove();
  window.automInit();
  _automToast('Relatório salvo com sucesso', _ac.green);
};

window._automAbrirModalITSM = function() {
  var cfg = window._automState.itsm;
  var html = _automOverlay('Configurar Integração ITSM',
    _automCampo('Sistema ITSM',
      '<select id="am-itsm-sys" style="' + _automInputStyle() + '">'
      + ['ServiceNow','Jira Service Desk','Zendesk','Custom'].map(function(s){ return '<option' + (cfg.sistema===s?' selected':'') + '>' + s + '</option>'; }).join('')
      + '</select>')
    + _automCampo('URL base da API', '<input id="am-itsm-url" value="' + cfg.urlBase + '" placeholder="https://empresa.service-now.com/api/..." style="' + _automInputStyle() + '">')
    + _automCampo('Tipo de autenticação',
      '<select id="am-itsm-auth" style="' + _automInputStyle() + '">'
      + [{v:'bearer',l:'Bearer Token'},{v:'basic',l:'Basic Auth (user:pass)'},{v:'apikey',l:'API Key (header)'}].map(function(a){ return '<option value="' + a.v + '"' + (cfg.authTipo===a.v?' selected':'') + '>' + a.l + '</option>'; }).join('')
      + '</select>')
    + _automCampo('Token / Credencial', '<input id="am-itsm-tok" type="password" value="" placeholder="Cole o token ou credencial aqui" style="' + _automInputStyle() + '">')
    + _automCampo('Template do título do ticket', '<input id="am-itsm-tit" value="' + cfg.camposTitulo + '" style="' + _automInputStyle() + '">')
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
    + _automCampo('Prioridade padrão',
      '<select id="am-itsm-prio" style="' + _automInputStyle() + '">'
      + [{v:'1',l:'1 – Crítica'},{v:'2',l:'2 – Alta'},{v:'3',l:'3 – Média'},{v:'4',l:'4 – Baixa'}].map(function(p){ return '<option value="' + p.v + '"' + (cfg.camposPrioridade===p.v?' selected':'') + '>' + p.l + '</option>'; }).join('')
      + '</select>')
    + _automCampo('Categoria', '<input id="am-itsm-cat" value="' + cfg.camposCategoria + '" style="' + _automInputStyle() + '">')
    + '</div>'
    + '<div style="background:rgba(73,197,177,.06);border:1px solid rgba(73,197,177,.2);border-radius:6px;padding:10px 12px;font-size:11px;color:' + _ac.txt2 + ';margin-top:4px">Variáveis disponíveis no título: <code style="color:' + _ac.teal + '">{{tipo}} {{rf_id}} {{fornecedor}} {{inconsistencia}} {{valor}} {{data}}</code></div>',
    'window._automSalvarITSM()'
  );
  document.getElementById('_automOverlay') && document.getElementById('_automOverlay').remove();
  document.body.insertAdjacentHTML('beforeend', html);
};

window._automSalvarITSM = function() {
  var url = document.getElementById('am-itsm-url').value.trim();
  if (!url) { alert('URL da API é obrigatória.'); return; }
  window._automState.itsm.sistema        = document.getElementById('am-itsm-sys').value;
  window._automState.itsm.urlBase        = url;
  window._automState.itsm.authTipo       = document.getElementById('am-itsm-auth').value;
  window._automState.itsm.camposTitulo   = document.getElementById('am-itsm-tit').value;
  window._automState.itsm.camposPrioridade = document.getElementById('am-itsm-prio').value;
  window._automState.itsm.camposCategoria  = document.getElementById('am-itsm-cat').value;
  window._automState.itsm.configurado = true;
  document.getElementById('_automOverlay').remove();
  window.automInit();
  _automToast('Configuração ITSM salva', _ac.green);
};

window._automAbrirModalCob = function(id) {
  var r = id ? (window._automState.cobranca.filter(function(x){ return x.id === id; })[0]) : null;
  var titulo = r ? 'Editar Régua de Cobrança' : 'Nova Régua de Cobrança';
  var v = r || { nome:'', gatilho:'pre', diasGatilho:7, maxEnvios:3, intervalo:3, canal:'email', assunto:'', corpo:'', ativo:true };
  var html = _automOverlay(titulo,
    _automCampo('Nome da régua', '<input id="am-cob-nome" value="' + (v.nome||'') + '" style="' + _automInputStyle() + '">')
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
    + _automCampo('Gatilho',
      '<select id="am-cob-gat" style="' + _automInputStyle() + '">'
      + [{v:'pre',l:'Antes do vencimento'},{v:'pos',l:'Após o vencimento'}].map(function(g){ return '<option value="' + g.v + '"' + (v.gatilho===g.v?' selected':'') + '>' + g.l + '</option>'; }).join('')
      + '</select>')
    + _automCampo('Dias do gatilho', '<input id="am-cob-dias" type="number" min="1" max="90" value="' + (v.diasGatilho||7) + '" style="' + _automInputStyle() + '">')
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">'
    + _automCampo('Máx. de envios', '<input id="am-cob-max" type="number" min="1" max="10" value="' + (v.maxEnvios||3) + '" style="' + _automInputStyle() + '">')
    + _automCampo('Intervalo (dias)', '<input id="am-cob-int" type="number" min="1" max="30" value="' + (v.intervalo||3) + '" style="' + _automInputStyle() + '">')
    + _automCampo('Canal',
      '<select id="am-cob-canal" style="' + _automInputStyle() + '">'
      + [{v:'email',l:'✉️ E-mail'},{v:'whatsapp',l:'💬 WhatsApp'},{v:'ambos',l:'✉️+💬 Ambos'}].map(function(c){ return '<option value="' + c.v + '"' + (v.canal===c.v?' selected':'') + '>' + c.l + '</option>'; }).join('')
      + '</select>')
    + '</div>'
    + _automCampo('Assunto do e-mail', '<input id="am-cob-ass" value="' + (v.assunto||'') + '" placeholder="[Ação necessária] Imposto {{tipo_fiscal}} vence em {{dias_vencimento}} dias" style="' + _automInputStyle() + '">')
    + _automCampo('Corpo do e-mail',
      '<textarea id="am-cob-corpo" rows="6" style="' + _automInputStyle() + 'resize:vertical;font-family:monospace;font-size:11px">' + (v.corpo||'') + '</textarea>')
    + '<div style="background:rgba(73,197,177,.06);border:1px solid rgba(73,197,177,.2);border-radius:6px;padding:10px 12px;font-size:11px;color:' + _ac.txt2 + '">Variáveis: '
    + ['{{fornecedor}}','{{rf_id}}','{{tipo_fiscal}}','{{valor_rf}}','{{data_vencimento}}','{{dias_vencimento}}','{{contato_fornecedor}}'].map(function(v){ return '<code style="color:' + _ac.teal + '">' + v + '</code>'; }).join(' ')
    + '</div>',
    'window._automSalvarCob(\'' + (id||'') + '\')'
  );
  document.getElementById('_automOverlay') && document.getElementById('_automOverlay').remove();
  document.body.insertAdjacentHTML('beforeend', html);
};

window._automSalvarCob = function(id) {
  var nome = document.getElementById('am-cob-nome').value.trim();
  if (!nome) { alert('Nome é obrigatório.'); return; }
  var obj = {
    id:           id || 'COB-' + String(Date.now()).slice(-3),
    nome:         nome,
    gatilho:      document.getElementById('am-cob-gat').value,
    diasGatilho:  parseInt(document.getElementById('am-cob-dias').value) || 7,
    maxEnvios:    parseInt(document.getElementById('am-cob-max').value) || 3,
    intervalo:    parseInt(document.getElementById('am-cob-int').value) || 3,
    canal:        document.getElementById('am-cob-canal').value,
    assunto:      document.getElementById('am-cob-ass').value,
    corpo:        document.getElementById('am-cob-corpo').value,
    ativo:        true, totalEnviados: r ? r.totalEnviados : 0, ultimoDisparo: r ? r.ultimoDisparo : '—'
  };
  var r = id ? (window._automState.cobranca.filter(function(x){ return x.id === id; })[0]) : null;
  if (id) {
    var idx = window._automState.cobranca.findIndex(function(x){ return x.id === id; });
    if (idx >= 0) window._automState.cobranca[idx] = obj;
  } else {
    window._automState.cobranca.push(obj);
  }
  document.getElementById('_automOverlay').remove();
  window.automInit();
  _automToast('Régua de cobrança salva', _ac.green);
};

// ── Helpers de UI ───────────────────────────────────────────────

function _automInputStyle() {
  return 'width:100%;background:var(--card);border:1px solid var(--border);border-radius:6px;padding:9px 12px;color:var(--txt1);font-size:13px;font-family:inherit;box-sizing:border-box;outline:none;';
}

function _automCampo(label, input) {
  return '<div style="margin-bottom:14px"><label style="display:block;font-size:11px;font-weight:600;color:var(--txt2);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">' + label + '</label>' + input + '</div>';
}

function _automOverlay(titulo, campos, onSave) {
  return '<div id="_automOverlay" onclick="if(event.target===this)document.getElementById(\'_automOverlay\').remove()" style="position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px">'
    + '<div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;width:100%;max-width:560px;max-height:92vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,.6)">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--bg);z-index:1">'
    + '<div style="font-size:15px;font-weight:700;color:var(--txt1)">' + titulo + '</div>'
    + '<button onclick="document.getElementById(\'_automOverlay\').remove()" style="background:none;border:none;color:var(--txt2);font-size:20px;cursor:pointer;line-height:1;padding:4px">✕</button>'
    + '</div>'
    + '<div style="padding:20px">' + campos + '</div>'
    + '<div style="display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid var(--border)">'
    + '<button onclick="document.getElementById(\'_automOverlay\').remove()" style="background:none;border:1px solid var(--border);border-radius:7px;padding:9px 18px;color:var(--txt2);font-size:13px;cursor:pointer;font-family:inherit">Cancelar</button>'
    + '<button onclick="' + onSave + '" style="background:#1d9e75;border:none;border-radius:7px;padding:9px 18px;color:#0a0a0a;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Salvar</button>'
    + '</div></div></div>';
}

function _automToast(msg, cor) {
  var t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:28px;right:24px;background:var(--card);border:1px solid ' + cor + '44;border-left:4px solid ' + cor + ';border-radius:8px;padding:12px 18px;z-index:10001;font-family:Montserrat,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3);font-size:13px;font-weight:600;color:var(--txt1)';
  t.textContent = '✓  ' + msg;
  document.body.appendChild(t);
  setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 3000);
}

// ============================================================
// RAG — Assistente Tributário com BM25 + Claude API
// ============================================================

// ── BM25 ────────────────────────────────────────────────────
window._rag = (function() {
  var k1 = 1.5, b = 0.75;

  function tok(text) {
    return (text || '').toLowerCase()
      .replace(/[^a-z0-9áéíóúãõâêôçàü\s]/g, ' ')
      .split(/\s+/)
      .filter(function(t) { return t.length > 1; });
  }

  function buildIndex(docs) {
    var N = docs.length || 1;
    var tfs = docs.map(function(d) {
      var terms = tok(d.text);
      var tf = {};
      terms.forEach(function(t) { tf[t] = (tf[t] || 0) + 1; });
      return { tf: tf, len: terms.length };
    });
    var df = {};
    tfs.forEach(function(d) {
      Object.keys(d.tf).forEach(function(t) { df[t] = (df[t] || 0) + 1; });
    });
    var avgdl = tfs.reduce(function(s, d) { return s + d.len; }, 0) / N;

    return function score(query, idx) {
      var d = tfs[idx];
      return tok(query).reduce(function(acc, t) {
        var f = d.tf[t] || 0;
        if (!f) return acc;
        var idf = Math.log((N - (df[t] || 0) + 0.5) / ((df[t] || 0) + 0.5) + 1);
        var tf_n = (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / avgdl));
        return acc + idf * tf_n;
      }, 0);
    };
  }

  return { buildIndex: buildIndex };
})();

window._ragDocs  = [];
window._ragScore = null;

// ── Construção do índice ─────────────────────────────────────
window.ragBuildIndex = function() {
  var docs = [];

  // 1. Base de conhecimento tributário (legislação)
  [
    { id:'kb-split',     src:'LC 214/2025 arts. 47–52',           text:'split payment mecanismo retenção automática tributo IBS CBS instituição financeira PIX cartão boleto recolhimento transferência fiscal TF comprador fornecedor pagamento automático' },
    { id:'kb-aliquota',  src:'LC 214/2025 arts. 54–89',           text:'alíquota CBS 8.8% IBS 0.1% imposto seletivo IS percentual taxa reforma tributária 2026 2033 cálculo base' },
    { id:'kb-credito',   src:'LC 214/2025 arts. 44–55',           text:'crédito tributário apropriar apropriação não-cumulatividade glosa perda crédito fornecedor pagamento confirmado plataforma centralizada ressarcimento em risco vencido inconsistência' },
    { id:'kb-rad',       src:'LC 214/2025 art. 51; Decreto 12.955 arts. 12–15', text:'RAD recolhimento pelo adquirente substituto ente público regime especial B2B adquirente retém recolhe fornecedor' },
    { id:'kb-cronograma',src:'LC 214/2025 arts. 348–421',         text:'cronograma implementação transição 2026 2027 2028 2033 split payment obrigatório fase PIS COFINS ISS ICMS extinção prazo vigência quando' },
    { id:'kb-marketplace',src:'LC 214/2025 arts. 38–42',          text:'marketplace plataforma digital e-commerce intermediário responsabilidade solidária adquirente serviço pagamento estrangeiro' },
    { id:'kb-lc214',     src:'LC 214/2025',                       text:'lei complementar 214 2025 reforma tributária IBS CBS IS imposto bens serviços contribuição seletivo não-cumulatividade destino origem' },
    { id:'kb-decreto',   src:'Decreto 12.955/2026',               text:'decreto 12.955 2026 regulamentação split payment fases obrigações instituições pagamento plataforma centralizada CG-IBS contingência RAD' },
    { id:'kb-plataforma',src:'LC 214/2025 arts. 26–35',           text:'plataforma centralizada CG-IBS comitê gestor validação RF TF transferência fiscal confirmação crédito distribuição estados municípios hub tecnológico' },
    { id:'kb-nfe',       src:'LC 214/2025',                       text:'nota fiscal NF-e NFC-e DF-e documento fiscal registro fiscal RF ciclo conciliação trifásica divergência RF TF inconsistência' },
    { id:'kb-inconsist', src:'Dados do projeto',                  text:'inconsistência RF registro fiscal divergência alíquota valor imposto base cálculo CNPJ não localizado contrato ausente período inválido vencido em risco gestão regularizar contestar' },
  ].forEach(function(d) { docs.push({ id: d.id, src: d.src, type: 'kb', text: d.text }); });

  // 2. Chunks de NFs ao vivo
  var nfLista = window.nfListaFiltradaGlobal || [];
  nfLista.forEach(function(nf) {
    var rfs = nf.registrosFiscais || [];
    var rfInc   = rfs.filter(function(r) { return (r.statusRegistro || r.status) === 'inconsistencia'; });
    var rfRisco = rfs.filter(function(r) { var sr = r.statusRegistro || r.status; return sr === 'em_risco' || sr === 'vencido'; });
    var rfAprop = rfs.filter(function(r) { var sc = r.statusCredito || r.status; return sc === 'apropriado' || sc === 'utilizado'; });

    docs.push({
      id:   'nf-' + nf.numero,
      src:  'Dados ao vivo · NF ' + nf.numero,
      type: 'nf',
      text: [
        'NF ' + (nf.numero || ''), 'nota fiscal ' + (nf.numero || ''),
        'fornecedor ' + (nf.entidade || ''), 'empresa ' + (nf.entidade || ''),
        'CNPJ ' + (nf.cnpj || ''),
        'data ' + (nf.data || ''), 'período ' + (nf.data || '').substring(0,7),
        'valor ' + (nf.valorTotal || nf.valor || 0),
        'tipo ' + (nf.tipo || ''),
        'método pagamento ' + (nf.metodoPagamento || ''),
        rfInc.length   ? rfInc.length   + ' inconsistência inconsistente ' + rfInc.map(function(r){return r.inconsistencia||'';}).join(' ') : '',
        rfRisco.length ? rfRisco.length + ' em risco vencido crédito risco' : '',
        rfAprop.length ? rfAprop.length + ' apropriado crédito aprovado utilizado' : '',
      ].filter(Boolean).join(' '),
      meta: { numero: nf.numero, entidade: nf.entidade, cnpj: nf.cnpj, data: nf.data,
              valor: nf.valorTotal || nf.valor || 0, tipo: nf.tipo,
              rfInc: rfInc.length, rfRisco: rfRisco.length, rfAprop: rfAprop.length,
              metodo: nf.metodoPagamento }
    });

    // chunk por RF inconsistente
    rfInc.forEach(function(rf) {
      docs.push({
        id:   'rf-' + rf.id,
        src:  'Dados ao vivo · RF ' + rf.id + ' (NF ' + nf.numero + ')',
        type: 'rf',
        text: 'RF ' + rf.id + ' inconsistência ' + (rf.inconsistencia || '') +
              ' NF ' + nf.numero + ' fornecedor ' + (nf.entidade || '') +
              ' CNPJ ' + (nf.cnpj || '') + ' tipo fiscal ' + (rf.tipoFiscal || '') +
              ' valor ' + (rf.valor || 0) + ' data ' + (rf.data || '') +
              ' divergência erro problema inconsistente',
        meta: { rfId: rf.id, nfNum: nf.numero, entidade: nf.entidade,
                tipoFiscal: rf.tipoFiscal, valor: rf.valor,
                inconsistencia: rf.inconsistencia, data: rf.data }
      });
    });
  });

  window._ragDocs  = docs;
  window._ragScore = window._rag.buildIndex(docs);
  console.log('[RAG] índice: ' + docs.length + ' docs (' + nfLista.length + ' NFs)');
  var badge = document.getElementById('rag-index-badge');
  if (badge) badge.textContent = docs.length + ' documentos indexados (' + nfLista.length + ' NFs)';
};

// ── Retrieval ────────────────────────────────────────────────
window.ragRetrieve = function(query, topK) {
  topK = topK || 6;
  if (!window._ragScore) window.ragBuildIndex();
  return window._ragDocs
    .map(function(doc, i) { return { score: window._ragScore(query, i), doc: doc }; })
    .filter(function(r) { return r.score > 0.01; })
    .sort(function(a, b) { return b.score - a.score; })
    .slice(0, topK);
};

// ── Claude API (streaming) ───────────────────────────────────
window._ragKey = '';

window.ragCallClaude = async function(systemPrompt, history, userMsg, onChunk) {
  var key = window._ragKey;
  if (!key) throw new Error('API key não configurada');

  var messages = history.slice(-8).concat([{ role: 'user', content: userMsg }]);

  var resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      stream: true,
      system: systemPrompt,
      messages: messages
    })
  });

  if (!resp.ok) {
    var err = await resp.json().catch(function() { return { error: { message: 'Erro ' + resp.status } }; });
    throw new Error((err.error && err.error.message) || 'Erro ' + resp.status);
  }

  var reader = resp.body.getReader();
  var decoder = new TextDecoder();
  var full = '';
  while (true) {
    var _ref = await reader.read();
    if (_ref.done) break;
    var lines = decoder.decode(_ref.value, { stream: true }).split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line.startsWith('data: ')) continue;
      var data = line.slice(6);
      if (data === '[DONE]') continue;
      try {
        var ev = JSON.parse(data);
        if (ev.type === 'content_block_delta' && ev.delta && ev.delta.text) {
          full += ev.delta.text;
          if (onChunk) onChunk(full);
        }
      } catch(e) {}
    }
  }
  return full;
};

// ── Atualizar painel de fontes com retrieval ─────────────────
window.ragShowSources = function(retrieved) {
  var panel = document.getElementById('rag-retrieved-sources');
  if (!panel) return;
  if (!retrieved || !retrieved.length) { panel.style.display = 'none'; return; }

  var typeLbl = { kb: 'Legislação', nf: 'Dados NF', rf: 'Dados RF' };
  var typeClr = { kb: 'var(--teal)', nf: 'var(--blue)', rf: 'var(--amber)' };
  var html = '<div style="font-size:11px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Fontes recuperadas</div>';
  retrieved.forEach(function(r, i) {
    var c = typeClr[r.doc.type] || 'var(--txt2)';
    var l = typeLbl[r.doc.type] || r.doc.type;
    html += '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border)">'
      + '<span style="flex-shrink:0;font-size:10px;font-weight:700;background:rgba(0,0,0,.2);color:' + c + ';border:1px solid ' + c + '44;border-radius:4px;padding:2px 6px;margin-top:1px">[' + (i+1) + '] ' + l + '</span>'
      + '<span style="font-size:11px;color:var(--txt2);line-height:1.4">' + escHtml(r.doc.src) + '</span>'
      + '</div>';
  });
  panel.innerHTML = html;
  panel.style.display = 'block';
};

// Reconstrói índice quando dados reais chegarem
(function() {
  var _t = setInterval(function() {
    if (window.nfListaFiltradaGlobal && window.nfListaFiltradaGlobal.length > 0) {
      clearInterval(_t);
      window.ragBuildIndex();
    }
  }, 800);
})();

// ── SINCRONIZAÇÃO DINÂMICA DA APURAÇÃO IBS/CBS ───────────────────────────────
window.sincronizarApuracao = function() {
  var lista = window.nfListaFiltradaGlobal || [];
  if (!lista.length) { if (typeof apurRenderAll === 'function') apurRenderAll(); return; }

  var mesesAbrev = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

  function fmtData(iso) {
    var p = (iso || '').split('-');
    return p.length === 3 ? p[2]+'/'+p[1]+'/'+p[0] : (iso || '—');
  }

  function mesKey(iso) {
    var p = (iso || '').split('-');
    if (p.length < 2) return null;
    var m = parseInt(p[1], 10);
    return mesesAbrev[m - 1] + '/' + p[0];
  }

  function mecFromExtincao(ext) {
    if (!ext) return null;
    var e = ext.toLowerCase();
    if (e.indexOf('split') !== -1) return 'split';
    if (e.indexOf('rad') !== -1) return 'rad';
    if (e.indexOf('compensa') !== -1 || e.indexOf('crédito') !== -1 || e.indexOf('credito') !== -1) return 'credito';
    return null;
  }

  var periodos = {};

  lista.forEach(function(nf) {
    var k = mesKey(nf.data || '');
    if (!k) return;
    if (!periodos[k]) {
      periodos[k] = {
        status: 'calculada',
        ultimaExecucao: null,
        ibsSaldoInicial: 0,
        cbsSaldoInicial: 0,
        creditos: [],
        debitos: []
      };
    }
    var p = periodos[k];
    var tipoDF = nf.tipoDF || 'NF-e';
    var num = nf.numero || '';
    var doc = tipoDF + ' ' + num;
    var dataFmt = fmtData(nf.data || '');
    var entidade = nf.entidade || '—';

    (nf.registrosFiscais || []).forEach(function(rf) {
      var tri = (rf.tipoFiscal || '').toUpperCase();
      if (tri !== 'IBS' && tri !== 'CBS') return;
      var v = rf.valor || 0;
      var sc = rf.statusCredito || rf.status || '';

      if (nf.tipo === 'entrada') {
        var isAprop = (sc === 'apropriado' || sc === 'utilizado');
        var isUtil  = (sc === 'utilizado');
        var aprop   = isAprop ? v : 0;
        var util    = isUtil  ? v : 0;
        p.creditos.push({
          doc: doc,
          tributo: tri,
          data: dataFmt,
          forn: entidade,
          total: v,
          aprop: aprop,
          naoAprop: v - aprop,
          util: util,
          naoUtil: aprop - util,
          motivo: (v - aprop > 0) ? (rf.motivo || 'Aguardando confirmação na Plataforma Centralizada') : null
        });
      } else if (nf.tipo === 'saida') {
        var extinto = (rf.status === 'extinto') ? v : 0;
        var naoExt  = v - extinto;
        var mec     = mecFromExtincao(rf.metodoExtincao);
        if (!mec && extinto > 0) mec = 'split'; // fallback
        var splitEvt = null, radEvt = null, credEvt = null;
        if (mec === 'split' && extinto > 0) {
          splitEvt = { data: dataFmt, meio: 'PIX', txId: 'SP-' + (nf.data||'').replace(/-/g,'') + '-' + (num||'0000').slice(-4), valor: extinto };
        } else if (mec === 'rad' && extinto > 0) {
          radEvt = { adquirente: entidade, cnpj: nf.cnpj || '00.000.000/0001-00', data: dataFmt };
        } else if (mec === 'credito' && extinto > 0) {
          credEvt = [];
        }
        p.debitos.push({
          doc: doc,
          tributo: tri,
          data: dataFmt,
          cliente: entidade,
          total: v,
          naoExt: naoExt,
          extinto: extinto,
          mec: (extinto === 0) ? null : mec,
          splitEvt: splitEvt,
          radEvt: radEvt,
          credEvt: credEvt
        });
      }
    });
  });

  if (!Object.keys(periodos).length) { if (typeof apurRenderAll === 'function') apurRenderAll(); return; }

  // Ordenar períodos cronologicamente
  var ordemMes = { jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12 };
  var keys = Object.keys(periodos).sort(function(a, b) {
    var pa = a.split('/'), pb = b.split('/');
    var ya = parseInt(pa[1], 10), yb = parseInt(pb[1], 10);
    if (ya !== yb) return ya - yb;
    return (ordemMes[pa[0]] || 0) - (ordemMes[pb[0]] || 0);
  });

  // Propagar saldo acumulado entre períodos
  var ibsAcum = 0, cbsAcum = 0;
  keys.forEach(function(k) {
    var d = periodos[k];
    d.ibsSaldoInicial = ibsAcum;
    d.cbsSaldoInicial = cbsAcum;
    // Calcular saldo final para próximo período
    var ibsC = d.creditos.filter(function(c){ return c.tributo === 'IBS'; });
    var cbsC = d.creditos.filter(function(c){ return c.tributo === 'CBS'; });
    var ibsD = d.debitos.filter(function(x){ return x.tributo === 'IBS'; });
    var cbsD = d.debitos.filter(function(x){ return x.tributo === 'CBS'; });
    var ibsAprop = ibsC.reduce(function(s,c){ return s+c.aprop; }, 0);
    var cbsAprop = cbsC.reduce(function(s,c){ return s+c.aprop; }, 0);
    var ibsUtil  = ibsC.reduce(function(s,c){ return s+c.util;  }, 0);
    var cbsUtil  = cbsC.reduce(function(s,c){ return s+c.util;  }, 0);
    ibsAcum = ibsAcum + ibsAprop - ibsUtil;
    cbsAcum = cbsAcum + cbsAprop - cbsUtil;
  });

  // Substituir apurData global e atualizar selector
  if (typeof apurData !== 'undefined') {
    Object.keys(apurData).forEach(function(k){ delete apurData[k]; });
    keys.forEach(function(k){ apurData[k] = periodos[k]; });
  } else {
    window.apurData = periodos;
  }

  // Atualizar selector de período
  var sel = document.getElementById('apur-periodo-sel');
  if (sel) {
    sel.innerHTML = '';
    keys.slice().reverse().forEach(function(k) {
      var opt = document.createElement('option');
      opt.value = k;
      opt.textContent = k.charAt(0).toUpperCase() + k.slice(1);
      sel.appendChild(opt);
    });
    if (typeof apurPeriodoAtivo !== 'undefined') {
      var ultimo = keys[keys.length - 1];
      window.apurPeriodoAtivo = ultimo;
      sel.value = ultimo;
    }
  }

  if (typeof apurRenderAll === 'function') apurRenderAll();
};

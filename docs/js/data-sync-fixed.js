/**
 * Data Sync Manager - Versão Corrigida
 * Sincroniza 500 NFs de entrada com o dashboard
 * Gera R$ 50.000.000 em créditos apropriados (10% de R$ 500M)
 */

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
  {id:'CT-0001',cnpj:'17.197.585/0001-21',inicio:'2025-08-01',fim:'2026-06-30',rad:false,prazo:'30'},
  {id:'CT-0002',cnpj:'33.592.510/0001-62',inicio:'2025-10-01',fim:'2026-09-30',rad:true, prazo:'60'},
  {id:'CT-0003',cnpj:'07.525.847/0001-00',inicio:'2025-07-01',fim:'2026-12-31',rad:false,prazo:'90'},
  {id:'CT-0004',cnpj:'09.165.051/0001-07',inicio:'2025-11-01',fim:'2026-10-31',rad:true, prazo:'30'},
  {id:'CT-0005',cnpj:'17.197.757/0001-00',inicio:'2026-01-01',fim:'2026-12-31',rad:false,prazo:'60'},
  {id:'CT-0006',cnpj:'17.235.322/0001-97',inicio:'2025-09-01',fim:'2026-08-31',rad:false,prazo:'30'},
  {id:'CT-0007',cnpj:'33.514.814/0001-19',inicio:'2025-12-01',fim:'2026-11-30',rad:true, prazo:'90'},
  {id:'CT-0008',cnpj:'17.018.477/0001-45',inicio:'2026-01-01',fim:'2026-06-30',rad:false,prazo:'60'},
  {id:'CT-0009',cnpj:'42.695.633/0001-78',inicio:'2025-06-01',fim:'2026-05-31',rad:true, prazo:'120'},
  {id:'CT-0010',cnpj:'70.873.979/0001-04',inicio:'2026-01-01',fim:'2026-12-31',rad:false,prazo:'30'}
];

function buscarContrato(cnpj, dataISO) {
  for (var i = 0; i < _contratosData.length; i++) {
    var c = _contratosData[i];
    if (c.cnpj === cnpj && dataISO >= c.inicio && dataISO <= c.fim) return c;
  }
  return null;
}

// Função auxiliar de badges
function bdg(status) {
  var labels = {
    'confirmado':    'Confirmado',
    'apropriado':    'Apropriado',
    'nao_apropriado':'Não Apropriado',
    'utilizado':     'Utilizado',
    'inconsistencia':'Inconsistência',
    'vencido':       'Vencido',
    'extinto':       'Extinto',
    'nao_extinto':   'Não Extinto',
    'aguardando':    'Aguardando',
    'em_risco':      'Em risco',
    'perdido':       'Perdido',
    'vencendo':      'Vencendo',
    'atrasado':      'Atrasado',
    'pendente':      'Pendente',
    'pago':          'Pago'
  };
  var colors = {
    'confirmado':    '#22C55E',
    'apropriado':    '#22C55E',
    'nao_apropriado':'#A7A8AA',
    'utilizado':     '#3B82F6',
    'inconsistencia':'#F43F5E',
    'vencido':       '#F59E0B',
    'extinto':       '#22C55E',
    'nao_extinto':   '#A7A8AA',
    'aguardando':    '#F59E0B',
    'em_risco':      '#F43F5E',
    'perdido':       '#F43F5E',
    'vencendo':      '#F59E0B',
    'atrasado':      '#F43F5E',
    'pendente':      '#F59E0B',
    'pago':          '#22C55E'
  };
  var cor = colors[status] || '#A7A8AA';
  var text = labels[status] || (status.charAt(0).toUpperCase() + status.slice(1));
  var rgbMap = {
    '#22C55E': '34,197,94',
    '#F59E0B': '245,158,11',
    '#F43F5E': '244,63,94',
    '#3B82F6': '59,130,246',
    '#A7A8AA': '167,168,170'
  };
  var rgb = rgbMap[cor] || '167,168,170';
  return '<span style="background:rgba(' + rgb + ',.12);color:' + cor + ';border:1px solid rgba(' + rgb + ',.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">' + text + '</span>';
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

  var h = '';
  lista.forEach(function(r) {
    var tipoBadge = r.tipo === 'entrada'
      ? '<span style="background:rgba(34,197,94,.12);color:#22C55E;border:1px solid rgba(34,197,94,.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">Entrada</span>'
      : '<span style="background:rgba(59,130,246,.12);color:#3B82F6;border:1px solid rgba(59,130,246,.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">Saída</span>';

    var statusMap = {
      'nao_apropriado': ['244,63,94','#F43F5E','Não Apropriado'],
      'apropriado':     ['245,158,11','#F59E0B','Apropriado'],
      'utilizado':      ['34,197,94','#22C55E','Utilizado'],
      'nao_extinto':    ['244,63,94','#F43F5E','Não Extinto'],
      'extinto':        ['34,197,94','#22C55E','Extinto']
    };
    var sm = statusMap[r.status] || ['167,168,170','#A7A8AA', r.status || '—'];
    var statusBadge = '<span style="background:rgba(' + sm[0] + ',.12);color:' + sm[1] + ';border:1px solid rgba(' + sm[0] + ',.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">' + sm[2] + '</span>';

    var dataParts = r.data.split('-');
    var dataFormatada = dataParts[2] + '/' + dataParts[1] + '/' + dataParts[0];

    h += '<tr>'
      + '<td class="mono"><button onclick="window.abrirDetalhesNFporNumero(\'' + r.numero + '\')" style="background:none;border:none;color:#3B82F6;cursor:pointer;font-weight:600;padding:0;text-decoration:underline;font-family:inherit;font-size:inherit">NF-' + r.numero + '</button></td>'
      + '<td>' + tipoBadge + '</td>'
      + '<td>' + r.entidade + '</td>'
      + '<td class="mono" style="font-size:11px;color:var(--txt2)">' + r.cnpj + '</td>'
      + '<td class="r mono" style="font-size:11px">' + ff(r.valorTotal) + '</td>'
      + '<td class="r mono" style="font-size:11px;color:var(--txt2)">' + ff(r.valorLiquido) + '</td>'
      + '<td class="r mono" style="font-size:11px;font-weight:600;color:' + (r.cbs > 0 ? '#F59E0B' : 'var(--txt3)') + '">' + ffz(r.cbs) + '</td>'
      + '<td class="r mono" style="font-size:11px;font-weight:600;color:' + (r.ibs > 0 ? '#3B82F6' : 'var(--txt3)') + '">' + ffz(r.ibs) + '</td>'
      + '<td>' + statusBadge + '</td>'
      + '<td style="font-size:12px;color:var(--txt2)">' + dataFormatada + '</td>'
      + '</tr>';
  });

  if (!lista.length) {
    h = '<tr><td colspan="10" style="text-align:center;color:var(--txt3);padding:24px">Nenhuma NF encontrada para este filtro.</td></tr>';
  }

  var tbody = document.getElementById('t-listagem-nfs');
  if (tbody) tbody.innerHTML = h;

  var sub = document.getElementById('nf-count-sub');
  if (sub) sub.textContent = lista.length + ' de ' + (window.nfTotalGlobal || lista.length) + ' NFs exibidas';

  console.log('[data-sync-fixed] Listagem de NFs renderizada com', lista.length, 'registros');
};

// Abrir modal de detalhes da NF — implementação global estável
window.abrirDetalhesNFporNumero = function(nfNumero) {
  var lista = window.nfListaFiltradaGlobal || [];
  var r = null;
  for (var i = 0; i < lista.length; i++) {
    if (lista[i].numero === nfNumero) { r = lista[i]; break; }
  }
  if (!r) return;

  var dataParts = r.data.split('-');
  var dataFormatada = dataParts[2] + '/' + dataParts[1] + '/' + dataParts[0];
  var tipoLabel = r.tipo === 'entrada' ? 'Entrada' : 'Saída';
  var statusLabels = {
    'nao_apropriado': 'Não Apropriado', 'apropriado': 'Apropriado',
    'utilizado': 'Utilizado', 'nao_extinto': 'Não Extinto', 'extinto': 'Extinto'
  };

  function setEl(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  setEl('nf-detail-numero',        'NF-' + r.numero);
  setEl('nf-detail-tipo',          tipoLabel);
  setEl('nf-detail-entidade',      r.entidade);
  setEl('nf-detail-cnpj',          r.cnpj);
  setEl('nf-detail-valor-total',   ff(r.valorTotal));
  setEl('nf-detail-valor-liquido', ff(r.valorLiquido));
  setEl('nf-detail-cbs',           ffz(r.cbs));
  setEl('nf-detail-ibs',           ffz(r.ibs));
  setEl('nf-detail-status',        statusLabels[r.status] || r.status);
  setEl('nf-detail-data',          dataFormatada);

  var fiscaisHtml = '';
  if (r.registrosFiscais && r.registrosFiscais.length) {
    r.registrosFiscais.forEach(function(rf) {
      var rfLabel = rf.tipoFiscal === 'ibs' ? 'IBS' : 'CBS';
      var rfCor   = rf.tipoFiscal === 'ibs' ? '#3B82F6' : '#F59E0B';
      var rfStatus = statusLabels[rf.status] || rf.status;
      fiscaisHtml += '<div style="background:rgba(73,197,177,.06);border:1px solid rgba(73,197,177,.2);border-radius:6px;padding:12px;font-size:11px;margin-bottom:8px">'
        + '<div style="font-weight:600;color:' + rfCor + ';margin-bottom:8px">' + rfLabel + ' • ' + rf.id + '</div>'
        + '<div style="color:var(--txt2);margin-bottom:6px">Entidade: <span style="color:var(--txt1)">' + rf.entidade + '</span></div>'
        + '<div style="color:var(--txt2);margin-bottom:6px;font-family:monospace;font-size:10px">CNPJ: ' + rf.cnpj + '</div>'
        + '<div style="color:var(--txt2);margin-bottom:6px">Valor: <span style="color:var(--txt1);font-weight:600">' + ff(rf.valor) + '</span></div>'
        + '<div style="color:var(--txt2);margin-bottom:6px">NF Total: <span style="color:var(--txt1)">' + ff(rf.valorTotalNF) + '</span></div>'
        + '<div style="color:var(--txt2);margin-bottom:6px">NF Líquido: <span style="color:var(--txt1)">' + ff(rf.valorLiquidoNF) + '</span></div>'
        + '<div style="color:var(--txt2)">Status: <span style="color:var(--txt1);font-weight:600">' + rfStatus + '</span></div>'
        + '</div>';
    });
  }
  var fiscaisEl = document.getElementById('nf-detail-fiscais');
  if (fiscaisEl) fiscaisEl.innerHTML = fiscaisHtml;

  var modal = document.getElementById('nf-modal');
  if (modal) modal.style.display = 'flex';
};

// Estado dos filtros da tabela de créditos
window._filtrosCreditos = {
  mesAno: '',
  busca: '', tipoFiscal: '', status: '', contrato: '',
  metodo: '', pagamento: '', dataNFDe: '', dataNFAte: '',
  credMin: '', credMax: ''
};

window.injetarFiltrosCreditos = function() {
  if (document.getElementById('filtros-creditos-avancado')) return;
  var tcrd = document.querySelector('#view-creditos .tcrd') || document.querySelector('.tcrd');
  if (!tcrd) return;

  var contratos = _contratosData.map(function(c) {
    return '<option value="' + c.id + '">' + c.id + '</option>';
  }).join('');

  var html = '<div id="filtros-creditos-avancado" style="background:var(--card);border:1px solid var(--brd);border-radius:10px;margin-bottom:16px;overflow:hidden">'
    + '<button onclick="window.creditosToggleFiltros()" style="width:100%;display:flex;align-items:center;justify-content:space-between;background:none;border:none;padding:14px 20px;cursor:pointer;text-align:left">'
    + '<span style="font-size:12px;font-weight:700;color:var(--txt1);text-transform:uppercase;letter-spacing:.05em">Filtros</span>'
    + '<span id="fc-toggle-icon" style="font-size:16px;color:var(--txt2);transition:transform .2s">▾</span>'
    + '</button>'
    + '<div id="fc-corpo" style="padding:0 20px 16px;display:none">'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;align-items:end">'

    // Busca geral
    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Busca (RF / NF / Fornecedor)</label>'
    + '<input id="fc-busca" type="text" placeholder="Pesquisar…" oninput="window.creditosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none"></div>'

    // Tipo Fiscal
    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Tipo Fiscal</label>'
    + '<select id="fc-tipo" onchange="window.creditosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none">'
    + '<option value="">Todos</option><option value="IBS">IBS</option><option value="CBS">CBS</option></select></div>'

    // Status
    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Status</label>'
    + '<select id="fc-status" onchange="window.creditosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none">'
    + '<option value="">Todos</option>'
    + '<option value="apropriado">Apropriado</option>'
    + '<option value="nao_apropriado">Não Apropriado</option>'
    + '<option value="utilizado">Utilizado</option>'
    + '<option value="vencido">Vencido</option>'
    + '<option value="inconsistencia">Inconsistência</option>'
    + '</select></div>'

    // Contrato
    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Contrato</label>'
    + '<select id="fc-contrato" onchange="window.creditosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none">'
    + '<option value="">Todos</option>' + contratos + '<option value="__sem__">Sem contrato</option>'
    + '</select></div>'

    // Método de Pagamento
    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Método de Pagamento</label>'
    + '<select id="fc-metodo" onchange="window.creditosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none">'
    + '<option value="">Todos</option><option value="RAD">RAD</option><option value="Fornecedor">Fornecedor</option>'
    + '</select></div>'

    // Pagamento
    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Pagamento</label>'
    + '<select id="fc-pagamento" onchange="window.creditosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none">'
    + '<option value="">Todos</option><option value="com">Com pagamento</option><option value="sem">Sem pagamento</option>'
    + '</select></div>'

    // Data NF De
    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Data NF — de</label>'
    + '<input id="fc-data-de" type="date" onchange="window.creditosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none"></div>'

    // Data NF Até
    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Data NF — até</label>'
    + '<input id="fc-data-ate" type="date" onchange="window.creditosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none"></div>'

    // Crédito mín
    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Crédito — mín (R$)</label>'
    + '<input id="fc-cred-min" type="number" min="0" placeholder="0" oninput="window.creditosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none"></div>'

    // Crédito máx
    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Crédito — máx (R$)</label>'
    + '<input id="fc-cred-max" type="number" min="0" placeholder="∞" oninput="window.creditosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none"></div>'

    + '</div>'
    // Rodapé: contagem + limpar
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid var(--brd)">'
    + '<span id="fc-contagem" style="font-size:11px;color:var(--txt2)">200 registros</span>'
    + '<button onclick="window.creditosLimparFiltrosGrid()" style="background:none;border:1px solid var(--brd);border-radius:6px;padding:4px 12px;font-size:11px;color:var(--txt2);cursor:pointer">✕ Limpar filtros</button>'
    + '</div>'
    + '</div>'  // fecha fc-corpo
    + '</div>';

  tcrd.insertAdjacentHTML('beforebegin', html);
};

window.creditosToggleFiltros = function() {
  var corpo = document.getElementById('fc-corpo');
  var icon  = document.getElementById('fc-toggle-icon');
  if (!corpo) return;
  var aberto = corpo.style.display !== 'none';
  corpo.style.display = aberto ? 'none' : 'block';
  if (icon) icon.style.transform = aberto ? '' : 'rotate(180deg)';
};

window.creditosFiltrarGrid = function() {
  var f = window._filtrosCreditos;
  f.busca      = (document.getElementById('fc-busca')    || {}).value || '';
  f.tipoFiscal = (document.getElementById('fc-tipo')     || {}).value || '';
  f.status     = (document.getElementById('fc-status')   || {}).value || '';
  f.contrato   = (document.getElementById('fc-contrato') || {}).value || '';
  f.metodo     = (document.getElementById('fc-metodo')   || {}).value || '';
  f.pagamento  = (document.getElementById('fc-pagamento')|| {}).value || '';
  f.dataNFDe   = (document.getElementById('fc-data-de') || {}).value || '';
  f.dataNFAte  = (document.getElementById('fc-data-ate')|| {}).value || '';
  f.credMin    = (document.getElementById('fc-cred-min') || {}).value || '';
  f.credMax    = (document.getElementById('fc-cred-max') || {}).value || '';
  window.renderizarTabelaCreditos();
};

window.creditosFiltrarMesAno = function() {
  var sel = document.getElementById('cred-mes-ano');
  window._filtrosCreditos.mesAno = sel ? sel.value : '';
  var mesLabels = {
    '2025-10':'out/2025','2025-11':'nov/2025','2025-12':'dez/2025',
    '2026-01':'jan/2026','2026-02':'fev/2026','2026-03':'mar/2026','2026-04':'abr/2026'
  };
  var label = window._filtrosCreditos.mesAno
    ? (mesLabels[window._filtrosCreditos.mesAno] || window._filtrosCreditos.mesAno)
    : 'Todos os períodos';
  var sub = document.getElementById('cred-periodo-sub');
  if (sub) sub.textContent = 'Posição IBS + CBS · Art. 48 LC 214/2025 · ' + label;
  window.renderizarTabelaCreditos();
  try { window.renderizarComposicaoCreditos(window._composicaoFiltro || ''); } catch(e) {}
  try { window.atualizarPerdaAcumulada(); } catch(e) {}
};

window.creditosLimparFiltrosGrid = function() {
  ['fc-busca','fc-tipo','fc-status','fc-contrato','fc-metodo','fc-pagamento','fc-data-de','fc-data-ate','fc-cred-min','fc-cred-max'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var selMes = document.getElementById('cred-mes-ano');
  if (selMes) selMes.value = '';
  var sub = document.getElementById('cred-periodo-sub');
  if (sub) sub.textContent = 'Posição IBS + CBS · Art. 48 LC 214/2025 · Todos os períodos';
  window._filtrosCreditos = {
    mesAno:'', busca:'', tipoFiscal:'', status:'', contrato:'',
    metodo:'', pagamento:'', dataNFDe:'', dataNFAte:'',
    credMin:'', credMax:''
  };
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
          var cbsVal = rf.tipoFiscal === 'cbs' ? Math.floor(valorLiq * 0.08) : 0;
          var ibsVal = rf.tipoFiscal === 'ibs' ? Math.floor(valorLiq * 0.10) : 0;
          var credVal = rf.tipoFiscal === 'cbs' ? cbsVal : ibsVal;
          listaRFs.push({
            rf: rf.id,
            tipoFiscal: tipoFiscalLabel,
            nf: 'NF-' + rf.nfVinculada,
            nfNumero: rf.nfVinculada,
            forn: rf.entidade,
            cnpj: rf.cnpj,
            dataNF: rf.data,
            data: rf.data.split('-').reverse().join('/'),
            valorTotal: rf.valorTotalNF,
            valorLiq: valorLiq,
            cbs: cbsVal,
            ibs: ibsVal,
            cred: credVal,
            pag: rf.dataPagamento || '—',
            status: rf.status || 'nao_apropriado',
            contratoId: rf.contratoId || nf.contratoId || null,
            metodoPagamento: rf.metodoPagamento || nf.metodoPagamento || null
          });
        });
      }
    });
  }

  // Aplicar filtros
  var f = window._filtrosCreditos || {};
  if (f.mesAno || f.busca || f.tipoFiscal || f.status || f.contrato || f.metodo ||
      f.pagamento || f.dataNFDe || f.dataNFAte || f.credMin || f.credMax) {
    var busca = (f.busca || '').toLowerCase();
    listaRFs = listaRFs.filter(function(r) {
      if (f.mesAno && !(r.dataNF || '').startsWith(f.mesAno)) return false;
      if (busca && !(r.rf.toLowerCase().includes(busca) || r.nf.toLowerCase().includes(busca) || r.forn.toLowerCase().includes(busca))) return false;
      if (f.tipoFiscal && r.tipoFiscal !== f.tipoFiscal) return false;
      if (f.status && r.status !== f.status) return false;
      if (f.contrato === '__sem__' && r.contratoId) return false;
      if (f.contrato && f.contrato !== '__sem__' && r.contratoId !== f.contrato) return false;
      if (f.metodo && r.metodoPagamento !== f.metodo) return false;
      if (f.pagamento === 'com' && r.pag === '—') return false;
      if (f.pagamento === 'sem' && r.pag !== '—') return false;
      if (f.dataNFDe && r.dataNF < f.dataNFDe) return false;
      if (f.dataNFAte && r.dataNF > f.dataNFAte) return false;
      if (f.credMin !== '' && r.cred < parseFloat(f.credMin)) return false;
      if (f.credMax !== '' && r.cred > parseFloat(f.credMax)) return false;
      return true;
    });
  }

  // Atualizar contagem
  var contagemEl = document.getElementById('fc-contagem');
  if (contagemEl) contagemEl.textContent = listaRFs.length + ' registro' + (listaRFs.length !== 1 ? 's' : '');

  if (!listaRFs.length) {
    h = '<tr><td colspan="14" style="text-align:center;color:var(--txt3);padding:24px">Nenhum crédito encontrado para este filtro.</td></tr>';
  } else {
    listaRFs.forEach(function(r) {
      var pc = r.pag === "—" ? "#53565A" : (r.status === "perdido" || r.status === "em_risco") ? "#F43F5E" : "#22C55E";
      var tipoFiscalBadge = '<span style="font-size:11px;font-weight:600;color:' + (r.tipoFiscal === 'IBS' ? '#3B82F6' : '#F59E0B') + '">' + r.tipoFiscal + '</span>';
      var nfNumero = r.nfNumero || r.nf.replace('NF-', '');
      var nfLink = '<span class="mono" style="font-size:11px;color:#3B82F6;cursor:pointer;text-decoration:underline" onclick="window.abrirDetalhesNFporNumero(\'' + nfNumero + '\')">' + r.nf + '</span>';
      var contratoCell = r.contratoId
        ? '<span class="mono" style="font-size:11px;color:#49C5B1;font-weight:600">' + r.contratoId + '</span>'
        : '<span style="color:var(--txt3)">—</span>';
      var metodoCell = r.metodoPagamento === 'RAD'
        ? '<span style="font-size:11px;font-weight:600;color:#8B5CF6">RAD</span>'
        : r.metodoPagamento === 'Fornecedor'
          ? '<span style="font-size:11px;font-weight:600;color:#3B82F6">Fornecedor</span>'
          : '<span style="color:var(--txt3)">—</span>';
      h += '<tr><td class="mono" style="color:#3B82F6;font-size:11px">' + r.rf + '</td><td>' + tipoFiscalBadge + '</td><td>' + nfLink + '</td><td>' + r.forn + '</td><td>' + r.data + '</td><td class="r mono">' + ff(r.valorTotal) + '</td><td class="r mono">' + ff(r.valorLiq) + '</td><td class="r mono" style="color:#F59E0B;font-weight:600">' + ffz(r.cbs) + '</td><td class="r mono" style="color:#3B82F6;font-weight:600">' + ffz(r.ibs) + '</td><td class="r mono" style="color:#49C5B1;font-weight:700">' + ff(r.cred) + '</td><td style="font-size:11px;color:' + pc + '">' + r.pag + '</td><td>' + bdg(r.status) + '</td><td style="white-space:nowrap">' + contratoCell + '</td><td style="white-space:nowrap">' + metodoCell + '</td></tr>';
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
  var total = 0, aprop = 0, naoAprop = 0, risco = 0, util = 0, aguard = 0, inconsist = 0;
  (listaRFs || []).forEach(function(r) {
    var v = r.cred || 0;
    total += v;
    if (r.status === 'apropriado')     aprop    += v;
    if (r.status === 'nao_apropriado') naoAprop += v;
    if (r.status === 'vencido')        risco    += v;
    if (r.status === 'utilizado')      util     += v;
    if (r.status === 'nao_apropriado') aguard   += v;
    if (r.status === 'inconsistencia') inconsist += v;
  });
  var fmt = function(v) {
    if (v >= 1e6) return 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M';
    if (v >= 1e3) return 'R$ ' + Math.round(v / 1e3) + 'K';
    return ff(v);
  };
  var set = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
  set('cred-total', fmt(total));
  set('cred-aprop', fmt(aprop));
  set('cred-aprop-sub', total > 0 ? (aprop / total * 100).toFixed(1).replace('.', ',') + '% — retorno Plataforma' : '—');
  set('cred-nao-aprop', fmt(naoAprop));
  set('cred-nao-aprop-sub', total > 0 ? (naoAprop / total * 100).toFixed(1).replace('.', ',') + '% do total · IBS + CBS' : 'Soma de RFs com status Não Apropriado');
  set('cred-risco', fmt(risco));
  set('cred-risco-sub', total > 0 ? (risco / total * 100).toFixed(1).replace('.', ',') + '% — vencimento próximo' : '—');
  set('cred-util', fmt(util));
  set('cred-util-sub', aprop > 0 ? (util / aprop * 100).toFixed(1).replace('.', ',') + '% dos apropriados — abateram débito' : '—');
  set('cred-aguard', fmt(aguard));
  set('cred-aguard-sub', total > 0 ? (aguard / total * 100).toFixed(1).replace('.', ',') + '% — pagamento efetuado' : '—');
  set('cred-inconsist', fmt(inconsist));
  set('cred-inconsist-sub', total > 0 ? (inconsist / total * 100).toFixed(1).replace('.', ',') + '% do total · requer revisão' : 'RFs com inconsistência · requer revisão');
};

window.atualizarPerdaAcumulada = function() {
  var totalVencido = 0;
  var countRFs = 0;
  var mesAno = (window._filtrosCreditos || {}).mesAno || '';
  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    (nf.registrosFiscais || []).forEach(function(rf) {
      if (mesAno && !(rf.data || '').startsWith(mesAno)) return;
      if (rf.status === 'vencido') {
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

window.atualizarKPIsDashboard = function() {
  var aprop = 0, naoAprop = 0, risco = 0;
  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'entrada') return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      var v = rf.valor || 0;
      if (rf.status === 'apropriado' || rf.status === 'utilizado') aprop   += v;
      if (rf.status === 'nao_apropriado')                          naoAprop += v;
      if (rf.status === 'vencido')                                 risco    += v;
    });
  });
  function fmtM(v) {
    if (v >= 1e6) return 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M';
    if (v >= 1e3) return 'R$ ' + Math.round(v / 1e3) + 'K';
    return 'R$ ' + v.toLocaleString('pt-BR');
  }
  function setEl(id, val) { var e = document.getElementById(id); if (e) e.textContent = val; }
  setEl('dash-cred-aprop',     fmtM(aprop));
  setEl('dash-cred-apropriar', fmtM(naoAprop));
  setEl('dash-cred-risco',     fmtM(risco));
};

// ============================================================
// ESTATÍSTICAS DE CONCILIAÇÃO — derivadas de nfListaFiltradaGlobal
// ============================================================

window.atualizarEstatisticasConciliacao = function() {
  var lista = window.nfListaFiltradaGlobal || [];
  var totalNFs = lista.length;
  var totalRFs = 0, tfOk = 0, aprovados = 0, inconsist = 0;
  lista.forEach(function(nf) {
    (nf.registrosFiscais || []).forEach(function(rf) {
      totalRFs++;
      var temPag = rf.dataPagamento && rf.dataPagamento !== '—';
      var temExt = rf.dataExtincao  && rf.dataExtincao  !== '—';
      if (temPag || temExt) tfOk++;
      if (rf.status === 'apropriado' || rf.status === 'utilizado' || rf.status === 'extinto') aprovados++;
      if (rf.status === 'inconsistencia') inconsist++;
    });
  });
  var pctRF  = totalNFs  > 0 ? (totalRFs / totalNFs * 100).toFixed(1).replace('.', ',') : '0,0';
  var pctTF  = totalRFs  > 0 ? (tfOk     / totalRFs * 100).toFixed(1).replace('.', ',') : '0,0';
  var pctDiv = totalRFs  > 0 ? (inconsist / totalRFs * 100).toFixed(1).replace('.', ',') : '0,0';
  function setEl(id, val) { var e = document.getElementById(id); if (e) e.textContent = val; }
  setEl('conc-dfe',     totalNFs.toLocaleString('pt-BR'));
  setEl('conc-dfe-sub', 'NF-e · entrada e saída processadas');
  setEl('conc-rf',      totalRFs.toLocaleString('pt-BR'));
  setEl('conc-rf-sub',  pctRF + '% com RF registrado');
  setEl('conc-tf',      tfOk.toLocaleString('pt-BR'));
  setEl('conc-tf-sub',  pctTF + '% com TF validada');
  setEl('conc-div',     inconsist.toLocaleString('pt-BR'));
  setEl('conc-div-sub', pctDiv + '% — em análise');
  setEl('pipe-dfe',  totalNFs.toLocaleString('pt-BR'));
  setEl('pipe-rf',   totalRFs.toLocaleString('pt-BR'));
  setEl('pipe-tf',   tfOk.toLocaleString('pt-BR'));
  setEl('pipe-cred', aprovados.toLocaleString('pt-BR'));
};

// ============================================================
// INCONSISTÊNCIAS — RFs de crédito com status inconsistencia
// ============================================================

window.creditosIrParaInconsistencias = function() {
  var btn = document.getElementById('subnav-inconsist-lista');
  if (typeof showInconsistSub === 'function' && btn) {
    showInconsistSub('lista', btn);
  }
  try { if (typeof inconsistRenderTabela === 'function') inconsistRenderTabela(); } catch(e) {}
  try { window.renderizarRFsInconsistencias(); } catch(e) {}
};

window.renderizarRFsInconsistencias = function() {
  var lista = [];
  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'entrada' || !nf.registrosFiscais) return;
    nf.registrosFiscais.forEach(function(rf) {
      if (rf.status !== 'inconsistencia') return;
      var valorLiq = rf.valorLiquidoNF || 0;
      var cred = rf.tipoFiscal === 'cbs'
        ? Math.floor(valorLiq * 0.08)
        : Math.floor(valorLiq * 0.10);
      var dp = (rf.data || '').split('-');
      lista.push({
        rf:         rf.id || '—',
        tf:         rf.tipoFiscal === 'ibs' ? 'IBS' : 'CBS',
        nf:         'NF-' + (rf.nfVinculada || nf.numero || ''),
        forn:       rf.entidade || nf.entidade || '—',
        cnpj:       rf.cnpj    || nf.cnpj    || '—',
        data:       dp.length === 3 ? dp[2]+'/'+dp[1]+'/'+dp[0] : '—',
        cred:       cred,
        contrato:   rf.contratoId || nf.contratoId || '—'
      });
    });
  });

  var h = '';
  lista.forEach(function(r) {
    var tfBadge = r.tf === 'IBS'
      ? '<span style="background:rgba(59,130,246,.12);color:#3B82F6;border:1px solid rgba(59,130,246,.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">IBS</span>'
      : '<span style="background:rgba(245,158,11,.12);color:#F59E0B;border:1px solid rgba(245,158,11,.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">CBS</span>';
    var incBadge = '<span style="background:rgba(244,63,94,.12);color:#F43F5E;border:1px solid rgba(244,63,94,.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">Inconsistência</span>';
    h += '<tr>'
      + '<td class="mono" style="font-size:11px;color:var(--txt2)">' + r.rf + '</td>'
      + '<td>' + tfBadge + '</td>'
      + '<td class="mono" style="font-size:11px;color:#3B82F6;font-weight:600">' + r.nf + '</td>'
      + '<td style="font-size:12px">' + r.forn + '</td>'
      + '<td class="mono" style="font-size:11px;color:var(--txt2)">' + r.cnpj + '</td>'
      + '<td style="font-size:11px;color:var(--txt2)">' + r.data + '</td>'
      + '<td class="r mono" style="font-size:11px;font-weight:700;color:#F43F5E">' + ff(r.cred) + '</td>'
      + '<td class="mono" style="font-size:11px;color:var(--txt2)">' + r.contrato + '</td>'
      + '</tr>';
  });

  if (!lista.length) {
    h = '<tr><td colspan="8" style="text-align:center;color:var(--txt3);padding:24px">Nenhum RF com inconsistência encontrado.</td></tr>';
  }

  var tbody = document.getElementById('t-inc-rfs');
  if (tbody) tbody.innerHTML = h;

  var sub = document.getElementById('inc-rf-count-sub');
  if (sub) sub.textContent = lista.length + ' RF' + (lista.length !== 1 ? 's' : '') + ' com inconsistência · IBS + CBS';
};

// ============================================================
// MÓDULO GESTÃO DE DÉBITOS — NFs de saída · IBS + CBS
// ============================================================

window._enriquecerNFsSaida = function() {
  var meses = ['2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04'];
  var statusDist = [
    'extinto','extinto','extinto','extinto','extinto','extinto','extinto',
    'nao_extinto','nao_extinto','nao_extinto','nao_extinto',
    'vencido','vencido','vencido',
    'inconsistencia','inconsistencia'
  ];
  var metodos = ['RAD','RAD','Compensacao'];
  var idx = 0;

  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'saida') return;
    var mes     = meses[idx % meses.length];
    var day     = 1 + ((idx * 7) % 27);
    var dayStr  = day < 10 ? '0' + day : '' + day;
    var dataISO = mes + '-' + dayStr;
    var stRF    = statusDist[idx % statusDist.length];

    nf.data   = dataISO;
    nf.status = (stRF === 'extinto') ? 'extinto' : 'nao_extinto';

    (nf.registrosFiscais || []).forEach(function(rf, ri) {
      rf.data           = dataISO;
      rf.status         = stRF;
      rf.metodoExtincao = metodos[(idx + ri) % metodos.length];
      if (stRF === 'extinto') {
        var extDay    = Math.min(day + 5, 28);
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
  mesAno: '', busca: '', tipoFiscal: '', status: '',
  metodo: '', extincao: '', dataNFDe: '', dataNFAte: '',
  debMin: '', debMax: ''
};

window.injetarFiltrosDebitos = function() {
  if (document.getElementById('filtros-debitos-avancado')) return;
  var tcrd = document.querySelector('#view-debitos .tcrd');
  if (!tcrd) return;

  var html = '<div id="filtros-debitos-avancado" style="background:var(--card);border:1px solid var(--brd);border-radius:10px;margin-bottom:16px;overflow:hidden">'
    + '<button onclick="window.debitosToggleFiltros()" style="width:100%;display:flex;align-items:center;justify-content:space-between;background:none;border:none;padding:14px 20px;cursor:pointer;text-align:left">'
    + '<span style="font-size:12px;font-weight:700;color:var(--txt1);text-transform:uppercase;letter-spacing:.05em">Filtros</span>'
    + '<span id="fd-toggle-icon" style="font-size:16px;color:var(--txt2);transition:transform .2s">▾</span>'
    + '</button>'
    + '<div id="fd-corpo" style="padding:0 20px 16px;display:none">'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;align-items:end">'
    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Busca (RF / NF / Cliente)</label>'
    + '<input id="fd-busca" type="text" placeholder="Pesquisar…" oninput="window.debitosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none"></div>'
    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Tipo Fiscal</label>'
    + '<select id="fd-tipo" onchange="window.debitosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none">'
    + '<option value="">Todos</option><option value="IBS">IBS</option><option value="CBS">CBS</option></select></div>'
    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Status</label>'
    + '<select id="fd-status" onchange="window.debitosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none">'
    + '<option value="">Todos</option><option value="extinto">Extinto</option><option value="nao_extinto">Não Extinto</option>'
    + '<option value="vencido">Vencido</option><option value="inconsistencia">Inconsistência</option></select></div>'
    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Método de Extinção</label>'
    + '<select id="fd-metodo" onchange="window.debitosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none">'
    + '<option value="">Todos</option><option value="RAD">RAD</option><option value="Compensacao">Compensação</option></select></div>'
    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Extinção</label>'
    + '<select id="fd-extincao" onchange="window.debitosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none">'
    + '<option value="">Todos</option><option value="com">Com extinção</option><option value="sem">Sem extinção</option></select></div>'
    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Data NF — de</label>'
    + '<input id="fd-data-de" type="date" onchange="window.debitosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none"></div>'
    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Data NF — até</label>'
    + '<input id="fd-data-ate" type="date" onchange="window.debitosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none"></div>'
    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Débito — mín (R$)</label>'
    + '<input id="fd-deb-min" type="number" min="0" placeholder="0" oninput="window.debitosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none"></div>'
    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Débito — máx (R$)</label>'
    + '<input id="fd-deb-max" type="number" min="0" placeholder="∞" oninput="window.debitosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none"></div>'
    + '</div>'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid var(--brd)">'
    + '<span id="fd-contagem" style="font-size:11px;color:var(--txt2)">200 registros</span>'
    + '<button onclick="window.debitosLimparFiltrosGrid()" style="background:none;border:1px solid var(--brd);border-radius:6px;padding:4px 12px;font-size:11px;color:var(--txt2);cursor:pointer">✕ Limpar filtros</button>'
    + '</div></div></div>';

  tcrd.insertAdjacentHTML('beforebegin', html);
};

window.debitosToggleFiltros = function() {
  var corpo = document.getElementById('fd-corpo');
  var icon  = document.getElementById('fd-toggle-icon');
  if (!corpo) return;
  var aberto = corpo.style.display !== 'none';
  corpo.style.display = aberto ? 'none' : 'block';
  if (icon) icon.style.transform = aberto ? '' : 'rotate(180deg)';
};

window.debitosFiltrarGrid = function() {
  var f = window._filtrosDebitos;
  f.busca      = (document.getElementById('fd-busca')    || {}).value || '';
  f.tipoFiscal = (document.getElementById('fd-tipo')     || {}).value || '';
  f.status     = (document.getElementById('fd-status')   || {}).value || '';
  f.metodo     = (document.getElementById('fd-metodo')   || {}).value || '';
  f.extincao   = (document.getElementById('fd-extincao') || {}).value || '';
  f.dataNFDe   = (document.getElementById('fd-data-de') || {}).value || '';
  f.dataNFAte  = (document.getElementById('fd-data-ate')|| {}).value || '';
  f.debMin     = (document.getElementById('fd-deb-min') || {}).value || '';
  f.debMax     = (document.getElementById('fd-deb-max') || {}).value || '';
  window.renderizarTabelaDebitos();
};

window.debitosFiltrarMesAno = function() {
  var sel = document.getElementById('deb-mes-ano');
  window._filtrosDebitos.mesAno = sel ? sel.value : '';
  var mesLabels = {
    '2025-10':'out/2025','2025-11':'nov/2025','2025-12':'dez/2025',
    '2026-01':'jan/2026','2026-02':'fev/2026','2026-03':'mar/2026','2026-04':'abr/2026'
  };
  var label = window._filtrosDebitos.mesAno
    ? (mesLabels[window._filtrosDebitos.mesAno] || window._filtrosDebitos.mesAno)
    : 'Todos os períodos';
  var sub = document.getElementById('deb-periodo-sub');
  if (sub) sub.textContent = 'Posição IBS + CBS · Art. 153-A LC 214/2025 · ' + label;
  window.renderizarTabelaDebitos();
  try { window.renderizarComposicaoDebitos(window._composicaoDebitosFiltro || ''); } catch(e) {}
  try { window.atualizarPerdaAcumuladaDebitos(); } catch(e) {}
  try { window.renderizarExtincaoMetodo(); } catch(e) {}
};

window.debitosLimparFiltrosGrid = function() {
  ['fd-busca','fd-tipo','fd-status','fd-metodo','fd-extincao','fd-data-de','fd-data-ate','fd-deb-min','fd-deb-max'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  var selMes = document.getElementById('deb-mes-ano');
  if (selMes) selMes.value = '';
  var sub = document.getElementById('deb-periodo-sub');
  if (sub) sub.textContent = 'Posição IBS + CBS · Art. 153-A LC 214/2025 · Todos os períodos';
  window._filtrosDebitos = {
    mesAno: '', busca: '', tipoFiscal: '', status: '',
    metodo: '', extincao: '', dataNFDe: '', dataNFAte: '',
    debMin: '', debMax: ''
  };
  window.renderizarTabelaDebitos();
  try { window.renderizarComposicaoDebitos(window._composicaoDebitosFiltro || ''); } catch(e) {}
  try { window.atualizarPerdaAcumuladaDebitos(); } catch(e) {}
  try { window.renderizarExtincaoMetodo(); } catch(e) {}
};

window.renderizarTabelaDebitos = function() {
  var listaRFs = [];
  var f    = window._filtrosDebitos || {};
  var busca = (f.busca || '').toLowerCase();
  var stCoresMap  = {'extinto':'34,197,94','nao_extinto':'167,168,170','vencido':'245,158,11','inconsistencia':'244,63,94'};
  var stHexMap    = {'extinto':'#22C55E','nao_extinto':'#A7A8AA','vencido':'#F59E0B','inconsistencia':'#F43F5E'};
  var stLblMap    = {'extinto':'Extinto','nao_extinto':'Não Extinto','vencido':'Vencido','inconsistencia':'Inconsistência'};
  var metCoresMap = {'RAD':'#8B5CF6','Compensacao':'#14B8A6'};
  var metLblMap   = {'RAD':'RAD','Compensacao':'Compensação'};

  if (window.nfListaFiltradaGlobal) {
    window.nfListaFiltradaGlobal.forEach(function(nf) {
      if (nf.tipo !== 'saida' || !nf.registrosFiscais) return;
      nf.registrosFiscais.forEach(function(rf) {
        var valorLiq = rf.valorLiquidoNF || nf.valorLiquido || 0;
        var cbsVal   = rf.tipoFiscal === 'cbs' ? Math.floor(valorLiq * 0.08) : 0;
        var ibsVal   = rf.tipoFiscal === 'ibs' ? Math.floor(valorLiq * 0.10) : 0;
        var debVal   = cbsVal || ibsVal;
        var dp       = (rf.data || '').split('-');
        listaRFs.push({
          rf:   rf.id || '—',
          tf:   rf.tipoFiscal === 'ibs' ? 'IBS' : 'CBS',
          nf:   'NF-' + (rf.nfVinculada || nf.numero || ''),
          dataNF: rf.data || '',
          data: dp.length === 3 ? dp[2]+'/'+dp[1]+'/'+dp[0] : '—',
          cliente:   rf.entidade || nf.entidade || '—',
          valorTotal: rf.valorTotalNF  || nf.valorTotal   || 0,
          valorLiq:   valorLiq,
          cbs: cbsVal, ibs: ibsVal, deb: debVal,
          extincao:       rf.dataExtincao   || '—',
          status:         rf.status         || 'nao_extinto',
          metodoExtincao: rf.metodoExtincao || '—'
        });
      });
    });
  }

  listaRFs = listaRFs.filter(function(r) {
    if (f.mesAno    && !r.dataNF.startsWith(f.mesAno)) return false;
    if (busca) {
      var s = r.rf.toLowerCase() + r.nf.toLowerCase() + r.cliente.toLowerCase();
      if (!s.includes(busca)) return false;
    }
    if (f.tipoFiscal && r.tf !== f.tipoFiscal) return false;
    if (f.status     && r.status !== f.status) return false;
    if (f.metodo     && r.metodoExtincao !== f.metodo) return false;
    if (f.extincao === 'com' && r.extincao === '—') return false;
    if (f.extincao === 'sem' && r.extincao !== '—') return false;
    if (f.dataNFDe   && r.dataNF < f.dataNFDe) return false;
    if (f.dataNFAte  && r.dataNF > f.dataNFAte) return false;
    if (f.debMin !== '' && r.deb < parseFloat(f.debMin)) return false;
    if (f.debMax !== '' && r.deb > parseFloat(f.debMax)) return false;
    return true;
  });

  var cnt = document.getElementById('fd-contagem');
  if (cnt) cnt.textContent = listaRFs.length + ' registros';

  var h = '';
  listaRFs.forEach(function(r) {
    var stCor  = stHexMap[r.status]  || '#A7A8AA';
    var stRgb  = stCoresMap[r.status] || '167,168,170';
    var stLbl  = stLblMap[r.status]  || r.status;
    var stBadge = '<span style="background:rgba('+stRgb+',.12);color:'+stCor+';border:1px solid rgba('+stRgb+',.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">'+stLbl+'</span>';
    var tfBadge = r.tf === 'IBS'
      ? '<span style="background:rgba(59,130,246,.12);color:#3B82F6;border:1px solid rgba(59,130,246,.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">IBS</span>'
      : '<span style="background:rgba(245,158,11,.12);color:#F59E0B;border:1px solid rgba(245,158,11,.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">CBS</span>';
    var mCor = metCoresMap[r.metodoExtincao] || 'var(--txt3)';
    var mLbl = metLblMap[r.metodoExtincao]   || r.metodoExtincao;
    var mBadge = (r.metodoExtincao && r.metodoExtincao !== '—')
      ? '<span style="color:'+mCor+';font-weight:600;font-size:11px">'+mLbl+'</span>'
      : '<span style="color:var(--txt3);font-size:11px">—</span>';

    h += '<tr>'
      + '<td class="mono" style="font-size:11px;color:var(--txt2)">' + r.rf + '</td>'
      + '<td>' + tfBadge + '</td>'
      + '<td class="mono" style="font-size:11px;color:#3B82F6;font-weight:600">' + r.nf + '</td>'
      + '<td style="font-size:12px">' + r.cliente + '</td>'
      + '<td style="font-size:11px;color:var(--txt2)">' + r.data + '</td>'
      + '<td class="r mono" style="font-size:11px">' + ff(r.valorTotal) + '</td>'
      + '<td class="r mono" style="font-size:11px;color:var(--txt2)">' + ff(r.valorLiq) + '</td>'
      + '<td class="r mono" style="font-size:11px;font-weight:600;color:#F59E0B">' + ffz(r.cbs) + '</td>'
      + '<td class="r mono" style="font-size:11px;font-weight:600;color:#3B82F6">' + ffz(r.ibs) + '</td>'
      + '<td class="r mono" style="font-size:11px;font-weight:700;color:var(--txt1)">' + ff(r.deb) + '</td>'
      + '<td style="font-size:11px;color:var(--txt2)">' + r.extincao + '</td>'
      + '<td>' + stBadge + '</td>'
      + '<td>' + mBadge + '</td>'
      + '</tr>';
  });

  if (!listaRFs.length) {
    h = '<tr><td colspan="13" style="text-align:center;color:var(--txt3);padding:24px">Nenhum RF de débito encontrado para este filtro.</td></tr>';
  }

  var tbody = document.getElementById('t-debitos');
  if (tbody) tbody.innerHTML = h;

  window.atualizarKPIsDebitos(listaRFs);
  try { window.renderizarComposicaoDebitos(window._composicaoDebitosFiltro || ''); } catch(e) {}
  try { window.renderizarExtincaoMetodo(); } catch(e) {}
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
  var mesAno = (window._filtrosDebitos || {}).mesAno || '';
  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'saida') return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      if (mesAno && !(rf.data || '').startsWith(mesAno)) return;
      if (rf.status === 'vencido') { totalVencido += rf.valor || 0; countRFs++; }
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
  var statusCores = {'extinto':'#22C55E','nao_extinto':'#A7A8AA','vencido':'#F59E0B','inconsistencia':'#F43F5E'};
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
      if (f.mesAno   && !(rf.data||'').startsWith(f.mesAno)) return;
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
      var valorLiq = rf.valorLiquidoNF || 0;
      var debVal   = rf.tipoFiscal === 'cbs' ? Math.floor(valorLiq*0.08) : Math.floor(valorLiq*0.10);
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
      if (f.mesAno   && !(rf.data||'').startsWith(f.mesAno)) return;
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
    { label:'RAD',         color:'#8B5CF6', data:radPorMes.map(round2)  },
    { label:'Compensação', color:'#14B8A6', data:compPorMes.map(round2) }
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
    // Atualizar o dashboard
    this.atualizarDashboard();
    console.log('✓ Data Sync Manager inicializado');
    console.log(`  - ${this.nfsEntrada.length} NFs de entrada geradas`);
    console.log(`  - ${this.creditosGerados.length} registros de crédito gerados`);
    console.log(`  - Total em créditos: R$ ${this.creditosGerados.reduce((s, c) => s + c.cred, 0).toLocaleString('pt-BR')}`);
  }

  gerarNFsEntrada() {
    const fornecedores = [
      { nome: 'Vale S.A.', cnpj: '33.592.510/0001-62' },
      { nome: 'Randon S.A.', cnpj: '17.197.585/0001-21' },
      { nome: 'Marcopolo S.A.', cnpj: '17.197.757/0001-00' },
      { nome: 'Bosch Ltda', cnpj: '17.235.322/0001-97' },
      { nome: 'WEG Equipamentos', cnpj: '33.514.814/0001-19' },
      { nome: 'Embraer S.A.', cnpj: '07.525.847/0001-00' },
      { nome: 'Petrobras Dist.', cnpj: '09.165.051/0001-07' },
      { nome: 'Braskem S.A.', cnpj: '42.695.633/0001-78' },
      { nome: 'Suzano S.A.', cnpj: '17.018.477/0001-45' },
      { nome: 'Natura &Co', cnpj: '70.873.979/0001-04' }
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
      const dia = (i % 28) + 1;
      const mes = Math.floor((i - 1) / 150) % 12 + 1;

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

  atualizarDashboard() {
    // Chamar funções de atualização do dashboard
    if (typeof creditosRenderKPIs === 'function') {
      creditosRenderKPIs();
      console.log('✓ creditosRenderKPIs() executado');
    }

    if (typeof dashRenderCreditKPIs === 'function') {
      dashRenderCreditKPIs();
      console.log('✓ dashRenderCreditKPIs() executado');
    }

    if (typeof pagRenderKPIs === 'function') {
      pagRenderKPIs();
      console.log('✓ pagRenderKPIs() executado');
    }

    if (typeof conciliRender === 'function') {
      conciliRender();
      console.log('✓ conciliRender() executado');
    }
  }

  sincronizar() {
    // Atualizar dashboard periodicamente
    this.atualizarDashboard();
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
  t.style.cssText = 'position:fixed;display:none;background:#1D1C1B;border:1px solid #3D3C3A;border-radius:8px;padding:8px 12px;font-size:12px;font-family:Montserrat,sans-serif;color:#F2F0EF;pointer-events:none;z-index:9999;white-space:nowrap;box-shadow:0 6px 20px rgba(0,0,0,.5);line-height:1.5';
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
    s += '<text x="' + (padL - 5) + '" y="' + (yg + 4) + '" text-anchor="end" fill="#53565A" font-size="9" font-family="Montserrat,sans-serif">' + val + '</text>';
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
    s += '<text x="' + xp(i) + '" y="' + (padT + plotH + padB - 4) + '" text-anchor="middle" fill="#53565A" font-size="9" font-family="Montserrat,sans-serif">' + labels[i] + '</text>';
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
// GRÁFICO DE MÉTODO DE PAGAMENTO — RAD vs Fornecedor · mês a mês
// ============================================================
window.renderizarPagamentosMetodo = function() {
  var mesesLabels = ['Out','Nov','Dez','Jan','Fev','Mar','Abr'];
  var mesesISO    = ['2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04'];
  var f = window._filtrosCreditos || {};
  var busca = (f.busca || '').toLowerCase();

  var radPorMes  = [0,0,0,0,0,0,0];
  var fornPorMes = [0,0,0,0,0,0,0];

  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    (nf.registrosFiscais || []).forEach(function(rf) {
      // Apenas pagamentos realizados
      if (!rf.dataPagamento || rf.dataPagamento === '—') return;
      // Filtros globais
      if (f.mesAno && !(rf.data || '').startsWith(f.mesAno)) return;
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

      var credVal = rf.tipoFiscal === 'cbs'
        ? Math.floor((rf.valorLiquidoNF || 0) * 0.08)
        : Math.floor((rf.valorLiquidoNF || 0) * 0.10);
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
    { label: 'RAD',        color: '#8B5CF6', data: radPorMes.map(round2)  },
    { label: 'Fornecedor', color: '#3B82F6', data: fornPorMes.map(round2) }
  ];

  _svgStackedBar('cPagMetodo', datasets, mesesLabels, 200);

  // Subtítulo dinâmico com proporção total
  var totalRad  = radPorMes.reduce(function(a,b){return a+b;},0);
  var totalForn = fornPorMes.reduce(function(a,b){return a+b;},0);
  var total = totalRad + totalForn;
  var sub = document.getElementById('cPagMetodo-sub');
  if (sub) {
    if (total > 0) {
      sub.textContent = 'R$ milhões · RAD ' + (totalRad/total*100).toFixed(0) + '% · Fornecedor ' + (totalForn/total*100).toFixed(0) + '% · pagamentos realizados';
    } else {
      sub.textContent = 'R$ milhões · RAD vs Fornecedor · pagamentos realizados · mês a mês';
    }
  }
};

window._composicaoFiltro = '';

window.renderizarComposicaoCreditos = function(filtroTipo) {
  if (filtroTipo !== undefined) window._composicaoFiltro = filtroTipo;
  var filtro = window._composicaoFiltro || '';

  var mesesLabels = ['Out','Nov','Dez','Jan','Fev','Mar','Abr'];
  var mesesISO    = ['2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04'];

  var statusList = ['apropriado','utilizado','nao_apropriado','vencido','inconsistencia'];
  var statusCores = {
    'apropriado':    '#22C55E',
    'utilizado':     '#3B82F6',
    'nao_apropriado':'#A7A8AA',
    'vencido':       '#F59E0B',
    'inconsistencia':'#F43F5E'
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
      if (f.mesAno && !(rf.data || '').startsWith(f.mesAno)) return;
      if (f.dataNFDe && rf.data < f.dataNFDe) return;
      if (f.dataNFAte && rf.data > f.dataNFAte) return;
      var credVal = rf.tipoFiscal === 'cbs'
        ? Math.floor((rf.valorLiquidoNF || 0) * 0.08)
        : Math.floor((rf.valorLiquidoNF || 0) * 0.10);
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
  // Esperar 3 segundos para garantir que o HTML inline script foi completamente executado
  setTimeout(function() {
    console.log('[data-sync-fixed] Iniciando sincronização após 3s delay');
    const dataSyncFixed = new DataSyncManagerFixed();
    window.dataSyncFixed = dataSyncFixed; // Expor globalmente

    // Função de pós-processamento global — roda após nfListaFiltradaGlobal ser populado
    function _postProcessarDados() {
      try { window._enriquecerNFsSaida(); } catch(e) { console.error('[data-sync-fixed] Erro _enriquecerNFsSaida:', e); }
      try { window.renderizarListaNFs(); } catch(e) {}
      try { window.injetarFiltrosCreditos(); window.renderizarTabelaCreditos(); } catch(e) {}
      try { window.renderizarRFsInconsistencias(); } catch(e) {}
      try { window.injetarFiltrosDebitos(); window.renderizarTabelaDebitos(); window.renderizarComposicaoDebitos(''); window.renderizarExtincaoMetodo(); window.atualizarPerdaAcumuladaDebitos(); } catch(e) {}
      try { window.renderizarComposicaoCreditos(''); } catch(e) {}
      try { window.renderizarPagamentosMetodo(); } catch(e) {}
      try { window.atualizarPerdaAcumulada(); } catch(e) {}
      try { window.atualizarKPIsDashboard(); } catch(e) {}
      try { window.atualizarEstatisticasConciliacao(); } catch(e) {}
      try { window.iniciarPaginacaoUniversal(); } catch(e) {}
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

        // Coletar NFs de entrada
        var nfsEntrada = window.dataSyncFixed.getNFsEntrada();
        // Meses para distribuição das NFs (correspondente aos demais gráficos do dashboard)
        var _mesesSpread = ['2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04'];
        nfsEntrada.forEach(function(nf, idx) {
          var statusCreditos = ['nao_apropriado','nao_apropriado','apropriado','apropriado','apropriado','utilizado','utilizado','utilizado'];
          var statusCred = statusCreditos[idx % statusCreditos.length];

          // Espalhar datas dos RFs pelos 7 meses do dashboard
          var mesIdx = Math.floor(idx * _mesesSpread.length / nfsEntrada.length);
          var dia = String(1 + (idx % 28)).padStart(2, '0');
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

          var nfRecord = {
            numero: nf.numero,
            tipo: 'entrada',
            subTipo: 'nf',
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
            registrosFiscais: []
          };

          var statusSemPagBuild = ['nao_apropriado', 'utilizado', 'inconsistencia', 'vencido'];
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
            return { dataPagamento: dat, rfStatus: st };
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
            dataPagamento: pagIBS.dataPagamento,
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
            dataPagamento: pagCBS.dataPagamento,
            data: dataEfetiva,
            valorTotalNF: valorBruto,
            valorLiquidoNF: valorLiquido,
            contratoId: contratoId,
            metodoPagamento: metodoPagamento
          });

          window.nfListaFiltradaGlobal.push(nfRecord);
        });

        // Gerar NFs de saída (100 clientes) — mesma estrutura das NFs de entrada
        var _clientesSaida = ['WEG Motores','Mercado Livre','Embraer S.A.','Bosch Ltda','Randon S.A.','Ambev S.A.','Magazine Luiza','Gerdau Aços','Marcopolo S.A.','Natura &Co'];
        var _mesesSaida    = ['2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04'];
        var _statusSaida   = ['extinto','extinto','extinto','extinto','extinto','nao_extinto','nao_extinto','nao_extinto','vencido','inconsistencia'];
        var _metodosSaida  = ['RAD','RAD','Compensacao'];
        for (var _si = 1; _si <= 100; _si++) {
          var _vliq   = Math.floor(12000 + (_si * 317) % 20000) * ((_si % 5) + 1);
          var _cbs    = Math.floor(_vliq * 0.08);
          var _ibs    = Math.floor(_vliq * 0.10);
          var _vbrut  = _vliq + _cbs + _ibs;
          var _nsNum  = String(_si + 500000).padStart(6, '0');
          var _mes    = _mesesSaida[(_si - 1) % _mesesSaida.length];
          var _dia    = String(1 + ((_si * 7) % 27)).padStart(2, '0');
          var _dataS  = _mes + '-' + _dia;
          var _stS    = _statusSaida[(_si - 1) % _statusSaida.length];
          var _metS   = _stS === 'extinto' ? _metodosSaida[(_si - 1) % _metodosSaida.length] : '—';
          var _extDay = String(Math.min(parseInt(_dia) + 5, 28)).padStart(2, '0');
          var _mp     = _mes.split('-');
          var _dtExt  = _stS === 'extinto' ? (_extDay + '/' + _mp[1] + '/' + _mp[0] + ' 09:00') : '—';

          var _nfS = {
            numero: _nsNum, tipo: 'saida', subTipo: 'nf',
            entidade: _clientesSaida[_si % _clientesSaida.length],
            cnpj: '12.345.678/000' + String(_si % 100).padStart(2, '0'),
            valorTotal: _vbrut, valorLiquido: _vliq, cbs: _cbs, ibs: _ibs,
            data: _dataS, status: _stS === 'extinto' ? 'extinto' : 'nao_extinto',
            contratoId: null, registrosFiscais: []
          };

          // RF IBS — mesma estrutura de RF de entrada (dataPagamento → dataExtincao, metodoPagamento → metodoExtincao)
          _nfS.registrosFiscais.push({
            id: 'RF-' + String(++window._rfIdCounter).padStart(8, '0'),
            tipo: 'saida', subTipo: 'fiscal', tipoFiscal: 'ibs',
            nfVinculada: _nsNum, entidade: _nfS.entidade, cnpj: _nfS.cnpj,
            valor: _ibs,
            status: _stS,
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
      }

      _postProcessarDados();
    }

    // Sincronizar a cada 30 segundos
    setInterval(() => {
      dataSyncFixed.sincronizar();
    }, 30000);

    console.log('✓ Sistema de sincronização de dados ativo');
  }, 3000);
});

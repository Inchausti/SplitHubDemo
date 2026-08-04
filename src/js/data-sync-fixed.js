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

  var _dfColorsMap = {
    'NF-e':   ['59,130,246','#3B82F6'], 'NFC-e':  ['99,102,241','#6366F1'],
    'NFCom':  ['16,185,129','#10B981'], 'NF3-e':  ['20,184,166','#14B8A6'],
    'NFS-e':  ['34,197,94','#22C55E'], 'CT-e':   ['245,158,11','#F59E0B'],
    'NFAg':   ['132,204,22','#84CC16'],'NFGás':  ['234,179,8','#EAB308'],
    'MDF-e':  ['168,85,247','#A855F7'],'BP-e':   ['73,197,177','var(--teal)']
  };

  var h = '';
  lista.forEach(function(r) {
    var _dfT = r.tipoDF || 'NF-e';
    var _dc = _dfColorsMap[_dfT] || _dfColorsMap['NF-e'];
    var tipoBadge = '<span style="background:rgba(' + _dc[0] + ',.12);color:' + _dc[1] + ';border:1px solid rgba(' + _dc[0] + ',.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">' + _dfT + '</span>';

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

    var chave = r.chaveDF || '';
    var chaveTrunc = chave ? (chave.slice(0,4) + ' ' + chave.slice(4,8) + ' ' + chave.slice(8,12) + ' …') : '—';
    var numLabel = _dfT + ' ' + r.numero;

    h += '<tr>'
      + '<td class="mono"><button onclick="window.abrirDetalhesNFporNumero(\'' + r.numero + '\')" style="background:none;border:none;color:#3B82F6;cursor:pointer;font-weight:600;padding:0;text-decoration:underline;font-family:inherit;font-size:11px">' + numLabel + '</button></td>'
      + '<td>' + tipoBadge + '</td>'
      + '<td>' + r.entidade + '</td>'
      + '<td class="mono" style="font-size:11px;color:var(--txt2)">' + r.cnpj + '</td>'
      + '<td class="r mono" style="font-size:11px">' + ff(r.valorTotal) + '</td>'
      + '<td class="r mono" style="font-size:11px;color:var(--txt2)">' + ff(r.valorLiquido) + '</td>'
      + '<td class="r mono" style="font-size:11px;font-weight:600;color:' + (r.cbs > 0 ? '#F59E0B' : 'var(--txt3)') + '">' + ffz(r.cbs) + '</td>'
      + '<td class="r mono" style="font-size:11px;font-weight:600;color:' + (r.ibs > 0 ? '#3B82F6' : 'var(--txt3)') + '">' + ffz(r.ibs) + '</td>'
      + '<td>' + statusBadge + '</td>'
      + '<td style="font-size:12px;color:var(--txt2)">' + dataFormatada + '</td>'
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

  setEl('nf-detail-numero',        (r.tipoDF || 'DF') + ' ' + r.numero);
  setEl('nf-detail-tipo',          tipoLabel);
  setEl('nf-detail-entidade',      r.entidade);
  setEl('nf-detail-cnpj',          r.cnpj);
  setEl('nf-detail-valor-total',   ff(r.valorTotal));
  setEl('nf-detail-valor-liquido', ff(r.valorLiquido));
  setEl('nf-detail-cbs',           ffz(r.cbs));
  setEl('nf-detail-ibs',           ffz(r.ibs));
  setEl('nf-detail-status',        statusLabels[r.status] || r.status);
  setEl('nf-detail-data',          dataFormatada);
  var chaveEl = document.getElementById('nf-detail-chave');
  if (chaveEl) chaveEl.textContent = r.chaveDF ? r.chaveDF.replace(/(.{4})(?=.)/g, '$1 ') : '—';

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
  credMin: '', credMax: '', tipoDFe: ''
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

    // Tipo de DFe
    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Tipo de DFe</label>'
    + '<select id="fc-tipo-dfe" onchange="window.creditosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none">'
    + '<option value="">Todos</option><option value="entrada">Entrada</option><option value="saida">Saída</option>'
    + '</select></div>'

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
  f.tipoDFe    = (document.getElementById('fc-tipo-dfe') || {}).value || '';
  window.renderizarTabelaCreditos();
};

window.creditosFiltrarMesAno = function() {
  var sel = document.getElementById('cred-mes-ano');
  window._filtrosCreditos.mesAno = sel ? sel.value : '';
  var mesLabels = {
    '2025-10':'out/2025','2025-11':'nov/2025','2025-12':'dez/2025',
    '2026-01':'jan/2026','2026-02':'fev/2026','2026-03':'mar/2026','2026-04':'abr/2026',
    '2026-05':'mai/2026','2026-06':'jun/2026','2026-07':'jul/2026','2026-08':'ago/2026',
    '2026-09':'set/2026','2026-10':'out/2026','2026-11':'nov/2026','2026-12':'dez/2026'
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
  ['fc-busca','fc-tipo','fc-status','fc-contrato','fc-metodo','fc-pagamento','fc-data-de','fc-data-ate','fc-cred-min','fc-cred-max','fc-tipo-dfe'].forEach(function(id) {
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
    credMin:'', credMax:'', tipoDFe:''
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
          // Usar rf.valor (sincronizado com alíquota do imposto) ao invés de recomputar
          var credVal = rf.valor || 0;
          var cbsVal = rf.tipoFiscal === 'cbs' ? credVal : 0;
          var ibsVal = rf.tipoFiscal === 'ibs' ? credVal : 0;
          var _eApropriado = rf.status === 'apropriado' || rf.status === 'utilizado';
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
            nf: (nf.tipoDF || 'DF') + ' ' + rf.nfVinculada,
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
            pag: _pagVal,
            isPago: _eApropriado || _temPag,
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
      f.pagamento || f.dataNFDe || f.dataNFAte || f.credMin || f.credMax || f.tipoDFe ||
      (f.statusMulti && f.statusMulti.length)) {
    var busca = (f.busca || '').toLowerCase();
    listaRFs = listaRFs.filter(function(r) {
      if (f.mesAno && !(r.dataNF || '').startsWith(f.mesAno)) return false;
      if (busca && !(r.rf.toLowerCase().includes(busca) || r.nf.toLowerCase().includes(busca) || r.forn.toLowerCase().includes(busca))) return false;
      if (f.tipoFiscal && r.tipoFiscal !== f.tipoFiscal) return false;
      if (f.status && r.status !== f.status) return false;
      if (f.statusMulti && f.statusMulti.length && !f.statusMulti.includes(r.status)) return false;
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
      return true;
    });
  }

  // Atualizar contagem
  var contagemEl = document.getElementById('fc-contagem');
  if (contagemEl) contagemEl.textContent = listaRFs.length + ' registro' + (listaRFs.length !== 1 ? 's' : '');

  if (!listaRFs.length) {
    h = '<tr><td colspan="15" style="text-align:center;color:var(--txt3);padding:24px">Nenhum crédito encontrado para este filtro.</td></tr>';
  } else {
    listaRFs.forEach(function(r) {
      var tipoFiscalBadge = '<span style="font-size:11px;font-weight:600;color:' + (r.tipoFiscal === 'IBS' ? '#3B82F6' : '#F59E0B') + '">' + r.tipoFiscal + '</span>';
      var nfTipoBadgeCred = r.tipoNF === 'saida'
        ? '<span style="background:rgba(59,130,246,.12);color:#3B82F6;border:1px solid rgba(59,130,246,.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">Saída</span>'
        : '<span style="background:rgba(34,197,94,.12);color:#22C55E;border:1px solid rgba(34,197,94,.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">Entrada</span>';
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
      var pagCell = r.isPago
        ? '<a href="javascript:void(0)" onclick="window.abrirComprovanteRF(\'' + r.rfId + '\')" title="Ver comprovante PIX" style="color:var(--teal);font-weight:600;text-decoration:underline dotted;cursor:pointer">' + r.pag + '</a>'
        : '<span style="color:var(--txt3)">—</span>';
      h += '<tr><td class="mono" style="color:#3B82F6;font-size:11px">' + r.rf + '</td><td>' + tipoFiscalBadge + '</td><td>' + nfTipoBadgeCred + '</td><td>' + nfLink + '</td><td>' + r.forn + '</td><td>' + r.data + '</td><td class="r mono">' + ff(r.valorTotal) + '</td><td class="r mono">' + ff(r.valorLiq) + '</td><td class="r mono" style="color:#F59E0B;font-weight:600">' + ffz(r.cbs) + '</td><td class="r mono" style="color:#3B82F6;font-weight:600">' + ffz(r.ibs) + '</td><td class="r mono" style="color:#49C5B1;font-weight:700">' + ff(r.cred) + '</td><td style="font-size:11px">' + pagCell + '</td><td>' + bdg(r.status) + '</td><td style="white-space:nowrap">' + contratoCell + '</td><td style="white-space:nowrap">' + metodoCell + '</td></tr>';
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
  var sel = document.getElementById('dash-mes-select');
  var mes = sel ? sel.value : '04';
  if (!mes) mes = '04';
  var prefix = '2026-' + mes;

  var aprop = 0, total = 0, bad = 0, risco = 0;
  var badStatuses = ['nao_apropriado', 'inconsistencia', 'vencido'];
  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'entrada') return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      if (!(rf.data || '').startsWith(prefix)) return;
      var v = rf.valor || 0;
      total += v;
      if (rf.status === 'apropriado' || rf.status === 'utilizado') aprop += v;
      if (badStatuses.indexOf(rf.status) !== -1)                   bad   += v;
      if (rf.status === 'vencido')                                  risco += v;
    });
  });

  function fmtM(v) {
    if (v >= 1e6) return 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M';
    if (v >= 1e3) return 'R$ ' + Math.round(v / 1e3) + 'K';
    return 'R$ ' + v.toLocaleString('pt-BR');
  }
  function setEl(id, val) { var e = document.getElementById(id); if (e) e.textContent = val; }

  setEl('dash-cred-aprop', fmtM(aprop));
  setEl('dash-cred-risco', fmtM(risco));

  // % de créditos não apropriados (nao_apropriado + inconsistencia + vencido) sobre total do mês
  if (total > 0) {
    var pct = (bad / total * 100).toFixed(1).replace('.', ',') + '%';
    setEl('dash-cred-apropriar', pct);
    var d = (typeof _dashMeses !== 'undefined' && _dashMeses[mes]) ? _dashMeses[mes] : {};
    setEl('dash-cred-apropriar-sub', (d.upApropriar || '') + ' — ' + fmtM(bad) + ' não apropriados');
  }
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

// ============================================================
// GESTÃO DE INCONSISTÊNCIAS — listagem, KPIs e gráficos
// ============================================================

window._rfIncGlobal  = [];
window._rfIncFiltrado = [];
window._rfIncPagina  = 1;
window._rfIncIpp     = 25;

var _incCores = { 'Não conciliado':'#F43F5E','Valor imposto divergente':'#F59E0B','Vencido':'#EF4444','Sem Comprovante':'#8B5CF6' };

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
    s += '<text x="' + (W - 2) + '" y="' + (y + barH / 2 + 4) + '" text-anchor="end" fill="#8B5CF6" font-size="10" font-weight="700" font-family="Montserrat,sans-serif">' + vlbl + '</text>';
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
    s += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + bh + '" rx="2" fill="#8B5CF6" opacity=".75"/>';
    s += '<text x="' + (x + barW / 2) + '" y="' + (H - 6) + '" text-anchor="middle" fill="#A7A8AA" font-size="9" font-family="Montserrat,sans-serif">' + m.slice(5) + '</text>';
    if (v > 0) s += '<text x="' + (x + barW / 2) + '" y="' + (y - 3) + '" text-anchor="middle" fill="#8B5CF6" font-size="9" font-weight="700" font-family="Montserrat,sans-serif">' + v + '</text>';
  });
  s += '</svg>';
  el.innerHTML = s;
}

window.renderizarRFsInconsistencias = function() {
  // 1. Coletar dados globais
  var lista = [];
  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (!nf.registrosFiscais) return;
    var tipoNF = nf.tipo || 'entrada';
    nf.registrosFiscais.forEach(function(rf) {
      if (rf.status !== 'inconsistencia') return;
      var dp = (rf.data || '').split('-');
      lista.push({
        id:        rf.id || '—',
        tf:        rf.tipoFiscal === 'ibs' ? 'IBS' : 'CBS',
        tipoNF:    tipoNF,
        nfVinc:    (nf.tipoDF || 'DF') + ' ' + (rf.nfVinculada || nf.numero || ''),
        forn:      (rf.entidade || nf.entidade || '—'),
        cnpj:      rf.cnpj || nf.cnpj || '—',
        valor:     rf.valor || 0,
        valorTotal: rf.valorTotalNF || 0,
        valorLiq:  rf.valorLiquidoNF || 0,
        dataISO:   rf.data || '',
        data:      dp.length === 3 ? dp[2]+'/'+dp[1]+'/'+dp[0] : '—',
        inc:       rf.inconsistencia || null
      });
    });
  });
  window._rfIncGlobal = lista;

  // 2. KPIs
  var totalRFs = lista.length;
  var volTotal  = lista.reduce(function(s, r){ return s + r.valor; }, 0);
  var cntEnt    = lista.filter(function(r){ return r.tipoNF === 'entrada'; }).length;
  var cntSai    = lista.filter(function(r){ return r.tipoNF === 'saida'; }).length;
  function setEl(id, v){ var e=document.getElementById(id); if(e) e.textContent=v; }
  setEl('inc2-total',  totalRFs);
  setEl('inc2-total-sub', 'IBS + CBS · entrada e saída');
  setEl('inc2-volume', _incFmtM(volTotal));
  setEl('inc2-volume-sub', totalRFs > 0 ? 'Média ' + _incFmtM(Math.round(volTotal / totalRFs)) + ' por RF' : 'Soma dos valores');
  setEl('inc2-entrada', cntEnt);
  setEl('inc2-entrada-sub', 'Créditos · ' + lista.filter(function(r){return r.tipoNF==='entrada'&&r.tf==='IBS';}).length + ' IBS · ' + lista.filter(function(r){return r.tipoNF==='entrada'&&r.tf==='CBS';}).length + ' CBS');
  setEl('inc2-saida', cntSai);
  setEl('inc2-saida-sub', 'Débitos · ' + lista.filter(function(r){return r.tipoNF==='saida'&&r.tf==='IBS';}).length + ' IBS · ' + lista.filter(function(r){return r.tipoNF==='saida'&&r.tf==='CBS';}).length + ' CBS');

  // 3. Chart 1 — Top 5 fornecedores
  var mapForn = {};
  lista.forEach(function(r){ mapForn[r.forn] = (mapForn[r.forn]||0) + r.valor; });
  var top5Forn = Object.keys(mapForn).map(function(k){return {label:k,v:mapForn[k]};}).sort(function(a,b){return b.v-a.v;}).slice(0,5);
  _incSvgBar(document.getElementById('c-inc-top5-forn'), top5Forn, function(){return '#8B5CF6';}, 560, 20, 12, 180, 70);

  // 4. Chart 2 — Por tipo de inconsistência
  var mapTipo = {};
  lista.forEach(function(r){ var k=r.inc||'Sem tipo'; mapTipo[k]=(mapTipo[k]||0)+r.valor; });
  var tiposDados = Object.keys(mapTipo).map(function(k){return {label:k,v:mapTipo[k],cor:_incCores[k]||'#8B5CF6'};}).sort(function(a,b){return b.v-a.v;});
  _incSvgBar(document.getElementById('c-inc-tipos'), tiposDados, function(d){return d.cor;}, 560, 20, 12, 180, 70);

  // 5. Chart 3 — IBS vs CBS
  var volIBS = lista.filter(function(r){return r.tf==='IBS';}).reduce(function(s,r){return s+r.valor;},0);
  var volCBS = lista.filter(function(r){return r.tf==='CBS';}).reduce(function(s,r){return s+r.valor;},0);
  _incSvgDuo(document.getElementById('c-inc-ibs-cbs'), [
    {label:'IBS', v:volIBS, cor:'#3B82F6'},
    {label:'CBS', v:volCBS, cor:'#F59E0B'}
  ], 280, 22);

  // 6. Chart 4 — Entrada vs Saída
  var volEnt = lista.filter(function(r){return r.tipoNF==='entrada';}).reduce(function(s,r){return s+r.valor;},0);
  var volSai = lista.filter(function(r){return r.tipoNF==='saida';}).reduce(function(s,r){return s+r.valor;},0);
  _incSvgDuo(document.getElementById('c-inc-ent-sai'), [
    {label:'Entrada', v:volEnt, cor:'#22C55E'},
    {label:'Saída',   v:volSai, cor:'#3B82F6'}
  ], 280, 22);

  // 7. Chart 5 — Evolução mensal (contagem de RFs)
  var mapMes = {};
  lista.forEach(function(r){ var m=(r.dataISO||'').slice(0,7); if(m) mapMes[m]=(mapMes[m]||0)+1; });
  _incSvgMensal(document.getElementById('c-inc-mensal'), mapMes, 280);

  // 8. Renderizar listagem filtrada
  window.incRfFiltrar();
};

window.incRfToggleFiltros = function() {
  var corpo = document.getElementById('inc-rf-filtro-corpo');
  var icon  = document.getElementById('inc-rf-toggle-icon');
  if (!corpo) return;
  var aberto = corpo.style.display !== 'none';
  corpo.style.display = aberto ? 'none' : 'block';
  if (icon) icon.style.transform = aberto ? '' : 'rotate(180deg)';
};

window.incRfFiltrar = function() {
  var busca    = ((document.getElementById('inc-rf-busca')       ||{}).value||'').toLowerCase();
  var tipoNF   = (document.getElementById('inc-rf-tipo-nf')      ||{}).value||'';
  var tipoFisc = (document.getElementById('inc-rf-tipo-fiscal')  ||{}).value||'';
  var incTipo  = (document.getElementById('inc-rf-inc-tipo')     ||{}).value||'';
  var dataDe   = (document.getElementById('inc-rf-data-de')      ||{}).value||'';
  var dataAte  = (document.getElementById('inc-rf-data-ate')     ||{}).value||'';
  var valMin   = (document.getElementById('inc-rf-valor-min')    ||{}).value||'';
  var valMax   = (document.getElementById('inc-rf-valor-max')    ||{}).value||'';

  var lista = (window._rfIncGlobal || []).filter(function(r) {
    if (tipoNF   && r.tipoNF !== tipoNF)                          return false;
    if (tipoFisc && r.tf.toLowerCase() !== tipoFisc)              return false;
    if (incTipo  && r.inc !== incTipo)                            return false;
    if (dataDe   && r.dataISO < dataDe)                           return false;
    if (dataAte  && r.dataISO > dataAte)                          return false;
    if (valMin !== '' && r.valor < parseFloat(valMin))            return false;
    if (valMax !== '' && r.valor > parseFloat(valMax))            return false;
    if (busca) {
      var s = (r.id+r.nfVinc+r.forn+r.cnpj).toLowerCase();
      if (!s.includes(busca)) return false;
    }
    return true;
  });

  window._rfIncFiltrado = lista;
  window._rfIncPagina = 1;
  var cnt = document.getElementById('inc-rf-contagem');
  if (cnt) cnt.textContent = lista.length + ' registro' + (lista.length !== 1 ? 's' : '');
  window._incRfRenderPagina();
};

window.incRfLimparFiltros = function() {
  ['inc-rf-busca','inc-rf-tipo-nf','inc-rf-tipo-fiscal','inc-rf-inc-tipo','inc-rf-data-de','inc-rf-data-ate','inc-rf-valor-min','inc-rf-valor-max'].forEach(function(id){
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

  var stBadge = '<span style="background:rgba(139,92,246,.12);color:#8B5CF6;border:1px solid rgba(139,92,246,.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">Inconsistência</span>';
  var h = '';
  pag.forEach(function(r) {
    var tfBadge = r.tf === 'IBS'
      ? '<span style="background:rgba(59,130,246,.12);color:#3B82F6;border:1px solid rgba(59,130,246,.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">IBS</span>'
      : '<span style="background:rgba(245,158,11,.12);color:#F59E0B;border:1px solid rgba(245,158,11,.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">CBS</span>';
    var nfBadge = r.tipoNF === 'entrada'
      ? '<span style="background:rgba(34,197,94,.12);color:#22C55E;border:1px solid rgba(34,197,94,.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">Entrada</span>'
      : '<span style="background:rgba(59,130,246,.12);color:#3B82F6;border:1px solid rgba(59,130,246,.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">Saída</span>';
    var incBadge = r.inc
      ? '<span style="color:' + (_incCores[r.inc]||'#666') + ';font-size:11px;font-weight:600">' + r.inc + '</span>'
      : '<span style="color:var(--txt3);font-size:11px">—</span>';
    h += '<tr>'
      + '<td class="mono" style="color:#8B5CF6;font-weight:600">' + r.id + '</td>'
      + '<td>' + tfBadge + '</td>'
      + '<td>' + nfBadge + '</td>'
      + '<td class="mono" style="font-size:11px;color:#3B82F6;font-weight:600">' + r.nfVinc + '</td>'
      + '<td style="font-size:12px">' + r.forn + '</td>'
      + '<td class="mono" style="font-size:11px;color:var(--txt2)">' + r.cnpj + '</td>'
      + '<td class="r mono" style="font-size:11px;font-weight:700;color:' + (r.tf==='IBS'?'#3B82F6':'#F59E0B') + '">' + ff(r.valor) + '</td>'
      + '<td class="r mono" style="font-size:11px">' + ff(r.valorTotal) + '</td>'
      + '<td class="r mono" style="font-size:11px;color:var(--txt2)">' + ff(r.valorLiq) + '</td>'
      + '<td>' + stBadge + '</td>'
      + '<td style="font-size:11px;color:var(--txt2)">' + r.data + '</td>'
      + '<td>' + incBadge + '</td>'
      + '</tr>';
  });
  if (!pag.length) h = '<tr><td colspan="12" style="text-align:center;color:var(--txt3);padding:24px">Nenhum RF com inconsistência encontrado para este filtro.</td></tr>';

  var tbody = document.getElementById('t-inc-rfs');
  if (tbody) tbody.innerHTML = h;

  function setEl(id, v){ var e=document.getElementById(id); if(e) e.textContent=v; }
  setEl('inc-rf-count-sub', lista.length + ' RF' + (lista.length!==1?'s':'') + ' com inconsistência · entrada e saída');
  setEl('inc-rf-pag-atual', pagAtual);
  setEl('inc-rf-pag-total', totalPag);

  var btnP = document.getElementById('inc-rf-btn-prev');
  var btnN = document.getElementById('inc-rf-btn-prox');
  if (btnP) { btnP.disabled = pagAtual <= 1; btnP.style.opacity = pagAtual <= 1 ? '0.5' : '1'; btnP.style.cursor = pagAtual <= 1 ? 'not-allowed' : 'pointer'; }
  if (btnN) { btnN.disabled = pagAtual >= totalPag; btnN.style.opacity = pagAtual >= totalPag ? '0.5' : '1'; btnN.style.cursor = pagAtual >= totalPag ? 'not-allowed' : 'pointer'; }
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
  { id: 'identificado',   label: 'Identificado',       cor: '#F43F5E', icon: '🔴' },
  { id: 'analise',        label: 'Em Análise',          cor: '#F59E0B', icon: '🔍' },
  { id: 'tratamento',     label: 'Em Tratamento',       cor: '#3B82F6', icon: '🔧' },
  { id: 'aguardando',     label: 'Aguardando Retorno',  cor: '#8B5CF6', icon: '⏳' },
  { id: 'resolvido',      label: 'Resolvido',           cor: '#22C55E', icon: '✅' }
];

var _kbIncCores = {
  'Não conciliado':          '#F43F5E',
  'Valor imposto divergente':'#F59E0B',
  'Vencido':                 '#EF4444',
  'Sem Comprovante':         '#8B5CF6'
};

window.renderizarKanbanInconsistencias = function() {
  var board = document.getElementById('inc-kanban-board');
  if (!board) return;

  // Coletar RFs com inconsistência
  var rfs = [];
  var nfs = window.nfListaFiltradaGlobal || [];
  nfs.forEach(function(nf) {
    (nf.registrosFiscais || []).forEach(function(rf) {
      if (rf.status === 'inconsistencia') {
        rfs.push({
          id: rf.id || ('RF-' + Math.random().toString(36).slice(2,7).toUpperCase()),
          tipoNF: nf.tipo || 'entrada',
          tipoFiscal: rf.tipoFiscal === 'ibs' ? 'IBS' : 'CBS',
          entidade: rf.entidade || nf.entidade || '—',
          cnpj: rf.cnpj || nf.cnpj || '—',
          valor: rf.valor || 0,
          data: rf.data || nf.data || '',
          nfNumero: nf.numero || '—',
          inconsistencia: rf.inconsistencia || 'Não conciliado'
        });
      }
    });
  });

  // Atualizar badge total
  var badge = document.getElementById('inc-kb-total-badge');
  if (badge) badge.textContent = rfs.length + (rfs.length === 1 ? ' cartão' : ' cartões');

  // Inicializar estado para novos RFs (padrão: identificado)
  rfs.forEach(function(rf) {
    if (!window._kanbanState[rf.id]) window._kanbanState[rf.id] = 'identificado';
  });

  // Agrupar por coluna
  var grupos = {};
  _kbColunas.forEach(function(c) { grupos[c.id] = []; });
  rfs.forEach(function(rf) {
    var col = window._kanbanState[rf.id] || 'identificado';
    if (!grupos[col]) col = 'identificado';
    grupos[col].push(rf);
  });

  function ff(v) {
    if (!v && v !== 0) return '—';
    return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Construir board
  var html = '';
  _kbColunas.forEach(function(col) {
    var cards = grupos[col.id] || [];
    var cardsHtml = '';
    cards.forEach(function(rf) {
      var incCor = _kbIncCores[rf.inconsistencia] || '#64748B';
      var nfTipoCor = rf.tipoNF === 'entrada' ? '#22C55E' : '#F59E0B';
      var ftCor = rf.tipoFiscal === 'IBS' ? '#3B82F6' : '#2DD4BF';
      cardsHtml += '<div class="kb-card" draggable="true"'
        + ' ondragstart="window._kbDragStart(event,\'' + rf.id.replace(/'/g,"\\'") + '\')"'
        + ' style="background:var(--card);border:1px solid var(--brd);border-radius:10px;padding:12px 14px;margin-bottom:10px;cursor:grab;box-shadow:0 1px 4px rgba(0,0,0,.08);transition:opacity .15s,transform .15s,box-shadow .15s"'
        + ' onmouseenter="this.style.boxShadow=\'0 4px 14px rgba(0,0,0,.18)\';this.style.transform=\'translateY(-1px)\'"'
        + ' onmouseleave="this.style.boxShadow=\'0 1px 4px rgba(0,0,0,.08)\';this.style.transform=\'\'">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
        + '<span style="font-size:9px;font-family:\'IBM Plex Mono\',monospace;color:var(--txt3);letter-spacing:.05em">' + rf.id + '</span>'
        + '<span style="background:' + incCor + '22;color:' + incCor + ';border-radius:4px;padding:2px 6px;font-size:9px;font-weight:700;letter-spacing:.03em">' + rf.inconsistencia + '</span>'
        + '</div>'
        + '<div style="font-size:12px;font-weight:600;color:var(--txt1);margin-bottom:6px;line-height:1.3">' + rf.entidade + '</div>'
        + '<div style="font-size:11px;color:var(--txt2);margin-bottom:8px;font-family:\'IBM Plex Mono\',monospace">' + rf.cnpj + '</div>'
        + '<div style="font-size:13px;font-weight:700;color:var(--txt1);margin-bottom:8px">' + ff(rf.valor) + '</div>'
        + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'
        + '<span style="background:' + nfTipoCor + '22;color:' + nfTipoCor + ';border-radius:4px;padding:2px 6px;font-size:9px;font-weight:700">' + (rf.tipoNF === 'entrada' ? 'ENTRADA' : 'SAÍDA') + '</span>'
        + '<span style="background:' + ftCor + '22;color:' + ftCor + ';border-radius:4px;padding:2px 6px;font-size:9px;font-weight:700">' + rf.tipoFiscal + '</span>'
        + '<span style="font-size:10px;color:var(--txt3);margin-left:auto">' + (rf.data ? rf.data.split('T')[0] : '—') + '</span>'
        + '</div>'
        + '</div>';
    });

    html += '<div style="flex:0 0 230px;min-width:230px">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:10px 14px;background:var(--card);border:1px solid var(--brd);border-radius:10px;border-top:3px solid ' + col.cor + '">'
      + '<span style="font-size:14px">' + col.icon + '</span>'
      + '<span style="font-size:12px;font-weight:700;color:var(--txt1);flex:1">' + col.label + '</span>'
      + '<span style="background:' + col.cor + '22;color:' + col.cor + ';border-radius:10px;padding:2px 8px;font-size:11px;font-weight:700">' + cards.length + '</span>'
      + '</div>'
      + '<div id="kb-col-' + col.id + '" data-col="' + col.id + '"'
      + ' ondragover="window._kbDragOver(event)"'
      + ' ondragleave="window._kbDragLeave(event)"'
      + ' ondrop="window._kbDrop(event,\'' + col.id + '\')"'
      + ' style="min-height:400px;padding:4px;border:2px dashed transparent;border-radius:10px;transition:border-color .15s,background .15s">'
      + cardsHtml
      + '</div>'
      + '</div>';
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
  var rfId = e.dataTransfer.getData('text/plain');
  if (!rfId) return;
  window._kanbanState[rfId] = colId;
  window.renderizarKanbanInconsistencias();
};

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

  // Pré-calcular valores escalados: sum(valorBruto) = R$ 100M
  // valorBruto = vliq * (1 + ALIQ_CBS + ALIQ_IBS) = vliq * 1.18
  var _vliqBase = [];
  for (var _j = 1; _j <= 100; _j++) {
    var _s = (_j * 73856093 ^ _j * 19349663 ^ _j * 83492791) >>> 0;
    _vliqBase.push(500000 + (_s % 800001));
  }
  var _sumBase   = _vliqBase.reduce(function(s, v) { return s + v; }, 0);
  var _targetLiq = Math.round(100000000 / (1 + ALIQ_CBS + ALIQ_IBS));
  var _scale     = _targetLiq / _sumBase;

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

    (nf.registrosFiscais || []).forEach(function(rf, ri) {
      rf.data           = dataISO;
      rf.status         = stRF;
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
  mesAno: '', busca: '', tipoFiscal: '', status: '',
  metodo: '', extincao: '', dataNFDe: '', dataNFAte: '',
  debMin: '', debMax: '', tipoDFe: ''
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
    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Tipo de DFe</label>'
    + '<select id="fd-tipo-dfe" onchange="window.debitosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none">'
    + '<option value="">Todos</option><option value="entrada">Entrada</option><option value="saida">Saída</option>'
    + '</select></div>'
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
  f.tipoDFe    = (document.getElementById('fd-tipo-dfe') || {}).value || '';
  window.renderizarTabelaDebitos();
};

window.debitosFiltrarMesAno = function() {
  var sel = document.getElementById('deb-mes-ano');
  window._filtrosDebitos.mesAno = sel ? sel.value : '';
  var mesLabels = {
    '2025-10':'out/2025','2025-11':'nov/2025','2025-12':'dez/2025',
    '2026-01':'jan/2026','2026-02':'fev/2026','2026-03':'mar/2026','2026-04':'abr/2026',
    '2026-05':'mai/2026','2026-06':'jun/2026','2026-07':'jul/2026','2026-08':'ago/2026',
    '2026-09':'set/2026','2026-10':'out/2026','2026-11':'nov/2026','2026-12':'dez/2026'
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
  ['fd-busca','fd-tipo','fd-status','fd-metodo','fd-extincao','fd-data-de','fd-data-ate','fd-deb-min','fd-deb-max','fd-tipo-dfe'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  var selMes = document.getElementById('deb-mes-ano');
  if (selMes) selMes.value = '';
  var sub = document.getElementById('deb-periodo-sub');
  if (sub) sub.textContent = 'Posição IBS + CBS · Art. 153-A LC 214/2025 · Todos os períodos';
  window._filtrosDebitos = {
    mesAno: '', busca: '', tipoFiscal: '', status: '',
    metodo: '', extincao: '', dataNFDe: '', dataNFAte: '',
    debMin: '', debMax: '', tipoDFe: ''
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
        // Usar rf.valor (sincronizado com alíquota do imposto) ao invés de recomputar
        var debVal   = rf.valor || 0;
        var cbsVal   = rf.tipoFiscal === 'cbs' ? debVal : 0;
        var ibsVal   = rf.tipoFiscal === 'ibs' ? debVal : 0;
        var dp       = (rf.data || '').split('-');
        listaRFs.push({
          rf:   rf.id || '—',
          tf:   rf.tipoFiscal === 'ibs' ? 'IBS' : 'CBS',
          tipoNF: rf.tipoNF || nf.tipo || 'saida',
          nf:   (nf.tipoDF || 'DF') + ' ' + (rf.nfVinculada || nf.numero || ''),
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
    if (f.tipoDFe    && r.tipoNF !== f.tipoDFe) return false;
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

    var nfTipoBadgeDeb = r.tipoNF === 'entrada'
      ? '<span style="background:rgba(34,197,94,.12);color:#22C55E;border:1px solid rgba(34,197,94,.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">Entrada</span>'
      : '<span style="background:rgba(59,130,246,.12);color:#3B82F6;border:1px solid rgba(59,130,246,.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">Saída</span>';
    h += '<tr>'
      + '<td class="mono" style="font-size:11px;color:var(--txt2)">' + r.rf + '</td>'
      + '<td>' + tfBadge + '</td>'
      + '<td>' + nfTipoBadgeDeb + '</td>'
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
    h = '<tr><td colspan="14" style="text-align:center;color:var(--txt3);padding:24px">Nenhum RF de débito encontrado para este filtro.</td></tr>';
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
// CRÉDITOS — top 5 RFs com inconsistência por volume financeiro
// ============================================================

window.renderizarTop5Inconsistencias = function() {
  var el = document.getElementById('c-top5-inconsist');
  if (!el) return;

  var lista = [];
  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'entrada') return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      if (rf.status === 'inconsistencia') {
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

  var tipoCor = { IBS: '#3B82F6', CBS: '#F59E0B' };

  var s = '<svg viewBox="0 0 ' + W + ' ' + totalH + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">';

  top5.forEach(function(r, i) {
    var y = padT + i * (barH + gap);
    var barW = Math.max(4, Math.round((r.valor / maxVal) * (W - padL - padR)));
    var cor = tipoCor[r.tipo] || '#F43F5E';
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
    s += '<text x="' + (W - 4) + '" y="' + (y + barH / 2 + 4) + '" text-anchor="end" fill="#F43F5E" font-size="10" font-weight="700" font-family="Montserrat,sans-serif">R$ ' + valM + 'M</text>';
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

  var mapa = {};
  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'entrada') return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      if (rf.status !== 'vencido' && rf.status !== 'inconsistencia') return;
      var nome = (rf.entidade || nf.entidade || '—');
      if (!mapa[nome]) mapa[nome] = { nome: nome, vencido: 0, inconsistencia: 0 };
      if (rf.status === 'vencido')        mapa[nome].vencido       += rf.valor || 0;
      if (rf.status === 'inconsistencia') mapa[nome].inconsistencia += rf.valor || 0;
    });
  });

  var lista = Object.values(mapa).map(function(e) {
    return { nome: e.nome.slice(0, 18), total: e.vencido + e.inconsistencia, vencido: e.vencido, inconsistencia: e.inconsistencia };
  });

  if (!lista.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--txt3);font-size:12px;padding:24px 0">Nenhum registro encontrado.</div>';
    return;
  }

  lista.sort(function(a, b) { return b.total - a.total; });
  var top10 = lista.slice(0, 10);
  var maxVal = top10[0].total;

  var W = 520, barH = 14, gap = 10, padL = 120, padR = 64, padT = 6, padB = 4;
  var totalH = padT + top10.length * (barH + gap) - gap + padB;

  var s = '<svg viewBox="0 0 ' + W + ' ' + totalH + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">';

  top10.forEach(function(r, i) {
    var y = padT + i * (barH + gap);
    var barWTotal  = Math.max(4, Math.round((r.total        / maxVal) * (W - padL - padR)));
    var barWVenc   = Math.max(0, Math.round((r.vencido      / maxVal) * (W - padL - padR)));
    var barWIncons = Math.max(0, Math.round((r.inconsistencia / maxVal) * (W - padL - padR)));

    // label
    s += '<text x="' + (padL - 6) + '" y="' + (y + barH / 2 + 4) + '" text-anchor="end" fill="#A7A8AA" font-size="9" font-family="Montserrat,sans-serif">' + r.nome + '</text>';

    // fundo
    s += '<rect x="' + padL + '" y="' + y + '" width="' + (W - padL - padR) + '" height="' + barH + '" rx="3" fill="rgba(244,63,94,.07)"/>';

    // segmento vencido (vermelho)
    if (barWVenc > 0) {
      s += '<rect x="' + padL + '" y="' + y + '" width="' + barWVenc + '" height="' + barH + '" rx="3" fill="#F43F5E" opacity=".8"/>';
    }
    // segmento inconsistência (âmbar) empilhado
    if (barWIncons > 0) {
      var xIncons = padL + barWVenc;
      s += '<rect x="' + xIncons + '" y="' + y + '" width="' + barWIncons + '" height="' + barH + '" rx="3" fill="#F59E0B" opacity=".8"/>';
    }

    // valor total
    var valM = (r.total / 1e6).toFixed(2).replace('.', ',');
    s += '<text x="' + (W - 2) + '" y="' + (y + barH / 2 + 4) + '" text-anchor="end" fill="#A7A8AA" font-size="9" font-weight="600" font-family="Montserrat,sans-serif">R$ ' + valM + 'M</text>';
  });

  // legenda
  s += '<rect x="' + padL + '" y="' + (totalH - 2) + '" width="10" height="6" rx="1" fill="#F43F5E" opacity=".8"/>';
  s += '<text x="' + (padL + 13) + '" y="' + (totalH + 2) + '" fill="#A7A8AA" font-size="8" font-family="Montserrat,sans-serif">Vencido</text>';
  s += '<rect x="' + (padL + 65) + '" y="' + (totalH - 2) + '" width="10" height="6" rx="1" fill="#F59E0B" opacity=".8"/>';
  s += '<text x="' + (padL + 78) + '" y="' + (totalH + 2) + '" fill="#A7A8AA" font-size="8" font-family="Montserrat,sans-serif">Inconsistência</text>';

  s += '</svg>';
  el.innerHTML = s;
};

// ============================================================
// GESTÃO DE PAGAMENTOS — filtro global de mês + tabela dinâmica
// ============================================================

window._filtrosPagamentos = { mesAno: '', tipo: '', status: '', busca: '', valorMin: '', valorMax: '', dataRFDe: '', dataRFAte: '', pagamento: '', tipoDFe: '' };

window.injetarFiltrosPagamentos = function() {
  if (document.getElementById('filtros-pagamentos-avancado')) return;
  var tcrd = document.querySelector('#pag-imp .tcrd');
  if (!tcrd) return;

  var html = '<div id="filtros-pagamentos-avancado" style="background:var(--card);border:1px solid var(--brd);border-radius:10px;margin-bottom:16px;overflow:hidden">'
    + '<button onclick="window.pagamentosToggleFiltros()" style="width:100%;display:flex;align-items:center;justify-content:space-between;background:none;border:none;padding:14px 20px;cursor:pointer;text-align:left">'
    + '<span style="font-size:12px;font-weight:700;color:var(--txt1);text-transform:uppercase;letter-spacing:.05em">Filtros</span>'
    + '<span id="fp-toggle-icon" style="font-size:16px;color:var(--txt2);transition:transform .2s">▾</span>'
    + '</button>'
    + '<div id="fp-corpo" style="padding:0 20px 16px;display:none">'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;align-items:end">'

    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Busca (RF / Fornecedor / CNPJ)</label>'
    + '<input id="fp-busca" type="text" placeholder="Pesquisar…" oninput="window.pagamentosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none"></div>'

    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Tipo</label>'
    + '<select id="fp-tipo" onchange="window.pagamentosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none">'
    + '<option value="">Todos</option><option value="Guia IBS">Guia IBS</option><option value="DARF CBS">DARF CBS</option>'
    + '</select></div>'

    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Status</label>'
    + '<select id="fp-status" onchange="window.pagamentosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none">'
    + '<option value="">Todos</option>'
    + '<option value="pago">Pago</option>'
    + '<option value="pendente">Pendente</option>'
    + '<option value="atrasado">Atrasado</option>'
    + '<option value="vencendo">Em risco</option>'
    + '</select></div>'

    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Pagamento</label>'
    + '<select id="fp-pagamento" onchange="window.pagamentosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none">'
    + '<option value="">Todos</option><option value="com">Com pagamento</option><option value="sem">Sem pagamento</option>'
    + '</select></div>'

    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Data RF — de</label>'
    + '<input id="fp-data-de" type="date" onchange="window.pagamentosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none"></div>'

    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Data RF — até</label>'
    + '<input id="fp-data-ate" type="date" onchange="window.pagamentosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none"></div>'

    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Valor — mín (R$)</label>'
    + '<input id="fp-valor-min" type="number" min="0" placeholder="0" oninput="window.pagamentosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none"></div>'

    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Valor — máx (R$)</label>'
    + '<input id="fp-valor-max" type="number" min="0" placeholder="∞" oninput="window.pagamentosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none"></div>'

    + '<div><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Tipo de DFe</label>'
    + '<select id="fp-tipo-dfe" onchange="window.pagamentosFiltrarGrid()" style="width:100%;box-sizing:border-box;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt1);outline:none">'
    + '<option value="">Todos</option><option value="entrada">Entrada</option><option value="saida">Saída</option>'
    + '</select></div>'

    + '</div>'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid var(--brd)">'
    + '<span id="fp-contagem" style="font-size:11px;color:var(--txt2)">— registros</span>'
    + '<button onclick="window.pagamentosLimparFiltros()" style="background:none;border:1px solid var(--brd);border-radius:6px;padding:4px 12px;font-size:11px;color:var(--txt2);cursor:pointer">✕ Limpar filtros</button>'
    + '</div>'
    + '</div>'
    + '</div>';

  tcrd.insertAdjacentHTML('beforebegin', html);
};

window.pagamentosToggleFiltros = function() {
  var corpo = document.getElementById('fp-corpo');
  var icon  = document.getElementById('fp-toggle-icon');
  if (!corpo) return;
  var aberto = corpo.style.display !== 'none';
  corpo.style.display = aberto ? 'none' : 'block';
  if (icon) icon.style.transform = aberto ? '' : 'rotate(180deg)';
};

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
  window.renderizarTabelaPagamentos();
};

window.pagamentosLimparFiltros = function() {
  ['fp-busca','fp-tipo','fp-status','fp-pagamento','fp-data-de','fp-data-ate','fp-valor-min','fp-valor-max','fp-tipo-dfe'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  window._filtrosPagamentos = { mesAno: window._filtrosPagamentos.mesAno, tipo: '', status: '', busca: '', valorMin: '', valorMax: '', dataRFDe: '', dataRFAte: '', pagamento: '', tipoDFe: '' };
  window.renderizarTabelaPagamentos();
};

window.pagamentosFiltrarMesAno = function() {
  var sel = document.getElementById('pag-mes-ano');
  window._filtrosPagamentos.mesAno = sel ? sel.value : '';
  var mesLabels = {
    '2025-10':'out/2025','2025-11':'nov/2025','2025-12':'dez/2025',
    '2026-01':'jan/2026','2026-02':'fev/2026','2026-03':'mar/2026','2026-04':'abr/2026',
    '2026-05':'mai/2026','2026-06':'jun/2026','2026-07':'jul/2026','2026-08':'ago/2026',
    '2026-09':'set/2026','2026-10':'out/2026','2026-11':'nov/2026','2026-12':'dez/2026'
  };
  var label = window._filtrosPagamentos.mesAno
    ? (mesLabels[window._filtrosPagamentos.mesAno] || window._filtrosPagamentos.mesAno)
    : 'Todos os períodos';
  var sub = document.getElementById('pag-periodo-sub');
  if (sub) sub.textContent = 'Impostos (DARF/Guia IBS) e fornecedores · ' + label;
  window.renderizarTabelaPagamentos();
};

window.renderizarTabelaPagamentos = function() {
  var f     = window._filtrosPagamentos;
  var busca = (f.busca || '').toLowerCase();
  var tipo  = f.tipo  || '';
  var stFlt = f.status || '';

  var stCoresMap = { pendente:'73,197,177', vencendo:'245,158,11', atrasado:'244,63,94', pago:'34,197,94' };
  var stHexMap   = { pendente:'#49C5B1', vencendo:'#F59E0B', atrasado:'#F43F5E', pago:'#22C55E' };
  var stLblMap   = { pendente:'Pendente', vencendo:'Em risco', atrasado:'Atrasado', pago:'Pago' };

  var rows = [];
  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'entrada') return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      if (f.mesAno && !(rf.data || '').startsWith(f.mesAno)) return;

      var tipoCol = rf.tipoFiscal === 'ibs' ? 'Guia IBS' : 'DARF CBS';
      if (tipo && tipoCol !== tipo) return;

      var temPag      = rf.dataPagamento && rf.dataPagamento !== '—';
      var eApropriado = rf.status === 'apropriado' || rf.status === 'utilizado';
      var rfSt;
      if (temPag || eApropriado)               rfSt = 'pago';
      else if (rf.status === 'vencido')        rfSt = 'atrasado';
      else if (rf.status === 'inconsistencia') rfSt = 'vencendo';
      else                                     rfSt = 'pendente';
      if (stFlt && rfSt !== stFlt) return;

      // filtro pagamento com/sem
      if (f.pagamento === 'com' && rfSt !== 'pago') return;
      if (f.pagamento === 'sem' && rfSt === 'pago') return;

      var valor = rf.valor || 0;
      if (f.valorMin !== '' && valor < parseFloat(f.valorMin)) return;
      if (f.valorMax !== '' && valor > parseFloat(f.valorMax)) return;
      if (f.tipoDFe && (rf.tipoNF || nf.tipo || 'entrada') !== f.tipoDFe) return;

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
        tipo: tipoCol, tipoNF: nf.tipo || 'entrada', valor: valor,
        dataRF: dataFmt, dataRFIso: dataRFIso, pagamento: pagFmt, status: rfSt
      });
    });
  });

  var cnt = document.getElementById('fp-contagem');
  if (cnt) cnt.textContent = rows.length + ' registro' + (rows.length !== 1 ? 's' : '');

  window._pagImpRows = rows;
  var h = '';
  rows.forEach(function(r, idx) {
    var stCor  = stHexMap[r.status]  || '#A7A8AA';
    var stRgb  = stCoresMap[r.status] || '167,168,170';
    var stLbl  = stLblMap[r.status]  || r.status;
    var badge  = '<span style="background:rgba('+stRgb+',.12);color:'+stCor+';border:1px solid rgba('+stRgb+',.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">'+stLbl+'</span>';
    var tipoBadge = r.tipo === 'Guia IBS'
      ? '<span style="background:rgba(59,130,246,.12);color:#3B82F6;border:1px solid rgba(59,130,246,.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">Guia IBS</span>'
      : '<span style="background:rgba(245,158,11,.12);color:#F59E0B;border:1px solid rgba(245,158,11,.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">DARF CBS</span>';
    var act = r.status !== 'pago'
      ? '<button class="btn btn-t" style="font-size:11px;padding:4px 10px" onclick="window.abrirGuiaDARF('+idx+')">Gerar Guia</button>'
      : '<span style="font-size:11px;color:var(--txt3)">Concluído</span>';
    var nfTipoBadgePag = r.tipoNF === 'entrada'
      ? '<span style="background:rgba(34,197,94,.12);color:#22C55E;border:1px solid rgba(34,197,94,.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">Entrada</span>'
      : '<span style="background:rgba(59,130,246,.12);color:#3B82F6;border:1px solid rgba(59,130,246,.25);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">Saída</span>';
    h += '<tr>'
      + '<td class="mono" style="font-size:11px;color:#3B82F6;font-weight:600">' + r.rf + '</td>'
      + '<td><div style="font-weight:500;font-size:13px">' + r.forn + '</div><div style="font-size:11px;color:var(--txt2)">' + r.cnpj + '</div></td>'
      + '<td>' + tipoBadge + '</td>'
      + '<td>' + nfTipoBadgePag + '</td>'
      + '<td class="r mono" style="font-weight:600">' + ff(r.valor) + '</td>'
      + '<td style="font-size:11px;color:var(--txt2)">' + r.dataRF + '</td>'
      + '<td style="font-size:11px">' + (r.status === 'pago'
          ? '<a href="javascript:void(0)" onclick="window.abrirComprovanteRF(\'' + r.rfId + '\')" title="Ver comprovante PIX" style="color:var(--teal);font-weight:600;text-decoration:underline dotted;cursor:pointer">' + r.pagamento + '</a>'
          : '<span style="color:var(--txt2)">—</span>') + '</td>'
      + '<td>' + badge + '</td>'
      + '<td>' + act + '</td>'
      + '</tr>';
  });

  if (!rows.length) {
    h = '<tr><td colspan="9" style="text-align:center;color:var(--txt3);padding:24px">Nenhum pagamento encontrado para este filtro.</td></tr>';
  }
  var tbody = document.getElementById('t-impostos');
  if (tbody) tbody.innerHTML = h;

  window.atualizarKPIsPagamentos();
};

window.atualizarKPIsPagamentos = function() {
  var f = window._filtrosPagamentos;
  var pendente = 0, cntPend = 0;
  var vencendo = 0, cntVenc = 0, lastVenc = null;
  var atrasado = 0, cntAtr  = 0, lastAtr  = null;
  var pago     = 0, cntPago = 0;

  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'entrada') return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      if (f.mesAno && !(rf.data || '').startsWith(f.mesAno)) return;
      var temPag     = rf.dataPagamento && rf.dataPagamento !== '—';
      var eApropriado = rf.status === 'apropriado' || rf.status === 'utilizado';
      var v = rf.valor || 0;
      if (temPag || eApropriado)               { pago     += v; cntPago++; }
      else if (rf.status === 'vencido')        { atrasado += v; cntAtr++;  lastAtr  = rf.entidade || nf.entidade; }
      else if (rf.status === 'inconsistencia') { vencendo += v; cntVenc++; lastVenc = rf.entidade || nf.entidade; }
      else                                     { pendente += v; cntPend++; }
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
  var pagNome  = 'Positivo Soluções em Pagamentos';
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
  // Esperar 3 segundos para garantir que o HTML inline script foi completamente executado
  setTimeout(function() {
    console.log('[data-sync-fixed] Iniciando sincronização após 3s delay');
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
        sel.innerHTML = '<option value="">Todos os períodos</option>';
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
      try { window._enriquecerNFsSaida(); } catch(e) { console.error('[data-sync-fixed] Erro _enriquecerNFsSaida:', e); }
      try { _popularFiltrosMes(); } catch(e) { console.error('[data-sync-fixed] Erro _popularFiltrosMes:', e); }
      try { window.renderizarListaNFs(); } catch(e) {}
      try { window.injetarFiltrosCreditos(); window.renderizarTabelaCreditos(); } catch(e) {}
      try { window.injetarFiltrosPagamentos(); window.renderizarTabelaPagamentos(); } catch(e) {}
      try { window.renderizarRFsInconsistencias(); } catch(e) {}
      try { window.renderizarTop5Inconsistencias(); } catch(e) {}
      try { window.renderizarTop10Empresas(); } catch(e) {}
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

        // Gerar NFs de saída (100 clientes) — datas 2026 inteiro, montante total = R$ 100M
        var _clientesSaida = ['WEG Motores','Mercado Livre','Embraer S.A.','Bosch Ltda','Randon S.A.','Ambev S.A.','Magazine Luiza','Gerdau Aços','Marcopolo S.A.','Natura &Co'];
        var _mesesSaida2026 = ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12'];
        var _statusSaida   = ['extinto','extinto','extinto','extinto','extinto','nao_extinto','nao_extinto','nao_extinto','vencido','inconsistencia'];
        var _metodosSaida  = ['RAD','RAD','Compensacao'];

        // Pré-calcular vliq base com variação pseudo-aleatória, depois escalar para sum(valorTotal)=100M
        // valorTotal = vliq * 1.18, target sum(valorTotal) = 100M → sum(vliq) = 100M/1.18 ≈ 84.745.763
        var _vliqBase = [];
        for (var _sj = 1; _sj <= 100; _sj++) {
          var _seed = (_sj * 73856093 ^ _sj * 19349663 ^ _sj * 83492791) >>> 0;
          _vliqBase.push(500000 + (_seed % 800001)); // range 500K–1.3M
        }
        var _sumVliqBase = _vliqBase.reduce(function(s,v){ return s+v; }, 0);
        var _targetSumVliq = Math.round(100000000 / 1.18);
        var _scaleSaida = _targetSumVliq / _sumVliqBase;

        for (var _si = 1; _si <= 100; _si++) {
          var _vliq   = Math.round(_vliqBase[_si - 1] * _scaleSaida);
          var _cbs    = Math.floor(_vliq * 0.08);
          var _ibs    = Math.floor(_vliq * 0.10);
          var _vbrut  = _vliq + _cbs + _ibs;
          var _nsNum  = String(_si + 500000).padStart(6, '0');
          // Data aleatória espalhada por todos os 12 meses de 2026
          var _mesIdx = (_si * 7 + 3) % 12;
          var _mes    = _mesesSaida2026[_mesIdx];
          var _diasNoMes = [31,28,31,30,31,30,31,31,30,31,30,31][_mesIdx];
          var _dia    = String(1 + ((_si * 11 + 7) % _diasNoMes)).padStart(2, '0');
          var _dataS  = _mes + '-' + _dia;
          var _stS    = _statusSaida[(_si - 1) % _statusSaida.length];
          var _metS   = _stS === 'extinto' ? _metodosSaida[(_si - 1) % _metodosSaida.length] : '—';
          var _extDay = String(Math.min(parseInt(_dia) + 5, _diasNoMes)).padStart(2, '0');
          var _mp     = _mes.split('-');
          var _dtExt  = _stS === 'extinto' ? (_extDay + '/' + _mp[1] + '/' + _mp[0] + ' 09:00') : '—';

          var _tipoDFSai = _getTipoDFLoc(_nsNum);
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

        // Enriquecer cada RF com tipoNF da NF pai (entrada | saida)
        window.nfListaFiltradaGlobal.forEach(function(nf) {
          (nf.registrosFiscais || []).forEach(function(rf) {
            rf.tipoNF = nf.tipo || 'entrada';
          });
        });
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

// ============================================================
// GESTÃO ORGANIZAÇÃO — CRUD de CNPJs compradores (Positivo)
// ============================================================

window._orgCnpjs = [
  { id:1, cnpj:'81.243.735/0001-48', razao:'Positivo Tecnologia S.A.', ie:'9029-6',     uf:'PR', tipo:'Matriz', status:'ativo'   },
  { id:2, cnpj:'81.243.735/0002-29', razao:'Positivo Tecnologia S.A.', ie:'9029-6/002', uf:'SP', tipo:'Filial', status:'ativo'   },
  { id:3, cnpj:'81.243.735/0003-00', razao:'Positivo Tecnologia S.A.', ie:'9029-6/003', uf:'MG', tipo:'Filial', status:'ativo'   },
  { id:4, cnpj:'81.243.735/0004-81', razao:'Positivo Tecnologia S.A.', ie:'9029-6/004', uf:'SC', tipo:'Filial', status:'inativo' },
  { id:5, cnpj:'81.243.735/0005-62', razao:'Positivo Tecnologia S.A.', ie:'9029-6/005', uf:'RJ', tipo:'Filial', status:'ativo'   },
  { id:6, cnpj:'81.243.735/0006-43', razao:'Positivo Tecnologia S.A.', ie:'9029-6/006', uf:'RS', tipo:'Filial', status:'ativo'   },
  { id:7, cnpj:'81.243.735/0007-24', razao:'Positivo Tecnologia S.A.', ie:'9029-6/007', uf:'BA', tipo:'Filial', status:'ativo'   },
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
  tbody.innerHTML = lista.map(function(r) {
    var sCorBg = r.status === 'ativo' ? 'rgba(34,197,94,.15)' : 'rgba(100,116,139,.15)';
    var sCor   = r.status === 'ativo' ? 'var(--green)' : 'var(--txt3)';
    var sLabel = r.status === 'ativo' ? 'Ativo' : 'Inativo';
    var tipoBg = r.tipo === 'Matriz' ? 'rgba(59,130,246,.15)' : 'rgba(139,92,246,.15)';
    var tipoCor = r.tipo === 'Matriz' ? 'var(--blue)' : '#8B5CF6';
    return '<tr>'
      + '<td class="mono" style="font-size:11px">' + r.cnpj + '</td>'
      + '<td style="font-size:12px;font-weight:500;color:var(--txt1)">' + r.razao + '</td>'
      + '<td class="mono" style="font-size:11px">' + r.ie + '</td>'
      + '<td><span style="font-size:11px;font-weight:700;color:var(--txt2)">' + r.uf + '</span></td>'
      + '<td><span style="background:'+tipoBg+';color:'+tipoCor+';border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700">' + r.tipo + '</span></td>'
      + '<td><span style="background:'+sCorBg+';color:'+sCor+';border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700">' + sLabel + '</span></td>'
      + '<td style="text-align:center;white-space:nowrap">'
      + '<button onclick="window.orgAbrirModal(' + r.id + ')" style="background:none;border:1px solid var(--brd);border-radius:5px;padding:3px 10px;font-size:11px;color:var(--txt2);cursor:pointer;margin-right:6px">✏ Editar</button>'
      + '<button onclick="window.orgExcluir(' + r.id + ')" style="background:none;border:1px solid rgba(244,63,94,.4);border-radius:5px;padding:3px 10px;font-size:11px;color:var(--red);cursor:pointer">✕</button>'
      + '</td>'
      + '</tr>';
  }).join('');
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

window.orgSalvar = function() {
  var cnpj   = (document.getElementById('org-form-cnpj')||{value:''}).value.trim();
  var razao  = (document.getElementById('org-form-razao')||{value:''}).value.trim();
  var ie     = (document.getElementById('org-form-ie')||{value:''}).value.trim();
  var uf     = (document.getElementById('org-form-uf')||{value:'PR'}).value;
  var tipo   = (document.getElementById('org-form-tipo')||{value:'Filial'}).value;
  var status = (document.getElementById('org-form-status')||{value:'ativo'}).value;
  if (!cnpj || !razao) { alert('CNPJ e Razão Social são obrigatórios.'); return; }
  var id = window._orgEditId;
  if (id) {
    var idx = (window._orgCnpjs||[]).findIndex(function(x){return x.id===id;});
    if (idx > -1) window._orgCnpjs[idx] = {id:id, cnpj:cnpj, razao:razao, ie:ie, uf:uf, tipo:tipo, status:status};
  } else {
    window._orgCnpjs.push({id:window._orgNextId++, cnpj:cnpj, razao:razao, ie:ie, uf:uf, tipo:tipo, status:status});
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
  var badStatuses = ['nao_apropriado', 'inconsistencia', 'vencido'];
  var total = 0, bad = 0, badVal = 0;
  (window.nfListaFiltradaGlobal || []).forEach(function(nf) {
    if (nf.tipo !== 'entrada') return;
    (nf.registrosFiscais || []).forEach(function(rf) {
      if (!(rf.data || '').startsWith(prefix)) return;
      var v = rf.valor || 0;
      total += v;
      if (badStatuses.indexOf(rf.status) !== -1) { bad += v; badVal += v; }
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
  // Navegar para view-creditos
  var btn = document.querySelector('.nav-btn[onclick*="creditos"]');
  if (typeof showView === 'function') showView('creditos', btn);

  // Aplicar filtro multi-status
  if (!window._filtrosCreditos) window._filtrosCreditos = {};
  window._filtrosCreditos.status = '';
  window._filtrosCreditos.statusMulti = ['nao_apropriado', 'inconsistencia', 'vencido'];

  // Exibir chip de filtro ativo
  var chip = document.getElementById('creditos-filtro-chip');
  var lbl  = document.getElementById('creditos-filtro-label');
  if (lbl)  lbl.textContent = 'Não apropriado · Inconsistência · Vencido';
  if (chip) chip.style.display = 'flex';

  // Renderizar tabela com filtro aplicado
  if (window.renderizarTabelaCreditos) window.renderizarTabelaCreditos();
};

window.dashIrParaPagamentosRisco = function() {
  // Navegar para view-pagamentos
  var btn = document.querySelector('.nav-btn[onclick*="pagamentos"]');
  if (typeof showView === 'function') showView('pagamentos', btn);

  // Garantir que a aba pag-imp (guias de impostos) esteja ativa
  document.querySelectorAll('#view-pagamentos .sv').forEach(function(sv) { sv.classList.remove('active'); });
  var svImp = document.getElementById('pag-imp');
  if (svImp) svImp.classList.add('active');
  document.querySelectorAll('#view-pagamentos .stab').forEach(function(b) { b.classList.remove('active'); });
  var stabImp = document.querySelector('#view-pagamentos .stab[onclick*="\'imp\'"]');
  if (stabImp) stabImp.classList.add('active');

  // Aplicar filtro status pendente (a vencer)
  if (!window._filtrosPagamentos) window._filtrosPagamentos = {};
  window._filtrosPagamentos.status = 'pendente';

  // Renderizar tabela filtrada
  if (window.renderizarTabelaPagamentos) window.renderizarTabelaPagamentos();
  if (window.atualizarKPIsPagamentos) window.atualizarKPIsPagamentos();
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
    ? 'display:inline-block;border-radius:4px;padding:2px 10px;font-size:11px;font-weight:700;letter-spacing:.04em;margin-bottom:8px;background:rgba(59,130,246,.15);color:#3B82F6;border:1px solid rgba(59,130,246,.3)'
    : 'display:inline-block;border-radius:4px;padding:2px 10px;font-size:11px;font-weight:700;letter-spacing:.04em;margin-bottom:8px;background:rgba(245,158,11,.15);color:#F59E0B;border:1px solid rgba(245,158,11,.3)';

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
    '<div class="footer">Gerado pelo SplitHub &nbsp;&middot;&nbsp; Positivo Tecnologia &nbsp;&middot;&nbsp; IBS/CBS — LC 214/2025 &nbsp;&middot;&nbsp; Documento sem validade fiscal sem autenticação da Receita Federal.</div>' +
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
    { nome: 'Randon S.A.', cnpj: '17.197.585/0001-21' },
    { nome: 'WEG S.A.', cnpj: '84.429.695/0001-11' },
    { nome: 'Marcopolo S.A.', cnpj: '88.611.835/0001-29' },
    { nome: 'Braskem S.A.', cnpj: '42.150.391/0001-70' },
    { nome: 'Embraer S.A.', cnpj: '07.689.002/0001-89' },
    { nome: 'Gerdau S.A.', cnpj: '33.611.500/0001-19' },
    { nome: 'Suzano S.A.', cnpj: '16.404.287/0001-55' },
    { nome: 'Localiza S.A.', cnpj: '16.670.085/0001-55' },
    { nome: 'Ambev S.A.', cnpj: '07.526.557/0001-00' },
    { nome: 'BRF S.A.', cnpj: '01.838.723/0001-27' },
    { nome: 'Ultrapar S.A.', cnpj: '33.256.439/0001-39' },
    { nome: 'CVC Corp S.A.', cnpj: '01.972.984/0001-03' },
    { nome: 'Rumo S.A.', cnpj: '02.387.241/0001-60' },
    { nome: 'JSL S.A.', cnpj: '52.548.435/0001-79' },
    { nome: 'Votorantim S.A.', cnpj: '73.406.527/0001-74' }
  ];

  var _tipos = ['NF-e Entrada', 'NF-e Entrada', 'NF-e Entrada', 'NF-e Saída', 'NF-e Saída', 'NFC-e', 'NFCom', 'NF3-e', 'NFS-e', 'CT-e', 'CT-e', 'NFAg', 'NFGás', 'MDF-e', 'BP-e'];
  var _cfops = ['1101', '1102', '1201', '1401', '2101', '5101', '5102', '5201', '6101', '7101'];
  var _statusDist = [
    'integrado','integrado','integrado','integrado','integrado','integrado','integrado','integrado','integrado',
    'pendente','pendente',
    'erro_layout','erro_layout',
    'erro_dados','erro_dados',
    'rejeitado',
    'duplicado'
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
    var cert = { tipo: 'Validade do certificado', ok: true, mensagem: 'Certificado válido até 12/2027' };
    var cnpjV = { tipo: 'CNPJ emitente (Receita Federal)', ok: true, mensagem: 'CNPJ ativo e regular' };
    var cfopV = { tipo: 'CFOP compatível com operação', ok: true, mensagem: 'CFOP válido para o tipo de operação' };
    var aliq = { tipo: 'Alíquotas IBS/CBS (LC 214/2025)', ok: true, mensagem: 'Alíquotas dentro do intervalo regulatório' };
    var dup = { tipo: 'Chave de acesso (unicidade)', ok: true, mensagem: 'Chave de acesso única no banco' };

    if (status === 'integrado') {
      return [schemaNFe, campos, cert, cnpjV, cfopV, aliq, dup];
    }
    if (status === 'pendente') {
      return [
        schemaNFe,
        campos,
        cert,
        { tipo: 'CNPJ emitente (Receita Federal)', ok: null, mensagem: 'Aguardando consulta à RF' },
        { tipo: 'CFOP compatível com operação', ok: null, mensagem: 'Aguardando validação de dados' },
        { tipo: 'Alíquotas IBS/CBS (LC 214/2025)', ok: null, mensagem: 'Em processamento' },
        dup
      ];
    }
    if (status === 'erro_layout') {
      var erros = [
        { tipo: 'Schema XML NF-e 4.0', ok: false, mensagem: 'Elemento <infNFe> malformado na linha 47' },
        { tipo: 'Schema XML NF-e 4.0', ok: false, mensagem: 'Namespace inválido: esperado NF-e 4.00, recebido 3.10' },
        { tipo: 'Campos obrigatórios', ok: false, mensagem: 'Campo <CNPJ> ausente em <emit>' },
        { tipo: 'Schema XML NF-e 4.0', ok: false, mensagem: 'Atributo versão fora do padrão SEFAZ' }
      ];
      var e = erros[Math.floor(rnd() * erros.length)];
      return [e, campos, cert, cnpjV, cfopV, aliq, dup];
    }
    if (status === 'erro_dados') {
      var errosDados = [
        { tipo: 'CNPJ emitente (Receita Federal)', ok: false, mensagem: 'CNPJ 00.000.000/0001-00 não localizado na RF' },
        { tipo: 'CFOP compatível com operação', ok: false, mensagem: 'CFOP 5101 incompatível com NF-e de entrada' },
        { tipo: 'Alíquotas IBS/CBS (LC 214/2025)', ok: false, mensagem: 'Alíquota CBS 8.5% fora do intervalo (0%–7.9%)' }
      ];
      var ed = errosDados[Math.floor(rnd() * errosDados.length)];
      return [schemaNFe, campos, cert, ed, cfopV, aliq, dup];
    }
    if (status === 'rejeitado') {
      return [
        { tipo: 'Schema XML NF-e 4.0', ok: true, mensagem: 'Estrutura válida' },
        campos,
        { tipo: 'Assinatura digital (SEFAZ)', ok: false, mensagem: 'Código 228 — Rejeição: assinatura inválida do XML' },
        cnpjV,
        cfopV,
        aliq,
        dup
      ];
    }
    if (status === 'duplicado') {
      return [
        schemaNFe,
        campos,
        cert,
        cnpjV,
        cfopV,
        aliq,
        { tipo: 'Chave de acesso (unicidade)', ok: false, mensagem: 'Chave já existente — documento recebido em ' + _fmtData('2026-0' + (Math.floor(rnd()*6)+1) + '-' + String(Math.floor(rnd()*27)+1).padStart(2,'0')) }
      ];
    }
    return [schemaNFe, campos, cert, cnpjV, cfopV, aliq, dup];
  }

  function _derivaValidacoes(status, vals) {
    var layout = null, validade = null, dados = null;
    vals.forEach(function(v) {
      if (v.tipo.indexOf('Schema') !== -1 || v.tipo.indexOf('Campos') !== -1 || v.tipo.indexOf('estrutura') !== -1 || v.tipo.indexOf('Assinatura') !== -1) {
        if (layout === null) layout = v.ok;
        else if (v.ok === false) layout = false;
      } else if (v.tipo.indexOf('certif') !== -1 || v.tipo.indexOf('Validade') !== -1) {
        if (validade === null) validade = v.ok;
        else if (v.ok === false) validade = false;
      } else if (v.tipo.indexOf('CNPJ') !== -1 || v.tipo.indexOf('CFOP') !== -1 || v.tipo.indexOf('Alíquota') !== -1 || v.tipo.indexOf('unicidade') !== -1) {
        if (dados === null) dados = v.ok;
        else if (v.ok === false) dados = false;
      }
    });
    if (status === 'pendente') { validade = null; dados = null; }
    return { valLayout: layout, valValidade: validade, valDados: dados };
  }

  function _gerarDados() {
    var dados = [];
    var r = _rng(20260101);
    var datas = [
      '2026-01-15','2026-01-22','2026-01-29',
      '2026-02-05','2026-02-12','2026-02-19','2026-02-26',
      '2026-03-04','2026-03-11','2026-03-18','2026-03-25',
      '2026-04-02','2026-04-09','2026-04-16','2026-04-23',
      '2026-05-07','2026-05-14','2026-05-21','2026-05-28',
      '2026-06-04','2026-06-11','2026-06-18','2026-06-25',
      '2026-07-02','2026-07-09','2026-07-16','2026-07-23',
      '2026-08-01','2026-08-04'
    ];

    for (var i = 0; i < 152; i++) {
      var emit = _emitentes[Math.floor(r() * _emitentes.length)];
      var tipo = _tipos[Math.floor(r() * _tipos.length)];
      var status = _statusDist[Math.floor(r() * _statusDist.length)];
      var cfop = _cfops[Math.floor(r() * _cfops.length)];
      var valor = Math.round((r() * 980000 + 2000) * 100) / 100;
      var dEmissao = datas[Math.floor(r() * datas.length)];
      var partsE = dEmissao.split('-');
      var dIngDay = Math.min(parseInt(partsE[2]) + Math.floor(r() * 3), 28);
      var dIngH = String(Math.floor(r() * 24)).padStart(2,'0');
      var dIngM = String(Math.floor(r() * 60)).padStart(2,'0');
      var dIngestao = partsE[2].padStart(2,'0') + '/' + partsE[1] + '/' + partsE[0] + ' ' + dIngH + ':' + dIngM;
      var chave = _chave(r, emit, i, tipo);
      var validacoes = _validacoesParaStatus(status, r);
      var vDeriv = _derivaValidacoes(status, validacoes);

      dados.push({
        id: i,
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
      });
    }
    return dados;
  }

  function _valChip(v) {
    if (v === true) return '<span style="color:var(--green);font-weight:700;font-size:15px">✓</span>';
    if (v === false) return '<span style="color:var(--red);font-weight:700;font-size:15px">✗</span>';
    return '<span style="color:var(--amber);font-size:13px">⏳</span>';
  }

  function _statusLabel(s) {
    var m = {
      integrado: { lbl: 'Integrado', bg: 'rgba(34,197,94,.12)', col: 'var(--green)', bdr: 'rgba(34,197,94,.25)' },
      pendente: { lbl: 'Processando', bg: 'rgba(245,158,11,.12)', col: 'var(--amber)', bdr: 'rgba(245,158,11,.25)' },
      erro_layout: { lbl: 'Erro Layout', bg: 'rgba(244,63,94,.12)', col: 'var(--red)', bdr: 'rgba(244,63,94,.25)' },
      erro_dados: { lbl: 'Erro Dados', bg: 'rgba(244,63,94,.12)', col: 'var(--red)', bdr: 'rgba(244,63,94,.25)' },
      rejeitado: { lbl: 'Rejeitado', bg: 'rgba(244,63,94,.12)', col: 'var(--red)', bdr: 'rgba(244,63,94,.25)' },
      duplicado: { lbl: 'Duplicado', bg: 'rgba(167,168,170,.12)', col: 'var(--txt3)', bdr: 'rgba(167,168,170,.25)' }
    };
    var c = m[s] || { lbl: s, bg: 'rgba(167,168,170,.12)', col: 'var(--txt2)', bdr: 'rgba(167,168,170,.25)' };
    return '<span style="display:inline-block;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;background:' + c.bg + ';color:' + c.col + ';border:1px solid ' + c.bdr + '">' + c.lbl + '</span>';
  }

  function _tipoLabel(tipo) {
    var m = {
      'NF-e Entrada': 'rgba(59,130,246,.12)',
      'NF-e Saída': 'rgba(73,197,177,.12)',
      'NFS-e': 'rgba(245,158,11,.12)',
      'CT-e': 'rgba(167,168,170,.12)'
    };
    var col = m[tipo] || 'rgba(167,168,170,.12)';
    return '<span style="display:inline-block;border-radius:3px;padding:1px 7px;font-size:11px;font-weight:600;background:' + col + ';color:var(--txt2)">' + tipo + '</span>';
  }

  function _renderKPIs(dados) {
    var total = dados.length;
    var ok = dados.filter(function(d) { return d.status === 'integrado'; }).length;
    var pend = dados.filter(function(d) { return d.status === 'pendente'; }).length;
    var erroLay = dados.filter(function(d) { return d.status === 'erro_layout'; }).length;
    var erroDat = dados.filter(function(d) { return d.status === 'erro_dados'; }).length;
    var rej = dados.filter(function(d) { return d.status === 'rejeitado'; }).length;
    var dup = dados.filter(function(d) { return d.status === 'duplicado'; }).length;
    var erroTotal = erroLay + erroDat + rej;
    var taxa = total > 0 ? Math.round((ok / total) * 100) : 0;

    function _el(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

    _el('ing-total', total);
    _el('ing-ok', ok);
    _el('ing-pend', pend);
    _el('ing-erro', erroTotal);
    _el('ing-dup', dup);
    _el('ing-taxa', taxa + '%');

    _el('pipe-ing-receb', total);
    _el('pipe-ing-triagem', total - rej);
    _el('pipe-ing-layout', total - rej - erroLay);
    _el('pipe-ing-dados', total - rej - erroLay - erroDat - dup);
    _el('pipe-ing-integ', ok);
    _el('pipe-ing-err-lay', erroLay);
    _el('pipe-ing-err-dat', erroDat);
    _el('pipe-ing-err-dup', dup);
    _el('pipe-ing-err-rej', rej);
  }

  function _renderChart(dados) {
    var el = document.getElementById('cIngestao');
    if (!el) return;

    var byDay = {};
    dados.forEach(function(d) {
      var k = d.dataEmissao;
      if (!byDay[k]) byDay[k] = { rec: 0, ok: 0, err: 0 };
      byDay[k].rec++;
      if (d.status === 'integrado') byDay[k].ok++;
      else if (d.status !== 'pendente') byDay[k].err++;
    });

    var keys = Object.keys(byDay).sort().slice(-7);
    var recArr = [], okArr = [], errArr = [];
    var labels = [];
    keys.forEach(function(k) {
      var p = k.split('-');
      labels.push(p[2] + '/' + p[1]);
      recArr.push(byDay[k].rec);
      okArr.push(byDay[k].ok);
      errArr.push(byDay[k].err);
    });

    if (typeof _svgStackedBar === 'function') {
      _svgStackedBar('cIngestao', [
        { label: 'Recebidos', data: recArr, color: '#3B82F6' },
        { label: 'Integrados', data: okArr, color: '#22C55E' },
        { label: 'Com erro', data: errArr, color: '#F43F5E' }
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

    var html = '';
    slice.forEach(function(d) {
      var chaveShort = d.chave.substring(0, 8) + '…' + d.chave.slice(-8);
      html += '<tr>' +
        '<td class="mono" style="font-size:11px;color:var(--txt2)">' + chaveShort + '</td>' +
        '<td>' + _tipoLabel(d.tipo) + '</td>' +
        '<td style="font-size:12px;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + d.emitente + '</td>' +
        '<td class="r mono" style="font-size:12px">' + _fmtBRL(d.valor) + '</td>' +
        '<td style="font-size:12px">' + _fmtData(d.dataEmissao) + '</td>' +
        '<td style="font-size:11px;color:var(--txt2)">' + d.dataIngestao + '</td>' +
        '<td style="text-align:center">' + _valChip(d.valLayout) + '</td>' +
        '<td style="text-align:center">' + _valChip(d.valValidade) + '</td>' +
        '<td style="text-align:center">' + _valChip(d.valDados) + '</td>' +
        '<td>' + _statusLabel(d.status) + '</td>' +
        '<td><button class="btn" style="font-size:11px;padding:4px 10px;border-radius:6px" onclick="abrirIngModal(' + d.id + ')">Detalhar</button></td>' +
        '</tr>';
    });

    if (!html) {
      html = '<tr><td colspan="11" style="text-align:center;color:var(--txt3);padding:40px">Nenhum documento encontrado para os filtros selecionados.</td></tr>';
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

  function _aplicarFiltros() {
    var busca = (document.getElementById('ing-busca') || {}).value || '';
    var filtTipo = (document.getElementById('ing-filtro-tipo') || {}).value || '';
    var filtStatus = (document.getElementById('ing-filtro-status') || {}).value || '';
    var filtVal = (document.getElementById('ing-filtro-val') || {}).value || '';

    busca = busca.toLowerCase();

    _ingFiltrados = _ingDados.filter(function(d) {
      if (busca && d.chave.toLowerCase().indexOf(busca) === -1 &&
          d.emitente.toLowerCase().indexOf(busca) === -1 &&
          d.cnpj.toLowerCase().indexOf(busca) === -1) return false;
      if (filtTipo && d.tipo !== filtTipo) return false;
      if (filtStatus && d.status !== filtStatus) return false;
      if (filtVal === 'ok' && (d.valLayout === false || d.valValidade === false || d.valDados === false)) return false;
      if (filtVal === 'erro' && d.valLayout !== false && d.valValidade !== false && d.valDados !== false) return false;
      return true;
    });
  }

  window.ingestaoInit = function() {
    if (!_ingIniciado) {
      _ingDados = _gerarDados();
      _ingIniciado = true;
    }
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
    var el;
    el = document.getElementById('ing-busca'); if (el) el.value = '';
    el = document.getElementById('ing-filtro-tipo'); if (el) el.value = '';
    el = document.getElementById('ing-filtro-status'); if (el) el.value = '';
    el = document.getElementById('ing-filtro-val'); if (el) el.value = '';
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

    var badge = document.getElementById('ing-modal-tipo-badge');
    if (badge) badge.textContent = d.tipo;

    var chaveEl = document.getElementById('ing-modal-chave');
    if (chaveEl) chaveEl.textContent = d.chave.substring(0,14) + '…';

    function _set(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
    _set('ing-modal-emit', d.emitente);
    _set('ing-modal-cnpj', d.cnpj);
    _set('ing-modal-emissao', _fmtData(d.dataEmissao));
    _set('ing-modal-ingestao', d.dataIngestao);
    _set('ing-modal-valor', _fmtBRL(d.valor));
    _set('ing-modal-cfop', d.cfop);
    _set('ing-modal-chave-full', d.chave);

    var statusBar = document.getElementById('ing-modal-status-bar');
    if (statusBar) {
      var sConf = {
        integrado: { icon: '✓', txt: 'Documento integrado com sucesso — todos os critérios de validação aprovados.', bg: 'rgba(34,197,94,.12)', col: 'var(--green)' },
        pendente: { icon: '⏳', txt: 'Documento em processamento — validações ainda em andamento.', bg: 'rgba(245,158,11,.12)', col: 'var(--amber)' },
        erro_layout: { icon: '✗', txt: 'Falha de layout — estrutura XML inválida, documento rejeitado na triagem.', bg: 'rgba(244,63,94,.12)', col: 'var(--red)' },
        erro_dados: { icon: '✗', txt: 'Falha de dados — inconsistência nos dados fiscais do documento.', bg: 'rgba(244,63,94,.12)', col: 'var(--red)' },
        rejeitado: { icon: '✗', txt: 'Rejeitado pela SEFAZ — assinatura ou autorização inválida.', bg: 'rgba(244,63,94,.12)', col: 'var(--red)' },
        duplicado: { icon: '⚠', txt: 'Documento duplicado — chave de acesso já existente na base.', bg: 'rgba(167,168,170,.12)', col: 'var(--txt2)' }
      };
      var sc = sConf[d.status] || sConf.pendente;
      statusBar.style.background = sc.bg;
      statusBar.style.color = sc.col;
      statusBar.innerHTML = '<span style="font-size:18px">' + sc.icon + '</span><span>' + sc.txt + '</span>';
    }

    var valDiv = document.getElementById('ing-modal-validacoes');
    if (valDiv) {
      var vhtml = '';
      d.validacoes.forEach(function(v) {
        var ico = v.ok === true ? '✓' : (v.ok === false ? '✗' : '⏳');
        var col = v.ok === true ? 'var(--green)' : (v.ok === false ? 'var(--red)' : 'var(--amber)');
        var bg = v.ok === true ? 'rgba(34,197,94,.06)' : (v.ok === false ? 'rgba(244,63,94,.06)' : 'rgba(245,158,11,.06)');
        vhtml += '<div style="display:flex;align-items:flex-start;gap:12px;padding:10px 14px;border-radius:7px;border:1px solid var(--border);background:' + bg + '">' +
          '<span style="color:' + col + ';font-weight:700;font-size:16px;line-height:1.2;flex-shrink:0">' + ico + '</span>' +
          '<div><div style="font-size:12px;font-weight:600;color:var(--txt1);margin-bottom:2px">' + v.tipo + '</div>' +
          '<div style="font-size:11px;color:var(--txt2)">' + v.mensagem + '</div></div>' +
          '</div>';
      });
      valDiv.innerHTML = vhtml;
    }

    var modal = document.getElementById('ing-modal');
    if (modal) { modal.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
  };

  window.fecharIngModal = function() {
    var modal = document.getElementById('ing-modal');
    if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; }
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
    _ingFiltrados = _ingDados.slice();
    _ingPagina = 1;
    _renderKPIs(_ingDados);
    _renderTabela();
  };
})();

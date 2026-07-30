// ──────────────────────────────────────────────────────────
// SPLITHUB CHARTS & DATA INITIALIZATION
// ──────────────────────────────────────────────────────────

let chartInstances = {};

document.addEventListener('DOMContentLoaded', function() {
  populateSampleTables();
  initializeCharts();
  console.log('✓ Charts and data populated');
});

// ─── POPULATE TABLES WITH SAMPLE DATA ───
function populateSampleTables() {
  // Recent transactions
  const recentTable = document.getElementById('t-recent');
  if (recentTable) {
    const data = [
      { id: 'RF-001234', fornecedor: 'Vale S.A.', tipo: 'Guia IBS', valor: 'R$ 512.000', vencimento: '24/04/2026', status: 'Vencendo' },
      { id: 'RF-001233', fornecedor: 'Randon S.A.', tipo: 'DARF CBS', valor: 'R$ 168.000', vencimento: '22/04/2026', status: 'Atrasado' },
      { id: 'RF-001232', fornecedor: 'Bosch Ltda', tipo: 'Guia IBS', valor: 'R$ 340.000', vencimento: '26/04/2026', status: 'Pendente' },
      { id: 'RF-001231', fornecedor: 'Marcopolo S.A.', tipo: 'DARF CBS', valor: 'R$ 245.000', vencimento: '27/04/2026', status: 'Pendente' },
      { id: 'RF-001230', fornecedor: 'WEG Equipamentos', tipo: 'Guia IBS', valor: 'R$ 189.000', vencimento: '28/04/2026', status: 'Pendente' }
    ];

    recentTable.innerHTML = data.map(row => `
      <tr>
        <td class="mono">${row.id}</td>
        <td>${row.fornecedor}</td>
        <td>${row.tipo}</td>
        <td class="r">${row.valor}</td>
        <td>${row.vencimento}</td>
        <td><span style="font-size:10px;padding:2px 6px;background:rgba(245,158,11,.2);color:var(--amber);border-radius:4px">${row.status}</span></td>
      </tr>
    `).join('');
  }

  // Impostos table
  const impostosTable = document.getElementById('t-impostos');
  if (impostosTable) {
    const data = [
      { id: 'G-0048', rf: 'RF-001234', fornecedor: 'Vale S.A.', tipo: 'Guia IBS', valor: 'R$ 512.000', vencimento: '24/04/2026', status: 'Vencendo', acao: 'Pagar' },
      { id: 'D-0047', rf: 'RF-001233', fornecedor: 'Randon S.A.', tipo: 'DARF CBS', valor: 'R$ 168.000', vencimento: '22/04/2026', status: 'Atrasado', acao: 'Pagar' },
      { id: 'G-0046', rf: 'RF-001232', fornecedor: 'Bosch Ltda', tipo: 'Guia IBS', valor: 'R$ 340.000', vencimento: '26/04/2026', status: 'Pendente', acao: 'Agendar' }
    ];

    impostosTable.innerHTML = data.map(row => `
      <tr>
        <td class="mono">${row.id}</td>
        <td class="mono">${row.rf}</td>
        <td>${row.fornecedor}</td>
        <td>${row.tipo}</td>
        <td class="r">${row.valor}</td>
        <td>${row.vencimento}</td>
        <td><span style="font-size:10px;padding:2px 6px;background:rgba(245,158,11,.2);color:var(--amber);border-radius:4px">${row.status}</span></td>
        <td><button class="btn" style="padding:4px 8px;font-size:11px">${row.acao} →</button></td>
      </tr>
    `).join('');
  }

  // Fornecedores table
  const fornTable = document.getElementById('t-forn');
  if (fornTable) {
    const data = [
      { fornecedor: 'Vale S.A.', cnpj: '33.592.510/0001-62', compras: 'R$ 3,2M', creditos: 'R$ 612K', pagtos: '15', pendentes: '1', score: '88', status: '✓' },
      { fornecedor: 'Randon S.A.', cnpj: '17.197.585/0001-21', compras: 'R$ 2,4M', creditos: 'R$ 456K', pagtos: '12', pendentes: '2', score: '82', status: '✓' },
      { fornecedor: 'Marcopolo S.A.', cnpj: '17.197.757/0001-00', compras: 'R$ 1,8M', creditos: 'R$ 340K', pagtos: '8', pendentes: '0', score: '78', status: '✓' },
      { fornecedor: 'Bosch Ltda', cnpj: '17.235.322/0001-97', compras: 'R$ 1,5M', creditos: 'R$ 285K', pagtos: '9', pendentes: '1', score: '74', status: '⚠' },
      { fornecedor: 'WEG Equipamentos', cnpj: '33.514.814/0001-19', compras: 'R$ 890K', creditos: 'R$ 169K', pagtos: '3', pendentes: '0', score: '65', status: '⚠' }
    ];

    fornTable.innerHTML = data.map(row => `
      <tr>
        <td>${row.fornecedor}</td>
        <td class="mono">${row.cnpj}</td>
        <td class="r">${row.compras}</td>
        <td class="r">${row.creditos}</td>
        <td>${row.pagtos}</td>
        <td>${row.pendentes}</td>
        <td>${row.score}</td>
        <td>${row.status}</td>
      </tr>
    `).join('');
  }

  // Créditos table
  const creditosTable = document.getElementById('t-creditos');
  if (creditosTable) {
    const data = [
      { rf: 'RF-001234', nf: '000001001', fornecedor: 'Vale S.A.', datanf: '15/04/2026', valornf: 'R$ 512.000', credito: 'R$ 51.200', cbs: 'R$ 25.600', ibs: 'R$ 25.600', pagto: 'Pix', status: 'Apropriado', contrato: 'CT-0048' },
      { rf: 'RF-001233', nf: '000001002', fornecedor: 'Randon S.A.', datanf: '16/04/2026', valornf: 'R$ 340.000', credito: 'R$ 34.000', cbs: 'R$ 17.000', ibs: 'R$ 17.000', pagto: 'TED', status: 'Apropriado', contrato: 'CT-0047' },
      { rf: 'RF-001232', nf: '000001003', fornecedor: 'Bosch Ltda', datanf: '17/04/2026', valornf: 'R$ 245.000', credito: 'R$ 24.500', cbs: 'R$ 12.250', ibs: 'R$ 12.250', pagto: 'Pix', status: 'Apropriado', contrato: 'CT-0046' }
    ];

    creditosTable.innerHTML = data.map(row => `
      <tr>
        <td class="mono">${row.rf}</td>
        <td class="mono">${row.nf}</td>
        <td>${row.fornecedor}</td>
        <td>${row.datanf}</td>
        <td class="r">${row.valornf}</td>
        <td class="r">${row.credito}</td>
        <td class="r">${row.cbs}</td>
        <td class="r">${row.ibs}</td>
        <td>${row.pagto}</td>
        <td><span style="font-size:10px;padding:2px 6px;background:rgba(34,197,94,.2);color:var(--green);border-radius:4px">${row.status}</span></td>
        <td class="mono">${row.contrato}</td>
      </tr>
    `).join('');
  }

  // FCT Daily flow table
  const fctTable = document.getElementById('fct-t-body');
  if (fctTable) {
    const data = [
      { data: '01/06/2026', saldoini: 'R$ 4,2M', credconf: 'R$ 1,2M', credcond: 'R$ 580K', apropr: 'R$ 340K', debitbruto: 'R$ 2,8M', recolhliq: 'R$ 1,6M', saldofim: 'R$ 3,9M', status: 'Realizado' },
      { data: '02/06/2026', saldoini: 'R$ 3,9M', credconf: 'R$ 1,1M', credcond: 'R$ 620K', apropr: 'R$ 280K', debitbruto: 'R$ 2,4M', recolhliq: 'R$ 1,3M', saldofim: 'R$ 3,8M', status: 'Projetado' }
    ];

    fctTable.innerHTML = data.map(row => `
      <tr>
        <td>${row.data}</td>
        <td class="r">${row.saldoini}</td>
        <td class="r">${row.credconf}</td>
        <td class="r">${row.credcond}</td>
        <td class="r">${row.apropr}</td>
        <td class="r">${row.debitbruto}</td>
        <td class="r">${row.recolhliq}</td>
        <td class="r">${row.saldofim}</td>
        <td><span style="font-size:10px;padding:2px 6px;background:rgba(73,197,177,.2);color:var(--teal);border-radius:4px">${row.status}</span></td>
      </tr>
    `).join('');
  }

  // FCT Risk list
  const fctRiskList = document.getElementById('fct-risk-list');
  if (fctRiskList) {
    const risks = [
      { fornecedor: 'Randon S.A.', credito: 'R$ 1,82M', dias: '8 dias', color: 'var(--red)' },
      { fornecedor: 'Marcopolo S.A.', credito: 'R$ 1,24M', dias: '12 dias', color: 'var(--amber)' },
      { fornecedor: 'Bosch Ltda', credito: 'R$ 890K', dias: '25 dias', color: 'var(--teal)' }
    ];

    fctRiskList.innerHTML = risks.map(item => `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border)">
        <div style="width:8px;height:8px;border-radius:50%;background:${item.color};flex-shrink:0"></div>
        <div style="flex:1">
          <div style="font-size:12px;color:var(--txt1);font-weight:600">${item.fornecedor}</div>
          <div style="font-size:11px;color:var(--txt3)">${item.credito}</div>
        </div>
        <div style="font-size:11px;color:var(--txt3);text-align:right">Liberação<br>${item.dias}</div>
      </div>
    `).join('');
  }

  // FCT Alerts
  const fctAlertas = document.getElementById('fct-alertas');
  if (fctAlertas) {
    const alerts = [
      { data: '20/06/2026', saldo: 'R$ 1,2M', info: 'Saldo abaixo do piso. Crédito condicionado da Randon vence em 48h' },
      { data: '26/06/2026', saldo: 'R$ 980K', info: 'Recolhimento de R$ 2,8M com saldo projetado de R$ 980K. Déficit: R$ 1,8M' }
    ];

    fctAlertas.innerHTML = alerts.map(alert => `
      <div class="arow" style="border-left-color:var(--red)">
        <span class="asev" style="background:rgba(244,63,94,.12);color:var(--red)">ALERTA</span>
        <div>
          <div class="amsg">${alert.info}</div>
          <div class="atim">${alert.data}</div>
        </div>
      </div>
    `).join('');
  }
}

// ─── INITIALIZE CHARTS ───
function initializeCharts() {
  // Check if Chart.js is loaded
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded. Skipping chart initialization.');
    return;
  }

  // Chart 1: Evolução de Créditos
  const credContainer = document.getElementById('cCreditos');
  if (credContainer) {
    try {
      const canvas = document.createElement('canvas');
      credContainer.appendChild(canvas);

      new Chart(canvas, {
        type: 'line',
        data: {
          labels: ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
          datasets: [
            {
              label: 'Apropriados',
              data: [48, 50, 52.3, 51, 52.8, 54, 55.2],
              borderColor: '#49C5B1',
              backgroundColor: 'rgba(73, 197, 177, 0.1)',
              tension: 0.4
            },
            {
              label: 'A Apropriar',
              data: [12, 11, 10.9, 11.5, 10.2, 11.8, 12.5],
              borderColor: '#F59E0B',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              tension: 0.4
            },
            {
              label: 'Em risco',
              data: [3.2, 2.8, 2.4, 3.1, 2.6, 2.9, 3.3],
              borderColor: '#F43F5E',
              backgroundColor: 'rgba(244, 63, 94, 0.1)',
              tension: 0.4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } }
        }
      });
    } catch (e) {
      console.error('Error creating créditos chart:', e);
    }
  }

  // Chart 2: Pagamentos
  const pagContainer = document.getElementById('cPagamentos');
  if (pagContainer) {
    try {
      const canvas = document.createElement('canvas');
      pagContainer.appendChild(canvas);

      new Chart(canvas, {
        type: 'bar',
        data: {
          labels: ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
          datasets: [
            {
              label: 'DARF CBS',
              data: [3.2, 3.8, 4.1, 3.5, 4.2, 3.9, 4.5],
              backgroundColor: '#3B82F6'
            },
            {
              label: 'Guia IBS',
              data: [2.1, 2.4, 2.7, 2.3, 2.8, 2.5, 3.1],
              backgroundColor: '#49C5B1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { stacked: true }, y: { stacked: true } }
        }
      });
    } catch (e) {
      console.error('Error creating pagamentos chart:', e);
    }
  }

  // Chart 3: Composição
  const compContainer = document.getElementById('cComposicao');
  if (compContainer) {
    try {
      const canvas = document.createElement('canvas');
      compContainer.appendChild(canvas);

      new Chart(canvas, {
        type: 'area',
        data: {
          labels: ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
          datasets: [
            {
              label: 'Apropriados',
              data: [48, 50, 52.3, 51, 52.8, 54, 55.2],
              borderColor: '#22C55E',
              backgroundColor: 'rgba(34, 197, 94, 0.2)',
              tension: 0.4
            },
            {
              label: 'Aguardando',
              data: [8, 9, 10.9, 11, 10, 11.5, 12],
              borderColor: '#3B82F6',
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              tension: 0.4
            },
            {
              label: 'Em risco',
              data: [3, 2.8, 2.4, 3, 2.5, 2.8, 3],
              borderColor: '#F43F5E',
              backgroundColor: 'rgba(244, 63, 94, 0.2)',
              tension: 0.4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } }
        }
      });
    } catch (e) {
      console.error('Error creating composição chart:', e);
    }
  }

  // Chart 4: FCT (Fluxo de Caixa Tributário)
  const fctContainer = document.getElementById('cFCT');
  if (fctContainer) {
    try {
      const canvas = document.createElement('canvas');
      fctContainer.appendChild(canvas);

      new Chart(canvas, {
        type: 'bar',
        data: {
          labels: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'],
          datasets: [
            {
              label: 'Crédito apropriado',
              data: [1.2, 0.8, 1.5, 0.6, 1.3, 0.9, 1.1, 0.7, 1.4, 0.8],
              backgroundColor: '#49C5B1'
            },
            {
              label: 'Crédito condicionado',
              data: [0.6, 0.4, 0.8, 0.3, 0.7, 0.5, 0.6, 0.4, 0.7, 0.5],
              backgroundColor: '#F59E0B'
            },
            {
              label: 'Recolhimento líquido',
              data: [-1.8, -1.2, -2.3, -0.9, -2.0, -1.4, -1.7, -1.1, -2.1, -1.3],
              backgroundColor: '#F43F5E'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { stacked: true }, y: { stacked: true } }
        }
      });
    } catch (e) {
      console.error('Error creating FCT chart:', e);
    }
  }
}

console.log('✓ Charts module loaded');

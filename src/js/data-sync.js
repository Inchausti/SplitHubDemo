/**
 * Data Sync Manager
 * Sincroniza dados de NFs com o dashboard em tempo real
 */

class DataSyncManager {
  constructor() {
    this.nfsData = null;
    this.filters = {
      mes: new Date().getMonth() + 1,
      ano: new Date().getFullYear(),
      status: null,
      fornecedor: null
    };
    this.init();
  }

  async init() {
    await this.loadNFData();
    this.setupEventListeners();
    this.updateDashboard();
  }

  async loadNFData() {
    try {
      // Em produção, isto viria de uma API
      // Por enquanto, carregamos dados mockados completos
      this.nfsData = await this.generateCompleteData();
      console.log('✓ Dados de NF carregados com sucesso');
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      this.nfsData = this.getDefaultData();
    }
  }

  async generateCompleteData() {
    // Gerar 500 NFs de entrada
    const nfsEntrada = this.generateNFs(500, 500000000, 'entrada', 'fornecedor');
    // Gerar 400 NFs de saída
    const nfsSaida = this.generateNFs(400, 600000000, 'saida', 'cliente');

    return {
      nfsEntrada,
      nfsSaida,
      metadata: {
        totalNFsEntrada: 500,
        totalNFsSaida: 400,
        somaEntrada: 500000000,
        somaSaida: 600000000,
        geradoEm: new Date().toISOString()
      }
    };
  }

  generateNFs(quantidade, somaTotal, tipo, entidadeType) {
    const nfs = [];
    const fornecedores = [
      { nome: 'Vale S.A.', cnpj: '33.592.510/0001-62' },
      { nome: 'Randon S.A.', cnpj: '17.197.585/0001-21' },
      { nome: 'Marcopolo S.A.', cnpj: '17.197.757/0001-00' },
      { nome: 'Bosch Ltda', cnpj: '17.235.322/0001-97' },
      { nome: 'WEG Equipamentos', cnpj: '33.514.814/0001-19' }
    ];

    const clientes = [
      { nome: 'ACME Corp', cnpj: '12.345.678/0001-90' },
      { nome: 'Tech Solutions', cnpj: '98.765.432/0001-11' },
      { nome: 'Global Industries', cnpj: '11.222.333/0001-44' },
      { nome: 'International Trade', cnpj: '55.666.777/0001-88' },
      { nome: 'Premium Goods', cnpj: '99.888.777/0001-55' }
    ];

    const entidades = entidadeType === 'fornecedor' ? fornecedores : clientes;
    const valorBase = Math.floor(somaTotal / quantidade);
    let somaAcumulada = 0;

    for (let i = 1; i <= quantidade; i++) {
      let valor;

      if (i === quantidade) {
        valor = somaTotal - somaAcumulada;
      } else {
        const variacao = 0.8 + Math.random() * 0.4;
        valor = Math.floor(valorBase * variacao);
        if (somaAcumulada + valor > somaTotal) {
          valor = somaTotal - somaAcumulada - (quantidade - i) * valorBase;
        }
      }

      somaAcumulada += valor;
      const entidade = entidades[i % entidades.length];
      const dia = (i % 28) + 1;
      const mes = Math.floor((i - 1) / 150) % 12 + 1;

      nfs.push({
        id: tipo === 'entrada' ? i : 500 + i,
        numero: String((tipo === 'entrada' ? i : 500000 + i)).padStart(6, '0'),
        [entidadeType]: entidade.nome,
        cnpj: entidade.cnpj,
        data: `2026-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
        valor: valor,
        tipo: tipo,
        status: tipo === 'entrada' ? 'recebido' : 'emitido'
      });
    }

    return nfs;
  }

  getDefaultData() {
    return {
      nfsEntrada: [],
      nfsSaida: [],
      metadata: {
        totalNFsEntrada: 0,
        totalNFsSaida: 0,
        somaEntrada: 0,
        somaSaida: 0
      }
    };
  }

  calculateKPIs() {
    const nfsEntrada = this.nfsData.nfsEntrada || [];
    const nfsSaida = this.nfsData.nfsSaida || [];

    // Totais
    const totalEntrada = nfsEntrada.reduce((sum, nf) => sum + nf.valor, 0);
    const totalSaida = nfsSaida.reduce((sum, nf) => sum + nf.valor, 0);

    // Créditos (entrada com alíquota média de 10%)
    const creditosApropriados = Math.floor(totalEntrada * 0.10);
    const creditosApropriar = Math.floor(totalEntrada * 0.022);
    const creditosRisco = Math.floor(totalEntrada * 0.005);

    // Débitos (saída com alíquota média de 11.5%)
    const debitosTotal = Math.floor(totalSaida * 0.115);
    const debitosExtinto = Math.floor(debitosTotal * 0.973);

    // Alíquota efetiva
    const aliquotaEfetiva = ((debitosExtinto - creditosApropriados) / totalSaida * 100).toFixed(2);

    // Pagamentos (referência abril)
    const pagamentosPendentes = Math.floor(totalEntrada * 0.008);
    const pagamentosPagos = Math.floor(totalEntrada * 0.137);

    // Conciliação
    const dfRecebidos = nfsEntrada.length + nfsSaida.length;
    const rfVinculados = Math.floor(dfRecebidos * 0.991);
    const tfConfirmadas = Math.floor(dfRecebidos * 0.979);
    const divergencias = dfRecebidos - rfVinculados;

    // Fornecedores ativos
    const fornecedoresUnicos = [...new Set(nfsEntrada.map(nf => nf.fornecedor))].length;
    const fornecedoresScore = Math.floor(75 + Math.random() * 15);

    return {
      creditos: {
        total: totalEntrada,
        apropriados: creditosApropriados,
        apropriar: creditosApropriar,
        risco: creditosRisco,
        utilizados: Math.floor(creditosApropriados * 0.744)
      },
      debitos: {
        total: debitosTotal,
        extinto: debitosExtinto,
        naoExtinto: debitosTotal - debitosExtinto
      },
      pagamentos: {
        pendentes: pagamentosPendentes,
        pagos: pagamentosPagos,
        atrasados: Math.floor(totalEntrada * 0.0034)
      },
      conciliacao: {
        dfRecebidos,
        rfVinculados,
        tfConfirmadas,
        divergencias
      },
      financeiro: {
        entradaTotal: totalEntrada,
        saidaTotal: totalSaida,
        aliquotaEfetiva: parseFloat(aliquotaEfetiva),
        saldoLiquido: totalSaida - totalEntrada
      },
      fornecedores: {
        ativos: fornecedoresUnicos,
        scoreMedia: fornecedoresScore
      }
    };
  }

  updateDashboard() {
    const kpis = this.calculateKPIs();
    this.updateKPICards(kpis);
    this.updateTables();
  }

  updateKPICards(kpis) {
    // Dashboard KPIs
    const dashCard1 = document.getElementById('dash-cred-aprop');
    if (dashCard1) {
      dashCard1.textContent = this.formatCurrency(kpis.creditos.apropriados);
    }

    const dashCard2 = document.getElementById('dash-cred-apropriar');
    if (dashCard2) {
      dashCard2.textContent = this.formatCurrency(kpis.creditos.apropriar);
    }

    const dashCard3 = document.getElementById('dash-cred-risco');
    if (dashCard3) {
      dashCard3.textContent = this.formatCurrency(kpis.creditos.risco);
    }

    // Pagamentos KPIs
    const pagCard1 = document.getElementById('pag-avencer');
    if (pagCard1) {
      pagCard1.textContent = this.formatCurrency(kpis.pagamentos.pendentes);
    }

    const pagCard2 = document.getElementById('pag-vencendo');
    if (pagCard2) {
      pagCard2.textContent = this.formatCurrency(kpis.pagamentos.pagos / 15); // Vencendo hoje
    }

    const pagCard3 = document.getElementById('pag-atrasado');
    if (pagCard3) {
      pagCard3.textContent = this.formatCurrency(kpis.pagamentos.atrasados);
    }

    const pagCard4 = document.getElementById('pag-pago');
    if (pagCard4) {
      pagCard4.textContent = this.formatCurrency(kpis.pagamentos.pagos);
    }

    // Créditos KPIs
    const credCard1 = document.getElementById('cred-total');
    if (credCard1) {
      credCard1.textContent = this.formatCurrency(kpis.creditos.total);
    }

    const credCard2 = document.getElementById('cred-aprop');
    if (credCard2) {
      credCard2.textContent = this.formatCurrency(kpis.creditos.apropriados);
    }

    const credCard3 = document.getElementById('cred-risco');
    if (credCard3) {
      credCard3.textContent = this.formatCurrency(kpis.creditos.risco);
    }

    const credCard4 = document.getElementById('cred-util');
    if (credCard4) {
      credCard4.textContent = this.formatCurrency(kpis.creditos.utilizados);
    }

    // Conciliação KPIs
    const concCard1 = document.querySelector('.kgrid.k4 .kcard:nth-child(1) .kval');
    if (concCard1) {
      concCard1.textContent = kpis.conciliacao.dfRecebidos.toLocaleString('pt-BR');
    }

    console.log('✓ KPI cards atualizados');
  }

  updateTables() {
    const nfsEntrada = this.nfsData.nfsEntrada.slice(0, 5);
    const nfsSaida = this.nfsData.nfsSaida.slice(0, 5);

    // Atualizar tabela de transações recentes
    const recentTable = document.getElementById('t-recent');
    if (recentTable && nfsEntrada.length > 0) {
      recentTable.innerHTML = nfsEntrada.map(nf => `
        <tr>
          <td class="mono">RF-${nf.numero}</td>
          <td>${nf.fornecedor}</td>
          <td>Compra</td>
          <td class="r">${this.formatCurrency(nf.valor)}</td>
          <td>${nf.data}</td>
          <td><span style="font-size:10px;padding:2px 6px;background:rgba(34,197,94,.2);color:var(--green);border-radius:4px">Recebido</span></td>
        </tr>
      `).join('');
    }

    console.log('✓ Tabelas atualizadas');
  }

  setupEventListeners() {
    // Listener para filtros de data, status, etc.
    document.addEventListener('filterChange', (e) => {
      this.filters = { ...this.filters, ...e.detail };
      this.updateDashboard();
    });
  }

  formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  formatNumber(value) {
    return value.toLocaleString('pt-BR');
  }

  // Getters para acessar dados
  getNFsEntrada() {
    return this.nfsData?.nfsEntrada || [];
  }

  getNFsSaida() {
    return this.nfsData?.nfsSaida || [];
  }

  getKPIs() {
    return this.calculateKPIs();
  }

  // Métodos para sincronização em tempo real
  sincronizar() {
    console.log('Sincronizando dados...');
    this.updateDashboard();
  }
}

// Instanciar gerenciador global
let dataSyncManager = null;

document.addEventListener('DOMContentLoaded', function() {
  dataSyncManager = new DataSyncManager();
  window.dataSyncManager = dataSyncManager; // Expor globalmente para debugging
  console.log('✓ Data Sync Manager inicializado');
  console.log('  Total de NFs: 900 (500 entrada + 400 saída)');
  console.log('  Valor entrada: R$ 500.000.000');
  console.log('  Valor saída: R$ 600.000.000');
});

// Sincronizar a cada 30 segundos
if (typeof window !== 'undefined') {
  setInterval(() => {
    if (dataSyncManager) {
      dataSyncManager.sincronizar();
    }
  }, 30000);
}

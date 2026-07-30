/**
 * Apuração Completa - Todos os Meses
 * Gera dados de apuração para todos os 12 meses de 2026
 */

function gerarApuracaoCompleta() {
  // Dados base para cada mês
  const meses = [
    'jan/2026', 'fev/2026', 'mar/2026', 'abr/2026', 'mai/2026', 'jun/2026',
    'jul/2026', 'ago/2026', 'set/2026', 'out/2026', 'nov/2026', 'dez/2026'
  ];

  const fornecedores = [
    'Vale S.A.', 'Randon S.A.', 'Marcopolo S.A.', 'Bosch Ltda', 'WEG Equipamentos',
    'Embraer S.A.', 'Petrobras Dist.', 'Braskem S.A.', 'Suzano S.A.', 'Ambev S.A.'
  ];

  const clientes = [
    'WEG Motores', 'Mercado Livre', 'Embraer S.A.', 'Bosch Ltda', 'Randon S.A.',
    'Ambev S.A.', 'Magazine Luiza', 'Gerdau Aços', 'Marcopolo S.A.'
  ];

  // Gerar dados para cada mês
  const apurDataCompleta = {};

  meses.forEach((mes, idx) => {
    const mesNum = idx + 1;
    const statusOptions = ['aberta', 'calculada', 'concluida'];
    const status = idx < 5 ? 'concluida' : (idx < 11 ? 'calculada' : 'aberta');

    // Saldo inicial cresce progressivamente
    const ibsSaldoIni = 1340 + (idx * 500);
    const cbsSaldoIni = 5820 + (idx * 1200);

    // Gerar créditos (IBS e CBS)
    const creditos = [];
    for (let i = 0; i < 10; i++) {
      const nfNum = String(45000 + idx * 100 + i).padStart(8, '0');
      const valorBase = 10000 + Math.random() * 15000;
      const forn = fornecedores[i % fornecedores.length];
      const data = `${String((i % 28) + 1).padStart(2, '0')}/${String(mesNum).padStart(2, '0')}/2026`;

      const credIbs = Math.floor(valorBase * 0.10);
      const credCbs = Math.floor(valorBase * 0.16);

      const statusCred = ['apropriado', 'apropriado', 'apropriado', 'nao_apropriado', 'utilizado'][i % 5];
      const apropIbs = statusCred === 'apropriado' || statusCred === 'utilizado' ? credIbs : 0;
      const apropCbs = statusCred === 'apropriado' || statusCred === 'utilizado' ? credCbs : 0;

      creditos.push({
        doc: `NF-e ${nfNum}`,
        tributo: 'IBS',
        data: data,
        forn: forn,
        total: credIbs,
        aprop: apropIbs,
        naoAprop: statusCred === 'nao_apropriado' ? credIbs : 0,
        util: statusCred === 'utilizado' ? apropIbs : 0,
        naoUtil: statusCred === 'utilizado' ? 0 : apropIbs,
        motivo: statusCred === 'nao_apropriado' ? 'Tributo do fornecedor não liquidado junto ao CG-IBS' : null
      });

      creditos.push({
        doc: `NF-e ${nfNum}`,
        tributo: 'CBS',
        data: data,
        forn: forn,
        total: credCbs,
        aprop: apropCbs,
        naoAprop: statusCred === 'nao_apropriado' ? credCbs : 0,
        util: statusCred === 'utilizado' ? apropCbs : 0,
        naoUtil: statusCred === 'utilizado' ? 0 : apropCbs,
        motivo: statusCred === 'nao_apropriado' ? 'Tributo do fornecedor não liquidado junto ao CG-IBS' : null
      });
    }

    // Gerar débitos (IBS e CBS)
    const debitos = [];
    for (let i = 0; i < 8; i++) {
      const nfNum = String(89000 + idx * 100 + i).padStart(8, '0');
      const valorBase = 12000 + Math.random() * 20000;
      const cliente = clientes[i % clientes.length];
      const data = `${String((i % 28) + 1).padStart(2, '0')}/${String(mesNum).padStart(2, '0')}/2026`;

      const debitoIbs = Math.floor(valorBase * 0.12);
      const debitoCbs = Math.floor(valorBase * 0.20);

      const mecOptions = ['split', 'rad', 'credito', null];
      const mec = mecOptions[i % mecOptions.length];

      // Extinção depende do mecanismo
      let extintoIbs = 0, extintosCbs = 0, naoExtIbs = debitoIbs, naoExtCbs = debitoCbs;
      if (mec) {
        extintoIbs = debitoIbs;
        extintosCbs = debitoCbs;
        naoExtIbs = 0;
        naoExtCbs = 0;
      }

      debitos.push({
        doc: `NF-e ${nfNum}`,
        tributo: 'IBS',
        data: data,
        cliente: cliente,
        total: debitoIbs,
        naoExt: naoExtIbs,
        extinto: extintoIbs,
        mec: mec,
        splitEvt: mec === 'split' ? {
          data: data,
          meio: 'PIX',
          txId: `SP-${data.split('/').reverse().join('')}-${String(Math.floor(Math.random() * 10000)).padStart(5, '0')}`,
          valor: extintoIbs
        } : null,
        radEvt: mec === 'rad' ? { adquirente: cliente + ' Ltda', cnpj: '12.345.678/0001-90', data: data } : null,
        credEvt: null
      });

      debitos.push({
        doc: `NF-e ${nfNum}`,
        tributo: 'CBS',
        data: data,
        cliente: cliente,
        total: debitoCbs,
        naoExt: naoExtCbs,
        extinto: extintosCbs,
        mec: mec,
        splitEvt: mec === 'split' ? {
          data: data,
          meio: 'PIX',
          txId: `SP-${data.split('/').reverse().join('')}-${String(Math.floor(Math.random() * 10000)).padStart(5, '0')}`,
          valor: extintosCbs
        } : null,
        radEvt: mec === 'rad' ? { adquirente: cliente + ' Ltda', cnpj: '12.345.678/0001-90', data: data } : null,
        credEvt: null
      });
    }

    // Definir status baseado no índice do mês
    let dataExec = null;
    if (status === 'calculada') {
      const dia = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
      const mes2 = String(mesNum + 1).padStart(2, '0');
      const hora = String(Math.floor(Math.random() * 23)).padStart(2, '0');
      const min = String(Math.floor(Math.random() * 59)).padStart(2, '0');
      dataExec = `${dia}/0${mes2}/2026 às ${hora}:${min}`;
    } else if (status === 'concluida') {
      const dia = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
      const mes2 = String(mesNum + 1).padStart(2, '0');
      const hora = String(Math.floor(Math.random() * 23)).padStart(2, '0');
      const min = String(Math.floor(Math.random() * 59)).padStart(2, '0');
      dataExec = `${dia}/0${mes2}/2026 às ${hora}:${min}`;
    }

    apurDataCompleta[mes] = {
      status: status,
      ultimaExecucao: dataExec,
      ibsSaldoInicial: ibsSaldoIni,
      cbsSaldoInicial: cbsSaldoIni,
      creditos: creditos,
      debitos: debitos
    };
  });

  return apurDataCompleta;
}

// Executar quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', function() {
  // Atualizar apurData com dados completos
  if (typeof apurData !== 'undefined') {
    const apurCompleta = gerarApuracaoCompleta();
    Object.keys(apurCompleta).forEach(mes => {
      apurData[mes] = apurCompleta[mes];
    });
    console.log('✓ Dados de Apuração completos gerados para todos os 12 meses');

    // Atualizar o select de períodos
    const selectPeriodo = document.getElementById('apur-periodo-sel');
    if (selectPeriodo) {
      // Limpar opções existentes
      selectPeriodo.innerHTML = '';

      // Adicionar todas as opções de mês
      const meses = [
        'jan/2026', 'fev/2026', 'mar/2026', 'abr/2026', 'mai/2026', 'jun/2026',
        'jul/2026', 'ago/2026', 'set/2026', 'out/2026', 'nov/2026', 'dez/2026'
      ];

      meses.forEach((mes, idx) => {
        const option = document.createElement('option');
        option.value = mes;
        option.textContent = mes.toUpperCase();
        option.selected = idx === 4; // mai/2026 como padrão (índice 4)
        selectPeriodo.appendChild(option);
      });

      console.log('✓ Dropdown de períodos atualizado com 12 meses');

      // Renderizar dados do mês padrão
      if (typeof apurRenderAll === 'function') {
        apurRenderAll();
      }
    }
  }
});

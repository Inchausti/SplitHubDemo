/**
 * Gerador de Notas Fiscais
 * Cria 500 NFs de entrada (R$ 500M) e 400 NFs de saída (R$ 600M)
 */

const fs = require('fs');
const path = require('path');

// Lista de fornecedores
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

// Lista de clientes
const clientes = [
  { nome: 'ACME Corp', cnpj: '12.345.678/0001-90' },
  { nome: 'Tech Solutions', cnpj: '98.765.432/0001-11' },
  { nome: 'Global Industries', cnpj: '11.222.333/0001-44' },
  { nome: 'International Trade', cnpj: '55.666.777/0001-88' },
  { nome: 'Premium Goods', cnpj: '99.888.777/0001-55' },
  { nome: 'Smart Commerce', cnpj: '44.333.222/0001-66' },
  { nome: 'Logistics Plus', cnpj: '77.888.999/0001-22' },
  { nome: 'Retail Group', cnpj: '33.444.555/0001-99' },
  { nome: 'Distribution Hub', cnpj: '66.555.444/0001-33' },
  { nome: 'Export Co.', cnpj: '22.111.333/0001-77' }
];

function gerarNFsEntrada(quantidade, somaTotal) {
  const nfs = [];
  const valorBase = Math.floor(somaTotal / quantidade);
  let somaAcumulada = 0;

  for (let i = 1; i <= quantidade; i++) {
    let valor;

    if (i === quantidade) {
      // Última NF recebe o resto para completar exatamente o valor total
      valor = somaTotal - somaAcumulada;
    } else {
      // Varia entre 80% e 120% do valor base
      const variacao = 0.8 + Math.random() * 0.4;
      valor = Math.floor(valorBase * variacao);

      // Certifica que não exceda o total
      if (somaAcumulada + valor > somaTotal) {
        valor = somaTotal - somaAcumulada - (quantidade - i) * valorBase;
      }
    }

    somaAcumulada += valor;
    const fornecedor = fornecedores[i % fornecedores.length];
    const dia = Math.floor((i - 1) / 17) + 1;
    const mes = Math.floor((i - 1) / 250) + 1;
    const data = `2026-${String(mes).padStart(2, '0')}-${String(Math.min(dia, 28)).padStart(2, '0')}`;

    nfs.push({
      id: i,
      numero: String(i).padStart(6, '0'),
      fornecedor: fornecedor.nome,
      cnpj: fornecedor.cnpj,
      data: data,
      valor: valor,
      tipo: 'entrada',
      status: 'recebido',
      descricao: `Compra de materiais - NF ${i}`
    });
  }

  return nfs;
}

function gerarNFsSaida(quantidade, somaTotal) {
  const nfs = [];
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
    const cliente = clientes[i % clientes.length];
    const dia = Math.floor((i - 1) / 13) + 1;
    const mes = Math.floor((i - 1) / 200) + 1;
    const data = `2026-${String(mes).padStart(2, '0')}-${String(Math.min(dia, 28)).padStart(2, '0')}`;

    nfs.push({
      id: 500 + i,
      numero: String(500000 + i).padStart(6, '0'),
      cliente: cliente.nome,
      cnpj: cliente.cnpj,
      data: data,
      valor: valor,
      tipo: 'saida',
      status: 'emitido',
      descricao: `Venda de produtos - NF ${i}`
    });
  }

  return nfs;
}

// Gerar dados
console.log('Gerando 500 NFs de entrada (R$ 500M)...');
const nfsEntrada = gerarNFsEntrada(500, 500000000);
console.log(`✓ Gerado: ${nfsEntrada.length} NFs de entrada`);
console.log(`  Soma total: R$ ${nfsEntrada.reduce((sum, nf) => sum + nf.valor, 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`);

console.log('\nGerando 400 NFs de saída (R$ 600M)...');
const nfsSaida = gerarNFsSaida(400, 600000000);
console.log(`✓ Gerado: ${nfsSaida.length} NFs de saída`);
console.log(`  Soma total: R$ ${nfsSaida.reduce((sum, nf) => sum + nf.valor, 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`);

// Salvar dados
const data = {
  nfsEntrada,
  nfsSaida,
  metadata: {
    totalNFsEntrada: nfsEntrada.length,
    totalNFsSaida: nfsSaida.length,
    somaEntrada: nfsEntrada.reduce((sum, nf) => sum + nf.valor, 0),
    somaSaida: nfsSaida.reduce((sum, nf) => sum + nf.valor, 0),
    geradoEm: new Date().toISOString()
  }
};

const outputPath = path.join(__dirname, 'nfs.json');
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

console.log(`\n✓ Dados salvos em: ${outputPath}`);
console.log(`\nResumo financeiro:`);
console.log(`  Entrada total: R$ ${data.metadata.somaEntrada.toLocaleString('pt-BR')}`);
console.log(`  Saída total:   R$ ${data.metadata.somaSaida.toLocaleString('pt-BR')}`);
console.log(`  Diferença:     R$ ${(data.metadata.somaSaida - data.metadata.somaEntrada).toLocaleString('pt-BR')}`);

module.exports = { nfsEntrada, nfsSaida, data };

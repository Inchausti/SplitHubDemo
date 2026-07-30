# Estrutura de Dados - SplitHub Dashboard

## 📊 Visão Geral

Este diretório contém os dados que alimentam o SplitHub Dashboard. O sistema mantém sincronização em tempo real entre:

- **NFs de Entrada** (500 registros - R$ 500M)
- **NFs de Saída** (400 registros - R$ 600M)
- **Contratos** (7 registros - R$ 829M)
- **Fornecedores** (10 fornecedores ativos)
- **Clientes** (5 clientes ativos)

## 📁 Arquivos de Dados

### `nfs.json`
Contém os registros de Notas Fiscais (entrada e saída).

**Estrutura NF de Entrada:**
```json
{
  "id": 1,
  "numero": "000001",
  "fornecedor": "Vale S.A.",
  "cnpj": "33.592.510/0001-62",
  "data": "2026-01-05",
  "valor": 1250000,
  "tipo": "entrada",
  "status": "recebido",
  "descricao": "Compra de materiais - NF 1"
}
```

**Estrutura NF de Saída:**
```json
{
  "id": 501,
  "numero": "500001",
  "cliente": "ACME Corp",
  "cnpj": "12.345.678/0001-90",
  "data": "2026-01-05",
  "valor": 1850000,
  "tipo": "saida",
  "status": "emitido",
  "descricao": "Venda de produtos - NF 1"
}
```

### `contratos.json`
Contém os contratos firmados com fornecedores.

**Estrutura:**
```json
{
  "id": "CT-0001",
  "numero": "2024-001",
  "fornecedor": "Vale S.A.",
  "cnpj": "33.592.510/0001-62",
  "dataInicio": "2024-01-15",
  "dataFim": "2026-12-31",
  "valorTotal": 125000000,
  "status": "ativo",
  "nfsVinculadas": [1, 8, 15, 22, 29],
  "descricao": "Fornecimento de minério de ferro e derivados"
}
```

### `fornecedores.json`
Contém informações de fornecedores e clientes.

**Estrutura Fornecedor:**
```json
{
  "id": "F-001",
  "nome": "Vale S.A.",
  "cnpj": "33.592.510/0001-62",
  "status": "ativo",
  "dataCadastro": "2020-01-15",
  "volumeCompras": 125000000,
  "creditosGerados": 12500000,
  "pagamentosRealizados": 15,
  "pagamentosPendentes": 1,
  "score": 88,
  "categorizacao": "Premium"
}
```

## 🔄 Sincronização de Dados

### Como Funciona

1. **Carregamento Inicial**
   - `data-sync.js` carrega os arquivos JSON
   - Calcula KPIs em tempo real baseado nos dados

2. **Cálculo de KPIs**
   - **Créditos Apropriados**: 10% do valor de entrada
   - **Débitos**: 11.5% do valor de saída
   - **Alíquota Efetiva**: (Débito - Crédito) / Saída
   - **Conciliação**: Calcula percentual de RF vinculados e TF confirmadas

3. **Atualização do Dashboard**
   - KPI cards são atualizados com valores reais
   - Tabelas são populadas com dados das NFs
   - Gráficos são sincronizados com os dados

4. **Sincronização Contínua**
   - Sistema sincroniza a cada 30 segundos
   - Detecta mudanças nos dados
   - Atualiza automaticamente a interface

## 📊 Relacionamentos de Dados

```
NFs de Entrada (500) --->  Fornecedores (10)  <--- Contratos (7)
      ↓
  Créditos (IBS/CBS)
      ↓
Débitos (Pagamento)
      ↓
Conciliação (RF x TF)


NFs de Saída (400) -----> Clientes (5)
      ↓
  Receita
      ↓
  Análise de Vendas
```

## 💰 Dados Financeiros

### Resumo Global

| Indicador | Valor |
|-----------|-------|
| **Entrada Total** | R$ 500.000.000 |
| **Saída Total** | R$ 600.000.000 |
| **Créditos Apropriados (10%)** | R$ 50.000.000 |
| **Débitos (11.5%)** | R$ 69.000.000 |
| **Diferença Líquida** | R$ 100.000.000 |
| **Alíquota Efetiva** | 3,17% |

### Por Fornecedor (Exemplo - Vale S.A.)

- Volume de Compras: R$ 125.000.000
- Créditos Gerados: R$ 12.500.000
- Pagamentos Realizados: 15
- Score: 88 (Premium)
- Contratos Ativos: 1
- NFs Vinculadas: 5

## 🔄 Sincronização em Tempo Real

O arquivo `data-sync.js` implementa:

```javascript
// Sincronização automática a cada 30 segundos
setInterval(() => {
  dataSyncManager.sincronizar();
}, 30000);

// Atualização de KPIs
const kpis = dataSyncManager.getKPIs();

// Acesso aos dados
const nfsEntrada = dataSyncManager.getNFsEntrada();
const nfsSaida = dataSyncManager.getNFsSaida();
```

## 📈 Indicadores Calculados

### Dashboard Principal
- Créditos Apropriados
- Créditos a Apropriar
- Créditos em Risco
- Alíquota Efetiva

### Gestão de Pagamentos
- Pagamentos Pendentes (7 dias)
- Vencendo Hoje
- Atrasados
- Pagos em Abril

### Gestão de Créditos
- Total de Créditos
- Apropriados
- Em Risco
- Utilizados

### Conciliação
- DF-e Recebidos (900)
- RF Vinculados (891)
- TF Confirmadas (881)
- Divergências (9)

## 🛠️ Manutenção

### Atualizar Dados

1. Editar `nfs.json` com novos registros
2. Editar `contratos.json` com novos contratos
3. Editar `fornecedores.json` com novos fornecedores
4. Dashboard sincroniza automaticamente

### Gerar Novos Dados

Execute o script de geração:
```bash
node src/data/generate-nfs.js
```

## 📝 Notas

- Todos os valores estão em BRL (Real Brasileiro)
- Datas estão no formato ISO 8601 (YYYY-MM-DD)
- Sincronização ocorre a cada 30 segundos
- Dados são mantidos em memória (em produção, usar banco de dados)
- Para sincronização em tempo real com servidor, configure a API em `data-sync.js`

## 🔗 Integração com API

Para integrar com uma API real, modifique o método `loadNFData()` em `data-sync.js`:

```javascript
async loadNFData() {
  try {
    const response = await fetch('/api/nfs');
    this.nfsData = await response.json();
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
  }
}
```

## 📞 Suporte

Para dúvidas sobre estrutura de dados:
- Consulte o arquivo README.md principal
- Verifique a documentação em `/docs/`
- Abra uma issue no GitHub

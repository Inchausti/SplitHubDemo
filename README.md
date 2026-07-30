# SplitHub — Dashboard de Gestão Tributária

Uma plataforma completa de gestão de pagamentos, impostos, créditos e conciliação tributária. Desenvolvido para a Positivo Soluções em Pagamentos.

## 🎯 Funcionalidades

- **Dashboard de Visão Geral** — KPIs de créditos apropriados, débitos e alíquota efetiva
- **Gestão de Pagamentos** — DARF, Guia IBS, pagamentos a fornecedores
- **Gestão de Créditos** — Apropriação, risco, utilização (IBS + CBS)
- **Fluxo de Caixa Tributário** — Projeção diária com simulador de antecipações
- **Conciliação** — Match DF-e × RF × TF × Crédito apropriado
- **Assistente Tributário** — IA para alertas e recomendações
- **Gestão de Inconsistências** — Dashboard de erros e divergências

## 📋 Requisitos

- Node.js 16+ (para development)
- Navegador moderno com suporte a CSS Grid e Flexbox

## 🚀 Como usar

### Desenvolvimento

```bash
# Instalar dependências
npm install

# Iniciar servidor local
npm run dev

# Build para produção
npm run build
```

### Deploy

O projeto é estático e pode ser servido por qualquer servidor web:

```bash
# Vercel
vercel deploy

# Netlify
netlify deploy --prod

# AWS S3 + CloudFront
aws s3 sync dist/ s3://seu-bucket/
```

## 📁 Estrutura do Projeto

```
splithub-docs/
├── src/
│   ├── index.html          # HTML principal
│   ├── css/
│   │   ├── style.css       # Estilos globais
│   │   └── responsive.css  # Media queries
│   ├── js/
│   │   ├── main.js         # Lógica principal
│   │   ├── charts.js       # Gráficos (Chart.js/Recharts)
│   │   ├── api.js          # Chamadas à API
│   │   └── utils.js        # Funções utilitárias
│   └── assets/
│       ├── fonts/
│       └── icons/
├── public/                 # Arquivos estáticos
├── dist/                   # Build de produção
├── package.json
├── webpack.config.js       # Configuração webpack
└── README.md
```

## 🎨 Paleta de Cores

- **Primária (Teal):** `#49C5B1`
- **Secundária (Azul):** `#3B82F6`
- **Alerta (Amarelo):** `#F59E0B`
- **Erro (Vermelho):** `#F43F5E`
- **Sucesso (Verde):** `#22C55E`
- **Fundo Escuro:** `#1D1C1B`

## 🔐 Autenticação

Configure suas variáveis de ambiente:

```bash
REACT_APP_API_URL=https://api.splithub.com
REACT_APP_AUTH_TOKEN=seu_token
```

## 📊 Gráficos

Utiliza Chart.js ou Recharts para visualizações:

- Evolução de créditos (linha)
- Pagamentos executados (coluna)
- Composição de créditos (área)
- Movimentação de caixa (stacked bar)

## 🤝 Contribuindo

1. Fork o repositório
2. Crie uma branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Copyright © 2026 Positivo Soluções em Pagamentos. Todos os direitos reservados.

## 📞 Suporte

- **Email:** suporte@splithub.com
- **Docs:** https://docs.splithub.com
- **Issues:** GitHub Issues

---

Desenvolvido com ❤️ para a comunidade tributária brasileira.

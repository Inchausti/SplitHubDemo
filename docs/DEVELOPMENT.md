# Guia de Desenvolvimento

## Setup Local

### Pré-requisitos

- Node.js 16+ 
- npm ou yarn
- Git

### Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/splithub-docs.git
cd splithub-docs

# Instale as dependências
npm install

# Configure seu ambiente
cp .env.example .env.local
# Edite .env.local com suas configurações
```

### Executar em Desenvolvimento

```bash
# Inicia servidor local na porta 8000
npm run dev
```

O dashboard estará disponível em `http://localhost:8000`

## Estrutura do Projeto

```
splithub-docs/
├── src/
│   ├── index.html          # Arquivo HTML principal
│   ├── css/
│   │   └── style.css       # Estilos globais
│   └── js/
│       ├── main.js         # Lógica principal e navegação
│       └── charts.js       # Inicialização de gráficos
├── docs/                   # Documentação
├── public/                 # Arquivos estáticos
├── dist/                   # Build de produção
├── package.json
└── README.md
```

## Desenvolvimento de Componentes

### Adicionar uma Nova View

1. **HTML:**
```html
<div id="view-novo-modulo" class="view">
  <div class="pg-hdr">
    <div><div class="pg-title">Título do Módulo</div></div>
  </div>
  <!-- Conteúdo aqui -->
</div>
```

2. **JavaScript:**
```javascript
function showView(viewName, btnElement) {
  // Já existe função em main.js
}
```

3. **CSS:**
Use classes pré-definidas:
- `.kgrid`, `.kcard` - KPI cards
- `.cgrid`, `.ccrd` - Chart cards
- `.tcrd` - Table cards
- `.nav-btn`, `.nav-sub-btn` - Navigation

### Paleta de Cores

Todas as cores estão definidas em `:root`:

```css
--teal: #49C5B1      /* Cor primária */
--blue: #3B82F6      /* Secundária */
--amber: #F59E0B     /* Alerta */
--red: #F43F5E       /* Erro */
--green: #22C55E     /* Sucesso */
```

## Gráficos

Usar Chart.js para visualizações:

```javascript
const ctx = document.getElementById('meu-chart').getContext('2d');
const chart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: ['Jan', 'Fev', 'Mar'],
    datasets: [{
      label: 'Créditos',
      data: [12, 19, 3],
      borderColor: 'var(--teal)',
      tension: 0.4
    }]
  }
});
```

## Temas (Dark/Light)

O tema é armazenado em `localStorage`:

```javascript
// Toggle
document.documentElement.setAttribute('data-theme', 'light');

// Ler
const tema = document.documentElement.getAttribute('data-theme');
```

## Responsive Design

Breakpoints:
- `640px` - Mobile
- `1024px` - Tablet
- `1280px+` - Desktop

## Performance

- Lazy load de imagens
- CSS crítico inline
- Defer de scripts não-críticos
- Minify antes de deploy

## Testing

```bash
# Executar testes
npm test

# Com coverage
npm test -- --coverage
```

## Build para Produção

```bash
# Criar bundle otimizado
npm run build

# Verificar build
npm run serve
```

## Debugging

### Browser DevTools

- Abra F12
- Verifique Console para erros
- Use Network tab para requisições de API

### localStorage

```javascript
// Ver dados armazenados
console.log(localStorage);

// Limpar
localStorage.clear();
```

## Deploy

### Vercel

```bash
npm i -g vercel
vercel deploy
```

### Netlify

```bash
npm i -g netlify-cli
netlify deploy --prod
```

### AWS S3

```bash
aws s3 sync dist/ s3://seu-bucket/
aws cloudfront create-invalidation --distribution-id ID --paths "/*"
```

## Troubleshooting

### "Cannot find Chart.js"
```bash
npm install chart.js
```

### Charts não aparecem
- Verifique se dados estão sendo passados corretamente
- Abra Console (F12) para erros

### Tema não muda
- Limpe localStorage: `localStorage.clear()`
- Recarregue a página

## Padrões de Código

### Naming Conventions

**Functions:**
```javascript
// Ações claras
loadData()
updateUI()
handleClick()
toggleMenu()
```

**Variables:**
```javascript
// Descritivo
const userBalance = 1000;
const isLoading = false;
const creditElements = [];
```

**Classes CSS:**
```css
/* Utility first */
.flex { display: flex; }
.gap-4 { gap: 1rem; }

/* Block-Element-Modifier */
.card-header {}
.card__title {}
.card--active {}
```

## Resources

- [Chart.js Docs](https://www.chartjs.org)
- [CSS Grid Guide](https://css-tricks.com/snippets/css/complete-guide-grid/)
- [Responsive Design](https://developers.google.com/web/fundamentals/design-and-ux/responsive)

## Contato

Dúvidas sobre desenvolvimento?
- Issues no GitHub
- Discussões na community
- Email: dev@splithub.com

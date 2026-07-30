# Changelog

Todas as mudanças importantes para este projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
e este projeto adota [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-24

### Added
- Dashboard de visão geral com KPIs principais
- Gestão de pagamentos (DARF/Guia IBS/Fornecedores)
- Gestão de créditos (IBS + CBS)
- Fluxo de caixa tributário com simulador
- Conciliação (DF-e × RF × TF × Crédito)
- Assistente tributário com IA
- Tema claro/escuro
- Responsividade mobile
- Documentação completa
- CI/CD com GitHub Actions

### Features
- Múltiplas visualizações de dados com Chart.js
- Filtros avançados por CNPJ
- Exportação de relatórios (XLSX/PDF)
- Navegação aninhada
- Suporte a i18n (português)

### Security
- Autenticação via token Bearer
- CORS configurado
- Validação de entrada
- Proteção CSRF

## [0.9.0] - 2026-04-20

### Added
- Versão beta com funcionalidades principais
- Dashboard funcional
- Integração de API mockada

### Known Issues
- Gráficos ainda com dados estáticos
- Alguns modais em desenvolvimento
- Simulador em beta

---

## Como Contribuir

Ao relatar issues ou sugerir features, use as seguintes tags:

- `bug` — Erro encontrado
- `feature` — Nova funcionalidade
- `enhancement` — Melhoria em feature existente
- `documentation` — Documentação
- `performance` — Otimização
- `security` — Questão de segurança
- `breaking` — Mudança que quebra compatibilidade

## Versionamento

Usamos [Semantic Versioning](https://semver.org/):

- **MAJOR** — Mudanças incompatíveis
- **MINOR** — Novas funcionalidades (compatível)
- **PATCH** — Correções de bug

Exemplo: `1.2.3`
- `1` = MAJOR
- `2` = MINOR
- `3` = PATCH

---

Para questões sobre versões anteriores ou planejamento futuro, veja:
- [Projetos](https://github.com/positivo-solucoes/splithub-docs/projects)
- [Issues abertas](https://github.com/positivo-solucoes/splithub-docs/issues)
- [Roadmap](./docs/ROADMAP.md)

# Guia de Contribuição

Obrigado por considerar contribuir para o SplitHub! Este documento fornece orientações e instruções para contribuir.

## Código de Conduta

Este projeto adota um Código de Conduta. Ao participar, você é obrigado a manter este código. Por favor, reporte comportamento inaceitável para suporte@splithub.com.

## Como Contribuir

### Reportar Bugs

Antes de abrir uma issue, verifique se o problema já foi reportado. Se você encontrar um bug, abra uma issue com:

- **Título descritivo** do bug
- **Descrição detalhada** do comportamento esperado vs. observado
- **Passos para reproduzir** o problema
- **Screenshots** (se relevante)
- **Seu ambiente** (navegador, OS, versão)

### Sugerir Melhorias

As sugestões de melhorias são bem-vindas. Inclua:

- **Caso de uso** para a melhoria
- **Exemplos** de como funcionaria
- **Razão** pela qual seria útil para a maioria dos usuários

### Pull Requests

1. Fork o repositório e crie sua branch a partir de `main`
   ```bash
   git checkout -b feature/minha-funcionalidade
   ```

2. Se você adicionou código que deve ser testado, adicione testes

3. Garanta que o suite de testes passa
   ```bash
   npm test
   ```

4. Verifique se há linting erros
   ```bash
   npm run lint
   ```

5. Commit suas mudanças com mensagens descritivas
   ```bash
   git commit -m 'Add: descrição clara da mudança'
   ```

6. Push para seu fork
   ```bash
   git push origin feature/minha-funcionalidade
   ```

7. Abra um Pull Request com uma descrição clara do que foi feito

## Convenções de Código

### JavaScript/HTML

- Use `const` por padrão, `let` se precisar reatribuir
- Funções com nomes descritivos em camelCase
- Adicione comentários para código complexo
- Máximo 80 caracteres por linha (90 aceito)

### CSS

- Use variáveis CSS definidas em `:root`
- Siga a nomenclatura BEM quando apropriado
- Use media queries para responsividade
- Mantenha a especificidade baixa

### Git Commits

```
Type: Descrição curta (até 50 caracteres)

Descrição mais longa se necessária. Explique PORQUÊ, não O QUE.

Fixes #123
```

**Types:**
- `feat:` Nova funcionalidade
- `fix:` Corrige um bug
- `docs:` Mudanças apenas de documentação
- `style:` Mudanças que não afetam código (formatação, etc)
- `refactor:` Mudanças de código que não corrigem bugs nem adicionam features
- `perf:` Mudanças que melhoram performance
- `test:` Adiciona ou atualiza testes

## Processo de Review

Um mantenedor irá revisar seu PR. Pode haver pedidos de mudanças. Mudanças múltiplas em um commit ajudam a manter o histórico limpo.

## Licença

Ao contribuir, você concorda que suas contribuições serão licenciadas sob a mesma licença do projeto.

## Perguntas?

Sinta-se livre para abrir uma issue com a tag `question`.

---

Obrigado por contribuir! 🎉

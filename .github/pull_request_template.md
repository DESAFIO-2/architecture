## O que muda na arquitetura

<!-- Uma ou duas frases. Qual visão muda: atual, IA ou projetor? -->

## Por quê

<!-- Link para o PR, commit ou ADR do repositório de origem que motivou a mudança. -->

## Checklist

- [ ] O modelo (`model/*.json`) reflete o código da `main` do repositório de origem, com o commit citado em `sources`.
- [ ] Métricas copiadas como foram publicadas: reprovado continua reprovado.
- [ ] Decisão nova ou revertida tem ADR em `docs/adr/`.
- [ ] `npm run check` (site) e `uv run pytest` (projetor) passam localmente.
- [ ] Nenhum dado pessoal e nenhum conjunto de holdout cego nos dados do projetor.

> Este repositório só aceita merge com aprovação do arquiteto (CODEOWNERS + ruleset).

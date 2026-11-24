# Governança

Este repositório pertence ao arquiteto do projeto, `@mickeiascharles`.

## Regra

Nenhum commit chega à `main` sem pull request aprovado pelo arquiteto. Isso é garantido em
duas camadas:

1. **[CODEOWNERS](.github/CODEOWNERS)**: `*` pertence a `@mickeiascharles`, então todo PR pede a
   revisão dele automaticamente.
2. **[Ruleset da main](governance/ruleset-main.json)**, aplicado por
   [`governance/apply.sh`](governance/apply.sh):
   - PR obrigatório, com 1 aprovação **do code owner**;
   - aprovação cai se houver push novo, e o último push precisa ser aprovado por outra pessoa;
   - conversas resolvidas antes do merge;
   - CI `site` e `projector` verdes e atualizadas com a main;
   - merge só por squash e histórico linear;
   - proibido force push e apagar a main.

## Quando o próprio arquiteto abre o PR

O GitHub não deixa o autor aprovar o próprio PR. Por isso o ruleset tem um único bypass:
**dono da organização, só via pull request** (`bypass_mode: pull_request`). O arquiteto é o
único dono da DESAFIO-2, então ele pode fazer o merge dos próprios PRs, mas sempre por PR e
com a CI rodando. Ninguém faz push direto na main.

Se outra pessoa virar dona da organização, ela passa a ter o mesmo bypass. Nesse caso, troque
o bypass por um time só com o arquiteto.

## Outras regras do projeto

- Nenhuma IA aparece como autora ou coautora em commits ou PRs.
- Todo push, merge ou deploy é apresentado ao arquiteto antes (repositório, branch, commits,
  diff e riscos) e só acontece depois do "ok" dele.

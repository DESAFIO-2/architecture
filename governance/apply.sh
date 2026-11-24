#!/usr/bin/env bash
# Aplica a governança no GitHub. Rodar uma vez, por quem é dono da organização.
#   ./governance/apply.sh DESAFIO-2/architecture
set -euo pipefail

repo="${1:?uso: governance/apply.sh <org>/<repo>}"
here="$(cd "$(dirname "$0")" && pwd)"

existing="$(gh api "repos/$repo/rulesets" --jq '.[] | select(.name=="main-aprovacao-do-arquiteto") | .id')"
if [[ -n "$existing" ]]; then
  gh api -X PUT "repos/$repo/rulesets/$existing" --input "$here/ruleset-main.json" >/dev/null
  echo "ruleset atualizado ($existing)"
else
  gh api -X POST "repos/$repo/rulesets" --input "$here/ruleset-main.json" --jq '"ruleset criado (\(.id))"'
fi

# Merge só por squash, branch apagada depois do merge.
gh api -X PATCH "repos/$repo" \
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true >/dev/null
echo "opções de merge aplicadas"

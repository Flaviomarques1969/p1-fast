#!/usr/bin/env bash
# PreToolUse hook on Bash — bloqueia `git commit` com tratamento informal
# (tu/te/ti/teu/tua/teus/tuas/contigo/consigo). Regra dura do CLAUDE.md
# §Tratamento + §9.2 do PLANO_FASE_1.md.
#
# Match só lowercase pra evitar falso-positivo em test IDs (TE-01, TI-12, etc.).
# Pula --no-edit (amend sem mudar mensagem).

set -uo pipefail

input=$(cat)

# Extrai .tool_input.command do JSON do hook
if command -v jq >/dev/null 2>&1; then
  cmd=$(echo "$input" | jq -r '.tool_input.command // ""')
else
  cmd=$(echo "$input" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("command",""))' 2>/dev/null || true)
fi

# Só interfere se o comando COMEÇA com `git commit`. Match de substring causaria
# falso-positivo em comandos que apenas mencionam "git commit" dentro de strings
# (ex: echo de JSON com payload de teste do próprio hook).
if ! echo "$cmd" | grep -qE '^[[:space:]]*git[[:space:]]+commit\b'; then
  exit 0
fi

# Pula --no-edit (amend que preserva mensagem original)
if echo "$cmd" | grep -qE '\-\-no[-]edit\b'; then
  exit 0
fi

# Procura pronome informal — case-sensitive lowercase only
match=$(echo "$cmd" | grep -oE '\b(tu|te|ti|teu|tua|teus|tuas|contigo|consigo)\b' | head -3 | tr '\n' ' ')
if [ -n "$match" ]; then
  cat >&2 <<EOF
Mensagem de commit contém tratamento informal: $match
Regra dura do CLAUDE.md §Tratamento — sempre "você", nunca tu/te/ti/teu/tua/contigo.
Reescreva e tente de novo. (Se for falso positivo — ex: "te-st" técnico — confirme com o usuário antes de bypass.)
EOF
  exit 2
fi

exit 0

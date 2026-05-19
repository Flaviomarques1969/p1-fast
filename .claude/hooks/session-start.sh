#!/usr/bin/env bash
# SessionStart hook — automatiza o RUNBOOK_RETOMAR Passo 2.
# Imprime git state + handoff mais recente + lembrete dos docs canônicos.
# Saída entra como contexto pra Claude no início da sessão.

set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

echo "── git ──"
echo "branch: $(git branch --show-current 2>/dev/null || echo '(detached)')"
echo
short_status="$(git status --short 2>/dev/null)"
if [ -n "$short_status" ]; then
  echo "working tree:"
  echo "$short_status" | head -20
  extra=$(echo "$short_status" | wc -l)
  if [ "$extra" -gt 20 ]; then
    echo "...e mais $((extra - 20)) arquivo(s)"
  fi
else
  echo "working tree: clean"
fi
echo
echo "últimos 5 commits:"
git log --oneline -5 2>/dev/null || echo "(repo vazio)"
echo

echo "── handoff mais recente ──"
latest_handoff=$(ls -1t docs/SESSION_HANDOFF_*.md 2>/dev/null | head -1)
if [ -n "$latest_handoff" ]; then
  echo "$latest_handoff"
else
  echo "(nenhum docs/SESSION_HANDOFF_*.md encontrado)"
fi
echo

echo "── leitura canônica obrigatória ──"
echo "1. STATUS.md"
echo "2. docs/PLANO_FASE_1.md (doc mestre — vence todos)"
echo "3. ARCHITECTURE_DECISIONS.md (22 ADRs)"
if [ -n "$latest_handoff" ]; then
  echo "4. $latest_handoff (handoff da última sessão)"
fi
echo

echo "── regra dura ──"
echo "Tratamento sempre VOCÊ. Nunca tu/te/ti/teu/tua/contigo."
echo "(hook em .claude/hooks/pre-commit-pronoun-check.sh bloqueia commits com pronome informal)"

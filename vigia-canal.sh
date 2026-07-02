#!/usr/bin/env bash
# =============================================================================
# vigia-canal.sh — vigia do canal claude-comms, LADO iMac.
# Acorda (sai do loop e imprime) quando chega mensagem NOVA notebook->imac.
# Rodar em background. Ao sair, a sessão do iMac é re-invocada e trata o recado.
# Só LEITURA do canal (fetch + reset --hard alinha o working tree; não envia).
# =============================================================================
set -uo pipefail
BRANCH="claude-comms"
DIR="$HOME/Projetos/p1fast-worktrees/comms"
cd "$DIR" || exit 1

latest_notebook() { ls -1 mensagens/*-de-notebook-para-imac.md 2>/dev/null | sort | tail -1; }

baseline="$(latest_notebook)"
echo "$(date -u +%H:%M:%SZ) vigia LIGADA. baseline=$(basename "${baseline:-nenhuma}")"

while true; do
  git fetch --quiet origin "$BRANCH" 2>/dev/null && git reset --quiet --hard "origin/$BRANCH" 2>/dev/null
  latest="$(latest_notebook)"
  if [ "$latest" != "$baseline" ]; then
    echo "🔔 $(date -u +%H:%M:%SZ) MENSAGEM NOVA DO NOTEBOOK: $(basename "$latest")"
    echo "-------------------------------------------------------------"
    cat "$latest"
    echo "-------------------------------------------------------------"
    echo ">>> vigia saindo pra sessão do iMac tratar o recado. Religar depois."
    exit 0
  fi
  sleep 60
done

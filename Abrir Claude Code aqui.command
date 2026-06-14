#!/bin/bash
# Abre o Claude Code ja dentro da pasta do projeto P1 Fast.
# Dois cliques aqui = comeca uma conversa com o Claude com este projeto como contexto.
cd "$(dirname "$0")" || exit 1
CLAUDE="/Users/imac/.local/bin/claude"
if [ ! -x "$CLAUDE" ]; then CLAUDE="$(command -v claude)"; fi
if [ -z "$CLAUDE" ]; then
  echo "Nao encontrei o Claude Code neste Mac. Avise o suporte."
  read -r -p "Pressione Enter para fechar."
  exit 1
fi
clear
echo "============================================"
echo "  Claude Code - projeto P1 Fast"
echo "  Pasta: $(pwd)"
echo "  Para SAIR do Claude: digite /exit (ou feche esta janela)."
echo "============================================"
echo
exec "$CLAUDE"

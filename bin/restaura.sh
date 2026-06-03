#!/usr/bin/env bash
# Restaura um carimbo aprovado por nome
# Uso: bin/restaura.sh <nome-do-carimbo>
# Pra listar: bin/restaura.sh

set -euo pipefail

ROOT="/Users/imac/Projetos/P1 Fast/.claude/worktrees/infallible-liskov-7a1b15"
APROVADOS="$ROOT/_design-reference/_aprovados"

cd "$ROOT"

if [ $# -eq 0 ]; then
  echo "Uso: bin/restaura.sh <nome-do-carimbo>"
  echo ""
  echo "Carimbos disponíveis:"
  ls "$APROVADOS" 2>/dev/null | grep -v '^INDICE.md$' | sort -r | sed 's/^/  /'
  exit 0
fi

NOME="$1"
DIR="$APROVADOS/$NOME"

if [ ! -d "$DIR" ]; then
  echo "❌ Carimbo não encontrado: $NOME"
  echo ""
  echo "Carimbos disponíveis:"
  ls "$APROVADOS" 2>/dev/null | grep -v '^INDICE.md$' | sort -r | sed 's/^/  /'
  exit 1
fi

# Backup do estado atual ANTES de restaurar — segurança extra
STAMP=$(date +%Y-%m-%d-%H%M%S)
mkdir -p "_design-reference/_pre-restauracao-$STAMP"
cp "_design-reference/MAPA-BRASILIA-DEFINITIVO.json" "_design-reference/_pre-restauracao-$STAMP/" 2>/dev/null || true
cp "_design-reference/PISTA-OFICIAL-brasilia.txt" "_design-reference/_pre-restauracao-$STAMP/" 2>/dev/null || true

# Restaura
cp "$DIR/MAPA-BRASILIA-DEFINITIVO.json" "_design-reference/MAPA-BRASILIA-DEFINITIVO.json"
cp "$DIR/PISTA-OFICIAL-brasilia.txt" "_design-reference/PISTA-OFICIAL-brasilia.txt"
chmod u+w "_design-reference/MAPA-BRASILIA-DEFINITIVO.json" "_design-reference/PISTA-OFICIAL-brasilia.txt"

echo "✅ Restaurado do carimbo: $NOME"
echo "   Backup do estado anterior: _design-reference/_pre-restauracao-$STAMP/"

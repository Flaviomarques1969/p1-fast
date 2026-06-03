#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# Sistema de Carimbo Aprovado — Camada definitiva contra perda
# ═══════════════════════════════════════════════════════════
# Uso:
#   bin/carimba.sh "descrição curta do estado aprovado"
#
# O que faz:
#   1. Cria pasta blindada _design-reference/_aprovados/AAAA-MM-DD-HHMM-desc/
#   2. Copia os arquivos sensíveis pra dentro
#   3. Define a pasta como somente-leitura (chmod -R a-w)
#   4. Cria uma etiqueta no histórico do projeto (git tag) com mesmo nome
#   5. Atualiza o índice _aprovados/INDICE.md
#   6. Registra na memória permanente do projeto
#
# IMPORTANTE: este script é a ÚNICA forma de criar carimbo. Não
# crie checkpoint manualmente — sempre passe por aqui.

set -euo pipefail

ROOT="/Users/imac/Projetos/P1 Fast/.claude/worktrees/infallible-liskov-7a1b15"
APROVADOS="$ROOT/_design-reference/_aprovados"
INDICE="$APROVADOS/INDICE.md"

cd "$ROOT"

# Descrição (pode vir como argumento)
DESC="${1:-estado-aprovado}"
DESC_SLUG=$(echo "$DESC" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9' '-' | sed 's/--*/-/g' | sed 's/^-//;s/-$//' | cut -c1-50)

STAMP=$(date +%Y-%m-%d-%H%M%S)
NOME="$STAMP-$DESC_SLUG"
DIR="$APROVADOS/$NOME"

echo "════════════════════════════════════════════════════════════"
echo "Carimbo aprovado: $NOME"
echo "Descrição: $DESC"
echo "════════════════════════════════════════════════════════════"

# 1. Cria pasta do carimbo
mkdir -p "$DIR"

# 2. Copia arquivos sensíveis do mapa
cp "_design-reference/MAPA-BRASILIA-DEFINITIVO.json" "$DIR/MAPA-BRASILIA-DEFINITIVO.json"
cp "_design-reference/PISTA-OFICIAL-brasilia.txt" "$DIR/PISTA-OFICIAL-brasilia.txt"

# 3. Manifesto do carimbo
cat > "$DIR/MANIFESTO.md" <<EOF
# Carimbo aprovado · $NOME

**Aprovado em:** $(date '+%Y-%m-%d %H:%M:%S')
**Descrição:** $DESC

## Arquivos preservados nesse carimbo

- \`MAPA-BRASILIA-DEFINITIVO.json\` — cadastro completo do circuito (pontos canônicos, linha de chegada, âncoras geográficas, parciais)
- \`PISTA-OFICIAL-brasilia.txt\` — desenho da pista (495 pontos do path SVG)

## Como restaurar este carimbo

\`\`\`bash
bin/restaura.sh $NOME
\`\`\`

## Origem (parâmetros conhecidos no momento da gravação)

Calibração registrada no JSON:
$(python3 -c "
import json
m = json.load(open('_design-reference/MAPA-BRASILIA-DEFINITIVO.json'))
meta = m.get('_meta', {})
print('- Calibrado em:', meta.get('calibrado_em', '(sem registro)'))
params = meta.get('calibracao_parametros', {})
if params:
    for k,v in params.items():
        print(f'- {k}: {v}')
" 2>/dev/null || echo '(metadados não disponíveis)')
EOF

# 4. Bloqueia a pasta — somente leitura recursivo
chmod -R a-w "$DIR"

# 5. Atualiza índice central
if [ ! -f "$INDICE" ]; then
  cat > "$INDICE" <<EOF
# Índice de Carimbos Aprovados — P1 Fast

Cada linha abaixo é um estado do projeto que o Flávio aprovou explicitamente.
**Pastas em modo somente-leitura.** Nunca devem ser modificadas.

Pra restaurar qualquer carimbo: \`bin/restaura.sh <nome>\`

---

EOF
  chmod u+w "$INDICE"
fi

# Trava o índice pra escrita só agora
chmod u+w "$INDICE" 2>/dev/null || true
{
  cat "$INDICE"
  echo "## $NOME"
  echo ""
  echo "- **Aprovado em:** $(date '+%Y-%m-%d %H:%M:%S')"
  echo "- **Descrição:** $DESC"
  echo "- **Pasta:** \`_design-reference/_aprovados/$NOME/\`"
  echo "- **Restaurar:** \`bin/restaura.sh $NOME\`"
  echo ""
  echo "---"
  echo ""
} > "$INDICE.tmp"
mv "$INDICE.tmp" "$INDICE"

# 6. Etiqueta no histórico do projeto (git tag) — se este projeto usa git
if git rev-parse --git-dir > /dev/null 2>&1; then
  git tag -f "aprovado-$NOME" 2>/dev/null && echo "Etiqueta no histórico do projeto: aprovado-$NOME"
fi

echo ""
echo "✅ Carimbo criado e blindado"
echo "   Pasta: $DIR"
echo "   Permissão: somente leitura"
echo "   Restaurar: bin/restaura.sh $NOME"
echo ""
echo "Total de carimbos aprovados:"
ls "$APROVADOS" | grep -v '^INDICE.md$' | wc -l | tr -d ' '

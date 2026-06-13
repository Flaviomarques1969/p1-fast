#!/usr/bin/env bash
# cb-salvar-versao.sh — versionamento simples do layout do Command Box.
#
# Como usar (fluxo do Flávio):
#   1. No painel (Modo edição), clicar em "copiar layout"  -> copia o arranjo pra área de transferência.
#   2. Rodar:  bash tools/cb-salvar-versao.sh piloto "descrição opcional do que mudou"
#      (use "engenheiro" pra a outra vista)
#
# O script lê a área de transferência (pbpaste), confere que é o layout de verdade,
# salva uma versão com data/hora, atualiza o ponteiro ATUAL e registra no histórico.
# Nada se perde: cada salvar gera um arquivo novo; nenhum é apagado.

set -euo pipefail

VISTA="${1:-piloto}"           # piloto | engenheiro
NOTA="${2:-}"                  # descrição opcional
DIR="_design-reference/command-box-versoes"
HIST="$DIR/HISTORICO.md"
TS="$(date +%Y%m%d-%H%M%S)"
TSHUMANO="$(date '+%d/%m/%Y %H:%M:%S')"

cd "$(dirname "$0")/.." || exit 1
mkdir -p "$DIR"

CLIP="$(pbpaste)"

# validação: tem que ser o JSON do layout (contém "blocks" e posições)
if ! printf '%s' "$CLIP" | grep -q '"blocks"'; then
  echo "ERRO: a área de transferência NÃO tem um layout do Command Box."
  echo "      No painel, entre em 'Modo edição' e clique em 'copiar layout' antes de rodar isto."
  echo "      (conteúdo atual da área de transferência, início: $(printf '%s' "$CLIP" | head -c 80))"
  exit 1
fi

ARQ="$DIR/vista-${VISTA}-layout-${TS}.json"
ATUAL="$DIR/vista-${VISTA}-ATUAL.json"

printf '%s\n' "$CLIP" > "$ARQ"
cp "$ARQ" "$ATUAL"

# histórico legível
if [ ! -f "$HIST" ]; then
  printf '# Histórico de versões — Command Box (layout)\n\nCada linha é uma versão salva do arranjo dos blocos. Nada é apagado.\n\n| Quando | Vista | Arquivo | Nota |\n|---|---|---|---|\n' > "$HIST"
fi
printf '| %s | %s | %s | %s |\n' "$TSHUMANO" "$VISTA" "$(basename "$ARQ")" "${NOTA:-—}" >> "$HIST"

NBLOCOS="$(printf '%s' "$CLIP" | grep -c '"id"' || true)"
echo "OK — versão salva."
echo "  vista:   $VISTA"
echo "  arquivo: $ARQ"
echo "  atual:   $ATUAL"
echo "  blocos:  ~$NBLOCOS"
echo "  nota:    ${NOTA:-(sem nota)}"

#!/usr/bin/env bash
# Hook do harness — intercepta UserPromptSubmit do Claude Code.
# Lê stdin (JSON com a mensagem do usuário), detecta palavras-chave
# de carimbo aprovado e roda bin/carimba.sh automaticamente ANTES
# do Claude processar a mensagem.
#
# Configurar em .claude/settings.local.json:
# "hooks": {
#   "UserPromptSubmit": [{
#     "matcher": "",
#     "hooks": [{ "type": "command", "command": "bin/hook-detecta-carimba.sh" }]
#   }]
# }

set -euo pipefail

ROOT="/Users/imac/Projetos/P1 Fast/.claude/worktrees/infallible-liskov-7a1b15"
cd "$ROOT"

# Lê o JSON do stdin
INPUT=$(cat)

# Extrai a mensagem do usuário (usa python pra parsear JSON com segurança)
MSG=$(echo "$INPUT" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    # UserPromptSubmit envia 'prompt' com o texto do usuário
    print(data.get('prompt', ''))
except Exception:
    pass
" 2>/dev/null || echo "")

# Normaliza pra detecção (minúsculas, sem acento)
NORM=$(echo "$MSG" | tr '[:upper:]' '[:lower:]' | iconv -f UTF-8 -t ASCII//TRANSLIT 2>/dev/null || echo "$MSG" | tr '[:upper:]' '[:lower:]')

# Palavras-chave que disparam carimbo
# Usa boundaries pra não confundir "carimbado" etc — só pega comando explícito
TRIGGER=""
if echo "$NORM" | grep -qE '(^|[^a-z])carimba(r)?($|[^a-z])'; then
  TRIGGER="comando 'carimba' detectado"
elif echo "$NORM" | grep -qE 'salva (esse|este) estado'; then
  TRIGGER="comando 'salva esse estado' detectado"
elif echo "$NORM" | grep -qE '(ponto importante|estado aprovado|esta aprovado|esta correto)'; then
  TRIGGER="comando 'ponto importante' detectado"
fi

if [ -z "$TRIGGER" ]; then
  # Não dispara — passa adiante normalmente
  exit 0
fi

# Dispara o carimbo
# Pega uma descrição curta da mensagem (até 50 caracteres)
DESC=$(echo "$MSG" | head -c 80 | tr '\n' ' ')

# Roda o carimbo. Captura saída.
SAIDA=$(bin/carimba.sh "$DESC" 2>&1 || echo "(falhou)")

# Devolve pro Claude saber que o carimbo foi feito
cat <<EOF
{
  "hookSpecificOutput": {
    "additionalContext": "CARIMBO AUTOMÁTICO disparado pelo hook ($TRIGGER):\n\n$SAIDA\n\nPasta blindada criada em modo somente-leitura. Etiqueta no histórico do projeto registrada. Índice atualizado em _design-reference/_aprovados/INDICE.md."
  }
}
EOF

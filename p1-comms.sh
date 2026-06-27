#!/usr/bin/env bash
# =============================================================================
# p1-comms — canal de comunicação entre as DUAS sessões Claude do P1 Fast
#            (iMac  <->  notebook), transportado pelo GitHub.
#
# Transporta SÓ mensagens. Vive num branch isolado ("claude-comms") que NÃO tem
# nada do código do app. Nunca toca a main, nunca dispara deploy/produção.
#
# Uso (rodar de DENTRO da pasta do canal):
#   ./p1-comms.sh ler                 -> puxa do GitHub e mostra mensagens novas
#   ./p1-comms.sh enviar "assunto"    -> escreve mensagem (corpo vem pela entrada/stdin) e publica
#   ./p1-comms.sh enviar "assunto" "corpo numa linha"
#   ./p1-comms.sh historico           -> lista todas as mensagens já trocadas
#   ./p1-comms.sh quem                -> mostra/define quem é esta ponta (imac|notebook)
#
# Quem é esta ponta: variável P1_COMMS_WHO (imac|notebook). Se não definida,
# o script tenta adivinhar pelo nome da máquina e, no fim, assume "imac".
# =============================================================================
set -euo pipefail

BRANCH="claude-comms"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# --- quem é esta ponta ---------------------------------------------------------
detect_who() {
  if [ -n "${P1_COMMS_WHO:-}" ]; then echo "$P1_COMMS_WHO"; return; fi
  if [ -f "$DIR/.quem-sou" ]; then cat "$DIR/.quem-sou"; return; fi
  local host; host="$(hostname 2>/dev/null | tr '[:upper:]' '[:lower:]')"
  case "$host" in
    *imac*|*mac*) echo "imac" ;;
    *note*|*win*|*pc*|*desktop*) echo "notebook" ;;
    *) echo "imac" ;;
  esac
}
WHO="$(detect_who)"
case "$WHO" in
  imac)     OUTRO="notebook" ;;
  notebook) OUTRO="imac" ;;
  *)        OUTRO="notebook" ;;
esac

remote_tem_branch() { git ls-remote --heads origin "$BRANCH" 2>/dev/null | grep -q "$BRANCH"; }

sincronizar() {
  if remote_tem_branch; then
    git fetch --quiet origin "$BRANCH"
    git reset --quiet --hard "origin/$BRANCH"
  fi
}

cmd_ler() {
  sincronizar
  local marca="$DIR/.ultima-leitura"
  local desde="1970-01-01"
  [ -f "$marca" ] && desde="$(cat "$marca")"
  echo "== Mensagens PARA mim ($WHO) =="
  local achou=0
  # mensagens destinadas a mim, ordenadas por nome (timestamp no nome)
  for f in $(ls -1 mensagens/*-para-"$WHO".md 2>/dev/null | sort); do
    achou=1
    echo ""
    echo "----- $f -----"
    cat "$f"
  done
  [ "$achou" = 0 ] && echo "(nenhuma mensagem para $WHO ainda)"
  # registra a leitura (marcador LOCAL, não versionado)
  date -u +"%Y-%m-%dT%H:%M:%SZ" > "$marca"
  echo ""
  echo "== fim =="
}

cmd_historico() {
  sincronizar
  echo "== Histórico completo do canal =="
  ls -1 mensagens/*.md 2>/dev/null | sort || echo "(vazio)"
}

cmd_enviar() {
  local assunto="${1:-sem-assunto}"
  local corpo="${2:-}"
  sincronizar
  local ts; ts="$(date -u +"%Y%m%dT%H%M%SZ")"
  # nome do arquivo carrega DE quem é e PARA quem vai (o destino é o "OUTRO")
  local slug; slug="$(echo "$assunto" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-' | cut -c1-40)"
  local arq="mensagens/${ts}-de-${WHO}-para-${OUTRO}.md"
  {
    echo "# ${assunto}"
    echo ""
    echo "- De: ${WHO}"
    echo "- Para: ${OUTRO}"
    echo "- Quando (UTC): ${ts}"
    echo ""
    echo "---"
    echo ""
    if [ -n "$corpo" ]; then
      echo "$corpo"
    elif [ ! -t 0 ]; then
      cat            # corpo veio pela entrada padrão (stdin)
    else
      echo "(sem corpo)"
    fi
  } > "$arq"
  git add -A
  git commit --quiet -m "msg ${WHO}->${OUTRO}: ${assunto}"
  if remote_tem_branch; then
    git pull --quiet --rebase origin "$BRANCH" || true
    git push --quiet origin "$BRANCH"
  else
    git push --quiet -u origin "$BRANCH"
  fi
  echo "Enviado: $arq"
}

case "${1:-}" in
  ler)        cmd_ler ;;
  historico)  cmd_historico ;;
  enviar)     shift; cmd_enviar "${1:-}" "${2:-}" ;;
  quem)       echo "Esta ponta = $WHO (fala com $OUTRO)" ;;
  *)
    echo "uso: $0 {ler|enviar \"assunto\" [\"corpo\"]|historico|quem}"
    echo "esta ponta = $WHO  ->  outra ponta = $OUTRO"
    ;;
esac

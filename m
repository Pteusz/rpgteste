#!/usr/bin/env bash
# m — ciclo mínimo de missões: ponteiro, teste travado, commit a cada verde.
# Uso: ./m novo "fazendo" "para quê" | travar | check | fechar | voltar [--sim] | status
set -u

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$RAIZ" || exit 1

# shellcheck disable=SC1091
[ -f .mestre.conf ] && . ./.mestre.conf
TESTE_CMD="${TESTE_CMD:-echo 'defina TESTE_CMD em .mestre.conf' && false}"
TESTE_DIR="${TESTE_DIR:-tests}"

MISSAO="MISSAO.md"
TRAVA=".mestre.trava"

sha() { if command -v sha256sum >/dev/null; then sha256sum; else shasum -a 256; fi; }

hash_testes() {
  [ -d "$TESTE_DIR" ] || { echo "vazio"; return; }
  find "$TESTE_DIR" -type f ! -name '*.pyc' ! -path '*/__pycache__/*' -print0 \
    | sort -z | xargs -0 cat 2>/dev/null | sha | cut -d' ' -f1
}

campo() { grep -m1 "^$1:" "$MISSAO" 2>/dev/null | sed "s/^$1: *//"; }

set_campo() {
  local k="$1" v="$2"
  sed -i.bak "s|^$k:.*|$k: $v|" "$MISSAO" && rm -f "$MISSAO.bak"
}

garantir_git() {
  if ! git rev-parse --git-dir >/dev/null 2>&1; then
    git init -q && git add -A && git commit -q -m "estado inicial" --allow-empty
    git tag save/M000 2>/dev/null
    echo "git iniciado (save/M000)"
  fi
}

proximo_id() {
  local n
  n=$(git tag -l 'save/M*' 2>/dev/null | sed 's|save/M||' | sort -n | tail -1)
  printf "M%03d" $(( 10#${n:-0} + 1 ))
}

rodar_teste() { bash -c "$TESTE_CMD"; }

cmd_novo() {
  [ $# -eq 3 ] || { echo 'uso: ./m novo "fazendo X" "para Y" "pronto quando Z"'; exit 1; }
  garantir_git
  local st; st="$(campo status)"
  if [ -n "$st" ] && [ "$st" != "fechada" ]; then
    echo "missão $(campo id) ainda está '$st'. Feche (./m fechar) ou descarte (rm MISSAO.md .mestre.trava)."
    exit 1
  fi
  cat > "$MISSAO" <<EOF
id: $(proximo_id)
fazendo: $1
para: $2
pronto_quando: $3
base: $(git rev-parse --short HEAD)
status: aberta
EOF
  rm -f "$TRAVA"
  echo "missão $(campo id) aberta."
  echo "próximo: escreva o teste em $TESTE_DIR/ e rode ./m travar"
}

cmd_travar() {
  [ -f "$MISSAO" ] || { echo "sem missão. Use ./m novo"; exit 1; }
  [ "$(campo status)" = "aberta" ] || { echo "só se trava missão 'aberta' (está '$(campo status)')"; exit 1; }
  if rodar_teste >/dev/null 2>&1; then
    echo "AVISO: os testes já passam. Um teste que nasce verde não prova nada."
    echo "Escreva um teste que falhe agora, ou use ./m travar --forcar"
    [ "${1:-}" = "--forcar" ] || exit 1
  fi
  hash_testes > "$TRAVA"
  set_campo status em_andamento
  echo "teste travado (falha como esperado). Missão em andamento."
  echo "Agora implemente. Não edite $TESTE_DIR/. Rode ./m check a cada passo."
}

verificar_trava() {
  if [ -f "$TRAVA" ] && [ "$(cat "$TRAVA")" != "$(hash_testes)" ]; then
    echo "BLOQUEADO: arquivos em $TESTE_DIR/ mudaram depois de travar."
    echo "Se foi o agente, reverta (git checkout -- $TESTE_DIR). Se a fronteira estava errada,"
    echo "descarte a missão e abra outra com o teste corrigido."
    return 1
  fi
}

cmd_check() {
  [ -f "$MISSAO" ] || { echo "sem missão. Use ./m novo"; exit 1; }
  verificar_trava || exit 2
  if rodar_teste; then
    [ "$(campo status)" = "em_andamento" ] && set_campo status verde
    echo "VERDE. Pode fechar com ./m fechar"
  else
    echo "VERMELHO."
    exit 1
  fi
}

cmd_fechar() {
  [ -f "$MISSAO" ] || { echo "sem missão."; exit 1; }
  case "$(campo status)" in
    em_andamento|verde) ;;
    *) echo "missão está '$(campo status)'; só fecha depois de travar o teste."; exit 1 ;;
  esac
  verificar_trava || exit 2
  rodar_teste || { echo "VERMELHO: não fecha."; exit 1; }
  local id; id="$(campo id)"
  set_campo status fechada
  rm -f "$TRAVA"
  git add -A
  git commit -q -m "$id: $(campo fazendo)" --allow-empty
  git tag -f "save/$id" >/dev/null
  echo "$id fechada. Save point: save/$id"
  if [ "${PUSH:-0}" = "1" ] && git remote | grep -q .; then
    git push -q origin HEAD && git push -q origin "save/$id" && echo "enviado ao remoto (commit + tag)" \
      || echo "AVISO: push falhou; o save existe só localmente."
  fi
  echo "Pendências que surgiram? Anote em PENDENCIAS.md. Depois: ./m novo ..."
}

cmd_voltar() {
  local alvo; alvo="$(git tag -l 'save/M*' | sort -V | tail -1)"
  [ -n "$alvo" ] || { echo "sem save points."; exit 1; }
  echo "último save: $alvo"
  git status --short
  if [ "${1:-}" = "--sim" ]; then
    git reset --hard "$alvo" && git clean -fd -q
    rm -f "$TRAVA"
    echo "restaurado para $alvo"
  else
    echo "isso descarta tudo acima. Para confirmar: ./m voltar --sim"
  fi
}

cmd_status() {
  [ -f "$MISSAO" ] && cat "$MISSAO" || echo "sem missão ativa."
  [ -f "$TRAVA" ] && echo "(teste travado)"
  return 0
}

case "${1:-status}" in
  novo)   shift; cmd_novo "$@" ;;
  travar) shift; cmd_travar "$@" ;;
  check)  cmd_check ;;
  fechar) cmd_fechar ;;
  voltar) shift; cmd_voltar "$@" ;;
  status) cmd_status ;;
  *) echo "comandos: novo | travar | check | fechar | voltar | status"; exit 1 ;;
esac

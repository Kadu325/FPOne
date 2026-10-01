#!/bin/sh
# garage-init.sh — Bootstrap idempotente do Garage (nó único).
# Executa uma vez; cria layout, bucket e chave de acesso se não existirem.
# Requer: GARAGE_BUCKET, GARAGE_ADMIN_URL, GARAGE_ADMIN_TOKEN, GARAGE_KEY_NAME.
# Exporta: GARAGE_ACCESS_KEY_ID, GARAGE_SECRET_ACCESS_KEY (via /run/garage-secrets)
set -eu

: "${GARAGE_BUCKET:=fpone-files}"
: "${GARAGE_ADMIN_URL:=http://garage:3903}"
: "${GARAGE_ADMIN_TOKEN:?GARAGE_ADMIN_TOKEN é obrigatório}"
: "${GARAGE_KEY_NAME:=fpone-app}"
: "${GARAGE_LAYOUT_ZONE:=dc1}"
: "${GARAGE_LAYOUT_CAPACITY:=1G}"

SECRETS_FILE="/run/garage-secrets/garage.env"
AUTH_HEADER="Authorization: Bearer ${GARAGE_ADMIN_TOKEN}"

wait_garage() {
  echo "[garage-init] Aguardando Garage API Admin ($GARAGE_ADMIN_URL)..."
  i=0
  until curl -sf -H "${AUTH_HEADER}" "${GARAGE_ADMIN_URL}/v1/status" > /dev/null 2>&1; do
    i=$((i+1))
    if [ "$i" -ge 30 ]; then
      echo "[garage-init] ERRO: Garage não respondeu após 30 tentativas."
      exit 1
    fi
    sleep 2
  done
  echo "[garage-init] Garage disponível."
}

configure_layout() {
  echo "[garage-init] Verificando layout do cluster..."
  # Obtém o ID do nó local
  NODE_ID=$(curl -sf -H "${AUTH_HEADER}" "${GARAGE_ADMIN_URL}/v1/status" \
    | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ -z "$NODE_ID" ]; then
    echo "[garage-init] ERRO: Não foi possível obter o ID do nó."
    exit 1
  fi

  # Verifica se o layout já está configurado (tem roles atribuídas)
  LAYOUT_RESP=$(curl -sf -H "${AUTH_HEADER}" "${GARAGE_ADMIN_URL}/v1/layout")
  if echo "$LAYOUT_RESP" | grep -q "\"$NODE_ID\""; then
    echo "[garage-init] Layout já configurado para nó $NODE_ID."
    return 0
  fi

  echo "[garage-init] Configurando layout para nó $NODE_ID..."
  curl -sf -X POST \
    -H "${AUTH_HEADER}" \
    -H "Content-Type: application/json" \
    -d "[{\"id\":\"${NODE_ID}\",\"zone\":\"${GARAGE_LAYOUT_ZONE}\",\"capacity\":\"${GARAGE_LAYOUT_CAPACITY}\"}]" \
    "${GARAGE_ADMIN_URL}/v1/layout" > /dev/null

  # Obtém versão atual do layout para aplicar
  LAYOUT_VER=$(curl -sf -H "${AUTH_HEADER}" "${GARAGE_ADMIN_URL}/v1/layout" \
    | grep -o '"version":[0-9]*' | head -1 | cut -d: -f2)
  NEXT_VER=$((LAYOUT_VER + 1))

  curl -sf -X POST \
    -H "${AUTH_HEADER}" \
    -H "Content-Type: application/json" \
    -d "{\"version\":${NEXT_VER}}" \
    "${GARAGE_ADMIN_URL}/v1/layout/apply" > /dev/null

  echo "[garage-init] Layout v${NEXT_VER} aplicado."
}

ensure_bucket() {
  echo "[garage-init] Verificando bucket '${GARAGE_BUCKET}'..."
  if curl -sf -H "${AUTH_HEADER}" "${GARAGE_ADMIN_URL}/v1/bucket?globalAlias=${GARAGE_BUCKET}" > /dev/null 2>&1; then
    echo "[garage-init] Bucket '${GARAGE_BUCKET}' já existe."
  else
    echo "[garage-init] Criando bucket '${GARAGE_BUCKET}'..."
    curl -sf -X POST \
      -H "${AUTH_HEADER}" \
      -H "Content-Type: application/json" \
      -d "{\"globalAlias\":\"${GARAGE_BUCKET}\"}" \
      "${GARAGE_ADMIN_URL}/v1/bucket" > /dev/null
    echo "[garage-init] Bucket '${GARAGE_BUCKET}' criado."
  fi
}

ensure_key() {
  echo "[garage-init] Verificando chave '${GARAGE_KEY_NAME}'..."
  mkdir -p "$(dirname "$SECRETS_FILE")"

  # Procura chave existente pelo nome
  KEYS_RESP=$(curl -sf -H "${AUTH_HEADER}" "${GARAGE_ADMIN_URL}/v1/key?list")
  KEY_ID=$(echo "$KEYS_RESP" | grep -B1 "\"name\":\"${GARAGE_KEY_NAME}\"" \
    | grep -o '"id":"[^"]*"' | cut -d'"' -f4 || true)

  if [ -n "$KEY_ID" ]; then
    echo "[garage-init] Chave '${GARAGE_KEY_NAME}' já existe (id=${KEY_ID})."
    # Recupera secret existente (possível só via arquivo de secrets já gravado)
    if [ -f "$SECRETS_FILE" ]; then
      echo "[garage-init] Usando secrets previamente gravados."
      return 0
    fi
    # Sem arquivo: re-obtém detalhes da chave (secret não é exposto na API de listagem)
    echo "[garage-init] AVISO: Arquivo de secrets não encontrado. Recriando chave..."
    curl -sf -X DELETE \
      -H "${AUTH_HEADER}" \
      "${GARAGE_ADMIN_URL}/v1/key?id=${KEY_ID}" > /dev/null
  fi

  echo "[garage-init] Criando chave de acesso '${GARAGE_KEY_NAME}'..."
  KEY_RESP=$(curl -sf -X POST \
    -H "${AUTH_HEADER}" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${GARAGE_KEY_NAME}\"}" \
    "${GARAGE_ADMIN_URL}/v1/key")

  ACCESS_KEY=$(echo "$KEY_RESP" | grep -o '"accessKeyId":"[^"]*"' | cut -d'"' -f4)
  SECRET_KEY=$(echo "$KEY_RESP" | grep -o '"secretAccessKey":"[^"]*"' | cut -d'"' -f4)

  if [ -z "$ACCESS_KEY" ] || [ -z "$SECRET_KEY" ]; then
    echo "[garage-init] ERRO: Não foi possível extrair as credenciais da chave criada."
    exit 1
  fi

  # Permissão de leitura/escrita no bucket
  BUCKET_ID=$(curl -sf -H "${AUTH_HEADER}" "${GARAGE_ADMIN_URL}/v1/bucket?globalAlias=${GARAGE_BUCKET}" \
    | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  curl -sf -X POST \
    -H "${AUTH_HEADER}" \
    -H "Content-Type: application/json" \
    -d "{\"bucketId\":\"${BUCKET_ID}\",\"accessKeyId\":\"${ACCESS_KEY}\",\"permissions\":{\"read\":true,\"write\":true,\"owner\":false}}" \
    "${GARAGE_ADMIN_URL}/v1/bucket/allow" > /dev/null

  printf "GARAGE_ACCESS_KEY_ID=%s\nGARAGE_SECRET_ACCESS_KEY=%s\n" \
    "$ACCESS_KEY" "$SECRET_KEY" > "$SECRETS_FILE"
  echo "[garage-init] Chave criada e permissões concedidas. Secrets gravados em ${SECRETS_FILE}."
}

wait_garage
configure_layout
ensure_bucket
ensure_key

echo "[garage-init] Bootstrap concluído."

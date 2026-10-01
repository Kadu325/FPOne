#!/bin/sh
# Backup diário: pg_dump do banco + espelho do bucket S3 (Garage).
# Variáveis: BACKUP_HOUR (0-23, fuso TZ), BACKUP_RETENTION_DAYS, PG*, S3_*.
# Garage é compatível com S3; provider rclone = S3 (em vez de "Minio").
# Nunca imprime segredos.
set -eu

: "${BACKUP_HOUR:=2}"
: "${BACKUP_RETENTION_DAYS:=14}"
: "${BACKUP_DIR:=/backups}"

run_backup() {
  stamp="$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$BACKUP_DIR/db" "$BACKUP_DIR/storage"

  echo "[backup] $stamp: iniciando pg_dump"
  pg_dump --format=custom --file="$BACKUP_DIR/db/fpone-$stamp.dump.partial"
  mv "$BACKUP_DIR/db/fpone-$stamp.dump.partial" "$BACKUP_DIR/db/fpone-$stamp.dump"

  echo "[backup] $stamp: espelhando bucket $S3_BUCKET via Garage S3"
  # Provider "Other" com endpoint customizado é o modo correto para Garage no rclone;
  # "Minio" funciona mas provoca avisos sobre presigned URL que o Garage não precisa.
  RCLONE_CONFIG_S3_TYPE=s3 \
  RCLONE_CONFIG_S3_PROVIDER=Other \
  RCLONE_CONFIG_S3_ENDPOINT="$S3_ENDPOINT" \
  RCLONE_CONFIG_S3_ACCESS_KEY_ID="$S3_ACCESS_KEY" \
  RCLONE_CONFIG_S3_SECRET_ACCESS_KEY="$S3_SECRET_KEY" \
  RCLONE_CONFIG_S3_REGION=garage \
  RCLONE_CONFIG_S3_FORCE_PATH_STYLE=true \
    rclone sync "s3:$S3_BUCKET" "$BACKUP_DIR/storage/$S3_BUCKET" --quiet

  echo "[backup] $stamp: removendo dumps com mais de $BACKUP_RETENTION_DAYS dias"
  find "$BACKUP_DIR/db" -name 'fpone-*.dump' -mtime +"$BACKUP_RETENTION_DAYS" -delete
  echo "[backup] $stamp: concluído"
}

if [ "${1:-}" = "--now" ]; then
  run_backup
  exit 0
fi

echo "[backup] agendado diariamente às ${BACKUP_HOUR}h (TZ=${TZ:-UTC}), retenção de ${BACKUP_RETENTION_DAYS} dias"
last_day=""
while true; do
  hour="$(date +%-H)"
  day="$(date +%Y%m%d)"
  if [ "$hour" -eq "$BACKUP_HOUR" ] && [ "$day" != "$last_day" ]; then
    if run_backup; then last_day="$day"; else echo "[backup] FALHOU; nova tentativa em 5 min"; fi
  fi
  sleep 300
done

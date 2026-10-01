#!/bin/sh
set -e

# Se DATABASE_URL estiver presente, tenta aplicar as migrations pendentes com o Prisma 7
if [ -n "$DATABASE_URL" ]; then
  echo "==> [FPOne] Verificando e aplicando migrações do banco de dados (Prisma)..."
  if command -v prisma >/dev/null 2>&1; then
    PRISMA_HIDE_UPDATE_MESSAGE=1 prisma migrate deploy || echo "==> [FPOne] Aviso: Migrações não puderam ser aplicadas automaticamente."
  elif [ -f "./node_modules/.bin/prisma" ]; then
    PRISMA_HIDE_UPDATE_MESSAGE=1 ./node_modules/.bin/prisma migrate deploy || echo "==> [FPOne] Aviso: Migrações não puderam ser aplicadas automaticamente."
  fi
fi

echo "==> [FPOne] Iniciando servidor Next.js..."
exec "$@"

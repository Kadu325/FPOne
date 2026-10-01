# ==============================================================================
# FPOne Intranet - Dockerfile de Produção (Next.js 16 Standalone + Prisma 7)
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Dependências do Projeto e Prisma Engine
# ------------------------------------------------------------------------------
FROM node:22-slim AS deps
WORKDIR /app

# Instala OpenSSL e certificados para suporte nativo ao Prisma Client no Debian
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma

# Instalação limpa e geração do Prisma Client
RUN npm ci --ignore-scripts && npm rebuild && npx prisma generate && npm install -g prisma@7.10.0

# ------------------------------------------------------------------------------
# 2. Stage Tools (Migrations, Seeds e Operações CLI)
# ------------------------------------------------------------------------------
FROM node:22-slim AS tools
WORKDIR /app

RUN apt-get update -y && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

# ------------------------------------------------------------------------------
# 3. Compilação da Aplicação Next.js
# ------------------------------------------------------------------------------
FROM node:22-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_COMPANY_NAME="Fazenda Progresso"
ARG NEXT_PUBLIC_APP_ENV="production"
ENV NEXT_PUBLIC_COMPANY_NAME=$NEXT_PUBLIC_COMPANY_NAME \
    NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src/generated ./src/generated
COPY . .

RUN npm run build

# ------------------------------------------------------------------------------
# 4. Imagem Final de Execução (Runtime Seguro com Usuário Não-Root)
# ------------------------------------------------------------------------------
FROM node:22-slim AS runtime
WORKDIR /app

RUN apt-get update -y && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Copia o Prisma CLI global e suas dependências completas pré-instaladas no deps
COPY --from=deps /usr/local/lib/node_modules/prisma /usr/local/lib/node_modules/prisma
RUN ln -sf /usr/local/lib/node_modules/prisma/build/index.js /usr/local/bin/prisma

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NODE_PATH="/usr/local/lib/node_modules" \
    PRISMA_HIDE_UPDATE_MESSAGE=1

# Copia os artefatos de build standalone gerados pelo Next.js
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./prisma.config.ts

# Copia o entrypoint para execução de migrations e startup seguro
COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]

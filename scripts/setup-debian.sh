#!/usr/bin/env bash
# ==============================================================================
# FPOne Intranet - Script de Instalação e Inicialização Automatizada para Debian
# ==============================================================================
# Suporta: Debian 12 (Bookworm) e Debian 11 (Bullseye)
# Execução: sudo bash scripts/setup-debian.sh
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # Sem cor

log() { echo -e "${BLUE}[FPOne]${NC} $1"; }
log_success() { echo -e "${GREEN}[FPOne - SUCESSO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[FPOne - AVISO]${NC} $1"; }
log_error() { echo -e "${RED}[FPOne - ERRO]${NC} $1"; }

if [ "$EUID" -ne 0 ]; then
  log_error "Este script precisa ser executado com privilégios de root (use sudo)."
  exit 1
fi

log "Iniciando preparação do ambiente Debian Linux para o FPOne Intranet..."

# ------------------------------------------------------------------------------
# 1. Atualização e Instalação de Pacotes Essenciais
# ------------------------------------------------------------------------------
log "Atualizando repositórios APT e instalando pré-requisitos..."
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  gnupg \
  git \
  openssl \
  ufw

# ------------------------------------------------------------------------------
# 2. Instalação Oficial do Docker Engine & Docker Compose Plugin
# ------------------------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  log "Instalando Docker Engine a partir do repositório oficial da Docker..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
  chmod a+r /etc/apt/keyrings/docker.gpg

  VERSION_CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME")
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
    ${VERSION_CODENAME} stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  systemctl enable docker
  systemctl start docker
  log_success "Docker Engine e Docker Compose instalados com sucesso!"
else
  log "Docker já está instalado no sistema. Continuando..."
fi

# ------------------------------------------------------------------------------
# 3. Configuração de Firewall UFW
# ------------------------------------------------------------------------------
if ufw status | grep -qw "active"; then
  log "Ajustando regras de firewall no UFW..."
  ufw allow 22/tcp comment 'SSH' || true
  ufw allow 80/tcp comment 'HTTP FPOne' || true
  ufw allow 443/tcp comment 'HTTPS FPOne' || true
  ufw allow 8080/tcp comment 'Traefik Dashboard' || true
  ufw allow 9001/tcp comment 'MinIO Console' || true
  ufw reload || true
  log_success "Regras de firewall configuradas!"
fi

# ------------------------------------------------------------------------------
# 4. Geração Automática do Arquivo .env Seguro
# ------------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

if [ ! -f ".env" ]; then
  log "Arquivo .env não encontrado. Criando a partir de .env.example com segredos criptográficos..."
  cp .env.example .env

  # Gera senhas e segredos criptograficamente fortes
  AUTH_SECRET=$(openssl rand -hex 32)
  CPF_PEPPER=$(openssl rand -hex 32)
  POSTGRES_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)

  sed -i "s|AUTH_SECRET=.*|AUTH_SECRET=${AUTH_SECRET}|g" .env
  sed -i "s|CPF_PEPPER=.*|CPF_PEPPER=${CPF_PEPPER}|g" .env
  sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASS}|g" .env
  sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://fpone:${POSTGRES_PASS}@db:5432/fpone|g" .env

  log_success "Arquivo .env configurado com credenciais seguras geradas automaticamente!"
else
  log "Arquivo .env existente detectado. Mantendo as credenciais atuais."
fi

# ------------------------------------------------------------------------------
# 5. Inicialização da Stack via Docker Compose
# ------------------------------------------------------------------------------
log "Construindo imagens e subindo os containers da stack FPOne..."
docker compose pull db minio minio-init proxy || true
docker compose up -d --build

log_success "Stack FPOne iniciada com sucesso!"

# ------------------------------------------------------------------------------
# 6. Sumário de Acesso Administrativo
# ------------------------------------------------------------------------------
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "IP_DO_SERVIDOR")

echo ""
echo "================================================================================"
echo "          FPOne Intranet - Instalação e Inicialização Concluídas                "
echo "================================================================================"
echo "Serviços disponíveis:"
echo "  - Portal FPOne Intranet: http://${SERVER_IP} (ou http://localhost)"
echo "  - MinIO Storage Console: http://${SERVER_IP}:9001"
echo "  - Traefik Proxy Dash:   http://${SERVER_IP}:8080/dashboard/"
echo ""
echo "Credenciais do Usuário Local de Administração:"
echo "  - Aplicação (FPOne):    Login: admin  |  Senha: Admin@FPOne2026!"
echo "  - MinIO Console:        Login: admin  |  Senha: Admin@FPOne2026!"
echo "  - Traefik Dashboard:    Login: admin  |  Senha: Admin@FPOne2026!"
echo ""
echo "Comandos úteis para manutenção:"
echo "  - Ver status dos serviços:  docker compose ps"
echo "  - Ver logs em tempo real:   docker compose logs -f"
echo "  - Parar os serviços:        docker compose down"
echo "  - Reiniciar os serviços:    docker compose restart"
echo "================================================================================"

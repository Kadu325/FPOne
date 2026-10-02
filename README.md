# FPOne Intranet

> Portal corporativo e *Digital Workplace* moderno, modular e seguro para o agronegócio (Fazenda Progresso), conectando colaboradores de escritório e campo (mobile-first).

---

## 1. Visão Geral e Arquitetura

O **FPOne Intranet** centraliza a comunicação corporativa, diretório de pessoas, acervo de documentos, agenda de eventos, catálogo de links/sistemas internos e indicadores executivos.

A aplicação opera de forma autônoma em um **servidor dedicado Debian Linux**, orquestrada via **Docker Compose**, utilizando **MinIO** como motor de armazenamento S3 e **Traefik v3** como proxy reverso com gerenciamento visual, SSL/TLS automático e roteamento inteligente.

### Arquitetura da Solução

```mermaid
graph TD
    User([Colaboradores Web/Mobile]) -->|Portas 80 / 443 HTTP/HTTPS| Traefik[Proxy Reverso Traefik v3]
    Admin([Administrador TI]) -->|Porta 8080 /dashboard/| TraefikDash[Traefik Dashboard]
    Admin -->|Porta 9001 /| MinIOConsole[MinIO Web Console]
    
    subgraph Servidor Dedicado Debian Linux
        Traefik -->|Roteamento /| Web[App FPOne - Next.js 16 Standalone :3000]
        Traefik -->|Roteamento /{S3_BUCKET}/*| MinIO[MinIO S3 Storage :9000]
        
        Web -->|Consultas SQL| DB[(PostgreSQL 16 :5432)]
        Web -->|Upload / Assinatura S3| MinIO
        Web -->|Validação Credenciais| AD[Active Directory / LDAP]
        
        MinIOInit[MinIO Init / mc] -.->|Criação Idempotente do Bucket| MinIO
        Backup[Serviço Backup Diário] -->|pg_dump| DB
        Backup -->|rclone S3 sync| MinIO
    end
```

### Stack Tecnológica
* **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons, TipTap Rich Text Editor.
* **Backend**: Server Actions, Route Handlers, Zod Validation.
* **Proxy Reverso & Gerenciamento**: Traefik v3 com Dashboard visual, suporte a HTTP/3, WebSockets e emissão automática de SSL/TLS (Let's Encrypt).
* **Armazenamento de Arquivos**: MinIO Object Storage (API AWS S3 compatível) com console gráfico na porta `9001` e inicialização idempotente automatizada (`minio/mc`).
* **Banco de Dados**: PostgreSQL 16 com Prisma ORM 7 e migrações versionadas.
* **Autenticação & Sessão**: Auth.js v5 (NextAuth) com suporte a Active Directory (LDAP corporativo via `ldapts`), controle estrito de sessão e fallback seguro para Administrador Local.
* **Autorização (RBAC & Audiência)**: Matriz estrita de permissões no servidor (`can()`) e filtro de confidencialidade por público-alvo (`audienceFilter()`).
* **Orquestração**: Docker Compose com suporte a Debian 12 (Bookworm) e Debian 11 (Bullseye).

---

## 2. Usuários Locais de Administração (Gerenciamento da Ferramenta)

Para garantir acesso imediato e total controle operacional em manutenções ou caso serviços externos (como o Active Directory) estejam indisponíveis, a stack conta com usuários locais de administração pré-configurados:

| Ferramenta / Serviço | Interface de Acesso | Usuário Padrão | Senha Padrão / Variável | Finalidade |
|---|---|---|---|---|
| **Portal FPOne Intranet** | `http://<ip-servidor>/login` | `admin` | `Admin@FPOne2026!` (`MASTER_ADMIN_PASSWORD`) | Super Administrador da Intranet (Acesso total às 17 permissões do sistema) |
| **MinIO Storage Console** | `http://<ip-servidor>:9001` | `admin` | `Admin@FPOne2026!` (`MINIO_ROOT_PASSWORD`) | Console Web de arquivos S3, buckets, cotas e chaves de acesso |
| **Traefik Dashboard** | `http://<ip-servidor>:8080/dashboard/` | `admin` | `Admin@FPOne2026!` (`TRAEFIK_BASIC_AUTH`) | Painel visual de rotas, middlewares, integridade e certificados SSL |
| **Banco PostgreSQL** | `db:5432` (interno) | `fpone` | Definida em `.env` (`POSTGRES_PASSWORD`) | Administrador do banco de dados relacional |

> 💡 **Nota de Segurança**: É altamente recomendado alterar as senhas padrões no arquivo `.env` antes de colocar o ambiente em produção pública.

---

## 3. Como Subir a Aplicação no Servidor Debian Linux

### Método A: Instalação Automatizada (Recomendado)

Disponibilizamos um script que realiza toda a preparação do Debian 12 ou 11 (instalação do Docker oficial, Docker Compose, regras de firewall UFW, geração de `.env` com senhas fortes e inicialização dos containers):

```bash
# 1. No servidor Debian, clone o repositório
git clone https://github.com/Kadu325/FPOne.git /opt/fpone
cd /opt/fpone

# 2. Execute o instalador automatizado com privilégios de root
sudo bash scripts/setup-debian.sh
```

---

### Método B: Instalação Manual Passo a Passo

Caso prefira executar o processo manualmente:

#### 1. Instalar o Docker Engine e Docker Compose no Debian
```bash
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg git openssl ufw

# Adicionar repositório oficial da Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

#### 2. Configurar as Portas no Firewall UFW
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (Traefik)
sudo ufw allow 443/tcp   # HTTPS (Traefik)
sudo ufw allow 8080/tcp  # Traefik Dashboard
sudo ufw allow 9001/tcp  # MinIO Console
sudo ufw reload
```

#### 3. Clonar o Projeto e Configurar o `.env`
```bash
git clone https://github.com/Kadu325/FPOne.git /opt/fpone
cd /opt/fpone

# Copiar arquivo de exemplo
cp .env.example .env

# Gerar segredos criptográficos obrigatórios
sed -i "s|AUTH_SECRET=.*|AUTH_SECRET=$(openssl rand -hex 32)|g" .env
sed -i "s|CPF_PEPPER=.*|CPF_PEPPER=$(openssl rand -hex 32)|g" .env
```

Edite o arquivo `.env` (`nano .env`) e configure os parâmetros específicos do seu ambiente (ex: `APP_DOMAIN`, parâmetros do Active Directory/LDAP e e-mail do Let's Encrypt).

#### 4. Inicializar os Serviços
```bash
docker compose up -d --build
```

O Docker Compose inicializará:
1. `db`: Banco PostgreSQL 16 com volume persistente `db-data`.
2. `minio`: Storage S3 com volume persistente `minio-data` e console visual na porta `9001`.
3. `minio-init`: Inicializador automático que cria o bucket `fpone-files` como privado e encerra com código 0.
4. `web`: Aplicação Next.js 16 standalone que executa migrações do Prisma automaticamente no startup.
5. `proxy`: Traefik v3 roteando portas 80/443, emitindo certificados SSL e expondo dashboard na porta 8080.
6. `backup`: Cron diário para dump do Postgres e sincronização S3 via rclone.

---

## 4. Gerenciamento e Operação da Stack

### Verificar o Status dos Serviços
```bash
docker compose ps
```

### Visualizar Logs em Tempo Real
```bash
# Todos os serviços
docker compose logs -f

# Apenas a aplicação Web
docker compose logs -f web

# Apenas o Proxy Traefik
docker compose logs -f proxy

# Apenas o Storage MinIO
docker compose logs -f minio
```

### Reiniciar ou Atualizar a Aplicação
```bash
# Atualizar código via Git e recriar o container web
git pull origin main
docker compose up -d --build web
```

### Operações Administrativas via Profile `tools`
Para rodar comandos Prisma ou scripts administrativos sem instalar Node.js no host Debian:

```bash
# Aplicar novas migrações
docker compose run --rm tools npm run db:deploy

# Promover um colaborador por matrícula a Administrador
docker compose run --rm tools npm run admin:bootstrap -- --matricula 000123

# Executar backup imediatamente sob demanda
docker compose exec backup /backup.sh --now
```

---

## 5. Desenvolvimento e Validação Local

Para executar o projeto localmente em máquina de desenvolvimento:

```bash
# Instalar dependências
npm.cmd install

# Gerar cliente Prisma
npx.cmd prisma generate

# Executar bateria de 255 testes automatizados (100% de sucesso)
npm.cmd test

# Validar tipagem estrita com TypeScript
npm.cmd run typecheck

# Iniciar servidor local
npm.cmd run dev
```

---

## 6. Estrutura do Repositório

```text
├── .dockerignore
├── .env.example                 # Modelo de configuração com Traefik e MinIO
├── .gitignore
├── compose.yaml                 # Orquestração completa de produção (Traefik, MinIO, DB, Web)
├── Dockerfile                   # Build multi-stage standalone seguro
├── docker-entrypoint.sh         # Migração automática no startup
├── docker/
│   └── backup/                  # Rotina de backup diário Postgres + S3
├── scripts/
│   ├── setup-debian.sh          # Script de instalação automatizada para Debian Linux
│   └── admin-bootstrap.ts       # Script CLI para promoção de administradores
├── prisma/
│   ├── schema.prisma            # Schema relacional corporativo
│   └── migrations/              # Migrações versionadas do banco de dados
├── src/
│   ├── app/                     # Rotas do Next.js 16 (App Router)
│   ├── components/              # Componentes de UI e Layout (ONE Design System)
│   ├── modules/                 # Regras de negócio e serviços de domínio
│   ├── server/                  # Auth.js, LDAP AD, Authz (can/audience) e Audit
│   ├── lib/                     # Utilitários, constantes e validação de env
│   └── styles/                  # Tokens de design e contraste WCAG 2.2 AA
└── tests/                       # 33 suítes de testes unitários e de integração
```

---

## 7. Licença e Uso
Uso interno corporativo — Projeto FPOne Intranet (Fazenda Progresso).

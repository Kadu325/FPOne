# FPOne Intranet

> Portal corporativo e *Digital Workplace* moderno, modular e seguro para o agronegócio (Fazenda Progresso), conectando colaboradores de escritório e campo (mobile-first).

---

## 1. Visão Geral e Arquitetura

O **FPOne Intranet** centraliza comunicação corporativa, diretório de pessoas, acervo de documentos, agenda de eventos, catálogo de sistemas internos e indicadores executivos.

### Stack Tecnológica
* **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons, TipTap Rich Text Editor.
* **Backend**: Server Actions, Route Handlers, Zod Validation.
* **Autenticação & Sessão**: Auth.js v5 (NextAuth) com suporte a Active Directory (LDAP corporativo via `ldapts`), controle estrito de sessão (`session_version`) e fallback local seguro auditado.
* **Autorização (RBAC & Audiência)**: Matriz estrita de permissões no servidor (`can()`) e filtro de confidencialidade por público-alvo (`audienceFilter()`).
* **Banco de Dados**: PostgreSQL 16 com Prisma ORM 7 e migrations versionadas.
* **Armazenamento de Arquivos**: Garage S3 (nó único, leve e performático) com acesso via URLs pré-assinadas temporárias de 60 segundos.
* **Orquestração & Produção**: Dockerfile multi-stage standalone, healthcheck nativo e suporte nativo ao **Easypanel (Docker Swarm)**.

---

## 2. Como Subir a Aplicação no Easypanel (Docker Swarm)

O Easypanel utiliza o Docker Swarm por baixo dos panos para orquestrar serviços, réplicas e roteamento com SSL automático via Traefik.

A aplicação inclui o arquivo [`easypanel.json`](./easypanel.json), que define a stack completa de produção com 3 serviços interligados:
1. `db`: Banco de dados relacional PostgreSQL 16.
2. `garage`: Storage S3-compatível com volumes dedicados para metadados e dados.
3. `web`: Aplicação FPOne Intranet em modo standalone, com proxy reverso e migrações automáticas do Prisma.

### Passo 1: Criar o Projeto e Importar o Template JSON
1. No painel do seu **Easypanel**, clique em **New Project** (nomeie como `fpone` ou `intranet`).
2. Dentro do projeto, clique no botão de adicionar serviço e selecione **Templates** (ou clique em **Create from JSON / Schema**).
3. Abra o arquivo [`easypanel.json`](./easypanel.json) deste repositório, copie todo o seu conteúdo e cole no campo de texto do Easypanel.
4. Clique em **Create**. O Easypanel criará instantaneamente os 3 serviços (`db`, `garage` e `web`).

---

### Passo 2: Configurar o Repositório GitHub no Serviço Web
1. No Easypanel, clique no serviço **web**.
2. Vá na aba **Deploy / Source**:
   * **Source Type**: GitHub.
   * **Repository**: `https://github.com/Kadu325/FPOne` (ou selecione na sua conta GitHub integrada).
   * **Branch**: `main` (ou `dev`).
   * **Build Method**: Dockerfile (o Easypanel detectará automaticamente o `Dockerfile` na raiz).
3. Vá na aba **Domains**:
   * O Easypanel vinculará o domínio configurado (ex: `intranet.suaempresa.com.br`) com certificado SSL Let's Encrypt automático na porta interna `3000`.

---

### Passo 3: Configurar as Variáveis de Ambiente
Na aba **Environment** do serviço `web`, as seguintes variáveis já vêm preconfiguradas com links internos do Swarm. Preencha os valores específicos de produção:

| Variável | Descrição / Exemplo |
|---|---|
| `DATABASE_URL` | Conexão interna Postgres (gerada automaticamente pelo template) |
| `GARAGE_ENDPOINT` | `http://$(PROJECT_NAME)_garage:3900` |
| `S3_BUCKET` | `fpone-files` |
| `S3_ACCESS_KEY` | Chave de acesso S3 gerada no passo de bootstrap do Garage |
| `S3_SECRET_KEY` | Chave secreta S3 gerada no passo de bootstrap do Garage |
| `S3_PUBLIC_URL` | Domínio público HTTPS (ex: `https://intranet.suaempresa.com.br`) |
| `AUTH_SECRET` | Chave aleatória de 32+ caracteres (`openssl rand -hex 32`) |
| `AUTH_URL` | `https://$(PRIMARY_DOMAIN)` |
| `AUTH_TRUST_HOST` | `true` |
| `TRUST_PROXY` | `true` (necessário para ler IP real do cliente atrás do Traefik) |
| `CPF_PEPPER` | Segredo aleatório para hash HMAC-SHA256 de CPF |
| `TZ` | `America/Bahia` (fuso horário corporativo) |
| `AD_ENABLED` | `true` (ativa login via Active Directory) |
| `AD_HOST` | IP ou hostname do Controlador de Domínio (ex: `192.168.77.250`) |
| `AD_PORT` | `389` (LDAP) ou `636` (LDAPS) |
| `AD_BASE_DN` | Base DN (ex: `dc=fazendaprogresso,dc=com,dc=local`) |
| `AD_BIND_DN` | Conta de serviço (ex: `FP\glpi` ou `glpi@fazendaprogresso.com.local`) |
| `AD_BIND_PASSWORD` | Senha da conta de serviço técnica do AD |

Clique em **Save**.

---

### Passo 4: Realizar o Deploy
1. Clique em **Deploy** no serviço `web`.
2. O Dockerfile multi-stage executará:
   * Instalação limpa de dependências.
   * Geração dos clientes Prisma ORM.
   * Compilação Next.js standalone otimizada.
   * Execução do `docker-entrypoint.sh` (aplica `prisma migrate deploy` automaticamente antes de iniciar o servidor).

---

### Passo 5: Bootstrap Obrigatório do Garage S3 (Executado apenas 1 vez)
Após o primeiro deploy, é necessário criar o bucket e as chaves de acesso no Garage.

1. No Easypanel, acesse o serviço **garage** e abra a aba **Console / Terminal**.
2. Execute a sequência de comandos abaixo:

```bash
# 1. Obter o Node ID do Garage
garage status

# 2. Configurar o layout de armazenamento (substitua <NODE_ID> pelo valor obtido no comando anterior)
garage layout assign -z dc1 -c 10G <NODE_ID>
garage layout apply --version 1

# 3. Criar o bucket oficial de arquivos
garage bucket create fpone-files

# 4. Criar a chave de acesso da aplicação
garage key create fpone-app

# 5. Autorizar permissões de leitura e escrita
garage bucket allow fpone-files --read --write --key fpone-app
```

3. O comando do item 4 exibirá o **Access Key ID** e a **Secret Key**. Copie esses valores.
4. Volte nas variáveis de ambiente do serviço **web**, preencha `S3_ACCESS_KEY` e `S3_SECRET_KEY` e clique em **Save & Redeploy**.

Os arquivos do Garage persistem permanentemente nos volumes montados `meta` e `data`.

---

### Passo 6: Bootstrap do Primeiro Administrador
Depois que a aplicação estiver no ar, execute uma única vez o script CLI para conceder privilégios de `ADMIN` ao primeiro colaborador (a partir de sua matrícula de rede/RH):

No console do serviço **web**:
```bash
node scripts/admin-bootstrap.js --matricula <MATRICULA_DO_ADMIN>
```
*O script utiliza lock transacional no banco de dados e só pode ser executado se não existir nenhum administrador cadastrado, garantindo conformidade de governança.*

---

## 3. Desenvolvimento e Validação Local

Para executar o projeto localmente em ambiente de desenvolvimento:

```bash
# Instalar dependências
npm.cmd install

# Gerar o cliente Prisma
npx.cmd prisma generate

# Executar migrações locais
npm.cmd run db:migrate

# Executar bateria de 255 testes automatizados
npm.cmd test

# Validar tipagem estrita TypeScript
npm.cmd run typecheck

# Iniciar servidor de desenvolvimento
npm.cmd run dev
```

---

## 4. Estrutura do Repositório

```text
├── .dockerignore
├── .env.example
├── .gitignore
├── Dockerfile                   # Build multi-stage standalone seguro
├── docker-entrypoint.sh         # Migração automática no startup do Swarm
├── easypanel.json               # Template oficial 1-click para Easypanel
├── compose.yaml                 # Orquestração local / Docker Compose
├── package.json
├── tsconfig.json
├── prisma/
│   ├── schema.prisma            # Schema de dados corporativo
│   └── migrations/              # Migrações versionadas do banco
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

## 5. Licença e Uso
Uso interno corporativo — Projeto FPOne Intranet.

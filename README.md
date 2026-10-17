# Educano API

API REST do Educano, desenvolvida com Node.js, TypeScript e Express. O projeto usa Prisma ORM para acesso a um banco PostgreSQL.

> **Estado atual:** a API disponibiliza endpoints de saúde. Embora o schema do banco e a estrutura de diretórios indiquem módulos como usuários, cursos e flashcards, ainda não há endpoints funcionais para esses recursos.

## Tecnologias

- **Node.js** — ambiente de execução.
- **TypeScript** — linguagem e verificação estática.
- **Express 5** — servidor HTTP e rotas.
- **Prisma ORM 7** — schema, migrações e geração do client.
- **PostgreSQL** — banco de dados; conexão via `pg` e `@prisma/adapter-pg`.
- **Zod 4** — biblioteca disponível para validação de dados.
- **Helmet** — cabeçalhos de segurança HTTP.
- **CORS** — middleware para acesso cross-origin.
- **dotenv** — carregamento de variáveis do arquivo `.env`.
- **tsx** — execução TypeScript e modo de desenvolvimento com watch.
- **pnpm** — gerenciador de pacotes; a versão declarada pelo projeto é `12.14.0`.

## Pré-requisitos

- Node.js instalado.
- pnpm `12.14.0`.
- Uma instância PostgreSQL acessível pela aplicação.

Se pnpm ainda não estiver instalado, habilite o Corepack e ative a versão usada pelo projeto:

```bash
corepack enable
corepack prepare pnpm@12.14.0 --activate
```

## Instalação e configuração

1. Clone o repositório e entre na pasta do projeto.
2. Instale as dependências:

   ```bash
   pnpm install
   ```

3. Crie o arquivo `.env` a partir do exemplo:

   PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

   Bash:

   ```bash
   cp .env.example .env
   ```

4. Configure `DATABASE_URL` no `.env` com a URL da sua instância PostgreSQL:

   ```dotenv
   PORT=3000
   DATABASE_URL="postgresql://USUARIO:SENHA@HOST:5432/NOME_DO_BANCO?schema=public"
   ```

   Substitua os valores de exemplo pelas credenciais e endereço do seu banco.

## Banco de dados e Prisma

O schema está em `prisma/schema.prisma`. Ele define:

- `Usuario`, com nome, e-mail único, senha, tipo, status e datas de criação/atualização.
- `Perfil`, relacionado a um usuário, com visibilidade, plano, XP, moedas, nível, cor e URLs de imagens.
- Os enums `TipoUsuario`, `StatusUsuario` e `TipoPerfil`.

Há uma migração inicial em `prisma/migrations`. Para aplicá-la ao banco configurado:

```bash
pnpm exec prisma migrate deploy --config prisma7.config.ts
```

O comando `pnpm dev` executa `prisma generate` automaticamente antes de iniciar o servidor. Para gerar o client manualmente:

```bash
pnpm exec prisma generate --config prisma7.config.ts
```

## Executar

Modo de desenvolvimento, com reinicialização ao alterar arquivos:

```bash
pnpm dev
```

Por padrão, o servidor inicia na porta `3000`. É possível alterá-la pela variável `PORT`.

Compilar e iniciar a versão compilada:

```bash
pnpm build
pnpm start
```

O servidor precisa de uma `DATABASE_URL` válida para inicializar o client Prisma.

## Endpoints disponíveis

Todas as rotas atuais usam o prefixo `/api`.

### `GET /api/health`

Verifica se a API está respondendo. Não verifica a conexão com o banco.

- **Sucesso:** `200 OK`

  ```json
  {
    "status": "ok",
    "message": "API do Educano funcionando!"
  }
  ```

### `GET /api/health/database`

Executa uma consulta simples (`SELECT 1`) para verificar a conexão com o PostgreSQL.

- **Conexão disponível:** `200 OK`

  ```json
  {
    "status": "ok",
    "database": "connected"
  }
  ```

- **Banco indisponível ou consulta com erro:** `503 Service Unavailable`

  ```json
  {
    "status": "error",
    "message": "Banco de dados indisponível."
  }
  ```

## Middlewares e observações

A aplicação registra Helmet, CORS com a configuração padrão do middleware e o parser de JSON do Express. No momento, não há autenticação nem rotas de negócio expostas.

## Estrutura principal

```text
prisma/
  migrations/          Migrações do banco
  schema.prisma        Modelos e enums Prisma
src/
  app.ts               Configuração do Express e endpoints
  server.ts            Inicialização do servidor HTTP
  config/prisma.ts     Client Prisma com adapter PostgreSQL
  generated/prisma/    Client gerado pelo Prisma
```

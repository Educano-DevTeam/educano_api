# Educano API

API REST do Educano, desenvolvida com Node.js, TypeScript e Express. O acesso a dados é feito com Prisma ORM e PostgreSQL.

## Tecnologias

- **Node.js** e **TypeScript**.
- **Express 5** para o servidor HTTP e as rotas.
- **Prisma ORM 7** para schema, migrações e acesso ao banco.
- **PostgreSQL**, com `pg` e `@prisma/adapter-pg`.
- **Zod 4** para validação de parâmetros e payloads.
- **JWT** (`jsonwebtoken`) e **bcryptjs** para autenticação e senhas.
- **Nodemailer** para envio de e-mails de validação.
- **Helmet**, **CORS** e **dotenv**.
- **tsx** para desenvolvimento e **pnpm 12.14.0** para gerenciamento de pacotes.

## Pré-requisitos

- Node.js.
- pnpm `12.14.0`.
- PostgreSQL acessível pela aplicação.
- SMTP configurado para enviar códigos de validação por e-mail.

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

4. Configure as variáveis no `.env`:

   ```dotenv
   PORT=3000
   DATABASE_URL="postgresql://USUARIO:SENHA@HOST:5432/NOME_DO_BANCO?schema=public"
   VALIDATION_CODE_SECRET="segredo-aleatorio-com-pelo-menos-32-caracteres"
   JWT_SECRET="outro-segredo-aleatorio-com-pelo-menos-32-caracteres"

   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER="seu.email@gmail.com"
   SMTP_APP_PASSWORD="SENHA_DE_APP_DO_GOOGLE"
   EMAIL_FROM_NAME="Educano"
   EMAIL_FROM_ADDRESS="seu.email@gmail.com"
   ```

   `VALIDATION_CODE_SECRET` é usado para armazenar os códigos de validação como hash; `JWT_SECRET` assina os tokens de acesso. Configure ambos com segredos aleatórios fortes e não os compartilhe. Para o Gmail, use uma senha de aplicativo SMTP. `PORT` é opcional e, se omitida, a aplicação usa `3000`.

## Banco de dados e Prisma

O schema está em `prisma/schema.prisma`. Ele define:

- `Usuario`, com nome, e-mail único, senha armazenada como hash, tipo, status e datas de criação/atualização.
- `Perfil`, relacionado a um usuário, com visibilidade, plano, XP, moedas, nível, cor, decoração e URLs de imagens.
- `CodigoValidacao`, com hash do código, estado, data de criação e expiração.
- Os enums `TipoUsuario`, `StatusUsuario`, `TipoPerfil` e `StatusCodigoValidacao`.

As migrações estão em `prisma/migrations`. Para aplicá-las ao banco configurado:

```bash
pnpm exec prisma migrate deploy --config prisma7.config.ts
```

O comando `pnpm dev` executa `prisma generate` antes de iniciar o servidor. Para gerar o client manualmente:

```bash
pnpm exec prisma generate --config prisma7.config.ts
```

## Executar

Modo de desenvolvimento, com reinicialização ao alterar arquivos:

```bash
pnpm dev
```

Compilar e iniciar a versão compilada:

```bash
pnpm build
pnpm start
```

O servidor requer uma `DATABASE_URL` válida para inicializar o client Prisma.

## API

Todas as rotas usam o prefixo `/api`. Os corpos e parâmetros são validados com Zod. Os erros tratados pelos endpoints são retornados em JSON; erros de validação geralmente incluem `message` e, quando indicado abaixo, `errors`.

### Saúde

| Método e rota | Acesso | Retorno de sucesso |
| --- | --- | --- |
| `GET /api/health` | Público | `200`: `{ "status": "ok", "message": "API do Educano funcionando!" }`. Indica que a API está respondendo; não testa o banco. |
| `GET /api/health/database` | Público | `200`: `{ "status": "ok", "database": "connected" }`. Executa `SELECT 1`. Se o banco estiver indisponível, retorna `503`: `{ "status": "error", "message": "Banco de dados indisponível." }`. |

### Autenticação

As rotas de autenticação são públicas. O cadastro cria contas do tipo `ALUNO` com status `PENDENTE` e envia um código de seis caracteres para o e-mail cadastrado. O código expira em 10 minutos e não é incluído na resposta da API.

| Método e rota | Corpo | Retorno de sucesso |
| --- | --- | --- |
| `POST /api/auth/register` | `{ "nome": "Nome", "email": "pessoa@exemplo.com", "senha": "minimo-8-caracteres" }` | `201`: `{ "message": "Cadastro criado. Enviamos um código para seu e-mail.", "usuario": { "id": "UUID", "nome": "Nome", "email": "pessoa@exemplo.com", "tipo": "ALUNO", "status": "PENDENTE" } }` |
| `POST /api/auth/verify-code` | `{ "email": "pessoa@exemplo.com", "codigo": "A1B2C3" }` | `200`: `{ "message": "Conta validada e ativada com sucesso." }` |
| `POST /api/auth/login` | `{ "email": "pessoa@exemplo.com", "senha": "senha" }` | `200`: `{ "message": "Login realizado com sucesso.", "token": "JWT", "usuario": { "id": "UUID", "nome": "Nome", "email": "pessoa@exemplo.com", "tipo": "ALUNO", "status": "ATIVO" } }`. O token expira em 15 minutos. |

Erros relevantes:

- `400` para corpo inválido. A resposta contém `message` e `errors` com os detalhes da validação.
- Cadastro: `409` se o e-mail já estiver cadastrado; `503` se não for possível enviar o e-mail de confirmação.
- Validação do código: `400` se a conta/dados não puderem ser validados, se o código não existir, estiver incorreto, expirado ou já tiver sido usado.
- Login: `401` para credenciais incorretas ou conta ainda não ativada. A mensagem não diferencia esses casos.
- Erros inesperados: `500` com `{ "message": "Não foi possível concluir a solicitação." }`.

### Usuários e perfis

Todas as rotas deste grupo exigem o cabeçalho `Authorization: Bearer <token>`. O token é emitido no login. Sem token, com token inválido/expirado ou com conta indisponível, a API responde `401` com `{ "message": "..." }`. Falha ao consultar a conta no banco durante a autenticação responde `503`.

O identificador `:identifier` pode ser o UUID do usuário ou seu e-mail. Usuários comuns só podem consultar a própria conta ou perfil; operações administrativas indicadas abaixo exigem tipo `ADMIN` e respondem `403` se o usuário não tiver permissão.

| Método e rota | Acesso | Retorno de sucesso |
| --- | --- | --- |
| `GET /api/users/me` | Qualquer usuário autenticado | `200`: `{ "usuario": { "id": "UUID", "nome": "Nome", "email": "pessoa@exemplo.com", "tipo": "ALUNO", "status": "ATIVO", "criadoEm": "data ISO-8601", "atualizadoEm": "data ISO-8601" } }`. |
| `GET /api/users/me/profile` | Qualquer usuário autenticado | `200`: `{ "perfil": { "idUsuario": "UUID", "tipoPerfil": "PRIVADO", "planoContaId": null, "xp": 0, "moedas": 0, "nivel": 0, "cor": "", "decoracaoId": null, "urlFotoPerfil": "", "urlFotoBackground": "" } }`. |
| `PATCH /api/users/me/profile` | Qualquer usuário autenticado | Atualiza o próprio perfil. `200`: objeto JSON com `message` e `perfil`; `perfil` contém os mesmos campos retornados por `GET /api/users/me/profile`. |
| `GET /api/users?page=1` | Somente `ADMIN` | Lista usuários com 30 itens por página. `200`: objeto JSON com `dados` (array de usuários) e `paginacao` (`pagina`, `porPagina`, `total`, `totalPaginas`, `temMais`, `proximaPagina`). Cada usuário inclui `id`, `nome`, `email`, `tipo`, `status`, `criadoEm`, `atualizadoEm` e `perfil` (objeto com os campos de perfil ou `null`). `page` é um inteiro a partir de 1 e, se omitido, vale `1`. |
| `GET /api/users/:identifier` | Autenticado; próprio usuário ou `ADMIN` | `200`: objeto JSON com `usuario`, contendo `id`, `nome`, `email`, `tipo`, `status`, `criadoEm` e `atualizadoEm`. |
| `PATCH /api/users/:identifier` | Somente `ADMIN` | Atualiza `nome` e/ou `email`. `200`: objeto JSON com `message` e `usuario`, contendo os campos de usuário descritos acima. Informe ao menos um campo. |
| `DELETE /api/users/:identifier` | Somente `ADMIN` | Exclui o usuário e seus dados relacionados em cascata. `200`: `{ "message": "Usuário excluído com sucesso." }`. |
| `GET /api/users/:identifier/profile` | Autenticado; próprio usuário ou `ADMIN` | `200`: objeto JSON com `perfil`, contendo os campos descritos em `GET /api/users/me/profile`. |
| `PATCH /api/users/:identifier/profile` | Somente `ADMIN` | Atualiza o perfil identificado. `200`: objeto JSON com `message` e `perfil`, contendo os campos descritos em `GET /api/users/me/profile`. |
| `DELETE /api/users/:identifier/profile` | Somente `ADMIN` | Exclui somente o perfil; mantém a conta. `200`: `{ "message": "Perfil excluído com sucesso. A conta do usuário foi mantida." }`. |

No perfil, `tipoPerfil` aceita `PUBLICO` ou `PRIVADO`; os campos editáveis são `tipoPerfil`, `cor`, `urlFotoPerfil` e `urlFotoBackground`. URL vazia (`""`) também é aceita para limpar as imagens. XP, moedas, nível e plano não podem ser alterados por essas rotas. Para edição de usuário, apenas `nome` e `email` são aceitos.

Erros relevantes neste grupo: `400` para identificador, paginação ou corpo inválidos; `403` para acesso a outro usuário/perfil ou operação administrativa sem permissão; `404` para usuário/perfil inexistente; `409` ao tentar usar e-mail já cadastrado; `503` para indisponibilidade conhecida do banco; `500` para outros erros inesperados. Os erros são retornados como `{ "message": "..." }`; validações podem incluir `errors`.

### Ranking

| Método e rota | Acesso | Retorno de sucesso |
| --- | --- | --- |
| `GET /api/ranking?page=1` | Público | `200`: `{ "dados": [{ "posicao": 1, "id": "UUID", "nome": "Nome", "xp": 120, "nivel": 3, "urlFotoPerfil": "" }], "paginacao": { "pagina": 1, "porPagina": 15, "total": 1, "temMais": false, "proximaPagina": null } }`. Retorna 15 usuários por página, considerando apenas contas ativas com perfil e ordenando por XP decrescente. `page` é um inteiro a partir de 1 e, se omitido, vale `1`. |

Se a paginação do ranking for inválida, a resposta é `400` com `mensagem` e `erros` (detalhes de validação fornecidos pelo Zod).

## Middlewares

A aplicação registra Helmet, CORS com a configuração padrão do middleware e o parser JSON do Express. O grupo `/api/users` valida o token JWT e o status ativo da conta em cada requisição; algumas operações também verificam o tipo `ADMIN`.

## Estrutura do projeto

A árvore abaixo mostra o código-fonte, arquivos de configuração e migrações do projeto. Omitidos por serem locais ou artefatos de execução/build: `node_modules/`, `dist/` e `.env`. O diretório `.agents/skills/`, `.claude/skills/` e `.windsurf/skills/` contém material de apoio a agentes de desenvolvimento, não executado pela API.

```text
.
├── .agents/skills/                 # Instruções e referências para agentes
├── .claude/skills/                 # Instruções e referências para agentes
├── .windsurf/skills/               # Instruções e referências para agentes
├── assets/
│   └── Educano_Logo.jpeg           # Logo anexado ao e-mail de validação
├── generated/prisma/               # Client Prisma legado gerado na raiz
│   ├── internal/
│   │   ├── class.ts
│   │   ├── prismaNamespace.ts
│   │   └── prismaNamespaceBrowser.ts
│   ├── models/
│   │   ├── Perfil.ts
│   │   └── Usuario.ts
│   ├── browser.ts
│   ├── client.ts
│   ├── commonInputTypes.ts
│   ├── enums.ts
│   └── models.ts
├── prisma/
│   ├── migrations/
│   │   ├── 20261017012328_criar_usuario_perfil/
│   │   │   └── migration.sql
│   │   ├── 20261017234256_adicionar_codigo_validacao/
│   │   │   └── migration.sql
│   │   └── migration_lock.toml
│   └── schema.prisma               # Modelos, enums e destino do client gerado
├── src/
│   ├── config/
│   │   └── prisma.ts               # Client Prisma com adapter PostgreSQL
│   ├── generated/prisma/           # Client usado pela aplicação (gerado)
│   │   ├── internal/
│   │   │   ├── class.ts
│   │   │   ├── prismaNamespace.ts
│   │   │   └── prismaNamespaceBrowser.ts
│   │   ├── models/
│   │   │   ├── CodigoValidacao.ts
│   │   │   ├── Perfil.ts
│   │   │   └── Usuario.ts
│   │   ├── browser.ts
│   │   ├── client.ts
│   │   ├── commonInputTypes.ts
│   │   ├── enums.ts
│   │   └── models.ts
│   ├── middlewares/
│   │   ├── auth.middlewares.ts     # Autenticação JWT e autorização ADMIN
│   │   └── authorization.middleware.ts
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── controllers/auth.controller.ts
│   │   │   ├── repositories/       # Reservado para repositórios
│   │   │   ├── routes/auth.routes.ts
│   │   │   ├── schemas/auth.schema.ts
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts
│   │   │   │   └── token.service.ts
│   │   │   └── templates/validations-email.template.ts
│   │   ├── courses/                # Estrutura reservada; sem implementação
│   │   │   ├── controllers/
│   │   │   ├── repositories/
│   │   │   ├── routes/
│   │   │   ├── schemas/
│   │   │   └── services/
│   │   ├── flashcards/             # Estrutura reservada; sem implementação
│   │   │   ├── controllers/
│   │   │   ├── repositories/
│   │   │   ├── routes/
│   │   │   ├── schemas/
│   │   │   └── services/
│   │   ├── questions/              # Estrutura reservada; sem implementação
│   │   │   ├── controllers/
│   │   │   ├── repositories/
│   │   │   ├── routes/
│   │   │   ├── schemas/
│   │   │   └── services/
│   │   ├── ranking/
│   │   │   ├── controllers/ranking.controller.ts
│   │   │   ├── repositories/       # Reservado para repositórios
│   │   │   ├── routes/ranking,route.ts
│   │   │   ├── schemas/ranking.schema.ts
│   │   │   └── services/ranking.service.ts
│   │   ├── store/                  # Estrutura reservada; sem implementação
│   │   │   ├── controllers/
│   │   │   ├── repositories/
│   │   │   ├── routes/
│   │   │   ├── schemas/
│   │   │   └── services/
│   │   └── users/
│   │       ├── controllers/
│   │       │   ├── profile.controller.ts
│   │       │   └── users.controller.ts
│   │       ├── repositories/       # Reservado para repositórios
│   │       ├── routes/users.routes.ts
│   │       ├── schemas/
│   │       │   ├── profile.schema.ts
│   │       │   └── users.schema.ts
│   │       └── services/
│   │           ├── profile.service.ts
│   │           └── users.service.ts
│   ├── services/email.service.ts   # Transporte SMTP
│   ├── shared/                     # Reservado para recursos compartilhados
│   ├── app.ts                      # Middlewares e registro das rotas
│   └── server.ts                   # Inicialização HTTP e porta
├── .env.example                    # Modelo de variáveis de ambiente
├── .gitattributes
├── .gitignore
├── package.json                    # Scripts e dependências
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── prisma7.config.ts               # Configuração CLI Prisma 7
├── README.md
├── skills-lock.json
└── tsconfig.json
```

As pastas `courses`, `flashcards`, `questions` e `store` são apenas estrutura preparada: não têm rotas registradas nem endpoints disponíveis. O client Prisma de referência da aplicação é o de `src/generated/prisma`, configurado como saída em `prisma/schema.prisma`.

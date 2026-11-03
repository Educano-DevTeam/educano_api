# Educano API

API REST do Educano, desenvolvida com Node.js, TypeScript e Express. O armazenamento relacional usa PostgreSQL com Prisma ORM; arquivos e imagens podem ser enviados ao Cloudflare R2.

## Tecnologias

- Node.js e TypeScript
- Express 5
- Prisma ORM 7 e PostgreSQL
- `pg` e `@prisma/adapter-pg`
- Zod 4
- JWT, bcryptjs
- Multer para uploads temporários em disco
- AWS SDK S3 para integração com Cloudflare R2
- Nodemailer para e-mails de validação
- Helmet, CORS, dotenv
- tsx para desenvolvimento
- pnpm 12.14.0

## Pré-requisitos

- Node.js
- pnpm 12.14.0
- PostgreSQL acessível pela aplicação
- Conta de SMTP configurada
- Bucket Cloudflare R2 com credenciais válidas

Se necessário, habilite o pnpm pelo Corepack:

```bash
corepack enable
corepack prepare pnpm@12.14.0 --activate
```

## Instalação

```bash
pnpm install
cp .env.example .env
```

No PowerShell:

```powershell
Copy-Item .env.example .env
```

### Variáveis de ambiente

```dotenv
PORT=3000
DATABASE_URL="postgresql://usuario:senha@localhost:5432/educano?schema=public"
VALIDATION_CODE_SECRET="segredo-aleatorio-forte"
JWT_SECRET="segredo-jwt-forte"

SMTP_HOST="smtp.gmail.com"
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER="seu.email@gmail.com"
SMTP_APP_PASSWORD="SENHA_DE_APP"
EMAIL_FROM_NAME="Educano"
EMAIL_FROM_ADDRESS="seu.email@gmail.com"

R2_ACCOUNT_ID="id-da-conta-r2"
R2_ACCESS_KEY_ID="access-key"
R2_SECRET_ACCESS_KEY="secret-key"
R2_BUCKET_NAME="educano-arquivos"
R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
```

- `DATABASE_URL`: conexão PostgreSQL usada pelo Prisma.
- `VALIDATION_CODE_SECRET`: segredo usado para proteger o hash dos códigos de validação.
- `JWT_SECRET`: segredo usado para assinar e validar tokens JWT.
- `VALIDATION_CODE_SECRET` e `JWT_SECRET` devem ter valores fortes e exclusivos.
- `PORT`: opcional; padrão `3000`.
- Variáveis SMTP: necessárias para enviar códigos por e-mail. Para o Gmail, use senha de aplicativo.
- Variáveis R2: obrigatórias na inicialização da aplicação por `src/config/storage.ts`.

## Banco de dados e Prisma

O schema está em `prisma/schema.prisma`. A aplicação gera o client Prisma em `src/generated/prisma`.

Principais entidades:

- `Usuario`: conta, tipo, status, perfil, códigos e relacionamentos com cursos, arquivos e outros módulos.
- `Perfil`: privacidade, plano, experiência, moedas, nível, decoração e URLs de imagens.
- `CodigoValidacao`: código de validação expirável relacionado à conta.
- `Arquivo`: metadado e objeto armazenado no R2, incluindo tipo, finalidade, bucket, chave, tamanho, ETag e status.
- `Curso`: dados acadêmicos, responsável, autorização administrativa, status, vagas, preço, capa enviada ou ícone de capa.
- `Sessao`, `Modulo`, `Aula`, `Teste`, `Questao`, `Alternativa` e `Inscricao`: estrutura acadêmica preparada no schema.

Enums principais:

- Usuário: `TipoUsuario` (`ALUNO`, `PROFESSOR`, `PARCEIRO`, `ADMIN`) e `StatusUsuario` (`PENDENTE`, `ATIVO`, `INATIVO`).
- Perfil: `TipoPerfil` (`PUBLICO`, `PRIVADO`).
- Arquivo: `TipoArquivo`, `FinalidadeArquivo` e `StatusArquivo`.
- Curso: `CategoriaCurso` e `StatusCurso` (`RASCUNHO`, `INATIVO`, `ATIVO`).
- Conteúdo: `TipoMaterial`, `TipoTeste` e `NivelDificuldade`.

As migrações estão em `prisma/migrations`. Para aplicá-las:

```bash
pnpm exec prisma migrate deploy --config prisma7.config.ts
```

Para gerar o client manualmente:

```bash
pnpm exec prisma generate --config prisma7.config.ts
```

## Executar

Desenvolvimento:

```bash
pnpm dev
```

O script executa primeiro `prisma generate --config prisma7.config.ts`.

Produção local:

```bash
pnpm build
pnpm start
```

## Autenticação HTTP

Use nas rotas protegidas:

```http
Authorization: Bearer <token-jwt>
```

O token é criado no login e expira em 15 minutos. O middleware verifica assinatura, validade, existência da conta e status `ATIVO`.

Algumas operações exigem `ADMIN`. Quando necessário, falhas de permissão retornam `403`.

Respostas padrão incluem JSON com `message` ou `mensagem`. Validações podem incluir `errors` ou `erros`.

## API

Todas as rotas começam com `/api`.

### Saúde

| Método e rota | Acesso | Descrição |
| --- | --- | --- |
| `GET /api/health` | Público | Informa que o servidor HTTP está respondendo. |
| `GET /api/health/database` | Público | Executa `SELECT 1`. Retorna `503` se o banco estiver indisponível. |

### Autenticação

| Método e rota | Acesso | Corpo ou resposta |
| --- | --- | --- |
| `POST /api/auth/register` | Público | `{ nome, email, senha, tipo? }`. `tipo` aceita `ALUNO`, `PROFESSOR`, `PARCEIRO` ou `ADMIN`, mas usuários públicos só podem cadastrar `ALUNO`. Um administrador autenticado pode cadastrar outros tipos. |
| `POST /api/auth/verify-code` | Público | `{ email, codigo }`. Valida o código de seis caracteres e ativa a conta. |
| `POST /api/auth/login` | Público | `{ email, senha }`. Retorna JWT válido por 15 minutos e os dados do usuário. |
| `GET /api/auth/me` | Autenticado | Retorna os dados da sessão, da conta e do perfil. |

O cadastro cria o usuário como `PENDENTE`, gera um código de seis caracteres com validade de 10 minutos e envia-o por e-mail. O código não é retornado pela API.

Erros comuns: `400` para payload inválido, `401` para credenciais ou conta inválida, `403` para cadastro não autorizado, `409` para e-mail existente, `503` para SMTP ou banco indisponível.

### Usuários e perfis

Todas as rotas deste grupo exigem autenticação.

`identifier` pode ser o UUID ou o e-mail. A própria conta pode ser consultada integralmente; dados de terceiros são públicos ou restritos de acordo com perfil, conta e autorização administrativa.

| Método e rota | Acesso | Descrição |
| --- | --- | --- |
| `GET /api/users/me` | Autenticado | Dados completos da própria conta. |
| `GET /api/users/me/profile` | Autenticado | Perfil próprio. |
| `PATCH /api/users/me/profile` | Autenticado | Atualiza `tipoPerfil`, `cor`, `urlFotoPerfil` e `urlFotoBackground` do próprio perfil. |
| `DELETE /api/users/me` | Autenticado | Remove a própria conta e os dados relacionados em cascata. |
| `GET /api/users?page=1` | `ADMIN` | Lista 30 usuários por página. |
| `GET /api/users/:identifier` | Autenticado | Consulta os dados próprios ou públicos de outro usuário. Administradores recebem dados completos. |
| `PATCH /api/users/:identifier` | `ADMIN` | Atualiza `nome` e/ou `email`; exige pelo menos um campo. |
| `DELETE /api/users/:identifier` | `ADMIN` | Exclui usuário e dados relacionados. |
| `GET /api/users/:identifier/profile` | Autenticado | Consulta perfil próprio ou perfil público de terceiros. |
| `PATCH /api/users/:identifier/profile` | `ADMIN` | Atualiza o perfil identificado. |
| `DELETE /api/users/:identifier/profile` | `ADMIN` | Exclui o perfil, mantendo a conta. |

No perfil, `tipoPerfil` aceita `PUBLICO` ou `PRIVADO`; URLs vazias podem limpar fotos. XP, moedas, nível, plano e decoração não são alterados pelas rotas de perfil.

### Ranking

| Método e rota | Acesso | Descrição |
| --- | --- | --- |
| `GET /api/ranking?page=1` | Público | Lista 15 usuários por página, somente contas ativas com perfil, ordenados por XP decrescente. |

### Arquivos

Todas as rotas exigem autenticação e usam upload temporário em disco em `tmp/uploads`, limitado a 100 MB por arquivo. Os formatos permitidos são JPEG, PNG, WebP, MP3, WAV, OGG, M4A, AAC, MP4, WebM, MOV, PDF, DOCX, XLSX e PPTX.

Campo esperado para envio multipart: `arquivo`.

Campos adicionais no envio: `tipo` e `finalidade`.

Tipos permitidos em `tipo`:

- `IMAGEM`
- `VIDEO`
- `AUDIO`
- `PDF`
- `DOCUMENTO`
- `OUTRO`

Finalidades permitidas em `finalidade`:

- `FOTO_PERFIL`
- `BACKGROUND_PERFIL`
- `CAPA_CURSO`
- `MATERIAL_CURSO`
- `MATERIAL_AULA`
- `OUTRO`

| Método e rota | Acesso | Corpo ou parâmetros | Retorno |
| --- | --- | --- | --- |
| `POST /api/files` | Autenticado | Multipart com `arquivo`, `tipo` e `finalidade` | `201`: metadados do arquivo e URL temporária assinada. |
| `GET /api/files?pagina=1&limite=20&tipo=IMAGEM&finalidade=CAPA_CURSO` | Autenticado | `pagina`, `limite` e filtros opcionais | `200`: arquivos concluídos acessíveis ao usuário. Administradores listam todos os arquivos. |
| `GET /api/files/:id` | Proprietário ou `ADMIN` | UUID do arquivo | `200`: metadados e URL temporária assinada. |
| `DELETE /api/files/:id` | Proprietário ou `ADMIN` | UUID do arquivo | Remove o objeto do R2 e o registro do banco. |

As URLs assinadas são válidas por 15 minutos. O upload cria o registro como `PENDENTE`, envia ao R2 e muda para `CONCLUIDO`; falhas removem o objeto e/ou registro criado. Arquivos temporários são excluídos ao concluir ou falhar a operação.

`GET /api/files` retorna 20 itens por página por padrão, máximo 50 por página. A resposta inclui `dados` e `paginacao` (`pagina`, `limite`, `total`, `totalPaginas`). Apenas arquivos `CONCLUIDO` são listados ou consultados.

Erros comuns: `400` para arquivo/formato/filtros inválidos, `403` para acesso a arquivo de outro usuário, `404` para arquivo não encontrado, `413` para tamanho acima de 100 MB, `500` para falhas inesperadas no armazenamento ou banco.

### Cursos

Todas as rotas exigem autenticação. Cursos não ativos só podem ser consultados pelo responsável ou por `ADMIN`; `GET /api/courses` mostra somente cursos ativos para usuários comuns.

Categorias permitidas:

`LINGUAGENS`, `EXATAS`, `CIENCIAS_HUMANAS`, `CIENCIAS_NATURAIS`, `REDACAO`, `VESTIBULAR`, `TECNOLOGIA`, `INTELIGENCIA_ARTIFICIAL`, `DESIGN`, `FINANCAS`.

Status permitidos:

`RASCUNHO`, `INATIVO`, `ATIVO`.

Ícones de capa permitidos:

`livro`, `matematica`, `biologia`, `ciencias`, `historia`, `geografia`, `idiomas`, `artes`.

| Método e rota | Acesso | Corpo ou parâmetros | Retorno |
| --- | --- | --- | --- |
| `GET /api/courses?pagina=1&nome=&categoria=&status=` | Autenticado | `pagina`, `nome` e `categoria` opcionais. `status` pode ser usado somente por `ADMIN`. | `200`: lista paginada com 20 cursos por página. Usuários comuns recebem somente cursos ativos. |
| `POST /api/courses` | Autenticado | `multipart/form-data`: campos `nome`, `categoria`, `descricao?`, `vagas?`, `preco?`, `cor?`, `capa?`; campo opcional de arquivo `arquivo`. | `201`: curso criado e automaticamente convertido em parceiro caso o usuário seja `ALUNO`. |
| `GET /api/courses/:id` | Responsável/`ADMIN` para cursos não ativos; público entre usuários autenticados para cursos ativos | UUID do curso | `200`: curso completo. |
| `PATCH /api/courses/:id` | Responsável ou `ADMIN` | Multipart ou JSON com campos opcionais `nome`, `categoria`, `descricao`, `vagas`, `preco`, `cor`, `capa`, `status`. Pode enviar uma nova `arquivo`. | `200`: curso atualizado. |
| `DELETE /api/courses/:id` | Responsável ou `ADMIN` | UUID do curso | Remove o curso e, se houver, tenta remover a capa no R2. |

No cadastro:

- `nome`: texto entre 3 e 150 caracteres.
- `descricao`: texto opcional até 10.000 caracteres.
- `vagas`: inteiro positivo ou `null`.
- `preco`: número maior ou igual a zero ou `null`.
- `cor`: texto opcional até 30 caracteres.
- Em multipart, `vagas` e `preco` enviados como texto são convertidos para número ou `null`.
- A capa pode ser enviada como imagem JPEG, PNG ou WebP ou selecionada pelo campo textual `capa`.
- O arquivo de capa, quando enviado, ocupa o campo `arquivo`.

Completude do curso exige nome, categoria, descrição não vazia e uma capa: imagem enviada ou ícone selecionado. Um curso completo recebe `INATIVO` na criação. Sem esses dados, recebe `RASCUNHO`.

Somente administradores podem alterar `status`. Ao definir `ATIVO`, o curso precisa estar completo. A ativação registra administrativamente quem autorizou e quando. Voltar a um status não ativo limpa essa autorização.

Erros comuns: `400` para UUID, filtros, payload ou curso incompleto, `401` para conta indisponível, `403` para autorização/status ou alteração de terceiros, `404` para curso inexistente/inacessível, `409` para capa já vinculada, `502` para falha específica de upload da capa, `503` para banco indisponível.

## Uploads e Cloudflare R2

`src/modules/files/middleware/upload.middleware.ts` guarda os arquivos temporariamente em `tmp/uploads` antes da integração. A aplicação aceita um arquivo por requisição, até 100 MB.

`src/modules/files/services/files.service.ts`:

- cria registros `Arquivo` antes do envio externo;
- envia conteúdo por streaming para o R2;
- salva ETag, status e metadados;
- gera URL assinada com validade de 15 minutos;
- remove objetos temporários;
- tenta compensar falhas removendo objeto ou registro criado.

O diretório temporário é criado automaticamente no início da aplicação. Não o versionar.

## Middlewares e segurança

- Helmet aplica headers de segurança HTTP padrão.
- CORS usa a configuração padrão do middleware.
- Express aceita JSON nas rotas.
- `/api/users`, `/api/files` e `/api/courses` usam autenticação JWT.
- `/api/users` usa verificação adicional de administrador em operações protegidas.
- Cursos verificam responsável ou administrador antes de atualizar ou excluir.
- Arquivos verificam proprietário ou administrador antes de consultar/excluir.
- Rotas seguem respostas JSON e validam payloads, query strings ou UUIDs.

## Estrutura do projeto

```text
.
├── assets/
│   └── Educano_Logo.jpeg
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── src/
│   ├── app.ts                         # Middlewares e registro das rotas
│   ├── server.ts                      # Inicialização HTTP
│   ├── config/
│   │   ├── prisma.ts                  # Client Prisma e adapter PostgreSQL
│   │   └── storage.ts                 # Client Cloudflare R2
│   ├── generated/prisma/              # Client Prisma gerado
│   ├── middlewares/
│   │   ├── auth.middlewares.ts        # Autenticação JWT
│   │   └── authorization.middleware.ts
│   ├── modules/
│   │   ├── auth/                      # Registro, login, validação e sessão
│   │   ├── users/                     # Usuários e perfis
│   │   ├── ranking/                   # Ranking por XP
│   │   ├── files/                     # Upload, consulta e exclusão de arquivos
│   │   └── courses/                   # CRUD e regras de cursos
│   └── services/
│       └── email.service.ts           # Envio SMTP
├── tmp/uploads/                       # Arquivos temporários de upload
├── .env.example
├── package.json
├── pnpm-lock.yaml
├── prisma7.config.ts
├── tsconfig.json
└── README.md
```

A aplicação registra atualmente os módulos de autenticação, usuários, ranking, arquivos e cursos em `src/app.ts`. Outros diretórios presentes em `src/modules` podem representar estrutura ou implementação em desenvolvimento, mas não ficam disponíveis pela API enquanto não forem importados e montados em `src/app.ts`.

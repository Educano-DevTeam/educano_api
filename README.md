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

# Opcionais
PUBLIC_API_URL="https://api.educano.com.br"
SEED_PASSWORD="Educano@2026"
SEED_ASSETS_DIR="../educano_app/lib/assets"
```

- `DATABASE_URL`: conexão PostgreSQL usada pelo Prisma.
- `VALIDATION_CODE_SECRET`: segredo usado para proteger o hash dos códigos de validação.
- `JWT_SECRET`: segredo usado para assinar e validar tokens JWT.
- `VALIDATION_CODE_SECRET` e `JWT_SECRET` devem ter valores fortes e exclusivos.
- `PORT`: opcional; padrão `3000`.
- Variáveis SMTP: necessárias para enviar códigos por e-mail. Para o Gmail, use senha de aplicativo.
- Variáveis R2: obrigatórias na inicialização da aplicação por `src/config/storage.ts`.
- `PUBLIC_API_URL`: endereço da API em produção. É usado no link das fotos de perfil.
- `SEED_PASSWORD` e `SEED_ASSETS_DIR`: só servem para o seed.

## Banco de dados e Prisma

O schema está em `prisma/schema.prisma`. A aplicação gera o client Prisma em `src/generated/prisma`.

Principais entidades:

- `Usuario`: conta, tipo, status, perfil, códigos e relacionamentos com cursos, arquivos e outros módulos.
- `Perfil`: privacidade, plano, experiência, moedas, nível, decoração e URLs de imagens.
- `CodigoValidacao`: código de validação expirável relacionado à conta.
- `Arquivo`: metadado e objeto armazenado no R2, incluindo tipo, finalidade, bucket, chave, tamanho, ETag e status.
- `Curso`: dados acadêmicos, responsável, autorização administrativa, status, vagas, preço, capa enviada ou ícone de capa.
- `Sessao`, `Modulo`, `Aula`, `Teste`, `Questao`, `Alternativa` e `Inscricao`: conteúdo do curso, banco de questões e inscrições.
- `ProgressoAula`: aulas que o aluno já concluiu.
- `TentativaTeste` e `RespostaTentativa`: cada simulado ou atividade feita e as respostas.
- `MovimentacaoRecompensa`: histórico de XP e moedas.
- `Item`, `InventarioItem` e `AtivacaoItem`: loja, inventário e itens ativos.
- `PlanoConta`: planos e limite de simulados por mês.
- `Flashcard`: flashcards do aluno.

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

### Seed (dados de teste)

Cria contas de teste (`admin@`, `professor@`, `parceiro@` e `aluno@educano.local`), cursos com aulas e atividade, questões, itens, planos e flashcards. Os arquivos de exemplo saem de `SEED_ASSETS_DIR` e vão para o bucket do R2.

```bash
pnpm seed             # só roda com o banco vazio
pnpm seed -- --reset  # apaga tudo e cria de novo
```

Não rode em produção.

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
| `POST /api/auth/resend-code` | Público | `{ email }`. Manda um código novo. |
| `POST /api/auth/login` | Público | `{ email, senha }`. Retorna JWT válido por 15 minutos e os dados do usuário. |
| `POST /api/auth/forgot-password` | Público | `{ email }`. Manda o código para trocar a senha. Responde igual se o e-mail não existir. |
| `POST /api/auth/reset-password` | Público | `{ email, codigo, novaSenha }`. Troca a senha. |
| `POST /api/auth/refresh` | Autenticado | Devolve um token novo de 15 minutos. |
| `GET /api/auth/me` | Autenticado | Retorna os dados da sessão, da conta e do perfil. |

O cadastro cria o usuário como `PENDENTE`, gera um código de seis caracteres com validade de 10 minutos e envia-o por e-mail. O código não é retornado pela API.

Senha: mínimo de 8 caracteres, com maiúscula, número e caractere especial. Ela vence em 90 dias; depois disso o login dá `403` com `code: "SENHA_EXPIRADA"` e a pessoa precisa trocar a senha.

Erros comuns: `400` para payload inválido, `401` para credenciais ou conta inválida, `403` para cadastro não autorizado, `409` para e-mail existente, `503` para SMTP ou banco indisponível.

### Usuários e perfis

Todas as rotas deste grupo exigem autenticação.

`identifier` pode ser o UUID ou o e-mail. A própria conta pode ser consultada integralmente; dados de terceiros são públicos ou restritos de acordo com perfil, conta e autorização administrativa.

| Método e rota | Acesso | Descrição |
| --- | --- | --- |
| `GET /api/users/me` | Autenticado | Dados completos da própria conta. |
| `PATCH /api/users/me` | Autenticado | `{ nome }`. Troca o próprio nome. |
| `PATCH /api/users/me/password` | Autenticado | `{ senhaAtual, novaSenha }`. Troca a senha. |
| `GET /api/users/me/profile` | Autenticado | Perfil próprio. |
| `PATCH /api/users/me/profile` | Autenticado | Atualiza `tipoPerfil`, `cor`, `urlFotoPerfil` e `urlFotoBackground` do próprio perfil. |
| `POST /api/users/me/profile/photo` | Autenticado | Multipart com a imagem em `foto`. Salva no R2 e apaga a foto antiga. |
| `DELETE /api/users/me` | Autenticado | Remove a própria conta e os dados relacionados em cascata. |
| `GET /api/users?page=1&busca=&tipo=&status=` | `ADMIN` | 30 por página, com busca por nome ou e-mail. |
| `GET /api/users/:identifier` | Autenticado | Consulta os dados próprios ou públicos de outro usuário. Administradores recebem dados completos. |
| `PATCH /api/users/:identifier` | `ADMIN` | Atualiza `nome` e/ou `email`; exige pelo menos um campo. |
| `DELETE /api/users/:identifier` | `ADMIN` | Exclui o usuário. Dá `409` se ele tiver cursos ou questões. |
| `PATCH /api/users/:identifier/status` | `ADMIN` | `{ status: "ATIVO" \| "INATIVO" }`. Desativa ou reativa sem apagar nada. |
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

### Mídia pública

| Método e rota | Acesso | Descrição |
| --- | --- | --- |
| `GET /api/media/:id` | Público | Redireciona para a imagem no R2 (fotos de perfil e capas de curso). |

A URL assinada do R2 vence em 15 minutos, então o app guarda `/api/media/:id`. Arquivos de aula não passam por aqui: use `GET /api/lessons/:id/access`.

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
| `GET /api/courses/:id/estrutura` | Responsável, `ADMIN` ou aluno inscrito | UUID do curso | O curso com progresso e as sessões → módulos → conteúdos. |
| `PUT /api/courses/:id/estrutura` | Responsável ou `ADMIN` | `{ sessoes: [{ id?, titulo, modulos: [{ id?, titulo, xp, conteudos: [...] }] }] }` | Salva tudo de uma vez e devolve igual ao `GET`. |

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

A listagem também traz `inscritos`, `inscrito`, `turma`, `podeEditar`, `conteudo` e `estatisticas`. Quem não é admin vê os cursos ativos e os que cadastrou.

`PUT .../estrutura` é o que o editor usa: o que tem `id` é atualizado, o que não tem é criado e o que sumiu é apagado. Aula: `tipo` (`VIDEO`, `AUDIO`, `PDF` ou `DOCUMENTO`) e `idArquivo` (enviado antes em `POST /api/files`, finalidade `MATERIAL_AULA`). Atividade: `tipo: "ATIVIDADE"` e `idsQuestoes`.

### Sessões, módulos, aulas e atividades

Para criar ou apagar uma parte sem mandar o curso inteiro. Só o responsável ou `ADMIN`, menos acessar e concluir aula.

| Método e rota | Acesso | Corpo ou parâmetros | Retorno |
| --- | --- | --- | --- |
| `POST /api/sessions` | Responsável ou `ADMIN` | `{ idCurso, titulo, subtitulo?, descricao? }` | Cria a sessão. |
| `DELETE /api/sessions/:id` | Responsável ou `ADMIN` | UUID da sessão | Apaga a sessão. |
| `POST /api/modules` | Responsável ou `ADMIN` | `{ idSessao, titulo, descricao?, licaoTitulo?, xp }` | Cria o módulo. `xp` é o bônus ao terminar o módulo. |
| `DELETE /api/modules/:id` | Responsável ou `ADMIN` | UUID do módulo | Apaga o módulo. |
| `POST /api/lessons` | Responsável ou `ADMIN` | `{ idModulo, tipo, titulo, descricao?, idArquivo, duracaoMinutos?, quantidadePaginas? }` | Cria a aula. |
| `DELETE /api/lessons/:id` | Responsável ou `ADMIN` | UUID da aula | Apaga a aula. |
| `GET /api/lessons/:id/access` | Responsável, `ADMIN` ou aluno inscrito | UUID da aula | Link do arquivo (vale 3 horas). |
| `POST /api/lessons/:id/complete` | Aluno inscrito | UUID da aula | Marca como concluída e devolve o XP e as moedas. |
| `POST /api/tests` | Responsável ou `ADMIN` | `{ idModulo, titulo, tempoMinutos?, idsQuestoes }` | Cria a atividade. |
| `DELETE /api/tests/:id` | Responsável ou `ADMIN` | UUID da atividade | Apaga a atividade. |

XP e moedas só na primeira vez. Quem gerencia o curso pode abrir as aulas, mas o progresso só conta para aluno inscrito.

### Inscrições

| Método e rota | Acesso | Corpo ou parâmetros | Retorno |
| --- | --- | --- | --- |
| `POST /api/enrollments` | Autenticado | `{ idCurso, turma? }`. Turma: `MANHA`, `TARDE`, `NOITE` ou `EAD`. | Inscreve (se tiver vaga). |
| `GET /api/enrollments/me` | Autenticado | — | Meus cursos com o progresso. |
| `DELETE /api/enrollments/:idCurso` | Autenticado | UUID do curso | Cancela a inscrição. |
| `GET /api/enrollments/curso/:idCurso` | Responsável ou `ADMIN` | UUID do curso | Alunos inscritos. |
| `POST /api/enrollments/curso/:idCurso` | Responsável ou `ADMIN` | `{ email, turma? }` | Inscreve alguém pelo e-mail. |

### Banco de questões

Só `ADMIN`, `PROFESSOR` e `PARCEIRO`. Professor e parceiro só mexem nas próprias questões.

| Método e rota | Corpo ou parâmetros | Retorno |
| --- | --- | --- |
| `GET /api/questions?page=1&busca=&dificuldade=&materia=&alternativas=&minhas=` | Filtros opcionais | 15 por página. |
| `GET /api/questions/report` | — | Totais por dificuldade, matéria e professor, e taxa de acerto. |
| `GET /api/questions/:id` | UUID da questão | A questão. |
| `POST /api/questions` | `{ titulo, enunciado, dificuldade, materia, tema?, explicacao?, alternativas: [{ texto, correta }] }` | Cria a questão. |
| `PUT /api/questions/:id` | Igual ao cadastro. | Atualiza. |
| `DELETE /api/questions/:id` | UUID da questão | Apaga. Dá `409` se já foi respondida. |

`dificuldade`: `FACIL`, `MEDIO` ou `DIFICIL`. `materia`: os mesmos valores das categorias de curso. De 2 a 5 alternativas, uma correta.

### Simulados e atividades

| Método e rota | Corpo ou parâmetros | Retorno |
| --- | --- | --- |
| `GET /api/exams?tipo=SIMULADO&page=1` | `tipo` aceita `SIMULADO` ou `ATIVIDADE` | Histórico. |
| `POST /api/exams` | `{ materias, dificuldade?, quantidade }` | Gera o simulado com questões sorteadas. |
| `POST /api/exams/activities/:idTeste` | UUID da atividade do curso | Começa a atividade (ou volta para a que está aberta). |
| `GET /api/exams/:id` | UUID da tentativa | Questões, respostas, tempo e resultado. |
| `PUT /api/exams/:id/answers/:idQuestao` | `{ idAlternativa }` (`null` limpa a resposta) | Salva a resposta. |
| `POST /api/exams/:id/questions/:idQuestao/hint` | — | Gasta uma Dica Extra e tira uma alternativa errada. |
| `POST /api/exams/:id/finish` | — | Corrige e devolve nota, acertos por matéria, XP e moedas. |

Plano Básico: 3 simulados por mês. Cada questão dá 2,5 minutos. Tempo Extra soma minutos e Boost multiplica o XP. Acabou o tempo, não aceita mais resposta (`409`), só finalizar.

### Loja, inventário e planos

| Método e rota | Acesso | Corpo ou parâmetros | Retorno |
| --- | --- | --- | --- |
| `GET /api/items?busca=&categoria=&todos=` | Autenticado | `todos=true` mostra os desativados (admin). | Itens e saldo. |
| `POST /api/items` | `ADMIN` | `{ nome, descricao?, preco, icone?, cor, categoria, efeito, ... }` | Cria o item. |
| `PUT /api/items/:id` | `ADMIN` | Mesmo corpo do cadastro | Atualiza. |
| `DELETE /api/items/:id` | `ADMIN` | UUID do item | Apaga ou desativa. |
| `POST /api/items/:id/purchase` | Autenticado | `{ quantidade? }` | Compra com moedas. |
| `GET /api/inventory` | Autenticado | — | Meus itens. |
| `POST /api/inventory/:id/activate` | Autenticado | UUID do item | Ativa o item. |
| `GET /api/plans` | Autenticado | — | Planos e o plano atual. |
| `POST /api/plans/:id/subscribe` | Autenticado | UUID do plano | Troca de plano. |

Item ativado vence sozinho (o servidor confere a cada minuto).

### Flashcards, progresso e painel

| Método e rota | Acesso | Corpo ou parâmetros | Retorno |
| --- | --- | --- | --- |
| `GET /api/flashcards` | Autenticado | — | Meus flashcards. |
| `POST /api/flashcards` | Autenticado | `{ titulo, pergunta, resposta, repeticoesMensais? }` | Cria. |
| `PUT /api/flashcards/:id` | Autenticado | Mesmo corpo do cadastro | Atualiza. |
| `DELETE /api/flashcards/:id` | Autenticado | UUID do flashcard | Apaga. |
| `POST /api/flashcards/:id/review` | Autenticado | UUID do flashcard | Marca como revisado. |
| `GET /api/progress/me` | Autenticado | — | Nível, XP, moedas, sequência, cursos e simulados. |
| `GET /api/dashboard/summary` | `ADMIN` | — | Números do painel do admin. |

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

Importante: libere CORS no bucket do R2 para o endereço do app (`GET` e `HEAD`). Sem isso, vídeo, áudio e PDF não abrem na versão web.

## Middlewares e segurança

- Helmet aplica headers de segurança HTTP padrão.
- CORS usa a configuração padrão do middleware.
- Express aceita JSON nas rotas.
- Tudo pede token, menos saúde, cadastro/login/códigos, ranking e `/api/media`.
- `exigirAdmin` e `exigirTipos(...)` limitam rotas por tipo de conta.
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
│   ├── schema.prisma
│   └── seed.ts                        # Dados de desenvolvimento
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
│   │   ├── auth/                      # Registro, login, códigos, senha e sessão
│   │   ├── users/                     # Usuários e perfis
│   │   ├── ranking/                   # Ranking por XP
│   │   ├── files/                     # Upload, consulta, exclusão e mídia pública
│   │   ├── courses/                   # CRUD, regras e estrutura de cursos
│   │   ├── sessions/                  # Sessões do curso
│   │   ├── course-modules/            # Módulos das sessões
│   │   ├── lessons/                   # Aulas, acesso aos arquivos e conclusão
│   │   ├── tests/                     # Atividades dos módulos
│   │   ├── enrollments/               # Inscrições
│   │   ├── questions/                 # Banco de questões
│   │   ├── exams/                     # Simulados e tentativas de atividades
│   │   ├── store/                     # Loja e inventário
│   │   ├── plans/                     # Planos de conta
│   │   ├── flashcards/                # Flashcards
│   │   ├── progress/                  # Progresso e recompensas
│   │   └── dashboard/                 # Resumo do painel administrativo
│   ├── services/
│   │   └── email.service.ts           # Envio SMTP
│   └── shared/                        # Erros, paginação e dados do usuário autenticado
├── tmp/uploads/                       # Arquivos temporários de upload
├── .env.example
├── package.json
├── pnpm-lock.yaml
├── prisma7.config.ts
├── tsconfig.json
└── README.md
```

Todos os módulos de `src/modules` são registrados em `src/app.ts`.

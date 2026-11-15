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
- `CursoProfessor` e `Inscricao`: vínculos de professores e matrículas em cursos.
- `Sessao`, `Modulo`, `Aula`, `Teste`, `Questao`, `Alternativa`, `TesteQuestao`, `TentativaTeste` e `TentativaQuestao`: conteúdo acadêmico, avaliações e histórico de respostas.
- `Progresso`: registro de conclusão de materiais e avaliações.
- `Item` e `Inventario`: itens da loja, compras e boosts de recompensa.
- `Flashcard`: cartões pessoais com agenda de revisão.

Enums principais:

- Usuário: `TipoUsuario` (`ALUNO`, `PROFESSOR`, `PARCEIRO`, `ADMIN`) e `StatusUsuario` (`PENDENTE`, `ATIVO`, `INATIVO`).
- Perfil: `TipoPerfil` (`PUBLICO`, `PRIVADO`).
- Arquivo: `TipoArquivo`, `FinalidadeArquivo` e `StatusArquivo`.
- Curso: `CategoriaCurso` e `StatusCurso` (`RASCUNHO`, `INATIVO`, `ATIVO`).
- Conteúdo: `TipoMaterial`, `TipoTeste` e `NivelDificuldade`.
- Loja: `CategoriaItem`, `IconeItem`, `StatusItem` e `StatusInventario`.

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
| `POST /api/auth/forgot-password` | Público | `{ email }`. Solicita um código de recuperação e envia por e-mail quando a conta existir. A resposta é genérica para evitar enumeração de usuários. |
| `POST /api/auth/reset-password` | Público | `{ email, codigo, senha }`. Valida o código e redefine a senha do usuário. A senha deve conter entre 8 e 72 caracteres. |
| `GET /api/auth/me` | Autenticado | Retorna os dados da sessão, da conta e do perfil. |

O cadastro cria o usuário como `PENDENTE`, gera um código de seis caracteres com validade de 10 minutos e envia-o por e-mail. O código não é retornado pela API. O fluxo de recuperação usa o mesmo padrão: o usuário solicita o código por e-mail e, em seguida, envia `email + codigo + novaSenha` para redefinir a senha.

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
| `POST /api/courses` | Autenticado | `multipart/form-data`: campos `nome`, `categoria`, `cargaHoraria?`, `descricao?`, `vagas?`, `preco?`, `cor?`, `capa?`; campo opcional de arquivo `arquivo`. | `201`: curso criado e automaticamente convertido em parceiro caso o usuário seja `ALUNO`. |
| `GET /api/courses/:id` | Responsável/`ADMIN` para cursos não ativos; público entre usuários autenticados para cursos ativos | UUID do curso | `200`: curso completo. |
| `PATCH /api/courses/:id` | Responsável ou `ADMIN` | Multipart ou JSON com campos opcionais `nome`, `categoria`, `cargaHoraria`, `descricao`, `vagas`, `preco`, `cor`, `capa`, `status`. Pode enviar uma nova `arquivo`. | `200`: curso atualizado. |
| `DELETE /api/courses/:id` | Responsável ou `ADMIN` | UUID do curso | Remove o curso e, se houver, tenta remover a capa no R2. |
| `GET /api/courses/minhas-inscricoes` | Autenticado | Sem parâmetros | Cursos em que o usuário está inscrito. |
| `POST /api/courses/:id/inscricoes` | Autenticado | UUID do curso | Inscreve o próprio usuário em curso ativo com vagas disponíveis. |
| `GET /api/courses/:id/inscricoes/me` | Autenticado | UUID do curso | Consulta a própria inscrição. |
| `DELETE /api/courses/:id/inscricoes/me` | Autenticado | UUID do curso | Cancela a própria inscrição. |
| `GET /api/courses/:id/inscricoes?pagina=1` | Responsável ou `ADMIN` | Página opcional | Lista inscritos, 30 por página. |
| `GET /api/courses/:id/conteudo` | Responsável, professor vinculado, administrador ou aluno inscrito em curso ativo | UUID do curso | Árvore do curso com conteúdo e materiais acessíveis. |
| `GET /api/courses/:id/professores/disponiveis?pagina=1` | Responsável ou `ADMIN` | Página opcional | Professores ativos ainda não vinculados, 30 por página. |
| `GET /api/courses/:id/professores` | Responsável ou `ADMIN` | UUID do curso | Lista professores vinculados. |
| `POST /api/courses/:id/professores` | Responsável ou `ADMIN` | `{ "idProfessor": "uuid" }` | Vincula professor ativo ao curso. |
| `DELETE /api/courses/:id/professores/:idProfessor` | Responsável ou `ADMIN` | UUIDs do curso e professor | Remove o vínculo do professor. |

No cadastro:

- `nome`: texto entre 3 e 150 caracteres.
- `cargaHoraria`: inteiro positivo ou `null`.
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

Inscrições só podem ser feitas em cursos `ATIVO` e respeitam o limite de vagas. A matrícula em um curso pago ainda é confirmada de forma simulada; a API não integra um provedor de pagamentos.

### Sessões, módulos e aulas

Esses recursos organizam o conteúdo como curso → sessões → módulos → aulas. Todas as rotas exigem JWT. O responsável pelo curso, professores vinculados e administradores podem gerenciar conteúdo; leitura também é permitida a alunos inscritos em cursos ativos. Aulas e materiais seguem as mesmas permissões do curso.

| Método e rota | Corpo ou parâmetros | Descrição |
| --- | --- | --- |
| `POST /api/sessions` | `{ idCurso, titulo, subtitulo?, descricao? }` | Cria sessão; título de 3 a 150 caracteres. |
| `GET /api/sessions?idCurso=:uuid` | `idCurso` obrigatório | Lista sessões do curso. |
| `GET /api/sessions/:id` | UUID da sessão | Consulta sessão e contagem de módulos. |
| `PATCH /api/sessions/:id` | Um ou mais de `titulo`, `subtitulo`, `descricao` | Atualiza sessão. |
| `DELETE /api/sessions/:id` | UUID da sessão | Exclui sessão. |
| `POST /api/course-modules` | `{ idSessao, titulo, descricao? }` | Cria módulo dentro de uma sessão. |
| `GET /api/course-modules?idSessao=:uuid` | `idSessao` obrigatório | Lista módulos da sessão. |
| `GET /api/course-modules/:id` | UUID do módulo | Consulta módulo e contagens de aulas/testes. |
| `PATCH /api/course-modules/:id` | Um ou mais de `titulo`, `descricao` | Atualiza módulo. |
| `DELETE /api/course-modules/:id` | UUID do módulo | Exclui módulo. |
| `POST /api/lessons` | `multipart/form-data` com `idModulo`, `titulo`, `tipo`, metadados opcionais e `arquivo` obrigatório | Cria aula e envia o material ao R2. |
| `GET /api/lessons?idModulo=:uuid` | `idModulo` obrigatório | Lista aulas do módulo. |
| `GET /api/lessons/:id` | UUID da aula | Consulta aula e disponibiliza URL assinada do material. |
| `PATCH /api/lessons/:id` | `{ titulo?, descricao? }` | Atualiza metadados da aula. |
| `DELETE /api/lessons/:id` | UUID da aula | Exclui aula e material associado. |
| `POST /api/lessons/:id/progresso` | UUID da aula | Marca material como concluído e concede recompensa uma única vez. |

`tipo` da aula aceita `VIDEO`, `AUDIO`, `PDF`, `DOCUMENTO` ou `OUTRO`. PDF exige `quantidadePaginas`; vídeo e áudio exigem `duracaoMinutos`. O upload usa o campo multipart `arquivo` e está sujeito aos limites e formatos descritos em [Uploads e Cloudflare R2](#uploads-e-cloudflare-r2).

A conclusão de material concede inicialmente 2 moedas e 5 XP. Se houver boost válido ativo no inventário, seu multiplicador é aplicado às moedas e ao XP. Não existe uma rota separada `/api/progress`; o registro de progresso é feito pelas rotas de conclusão de aula e envio de tentativa.

### Questões

Rotas protegidas. Cadastro e listagem são permitidos a `PROFESSOR`, `PARCEIRO` e `ADMIN`; o autor ou um administrador pode alterar ou excluir uma questão. Questões têm de 2 a 5 alternativas únicas (`A` a `E`) e uma alternativa correta.

| Método e rota | Corpo ou parâmetros | Descrição |
| --- | --- | --- |
| `POST /api/questions` | `{ titulo?, enunciado, tema, dificuldade?, alternativas, letraCorreta }` | Cria questão com alternativas. Dificuldade padrão: `MEDIO`. |
| `GET /api/questions?pagina=1&limite=30&dificuldade=&tema=&busca=` | Filtros opcionais | Lista e pesquisa por tema, título ou enunciado; limite máximo 100. |
| `GET /api/questions/:id` | UUID da questão | Consulta questão e gabarito para perfis autorizados. |
| `PATCH /api/questions/:id` | Campos opcionais da criação | Atualiza questão; ao substituir alternativas, informe também `letraCorreta`. |
| `DELETE /api/questions/:id` | UUID da questão | Exclui questão, se não estiver em uso. |

`dificuldade` aceita `FACIL`, `MEDIO` ou `DIFICIL`; `tema` filtra por correspondência exata sem diferenciar maiúsculas de minúsculas. O enunciado aceita até 20.000 caracteres; o título e o tema, até 150; cada alternativa, até 5.000. Alunos não podem administrar o banco de questões.

### Atividades, simulados e tentativas

Todas as rotas exigem autenticação. Atividades pertencem a módulos de cursos e são gerenciadas pelo responsável do curso, professores vinculados ou administradores. Alunos inscritos em cursos ativos podem realizá-las. Simulados personalizados são associados ao criador; qualquer usuário autenticado pode criar o seu.

| Método e rota | Corpo ou parâmetros | Descrição |
| --- | --- | --- |
| `POST /api/tests/activities` | `{ idModulo, tema?, tempoMinutos, questaoIds }` | Cria atividade usando de 1 a 100 questões existentes. |
| `POST /api/tests/simulados` | `{ tema, tempoMinutos, dificuldade, quantidadeQuestoes }` | Cria configuração de simulado; as questões são sorteadas ao iniciar a tentativa. |
| `GET /api/tests?tipo=&idModulo=&pagina=1&limite=30` | Filtros opcionais | Lista testes acessíveis ao usuário; limite máximo 100. |
| `GET /api/tests/:id` | UUID do teste | Consulta teste acessível. |
| `PATCH /api/tests/:id` | Campos de teste aplicáveis | Atualiza teste conforme tipo e permissões; alguns campos não são editáveis após uso. |
| `DELETE /api/tests/:id` | UUID do teste | Exclui teste, se não houver impedimento por tentativas existentes. |
| `POST /api/tests/:id/attempts` | UUID do teste | Inicia tentativa e retorna questões sem expor o gabarito. |
| `POST /api/tests/attempts/:id/submit` | `{ "respostas": [{ "idQuestao": "uuid", "resposta": "A" }] }` | Envia respostas, calcula resultado e finaliza a tentativa. `resposta` também pode ser `null`. |
| `GET /api/tests/attempts?pagina=1&limite=30` | Paginação opcional | Lista as tentativas do usuário autenticado; limite máximo 100. |
| `GET /api/tests/attempts/:id` | UUID da tentativa | Consulta tentativa própria. |

`tempoMinutos` deve ser inteiro de 1 a 600; `dificuldade` aceita `FACIL`, `MEDIO` ou `DIFICIL`; simulados aceitam de 1 a 100 questões e exigem quantidade suficiente de questões cadastradas no tema e dificuldade selecionados. O envio é final: uma tentativa concluída não pode receber novas respostas.

A conclusão também registra progresso e recompensa de XP/moedas. Os valores variam conforme o tipo do teste e a nota; dificuldade e tempo podem aplicar multiplicadores, e um boost ativo também pode multiplicar a recompensa. O envio repetido não concede recompensa duplicada.

### Loja, itens e inventário

Todas as rotas exigem autenticação. O catálogo da loja, compras e inventário são voltados ao usuário; a administração do catálogo exige `ADMIN`.

| Método e rota | Acesso | Corpo ou parâmetros | Descrição |
| --- | --- | --- | --- |
| `GET /api/items/loja` | Autenticado | Sem parâmetros | Lista itens ativos ordenados por preço. |
| `POST /api/items/:id/comprar` | Autenticado | UUID do item | Compra item usando moedas e adiciona ao inventário. |
| `GET /api/items/inventario` | Autenticado | Sem parâmetros | Lista inventário do usuário autenticado. |
| `PATCH /api/items/inventario/:idInventario/ativar` | Autenticado | UUID do item no inventário | Ativa item compatível, incluindo boosts. |
| `GET /api/items/inventario/:idInventario/verificar` | Autenticado | UUID do item no inventário | Verifica estado/validade do item. |
| `POST /api/items` | `ADMIN` | `{ nome, descricao, preco, categoria, icone, boost, tempoUso, cor }` | Cria item do catálogo. |
| `GET /api/items?pagina=1&nome=&categoria=&status=` | `ADMIN` | Filtros opcionais | Lista itens, 30 por página. |
| `GET /api/items/:id` | `ADMIN` | UUID do item | Consulta item. |
| `PATCH /api/items/:id` | `ADMIN` | Campos do item e/ou `status` | Atualiza item. |
| `DELETE /api/items/:id` | `ADMIN` | UUID do item | Inativa item; não remove registros históricos de compras. |

Atualmente a categoria permitida é `BOOST`. Ícones disponíveis: `RAIO`, `ESCUDO`, `LAMPADA`, `CRONOMETRO`, `REINICIAR`, `AVATAR` e `ESTRELA`. `preco` é inteiro não negativo, `boost` é maior que 1 e no máximo 100, e `tempoUso` é inteiro positivo.

### Flashcards

Rotas protegidas; cada usuário só pode consultar e administrar os próprios flashcards. A listagem ordena os cartões pela próxima revisão.

| Método e rota | Corpo ou parâmetros | Descrição |
| --- | --- | --- |
| `POST /api/flashcards` | `{ titulo, pergunta, resposta, repeticoesMes }` | Cria flashcard pessoal. |
| `GET /api/flashcards?pagina=1&limite=30&busca=` | Filtros opcionais | Lista/pesquisa por título ou pergunta; limite máximo 100. |
| `GET /api/flashcards/:id` | UUID do flashcard | Consulta flashcard próprio. |
| `PATCH /api/flashcards/:id` | Um ou mais campos da criação | Atualiza flashcard e recalcula a próxima revisão se `repeticoesMes` mudar. |
| `DELETE /api/flashcards/:id` | UUID do flashcard | Exclui flashcard próprio. |
| `POST /api/flashcards/:id/visualizar` | UUID do flashcard | Registra visualização e agenda a próxima revisão. |

`repeticoesMes` é inteiro entre 1 e 30. A próxima revisão usa o intervalo de 30 dias dividido pela frequência mensal configurada.

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
- As rotas de autenticação, ranking e saúde são públicas conforme descrito acima; cursos, sessões, módulos, aulas, questões, testes, itens, flashcards, usuários e arquivos usam autenticação JWT, com exceção das rotas públicas de registro, validação e login.
- `/api/users` usa verificação adicional de administrador em operações protegidas.
- Cursos e conteúdo verificam responsável, professor vinculado, administrador ou inscrição ativa conforme a operação.
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
│   │   ├── courses/                   # Cursos, inscrições, professores e acessos
│   │   ├── sessions/                  # Sessões dos cursos
│   │   ├── course-modules/            # Módulos das sessões
│   │   ├── lessons/                   # Aulas, materiais e conclusão
│   │   ├── questions/                 # Questões e alternativas
│   │   ├── tests/                     # Atividades, simulados e tentativas
│   │   ├── items/                     # Loja, itens e inventário
│   │   ├── flashcards/                # Flashcards e revisões
│   │   └── progress/                  # Cálculo de progresso e recompensas
│   ├── services/
│   │   └── email.service.ts           # Envio SMTP
├── tmp/uploads/                       # Arquivos temporários de upload
├── .env.example
├── package.json
├── pnpm-lock.yaml
├── prisma7.config.ts
├── tsconfig.json
└── README.md
```

A aplicação registra esses módulos em `src/app.ts`. O progresso é registrado pelas operações de conclusão de aulas e tentativas de testes; não há um router próprio para `/api/progress`.

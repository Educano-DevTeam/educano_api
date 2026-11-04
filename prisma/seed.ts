/**
 * Dados de desenvolvimento do Educano.
 *
 * Uso: pnpm seed            (só popula um banco vazio)
 *      pnpm seed -- --reset (apaga TODOS os dados e popula de novo)
 *
 * Contas criadas (senha em SEED_PASSWORD, padrão "Educano@2026"):
 *   admin@educano.local      ADMIN
 *   professor@educano.local  PROFESSOR
 *   parceiro@educano.local   PARCEIRO
 *   aluno@educano.local      ALUNO (inscrito em cursos, com XP e itens)
 *
 * Os arquivos de exemplo das aulas são enviados ao bucket configurado
 * (R2_*) a partir de SEED_ASSETS_DIR (padrão: ../educano_app/lib/assets).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "../src/config/prisma.js";
import { R2_BUCKET, r2Client } from "../src/config/storage.js";
import { calcularNivel } from "../src/modules/progress/services/recompensas.service.js";
import type {
  CategoriaCurso,
  NivelDificuldade,
  TipoArquivo,
} from "../src/generated/prisma/client.js";

const SENHA = process.env.SEED_PASSWORD || "Educano@2026";
const ASSETS = path.resolve(
  process.env.SEED_ASSETS_DIR || path.join(process.cwd(), "..", "educano_app", "lib", "assets"),
);

if (process.env.NODE_ENV === "production") {
  console.error("O seed de desenvolvimento não deve ser executado em produção.");
  process.exit(1);
}

async function existe(arquivo: string) {
  try {
    return (await stat(arquivo)).isFile();
  } catch {
    return false;
  }
}

async function limparBanco() {
  // A ordem respeita as chaves estrangeiras.
  await prisma.respostaTentativa.deleteMany();
  await prisma.tentativaTeste.deleteMany();
  await prisma.testeQuestao.deleteMany();
  await prisma.teste.deleteMany();
  await prisma.progressoAula.deleteMany();
  await prisma.aula.deleteMany();
  await prisma.modulo.deleteMany();
  await prisma.sessao.deleteMany();
  await prisma.inscricao.deleteMany();
  await prisma.curso.deleteMany();
  await prisma.questao.updateMany({ data: { idAlternativaCorreta: null } });
  await prisma.alternativa.deleteMany();
  await prisma.questao.deleteMany();
  await prisma.arquivo.deleteMany();
  await prisma.ativacaoItem.deleteMany();
  await prisma.inventarioItem.deleteMany();
  await prisma.item.deleteMany();
  await prisma.movimentacaoRecompensa.deleteMany();
  await prisma.flashcard.deleteMany();
  await prisma.codigoValidacao.deleteMany();
  await prisma.perfil.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.planoConta.deleteMany();
}

async function criarPlanos() {
  const basico = await prisma.planoConta.create({
    data: {
      nome: "Básico",
      precoCentavos: 0,
      cor: "#7DAB9E",
      icone: "school",
      beneficios: ["Acesso a cursos gratuitos", "Até 3 simulados por mês", "Ranking global", "Suporte por e-mail"],
      indisponiveis: ["Simulados ilimitados", "Relatórios avançados", "Suporte prioritário"],
      limiteSimuladosMes: 3,
      ordem: 0,
    },
  });

  await prisma.planoConta.create({
    data: {
      nome: "Pro",
      precoCentavos: 2990,
      cor: "#425BC2",
      icone: "workspace_premium",
      destaque: "Mais Popular",
      beneficios: [
        "Todos os cursos disponíveis",
        "Simulados ilimitados",
        "Ranking global",
        "Relatórios de desempenho",
        "Suporte prioritário",
        "Certificados digitais",
      ],
      indisponiveis: ["Mentoria individual", "Conteúdo exclusivo"],
      limiteSimuladosMes: null,
      ordem: 1,
    },
  });

  await prisma.planoConta.create({
    data: {
      nome: "Premium",
      precoCentavos: 5990,
      cor: "#FFA62B",
      icone: "diamond",
      beneficios: [
        "Tudo do plano Pro",
        "Mentoria individual mensal",
        "Conteúdo exclusivo",
        "Acesso antecipado a novidades",
        "Badge exclusivo no perfil",
      ],
      indisponiveis: [],
      limiteSimuladosMes: null,
      ordem: 2,
    },
  });

  return basico;
}

async function criarUsuario(
  nome: string,
  email: string,
  tipo: "ALUNO" | "PROFESSOR" | "PARCEIRO" | "ADMIN",
  senhaHash: string,
  idPlano: string,
  xp = 0,
  extras: { moedas?: number; sequenciaDias?: number } = {},
) {
  return prisma.usuario.create({
    data: {
      nome,
      email,
      senha: senhaHash,
      tipo,
      status: "ATIVO",
      perfil: {
        create: {
          tipoPerfil: "PUBLICO",
          planoContaId: idPlano,
          xp,
          nivel: calcularNivel(xp),
          moedas: extras.moedas ?? 0,
          sequenciaDias: extras.sequenciaDias ?? 0,
          ultimaAtividadeEm: xp > 0 ? new Date() : null,
          cor: "#425BC2",
        },
      },
    },
    select: { id: true, email: true },
  });
}

interface QuestaoSeed {
  titulo: string;
  enunciado: string;
  dificuldade: NivelDificuldade;
  materia: CategoriaCurso;
  tema: string;
  explicacao: string;
  alternativas: string[];
  correta: number;
}

const QUESTOES: QuestaoSeed[] = [
  {
    titulo: "Texto 1 — Redes sociais e esfera pública",
    enunciado:
      "As redes sociais digitais reconfiguraram a noção de esfera pública. Se antes o acesso " +
      "à tribuna exigia mediação institucional, hoje a emissão de mensagens é instantânea e " +
      "descentralizada. Contudo, a aparente democratização da palavra vem acompanhada de uma " +
      "economia da atenção, na qual o algoritmo premia o engajamento pelo clímax emocional, " +
      "transformando o debate complexo em polarização espetacularizada.\n\n" +
      "O impacto desse modelo algorítmico na sociedade resulta em:",
    dificuldade: "MEDIO",
    materia: "LINGUAGENS",
    tema: "Interpretação de Texto",
    explicacao:
      "O texto afirma que o algoritmo premia o clímax emocional, o que reduz a complexidade " +
      "do debate em favor de reações passionais.",
    alternativas: [
      "Ampliação do rigor crítico nas discussões políticas cotidianas.",
      "Superação definitiva das barreiras de acesso à informação qualificada.",
      "Redução da complexidade dos fatos em favor de reações passionais.",
      "Fortalecimento das instituições tradicionais de imprensa escrita.",
      "Neutralidade ideológica na circulação de conteúdos na internet.",
    ],
    correta: 2,
  },
  {
    titulo: "Energia solar na escola",
    enunciado:
      "Uma escola instalou painéis solares que geram 18 kWh de energia por dia. Em cinco dias " +
      "de funcionamento, os painéis geram, ao todo:",
    dificuldade: "FACIL",
    materia: "EXATAS",
    tema: "Operações Básicas",
    explicacao: "Basta multiplicar: 18 kWh × 5 dias = 90 kWh.",
    alternativas: ["23 kWh", "60 kWh", "80 kWh", "90 kWh", "108 kWh"],
    correta: 3,
  },
  {
    titulo: "Alagamentos urbanos",
    enunciado:
      "Em uma área urbana, a substituição de superfícies vegetadas por asfalto e concreto reduz " +
      "a infiltração da água no solo. Uma medida que ajuda a diminuir alagamentos e recuperar " +
      "essa infiltração é:",
    dificuldade: "MEDIO",
    materia: "CIENCIAS_NATURAIS",
    tema: "Meio Ambiente",
    explicacao:
      "Jardins de chuva e pavimentos permeáveis aumentam a área por onde a água infiltra no solo.",
    alternativas: [
      "Ampliar a pavimentação impermeável das calçadas.",
      "Canalizar todos os cursos d’água da região.",
      "Instalar jardins de chuva e pavimentos permeáveis.",
      "Remover a vegetação das margens dos rios.",
      "Aumentar a velocidade de escoamento para os bairros baixos.",
    ],
    correta: 2,
  },
  {
    titulo: "Golpe de 1964",
    enunciado: "Qual foi um dos principais acontecimentos de 1º de abril de 1964 no Brasil?",
    dificuldade: "MEDIO",
    materia: "CIENCIAS_HUMANAS",
    tema: "Ditadura Militar",
    explicacao:
      "Em 1964, um golpe civil-militar depôs o presidente João Goulart e deu início à ditadura.",
    alternativas: ["Golpe militar que depôs João Goulart", "Proclamação da Independência", "Criação do Plano Real"],
    correta: 0,
  },
  {
    titulo: "Função quadrática",
    enunciado: "Dada a função f(x) = x², qual é o valor de f(2)?",
    dificuldade: "FACIL",
    materia: "EXATAS",
    tema: "Funções",
    explicacao: "f(2) = 2² = 4.",
    alternativas: ["2", "4", "8"],
    correta: 1,
  },
  {
    titulo: "Atos Institucionais",
    enunciado: "O AI-5, decretado em 1968, ficou conhecido principalmente por:",
    dificuldade: "MEDIO",
    materia: "CIENCIAS_HUMANAS",
    tema: "Ditadura Militar",
    explicacao:
      "O AI-5 fechou o Congresso, suspendeu o habeas corpus para crimes políticos e ampliou a censura.",
    alternativas: [
      "Restabelecer as eleições diretas para presidente.",
      "Endurecer o regime, suspendendo garantias e ampliando a censura.",
      "Conceder anistia aos presos políticos.",
      "Criar o bipartidarismo com ARENA e MDB pela primeira vez.",
    ],
    correta: 1,
  },
  {
    titulo: "Presidente deposto em 1964",
    enunciado: "Quem era o presidente do Brasil quando ocorreu o golpe de 1964?",
    dificuldade: "FACIL",
    materia: "CIENCIAS_HUMANAS",
    tema: "Ditadura Militar",
    explicacao: "João Goulart (Jango) governava o país e foi deposto em 1964.",
    alternativas: ["Getúlio Vargas", "Juscelino Kubitschek", "João Goulart", "Jânio Quadros"],
    correta: 2,
  },
  {
    titulo: "Fim da ditadura",
    enunciado: "Em que ano um presidente civil voltou a assumir o governo após a ditadura militar?",
    dificuldade: "DIFICIL",
    materia: "CIENCIAS_HUMANAS",
    tema: "Ditadura Militar",
    explicacao: "Em 1985 José Sarney assumiu a presidência, encerrando o ciclo de presidentes militares.",
    alternativas: ["1979", "1985", "1988", "1990"],
    correta: 1,
  },
  {
    titulo: "Porcentagem",
    enunciado: "Um produto de R$ 200,00 recebeu desconto de 15%. Qual é o novo preço?",
    dificuldade: "FACIL",
    materia: "EXATAS",
    tema: "Porcentagem",
    explicacao: "15% de 200 = 30. Logo, 200 − 30 = R$ 170,00.",
    alternativas: ["R$ 170,00", "R$ 185,00", "R$ 150,00", "R$ 230,00"],
    correta: 0,
  },
  {
    titulo: "Equação do 1º grau",
    enunciado: "Qual é a solução da equação 3x + 6 = 21?",
    dificuldade: "MEDIO",
    materia: "EXATAS",
    tema: "Equações",
    explicacao: "3x = 21 − 6 = 15, então x = 5.",
    alternativas: ["x = 3", "x = 5", "x = 7", "x = 9"],
    correta: 1,
  },
  {
    titulo: "Progressão aritmética",
    enunciado: "Em uma PA de primeiro termo 2 e razão 3, qual é o 10º termo?",
    dificuldade: "DIFICIL",
    materia: "EXATAS",
    tema: "Sequências",
    explicacao: "aₙ = a₁ + (n − 1)·r = 2 + 9·3 = 29.",
    alternativas: ["27", "29", "30", "32", "35"],
    correta: 1,
  },
  {
    titulo: "Figuras de linguagem",
    enunciado: "Em “Seus olhos são duas estrelas”, temos um exemplo de:",
    dificuldade: "FACIL",
    materia: "LINGUAGENS",
    tema: "Figuras de Linguagem",
    explicacao: "A metáfora é uma comparação implícita, sem conectivo como “como”.",
    alternativas: ["Metáfora", "Hipérbole", "Ironia", "Metonímia"],
    correta: 0,
  },
  {
    titulo: "Dom Casmurro",
    enunciado: "Quem escreveu o romance “Dom Casmurro”?",
    dificuldade: "FACIL",
    materia: "LINGUAGENS",
    tema: "Literatura",
    explicacao: "Dom Casmurro foi publicado por Machado de Assis em 1899.",
    alternativas: ["José de Alencar", "Machado de Assis", "Clarice Lispector", "Graciliano Ramos"],
    correta: 1,
  },
  {
    titulo: "Fotossíntese",
    enunciado: "Qual gás as plantas absorvem do ar para realizar a fotossíntese?",
    dificuldade: "FACIL",
    materia: "CIENCIAS_NATURAIS",
    tema: "Biologia",
    explicacao: "Na fotossíntese, as plantas absorvem gás carbônico (CO₂) e liberam oxigênio.",
    alternativas: ["Oxigênio", "Nitrogênio", "Gás carbônico", "Hidrogênio"],
    correta: 2,
  },
  {
    titulo: "Velocidade média",
    enunciado: "Um carro percorre 180 km em 2 horas. Qual é a sua velocidade média?",
    dificuldade: "MEDIO",
    materia: "CIENCIAS_NATURAIS",
    tema: "Física",
    explicacao: "v = Δs / Δt = 180 km / 2 h = 90 km/h.",
    alternativas: ["60 km/h", "80 km/h", "90 km/h", "120 km/h"],
    correta: 2,
  },
  {
    titulo: "Tratado de Tordesilhas",
    enunciado: "O Tratado de Tordesilhas (1494) dividiu as terras descobertas entre:",
    dificuldade: "MEDIO",
    materia: "CIENCIAS_HUMANAS",
    tema: "Brasil Colônia",
    explicacao: "O tratado dividiu as terras entre Portugal e Espanha por um meridiano imaginário.",
    alternativas: ["Portugal e Espanha", "Portugal e França", "Espanha e Inglaterra", "França e Holanda"],
    correta: 0,
  },
];

async function criarQuestoes(idProfessor: string) {
  const ids: Record<string, string> = {};

  for (const questao of QUESTOES) {
    const criada = await prisma.questao.create({
      data: {
        titulo: questao.titulo,
        enunciado: questao.enunciado,
        dificuldade: questao.dificuldade,
        materia: questao.materia,
        tema: questao.tema,
        explicacao: questao.explicacao,
        idResponsavel: idProfessor,
      },
      select: { id: true },
    });

    let idCorreta = "";

    for (const [ordem, texto] of questao.alternativas.entries()) {
      const alternativa = await prisma.alternativa.create({
        data: { idQuestao: criada.id, idResponsavel: idProfessor, texto, ordem },
        select: { id: true },
      });
      if (ordem === questao.correta) idCorreta = alternativa.id;
    }

    await prisma.questao.update({
      where: { id: criada.id },
      data: { idAlternativaCorreta: idCorreta },
    });

    ids[questao.titulo] = criada.id;
  }

  return ids;
}

/** Envia um arquivo de exemplo ao bucket e registra em Arquivo. */
async function enviarArquivoDemo(
  caminhoRelativo: string,
  tipo: TipoArquivo,
  finalidade: "MATERIAL_AULA" | "CAPA_CURSO",
  contentType: string,
  idOrigem: string,
) {
  const origem = path.join(ASSETS, caminhoRelativo);

  if (!(await existe(origem))) {
    console.warn(`Arquivo de exemplo não encontrado: ${origem}. Ignorado.`);
    return null;
  }

  const nome = path.basename(origem);
  const pasta = finalidade === "CAPA_CURSO" ? "cursos/capas" : `materiais/${tipo.toLowerCase()}`;
  const chaveObjeto = `educano/${pasta}/${idOrigem}/${randomUUID()}-${nome}`;
  const conteudo = await readFile(origem);

  const resultado = await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: chaveObjeto,
      Body: conteudo,
      ContentType: contentType,
      ContentLength: conteudo.length,
    }),
  );

  const arquivo = await prisma.arquivo.create({
    data: {
      idOrigem,
      tipo,
      finalidade,
      nomeOriginal: nome,
      chaveObjeto,
      bucket: R2_BUCKET,
      contentType,
      tamanhoBytes: BigInt(conteudo.length),
      etag: resultado.ETag ?? null,
      status: "CONCLUIDO",
    },
    select: { id: true },
  });

  return arquivo.id;
}

async function criarCursoVestibular(idAdmin: string, questoes: Record<string, string>) {
  const capa = await enviarArquivoDemo(
    "courses/vestibular_course_image.jpg",
    "IMAGEM",
    "CAPA_CURSO",
    "image/jpeg",
    idAdmin,
  );

  const curso = await prisma.curso.create({
    data: {
      nome: "Vestibular 2026 - Curso Preparatório",
      descricao:
        "Este curso preparatório completo para o vestibular oferece aulas diárias, material " +
        "didático atualizado, simulados semanais e suporte para organizar a rotina.",
      categoria: "VESTIBULAR",
      status: "ATIVO",
      vagas: 200,
      cor: "#425BC2",
      idCapa: capa,
      iconeCapa: capa ? null : "livro",
      idResponsavel: idAdmin,
      idAdminAutorizador: idAdmin,
      autorizadoEm: new Date(),
    },
    select: { id: true },
  });

  // Sessões e módulos em ordem de criação.
  let horario = Date.now() - 60 * 60 * 1000;
  const proximo = () => new Date(horario++);

  const sessao = (titulo: string, subtitulo: string, descricao: string) =>
    prisma.sessao.create({
      data: { idCurso: curso.id, titulo, subtitulo, descricao, idResponsavel: idAdmin, criadoEm: proximo() },
      select: { id: true },
    });

  const modulo = (idSessao: string, titulo: string, descricao: string, licaoTitulo?: string, xp = 0) =>
    prisma.modulo.create({
      data: { idSessao, titulo, descricao, licaoTitulo, xp, idResponsavel: idAdmin, criadoEm: proximo() },
      select: { id: true },
    });

  const aula = async (
    idModulo: string,
    titulo: string,
    descricao: string,
    tipo: "VIDEO" | "AUDIO" | "PDF",
    arquivo: string,
    contentType: string,
    extras: { duracaoMinutos?: number; quantidadePaginas?: number } = {},
  ) => {
    const idArquivo = await enviarArquivoDemo(arquivo, tipo, "MATERIAL_AULA", contentType, idAdmin);
    if (!idArquivo) return null;

    return prisma.aula.create({
      data: { idModulo, titulo, descricao, tipo, idArquivo, idResponsavel: idAdmin, criadoEm: proximo(), ...extras },
      select: { id: true },
    });
  };

  const linguagens = await sessao(
    "Linguagens",
    "Do Português Básico ao Inglês Avançado",
    "Fundamentos de linguagem, interpretação, gramática e produção textual.",
  );
  const interpretacao = await modulo(
    linguagens.id,
    "Módulo 1: Interpretação de Texto",
    "Leitura, contexto e identificação de ideias principais.",
    "Lendo nas entrelinhas",
    50,
  );
  await aula(interpretacao.id, "Introdução: interpretação", "Aula introdutória em vídeo.", "VIDEO", "videoplayback.mp4", "video/mp4", { duracaoMinutos: 24 });

  const exatas = await sessao("Exatas", "Matemática na Prática", "Matemática aplicada às questões mais recorrentes dos vestibulares.");
  await modulo(exatas.id, "Módulo 1: Fundamentos", "Operações, proporções e resolução de problemas.", "Base sólida", 40);

  const humanas = await sessao(
    "C. Humanas",
    "500 anos de História",
    "O módulo de ciências humanas integra História, Geografia, Sociologia e Filosofia.",
  );
  await modulo(humanas.id, "Módulo 1: O Tratado de Tordesilhas", "Conteúdo e atividades sobre O Tratado de Tordesilhas.");
  await modulo(humanas.id, "Módulo 2: Brasil Colônia", "Conteúdo e atividades sobre o Brasil Colônia.");
  const ditadura = await modulo(
    humanas.id,
    "Módulo 3: Ditadura Militar",
    "Período autoritário brasileiro e seus principais acontecimentos.",
    "Anos de chumbo",
    80,
  );

  const jango = await aula(ditadura.id, "Introdução: Jango", "Aula em vídeo.", "VIDEO", "videoplayback.mp4", "video/mp4", { duracaoMinutos: 35 });
  await aula(ditadura.id, "O Golpe de 1º de Abril", "Material em PDF.", "PDF", "ditadura.pdf", "application/pdf", { quantidadePaginas: 12 });
  await aula(ditadura.id, "Atos Institucionais (AI)", "Áudio complementar.", "AUDIO", "videoplayback.m4a", "audio/mp4", { duracaoMinutos: 21 });

  const idsAtividade = ["Golpe de 1964", "Atos Institucionais", "Presidente deposto em 1964", "Fim da ditadura"]
    .map((titulo) => questoes[titulo]);

  await prisma.teste.create({
    data: {
      idModulo: ditadura.id,
      idResponsavel: idAdmin,
      tipo: "ATIVIDADE",
      tema: "Questões de Prática",
      tempoMinutos: 10,
      quantidadeQuestoes: idsAtividade.length,
      criadoEm: proximo(),
      questoes: { create: idsAtividade.map((idQuestao, ordem) => ({ idQuestao, ordem })) },
    },
  });

  await sessao("C. Naturais", "Elementos, Cálculo e Animais", "Biologia, Química e Física com foco nos assuntos mais cobrados.");

  return { id: curso.id, idAulaJango: jango?.id ?? null };
}

async function criarOutrosCursos(idAdmin: string, idParceiro: string, idProfessor: string) {
  const matematica = await prisma.curso.create({
    data: {
      nome: "Matemática Básica",
      categoria: "EXATAS",
      descricao: "Fundamentos de matemática para o ensino médio, do básico às equações.",
      status: "ATIVO",
      vagas: 100,
      cor: "#425BC2",
      iconeCapa: "matematica",
      idResponsavel: idProfessor,
      idAdminAutorizador: idAdmin,
      autorizadoEm: new Date(),
    },
    select: { id: true },
  });

  const fundamentos = await prisma.sessao.create({
    data: { idCurso: matematica.id, titulo: "Fundamentos", descricao: "Introdução aos conceitos básicos", idResponsavel: idProfessor },
    select: { id: true },
  });
  const operacoes = await prisma.modulo.create({
    data: { idSessao: fundamentos.id, titulo: "Módulo 1: Operações Básicas", licaoTitulo: "Adição e Subtração", xp: 50, idResponsavel: idProfessor },
    select: { id: true },
  });
  const pdf = await enviarArquivoDemo("ditadura.pdf", "PDF", "MATERIAL_AULA", "application/pdf", idProfessor);

  if (pdf) {
    await prisma.aula.create({
      data: {
        idModulo: operacoes.id,
        titulo: "Apostila em PDF",
        descricao: "Resumo das operações básicas.",
        tipo: "PDF",
        idArquivo: pdf,
        quantidadePaginas: 12,
        idResponsavel: idProfessor,
      },
    });
  }

  const simples: Array<{
    nome: string;
    categoria: CategoriaCurso;
    descricao: string;
    vagas: number | null;
    cor: string;
    icone: string;
    status: "ATIVO" | "INATIVO" | "RASCUNHO";
    idResponsavel: string;
    imagem?: string;
  }> = [
    { nome: "Português Avançado", categoria: "LINGUAGENS", descricao: "Gramática, interpretação de texto e redação para o vestibular.", vagas: 60, cor: "#79B425", icone: "livro", status: "ATIVO", idResponsavel: idAdmin },
    { nome: "Biologia Celular", categoria: "CIENCIAS_NATURAIS", descricao: "Estrutura e funcionamento das células e suas organelas.", vagas: 80, cor: "#FFA62B", icone: "biologia", status: "ATIVO", idResponsavel: idAdmin },
    { nome: "História do Brasil", categoria: "CIENCIAS_HUMANAS", descricao: "Da colonização à república: os principais períodos da história.", vagas: 50, cor: "#1B5E20", icone: "historia", status: "INATIVO", idResponsavel: idAdmin },
    { nome: "Física Quântica", categoria: "CIENCIAS_NATURAIS", descricao: "Introdução aos conceitos da física quântica.", vagas: 40, cor: "#86C5FF", icone: "ciencias", status: "RASCUNHO", idResponsavel: idParceiro },
    { nome: "Introdução à Inteligência Artificial", categoria: "INTELIGENCIA_ARTIFICIAL", descricao: "Conceitos básicos de inteligência artificial de forma simples e direta.", vagas: 120, cor: "#425BC2", icone: "ciencias", status: "ATIVO", idResponsavel: idParceiro, imagem: "courses/ai_course_image.jpg" },
    { nome: "Finanças Pessoais para Iniciantes", categoria: "FINANCAS", descricao: "Organize seu orçamento, saia das dívidas e invista com segurança.", vagas: null, cor: "#79B425", icone: "geografia", status: "ATIVO", idResponsavel: idAdmin, imagem: "courses/finances_course_image.jpg" },
  ];

  for (const curso of simples) {
    const capa = curso.imagem
      ? await enviarArquivoDemo(curso.imagem, "IMAGEM", "CAPA_CURSO", "image/jpeg", curso.idResponsavel)
      : null;
    const ativo = curso.status === "ATIVO";

    await prisma.curso.create({
      data: {
        nome: curso.nome,
        categoria: curso.categoria,
        descricao: curso.descricao,
        vagas: curso.vagas,
        cor: curso.cor,
        status: curso.status,
        idCapa: capa,
        iconeCapa: capa ? null : curso.icone,
        idResponsavel: curso.idResponsavel,
        ...(ativo && { idAdminAutorizador: idAdmin, autorizadoEm: new Date() }),
      },
    });
  }

  return matematica.id;
}

async function criarItens() {
  const itens = [
    { nome: "Boost de XP", descricao: "Dobra o XP ganho por 24 horas.", preco: 200, icone: "bolt", cor: "#FFA62B", categoria: "Boosts", efeito: "BOOST_XP" as const, valorEfeito: 2, duracaoMinutos: 24 * 60 },
    { nome: "Escudo de Sequência", descricao: "Protege sua sequência por um dia.", preco: 150, icone: "shield", cor: "#425BC2", categoria: "Proteção", efeito: "ESCUDO_SEQUENCIA" as const, duracaoMinutos: 24 * 60 },
    { nome: "Dica Extra", descricao: "Elimina uma alternativa errada em qualquer questão.", preco: 80, icone: "lightbulb", cor: "#79B425", categoria: "Estudos", efeito: "DICA_EXTRA" as const },
    { nome: "Tempo Extra", descricao: "Adiciona 5 minutos no próximo simulado.", preco: 120, icone: "timer", cor: "#7DAB9E", categoria: "Estudos", efeito: "TEMPO_EXTRA" as const, valorEfeito: 5 },
    { nome: "Reviver Tentativa", descricao: "Refaz uma questão errada.", preco: 100, icone: "refresh", cor: "#E53935", categoria: "Estudos", efeito: "REVIVER_TENTATIVA" as const },
    { nome: "Avatar Especial", descricao: "Desbloqueie um avatar exclusivo.", preco: 500, icone: "face", cor: "#1B5E20", categoria: "Personalização", efeito: "COSMETICO" as const },
  ];

  const ids: Record<string, string> = {};

  for (const item of itens) {
    const criado = await prisma.item.create({ data: item, select: { id: true } });
    ids[item.nome] = criado.id;
  }

  return ids;
}

async function main() {
  const reset = process.argv.includes("--reset");
  const usuarios = await prisma.usuario.count();

  if (usuarios > 0 && !reset) {
    console.log("O banco já tem dados. Use \"pnpm seed -- --reset\" para apagar tudo e popular de novo.");
    return;
  }

  if (reset) {
    console.log("Apagando dados existentes...");
    await limparBanco();
  }

  const senhaHash = await bcrypt.hash(SENHA, 12);
  const basico = await criarPlanos();

  const admin = await criarUsuario("Daniel Lima", "admin@educano.local", "ADMIN", senhaHash, basico.id);
  const professor = await criarUsuario("Marcos Silva", "professor@educano.local", "PROFESSOR", senhaHash, basico.id);
  const parceiro = await criarUsuario("Editora Saber", "parceiro@educano.local", "PARCEIRO", senhaHash, basico.id);
  const aluno = await criarUsuario("Ana Souza", "aluno@educano.local", "ALUNO", senhaHash, basico.id, 1250, {
    moedas: 850,
    sequenciaDias: 7,
  });

  // Outros alunos para popular o ranking.
  const ranking: Array<[string, number]> = [
    ["Manuela Souza", 4820],
    ["Rafael Cristiano", 4510],
    ["Luana Castanho", 4290],
    ["Mateus Lima", 3760],
    ["Beatriz Ramos", 3410],
    ["João Pedro Alves", 3105],
    ["Sofia Marques", 2960],
  ];

  for (const [nome, xp] of ranking) {
    const email = `${nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, ".")}@educano.local`;
    await criarUsuario(nome, email, "ALUNO", senhaHash, basico.id, xp);
  }

  const questoes = await criarQuestoes(professor.id);
  const vestibular = await criarCursoVestibular(admin.id, questoes);
  const matematica = await criarOutrosCursos(admin.id, parceiro.id, professor.id);
  const itens = await criarItens();

  // Situação inicial do aluno de teste.
  await prisma.inscricao.createMany({
    data: [
      { idUsuario: aluno.id, idCurso: vestibular.id, turma: "NOITE" },
      { idUsuario: aluno.id, idCurso: matematica, turma: "EAD" },
    ],
  });

  if (vestibular.idAulaJango) {
    await prisma.progressoAula.create({ data: { idUsuario: aluno.id, idAula: vestibular.idAulaJango } });
  }

  await prisma.inventarioItem.createMany({
    data: [
      { idUsuario: aluno.id, idItem: itens["Dica Extra"], quantidade: 3 },
      { idUsuario: aluno.id, idItem: itens["Escudo de Sequência"], quantidade: 1 },
    ],
  });

  const flashcards: Array<[string, string, string]> = [
    ["Brasil - Geografia", "Qual é a capital do Brasil?", "Brasília."],
    ["Multiplicação - Matemática", "Quanto é 8 vezes 7?", "56."],
    ["Lua - História", "Em que ano o homem pisou na Lua pela primeira vez?", "1969."],
    ["T. Periódica - Química", "Qual é o símbolo químico da água?", "H2O."],
    ["Literatura - Linguagens", "Quem escreveu o livro \"Dom Casmurro\"?", "Machado de Assis."],
  ];

  await prisma.flashcard.createMany({
    data: flashcards.map(([titulo, pergunta, resposta]) => ({
      idUsuario: aluno.id,
      titulo,
      pergunta,
      resposta,
      repeticoesMensais: 4,
    })),
  });

  console.log("Seed concluído.");
  console.log("Contas: admin@, professor@, parceiro@ e aluno@educano.local (senha em SEED_PASSWORD ou padrão do arquivo).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    r2Client.destroy();
    await prisma.$disconnect();
  });

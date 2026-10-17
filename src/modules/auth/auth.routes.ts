
import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  createHmac,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { prisma } from "../../config/prisma.js";

const authRouter = Router();

const registerSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  senha: z.string().min(8).max(72),
});

const verifyCodeSchema = z.object({
  email: z.string().trim().email().max(255),
  codigo: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/),
});

// As cores devem seguir a identidade visual do Educano.
const CORES_PERFIL = [
  "#425BC2",
  "#86C5FF",
  "#FFA62B",
  "#7DAB9E",
  "#9FBEED",
  "#79B425",
];

function gerarCodigo(): string {
  const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  return Array.from(
    { length: 6 },
    () => caracteres[randomInt(0, caracteres.length)],
  ).join("");
}

function hashCodigo(codigo: string): string {
  const segredo = process.env.VALIDATION_CODE_SECRET;

  if (!segredo) {
    throw new Error(
      "A variável VALIDATION_CODE_SECRET não foi configurada.",
    );
  }

  return createHmac("sha256", segredo)
    .update(codigo)
    .digest("hex");
}

function compararHashes(hashSalvo: string, hashRecebido: string): boolean {
  const salvo = Buffer.from(hashSalvo, "hex");
  const recebido = Buffer.from(hashRecebido, "hex");

  // timingSafeEqual exige buffers de mesmo tamanho.
  return salvo.length === recebido.length &&
    timingSafeEqual(salvo, recebido);
}

function obterCodigoParaDesenvolvimento(codigo: string) {
  // Nunca retornar o código bruto em produção.
  return process.env.NODE_ENV !== "production"
    ? { codigoDesenvolvimento: codigo }
    : {};
}

// POST /api/auth/register
authRouter.post("/register", async (req, res) => {
  const validacao = registerSchema.safeParse(req.body);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Os dados do cadastro são inválidos.",
      errors: validacao.error.issues,
    });
  }

  const nome = validacao.data.nome;
  const email = validacao.data.email.toLowerCase();
  const senha = validacao.data.senha;

  try {
    const existente = await prisma.usuario.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existente) {
      return res.status(409).json({
        message: "Já existe uma conta cadastrada com esse e-mail.",
      });
    }

    const senhaHash = await bcrypt.hash(senha, 12);
    const codigo = gerarCodigo();
    const codigoHash = hashCodigo(codigo);
    const cor = CORES_PERFIL[randomInt(0, CORES_PERFIL.length)];

    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senha: senhaHash,
        tipo: "ALUNO",
        status: "PENDENTE",

        perfil: {
          create: {
            tipoPerfil: "PRIVADO",
            xp: 0,
            moedas: 0,
            nivel: 0,
            cor,
            urlFotoPerfil: "",
            urlFotoBackground: "",
          },
        },

        codigosValidacao: {
          create: {
            codigo: codigoHash,
            // dataCriacao e expiraEm usam os defaults do banco.
            status: "ATIVO",
          },
        },
      },

      // Não devolver senha, hash ou dados internos.
      select: {
        id: true,
        nome: true,
        email: true,
        tipo: true,
        status: true,
      },
    });

    return res.status(201).json({
      message: "Cadastro criado. Confirme o código para ativar a conta.",
      usuario,
      ...obterCodigoParaDesenvolvimento(codigo),
    });
  } catch (error) {
    // Protege contra dois cadastros simultâneos com o mesmo e-mail.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        message: "Já existe uma conta cadastrada com esse e-mail.",
      });
    }

    console.error("Erro ao cadastrar usuário:", error);

    return res.status(500).json({
      message: "Não foi possível concluir o cadastro.",
    });
  }
});

// POST /api/auth/verify-code
authRouter.post("/verify-code", async (req, res) => {
  const validacao = verifyCodeSchema.safeParse(req.body);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Informe um e-mail válido e um código de seis caracteres.",
      errors: validacao.error.issues,
    });
  }

  const email = validacao.data.email.toLowerCase();
  const codigoRecebido = validacao.data.codigo;

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      select: { id: true, status: true },
    });

    if (!usuario || usuario.status !== "PENDENTE") {
      return res.status(400).json({
        message: "Não foi possível validar essa conta com os dados informados.",
      });
    }

    const codigoSalvo = await prisma.codigoValidacao.findFirst({
      where: {
        idUsuario: usuario.id,
        status: "ATIVO",
      },
      orderBy: { dataCriacao: "desc" },
    });

    if (!codigoSalvo) {
      return res.status(400).json({
        message: "Não há um código ativo. Solicite um novo código.",
      });
    }

    // Usa o relógio do PostgreSQL para evitar depender do fuso
    // horário ou do relógio local da máquina que executa a API.
    const [relogio] = await prisma.$queryRaw<Array<{ agora: Date }>>`
      SELECT CURRENT_TIMESTAMP AS agora
    `;

    if (codigoSalvo.expiraEm <= relogio.agora) {
      await prisma.codigoValidacao.updateMany({
        where: {
          id: codigoSalvo.id,
          status: "ATIVO",
        },
        data: { status: "INATIVO" },
      });

      return res.status(400).json({
        message: "O código expirou. Solicite um novo código.",
      });
    }

    const hashRecebido = hashCodigo(codigoRecebido);

    if (!compararHashes(codigoSalvo.codigo, hashRecebido)) {
      return res.status(400).json({
        message: "Código de validação incorreto.",
      });
    }

    // Confere novamente o vencimento e o status dentro da transação.
    // Assim, duas requisições concorrentes não devem validar o mesmo código.
    await prisma.$transaction(async (tx) => {
      const [relogioTransacao] = await tx.$queryRaw<
        Array<{ agora: Date }>
      >`
        SELECT CURRENT_TIMESTAMP AS agora
      `;

      const resultado = await tx.codigoValidacao.updateMany({
        where: {
          id: codigoSalvo.id,
          status: "ATIVO",
          expiraEm: { gt: relogioTransacao.agora },
        },
        data: { status: "USADO" },
      });

      if (resultado.count !== 1) {
        throw new Error("CODIGO_EXPIRADO_OU_JA_UTILIZADO");
      }

      await tx.usuario.update({
        where: { id: usuario.id },
        data: {
          status: "ATIVO",
          atualizadoEm: relogioTransacao.agora,
        },
      });
    });

    return res.status(200).json({
      message: "Conta validada e ativada com sucesso.",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "CODIGO_EXPIRADO_OU_JA_UTILIZADO"
    ) {
      return res.status(400).json({
        message: "O código expirou ou já foi utilizado. Solicite outro.",
      });
    }

    console.error("Erro ao validar código:", error);

    return res.status(500).json({
      message: "Não foi possível validar a conta.",
    });
  }
});

export default authRouter;

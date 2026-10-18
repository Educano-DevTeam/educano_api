import jwt from "jsonwebtoken";

const TEMPO_EXPIRACAO_SEGUNDOS = 15 * 60;

function obterSegredo(): string {
  const segredo = process.env.JWT_SECRET;

  if (!segredo || segredo.length < 32) {
    throw new Error(
      "JWT_SECRET não configurado ou muito curto. " +
      "Configure um segredo aleatório com pelo menos 32 caracteres.",
    );
  }

  return segredo;
}

/**
 * Emite um token JWT para o usuário autenticado.
 *
 * O ID é armazenado no campo padrão "sub" (subject).
 * Não incluímos senha, e-mail ou outros dados pessoais.
 */
export function emitirToken(idUsuario: string): string {
  return jwt.sign({}, obterSegredo(), {
    subject: idUsuario,
    expiresIn: TEMPO_EXPIRACAO_SEGUNDOS,
    issuer: "educano-api",
    audience: "educano-app",
  });
}

/**
 * Verifica a assinatura, a validade e o destinatário do token.
 * Retorna o ID do usuário ou lança um erro se o token for inválido.
 */
export function verificarToken(token: string): string {
  const payload = jwt.verify(token, obterSegredo(), {
    issuer: "educano_api",
    audience: "educano_app",
  });

  if (typeof payload === "string" || !payload.sub) {
    throw new Error("Token sem identificador de usuário.");
  }

  return payload.sub;
}
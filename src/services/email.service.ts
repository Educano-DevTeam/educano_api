
import nodemailer from "nodemailer";
import path from "node:path";
import { google } from "googleapis";

// Caminho da logo do Educano.
const caminhoLogo = path.resolve(
  process.cwd(),
  "assets",
  "Educano_Logo.jpeg",
);

// Nodemailer será utilizado somente para montar a mensagem MIME.
// O envio será realizado pela Gmail API via HTTPS.
const transporter = nodemailer.createTransport({
  streamTransport: true,
  buffer: true,
  newline: "unix",
});

interface EnviarEmailProps {
  destinatario: string;
  assunto: string;
  html: string;
}

export async function enviarEmail({
  destinatario,
  assunto,
  html,
}: EnviarEmailProps): Promise<void> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const contaGoogle = process.env.GOOGLE_EMAIL;

  const remetente = process.env.EMAIL_FROM_ADDRESS;
  const nomeRemetente = process.env.EMAIL_FROM_NAME ?? "Educano";

  if (
    !clientId ||
    !clientSecret ||
    !refreshToken ||
    !redirectUri ||
    !contaGoogle ||
    !remetente
  ) {
    throw new Error(
      "As configurações da Gmail API estão incompletas.",
    );
  }

  // Configuração OAuth 2.0.
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri,
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  // Monta o e-mail com HTML e logo incorporada.
  const mensagem = await transporter.sendMail({
    from: `"${nomeRemetente}" <${remetente}>`,
    to: destinatario,
    subject: assunto,
    html,
    attachments: [
      {
        filename: "educano-logo.png",
        path: caminhoLogo,
        cid: "logo-educano",
      },
    ],
  });

  // Converte a mensagem MIME para Base64 URL-safe.
  let conteudo: Buffer;

  if (Buffer.isBuffer(mensagem.message)) {
    conteudo = mensagem.message;
  } else {
    const partes: Buffer[] = [];

    for await (const parte of mensagem.message) {
      partes.push(Buffer.isBuffer(parte) ? parte : Buffer.from(parte));
    }

    conteudo = Buffer.concat(partes);
  }

  const mensagemCodificada = conteudo.toString("base64url");

  // Conecta à Gmail API.
  const gmail = google.gmail({
    version: "v1",
    auth: oauth2Client,
  });

  // Envia a mensagem pela API oficial do Gmail.
  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: mensagemCodificada,
    },
  });
}

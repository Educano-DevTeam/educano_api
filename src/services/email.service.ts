
import nodemailer from "nodemailer";
import path from "node:path";

// O projeto é executado a partir da raiz da API.
const caminhoLogo = path.resolve(
  process.cwd(),
  "assets",
  "Educano_Logo.jpeg",
);

// Configuração SMTP do Gmail usando uma senha de aplicativo.
const porta = Number(process.env.SMTP_PORT ?? 465);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "smtp.gmail.com",
  port: porta,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_APP_PASSWORD,
  },
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
  const remetente = process.env.EMAIL_FROM_ADDRESS;
  const nomeRemetente = process.env.EMAIL_FROM_NAME ?? "Educano";

  if (
    !process.env.SMTP_USER ||
    !process.env.SMTP_APP_PASSWORD ||
    !remetente
  ) {
    throw new Error("As configurações SMTP do e-mail estão incompletas.");
  }

  await transporter.sendMail({
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
}

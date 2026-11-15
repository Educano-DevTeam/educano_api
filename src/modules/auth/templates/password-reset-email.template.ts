
function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function gerarEmailRecuperacaoSenha(
  nome: string,
  codigo: string,
): string {
  const nomeSeguro = escaparHtml(nome);
  const codigoSeguro = escaparHtml(codigo);

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Recuperação de senha - Educano</title>
      </head>

      <body style="
        margin: 0;
        padding: 0;
        background-color: #f3f6fc;
        font-family: Arial, Helvetica, sans-serif;
        color: #24304a;
      ">
        <div style="
          max-width: 560px;
          margin: 32px auto;
          padding: 0 16px;
        ">
          <div style="
            background-color: #ffffff;
            border-radius: 18px;
            overflow: hidden;
            border: 1px solid #e4eaf5;
          ">
            <div style="
              background-color: #425bc2;
              text-align: center;
              padding: 28px 20px;
            ">
              <img
                src="cid:logo-educano"
                alt="Educano"
                width="150"
                style="display: inline-block; max-width: 100%; height: auto;"
              />
            </div>

            <div style="padding: 32px 28px;">
              <h1 style="
                margin: 0 0 18px;
                font-size: 24px;
                color: #24304a;
              ">
                Vamos redefinir sua senha?
              </h1>

              <p style="font-size: 15px; line-height: 1.7;">
                Olá, <strong>${nomeSeguro}</strong>!
              </p>

              <p style="font-size: 15px; line-height: 1.7;">
                Recebemos uma solicitação para redefinir a senha
                da sua conta Educano. Utilize o código abaixo
                para continuar:
              </p>

              <div style="
                margin: 28px 0;
                padding: 22px 12px;
                background-color: #f0f4ff;
                border: 1px solid #dbe5ff;
                border-radius: 12px;
                text-align: center;
              ">
                <p style="
                  margin: 0 0 10px;
                  font-size: 12px;
                  letter-spacing: 1px;
                  color: #5b6680;
                  text-transform: uppercase;
                ">
                  Código de recuperação
                </p>

                <p style="
                  margin: 0;
                  font-size: 30px;
                  font-weight: bold;
                  letter-spacing: 7px;
                  color: #425bc2;
                ">
                  ${codigoSeguro}
                </p>
              </div>

              <p style="font-size: 14px; line-height: 1.7;">
                O código expira em <strong>10 minutos</strong>
                e poderá ser utilizado apenas uma vez.
              </p>

              <p style="font-size: 14px; line-height: 1.7;">
                Se você não solicitou a recuperação de senha,
                ignore esta mensagem. Sua senha atual continuará
                a mesma.
              </p>

              <p style="margin-top: 28px; font-size: 14px;">
                Até logo,<br />
                <strong>Equipe Educano</strong>
              </p>
            </div>
          </div>

          <p style="
            margin: 18px 8px;
            text-align: center;
            font-size: 12px;
            color: #737f96;
          ">
            Esta é uma mensagem automática. Por favor, não responda
            diretamente a este e-mail.
          </p>
        </div>
      </body>
    </html>
  `;
}

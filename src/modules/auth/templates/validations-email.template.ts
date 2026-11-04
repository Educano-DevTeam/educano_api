
function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface ConteudoEmailCodigo {
  tituloPagina: string;
  titulo: string;
  paragrafo: string;
  rotuloCodigo: string;
  aviso: string;
}

export function gerarEmailValidacao(
  nome: string,
  codigo: string,
): string {
  return montarEmailCodigo(nome, codigo, {
    tituloPagina: "Confirme sua conta - Educano",
    titulo: "Vamos confirmar sua conta?",
    paragrafo:
      "Falta apenas mais uma etapa para começar sua jornada " +
      "de aprendizagem com o Educano. Utilize o código abaixo " +
      "para confirmar seu endereço de e-mail.",
    rotuloCodigo: "Seu código de confirmação",
    aviso: "Se você não solicitou este cadastro, ignore esta mensagem.",
  });
}

export function gerarEmailRedefinicaoSenha(
  nome: string,
  codigo: string,
): string {
  return montarEmailCodigo(nome, codigo, {
    tituloPagina: "Redefinição de senha - Educano",
    titulo: "Vamos redefinir sua senha?",
    paragrafo:
      "Recebemos um pedido para redefinir a senha da sua conta. " +
      "Utilize o código abaixo no aplicativo para cadastrar uma nova senha.",
    rotuloCodigo: "Seu código de redefinição",
    aviso:
      "Se você não pediu a redefinição, ignore esta mensagem. " +
      "Sua senha atual continua válida.",
  });
}

function montarEmailCodigo(
  nome: string,
  codigo: string,
  conteudo: ConteudoEmailCodigo,
): string {
  const nomeSeguro = escaparHtml(nome);
  const codigoSeguro = escaparHtml(codigo);

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${conteudo.tituloPagina}</title>
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
                line-height: 1.3;
                color: #24304a;
              ">
                ${conteudo.titulo}
              </h1>

              <p style="font-size: 15px; line-height: 1.7;">
                Olá, <strong>${nomeSeguro}</strong>!
              </p>

              <p style="font-size: 15px; line-height: 1.7;">
                ${conteudo.paragrafo}
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
                  ${conteudo.rotuloCodigo}
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
                O código expira em <strong>10 minutos</strong>.
                ${conteudo.aviso}
              </p>

              <p style="
                margin-top: 28px;
                font-size: 14px;
                line-height: 1.7;
              ">
                Até logo,<br />
                <strong>Equipe Educano</strong>
              </p>
            </div>
          </div>

          <p style="
            margin: 18px 8px;
            text-align: center;
            font-size: 12px;
            line-height: 1.6;
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

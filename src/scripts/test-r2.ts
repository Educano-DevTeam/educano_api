
import "dotenv/config";

import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { R2_BUCKET, r2Client } from "../config/storage.js";

async function testarConexaoR2() {
  try {
    console.log("Verificando conexão com Cloudflare R2...");

    await r2Client.send(
      new HeadBucketCommand({
        Bucket: R2_BUCKET,
      }),
    );

    console.log("Conexão com Cloudflare R2 estabelecida!");
    console.log(`Bucket: ${R2_BUCKET}`);
  } catch (error) {
    console.error("Não foi possível conectar ao Cloudflare R2.");
    console.error(error);
    process.exitCode = 1;
  } finally {
    r2Client.destroy();
  }
}

testarConexaoR2();

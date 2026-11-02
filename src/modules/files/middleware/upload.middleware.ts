
import multer from "multer";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

const diretorioTemporario = path.resolve(
  process.cwd(),
  "tmp",
  "uploads",
);

// Garante que o diretório temporário exista.
mkdirSync(diretorioTemporario, { recursive: true });

// Associa cada extensão aos MIME types aceitos.
const formatosPermitidos: Record<string, string[]> = {
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],

  ".mp3": ["audio/mpeg"],
  ".wav": ["audio/wav", "audio/x-wav"],
  ".ogg": ["audio/ogg"],
  ".m4a": ["audio/mp4", "audio/x-m4a"],
  ".aac": ["audio/aac"],

  ".mp4": ["video/mp4", "audio/mp4"],
  ".webm": ["video/webm"],
  ".mov": ["video/quicktime"],

  ".pdf": ["application/pdf"],

  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  ".pptx": [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
};

const armazenamento = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, diretorioTemporario);
  },

  filename: (_req, file, callback) => {
    const extensao = path.extname(file.originalname).toLowerCase();

    callback(null, `${randomUUID()}${extensao}`);
  },
});

function validarFormato(
  _req: Express.Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback,
) {
  const extensao = path.extname(file.originalname).toLowerCase();

  const mimesAceitos = formatosPermitidos[extensao];

  if (!mimesAceitos || !mimesAceitos.includes(file.mimetype)) {
    return callback(
      new Error("Formato de arquivo não permitido."),
    );
  }

  callback(null, true);
}

export const uploadArquivo = multer({
  storage: armazenamento,

  fileFilter: validarFormato,

  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
    files: 1,
    fields: 10,
    parts: 12,
  },
});

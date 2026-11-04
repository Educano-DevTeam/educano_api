import type { TipoUsuario } from "../generated/prisma/client.js";

export interface UsuarioAutenticado {
  id: string;
  tipo: TipoUsuario;
}

// Tipos que produzem conteúdo (cursos, materiais e questões).
const TIPOS_EQUIPE: TipoUsuario[] = ["ADMIN", "PARCEIRO", "PROFESSOR"];

export function ehEquipe(usuario: UsuarioAutenticado): boolean {
  return TIPOS_EQUIPE.includes(usuario.tipo);
}

export function ehAdmin(usuario: UsuarioAutenticado): boolean {
  return usuario.tipo === "ADMIN";
}

/** URL base pública da API, usada para montar links de arquivos. */
export function urlBaseApi(protocolo: string, host?: string): string {
  const configurada = process.env.PUBLIC_API_URL?.replace(/\/+$/, "");
  return configurada || `${protocolo}://${host ?? "localhost:3000"}`;
}

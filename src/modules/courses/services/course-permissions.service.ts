
import { prisma } from "../../../config/prisma.js";

export async function consultarAcessoCurso(
    idCurso: string,
    idUsuario: string,
    tipoUsuario: string,
) {
    const curso = await prisma.curso.findUnique({
        where: { id: idCurso },
        select: {
            id: true,
            status: true,
            idResponsavel: true,

            professores: {
                where: {
                    idProfessor: idUsuario,
                },
                select: {
                    id: true,
                },
            },

            inscricoes: {
                where: {
                    idUsuario,
                },
                select: {
                    id: true,
                },
            },
        },
    });

    if (!curso) {
        return {
            curso: null,
            existe: false,
            ehAdmin: tipoUsuario === "ADMIN",
            ehResponsavel: false,
            ehProfessorVinculado: false,
            estaInscrito: false,
            podeGerenciar: false,
            podeLer: false,
        };
    }

    const ehAdmin = tipoUsuario === "ADMIN";

    const ehResponsavel =
        curso.idResponsavel === idUsuario;

    const ehProfessorVinculado =
        tipoUsuario === "PROFESSOR" &&
        curso.professores.length > 0;

    const estaInscrito =
        curso.inscricoes.length > 0;

    const podeGerenciar =
        ehAdmin ||
        ehResponsavel ||
        ehProfessorVinculado;

    const cursoAtivo = curso.status === "ATIVO";

    const podeLer =
        podeGerenciar ||
        (cursoAtivo && estaInscrito);

    return {
        curso,
        existe: true,
        ehAdmin,
        ehResponsavel,
        ehProfessorVinculado,
        estaInscrito,
        podeGerenciar,
        podeLer,
    };
}

import type {
    criarQuestaoSchema,
    atualizarQuestaoSchema,
} from "../schemas/questions.schema.js";

export type CriarQuestaoInput =
    typeof criarQuestaoSchema extends {
        _output: infer T;
    } ? T : never;

export type AtualizarQuestaoInput =
    typeof atualizarQuestaoSchema extends {
        _output: infer T;
    } ? T : never;
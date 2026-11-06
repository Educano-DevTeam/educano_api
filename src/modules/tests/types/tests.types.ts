import type {
    criarAtividadeSchema,
    criarSimuladoSchema,
    atualizarTesteSchema,
    listarTestesQuerySchema,
} from "../schemas/tests.schema.js";

export type CriarAtividadeInput =
    typeof criarAtividadeSchema extends {
        _output: infer T;
    } ? T : never;

export type CriarSimuladoInput =
    typeof criarSimuladoSchema extends {
        _output: infer T;
    } ? T : never;

export type AtualizarTesteInput =
    typeof atualizarTesteSchema extends {
        _output: infer T;
    } ? T : never;

export type ListarTestesInput =
    typeof listarTestesQuerySchema extends {
        _output: infer T;
    } ? T : never;
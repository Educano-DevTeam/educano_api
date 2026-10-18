import { z } from "zod";

export const rankingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

export type RankingQuery = z.infer<typeof rankingQuerySchema>;
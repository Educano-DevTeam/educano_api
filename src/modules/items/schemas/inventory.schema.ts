import { z } from "zod";

export const idInventarioParamsSchema = z.object({
  idInventario: z.string().uuid(),
});
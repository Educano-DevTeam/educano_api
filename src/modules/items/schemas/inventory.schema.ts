import { z } from "zod";

export const idInventarioParamsSchema = z.object({
  id: z.string().uuid(),
});
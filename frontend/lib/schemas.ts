import { z } from 'zod/v4';

export const SummarySchema = z.object({
  title: z.string(),
  mainClaims: z.array(
    z.object({
      claim: z.string(),
      evidence: z.string(),
    })
  ),
  summary: z.string(),
});

export type Summary = z.infer<typeof SummarySchema>;

import { z } from 'zod';

/**
 * Response contract for `GET /health`.
 *
 * The API and the web client both validate against this schema, so a change here is a
 * compile-time and runtime break on both sides rather than a silent divergence.
 */
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

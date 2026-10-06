import { z } from 'zod';

/**
 * Shape every AI-callable tool definition must satisfy.
 *
 * A tool declares the resource and action it touches so that the tool layer can run an
 * authorisation check before the tool body executes. See
 * `docs/adr/ADR-005-ai-tool-architecture.md`.
 *
 * `mutating` tools may only produce proposals; they never commit authoritative state
 * directly. The enforcement mechanism is defined during AI platform implementation.
 */
export const AiToolDescriptorSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, 'expected dotted lowercase tool name'),
  description: z.string().min(1),
  resourceType: z.string().min(1),
  action: z.enum(['READ', 'CREATE', 'UPDATE', 'DELETE', 'EXECUTE']),
  mutating: z.boolean(),
});

export type AiToolDescriptor = z.infer<typeof AiToolDescriptorSchema>;

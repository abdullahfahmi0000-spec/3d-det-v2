import type { AiToolDescriptor } from '@3ddet/contracts';

/**
 * Registry of AI-callable tools.
 *
 * Every tool declares the resource and action it touches, and the tool layer runs an
 * authorisation check before the handler executes. An agent is a subject in the permission
 * model in its own right, and an agent's effective permissions are intersected with those
 * of the invoking user, so delegating to an agent can never widen what that user could do.
 *
 * Tools marked `mutating` may only produce proposals. The mechanism that makes that
 * structural rather than procedural is defined during AI platform implementation; see
 * `docs/adr/ADR-005-ai-tool-architecture.md`.
 */
export interface ToolRegistration<TInput = unknown, TOutput = unknown> {
  readonly descriptor: AiToolDescriptor;
  readonly handler: (input: TInput) => Promise<TOutput>;
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolRegistration>();

  register(registration: ToolRegistration): void {
    const { name } = registration.descriptor;
    if (this.tools.has(name)) {
      throw new Error(`tool already registered: ${name}`);
    }
    this.tools.set(name, registration);
  }

  get(name: string): ToolRegistration | undefined {
    return this.tools.get(name);
  }

  descriptors(): readonly AiToolDescriptor[] {
    return [...this.tools.values()].map((tool) => tool.descriptor);
  }

  /** Tool names that may change authoritative state, and therefore require a proposal. */
  mutatingToolNames(): readonly string[] {
    return this.descriptors()
      .filter((descriptor) => descriptor.mutating)
      .map((descriptor) => descriptor.name);
  }
}

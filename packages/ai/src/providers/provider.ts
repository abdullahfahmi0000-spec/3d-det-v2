/**
 * Provider abstraction.
 *
 * No vendor SDK type may cross this interface and no model name may appear in business
 * code. Model selection is data, resolved by the routing policy, so a tenant bringing its
 * own model contract is a catalogue entry rather than a code change
 * (`docs/adr/ADR-005-ai-tool-architecture.md`).
 */
export interface CompletionRequest {
  /** Catalogue identifier of the model to use, chosen by the routing policy. */
  readonly modelId: string;
  readonly system?: string;
  readonly messages: readonly { role: 'user' | 'assistant'; content: string }[];
  readonly maxOutputTokens?: number;
}

export interface CompletionUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface CompletionResponse {
  readonly content: string;
  readonly usage: CompletionUsage;
  /** The concrete model version that served the request, recorded for audit. */
  readonly modelVersion: string;
}

export interface LlmProvider {
  readonly id: string;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}

/** Registry of available providers. Implementations are added per provider adapter. */
export class ProviderRegistry {
  private readonly providers = new Map<string, LlmProvider>();

  register(provider: LlmProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`provider already registered: ${provider.id}`);
    }
    this.providers.set(provider.id, provider);
  }

  get(id: string): LlmProvider | undefined {
    return this.providers.get(id);
  }

  ids(): readonly string[] {
    return [...this.providers.keys()];
  }
}

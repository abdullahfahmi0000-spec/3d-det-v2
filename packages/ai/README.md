# @3ddet/ai

AI platform capabilities. Framework-neutral by design.

No agent framework is installed. Orchestration is an explicit state machine plus a provider
adapter, which keeps every step inspectable and auditable
(`docs/adr/ADR-005-ai-tool-architecture.md`). Introducing LangGraph, Mastra, an agents SDK
or any equivalent is a decision that requires its own ADR and approval.

| Path           | Purpose                                                                 |
| -------------- | ----------------------------------------------------------------------- |
| `providers/`   | Provider abstraction. No vendor SDK type crosses this boundary.         |
| `routing/`     | Task requirements, catalogue entries and the recorded routing decision. |
| `sensitivity/` | Data classification, and the post-retrieval effective class.            |
| `tools/`       | Tool registry. Every tool declares its resource and action.             |
| `mcp/`         | MCP transport over the same registry.                                   |
| `prompts/`     | Version-controlled prompt templates.                                    |
| `provenance/`  | What went into an output, including whether any source was untrusted.   |
| `proposals/`   | Proposed changes awaiting human promotion.                              |
| `evaluation/`  | Golden-set evaluation of AI behaviour.                                  |

## Two invariants

**AI never writes authoritative state.** It produces proposals carrying provenance; a human
promotes them.

**Sensitivity is computed after retrieval.** The effective class is the highest across the
task and everything retrieved. Routing on the task's class alone would let a Public task
send Confidential material to an external provider.

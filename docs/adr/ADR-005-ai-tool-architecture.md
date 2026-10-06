# ADR-005: AI tool architecture

**Status:** Accepted as a direction. Implementation details are open.

## Context

AI agents assist with analysing and proposing changes to an organisation's structure and
processes. That data is tenant-confidential, and some of it is sensitive.

## Decision

- **AI is a platform capability**, implemented in `packages/ai` and used by the API and worker.
  It is not a separate service.
- **AI agents do not directly access PostgreSQL.** They have no database handle.
- **AI accesses controlled tools.** Each tool declares the resource and action it touches.
- **Every tool performs authorisation** before it executes. An agent is a subject in the
  permission model in its own right, and an agent acting for a user can never do more than
  that user could.
- **Human approval remains required for actions that change authoritative state**, where
  product governance requires it. Agents produce proposals; people promote them.
- **A provider abstraction exists.** No vendor SDK type crosses it and no model name appears in
  business code; model selection is configuration.
- **MCP can expose appropriate tools**, over the same registry that internal callers use, so
  authorisation cannot differ between the two paths.
- **No specific agent framework is mandated at repository bootstrap.** Orchestration starts as
  explicit code. Adopting a framework requires its own ADR.

## Consequences

- Grounding context is assembled through domain services inside a tenant transaction, so
  Row-Level Security and authorisation apply to what an agent reads.
- The sensitivity of a request is computed after retrieval, as the highest classification
  across the task and everything retrieved, and routing uses that value.
- Proposals carry provenance: what sources were used, and whether any source was untrusted
  free text.

## To be finalised during AI platform implementation

- Provider adapters and the routing policy.
- The mechanism that makes "mutating tools only create proposals" structural.
- Authentication for external MCP clients.
- Evaluation and regression testing of AI behaviour.

# Prompts

Prompt templates live here as version-controlled assets so that a change to a prompt is
reviewable and so that `promptHash` in the provenance record refers to something traceable.

Grounding context is assembled by calling domain services inside a tenant transaction, never
by querying the database directly. An agent that builds its own context from the database
has bypassed both Row-Level Security and the permission model while appearing to work.

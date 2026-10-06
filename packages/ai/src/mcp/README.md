# MCP transport

The tool registry in `../tools` is transport-independent. Internal callers invoke tools in
process; an MCP server exposes the same registry to external MCP clients.

One registry, two transports, so the authorisation check cannot be present on one path and
absent on the other.

External MCP access is an externally reachable surface capable of creating proposals. Its
authentication model -- per-user consent, short-lived scoped tokens bound to both the human
and the agent profile, revocable per client -- is to be finalised during AI platform
implementation and is not configured at bootstrap.

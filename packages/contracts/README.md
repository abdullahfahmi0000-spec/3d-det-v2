# @3ddet/contracts

Shared schemas for anything that crosses a boundary: HTTP request and response bodies,
tenant context, and AI tool descriptors.

Zod is used so that one declaration produces both the runtime validator and the static
type. The API validates inbound and outbound payloads against these schemas and the web
client parses responses with them, so a contract change breaks both sides at compile time
instead of diverging silently.

This package has no dependency on any framework and must stay that way.

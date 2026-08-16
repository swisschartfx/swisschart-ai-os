# Legacy Journal Agent compatibility

This directory is retained only for the explicitly guarded manual/external legacy signal tool and its isolated compatibility tests. It is not an active business-authority boundary.

Current Trading/Signal data access is owned by provider-neutral capabilities under `02_Core/Capabilities/`, with Notion details behind `02_Core/Services/notionService.js`. Normal Assistant, MCP, and cloud runtime paths must not import this legacy Agent.

Historical design material is preserved under `08_Documents/archive/legacy-journal-agent/`.

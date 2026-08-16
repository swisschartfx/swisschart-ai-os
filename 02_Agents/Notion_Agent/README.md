# Legacy Notion Agent compatibility

This directory is retained for isolated compatibility tests and manual read diagnostics only. It is not composed into the Central Assistant or cloud runtime.

Active Trading/Signal reads use the provider-neutral Trading Data capability. Active mutations use governed capabilities through the Capability Gateway. Normal runtime paths must not depend on this Agent or its provider-specific record shape.

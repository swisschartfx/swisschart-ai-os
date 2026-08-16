# Founder OAuth Operations

## Credential rotation

1. Generate a new strong Founder password using a cryptographically secure generator.
2. Replace `SWISSCHART_OAUTH_FOUNDER_PASSWORD` in the Railway service variables without printing or recording its value.
3. Redeploy the existing service and verify `GET /health`.
4. In Claude connector settings, disconnect and reconnect Swisschart.
5. Authorize using the new Founder password and run one read-only query.
6. Confirm an authenticated, completed MCP execution in Railway logs without inspecting or logging credentials.

Changing the Founder password does not automatically revoke an access token already issued. To revoke all OAuth sessions immediately, rotate the password and remove the persisted OAuth state file from the Railway volume during an authorized maintenance window, then redeploy and reconnect Claude.

## Claude connector reauthorization

1. Open Claude connector settings.
2. Disconnect the Swisschart connector.
3. Connect the same Railway `/mcp` endpoint again.
4. Complete the Swisschart Founder authorization page.
5. Verify that Claude exposes exactly one tool, `swisschart.query`.
6. Run a read-only query and confirm the corresponding completed Railway log entry.

Never place Founder credentials, OAuth codes or access tokens in source code, Project Brain, chat messages or logs.

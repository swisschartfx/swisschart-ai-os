const assert = require("assert");
const crypto = require("crypto");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const OAuthBridge = require("./oauthBridge");
const { TOKEN_TTL_MS, REFRESH_TOKEN_TTL_MS } = require("./oauthBridge");
const { McpEdge } = require("./mcpEdge");
const { createHttpServer } = require("./httpServer");
const ProductionRuntime = require("./productionRuntime");
const OAuthStateStore = require("./oauthStateStore");

const ISSUER = "https://swisschart.example";
const PASSWORD = "founder-oauth-test-password";
const REDIRECT_URI = "https://claude.ai/api/mcp/auth_callback";

async function run() {
    let now = Date.parse("2026-08-14T12:00:00.000Z");
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "swisschart-oauth-"));
    const stateFile = path.join(temporaryDirectory, "state.json");
    const stateStore = new OAuthStateStore({ filePath: stateFile });
    const legacyStateFile = path.join(temporaryDirectory, "legacy-state.json");
    fs.writeFileSync(legacyStateFile, JSON.stringify({ version: 1, clients: [[
        "legacy-client", { redirectUris: [REDIRECT_URI], expiresAt: now + 60000 }
    ]], transactions: [], codes: [], accessTokens: [] }));
    const legacyBridge = new OAuthBridge({ issuer: ISSUER,
        founderPassword: PASSWORD, clock: () => now,
        stateStore: new OAuthStateStore({ filePath: legacyStateFile }) });
    assert.deepStrictEqual(legacyBridge.clients.get("legacy-client").grantTypes,
        ["authorization_code"]);
    const oauthBridge = new OAuthBridge({
        issuer: ISSUER,
        founderPassword: PASSWORD,
        clock: () => now,
        logger: { info() {} },
        stateStore
    });
    const calls = [];
    const edge = new McpEdge({
        assistant: { async handle(value) {
            calls.push(value);
            return { status: "completed", data: { totalTrades: 1 } };
        } },
        bearerToken: "internal-test-bearer-token-1234567890",
        oauthTokenValidator: (token) => oauthBridge.validateAccessToken(token)
    });
    const server = createHttpServer({ edge, oauthBridge, logger: { info() {} } });
    let runtime = new ProductionRuntime({
        server, port: 0, host: "127.0.0.1", logger: { info() {} }
    });
    const address = await runtime.start();
    let base = `http://127.0.0.1:${address.port}`;

    const protectedMetadata = await request(base,
        "/.well-known/oauth-protected-resource/mcp", "GET");
    assert.strictEqual(protectedMetadata.status, 200);
    assert.deepStrictEqual(protectedMetadata.body.authorization_servers, [ISSUER]);
    const serverMetadata = await request(base,
        "/.well-known/oauth-authorization-server", "GET");
    assert.strictEqual(serverMetadata.body.code_challenge_methods_supported[0], "S256");
    assert.deepStrictEqual(serverMetadata.body.grant_types_supported,
        ["authorization_code", "refresh_token"]);

    const registration = await request(base, "/oauth/register", "POST", {
        client_name: "Claude",
        redirect_uris: [REDIRECT_URI],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code"],
        response_types: ["code"]
    });
    assert.strictEqual(registration.status, 201);
    assert.deepStrictEqual(registration.body.grant_types,
        ["authorization_code"]);
    const clientId = registration.body.client_id;
    const invalidGrantRegistration = await request(base, "/oauth/register", "POST", {
        client_name: "Invalid Claude",
        redirect_uris: [REDIRECT_URI],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "client_credentials"],
        response_types: ["code"]
    });
    assert.strictEqual(invalidGrantRegistration.status, 400);
    assert.strictEqual(invalidGrantRegistration.body.error,
        "invalid_client_metadata");
    const verifier = "test-verifier-abcdefghijklmnopqrstuvwxyz-0123456789";
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    const state = "founder-state-1234567890";
    const authorizePath = authorizationPath(clientId, challenge, state);

    const invalidState = await request(base,
        authorizationPath(clientId, challenge, "short"), "GET");
    assert.strictEqual(invalidState.status, 400);

    const expiredStart = await request(base, authorizePath, "GET");
    const expiredTransaction = hiddenValue(expiredStart.text, "transaction");
    now += 6 * 60 * 1000;
    const expired = await request(base, "/oauth/authorize", "POST",
        form({ transaction: expiredTransaction, password: PASSWORD }), null,
        "application/x-www-form-urlencoded");
    assert.strictEqual(expired.status, 400);

    const start = await request(base, authorizePath, "GET");
    assert.strictEqual(start.status, 200);
    const transaction = hiddenValue(start.text, "transaction");
    const wrongPassword = await request(base, "/oauth/authorize", "POST",
        form({ transaction, password: "wrong-password-value" }), null,
        "application/x-www-form-urlencoded");
    assert.strictEqual(wrongPassword.status, 403);

    const validStart = await request(base, authorizePath, "GET");
    const csp = validStart.headers["content-security-policy"];
    assert(csp.includes("default-src 'none'"));
    assert(csp.includes("style-src 'nonce-"));
    assert(csp.includes("form-action 'self'"));
    assert(csp.includes("https://claude.ai/api/mcp/auth_callback"));
    assert(csp.includes("https://claude.com/api/mcp/auth_callback"));
    assert.strictEqual(csp.includes("https://unapproved.example"), false);
    assert.strictEqual(csp.includes("*"), false);
    assert(csp.includes("base-uri 'none'"));
    assert(csp.includes("frame-ancestors 'none'"));
    const validTransaction = hiddenValue(validStart.text, "transaction");
    const callback = await request(base, "/oauth/authorize", "POST",
        form({ transaction: validTransaction, password: PASSWORD }), null,
        "application/x-www-form-urlencoded");
    assert.strictEqual(callback.status, 302);
    const callbackUrl = new URL(callback.headers.location);
    assert.strictEqual(callbackUrl.origin + callbackUrl.pathname, REDIRECT_URI);
    assert.strictEqual(callbackUrl.searchParams.get("state"), state);

    const token = await request(base, "/oauth/token", "POST", form({
        grant_type: "authorization_code",
        code: callbackUrl.searchParams.get("code"),
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier
    }), null, "application/x-www-form-urlencoded");
    assert.strictEqual(token.status, 200);
    assert.strictEqual(token.body.token_type, "Bearer");
    assert.strictEqual(typeof token.body.access_token, "string");
    assert.strictEqual(token.body.refresh_token, undefined);

    const missing = await request(base, "/mcp", "POST", rpc("tools/list"));
    assert.strictEqual(missing.status, 401);
    assert.ok(missing.headers["www-authenticate"].includes("resource_metadata="));
    const invalid = await request(base, "/mcp", "POST", rpc("tools/list"),
        "Bearer invalid-oauth-token");
    assert.strictEqual(invalid.status, 401);
    const initialized = await request(base, "/mcp", "POST", rpc("initialize"),
        `Bearer ${token.body.access_token}`);
    assert.strictEqual(initialized.status, 200);
    const tools = await request(base, "/mcp", "POST", rpc("tools/list"),
        `Bearer ${token.body.access_token}`);
    assert.deepStrictEqual(tools.body.result.tools.map((tool) => tool.name),
        ["swisschart.query"]);
    const query = await request(base, "/mcp", "POST", businessToolCall(
        "trade_count"),
        `Bearer ${token.body.access_token}`);
    assert.strictEqual(query.body.result.isError, false);
    assert.strictEqual(calls.length, 1);

    const refreshRegistration = await request(base, "/oauth/register", "POST", {
        client_name: "Refresh-capable Claude",
        redirect_uris: [REDIRECT_URI],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"]
    });
    assert.strictEqual(refreshRegistration.status, 201);
    assert.deepStrictEqual(refreshRegistration.body.grant_types,
        ["authorization_code", "refresh_token"]);
    const refreshClientId = refreshRegistration.body.client_id;
    const refreshAuthorizePath = authorizationPath(refreshClientId, challenge, state);
    const refreshStart = await request(base, refreshAuthorizePath, "GET");
    const refreshTransaction = hiddenValue(refreshStart.text, "transaction");
    const refreshCallback = await request(base, "/oauth/authorize", "POST",
        form({ transaction: refreshTransaction, password: PASSWORD }), null,
        "application/x-www-form-urlencoded");
    assert.strictEqual(refreshCallback.status, 302);
    const refreshCallbackUrl = new URL(refreshCallback.headers.location);
    const refreshGrant = await request(base, "/oauth/token", "POST", form({
        grant_type: "authorization_code",
        code: refreshCallbackUrl.searchParams.get("code"),
        client_id: refreshClientId, redirect_uri: REDIRECT_URI,
        code_verifier: verifier
    }), null, "application/x-www-form-urlencoded");
    assert.strictEqual(refreshGrant.status, 200);
    assert.strictEqual(typeof refreshGrant.body.access_token, "string");
    assert.strictEqual(typeof refreshGrant.body.refresh_token, "string");

    const unsupportedTokenGrant = await request(base, "/oauth/token", "POST",
        form({ grant_type: "client_credentials", client_id: refreshClientId }),
        null, "application/x-www-form-urlencoded");
    assert.strictEqual(unsupportedTokenGrant.status, 400);
    assert.strictEqual(unsupportedTokenGrant.body.error, "invalid_grant");

    const persistedBeforeRestart = fs.readFileSync(stateFile, "utf8");
    assert.strictEqual(persistedBeforeRestart.includes(token.body.access_token), false);
    assert.strictEqual(persistedBeforeRestart.includes(
        refreshGrant.body.access_token), false);
    assert.strictEqual(persistedBeforeRestart.includes(
        refreshGrant.body.refresh_token), false);
    assert.strictEqual(persistedBeforeRestart.includes(PASSWORD), false);

    now += TOKEN_TTL_MS + 1;
    assert.strictEqual(oauthBridge.validateAccessToken(token.body.access_token), false);
    await runtime.shutdown();

    const restartedBridge = new OAuthBridge({
        issuer: ISSUER,
        founderPassword: PASSWORD,
        clock: () => now,
        logger: { info() {} },
        stateStore: new OAuthStateStore({ filePath: stateFile })
    });
    assert.ok(restartedBridge.clients.has(clientId));
    assert.ok(restartedBridge.clients.has(refreshClientId));
    assert.deepStrictEqual(restartedBridge.clients.get(clientId).grantTypes,
        ["authorization_code"]);
    assert.deepStrictEqual(restartedBridge.clients.get(refreshClientId).grantTypes,
        ["authorization_code", "refresh_token"]);
    assert.strictEqual(restartedBridge.refreshTokens.size, 1);
    const restartedEdge = new McpEdge({
        assistant: edge.assistant,
        bearerToken: "internal-test-bearer-token-1234567890",
        oauthTokenValidator: (value) => restartedBridge.validateAccessToken(value)
    });
    const restartedServer = createHttpServer({ edge: restartedEdge,
        oauthBridge: restartedBridge, logger: { info() {} } });
    runtime = new ProductionRuntime({ server: restartedServer, port: 0,
        host: "127.0.0.1", logger: { info() {} } });
    const restartedAddress = await runtime.start();
    base = `http://127.0.0.1:${restartedAddress.port}`;

    const refreshed = await request(base, "/oauth/token", "POST", form({
        grant_type: "refresh_token",
        refresh_token: refreshGrant.body.refresh_token,
        client_id: refreshClientId
    }), null, "application/x-www-form-urlencoded");
    assert.strictEqual(refreshed.status, 200);
    assert.strictEqual(typeof refreshed.body.access_token, "string");
    assert.strictEqual(typeof refreshed.body.refresh_token, "string");
    assert.notStrictEqual(refreshed.body.refresh_token,
        refreshGrant.body.refresh_token);
    assert.strictEqual(restartedBridge.validateAccessToken(
        refreshed.body.access_token), true);
    const write = await request(base, "/mcp", "POST", toolCall(
        "write", "publishing.telegram", "publishing.telegram.publish"),
        `Bearer ${refreshed.body.access_token}`);
    assert.strictEqual(write.body.result.isError, true);
    assert.strictEqual(calls.length, 1);

    const reused = await request(base, "/oauth/token", "POST", form({
        grant_type: "refresh_token",
        refresh_token: refreshGrant.body.refresh_token,
        client_id: refreshClientId
    }), null, "application/x-www-form-urlencoded");
    assert.strictEqual(reused.status, 400);
    assert.strictEqual(reused.body.error, "invalid_grant");
    assert.strictEqual(restartedBridge.validateAccessToken(
        refreshed.body.access_token), false);
    const rotatedAfterReuse = await request(base, "/oauth/token", "POST", form({
        grant_type: "refresh_token", refresh_token: refreshed.body.refresh_token,
        client_id: refreshClientId
    }), null, "application/x-www-form-urlencoded");
    assert.strictEqual(rotatedAfterReuse.status, 400);

    const invalidRefresh = await request(base, "/oauth/token", "POST", form({
        grant_type: "refresh_token", refresh_token: "invalid-refresh-token",
        client_id: refreshClientId
    }), null, "application/x-www-form-urlencoded");
    assert.strictEqual(invalidRefresh.status, 400);
    assert.strictEqual(invalidRefresh.body.error, "invalid_grant");

    const secondStart = await request(base, refreshAuthorizePath, "GET");
    const secondTransaction = hiddenValue(secondStart.text, "transaction");
    const secondCallback = await request(base, "/oauth/authorize", "POST",
        form({ transaction: secondTransaction, password: PASSWORD }), null,
        "application/x-www-form-urlencoded");
    const secondCallbackUrl = new URL(secondCallback.headers.location);
    const secondToken = await request(base, "/oauth/token", "POST", form({
        grant_type: "authorization_code",
        code: secondCallbackUrl.searchParams.get("code"),
        client_id: refreshClientId,
        redirect_uri: REDIRECT_URI, code_verifier: verifier
    }), null, "application/x-www-form-urlencoded");
    assert.strictEqual(secondToken.status, 200);
    now += REFRESH_TOKEN_TTL_MS + 1;
    const expiredRefresh = await request(base, "/oauth/token", "POST", form({
        grant_type: "refresh_token", refresh_token: secondToken.body.refresh_token,
        client_id: refreshClientId
    }), null, "application/x-www-form-urlencoded");
    assert.strictEqual(expiredRefresh.status, 400);
    assert.strictEqual(expiredRefresh.body.error, "invalid_grant");

    await runtime.shutdown();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    console.log("Founder OAuth Bridge tests passed");
}

function authorizationPath(clientId, challenge, state) {
    const query = new URLSearchParams({
        response_type: "code", client_id: clientId,
        redirect_uri: REDIRECT_URI, code_challenge: challenge,
        code_challenge_method: "S256", state,
        scope: "swisschart.read", resource: `${ISSUER}/mcp`
    });
    return `/oauth/authorize?${query}`;
}
function hiddenValue(html, name) {
    const match = html.match(new RegExp(`name="${name}" value="([^"]+)"`));
    assert.ok(match, `Missing hidden field ${name}`);
    return match[1];
}
function form(values) { return new URLSearchParams(values).toString(); }
function rpc(method) { return { jsonrpc: "2.0", id: 1, method, params: {} }; }
function toolCall(intent, capability, operation) {
    return { jsonrpc: "2.0", id: 2, method: "tools/call", params: {
        name: "swisschart.query", arguments: { intent, capability, operation, input: {} }
    } };
}
function businessToolCall(query) {
    return { jsonrpc: "2.0", id: 3, method: "tools/call", params: {
        name: "swisschart.query", arguments: { query, period: {
            contractVersion: "1.0", preset: "this_month",
            timezone: "America/New_York"
        } }
    } };
}
function request(base, path, method, body, authorization, contentType) {
    const payload = body === undefined ? null :
        typeof body === "string" ? body : JSON.stringify(body);
    return new Promise((resolve, reject) => {
        const req = http.request(new URL(path, base), {
            method,
            headers: {
                ...(payload ? { "Content-Type": contentType || "application/json",
                    "Content-Length": Buffer.byteLength(payload) } : {}),
                ...(authorization ? { Authorization: authorization } : {})
            }
        }, (res) => {
            const chunks = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => {
                const text = Buffer.concat(chunks).toString("utf8");
                const isJson = String(res.headers["content-type"] || "")
                    .includes("application/json");
                resolve({ status: res.statusCode, headers: res.headers, text,
                    body: text && isJson ? JSON.parse(text) : null });
            });
        });
        req.on("error", reject);
        if (payload) req.write(payload);
        req.end();
    });
}

run().catch((error) => { console.error(error); process.exitCode = 1; });

const crypto = require("crypto");

const OAUTH_SCOPE = "swisschart.read";
const DEFAULT_REDIRECT_URIS = Object.freeze([
    "https://claude.ai/api/mcp/auth_callback",
    "https://claude.com/api/mcp/auth_callback"
]);
const TRANSACTION_TTL_MS = 5 * 60 * 1000;
const CODE_TTL_MS = 60 * 1000;
const TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CLIENT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_OAUTH_BODY_BYTES = 16 * 1024;

class OAuthBridge {
    constructor(options = {}) {
        if (typeof options.issuer !== "string" ||
            !options.issuer.startsWith("https://")) {
            throw new Error("OAuth Bridge requires an HTTPS issuer");
        }
        if (typeof options.founderPassword !== "string" ||
            options.founderPassword.length < 16) {
            throw new Error("OAuth Bridge requires a strong Founder password");
        }
        this.issuer = options.issuer.replace(/\/$/, "");
        this.founderPasswordHash = digest(options.founderPassword);
        this.clock = options.clock || (() => Date.now());
        this.randomToken = options.randomToken || (() =>
            crypto.randomBytes(32).toString("base64url"));
        this.logger = options.logger;
        this.allowedRedirectUris = new Set(
            options.allowedRedirectUris || DEFAULT_REDIRECT_URIS
        );
        this.stateStore = options.stateStore;
        const persisted = this.stateStore ? this.stateStore.load() : null;
        this.clients = restoreMap(persisted && persisted.clients, true);
        this.transactions = restoreMap(persisted && persisted.transactions);
        this.codes = restoreMap(persisted && persisted.codes);
        this.accessTokens = restoreMap(persisted && persisted.accessTokens);
        this.refreshTokens = restoreMap(persisted && persisted.refreshTokens);
        this.consumedRefreshTokens = restoreMap(
            persisted && persisted.consumedRefreshTokens
        );
        this.cleanup();
    }

    resourceMetadataUrl() {
        return `${this.issuer}/.well-known/oauth-protected-resource/mcp`;
    }

    async handle(request, response, requestId) {
        const url = new URL(request.url, this.issuer);
        if (request.method === "GET" && [
            "/.well-known/oauth-protected-resource",
            "/.well-known/oauth-protected-resource/mcp"
        ].includes(url.pathname)) {
            this.json(response, 200, {
                resource: `${this.issuer}/mcp`,
                authorization_servers: [this.issuer],
                scopes_supported: [OAUTH_SCOPE],
                bearer_methods_supported: ["header"]
            });
            return true;
        }
        if (request.method === "GET" &&
            url.pathname === "/.well-known/oauth-authorization-server") {
            this.json(response, 200, {
                issuer: this.issuer,
                authorization_endpoint: `${this.issuer}/oauth/authorize`,
                token_endpoint: `${this.issuer}/oauth/token`,
                registration_endpoint: `${this.issuer}/oauth/register`,
                response_types_supported: ["code"],
                grant_types_supported: ["authorization_code", "refresh_token"],
                token_endpoint_auth_methods_supported: ["none"],
                code_challenge_methods_supported: ["S256"],
                scopes_supported: [OAUTH_SCOPE]
            });
            return true;
        }
        if (request.method === "POST" && url.pathname === "/oauth/register") {
            await this.register(request, response, requestId);
            return true;
        }
        if (url.pathname === "/oauth/authorize" && request.method === "GET") {
            this.authorizationStart(url, response, requestId);
            return true;
        }
        if (url.pathname === "/oauth/authorize" && request.method === "POST") {
            await this.authorizationComplete(request, response, requestId);
            return true;
        }
        if (request.method === "POST" && url.pathname === "/oauth/token") {
            await this.exchangeToken(request, response, requestId);
            return true;
        }
        return false;
    }

    async register(request, response, requestId) {
        try {
            const client = await readJson(request);
            const redirectUris = client.redirect_uris;
            const grantTypes = client.grant_types || ["authorization_code"];
            if (!Array.isArray(redirectUris) || !redirectUris.length ||
                redirectUris.some((uri) => !this.allowedRedirectUris.has(uri)) ||
                (client.token_endpoint_auth_method &&
                    client.token_endpoint_auth_method !== "none") ||
                !Array.isArray(grantTypes) || !grantTypes.length ||
                !grantTypes.includes("authorization_code") ||
                grantTypes.some((grant) =>
                    !["authorization_code", "refresh_token"].includes(grant)) ||
                (client.response_types && !client.response_types.includes("code"))) {
                this.oauthError(response, 400, "invalid_client_metadata");
                return;
            }
            const clientId = `claude-${this.randomToken()}`;
            this.clients.set(clientId, {
                redirectUris: new Set(redirectUris),
                grantTypes: [...grantTypes],
                expiresAt: this.clock() + CLIENT_TTL_MS
            });
            this.persist();
            this.log("oauth_client_registered", { requestId, outcome: "completed" });
            this.json(response, 201, {
                client_id: clientId,
                client_id_issued_at: Math.floor(this.clock() / 1000),
                client_name: "Claude",
                redirect_uris: redirectUris,
                token_endpoint_auth_method: "none",
                grant_types: [...grantTypes],
                response_types: ["code"]
            });
        } catch (error) {
            this.oauthError(response, error.code === "REQUEST_TOO_LARGE" ? 413 : 400,
                "invalid_client_metadata");
        }
    }

    authorizationStart(url, response, requestId) {
        this.cleanup();
        const data = Object.fromEntries(url.searchParams);
        const client = this.clients.get(data.client_id);
        if (data.response_type !== "code" || !client ||
            client.expiresAt <= this.clock() ||
            !client.redirectUris.has(data.redirect_uri) ||
            data.code_challenge_method !== "S256" ||
            !isPkceChallenge(data.code_challenge) ||
            !isSafeState(data.state) ||
            (data.scope && data.scope !== OAUTH_SCOPE) ||
            (data.resource && data.resource !== `${this.issuer}/mcp`)) {
            this.log("oauth_authorization_started", { requestId, outcome: "rejected" });
            this.oauthError(response, 400, "invalid_request");
            return;
        }
        const transactionId = this.randomToken();
        this.transactions.set(transactionId, {
            clientId: data.client_id,
            redirectUri: data.redirect_uri,
            codeChallenge: data.code_challenge,
            state: data.state,
            scope: data.scope || OAUTH_SCOPE,
            expiresAt: this.clock() + TRANSACTION_TTL_MS
        });
        this.persist();
        this.log("oauth_authorization_started", { requestId, outcome: "pending" });
        const nonce = this.randomToken();
        const approvedFormActions = Array.from(this.allowedRedirectUris).join(" ");
        response.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Content-Security-Policy": `default-src 'none'; style-src 'nonce-${nonce}'; form-action 'self' ${approvedFormActions}; base-uri 'none'; frame-ancestors 'none'`,
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "no-referrer"
        });
        response.end(loginPage(transactionId, nonce));
    }

    async authorizationComplete(request, response, requestId) {
        let form;
        try {
            form = new URLSearchParams(await readBody(request));
        } catch (error) {
            this.oauthError(response, 400, "invalid_request");
            return;
        }
        const transactionId = form.get("transaction");
        const transaction = this.transactions.get(transactionId);
        this.transactions.delete(transactionId);
        this.persist();
        if (!transaction || transaction.expiresAt <= this.clock()) {
            this.log("oauth_authorization_completed", { requestId, outcome: "expired" });
            this.oauthError(response, 400, "invalid_request");
            return;
        }
        const passwordHash = digest(form.get("password") || "");
        if (!crypto.timingSafeEqual(passwordHash, this.founderPasswordHash)) {
            this.log("oauth_authorization_completed", { requestId, outcome: "rejected" });
            this.oauthError(response, 403, "access_denied");
            return;
        }
        const code = this.randomToken();
        this.codes.set(code, {
            clientId: transaction.clientId,
            redirectUri: transaction.redirectUri,
            codeChallenge: transaction.codeChallenge,
            scope: transaction.scope,
            expiresAt: this.clock() + CODE_TTL_MS
        });
        this.persist();
        const redirect = new URL(transaction.redirectUri);
        redirect.searchParams.set("code", code);
        redirect.searchParams.set("state", transaction.state);
        this.log("oauth_authorization_completed", { requestId, outcome: "approved" });
        response.writeHead(302, { Location: redirect.toString(), "Cache-Control": "no-store" });
        response.end();
    }

    async exchangeToken(request, response, requestId) {
        let form;
        try {
            form = new URLSearchParams(await readBody(request));
        } catch (error) {
            this.oauthError(response, 400, "invalid_request");
            return;
        }
        if (form.get("grant_type") === "refresh_token") {
            this.refreshAccessToken(form, response, requestId);
            return;
        }
        this.exchangeAuthorizationCode(form, response, requestId);
    }

    exchangeAuthorizationCode(form, response, requestId) {
        const codeValue = form.get("code");
        const code = this.codes.get(codeValue);
        this.codes.delete(codeValue);
        this.persist();
        const client = this.clients.get(form.get("client_id"));
        if (form.get("grant_type") !== "authorization_code" || !code ||
            code.expiresAt <= this.clock() || !client ||
            code.clientId !== form.get("client_id") ||
            code.redirectUri !== form.get("redirect_uri") ||
            !verifyPkce(form.get("code_verifier"), code.codeChallenge)) {
            this.log("oauth_token_exchange", { requestId, outcome: "rejected" });
            this.oauthError(response, 400, "invalid_grant");
            return;
        }
        const tokens = this.issueTokenPair(code.clientId, code.scope, undefined,
            client.grantTypes.includes("refresh_token"));
        this.log("oauth_token_exchange", { requestId, outcome: "completed" });
        this.json(response, 200, {
            access_token: tokens.accessToken,
            token_type: "Bearer",
            expires_in: Math.floor(TOKEN_TTL_MS / 1000),
            ...(tokens.refreshToken ? { refresh_token: tokens.refreshToken } : {}),
            scope: code.scope
        });
    }

    refreshAccessToken(form, response, requestId) {
        this.cleanup();
        const refreshToken = form.get("refresh_token");
        const key = typeof refreshToken === "string" ? tokenKey(refreshToken) : "";
        const record = this.refreshTokens.get(key);
        const consumed = this.consumedRefreshTokens.get(key);
        const client = this.clients.get(form.get("client_id"));
        if (!record || record.expiresAt <= this.clock() || !client ||
            client.expiresAt <= this.clock() ||
            !client.grantTypes.includes("refresh_token") ||
            record.clientId !== form.get("client_id") ||
            (form.get("scope") && form.get("scope") !== record.scope)) {
            if (consumed && consumed.expiresAt > this.clock()) {
                this.revokeTokenFamily(consumed.familyId);
                this.log("oauth_refresh_reuse", { requestId, outcome: "revoked" });
            } else {
                this.log("oauth_token_refresh", { requestId, outcome: "rejected" });
            }
            this.persist();
            this.oauthError(response, 400, "invalid_grant");
            return;
        }
        this.refreshTokens.delete(key);
        this.consumedRefreshTokens.set(key, {
            familyId: record.familyId,
            expiresAt: record.expiresAt
        });
        client.expiresAt = this.clock() + CLIENT_TTL_MS;
        const tokens = this.issueTokenPair(record.clientId, record.scope,
            record.familyId, true);
        this.log("oauth_token_refresh", { requestId, outcome: "completed" });
        this.json(response, 200, {
            access_token: tokens.accessToken,
            token_type: "Bearer",
            expires_in: Math.floor(TOKEN_TTL_MS / 1000),
            refresh_token: tokens.refreshToken,
            scope: record.scope
        });
    }

    issueTokenPair(clientId, scope, familyId, includeRefreshToken = false) {
        const accessToken = this.randomToken();
        const refreshToken = includeRefreshToken ? this.randomToken() : null;
        const tokenFamilyId = familyId || (includeRefreshToken
            ? this.randomToken() : null);
        this.accessTokens.set(tokenKey(accessToken), {
            clientId, familyId: tokenFamilyId, scope,
            expiresAt: this.clock() + TOKEN_TTL_MS
        });
        if (refreshToken) {
            this.refreshTokens.set(tokenKey(refreshToken), {
                clientId, familyId: tokenFamilyId, scope,
                expiresAt: this.clock() + REFRESH_TOKEN_TTL_MS
            });
        }
        this.persist();
        return { accessToken, refreshToken };
    }

    revokeTokenFamily(familyId) {
        removeFamily(this.accessTokens, familyId);
        removeFamily(this.refreshTokens, familyId);
    }

    validateAccessToken(token) {
        this.cleanup();
        const record = typeof token === "string"
            ? this.accessTokens.get(tokenKey(token)) : null;
        return Boolean(record && record.expiresAt > this.clock() &&
            record.scope === OAUTH_SCOPE);
    }

    cleanup() {
        const now = this.clock();
        const changed = removeExpired(this.clients, now) |
            removeExpired(this.transactions, now) |
            removeExpired(this.codes, now) |
            removeExpired(this.accessTokens, now) |
            removeExpired(this.refreshTokens, now) |
            removeExpired(this.consumedRefreshTokens, now);
        if (changed) this.persist();
    }

    persist() {
        if (!this.stateStore) return;
        this.stateStore.save({
            clients: serializeMap(this.clients, true),
            transactions: serializeMap(this.transactions),
            codes: serializeMap(this.codes),
            accessTokens: serializeMap(this.accessTokens),
            refreshTokens: serializeMap(this.refreshTokens),
            consumedRefreshTokens: serializeMap(this.consumedRefreshTokens)
        });
    }

    json(response, status, body) {
        response.writeHead(status, {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store"
        });
        response.end(JSON.stringify(body));
    }

    oauthError(response, status, error) {
        this.json(response, status, { error });
    }

    log(event, fields) {
        if (this.logger && typeof this.logger.info === "function") {
            this.logger.info(event, fields);
        }
    }
}

function readJson(request) {
    return readBody(request).then((body) => JSON.parse(body));
}

function readBody(request) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        request.on("data", (chunk) => {
            size += chunk.length;
            if (size > MAX_OAUTH_BODY_BYTES) {
                const error = new Error("OAuth request is too large");
                error.code = "REQUEST_TOO_LARGE";
                reject(error);
                return;
            }
            chunks.push(chunk);
        });
        request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        request.on("error", reject);
    });
}

function digest(value) {
    return crypto.createHash("sha256").update(String(value)).digest();
}
function tokenKey(value) { return digest(value).toString("hex"); }
function isPkceChallenge(value) {
    return typeof value === "string" && /^[A-Za-z0-9_-]{43,128}$/.test(value);
}
function isSafeState(value) {
    return typeof value === "string" && value.length >= 16 && value.length <= 512;
}
function verifyPkce(verifier, challenge) {
    if (typeof verifier !== "string" ||
        !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
    const calculated = crypto.createHash("sha256").update(verifier)
        .digest("base64url");
    return calculated.length === challenge.length &&
        crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(challenge));
}
function removeExpired(map, now) {
    let changed = false;
    for (const [key, value] of map) {
        if (value.expiresAt <= now) { map.delete(key); changed = true; }
    }
    return changed;
}
function removeFamily(map, familyId) {
    for (const [key, value] of map) {
        if (value.familyId === familyId) map.delete(key);
    }
}
function restoreMap(entries, redirectUris = false) {
    return new Map((entries || []).map(([key, value]) => [key, redirectUris ? {
        ...value, redirectUris: new Set(value.redirectUris || []),
        grantTypes: Array.isArray(value.grantTypes)
            ? value.grantTypes : ["authorization_code"]
    } : value]));
}
function serializeMap(map, redirectUris = false) {
    return Array.from(map, ([key, value]) => [key, redirectUris ? {
        ...value, redirectUris: Array.from(value.redirectUris || [])
    } : value]);
}
function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
}
function loginPage(transactionId, nonce) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Swisschart Founder Authorization</title><style nonce="${escapeHtml(nonce)}">body{font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#17202a}form{display:grid;gap:1rem}input,button{font:inherit;padding:.75rem}button{background:#17202a;color:white;border:0;cursor:pointer}</style></head><body><h1>Swisschart Founder Authorization</h1><p>Authorize Claude for read-only Swisschart trading analysis.</p><form method="post" action="/oauth/authorize"><input type="hidden" name="transaction" value="${escapeHtml(transactionId)}"><label>Founder password<input name="password" type="password" required autocomplete="current-password"></label><button type="submit">Authorize read-only access</button></form></body></html>`;
}

module.exports = OAuthBridge;
module.exports.OAUTH_SCOPE = OAUTH_SCOPE;
module.exports.DEFAULT_REDIRECT_URIS = DEFAULT_REDIRECT_URIS;
module.exports.TRANSACTION_TTL_MS = TRANSACTION_TTL_MS;
module.exports.TOKEN_TTL_MS = TOKEN_TTL_MS;
module.exports.REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_MS;

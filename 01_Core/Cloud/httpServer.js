const http = require("http");
const { randomUUID } = require("crypto");

const MAX_REQUEST_BYTES = 64 * 1024;

function createHttpServer(options = {}) {
    const edge = options.edge;
    const oauthBridge = options.oauthBridge || null;
    const logger = options.logger;
    if (!edge || typeof edge.authenticate !== "function" ||
        typeof edge.handleRpc !== "function") {
        throw new Error("HTTP server requires MCP Edge");
    }

    return http.createServer(async (request, response) => {
        const requestId = normalizeRequestId(request.headers["x-request-id"]) ||
            randomUUID();
        response.setHeader("X-Request-Id", requestId);

        if (oauthBridge && await oauthBridge.handle(request, response, requestId)) {
            return;
        }

        if (request.method === "GET" && request.url === "/health") {
            log(logger, "health_check", { requestId, outcome: "healthy" });
            writeJson(response, 200, { status: "ok" });
            return;
        }
        if (request.method !== "POST" || request.url !== "/mcp") {
            writeJson(response, 404, { error: "not_found" });
            return;
        }
        if (!edge.authenticate(request.headers.authorization)) {
            log(logger, "mcp_authentication", { requestId, outcome: "rejected" });
            const resourceMetadata = oauthBridge
                ? ` resource_metadata=\"${oauthBridge.resourceMetadataUrl()}\"`
                : "";
            response.setHeader("WWW-Authenticate", `Bearer${resourceMetadata}`);
            writeJson(response, 401, { error: "unauthorized" });
            return;
        }
        log(logger, "mcp_authentication", { requestId, outcome: "authenticated" });

        try {
            const body = await readJson(request, MAX_REQUEST_BYTES);
            const result = await edge.handleRpc(body, requestId);
            if (result === null) {
                response.writeHead(202);
                response.end();
                return;
            }
            writeJson(response, 200, result);
        } catch (error) {
            const status = error.code === "REQUEST_TOO_LARGE" ? 413 :
                error.code === "INVALID_JSON" ? 400 : 500;
            log(logger, "http_runtime_error", { requestId, status });
            writeJson(response, status, {
                error: status === 500 ? "internal_error" : error.code.toLowerCase()
            });
        }
    });
}

function readJson(request, limit) {
    return new Promise((resolve, reject) => {
        let size = 0;
        let exceeded = false;
        const chunks = [];
        request.on("data", (chunk) => {
            if (exceeded) return;
            size += chunk.length;
            if (size > limit) {
                exceeded = true;
                chunks.length = 0;
                const error = new Error("Request is too large");
                error.code = "REQUEST_TOO_LARGE";
                reject(error);
                return;
            }
            chunks.push(chunk);
        });
        request.on("end", () => {
            if (exceeded) return;
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
            } catch (cause) {
                const error = new Error("Request body must be valid JSON");
                error.code = "INVALID_JSON";
                reject(error);
            }
        });
        request.on("error", reject);
    });
}

function writeJson(response, status, body) {
    response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(body));
}

function normalizeRequestId(value) {
    return typeof value === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(value)
        ? value : null;
}
function log(logger, event, fields) {
    if (logger && typeof logger.info === "function") logger.info(event, fields);
}

module.exports = { createHttpServer, MAX_REQUEST_BYTES };

const REQUIRED_ENVIRONMENT_VARIABLES = Object.freeze([
    "SWISSCHART_MCP_BEARER_TOKEN",
    "SWISSCHART_PUBLIC_BASE_URL",
    "SWISSCHART_OAUTH_FOUNDER_PASSWORD",
    "SWISSCHART_OAUTH_STATE_FILE",
    "NOTION_API_TOKEN",
    "NOTION_DATABASE_ID",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID"
]);

function loadCloudConfig(environment = process.env) {
    const missing = REQUIRED_ENVIRONMENT_VARIABLES.filter((name) =>
        typeof environment[name] !== "string" || !environment[name].trim());
    if (missing.length) {
        const error = new Error(
            `Missing required environment variables: ${missing.join(", ")}`
        );
        error.code = "CLOUD_ENVIRONMENT_MISSING";
        error.missingVariables = missing;
        throw error;
    }
    if (environment.SWISSCHART_MCP_BEARER_TOKEN.length < 32) {
        const error = new Error("SWISSCHART_MCP_BEARER_TOKEN must contain at least 32 characters");
        error.code = "CLOUD_BEARER_TOKEN_WEAK";
        throw error;
    }
    if (environment.SWISSCHART_OAUTH_FOUNDER_PASSWORD.length < 16) {
        const error = new Error(
            "SWISSCHART_OAUTH_FOUNDER_PASSWORD must contain at least 16 characters"
        );
        error.code = "CLOUD_OAUTH_PASSWORD_WEAK";
        throw error;
    }
    let publicBaseUrl;
    try {
        publicBaseUrl = new URL(environment.SWISSCHART_PUBLIC_BASE_URL);
    } catch (cause) {
        const error = new Error("SWISSCHART_PUBLIC_BASE_URL must be a valid HTTPS URL");
        error.code = "CLOUD_PUBLIC_URL_INVALID";
        throw error;
    }
    if (publicBaseUrl.protocol !== "https:" || publicBaseUrl.pathname !== "/" ||
        publicBaseUrl.search || publicBaseUrl.hash) {
        const error = new Error("SWISSCHART_PUBLIC_BASE_URL must be an HTTPS origin");
        error.code = "CLOUD_PUBLIC_URL_INVALID";
        throw error;
    }

    const port = parsePort(environment.PORT);
    return Object.freeze({
        port,
        bearerToken: environment.SWISSCHART_MCP_BEARER_TOKEN,
        publicBaseUrl: publicBaseUrl.origin,
        founderPassword: environment.SWISSCHART_OAUTH_FOUNDER_PASSWORD,
        oauthStateFile: environment.SWISSCHART_OAUTH_STATE_FILE,
        telegramChatId: environment.TELEGRAM_CHAT_ID,
        telegramPollingEnabled: environment.TELEGRAM_POLLING_ENABLED === "true",
        schedulerEnabled: environment.SCHEDULER_ENABLED === "true"
    });
}

function parsePort(value) {
    if (value === undefined || value === "") return 3000;
    const port = Number(value);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
        const error = new Error("PORT must be an integer between 0 and 65535");
        error.code = "CLOUD_PORT_INVALID";
        throw error;
    }
    return port;
}

module.exports = { loadCloudConfig, REQUIRED_ENVIRONMENT_VARIABLES };

const REQUIRED_ENVIRONMENT_VARIABLES = Object.freeze([
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_FOUNDER_USER_ID",
    "OPENAI_API_KEY",
    "OPENAI_MODEL",
    "NOTION_API_TOKEN",
    "NOTION_DATABASE_ID"
]);

class TelegramAssistantRuntime {
    constructor(options = {}) {
        this.poller = options.poller;
        this.process = options.process || global.process;
        this.logger = options.logger || console;
        this.started = false;
        this.shutdownStarted = false;
        this.startPromise = null;
        this.signalHandler = () => this.shutdown();
        if (!this.poller || typeof this.poller.start !== "function" ||
            typeof this.poller.stop !== "function") {
            throw new Error("Telegram Assistant Runtime requires a poller");
        }
    }

    start() {
        if (this.startPromise) return this.startPromise;
        this.process.once("SIGINT", this.signalHandler);
        this.process.once("SIGTERM", this.signalHandler);
        this.started = true;
        this.startPromise = this.poller.start().finally(() =>
            this.removeSignalHandlers());
        return this.startPromise;
    }

    shutdown() {
        if (this.shutdownStarted) return;
        this.shutdownStarted = true;
        this.logger.info("Telegram Assistant graceful shutdown requested");
        this.poller.stop();
    }

    removeSignalHandlers() {
        if (!this.started) return;
        this.process.removeListener("SIGINT", this.signalHandler);
        this.process.removeListener("SIGTERM", this.signalHandler);
        this.started = false;
    }
}

function validateStartupEnvironment(environment = {}) {
    const missing = REQUIRED_ENVIRONMENT_VARIABLES.filter((name) =>
        typeof environment[name] !== "string" || !environment[name].trim());
    if (missing.length) {
        const error = new Error(`Missing required environment variables: ${missing.join(", ")}`);
        error.code = "TELEGRAM_ASSISTANT_ENVIRONMENT_MISSING";
        error.missingVariables = missing;
        throw error;
    }
    return true;
}

module.exports = {
    TelegramAssistantRuntime,
    REQUIRED_ENVIRONMENT_VARIABLES,
    validateStartupEnvironment
};

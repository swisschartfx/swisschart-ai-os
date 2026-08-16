class TelegramAssistantPoller {
    constructor(options = {}) {
        this.transport = options.transport;
        this.adapter = options.adapter;
        this.offset = Number.isSafeInteger(options.initialOffset)
            ? options.initialOffset
            : undefined;
        this.timeoutSeconds = options.timeoutSeconds || 25;
        this.retryDelayMs = options.retryDelayMs || 3000;
        this.delay = options.delay || ((milliseconds) =>
            new Promise((resolve) => setTimeout(resolve, milliseconds)));
        this.logger = options.logger || console;
        this.running = false;
        this.startPromise = null;
        if (!this.transport || typeof this.transport.getUpdates !== "function") {
            throw new Error("Telegram Assistant Poller requires getUpdates transport");
        }
        if (!this.adapter || typeof this.adapter.handleUpdate !== "function") {
            throw new Error("Telegram Assistant Poller requires Telegram Assistant Adapter");
        }
    }

    async pollOnce() {
        const updates = await this.transport.getUpdates({
            offset: this.offset,
            timeoutSeconds: this.timeoutSeconds
        });
        const ordered = [...updates].sort((left, right) =>
            left.update_id - right.update_id);
        const outcomes = [];
        for (const update of ordered) {
            if (!Number.isSafeInteger(update && update.update_id) ||
                (this.offset !== undefined && update.update_id < this.offset)) continue;
            let outcome;
            try {
                outcome = await this.adapter.handleUpdate(update);
            } catch (error) {
                outcome = { status: "failed" };
            } finally {
                this.offset = update.update_id + 1;
            }
            outcomes.push({ updateId: update.update_id, status: outcome.status });
        }
        return outcomes;
    }

    async start() {
        if (this.startPromise) return this.startPromise;
        this.running = true;
        this.logger.info("Telegram Assistant polling started");
        this.startPromise = this.runLoop();
        return this.startPromise;
    }

    async runLoop() {
        while (this.running) {
            try {
                const outcomes = await this.pollOnce();
                for (const outcome of outcomes) {
                    this.logger.info(outcome.status === "replied"
                        ? "Telegram Assistant authorized update handled"
                        : "Telegram Assistant update skipped");
                }
            } catch (error) {
                this.logger.warn("Telegram Assistant polling network error; retrying");
                if (this.running) await this.delay(this.retryDelayMs);
            }
        }
    }

    stop() {
        this.running = false;
    }
}

module.exports = TelegramAssistantPoller;

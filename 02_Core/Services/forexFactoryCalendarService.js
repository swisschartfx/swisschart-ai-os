const DEFAULT_FEED_URL =
    "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

class ForexFactoryCalendarService {
    constructor(options = {}) {
        this.feedUrl = options.feedUrl || DEFAULT_FEED_URL;
        this.fetch = options.fetch || global.fetch;
        this.clock = options.clock || (() => new Date());
        this.cacheTtlMs = options.cacheTtlMs === undefined
            ? 5 * 60 * 1000
            : options.cacheTtlMs;
        this.cache = null;

        if (typeof this.fetch !== "function") {
            const error = new Error("Forex Factory calendar fetch implementation is required");
            error.code = "FOREX_FACTORY_FETCH_REQUIRED";
            throw error;
        }
    }

    async getWeeklyCalendar(options = {}) {
        const now = this.clock();
        if (!options.forceRefresh && this.cache &&
            now.getTime() - this.cache.retrievedAtMs < this.cacheTtlMs) {
            return this.cache.value;
        }

        let response;
        try {
            response = await this.fetch(this.feedUrl, {
                headers: {
                    accept: "application/json"
                }
            });
        } catch (cause) {
            throw providerError(
                "FOREX_FACTORY_UNAVAILABLE",
                "Forex Factory calendar provider is unavailable",
                true,
                cause
            );
        }

        if (!response || response.ok !== true) {
            const status = response && Number.isInteger(response.status)
                ? response.status
                : null;
            const error = providerError(
                "FOREX_FACTORY_HTTP_ERROR",
                "Forex Factory calendar provider returned an unsuccessful response",
                status === 429 || (status !== null && status >= 500)
            );
            error.status = status;
            throw error;
        }

        let payload;
        try {
            payload = await response.json();
        } catch (cause) {
            throw providerError(
                "FOREX_FACTORY_MALFORMED_JSON",
                "Forex Factory calendar provider returned malformed JSON",
                false,
                cause
            );
        }

        if (!Array.isArray(payload)) {
            throw providerError(
                "FOREX_FACTORY_INVALID_PAYLOAD",
                "Forex Factory calendar payload must be an array",
                false
            );
        }

        const retrievedAt = now.toISOString();
        const value = Object.freeze({
            events: payload,
            sourceReference: this.feedUrl,
            retrievedAt
        });

        this.cache = {
            retrievedAtMs: now.getTime(),
            value
        };

        return value;
    }
}

function providerError(code, message, retryable, cause = null) {
    const error = new Error(message);
    error.code = code;
    error.retryable = Boolean(retryable);
    if (cause && cause.code) error.causeCode = cause.code;
    return error;
}

module.exports = ForexFactoryCalendarService;
module.exports.DEFAULT_FEED_URL = DEFAULT_FEED_URL;

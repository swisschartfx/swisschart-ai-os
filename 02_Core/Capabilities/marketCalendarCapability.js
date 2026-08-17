const ForexFactoryEventAdapter = require(
    "../../01_Core/Event_Engine/05_forexFactoryEventAdapter"
);
const ForexFactoryCalendarService = require(
    "../Services/forexFactoryCalendarService"
);
const {
    EXECUTION_MODES,
    CAPABILITY_BEHAVIORS,
    APPROVAL_REQUIREMENTS,
    LIFECYCLE_STAGES,
    createCapabilityDeclaration
} = require("./capabilityContract");

const MARKET_CALENDAR_DAILY = "market.calendar.daily";
const systemConfig = require("../../01_Core/Configuration/systemConfig.json");
const DEFAULT_TIMEZONE = systemConfig.timezone;

class MarketCalendarCapability {
    constructor(options = {}) {
        this.name = "market.calendar";
        this.calendarService = options.calendarService ||
            new ForexFactoryCalendarService(options.serviceOptions);
        this.adapter = options.adapter || new ForexFactoryEventAdapter();
        this.timezone = options.timezone || DEFAULT_TIMEZONE;
        this.currencies = Object.freeze(normalizeCurrencies(
            options.currencies || systemConfig.calendar.currencies
        ));
        this.clock = options.clock || (() => new Date());

        this.declaration = createCapabilityDeclaration({
            capabilityId: this.name,
            domain: "market_intelligence",
            version: "1.0.0",
            supportedOperations: [MARKET_CALENDAR_DAILY],
            executionMode: EXECUTION_MODES.SYNCHRONOUS,
            behavior: CAPABILITY_BEHAVIORS.READ_ONLY,
            approvalRequirement: APPROVAL_REQUIREMENTS.NONE,
            lifecycleSupport: [LIFECYCLE_STAGES.COLLECT],
            inputContractVersion: "1.0",
            outputContractVersion: "1.0"
        });
    }

    async execute(request) {
        if (!request || request.operation !== MARKET_CALENDAR_DAILY) {
            const error = new Error("Unsupported Market Calendar operation");
            error.code = "MARKET_CALENDAR_OPERATION_UNSUPPORTED";
            throw error;
        }

        const date = normalizeDate(
            request.input && request.input.date,
            this.clock(),
            this.timezone
        );
        const currencies = normalizeCurrencies(
            request.input && request.input.currencies || this.currencies
        );

        const provider = await this.calendarService.getWeeklyCalendar();
        const normalized = [];
        const rejected = [];

        for (const rawEvent of provider.events) {
            let event;
            try {
                event = this.adapter.adapt(rawEvent, {
                    sourceReference: provider.sourceReference,
                    retrievedAt: provider.retrievedAt
                });
                validateNormalizedEvent(event);
            } catch (error) {
                rejected.push({
                    title: rawEvent && rawEvent.title || null,
                    code: error.code || "MARKET_CALENDAR_EVENT_INVALID"
                });
                continue;
            }

            if (!currencies.includes(event.currency)) continue;
            if (event.localDate !== date) continue;
            if (event.impact !== "high" && event.isBankHoliday !== true) continue;

            normalized.push(event);
        }

        normalized.sort(compareEvents);

        return {
            data: {
                date,
                timezone: this.timezone,
                currencies,
                events: normalized,
                highImpactEvents: normalized.filter(event =>
                    event.impact === "high" && event.isBankHoliday !== true
                ),
                bankHolidays: normalized.filter(event =>
                    event.isBankHoliday === true
                ),
                providerStatus: "available",
                rejectedEventCount: rejected.length
            },
            summary: "Normalized daily market calendar retrieved",
            evidence: [],
            sourceReferences: [provider.sourceReference],
            recordCount: normalized.length,
            executionMetadata: {
                providerIndependent: true,
                provider: "forex_factory",
                sourceRetrievedAt: provider.retrievedAt,
                rejectedEvents: rejected
            }
        };
    }
}

function validateNormalizedEvent(event) {
    if (!event || typeof event !== "object" || !event.title ||
        !event.currency || !event.scheduledAt || !event.localDate) {
        const error = new Error("Normalized market calendar event is incomplete");
        error.code = "MARKET_CALENDAR_EVENT_INVALID";
        throw error;
    }
}

function normalizeCurrencies(value) {
    if (!Array.isArray(value) || value.length === 0) {
        const error = new Error("Market Calendar currencies are required");
        error.code = "MARKET_CALENDAR_CURRENCIES_REQUIRED";
        throw error;
    }
    const currencies = [...new Set(value.map(item =>
        String(item || "").trim().toUpperCase()
    ))];
    if (currencies.some(item => !/^[A-Z]{3}$/.test(item))) {
        const error = new Error("Market Calendar currency is invalid");
        error.code = "MARKET_CALENDAR_CURRENCY_INVALID";
        throw error;
    }
    return currencies;
}

function normalizeDate(value, now, timezone) {
    if (value !== undefined && value !== null) {
        const date = String(value).trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            const error = new Error("Market Calendar date must be YYYY-MM-DD");
            error.code = "MARKET_CALENDAR_DATE_INVALID";
            throw error;
        }
        return date;
    }
    return formatLocalDate(now, timezone);
}

function formatLocalDate(value, timezone) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        const error = new Error("Market Calendar timestamp is invalid");
        error.code = "MARKET_CALENDAR_TIMESTAMP_INVALID";
        throw error;
    }
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);
    const mapped = Object.fromEntries(parts
        .filter(part => part.type !== "literal")
        .map(part => [part.type, part.value]));
    return `${mapped.year}-${mapped.month}-${mapped.day}`;
}

function compareEvents(a, b) {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt) ||
        a.currency.localeCompare(b.currency) ||
        a.title.localeCompare(b.title);
}

module.exports = MarketCalendarCapability;
module.exports.MARKET_CALENDAR_DAILY = MARKET_CALENDAR_DAILY;
module.exports.DEFAULT_TIMEZONE = DEFAULT_TIMEZONE;

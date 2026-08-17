const MORNING_CALENDAR_RENDERER_VERSION = "morning-calendar.v1";
const DISPLAY_TIMEZONE = "America/New_York";
const INSERTION_ANCHOR = "London session opens in 1 hour";

function renderMorningMessage(baseContent, renderContext = {}) {
    if (typeof baseContent !== "string" || !baseContent.includes(INSERTION_ANCHOR)) {
        const error = new Error("Morning Message template anchor is missing");
        error.code = "MORNING_MESSAGE_TEMPLATE_INVALID";
        throw error;
    }

    if (renderContext.status !== "available") return baseContent;

    const highImpactEvents = Array.isArray(renderContext.highImpactEvents)
        ? [...renderContext.highImpactEvents].sort(compareByInstant)
        : [];
    const bankHolidays = Array.isArray(renderContext.bankHolidays)
        ? [...renderContext.bankHolidays].sort(compareByCurrencyAndTitle)
        : [];

    const lines = [];
    if (highImpactEvents.length > 0) {
        lines.push("Today's high-impact news:", "");
        highImpactEvents.forEach(event => {
            lines.push(`${formatNewYorkTime(event.scheduledAt)} — ${event.currency} ${event.title}`);
        });
    } else {
        lines.push("No high-impact news scheduled today");
    }

    if (bankHolidays.length > 0) {
        lines.push("", "Bank Holiday:", "");
        bankHolidays.forEach(event => {
            lines.push(`${event.currency} — ${event.title}`);
        });
    }

    return baseContent.replace(
        INSERTION_ANCHOR,
        `${INSERTION_ANCHOR}\n\n${lines.join("\n")}`
    );
}

function formatNewYorkTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        const error = new Error("Morning Message event timestamp is invalid");
        error.code = "MORNING_MESSAGE_EVENT_TIMESTAMP_INVALID";
        throw error;
    }
    return new Intl.DateTimeFormat("en-US", {
        timeZone: DISPLAY_TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).format(date);
}

function compareByInstant(a, b) {
    return Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt) ||
        String(a.currency || "").localeCompare(String(b.currency || "")) ||
        String(a.title || "").localeCompare(String(b.title || ""));
}

function compareByCurrencyAndTitle(a, b) {
    return String(a.currency || "").localeCompare(String(b.currency || "")) ||
        String(a.title || "").localeCompare(String(b.title || ""));
}

module.exports = {
    MORNING_CALENDAR_RENDERER_VERSION,
    DISPLAY_TIMEZONE,
    renderMorningMessage,
    formatNewYorkTime
};

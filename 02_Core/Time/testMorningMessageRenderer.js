const assert = require("assert");
const {
    renderMorningMessage,
    formatNewYorkTime,
    MORNING_CALENDAR_RENDERER_VERSION
} = require("./morningMessageRenderer");
const { createMarketSessionSchedules } = require("./marketSessionSchedules");

const morning = createMarketSessionSchedules().find(schedule =>
    schedule.scheduleId === "market.london.preopen_60m"
);
const base = morning.publication.template.content;
assert.strictEqual(morning.publication.rendererVersion,
    MORNING_CALENDAR_RENDERER_VERSION);

const available = {
    status: "available",
    highImpactEvents: [
        { title: "Consumer Sentiment", currency: "USD", scheduledAt: "2026-08-17T14:00:00.000Z" },
        { title: "Retail Sales", currency: "USD", scheduledAt: "2026-08-17T12:30:00.000Z" },
        { title: "CPI y/y", currency: "GBP", scheduledAt: "2026-08-17T06:00:00.000Z" }
    ],
    bankHolidays: [
        { title: "Bank Holiday", currency: "GBP", scheduledAt: "2026-08-17T04:00:00.000Z", isBankHoliday: true }
    ]
};
const message = renderMorningMessage(base, available);
assert(message.includes("Today's high-impact news:"));
assert(message.indexOf("02:00 — GBP CPI y/y") < message.indexOf("08:30 — USD Retail Sales"));
assert(message.indexOf("08:30 — USD Retail Sales") < message.indexOf("10:00 — USD Consumer Sentiment"));
assert(message.includes("Bank Holiday:\n\nGBP — Bank Holiday"));
assert(message.includes("Stay focused and wait for clean setups"));
assert(message.endsWith('<a href="https://linktr.ee/swisschart">Swisschart Links</a>'));

const holidayOnly = renderMorningMessage(base, {
    status: "available", highImpactEvents: [], bankHolidays: available.bankHolidays
});
assert(holidayOnly.includes("No high-impact news scheduled today"));
assert(holidayOnly.includes("Bank Holiday:"));

const empty = renderMorningMessage(base, {
    status: "available", highImpactEvents: [], bankHolidays: []
});
assert(empty.includes("No high-impact news scheduled today"));
assert(!empty.includes("Bank Holiday:"));

const failed = renderMorningMessage(base, { status: "unavailable" });
assert.strictEqual(failed, base);
assert(!failed.includes("No high-impact news scheduled today"));

assert.strictEqual(formatNewYorkTime("2026-01-15T13:30:00.000Z"), "08:30");
assert.strictEqual(formatNewYorkTime("2026-07-15T12:30:00.000Z"), "08:30");

console.log("Morning Message calendar renderer tests passed");

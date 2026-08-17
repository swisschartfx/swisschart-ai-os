const assert = require("assert");
const MarketCalendarCapability = require("./marketCalendarCapability");

const sourceReference =
    "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

function service(events) {
    return {
        async getWeeklyCalendar() {
            return {
                events,
                sourceReference,
                retrievedAt: "2026-08-17T11:00:00.000Z"
            };
        }
    };
}

(async () => {
    const capability = new MarketCalendarCapability({
        calendarService: service([
            {
                title: "CPI y/y",
                country: "GBP",
                date: "2026-08-19T02:00:00-04:00",
                impact: "High",
                forecast: "2.9%",
                previous: "2.6%"
            },
            {
                title: "FOMC Meeting Minutes",
                country: "USD",
                date: "2026-08-19T14:00:00-04:00",
                impact: "High",
                forecast: "",
                previous: ""
            },
            {
                title: "Bank Holiday",
                country: "USD",
                date: "2026-08-19T00:00:00-04:00",
                impact: "Holiday",
                forecast: "",
                previous: ""
            },
            {
                title: "German Bank Holiday",
                country: "EUR",
                date: "2026-08-19T00:00:00-04:00",
                impact: "Holiday",
                forecast: "",
                previous: ""
            },
            {
                title: "Retail Sales m/m",
                country: "GBP",
                date: "2026-08-19T04:30:00-04:00",
                impact: "Medium",
                forecast: "0.1%",
                previous: "0.2%"
            },
            {
                title: "CPI m/m",
                country: "CAD",
                date: "2026-08-19T08:30:00-04:00",
                impact: "High",
                forecast: "0.4%",
                previous: "-0.4%"
            },
            {
                title: "Tomorrow Event",
                country: "USD",
                date: "2026-08-20T08:30:00-04:00",
                impact: "High",
                forecast: "1",
                previous: "2"
            }
        ]),
        currencies: ["USD", "GBP", "EUR"]
    });

    const result = await capability.execute({
        operation: "market.calendar.daily",
        input: { date: "2026-08-19" }
    });

    assert.strictEqual(result.data.timezone, "America/New_York");
    assert.deepStrictEqual(result.data.currencies, ["USD", "GBP", "EUR"]);
    assert.strictEqual(result.data.events.length, 4);
    assert.strictEqual(result.data.highImpactEvents.length, 2);
    assert.strictEqual(result.data.bankHolidays.length, 2);

    const cpi = result.data.highImpactEvents.find(event => event.title === "CPI y/y");
    assert(cpi);
    assert.strictEqual(cpi.currency, "GBP");
    assert.strictEqual(cpi.scheduledAt, "2026-08-19T06:00:00.000Z");
    assert.strictEqual(cpi.localDate, "2026-08-19");
    assert.strictEqual(cpi.sourceTimezone, "-04:00");
    assert.strictEqual(cpi.release.forecast, "2.9%");
    assert.strictEqual(cpi.release.previous, "2.6%");
    assert.strictEqual(cpi.release.actual, null);

    const holiday = result.data.bankHolidays.find(event => event.currency === "USD");
    assert(holiday);
    assert.strictEqual(holiday.allDay, true);
    assert.strictEqual(holiday.isBankHoliday, true);
    assert.strictEqual(holiday.category, "bank_holiday");

    assert.strictEqual(result.sourceReferences[0], sourceReference);
    assert.strictEqual(result.executionMetadata.providerIndependent, true);

    console.log("Market Calendar Capability deterministic tests passed");
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});

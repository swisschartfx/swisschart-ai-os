const assert = require("assert");
const ForexFactoryCalendarService = require("./forexFactoryCalendarService");

(async () => {
    let calls = 0;
    let now = new Date("2026-08-17T12:00:00.000Z");
    const service = new ForexFactoryCalendarService({
        clock: () => now,
        fetch: async () => {
            calls += 1;
            return {
                ok: true,
                status: 200,
                async json() {
                    return [{
                        title: "CPI y/y",
                        country: "GBP",
                        date: "2026-08-19T02:00:00-04:00",
                        impact: "High",
                        forecast: "2.9%",
                        previous: "2.6%"
                    }];
                }
            };
        }
    });

    const first = await service.getWeeklyCalendar();
    const second = await service.getWeeklyCalendar();
    assert.strictEqual(calls, 1);
    assert.strictEqual(first, second);
    assert.strictEqual(first.events.length, 1);

    now = new Date("2026-08-17T12:06:00.000Z");
    await service.getWeeklyCalendar();
    assert.strictEqual(calls, 2);

    const malformed = new ForexFactoryCalendarService({
        fetch: async () => ({
            ok: true,
            status: 200,
            async json() { return { events: [] }; }
        })
    });
    await assert.rejects(
        () => malformed.getWeeklyCalendar(),
        error => error.code === "FOREX_FACTORY_INVALID_PAYLOAD"
    );

    console.log("Forex Factory Calendar Service deterministic tests passed");
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});

const assert = require("assert");
const {
    PeriodResolver, BUSINESS_TIMEZONE, PRESETS, resolveLocalDateTime,
    validateNormalizedPeriod, resolvePeriodInput
} = require("./periodContract");

function run() {
    const resolver = new PeriodResolver({
        clock: () => new Date("2026-08-14T02:30:00.000Z")
    });
    const expected = {
        today: ["2026-08-13", "2026-08-14"],
        yesterday: ["2026-08-12", "2026-08-13"],
        this_week: ["2026-08-10", "2026-08-14"],
        last_week: ["2026-08-03", "2026-08-10"],
        this_month: ["2026-08-01", "2026-08-14"],
        last_month: ["2026-07-01", "2026-08-01"],
        last_30_days: ["2026-07-15", "2026-08-14"],
        last_3_months: ["2026-05-13", "2026-08-14"],
        year_to_date: ["2026-01-01", "2026-08-14"]
    };
    for (const preset of PRESETS.filter((value) =>
        !["all", "explicit"].includes(value))) {
        const period = resolver.resolve(input(preset));
        assert.deepStrictEqual([period.startLocalDate, period.endLocalDateExclusive],
            expected[preset]);
        assert.strictEqual(period.timezone, BUSINESS_TIMEZONE);
        assert.strictEqual(period.resolvedAt, "2026-08-14T02:30:00.000Z");
    }
    const all = resolver.resolve(input("all"));
    assert.deepStrictEqual(all, {
        preset: "all",
        unbounded: true,
        timezone: BUSINESS_TIMEZONE,
        resolvedAt: "2026-08-14T02:30:00.000Z",
        contractVersion: "1.0"
    });
    assert.strictEqual(Object.hasOwn(all, "startLocalDate"), false);
    assert.strictEqual(Object.hasOwn(all, "endLocalDateExclusive"), false);
    assert.strictEqual(validateNormalizedPeriod(all), all);
    assert.strictEqual(resolvePeriodInput(all), all);
    const explicit = resolver.resolve(input("explicit", {
        startDate: "2026-08-01", endDate: "2026-08-14"
    }));
    assert.strictEqual(explicit.endLocalDateExclusive, "2026-08-15");
    assert.strictEqual(explicit.startInstant, "2026-08-01T04:00:00.000Z");

    const newYear = new PeriodResolver({
        clock: () => new Date("2027-01-01T04:30:00.000Z")
    }).resolve(input("today"));
    assert.strictEqual(newYear.startLocalDate, "2026-12-31");

    const spring = new PeriodResolver({
        clock: () => new Date("2026-03-08T16:00:00.000Z")
    }).resolve(input("today"));
    assert.strictEqual(spring.startInstant, "2026-03-08T05:00:00.000Z");
    assert.strictEqual(spring.endInstantExclusive, "2026-03-09T04:00:00.000Z");
    assert.throws(() => resolveLocalDateTime({
        date: "2026-03-08", time: "02:30", timezone: BUSINESS_TIMEZONE
    }), (error) => error.code === "LOCAL_TIME_NONEXISTENT");

    assert.throws(() => resolveLocalDateTime({
        date: "2026-11-01", time: "01:30", timezone: BUSINESS_TIMEZONE
    }), (error) => error.code === "LOCAL_TIME_AMBIGUOUS");
    assert.strictEqual(resolveLocalDateTime({ date: "2026-11-01", time: "01:30",
        timezone: BUSINESS_TIMEZONE, disambiguation: "earlier" }),
    "2026-11-01T05:30:00.000Z");
    assert.strictEqual(resolveLocalDateTime({ date: "2026-11-01", time: "01:30",
        timezone: BUSINESS_TIMEZONE, disambiguation: "later" }),
    "2026-11-01T06:30:00.000Z");

    for (const invalid of [
        input("explicit", { startDate: "2026-02-30", endDate: "2026-03-01" }),
        input("explicit", { startDate: "2026-08-14", endDate: "2026-08-01" }),
        input("explicit", { startDate: "2024-01-01", endDate: "2026-08-14" }),
        input("all", { startDate: "2026-08-01" }),
        { contractVersion: "1.0", preset: "today", timezone: "UTC" }
    ]) assert.throws(() => resolver.resolve(invalid));

    console.log("New York Period Contract tests passed");
}

function input(preset, extra = {}) {
    return { contractVersion: "1.0", preset, timezone: BUSINESS_TIMEZONE, ...extra };
}
run();

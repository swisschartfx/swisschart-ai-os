const assert = require("assert");
const ScheduleOccurrenceResolver = require("../../02_Core/Time/scheduleOccurrenceResolver");
const { normalizeSchedule } = require("./scheduleContract");

function schedule(overrides = {}) {
    const trigger = overrides.trigger || { type: "local_time", localTime: "08:00",
        timezone: "Europe/London", offsetMinutes: 0, disambiguation: "reject" };
    return normalizeSchedule({ scheduleId: overrides.scheduleId || "dst-test",
        name: "DST test", enabled: true, weekdays: overrides.weekdays || [1,2,3,4,5,6,7],
        trigger, publication: { destination: "telegram.primary",
            template: { templateId: "test", revision: 1, content: "Test" },
            displayTimezone: "America/New_York", rendererVersion: "1.0" },
        executionPolicy: { misfireMode: "skip_and_record", misfireGraceSeconds: 60,
            holidayPolicy: "none" } });
}

const resolver = new ScheduleOccurrenceResolver();
assert.strictEqual(resolver.resolve(schedule(), "2026-01-15").resolvedInstant,
    "2026-01-15T08:00:00Z");
assert.strictEqual(resolver.resolve(schedule(), "2026-07-15").resolvedInstant,
    "2026-07-15T07:00:00Z");
const ny = schedule({ trigger: { type: "local_time", localTime: "08:00",
    timezone: "America/New_York", offsetMinutes: 0, disambiguation: "reject" } });
assert.strictEqual(resolver.resolve(ny, "2026-01-15").resolvedInstant,
    "2026-01-15T13:00:00Z");
assert.strictEqual(resolver.resolve(ny, "2026-07-15").resolvedInstant,
    "2026-07-15T12:00:00Z");
assert.strictEqual(resolver.resolve(schedule(), "2026-03-16").resolvedInstant,
    "2026-03-16T08:00:00Z");
assert.strictEqual(resolver.resolve(ny, "2026-03-16").resolvedInstant,
    "2026-03-16T12:00:00Z");
assert.strictEqual(resolver.resolve(schedule(), "2026-10-26").resolvedInstant,
    "2026-10-26T08:00:00Z");
assert.strictEqual(resolver.resolve(ny, "2026-10-26").resolvedInstant,
    "2026-10-26T12:00:00Z");

const nonexistent = schedule({ trigger: { type: "local_time", localTime: "02:30",
    timezone: "America/New_York", offsetMinutes: 0, disambiguation: "reject" } });
assert.throws(() => resolver.resolve(nonexistent, "2026-03-08"),
    error => error.code === "SCHEDULE_LOCAL_TIME_NONEXISTENT");
const ambiguous = schedule({ trigger: { type: "local_time", localTime: "01:30",
    timezone: "America/New_York", offsetMinutes: 0, disambiguation: "reject" } });
assert.throws(() => resolver.resolve(ambiguous, "2026-11-01"),
    error => error.code === "SCHEDULE_LOCAL_TIME_AMBIGUOUS");
const earlier = schedule({ trigger: { ...ambiguous.trigger, disambiguation: "earlier" } });
const later = schedule({ trigger: { ...ambiguous.trigger, disambiguation: "later" } });
assert.strictEqual(resolver.resolve(earlier, "2026-11-01").resolvedInstant,
    "2026-11-01T05:30:00Z");
assert.strictEqual(resolver.resolve(later, "2026-11-01").resolvedInstant,
    "2026-11-01T06:30:00Z");
assert.deepStrictEqual(resolver.resolve(schedule(), "2026-01-15").display,
    { timezone: "America/New_York", localDate: "2026-01-15", localTime: "03:00",
        offset: "-05:00", instant: "2026-01-15T08:00:00Z" });
const relative = schedule({ trigger: { type: "session_relative", session: "london",
    boundary: "open", authoritativeLocalTime: "08:00", timezone: "Europe/London",
    offsetMinutes: -60, disambiguation: "reject" } });
assert.strictEqual(resolver.resolve(relative, "2026-07-15").resolvedInstant,
    "2026-07-15T06:00:00Z");
const weekdayOnly = schedule({ weekdays: [1,2,3,4,5] });
assert.strictEqual(resolver.resolve(weekdayOnly, "2026-08-15"), null);
assert(resolver.resolve(weekdayOnly, "2026-08-17"));
console.log("Schedule IANA/DST occurrence resolver tests passed");

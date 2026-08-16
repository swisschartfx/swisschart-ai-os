const assert = require("assert");

const {
    createMarketSessionSchedules
} = require("./marketSessionSchedules");

const ScheduleOccurrenceResolver = require("./scheduleOccurrenceResolver");

const resolver = new ScheduleOccurrenceResolver();
const schedules = createMarketSessionSchedules();

assert.strictEqual(schedules.length, 5);

for (const schedule of schedules) {
    assert.deepStrictEqual(schedule.weekdays, [1, 2, 3, 4, 5]);
    assert.strictEqual(schedule.enabled, false);
    assert.strictEqual(
        schedule.publication.displayTimezone,
        "America/New_York"
    );
    assert(
        schedule.publication.template.content.includes(
            '<a href="https://linktr.ee/swisschart">Swisschart Links</a>'
        )
    );
}

function byId(id) {
    const schedule = schedules.find(item => item.scheduleId === id);
    assert(schedule, `Missing schedule ${id}`);
    return schedule;
}

// London Open -60m
const londonPreOpen60 = byId("market.london.preopen_60m");

// Winter
let occurrence = resolver.resolve(londonPreOpen60, "2026-01-15");
assert.strictEqual(occurrence.display.localTime, "02:00");

// Summer
occurrence = resolver.resolve(londonPreOpen60, "2026-07-15");
assert.strictEqual(occurrence.display.localTime, "02:00");

// US DST active, UK not yet active
occurrence = resolver.resolve(londonPreOpen60, "2026-03-16");
assert.strictEqual(occurrence.display.localTime, "03:00");

// UK back to GMT, US still DST
occurrence = resolver.resolve(londonPreOpen60, "2026-10-26");
assert.strictEqual(occurrence.display.localTime, "03:00");

// London Open -5m
const londonPreOpen5 = byId("market.london.preopen_5m");

occurrence = resolver.resolve(londonPreOpen5, "2026-07-15");
assert.strictEqual(occurrence.display.localTime, "02:55");

// London Close -5m
const londonPreClose5 = byId("market.london.preclose_5m");

occurrence = resolver.resolve(londonPreClose5, "2026-07-15");
assert.strictEqual(occurrence.display.localTime, "11:55");

// New York Open -5m
const nyPreOpen5 = byId("market.newyork.preopen_5m");

occurrence = resolver.resolve(nyPreOpen5, "2026-01-15");
assert.strictEqual(occurrence.display.localTime, "07:55");

occurrence = resolver.resolve(nyPreOpen5, "2026-07-15");
assert.strictEqual(occurrence.display.localTime, "07:55");

// New York Close -5m / End of Day
const nyPreClose5 = byId("market.newyork.preclose_5m");

occurrence = resolver.resolve(nyPreClose5, "2026-01-15");
assert.strictEqual(occurrence.display.localTime, "16:55");

occurrence = resolver.resolve(nyPreClose5, "2026-07-15");
assert.strictEqual(occurrence.display.localTime, "16:55");

assert(
    nyPreClose5.publication.template.content.includes(
        "Swisschart channel activity is now concluded for today"
    )
);

// Weekend exclusion
for (const schedule of schedules) {
    assert.strictEqual(
        resolver.resolve(schedule, "2026-08-15"),
        null
    );

    assert.strictEqual(
        resolver.resolve(schedule, "2026-08-16"),
        null
    );
}

// Monday resumes
for (const schedule of schedules) {
    assert(
        resolver.resolve(schedule, "2026-08-17")
    );
}

console.log("Market session schedule timezone/DST tests passed");
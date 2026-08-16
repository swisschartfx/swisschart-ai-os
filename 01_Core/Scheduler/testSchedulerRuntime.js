const assert = require("assert");

const SchedulerRuntime = require("./schedulerRuntime");

async function run() {
    const dueAt = new Date("2026-08-12T10:00:00.000Z");
    const calls = { ingest: 0, evaluate: 0 };
    let intervalCallback = null;
    let clearedTimer = null;

    const eventEngine = {
        async ingest(candidate) {
            calls.ingest += 1;
            assert.strictEqual(candidate.eventType, "scheduled");
            assert.strictEqual(candidate.deduplicationKey,
                `scheduler:daily-evaluation:${dueAt.toISOString()}`);
            return { event: { eventId: "event-1" } };
        },
        async evaluate(eventId, now) {
            calls.evaluate += 1;
            assert.strictEqual(eventId, "event-1");
            assert.strictEqual(now.toISOString(), "2026-08-12T10:01:00.000Z");
            return { event: { eventId } };
        }
    };

    const runtime = new SchedulerRuntime({
        eventEngine,
        intervalMs: 5000,
        clock: () => new Date("2026-08-12T10:01:00.000Z"),
        getScheduledEvents: () => [{
            name: "daily-evaluation",
            executeAt: dueAt,
            timezone: "UTC"
        }],
        setInterval(callback, intervalMs) {
            assert.strictEqual(intervalMs, 5000);
            intervalCallback = callback;
            return { id: "timer-1" };
        },
        clearInterval(timer) {
            clearedTimer = timer;
        }
    });

    assert.strictEqual(runtime.start(), true);
    assert.strictEqual(runtime.isRunning(), true);
    assert.strictEqual(typeof intervalCallback, "function");

    await runtime.tick();
    assert.strictEqual(calls.ingest, 1);
    assert.strictEqual(calls.evaluate, 1);

    await runtime.tick();
    assert.strictEqual(calls.ingest, 1);
    assert.strictEqual(calls.evaluate, 1);

    assert.strictEqual(runtime.stop(), true);
    assert.strictEqual(runtime.isRunning(), false);
    assert.deepStrictEqual(clearedTimer, { id: "timer-1" });

    console.log("Scheduler runtime mock test passed");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});

const assert = require("assert");
const fs = require("fs"), os = require("os"), path = require("path");
const AutomationManager = require("../Automation_Manager/automationManager");
const SqliteAutomationStore = require("../Automation_Manager/sqliteAutomationStore");
const ScheduleOccurrenceResolver = require("../../02_Core/Time/scheduleOccurrenceResolver");
const AutomationSchedulerBridge = require("./automationSchedulerBridge");
const SchedulerRuntime = require("./schedulerRuntime");
const TaskEngine = require("../Task_Engine/02_taskEngine");
const PublishingAgentExecutor = require("../Task_Engine/05_publishingAgentExecutor");

function definition(id, options = {}) {
    return { scheduleId: id, name: id, enabled: options.enabled !== false,
        weekdays: options.weekdays || [1,2,3,4,5], priority: options.priority || 100,
        trigger: { type: options.type || "local_time",
            ...(options.type === "session_relative" ? { session: "new_york", boundary: "open",
                authoritativeLocalTime: options.time || "08:00" } : { localTime: options.time || "08:00" }),
            timezone: options.timezone || "America/New_York",
            offsetMinutes: options.offsetMinutes || 0, disambiguation: "reject" },
        publication: { destination: "telegram.primary",
            template: { templateId: `${id}-template`, revision: 1, content: `Message ${id}` },
            displayTimezone: "America/New_York", rendererVersion: "1.0" },
        executionPolicy: { misfireMode: "skip_and_record",
            misfireGraceSeconds: options.grace === undefined ? 60 : options.grace,
            holidayPolicy: "none" } };
}
function approve(manager, value) {
    const prepared = manager.prepareScheduleCreate(value);
    return manager.approveScheduleMutation({ approvalId: prepared.approvalId,
        payloadHash: prepared.payloadHash, confirm: true }).schedule;
}
function taskRequest(event) {
    const payload = event.metadata.taskPayload;
    return { source: "event", sourceReference: event.reference,
        createdBy: "scheduler-runtime", intent: payload.intent,
        objective: payload.objective, capabilityRequirement: payload.capabilityRequirement,
        input: payload.input, contextReferences: [event.reference], priority: "normal",
        approval: { required: false, status: "approved",
            reason: "Approved schedule revision" },
        authorization: event.metadata.approvedScheduleGrant,
        idempotencyKey: `scheduled:${event.metadata.occurrenceKey}` };
}

(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "swisschart-durable-schedule-"));
    const dbPath = path.join(dir, "schedule.sqlite");
    const clock = () => new Date("2026-01-05T13:00:30.000Z");
    let store = new SqliteAutomationStore({ databasePath: dbPath, clock });
    const manager = new AutomationManager({ automationStore: null,
        scheduleStore: store, clock });
    const resolver = new ScheduleOccurrenceResolver();
    approve(manager, definition("schedule-a"));
    approve(manager, definition("schedule-b", { priority: 200 }));
    approve(manager, definition("disabled", { enabled: false }));
    const bridge = new AutomationSchedulerBridge({ automationManager: manager,
        occurrenceStore: store, occurrenceResolver: resolver, clock, lookbackMs: 300000 });
    const events = bridge.getScheduledEvents().filter(event =>
        Date.parse(event.executeAt) <= clock().getTime());
    assert.deepStrictEqual(events.map(event => event.name), ["schedule-a", "schedule-b"]);
    assert.strictEqual(events[0].metadata.approvedScheduleGrant.approvalBasis,
        "approved_schedule_revision");

    const secondStore = new SqliteAutomationStore({ databasePath: dbPath, clock });
    const key = events[0].metadata.occurrenceKey;
    assert.strictEqual(secondStore.getOccurrence(key).state, "planned");
    assert.strictEqual(store.claimOccurrence(key, clock().toISOString()).claimed, true);
    assert.strictEqual(secondStore.claimOccurrence(key, clock().toISOString()).claimed, false);
    assert.strictEqual(store.recoverClaimedBeforePublishing(clock().toISOString()), 1);
    assert.strictEqual(secondStore.claimOccurrence(key, clock().toISOString()).claimed, true);
    secondStore.transitionOccurrence(key, "publishing", {}, clock().toISOString());
    secondStore.close();
    const restarted = new SqliteAutomationStore({ databasePath: dbPath, clock });
    restarted.recoverInterruptedPublishing(clock().toISOString());
    assert.strictEqual(restarted.getOccurrence(key).state, "delivery_uncertain");
    restarted.transitionOccurrence(key, "completed", { messageId: 101 }, clock().toISOString());
    restarted.close();
    const completedRestart = new SqliteAutomationStore({ databasePath: dbPath, clock });
    assert.strictEqual(completedRestart.getOccurrence(key).state, "completed");

    const runtimeEvents = events.slice(1);
    let handled = 0;
    const runtime = new SchedulerRuntime({ eventEngine: { ingest() {}, evaluate() {} },
        getScheduledEvents: () => runtimeEvents, occurrenceStore: completedRestart,
        clock, eventAdapter: { adapt: value => value }, eventHandler: {
            async handle() { handled += 1; return { ok: true }; }
        } });
    await runtime.tick(); await runtime.tick();
    assert.strictEqual(handled, 1);

    const lateClock = () => new Date("2026-01-05T13:02:00.000Z");
    approve(manager, definition("misfire", { grace: 30 }));
    const lateBridge = new AutomationSchedulerBridge({ automationManager: manager,
        occurrenceStore: completedRestart, occurrenceResolver: resolver,
        clock: lateClock, lookbackMs: 300000 });
    lateBridge.getScheduledEvents();
    assert.strictEqual(completedRestart.listOccurrences({ scheduleId: "misfire" })[0].state,
        "skipped");

    approve(manager, definition("suppressed"));
    const suppressedBridge = new AutomationSchedulerBridge({ automationManager: manager,
        occurrenceStore: completedRestart, occurrenceResolver: resolver, clock,
        suppressionPolicy: { evaluate({ schedule }) { return schedule.scheduleId === "suppressed"
            ? { suppressed: true, reason: "mock_holiday", reference: "calendar-test" }
            : { suppressed: false }; } } });
    suppressedBridge.getScheduledEvents();
    assert.strictEqual(completedRestart.listOccurrences({ scheduleId: "suppressed" })[0].state,
        "suppressed");

    approve(manager, definition("publish-once"));
    const publishBridge = new AutomationSchedulerBridge({ automationManager: manager,
        occurrenceStore: completedRestart, occurrenceResolver: resolver, clock });
    const publishEvent = publishBridge.getScheduledEvents()
        .find(event => event.name === "publish-once");
    assert(publishEvent);
    assert.strictEqual(completedRestart.claimOccurrence(
        publishEvent.metadata.occurrenceKey, clock().toISOString()).claimed, true);
    let sends = 0;
    const executor = new PublishingAgentExecutor({ publisherFactory: () => ({
        async publishContent() { sends += 1; return { message_id: 777,
            chat: { id: "test-chat" } }; }
    }) });
    const engine = new TaskEngine({ scheduleAuthorizationStore: completedRestart,
        executors: { "publishing-agent": executor }, clock });
    const execution = await engine.execute(taskRequest(publishEvent));
    assert.strictEqual(execution.result.status, "completed");
    assert.strictEqual(sends, 1);
    assert.strictEqual(Number(completedRestart.getOccurrence(
        publishEvent.metadata.occurrenceKey).messageId), 777);
    await assert.rejects(() => engine.execute(taskRequest(publishEvent)),
        error => error.code === "SCHEDULE_EXECUTION_NOT_AUTHORIZED");
    assert.strictEqual(sends, 1);

    approve(manager, definition("stale"));
    const staleBridge = new AutomationSchedulerBridge({ automationManager: manager,
        occurrenceStore: completedRestart, occurrenceResolver: resolver, clock });
    const staleEvent = staleBridge.getScheduledEvents().find(event => event.name === "stale");
    completedRestart.claimOccurrence(staleEvent.metadata.occurrenceKey, clock().toISOString());
    const update = manager.prepareScheduleUpdate("stale", 1, { trigger: { localTime: "09:00" } });
    manager.approveScheduleMutation({ approvalId: update.approvalId,
        payloadHash: update.payloadHash, confirm: true });
    await assert.rejects(() => engine.execute(taskRequest(staleEvent)),
        error => error.code === "SCHEDULE_EXECUTION_NOT_AUTHORIZED");

    const deletion = manager.prepareScheduleDelete("schedule-b", 1);
    manager.approveScheduleMutation({ approvalId: deletion.approvalId,
        payloadHash: deletion.payloadHash, confirm: true });
    assert(!new AutomationSchedulerBridge({ automationManager: manager,
        occurrenceStore: completedRestart, occurrenceResolver: resolver, clock })
        .getScheduledEvents().some(event => event.name === "schedule-b"));

    completedRestart.close(); store.close(); fs.rmSync(dir, { recursive: true, force: true });
    console.log("Durable schedule claims, restart, recovery, suppression, Task authorization, and Publishing Agent tests passed");
})().catch(error => { console.error(error); process.exitCode = 1; });

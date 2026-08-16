const assert = require("assert");
const fs = require("fs"), os = require("os"), path = require("path");
const AutomationManager = require("./automationManager");
const SqliteAutomationStore = require("./sqliteAutomationStore");
const ScheduleManagementCapability = require("../../02_Core/Capabilities/scheduleManagementCapability");
const CapabilityRegistry = require("../../02_Core/Capabilities/capabilityRegistry");
const CapabilityGateway = require("../../02_Core/Capabilities/capabilityGateway");
const { createCloudComposition } = require("../Cloud/cloudComposition");
const { McpEdge } = require("../Cloud/mcpEdge");

function candidate(id = "weekday-message", weekdays = [1,2,3,4,5]) {
    return { scheduleId: id, name: id, enabled: true, weekdays,
        trigger: { type: "local_time", localTime: "10:00",
            timezone: "America/New_York", offsetMinutes: 0, disambiguation: "reject" },
        publication: { destination: "telegram.primary",
            template: { templateId: `${id}-template`, revision: 1, content: "Founder text" },
            displayTimezone: "America/New_York", rendererVersion: "1.0" },
        executionPolicy: { misfireMode: "skip_and_record", misfireGraceSeconds: 60,
            holidayPolicy: "none" } };
}
function managerAt(dbPath) {
    const store = new SqliteAutomationStore({ databasePath: dbPath,
        clock: () => new Date("2026-08-16T12:00:00Z") });
    return { store, manager: new AutomationManager({ automationStore: null,
        scheduleStore: store, clock: () => new Date("2026-08-16T12:00:00Z") }) };
}
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "swisschart-schedules-"));
const dbPath = path.join(dir, "schedules.sqlite");
let { store, manager } = managerAt(dbPath);
const prepared = manager.prepareScheduleCreate(candidate());
assert.strictEqual(prepared.status, "pending_approval");
assert.strictEqual(manager.listSchedules().length, 0);
assert.throws(() => manager.approveScheduleMutation({ approvalId: prepared.approvalId,
    payloadHash: "0".repeat(64), confirm: true }),
error => error.code === "SCHEDULE_PAYLOAD_HASH_MISMATCH");
assert.throws(() => manager.approveScheduleMutation({ approvalId: prepared.approvalId,
    payloadHash: prepared.payloadHash, confirm: false }),
error => error.code === "SCHEDULE_EXPLICIT_APPROVAL_REQUIRED");
assert.throws(() => manager.approveScheduleMutation({ approvalId: prepared.approvalId,
    payloadHash: prepared.payloadHash, confirm: true }, "update"),
error => error.code === "SCHEDULE_APPROVAL_OPERATION_MISMATCH");
const created = manager.approveScheduleMutation({ approvalId: prepared.approvalId,
    payloadHash: prepared.payloadHash, confirm: true });
assert.strictEqual(created.schedule.revision, 1);
assert.deepStrictEqual(created.schedule.weekdays, [1,2,3,4,5]);
const replay = manager.approveScheduleMutation({ approvalId: prepared.approvalId,
    payloadHash: prepared.payloadHash, confirm: true });
assert.strictEqual(replay.replayed, true);
assert.strictEqual(manager.listSchedules().length, 1);
assert.strictEqual(manager.inspectSchedule("weekday-message").schedule.revision, 1);

const disable = manager.prepareScheduleUpdate("weekday-message", 1, { enabled: false });
assert.throws(() => manager.prepareScheduleUpdate("weekday-message", 2, { enabled: false }),
    error => error.code === "SCHEDULE_STALE_REVISION");
const disabled = manager.approveScheduleMutation({ approvalId: disable.approvalId,
    payloadHash: disable.payloadHash, confirm: true });
assert.strictEqual(disabled.schedule.enabled, false);
assert.strictEqual(disabled.schedule.revision, 2);
const enable = manager.prepareScheduleUpdate("weekday-message", 2, { enabled: true,
    trigger: { localTime: "11:00" }, publication: { template: { revision: 2,
        content: "Changed Founder text" } } });
manager.approveScheduleMutation({ approvalId: enable.approvalId,
    payloadHash: enable.payloadHash, confirm: true });
assert.strictEqual(manager.inspectSchedule("weekday-message").schedule.trigger.localTime, "11:00");

const weekendPrepared = manager.prepareScheduleCreate(candidate("saturday-message", [6]));
manager.approveScheduleMutation({ approvalId: weekendPrepared.approvalId,
    payloadHash: weekendPrepared.payloadHash, confirm: true });
assert.strictEqual(manager.listSchedules({ weekday: 6 }).length, 1);
const deletion = manager.prepareScheduleDelete("saturday-message", 1);
manager.approveScheduleMutation({ approvalId: deletion.approvalId,
    payloadHash: deletion.payloadHash, confirm: true });
assert.strictEqual(manager.listSchedules({ enabled: true }).length, 1);
assert.strictEqual(manager.inspectSchedule("saturday-message").schedule.tombstoned, true);
store.close();
({ store, manager } = managerAt(dbPath));
assert.strictEqual(manager.inspectSchedule("weekday-message").schedule.revision, 3);

const capability = new ScheduleManagementCapability({ automationManager: manager });
const gateway = new CapabilityGateway({ registry: new CapabilityRegistry([capability]) });
(async () => {
    const result = await gateway.execute({ requestId: "schedule-list", capability: "schedule.management",
        operation: "schedule.list", input: {}, context: {}, constraints: {}, metadata: {},
        requestedBy: "founder", source: "test", inputContractVersion: "1.0",
        timestamp: "2026-08-16T12:00:00.000Z" });
    assert.strictEqual(result.status, "completed");
    assert.strictEqual(result.data.schedules.length, 1);
    const prepareViaGateway = await gateway.execute({ requestId: "schedule-prepare", capability: "schedule.management",
        operation: "schedule.create.prepare", input: { schedule: candidate("gateway-created") },
        context: {}, constraints: {}, metadata: {}, requestedBy: "founder", source: "test",
        inputContractVersion: "1.0", timestamp: "2026-08-16T12:00:00.000Z" });
    assert.strictEqual(prepareViaGateway.status, "completed");
    const deniedApproval = await gateway.execute({ requestId: "schedule-denied", capability: "schedule.management",
        operation: "schedule.create.approve", input: { approvalId: prepareViaGateway.data.approvalId,
            payloadHash: prepareViaGateway.data.payloadHash, confirm: true }, context: {}, constraints: {},
        metadata: {}, requestedBy: "founder", source: "test", inputContractVersion: "1.0",
        timestamp: "2026-08-16T12:00:00.000Z" });
    assert.strictEqual(deniedApproval.code, "CAPABILITY_MUTATION_AUTHORITY_REQUIRED");
    const approvedViaGateway = await gateway.execute({ requestId: "schedule-approved", capability: "schedule.management",
        operation: "schedule.create.approve", input: { approvalId: prepareViaGateway.data.approvalId,
            payloadHash: prepareViaGateway.data.payloadHash, confirm: true }, context: { approvalVerified: true,
            payloadHash: prepareViaGateway.data.payloadHash, idempotencyKey: prepareViaGateway.data.approvalId },
        constraints: { approvedMutation: true }, metadata: {}, requestedBy: "founder", source: "test",
        inputContractVersion: "1.0", timestamp: "2026-08-16T12:00:00.000Z" });
    assert.strictEqual(approvedViaGateway.status, "completed");
    const composition = createCloudComposition({ scheduleManagementCapability: capability });
    const edge = new McpEdge({ assistant: composition.assistant,
        bearerToken: "x".repeat(32) });
    const rpc = await edge.handleRpc({ jsonrpc: "2.0", id: 1, method: "tools/call",
        params: { name: "swisschart.query", arguments: { requestType: "schedule_list" } } },
    "mcp-schedule-list");
    assert.strictEqual(rpc.result.isError, false);
    assert.strictEqual(JSON.parse(rpc.result.content[0].text).data.schedules.length, 2);
    const localDb = path.join(dir, "composed.sqlite");
    const localComposition = createCloudComposition({ scheduleDatabasePath: localDb,
        tradingDataCapability: { name: "trading.data", declaration: require("../../02_Core/Capabilities/capabilityContract").createCapabilityDeclaration({ capabilityId: "trading.data", domain: "test", version: "1.0.0", supportedOperations: ["trading.performance.summary", "trading.records.query", "trading.schema.get", "trading.trade_reference.resolve"], executionMode: "synchronous", behavior: "read_only", approvalRequirement: "none", lifecycleSupport: ["collect"], inputContractVersion: "1.0", outputContractVersion: "1.0" }), async execute() { return { data: {}, summary: "mock" }; } } });
    assert(localComposition.capabilityRegistry.has("schedule.management"));
    assert.strictEqual(localComposition.schedulerRuntime, null);
    localComposition.scheduleStore.close();
    store.close(); fs.rmSync(dir, { recursive: true, force: true });
    console.log("Schedule management, SQLite, approval, CRUD, replay, and Gateway tests passed");
})().catch(error => { console.error(error); process.exitCode = 1; });

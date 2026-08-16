const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const AutomationManager = require("./automationManager");
const SqliteAutomationStore = require("./sqliteAutomationStore");
const ScheduleManagementCapability = require(
    "../../02_Core/Capabilities/scheduleManagementCapability"
);
const CapabilityRegistry = require(
    "../../02_Core/Capabilities/capabilityRegistry"
);
const CapabilityGateway = require(
    "../../02_Core/Capabilities/capabilityGateway"
);

const {
    createMarketSessionSchedules
} = require("../../02_Core/Time/marketSessionSchedules");

const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), "swisschart-market-session-")
);

const dbPath = path.join(dir, "market-session.sqlite");

const store = new SqliteAutomationStore({
    databasePath: dbPath
});

const manager = new AutomationManager({
    automationStore: null,
    scheduleStore: store,
    clock: () => new Date("2026-08-16T12:00:00.000Z")
});

const capability = new ScheduleManagementCapability({
    automationManager: manager
});

const gateway = new CapabilityGateway({
    registry: new CapabilityRegistry([capability])
});

function request({
    requestId,
    operation,
    input,
    context = {},
    constraints = {}
}) {
    return gateway.execute({
        requestId,
        capability: "schedule.management",
        operation,
        input,
        context,
        constraints,
        metadata: {
            transport: "local-market-session-test"
        },
        requestedBy: "founder",
        source: "local-test",
        inputContractVersion: "1.0",
        timestamp: "2026-08-16T12:00:00.000Z"
    });
}

(async () => {
    const schedules = createMarketSessionSchedules();

    assert.strictEqual(schedules.length, 5);

    for (const schedule of schedules) {
        const prepared = await request({
            requestId: `prepare-${schedule.scheduleId}`,
            operation: "schedule.create.prepare",
            input: {
                schedule
            }
        });

        assert.strictEqual(prepared.status, "completed");
        assert.strictEqual(prepared.data.approvalRequired, true);

        const approved = await request({
            requestId: `approve-${schedule.scheduleId}`,
            operation: "schedule.create.approve",
            input: {
                approvalId: prepared.data.approvalId,
                payloadHash: prepared.data.payloadHash,
                confirm: true
            },
            context: {
                authenticatedFounder: true,
                approvalVerified: true,
                payloadHash: prepared.data.payloadHash,
                idempotencyKey: prepared.data.approvalId
            },
            constraints: {
                approvedMutation: true,
                schedulerActivationAllowed: false
            }
        });

        assert.strictEqual(approved.status, "completed");
        assert.strictEqual(approved.data.schedule.enabled, false);
    }

    const listed = await request({
        requestId: "list-market-sessions",
        operation: "schedule.list",
        input: {}
    });

    assert.strictEqual(listed.status, "completed");
    assert.strictEqual(listed.data.schedules.length, 5);

    for (const schedule of listed.data.schedules) {
        assert.strictEqual(schedule.enabled, false);
        assert.deepStrictEqual(schedule.weekdays, [1, 2, 3, 4, 5]);
        assert.strictEqual(
            schedule.publication.displayTimezone,
            "America/New_York"
        );

        const inspected = await request({
            requestId: `inspect-${schedule.scheduleId}`,
            operation: "schedule.inspect",
            input: {
                scheduleId: schedule.scheduleId
            }
        });

        assert.strictEqual(inspected.status, "completed");
        assert.strictEqual(
            inspected.data.schedule.scheduleId,
            schedule.scheduleId
        );

        assert(
            Array.isArray(inspected.data.nextOccurrences)
        );
    }

    console.log("Market session Schedule Management integration tests passed");

    store.close();
    fs.rmSync(dir, {
        recursive: true,
        force: true
    });
})().catch(error => {
    try {
        store.close();
    } catch (_) {}

    fs.rmSync(dir, {
        recursive: true,
        force: true
    });

    console.error(error);
    process.exitCode = 1;
});
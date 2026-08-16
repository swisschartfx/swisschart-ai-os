const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const SignalActionStore = require("./signalActionStore");
const SignalMutationCoordinator = require("./signalMutationCoordinator");
const NotionSignalCapability = require("../../02_Core/Capabilities/notionSignalCapability");
const CapabilityRegistry = require("../../02_Core/Capabilities/capabilityRegistry");
const CapabilityGateway = require("../../02_Core/Capabilities/capabilityGateway");
const { createCapabilityRequest } = require("../../02_Core/Capabilities/capabilityContract");

async function run() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "swisschart-signal-"));
    const store = new SignalActionStore({ filePath: path.join(dir, "actions.json") });
    let calls = 0;
    const assistant = { async handle(request) { calls += 1; assert.strictEqual(request.context.approvalVerified, true); return { status: "completed", data: { tradeId: "SCT-M8-TEST", pageId: "page-test" } }; } };
    const clock = () => new Date("2026-08-14T16:00:00.000Z");
    const coordinator = new SignalMutationCoordinator({ assistant, store, clock });
    const signal = validSignal();
    assert.throws(() => coordinator.prepare({ signal: { pair: "EURUSD" } }), (e) => e.code === "SIGNAL_DRAFT_FIELDS_MISSING");
    const prepared = coordinator.prepare({ signal });
    assert.strictEqual(prepared.status, "pending_approval");
    assert.strictEqual(calls, 0);
    await assert.rejects(() => coordinator.approve({ approvalId: prepared.approvalId, payloadHash: "0".repeat(64), confirm: true }, "r1"), (e) => e.code === "SIGNAL_PAYLOAD_CHANGED_REAPPROVAL_REQUIRED");
    await assert.rejects(() => coordinator.approve({ approvalId: prepared.approvalId, payloadHash: prepared.payloadHash, confirm: false }, "r2"), (e) => e.code === "SIGNAL_EXPLICIT_APPROVAL_REQUIRED");
    const completed = await coordinator.approve({ approvalId: prepared.approvalId, payloadHash: prepared.payloadHash, confirm: true }, "r3");
    assert.strictEqual(completed.status, "completed"); assert.strictEqual(calls, 1);
    const replay = await coordinator.approve({ approvalId: prepared.approvalId, payloadHash: prepared.payloadHash, confirm: true }, "r4");
    assert.strictEqual(replay.replayed, true); assert.strictEqual(calls, 1);
    const restored = new SignalMutationCoordinator({ assistant, store, clock });
    const replayAfterRestart = await restored.approve({ approvalId: prepared.approvalId, payloadHash: prepared.payloadHash, confirm: true }, "r5");
    assert.strictEqual(replayAfterRestart.replayed, true); assert.strictEqual(calls, 1);

    let pages = 0; const records = [record("SCT-2646"), record("SCT-malformed"), record("TSC-2699")];
    const service = { async getAllDatabaseRecords() { return { records }; }, async createDatabasePage(value) { pages += 1; const id = `page-${pages}`; const title = value.properties["Trade ID"].title[0].text.content; records.push(record(title)); return { id }; } };
    const capability = new NotionSignalCapability({ databaseId: "db", service, clock });
    const gateway = new CapabilityGateway({ registry: new CapabilityRegistry([capability]), clock });
    const unauthorized = await gateway.execute(request(signal, {}));
    assert.strictEqual(unauthorized.code, "CAPABILITY_MUTATION_AUTHORITY_REQUIRED"); assert.strictEqual(pages, 0);
    const authorized = await gateway.execute(request(signal, { approvalVerified: true, payloadHash: prepared.payloadHash, idempotencyKey: prepared.payloadHash }));
    assert.strictEqual(authorized.status, "completed"); assert.strictEqual(pages, 1);
    assert.strictEqual(authorized.data.tradeId, "SCT-2647");
    const concurrentCapability = new NotionSignalCapability({ databaseId: "db", service, clock });
    const [firstConcurrent, secondConcurrent] = await Promise.all([
        concurrentCapability.execute(request(signal, { approvalVerified: true, payloadHash: "a".repeat(64), idempotencyKey: "a".repeat(64) })),
        concurrentCapability.execute(request(signal, { approvalVerified: true, payloadHash: "b".repeat(64), idempotencyKey: "b".repeat(64) }))
    ]);
    assert.deepStrictEqual([firstConcurrent.data.tradeId, secondConcurrent.data.tradeId], ["SCT-2648", "SCT-2649"]);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log("Signal mutation approval and idempotency tests passed");
}
function validSignal() { return { pair: "EURUSD", direction: "buy", entry: 1.1, stopLoss: 1.09, tp1: 1.11, tp2: 1.12, tp3: 1.13, risk: 0.5, grade: 3 }; }
function record(id) { return { properties: { "Trade ID": { title: [{ plain_text: id }] } } }; }
function request(draft, context) { return createCapabilityRequest({ requestId: "signal-test", capability: "signal.notion", operation: "signal.notion.create", input: { draft }, context, constraints: { approvedMutation: context.approvalVerified === true }, metadata: {}, requestedBy: "founder", source: "test", inputContractVersion: "1.0" }, { clock: () => new Date("2026-08-14T16:00:00.000Z") }); }
run().catch((error) => { console.error(error); process.exitCode = 1; });

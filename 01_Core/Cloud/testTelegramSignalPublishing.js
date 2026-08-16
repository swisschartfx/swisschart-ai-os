const assert = require("assert");
const fs = require("fs"); const os = require("os"); const path = require("path");
const SignalActionStore = require("./signalActionStore");
const TelegramPublishCoordinator = require("./telegramPublishCoordinator");
const TelegramSignalCapability = require("../../02_Core/Capabilities/telegramSignalCapability");

async function run() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "swisschart-telegram-"));
    const storePath = path.join(dir, "actions.json"); const order = []; let failSignalOnce = false;
    const assistant = { async handle(request) { order.push(request.input.messageRole); if (request.input.messageRole === "signal" && failSignalOnce) { failSignalOnce = false; throw Object.assign(new Error("mock"), { code: "MOCK_SIGNAL_FAILURE" }); } return { status: "completed", data: { messageId: order.length } }; } };
    const options = { assistant, store: new SignalActionStore({ filePath: storePath }), destinationId: "-100-private", clock: () => new Date("2026-08-15T12:00:00Z") };
    const coordinator = new TelegramPublishCoordinator(options);
    const prepared = coordinator.prepare({ signalReference: "SCT-2646", signal: signal() });
    assert.strictEqual(prepared.status, "pending_approval"); assert(prepared.riskManagementMessage.includes("Risk Reminder")); assert(prepared.signalMessage.includes("SCT-2646")); assert.deepStrictEqual(prepared.sendOrder, ["risk_management", "signal"]); assert.strictEqual(order.length, 0);
    await assert.rejects(() => coordinator.approve({ approvalId: prepared.approvalId, payloadHash: "0".repeat(64), confirm: true }, "1"), (error) => error.code === "TELEGRAM_PAYLOAD_CHANGED_REAPPROVAL_REQUIRED");
    const changedRisk = new TelegramPublishCoordinator({ ...options, store: new SignalActionStore({ filePath: path.join(dir, "risk.json") }), riskMessage: `${prepared.riskManagementMessage}!` }).prepare({ signalReference: "SCT-2646", signal: signal() });
    assert.notStrictEqual(changedRisk.payloadHash, prepared.payloadHash);
    const changedSignal = coordinator.prepare({ signalReference: "SCT-2646", signal: { ...signal(), tp3: 1.14 } }); assert.notStrictEqual(changedSignal.payloadHash, prepared.payloadHash);
    const changedDestination = new TelegramPublishCoordinator({ ...options, store: new SignalActionStore({ filePath: path.join(dir, "destination.json") }), destinationId: "-100-other" }).prepare({ signalReference: "SCT-2646", signal: signal() }); assert.notStrictEqual(changedDestination.payloadHash, prepared.payloadHash);
    const done = await coordinator.approve({ approvalId: prepared.approvalId, payloadHash: prepared.payloadHash, confirm: true }, "2"); assert.strictEqual(done.status, "completed"); assert.deepStrictEqual(order, ["risk_management", "signal"]);
    const replay = await coordinator.approve({ approvalId: prepared.approvalId, payloadHash: prepared.payloadHash, confirm: true }, "3"); assert.strictEqual(replay.replayed, true); assert.strictEqual(order.length, 2);
    const parallel = coordinator.prepare({ signalReference: "SCT-2646", signal: { ...signal(), tp2: 1.125 } }); const beforeParallel = order.length;
    const parallelResults = await Promise.all([coordinator.approve({ approvalId: parallel.approvalId, payloadHash: parallel.payloadHash, confirm: true }, "parallel-1"), coordinator.approve({ approvalId: parallel.approvalId, payloadHash: parallel.payloadHash, confirm: true }, "parallel-2")]); assert.strictEqual(order.length, beforeParallel + 2); assert.strictEqual(parallelResults.filter((result) => result.replayed).length, 1);
    failSignalOnce = true; const partial = coordinator.prepare({ signalReference: "SCT-2646", signal: { ...signal(), tp3: 1.15 } });
    await assert.rejects(() => coordinator.approve({ approvalId: partial.approvalId, payloadHash: partial.payloadHash, confirm: true }, "4"), (error) => error.code === "TELEGRAM_BUNDLE_EXECUTION_INCOMPLETE"); assert.deepStrictEqual(order.slice(-2), ["risk_management", "signal"]);
    const riskCountBeforeResume = order.filter((role) => role === "risk_management").length;
    const restarted = new TelegramPublishCoordinator({ ...options, store: new SignalActionStore({ filePath: storePath }) });
    const resumed = await restarted.approve({ approvalId: partial.approvalId, payloadHash: partial.payloadHash, confirm: true }, "5"); assert.strictEqual(resumed.status, "completed"); assert.strictEqual(order.at(-1), "signal"); assert.strictEqual(order.filter((role) => role === "risk_management").length, riskCountBeforeResume);
    let sends = 0; const capability = new TelegramSignalCapability({ databaseId: "db", notionService: { async getDatabaseRecords() { return { records: [{ id: "page" }] }; } }, publisher: { async publishContent() { sends += 1; return { message_id: 456 }; } } });
    await assert.rejects(() => capability.execute({ input: {}, context: {}, constraints: {} }), (error) => error.code === "TELEGRAM_APPROVAL_REQUIRED");
    const output = await capability.execute({ input: { signalReference: "SCT-2646", renderedMessage: prepared.riskManagementMessage, messageRole: "risk_management" }, context: { approvalVerified: true, payloadHash: prepared.payloadHash, idempotencyKey: `${prepared.payloadHash}:risk` }, constraints: {} }); assert.strictEqual(output.data.messageId, 456); assert.strictEqual(sends, 1);
    fs.rmSync(dir, { recursive: true, force: true }); console.log("Telegram two-message bundle approval, order, recovery, and idempotency tests passed");
}
function signal() { return { pair: "EURUSD", direction: "buy", entry: 1.1, stopLoss: 1.09, tp1: 1.11, tp2: 1.12, tp3: 1.13, risk: 0.01, grade: 1 }; }
run().catch((error) => { console.error(error); process.exitCode = 1; });

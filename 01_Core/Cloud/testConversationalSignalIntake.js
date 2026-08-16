const assert = require("assert");
const fs = require("fs"); const os = require("os"); const path = require("path");
const SignalActionStore = require("./signalActionStore");
const SignalMutationCoordinator = require("./signalMutationCoordinator");
const TelegramPublishCoordinator = require("./telegramPublishCoordinator");
const { InstrumentNormalizer } = require("../../02_Core/Signals/instrumentNormalizer");
const { DOMAIN_INTENT_EXAMPLES } = require("../../02_Core/Signals/signalIntakeContract");
const { parseTradeId } = require("../../02_Core/Signals/tradeIdContract");

function run() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "swisschart-intake-")); const clock = () => new Date("2026-08-15T12:00:00Z");
    const coordinator = new SignalMutationCoordinator({ assistant: { handle() { throw new Error("must not mutate"); } }, store: new SignalActionStore({ filePath: path.join(dir, "signal.json") }), clock });
    for (const intent of ["Signal", "سیگنال"]) assert(DOMAIN_INTENT_EXAMPLES.includes(intent));
    const started = coordinator.start(); assert.strictEqual(started.domainIntent, "swisschart_signal_workflow"); assert.strictEqual(started.nextField, "pair"); assert.strictEqual(started.nextPrompt, "Asset چیه؟"); assert.strictEqual(/what kind|destination/i.test(started.nextPrompt), false);
    const empty = coordinator.validate({ signal: {} }); assert.strictEqual(empty.status, "incomplete"); assert.strictEqual(empty.nextField, "pair"); assert.deepStrictEqual(empty.missingFields, ["pair", "direction", "entry", "stopLoss", "risk", "grade", "tp1", "tp2", "tp3"]); assert.strictEqual(empty.normalizedSignal, undefined);
    const aliases = new InstrumentNormalizer();
    for (const alias of ["GBPUSD", "GBP USD", "GBP/USD", "pound dollar", "pound/dollar", "پوند دلار", "پوند/دلار"]) assert.strictEqual(aliases.normalize(alias).symbol, "GBPUSD");
    for (const alias of ["XAUUSD", "XAU USD", "XAU/USD", "Gold", "gold dollar", "طلا", "طلا دلار"]) assert.strictEqual(aliases.normalize(alias).symbol, "XAUUSD");
    const unknown = aliases.normalize("mystery coin"); assert.strictEqual(unknown.status, "unknown"); assert.strictEqual(unknown.symbol, null); assert.strictEqual(unknown.clarificationRequired, true);
    const unknownDraft = coordinator.validate({ signal: { pair: "mystery coin" } }); assert.strictEqual(unknownDraft.status, "invalid"); assert.strictEqual(unknownDraft.nextField, "pair"); assert.strictEqual(unknownDraft.invalidFields[0].code, "SIGNAL_ASSET_UNKNOWN");
    const multi = coordinator.validate({ signal: { pair: "پوند دلار", direction: "sell", entry: 1.34556 } }); assert.strictEqual(multi.nextField, "stopLoss"); assert.deepStrictEqual(multi.missingFields, ["stopLoss", "risk", "grade", "tp1", "tp2", "tp3"]);
    const six = { pair: "GBP/USD", direction: "sell", entry: 1.34556, stopLoss: 1.3459, risk: 0.5, grade: 3 };
    const targetGap = coordinator.validate({ signal: six }); assert.strictEqual(targetGap.status, "blocked_missing_targets"); assert.strictEqual(targetGap.gapCode, "SIGNAL_TP_RULE_MISSING"); assert.strictEqual(targetGap.nextField, "tp1"); assert.strictEqual(targetGap.normalizedSignal, undefined);
    const corrected = { ...six, entry: 1.3455, tp1: 1.345, tp2: 1.3445, tp3: 1.344 };
    const complete = coordinator.validate({ signal: corrected }); assert.strictEqual(complete.status, "complete"); assert.strictEqual(complete.normalizedSignal.entry, 1.3455); assert.strictEqual(complete.normalizedSignal.pair, "GBPUSD"); assert.strictEqual(complete.derivedFields.stopSizePips, 4); assert.strictEqual(complete.derivedFields.rrTp1, "1:1.2"); assert.strictEqual(complete.derivedFields.rrTp2, "1:2.5"); assert.strictEqual(complete.derivedFields.rrTp3, "1:3.7"); assert.strictEqual(complete.approvalRequired, true);
    const prepared = coordinator.prepare({ signal: corrected }); assert.strictEqual(prepared.status, "pending_approval"); assert.strictEqual(prepared.approvalRequired, true);
    const telegram = new TelegramPublishCoordinator({ assistant: { handle() { throw new Error("must not publish"); } }, store: new SignalActionStore({ filePath: path.join(dir, "telegram.json") }), destinationId: "-100-private", clock });
    const publication = telegram.prepare({ signalReference: "SCT-2647", signal: corrected }); assert.strictEqual(publication.approvalRequired, true); assert.deepStrictEqual(publication.sendOrder, ["risk_management", "signal"]); assert.notStrictEqual(prepared.approvalId, publication.approvalId);
    assert(parseTradeId("SCT-2647")); assert.strictEqual(parseTradeId("TSC-2647"), null);
    fs.rmSync(dir, { recursive: true, force: true }); console.log("Swisschart Founder conversational signal intake, aliases, derivation, and approval tests passed");
}
run();

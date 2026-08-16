const crypto = require("crypto");
const { InstrumentNormalizer } = require("./instrumentNormalizer");
const { FOUNDER_COLLECTION_ORDER, TARGET_COLLECTION_ORDER } = require("./signalIntakeContract");
const { createSignal } = require("../../03_Workflows/signalWorkflow");

const VERSION = "1.0";
const REQUIRED = [...FOUNDER_COLLECTION_ORDER, ...TARGET_COLLECTION_ORDER];

function normalizeSignalDraft(input, options = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw coded("SIGNAL_DRAFT_REQUIRED");
    const missing = REQUIRED.filter((key) => input[key] === undefined || input[key] === null || input[key] === "");
    if (missing.length) throw coded("SIGNAL_DRAFT_FIELDS_MISSING", missing.join(","));
    const instrument = (options.instrumentNormalizer || new InstrumentNormalizer()).normalize(input.pair);
    if (instrument.status !== "normalized") throw coded(instrument.status === "ambiguous" ? "SIGNAL_ASSET_AMBIGUOUS" : "SIGNAL_ASSET_UNKNOWN", "pair");
    const pair = instrument.symbol;
    const direction = String(input.direction).trim().toLowerCase();
    if (!new Set(["buy", "sell"]).has(direction)) throw coded("SIGNAL_DIRECTION_INVALID");
    const numeric = {};
    for (const key of ["entry", "stopLoss", "tp1", "tp2", "tp3", "risk", "grade"]) {
        numeric[key] = Number(String(input[key]).replace("%", "").trim());
        if (!Number.isFinite(numeric[key])) throw coded("SIGNAL_NUMBER_INVALID", key);
    }
    if (numeric.entry <= 0 || numeric.stopLoss <= 0 || numeric.tp1 <= 0 || numeric.tp2 <= 0 || numeric.tp3 <= 0 || numeric.risk <= 0) throw coded("SIGNAL_NUMBER_INVALID");
    if (!Number.isInteger(numeric.grade) || numeric.grade < 1 || numeric.grade > 5) throw coded("SIGNAL_GRADE_INVALID");
    if (direction === "buy" && !(numeric.stopLoss < numeric.entry && numeric.tp1 > numeric.entry && numeric.tp2 > numeric.entry && numeric.tp3 > numeric.entry)) throw coded("SIGNAL_PRICE_ORDER_INVALID");
    if (direction === "sell" && !(numeric.stopLoss > numeric.entry && numeric.tp1 < numeric.entry && numeric.tp2 < numeric.entry && numeric.tp3 < numeric.entry)) throw coded("SIGNAL_PRICE_ORDER_INVALID");
    const now = (options.clock || (() => new Date()))();
    const local = localParts(now);
    return Object.freeze({ contractVersion: VERSION, pair, direction,
        entry: numeric.entry, stopLoss: numeric.stopLoss, tp1: numeric.tp1,
        tp2: numeric.tp2, tp3: numeric.tp3, risk: numeric.risk, grade: numeric.grade,
        publishDate: local.date, signalTimeNY: local.time,
        metadata: Object.freeze({ timezone: "America/New_York", purpose: "signal_creation" }) });
}

function inspectSignalDraft(input, options = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) input = {};
    const allowed = new Set(REQUIRED);
    const invalidFields = Object.keys(input).filter((key) => !allowed.has(key))
        .map((field) => ({ field, code: "SIGNAL_FIELD_UNSUPPORTED" }));
    const missingFields = REQUIRED.filter((key) => input[key] === undefined || input[key] === null || input[key] === "");
    for (const field of REQUIRED.filter((key) => !missingFields.includes(key))) {
        try { validateProvidedField(field, input[field]); }
        catch (error) { invalidFields.push({ field, code: error.code }); }
    }
    if (!missingFields.length && !invalidFields.length) {
        try {
            const normalizedSignal = normalizeSignalDraft(input, options);
            const publication = createSignal(normalizedSignal);
            return Object.freeze({ status: "complete", missingFields: [], invalidFields: [], normalizedSignal, derivedFields: Object.freeze({ canonicalInstrument: publication.pair, stopSizePips: publication.stopSize, rrTp1: publication.rrTp1, rrTp2: publication.rrTp2, rrTp3: publication.rrTp3, plannedRR: publication.plannedRR, formattedGrade: publication.grade }), approvalRequired: true, nextField: null, nextAction: "show_normalized_summary_and_request_notion_approval" });
        } catch (error) {
            invalidFields.push({ field: error.detail || priceErrorField(error.code), code: error.code });
        }
    }
    const nextField = invalidFields.length ? invalidFields[0].field : REQUIRED.find((field) => missingFields.includes(field)) || null;
    const targetsBlocked = FOUNDER_COLLECTION_ORDER.every((field) => !missingFields.includes(field)) && TARGET_COLLECTION_ORDER.some((field) => missingFields.includes(field));
    return Object.freeze({ status: invalidFields.length ? "invalid" : targetsBlocked ? "blocked_missing_targets" : "incomplete", missingFields: Object.freeze(missingFields), invalidFields: Object.freeze(invalidFields), nextField, collectionMode: "one_field_at_a_time", gapCode: targetsBlocked ? "SIGNAL_TP_RULE_MISSING" : undefined, gapExplanation: targetsBlocked ? "No authoritative Swisschart TP-generation rule exists; collect TP1, TP2, and TP3 from the Founder without invention." : undefined, approvalRequired: false, nextAction: invalidFields.length ? "ask_founder_to_correct_invalid_fields" : "ask_founder_for_next_field" });
}

function validateProvidedField(field, value) {
    if (field === "pair") {
        const instrument = new InstrumentNormalizer().normalize(value);
        if (instrument.status !== "normalized") throw coded(instrument.status === "ambiguous" ? "SIGNAL_ASSET_AMBIGUOUS" : "SIGNAL_ASSET_UNKNOWN", field);
        return;
    }
    if (field === "direction") {
        if (!new Set(["buy", "sell"]).has(String(value).trim().toLowerCase())) throw coded("SIGNAL_DIRECTION_INVALID", field);
        return;
    }
    const numeric = Number(String(value).replace("%", "").trim());
    if (!Number.isFinite(numeric) || numeric <= 0) throw coded("SIGNAL_NUMBER_INVALID", field);
    if (field === "grade" && (!Number.isInteger(numeric) || numeric < 1 || numeric > 5)) throw coded("SIGNAL_GRADE_INVALID", field);
}
function priceErrorField(code) { return code === "SIGNAL_PRICE_ORDER_INVALID" ? "prices" : "signal"; }

function payloadHash(draft, destination) {
    return crypto.createHash("sha256").update(stable({ draft, destination })).digest("hex");
}

function stable(value) {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
    return JSON.stringify(value);
}

function localParts(date) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
function coded(code, detail) { const error = new Error(code); error.code = code; error.detail = detail; return error; }

module.exports = { VERSION, REQUIRED, inspectSignalDraft, normalizeSignalDraft, payloadHash };

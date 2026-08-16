const BUSINESS_TIMEZONE = "America/New_York";
const CANONICAL_PATTERN = /^SCT-(\d{2})(0[1-9]|[1-9]\d)$/;

function newYorkYear(instant) {
    const date = instant instanceof Date ? instant : new Date(instant);
    if (Number.isNaN(date.getTime())) throw coded("TRADE_ID_CLOCK_INVALID");
    const year = new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TIMEZONE, year: "numeric" })
        .formatToParts(date).find((part) => part.type === "year").value;
    return Number(year);
}

function parseTradeId(value) {
    const match = typeof value === "string" ? value.match(CANONICAL_PATTERN) : null;
    return match ? { yearSuffix: match[1], sequence: Number(match[2]) } : null;
}

function highestSequenceForYear(values, year) {
    const suffix = String(year).slice(-2);
    return values.reduce((highest, value) => {
        const parsed = parseTradeId(value);
        return parsed && parsed.yearSuffix === suffix ? Math.max(highest, parsed.sequence) : highest;
    }, 0);
}

function createNextTradeId(values, instant, reservedSequence = 0) {
    const year = newYorkYear(instant); const suffix = String(year).slice(-2);
    const next = Math.max(highestSequenceForYear(values, year), reservedSequence) + 1;
    if (next > 99) throw coded("TRADE_ID_YEAR_SEQUENCE_EXHAUSTED");
    return { tradeId: `SCT-${suffix}${String(next).padStart(2, "0")}`, year, yearSuffix: suffix, sequence: next };
}

function coded(code) { const error = new Error(code); error.code = code; return error; }
module.exports = { BUSINESS_TIMEZONE, CANONICAL_PATTERN, newYorkYear, parseTradeId, highestSequenceForYear, createNextTradeId };

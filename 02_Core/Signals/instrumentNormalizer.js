const DEFAULT_INSTRUMENTS = Object.freeze([
    Object.freeze({ symbol: "EURUSD", aliases: Object.freeze(["eurusd", "eur usd", "eur/usd", "euro dollar", "euro/dollar", "یورو دلار", "یورو/دلار"]) }),
    Object.freeze({ symbol: "GBPUSD", aliases: Object.freeze(["gbpusd", "gbp usd", "gbp/usd", "pound dollar", "pound/dollar", "پوند دلار", "پوند/دلار"]) }),
    Object.freeze({ symbol: "XAUUSD", aliases: Object.freeze(["xauusd", "xau usd", "xau/usd", "gold", "gold dollar", "طلا", "طلا دلار"]) })
]);

class InstrumentNormalizer {
    constructor(options = {}) { this.instruments = options.instruments || DEFAULT_INSTRUMENTS; }
    normalize(value) {
        if (typeof value !== "string" || !value.trim()) return { status: "missing", symbol: null, clarificationRequired: true };
        const key = normalizeAlias(value);
        const matches = this.instruments.filter((instrument) => [instrument.symbol, ...instrument.aliases].some((alias) => normalizeAlias(alias) === key));
        if (matches.length === 1) return { status: "normalized", symbol: matches[0].symbol, clarificationRequired: false };
        return { status: matches.length > 1 ? "ambiguous" : "unknown", symbol: null, clarificationRequired: true };
    }
}
function normalizeAlias(value) { return String(value).trim().toLowerCase().replace(/[\s/_-]+/g, ""); }
module.exports = { InstrumentNormalizer, DEFAULT_INSTRUMENTS, normalizeAlias };

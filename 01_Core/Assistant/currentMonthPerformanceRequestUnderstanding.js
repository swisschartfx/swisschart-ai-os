const { randomUUID } = require("crypto");
const { createCapabilityRequest } = require("../../02_Core/Capabilities/capabilityContract");

class CurrentMonthPerformanceRequestUnderstanding {
    constructor(options = {}) {
        this.clock = options.clock || (() => new Date());
        this.idGenerator = options.idGenerator ||
            (() => `assistant-request-${randomUUID()}`);
    }

    understand(text) {
        const normalized = String(text || "").trim().toLowerCase().replace(/\s+/g, " ");
        if (!isCurrentMonth(normalized)) return null;
        const requestedMetrics = classifyMetrics(normalized);
        if (!requestedMetrics) return null;
        return {
            intent: "current_month_trading_performance",
            requestClass: "read",
            requiresCapability: true,
            requestedMetrics,
            capabilityRequest: createCapabilityRequest({
                requestId: this.idGenerator(), capability: "trading.data",
                operation: "trading.performance.summary",
                input: { period: "current_month" }, context: {},
                constraints: { readOnly: true },
                metadata: { understoodIntent: "current_month_trading_performance",
                    requestedMetrics },
                requestedBy: "founder", source: "assistant-natural-language",
                timestamp: this.clock().toISOString(), inputContractVersion: "1.0"
            })
        };
    }
}

function isCurrentMonth(text) {
    return /\bthis\s+month\b/.test(text) || text.includes("این ماه");
}

function classifyMetrics(text) {
    if (/\bwin\s*rate\b/.test(text) || text.includes("وین ریت") ||
        text.includes("نرخ برد")) return "win_rate";
    if (/\bnet\s*r+r?\b/.test(text) || text.includes("آر آر خالص")) return "net_rr";
    if ((text.includes("برد") && text.includes("باخت")) ||
        (/\bwins?\b/.test(text) && /\bloss(?:es)?\b/.test(text))) return "wins_losses";
    if ((/\bhow many trades?\b/.test(text) || /\btrade count\b/.test(text)) ||
        ((text.includes("چند") || text.includes("تعداد")) &&
            (text.includes("معامله") || text.includes("ترید") ||
                /\btrades?\b/.test(text)))) return "trade_count";
    if (/\bperformance\b/.test(text) || text.includes("عملکرد")) return "general";
    return null;
}

module.exports = CurrentMonthPerformanceRequestUnderstanding;

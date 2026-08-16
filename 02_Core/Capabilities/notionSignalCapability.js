const { createCapabilityDeclaration, EXECUTION_MODES, CAPABILITY_BEHAVIORS, APPROVAL_REQUIREMENTS, LIFECYCLE_STAGES } = require("./capabilityContract");
const NotionService = require("../Services/notionService");
const { createNextTradeId } = require("../Signals/tradeIdContract");

class NotionSignalCapability {
    constructor(options = {}) {
        this.name = "signal.notion"; this.service = options.service || new NotionService();
        this.databaseId = options.databaseId || process.env.NOTION_DATABASE_ID;
        this.clock = options.clock || (() => new Date());
        this.allocationQueue = Promise.resolve(); this.lastAllocatedByYear = new Map();
        this.declaration = createCapabilityDeclaration({ capabilityId: this.name, domain: "trading", version: "1.0.0", supportedOperations: ["signal.notion.create"], operationPolicies: { "signal.notion.create": governedMutation() }, executionMode: EXECUTION_MODES.SYNCHRONOUS, behavior: CAPABILITY_BEHAVIORS.MUTATING, approvalRequirement: APPROVAL_REQUIREMENTS.REQUIRED, lifecycleSupport: [LIFECYCLE_STAGES.STORE, LIFECYCLE_STAGES.ACT], inputContractVersion: "1.0", outputContractVersion: "1.0" });
    }
    async execute(request) {
        if (!request.context || request.context.approvalVerified !== true || !request.context.payloadHash || !request.context.idempotencyKey) { const e = new Error("Approval required"); e.code = "SIGNAL_APPROVAL_REQUIRED"; throw e; }
        const execution = this.allocationQueue.then(() => this.createSequentialSignal(request));
        this.allocationQueue = execution.catch(() => {});
        return execution;
    }
    async createSequentialSignal(request) {
        const d = request.input.draft;
        const response = typeof this.service.getAllDatabaseRecords === "function"
            ? await this.service.getAllDatabaseRecords({ databaseId: this.databaseId })
            : await this.service.getDatabaseRecords({ databaseId: this.databaseId });
        const values = (response.records || []).map(readTradeId);
        const now = this.clock();
        const year = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric" }).format(now));
        const allocation = createNextTradeId(values, now, this.lastAllocatedByYear.get(year) || 0);
        this.lastAllocatedByYear.set(year, allocation.sequence);
        const tradeId = allocation.tradeId;
        const properties = {
            "Trade ID": { title: [{ text: { content: tradeId } }] },
            Grade: { select: { name: "⭐".repeat(d.grade) } }, Pair: { select: { name: d.pair } }, Direction: { select: { name: d.direction === "buy" ? "Buy" : "Sell" } },
            Result: { select: { name: "Pending" } }, "Trade State": { select: { name: "Pending" } }, Status: { select: { name: "Pending" } },
            Entry: rich(d.entry), "Stop Loss": rich(d.stopLoss), "TP1 Price": rich(d.tp1), "TP2 Price": rich(d.tp2), "TP3 Price": rich(d.tp3),
            "Risk %": { number: d.risk }, "Publish Date": { date: { start: d.publishDate } }, "Signal Time NY": rich(d.signalTimeNY)
        };
        const page = await this.service.createDatabasePage({ databaseId: this.databaseId, properties });
        return { data: { created: true, tradeId, pageId: page.id }, summary: "Approved signal created", evidence: [`notion_page:${page.id}`], sourceReferences: [page.id], recordCount: 1, executionMetadata: { idempotencyKey: request.context.idempotencyKey } };
    }
}
function governedMutation() { return { access: "mutation", mutationPolicy: { approvalRequired: true, payloadBindingRequired: true, idempotencyRequired: true } }; }
function readTradeId(record) {
    const title = record && record.properties && record.properties["Trade ID"] && record.properties["Trade ID"].title;
    return title && title[0] && (title[0].plain_text || title[0].text && title[0].text.content) || null;
}
function rich(value) { return { rich_text: [{ text: { content: String(value) } }] }; }
module.exports = NotionSignalCapability;

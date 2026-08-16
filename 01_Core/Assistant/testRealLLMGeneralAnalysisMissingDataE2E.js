const assert = require("assert");
const path = require("path");
const dotenv = require("../../02_Agents/01_Journal_Agent/node_modules/dotenv");

dotenv.config({ path: path.join(__dirname, "../../.env"), override: true, quiet: true });

const originalFetch = globalThis.fetch;
let openAIRequestCount = 0;
let notionRequestCount = 0;

globalThis.fetch = async (url, options) => {
    const target = String(url);
    if (target.includes("/responses")) openAIRequestCount += 1;
    if (target.includes("api.notion.com")) notionRequestCount += 1;
    return originalFetch(url, options);
};

const runtime = require("../bootstrap");
const originalUnderstand = runtime.assistant.requestUnderstanding.understand
    .bind(runtime.assistant.requestUnderstanding);
let observedUnderstanding = null;
runtime.assistant.requestUnderstanding.understand = async (text) => {
    const result = await originalUnderstand(text);
    observedUnderstanding = result;
    return result;
};

async function run() {
    if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) {
        throw new Error("OPENAI_API_KEY and OPENAI_MODEL are required");
    }
    if (!process.env.NOTION_API_TOKEN || !process.env.NOTION_DATABASE_ID) {
        throw new Error("NOTION_API_TOKEN and NOTION_DATABASE_ID are required");
    }

    const question = "Max Drawdown دقیق این ماه چقدر بوده؟";
    const fixedAnalytics = runtime.capabilityRegistry.get("trading.analytics");
    assert.ok(fixedAnalytics);
    assert.strictEqual(fixedAnalytics.supportedMetrics.includes("max_drawdown"), false);

    try {
        const response = await runtime.assistant.handle(question);

        const diagnosticData = response.capabilityResult &&
            response.capabilityResult.data;
        console.log("SAFE_DIAGNOSTICS", {
            responseSuccess: response.success,
            responseIntent: response.intent || null,
            responseMessage: response.message || null,
            capabilityResultStatus: response.capabilityResult &&
                response.capabilityResult.status || null,
            capabilityDataStatus: diagnosticData && diagnosticData.status || null,
            missingFields: diagnosticData && diagnosticData.missingFields || null,
            planningErrorCode: response.planningError &&
                response.planningError.code || null,
            planningErrorMessage: response.planningError &&
                response.planningError.message || null,
            plannerProviderActivity: response.providerMetadata &&
                response.providerMetadata.request &&
                response.providerMetadata.request.activity || null,
            openAIRequestCount,
            notionRequestCount
        });
        console.log("SAFE_REQUEST_UNDERSTANDING", {
            domain: observedUnderstanding && observedUnderstanding.understanding &&
                observedUnderstanding.understanding.domain || null,
            mode: observedUnderstanding && observedUnderstanding.understanding &&
                observedUnderstanding.understanding.mode || null,
            requestedMetric: observedUnderstanding &&
                observedUnderstanding.understanding &&
                observedUnderstanding.understanding.requestedMetric || null,
            analyticalGoal: observedUnderstanding &&
                observedUnderstanding.understanding &&
                observedUnderstanding.understanding.analyticalGoal || null,
            period: observedUnderstanding && observedUnderstanding.understanding &&
                observedUnderstanding.understanding.period || null,
            capabilityCandidate: observedUnderstanding &&
                observedUnderstanding.understanding &&
                observedUnderstanding.understanding.capabilityCandidate || null,
            operationCandidate: observedUnderstanding &&
                observedUnderstanding.understanding &&
                observedUnderstanding.understanding.operationCandidate || null,
            calculationRequired: observedUnderstanding &&
                observedUnderstanding.understanding
                ? observedUnderstanding.understanding.calculationRequired
                : null,
            executable: observedUnderstanding
                ? observedUnderstanding.executable
                : null,
            unsupportedReason: observedUnderstanding &&
                observedUnderstanding.unsupportedReason || null,
            generalAnalysisEligible: observedUnderstanding
                ? observedUnderstanding.generalAnalysisEligible
                : null
        });

        assert.strictEqual(response.success, true);
        assert.strictEqual(response.intent, "general_trading_analysis");
        assert.ok(response.capabilityResult);
        assert.strictEqual(response.capabilityResult.capability,
            "trading.general_analysis");
        assert.strictEqual(response.capabilityResult.operation,
            "trading.general_analysis.execute");

        const data = response.capabilityResult.data;
        assert.strictEqual(data.status, "missing_data");
        assert.ok(Array.isArray(data.missingFields));
        assert.ok(data.missingFields.length > 0);
        assert.strictEqual(Object.hasOwn(data, "result"), false);
        assert.strictEqual(data.dataSufficiency.possible, false);
        assert.strictEqual(data.dataSufficiency.approximate, false);

        const missing = data.missingFields.find((item) =>
            /equity|balance/i.test(`${item.field} ${item.reason} ${item.suggestedData}`)
        );
        assert.ok(missing, "A canonical equity or balance series must be identified");
        assert.ok(/chronolog|sequence|peak|trough|equity|balance/i.test(missing.reason));

        assert.strictEqual(typeof response.message, "string");
        assert.ok(response.message.includes(data.analysisGoal));
        assert.ok(response.message.includes(missing.field));
        assert.ok(response.message.includes(missing.reason));
        assert.ok(response.message.includes(missing.suggestedData));
        assert.strictEqual(/max drawdown[^.]*\b-?\d+(?:\.\d+)?%?/i
            .test(response.message), false);

        assert.strictEqual(response.providerMetadata.provider, "openai");
        assert.strictEqual(response.providerMetadata.request.activity,
            "assistant.trading_analysis_planning");
        assert.ok(Number.isInteger(response.providerMetadata.usage.totalTokens));

        const publicOutput = JSON.stringify({
            message: response.message,
            capabilityResult: response.capabilityResult
        });
        assert.strictEqual(publicOutput.includes("databaseId"), false);
        assert.strictEqual(publicOutput.includes("api.notion.com"), false);
        assert.strictEqual(publicOutput.includes("NOTION_"), false);
        assert.strictEqual(publicOutput.includes("OPENAI_API_KEY"), false);

        assert.strictEqual(openAIRequestCount, 2);
        assert.strictEqual(notionRequestCount, 0);

        console.log({ question, response });
        console.log("Real General Analysis Missing Data E2E proof passed");
    } finally {
        globalThis.fetch = originalFetch;
    }
}

run().catch((error) => {
    globalThis.fetch = originalFetch;
    console.error("Real General Analysis Missing Data E2E proof failed:", error.message);
    process.exitCode = 1;
});

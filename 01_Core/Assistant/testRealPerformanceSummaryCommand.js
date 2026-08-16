const assert = require("assert");

const SwisschartAssistant = require("./01_assistant");
const NotionAgent = require("../../02_Agents/Notion_Agent/notionAgent");
const PerformanceFormatterCapability = require(
    "../../02_Core/Capabilities/performanceFormatterCapability"
);

async function run() {
    const notionRequests = [];
    const notionResults = [];
    const formatterInputs = [];
    const realNotionAgent = new NotionAgent({ mode: "real" });
    const realFormatter = new PerformanceFormatterCapability();
    const assistant = new SwisschartAssistant({
        notionAgent: {
            async handleRequest(request) {
                notionRequests.push(request);
                const result = await realNotionAgent.handleRequest(request);
                notionResults.push(result);
                return result;
            }
        },
        performanceFormatterCapability: {
            async execute(input) {
                formatterInputs.push(input);
                return realFormatter.execute(input);
            }
        }
    });

    const result = await assistant.handle("performance_summary");

    assert.deepStrictEqual(notionRequests, [{
        action: "getPerformanceSummary"
    }]);
    assert.strictEqual(notionResults.length, 1);
    assert.strictEqual(notionResults[0].type, "performance_summary");
    assert.ok(notionResults[0].summary);
    assert.deepStrictEqual(formatterInputs, [{
        summary: notionResults[0].summary
    }]);
    assert.strictEqual(result.type, "formatted_message");
    assert.strictEqual(typeof result.content, "string");
    assert.ok(result.content.trim().length > 0);

    console.log(result.content);
    console.log("Real Assistant performance summary command test passed");
}

run().catch(error => {
    console.error("Real Assistant performance summary command test failed:",
        error.message);
    process.exitCode = 1;
});

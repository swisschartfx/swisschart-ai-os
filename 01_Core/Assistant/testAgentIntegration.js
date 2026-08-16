const assert = require("assert");

const SwisschartAssistant = require("./01_assistant");
const NotionAgent = require("../../02_Agents/Notion_Agent/notionAgent");
const PublishingAgent = require("../../02_Agents/02_Publishing_Agent/index02");

async function run() {
    const notionAgent = new NotionAgent({
        mockTrades: [{
            tradeId: "SCT-3000",
            pair: "EURUSD",
            result: "Win",
            finalRR: 2
        }]
    });
    const publishingAgent = Object.create(PublishingAgent.prototype);
    publishingAgent.sentMessages = [];
    publishingAgent.publishContent = async function publishContent(message) {
        const response = {
            message_id: `mock-message-${this.sentMessages.length + 1}`,
            chat: { id: "telegram.primary" },
            text: message,
            mock: true
        };
        this.sentMessages.push(response);
        return response;
    };
    const assistant = new SwisschartAssistant({
        testMode: true,
        taskEngine: {},
        ruleResolver: {},
        notionAgent,
        publishingAgent
    });

    const notionResponse = await assistant.handle({
        type: "notion",
        action: "getTradeHistory",
        filters: { pair: "EURUSD" }
    });
    assert.strictEqual(notionResponse.type, "trade_history");
    assert.strictEqual(notionResponse.count, 1);
    assert.strictEqual(notionResponse.trades[0].tradeId, "SCT-3000");

    const approvedResponse = await assistant.handle({
        type: "telegram_publish",
        task: {
            taskId: "task-approved",
            input: {
                destination: "telegram.primary",
                message: "Approved mock publication"
            },
            approval: {
                required: true,
                status: "approved"
            }
        }
    });
    assert.strictEqual(approvedResponse.mock, true);
    assert.strictEqual(publishingAgent.sentMessages.length, 1);

    await assert.rejects(
        () => assistant.handle({
            type: "telegram_publish",
            task: {
                taskId: "task-pending",
                input: {
                    destination: "telegram.primary",
                    message: "Pending publication"
                },
                approval: {
                    required: true,
                    status: "pending"
                }
            }
        }),
        error => error.code === "TELEGRAM_PUBLISHING_APPROVAL_REQUIRED"
    );
    assert.strictEqual(publishingAgent.sentMessages.length, 1);

    console.log("Assistant Agent integration mock tests passed");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});

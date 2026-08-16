const assert = require("assert");

const TelegramAssistantAdapter = require("./telegramAssistantAdapter");
const { MAX_TELEGRAM_ASSISTANT_TEXT_LENGTH } = require(
    "./telegramAssistantAdapter"
);

async function run() {
    const assistantCalls = [];
    const sent = [];
    const adapter = new TelegramAssistantAdapter({
        founderUserId: "123456789",
        assistant: {
            async handle(text) {
                assistantCalls.push(text);
                return {
                    success: true,
                    message: "Profit Factor this month: 2.",
                    capabilityResult: { internal: "must-not-be-sent" },
                    providerMetadata: { tokenUsage: "must-not-be-sent" }
                };
            }
        },
        transport: {
            async sendMessage(payload) { sent.push(payload); }
        }
    });

    const founderText = "Profit factor این ماه چقدره؟";
    const replied = await adapter.handleUpdate(privateText(
        123456789, 123456789, founderText
    ));
    assert.deepStrictEqual(replied, { status: "replied" });
    assert.deepStrictEqual(assistantCalls, [founderText]);
    assert.deepStrictEqual(sent, [{
        chatId: 123456789,
        text: "Profit Factor this month: 2."
    }]);
    assert.strictEqual(JSON.stringify(sent).includes("capabilityResult"), false);
    assert.strictEqual(JSON.stringify(sent).includes("tokenUsage"), false);

    const longText = "x".repeat(MAX_TELEGRAM_ASSISTANT_TEXT_LENGTH + 500);
    const longReplies = [];
    const longAdapter = new TelegramAssistantAdapter({
        founderUserId: "123456789",
        assistant: { async handle() { return { message: longText }; } },
        transport: { async sendMessage(payload) { longReplies.push(payload); } }
    });
    await longAdapter.handleUpdate(privateText(123456789, 123456789, "Long"));
    assert.strictEqual(longReplies[0].text.length,
        MAX_TELEGRAM_ASSISTANT_TEXT_LENGTH);
    assert.ok(longReplies[0].text.endsWith("[Response shortened for Telegram.]"));
    assert.strictEqual(sent[0].text, "Profit Factor this month: 2.");

    assert.deepStrictEqual(await adapter.handleUpdate(privateText(
        999, 999, "Unauthorized"
    )), { status: "unauthorized" });
    assert.strictEqual(assistantCalls.length, 1);
    assert.strictEqual(sent.length, 1);

    assert.deepStrictEqual(await adapter.handleUpdate({
        message: { from: { id: 123456789 }, chat: { id: 123456789, type: "private" },
            photo: [{ file_id: "photo" }] }
    }), { status: "ignored" });
    assert.deepStrictEqual(await adapter.handleUpdate({
        message: { from: { id: 123456789 }, chat: { id: -1001, type: "group" },
            text: "Group request" }
    }), { status: "ignored" });
    assert.strictEqual(assistantCalls.length, 1);

    const failures = [];
    const failing = new TelegramAssistantAdapter({
        founderUserId: "123456789",
        assistant: {
            async handle() {
                const error = new Error("OPENAI_API_KEY secret databaseId stack trace");
                error.internalMetadata = { notionToken: "secret" };
                throw error;
            }
        },
        transport: { async sendMessage(payload) { failures.push(payload); } }
    });
    assert.deepStrictEqual(await failing.handleUpdate(privateText(
        123456789, 123456789, "Fail safely"
    )), { status: "failed" });
    assert.deepStrictEqual(failures, [{
        chatId: 123456789,
        text: "The Assistant is temporarily unavailable. Please try again later."
    }]);
    assert.strictEqual(JSON.stringify(failures).includes("OPENAI_API_KEY"), false);
    assert.strictEqual(JSON.stringify(failures).includes("databaseId"), false);

    console.log("Telegram Assistant Adapter tests passed");
}

function privateText(userId, chatId, text) {
    return {
        update_id: 1,
        message: {
            message_id: 2,
            from: { id: userId },
            chat: { id: chatId, type: "private" },
            text
        }
    };
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

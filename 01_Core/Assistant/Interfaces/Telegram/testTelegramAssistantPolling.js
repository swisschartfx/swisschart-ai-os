const assert = require("assert");

const TelegramAssistantAdapter = require("./telegramAssistantAdapter");
const TelegramBotTransport = require("./telegramBotTransport");
const TelegramAssistantPoller = require("./telegramAssistantPoller");

async function run() {
    const requests = [];
    const token = "test-token-must-not-appear-in-output";
    const transport = new TelegramBotTransport({
        botToken: token,
        fetch: async (url, options) => {
            requests.push({ url, body: JSON.parse(options.body) });
            const method = url.endsWith("/getUpdates") ? "getUpdates" : "sendMessage";
            return response(method === "getUpdates"
                ? [{ update_id: 10 }, { update_id: 11 }]
                : { message_id: 20 });
        }
    });
    const updates = await transport.getUpdates({ offset: 10, timeoutSeconds: 20 });
    assert.deepStrictEqual(updates.map((update) => update.update_id), [10, 11]);
    assert.deepStrictEqual(requests[0].body, {
        offset: 10, timeout: 20, allowed_updates: ["message"]
    });
    await transport.sendMessage({ chatId: 123, text: "Assistant response" });
    assert.deepStrictEqual(requests[1].body, {
        chat_id: 123, text: "Assistant response"
    });
    assert.strictEqual(JSON.stringify(transport).includes(token), true);
    const safeErrorTransport = new TelegramBotTransport({
        botToken: token,
        fetch: async () => response({}, false)
    });
    await assert.rejects(
        () => safeErrorTransport.getUpdates(),
        (error) => error.message === "Telegram getUpdates request failed" &&
            !error.message.includes(token)
    );

    const assistantCalls = [];
    const replies = [];
    const adapter = new TelegramAssistantAdapter({
        founderUserId: "123",
        assistant: {
            async handle(text) {
                assistantCalls.push(text);
                return { message: "Same-chat reply" };
            }
        },
        transport: { async sendMessage(payload) { replies.push(payload); } }
    });
    const batches = [[
        privateText(5, 123, 123, "Founder question"),
        privateText(6, 999, 999, "Unauthorized")
    ], [privateText(5, 123, 123, "Duplicate")], []];
    const offsets = [];
    const poller = new TelegramAssistantPoller({
        adapter,
        transport: {
            async getUpdates({ offset }) {
                offsets.push(offset);
                return batches.shift();
            }
        }
    });
    assert.deepStrictEqual(await poller.pollOnce(), [
        { updateId: 5, status: "replied" },
        { updateId: 6, status: "unauthorized" }
    ]);
    assert.strictEqual(poller.offset, 7);
    assert.deepStrictEqual(await poller.pollOnce(), []);
    assert.deepStrictEqual(await poller.pollOnce(), []);
    assert.deepStrictEqual(offsets, [undefined, 7, 7]);
    assert.deepStrictEqual(assistantCalls, ["Founder question"]);
    assert.deepStrictEqual(replies, [{ chatId: 123, text: "Same-chat reply" }]);

    let failedCalls = 0;
    const failedPoller = new TelegramAssistantPoller({
        adapter: {
            async handleUpdate() {
                failedCalls += 1;
                throw new Error("Assistant update failed");
            }
        },
        transport: {
            async getUpdates() { return [privateText(20, 123, 123, "Fail")]; }
        }
    });
    assert.deepStrictEqual(await failedPoller.pollOnce(), [
        { updateId: 20, status: "failed" }
    ]);
    assert.strictEqual(failedPoller.offset, 21);
    assert.strictEqual(failedCalls, 1);

    let attempts = 0;
    let delays = 0;
    const logs = [];
    let recoveringPoller;
    recoveringPoller = new TelegramAssistantPoller({
        adapter: { async handleUpdate() { return { status: "ignored" }; } },
        transport: {
            async getUpdates() {
                attempts += 1;
                if (attempts === 1) throw new Error(`network ${token}`);
                recoveringPoller.stop();
                return [];
            }
        },
        retryDelayMs: 2500,
        delay: async (milliseconds) => {
            delays += 1;
            assert.strictEqual(milliseconds, 2500);
        },
        logger: {
            info(message) { logs.push(message); },
            warn(message) { logs.push(message); }
        }
    });
    await recoveringPoller.start();
    assert.strictEqual(attempts, 2);
    assert.strictEqual(delays, 1);
    assert.strictEqual(JSON.stringify(logs).includes(token), false);
    assert.ok(logs.includes("Telegram Assistant polling network error; retrying"));

    console.log("Telegram Assistant polling tests passed");
}

function privateText(updateId, userId, chatId, text) {
    return {
        update_id: updateId,
        message: {
            from: { id: userId },
            chat: { id: chatId, type: "private" },
            text
        }
    };
}

function response(result, ok = true) {
    return {
        ok,
        async json() { return { ok, result, description: ok ? undefined : "secret" }; }
    };
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

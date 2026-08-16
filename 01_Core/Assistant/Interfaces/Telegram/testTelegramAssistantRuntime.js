const assert = require("assert");
const EventEmitter = require("events");

const {
    TelegramAssistantRuntime,
    validateStartupEnvironment
} = require("./telegramAssistantRuntime");

async function run() {
    const validEnvironment = {
        TELEGRAM_BOT_TOKEN: "telegram-secret",
        TELEGRAM_FOUNDER_USER_ID: "123",
        OPENAI_API_KEY: "openai-secret",
        OPENAI_MODEL: "test-model",
        NOTION_API_TOKEN: "notion-secret",
        NOTION_DATABASE_ID: "database-secret"
    };
    assert.strictEqual(validateStartupEnvironment(validEnvironment), true);
    assert.throws(
        () => validateStartupEnvironment({ ...validEnvironment,
            OPENAI_API_KEY: "", NOTION_API_TOKEN: "" }),
        (error) => error.code === "TELEGRAM_ASSISTANT_ENVIRONMENT_MISSING" &&
            error.message.includes("OPENAI_API_KEY") &&
            error.message.includes("NOTION_API_TOKEN") &&
            !error.message.includes("telegram-secret") &&
            !error.message.includes("database-secret")
    );

    await testSignal("SIGINT");
    await testSignal("SIGTERM");

    console.log("Telegram Assistant Runtime tests passed");
}

async function testSignal(signal) {
    const processStub = new EventEmitter();
    const logs = [];
    let starts = 0;
    let stops = 0;
    let resolvePolling;
    const polling = new Promise((resolve) => { resolvePolling = resolve; });
    const runtime = new TelegramAssistantRuntime({
        process: processStub,
        logger: { info(message) { logs.push(message); } },
        poller: {
            start() { starts += 1; return polling; },
            stop() { stops += 1; resolvePolling(); }
        }
    });
    const first = runtime.start();
    const second = runtime.start();
    assert.strictEqual(starts, 1);
    processStub.emit(signal);
    await Promise.all([first, second]);
    assert.strictEqual(stops, 1);
    assert.deepStrictEqual(logs,
        ["Telegram Assistant graceful shutdown requested"]);
    assert.strictEqual(processStub.listenerCount("SIGINT"), 0);
    assert.strictEqual(processStub.listenerCount("SIGTERM"), 0);
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

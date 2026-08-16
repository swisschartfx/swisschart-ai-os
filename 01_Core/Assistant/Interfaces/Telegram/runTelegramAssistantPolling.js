const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "../../../../.env"), override: true,
    quiet: true });
dotenv.config({ path: path.join(__dirname,
    "../../../../02_Agents/02_Publishing_Agent/.env"), override: false,
    quiet: true });

const {
    TelegramAssistantRuntime,
    validateStartupEnvironment
} = require("./telegramAssistantRuntime");

validateStartupEnvironment(process.env);

const runtime = require("../../../bootstrap");
const TelegramAssistantAdapter = require("./telegramAssistantAdapter");
const TelegramBotTransport = require("./telegramBotTransport");
const TelegramAssistantPoller = require("./telegramAssistantPoller");

const transport = new TelegramBotTransport();
const adapter = new TelegramAssistantAdapter({
    assistant: runtime.assistant,
    transport
});
const poller = new TelegramAssistantPoller({ transport, adapter });
const telegramRuntime = new TelegramAssistantRuntime({ poller });

telegramRuntime.start().catch(() => {
    console.error("Telegram Assistant polling stopped unexpectedly");
    process.exitCode = 1;
});

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = relativePath => fs.existsSync(path.join(root, relativePath));

const removedPaths = [
    "01_Core/Scheduler/scheduler.js",
    "01_Core/Configuration/configManager.js",
    "01_Core/Agents/agentContract.js",
    "01_Core/Assistant/automationIntentHandler.js",
    "02_Agents/03_Content_Agent/index.js",
    "03_Workflows/tradeLifecycle.js",
    "03_Workflows/telegramPublishingWorkflow.js",
    "03_Workflows/performanceSummaryTelegramWorkflow.js",
    "02_Core/Capabilities/performanceFormatterCapability.js",
    "02_Agents/01_Journal_Agent/notionAutomationCapability.js",
    "02_Agents/01_Journal_Agent/utils/signalFormatter.js",
    "00_PROJECT_BRAIN.zip",
    "02_Agents/02_Publishing_Agent/index02.js",
    "01_Core/Cloud/readOnlyComposition.js"
];

for (const relativePath of removedPaths) {
    assert.strictEqual(exists(relativePath), false, `${relativePath} must remain absent`);
}

const assistant = read("01_Core/Assistant/01_assistant.js");
assert.doesNotMatch(assistant, /Notion_Agent|NotionAgent|notionAgent/);
assert.doesNotMatch(assistant, /telegramPublishingWorkflow|performanceSummaryTelegramWorkflow/);
assert.match(assistant, /trading\.performance\.summary/);
assert.match(assistant, /LEGACY_NOTION_AGENT_ROUTE_DISABLED/);

const automationManager = read("01_Core/Automation_Manager/automationManager.js");
assert.match(automationManager, /legacyJsonAutomationStore/);
assert.doesNotMatch(automationManager, /require\("\.\/automationStore"\)/);
assert.match(read("01_Core/Automation_Manager/legacyJsonAutomationStore.js"), /Legacy\/manual compatibility store only/);

const composition = read("01_Core/Cloud/cloudComposition.js");
assert.match(composition, /automationStore:\s*null/);
assert.match(composition, /sqliteAutomationStore/);
assert.doesNotMatch(composition, /notionAgent|telegramPublishingWorkflow|performanceSummaryTelegramWorkflow/);

const telegramPollingEntry = read("01_Core/Assistant/Interfaces/Telegram/runTelegramAssistantPolling.js");
assert.match(telegramPollingEntry, /require\("dotenv"\)/);
assert.doesNotMatch(telegramPollingEntry, /01_Journal_Agent|node_modules[\\/]dotenv/);
assert.strictEqual(JSON.parse(read("package.json")).dependencies.dotenv, "^17.4.2");

const formatter = read("02_Agents/02_Publishing_Agent/utils/telegramFormatter.js");
for (const field of ["TP3", "Risk", "rrTp3", "tradeId"]) {
    assert.match(formatter, new RegExp(field.replace(" ", "\\s*")), `canonical formatter must retain ${field}`);
}

assert.strictEqual(exists("08_Documents/archive/README.md"), true);
assert.match(read("08_Documents/archive/README.md"), /historical and non-authoritative/i);
assert.strictEqual(exists("01_Core/Assistant/02_Assistant_Blueprint.md"), false);
assert.strictEqual(exists("08_Documents/archive/legacy-blueprints/02_Assistant_Blueprint.md"), true);
assert.strictEqual(exists("02_Agents/02_Publishing_Agent/publishingAgent.js"), true);
assert.strictEqual(exists("01_Core/Cloud/cloudComposition.js"), true);

const scripts = JSON.parse(read("package.json")).scripts;
for (const [name, command] of Object.entries(scripts)) {
    if (name === "start") continue;
    assert.doesNotMatch(command, /manual[\\/]|08_Documents[\\/]archive|Notion_Agent|01_Journal_Agent/,
        `${name} must not execute manual, archived, or legacy Agent code`);
}

console.log("P2 maintainability boundary tests passed");

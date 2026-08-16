const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const { requireManualExternalAuthorization } = require(
    path.join(root, "manual/external/manualExternalGuard")
);

function run() {
    const guardedNames = [
        "SWISSCHART_ALLOW_REAL_EXTERNAL_ACTIONS",
        "SWISSCHART_EXTERNAL_TARGET",
        "SWISSCHART_CONFIRM_TELEGRAM_SEND"
    ];
    const saved = Object.fromEntries(
        guardedNames.map(name => [name, process.env[name]])
    );
    try {
        guardedNames.forEach(name => delete process.env[name]);
        assert.throws(
            () => requireManualExternalAuthorization({
                description: "static safety probe",
                actionFlags: ["SWISSCHART_CONFIRM_TELEGRAM_SEND"]
            }),
            error => error.code === "MANUAL_EXTERNAL_ACTION_NOT_AUTHORIZED"
        );
    } finally {
        for (const name of guardedNames) {
            if (saved[name] === undefined) delete process.env[name];
            else process.env[name] = saved[name];
        }
    }

    const packageJson = JSON.parse(read("package.json"));
    const defaultSuites = [
        packageJson.scripts["test:cloud"],
        packageJson.scripts["test:schedules"],
        packageJson.scripts["test:p0-safety"]
    ].join("\n");
    assert(!defaultSuites.includes("manual/external"));
    assert(!defaultSuites.includes("testRealSignal"));
    assert(!defaultSuites.includes("testRealTelegramPublishingSmoke"));
    assert(!defaultSuites.includes("testPhoto.js"));

    const assistant = read("01_Core/Assistant/01_assistant.js");
    assert(!assistant.includes('require("../../03_Workflows/signalExecution")'));
    assert(assistant.includes("LEGACY_SIGNAL_EXECUTION_DISABLED"));

    const legacySignal = read("03_Workflows/signalExecution.js");
    assert(legacySignal.includes("assertManualExternalAuthorization();"));
    assert(legacySignal.includes("SWISSCHART_CONFIRM_TELEGRAM_SEND"));
    assert(legacySignal.includes("SWISSCHART_CONFIRM_NOTION_WRITE"));
    assert(
        legacySignal.indexOf("assertManualExternalAuthorization();") <
        legacySignal.indexOf("../02_Agents/01_Journal_Agent/agents/journalAgent"),
        "legacy providers must load only after authorization"
    );

    const legacyStart = read("01_Core/start.js");
    assert(legacyStart.includes('process.env.SWISSCHART_ENABLE_LEGACY_SCHEDULER === "true"'));
    assert(!/^runtime\.schedulerRuntime\.start\(\);/m.test(legacyStart));

    const manualFiles = [
        "manual/external/runLegacySignalExecution.js",
        "manual/external/sendTelegramConnectionProbe.js",
        "manual/external/sendTelegramPhotoProbe.js"
    ];
    for (const file of manualFiles) {
        const source = read(file);
        const guardIndex = source.indexOf("requireManualExternalAuthorization({");
        assert(guardIndex >= 0, `${file} must invoke the external-action guard`);
        const providerIndex = Math.min(
            ...["signalExecution", "services/telegram"]
                .map(token => source.indexOf(token))
                .filter(index => index >= 0)
        );
        assert(guardIndex < providerIndex, `${file} must authorize before loading provider code`);
    }

    for (const oldPath of [
        "01_Core/Assistant/testRealSignal.js",
        "01_Core/Assistant/testRealTelegramPublishingSmoke.js",
        "02_Agents/02_Publishing_Agent/testPhoto.js"
    ]) {
        assert(!fs.existsSync(path.join(root, oldPath)), `${oldPath} must not retain test naming`);
    }

    console.log("P0 static safety boundaries passed");
}

run();

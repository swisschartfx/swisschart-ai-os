const { requireManualExternalAuthorization } = require("./manualExternalGuard");

requireManualExternalAuthorization({
    description: "send a Telegram signal bundle and create a Notion trade",
    actionFlags: [
        "SWISSCHART_CONFIRM_TELEGRAM_SEND",
        "SWISSCHART_CONFIRM_NOTION_WRITE"
    ]
});

const executeSignal = require("../../03_Workflows/signalExecution");

async function main() {
    const signalData = {
        pair: "GBPUSD",
        direction: "SELL",
        entry: 1.35755,
        stopLoss: 1.35813,
        tp1: 1.35260,
        tp2: 1.34800,
        tp3: 1.34000,
        risk: "1%",
        grade: "3",
        signalScreenshot: null,
        tradingViewLink: null
    };

    console.warn("Executing legacy production-capable signal operation");
    console.log(await executeSignal(signalData));
}

main().catch(error => {
    console.error(`MANUAL EXTERNAL ACTION FAILED: ${error.message}`);
    process.exitCode = 1;
});

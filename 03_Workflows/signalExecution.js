const { createSignal } =
    require("./signalWorkflow");

const { createRiskReminder } =
    require("./riskReminder");

function getNewYorkDateTime() {

    const now =
        new Date();


    const formatter =
        new Intl.DateTimeFormat(
            "en-US",
            {
                timeZone: "America/New_York",

                year: "numeric",
                month: "2-digit",
                day: "2-digit",

                hour: "2-digit",
                minute: "2-digit",

                hour12: false
            }
        );


    const parts =
        formatter.formatToParts(now);


    const values = {};


    for (const part of parts) {

        if (
            part.type !== "literal"
        ) {

            values[part.type] =
                part.value;
        }
    }


    return {

        publishDate:
            `${values.year}-${values.month}-${values.day}`,

        signalTimeNY:
            `${values.hour}:${values.minute}`
    };
}


async function executeSignal(signalData) {

    assertManualExternalAuthorization();

    const JournalAgent = require(
        "../02_Agents/01_Journal_Agent/agents/journalAgent"
    );
    const PublishingAgent = require(
        "../02_Agents/02_Publishing_Agent/publishingAgent"
    );

    console.log("================================");
    console.log("🚀 Swisschart Signal Execution");
    console.log("================================");


    // ==============================
    // 1. Validate input
    // ==============================

    if (!signalData) {

        throw new Error(
            "Signal data is missing"
        );
    }


    // ==============================
    // 2. Generate New York timestamp
    // ==============================

    const newYorkDateTime =
        getNewYorkDateTime();


    signalData.publishDate =
        newYorkDateTime.publishDate;


    signalData.signalTimeNY =
        newYorkDateTime.signalTimeNY;


    console.log(
        "📅 Publish Date:",
        signalData.publishDate
    );


    console.log(
        "🕒 Signal Time NY:",
        signalData.signalTimeNY
    );


    // ==============================
    // 3. Create normalized Signal
    // ==============================

    const signal =
        createSignal(
            signalData
        );


    console.log(
        "✅ Signal data validated"
    );


    // ==============================
    // 4. Publishing Agent
    // ==============================

    const publishingAgent =
        new PublishingAgent();


    // ==============================
    // 5. Risk Reminder
    // ==============================

    const riskReminder =
        createRiskReminder();


    await publishingAgent.telegram.sendMessage(
        riskReminder
    );


    console.log(
        "✅ Risk Reminder published"
    );


    // ==============================
    // 6. Journal Agent
    // ==============================

    const journalAgent =
        new JournalAgent();


    // ==============================
    // 7. Generate Trade ID
    // ==============================

    const tradeId =
        signal.tradeId ||
        await journalAgent.generateTradeId();


    console.log(
        `🆔 Trade ID: ${tradeId}`
    );


    // ==============================
    // 8. Add Trade ID
    // ==============================

    signal.tradeId =
        tradeId;


    // ==============================
    // 9. Publish Signal
    // ==============================

    await publishingAgent.publishSignal(
        signal
    );


    console.log(
        "✅ Signal published to Telegram"
    );


    // ==============================
    // 10. Save to Notion
    // ==============================

    await journalAgent.createTrade(
        signal
    );


    console.log(
        "✅ Signal saved to Notion"
    );


    console.log("================================");


    console.log(
        `✅ ${tradeId} execution completed`
    );


    console.log("================================");


    return signal;
}


function assertManualExternalAuthorization() {

    const required = [
        "SWISSCHART_ALLOW_REAL_EXTERNAL_ACTIONS",
        "SWISSCHART_CONFIRM_TELEGRAM_SEND",
        "SWISSCHART_CONFIRM_NOTION_WRITE"
    ];

    const missing = required.filter(
        name => process.env[name] !== "true"
    );

    if (
        process.env.SWISSCHART_EXTERNAL_TARGET !== "production" ||
        missing.length > 0
    ) {
        const error = new Error(
            "Legacy signal execution is manual-only and requires explicit production target plus Telegram and Notion confirmations"
        );
        error.code = "LEGACY_SIGNAL_MANUAL_AUTHORIZATION_REQUIRED";
        throw error;
    }

    console.warn(
        "WARNING: MANUAL EXTERNAL ACTION AUTHORIZED: Telegram send + Notion write"
    );
}


module.exports =
    executeSignal;

const path = require("path");

const dotenv = require(
    path.join(
        __dirname,
        "../02_Agents/01_Journal_Agent/node_modules/dotenv"
    )
);

dotenv.config({
    path: path.join(
        __dirname,
        "../02_Agents/01_Journal_Agent/.env"
    ),
    override: true
});

const { createSignal } =
    require("./signalWorkflow");

const { createRiskReminder } =
    require("./riskReminder");

const JournalAgent =
    require(
        "../02_Agents/01_Journal_Agent/agents/journalAgent"
    );

const PublishingAgent =
    require(
        "../02_Agents/02_Publishing_Agent/index02"
    );


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


module.exports =
    executeSignal;
const JournalAgent =
    require(
        "../02_Agents/01_Journal_Agent/agents/journalAgent"
    );

// ==================================================
// Swisschart Trade Lifecycle
// ==================================================
//
// EVENT DRIVEN
//
// This workflow does NOT detect TP / SL automatically.
// It only records an event received from Assistant/User.
//
// All dates and times:
// America/New_York
// ==================================================


// ==================================================
// New York Date / Time
// ==================================================

function getNewYorkDateTime() {

    const now =
        new Date();

    const formatter =
        new Intl.DateTimeFormat(
            "en-US",
            {
                timeZone:
                    "America/New_York",

                year:
                    "numeric",

                month:
                    "2-digit",

                day:
                    "2-digit",

                hour:
                    "2-digit",

                minute:
                    "2-digit",

                second:
                    "2-digit",

                hour12:
                    false
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

        date:
            `${values.year}-${values.month}-${values.day}`,

        time:
            `${values.hour}:${values.minute}:${values.second}`
    };
}


// ==================================================
// Validation
// ==================================================

function validateTradeId(tradeId) {

    if (
        !tradeId ||
        typeof tradeId !== "string"
    ) {

        throw new Error(
            "Trade ID is required"
        );
    }
}


// ==================================================
// Get Current Trade
// ==================================================

async function getCurrentTrade(
    tradeId
) {

    validateTradeId(tradeId);

    const journalAgent =
        new JournalAgent();

    const trade =
        await journalAgent.getTradeById(
            tradeId
        );

    if (!trade) {

        throw new Error(
            `Trade ${tradeId} not found`
        );
    }

    return trade;
}


// ==================================================
// Get Current Trade State
// ==================================================

function getTradeState(
    trade
) {

    return (
        trade
            ?.properties
            ?.["Trade State"]
            ?.select
            ?.name
        || null
    );
}


// ==================================================
// Closed Trade Protection
// ==================================================
//
// Once Trade State = Close,
// no lifecycle event may modify the trade.
//
// This protection is intentionally centralized
// so every event uses the same rule.
// ==================================================

async function ensureTradeIsNotClosed(
    tradeId
) {

    const trade =
        await getCurrentTrade(
            tradeId
        );

    const tradeState =
        getTradeState(
            trade
        );

    if (
        tradeState === "Close"
    ) {

        throw new Error(
            `Trade ${tradeId} is already closed`
        );
    }

    return trade;
}


// ==================================================
// ACTIVATE
// ==================================================

async function activateTrade(
    tradeId
) {

    await ensureTradeIsNotClosed(
        tradeId
    );

    const journalAgent =
        new JournalAgent();

    const ny =
        getNewYorkDateTime();

    return await journalAgent.updateTrade(
        tradeId,
        {

            status:
                "Active",

            tradeState:
                "Active",

            result:
                "Active",

            activationDate:
                ny.date,

            activationTimeNY:
                ny.time
        }
    );
}


// ==================================================
// TP1 HIT
// ==================================================

async function hitTP1(
    tradeId
) {

    await ensureTradeIsNotClosed(
        tradeId
    );

    const journalAgent =
        new JournalAgent();

    const ny =
        getNewYorkDateTime();

    return await journalAgent.updateTrade(
        tradeId,
        {

            status:
                "TP1",

            tp1Date:
                ny.date,

            tp1TimeNY:
                ny.time
        }
    );
}


// ==================================================
// TP2 HIT
// ==================================================

async function hitTP2(
    tradeId
) {

    await ensureTradeIsNotClosed(
        tradeId
    );

    const journalAgent =
        new JournalAgent();

    const ny =
        getNewYorkDateTime();

    return await journalAgent.updateTrade(
        tradeId,
        {

            status:
                "TP2",

            tp2Date:
                ny.date,

            tp2TimeNY:
                ny.time
        }
    );
}


// ==================================================
// TP3 HIT
// ==================================================

async function hitTP3(
    tradeId,
    options = {}
) {

    await ensureTradeIsNotClosed(
        tradeId
    );

    const journalAgent =
        new JournalAgent();

    const ny =
        getNewYorkDateTime();

    const data = {

        status:
            "TP3",

        tp3Date:
            ny.date,

        tp3TimeNY:
            ny.time
    };


    // TP3 alone does NOT mean Close.
    //
    // Close is only recorded when
    // closeTrade === true.

    if (
        options.closeTrade === true
    ) {

        data.result =
            options.result ||
            "Win";

        data.tradeState =
            "Close";

        data.closeDate =
            ny.date;

        data.closeTimeNY =
            ny.time;


        if (
            options.finalRR !== undefined
        ) {

            data.finalRR =
                options.finalRR;
        }
    }


    return await journalAgent.updateTrade(
        tradeId,
        data
    );
}


// ==================================================
// STOP LOSS
// ==================================================

async function hitSL(
    tradeId,
    options = {}
) {

    await ensureTradeIsNotClosed(
        tradeId
    );

    const journalAgent =
        new JournalAgent();

    const ny =
        getNewYorkDateTime();

    const data = {

        status:
            "SL",

        result:
            "Loss",

        tradeState:
            "Close",

        closeDate:
            ny.date,

        closeTimeNY:
            ny.time
    };


    if (
        options.finalRR !== undefined
    ) {

        data.finalRR =
            options.finalRR;
    }


    return await journalAgent.updateTrade(
        tradeId,
        data
    );
}


// ==================================================
// BREAK EVEN
// ==================================================

async function markBE(
    tradeId,
    options = {}
) {

    await ensureTradeIsNotClosed(
        tradeId
    );

    const journalAgent =
        new JournalAgent();

    const ny =
        getNewYorkDateTime();

    const data = {

        status:
            "BE",

        result:
            "BE",

        tradeState:
            "Close",

        closeDate:
            ny.date,

        closeTimeNY:
            ny.time
    };


    if (
        options.finalRR !== undefined
    ) {

        data.finalRR =
            options.finalRR;
    }


    return await journalAgent.updateTrade(
        tradeId,
        data
    );
}


// ==================================================
// CANCELLED
// ==================================================

async function cancelTrade(
    tradeId
) {

    await ensureTradeIsNotClosed(
        tradeId
    );

    const journalAgent =
        new JournalAgent();

    const ny =
        getNewYorkDateTime();

    return await journalAgent.updateTrade(
        tradeId,
        {

            status:
                "Cancelled",

            result:
                "Cancelled",

            tradeState:
                "Close",

            closeDate:
                ny.date,

            closeTimeNY:
                ny.time
        }
    );
}


// ==================================================
// MISSED
// ==================================================

async function markMissed(
    tradeId
) {

    await ensureTradeIsNotClosed(
        tradeId
    );

    const journalAgent =
        new JournalAgent();

    const ny =
        getNewYorkDateTime();

    return await journalAgent.updateTrade(
        tradeId,
        {

            status:
                "Missed",

            result:
                "Missed",

            tradeState:
                "Close",

            closeDate:
                ny.date,

            closeTimeNY:
                ny.time
        }
    );
}


// ==================================================
// CLOSE TRADE
// ==================================================

async function closeTrade(
    tradeId,
    options = {}
) {

    await ensureTradeIsNotClosed(
        tradeId
    );

    const journalAgent =
        new JournalAgent();

    const ny =
        getNewYorkDateTime();

    const data = {

        tradeState:
            "Close",

        closeDate:
            ny.date,

        closeTimeNY:
            ny.time
    };


    if (
        options.status !== undefined
    ) {

        data.status =
            options.status;
    }


    if (
        options.result !== undefined
    ) {

        data.result =
            options.result;
    }


    if (
        options.finalRR !== undefined
    ) {

        data.finalRR =
            options.finalRR;
    }


    return await journalAgent.updateTrade(
        tradeId,
        data
    );
}


// ==================================================
// EXPORT
// ==================================================

module.exports = {

    getNewYorkDateTime,

    getCurrentTrade,

    ensureTradeIsNotClosed,

    activateTrade,

    hitTP1,

    hitTP2,

    hitTP3,

    hitSL,

    markBE,

    cancelTrade,

    markMissed,

    closeTrade
};

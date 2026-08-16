function calculateStopSize(pair, entry, stopLoss) {

    const difference =
        Math.abs(entry - stopLoss);

    if (
        pair.includes("USD") ||
        pair.includes("EUR") ||
        pair.includes("GBP") ||
        pair.includes("AUD") ||
        pair.includes("NZD") ||
        pair.includes("CAD") ||
        pair.includes("CHF")
    ) {
        return Number(
            (difference * 10000).toFixed(1)
        );
    }

    return Number(
        difference.toFixed(2)
    );
}


function calculateRR(
    entry,
    stopLoss,
    takeProfit
) {

    const risk =
        Math.abs(entry - stopLoss);

    const reward =
        Math.abs(takeProfit - entry);

    if (risk === 0) {
        return null;
    }

    return Number(
        (reward / risk).toFixed(1)
    );
}


function convertGradeToStars(grade) {

    const numericGrade =
        Number(grade);

    if (
        !Number.isInteger(numericGrade) ||
        numericGrade < 1 ||
        numericGrade > 5
    ) {
        throw new Error(
            "Grade must be a number between 1 and 5"
        );
    }

    return "⭐".repeat(
        numericGrade
    );
}


function validateSignalInput(data) {

    const required = [
        "pair",
        "direction",
        "entry",
        "stopLoss",
        "tp1",
        "tp2",
        "tp3",
        "risk",
        "grade"
    ];

    const missing =
        required.filter(
            field =>
                data[field] === undefined ||
                data[field] === null ||
                data[field] === ""
        );

    if (missing.length > 0) {

        throw new Error(
            `Missing signal data: ${missing.join(", ")}`
        );
    }
}


function createSignal(signalData) {

    validateSignalInput(
        signalData
    );

    const entry =
        Number(signalData.entry);

    const stopLoss =
        Number(signalData.stopLoss);

    const tp1 =
        Number(signalData.tp1);

    const tp2 =
        Number(signalData.tp2);

    const tp3 =
        Number(signalData.tp3);

    const grade =
        convertGradeToStars(
            signalData.grade
        );

    const stopSize =
        calculateStopSize(
            signalData.pair,
            entry,
            stopLoss
        );

    const rrTp1 =
        calculateRR(
            entry,
            stopLoss,
            tp1
        );

    const rrTp2 =
        calculateRR(
            entry,
            stopLoss,
            tp2
        );

    const rrTp3 =
        calculateRR(
            entry,
            stopLoss,
            tp3
        );

    // Planned RR is based on the final TP
    // declared in the signal

    const plannedRR =
        rrTp3;


    return {

        // Identity

        tradeId:
            signalData.tradeId || null,

        grade,


        // Publish Info

        publishDate:
            signalData.publishDate || null,

        signalTimeNY:
            signalData.signalTimeNY || null,


        // Trade

        pair:
            signalData.pair,

        direction:
            signalData.direction,

        entry,

        stopLoss,

        stopSize,

        tp1,

        tp2,

        tp3,

        risk:
            signalData.risk,


        // R:R

        rrTp1:
            rrTp1 !== null
                ? `1:${rrTp1}`
                : null,

        rrTp2:
            rrTp2 !== null
                ? `1:${rrTp2}`
                : null,

        rrTp3:
            rrTp3 !== null
                ? `1:${rrTp3}`
                : null,


        // Planned RR
        // Stored as numeric value for Notion

        plannedRR,


        // Final RR remains empty
        // until the trade is completed

        finalRR:
            null,


        // Journal

        maxRBeforeSL:
            signalData.maxRBeforeSL ?? null,


        // Evidence

        signalScreenshot:
            signalData.signalScreenshot || null,

        tradingViewLink:
            signalData.tradingViewLink || null,

        finalScreenshot:
            signalData.finalScreenshot || null,


        // Telegram

        telegramMessage:
            signalData.telegramMessage || null,

        riskReminder:
            signalData.riskReminder || null
    };
}


module.exports = {
    createSignal,
    calculateStopSize,
    calculateRR
};

function formatContentFooter() {

    return [
        "",
        "As precise as a Swiss watch",
        "",
        '<a href="' + 'https://' + 'linktr.ee/swisschart' + '">Swisschart Links</a>'
    ].join("\n");
}


function formatMorningMessage(data = {}) {

    return [
        "âک€ï¸ڈ GOOD MORNING",
        "",
        data.date || "",
        "",
        data.summary || "",
        "",
        data.focus || "",
        formatContentFooter()
    ]
        .filter(Boolean)
        .join("\n");
}


function formatMarketUpdate(data = {}) {

    return [
        "ًں“ٹ MARKET UPDATE",
        "",
        data.market || "",
        "",
        data.analysis || "",
        "",
        data.keyLevels
            ? "ًںژ¯ Key Levels\n" + data.keyLevels
            : "",
        "",
        data.outlook
            ? "ًں“Œ Outlook\n" + data.outlook
            : "",
        formatContentFooter()
    ]
        .filter(Boolean)
        .join("\n");
}


function formatSessionMessage(session, data = {}) {

    const titles = {

        londonOpen:
            "ًں‡¬ًں‡§ LONDON OPEN",

        newYorkOpen:
            "ًں‡؛ًں‡¸ NEW YORK OPEN",

        londonClose:
            "ًں‡¬ًں‡§ LONDON CLOSE",

        newYorkClose:
            "ًں‡؛ًں‡¸ NEW YORK CLOSE"
    };


    const title =
        titles[session] ||
        "ًں“ٹ SESSION UPDATE";


    return [
        title,
        "",
        data.summary || "",
        "",
        data.market
            ? "ًں“ٹ Market\n" + data.market
            : "",
        "",
        data.focus
            ? "ًںژ¯ Focus\n" + data.focus
            : "",
        "",
        data.risk
            ? "âڑ ï¸ڈ Risk\n" + data.risk
            : "",
        formatContentFooter()
    ]
        .filter(Boolean)
        .join("\n");
}
module.exports = {
    formatMorningMessage,
    formatMarketUpdate,
    formatSessionMessage
};


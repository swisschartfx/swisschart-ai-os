function formatTelegramSignal(signal) {
    return [
        signal.tradeId,
        "",
        signal.grade,
        "",
        "📊 " + signal.pair,
        "📍 " + signal.direction,
        "",
        "🎯 Entry: " + signal.entry,
        "",
        "🛑 SL: " + signal.stopLoss,
        "🛑 Stop Size: " + signal.stopSize + " pips",
        "",
        "💰 TP1: " + signal.tp1,
        "💰 TP2: " + signal.tp2,
        "💰 TP3: " + signal.tp3,
        "",
        "⚠️ Risk: " + signal.risk,
        "",
        "📊 R:R TP1 — " + signal.rrTp1,
        "📊 R:R TP2 — " + signal.rrTp2,
        "📊 R:R TP3 — " + signal.rrTp3,
        "",
        "As precise as a Swiss watch",
        "",
        '<a href="https://linktr.ee/swisschart">Swisschart Links</a>'
    ].join("\n");
}

module.exports = formatTelegramSignal;
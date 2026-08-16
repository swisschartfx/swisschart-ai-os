function formatSignal(signal) {

    return `
${signal.riskReminder}

${signal.tradeId}
${signal.grade}

📊 ${signal.pair}
📍 ${signal.direction}

🎯 Entry: ${signal.entry}

🛑 SL: ${signal.stopLoss}
🛑 Stop Size: ${signal.stopSize} pips

💰 TP1: ${signal.tp1}
💰 TP2: ${signal.tp2}

📊 R:R TP1 — ${signal.rrTp1}
📊 R:R TP2 — ${signal.rrTp2}

As precise as a Swiss watch

Swisschart Links
`.trim();

}

module.exports = formatSignal;
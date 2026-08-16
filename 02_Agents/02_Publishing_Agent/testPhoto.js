require("dotenv").config({
    path: __dirname + "/.env"
});

const TelegramService = require("./services/telegram");

async function main() {

    const telegram = new TelegramService();

    const photoPath =
        "C:\\PATH\\TO\\YOUR\\CHART.png";

    const caption =
`🧪 Swisschart Photo Test

📊 GBPUSD
📍 SELL

🎯 Entry: 1.35755
🛑 SL: 1.35813

Test photo + caption`;

    const result = await telegram.sendPhoto(
        photoPath,
        caption
    );

    console.log("✅ Photo test successful");
    console.log(result);
}

main().catch(error => {

    console.error("❌ Photo test failed:");
    console.error(error.message);

});
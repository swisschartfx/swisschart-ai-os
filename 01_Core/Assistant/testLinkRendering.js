const dotenv = require("../../02_Agents/02_Publishing_Agent/node_modules/dotenv");

dotenv.config({
    path: "./02_Agents/02_Publishing_Agent/.env"
});

const TelegramService =
    require("../../02_Agents/02_Publishing_Agent/services/telegram");

async function run() {

    const telegram =
        new TelegramService();

    console.log("==============================");
    console.log("🔗 TELEGRAM LINK TEST");
    console.log("==============================");

    const correctLink =
        '<a href="https://linktr.ee/swisschart">Swisschart Links</a>';

    const currentLink =
        '<a href="[https://linktr.ee/swisschart](https://linktr.ee/swisschart)">Swisschart Links</a>';

    console.log("Sending TEST 1...");

    await telegram.sendMessage(
        "TEST 1 — STANDARD HTML\n\n" +
        correctLink
    );

    console.log("✅ TEST 1 SENT");

    console.log("Sending TEST 2...");

    await telegram.sendMessage(
        "TEST 2 — CURRENT FORMAT\n\n" +
        currentLink
    );

    console.log("✅ TEST 2 SENT");

    console.log("==============================");
    console.log("✅ BOTH TESTS SENT");
    console.log("==============================");
}

run().catch(error => {
    console.error("❌ TEST FAILED");
    console.error(error);
});

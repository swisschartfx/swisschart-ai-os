const executeSignal =
    require("../../03_Workflows/signalExecution");


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


    console.log("==============================");
    console.log("🚀 REAL SIGNAL TEST");
    console.log("==============================");


    const signal =
        await executeSignal(
            signalData
        );


    console.log("==============================");
    console.log("✅ REAL TEST COMPLETED");
    console.log("==============================");


    console.log(signal);
}


main().catch(error => {

    console.error("==============================");
    console.error("❌ REAL TEST FAILED");
    console.error("==============================");

    console.error(error);
});
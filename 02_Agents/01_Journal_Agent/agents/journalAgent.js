const notion = require("../services/notion");
const { createNextTradeId } = require("../../../02_Core/Signals/tradeIdContract");


class JournalAgent {


    async readTrades() {

        const response =
            await notion.dataSources.query({

                data_source_id:
                    process.env.NOTION_DATA_SOURCE_ID,
            });

        return response.results;
    }


    async generateTradeId() {

        const trades =
            await this.readTrades();


        const ids = trades.map((trade) => trade.properties["Trade ID"]
            ?.title?.[0]?.plain_text || "");
        return createNextTradeId(ids, new Date()).tradeId;
    }


    async createTrade(signal) {

        const tradeId =
            signal.tradeId ||
            await this.generateTradeId();


        const trade = {
            ...signal,
            tradeId
        };


        console.log(
            "Creating new trade..."
        );

        console.log(trade);


        const properties = {


            "Trade ID": {
                title: [
                    {
                        text: {
                            content:
                                trade.tradeId,
                        },
                    },
                ],
            },


            "Grade": {
                select: {
                    name:
                        trade.grade || "",
                },
            },


            "Pair": {
                select: {
                    name:
                        trade.pair || "",
                },
            },


            "Direction": {
                select: {
                    name:
                        trade.direction || "",
                },
            },


            // ==============================
            // Initial Trade State
            // ==============================

            "Result": {
                select: {
                    name: "Pending",
                },
            },


            "Trade State": {
                select: {
                    name: "Pending",
                },
            },


            "Status": {
                select: {
                    name: "Pending",
                },
            },


            "Entry": {
                rich_text: [
                    {
                        text: {
                            content:
                                String(
                                    trade.entry ?? ""
                                ),
                        },
                    },
                ],
            },


            "Stop Loss": {
                rich_text: [
                    {
                        text: {
                            content:
                                String(
                                    trade.stopLoss ?? ""
                                ),
                        },
                    },
                ],
            },


            "TP1 Price": {
                rich_text: [
                    {
                        text: {
                            content:
                                String(
                                    trade.tp1 ?? ""
                                ),
                        },
                    },
                ],
            },


            "TP2 Price": {
                rich_text: [
                    {
                        text: {
                            content:
                                String(
                                    trade.tp2 ?? ""
                                ),
                        },
                    },
                ],
            },


            "TP3 Price": {
                rich_text: [
                    {
                        text: {
                            content:
                                String(
                                    trade.tp3 ?? ""
                                ),
                        },
                    },
                ],
            },


            "Stop size(pip)": {
                number:
                    Number(
                        trade.stopSize
                    ) || 0,
            },


            "Max R Before SL": {
                number:
                    trade.maxRBeforeSL ?? null,
            },
        };


        // ==============================
        // Risk %
        // ==============================

        if (
            trade.risk !== undefined &&
            trade.risk !== null &&
            trade.risk !== ""
        ) {

            const riskPercent =
                typeof trade.risk === "string"
                    ? Number(
                        trade.risk
                            .replace("%", "")
                            .trim()
                    )
                    : Number(
                        trade.risk
                    );


            if (
                Number.isFinite(riskPercent)
            ) {

                properties["Risk %"] = {

                    number:
                        riskPercent,
                };
            }
        }


        // ==============================
        // Planned RR
        // ==============================

        if (
            trade.plannedRR !== undefined &&
            trade.plannedRR !== null
        ) {

            const plannedRR =
                typeof trade.plannedRR === "string"
                    ? Number(
                        trade.plannedRR
                            .replace("1:", "")
                            .trim()
                    )
                    : Number(
                        trade.plannedRR
                    );


            if (
                Number.isFinite(plannedRR)
            ) {

                properties["Planned RR"] = {

                    number:
                        plannedRR,
                };
            }
        }


        // ==============================
        // Publish Date
        // ==============================

        if (
            trade.publishDate
        ) {

            properties["Publish Date"] = {

                date: {
                    start:
                        trade.publishDate,
                },
            };
        }


        // ==============================
        // Signal Time NY
        // ==============================

        if (
            trade.signalTimeNY
        ) {

            properties["Signal Time NY"] = {

                rich_text: [
                    {
                        text: {
                            content:
                                String(
                                    trade.signalTimeNY
                                ),
                        },
                    },
                ],
            };
        }


        // ==============================
        // Final RR
        // ==============================

        if (
            trade.finalRR !== null &&
            trade.finalRR !== undefined
        ) {

            const finalRR =
                typeof trade.finalRR === "string"
                    ? Number(
                        trade.finalRR
                            .replace("1:", "")
                    )
                    : Number(
                        trade.finalRR
                    );


            if (
                Number.isFinite(finalRR)
            ) {

                properties["Final RR"] = {

                    number:
                        finalRR,
                };
            }
        }


        // ==============================
        // TradingView
        // ==============================

        if (
            trade.tradingViewLink
        ) {

            properties[
                "TradingView Link"
            ] = {

                url:
                    trade.tradingViewLink,
            };
        }


        // ==============================
        // Signal Screenshot
        // ==============================

        if (
            trade.signalScreenshot
        ) {

            properties[
                "Signal Screenshot"
            ] = {

                files: [
                    {
                        type:
                            "external",

                        name:
                            "Signal Screenshot",

                        external: {
                            url:
                                trade.signalScreenshot,
                        },
                    },
                ],
            };
        }


        // ==============================
        // Result Screenshot
        // ==============================

        if (
            trade.finalScreenshot
        ) {

            properties[
                "Result Screenshot"
            ] = {

                files: [
                    {
                        type:
                            "external",

                        name:
                            "Result Screenshot",

                        external: {
                            url:
                                trade.finalScreenshot,
                        },
                    },
                ],
            };
        }


        const response =
            await notion.pages.create({

                parent: {
                    data_source_id:
                        process.env.NOTION_DATA_SOURCE_ID,
                },

                properties,
            });


        console.log(
            `Trade ${trade.tradeId} created in Notion`
        );


        return response;
    }


    async updateTrade(id, data) {

        console.log(
            `Updating trade ${id}...`
        );


        const trade =
            await this.getTradeById(id);


        if (!trade) {

            throw new Error(
                `Trade ${id} not found`
            );
        }


        const properties = {};


        // ==============================
        // Status
        // ==============================

        if (
            data.status !== undefined
        ) {

            properties["Status"] = {

                select: {
                    name:
                        data.status,
                },
            };
        }


        // ==============================
        // Trade State
        // ==============================

        if (
            data.tradeState !== undefined
        ) {

            properties["Trade State"] = {

                select: {
                    name:
                        data.tradeState,
                },
            };
        }


        // ==============================
        // Publish Date
        // ==============================

        if (
            data.publishDate !== undefined
        ) {

            properties["Publish Date"] = {

                date:
                    data.publishDate
                        ? {
                            start:
                                data.publishDate
                        }
                        : null,
            };
        }


        // ==============================
        // Signal Time NY
        // ==============================

        if (
            data.signalTimeNY !== undefined
        ) {

            properties["Signal Time NY"] = {

                rich_text: [
                    {
                        text: {
                            content:
                                String(
                                    data.signalTimeNY
                                ),
                        },
                    },
                ],
            };
        }


        // ==============================
        // Final RR
        // ==============================

        if (
            data.finalRR !== undefined
        ) {

            const finalRR =
                typeof data.finalRR === "string"
                    ? Number(
                        data.finalRR
                            .replace("1:", "")
                    )
                    : Number(
                        data.finalRR
                    );


            properties["Final RR"] = {

                number:
                    Number.isFinite(finalRR)
                        ? finalRR
                        : null,
            };
        }


        // ==============================
        // Activation
        // ==============================

        if (
            data.activationDate !== undefined
        ) {

            properties["Activation Date"] = {

                date:
                    data.activationDate
                        ? {
                            start:
                                data.activationDate
                        }
                        : null,
            };
        }


        if (
            data.activationTimeNY !== undefined
        ) {

            properties["Activation Time NY"] = {

                rich_text: [
                    {
                        text: {
                            content:
                                String(
                                    data.activationTimeNY
                                ),
                        },
                    },
                ],
            };
        }


        // ==============================
        // TP1
        // ==============================

        if (
            data.tp1Date !== undefined
        ) {

            properties["TP1 Date"] = {

                date:
                    data.tp1Date
                        ? {
                            start:
                                data.tp1Date
                        }
                        : null,
            };
        }


        if (
            data.tp1TimeNY !== undefined
        ) {

            properties["TP1 Time NY"] = {

                rich_text: [
                    {
                        text: {
                            content:
                                String(
                                    data.tp1TimeNY
                                ),
                        },
                    },
                ],
            };
        }


        // ==============================
        // TP2
        // ==============================

        if (
            data.tp2Date !== undefined
        ) {

            properties["TP2 Date"] = {

                date:
                    data.tp2Date
                        ? {
                            start:
                                data.tp2Date
                        }
                        : null,
            };
        }


        if (
            data.tp2TimeNY !== undefined
        ) {

            properties["TP2 Time NY"] = {

                rich_text: [
                    {
                        text: {
                            content:
                                String(
                                    data.tp2TimeNY
                                ),
                        },
                    },
                ],
            };
        }


        // ==============================
        // TP3
        // ==============================

        if (
            data.tp3Date !== undefined
        ) {

            properties["TP3 Date"] = {

                date:
                    data.tp3Date
                        ? {
                            start:
                                data.tp3Date
                        }
                        : null,
            };
        }


        if (
            data.tp3TimeNY !== undefined
        ) {

            properties["TP3 Time NY"] = {

                rich_text: [
                    {
                        text: {
                            content:
                                String(
                                    data.tp3TimeNY
                                ),
                        },
                    },
                ],
            };
        }


        // ==============================
        // Close
        // ==============================

        if (
            data.closeDate !== undefined
        ) {

            properties["Close Date"] = {

                date:
                    data.closeDate
                        ? {
                            start:
                                data.closeDate
                        }
                        : null,
            };
        }


        if (
            data.closeTimeNY !== undefined
        ) {

            properties["Close Time NY"] = {

                rich_text: [
                    {
                        text: {
                            content:
                                String(
                                    data.closeTimeNY
                                ),
                        },
                    },
                ],
            };
        }


        // ==============================
        // Trade Results
        // ==============================

        if (
            data.maxTPReached !== undefined
        ) {

            properties["Max TP Reached"] = {

                select: {
                    name:
                        data.maxTPReached,
                },
            };
        }


        if (
            data.maxRBeforeSL !== undefined
        ) {

            properties["Max R Before SL"] = {

                number:
                    data.maxRBeforeSL,
            };
        }


        if (
            data.plannedRR !== undefined
        ) {

            properties["Planned RR"] = {

                number:
                    data.plannedRR,
            };
        }


        if (
            data.cumulativeRR !== undefined
        ) {

            properties["Cumulative RR"] = {

                number:
                    data.cumulativeRR,
            };
        }


        if (
            data.rewardSizePip !== undefined
        ) {

            properties["Reward Size(pip)"] = {

                number:
                    data.rewardSizePip,
            };
        }


        if (
            data.riskPercent !== undefined
        ) {

            properties["Risk %"] = {

                number:
                    data.riskPercent,
            };
        }


        if (
            data.result !== undefined
        ) {

            properties["Result"] = {

                select: {
                    name:
                        data.result,
                },
            };
        }


        // ==============================
        // TradingView
        // ==============================

        if (
            data.tradingViewLink !== undefined
        ) {

            properties[
                "TradingView Link"
            ] = {

                url:
                    data.tradingViewLink || null,
            };
        }


        // ==============================
        // Result Screenshot
        // ==============================

        if (
            data.finalScreenshot
        ) {

            properties[
                "Result Screenshot"
            ] = {

                files: [
                    {
                        type:
                            "external",

                        name:
                            "Result Screenshot",

                        external: {
                            url:
                                data.finalScreenshot,
                        },
                    },
                ],
            };
        }


        // ==============================
        // Nothing to update
        // ==============================

        if (
            Object.keys(properties).length === 0
        ) {

            console.log(
                "No properties to update"
            );

            return trade;
        }


        const response =
            await notion.pages.update({

                page_id:
                    trade.id,

                properties,
            });


        console.log(
            `Trade ${id} updated`
        );


        return response;
    }


    async closeTrade(id, result) {

        console.log(
            `Closing trade ${id}...`
        );


        return await this.updateTrade(
            id,
            result
        );
    }


    async getTradeById(id) {

        const trades =
            await this.readTrades();


        return trades.find(

            trade =>

                trade.properties["Trade ID"]
                    ?.title?.[0]?.plain_text === id
        );
    }

}


module.exports =
    JournalAgent;

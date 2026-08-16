function createDefaultPublisher() {
    const PublishingAgentClass = require("../../02_Agents/02_Publishing_Agent/index02");
    return new PublishingAgentClass();
}

class PublishingAgentExecutor {
    constructor(options = {}) {
        this.publisherFactory = options.publisherFactory || createDefaultPublisher;
    }

    async execute(instruction) {
        if (!instruction || instruction.action !== "publishContent") {
            throw new Error("Unsupported Publishing Agent execution instruction");
        }

        const publisher = this.publisherFactory();
        const telegramResponse = await publisher.publishContent(instruction.message);

        if (!telegramResponse || !telegramResponse.message_id) {
            const error = new Error("Telegram response did not contain a verified message_id");
            error.code = "TELEGRAM_RESPONSE_UNVERIFIED";
            throw error;
        }

        return {
            output: {
                publicationType: "text",
                destination: instruction.destination,
                messageLength: instruction.message.length
            },
            externalReferences: [{
                platform: "telegram",
                messageId: telegramResponse.message_id,
                chatId: telegramResponse.chat && telegramResponse.chat.id
                    ? telegramResponse.chat.id
                    : null
            }],
            evidence: [{
                type: "telegram_response",
                verifiedFields: ["message_id"]
            }]
        };
    }
}

module.exports = PublishingAgentExecutor;

const PublishingAgent =
    require("../02_Publishing_Agent/index02");

const {
    formatMorningMessage,
    formatMarketUpdate,
    formatSessionMessage
} =
    require("./utils/contentFormatter");


class ContentAgent {

    constructor() {

        this.publisher =
            new PublishingAgent();

    }


    async publishMorningMessage(data = {}) {

        const message =
            formatMorningMessage(data);

        return await this.publisher.publishContent(
            message
        );
    }


    async publishMarketUpdate(data = {}) {

        const message =
            formatMarketUpdate(data);

        return await this.publisher.publishContent(
            message
        );
    }


    async publishSessionMessage(session, data = {}) {

        const message =
            formatSessionMessage(
                session,
                data
            );

        return await this.publisher.publishContent(
            message
        );
    }

}


module.exports =
    ContentAgent;
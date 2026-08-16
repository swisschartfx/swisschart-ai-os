const fs = require("fs");
const path = require("path");

class TelegramService {

    constructor() {

        this.botToken =
            process.env.TELEGRAM_BOT_TOKEN;

        this.chatId =
            process.env.TELEGRAM_CHAT_ID;

        if (!this.botToken) {
            throw new Error(
                "TELEGRAM_BOT_TOKEN is missing"
            );
        }

        if (!this.chatId) {
            throw new Error(
                "TELEGRAM_CHAT_ID is missing"
            );
        }

        this.baseUrl =
            `https://api.telegram.org/bot${this.botToken}`;
    }


    async request(method, body) {

        const response = await fetch(
            `${this.baseUrl}/${method}`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(body)
            }
        );

        const data =
            await response.json();

        if (!data.ok) {

            throw new Error(
                `Telegram API Error: ${data.description}`
            );
        }

        return data.result;
    }


    async sendMessage(message) {

        console.log(
            "Sending Telegram message..."
        );

        return await this.request(
            "sendMessage",
            {
                chat_id: this.chatId,
                text: message,
                parse_mode: "HTML",
                disable_web_page_preview: true
            }
        );
    }


    async sendPhoto(photo, caption) {

        console.log(
            "Sending Telegram photo..."
        );

        if (!photo) {

            throw new Error(
                "Photo path is missing"
            );
        }


        // Local file
        if (fs.existsSync(photo)) {

            const fileBuffer =
                await fs.promises.readFile(photo);

            const blob =
                new Blob([fileBuffer]);


            const form =
                new FormData();


            form.append(
                "chat_id",
                this.chatId
            );


            form.append(
                "photo",
                blob,
                path.basename(photo)
            );


            if (caption) {

                form.append(
                    "caption",
                    caption
                );
            }


            form.append(
                "parse_mode",
                "HTML"
            );


            const response =
                await fetch(
                    `${this.baseUrl}/sendPhoto`,
                    {
                        method: "POST",
                        body: form
                    }
                );


            const data =
                await response.json();


            if (!data.ok) {

                throw new Error(
                    `Telegram API Error: ${data.description}`
                );
            }


            return data.result;
        }


        // Telegram file_id or URL
        return await this.request(
            "sendPhoto",
            {
                chat_id: this.chatId,
                photo,
                caption,
                parse_mode: "HTML"
            }
        );
    }
}


module.exports = TelegramService;
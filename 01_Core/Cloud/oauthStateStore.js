const fs = require("fs");
const path = require("path");

const STATE_VERSION = 1;

class OAuthStateStore {
    constructor(options = {}) {
        if (typeof options.filePath !== "string" || !options.filePath.trim()) {
            throw new Error("OAuth state store requires a file path");
        }
        this.filePath = path.resolve(options.filePath);
        this.fs = options.fs || fs;
    }

    load() {
        try {
            const parsed = JSON.parse(this.fs.readFileSync(this.filePath, "utf8"));
            if (!parsed || parsed.version !== STATE_VERSION) return emptyState();
            return {
                clients: validEntries(parsed.clients),
                transactions: validEntries(parsed.transactions),
                codes: validEntries(parsed.codes),
                accessTokens: validEntries(parsed.accessTokens),
                refreshTokens: validEntries(parsed.refreshTokens),
                consumedRefreshTokens: validEntries(parsed.consumedRefreshTokens)
            };
        } catch (error) {
            if (error.code === "ENOENT") return emptyState();
            throw new Error("Unable to load persisted OAuth state", { cause: error });
        }
    }

    save(state) {
        const directory = path.dirname(this.filePath);
        this.fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
        const temporary = `${this.filePath}.${process.pid}.tmp`;
        const payload = JSON.stringify({ version: STATE_VERSION, ...state });
        try {
            this.fs.writeFileSync(temporary, payload, { encoding: "utf8", mode: 0o600 });
            this.fs.renameSync(temporary, this.filePath);
            try { this.fs.chmodSync(this.filePath, 0o600); } catch (error) {
                if (process.platform !== "win32") throw error;
            }
        } catch (error) {
            try { this.fs.unlinkSync(temporary); } catch (cleanupError) {
                if (cleanupError.code !== "ENOENT") throw cleanupError;
            }
            throw new Error("Unable to persist OAuth state", { cause: error });
        }
    }
}

function emptyState() {
    return { clients: [], transactions: [], codes: [], accessTokens: [],
        refreshTokens: [], consumedRefreshTokens: [] };
}

function validEntries(value) {
    return Array.isArray(value) ? value.filter((entry) =>
        Array.isArray(entry) && entry.length === 2 && typeof entry[0] === "string") : [];
}

module.exports = OAuthStateStore;

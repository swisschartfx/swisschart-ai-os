const fs = require("fs");
const path = require("path");

class SignalActionStore {
    constructor(options = {}) { this.filePath = path.resolve(options.filePath); this.fs = options.fs || fs; }
    load() { try { const value = JSON.parse(this.fs.readFileSync(this.filePath, "utf8")); return value && value.version === 1 && Array.isArray(value.actions) ? value.actions : []; } catch (error) { if (error.code === "ENOENT") return []; throw error; } }
    save(actions) { const dir = path.dirname(this.filePath); this.fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); const temporary = `${this.filePath}.${process.pid}.tmp`; this.fs.writeFileSync(temporary, JSON.stringify({ version: 1, actions }), { mode: 0o600 }); this.fs.renameSync(temporary, this.filePath); }
}
module.exports = SignalActionStore;

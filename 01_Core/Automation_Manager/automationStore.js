const fs = require("fs");
const path = require("path");

class AutomationStore {
    constructor(options = {}) {
        this.filePath = options.filePath || path.join(
            __dirname,
            "../../06_Data/Automation/automations.json"
        );
        this.automations = new Map();
    }

    load() {
        if (!fs.existsSync(this.filePath)) {
            this.save();
            return [];
        }

        const raw = fs.readFileSync(this.filePath, "utf8").trim();
        const records = raw ? JSON.parse(raw) : [];

        if (!Array.isArray(records)) {
            throw new Error("Automation storage must contain a JSON array");
        }

        this.automations = new Map(records.map(automation => [
            automation.automationId,
            clone(automation)
        ]));
        return this.getAll();
    }

    save() {
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
        fs.writeFileSync(
            this.filePath,
            `${JSON.stringify(this.getAll(), null, 2)}\n`,
            "utf8"
        );
        return this.getAll();
    }

    get(id) {
        const automation = this.automations.get(id);
        return automation ? clone(automation) : null;
    }

    getAll() {
        return Array.from(this.automations.values(), clone);
    }

    create(automation) {
        if (this.automations.has(automation.automationId)) {
            throw new Error(
                `Automation ${automation.automationId} already exists`
            );
        }

        this.automations.set(automation.automationId, clone(automation));
        this.save();
        return this.get(automation.automationId);
    }

    update(id, updates) {
        const existing = this.automations.get(id);

        if (!existing) {
            throw new Error(`Automation ${id} was not found`);
        }

        this.automations.set(id, clone({
            ...existing,
            ...updates,
            automationId: id
        }));
        this.save();
        return this.get(id);
    }

    delete(id) {
        const deleted = this.automations.delete(id);

        if (deleted) {
            this.save();
        }

        return deleted;
    }
}

function clone(value) {
    return structuredClone(value);
}

module.exports = AutomationStore;

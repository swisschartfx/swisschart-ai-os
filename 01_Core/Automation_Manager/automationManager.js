const AutomationStore = require("./automationStore");
const { randomUUID } = require("crypto");
const { Temporal } = require("@js-temporal/polyfill");
const {
    normalizeSchedule,
    schedulePayloadHash
} = require("./scheduleContract");
const ScheduleOccurrenceResolver = require(
    "../../02_Core/Time/scheduleOccurrenceResolver"
);

class AutomationManager {
    constructor(options = {}) {
        this.automationStore = options.automationStore === null
            ? null
            : options.automationStore || new AutomationStore();
        const storedAutomations = this.automationStore
            ? this.automationStore.load()
            : [];
        this.automations = new Map(storedAutomations.map(automation => [
            automation.automationId,
            cloneAutomation(automation)
        ]));
        this.scheduleStore = options.scheduleStore ||
            (this.automationStore &&
            typeof this.automationStore.savePreparedMutation === "function"
                ? this.automationStore : null);
        this.clock = options.clock || (() => new Date());
        this.approvalIdGenerator = options.approvalIdGenerator ||
            (() => `schedule-${randomUUID()}`);
        this.occurrenceResolver = options.occurrenceResolver ||
            new ScheduleOccurrenceResolver();
    }

    createAutomation(automation) {
        validateAutomation(automation);

        if (this.automations.has(automation.automationId)) {
            throw new Error(`Automation ${automation.automationId} already exists`);
        }

        const stored = cloneAutomation({
            automationId: automation.automationId,
            name: automation.name,
            enabled: automation.enabled === true,
            trigger: automation.trigger,
            ...(automation.action ? { action: automation.action } : {}),
            ...(automation.workflow ? { workflow: automation.workflow } : {}),
            approvalPolicy: automation.approvalPolicy,
            metadata: automation.metadata || {}
        });

        if (this.automationStore) {
            this.automationStore.create(stored);
        }
        this.automations.set(stored.automationId, stored);
        return cloneAutomation(stored);
    }

    createWorkflowAutomation(automation) {
        if (!automation || !automation.workflow) {
            throw new Error("Workflow automation requires workflow");
        }

        return this.createAutomation(automation);
    }

    getWorkflowAutomation(automationId) {
        const automation = this.getAutomation(automationId);
        return automation && automation.workflow ? automation : null;
    }

    updateWorkflowAutomation(automationId, workflow) {
        if (!workflow) {
            throw new Error("Workflow automation update requires workflow");
        }

        return this.updateAutomation(automationId, { workflow });
    }

    updateAutomation(automationId, updates) {
        const existing = this.requireAutomation(automationId);
        const updated = {
            ...existing,
            ...updates,
            automationId
        };

        validateAutomation(updated);
        const stored = cloneAutomation(updated);
        if (this.automationStore) {
            this.automationStore.update(automationId, stored);
        }
        this.automations.set(automationId, stored);
        return cloneAutomation(stored);
    }

    enableAutomation(automationId) {
        return this.updateAutomation(automationId, { enabled: true });
    }

    disableAutomation(automationId) {
        return this.updateAutomation(automationId, { enabled: false });
    }

    deleteAutomation(automationId) {
        const deleted = this.automations.delete(automationId);

        if (deleted && this.automationStore) {
            this.automationStore.delete(automationId);
        }

        return deleted;
    }

    getAutomation(automationId) {
        const automation = this.automations.get(automationId);
        return automation ? cloneAutomation(automation) : null;
    }

    getAutomations(options = {}) {
        return Array.from(this.automations.values())
            .filter(automation => options.enabled === undefined ||
                automation.enabled === options.enabled)
            .map(cloneAutomation);
    }

    requireAutomation(automationId) {
        const automation = this.automations.get(automationId);

        if (!automation) {
            throw new Error(`Automation ${automationId} was not found`);
        }

        return automation;
    }

    listSchedules(filters = {}) {
        return this.requireScheduleStore().listSchedules(filters);
    }

    inspectSchedule(scheduleId) {
        const schedule = this.requireScheduleStore().getSchedule(scheduleId,
            { includeTombstoned: true });
        if (!schedule) throw scheduleError("SCHEDULE_NOT_FOUND");
        return { schedule, nextOccurrences: schedule.tombstoned
            ? [] : this.previewOccurrences(schedule) };
    }

    prepareScheduleCreate(input) {
        const candidate = normalizeSchedule(input, { revision: 1 });
        if (this.requireScheduleStore().getSchedule(candidate.scheduleId,
            { includeTombstoned: true })) throw scheduleError("SCHEDULE_ALREADY_EXISTS");
        return this.prepareMutation("create", candidate.scheduleId, null,
            candidate);
    }

    prepareScheduleUpdate(scheduleId, expectedRevision, updates) {
        const current = this.requireActiveSchedule(scheduleId);
        if (current.revision !== Number(expectedRevision)) {
            throw scheduleError("SCHEDULE_STALE_REVISION");
        }
        const candidate = normalizeSchedule(deepMerge(current, updates || {}),
            { revision: current.revision + 1 });
        if (candidate.scheduleId !== scheduleId) {
            throw scheduleError("SCHEDULE_ID_IMMUTABLE");
        }
        return this.prepareMutation("update", scheduleId, current.revision,
            candidate, current);
    }

    prepareScheduleDelete(scheduleId, expectedRevision) {
        const current = this.requireActiveSchedule(scheduleId);
        if (current.revision !== Number(expectedRevision)) {
            throw scheduleError("SCHEDULE_STALE_REVISION");
        }
        return this.prepareMutation("delete", scheduleId, current.revision,
            null, current);
    }

    approveScheduleMutation(input, expectedMutationType = null) {
        if (expectedMutationType) {
            const prepared = this.requireScheduleStore().getPreparedMutation(input.approvalId);
            if (!prepared || prepared.mutationType !== expectedMutationType) {
                throw scheduleError("SCHEDULE_APPROVAL_OPERATION_MISMATCH");
            }
        }
        return this.requireScheduleStore().approvePreparedMutation(input,
            this.clock().toISOString());
    }

    prepareMutation(mutationType, scheduleId, expectedRevision, candidate,
        before = null) {
        const approvalId = this.approvalIdGenerator();
        const payloadHash = schedulePayloadHash({ mutationType, scheduleId,
            expectedRevision, candidate });
        const action = this.requireScheduleStore().savePreparedMutation({
            approvalId, mutationType, scheduleId, expectedRevision,
            payloadHash, candidate, createdAt: this.clock().toISOString()
        });
        return {
            approvalId,
            status: action.status,
            approvalRequired: true,
            mutationType,
            payloadHash,
            expectedRevision,
            before,
            candidate,
            nextOccurrences: candidate ? this.previewOccurrences(candidate) : []
        };
    }

    previewOccurrences(schedule, limit = 3) {
        const now = Temporal.Instant.from(this.clock().toISOString());
        let date = now.toZonedDateTimeISO(schedule.trigger.timezone).toPlainDate();
        const occurrences = [];
        for (let day = 0; day < 21 && occurrences.length < limit; day += 1) {
            const occurrence = this.occurrenceResolver.resolve(schedule,
                date.add({ days: day }).toString());
            if (occurrence && Temporal.Instant.from(occurrence.resolvedInstant)
                .epochNanoseconds > now.epochNanoseconds) occurrences.push(occurrence);
        }
        return occurrences;
    }

    requireActiveSchedule(scheduleId) {
        const schedule = this.requireScheduleStore().getSchedule(scheduleId);
        if (!schedule || schedule.tombstoned) throw scheduleError("SCHEDULE_NOT_FOUND");
        return schedule;
    }

    requireScheduleStore() {
        if (!this.scheduleStore) throw scheduleError("SCHEDULE_STORE_REQUIRED");
        return this.scheduleStore;
    }
}

function validateAutomation(automation) {
    if (!automation || typeof automation !== "object") {
        throw new Error("Automation is required");
    }

    for (const field of [
        "automationId",
        "name",
        "trigger",
        "approvalPolicy"
    ]) {
        if (!automation[field]) {
            throw new Error(`Automation ${field} is required`);
        }
    }

    if (typeof automation.enabled !== "boolean") {
        throw new Error("Automation enabled must be a boolean");
    }

    if (!automation.action && !automation.workflow) {
        throw new Error("Automation action or workflow is required");
    }

    if (automation.workflow) {
        validateWorkflow(automation.workflow);
    }
}

function validateWorkflow(workflow) {
    if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
        throw new Error("Automation workflow requires at least one step");
    }

    workflow.steps.forEach((step, index) => {
        if (!step || !step.capabilityRequirement || !step.intent) {
            throw new Error(
                `Automation workflow step ${index + 1} requires capabilityRequirement and intent`
            );
        }
    });
}

function cloneAutomation(automation) {
    return structuredClone(automation);
}

function deepMerge(current, updates) {
    return {
        ...current,
        ...updates,
        trigger: { ...current.trigger, ...(updates.trigger || {}) },
        publication: {
            ...current.publication,
            ...(updates.publication || {}),
            template: {
                ...current.publication.template,
                ...((updates.publication && updates.publication.template) || {})
            }
        },
        executionPolicy: {
            ...current.executionPolicy,
            ...(updates.executionPolicy || {})
        },
        approval: undefined,
        updatedAt: undefined
    };
}
function scheduleError(code) { const error = new Error(code); error.code = code; return error; }

module.exports = AutomationManager;

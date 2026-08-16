const { createCapabilityDeclaration, EXECUTION_MODES, CAPABILITY_BEHAVIORS,
    APPROVAL_REQUIREMENTS, LIFECYCLE_STAGES, RESULT_STATUSES } = require("./capabilityContract");

const OPERATIONS = Object.freeze({ LIST: "schedule.list", INSPECT: "schedule.inspect",
    CREATE_PREPARE: "schedule.create.prepare", CREATE_APPROVE: "schedule.create.approve",
    UPDATE_PREPARE: "schedule.update.prepare", UPDATE_APPROVE: "schedule.update.approve",
    DELETE_PREPARE: "schedule.delete.prepare", DELETE_APPROVE: "schedule.delete.approve" });

class ScheduleManagementCapability {
    constructor(options = {}) {
        if (!options.automationManager) throw new Error("Schedule Management Capability requires AutomationManager");
        this.name = "schedule.management"; this.automationManager = options.automationManager;
        this.declaration = createCapabilityDeclaration({ capabilityId: this.name,
            domain: "automation", version: "1.0.0", supportedOperations: Object.values(OPERATIONS),
            operationPolicies: scheduleOperationPolicies(),
            executionMode: EXECUTION_MODES.SYNCHRONOUS, behavior: CAPABILITY_BEHAVIORS.MUTATING,
            approvalRequirement: APPROVAL_REQUIREMENTS.REQUIRED,
            lifecycleSupport: [LIFECYCLE_STAGES.STORE, LIFECYCLE_STAGES.ACT],
            inputContractVersion: "1.0", outputContractVersion: "1.0" });
    }
    async execute(request) {
        const input = request.input || {}; let data;
        switch (request.operation) {
            case OPERATIONS.LIST: data = { schedules: this.automationManager.listSchedules(input.filters || {}) }; break;
            case OPERATIONS.INSPECT: data = this.automationManager.inspectSchedule(input.scheduleId); break;
            case OPERATIONS.CREATE_PREPARE: data = this.automationManager.prepareScheduleCreate(input.schedule); break;
            case OPERATIONS.UPDATE_PREPARE: data = this.automationManager.prepareScheduleUpdate(input.scheduleId, input.expectedRevision, input.updates); break;
            case OPERATIONS.DELETE_PREPARE: data = this.automationManager.prepareScheduleDelete(input.scheduleId, input.expectedRevision); break;
            case OPERATIONS.CREATE_APPROVE: data = this.automationManager.approveScheduleMutation(input, "create"); break;
            case OPERATIONS.UPDATE_APPROVE: data = this.automationManager.approveScheduleMutation(input, "update"); break;
            case OPERATIONS.DELETE_APPROVE: data = this.automationManager.approveScheduleMutation(input, "delete"); break;
            default: { const error = new Error("Unsupported schedule operation"); error.code = "SCHEDULE_OPERATION_UNSUPPORTED"; throw error; }
        }
        return { status: RESULT_STATUSES.COMPLETED, data,
            summary: `Schedule operation ${request.operation} completed`, evidence: [],
            sourceReferences: data.scheduleId ? [data.scheduleId] : [],
            recordCount: Array.isArray(data.schedules) ? data.schedules.length : undefined,
            executionMetadata: { schedulerActivated: false } };
    }
}
function scheduleOperationPolicies() {
    const governed = () => ({ access: "mutation", mutationPolicy: {
        approvalRequired: true, payloadBindingRequired: true,
        idempotencyRequired: true } });
    return {
        [OPERATIONS.LIST]: { access: "read" },
        [OPERATIONS.INSPECT]: { access: "read" },
        [OPERATIONS.CREATE_PREPARE]: { access: "internal" },
        [OPERATIONS.UPDATE_PREPARE]: { access: "internal" },
        [OPERATIONS.DELETE_PREPARE]: { access: "internal" },
        [OPERATIONS.CREATE_APPROVE]: governed(),
        [OPERATIONS.UPDATE_APPROVE]: governed(),
        [OPERATIONS.DELETE_APPROVE]: governed()
    };
}
module.exports = ScheduleManagementCapability;
module.exports.OPERATIONS = OPERATIONS;

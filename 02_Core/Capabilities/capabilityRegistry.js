class CapabilityRegistry {
    constructor(capabilities = []) {
        this.capabilities = new Map();

        capabilities.forEach(capability => this.register(capability));
    }

    register(capability) {
        if (!capability || typeof capability !== "object" || !capability.name) {
            throw new Error("Capability with a name is required");
        }

        this.capabilities.set(capability.name, capability);
        return capability;
    }

    get(name) {
        return this.capabilities.get(name) || null;
    }

    has(name) {
        return this.capabilities.has(name);
    }

    list() {
        return Array.from(this.capabilities.values());
    }
}

module.exports = CapabilityRegistry;

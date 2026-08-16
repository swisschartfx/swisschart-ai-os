class ProductionRuntime {
    constructor(options = {}) {
        this.server = options.server;
        this.port = options.port;
        this.host = options.host || "0.0.0.0";
        this.logger = options.logger;
        this.process = options.process || global.process;
        this.telegramRuntime = options.telegramRuntime || null;
        this.schedulerRuntime = options.schedulerRuntime || null;
        this.started = false;
        this.shutdownPromise = null;
        this.signalHandler = (signal) => this.shutdown(signal);
        if (!this.server || typeof this.server.listen !== "function" ||
            typeof this.server.close !== "function") {
            throw new Error("Production Runtime requires an HTTP server");
        }
    }

    async start() {
        if (this.started) return this.address();
        await listen(this.server, this.port, this.host);
        if (this.schedulerRuntime) this.schedulerRuntime.start();
        if (this.telegramRuntime) this.telegramStartPromise =
            this.telegramRuntime.start().catch(() => {
                this.log("runtime_component_error", { component: "telegram" });
            });
        this.process.once("SIGINT", this.signalHandler);
        this.process.once("SIGTERM", this.signalHandler);
        this.started = true;
        this.log("cloud_runtime_started", { port: this.address().port });
        return this.address();
    }

    shutdown(signal = "manual") {
        if (this.shutdownPromise) return this.shutdownPromise;
        this.shutdownPromise = this.performShutdown(signal);
        return this.shutdownPromise;
    }

    async performShutdown(signal) {
        this.log("cloud_runtime_shutdown_started", { signal });
        if (this.telegramRuntime && typeof this.telegramRuntime.shutdown === "function") {
            this.telegramRuntime.shutdown();
        }
        if (this.schedulerRuntime && typeof this.schedulerRuntime.stop === "function") {
            this.schedulerRuntime.stop();
        }
        if (this.server.listening) await close(this.server);
        this.process.removeListener("SIGINT", this.signalHandler);
        this.process.removeListener("SIGTERM", this.signalHandler);
        this.started = false;
        this.log("cloud_runtime_stopped", { signal });
    }

    address() { return this.server.address(); }
    log(event, fields) {
        if (this.logger && typeof this.logger.info === "function") {
            this.logger.info(event, fields);
        }
    }
}

function listen(server, port, host) {
    return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
            server.removeListener("error", reject);
            resolve();
        });
    });
}
function close(server) {
    return new Promise((resolve, reject) => server.close((error) =>
        error ? reject(error) : resolve()));
}

module.exports = ProductionRuntime;

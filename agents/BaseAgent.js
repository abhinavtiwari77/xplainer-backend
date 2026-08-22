class BaseAgent {
    constructor(config) {
        this.config = config;
    }

    async process(input) {
        throw new Error("Method 'process' must be implemented.");
    }
}

module.exports = BaseAgent;

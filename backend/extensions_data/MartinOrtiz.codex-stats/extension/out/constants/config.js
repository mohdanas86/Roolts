"use strict";
/**
 * Configuration constants for the Codex Usage extension
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG = void 0;
exports.CONFIG = {
    // Status bar configuration
    STATUS_BAR: {
        ALIGNMENT: 'Right',
        PRIORITY: 100,
        LOADING_TEXT: '$(sync~spin) Codex',
        ERROR_TEXT: '$(error) Codex',
        WARNING_TEXT: '$(warning) Codex',
    },
    // Update intervals (in seconds)
    UPDATE_INTERVAL: {
        DEFAULT: 300, // 5 minutes
    },
    // Usage thresholds
    THRESHOLDS: {
        WARNING: 80,
        CRITICAL: 95,
        HIGH_USAGE: 75,
        VERY_HIGH_USAGE: 90,
    },
    // External URLs
    URLS: {
        CODEX_CLI_DOCS: 'https://github.com/openai/codex-cli',
    },
    // Commands
    COMMANDS: {
        NOOP: 'codex-usage.noop',
        REFRESH: 'codex-usage.refresh',
        LOGIN: 'codex-usage.login',
    },
    // Configuration keys
    SETTINGS: {
        UPDATE_INTERVAL: 'updateInterval',
        SHOW_NOTIFICATIONS: 'showNotifications',
    },
};
//# sourceMappingURL=config.js.map
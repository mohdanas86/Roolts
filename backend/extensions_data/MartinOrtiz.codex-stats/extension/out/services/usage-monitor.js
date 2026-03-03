"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentAuthData = exports.updateUsage = exports.initializeMonitor = void 0;
const vscode = __importStar(require("vscode"));
const codexClient_1 = require("../codexClient");
const status_bar_1 = require("../ui/status-bar");
let apiClient;
let currentAuthData;
/**
 * Initialize the usage monitor with authentication data
 */
function initializeMonitor(authData) {
    currentAuthData = authData;
    apiClient = new codexClient_1.CodexAPIClient(authData);
}
exports.initializeMonitor = initializeMonitor;
/**
 * Update usage statistics
 */
async function updateUsage() {
    console.log('updateUsage called');
    console.log('apiClient exists:', !!apiClient);
    console.log('currentAuthData exists:', !!currentAuthData);
    if (!apiClient || !currentAuthData) {
        console.log('Missing apiClient or authData, returning');
        return;
    }
    try {
        console.log('Setting status bar to updating...');
        (0, status_bar_1.showUpdating)();
        // Send a simple message to get rate limits
        console.log('Calling getRateLimits...');
        const rateLimits = await apiClient.getRateLimits();
        console.log('getRateLimits returned:', rateLimits);
        if (rateLimits) {
            (0, status_bar_1.updateStatusBar)(rateLimits, currentAuthData);
            // Check if we should show notifications
            const config = vscode.workspace.getConfiguration('codexUsage');
            const showNotifications = config.get('showNotifications');
            if (showNotifications) {
                checkRateLimitWarnings(rateLimits);
            }
        }
        else {
            console.log('No rate limits received');
            (0, status_bar_1.showFetchError)();
        }
    }
    catch (error) {
        console.error('Error updating usage:', error);
        if (error instanceof Error) {
            console.error('Error details:', error.message);
        }
        (0, status_bar_1.showUpdateError)(error);
    }
}
exports.updateUsage = updateUsage;
/**
 * Check rate limits and show warnings if needed
 */
function checkRateLimitWarnings(rateLimits) {
    const warnings = [];
    if (rateLimits.primary && rateLimits.primary.used_percent > 90) {
        warnings.push(`5h limit is ${rateLimits.primary.used_percent.toFixed(1)}% used`);
    }
    if (rateLimits.secondary && rateLimits.secondary.used_percent > 90) {
        warnings.push(`Weekly limit is ${rateLimits.secondary.used_percent.toFixed(1)}% used`);
    }
    if (warnings.length > 0) {
        vscode.window.showWarningMessage(`Codex Stats Warning: ${warnings.join(', ')}`);
    }
}
/**
 * Get current auth data
 */
function getCurrentAuthData() {
    return currentAuthData;
}
exports.getCurrentAuthData = getCurrentAuthData;
//# sourceMappingURL=usage-monitor.js.map
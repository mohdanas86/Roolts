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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const auth_manager_1 = require("./auth/auth-manager");
const status_bar_1 = require("./ui/status-bar");
const usage_monitor_1 = require("./services/usage-monitor");
const commands_1 = require("./commands");
let updateInterval;
function activate(context) {
    console.log('Codex Stats Monitor is now active!');
    // Create status bar item
    const statusBarItem = (0, status_bar_1.createStatusBarItem)();
    context.subscriptions.push(statusBarItem);
    // Register all commands
    (0, commands_1.registerCommands)(context);
    // Load auth and start monitoring
    loadAuthAndStartMonitoring();
}
exports.activate = activate;
async function loadAuthAndStartMonitoring() {
    try {
        console.log('Loading auth and starting monitoring...');
        // Try to load auth data
        const authData = await (0, auth_manager_1.loadAuthData)();
        if (authData) {
            console.log('Auth data loaded successfully');
            console.log('Email:', authData.email);
            console.log('Plan:', authData.planType);
            // Initialize the monitor with auth data
            (0, usage_monitor_1.initializeMonitor)(authData);
            // Update immediately
            console.log('Performing initial update...');
            await (0, usage_monitor_1.updateUsage)();
            // Start periodic updates (default 5 minutes)
            const config = vscode.workspace.getConfiguration('codexUsage');
            const intervalSeconds = config.get('updateInterval') || 300;
            console.log(`Setting update interval to ${intervalSeconds} seconds`);
            if (updateInterval) {
                clearInterval(updateInterval);
            }
            updateInterval = setInterval(async () => {
                console.log('Periodic update triggered');
                await (0, usage_monitor_1.updateUsage)();
            }, intervalSeconds * 1000);
        }
        else {
            console.log('No auth data found');
            (0, status_bar_1.showAuthRequired)();
        }
    }
    catch (error) {
        console.error('Error loading auth:', error);
        if (error instanceof Error) {
            console.error('Error details:', error.message);
        }
        (0, status_bar_1.showAuthError)(error);
    }
}
function deactivate() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    const statusBarItem = (0, status_bar_1.getStatusBarItem)();
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map
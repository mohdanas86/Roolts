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
exports.NotificationService = void 0;
const vscode = __importStar(require("vscode"));
const config_1 = require("../constants/config");
/**
 * Service for handling notifications
 */
class NotificationService {
    /**
     * Check rate limits and show warnings if necessary
     */
    checkRateLimitWarnings(rateLimits) {
        const config = vscode.workspace.getConfiguration('codexUsage');
        const showNotifications = config.get(config_1.CONFIG.SETTINGS.SHOW_NOTIFICATIONS);
        if (!showNotifications) {
            return;
        }
        const warnings = [];
        if (rateLimits.primary &&
            rateLimits.primary.used_percent > config_1.CONFIG.THRESHOLDS.VERY_HIGH_USAGE) {
            warnings.push(`5h limit is ${rateLimits.primary.used_percent.toFixed(1)}% used`);
        }
        if (rateLimits.secondary &&
            rateLimits.secondary.used_percent > config_1.CONFIG.THRESHOLDS.VERY_HIGH_USAGE) {
            warnings.push(`Weekly limit is ${rateLimits.secondary.used_percent.toFixed(1)}% used`);
        }
        if (warnings.length > 0) {
            vscode.window.showWarningMessage(`Codex Usage Warning: ${warnings.join(', ')}`);
        }
    }
    /**
     * Show login help dialog
     */
    async showLoginHelp() {
        const selection = await vscode.window.showInformationMessage('You need to authenticate with Codex to use this extension.', 'Open Terminal', 'Copy Command', 'Help');
        if (selection === 'Open Terminal') {
            vscode.commands.executeCommand('workbench.action.terminal.new');
            setTimeout(() => {
                vscode.commands.executeCommand('workbench.action.terminal.sendSequence', {
                    text: 'codex login\n',
                });
            }, 500);
        }
        else if (selection === 'Copy Command') {
            vscode.env.clipboard.writeText('codex login');
            vscode.window.showInformationMessage('Command "codex login" copied to clipboard!');
        }
        else if (selection === 'Help') {
            vscode.env.openExternal(vscode.Uri.parse(config_1.CONFIG.URLS.CODEX_CLI_DOCS));
        }
    }
}
exports.NotificationService = NotificationService;
//# sourceMappingURL=notification-service.js.map
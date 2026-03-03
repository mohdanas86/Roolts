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
exports.registerCommands = void 0;
const vscode = __importStar(require("vscode"));
const usage_monitor_1 = require("../services/usage-monitor");
/**
 * Register all extension commands
 */
function registerCommands(context) {
    // No-op command just to show pointer cursor
    const noopCommand = vscode.commands.registerCommand('codex-usage.noop', () => {
        // No-op command just to show pointer cursor
    });
    // Refresh command
    const refreshCommand = vscode.commands.registerCommand('codex-usage.refresh', async () => {
        await (0, usage_monitor_1.updateUsage)();
    });
    // Login command
    const loginCommand = vscode.commands.registerCommand('codex-usage.login', async () => {
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
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/openai/codex-cli'));
        }
    });
    // Register all commands
    context.subscriptions.push(noopCommand);
    context.subscriptions.push(refreshCommand);
    context.subscriptions.push(loginCommand);
}
exports.registerCommands = registerCommands;
//# sourceMappingURL=index.js.map
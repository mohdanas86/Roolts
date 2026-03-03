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
exports.getStatusBarItem = exports.showUpdateError = exports.showFetchError = exports.showUpdating = exports.showAuthError = exports.showAuthRequired = exports.updateStatusBar = exports.createStatusBarItem = void 0;
const vscode = __importStar(require("vscode"));
const tooltip_builder_1 = require("./tooltip-builder");
let statusBarItem;
/**
 * Create and initialize the status bar item
 */
function createStatusBarItem() {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    // Set initial state with better styling
    statusBarItem.text = '$(codex-blossom) $(sync~spin)';
    statusBarItem.tooltip = 'Initializing Codex Stats Monitor...';
    statusBarItem.command = 'codex-usage.noop'; // Just for pointer cursor
    statusBarItem.show();
    return statusBarItem;
}
exports.createStatusBarItem = createStatusBarItem;
/**
 * Update status bar with rate limits data
 */
function updateStatusBar(rateLimits, authData) {
    // Determine usage percentages
    let primaryPercent = 0;
    let secondaryPercent = 0;
    let statusColor = 'charts.green';
    if (rateLimits.primary) {
        primaryPercent = rateLimits.primary.used_percent;
    }
    if (rateLimits.secondary) {
        secondaryPercent = rateLimits.secondary.used_percent;
    }
    // Update status bar text with custom icon - no colors
    statusBarItem.text = `$(codex-blossom) ${primaryPercent.toFixed(0)}%`;
    statusBarItem.color = undefined;
    statusBarItem.backgroundColor = undefined;
    // Set tooltip
    statusBarItem.tooltip = (0, tooltip_builder_1.createMainTooltip)(rateLimits, authData, primaryPercent, secondaryPercent);
}
exports.updateStatusBar = updateStatusBar;
/**
 * Show authentication required state
 */
function showAuthRequired() {
    statusBarItem.text = '$(error)';
    statusBarItem.color = new vscode.ThemeColor('errorForeground');
    statusBarItem.tooltip = (0, tooltip_builder_1.createAuthRequiredTooltip)();
    statusBarItem.command = 'codex-usage.noop'; // Just for pointer cursor
}
exports.showAuthRequired = showAuthRequired;
/**
 * Show authentication error state
 */
function showAuthError(error) {
    statusBarItem.text = '$(error)';
    statusBarItem.color = new vscode.ThemeColor('errorForeground');
    statusBarItem.tooltip = (0, tooltip_builder_1.createAuthErrorTooltip)(error);
}
exports.showAuthError = showAuthError;
/**
 * Show updating state
 */
function showUpdating() {
    statusBarItem.text = '$(codex-blossom) $(sync~spin)';
    statusBarItem.color = undefined; // Reset color while updating
    statusBarItem.tooltip = (0, tooltip_builder_1.createUpdatingTooltip)();
}
exports.showUpdating = showUpdating;
/**
 * Show fetch error state
 */
function showFetchError() {
    statusBarItem.text = '$(warning)';
    statusBarItem.color = new vscode.ThemeColor('editorWarning.foreground');
    statusBarItem.tooltip = (0, tooltip_builder_1.createFetchErrorTooltip)();
}
exports.showFetchError = showFetchError;
/**
 * Show update error state
 */
function showUpdateError(error) {
    statusBarItem.text = '$(warning)';
    statusBarItem.color = new vscode.ThemeColor('editorWarning.foreground');
    statusBarItem.tooltip = (0, tooltip_builder_1.createUpdateErrorTooltip)(error);
}
exports.showUpdateError = showUpdateError;
/**
 * Get the status bar item
 */
function getStatusBarItem() {
    return statusBarItem;
}
exports.getStatusBarItem = getStatusBarItem;
//# sourceMappingURL=status-bar.js.map
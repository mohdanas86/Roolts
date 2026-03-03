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
exports.StatusBarManager = void 0;
const vscode = __importStar(require("vscode"));
const tooltip_builder_1 = require("./tooltip-builder");
const config_1 = require("../constants/config");
/**
 * Manager class for status bar item and its updates
 */
class StatusBarManager {
    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, config_1.CONFIG.STATUS_BAR.PRIORITY);
        this.tooltipBuilder = new tooltip_builder_1.TooltipBuilder();
        this.initialize();
    }
    /**
     * Initialize the status bar with default state
     */
    initialize() {
        this.statusBarItem.text = config_1.CONFIG.STATUS_BAR.LOADING_TEXT;
        this.statusBarItem.tooltip = 'Initializing Codex Usage Monitor...';
        this.statusBarItem.command = config_1.CONFIG.COMMANDS.NOOP; // Just for pointer cursor
        this.statusBarItem.show();
    }
    /**
     * Update status bar with rate limits data
     */
    updateWithRateLimits(rateLimits, authData) {
        const primaryPercent = rateLimits.primary?.used_percent || 0;
        const secondaryPercent = rateLimits.secondary?.used_percent || 0;
        // Update status bar appearance
        this.updateStatusBarAppearance(primaryPercent, secondaryPercent);
        // Build and set tooltip
        const tooltip = this.tooltipBuilder.buildRateLimitsTooltip(rateLimits, authData, primaryPercent, secondaryPercent);
        this.statusBarItem.tooltip = tooltip;
    }
    /**
     * Show authentication required state
     */
    showAuthRequired() {
        this.statusBarItem.text = config_1.CONFIG.STATUS_BAR.ERROR_TEXT;
        this.statusBarItem.color = new vscode.ThemeColor('errorForeground');
        this.statusBarItem.tooltip = this.tooltipBuilder.buildAuthErrorTooltip();
        this.statusBarItem.command = config_1.CONFIG.COMMANDS.NOOP;
    }
    /**
     * Show error state
     */
    showError(error) {
        this.statusBarItem.text = config_1.CONFIG.STATUS_BAR.ERROR_TEXT;
        this.statusBarItem.color = new vscode.ThemeColor('errorForeground');
        this.statusBarItem.tooltip = this.tooltipBuilder.buildErrorTooltip(error);
    }
    /**
     * Show loading state
     */
    showLoading() {
        this.statusBarItem.text = config_1.CONFIG.STATUS_BAR.LOADING_TEXT;
        this.statusBarItem.color = undefined;
        this.statusBarItem.tooltip = this.tooltipBuilder.buildLoadingTooltip();
    }
    /**
     * Show warning for fetch failures
     */
    showFetchWarning() {
        this.statusBarItem.text = config_1.CONFIG.STATUS_BAR.WARNING_TEXT;
        this.statusBarItem.color = new vscode.ThemeColor('editorWarning.foreground');
        this.statusBarItem.tooltip = this.tooltipBuilder.buildFetchWarningTooltip();
    }
    /**
     * Show update error
     */
    showUpdateError(error) {
        this.statusBarItem.text = config_1.CONFIG.STATUS_BAR.WARNING_TEXT;
        this.statusBarItem.color = new vscode.ThemeColor('editorWarning.foreground');
        this.statusBarItem.tooltip =
            this.tooltipBuilder.buildUpdateErrorTooltip(error);
    }
    /**
     * Get the status bar item for disposal
     */
    getStatusBarItem() {
        return this.statusBarItem;
    }
    /**
     * Dispose the status bar item
     */
    dispose() {
        this.statusBarItem.dispose();
    }
    /**
     * Update the visual appearance of the status bar
     */
    updateStatusBarAppearance(primaryPercent, secondaryPercent) {
        let statusColor = 'charts.green';
        // Change color based on usage levels (no icons)
        if (primaryPercent > config_1.CONFIG.THRESHOLDS.CRITICAL ||
            secondaryPercent > config_1.CONFIG.THRESHOLDS.CRITICAL) {
            statusColor = 'errorForeground';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
        else if (primaryPercent > config_1.CONFIG.THRESHOLDS.WARNING ||
            secondaryPercent > config_1.CONFIG.THRESHOLDS.WARNING) {
            statusColor = 'editorWarning.foreground';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
        else {
            this.statusBarItem.backgroundColor = undefined;
        }
        // Update status bar text without icon
        this.statusBarItem.text = `Codex ${primaryPercent.toFixed(0)}%`;
        this.statusBarItem.color = new vscode.ThemeColor(statusColor);
    }
}
exports.StatusBarManager = StatusBarManager;
//# sourceMappingURL=status-bar-manager.js.map
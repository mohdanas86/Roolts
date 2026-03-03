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
exports.createUpdateErrorTooltip = exports.createFetchErrorTooltip = exports.createUpdatingTooltip = exports.createAuthErrorTooltip = exports.createAuthRequiredTooltip = exports.createMainTooltip = void 0;
const vscode = __importStar(require("vscode"));
const progress_bar_1 = require("./progress-bar");
const time_formatter_1 = require("../utils/time-formatter");
/**
 * Create the main tooltip with usage information
 */
function createMainTooltip(rateLimits, authData, primaryPercent, secondaryPercent) {
    const tooltip = new vscode.MarkdownString();
    tooltip.supportHtml = true;
    tooltip.isTrusted = true;
    tooltip.supportThemeIcons = true;
    // Header section with centered title and icon
    tooltip.appendMarkdown('<div align="center">\n\n');
    tooltip.appendMarkdown(`## ⚡ Codex Stats Monitor\n\n`);
    tooltip.appendMarkdown('</div>\n\n');
    // Account info section with icons
    tooltip.appendMarkdown(`### 👤 Account Information\n\n`);
    tooltip.appendMarkdown(`📧 **Email:** ${authData.email}\n\n`);
    tooltip.appendMarkdown(`💎 **Plan:** ${authData.planType.toUpperCase()}\n\n`);
    tooltip.appendMarkdown(`---\n\n`);
    // Usage Limits section with better visual hierarchy
    tooltip.appendMarkdown(`### 🚀 Rate Limits\n\n`);
    if (rateLimits.primary) {
        const windowHours = rateLimits.primary.window_minutes
            ? Math.floor(rateLimits.primary.window_minutes / 60)
            : 5;
        // Primary limit with icon based on usage
        let limitIcon = '✅';
        if (primaryPercent >= 90)
            limitIcon = '🔴';
        else if (primaryPercent >= 75)
            limitIcon = '🟡';
        tooltip.appendMarkdown(`#### ${limitIcon} ${windowHours}-Hour Limit\n\n`);
        tooltip.appendMarkdown(`${(0, progress_bar_1.createProgressBar)(primaryPercent)}\n\n`);
        if (rateLimits.primary.resets_in_seconds) {
            const resetTime = (0, time_formatter_1.formatResetTime)(rateLimits.primary.resets_in_seconds);
            tooltip.appendMarkdown(`⏱️ Resets in **${resetTime}**\n\n`);
        }
        tooltip.appendMarkdown(`\n`);
    }
    if (rateLimits.secondary) {
        const windowDays = rateLimits.secondary.window_minutes
            ? Math.floor(rateLimits.secondary.window_minutes / (60 * 24))
            : 7;
        // Secondary limit with icon based on usage
        let limitIcon = '✅';
        if (secondaryPercent >= 90)
            limitIcon = '🔴';
        else if (secondaryPercent >= 75)
            limitIcon = '🟡';
        tooltip.appendMarkdown(`#### ${limitIcon} ${windowDays}-Day Limit\n\n`);
        tooltip.appendMarkdown(`${(0, progress_bar_1.createProgressBar)(secondaryPercent)}\n\n`);
        if (rateLimits.secondary.resets_in_seconds) {
            const resetTime = (0, time_formatter_1.formatResetTime)(rateLimits.secondary.resets_in_seconds);
            tooltip.appendMarkdown(`⏱️ Resets in **${resetTime}**\n\n`);
        }
        tooltip.appendMarkdown(`\n`);
    }
    // Usage Tips section (only show when usage is high)
    if (primaryPercent > 75 || secondaryPercent > 75) {
        tooltip.appendMarkdown(`---\n\n`);
        tooltip.appendMarkdown(`### 💡 Tips\n\n`);
        if (primaryPercent > 90 || secondaryPercent > 90) {
            tooltip.appendMarkdown(`> ⚠️ **High usage detected!** Consider reducing your request frequency.\n\n`);
        }
        else if (primaryPercent > 75 || secondaryPercent > 75) {
            tooltip.appendMarkdown(`> ℹ️ You're approaching your rate limits. Monitor your usage carefully.\n\n`);
        }
    }
    tooltip.appendMarkdown(`\n\n---\n\n`);
    // Action buttons section with icons
    tooltip.appendMarkdown(`🔄 [Refresh Now](command:codex-usage.refresh) • `);
    tooltip.appendMarkdown(`⚙️ [Settings](command:workbench.action.openSettings?%22codexUsage%22)\n\n`);
    // Last update time with clock icon
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });
    tooltip.appendMarkdown(`🕒 Last updated: **${timeStr}**\n\n`);
    return tooltip;
}
exports.createMainTooltip = createMainTooltip;
/**
 * Create authentication required tooltip
 */
function createAuthRequiredTooltip() {
    const tooltip = new vscode.MarkdownString();
    tooltip.isTrusted = true;
    tooltip.supportThemeIcons = true;
    tooltip.supportHtml = true;
    tooltip.appendMarkdown('<div align="center">\n\n');
    tooltip.appendMarkdown(`## 🔐 Authentication Required\n\n`);
    tooltip.appendMarkdown('</div>\n\n');
    tooltip.appendMarkdown(`> ⚠️ **You need to login to Codex to use this extension**\n\n`);
    tooltip.appendMarkdown(`### 📝 How to Login\n\n`);
    tooltip.appendMarkdown(`1️⃣ Open a terminal\n\n`);
    tooltip.appendMarkdown(`2️⃣ Run: \`codex login\`\n\n`);
    tooltip.appendMarkdown(`3️⃣ Follow the authentication flow\n\n`);
    tooltip.appendMarkdown(`4️⃣ Reload VS Code window\n\n`);
    tooltip.appendMarkdown(`---\n\n`);
    tooltip.appendMarkdown('<div align="center">\n\n');
    tooltip.appendMarkdown(`🆘 [Get Help](command:codex-usage.login) • `);
    tooltip.appendMarkdown(`📚 [Documentation](https://github.com/openai/codex-cli)\n\n`);
    tooltip.appendMarkdown('</div>');
    return tooltip;
}
exports.createAuthRequiredTooltip = createAuthRequiredTooltip;
/**
 * Create error loading authentication tooltip
 */
function createAuthErrorTooltip(error) {
    const tooltip = new vscode.MarkdownString();
    tooltip.isTrusted = true;
    tooltip.supportThemeIcons = true;
    tooltip.supportHtml = true;
    tooltip.appendMarkdown('<div align="center">\n\n');
    tooltip.appendMarkdown(`## ❌ Error Loading Authentication\n\n`);
    tooltip.appendMarkdown('</div>\n\n');
    tooltip.appendMarkdown(`> 🔴 **${error}**\n\n`);
    tooltip.appendMarkdown(`### 🔧 Troubleshooting Steps\n\n`);
    tooltip.appendMarkdown(`✓ Check if \`~/.codex/auth.json\` exists\n\n`);
    tooltip.appendMarkdown(`✓ Try running \`codex login\` again\n\n`);
    tooltip.appendMarkdown(`✓ Reload VS Code window\n\n`);
    tooltip.appendMarkdown(`---\n\n`);
    tooltip.appendMarkdown('<div align="center">\n\n');
    tooltip.appendMarkdown(`🔄 [Click to Retry](command:codex-usage.refresh)\n\n`);
    tooltip.appendMarkdown('</div>');
    return tooltip;
}
exports.createAuthErrorTooltip = createAuthErrorTooltip;
/**
 * Create updating tooltip
 */
function createUpdatingTooltip() {
    const tooltip = new vscode.MarkdownString();
    tooltip.isTrusted = true;
    tooltip.supportThemeIcons = true;
    tooltip.supportHtml = true;
    tooltip.appendMarkdown('<div align="center">\n\n');
    tooltip.appendMarkdown(`## ⚡ Codex Stats Monitor\n\n`);
    tooltip.appendMarkdown(`### $(sync~spin) Updating...\n\n`);
    tooltip.appendMarkdown(`Fetching latest rate limits from Codex API...\n\n`);
    tooltip.appendMarkdown('</div>');
    return tooltip;
}
exports.createUpdatingTooltip = createUpdatingTooltip;
/**
 * Create unable to fetch rate limits tooltip
 */
function createFetchErrorTooltip() {
    const tooltip = new vscode.MarkdownString();
    tooltip.isTrusted = true;
    tooltip.supportThemeIcons = true;
    tooltip.supportHtml = true;
    tooltip.appendMarkdown('<div align="center">\n\n');
    tooltip.appendMarkdown(`## ⚠️ Unable to Fetch Rate Limits\n\n`);
    tooltip.appendMarkdown('</div>\n\n');
    tooltip.appendMarkdown(`> 🟡 **Could not retrieve usage data from Codex**\n\n`);
    tooltip.appendMarkdown(`### 🔍 Possible Causes\n\n`);
    tooltip.appendMarkdown(`🌐 Network connectivity issues\n\n`);
    tooltip.appendMarkdown(`🔧 Codex service temporarily unavailable\n\n`);
    tooltip.appendMarkdown(`🔑 Authentication token expired\n\n`);
    tooltip.appendMarkdown(`---\n\n`);
    tooltip.appendMarkdown('<div align="center">\n\n');
    tooltip.appendMarkdown(`🔄 [Click to Retry](command:codex-usage.refresh)\n\n`);
    tooltip.appendMarkdown('</div>');
    return tooltip;
}
exports.createFetchErrorTooltip = createFetchErrorTooltip;
/**
 * Create update error tooltip
 */
function createUpdateErrorTooltip(error) {
    const tooltip = new vscode.MarkdownString();
    tooltip.isTrusted = true;
    tooltip.supportThemeIcons = true;
    tooltip.supportHtml = true;
    tooltip.appendMarkdown('<div align="center">\n\n');
    tooltip.appendMarkdown(`## ⚠️ Update Error\n\n`);
    tooltip.appendMarkdown('</div>\n\n');
    tooltip.appendMarkdown(`> 🟡 **${error}**\n\n`);
    tooltip.appendMarkdown(`---\n\n`);
    tooltip.appendMarkdown('<div align="center">\n\n');
    tooltip.appendMarkdown(`🔄 [Click to Retry](command:codex-usage.refresh)\n\n`);
    tooltip.appendMarkdown('</div>');
    return tooltip;
}
exports.createUpdateErrorTooltip = createUpdateErrorTooltip;
//# sourceMappingURL=tooltip-builder.js.map
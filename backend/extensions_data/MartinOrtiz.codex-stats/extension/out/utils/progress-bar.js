"use strict";
/**
 * Progress bar utility for creating emoji-based progress indicators
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProgressBar = void 0;
// Emoji constants for progress bar
const PROGRESS_EMPTY = '⬜';
const PROGRESS_FILLED = '🟩';
const PROGRESS_WARNING = '🟨';
const PROGRESS_CRITICAL = '🟥';
// Thresholds for color changes
const WARNING_THRESHOLD = 75;
const CRITICAL_THRESHOLD = 90;
const BAR_LENGTH = 10;
/**
 * Create an emoji-based progress bar
 * @param percent The percentage to display (0-100)
 * @returns Formatted progress bar string with percentage
 */
function createProgressBar(percent) {
    // Ensure percentage is within 0-100 range
    const clampedPercentage = Math.max(0, Math.min(100, percent));
    // Calculate filled positions
    const filledCount = Math.round((clampedPercentage / 100) * BAR_LENGTH);
    const emptyCount = BAR_LENGTH - filledCount;
    // Choose emoji color based on thresholds
    let filledEmoji = PROGRESS_FILLED;
    if (clampedPercentage >= CRITICAL_THRESHOLD) {
        filledEmoji = PROGRESS_CRITICAL;
    }
    else if (clampedPercentage >= WARNING_THRESHOLD) {
        filledEmoji = PROGRESS_WARNING;
    }
    // Build the progress bar
    const bar = filledEmoji.repeat(filledCount) + PROGRESS_EMPTY.repeat(emptyCount);
    // Format with percentage aligned
    return `${bar}  **${percent.toFixed(0)}%**`;
}
exports.createProgressBar = createProgressBar;
//# sourceMappingURL=progress-bar.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatResetTime = void 0;
/**
 * Format reset time in human-readable format
 */
function formatResetTime(seconds) {
    if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    }
    else if (seconds < 86400) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (minutes > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }
    else {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        if (hours > 0) {
            return `${days}d ${hours}h`;
        }
        return `${days} ${days === 1 ? 'day' : 'days'}`;
    }
}
exports.formatResetTime = formatResetTime;
//# sourceMappingURL=time-formatter.js.map
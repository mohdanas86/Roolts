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
exports.loadAuthData = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
/**
 * Parse JWT token to extract payload
 */
function parseJWT(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid JWT');
        }
        const payload = Buffer.from(parts[1], 'base64url').toString();
        return JSON.parse(payload);
    }
    catch (error) {
        console.error('Error parsing JWT:', error);
        return {};
    }
}
/**
 * Load authentication data from Codex auth file
 */
async function loadAuthData() {
    const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
    const authPath = path.join(codexHome, 'auth.json');
    try {
        if (!fs.existsSync(authPath)) {
            return null;
        }
        const authContent = fs.readFileSync(authPath, 'utf8');
        const authJson = JSON.parse(authContent);
        if (!authJson.tokens) {
            return null;
        }
        // Parse ID token to get user info
        const idTokenPayload = parseJWT(authJson.tokens.id_token);
        return {
            idToken: authJson.tokens.id_token,
            accessToken: authJson.tokens.access_token,
            refreshToken: authJson.tokens.refresh_token,
            accountId: authJson.tokens.account_id,
            email: idTokenPayload.email || 'Unknown',
            planType: idTokenPayload['https://api.openai.com/auth']?.chatgpt_plan_type ||
                'Unknown',
        };
    }
    catch (error) {
        console.error('Error reading auth file:', error);
        return null;
    }
}
exports.loadAuthData = loadAuthData;
//# sourceMappingURL=auth-manager.js.map
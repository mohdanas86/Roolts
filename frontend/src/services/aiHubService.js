/**
 * AI Hub Service
 * Multi-AI integration with smart model selection
 */

import api from './api';

export const aiHubService = {
    // ============ Model Info ============

    /**
     * Get list of available AI models
     */
    getModels: async () => {
        const response = await api.get('/ai-hub/models');
        return response.data;
    },

    // ============ Chat ============

    /**
     * Send a message to an AI model
     * @param {string} prompt - The user's message
     * @param {string} model - 'auto', 'gemini', 'claude', 'deepseek', or 'qwen'
     * @param {string} systemPrompt - Optional system instructions
     */
    chat: async (prompt, model = 'auto', systemPrompt = null) => {
        const response = await api.post('/ai-hub/chat', {
            prompt,
            model,
            system_prompt: systemPrompt
        });
        return response.data;
    },

    /**
     * Get AI suggestions while typing
     * @param {string} text - Partial text to get suggestions for
     */
    suggest: async (text) => {
        const response = await api.post('/ai-hub/suggest', { text });
        return response.data;
    },

    /**
     * Analyze which AI model would be best for a prompt
     * @param {string} prompt - The prompt to analyze
     */
    analyzePrompt: async (prompt) => {
        const response = await api.post('/ai-hub/analyze-prompt', { prompt });
        return response.data;
    },

    /**
     * Analyze code for bugs and improvements
     * @param {string} code - The code to review
     * @param {string} language - Programming language
     */
    reviewCode: async (code, language) => {
        const response = await api.post('/ai/review', { code, language });
        return response.data;
    },

    // ============ Model Info ============

    /**
     * Get human-readable model info
     */
    getModelInfo: (modelId) => {
        const models = {
            auto: {
                name: 'Auto Select',
                icon: '🎯',
                description: 'Automatically picks the best AI for your task',
                color: '#6366f1'
            },
            gemini: {
                name: 'Google Gemini',
                icon: '💎',
                description: 'Best for research, facts, and multimodal content',
                color: '#4285f4'
            },
            claude: {
                name: 'Anthropic Claude',
                icon: '🎭',
                description: 'Best for nuanced writing and analysis',
                color: '#d97706'
            },
            deepseek: {
                name: 'DeepSeek',
                icon: '🔍',
                description: 'Best for coding and technical tasks',
                color: '#10b981'
            },
            qwen: {
                name: 'Alibaba Qwen',
                icon: '🌐',
                description: 'Best for multilingual content',
                color: '#ec4899'
            }
        };
        return models[modelId] || models.auto;
    }
};

export default aiHubService;

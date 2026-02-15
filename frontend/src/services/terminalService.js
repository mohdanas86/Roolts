/**
 * Terminal Service
 * Handles communication with the backend terminal API
 */

import axios from 'axios';

const terminalApi = axios.create({
    baseURL: '/api/terminal',
    timeout: 120000, // 2 minutes for long commands like pip install
    headers: {
        'Content-Type': 'application/json'
    }
});

export const terminalService = {
    /**
     * Execute a command in the terminal
     */
    execute: async (command, sessionId = 'default') => {
        try {
            const response = await terminalApi.post('/execute', {
                command,
                sessionId
            });
            return response.data;
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || error.message,
                output: '',
                cwd: ''
            };
        }
    },

    /**
     * Get current working directory
     */
    getCwd: async (sessionId = 'default') => {
        try {
            const response = await terminalApi.get('/cwd', {
                params: { sessionId }
            });
            return response.data.cwd;
        } catch (error) {
            return '';
        }
    },

    /**
     * Set current working directory
     */
    setCwd: async (cwd, sessionId = 'default') => {
        try {
            const response = await terminalApi.post('/cwd', {
                cwd,
                sessionId
            });
            return response.data.cwd;
        } catch (error) {
            return null;
        }
    },

    /**
     * Get command history
     */
    getHistory: async (sessionId = 'default') => {
        try {
            const response = await terminalApi.get('/history', {
                params: { sessionId }
            });
            return response.data.history;
        } catch (error) {
            return [];
        }
    },

    /**
     * Clear terminal history
     */
    clearHistory: async (sessionId = 'default') => {
        try {
            await terminalApi.post('/clear', { sessionId });
            return true;
        } catch (error) {
            return false;
        }
    }
};

export default terminalService;

/**
 * Code Executor Service
 * Executes code via the Node.js executor service
 * All requests go through the Vite proxy at /api/executor
 */

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api/executor`
    : '/api/executor';
const executorApi = axios.create({
    baseURL: API_URL,
    timeout: 60000, // 60 seconds for code execution
    headers: {
        'Content-Type': 'application/json'
    }
});

export const executorService = {
    // ============ Health & Info ============

    /**
     * Check if executor service is available
     */
    health: async () => {
        try {
            const response = await executorApi.get('/health');
            return { available: true, ...response.data };
        } catch (error) {
            return { available: false, error: error.message };
        }
    },

    /**
     * Get list of supported languages
     */
    getLanguages: async () => {
        try {
            const response = await executorApi.get('/languages');
            return response.data;
        } catch (error) {
            console.error('Failed to get languages:', error);
            return [];
        }
    },

    // ============ Code Execution ============

    /**
     * Execute Python code
     */
    executePython: async (code, input = '') => {
        const response = await executorApi.post('/execute', { code, language: 'python', input });
        return response.data;
    },

    /**
     * Execute Java code
     */
    executeJava: async (code, className = 'Main', input = '') => {
        // If className ends with .java, use it as filename, else assume it's class name
        const filename = className.endsWith('.java') ? className : `${className}.java`;
        const response = await executorApi.post('/execute', { code, language: 'java', filename, input });
        return response.data;
    },

    /**
     * Execute JavaScript code (Node.js)
     */
    executeJavaScript: async (code, input = '') => {
        const response = await executorApi.post('/execute', { code, language: 'javascript', input });
        return response.data;
    },

    /**
     * Execute code with specified language
     */
    execute: async (code, language, filename, input = '') => {
        try {
            const response = await executorApi.post('/execute', { code, language, filename, input });
            return response.data;
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || error.message,
                output: ''
            };
        }
    },

    // ============ Helpers ============

    /**
     * Detect language from code content
     */
    detectLanguage: (code) => {
        const patterns = {
            python: [/\bdef\s+\w+\s*\(/, /\bimport\s+\w+/, /print\s*\(/],
            java: [/\bpublic\s+class\s+/, /\bpublic\s+static\s+void\s+main/],
            javascript: [/\bfunction\s+\w+\s*\(/, /\bconst\s+\w+\s*=/, /=>/],
            c: [/#include\s+<stdio\.h>/, /\bint\s+main\s*\(/],
            cpp: [/#include\s+<iostream>/, /\busing\s+namespace\s+std;/, /\bstd::cout/],
            cpp: [/#include\s+<iostream>/, /\busing\s+namespace\s+std;/, /\bstd::cout/],
            go: [/\bpackage\s+main\b/, /\bfunc\s+main\s*\(/, /\bimport\s+\(/],
            kotlin: [/\bfun\s+main\s*\(/, /\bval\s+\w+/, /\bvar\s+\w+/],
            csharp: [/\busing\s+System;/, /\bclass\s+Program/, /\bvoid\s+Main\s*\(/],
            ruby: [/\bdef\s+\w+/, /\bend\b/, /\bputs\b/, /\brequire\b/]
        };

        for (const [lang, langPatterns] of Object.entries(patterns)) {
            for (const pattern of langPatterns) {
                if (pattern.test(code)) {
                    return lang;
                }
            }
        }

        return 'python'; // Default to Python
    },

    /**
     * Get language icon
     */
    getLanguageIcon: (language) => {
        const icons = {
            python: '🐍',
            java: '☕',
            javascript: '📜',
            js: '📜',
            c: 'C',
            cpp: 'C++',
            go: 'Go',
            kotlin: 'Kotlin',
            csharp: 'C#',
            ruby: 'Ruby'
        };
        return icons[language.toLowerCase()] || '📄';
    }
};

export default executorService;

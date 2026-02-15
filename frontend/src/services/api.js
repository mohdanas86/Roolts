import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api';

// Create axios instance with default config
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 60000,
    headers: {
        'Content-Type': 'application/json'
    }
});



// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
    }
);

// ============ File Operations ============

export const fileService = {
    list: () => api.get('/files'),
    get: (id) => api.get(`/files/${id}`),
    create: (data) => api.post('/files', data),
    update: (id, data) => api.put(`/files/${id}`, data),
    delete: (id) => api.delete(`/files/${id}`),
    save: (id) => api.post(`/files/${id}/save`)
};

// ============ AI Learning Operations ============

export const aiService = {
    status: () => api.get('/ai/status'),
    explainCode: (code, language) => api.post('/ai/explain', { code, language }),
    generateDiagram: (code, language, type = 'flowchart') =>
        api.post('/ai/diagram', { code, language, type }),
    suggestResources: (code, language) => api.post('/ai/resources', { code, language }),
    analyzeCode: (code, language) => api.post('/ai/analyze', { code, language }),
    analyzeCodeChamp: (code, language, action = 'analyze', url = '', target = '') =>
        api.post('/ai/code-champ', { code, language, action, url, target }),
    chat: (code, language, query, history, apiKey = null, provider = null, images = []) =>
        api.post('/ai/chat', { code, language, query, history, apiKey, provider, images }),
    review: (code, language) => api.post('/ai/review', { code, language }),
    refactor: (code, language) => api.post('/ai/refactor', { code, language }),
    generateTests: (code, language) => api.post('/ai/generate-tests', { code, language }),
    generateDocs: (code, language) => api.post('/ai/generate-docs', { code, language }),
    translate: (code, language, targetLanguage) =>
        api.post('/ai/translate', { code, language, targetLanguage }),
    fixCode: (code, language, error = '') => api.post('/ai/fix', { code, language, error }),
    suggestCommitMessage: (files, diff) =>
        api.post('/ai/commit-message', { files, diff }),

    // ── Advanced AI Features ──────────────────────────────────────
    // 1. Code Refactoring
    extractFunctions: (code, language) => api.post('/ai/extract-functions', { code, language }),
    renameVariables: (code, language) => api.post('/ai/rename-variables', { code, language }),

    // 2. Code Analysis
    analyzePerformance: (code, language) => api.post('/ai/performance', { code, language }),
    detectDeadCode: (code, language) => api.post('/ai/dead-code', { code, language }),
    analyzeComplexity: (code, language) => api.post('/ai/complexity', { code, language }),

    // 3. Test Generation
    generateEdgeTests: (code, language) => api.post('/ai/edge-tests', { code, language }),

    // 4. Documentation
    generateReadme: (code, language) => api.post('/ai/generate-readme', { code, language }),
    generateApiDocs: (code, language) => api.post('/ai/api-docs', { code, language }),
    addInlineComments: (code, language) => api.post('/ai/inline-comments', { code, language }),

    // 5. Code Search & Navigation
    semanticSearch: (code, language, query) => api.post('/ai/semantic-search', { code, language, query }),
    analyzeDependencies: (code, language) => api.post('/ai/dependency-analysis', { code, language }),

    // 6. Debugging
    analyzeStackTrace: (code, language, error) => api.post('/ai/stack-trace', { code, language, error }),
    predictBugs: (code, language) => api.post('/ai/bug-predict', { code, language }),

    // 7. Code Completion & Snippets
    suggestDesignPatterns: (code, language) => api.post('/ai/design-patterns', { code, language }),
    generateBoilerplate: (description, language) => api.post('/ai/boilerplate', { description, language }),

    // 8. Multi-File Operations
    generateMigration: (code, language, fromVersion = '', toVersion = '') =>
        api.post('/ai/migration', { code, language, fromVersion, toVersion }),
};


// ============ Java Service (Advanced Analysis) ============

const javaApi = axios.create({
    baseURL: import.meta.env.VITE_JAVA_API_URL
        ? `${import.meta.env.VITE_JAVA_API_URL}/api`
        : 'http://127.0.0.1:8080/api',
    timeout: 60000,
    headers: {
        'Content-Type': 'application/json'
    }
});

export const analyzerService = {
    health: () => javaApi.get('/analyze/health'),
    structure: (code, language) =>
        javaApi.post('/analyze/structure', { code, language }),
    complexity: (code, language) =>
        javaApi.post('/analyze/complexity', { code, language }),
    dependencies: (code, language) =>
        javaApi.post('/analyze/dependencies', { code, language }),
    suggestions: (code, language) =>
        javaApi.post('/analyze/suggestions', { code, language })
};

// ============ LSP (Language Server Protocol) ============

export const lspService = {
    status: () => api.get('/lsp/status'),
    install: (language) => api.post(`/lsp/install/${language}`),
};

export default api;

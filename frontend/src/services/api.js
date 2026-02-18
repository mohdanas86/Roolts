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
    chat: (code, language, query, history, apiKey = null, provider = null, images = [], signal = null, executionOutput = '') =>
        api.post('/ai/chat', { code, language, query, history, apiKey, provider, images, executionOutput }, { signal }),
    review: (code, language, error = '', signal = null) => api.post('/ai/review', { code, language, error }, { signal }),
    refactor: (code, language, error = '', signal = null) => api.post('/ai/refactor', { code, language, error }, { signal }),
    generateTests: (code, language, error = '', signal = null) => api.post('/ai/generate-tests', { code, language, error }, { signal }),
    generateDocs: (code, language, error = '', signal = null) => api.post('/ai/generate-docs', { code, language, error }, { signal }),
    translate: (code, language, targetLanguage, error = '', signal = null) =>
        api.post('/ai/translate', { code, language, targetLanguage, error }, { signal }),
    fixCode: (code, language, error = '', signal = null) => api.post('/ai/fix', { code, language, error }, { signal }),
    suggestCommitMessage: (files, diff) =>
        api.post('/ai/commit-message', { files, diff }),

    // ── Advanced AI Features ──────────────────────────────────────
    // 1. Code Refactoring (signal support)
    extractFunctions: (code, language, error = '', signal = null) => api.post('/ai/extract-functions', { code, language, error }, { signal }),
    renameVariables: (code, language, error = '', signal = null) => api.post('/ai/rename-variables', { code, language, error }, { signal }),

    // 2. Code Analysis (signal support)
    analyzePerformance: (code, language, error = '', signal = null) => api.post('/ai/performance', { code, language, error }, { signal }),
    detectDeadCode: (code, language, error = '', signal = null) => api.post('/ai/dead-code', { code, language, error }, { signal }),
    analyzeComplexity: (code, language, error = '', signal = null) => api.post('/ai/complexity', { code, language, error }, { signal }),

    // 3. Test Generation (signal support)
    generateEdgeTests: (code, language, error = '', signal = null) => api.post('/ai/edge-tests', { code, language, error }, { signal }),

    // 4. Documentation (signal support)
    generateReadme: (code, language, error = '', signal = null) => api.post('/ai/generate-readme', { code, language, error }, { signal }),
    generateApiDocs: (code, language, error = '', signal = null) => api.post('/ai/api-docs', { code, language, error }, { signal }),
    addInlineComments: (code, language, error = '', signal = null) => api.post('/ai/inline-comments', { code, language, error }, { signal }),

    // 5. Code Search & Navigation (signal support)
    semanticSearch: (code, language, query, error = '', signal = null) => api.post('/ai/semantic-search', { code, language, query, error }, { signal }),
    analyzeDependencies: (code, language, error = '', signal = null) => api.post('/ai/dependency-analysis', { code, language, error }, { signal }),

    // 6. Debugging (signal support)
    analyzeStackTrace: (code, language, error, signal = null) => api.post('/ai/stack-trace', { code, language, error }, { signal }),
    predictBugs: (code, language, error = '', signal = null) => api.post('/ai/bug-predict', { code, language, error }, { signal }),

    // 7. Code Completion & Snippets (signal support)
    suggestDesignPatterns: (code, language, error = '', signal = null) => api.post('/ai/design-patterns', { code, language, error }, { signal }),
    generateBoilerplate: (description, language, signal = null) => api.post('/ai/boilerplate', { description, language }, { signal }),

    // 8. Multi-File Operations (signal support)
    generateMigration: (code, language, fromVersion = '', toVersion = '', error = '', signal = null) =>
        api.post('/ai/migration', { code, language, fromVersion, toVersion, error }, { signal }),
};


// ============ Java Service (Advanced Analysis) ============

const javaApi = axios.create({
    baseURL: import.meta.env.VITE_JAVA_API_URL
        ? `${import.meta.env.VITE_JAVA_API_URL}/api`
        : '/api/analyzer-proxy',
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

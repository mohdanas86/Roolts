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
    explainCode: (code, language) => api.post('/ai/explain', { code, language }),
    generateDiagram: (code, language, type = 'flowchart') =>
        api.post('/ai/diagram', { code, language, type }),
    suggestResources: (code, language) => api.post('/ai/resources', { code, language }),
    analyzeCode: (code, language) => api.post('/ai/analyze', { code, language }),
    analyzeCodeChamp: (code, language, action = 'analyze', url = '', target = '') =>
        api.post('/ai/code-champ', { code, language, action, url, target }),
    chat: (code, language, query, history, apiKey = null, provider = null, images = []) =>
        api.post('/ai/chat', { code, language, query, history, apiKey, provider, images }),
    suggestCommitMessage: (files, diff) =>
        api.post('/ai/commit-message', { files, diff })
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

export default api;

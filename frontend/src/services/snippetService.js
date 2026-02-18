
import api from './api';

export const snippetService = {
    getAll: async () => {
        const response = await api.get('/snippets');
        return response.data;
    },

    create: async (snippet) => {
        const response = await api.post('/snippets', snippet);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/snippets/${id}`);
        return response.data;
    }
};

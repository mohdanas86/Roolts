/**
 * Authentication Service
 * Handles user login, registration, and session management
 */

import api from './api';

const TOKEN_KEY = 'roolts_token';
const USER_KEY = 'roolts_user';

export const authService = {
    // ============ Authentication ============
    
    /**
     * Register a new user
     */
    register: async (name, email, password) => {
        const response = await api.post('/auth/register', { name, email, password });
        if (response.data.token) {
            localStorage.setItem(TOKEN_KEY, response.data.token);
            localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
        }
        return response.data;
    },

    /**
     * Login an existing user
     */
    login: async (email, password) => {
        const response = await api.post('/auth/login', { email, password });
        if (response.data.token) {
            localStorage.setItem(TOKEN_KEY, response.data.token);
            localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
        }
        return response.data;
    },

    /**
     * Logout current user
     */
    logout: () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    },

    /**
     * Get current user from localStorage
     */
    getCurrentUser: () => {
        const user = localStorage.getItem(USER_KEY);
        return user ? JSON.parse(user) : null;
    },

    /**
     * Get auth token
     */
    getToken: () => {
        return localStorage.getItem(TOKEN_KEY);
    },

    /**
     * Check if user is authenticated
     */
    isAuthenticated: () => {
        return !!localStorage.getItem(TOKEN_KEY);
    },

    /**
     * Get current user profile from server
     */
    getProfile: async () => {
        const response = await api.get('/auth/me');
        localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
        return response.data.user;
    },

    /**
     * Update user profile
     */
    updateProfile: async (data) => {
        const response = await api.put('/auth/profile', data);
        localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
        return response.data;
    },

    /**
     * Update AI API keys
     */
    updateApiKeys: async (keys) => {
        const response = await api.put('/auth/api-keys', keys);
        return response.data;
    },

    // ============ Social OAuth ============

    /**
     * Get Twitter OAuth URL
     */
    connectTwitter: async () => {
        const response = await api.get('/auth/twitter/connect');
        return response.data.auth_url;
    },

    /**
     * Handle Twitter OAuth callback
     */
    twitterCallback: async (code, state) => {
        const response = await api.post('/auth/twitter/callback', { code, state });
        return response.data;
    },

    /**
     * Get LinkedIn OAuth URL
     */
    connectLinkedIn: async () => {
        const response = await api.get('/auth/linkedin/connect');
        return response.data.auth_url;
    },

    /**
     * Handle LinkedIn OAuth callback
     */
    linkedinCallback: async (code, state) => {
        const response = await api.post('/auth/linkedin/callback', { code, state });
        return response.data;
    },

    /**
     * Get connected social accounts
     */
    getConnections: async () => {
        const response = await api.get('/auth/connections');
        return response.data.connections;
    },

    /**
     * Disconnect a social platform
     */
    disconnect: async (platform) => {
        const response = await api.delete(`/auth/connections/${platform}`);
        return response.data;
    }
};

// Add auth token to all requests
api.interceptors.request.use((config) => {
    const token = authService.getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 responses (token expired)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            authService.logout();
            window.location.href = '/';
        }
        return Promise.reject(error);
    }
);

export default authService;

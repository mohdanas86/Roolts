/**
 * Real-Time Validator Service
 * Provides real-time syntax and error validation for Monaco Editor
 */

import { pythonValidator } from './validators/pythonValidator.js';
import { genericValidator } from './validators/genericValidator.js';

class RealtimeValidator {
    constructor() {
        this.monaco = null;
        this.editor = null;
        this.debounceTimer = null;
        this.debounceDelay = 500; // Default 500ms
        this.isValidating = false;
        this.pendingValidation = false;
        this.currentLanguage = null;
        this.abortController = null;
        this.validatorDisposed = false;
    }

    /**
     * Initialize the validator with Monaco editor instance
     * @param {object} monaco - Monaco editor module
     * @param {object} editor - Monaco editor instance
     */
    initialize(monaco, editor) {
        this.monaco = monaco;
        this.editor = editor;
        this.validatorDisposed = false;

        // Set up content change listener
        const model = editor.getModel();
        if (model) {
            model.onDidChangeContent(() => {
                this.scheduleValidation();
            });
        }

        console.log('[RealtimeValidator] Initialized');
    }

    /**
     * Schedule validation with debouncing
     */
    scheduleValidation() {
        if (this.validatorDisposed) return;

        // Clear existing timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Cancel in-progress validation
        if (this.isValidating && this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }

        // Mark as pending
        this.pendingValidation = true;

        // Get file size to determine debounce delay
        const model = this.editor?.getModel();
        if (model) {
            const lineCount = model.getLineCount();
            const delay = lineCount > 5000 ? 1000 : this.debounceDelay;

            // Schedule validation
            this.debounceTimer = setTimeout(() => {
                this.runValidation();
            }, delay);
        }
    }

    /**
     * Run validation on current editor content
     */
    async runValidation() {
        if (this.validatorDisposed || !this.editor || !this.monaco) return;

        const model = this.editor.getModel();
        if (!model) return;

        this.isValidating = true;
        this.pendingValidation = false;
        this.abortController = new AbortController();

        try {
            const code = model.getValue();
            const language = model.getLanguageId();
            const fileName = model.uri?.path || 'untitled';

            this.currentLanguage = language;

            // Validate code
            const markers = await this.validate(code, language, fileName);

            // Check if validation was aborted
            if (this.abortController.signal.aborted) {
                return;
            }

            // Set markers with 'realtime' owner
            this.monaco.editor.setModelMarkers(model, 'realtime', markers);

        } catch (error) {
            console.error('[RealtimeValidator] Validation error:', error);
            // Clear markers on error
            if (model && this.monaco) {
                this.monaco.editor.setModelMarkers(model, 'realtime', []);
            }
        } finally {
            this.isValidating = false;
            this.abortController = null;
        }
    }

    /**
     * Validate code and return markers
     * @param {string} code - Code to validate
     * @param {string} language - Programming language
     * @param {string} fileName - File name
     * @returns {Promise<Array>} Array of markers
     */
    async validate(code, language, fileName) {
        const markers = [];
        
        try {
            // Route to appropriate validator based on language
            const lang = language.toLowerCase();
            
            switch (lang) {
                case 'python':
                    // Use Python validator
                    const pythonResults = pythonValidator.validate(code);
                    markers.push(...pythonResults);
                    break;
                    
                case 'javascript':
                case 'typescript':
                case 'javascriptreact':
                case 'typescriptreact':
                    // Monaco has built-in validation for these
                    // We'll integrate Monaco diagnostics separately
                    break;
                    
                case 'html':
                case 'css':
                case 'json':
                    // Monaco has built-in validation
                    break;
                    
                case 'java':
                case 'c':
                case 'cpp':
                case 'go':
                default:
                    // Use generic validator for other languages
                    const genericResults = genericValidator.validate(code, language);
                    markers.push(...genericResults);
                    break;
            }
            
        } catch (error) {
            console.error('[RealtimeValidator] Validation error:', error);
        }
        
        return markers;
    }

    /**
     * Set debounce delay
     * @param {number} ms - Delay in milliseconds
     */
    setDebounceDelay(ms) {
        this.debounceDelay = ms;
    }

    /**
     * Dispose validator and clean up resources
     */
    dispose() {
        this.validatorDisposed = true;

        // Clear timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        // Cancel validation
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }

        // Clear markers
        if (this.editor && this.monaco) {
            const model = this.editor.getModel();
            if (model) {
                this.monaco.editor.setModelMarkers(model, 'realtime', []);
            }
        }

        this.monaco = null;
        this.editor = null;

        console.log('[RealtimeValidator] Disposed');
    }
}

// Export singleton instance
export const realtimeValidator = new RealtimeValidator();

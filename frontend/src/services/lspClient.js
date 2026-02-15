/**
 * LSP Client Service
 * ==================
 * Connects Monaco Editor to backend Language Servers via SocketIO.
 * 
 * Architecture:
 *   Monaco Editor  <--providers-->  LSPClient  <--SocketIO-->  Flask  <--stdio-->  pylsp/jdtls/clangd
 *
 * This service:
 *   1. Connects to the backend via SocketIO
 *   2. Sends LSP initialize/textDocument messages
 *   3. Receives diagnostics, completions, hover info
 *   4. Registers Monaco providers (completion, hover, diagnostics, formatting)
 */

import io from 'socket.io-client';

class LSPClient {
    constructor() {
        this.socket = null;
        this.monaco = null;
        this.activeServers = new Map(); // language -> { initialized, capabilities, requestId }
        this.pendingRequests = new Map(); // requestId -> { resolve, reject, timeout }
        this.nextId = 1;
        this.disposables = [];
        this.diagnosticCollections = new Map(); // uri -> markers
        this.currentFileUri = null;
        this.currentLanguage = null;
        this.currentContent = null;
        this.documentVersions = new Map(); // uri -> version number
    }

    /**
     * Initialize the LSP client with Monaco and connect to backend.
     */
    initialize(monaco, backendUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000') {
        this.monaco = monaco;

        if (this.socket) return; // Already connected

        this.socket = io(backendUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
        });

        this.socket.on('connect', () => {
            console.log('[LSP] Connected to backend');
        });

        this.socket.on('lsp:started', (data) => {
            console.log(`[LSP] Server started: ${data.language}`);
            this._onServerStarted(data.language);
        });

        this.socket.on('lsp:message', (data) => {
            this._handleServerMessage(data.language, data.message);
        });

        this.socket.on('lsp:error', (data) => {
            console.error(`[LSP] Server error: ${data.error}`);
        });

        this.socket.on('lsp:stopped', (data) => {
            console.log(`[LSP] Server stopped: ${data.language}`);
            this.activeServers.delete(data.language);
        });

        // Register Monaco providers
        this._registerProviders();
    }

    /**
     * Start a language server for the given language.
     */
    startServer(language) {
        if (!this.socket || !language) return;

        // Don't start for JS/TS — Monaco has built-in support
        if (['javascript', 'typescript'].includes(language)) return;

        // Map editor languages to LSP server languages
        const lspLang = this._mapLanguage(language);
        if (!lspLang) return;

        if (this.activeServers.has(lspLang)) return; // Already running

        console.log(`[LSP] Requesting server for: ${lspLang}`);
        this.socket.emit('lsp:start', { language: lspLang });
    }

    /**
     * Called when a language server has started. Send initialize request.
     */
    _onServerStarted(language) {
        const id = this._nextId();

        this.activeServers.set(language, {
            initialized: false,
            capabilities: {},
            requestId: id,
        });

        // Send LSP initialize
        this._sendRequest(language, id, 'initialize', {
            processId: null,
            capabilities: {
                textDocument: {
                    completion: {
                        completionItem: {
                            snippetSupport: true,
                            commitCharactersSupport: true,
                            documentationFormat: ['markdown', 'plaintext'],
                        },
                    },
                    hover: {
                        contentFormat: ['markdown', 'plaintext'],
                    },
                    publishDiagnostics: {
                        relatedInformation: true,
                    },
                    formatting: {},
                    signatureHelp: {
                        signatureInformation: {
                            documentationFormat: ['markdown', 'plaintext'],
                        },
                    },
                },
                workspace: {
                    workspaceFolders: false,
                },
            },
            rootUri: 'file:///workspace',
            workspaceFolders: null,
        }).then((result) => {
            const server = this.activeServers.get(language);
            if (server) {
                server.initialized = true;
                server.capabilities = result.capabilities || {};
                console.log(`[LSP] Server ${language} initialized`, server.capabilities);
            }

            // Send initialized notification
            this._sendNotification(language, 'initialized', {});

            // If we have a current document, open it
            if (this.currentFileUri && this._mapLanguage(this.currentLanguage) === language) {
                this._sendDidOpen(language, this.currentFileUri, this.currentLanguage, this.currentContent);
            }
        }).catch((err) => {
            console.error(`[LSP] Initialize failed for ${language}:`, err);
        });
    }

    /**
     * Notify the LSP server about a document being opened.
     */
    openDocument(uri, language, content) {
        this.currentFileUri = uri;
        this.currentLanguage = language;
        this.currentContent = content;
        this.documentVersions.set(uri, 1);

        const lspLang = this._mapLanguage(language);
        if (!lspLang) return;

        // Start server if not running
        this.startServer(language);

        const server = this.activeServers.get(lspLang);
        if (server && server.initialized) {
            this._sendDidOpen(lspLang, uri, language, content);
        }
    }

    /**
     * Notify the LSP server about document changes.
     */
    changeDocument(uri, language, content) {
        this.currentContent = content;
        const lspLang = this._mapLanguage(language);
        if (!lspLang) return;

        const server = this.activeServers.get(lspLang);
        if (!server || !server.initialized) return;

        const version = (this.documentVersions.get(uri) || 0) + 1;
        this.documentVersions.set(uri, version);

        this._sendNotification(lspLang, 'textDocument/didChange', {
            textDocument: { uri, version },
            contentChanges: [{ text: content }],
        });
    }

    /**
     * Request completions from the LSP server.
     */
    async getCompletions(uri, language, position) {
        const lspLang = this._mapLanguage(language);
        if (!lspLang) return null;

        const server = this.activeServers.get(lspLang);
        if (!server || !server.initialized) return null;

        try {
            const result = await this._sendRequest(lspLang, this._nextId(), 'textDocument/completion', {
                textDocument: { uri },
                position: { line: position.lineNumber - 1, character: position.column - 1 },
            });
            return result;
        } catch (err) {
            console.warn('[LSP] Completion request failed:', err);
            return null;
        }
    }

    /**
     * Request hover info from the LSP server.
     */
    async getHover(uri, language, position) {
        const lspLang = this._mapLanguage(language);
        if (!lspLang) return null;

        const server = this.activeServers.get(lspLang);
        if (!server || !server.initialized) return null;

        try {
            const result = await this._sendRequest(lspLang, this._nextId(), 'textDocument/hover', {
                textDocument: { uri },
                position: { line: position.lineNumber - 1, character: position.column - 1 },
            });
            return result;
        } catch (err) {
            return null;
        }
    }

    /**
     * Request formatting from the LSP server.
     */
    async formatDocument(uri, language) {
        const lspLang = this._mapLanguage(language);
        if (!lspLang) return null;

        const server = this.activeServers.get(lspLang);
        if (!server || !server.initialized) return null;

        try {
            const result = await this._sendRequest(lspLang, this._nextId(), 'textDocument/formatting', {
                textDocument: { uri },
                options: { tabSize: 4, insertSpaces: true },
            });
            return result;
        } catch (err) {
            return null;
        }
    }

    // ── Monaco Provider Registration ─────────────────────────────────────

    _registerProviders() {
        const monaco = this.monaco;
        const self = this;

        // Languages that have LSP servers (not JS/TS, which use built-in)
        const lspLanguages = ['python', 'java', 'c', 'cpp'];

        lspLanguages.forEach(lang => {
            // Completion Provider
            const completionDisposable = monaco.languages.registerCompletionItemProvider(lang, {
                triggerCharacters: ['.', ':', '(', '"', "'", '/', '@', '<'],
                provideCompletionItems: async (model, position) => {
                    const uri = model.uri.toString();
                    const result = await self.getCompletions(uri, lang, position);
                    if (!result) return { suggestions: [] };

                    const items = result.items || (Array.isArray(result) ? result : []);
                    const suggestions = items.map(item => ({
                        label: item.label || '',
                        kind: self._mapCompletionKind(item.kind),
                        detail: item.detail || '',
                        documentation: item.documentation
                            ? (typeof item.documentation === 'string'
                                ? item.documentation
                                : { value: item.documentation.value || '' })
                            : '',
                        insertText: item.insertText || item.textEdit?.newText || item.label || '',
                        insertTextRules: item.insertTextFormat === 2
                            ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                            : undefined,
                        sortText: item.sortText,
                        filterText: item.filterText,
                        range: item.textEdit?.range
                            ? {
                                startLineNumber: item.textEdit.range.start.line + 1,
                                startColumn: item.textEdit.range.start.character + 1,
                                endLineNumber: item.textEdit.range.end.line + 1,
                                endColumn: item.textEdit.range.end.character + 1,
                            }
                            : undefined,
                    }));

                    return { suggestions };
                },
            });
            this.disposables.push(completionDisposable);

            // Hover Provider
            const hoverDisposable = monaco.languages.registerHoverProvider(lang, {
                provideHover: async (model, position) => {
                    const uri = model.uri.toString();
                    const result = await self.getHover(uri, lang, position);
                    if (!result || !result.contents) return null;

                    let contents;
                    if (typeof result.contents === 'string') {
                        contents = [{ value: result.contents }];
                    } else if (result.contents.kind) {
                        contents = [{ value: result.contents.value }];
                    } else if (Array.isArray(result.contents)) {
                        contents = result.contents.map(c =>
                            typeof c === 'string' ? { value: c } : { value: c.value || String(c) }
                        );
                    } else {
                        contents = [{ value: String(result.contents.value || result.contents) }];
                    }

                    return {
                        contents,
                        range: result.range ? {
                            startLineNumber: result.range.start.line + 1,
                            startColumn: result.range.start.character + 1,
                            endLineNumber: result.range.end.line + 1,
                            endColumn: result.range.end.character + 1,
                        } : undefined,
                    };
                },
            });
            this.disposables.push(hoverDisposable);

            // Formatting Provider
            const formattingDisposable = monaco.languages.registerDocumentFormattingEditProvider(lang, {
                provideDocumentFormattingEdits: async (model) => {
                    const uri = model.uri.toString();
                    const edits = await self.formatDocument(uri, lang);
                    if (!edits || !Array.isArray(edits)) return [];

                    return edits.map(edit => ({
                        range: {
                            startLineNumber: edit.range.start.line + 1,
                            startColumn: edit.range.start.character + 1,
                            endLineNumber: edit.range.end.line + 1,
                            endColumn: edit.range.end.character + 1,
                        },
                        text: edit.newText,
                    }));
                },
            });
            this.disposables.push(formattingDisposable);
        });
    }

    // ── Internal LSP Communication ───────────────────────────────────────

    _sendRequest(language, id, method, params) {
        return new Promise((resolve, reject) => {
            const message = {
                jsonrpc: '2.0',
                id,
                method,
                params,
            };

            // Set up response handler with timeout
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`LSP request timeout: ${method}`));
            }, 10000);

            this.pendingRequests.set(id, { resolve, reject, timeout });

            this.socket.emit('lsp:message', { language, message });
        });
    }

    _sendNotification(language, method, params) {
        const message = {
            jsonrpc: '2.0',
            method,
            params,
        };
        this.socket.emit('lsp:message', { language, message });
    }

    _sendDidOpen(language, uri, editorLanguage, content) {
        this._sendNotification(language, 'textDocument/didOpen', {
            textDocument: {
                uri,
                languageId: editorLanguage,
                version: this.documentVersions.get(uri) || 1,
                text: content || '',
            },
        });
    }

    _handleServerMessage(language, message) {
        // Handle response to a request
        if (message.id !== undefined && message.id !== null) {
            const pending = this.pendingRequests.get(message.id);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(message.id);

                if (message.error) {
                    pending.reject(message.error);
                } else {
                    pending.resolve(message.result);
                }
                return;
            }
        }

        // Handle server-initiated notifications
        if (message.method) {
            this._handleNotification(language, message.method, message.params);
        }
    }

    _handleNotification(language, method, params) {
        switch (method) {
            case 'textDocument/publishDiagnostics':
                this._handleDiagnostics(params);
                break;
            case 'window/logMessage':
            case 'window/showMessage':
                if (params.message) {
                    console.log(`[LSP-${language}] ${params.message}`);
                }
                break;
            default:
                // Ignore other notifications
                break;
        }
    }

    _handleDiagnostics(params) {
        if (!this.monaco || !params) return;

        const uri = params.uri;
        const diagnostics = params.diagnostics || [];

        // Convert LSP diagnostics to Monaco markers
        const markers = diagnostics.map(d => ({
            severity: this._mapDiagnosticSeverity(d.severity),
            startLineNumber: (d.range?.start?.line || 0) + 1,
            startColumn: (d.range?.start?.character || 0) + 1,
            endLineNumber: (d.range?.end?.line || 0) + 1,
            endColumn: (d.range?.end?.character || 0) + 1,
            message: d.message || 'Unknown error',
            source: d.source || 'lsp',
            code: d.code ? String(d.code) : undefined,
        }));

        // Find the model for this URI and set markers
        const models = this.monaco.editor.getModels();
        for (const model of models) {
            if (model.uri.toString() === uri || model.uri.toString().includes(uri.split('/').pop())) {
                this.monaco.editor.setModelMarkers(model, 'lsp', markers);
                break;
            }
        }
    }

    // ── Utility Mappers ──────────────────────────────────────────────────

    _mapLanguage(editorLang) {
        const map = {
            python: 'python',
            java: 'java',
            c: 'c',
            cpp: 'cpp',
        };
        return map[editorLang] || null;
    }

    _mapCompletionKind(lspKind) {
        const monaco = this.monaco;
        if (!monaco) return 0;
        const map = {
            1: monaco.languages.CompletionItemKind.Text,
            2: monaco.languages.CompletionItemKind.Method,
            3: monaco.languages.CompletionItemKind.Function,
            4: monaco.languages.CompletionItemKind.Constructor,
            5: monaco.languages.CompletionItemKind.Field,
            6: monaco.languages.CompletionItemKind.Variable,
            7: monaco.languages.CompletionItemKind.Class,
            8: monaco.languages.CompletionItemKind.Interface,
            9: monaco.languages.CompletionItemKind.Module,
            10: monaco.languages.CompletionItemKind.Property,
            11: monaco.languages.CompletionItemKind.Unit,
            12: monaco.languages.CompletionItemKind.Value,
            13: monaco.languages.CompletionItemKind.Enum,
            14: monaco.languages.CompletionItemKind.Keyword,
            15: monaco.languages.CompletionItemKind.Snippet,
            16: monaco.languages.CompletionItemKind.Color,
            17: monaco.languages.CompletionItemKind.File,
            18: monaco.languages.CompletionItemKind.Reference,
            19: monaco.languages.CompletionItemKind.Folder,
            20: monaco.languages.CompletionItemKind.EnumMember,
            21: monaco.languages.CompletionItemKind.Constant,
            22: monaco.languages.CompletionItemKind.Struct,
            23: monaco.languages.CompletionItemKind.Event,
            24: monaco.languages.CompletionItemKind.Operator,
            25: monaco.languages.CompletionItemKind.TypeParameter,
        };
        return map[lspKind] || monaco.languages.CompletionItemKind.Text;
    }

    _mapDiagnosticSeverity(lspSeverity) {
        const monaco = this.monaco;
        if (!monaco) return 8;
        switch (lspSeverity) {
            case 1: return monaco.MarkerSeverity.Error;
            case 2: return monaco.MarkerSeverity.Warning;
            case 3: return monaco.MarkerSeverity.Info;
            case 4: return monaco.MarkerSeverity.Hint;
            default: return monaco.MarkerSeverity.Error;
        }
    }

    _nextId() {
        return this.nextId++;
    }

    /**
     * Clean up: stop all servers, dispose providers.
     */
    dispose() {
        // Dispose Monaco providers
        this.disposables.forEach(d => {
            if (d && typeof d.dispose === 'function') d.dispose();
        });
        this.disposables = [];

        // Clear pending requests
        this.pendingRequests.forEach(p => {
            clearTimeout(p.timeout);
            p.reject(new Error('LSP client disposed'));
        });
        this.pendingRequests.clear();

        // Disconnect socket
        if (this.socket) {
            this.activeServers.forEach((_, lang) => {
                this.socket.emit('lsp:stop', { language: lang });
            });
            this.socket.disconnect();
            this.socket = null;
        }

        this.activeServers.clear();
    }
}

export const lspClient = new LSPClient();

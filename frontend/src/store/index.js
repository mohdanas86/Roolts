import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

// File Store - manages files and editor state (persisted)
export const useFileStore = create(
    persist(
        (set, get) => ({
            files: [
                {
                    id: '1',
                    name: 'main.py',
                    path: '/main.py',
                    content: `# Welcome to Roolts!
# Start coding here...

def hello_world():
    """A simple hello world function"""
    print("Hello from Roolts!")
    return True

if __name__ == "__main__":
    hello_world()
`,
                    language: 'python',
                    modified: false
                },
                {
                    id: '2',
                    name: 'App.js',
                    path: '/src/App.js',
                    content: `import React from 'react';

function App() {
  return (
    <div className="App">
      <h1>Hello, Roolts!</h1>
    </div>
  );
}

export default App;
`,
                    language: 'javascript',
                    modified: false
                }
            ],
            activeFileId: '1',
            openFiles: ['1'],

            // Actions
            setActiveFile: (fileId) => set({ activeFileId: fileId }),

            openFile: (fileId) => set((state) => ({
                openFiles: state.openFiles.includes(fileId)
                    ? state.openFiles
                    : [...state.openFiles, fileId],
                activeFileId: fileId
            })),

            closeFile: (fileId) => set((state) => {
                const newOpenFiles = state.openFiles.filter((id) => id !== fileId);
                return {
                    openFiles: newOpenFiles,
                    activeFileId: state.activeFileId === fileId
                        ? newOpenFiles[newOpenFiles.length - 1] || null
                        : state.activeFileId
                };
            }),

            closeFiles: (fileIds) => set((state) => {
                const idsToClose = new Set(fileIds);
                const newOpenFiles = state.openFiles.filter((id) => !idsToClose.has(id));
                const newActiveFileId = idsToClose.has(state.activeFileId)
                    ? newOpenFiles[newOpenFiles.length - 1] || null
                    : state.activeFileId;

                return {
                    openFiles: newOpenFiles,
                    activeFileId: newActiveFileId
                };
            }),

            // Reordering Actions
            reorderFiles: (sourceIndex, destinationIndex) => set((state) => {
                const newFiles = [...state.files];
                const [reorderedItem] = newFiles.splice(sourceIndex, 1);
                newFiles.splice(destinationIndex, 0, reorderedItem);
                return { files: newFiles };
            }),

            reorderTabs: (sourceIndex, destinationIndex) => set((state) => {
                const newOpenFiles = [...state.openFiles];
                const [reorderedItem] = newOpenFiles.splice(sourceIndex, 1);
                newOpenFiles.splice(destinationIndex, 0, reorderedItem);
                return { openFiles: newOpenFiles };
            }),

            updateFileContent: (fileId, content) => set((state) => {
                let updatedFiles = state.files.map((file) => {
                    if (file.id === fileId) {
                        let newName = file.name;
                        let newPath = file.path;

                        // Auto-rename Java files based on public class name
                        if (file.language === 'java') {
                            const match = content.match(/public\s+class\s+(\w+)/);
                            if (match && match[1]) {
                                const className = match[1];
                                if (file.name !== `${className}.java`) {
                                    newName = `${className}.java`;
                                    // Update path to match new filename
                                    // Assuming path ends with filename
                                    newPath = file.path.substring(0, file.path.lastIndexOf('/') + 1) + newName;
                                }
                            }
                        }

                        return { ...file, content, name: newName, path: newPath, modified: true };
                    }
                    return file;
                });
                return { files: updatedFiles };
            }),

            moveFile: (fileId, newPath) => set((state) => {
                const updatedFiles = state.files.map((file) => {
                    if (file.id === fileId) {
                        return { ...file, path: newPath };
                    }
                    return file;
                });
                return { files: updatedFiles };
            }),

            addFile: (name, content = '', language = 'plaintext') => {
                const id = Date.now().toString();
                set((state) => ({
                    files: [
                        ...state.files,
                        {
                            id,
                            name,
                            path: `/${name}`,
                            content,
                            language,
                            modified: false,
                            highlights: [],
                            drawings: []
                        }
                    ],
                    openFiles: [...state.openFiles, id],
                    activeFileId: id
                }));
                const newFile = get().files.find(f => f.id === id);
                if (newFile) {
                    get().setActiveFile(id);
                    get().openFile(id);
                }
                return id;
            },

            addHighlight: (fileId, highlight) => set((state) => ({
                files: state.files.map((file) =>
                    file.id === fileId
                        ? { ...file, highlights: [...(file.highlights || []), highlight], modified: true }
                        : file
                )
            })),

            updateHighlight: (fileId, highlight) => set((state) => ({
                files: state.files.map((file) => {
                    if (file.id === fileId) {
                        const newHighlights = (file.highlights || []).map(h =>
                            h.id === highlight.id ? highlight : h
                        );
                        return { ...file, highlights: newHighlights, modified: true };
                    }
                    return file;
                })
            })),

            removeHighlight: (fileId, highlightId) => set((state) => ({
                files: state.files.map((file) =>
                    file.id === fileId
                        ? { ...file, highlights: (file.highlights || []).filter(h => h.id !== highlightId), modified: true }
                        : file
                )
            })),

            // Drawing Actions
            addDrawing: (fileId, drawing) => set((state) => ({
                files: state.files.map((file) =>
                    file.id === fileId
                        ? { ...file, drawings: [...(file.drawings || []), drawing], modified: true }
                        : file
                )
            })),

            removeDrawing: (fileId, drawingId) => set((state) => ({
                files: state.files.map((file) =>
                    file.id === fileId
                        ? { ...file, drawings: (file.drawings || []).filter(d => d.id !== drawingId), modified: true }
                        : file
                )
            })),

            clearDrawings: (fileId) => set((state) => ({
                files: state.files.map((file) =>
                    file.id === fileId
                        ? { ...file, drawings: [], modified: true }
                        : file
                )
            })),

            removeLastDrawing: (fileId) => set((state) => ({
                files: state.files.map((file) => {
                    if (file.id === fileId) {
                        const drawings = file.drawings || [];
                        return { ...file, drawings: drawings.slice(0, -1), modified: true };
                    }
                    return file;
                })
            })),


            deleteFile: (fileId) => set((state) => ({
                files: state.files.filter((file) => file.id !== fileId),
                openFiles: state.openFiles.filter((id) => id !== fileId),
                activeFileId: state.activeFileId === fileId ? state.openFiles[0] || null : state.activeFileId
            })),

            deleteFiles: (fileIds) => set((state) => {
                const idsToDelete = new Set(fileIds);
                return {
                    files: state.files.filter((file) => !idsToDelete.has(file.id)),
                    openFiles: state.openFiles.filter((id) => !idsToDelete.has(id)),
                    activeFileId: idsToDelete.has(state.activeFileId) ? state.openFiles.filter(id => !idsToDelete.has(id))[0] || null : state.activeFileId
                };
            }),

            markFileSaved: (fileId) => set((state) => ({
                files: state.files.map((file) =>
                    file.id === fileId ? { ...file, modified: false } : file
                )
            })),

            renameFile: (fileId, newName) => set((state) => ({
                files: state.files.map((file) =>
                    file.id === fileId
                        ? { ...file, name: newName, path: file.path.substring(0, file.path.lastIndexOf('/') + 1) + newName }
                        : file
                )
            })),

            getActiveFile: () => {
                const state = get();
                return state.files.find((file) => file.id === state.activeFileId);
            }
        }),
        {
            name: 'roolts-files-storage',
            partialize: (state) => ({
                files: state.files,
                activeFileId: state.activeFileId,
                openFiles: state.openFiles
            })
        }
    )
);



// Learning Store - manages AI learning features
export const useLearningStore = create((set) => ({
    explanation: null,
    diagram: null,
    resources: [],
    reviewResults: null,
    isGenerating: false,
    isReviewing: false,
    activeTab: 'explain',
    chatMessages: [],

    setExplanation: (explanation) => set({ explanation }),
    setDiagram: (diagram) => set({ diagram }),
    setResources: (resources) => set({ resources }),
    setReviewResults: (reviewResults) => set({ reviewResults }),
    setGenerating: (isGenerating) => set({ isGenerating }),
    setReviewing: (isReviewing) => set({ isReviewing }),
    setActiveTab: (activeTab) => set({ activeTab }),
    addChatMessage: (message) => set((state) => ({
        chatMessages: [...state.chatMessages, { ...message, id: Date.now() }]
    })),
    clearChat: () => set({ chatMessages: [] }),

    reset: () => set({
        explanation: null,
        diagram: null,
        resources: [],
        reviewResults: null,
        isGenerating: false,
        isReviewing: false
    })
}));

// UI Store - manages UI state
export const useUIStore = create(
    persist(
        (set) => ({
            sidebarOpen: true,
            rightPanelOpen: true,
            rightPanelTab: 'learn',
            editorMinimized: false,
            rightPanelExpanded: false,
            modals: {
                newFile: false,
                commitPush: false,
                share: false,
                settings: false,
                portfolioGenerator: false,
                deployment: false
            },
            notifications: [],
            rightPanelWidth: 600,
            lastOpenWidth: 600,
            isResizing: null,

            toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
            toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
            setIsResizing: (val) => set({ isResizing: val }),
            setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
            setRightPanelWidth: (width) => set({ rightPanelWidth: width }),
            toggleEditorMinimized: () => set((state) => ({ editorMinimized: !state.editorMinimized })),
            toggleRightPanelExpanded: () => set((state) => ({
                rightPanelExpanded: !state.rightPanelExpanded,
                editorMinimized: !state.rightPanelExpanded
            })),

            openModal: (modalName) => set((state) => ({
                modals: { ...state.modals, [modalName]: true }
            })),

            closeModal: (modalName) => set((state) => ({
                modals: { ...state.modals, [modalName]: false }
            })),

            addNotification: (notification) => {
                const id = Date.now();
                set((state) => ({
                    notifications: [...state.notifications, { ...notification, id }]
                }));
                // Auto-remove after 5 seconds
                setTimeout(() => {
                    set((state) => ({
                        notifications: state.notifications.filter((n) => n.id !== id)
                    }));
                }, 5000);
            },

            removeNotification: (id) => set((state) => ({
                notifications: state.notifications.filter((n) => n.id !== id)
            })),

            setLastOpenWidth: (width) => set({ lastOpenWidth: width })
        }),
        {
            name: 'roolts-ui-storage',
            partialize: (state) => ({
                sidebarOpen: state.sidebarOpen,
                rightPanelOpen: state.rightPanelOpen,
                rightPanelTab: state.rightPanelTab,
                rightPanelWidth: state.rightPanelWidth,
                lastOpenWidth: state.lastOpenWidth
            })
        }
    )
);

// Settings Store - manages user preferences (persisted)
export const useSettingsStore = create(
    persist(
        (set) => ({
            theme: 'vs-dark', // vs-dark, light, high-contrast-black
            backgroundImage: null, // Base64 or URL
            backgroundOpacity: 0.1, // 0 to 1
            uiFontSize: 14,
            uiFontFamily: 'Inter',
            format: {
                fontSize: 14,
                tabSize: 4,
                wordWrap: 'on', // on, off, wordWrapColumn, bounded
                fontFamily: "'Fira Code', Consolas, 'Courier New', monospace",
                lineHeight: 1.5
            },
            features: {
                minimap: true,
                lineNumbers: 'on', // on, off, relative, interval
                autoSave: false,
                livePreview: true,
                vimMode: false,
                validation: false
            },
            experimental: {
                scribble: false,
                customBackground: false,
                customBackground: false,
                vscodeApp: true
            },
            scribblePenSize: 3,
            scribbleEraserSize: 15,
            appOrder: [], // Persisted order of app IDs

            setTheme: (theme) => set({ theme }),
            setBackgroundImage: (image) => set({ backgroundImage: image }),
            setBackgroundOpacity: (opacity) => set({ backgroundOpacity: opacity }),
            setUiFontSize: (size) => set({ uiFontSize: size }),
            setUiFontFamily: (family) => set({ uiFontFamily: family }),
            updateFormat: (key, value) => set((state) => ({
                format: { ...state.format, [key]: value }
            })),
            toggleFeature: (key) => set((state) => ({
                features: { ...state.features, [key]: !state.features[key] }
            })),
            setFeature: (key, value) => set((state) => ({
                features: { ...state.features, [key]: value }
            })),
            toggleExperimental: (key) => set((state) => ({
                experimental: { ...state.experimental, [key]: !state.experimental[key] }
            })),
            setScribbleSize: (type, size) => set((state) => ({
                [type === 'pen' ? 'scribblePenSize' : 'scribbleEraserSize']: size
            })),

            // App Reordering Action
            reorderApps: (newOrder) => set({ appOrder: newOrder }),

            resetSettings: () => set({
                theme: 'vs-dark',
                uiFontSize: 14,
                uiFontFamily: 'Inter',
                format: {
                    fontSize: 14,
                    tabSize: 4,
                    wordWrap: 'on',
                    fontFamily: "'Fira Code', Consolas, 'Courier New', monospace",
                    lineHeight: 1.5
                },
                features: {
                    minimap: true,
                    lineNumbers: 'on',
                    autoSave: false,
                    livePreview: true,
                    vimMode: false,
                    validation: false // Default to false to hide red lines
                },
                experimental: {
                    scribble: false,
                    customBackground: false,
                    customBackground: false,
                    vscodeApp: true
                },
                scribblePenSize: 3,
                scribbleEraserSize: 15,
                appOrder: []
            })
        }),
        {
            name: 'roolts-settings-storage'
        }
    )
);

// Notes Store - manages notes for the note editor
export const useNotesStore = create(
    persist(
        (set, get) => ({
            notes: [],
            folders: [
                { id: 'all', name: 'All Notes', icon: 'FiList', type: 'smart' },
                { id: 'today', name: 'Today', icon: 'FiClock', type: 'smart' },
                { id: 'tags', name: 'Tags', icon: 'FiTag', type: 'section' }
            ],
            activeNoteId: null,
            activeFolderId: 'all',
            isLoading: false,
            searchQuery: '',
            selectedProvider: null,

            // AI Extension State
            aiSidebarOpen: true,
            aiSidebarWidth: 600,
            aiExpanded: false,
            aiMessages: [],


            setNotes: (notes) => set({ notes }),
            setActiveNote: (noteId) => set({ activeNoteId: noteId }),
            setActiveFolder: (folderId) => set({ activeFolderId: folderId }),
            setLoading: (isLoading) => set({ isLoading }),
            setSearchQuery: (searchQuery) => set({ searchQuery }),
            setProvider: (provider) => set({ selectedProvider: provider }),

            // AI Actions
            setAiSidebarOpen: (isOpen) => set({ aiSidebarOpen: isOpen }),
            setAiSidebarWidth: (width) => set({ aiSidebarWidth: width }),
            setAiExpanded: (isExpanded) => set({ aiExpanded: isExpanded }),
            setAiMessages: (messages) => set({ aiMessages: messages }),
            addAiMessage: (msg) => set((state) => ({
                aiMessages: [...state.aiMessages, { ...msg, id: uuidv4(), timestamp: new Date().toISOString() }]
            })),
            clearAiMessages: () => set({ aiMessages: [] }),


            addFolder: (folder) => set((state) => ({
                folders: [...state.folders, { ...folder, id: uuidv4() }]
            })),

            deleteFolder: (folderId) => set((state) => ({
                folders: state.folders.filter(f => f.id !== folderId),
                activeFolderId: state.activeFolderId === folderId ? 'all' : state.activeFolderId
            })),

            addNote: (note) => set((state) => ({
                notes: [note, ...state.notes],
                activeNoteId: note.id
            })),

            updateNote: (noteId, updates) => set((state) => ({
                notes: state.notes.map((note) =>
                    note.id === noteId ? { ...note, ...updates, updatedAt: new Date().toISOString() } : note
                )
            })),

            deleteNote: (noteId) => set((state) => {
                const newNotes = state.notes.filter((note) => note.id !== noteId);
                return {
                    notes: newNotes,
                    activeNoteId: state.activeNoteId === noteId
                        ? (newNotes[0]?.id || null)
                        : state.activeNoteId
                };
            }),

            getActiveNote: () => {
                const state = get();
                return state.notes.find((note) => note.id === state.activeNoteId);
            },

            getFilteredNotes: () => {
                const state = get();
                if (!state.searchQuery) return state.notes;
                const query = state.searchQuery.toLowerCase();
                return state.notes.filter(
                    note => note.title.toLowerCase().includes(query) ||
                        note.content.toLowerCase().includes(query)
                );
            }
        }),
        {
            name: 'roolts-notes-storage',
            partialize: (state) => ({
                selectedProvider: state.selectedProvider,
                notes: state.notes,
                folders: state.folders,
                activeFolderId: state.activeFolderId,
                aiSidebarOpen: state.aiSidebarOpen,
                aiSidebarWidth: state.aiSidebarWidth,
                aiExpanded: state.aiExpanded,
                aiMessages: state.aiMessages
            })
        }
    )
);

// Execution Store - manages code execution state (persisted compilers)
export const useExecutionStore = create(
    persist(
        (set, get) => ({
            isExecuting: false,
            output: '',
            error: null,
            executionTime: null,
            history: [],
            compilers: {
                python: { available: null, version: null },
                java: { available: null, version: null },
                javascript: { available: null, version: null }
            },
            showOutput: false,
            input: '',
            inputRequestOpen: false,


            setExecuting: (isExecuting) => set({ isExecuting }),
            setOutput: (output) => set({ output, showOutput: true }),
            setError: (error) => set({ error }),
            setExecutionTime: (executionTime) => set({ executionTime }),
            setShowOutput: (showOutput) => set({ showOutput }),
            setInput: (input) => {
                const sanitizedInput = typeof input === 'string' ? input : '';
                set({ input: sanitizedInput });
            },
            setInputRequestOpen: (inputRequestOpen) => set({ inputRequestOpen }),


            setCompilerStatus: (language, status) => set((state) => ({
                compilers: {
                    ...state.compilers,
                    [language]: status
                }
            })),

            addToHistory: (entry) => set((state) => ({
                history: [
                    {
                        id: Date.now(),
                        timestamp: new Date().toISOString(),
                        ...entry
                    },
                    ...state.history
                ].slice(0, 20) // Keep last 20 entries
            })),

            clearOutput: () => set({ output: '', error: null, executionTime: null }),

            clearHistory: () => set({ history: [] }),

            reset: () => set({
                isExecuting: false,
                output: '',
                error: null,
                executionTime: null,
                showOutput: false
            })
        }),
        {
            name: 'roolts-execution-storage',
            partialize: (state) => ({
                compilers: state.compilers,
                history: state.history
            })
        }
    )
);

// Terminal Store - manages integrated terminal state (persisted history)
export const useTerminalStore = create(
    persist(
        (set, get) => ({
            lines: [{ type: 'system', content: 'PowerShell Terminal - Type commands below' }],
            commandHistory: [],
            historyIndex: -1,
            currentInput: '',
            cwd: '',
            isRunning: false,
            executionOutput: [],

            addLine: (line) => set((state) => ({
                lines: [...state.lines, line].slice(-500) // Keep last 500 lines
            })),

            addCommand: (command) => set((state) => ({
                commandHistory: [command, ...state.commandHistory].slice(0, 100)
            })),

            setHistoryIndex: (index) => set({ historyIndex: index }),
            setCurrentInput: (input) => set({ currentInput: input }),
            setCwd: (cwd) => set({ cwd }),
            setRunning: (isRunning) => set({ isRunning }),

            clearTerminal: () => set({
                lines: [{ type: 'system', content: 'Terminal cleared' }],
                historyIndex: -1
            }),

            clearExecutionOutput: () => set({ executionOutput: [] }),

            addExecutionLine: (line) => set((state) => ({
                executionOutput: [...state.executionOutput, line].slice(-500)
            })),

            getFromHistory: (direction) => {
                const state = get();
                const { commandHistory, historyIndex } = state;

                if (commandHistory.length === 0) return state.currentInput;

                let newIndex = historyIndex;
                if (direction === 'up') {
                    newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
                } else {
                    newIndex = Math.max(historyIndex - 1, -1);
                }

                set({ historyIndex: newIndex });
                return newIndex >= 0 ? commandHistory[newIndex] : '';
            }
        }),
        {
            name: 'roolts-terminal-storage',
            partialize: (state) => ({
                commandHistory: state.commandHistory.slice(0, 50),
                cwd: state.cwd
            })
        }
    )
);

// Snippet Store - manages user snippets
export const useSnippetStore = create((set) => ({
    snippets: [],
    isLoading: false,

    setSnippets: (snippets) => set({ snippets }),
    setLoading: (isLoading) => set({ isLoading }),

    addSnippet: (snippet) => set((state) => ({
        snippets: [snippet, ...state.snippets]
    })),

    removeSnippet: (id) => set((state) => ({
        snippets: state.snippets.filter(s => s.id !== id)
    }))
}));

// Extension Store - manages installed VS Code extensions (persisted)
export const useExtensionStore = create(
    persist(
        (set, get) => ({
            installedExtensions: [], // Array of extension objects {id, name, namespace, version, iconUrl, description}

            installExtension: (extension) => set((state) => {
                if (state.installedExtensions.find(e => e.id === extension.id)) return state;
                return { installedExtensions: [...state.installedExtensions, extension] };
            }),

            uninstallExtension: (id) => set((state) => ({
                installedExtensions: state.installedExtensions.filter(e => e.id !== id)
            })),

            isInstalled: (id) => {
                const state = get();
                return state.installedExtensions.some(e => e.id === id);
            }
        }),
        {
            name: 'roolts-extension-storage'
        }
    )
);

import { createWithEqualityFn as create } from 'zustand/traditional';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { indexedDBStorage } from '../services/storage';

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
                    modified: false,
                    highlights: [],
                    drawings: [],
                    stickers: [],
                    images: []
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
                    modified: false,
                    highlights: [],
                    drawings: [],
                    stickers: [],
                    images: []
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

            markFileSaved: (fileId) => set((state) => ({
                files: state.files.map((file) =>
                    file.id === fileId ? { ...file, modified: false } : file
                )
            })),

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
                            drawings: [],
                            stickers: [],
                            images: []
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

            // Sticker Actions
            addSticker: (fileId, sticker) => set((state) => ({
                files: state.files.map((file) =>
                    file.id === fileId
                        ? { ...file, stickers: [...(file.stickers || []), sticker], modified: true }
                        : file
                )
            })),

            // Image Actions
            addImage: (fileId, image) => set((state) => ({
                files: state.files.map((file) =>
                    file.id === fileId
                        ? { ...file, images: [...(file.images || []), image], modified: true }
                        : file
                )
            })),

            removeImage: (fileId, imageId) => set((state) => ({
                files: state.files.map((file) =>
                    file.id === fileId
                        ? { ...file, images: (file.images || []).filter(img => img.id !== imageId), modified: true }
                        : file
                )
            })),
            updateSticker: (fileId, stickerId, updates) => set((state) => ({
                files: state.files.map((file) => {
                    if (file.id === fileId) {
                        const newStickers = (file.stickers || []).map(s =>
                            s.id === stickerId ? { ...s, ...updates } : s
                        );
                        return { ...file, stickers: newStickers, modified: true };
                    }
                    return file;
                })
            })),

            removeSticker: (fileId, stickerId) => set((state) => ({
                files: state.files.map((file) =>
                    file.id === fileId
                        ? { ...file, stickers: (file.stickers || []).filter(s => s.id !== stickerId), modified: true }
                        : file
                )
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
            storage: indexedDBStorage,
            partialize: (state) => ({
                files: state.files,
                activeFileId: state.activeFileId,
                openFiles: state.openFiles
            })
        }
    )
);



// Learning Store - manages AI learning features (persisted)
export const useLearningStore = create(
    persist(
        (set) => ({
            explanation: null,
            diagram: null,
            resources: [],
            reviewResults: null,
            isGenerating: false,
            isReviewing: false,
            activeTab: 'explain',
            chatMessages: [],
            pendingQuery: null,

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
            setPendingQuery: (query) => set({ pendingQuery: query }),

            reset: () => set({
                explanation: null,
                diagram: null,
                resources: [],
                reviewResults: null,
                isGenerating: false,
                isReviewing: false,
                chatMessages: []
            })
        }),
        {
            name: 'roolts-learning-storage',
            storage: indexedDBStorage,
            partialize: (state) => ({
                chatMessages: state.chatMessages,
                explanation: state.explanation,
                diagram: state.diagram,
                resources: state.resources,
                activeTab: state.activeTab
            })
        }
    )
);

// CodeChamp Store - manages competitive coding assistant state (persisted)
export const useCodeChampStore = create(
    persist(
        (set) => ({
            analysis: null,
            testCases: [{ input: '', expected: '' }],
            detectedProblem: null,
            activeTab: 'complexity',
            hasAnalyzedOnce: false,
            lastContentHash: '',
            tone: 'standard',
            scraperUrl: '',
            scraperTarget: '',
            scraperResult: '',

            setAnalysis: (analysis) => set({ analysis }),
            setTestCases: (testCases) => set({ testCases }),
            setDetectedProblem: (detectedProblem) => set({ detectedProblem }),
            setActiveTab: (activeTab) => set({ activeTab }),
            setHasAnalyzedOnce: (val) => set({ hasAnalyzedOnce: val }),
            setLastContentHash: (hash) => set({ lastContentHash: hash }),
            setTone: (tone) => set({ tone }),
            setScraperUrl: (url) => set({ scraperUrl: url }),
            setScraperTarget: (target) => set({ scraperTarget: target }),
            setScraperResult: (result) => set({ scraperResult: result }),

            reset: () => set({
                analysis: null,
                testCases: [{ input: '', expected: '' }],
                detectedProblem: null,
                hasAnalyzedOnce: false,
                lastContentHash: '',
                tone: 'standard',
                scraperUrl: '',
                scraperTarget: '',
                scraperResult: ''
            })
        }),
        {
            name: 'roolts-codechamp-storage',
            storage: indexedDBStorage,
            partialize: (state) => ({
                analysis: state.analysis,
                testCases: state.testCases,
                detectedProblem: state.detectedProblem,
                activeTab: state.activeTab,
                hasAnalyzedOnce: state.hasAnalyzedOnce,
                lastContentHash: state.lastContentHash,
                tone: state.tone,
                scraperUrl: state.scraperUrl,
                scraperTarget: state.scraperTarget,
                scraperResult: state.scraperResult
            })
        }
    )
);

// UI Store - manages UI state
export const useUIStore = create(
    persist(
        (set) => ({
            sidebarOpen: true,
            rightPanelOpen: true,
            rightPanelTab: 'learn', // This is technically the active app
            get rightPanelApp() { return this.rightPanelTab; }, // Alias for ease of use
            editorMinimized: false,
            rightPanelExpanded: false,
            modals: {
                newFile: false,
                commitPush: false,
                share: false,
                settings: false,
                portfolioGenerator: false,
                deployment: false,
                auth: false
            },
            notifications: [],
            appPreviewUrl: null,
            rightPanelWidth: 800,
            lastOpenWidth: 800,
            isResizing: null,
            openApps: [], // Array of app IDs currently open in sidebar

            toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
            toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
            setIsResizing: (val) => set({ isResizing: val }),
            setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
            toggleRightPanelApp: (appId) => set((state) => ({
                rightPanelTab: appId,
                rightPanelOpen: state.rightPanelTab === appId ? !state.rightPanelOpen : true
            })),
            setRightPanelWidth: (width) => set({ rightPanelWidth: width }),
            toggleEditorMinimized: () => set((state) => ({ editorMinimized: !state.editorMinimized })),
            toggleRightPanelExpanded: () => set((state) => ({
                rightPanelExpanded: !state.rightPanelExpanded,
                editorMinimized: !state.rightPanelExpanded
            })),
            setAppPreviewUrl: (url) => set({ appPreviewUrl: url }),

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

            setLastOpenWidth: (width) => set({ lastOpenWidth: width }),

            openApp: (appId) => set((state) => {
                if (state.openApps.includes(appId)) return { rightPanelTab: appId, rightPanelOpen: true };
                return {
                    openApps: [...state.openApps, appId],
                    rightPanelTab: appId,
                    rightPanelOpen: true
                };
            }),

            closeApp: (appId) => set((state) => {
                const newOpenApps = state.openApps.filter(id => id !== appId);
                const nextTab = state.rightPanelTab === appId
                    ? (newOpenApps.length > 0 ? newOpenApps[newOpenApps.length - 1] : 'learn')
                    : state.rightPanelTab;

                return {
                    openApps: newOpenApps,
                    rightPanelTab: nextTab
                };
            })
        }),
        {
            name: 'roolts-ui-storage',
            partialize: (state) => ({
                sidebarOpen: state.sidebarOpen,
                rightPanelOpen: state.rightPanelOpen,
                rightPanelTab: state.rightPanelTab,
                rightPanelWidth: state.rightPanelWidth,
                lastOpenWidth: state.lastOpenWidth,
                openApps: state.openApps
            })
        }
    )
);

// Settings Store - manages user preferences (persisted)
export const useSettingsStore = create(
    persist(
        (set, get) => ({
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
                lineNumbers: 'on',
                autoSave: false,
                livePreview: true,
                vimMode: false,
                validation: false,
                scribble: false,
                customBackground: false,
                superSimpleMode: false,
                socratesMode: false,
                hideExtensions: false,
                currentLineHighlight: false
            },
            experimental: {
                leetcodeMode: false,
                snapshots: false,
                headerApps: false,
                collaborativeHub: false
            },
            typingSound: 'none', // none, mechanical, typewriter, click, pop
            scribblePenSize: 3,
            scribbleEraserSize: 15,
            appOrder: [], // Persisted order of app IDs

            setTheme: (theme) => set({ theme }),
            // Force reset if theme is Dracula (user requested to not use it)
            resetDracula: () => {
                if (get().theme && get().theme.includes('Dracula')) {
                    set({ theme: 'vs-dark' });
                }
            },
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
            setTypingSound: (sound) => set({ typingSound: sound }),

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
                    validation: false, // Default to false to hide red lines
                    scribble: false,
                    customBackground: false,
                    superSimpleMode: false,
                    socratesMode: false,
                    hideExtensions: false,
                    currentLineHighlight: false
                },
                experimental: {
                    leetcodeMode: false,
                    snapshots: false,
                    headerApps: false,
                    collaborativeHub: false
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
            isSplitMode: false,
            input: '',
            inputRequestOpen: false,
            isInteractive: false,
            activeGui: null,
            // GUI execution state (used by EditorTabs + OutputPanel)
            isGUIExecuting: false,



            setExecuting: (isExecuting) => set({ isExecuting }),
            setSplitMode: (isSplitMode) => set({ isSplitMode }),
            setOutput: (output) => set({ output, showOutput: true }),
            appendOutput: (chunk) => set((state) => ({
                output: state.output + chunk,
                showOutput: true
            })),
            setError: (error) => set({ error }),
            setExecutionTime: (executionTime) => set({ executionTime }),
            setShowOutput: (showOutput) => set({ showOutput }),
            setInput: (input) => {
                const sanitizedInput = typeof input === 'string' ? input : '';
                set({ input: sanitizedInput });
            },
            setInputRequestOpen: (inputRequestOpen) => set({ inputRequestOpen }),
            setIsInteractive: (isInteractive) => set({ isInteractive }),
            setActiveGui: (activeGui) => set({ activeGui }),
            setIsGUIExecuting: (isGUIExecuting) => set({ isGUIExecuting }),



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

            clearOutput: () => set({ output: '', error: null, executionTime: null, activeGui: null }),


            clearHistory: () => set({ history: [] }),

            reset: () => set({
                isExecuting: false,
                output: '',
                error: null,
                executionTime: null,
                showOutput: false,
                isInteractive: false,
                activeGui: null
            })

        }),
        {
            name: 'roolts-execution-storage',
            partialize: (state) => ({
                compilers: state.compilers,
                history: state.history,
                isSplitMode: state.isSplitMode
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

            addExecutionLine: (line) => set((state) => {
                let processedLine = { ...line };
                if (line.type === 'stdout' && typeof line.content === 'string') {
                    // Optimized ANSI parser
                    const parts = [];
                    const regex = /\x1b\[([0-9;]*)m/g;
                    let lastIndex = 0;
                    let currentColor = '#cccccc';
                    let match;

                    while ((match = regex.exec(line.content)) !== null) {
                        if (match.index > lastIndex) {
                            parts.push({ text: line.content.slice(lastIndex, match.index), color: currentColor });
                        }
                        const codes = match[1].split(';').map(Number);
                        for (const code of codes) {
                            switch (code) {
                                case 0: currentColor = '#cccccc'; break;
                                case 30: currentColor = '#0c0c0c'; break;
                                case 31: currentColor = '#ff6b6b'; break;
                                case 32: currentColor = '#51cf66'; break;
                                case 33: currentColor = '#ffd43b'; break;
                                case 34: currentColor = '#4dabf7'; break;
                                case 35: currentColor = '#cc5de8'; break;
                                case 36: currentColor = '#3bc9db'; break;
                                case 37: currentColor = '#f1f3f5'; break;
                                case 90: currentColor = '#868e96'; break;
                                case 91: currentColor = '#ff8787'; break;
                                case 92: currentColor = '#69db7c'; break;
                                case 93: currentColor = '#ffe066'; break;
                                case 94: currentColor = '#74c0fc'; break;
                                case 95: currentColor = '#e599f7'; break;
                                case 96: currentColor = '#66d9e8'; break;
                                case 97: currentColor = '#ffffff'; break;
                            }
                        }
                        lastIndex = regex.lastIndex;
                    }

                    if (lastIndex < line.content.length) {
                        parts.push({ text: line.content.slice(lastIndex), color: currentColor });
                    }
                    processedLine.parts = parts.length > 0 ? parts : [{ text: line.content, color: '#cccccc' }];
                }

                return {
                    executionOutput: [...state.executionOutput, processedLine].slice(-500)
                };
            }),

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

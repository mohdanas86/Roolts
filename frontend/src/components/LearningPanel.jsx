import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
    FiSettings, FiX, FiPaperclip, FiSend, FiZap, FiCopy, FiCheck, FiRotateCcw, FiPlay, FiGrid, FiChevronDown, FiChevronUp, FiSave, FiTrash2, FiSquare,
    FiMessageSquare, FiBookOpen, FiExternalLink, FiClock, FiBox, FiActivity, FiTrendingUp, FiMonitor, FiEye
} from 'react-icons/fi';
import { getGuiData } from './GUIPreviewPanel';


import { useFileStore, useUIStore, useExecutionStore, useSettingsStore, useLearningStore, useTerminalStore } from '../store';
import { aiService } from '../services/api';
import { authService } from '../services/authService';
import api from '../services/api'; // Direct access to axios instance
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import executorService from '../services/executorService';

// Cloud-First AI Glow Animation
const cloudGlow = `
  @keyframes cloud-glow {
    0% { filter: drop-shadow(0 0 10px rgba(var(--accent-primary-rgb), 0.1)); opacity: 0.95; }
    50% { filter: drop-shadow(0 0 20px rgba(var(--accent-primary-rgb), 0.25)); opacity: 1; }
    100% { filter: drop-shadow(0 0 10px rgba(var(--accent-primary-rgb), 0.1)); opacity: 0.95; }
  }
`;
const CopyButton = ({ content }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    };
    return (
        <button className={`assistant-copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy code">
            {copied ? <FiCheck size={12} /> : <FiCopy size={12} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
    );
};

// Redundant RunButton replaced by inline action in Markdown components


// Radical Simplicity Section Header
const MarkdownSectionHeader = ({ children }) => {
    return (
        <div className="section-radical-simplicity">
            <span className="section-title-radical">{children}</span>
        </div>
    );
};

// GUI components moved to separate file

const handleGlobalCopy = async (content) => {
    try {
        await navigator.clipboard.writeText(content);
        return true;
    } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        return false;
    }
};

function LearningPanel({ onBack }) {
    // Inject into local scope too for maximum visibility across different renderers
    const copyToClipboard = handleGlobalCopy;
    const {
        chatMessages: chatHistory,
        addChatMessage,
        clearChat,
        explanation,
        setExplanation,
        diagram,
        setDiagram,
        resources,
        setResources,
        isGenerating: isLoadingFeature,
        setGenerating: setIsLoadingFeature,
        activeTab: learningTab,
        setActiveTab: setLearningTab
    } = useLearningStore();

    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [provider, setProvider] = useState(() => localStorage.getItem('roolts_ai_provider') || 'roolts');
    const [apiKey, setApiKey] = useState(() => {
        const storedProvider = localStorage.getItem('roolts_ai_provider') || 'roolts';
        return localStorage.getItem(`roolts_ai_key_${storedProvider}`) || localStorage.getItem('roolts_ai_key') || '';
    });
    const [aiStatus, setAiStatus] = useState({ configured: null, models: [] });
    const [translateLang, setTranslateLang] = useState('python');
    const [expandedCategory, setExpandedCategory] = useState(null);
    const [showAllTools, setShowAllTools] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const features = useSettingsStore(state => state.features);
    const toggleFeature = useSettingsStore(state => state.toggleFeature);

    const activeFileId = useFileStore(state => state.activeFileId);
    const activeFile = useFileStore(
        state => state.files.find(f => f.id === state.activeFileId),
        (a, b) => a?.id === b?.id && a?.content === b?.content && a?.language === b?.language
    );

    const addNotification = useUIStore(state => state.addNotification);
    const toggleRightPanel = useUIStore(state => state.toggleRightPanel);
    const setRightPanelTab = useUIStore(state => state.setRightPanelTab);
    const activeSidebarTab = useUIStore(state => state.activeSidebarTab);
    const openFiles = useFileStore(state => state.files);

    const legacyOutput = useExecutionStore(state => state.output);
    const executionOutput = useTerminalStore(state => state.executionOutput);
    const [lastErrorProcessed, setLastErrorProcessed] = useState(null);
    const pendingQuery = useLearningStore(state => state.pendingQuery);
    const setPendingQuery = useLearningStore(state => state.setPendingQuery);
    const chatEndRef = useRef(null);
    const abortControllerRef = useRef(null);
    const fileInputRef = useRef(null);
    const [attachments, setAttachments] = useState([]);
    const { setActiveGui, setShowOutput: setShowGlobalOutput } = useExecutionStore();


    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
            addNotification({ type: 'info', message: 'AI request cancelled' });
        }
    };

    // Load Chat History from backend on mount if store is empty
    useEffect(() => {
        const fetchHistory = async () => {
            if (authService.isAuthenticated() && chatHistory.length === 0) {
                try {
                    const res = await aiService.getChatHistory();
                    if (res.data && res.data.length > 0) {
                        res.data.forEach(msg => addChatMessage(msg));
                    }
                } catch (error) {
                    console.error("Could not fetch chat history", error);
                }
            }
        };
        fetchHistory();
    }, []);

    // Check AI status on mount
    useEffect(() => {
        aiService.status()
            .then(res => setAiStatus({ configured: res.data.configured, models: res.data.available_models || [] }))
            .catch(() => setAiStatus({ configured: false, models: [] }));
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, isLoading]);

    // Sync translateLang with activeFile
    useEffect(() => {
        if (activeFile?.language && activeFile.language !== 'plaintext') {
            setTranslateLang(activeFile.language);
        }
    }, [activeFileId, activeFile?.language]);

    useEffect(() => {
        localStorage.setItem('roolts_ai_provider', provider);
        if (provider !== 'roolts') {
            localStorage.setItem(`roolts_ai_key_${provider}`, apiKey);
        }
        localStorage.setItem('roolts_ai_key', apiKey);
    }, [provider, apiKey]);

    // Auto-trigger explanation on terminal errors
    useEffect(() => {
        if (!executionOutput || executionOutput.length === 0) return;

        const lastLine = executionOutput[executionOutput.length - 1];

        // Check if this is a new error we haven't processed yet
        if (lastLine.type === 'error' && lastLine.content !== lastErrorProcessed) {
            setLastErrorProcessed(lastLine.content);

            // Use the current active file for context
            const language = activeFile?.language || 'python';
            const code = activeFile?.content || '';

            // Construct terminal context (last few lines if possible, but at least the error)
            const errorContext = executionOutput
                .slice(-5)
                .map(l => l.content)
                .join('\n');

            handleFeature('Explain Error', async () => {
                const response = await aiService.explainCode(code, language, errorContext);
                return response;
            });
        }
    }, [executionOutput]);

    // Handle pending queries from other components (like Context Menu)
    useEffect(() => {
        if (pendingQuery) {
            handleChat(null, pendingQuery);
            setPendingQuery(null);
        }
    }, [pendingQuery]);

    const handleChat = async (e, forcedQuery = null) => {
        if (e) e.preventDefault();
        const finalQuery = forcedQuery || query;
        if (!finalQuery.trim() && attachments.length === 0) return;

        // Provide defaults if no active file
        const fileContent = activeFile?.content || '';
        const fileLanguage = activeFile?.language || 'plaintext';

        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const userMsg = {
            role: 'user',
            content: finalQuery + (attachments.length > 0 ? `\n\n*(Attached ${attachments.length} file${attachments.length > 1 ? 's' : ''})*` : ''),
            timestamp: timestamp
        };
        addChatMessage(userMsg);
        if (!forcedQuery) {
            setQuery('');
        }
        setIsLoading(true);

        // Save to backend asynchronously
        if (authService.isAuthenticated()) {
            aiService.saveChatMessage('user', finalQuery).catch(e => console.error("Failed saving message:", e));
        }

        // Abort previous request if any
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        let contextQuery = finalQuery;

        if (attachments.length > 0) {
            contextQuery += `\n\n[USER PROVIDED ATTACHMENTS]:\nThe user has uploaded the following files for you to read. Please base your answer on these files if applicable.\n`;
            attachments.forEach(att => {
                const MAX_CHARS = 12000;
                let contentText = att.content;
                if (contentText.length > MAX_CHARS) {
                    contentText = contentText.substring(0, MAX_CHARS) + `\n\n...[TRUNCATED: ${att.name} was too large so the rest was omitted for the AI context]...`;
                }
                contextQuery += `\n--- File: ${att.name} ---\n${contentText}\n--- End File ---`;
            });
        }

        if (features.socratesMode) {
            contextQuery = `[SYSTEM: SOCRATES MODE ENABLED. You are Socrates. Do NOT give the user the answer or code directly. Instead, ask a guiding question to help them discover the answer themselves. Be helpful but Socratic.]\n\nUser Query: ${contextQuery}`;
        }

        // Save current attachments temporarily in case of failure, then clear
        const currentAttachments = [...attachments];
        if (!forcedQuery) {
            setAttachments([]);
        }

        try {
            const response = await aiService.chat(
                fileContent,
                fileLanguage,
                contextQuery,
                chatHistory,
                provider !== 'roolts' ? apiKey : null,
                provider !== 'roolts' ? provider : null,
                [],
                abortControllerRef.current.signal,
                legacyOutput
            );

            const aiContent = response.data.response || "No response generated.";
            const aiReasoning = response.data.reasoning;

            addChatMessage({
                role: 'assistant',
                content: aiContent,
                reasoning: aiReasoning,
                image: response.data.image || null,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });

            // Save output to backend
            if (authService.isAuthenticated()) {
                aiService.saveChatMessage('assistant', aiContent, aiReasoning).catch(e => console.error("Failed saving message:", e));
            }
        } catch (error) {
            if (error.name === 'AbortError' || axios?.isCancel?.(error)) {
                // Ignore cancellation
                console.log('AI request cancelled by user');
                return;
            }
            const errMsg = error.response?.data?.response || error.message || 'AI chat failed — check your connection.';
            if (!forcedQuery) setAttachments(currentAttachments); // Restore on error
            addChatMessage({
                role: 'assistant',
                content: `> ⚠️ **Error:** ${errMsg}`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        } finally {
            abortControllerRef.current = null;
            setIsLoading(false);
        }
    };

    const handleReadScreen = async () => {
        setIsLoading(true);
        addNotification({ type: 'info', message: 'AI is reading your workspace context...' });

        // Gather context
        const activeFileContext = activeFile ? `Active File: ${activeFile.name}\nLanguage: ${activeFile.language}\nContent:\n${activeFile.content.substring(0, 5000)}` : 'No file currently active.';

        const openTabsContext = openFiles.length > 0
            ? `Open Tabs: ${openFiles.map(f => f.name).join(', ')}`
            : 'No other tabs open.';

        const terminalContext = executionOutput && executionOutput.length > 0
            ? `Recent Terminal Output:\n${executionOutput.slice(-15).map(l => `[${l.type}] ${l.content}`).join('\n')}`
            : 'Terminal is empty.';

        const screenContext = `[SYSTEM: SCREEN READ TRIGGERED]\nThe user has asked you to "Read the Screen". Here is the current workspace state:\n\n${activeFileContext}\n\n${openTabsContext}\n\n${terminalContext}\n\nBased on this, tell the user what they are working on, identify any obvious issues in their code or terminal errors, and suggest the next logical step. Be concise and proactive.`;

        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Add a specialized user message
        addChatMessage({
            role: 'user',
            content: `🔍 **Read my screen** (Analyzing workspace context...)`,
            timestamp: timestamp
        });

        if (authService.isAuthenticated()) {
            aiService.saveChatMessage('user', "Read my screen").catch(e => console.error("Failed saving message:", e));
        }

        try {
            const response = await aiService.chat(
                activeFile?.content || '',
                activeFile?.language || 'plaintext',
                screenContext,
                chatHistory,
                provider !== 'roolts' ? apiKey : null,
                provider !== 'roolts' ? provider : null
            );

            const aiContent = response.data.response || "I've analyzed your screen. How can I help further?";
            const aiReasoning = response.data.reasoning;

            addChatMessage({
                role: 'assistant',
                content: aiContent,
                reasoning: aiReasoning,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });

            if (authService.isAuthenticated()) {
                aiService.saveChatMessage('assistant', aiContent, aiReasoning).catch(e => console.error("Failed saving message:", e));
            }
        } catch (error) {
            addChatMessage({
                role: 'assistant',
                content: `> ⚠️ **Screen Read Failed:** ${error.response?.data?.error || error.message}`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileAttach = async (e) => {
        const files = Array.from(e.target.files);
        const newAttachments = [];
        for (const file of files) {
            const content = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsText(file);
            });
            newAttachments.push({
                name: file.name,
                content: content,
                type: file.type || 'text/plain'
            });
        }
        setAttachments(prev => [...prev, ...newAttachments]);
        e.target.value = null; // Reset input
    };

    const exportChatToMarkdown = () => {
        if (chatHistory.length === 0) return;

        let markdown = `# AI Chat Export - ${new Date().toLocaleDateString()}\n\n`;
        chatHistory.forEach(msg => {
            const role = msg.role === 'user' ? '👤 User' : '🤖 AI';
            markdown += `### ${role} (${msg.timestamp})\n${msg.content}\n\n`;
            if (msg.reasoning) {
                markdown += `> **Thinking Process:**\n> ${msg.reasoning.split('\n').join('\n> ')}\n\n`;
            }
            markdown += `---\n\n`;
        });

        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `roolts-chat-${new Date().toISOString().split('T')[0]}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        addNotification({ type: 'success', message: 'Chat exported as Markdown' });
    };

    const clearHistory = async () => {
        if (window.confirm('Are you sure you want to delete all chat history? This cannot be undone.')) {
            clearChat();
            if (authService.isAuthenticated()) {
                try {
                    await aiService.clearChatHistory();
                } catch (e) {
                    console.error("Could not clear on backend", e);
                }
            } else {
                localStorage.removeItem('roolts_ai_chat_history');
            }
            addNotification({ type: 'info', message: 'Chat history cleared' });
        }
    };

    // Feature action handler — calls specialized AI endpoints
    const handleFeature = async (featureName, apiCall) => {
        if (!activeFile || !activeFile.content) {
            addNotification({ type: 'warning', message: 'Open a file first' });
            return;
        }
        setIsLoadingFeature(featureName);
        setIsLoading(true);

        // Abort previous request if any
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        // Add a "user" bubble showing what feature was triggered
        addChatMessage({
            role: 'user',
            content: `🔧 **${featureName}** on \`${activeFile.name || 'current file'}\``,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        try {
            const response = await apiCall(activeFile.content, activeFile.language || 'plaintext', legacyOutput, abortControllerRef.current.signal);
            const data = response.data;
            const aiContent = data.response || data.explanation || data.error || 'No response.';
            const aiReasoning = data.reasoning;

            // For resources, attach them to the chat message for inline rendering
            const inlineResources = (featureName === 'Suggest Resources' && data.resources) ? data.resources : null;

            // Always add to chat history for context
            addChatMessage({
                role: 'assistant',
                content: aiContent,
                reasoning: aiReasoning,
                resources: inlineResources,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });

            if (authService.isAuthenticated()) {
                aiService.saveChatMessage('assistant', aiContent, aiReasoning).catch(e => console.error("Failed saving message:", e));
            }
        } catch (error) {
            if (error.name === 'AbortError' || axios?.isCancel?.(error)) {
                // Ignore cancellation
                console.log(`${featureName} cancelled by user`);
                return;
            }
            addChatMessage({
                role: 'assistant',
                content: `> ⚠️ **${featureName} failed:** ${error.response?.data?.error || error.message}`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        } finally {
            abortControllerRef.current = null;
            setIsLoadingFeature(null);
            setIsLoading(false);
        }
    };

    // ── Feature Categories with all 8 groups ──
    const featureCategories = [
        {
            id: 'refactor', title: '🔄 Refactoring', features: [
                { icon: '🔄', label: 'Refactor', desc: 'Clean & optimize code', action: () => handleFeature('Refactor', aiService.refactor) },
                { icon: '🧩', label: 'Extract', desc: 'Extract functions/classes', action: () => handleFeature('Extract Functions', aiService.extractFunctions) },
                { icon: '✏️', label: 'Rename', desc: 'Smart rename variables', action: () => handleFeature('Rename Variables', aiService.renameVariables) },
                { icon: '🌐', label: 'Translate', desc: `Convert to ${translateLang}`, action: () => handleFeature('Translate Code', (code, lang) => aiService.translate(code, lang, translateLang)) },
            ]
        },
        {
            id: 'analysis', title: '📊 Analysis', features: [
                { icon: '⚡', label: 'Performance', desc: 'Profile & optimize speed', action: () => handleFeature('Performance Analysis', aiService.analyzePerformance) },
                { icon: '💀', label: 'Dead Code', desc: 'Find unused code', action: () => handleFeature('Dead Code Detection', aiService.detectDeadCode) },
                { icon: '🔬', label: 'Complexity', desc: 'Cyclomatic complexity', action: () => handleFeature('Complexity Analysis', aiService.analyzeComplexity) },
                { icon: '🔗', label: 'Dependencies', desc: 'Call graph & coupling', action: () => handleFeature('Dependency Analysis', aiService.analyzeDependencies) },
            ]
        },
        {
            id: 'testing', title: '🧪 Testing', features: [
                { icon: '🧪', label: 'Unit Tests', desc: 'Generate unit tests', action: () => handleFeature('Generate Tests', aiService.generateTests) },
                { icon: '🎯', label: 'Edge Cases', desc: 'Boundary & error tests', action: () => handleFeature('Edge Case Tests', aiService.generateEdgeTests) },
            ]
        },
        {
            id: 'docs', title: '📝 Documentation', features: [
                { icon: '📝', label: 'Docstrings', desc: 'Add documentation', action: () => handleFeature('Generate Docs', aiService.generateDocs) },
                { icon: '📄', label: 'README', desc: 'Generate README.md', action: () => handleFeature('Generate README', aiService.generateReadme) },
                { icon: '📚', label: 'API Docs', desc: 'Full API reference', action: () => handleFeature('API Documentation', aiService.generateApiDocs) },
                { icon: '💬', label: 'Comments', desc: 'Add inline comments', action: () => handleFeature('Inline Comments', aiService.addInlineComments) },
                { icon: '🌐', label: 'Resources', desc: 'Suggested learning links', action: () => handleFeature('Suggest Resources', aiService.suggestResources) },
            ]
        },
        {
            id: 'debug', title: '🐛 Debugging', features: [
                { icon: '🐛', label: 'Fix Bugs', desc: 'Find & fix bugs', action: () => handleFeature('Fix Code', aiService.fixCode) },
                { icon: '📋', label: 'Stack Trace', desc: 'Analyze error traces', action: () => handleFeature('Stack Trace Analysis', (code, lang) => aiService.analyzeStackTrace(code, lang, '')) },
                { icon: '🔮', label: 'Predict Bugs', desc: 'Find bugs before they hit', action: () => handleFeature('Bug Prediction', aiService.predictBugs) },
                { icon: '🔍', label: 'Review', desc: 'Security & style review', action: () => handleFeature('Code Review', aiService.review) },
                {
                    icon: '🏥', label: 'Health', desc: 'Scan compiler environment',
                    action: () => handleFeature('Scan Compiler', async () => {
                        const response = await aiService.scanCompiler();
                        const aiContent = response.data.response || response.data.content || '';
                        addChatMessage({
                            role: 'assistant',
                            content: aiContent,
                            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        });
                        setLearningTab('assistant');
                        return response;
                    })
                },
            ]
        },
        {
            id: 'patterns', title: '🏗️ Patterns', features: [
                { icon: '🏛️', label: 'Design Patterns', desc: 'Suggest patterns', action: () => handleFeature('Design Patterns', aiService.suggestDesignPatterns) },
                { icon: '🚀', label: 'Migration', desc: 'Framework upgrades', action: () => handleFeature('Migration Helper', aiService.generateMigration) },
            ]
        },
    ];

    // Top-level quick-access buttons (most used)
    const topFeatures = [
        { icon: '🔄', label: 'Refactor', action: () => handleFeature('Refactor', aiService.refactor) },
        { icon: '🧪', label: 'Tests', action: () => handleFeature('Generate Tests', aiService.generateTests) },
        { icon: '📝', label: 'Docs', action: () => handleFeature('Generate Docs', aiService.generateDocs) },
        { icon: '🌐', label: 'Resources', action: () => handleFeature('Suggest Resources', aiService.suggestResources) },
        { icon: '🐛', label: 'Fix', action: () => handleFeature('Fix Code', aiService.fixCode) },
        { icon: '🔍', label: 'Read Screen', action: handleReadScreen, primary: true },
    ];

    const quickActions = [
        { label: '💡 Explain', query: 'Explain this code step by step. What does each function do?' },
        { label: '⚡ Optimize', query: 'Suggest performance optimizations and best practices for this code.' },
        { label: '🔒 Security', query: 'Analyze this code for security vulnerabilities and suggest hardening measures.' },
        { label: '🧠 Patterns', query: 'What design patterns are used here? Suggest improvements.' },
        { label: '🔍 Search', query: searchQuery ? `Find all code related to: ${searchQuery}` : 'Find all database queries in this code' },
    ];

    return (
        <div className="assistant-panel">
            {/* Native Header */}
            <header className="assistant-header">
                <div className="assistant-header-left">
                    <FiZap className="assistant-icon" />
                    <span className="assistant-title">AI Assistant</span>
                    {aiStatus.configured !== null && (
                        <span className={`assistant-status ${aiStatus.configured ? 'online' : 'offline'}`}>
                            {aiStatus.configured ? '● Online' : '● Offline'}
                        </span>
                    )}
                </div>
                <div className="assistant-header-right">
                    {chatHistory.length > 0 && (
                        <>
                            <button className="assistant-action-btn" onClick={exportChatToMarkdown} title="Save chat as Markdown">
                                <FiSave size={14} />
                            </button>
                            <button className="assistant-action-btn" onClick={clearHistory} title="Clear chat history">
                                <FiTrash2 size={14} />
                            </button>
                        </>
                    )}
                    <button className="assistant-action-btn" onClick={() => setRightPanelTab('apps')} title="Open Apps">
                        <FiGrid size={14} />
                    </button>
                    <button className="assistant-action-btn" onClick={() => setShowSettings(!showSettings)} title="Settings">
                        <FiSettings size={14} />
                    </button>
                    <button className="assistant-close-btn" onClick={toggleRightPanel} title="Close Assistant">
                        <FiX size={14} />
                    </button>
                </div>
            </header>

            {/* Settings Overlay */}
            {showSettings && (
                <div className="assistant-popover">
                    <div className="assistant-popover-content">
                        <div className="form-check" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
                            <input
                                type="checkbox"
                                checked={features.socratesMode}
                                onChange={() => toggleFeature('socratesMode')}
                                style={{ marginRight: '8px' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <label style={{ cursor: 'pointer', fontWeight: 600 }}>Socrates Mode</label>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>AI will ask questions instead of giving answers.</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label>Provider</label>
                            {aiStatus.configured !== null && (
                                <span style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <div style={{
                                        width: '6px',
                                        height: '6px',
                                        borderRadius: '50%',
                                        backgroundColor: (provider === 'roolts' ? aiStatus.configured : aiStatus.models.includes(provider)) ? 'var(--success-color)' : 'var(--text-secondary)'
                                    }} />
                                    {(provider === 'roolts' ? aiStatus.configured : aiStatus.models.includes(provider)) ? 'Connected' : 'Not Connected'}
                                </span>
                            )}
                        </div>
                        <select
                            value={provider}
                            onChange={(e) => {
                                const newProvider = e.target.value;
                                setProvider(newProvider);
                                setApiKey(localStorage.getItem(`roolts_ai_key_${newProvider}`) || '');
                            }}
                        >
                            <option value="roolts">Roolts (Auto)</option>
                            <option value="openai">OpenAI</option>
                            <option value="gemini">Gemini</option>
                            <option value="deepseek">DeepSeek</option>
                            <option value="huggingface">Hugging Face</option>
                        </select>
                        {provider !== 'roolts' && (
                            <>
                                <label>API Key</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="Enter key..."
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        className="btn btn--secondary"
                                        style={{ padding: '4px 8px', fontSize: '11px' }}
                                        onClick={async () => {
                                            try {
                                                addNotification({ type: 'info', message: `Testing ${provider} connection...` });
                                                // Fetch status to refresh available_models based on the NEW key in localStorage
                                                const res = await aiService.status();
                                                if (res.data.available_models.includes(provider)) {
                                                    setAiStatus({ configured: res.data.configured, models: res.data.available_models });
                                                    addNotification({ type: 'success', message: `${provider.toUpperCase()} connection verified!` });
                                                } else {
                                                    addNotification({ type: 'error', message: `${provider.toUpperCase()} verification failed. Check your key.` });
                                                }
                                            } catch (err) {
                                                addNotification({ type: 'error', message: "Connection test failed." });
                                            }
                                        }}
                                    >
                                        Test
                                    </button>
                                </div>
                            </>
                        )}
                        <button
                            className="btn btn--primary"
                            style={{ width: '100%', marginTop: '12px' }}
                            onClick={async () => {
                                setShowSettings(false);
                                if (provider !== 'roolts' && apiKey) {
                                    try {
                                        // Map provider to the expected backend key name
                                        const keyNameMap = {
                                            'gemini': 'gemini_api_key',
                                            'claude': 'claude_api_key',
                                            'deepseek': 'deepseek_api_key',
                                            'openai': 'openai_api_key',
                                            'qwen': 'qwen_api_key',
                                            'huggingface': 'hf_token'
                                        };
                                        const payload = { [keyNameMap[provider] || provider]: apiKey };
                                        await api.put('/auth/api-keys', payload);
                                        addNotification({ type: 'success', message: `${provider.toUpperCase()} key saved to profile` });
                                    } catch (err) {
                                        console.error('Failed to save API key to profile:', err);
                                    }
                                }
                            }}
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}

            {/* GUI Preview Side Panel Removed (Integrated into Output) */}


            {/* Chat View — Always Visible (no tabs) */}
            <div className="assistant-view-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
                <div className="assistant-chat-history">
                    {chatHistory.map((msg, idx) => (
                        <div key={idx} className={`assistant-bubble-container ${msg.role === 'user' ? 'user' : 'ai'}`}>
                            <div className={`assistant-bubble ${msg.role}`}>
                                {msg.reasoning && (
                                    <details className="assistant-reasoning">
                                        <summary>Thinking Process</summary>
                                        <div className="reasoning-content" style={{ whiteSpace: 'pre-wrap' }}>
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.reasoning}</ReactMarkdown>
                                        </div>
                                    </details>
                                )}
                                {/* --- Non-destructive complexity extraction ---
                                    Parse complexity values from the AI's text using
                                    read-only regex. We NEVER touch msg.content. */}
                                {(() => {
                                    const text = msg.content;
                                    // Match both bold and italic formats (e.g. *Time complexity is O(n)*)
                                    const timeMatch =
                                        text.match(/\*\*Time Complexity\*\*\s*:?\s*([O0o]\([^)]+\))/i) ||
                                        text.match(/Time Complexity\s*:?\s*\*?([O0o]\([^)]+\))\*?/i) ||
                                        text.match(/Time Efficiency\s*:?\s*\*?([O0o]\([^)]+\))\*?/i);

                                    const spaceMatch =
                                        text.match(/\*\*Space Complexity\*\*\s*:?\s*([O0o]\([^)]+\))/i) ||
                                        text.match(/Space Complexity\s*:?\s*\*?([O0o]\([^)]+\))\*?/i) ||
                                        text.match(/Memory Footprint\s*:?\s*\*?([O0o]\([^)]+\))\*?/i);

                                    if (!timeMatch && !spaceMatch) return null;

                                    const timeC = timeMatch ? timeMatch[1] : 'N/A';
                                    const spaceC = spaceMatch ? spaceMatch[1] : 'N/A';

                                    return (
                                        <div className="assistant-complexity-badges-subtle">
                                            {timeMatch && (
                                                <div className="complexity-badge-quiet">
                                                    <FiClock className="complexity-icon-quiet" size={12} />
                                                    <span className="complexity-value-quiet">{timeC}</span>
                                                </div>
                                            )}
                                            {spaceMatch && (
                                                <div className="complexity-badge-quiet">
                                                    <FiBox className="complexity-icon-quiet" size={12} />
                                                    <span className="complexity-value-quiet">{spaceC}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        code({ node, className, children, ...props }) {
                                            const match = /language-(\w+)/.exec(className || '');
                                            const codeStr = String(children).replace(/\n$/, '');
                                            const isInline = !match;
                                            const language = match ? match[1] : 'text';

                                            return isInline ? (
                                                <code className="assistant-inline-code" {...props}>{children}</code>
                                            ) : (
                                                <div className="assistant-code-block">
                                                    <div className="assistant-code-header">
                                                        <span className="assistant-code-lang">{language || 'code'}</span>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <button
                                                                className="assistant-code-action-btn"
                                                                title="Run Code"
                                                                onClick={() => {
                                                                    // 1. Set GUI data if applicable
                                                                    const guiData = getGuiData(codeStr, language);
                                                                    if (guiData) {
                                                                        setActiveGui(guiData);
                                                                    }
                                                                    // 2. Open Output Screen
                                                                    setShowGlobalOutput(true);
                                                                    // 3. Execution logic (for terminal output)
                                                                    executorService.runProgram(codeStr, language);
                                                                }}
                                                            >
                                                                <FiPlay size={14} style={{ color: 'var(--accent-primary)' }} />
                                                                <span>Run</span>
                                                            </button>
                                                            <CopyButton content={codeStr} />
                                                        </div>
                                                    </div>
                                                    <div className="assistant-code">
                                                        <SyntaxHighlighter
                                                            style={vscDarkPlus}
                                                            language={language || 'plaintext'}
                                                            PreTag="div"
                                                            customStyle={{ margin: 0, padding: '32px', background: 'transparent', fontSize: '15.5px' }}
                                                        >
                                                            {codeStr}
                                                        </SyntaxHighlighter>
                                                    </div>
                                                </div>

                                            );
                                        },
                                        h3({ node, children, ...props }) {
                                            return <MarkdownSectionHeader {...props}>{children}</MarkdownSectionHeader>;
                                        },
                                        h4({ node, children, ...props }) {
                                            return <MarkdownSectionHeader {...props}>{children}</MarkdownSectionHeader>;
                                        },
                                        table({ children, ...props }) {
                                            return (
                                                <div className="assistant-table-wrapper">
                                                    <table {...props}>
                                                        {children}
                                                    </table>
                                                </div>
                                            );
                                        }
                                    }}
                                >
                                    {msg.content}
                                </ReactMarkdown>
                                {msg.image && (
                                    <div className="assistant-inline-image-container" style={{
                                        marginTop: '24px',
                                        borderRadius: '16px',
                                        overflow: 'hidden',
                                        border: '1.5px solid var(--border-primary)',
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                                        background: '#fff',
                                    }}>
                                        <div style={{
                                            padding: '12px 18px',
                                            background: '#f8f9fa',
                                            borderBottom: '1px solid var(--border-primary)',
                                            fontSize: '13px',
                                            color: '#444',
                                            fontWeight: 700,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                        }}>
                                            <FiGrid size={14} color="var(--accent-primary)" /> Visualization
                                        </div>
                                        <img
                                            src={msg.image}
                                            alt="AI Generated Visual"
                                            style={{
                                                width: '100%',
                                                height: 'auto',
                                                display: 'block',
                                                maxHeight: '450px',
                                                objectFit: 'contain',
                                                padding: '16px',
                                            }}
                                        />
                                    </div>
                                )}
                                {/* Inline Sources — rendered as premium cards inside the chat bubble */}
                                {msg.resources && msg.resources.length > 0 && (
                                    <div className="assistant-sources-grid" style={{ marginTop: '12px' }}>
                                        {msg.resources.map((res, i) => {
                                            const colors = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#ec4899'];
                                            const accentColor = colors[i % colors.length];
                                            return (
                                                <a key={i} href={res.url} target="_blank" rel="noopener noreferrer" className="assistant-source-card">
                                                    <div className="source-card-accent" style={{ background: accentColor }}></div>
                                                    <div className="source-card-icon" style={{ background: `${accentColor}15`, color: accentColor }}>
                                                        <FiExternalLink size={18} />
                                                    </div>
                                                    <div className="source-card-info">
                                                        <div className="source-card-title">{res.title}</div>
                                                        <div className="source-card-desc">{res.description}</div>
                                                    </div>
                                                </a>
                                            );
                                        })}
                                    </div>
                                )}
                                <div className="assistant-meta">
                                    <span className="assistant-time">{msg.timestamp}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="assistant-bubble-container ai">
                            <div className="assistant-bubble ai loading">
                                <div className="assistant-typing"><span></span><span></span><span></span></div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>
            </div>

            {/* Footer with Quick Actions & Input */}
            <footer className="assistant-footer">
                <div className="assistant-quick-actions">
                    {quickActions.map((action, i) => (
                        <button key={i} className="assistant-capsule" onClick={() => handleChat(null, action.query)}>
                            {action.label}
                        </button>
                    ))}
                </div>
                <form className="assistant-input-container" onSubmit={handleChat}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileAttach}
                        style={{ display: 'none' }}
                        accept=".txt,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.h,.css,.html,.json,.md,.csv,.log,.sh,.yml,.yaml,text/*"
                        multiple
                    />
                    <button type="button" className="assistant-attach" onClick={() => fileInputRef.current?.click()} title="Attach file context">
                        <FiPaperclip size={18} />
                    </button>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
                        {attachments.length > 0 && (
                            <div className="assistant-attachments-preview">
                                {attachments.map((att, i) => (
                                    <div key={i} className="attachment-pill">
                                        <span className="attachment-pill-name">{att.name}</span>
                                        <button
                                            type="button"
                                            className="attachment-pill-remove"
                                            onClick={(e) => { e.stopPropagation(); setAttachments(prev => prev.filter((_, idx) => idx !== i)); }}
                                        >
                                            <FiX size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <textarea
                            rows="1"
                            placeholder="Ask anything..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleChat(e);
                                }
                            }}
                            disabled={isLoading}
                        />
                    </div>
                    {isLoading ? (
                        <button type="button" className="assistant-stop active" onClick={handleStop} title="Stop generation">
                            <FiSquare size={16} fill="currentColor" />
                        </button>
                    ) : (
                        <button type="submit" className={`assistant-send ${query ? 'active' : ''}`}>
                            <FiSend size={18} />
                        </button>
                    )}
                </form>
            </footer>

            <style>{`
                /* Advanced AI UI Styles */
                .assistant-panel {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    overflow: hidden;
                    position: relative;
                    font-family: 'Inter', system-ui, -apple-system, sans-serif;
                }
                .assistant-header {
                    height: 54px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 18px;
                    border-bottom: 1px solid var(--border-primary);
                    flex-shrink: 0;
                    background: rgba(var(--bg-tertiary-rgb), 0.85);
                    backdrop-filter: blur(12px);
                    z-index: 10;
                    box-shadow: 0 1px 10px rgba(0,0,0,0.2);
                }
                .assistant-header-left { display: flex; align-items: center; gap: 12px; }
                .assistant-icon { 
                    color: var(--accent-primary); 
                    filter: drop-shadow(0 0 8px rgba(var(--accent-primary-rgb), 0.4)); 
                    animation: pulse-glow 2s infinite alternate;
                }
                @keyframes pulse-glow { from { opacity: 0.8; transform: scale(1); } to { opacity: 1; transform: scale(1.1); } }
                .assistant-title { font-weight: 700; font-size: 15px; letter-spacing: -0.01em; background: var(--accent-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                .assistant-header-right { display: flex; gap: 6px; }
                .assistant-action-btn, .assistant-close-btn {
                    background: transparent; border: none; color: var(--text-muted);
                    width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
                    cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .assistant-action-btn:hover { background: var(--bg-tertiary); color: var(--text-primary); transform: translateY(-1px); }
                .assistant-close-btn:hover { background: rgba(248, 81, 73, 0.15); color: var(--error); transform: rotate(90deg); }

                .assistant-chat-history {
                    flex: 1;
                    overflow-y: auto;
                    padding: 24px 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    scroll-behavior: smooth;
                    background: var(--bg-primary);
                }
                /* Subtle grid background for the chat area */
                .assistant-chat-history::before {
                    content: '';
                    position: fixed;
                    inset: 0;
                    background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.015) 1px, transparent 0);
                    background-size: 28px 28px;
                    pointer-events: none;
                    z-index: 0;
                }
                .assistant-bubble-container {
                    display: flex;
                    width: 100%;
                    animation: fadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
                    position: relative;
                    z-index: 1;
                }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
                
                .assistant-bubble-container.user { justify-content: flex-end; }
                .assistant-bubble-container.ai { justify-content: flex-start; align-items: flex-start; }

                /* AI Avatar indicator */
                .assistant-bubble-container.ai::before {
                    content: '✦';
                    font-size: 13px;
                    color: var(--accent-primary);
                    min-width: 28px;
                    min-height: 28px;
                    background: linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.15), rgba(var(--accent-secondary-rgb), 0.1));
                    border: 1px solid rgba(var(--accent-primary-rgb), 0.2);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 10px;
                    flex-shrink: 0;
                    margin-top: 2px;
                }

                .assistant-bubble {
                    max-width: 88%;
                    padding: 18px 22px;
                    border-radius: 16px;
                    font-size: 14px;
                    line-height: 1.8;
                    position: relative;
                    transition: box-shadow 0.2s ease;
                }
                .assistant-bubble.user {
                    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
                    color: white;
                    border-bottom-right-radius: 4px;
                    box-shadow: 0 4px 20px rgba(var(--accent-primary-rgb), 0.3);
                    max-width: 75%;
                }
                .assistant-bubble.ai {
                    color: var(--text-primary);
                    border-bottom-left-radius: 4px;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-primary);
                    border-left: 4px solid var(--accent-primary);
                    box-shadow: 0 10px 30px -10px rgba(0,0,0,0.25), 0 1px 4px rgba(0,0,0,0.1);
                    line-height: 1.8;
                    font-size: 14.5px;
                    backdrop-filter: blur(10px);
                }
                .assistant-bubble.ai:hover {
                    box-shadow: 0 6px 32px rgba(0,0,0,0.16);
                }
                
                /* Selection colors */
                .assistant-bubble::selection { background: var(--accent-primary); color: white; }
                
                /* Professional Typography */
                .assistant-bubble.ai h1, .assistant-bubble.ai h2, .assistant-bubble.ai h3, .assistant-bubble.ai h4 {
                    color: var(--text-primary);
                    font-weight: 700;
                    margin: 1.2em 0 0.5em 0;
                    line-height: 1.3;
                }
                .assistant-bubble.ai h1:first-child, .assistant-bubble.ai h2:first-child, .assistant-bubble.ai h3:first-child { margin-top: 0; }
                .assistant-bubble.ai h1 { font-size: 1.4em; padding-bottom: 8px; border-bottom: 1px solid var(--border-primary); margin-bottom: 12px; color: var(--accent-primary); }
                .assistant-bubble.ai h2 { font-size: 1.2em; color: var(--accent-primary); }
                .assistant-bubble.ai h3 { font-size: 1.05em; color: var(--text-secondary); }
                .assistant-bubble.ai h4 { font-size: 0.95em; color: var(--text-muted); }
                .assistant-bubble.ai p { margin: 0 0 0.9em 0; }
                .assistant-bubble.ai p:last-child { margin-bottom: 0; }
                .assistant-bubble.ai strong { color: var(--text-primary); font-weight: 700; }
                .assistant-bubble.ai em { color: var(--text-secondary); font-style: italic; }
                
                .assistant-bubble.ai ul, .assistant-bubble.ai ol { margin: 0.6em 0 1em 0; padding-left: 22px; }
                .assistant-bubble.ai li { margin-bottom: 0.5em; padding-left: 4px; line-height: 1.7; }
                .assistant-bubble.ai li::marker { color: var(--accent-primary); font-weight: 700; }
                
                .assistant-bubble.ai blockquote {
                    border-left: 3px solid var(--accent-primary);
                    margin: 16px 0;
                    padding: 10px 16px;
                    background: rgba(var(--accent-primary-rgb), 0.04);
                    border-radius: 0 8px 8px 0;
                    color: var(--text-secondary);
                    font-style: italic;
                }
                .assistant-bubble.ai a {
                    color: var(--accent-primary);
                    text-decoration: none;
                    font-weight: 600;
                    border-bottom: 1px solid rgba(var(--accent-primary-rgb), 0.3);
                    transition: border-color 0.2s;
                }
                .assistant-bubble.ai a:hover { border-bottom-color: var(--accent-primary); opacity: 0.85; }

                .assistant-meta {
                    margin-top: 12px;
                    padding-top: 10px;
                    border-top: 1px solid rgba(var(--border-primary-rgb, 255,255,255), 0.06);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .assistant-time {
                    font-size: 10px;
                    color: var(--text-muted);
                    letter-spacing: 0.04em;
                }
                
                /* Tables - Premium Glass Aesthetic */
                .assistant-table-wrapper {
                    overflow-x: auto;
                    margin: 24px 0;
                    border-radius: 12px;
                    border: 1px solid var(--border-primary);
                    background: rgba(var(--bg-tertiary-rgb), 0.2);
                    backdrop-filter: blur(4px);
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                    animation: table-slide-in 0.5s cubic-bezier(0.2, 0, 0, 1) both;
                }
                @keyframes table-slide-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .assistant-bubble.ai table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                    font-size: 13.5px;
                }
                .assistant-bubble.ai td {
                    padding: 14px 20px;
                    border-bottom: 1px solid var(--border-primary);
                    text-align: left;
                    line-height: 1.6;
                    vertical-align: top;
                }
                .assistant-bubble.ai th {
                    background: linear-gradient(to bottom, rgba(var(--accent-primary-rgb), 0.1), rgba(var(--accent-primary-rgb), 0.02));
                    font-weight: 700;
                    color: var(--accent-primary);
                    text-transform: uppercase;
                    font-size: 11px;
                    letter-spacing: 1px;
                    border-bottom: 2px solid rgba(var(--accent-primary-rgb), 0.2);
                }
                .assistant-bubble.ai tr:last-child td { border-bottom: none; }
                .assistant-bubble.ai tr:hover td {
                    background: rgba(var(--accent-primary-rgb), 0.03);
                    transition: background 0.2s ease;
                }
                .assistant-bubble.ai td strong {
                    color: var(--accent-secondary);
                }
                .assistant-bubble.ai td p {
                    margin-bottom: 4px;
                }
                .assistant-bubble.ai td p:last-child {
                    margin-bottom: 0;
                }
                .assistant-bubble.ai td code {
                    white-space: pre-wrap;
                    word-break: break-all;
                }
                .assistant-bubble.ai td .assistant-code-block {
                    margin: 8px 0;
                    min-width: 200px;
                }
 
                /* Footer */
                .assistant-footer {
                    padding: 20px;
                    border-top: 1px solid var(--border-primary);
                    background: var(--bg-secondary);
                }
                .assistant-quick-actions {
                    display: flex; 
                    gap: 10px; 
                    overflow-x: auto; 
                    margin-bottom: 12px; 
                    padding: 8px 4px; /* Added vertical padding for hover room */
                    scrollbar-width: none;
                }
                .assistant-quick-actions::-webkit-scrollbar { display: none; }
                .assistant-capsule {
                    white-space: nowrap; padding: 8px 16px; border-radius: 20px;
                    background: linear-gradient(135deg, var(--bg-tertiary), rgba(var(--accent-primary-rgb), 0.05));
                    border: 1px solid rgba(var(--accent-primary-rgb), 0.15);
                    color: var(--text-secondary); font-size: 12px; font-weight: 600;
                    cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    letter-spacing: 0.02em;
                    position: relative;
                    overflow: hidden;
                }
                .assistant-capsule::before {
                    content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(var(--accent-primary-rgb), 0.08), transparent);
                    transition: left 0.5s ease;
                }
                .assistant-capsule:hover::before { left: 100%; }
                .assistant-capsule:hover {
                    border-color: var(--accent-primary);
                    color: var(--accent-primary);
                    background: linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.12), rgba(var(--accent-primary-rgb), 0.04));
                    transform: translateY(-2px);
                    box-shadow: 0 4px 16px rgba(var(--accent-primary-rgb), 0.15);
                }
 
                 .assistant-input-container {
                    background: rgba(var(--bg-tertiary-rgb), 0.7);
                    border: 1px solid var(--border-primary);
                    border-radius: 24px;
                    padding: 6px 8px 6px 20px;
                    display: flex; align-items: center; gap: 14px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    backdrop-filter: blur(10px);
                    box-shadow: inset 0 1px 3px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.15);
                }
                .assistant-input-container:focus-within { 
                    background: var(--bg-primary);
                    border-color: var(--accent-primary); 
                    box-shadow: 0 0 0 3px rgba(var(--accent-primary-rgb), 0.15), 0 4px 12px rgba(0,0,0,0.2);
                    transform: translateY(-1px);
                }
                .assistant-input-container textarea {
                    font-size: 14px; line-height: 1.5; color: var(--text-primary);
                    background: transparent; border: none; outline: none; flex: 1;
                    padding: 4px 0; resize: none; max-height: 120px; overflow-y: auto;
                }
                .assistant-attachments-preview {
                    display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; padding-top: 4px;
                }
                .attachment-pill {
                    display: flex; align-items: center; gap: 4px; padding: 2px 8px;
                    background: rgba(var(--accent-primary-rgb), 0.15); border: 1px solid rgba(var(--accent-primary-rgb), 0.3);
                    border-radius: 12px; font-size: 11px; color: var(--accent-primary);
                }
                .attachment-pill-name { max-width: 100px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; }
                .attachment-pill-remove { 
                    display: flex; align-items: center; justify-content: center; background: transparent; border: none; 
                    color: inherit; cursor: pointer; padding: 0; opacity: 0.7; transition: opacity 0.2s;
                }
                .attachment-pill-remove:hover { opacity: 1; color: var(--error); }
                .assistant-attach, .assistant-send {
                    background: transparent; border: none; color: var(--text-muted);
                    cursor: pointer; display: flex; align-items: center; justify-content: center;
                    transition: all 0.2s; width: 36px; height: 36px; border-radius: 50%;
                }
                .assistant-attach:hover { background: rgba(255,255,255,0.05); color: var(--text-primary); }
                .assistant-send.active { color: white; background: var(--accent-primary); box-shadow: 0 2px 8px rgba(var(--accent-primary-rgb), 0.3); }
                .assistant-send.active:hover { background: var(--accent-secondary); transform: scale(1.08) rotate(-10deg); }
                .assistant-stop { 
                    background: rgba(248, 81, 73, 0.1); border: 1px solid rgba(248, 81, 73, 0.2); 
                    color: var(--error); cursor: pointer; display: flex; align-items: center; justify-content: center;
                    transition: all 0.2s; width: 36px; height: 36px; border-radius: 50%;
                }
                .assistant-stop:hover { background: rgba(248, 81, 73, 0.2); transform: scale(1.1); }

                .assistant-typing {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 4px 8px;
                    height: 24px;
                }
                .assistant-typing span {
                    width: 6px; 
                    height: 6px; 
                    background: var(--accent-primary); 
                    border-radius: 50%; 
                    animation: modernTyping 1.2s infinite ease-in-out both;
                }
                .assistant-typing span:nth-child(1) { animation-delay: -0.32s; }
                .assistant-typing span:nth-child(2) { animation-delay: -0.16s; }
                .assistant-typing span:nth-child(3) { animation-delay: 0s; }
                
                @keyframes modernTyping {
                    0%, 80%, 100% {
                        transform: scale(0.6) translateY(0);
                        opacity: 0.4;
                    }
                    40% {
                        transform: scale(1) translateY(-4px);
                        opacity: 1;
                        box-shadow: 0 4px 8px rgba(var(--accent-primary-rgb), 0.4);
                    }
                }
                
                .assistant-reasoning {
                    margin-bottom: 16px;
                    border: 1px solid var(--border-primary);
                    border-radius: 8px;
                    background: var(--bg-primary);
                    overflow: hidden;
                    font-size: 13px;
                }
                .assistant-reasoning summary {
                    padding: 8px 14px;
                    background: linear-gradient(90deg, var(--bg-tertiary), var(--bg-secondary));
                    cursor: pointer; font-weight: 600; color: var(--text-secondary);
                    list-style: none; display: flex; align-items: center; gap: 10px;
                    transition: background 0.2s;
                }
                .assistant-reasoning summary:hover { background: var(--bg-tertiary); }
                .assistant-reasoning summary::before { content: '🧠'; font-size: 16px; filter: grayscale(0.5); transition: filter 0.2s; }
                .assistant-reasoning[open] summary::before { filter: grayscale(0); }
                .assistant-reasoning .reasoning-content {
                    padding: 16px; color: var(--text-muted); font-style: italic; background: var(--bg-primary);
                    border-top: 1px solid var(--border-primary); animation: slideDown 0.3s ease-out;
                }
                @keyframes slideDown { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }

                /* VS Code Style Code Blocks - Composed */
                .assistant-code-block {
                    margin: 40px 0;
                    border-radius: 12px;
                    overflow: hidden;
                    background: #09090b;
                    border: 1px solid rgba(255, 255, 255, 0.04);
                    font-family: 'JetBrains Mono', monospace;
                }
                .assistant-code-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 20px;
                    background: rgba(255, 255, 255, 0.02);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
                    height: 44px;
                }
                .assistant-code-lang {
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: rgba(255, 255, 255, 0.3);
                    letter-spacing: 0.2em;
                }
                .assistant-code { 
                    font-size: 14.5px;
                    line-height: 1.7;
                }
                .assistant-inline-code {
                    background: rgba(var(--accent-primary-rgb), 0.15);
                    color: #fff;
                    padding: 3px 8px;
                    border-radius: 6px;
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 0.9em;
                    border: 1px solid rgba(var(--accent-primary-rgb), 0.3);
                    font-weight: 600;
                    letter-spacing: 0.02em;
                }
                
                .assistant-meta {
                    display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding: 0 4px;
                }
                .assistant-model { font-size: 11px; opacity: 0.5; font-style: italic; display: flex; align-items: center; gap: 4px; }
                .assistant-model::before { content: ''; width: 6px; height: 6px; background: currentColor; border-radius: 50%; opacity: 0.5; }
                .assistant-time { font-size: 11px; opacity: 0.5; font-weight: 500; }
                
                /* Tables Styling - Composed */
                 .assistant-table-wrapper {
                    margin: 40px 0;
                    overflow-x: auto;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    background: rgba(255, 255, 255, 0.01);
                    backdrop-filter: blur(8px);
                }
                .assistant-table-wrapper table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 14px;
                    text-align: left;
                }
                .assistant-table-wrapper th {
                    background: rgba(255, 255, 255, 0.015);
                    color: var(--accent-primary);
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.15em;
                    font-size: 10px;
                    padding: 18px 24px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }
                .assistant-table-wrapper td {
                    padding: 16px 24px;
                    color: rgba(255, 255, 255, 0.8);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.02);
                }
                .assistant-table-wrapper tr:last-child td {
                    border-bottom: none;
                }
                .assistant-table-wrapper tr:hover td {
                    background: rgba(255, 255, 255, 0.01);
                    color: #fff;
                }

                /* Executive Summary Section */
                .section-executive-summary {
                    margin: 64px 0 32px 0;
                    padding: 24px;
                    background: linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.08), transparent);
                    border-radius: 16px;
                    border-left: 4px solid var(--accent-primary);
                }
                .section-title-executive {
                    font-size: 14px;
                    font-weight: 800;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    color: var(--accent-primary);
                    display: block;
                    margin-bottom: 8px;
                }

                /* Premium Complexity Badges */
                .assistant-complexity-badges-prominent {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                    margin: 40px 0;
                }
                .complexity-badge-premium {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 14px 20px;
                    border-radius: 12px;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    min-width: 180px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .complexity-badge-premium:hover {
                    background: rgba(var(--accent-primary-rgb), 0.1);
                    border-color: rgba(var(--accent-primary-rgb), 0.3);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                }
                .complexity-badge-premium .complexity-icon {
                    color: var(--accent-primary);
                    filter: drop-shadow(0 0 8px rgba(var(--accent-primary-rgb), 0.4));
                }
                .complexity-badge-premium .complexity-label {
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    color: rgba(255, 255, 255, 0.4);
                }
                .complexity-badge-premium .complexity-value {
                    font-size: 15px;
                    font-weight: 800;
                    color: #fff;
                    font-family: 'JetBrains Mono', monospace;
                }
                
                /* Custom scrollbar for chat */
                .assistant-chat-history::-webkit-scrollbar { width: 6px; }
                .assistant-chat-history::-webkit-scrollbar-thumb { background: rgba(var(--accent-primary-rgb), 0.2); border-radius: 3px; }
                .assistant-chat-history::-webkit-scrollbar-thumb:hover { background: var(--accent-primary); }

                /* Tools & Popovers */
                .assistant-popover {
                    position: absolute; bottom: 85px; left: 16px; right: 16px;
                    background: var(--bg-elevated); border: 1px solid var(--border-primary);
                    border-radius: 12px; padding: 16px; z-index: 100;
                    box-shadow: 0 8px 30px rgba(0,0,0,0.2);
                    animation: popUp 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                @keyframes popUp { from { opacity: 0; transform: translateY(10px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
                
                .assistant-toolbar {
                    display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-bottom: 1px solid var(--border-primary);
                    flex-wrap: wrap; flex-shrink: 0; background: var(--bg-primary);
                }
                .assistant-feature-btn {
                    display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px;
                    border: 1px solid var(--border-primary); background: var(--bg-secondary); color: var(--text-secondary);
                    font-size: 12px; cursor: pointer; transition: all 0.2s; white-space: nowrap;
                }
                .assistant-feature-btn:hover:not(:disabled) {
                    border-color: var(--accent-primary); color: var(--text-primary); background: var(--bg-elevated);
                    transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }

                ${cloudGlow}

                /* Composed Elegance Styles */
                .assistant-bubble.ai {
                    background: transparent;
                    border: none;
                    padding: 0 12px;
                    margin: 24px 0; 
                    line-height: 1.85;
                    max-width: 100%;
                }
                .assistant-bubble.ai p {
                    margin-bottom: 32px;
                    font-size: 15.5px;
                    color: rgba(255, 255, 255, 0.85);
                    letter-spacing: 0.015em;
                }
                .assistant-bubble.ai .markdown-content em {
                    color: var(--accent-primary);
                    opacity: 0.9;
                }

                .assistant-complexity-badges-subtle {
                    display: flex;
                    gap: 16px;
                    margin: 8px 0 20px 0;
                    opacity: 0.6;
                    font-size: 12px;
                }
                .complexity-badge-quiet {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: var(--text-muted);
                }
                .complexity-icon-quiet {
                    color: var(--accent-primary);
                }
                .complexity-value-quiet {
                    font-family: 'JetBrains Mono', monospace;
                    font-weight: 500;
                }

                .universal-gui-container {
                    margin: 64px 0;
                    border-radius: 24px;
                    overflow: hidden;
                    border: 1px solid rgba(var(--accent-primary-rgb), 0.15);
                    background: var(--bg-tertiary);
                    box-shadow: 0 12px 60px rgba(0,0,0,0.2);
                    animation: cloud-slideUp 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
                }
                @keyframes cloud-slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }

                .universal-gui-frame {
                    width: 100%;
                    height: 550px; /* Taller for professional app feel */
                    border: none;
                    background: #fff;
                }

                .gui-bar {
                    background: rgba(var(--bg-tertiary-rgb), 0.9);
                    padding: 16px 24px;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    border-bottom: 1px solid rgba(var(--accent-primary-rgb), 0.1);
                    backdrop-filter: blur(12px);
                }
                .section-radical-simplicity {
                    margin: 48px 0 24px 0;
                    padding-bottom: 8px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }
                .section-title-radical {
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.15em;
                    text-transform: uppercase;
                    color: var(--accent-primary);
                    opacity: 0.6;
                }

                .gui-dot { width: 10px; height: 10px; background: #ff5f56; border-radius: 50%; opacity: 0.8; }
                .gui-stream-placeholder { 
                    height: 100%; display: flex; flex-direction: column; align-items: center; 
                    justify-content: center; background: #111; color: #444; gap: 16px;
                }

                /* --- Integrated GUI Styles moved to OutputPanel --- */
                .assistant-code-action-btn {
                    display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 6px;
                    background: rgba(var(--accent-primary-rgb), 0.1); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);
                    color: var(--text-primary); font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.2s;
                    text-transform: uppercase; letter-spacing: 0.05em;
                }
                .assistant-code-action-btn:hover {
                    background: var(--accent-primary); color: white; border-color: var(--accent-primary);
                    transform: translateY(-1px); box-shadow: 0 4px 12px rgba(var(--accent-primary-rgb), 0.3);
                }

                
                .performance-metrics-tag {
                    margin-top: 48px;
                    opacity: 0.4;
                    transition: opacity 0.3s;
                }
                .performance-metrics-tag:hover { opacity: 1; }
                .performance-metrics-tag summary {
                    font-size: 11px; font-weight: 700; color: var(--text-muted); cursor: pointer;
                    list-style: none; text-transform: uppercase; letter-spacing: 0.1em;
                }

                .assistant-tools-toggle {
                    display: flex; align-items: center; justify-content: center; gap: 10px;
                    padding: 14px 20px; margin: 12px 16px; border-radius: 14px;
                    background: linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.06), rgba(var(--bg-tertiary-rgb), 0.6));
                    border: 1px solid rgba(var(--accent-primary-rgb), 0.15);
                    color: var(--text-secondary); font-size: 13px; font-weight: 700;
                    cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    backdrop-filter: blur(8px);
                    letter-spacing: 0.03em;
                    position: relative;
                    overflow: hidden;
                }
                .assistant-tools-toggle::before {
                    content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
                    background: radial-gradient(circle, rgba(var(--accent-primary-rgb), 0.06) 0%, transparent 70%);
                    opacity: 0; transition: opacity 0.4s;
                }
                .assistant-tools-toggle:hover::before { opacity: 1; }
                .assistant-tools-toggle:hover {
                    background: linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.15), rgba(var(--accent-primary-rgb), 0.05));
                    border-color: var(--accent-primary);
                    color: var(--accent-primary);
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(var(--accent-primary-rgb), 0.15);
                }
                .assistant-tools-toggle.active {
                    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
                    border: 1px solid var(--accent-primary);
                    color: white;
                    border-style: solid;
                    box-shadow: 0 4px 16px rgba(var(--accent-primary-rgb), 0.3);
                }
                .assistant-tools-toggle span { display: flex; align-items: center; gap: 8px; }
                .assistant-tools-toggle svg { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
                .assistant-tools-toggle.active svg { transform: rotate(180deg); }

                .assistant-categories { 
                    background: linear-gradient(180deg, var(--bg-secondary), var(--bg-primary)); 
                    border-top: 1px solid var(--border-primary);
                    padding: 12px 0;
                    animation: slideIn 0.3s ease-out;
                }
                @keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

                .assistant-category {
                    margin: 0 16px 10px 16px;
                    border-radius: 14px;
                    overflow: hidden;
                    border: 1px solid transparent;
                    transition: all 0.3s;
                }
                .assistant-category.expanded {
                    background: linear-gradient(165deg, rgba(var(--bg-tertiary-rgb), 0.4), rgba(var(--accent-primary-rgb), 0.03));
                    border-color: rgba(var(--accent-primary-rgb), 0.12);
                    box-shadow: 0 4px 16px rgba(0,0,0,0.08);
                }

                .assistant-category-header {
                    width: 100%;
                    padding: 14px 18px; 
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: transparent;
                    border: none;
                    color: var(--text-secondary);
                    font-size: 13px; font-weight: 700; 
                    cursor: pointer; transition: all 0.2s;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    position: relative;
                }
                .assistant-category-header:hover { background: rgba(var(--accent-primary-rgb), 0.04); color: var(--text-primary); }
                .assistant-category.expanded .assistant-category-header { color: var(--accent-primary); }

                .assistant-category-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    padding: 0 16px 16px 16px;
                    animation: fadeIn 0.3s ease-out;
                }

                .assistant-feature-card {
                    display: flex; 
                    flex-direction: row;
                    align-items: center;
                    gap: 16px; 
                    padding: 14px 18px; 
                    border-radius: 12px;
                    border: 1px solid rgba(var(--accent-primary-rgb), 0.08); 
                    background: linear-gradient(135deg, var(--bg-primary), rgba(var(--accent-primary-rgb), 0.02));
                    color: var(--text-primary); text-align: left;
                    cursor: pointer; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                }
                .assistant-feature-card::before {
                    content: ''; position: absolute; top: 0; left: 0; width: 3px; height: 100%;
                    background: linear-gradient(180deg, var(--accent-primary), var(--accent-secondary));
                    opacity: 0; transition: opacity 0.25s;
                }
                .assistant-feature-card::after {
                    content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(var(--accent-primary-rgb), 0.04), transparent);
                    transition: left 0.6s ease;
                }
                .assistant-feature-card:hover::after { left: 100%; }
                .assistant-feature-card:hover { 
                    border-color: rgba(var(--accent-primary-rgb), 0.3); 
                    background: linear-gradient(135deg, var(--bg-elevated), rgba(var(--accent-primary-rgb), 0.06)); 
                    transform: translateX(4px); 
                    box-shadow: 0 6px 20px rgba(0,0,0,0.12); 
                }
                .assistant-feature-card:hover::before { opacity: 1; }
                
                .card-icon { font-size: 22px; flex-shrink: 0; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.25)); transition: transform 0.3s; }
                .assistant-feature-card:hover .card-icon { transform: scale(1.15); }
                .card-label-container { display: flex; flex-direction: column; gap: 3px; }
                .card-label { font-weight: 700; font-size: 13px; color: var(--text-primary); }
                .card-desc { font-size: 11px; color: var(--text-muted); line-height: 1.4; }

                /* Smooth category transitions */
                .category-arrow { transition: transform 0.3s; font-size: 10px; opacity: 0.5; }
                .assistant-category.expanded .category-arrow { transform: rotate(90deg); opacity: 1; color: var(--accent-primary); }

                /* Tab Styles */
                .assistant-tabs {
                    display: flex;
                    gap: 4px;
                    padding: 4px 12px;
                    background: var(--bg-tertiary);
                    border-bottom: 1px solid var(--border-primary);
                    overflow-x: auto;
                    scrollbar-width: none;
                }
                .assistant-tabs::-webkit-scrollbar { display: none; }
                
                .assistant-tab {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    border: none;
                    background: transparent;
                    color: var(--text-muted);
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    white-space: nowrap;
                    border-radius: 8px;
                    transition: all 0.2s;
                }
                .assistant-tab:hover {
                    color: var(--text-primary);
                    background: rgba(var(--accent-primary-rgb), 0.05);
                }
                .assistant-tab.active {
                    color: var(--accent-primary);
                    background: rgba(var(--accent-primary-rgb), 0.1);
                }

                /* Specialized Views */
                .assistant-specialized-view {
                    flex: 1;
                    padding: 16px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                }
                .assistant-empty-view {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 16px;
                    color: var(--text-muted);
                    text-align: center;
                    padding: 40px;
                }
                .assistant-empty-view h3 { color: var(--text-primary); margin: 0; }
                .assistant-empty-view p { font-size: 13px; max-width: 240px; margin: 0; }

                .assistant-content-area {
                    font-size: 14px;
                    line-height: 1.6;
                    color: var(--text-primary);
                }

                .assistant-sources-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 12px;
                }
                 .assistant-source-card {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    padding: 18px;
                    background: rgba(var(--bg-secondary-rgb), 0.5);
                    border: 1px solid var(--border-primary);
                    border-radius: 16px;
                    text-decoration: none;
                    color: inherit;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    transition: all 0.2s ease;
                    position: relative;
                }
                .assistant-source-card:hover {
                    border-color: var(--accent-primary);
                    background: var(--bg-elevated);
                    transform: translateX(4px);
                    box-shadow: 0 4px 15px rgba(0,0,0,0.15);
                }
                .source-card-accent {
                    position: absolute;
                    left: 0;
                    top: 12px;
                    bottom: 12px;
                    width: 3px;
                    border-radius: 0 2px 2px 0;
                    background: var(--accent-primary);
                    opacity: 0.8;
                }
                .source-card-icon {
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(var(--accent-primary-rgb), 0.1) !important;
                    color: var(--accent-primary) !important;
                    flex-shrink: 0;
                }
                .source-card-info {
                    flex: 1;
                    min-width: 0;
                }
                .source-card-title {
                    font-weight: 700;
                    font-size: 15px;
                    color: var(--text-primary);
                    margin-bottom: 4px;
                    letter-spacing: -0.01em;
                }
                .source-card-desc {
                    font-size: 12px;
                    color: var(--text-muted);
                    line-height: 1.4;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .assistant-complexity-badges {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                    gap: 12px;
                    margin: 24px 0;
                }
                .complexity-badge {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    border-radius: 12px;
                    background: rgba(var(--bg-tertiary-rgb), 0.3);
                    border: 1px solid var(--border-primary);
                    transition: all 0.2s ease;
                }
                .complexity-badge:hover {
                    border-color: var(--accent-primary);
                    background: rgba(var(--bg-tertiary-rgb), 0.5);
                    transform: translateY(-2px);
                }
                .complexity-icon {
                    color: var(--accent-primary);
                    opacity: 0.8;
                }
                .complexity-info {
                    display: flex;
                    flex-direction: column;
                }
                .complexity-label {
                    font-size: 10px;
                    color: var(--text-muted);
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .complexity-value {
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--text-primary);
                    font-family: var(--font-mono);
                }
                
                /* Cleanup legacy complexity styles */
                .time-badge, .space-badge { background: none; border-top: none; }
                .time-badge .complexity-icon, .space-badge .complexity-icon { background: none; padding: 0; box-shadow: none; }

            `}</style>
        </div >
    );
}

export default LearningPanel;

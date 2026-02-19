import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
    FiSettings, FiX, FiPaperclip, FiSend, FiZap, FiCopy, FiCheck, FiRotateCcw, FiPlay, FiGrid, FiChevronDown, FiChevronUp, FiSave, FiTrash2, FiSquare
} from 'react-icons/fi';
import { useFileStore, useUIStore, useExecutionStore, useSettingsStore, useLearningStore } from '../store';
import { aiService } from '../services/api';
import api from '../services/api'; // Direct access to axios instance
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

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

// Unified clipboard helper (v1.0.1 - Cache Buster)
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
    const [query, setQuery] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingFeature, setLoadingFeature] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [provider, setProvider] = useState(() => localStorage.getItem('roolts_ai_provider') || 'roolts');
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('roolts_ai_key') || '');
    const [aiStatus, setAiStatus] = useState({ configured: null, models: [] });
    const [translateLang, setTranslateLang] = useState('python');
    const [expandedCategory, setExpandedCategory] = useState(null);
    const [showAllTools, setShowAllTools] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const { features, toggleFeature } = useSettingsStore();

    const { files, activeFileId } = useFileStore();
    const { addNotification, toggleRightPanel, setRightPanelTab } = useUIStore();
    const { output: executionOutput } = useExecutionStore();
    const { pendingQuery, setPendingQuery } = useLearningStore();
    const activeFile = files.find(f => f.id === activeFileId);
    const chatEndRef = useRef(null);
    const abortControllerRef = useRef(null);

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
            setLoadingFeature(null);
            addNotification({ type: 'info', message: 'AI request cancelled' });
        }
    };

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
        localStorage.setItem('roolts_ai_key', apiKey);
        // localStorage.setItem('roolts_ai_chat_history', JSON.stringify(chatHistory)); // History Disabled
    }, [provider, apiKey]);

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
        if (!finalQuery.trim() || !activeFile) return;

        const userMsg = {
            role: 'user',
            content: finalQuery,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setChatHistory(prev => [...prev, userMsg]);
        if (!forcedQuery) setQuery('');
        setIsLoading(true);

        // Abort previous request if any
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        let contextQuery = finalQuery;
        if (features.socratesMode) {
            contextQuery = `[SYSTEM: SOCRATES MODE ENABLED. You are Socrates. Do NOT give the user the answer or code directly. Instead, ask a guiding question to help them discover the answer themselves. Be helpful but Socratic.]\n\nUser Query: ${finalQuery}`;
        }

        try {
            const response = await aiService.chat(
                activeFile.content,
                activeFile.language || 'plaintext',
                contextQuery,
                chatHistory,
                provider !== 'roolts' ? apiKey : null,
                provider !== 'roolts' ? provider : null,
                [],
                abortControllerRef.current.signal,
                executionOutput
            );

            setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: response.data.response || "No response generated.",
                reasoning: response.data.reasoning,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        } catch (error) {
            if (error.name === 'AbortError' || axios?.isCancel?.(error)) {
                // Ignore cancellation
                console.log('AI request cancelled by user');
                return;
            }
            const errMsg = error.response?.data?.response || error.message || 'AI chat failed — check your connection.';
            setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: `> ⚠️ **Error:** ${errMsg}`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        } finally {
            abortControllerRef.current = null;
            setIsLoading(false);
        }
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

    const clearHistory = () => {
        if (window.confirm('Are you sure you want to delete all chat history? This cannot be undone.')) {
            setChatHistory([]);
            localStorage.removeItem('roolts_ai_chat_history');
            addNotification({ type: 'info', message: 'Chat history cleared' });
        }
    };

    // Feature action handler — calls specialized AI endpoints
    const handleFeature = async (featureName, apiCall) => {
        if (!activeFile || !activeFile.content) {
            addNotification({ type: 'warning', message: 'Open a file first' });
            return;
        }
        setLoadingFeature(featureName);
        setIsLoading(true);

        // Abort previous request if any
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        // Add a "user" bubble showing what feature was triggered
        setChatHistory(prev => [...prev, {
            role: 'user',
            content: `🔧 **${featureName}** on \`${activeFile.name || 'current file'}\``,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);

        try {
            const response = await apiCall(activeFile.content, activeFile.language || 'plaintext', executionOutput, abortControllerRef.current.signal);
            const data = response.data;
            setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: data.response || data.error || 'No response.',
                reasoning: data.reasoning,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        } catch (error) {
            if (error.name === 'AbortError' || axios?.isCancel?.(error)) {
                // Ignore cancellation
                console.log(`${featureName} cancelled by user`);
                return;
            }
            setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: `> ⚠️ **${featureName} failed:** ${error.response?.data?.error || error.message}`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        } finally {
            abortControllerRef.current = null;
            setLoadingFeature(null);
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
            ]
        },
        {
            id: 'debug', title: '🐛 Debugging', features: [
                { icon: '🐛', label: 'Fix Bugs', desc: 'Find & fix bugs', action: () => handleFeature('Fix Code', aiService.fixCode) },
                { icon: '📋', label: 'Stack Trace', desc: 'Analyze error traces', action: () => handleFeature('Stack Trace Analysis', (code, lang) => aiService.analyzeStackTrace(code, lang, '')) },
                { icon: '🔮', label: 'Predict Bugs', desc: 'Find bugs before they hit', action: () => handleFeature('Bug Prediction', aiService.predictBugs) },
                { icon: '🔍', label: 'Review', desc: 'Security & style review', action: () => handleFeature('Code Review', aiService.review) },
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
        { icon: '🐛', label: 'Fix', action: () => handleFeature('Fix Code', aiService.fixCode) },
        { icon: '⚡', label: 'Perf', action: () => handleFeature('Performance Analysis', aiService.analyzePerformance) },
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

                        <label>Provider</label>
                        <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                            <option value="roolts">Roolts</option>
                            <option value="openai">OpenAI</option>
                            <option value="gemini">Gemini</option>
                            <option value="deepseek">DeepSeek</option>
                            <option value="huggingface">Hugging Face</option>
                        </select>
                        {provider !== 'roolts' && (
                            <>
                                <label>API Key</label>
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="Enter key..."
                                />
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

            {/* Top Feature Toolbar — Quick Access */}
            <div className="assistant-toolbar">
                {topFeatures.map((feat, i) => (
                    <button
                        key={i}
                        className={`assistant-feature-btn ${loadingFeature === feat.label ? 'loading' : ''}`}
                        onClick={feat.action}
                        disabled={isLoading}
                        title={feat.desc}
                    >
                        <span className="feature-icon">{feat.icon}</span>
                        <span className="feature-label">{feat.label}</span>
                    </button>
                ))}
                <select
                    className="assistant-translate-select"
                    value={translateLang}
                    onChange={(e) => setTranslateLang(e.target.value)}
                    title="Target language for translation"
                >
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                    <option value="typescript">TypeScript</option>
                    <option value="java">Java</option>
                    <option value="c">C</option>
                    <option value="cpp">C++</option>
                    <option value="go">Go</option>
                    <option value="rust">Rust</option>
                </select>
            </div>

            {/* More Tools Toggle */}
            <div className={`assistant-tools-toggle ${showAllTools ? 'active' : ''}`} onClick={() => setShowAllTools(!showAllTools)}>
                <span>{showAllTools ? 'Close Tools' : 'Explore All AI Tools'}</span>
                {showAllTools ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
            </div>

            {/* Expanded Feature Categories */}
            {showAllTools && (
                <div className="assistant-categories">
                    {featureCategories.map(cat => (
                        <div key={cat.id} className={`assistant-category ${expandedCategory === cat.id ? 'expanded' : ''}`}>
                            <button
                                className="assistant-category-header"
                                onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
                            >
                                <span>{cat.title}</span>
                                <span className="category-arrow">{expandedCategory === cat.id ? '▾' : '▸'}</span>
                            </button>
                            {expandedCategory === cat.id && (
                                <div className="assistant-category-grid">
                                    {cat.features.map((feat, j) => (
                                        <button
                                            key={j}
                                            className={`assistant-feature-card ${loadingFeature === feat.label ? 'loading' : ''}`}
                                            onClick={feat.action}
                                            disabled={isLoading}
                                            title={feat.desc}
                                        >
                                            <span className="card-icon">{feat.icon}</span>
                                            <div className="card-label-container">
                                                <span className="card-label">{feat.label}</span>
                                                <span className="card-desc">{feat.desc}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Conversation Area */}
            <div className="assistant-chat-history">
                {chatHistory.map((msg, idx) => (
                    <div key={idx} className={`assistant-bubble-container ${msg.role === 'user' ? 'user' : 'ai'}`}>
                        <div className={`assistant-bubble ${msg.role}`}>
                            {msg.reasoning && (
                                <details className="assistant-reasoning">
                                    <summary>Thinking Process</summary>
                                    <div className="reasoning-content">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.reasoning}</ReactMarkdown>
                                    </div>
                                </details>
                            )}
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    code({ node, className, children, ...props }) {
                                        const match = /language-(\w+)/.exec(className || '');
                                        const codeContent = String(children).replace(/\n$/, '');
                                        const isInline = !match;

                                        return !isInline ? (
                                            <div className="assistant-code-block">
                                                <div className="assistant-code-header">
                                                    <span className="assistant-code-lang">{match ? match[1] : 'text'}</span>
                                                    <CopyButton content={codeContent} />
                                                </div>
                                                <div className="assistant-code">
                                                    <SyntaxHighlighter
                                                        style={vscDarkPlus}
                                                        language={match ? match[1] : 'plaintext'}
                                                        PreTag="div"
                                                        customStyle={{ margin: 0, padding: '12px', background: 'transparent' }}
                                                    >
                                                        {codeContent}
                                                    </SyntaxHighlighter>
                                                </div>
                                            </div>
                                        ) : (
                                            <code className="assistant-inline-code" {...props}>{children}</code>
                                        );
                                    },
                                    table({ children, ...props }) {
                                        return (
                                            <div style={{ overflowX: 'auto', margin: '24px 0', borderRadius: '12px', border: '1px solid var(--border-primary)' }}>
                                                <table {...props} style={{ margin: 0, border: 'none', width: '100%' }}>
                                                    {children}
                                                </table>
                                            </div>
                                        );
                                    }
                                }}
                            >
                                {msg.content}
                            </ReactMarkdown>
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
                    <button type="button" className="assistant-attach">
                        <FiPaperclip size={18} />
                    </button>
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
                    height: 52px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 16px;
                    border-bottom: 1px solid var(--border-primary);
                    flex-shrink: 0;
                    background: linear-gradient(to bottom, var(--bg-tertiary), var(--bg-secondary)); /* Premium Gradient */
                    z-index: 10;
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
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                    scroll-behavior: smooth;
                    background: var(--bg-primary); /* Cleaner background for messages */
                }
                .assistant-bubble-container { display: flex; width: 100%; animation: fadeIn 0.3s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                
                .assistant-bubble-container.user { justify-content: flex-end; }
                .assistant-bubble-container.ai { justify-content: flex-start; }

                .assistant-bubble {
                    max-width: 90%;
                    padding: 18px 24px; /* Spacious Padding */
                    border-radius: 18px;
                    font-size: 15px;
                    line-height: 1.85; /* Spacious Line Height */
                    position: relative;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.06);
                    transition: all 0.3s ease;
                }
                .assistant-bubble.user {
                    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
                    color: white;
                    border-bottom-right-radius: 4px;
                }
                .assistant-bubble.ai {
                    color: var(--text-primary);
                    border-bottom-left-radius: 4px;
                    border: 1px solid var(--border-primary);
                    /* Premium glass aesthetic */
                    background: linear-gradient(165deg, rgba(var(--bg-elevated-rgb), 0.85), rgba(var(--bg-secondary-rgb), 0.95));
                    backdrop-filter: blur(16px);
                    box-shadow: 0 12px 40px rgba(0,0,0,0.18);
                    padding: 16px 20px;
                    line-height: 1.75;
                    font-size: 14.5px;
                }
                
                /* Selection colors */
                .assistant-bubble::selection { background: var(--accent-primary); color: white; }
                
                /* Professional Typography */
                .assistant-bubble.ai h1, .assistant-bubble.ai h2, .assistant-bubble.ai h3 {
                    margin: 1.2em 0 0.6em 0;
                    color: var(--accent-primary);
                    font-weight: 700;
                    letter-spacing: -0.01em;
                }
                .assistant-bubble.ai h1:first-child, .assistant-bubble.ai h2:first-child { margin-top: 0; }
                .assistant-bubble.ai h1 { font-size: 1.55em; border-bottom: 1px solid var(--border-primary); padding-bottom: 8px; }
                .assistant-bubble.ai h2 { font-size: 1.35em; }
                .assistant-bubble.ai h3 { font-size: 1.15em; }
                .assistant-bubble.ai p { margin-bottom: 0.8em; }
                .assistant-bubble.ai p:last-child { margin-bottom: 0; }
                
                .assistant-bubble.ai ul, .assistant-bubble.ai ol { margin-bottom: 0.8em; padding-left: 20px; }
                .assistant-bubble.ai li { margin-bottom: 1.5em; position: relative; padding-left: 6px; }
                .assistant-bubble.ai li::marker { color: var(--accent-primary); padding-right: 8px; }
                .assistant-bubble.ai strong { color: var(--accent-primary); font-weight: 700; }
                .assistant-bubble.ai blockquote {
                    border-left: 4px solid var(--accent-primary);
                    margin: 20px 0; padding: 12px 18px;
                    background: rgba(var(--accent-primary-rgb), 0.05);
                    font-style: italic; color: var(--text-secondary);
                    border-radius: 0 8px 8px 0;
                }
                .assistant-bubble.ai a { color: var(--accent-primary); text-decoration: none; font-weight: 600; border-bottom: 1px dotted var(--accent-primary); }
                .assistant-bubble.ai a:hover { border-bottom-style: solid; opacity: 0.8; }
                
                /* Tables */
                /* Tables */
                .assistant-bubble.ai table {
                    width: 100%; border-collapse: separate; border-spacing: 0; font-size: 14px;
                    background: rgba(var(--bg-tertiary-rgb), 0.3);
                }
                .assistant-bubble.ai th, .assistant-bubble.ai td {
                    padding: 14px 18px; border-bottom: 1px solid var(--border-primary); text-align: left;
                    line-height: 1.6;
                }
                .assistant-bubble.ai th { 
                    background: rgba(var(--bg-tertiary-rgb), 0.8); 
                    font-weight: 700; color: var(--text-primary); 
                    text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px;
                }
                .assistant-bubble.ai tr:last-child td { border-bottom: none; }
                .assistant-bubble.ai tr:hover td { background: rgba(var(--bg-tertiary-rgb), 0.5); }
                .assistant-bubble.ai td p, .assistant-bubble.ai th p {
                    margin-bottom: 12px;
                }
                .assistant-bubble.ai td p:last-child, .assistant-bubble.ai th p:last-child {
                    margin-bottom: 0;
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
                    white-space: nowrap; padding: 6px 14px; border-radius: 20px;
                    background: var(--bg-tertiary); border: 1px solid var(--border-primary);
                    color: var(--text-secondary); font-size: 12px; font-weight: 500;
                    cursor: pointer; transition: all 0.2s;
                }
                .assistant-capsule:hover { border-color: var(--accent-primary); color: var(--text-primary); transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
 
                .assistant-input-container {
                    background: var(--bg-tertiary); /* Contrast against panel */
                    border: 1px solid var(--border-primary);
                    border-radius: 28px; /* Clean Pill Shape */
                    padding: 4px 6px 4px 18px;
                    display: flex; align-items: center; gap: 12px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
                }
                .assistant-input-container:focus-within { 
                    background: var(--bg-primary);
                    border-color: var(--accent-primary); 
                    box-shadow: 0 0 0 3px rgba(var(--accent-primary-rgb), 0.15), 0 4px 12px rgba(0,0,0,0.2);
                    transform: translateY(-1px);
                }
                .assistant-input-container textarea {
                    font-size: 15px; line-height: 1.5; color: var(--text-primary);
                    background: transparent; border: none; outline: none; flex: 1;
                    padding: 8px 0;
                }
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

                .assistant-typing { display: flex; gap: 6px; padding: 8px 12px; background: rgba(var(--bg-tertiary-rgb), 0.5); border-radius: 12px; width: fit-content; }
                .assistant-typing span {
                    width: 8px; height: 8px; background: var(--text-muted); opacity: 0.4;
                    border-radius: 50%; animation: typing 1.4s infinite ease-in-out both;
                }
                .assistant-typing span:nth-child(1) { animation-delay: -0.32s; }
                .assistant-typing span:nth-child(2) { animation-delay: -0.16s; }
                
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

                /* VS Code Style Code Blocks -> Mini Terminal */
                .assistant-code-block {
                    margin: 20px 0;
                    border: 1px solid #333;
                    border-radius: 6px;
                    overflow: hidden;
                    background: #0d0d0d; /* Dark Terminal Background */
                    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
                    font-family: 'Fira Code', monospace;
                }
                .assistant-code-header {
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 8px 12px; background: #1f1f1f; border-bottom: 1px solid #333;
                    height: 36px;
                }
                .assistant-code-lang {
                    font-size: 11px; font-weight: 700; text-transform: uppercase; color: #888; letter-spacing: 1px;
                    display: flex; align-items: center; gap: 8px;
                }
                .assistant-code-lang::before {
                    content: none;
                }

                .assistant-copy-btn {
                    display: flex; align-items: center; gap: 6px; background: transparent; border: none;
                    color: #858585; cursor: pointer; padding: 4px 8px; border-radius: 4px;
                    font-size: 11px; font-weight: 500; transition: all 0.2s;
                }
                .assistant-copy-btn:hover { background: #3c3c3c; color: #cccccc; }
                .assistant-copy-btn.copied { color: #3fb950; }
                .assistant-code { 
                    font-size: 13px; line-height: 1.5; font-family: 'JetBrains Mono', 'Fira Code', monospace; 
                    padding: 4px 0; /* Let syntax highlighter handle padding */
                }
                .assistant-inline-code { 
                    background: rgba(var(--accent-primary-rgb), 0.1); color: var(--accent-primary);
                    padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 0.9em;
                    border: 1px solid rgba(var(--accent-primary-rgb), 0.2);
                }
                
                .assistant-meta {
                    display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding: 0 4px;
                }
                .assistant-model { font-size: 11px; opacity: 0.5; font-style: italic; display: flex; align-items: center; gap: 4px; }
                .assistant-model::before { content: ''; width: 6px; height: 6px; background: currentColor; border-radius: 50%; opacity: 0.5; }
                .assistant-time { font-size: 11px; opacity: 0.5; font-weight: 500; }
                
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

                .assistant-tools-toggle {
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                    padding: 12px 16px; margin: 10px 16px; border-radius: 12px;
                    background: rgba(var(--bg-tertiary-rgb), 0.5);
                    border: 1px dashed var(--border-primary);
                    color: var(--text-secondary); font-size: 13px; font-weight: 600;
                    cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    backdrop-filter: blur(4px);
                }
                .assistant-tools-toggle:hover {
                    background: rgba(var(--accent-primary-rgb), 0.1);
                    border: 1px solid var(--accent-primary);
                    color: var(--accent-primary);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(var(--accent-primary-rgb), 0.1);
                }
                .assistant-tools-toggle.active {
                    background: var(--accent-primary);
                    border: 1px solid var(--accent-primary);
                    color: white;
                    border-style: solid;
                }
                .assistant-tools-toggle span { display: flex; align-items: center; gap: 6px; }
                .assistant-tools-toggle svg { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
                .assistant-tools-toggle.active svg { transform: rotate(180deg); }

                .assistant-categories { 
                    background: var(--bg-secondary); 
                    border-top: 1px solid var(--border-primary);
                    padding: 8px 0;
                    animation: slideIn 0.3s ease-out;
                }
                @keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

                .assistant-category {
                    margin: 0 16px 8px 16px;
                    border-radius: 12px;
                    overflow: hidden;
                    border: 1px solid transparent;
                    transition: all 0.3s;
                }
                .assistant-category.expanded {
                    background: rgba(var(--bg-tertiary-rgb), 0.3);
                    border-color: var(--border-secondary);
                }

                .assistant-category-header {
                    width: 100%;
                    padding: 12px 16px; 
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: transparent;
                    border: none;
                    color: var(--text-secondary);
                    font-size: 13px; font-weight: 700; 
                    cursor: pointer; transition: all 0.2s;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .assistant-category-header:hover { background: rgba(var(--bg-tertiary-rgb), 0.5); color: var(--text-primary); }
                .assistant-category.expanded .assistant-category-header { color: var(--accent-primary); }

                .assistant-category-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    padding: 0 16px 16px 16px;
                    animation: fadeIn 0.3s ease-out;
                }

                .assistant-feature-card {
                    display: flex; 
                    flex-direction: row; /* Horizontal layout for list style */
                    align-items: center;
                    gap: 16px; 
                    padding: 12px 16px; 
                    border-radius: 12px;
                    border: 1px solid var(--border-primary); 
                    background: var(--bg-primary);
                    color: var(--text-primary); text-align: left;
                    cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                }
                .assistant-feature-card::before {
                    content: ''; position: absolute; top: 0; left: 0; width: 3px; height: 100%;
                    background: var(--accent-primary); opacity: 0; transition: opacity 0.2s;
                }
                .assistant-feature-card:hover { 
                    border-color: var(--accent-primary); 
                    background: var(--bg-elevated); 
                    transform: translateX(4px); 
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
                }
                .assistant-feature-card:hover::before { opacity: 1; }
                
                .card-icon { font-size: 20px; flex-shrink: 0; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); }
                .card-label-container { display: flex; flex-direction: column; gap: 2px; }
                .card-label { font-weight: 700; font-size: 13px; color: var(--text-primary); }
                .card-desc { font-size: 11px; color: var(--text-muted); line-height: 1.4; }

                /* Smooth category transitions */
                .category-arrow { transition: transform 0.3s; font-size: 10px; opacity: 0.5; }
                .assistant-category.expanded .category-arrow { transform: rotate(90deg); opacity: 1; }

            `}</style>
        </div>
    );
}

export default LearningPanel;

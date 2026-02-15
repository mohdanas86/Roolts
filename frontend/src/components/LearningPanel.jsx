import React, { useState, useRef, useEffect } from 'react';
import {
    FiSettings, FiX, FiPaperclip, FiSend, FiZap, FiCopy, FiCheck, FiRotateCcw, FiPlay, FiGrid, FiChevronDown, FiChevronUp
} from 'react-icons/fi';
import { useFileStore, useUIStore } from '../store';
import { aiService } from '../services/api';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

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

function LearningPanel({ onBack }) {
    const [query, setQuery] = useState('');
    const [chatHistory, setChatHistory] = useState(() => {
        const saved = localStorage.getItem('roolts_ai_chat_history');
        return saved ? JSON.parse(saved) : [];
    });
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

    const { files, activeFileId } = useFileStore();
    const { addNotification, toggleRightPanel, setRightPanelTab } = useUIStore();
    const activeFile = files.find(f => f.id === activeFileId);
    const chatEndRef = useRef(null);

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
        localStorage.setItem('roolts_ai_chat_history', JSON.stringify(chatHistory));
    }, [provider, apiKey, chatHistory]);

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

        try {
            const response = await aiService.chat(
                activeFile.content,
                activeFile.language || 'plaintext',
                finalQuery,
                chatHistory,
                provider !== 'roolts' ? apiKey : null,
                provider !== 'roolts' ? provider : null
            );

            setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: response.data.response || "No response generated.",
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        } catch (error) {
            const errMsg = error.response?.data?.response || error.message || 'AI chat failed — check your connection.';
            setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: `> ⚠️ **Error:** ${errMsg}`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        }
        setIsLoading(false);
    };

    // Feature action handler — calls specialized AI endpoints
    const handleFeature = async (featureName, apiCall) => {
        if (!activeFile || !activeFile.content) {
            addNotification({ type: 'warning', message: 'Open a file first' });
            return;
        }
        setLoadingFeature(featureName);
        setIsLoading(true);

        // Add a "user" bubble showing what feature was triggered
        setChatHistory(prev => [...prev, {
            role: 'user',
            content: `🔧 **${featureName}** on \`${activeFile.name || 'current file'}\``,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);

        try {
            const response = await apiCall(activeFile.content, activeFile.language || 'plaintext');
            const data = response.data;
            setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: data.response || data.error || 'No response.',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        } catch (error) {
            setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: `> ⚠️ **${featureName} failed:** ${error.response?.data?.error || error.message}`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        }
        setLoadingFeature(null);
        setIsLoading(false);
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
                        <label>Provider</label>
                        <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                            <option value="roolts">Roolts</option>
                            <option value="openai">OpenAI</option>
                            <option value="gemini">Gemini</option>
                            <option value="deepseek">DeepSeek</option>
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
                        <button className="btn btn--primary" style={{ width: '100%', marginTop: '12px' }} onClick={() => setShowSettings(false)}>Done</button>
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
                {chatHistory.length > 0 && (
                    <button
                        className="assistant-feature-btn clear"
                        onClick={() => { setChatHistory([]); localStorage.removeItem('roolts_ai_chat_history'); }}
                        title="Clear chat history"
                    >
                        <span className="feature-icon"><FiRotateCcw size={12} /></span>
                        <span className="feature-label">Clear</span>
                    </button>
                )}
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
                                            <span className="card-label">{feat.label}</span>
                                            <span className="card-desc">{feat.desc}</span>
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
                            <ReactMarkdown
                                components={{
                                    code({ inline, className, children, ...props }) {
                                        const match = /language-(\w+)/.exec(className || '');
                                        const lang = match ? match[1] : 'text';
                                        const codeContent = String(children).replace(/\n$/, '');

                                        return !inline ? (
                                            <div className="assistant-code-block">
                                                <div className="assistant-code-header">
                                                    <span className="assistant-code-lang">{lang}</span>
                                                    <CopyButton content={codeContent} />
                                                </div>
                                                <div className="assistant-code">
                                                    <SyntaxHighlighter
                                                        style={vscDarkPlus}
                                                        language={lang}
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
                    />
                    <button type="submit" className={`assistant-send ${query ? 'active' : ''}`}>
                        <FiSend size={18} />
                    </button>
                </form>
            </footer>

            <style>{`
                .assistant-panel {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    overflow: hidden;
                    position: relative;
                }
                .assistant-header {
                    height: 48px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 var(--space-4);
                    border-bottom: 1px solid var(--border-primary);
                    flex-shrink: 0;
                }
                .assistant-header-left { display: flex; align-items: center; gap: 10px; }
                .assistant-icon { color: var(--accent-primary); }
                .assistant-title { font-weight: 600; font-size: 14px; }
                .assistant-header-right { display: flex; gap: 4px; }
                .assistant-action-btn, .assistant-close-btn {
                    background: transparent; border: none; color: var(--text-muted);
                    width: 28px; height: 28px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center;
                    cursor: pointer; transition: all 0.2s;
                }
                .assistant-action-btn:hover { background: var(--bg-tertiary); color: var(--text-primary); }
                .assistant-close-btn:hover { background: rgba(248, 81, 73, 0.1); color: var(--error); }

                .assistant-chat-history {
                    flex: 1;
                    overflow-y: auto;
                    padding: var(--space-4);
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .assistant-bubble-container { display: flex; width: 100%; }
                .assistant-bubble-container.user { justify-content: flex-end; }
                .assistant-bubble-container.ai { justify-content: flex-start; }

                .assistant-bubble {
                    max-width: 85%;
                    padding: 10px 14px;
                    border-radius: var(--radius-md);
                    font-size: 14px;
                    line-height: 1.5;
                    position: relative;
                }
                .assistant-bubble.user {
                    background: var(--accent-primary);
                    color: white;
                    border-bottom-right-radius: 2px;
                }
                .assistant-bubble.ai {
                    background: var(--bg-tertiary);
                    color: var(--text-primary);
                    border-bottom-left-radius: 2px;
                    border: 1px solid var(--border-primary);
                }



                .assistant-footer {
                    padding: var(--space-4);
                    border-top: 1px solid var(--border-primary);
                    background: var(--bg-secondary);
                }
                .assistant-quick-actions {
                    display: flex;
                    gap: 8px;
                    overflow-x: auto;
                    margin-bottom: 12px;
                    padding-bottom: 4px;
                    scrollbar-width: none;
                }
                .assistant-quick-actions::-webkit-scrollbar { display: none; }
                .assistant-capsule {
                    white-space: nowrap;
                    padding: 4px 12px;
                    border-radius: 12px;
                    background: var(--bg-tertiary);
                    border: 1px solid var(--border-primary);
                    color: var(--text-secondary);
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .assistant-capsule:hover { border-color: var(--accent-primary); color: var(--text-primary); }

                .assistant-input-container {
                    background: var(--bg-primary);
                    border: 1px solid var(--border-primary);
                    border-radius: var(--radius-md);
                    padding: 8px 12px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .assistant-input-container textarea {
                    flex: 1;
                    background: transparent;
                    border: none;
                    color: var(--text-primary);
                    font-size: 14px;
                    resize: none;
                    outline: none;
                    max-height: 120px;
                    font-family: var(--font-body);
                }
                .assistant-input-container textarea::placeholder { color: var(--text-muted); }
                .assistant-attach, .assistant-send {
                    background: transparent; border: none; color: var(--text-muted);
                    cursor: pointer; display: flex; align-items: center; justify-content: center;
                    transition: all 0.2s;
                }
                .assistant-send.active { color: var(--accent-primary); }

                .assistant-typing { display: flex; gap: 4px; padding: 4px; }
                .assistant-typing span {
                    width: 6px; height: 6px; background: var(--text-muted); opacity: 0.3;
                    border-radius: 50%; animation: typing 1.4s infinite;
                }
                .assistant-typing span:nth-child(2) { animation-delay: 0.2s; }
                .assistant-typing span:nth-child(3) { animation-delay: 0.4s; }
                @keyframes typing { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }

                .assistant-code { margin-top: 8px; border-radius: 4px; overflow: hidden; font-size: 12px; }
                .assistant-inline-code { background: var(--bg-elevated); padding: 2px 4px; border-radius: 4px; font-family: var(--font-mono); }
                
                .assistant-meta {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 6px;
                }
                .assistant-model {
                    font-size: 10px;
                    opacity: 0.5;
                    font-style: italic;
                }
                .assistant-time {
                    font-size: 10px;
                    opacity: 0.6;
                    text-align: right;
                }
                .assistant-status {
                    font-size: 11px;
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-weight: 500;
                }
                .assistant-status.online {
                    color: #3fb950;
                    background: rgba(63, 185, 80, 0.1);
                }
                .assistant-status.offline {
                    color: #f85149;
                    background: rgba(248, 81, 73, 0.1);
                }

                .assistant-popover {
                    position: absolute; bottom: 80px; left: 16px; right: 16px;
                    background: var(--bg-elevated); border: 1px solid var(--border-primary);
                    border-radius: var(--radius-lg); padding: 16px; z-index: 100;
                    box-shadow: var(--shadow-lg);
                }
                .assistant-popover label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
                .assistant-popover select, .assistant-popover input {
                    width: 100%; padding: 8px; background: var(--bg-primary); 
                    border: 1px solid var(--border-primary); border-radius: var(--radius-sm);
                    color: var(--text-primary); margin-bottom: 12px;
                }

                .assistant-toolbar {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 12px;
                    border-bottom: 1px solid var(--border-primary);
                    flex-wrap: wrap;
                    flex-shrink: 0;
                    background: var(--bg-primary);
                }
                .assistant-feature-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 10px;
                    border-radius: 6px;
                    border: 1px solid var(--border-primary);
                    background: var(--bg-secondary);
                    color: var(--text-secondary);
                    font-size: 11px;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    white-space: nowrap;
                }
                .assistant-feature-btn:hover:not(:disabled) {
                    border-color: var(--accent-primary);
                    color: var(--text-primary);
                    background: var(--bg-elevated);
                    transform: translateY(-1px);
                    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
                }
                .assistant-tools-toggle {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 8px;
                    background: var(--bg-tertiary);
                    border-bottom: 1px solid var(--border-primary);
                    color: var(--accent-primary);
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .assistant-tools-toggle:hover { background: var(--bg-elevated); color: var(--accent-secondary); }
                .assistant-tools-toggle.active { border-bottom: none; }
                .assistant-feature-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .assistant-feature-btn.loading {
                    border-color: var(--accent-primary);
                    animation: featurePulse 1.5s infinite;
                }
                .assistant-feature-btn.clear {
                    background: transparent;
                    color: var(--text-muted);
                    margin-left: auto;
                }
                .assistant-feature-btn.clear:hover { color: var(--error); border-color: var(--error); }
                .feature-icon { font-size: 13px; line-height: 1; }
                .feature-label { font-weight: 500; }
                @keyframes featurePulse { 0%,100%{opacity:1} 50%{opacity:0.6} }

                .assistant-translate-select {
                    padding: 3px 6px;
                    border-radius: 6px;
                    border: 1px solid var(--border-primary);
                    background: var(--bg-tertiary);
                    color: var(--text-secondary);
                    font-size: 10px;
                    cursor: pointer;
                    outline: none;
                }
                .assistant-translate-select:hover { border-color: var(--accent-primary); }

                /* Code Block Styling */
                .assistant-code-block {
                    margin: 12px 0;
                    border: 1px solid var(--border-primary);
                    border-radius: var(--radius-md);
                    overflow: hidden;
                    background: #1e1e1e;
                }
                .assistant-code-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 4px 12px;
                    background: var(--bg-tertiary);
                    border-bottom: 1px solid var(--border-primary);
                    height: 28px;
                }
                .assistant-code-lang {
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: var(--text-muted);
                    letter-spacing: 0.5px;
                }
                .assistant-copy-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: transparent;
                    border: none;
                    color: var(--text-muted);
                    cursor: pointer;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                .assistant-copy-btn:hover { background: var(--bg-primary); color: var(--accent-primary); }
                .assistant-copy-btn.copied { color: #3fb950; }
                .assistant-code { font-size: 12px; line-height: 1.4; }

                /* Category System */
                .assistant-categories {
                    max-height: 200px;
                    overflow-y: auto;
                    border-top: 1px solid var(--border-primary);
                    border-bottom: 1px solid var(--border-primary);
                    background: var(--bg-secondary);
                    flex-shrink: 0;
                }
                .assistant-category-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    width: 100%;
                    padding: 8px 16px;
                    background: transparent;
                    border: none;
                    border-bottom: 1px solid var(--border-primary);
                    color: var(--text-secondary);
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .assistant-category-header:hover { background: var(--bg-tertiary); }
                .assistant-category.expanded .assistant-category-header {
                    background: var(--bg-tertiary);
                    color: var(--accent-primary);
                }
                .assistant-category-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 8px;
                    padding: 12px;
                    background: var(--bg-secondary);
                }
                .assistant-feature-card {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 4px;
                    padding: 10px;
                    border-radius: 8px;
                    border: 1px solid var(--border-primary);
                    background: var(--bg-primary);
                    color: var(--text-primary);
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    text-align: left;
                }
                .assistant-feature-card:hover:not(:disabled) {
                    border-color: var(--accent-primary);
                    background: var(--bg-elevated);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                }
                .card-icon { font-size: 18px; margin-bottom: 2px; }
                .card-label { font-weight: 600; font-size: 12px; }
                .card-desc { font-size: 10px; color: var(--text-muted); line-height: 1.3; }

            `}</style>
        </div>
    );
}

export default LearningPanel;

import React, { useState, useRef, useEffect } from 'react';
import {
    FiSettings, FiX, FiPaperclip, FiSend, FiZap, FiCopy, FiCheck, FiRotateCcw, FiPlay, FiGrid
} from 'react-icons/fi';
import { useFileStore, useUIStore } from '../store';
import { aiService } from '../services/api';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

function LearningPanel({ onBack }) {
    const [query, setQuery] = useState('');
    const [chatHistory, setChatHistory] = useState(() => {
        const saved = localStorage.getItem('roolts_ai_chat_history');
        return saved ? JSON.parse(saved) : [];
    });
    const [isLoading, setIsLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [provider, setProvider] = useState(() => localStorage.getItem('roolts_ai_provider') || 'roolts');
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('roolts_ai_key') || '');

    const { files, activeFileId } = useFileStore();
    const { addNotification, toggleRightPanel, setRightPanelTab } = useUIStore();
    const activeFile = files.find(f => f.id === activeFileId);
    const chatEndRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, isLoading]);

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
            addNotification({ type: 'error', message: 'AI chat failed' });
        }
        setIsLoading(false);
    };

    const quickActions = [
        { label: 'Summarize', query: 'Summarize this code briefly.' },
        { label: 'Explain', query: 'Explain the logic of this file.' },
        { label: 'Optimize', query: 'Suggest performance optimizations.' },
        { label: 'Tamil', query: 'Translate the main comments to Tamil.' }
    ];

    return (
        <div className="assistant-panel">
            {/* Native Header */}
            <header className="assistant-header">
                <div className="assistant-header-left">
                    <FiZap className="assistant-icon" />
                    <span className="assistant-title">AI Assistant</span>
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

            {/* Conversation Area */}
            <div className="assistant-chat-history">
                {chatHistory.map((msg, idx) => (
                    <div key={idx} className={`assistant-bubble-container ${msg.role === 'user' ? 'user' : 'ai'}`}>
                        <div className={`assistant-bubble ${msg.role}`}>
                            <ReactMarkdown
                                components={{
                                    code({ inline, className, children, ...props }) {
                                        const match = /language-(\w+)/.exec(className || '');
                                        return !inline && match ? (
                                            <div className="assistant-code">
                                                <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="pre">
                                                    {String(children).replace(/\n$/, '')}
                                                </SyntaxHighlighter>
                                            </div>
                                        ) : (
                                            <code className="assistant-inline-code" {...props}>{children}</code>
                                        );
                                    }
                                }}
                            >
                                {msg.content}
                            </ReactMarkdown>
                            <span className="assistant-time">{msg.timestamp}</span>
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

                .assistant-time {
                    display: block;
                    font-size: 10px;
                    opacity: 0.6;
                    margin-top: 6px;
                    text-align: right;
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
            `}</style>
        </div>
    );
}

export default LearningPanel;

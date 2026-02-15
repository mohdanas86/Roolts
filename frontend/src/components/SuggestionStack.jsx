import React, { useState } from 'react';
import { FiThumbsUp, FiThumbsDown, FiArrowRight, FiTrash2, FiClock, FiCheck, FiFilter, FiPlusCircle } from 'react-icons/fi';
import { useSuggestionStore, useFileStore, useUIStore } from '../store';
import ReactMarkdown from 'react-markdown';

const SuggestionCard = ({ suggestion, onApply, onRemove, onFeedback }) => {
    const [copied, setCopied] = useState(false);

    const handleApply = () => {
        onApply(suggestion);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`suggestion-card ${suggestion.feedback === 'up' ? 'suggestion-card--liked' : ''}`}>
            <div className="suggestion-card__header">
                <div className="suggestion-card__type">
                    <FiClock size={12} />
                    <span>{new Date(suggestion.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="suggestion-card__feedback">
                    <button
                        className={`btn btn--icon btn--xs ${suggestion.feedback === 'up' ? 'btn--active' : ''}`}
                        onClick={() => onFeedback(suggestion.id, 'up')}
                    >
                        <FiThumbsUp />
                    </button>
                    <button
                        className={`btn btn--icon btn--xs ${suggestion.feedback === 'down' ? 'btn--active' : ''}`}
                        onClick={() => onFeedback(suggestion.id, 'down')}
                    >
                        <FiThumbsDown />
                    </button>
                    <button className="btn btn--icon btn--xs" onClick={() => onRemove(suggestion.id)}><FiTrash2 /></button>
                </div>
            </div>

            <div className="suggestion-card__body">
                <h4 className="suggestion-card__title">{suggestion.title}</h4>
                <div className="suggestion-card__content">
                    <ReactMarkdown>{suggestion.summary || suggestion.content.slice(0, 100) + '...'}</ReactMarkdown>
                </div>
            </div>

            <div className="suggestion-card__footer">
                <button className="btn btn--primary btn--sm btn--full" onClick={handleApply}>
                    {copied ? <><FiCheck /> Applied</> : <><FiArrowRight /> Apply Code</>}
                </button>
            </div>
        </div>
    );
};

function SuggestionStack() {
    const { suggestions, removeSuggestion, updateFeedback, clearHistory } = useSuggestionStore();
    const { activeFileId, updateFileContent } = useFileStore();
    const { addNotification } = useUIStore();
    const [filter, setFilter] = useState('all'); // all, liked

    const filteredSuggestions = suggestions.filter(s => {
        if (filter === 'liked') return s.feedback === 'up';
        return true;
    });

    const handleApply = (suggestion) => {
        if (!activeFileId) return addNotification({ type: 'error', message: 'No active file to apply code' });
        // In a real app, we'd use better insertion logic. 
        // For now, we'll append or overwrite if it's a "gen" type.
        updateFileContent(activeFileId, suggestion.content);
        addNotification({ type: 'success', message: 'Suggestion applied to editor' });
    };

    return (
        <div className="suggestion-stack">
            <div className="suggestion-stack__header">
                <div className="suggestion-stack__filters">
                    <button className={`filter-tab ${filter === 'all' ? 'filter-tab--active' : ''}`} onClick={() => setFilter('all')}>All</button>
                    <button className={`filter-tab ${filter === 'liked' ? 'filter-tab--active' : ''}`} onClick={() => setFilter('liked')}>Liked</button>
                </div>
                {suggestions.length > 0 && (
                    <button className="btn btn--ghost btn--xs" onClick={clearHistory}>Clear All</button>
                )}
            </div>

            <div className="suggestion-stack__list">
                {filteredSuggestions.length === 0 ? (
                    <div className="suggestion-stack__empty">
                        <FiClock size={32} style={{ opacity: 0.2, marginBottom: '12px' }} />
                        <p>No recent suggestions</p>
                    </div>
                ) : (
                    filteredSuggestions.map(s => (
                        <SuggestionCard
                            key={s.id}
                            suggestion={s}
                            onApply={handleApply}
                            onRemove={removeSuggestion}
                            onFeedback={updateFeedback}
                        />
                    ))
                )}
            </div>

            <button className="new-suggestion-fab" onClick={() => window.dispatchEvent(new CustomEvent('open-ai-chat'))}>
                <FiPlusCircle size={20} />
                <span>New Suggestion</span>
            </button>

            <style>{`
                .suggestion-stack {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    padding: 12px;
                    position: relative;
                }
                .suggestion-stack__header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }
                .suggestion-stack__filters {
                    display: flex;
                    gap: 8px;
                    background: rgba(255, 255, 255, 0.05);
                    padding: 2px;
                    border-radius: 6px;
                }
                .filter-tab {
                    background: transparent;
                    border: none;
                    color: var(--text-muted);
                    font-size: 11px;
                    padding: 4px 10px;
                    cursor: pointer;
                    border-radius: 4px;
                    transition: all 0.2s;
                }
                .filter-tab--active {
                    background: var(--bg-secondary);
                    color: white;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                .suggestion-stack__list {
                    flex: 1;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding-bottom: 60px;
                }
                .suggestion-card {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 10px;
                    padding: 12px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .suggestion-card--liked { border-color: var(--accent-color); background: rgba(99, 102, 241, 0.05); }
                .suggestion-card__header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                .suggestion-card__type {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 10px;
                    color: var(--text-muted);
                    text-transform: uppercase;
                }
                .suggestion-card__feedback { display: flex; gap: 4px; }
                .suggestion-card__title {
                    font-size: 13px;
                    font-weight: 600;
                    margin-bottom: 4px;
                    color: white;
                }
                .suggestion-card__content {
                    font-size: 12px;
                    color: var(--text-secondary);
                    max-height: 80px;
                    overflow: hidden;
                    mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
                }
                .suggestion-card__footer { margin-top: 12px; }
                .new-suggestion-fab {
                    position: absolute;
                    bottom: 20px;
                    left: 20px;
                    right: 20px;
                    background: var(--accent-color);
                    color: white;
                    border: none;
                    border-radius: 30px;
                    padding: 10px 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    font-weight: 600;
                    font-size: 13px;
                    cursor: pointer;
                    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
                    transition: all 0.3s;
                    z-index: 10;
                }
                .new-suggestion-fab:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.6);
                }
                .suggestion-stack__empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    opacity: 0.5;
                    font-size: 13px;
                }
            `}</style>
        </div>
    );
}

export default SuggestionStack;

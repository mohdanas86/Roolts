import React, { useState } from 'react';
import { FiSliders, FiCpu, FiMessageCircle, FiType, FiMonitor, FiChevronDown, FiChevronUp, FiPlay } from 'react-icons/fi';
import { useSettingsStore, useUIStore } from '../store';

const Accordion = ({ title, icon, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="accordion">
            <div className="accordion-header" onClick={() => setIsOpen(!isOpen)}>
                <span className="accordion-title">
                    {icon}
                    <span>{title}</span>
                </span>
                {isOpen ? <FiChevronUp /> : <FiChevronDown />}
            </div>
            {isOpen && <div className="accordion-body">{children}</div>}
        </div>
    );
};

function ActionSidebar() {
    const { format, theme, setTheme, updateFormat, experimental } = useSettingsStore();
    const { addNotification } = useUIStore();
    const [aiMode, setAiMode] = useState('agent');

    const promptTemplates = [
        { name: 'Refactor Logic', prompt: 'Refactor this code to be more concise and follow functional programming principles.' },
        { name: 'Add Comments', prompt: 'Add detailed JSDoc/Docstring comments to all functions in this file.' },
        { name: 'Security Check', prompt: 'Scan this code for common vulnerabilities like XSS, SQLi, or Buffer Overflows.' },
        { name: 'Optimize Performance', prompt: 'Analyze this code and suggest optimizations for time and space complexity.' }
    ];

    const [selectedTemplate, setSelectedTemplate] = useState(null);

    return (
        <div className="action-sidebar">
            <Accordion title="Code Style" icon={<FiSliders />} defaultOpen={true}>
                <div className="control-group">
                    <label>Indent Size: {format.tabSize || 4}</label>
                    <input
                        type="range" min="2" max="8" step="2"
                        value={format.tabSize || 4}
                        onChange={(e) => updateFormat({ tabSize: parseInt(e.target.value) })}
                    />
                </div>
                <div className="control-group">
                    <label>Theme</label>
                    <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                        <option value="vs-dark">Dracula Dark</option>
                        <option value="nord">Nord Frost</option>
                        <option value="solarized-light">Solarized Light</option>
                        <option value="hc-black">High Contrast</option>
                    </select>
                </div>
            </Accordion>

            <Accordion title="AI Mode" icon={<FiCpu />}>
                <div className="ai-mode-toggle">
                    <button
                        className={`mode-btn ${aiMode === 'agent' ? 'mode-btn--active' : ''}`}
                        onClick={() => setAiMode('agent')}
                    >
                        <FiCpu />
                        <span>Agent</span>
                    </button>
                    <button
                        className={`mode-btn ${aiMode === 'chat' ? 'mode-btn--active' : ''}`}
                        onClick={() => setAiMode('chat')}
                    >
                        <FiMessageCircle />
                        <span>Chat</span>
                    </button>
                </div>
                <p className="ai-mode-desc">
                    {aiMode === 'agent' ? 'Proactive autonomous help.' : 'Reactive chat-based assistance.'}
                </p>
            </Accordion>

            <Accordion title="Prompt Templates" icon={<FiType />}>
                <div className="template-list">
                    {promptTemplates.map(t => (
                        <div key={t.name} className="template-item">
                            <div className="template-row" onClick={() => setSelectedTemplate(selectedTemplate === t.name ? null : t.name)}>
                                <span>{t.name}</span>
                                <FiPlay className="play-icon" onClick={(e) => {
                                    e.stopPropagation();
                                    window.dispatchEvent(new CustomEvent('open-ai-chat', { detail: t.prompt }));
                                    addNotification({ type: 'info', message: `Executing: ${t.name}` });
                                }} />
                            </div>
                            {selectedTemplate === t.name && (
                                <div className="template-preview">
                                    {t.prompt}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </Accordion>

            <style>{`
                .action-sidebar {
                    padding: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    height: 100%;
                    overflow-y: auto;
                    background: var(--bg-primary); /* Solid background */
                }
                .accordion {
                    background: var(--bg-secondary); /* Solid secondary */
                    border: 1px solid var(--border-primary);
                    border-radius: 4px; /* Less rounded */
                    overflow: hidden;
                    margin-bottom: 4px;
                }
                .accordion-header {
                    padding: 10px 12px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: pointer;
                    user-select: none;
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--text-primary);
                    background: var(--bg-tertiary); /* Solid header */
                }
                .accordion-title { display: flex; align-items: center; gap: 8px; }
                .accordion-body { padding: 12px; border-top: 1px solid var(--border-primary); }
                .control-group { margin-bottom: 12px; }
                .control-group label { display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 6px; }
                .control-group input[type="range"] { width: 100%; accent-color: var(--accent-color); }
                .control-group select {
                    width: 100%;
                    background: var(--bg-primary);
                    color: var(--text-primary);
                    border: 1px solid var(--border-primary);
                    padding: 6px;
                    border-radius: 4px;
                    font-size: 12px;
                }
                .ai-mode-toggle {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 6px;
                    background: var(--bg-primary);
                    padding: 4px;
                    border-radius: 4px;
                    border: 1px solid var(--border-primary);
                }
                .mode-btn {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                    padding: 8px;
                    background: transparent;
                    border: none;
                    color: var(--text-muted);
                    font-size: 11px;
                    cursor: pointer;
                    border-radius: 4px;
                    transition: all 0.2s;
                }
                .mode-btn--active { 
                    background: var(--bg-tertiary); 
                    color: var(--accent-primary); 
                    border: 1px solid var(--border-primary);
                }
                .ai-mode-desc { font-size: 10px; color: var(--text-muted); text-align: center; margin-top: 8px; }
                .template-list { display: flex; flex-direction: column; gap: 4px; }
                .template-item { border-bottom: 1px solid var(--border-primary); }
                .template-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 0;
                    font-size: 12px;
                    cursor: pointer;
                    color: var(--text-secondary);
                }
                .template-row:hover { color: var(--text-primary); }
                .play-icon { color: var(--accent-primary); opacity: 0.6; }
                .play-icon:hover { opacity: 1; transform: scale(1.1); }
                .template-preview {
                    font-size: 10px;
                    color: var(--text-muted);
                    padding: 0 0 8px 0;
                    white-space: pre-wrap;
                }
            `}</style>
        </div>
    );
}

export default ActionSidebar;

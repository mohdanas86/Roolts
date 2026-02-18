import React, { useEffect, useRef } from 'react';
import { FiTerminal, FiX, FiTrash2, FiCopy } from 'react-icons/fi';
import { useTerminalStore } from '../store';

const ExecutionOutputPanel = ({ isVisible, onToggle, height = '100%' }) => {
    const { executionOutput, clearExecutionOutput } = useTerminalStore();
    const outputRef = useRef(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [executionOutput]);

    const copyOutput = () => {
        const text = executionOutput.map(line => line.content).join('\n');
        navigator.clipboard.writeText(text);
    };

    if (!isVisible) return null;

    return (
        <div className="terminal-container" style={{
            height,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-secondary)',
            borderLeft: '1px solid var(--border-color)',
            animation: 'fadeIn 0.3s ease-out'
        }}>
            <div className="terminal-header" style={{
                background: 'rgba(30, 30, 30, 0.7)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
                <div className="terminal-title">
                    <FiTerminal style={{ color: 'var(--accent-color)' }} />
                    <span style={{ fontWeight: '600', letterSpacing: '0.5px' }}>Terminal Output</span>
                </div>
                <div className="terminal-controls">
                    <button className="terminal-control-btn" onClick={clearExecutionOutput} title="Clear Output">
                        <FiTrash2 />
                    </button>
                    <button className="terminal-control-btn" onClick={copyOutput} title="Copy Output">
                        <FiCopy />
                    </button>
                    <button className="terminal-control-btn" onClick={() => onToggle(false)} title="Close">
                        <FiX />
                    </button>
                </div>
            </div>

            <div
                ref={outputRef}
                className="terminal-output-container custom-scrollbar"
                style={{
                    flex: 1,
                    padding: '16px',
                    overflowY: 'auto',
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    backgroundColor: '#0d1117',
                    color: '#e6edf3'
                }}
            >
                {executionOutput.length === 0 && (
                    <div className="empty-state" style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        opacity: 0.4
                    }}>
                        <FiTerminal size={48} style={{ marginBottom: '1rem' }} />
                        <div style={{ fontStyle: 'italic' }}>Waiting for execution...</div>
                    </div>
                )}
                {executionOutput.map((line, index) => (
                    <div
                        key={index}
                        className="output-line"
                        style={{
                            whiteSpace: 'pre-wrap',
                            marginBottom: '6px',
                            padding: '4px 12px',
                            borderRadius: '4px',
                            borderLeft: `3px solid ${line.type === 'error' ? '#f85149' :
                                    line.type === 'info' ? '#388bfd' :
                                        '#3fb950'
                                }`,
                            backgroundColor: line.type === 'error' ? 'rgba(248, 81, 73, 0.1)' :
                                line.type === 'info' ? 'rgba(56, 139, 253, 0.1)' :
                                    'transparent',
                            color: line.type === 'error' ? '#ff7b72' :
                                line.type === 'info' ? '#79c0ff' :
                                    '#e6edf3',
                            animation: 'slideUp 0.2s ease-out forwards'
                        }}
                    >
                        {line.content}
                    </div>
                ))}
            </div>

            <style>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
                .output-line:hover {
                    background-color: rgba(255, 255, 255, 0.03) !important;
                }
            `}</style>
        </div>
    );
};

export default ExecutionOutputPanel;

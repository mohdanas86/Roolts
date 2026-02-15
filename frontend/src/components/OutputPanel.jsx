import React, { useState } from 'react';
import { FiTerminal, FiClock, FiTrash2, FiX, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { useExecutionStore } from '../store';

function OutputPanel() {
    const { output, error, executionTime, isExecuting, clearOutput, history, setShowOutput } = useExecutionStore();
    const [showHistory, setShowHistory] = useState(false);

    return (
        <div className="output-panel">
            <div className="output-panel__header">
                <span className="output-panel__title">
                    <FiTerminal /> Output
                    {executionTime && (
                        <span className="output-panel__time">
                            <FiClock size={12} /> {executionTime}ms
                        </span>
                    )}
                </span>
                <div className="output-panel__actions">
                    <button
                        className="btn btn--ghost btn--icon"
                        onClick={() => setShowHistory(!showHistory)}
                        title="History"
                    >
                        <FiClock />
                    </button>
                    <button
                        className="btn btn--ghost btn--icon"
                        onClick={clearOutput}
                        title="Clear"
                    >
                        <FiTrash2 />
                    </button>
                    <button
                        className="btn btn--ghost btn--icon"
                        onClick={() => setShowOutput(false)}
                        title="Close Output"
                    >
                        <FiX />
                    </button>
                </div>
            </div>

            {showHistory ? (
                <div className="output-panel__history">
                    <h4 style={{ marginBottom: '12px', fontSize: '13px' }}>Execution History</h4>
                    {history.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No execution history yet</p>
                    ) : (
                        history.map((entry) => (
                            <div key={entry.id} className="history-item">
                                <div className="history-item__header">
                                    <span className={`history-item__status ${entry.success ? 'success' : 'error'}`}>
                                        {entry.success ? <FiCheckCircle /> : <FiAlertCircle />}
                                    </span>
                                    <span className="history-item__lang">{entry.language}</span>
                                    <span className="history-item__time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                <div className="output-panel__content">
                    {isExecuting ? (
                        <div className="output-panel__loading">
                            <span className="spinner" /> Running code...
                        </div>
                    ) : error ? (
                        <pre className="output-panel__error">{error}</pre>
                    ) : output ? (
                        <pre className="output-panel__result">{output}</pre>
                    ) : (
                        <div className="output-panel__empty">
                            <FiTerminal size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                            <p>Click "Run" to execute your code</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default OutputPanel;

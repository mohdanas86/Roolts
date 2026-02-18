import React, { useState, useEffect, useRef } from 'react';
import { FiTerminal, FiClock, FiTrash2, FiX, FiCheckCircle, FiAlertCircle, FiSquare } from 'react-icons/fi';
import { useExecutionStore } from '../store';
import { socketService } from '../services/socketService';
import { executorService } from '../services/executorService';

function OutputPanel() {
    const {
        output, error, executionTime, isExecuting,
        clearOutput, history, setShowOutput,
        appendOutput, setExecuting, setError,
        input, setInput, // Use global input state
        isInteractive, setIsInteractive // Use global interactive state
    } = useExecutionStore();
    const [showHistory, setShowHistory] = useState(false);
    // Removed local input/interactive state to persist across tab switches
    const outputContentRef = useRef(null);
    const inputRef = useRef(null);

    // Socket.IO listeners for live execution
    useEffect(() => {
        let stopButtonTimer = null;
        let outputBuffer = "";
        let flushFrameId = null;

        const flushBuffer = () => {
            if (outputBuffer) {
                appendOutput(outputBuffer);
                outputBuffer = "";
            }
            flushFrameId = null;
        };

        const handleExecData = (data) => {
            if (data && data.data) {
                outputBuffer += data.data;

                // Throttle updates to animation frame for smooth rendering (max 60fps)
                if (!flushFrameId) {
                    flushFrameId = requestAnimationFrame(flushBuffer);
                }
            }
        };

        const handleExecStarted = () => {
            setIsInteractive(true);
            setExecuting(true);
        };

        const handleExecFinished = () => {
            // Flush any remaining data immediately
            if (outputBuffer) {
                appendOutput(outputBuffer);
                outputBuffer = "";
            }
            if (flushFrameId) {
                cancelAnimationFrame(flushFrameId);
                flushFrameId = null;
            }

            setIsInteractive(false);
            setExecuting(false);
            if (stopButtonTimer) clearTimeout(stopButtonTimer);
        };

        const handleExecError = (data) => {
            if (outputBuffer) {
                appendOutput(outputBuffer);
                outputBuffer = "";
            }
            if (flushFrameId) cancelAnimationFrame(flushFrameId);

            setError(data.error);
            setIsInteractive(false);
            setExecuting(false);
            if (stopButtonTimer) clearTimeout(stopButtonTimer);
        };

        socketService.on('exec:data', handleExecData);
        socketService.on('exec:started', handleExecStarted);
        socketService.on('exec:finished', handleExecFinished);
        socketService.on('exec:error', handleExecError);

        return () => {
            socketService.off('exec:data', handleExecData);
            socketService.off('exec:started', handleExecStarted);
            socketService.off('exec:finished', handleExecFinished);
            socketService.off('exec:error', handleExecError);
            if (flushFrameId) cancelAnimationFrame(flushFrameId);
        };
    }, []);

    // Auto-scroll to bottom of output
    useEffect(() => {
        if (outputContentRef.current) {
            outputContentRef.current.scrollTop = outputContentRef.current.scrollHeight;
        }
    }, [output]);

    const handleInputSubmit = (e) => {
        e.preventDefault();
        if (isInteractive && input.trim()) {
            executorService.sendInput(input + '\n');
            appendOutput(`> ${input}\n`);
            setInput('');
        }
    };

    const handleStop = () => {
        executorService.stopExecution();
        setIsInteractive(false);
        setExecuting(false);
        appendOutput("\n>>> Execution stopped by user.\n");
    };

    return (
        <div className="output-panel">
            <div className="output-panel__header">
                <span className="output-panel__title">
                    <FiTerminal /> Output Screen
                    {executionTime && (
                        <span className="output-panel__time">
                            <FiClock size={12} /> {executionTime}ms
                        </span>
                    )}
                </span>
                <div className="output-panel__actions">
                    {isExecuting && (
                        <button
                            className="btn btn--ghost btn--icon"
                            onClick={handleStop}
                            title="Stop Execution"
                            style={{ color: 'var(--status-error)' }}
                        >
                            <FiSquare fill="currentColor" size={14} />
                        </button>
                    )}
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

            <div className="output-panel__container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 48px)' }}>
                {showHistory ? (
                    <div className="output-panel__history" style={{ flex: 1, overflowY: 'auto' }}>
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
                    <div className="output-panel__content" ref={outputContentRef} style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                        {isExecuting && !output && (
                            <div className="output-panel__loading">
                                <span className="spinner" /> Initializing execution...
                            </div>
                        )}
                        {error && (
                            <pre className="output-panel__error" style={{ color: 'var(--status-error)', whiteSpace: 'pre-wrap' }}>{error}</pre>
                        )}
                        {output && (
                            <pre className="output-panel__result" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{output}</pre>
                        )}
                        {!isExecuting && !output && !error && (
                            <div className="output-panel__empty">
                                <FiTerminal size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                                <p>Click "Run" to execute your code</p>
                            </div>
                        )}
                    </div>
                )}

                {isInteractive && !showHistory && (
                    <form onSubmit={handleInputSubmit} className="output-panel__input-form" style={{
                        padding: '8px 12px',
                        borderTop: '1px solid var(--border-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        backgroundColor: 'var(--bg-tertiary)'
                    }}>
                        <span style={{ color: 'var(--accent-primary)', fontSize: '12px', fontWeight: 'bold' }}>{'>'}</span>
                        <input
                            ref={inputRef}
                            className="input"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type input and press Enter..."
                            style={{ flex: 1, border: 'none', background: 'transparent' }}
                            autoFocus
                        />
                    </form>
                )}
            </div>
        </div>
    );
}

export default OutputPanel;

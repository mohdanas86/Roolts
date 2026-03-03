import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiTerminal, FiTrash2, FiCopy, FiWifi, FiWifiOff, FiMaximize2, FiMinimize2, FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { io } from 'socket.io-client';
import { useTerminalStore, useExecutionStore } from '../store';

const InteractiveTerminal = ({ height = '100%', isVisible = true }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [inputCmd, setInputCmd] = useState('');
    const [isMaximized, setIsMaximized] = useState(false);
    const outputRef = useRef(null);
    const socketRef = useRef(null);
    const bottomRef = useRef(null);
    const inputFieldRef = useRef(null);

    // Command history
    const commandHistoryRef = useRef([]);
    const historyIndexRef = useRef(-1);

    const executionOutput = useTerminalStore(state => state.executionOutput);
    const addExecutionLine = useTerminalStore(state => state.addExecutionLine);
    const clearExecutionOutput = useTerminalStore(state => state.clearExecutionOutput);
    const actionCommand = useTerminalStore(state => state.actionCommand);
    const setActionCommand = useTerminalStore(state => state.setActionCommand);

    const appendOutput = useExecutionStore(state => state.appendOutput);
    const setGlobalOutput = useExecutionStore(state => state.setOutput);

    // Handle action commands (like 'Run' from editor)
    useEffect(() => {
        if (actionCommand && socketRef.current && isConnected) {
            socketRef.current.emit('terminal:input', { data: actionCommand + '\r\n' });
            setActionCommand(null);
        }
    }, [actionCommand, isConnected, setActionCommand]);

    // Initialize Socket
    useEffect(() => {
        const backendUrl = import.meta.env.VITE_API_URL || window.location.origin;
        const socket = io(backendUrl, {
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            setIsConnected(true);
            socket.emit('terminal:join', {});
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
            addExecutionLine({ type: 'system', content: '\r\n⚠ Disconnected. Reconnecting...\r\n' });
        });

        socket.on('terminal:ready', () => {
            addExecutionLine({ type: 'system', content: '╭──────────────────────────────╮\r\n│   PowerShell Session Ready   │\r\n╰──────────────────────────────╯\r\n' });
        });

        socket.on('terminal:data', (data) => {
            if (data && data.data) {
                addExecutionLine({ type: 'stdout', content: data.data });
                appendOutput(data.data);
            }
        });

        socket.on('terminal:error', (data) => {
            addExecutionLine({ type: 'error', content: `\r\n❌ Error: ${data.message}\r\n` });
            appendOutput(`\r\nError: ${data.message}\r\n`);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    // Auto-scroll logic
    useEffect(() => {
        if (bottomRef.current && isVisible) {
            bottomRef.current.scrollIntoView({ behavior: 'auto' });
        }
    }, [executionOutput, isVisible]);

    // Focus input on click anywhere in terminal
    const handleTerminalClick = () => {
        if (inputFieldRef.current) {
            inputFieldRef.current.focus();
        }
    };

    const handleInputSubmit = (e) => {
        e.preventDefault();
        if (!socketRef.current || !isConnected) return;
        if (!inputCmd.trim()) {
            // Send empty enter to get a new prompt line
            socketRef.current.emit('terminal:input', { data: '\r\n' });
            return;
        }

        // Add to command history
        commandHistoryRef.current.push(inputCmd);
        historyIndexRef.current = commandHistoryRef.current.length; // Reset to end

        socketRef.current.emit('terminal:input', { data: inputCmd + '\r\n' });
        setInputCmd('');
    };

    const handleKeyDown = useCallback((e) => {
        const history = commandHistoryRef.current;
        if (history.length === 0) return;

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyIndexRef.current > 0) {
                historyIndexRef.current--;
                setInputCmd(history[historyIndexRef.current]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndexRef.current < history.length - 1) {
                historyIndexRef.current++;
                setInputCmd(history[historyIndexRef.current]);
            } else {
                historyIndexRef.current = history.length;
                setInputCmd('');
            }
        } else if (e.key === 'l' && e.ctrlKey) {
            // Ctrl+L to clear
            e.preventDefault();
            clearLocalOutput();
        }
    }, []);

    const copyAllOutput = () => {
        const text = executionOutput.map(line => line.content).join('');
        navigator.clipboard.writeText(text);
    };

    const clearLocalOutput = () => {
        clearExecutionOutput();
        setGlobalOutput('');
        if (socketRef.current && isConnected) {
            socketRef.current.emit('terminal:input', { data: 'cls\r\n' });
        }
    };

    const reconnect = () => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current.connect();
        }
    };

    // ANSI parsing is now handled by the store for better performance

    if (!isVisible) return null;

    return (
        <div
            className="terminal-container"
            onClick={handleTerminalClick}
            style={{
                height: isMaximized ? '100vh' : height,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#0c0c0c',
                color: '#cccccc',
                fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
                fontSize: '13px',
                position: isMaximized ? 'fixed' : 'relative',
                inset: isMaximized ? 0 : 'auto',
                zIndex: isMaximized ? 9999 : 'auto',
                overflow: 'hidden'
            }}
        >
            {/* Header */}
            <div className="terminal-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 12px',
                backgroundColor: '#111111',
                borderBottom: '1px solid #2a2a2a',
                minHeight: '32px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <FiTerminal size={14} color="#4dabf7" />
                    <span style={{ fontWeight: 600, color: '#e8e8e8' }}>Terminal</span>
                    <span style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        background: isConnected ? 'rgba(81, 207, 102, 0.15)' : 'rgba(255, 107, 107, 0.15)',
                        color: isConnected ? '#51cf66' : '#ff6b6b',
                        display: 'flex', alignItems: 'center', gap: '3px'
                    }}>
                        {isConnected ? <FiWifi size={10} /> : <FiWifiOff size={10} />}
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                    {!isConnected && (
                        <button
                            className="terminal-control-btn"
                            onClick={reconnect}
                            title="Reconnect"
                            style={btnStyle}
                        >
                            <FiWifi size={13} />
                        </button>
                    )}
                    <button className="terminal-control-btn" onClick={clearLocalOutput} title="Clear (Ctrl+L)" style={btnStyle}>
                        <FiTrash2 size={13} />
                    </button>
                    <button className="terminal-control-btn" onClick={copyAllOutput} title="Copy All" style={btnStyle}>
                        <FiCopy size={13} />
                    </button>
                    <button
                        className="terminal-control-btn"
                        onClick={() => setIsMaximized(!isMaximized)}
                        title={isMaximized ? 'Restore' : 'Maximize'}
                        style={btnStyle}
                    >
                        {isMaximized ? <FiMinimize2 size={13} /> : <FiMaximize2 size={13} />}
                    </button>
                </div>
            </div>

            {/* Output */}
            <div
                ref={outputRef}
                className="terminal-body"
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    padding: '8px 12px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    lineHeight: '1.5',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#333 transparent'
                }}
            >
                {executionOutput.map((entry, i) => {
                    const baseColor = entry.type === 'error' ? '#ff6b6b' :
                        entry.type === 'system' ? '#4dabf7' : '#cccccc';

                    // Stdout lines now come pre-parsed with color parts from the store
                    if (entry.type === 'stdout' && entry.parts) {
                        return (
                            <span key={i}>
                                {entry.parts.map((part, j) => (
                                    <span key={j} style={{ color: part.color }}>{part.text}</span>
                                ))}
                            </span>
                        );
                    }

                    return (
                        <span key={i} style={{ color: baseColor }}>{entry.content}</span>
                    );
                })}

                {/* Input Prompt Area */}
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '2px' }}>
                    <span style={{
                        color: '#51cf66',
                        marginRight: '8px',
                        fontWeight: 600,
                        userSelect: 'none'
                    }}>PS&gt;</span>
                    <form onSubmit={handleInputSubmit} style={{ flex: 1 }}>
                        <input
                            ref={inputFieldRef}
                            type="text"
                            value={inputCmd}
                            onChange={(e) => setInputCmd(e.target.value)}
                            onKeyDown={handleKeyDown}
                            style={{
                                width: '100%',
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                color: '#ffffff',
                                fontFamily: 'inherit',
                                fontSize: 'inherit',
                                caretColor: '#4dabf7'
                            }}
                            autoFocus
                            autoComplete="off"
                            spellCheck="false"
                            placeholder={isConnected ? '' : 'Connecting...'}
                            disabled={!isConnected}
                        />
                    </form>
                </div>
                <div ref={bottomRef} />
            </div>

            <style>{`
                .terminal-body::-webkit-scrollbar { width: 6px; }
                .terminal-body::-webkit-scrollbar-track { background: transparent; }
                .terminal-body::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
                .terminal-body::-webkit-scrollbar-thumb:hover { background: #555; }
            `}</style>
        </div>
    );
};

const btnStyle = {
    background: 'transparent',
    border: '1px solid transparent',
    color: '#888',
    cursor: 'pointer',
    padding: '3px 6px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.15s'
};

export default InteractiveTerminal;

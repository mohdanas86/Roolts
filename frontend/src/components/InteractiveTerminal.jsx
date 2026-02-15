import React, { useState, useEffect, useRef } from 'react';
import { FiTerminal, FiRefreshCw, FiTrash2, FiCopy, FiWifi, FiWifiOff } from 'react-icons/fi';
import { io } from 'socket.io-client';
import { useTerminalStore } from '../store';

const InteractiveTerminal = ({ height = '100%', isVisible = true }) => {
    const [output, setOutput] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [inputCmd, setInputCmd] = useState('');
    const outputRef = useRef(null);
    const socketRef = useRef(null);
    const bottomRef = useRef(null);
    const inputFieldRef = useRef(null);

    const actionCommand = useTerminalStore((state) => state.actionCommand);
    const setActionCommand = useTerminalStore((state) => state.setActionCommand);

    // Handle action commands (like 'Run' from editor)
    useEffect(() => {
        if (actionCommand && socketRef.current && isConnected) {
            socketRef.current.emit('terminal:input', { data: actionCommand + '\r\n' });
            setActionCommand(null);
        }
    }, [actionCommand, isConnected, setActionCommand]);

    // Initialize Socket
    useEffect(() => {
        const socket = io('http://127.0.0.1:5000', {
            transports: ['websocket'],
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            setIsConnected(true);
            socket.emit('terminal:join', {});
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
        });

        socket.on('terminal:ready', () => {
            setOutput(prev => [...prev, { type: 'system', content: 'PowerShell Session Started\r\n' }]);
        });

        socket.on('terminal:data', (data) => {
            if (data && data.data) {
                setOutput(prev => {
                    const newOutput = [...prev];
                    if (newOutput.length > 0 && newOutput[newOutput.length - 1].type === 'stdout') {
                        newOutput[newOutput.length - 1].content += data.data;
                    } else {
                        newOutput.push({ type: 'stdout', content: data.data });
                    }
                    if (newOutput.length > 1000) return newOutput.slice(-1000);
                    return newOutput;
                });
            }
        });

        socket.on('terminal:error', (data) => {
            setOutput(prev => [...prev, { type: 'error', content: `\r\nError: ${data.message}\r\n` }]);
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
    }, [output, isVisible]);

    // Focus input on click anywhere in terminal
    const handleTerminalClick = () => {
        if (inputFieldRef.current) {
            inputFieldRef.current.focus();
        }
    };

    const handleInputSubmit = (e) => {
        e.preventDefault();
        if (!socketRef.current || !isConnected || !inputCmd.trim()) return;

        socketRef.current.emit('terminal:input', { data: inputCmd + '\r\n' });
        setInputCmd('');
    };

    const copyAllOutput = () => {
        const text = output.map(line => line.content).join('');
        navigator.clipboard.writeText(text);
    };

    const clearLocalOutput = () => {
        setOutput([]);
        // We might also want to send 'cls' to the real powershell
        if (socketRef.current && isConnected) {
            socketRef.current.emit('terminal:input', { data: 'cls\r\n' });
        }
    };

    if (!isVisible) return null;

    return (
        <div
            className="terminal-container"
            onClick={handleTerminalClick}
            style={{
                height,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#0c0c0c',
                color: '#cccccc',
                fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
                fontSize: '14px',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            <div className="terminal-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 16px',
                backgroundColor: '#1a1a1a',
                borderBottom: '1px solid #333'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <FiTerminal color="#4dabf7" />
                    <span style={{ fontWeight: 500 }}>PowerShell</span>
                    {isConnected ?
                        <FiWifi size={12} color="#51cf66" title="Connected" /> :
                        <FiWifiOff size={12} color="#ff6b6b" title="Disconnected" />
                    }
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="terminal-control-btn" onClick={clearLocalOutput} title="Clear Terminal">
                        <FiTrash2 size={14} />
                    </button>
                    <button className="terminal-control-btn" onClick={copyAllOutput} title="Copy All">
                        <FiCopy size={14} />
                    </button>
                </div>
            </div>

            <div
                ref={outputRef}
                className="terminal-body"
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '12px',
                    whiteSpace: 'pre-wrap',
                    lineHeight: '1.4'
                }}
            >
                {output.map((entry, i) => (
                    <span
                        key={i}
                        style={{
                            color: entry.type === 'error' ? '#ff6b6b' :
                                entry.type === 'system' ? '#4dabf7' : '#cccccc'
                        }}
                    >
                        {entry.content}
                    </span>
                ))}

                {/* Input Prompt Area */}
                <div style={{ display: 'flex', marginTop: '4px' }}>
                    <span style={{ color: '#51cf66', marginRight: '8px' }}>PS&gt;</span>
                    <form onSubmit={handleInputSubmit} style={{ flex: 1 }}>
                        <input
                            ref={inputFieldRef}
                            type="text"
                            value={inputCmd}
                            onChange={(e) => setInputCmd(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                color: '#ffffff',
                                fontFamily: 'inherit',
                                fontSize: 'inherit'
                            }}
                            autoFocus
                            autoComplete="off"
                            spellCheck="false"
                        />
                    </form>
                </div>
                <div ref={bottomRef} />
            </div>
        </div>
    );
};

export default InteractiveTerminal;

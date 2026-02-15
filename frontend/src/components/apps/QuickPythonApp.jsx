import React, { useState, useEffect, useRef } from 'react';
import { FiTerminal, FiRefreshCw, FiExternalLink, FiMaximize, FiArrowLeft, FiTrash2 } from 'react-icons/fi';

const QuickPythonApp = ({ isWindowed, onPopOut, onOpenNewWindow, onBack }) => {
    const [output, setOutput] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [pyodide, setPyodide] = useState(null);
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    const outputEndRef = useRef(null);
    const inputRef = useRef(null);

    // Load Pyodide
    useEffect(() => {
        let isMounted = true;

        // Define global callback registry if not exists
        if (!window.rooltsPyodideCallbacks) {
            window.rooltsPyodideCallbacks = {
                stdout: null,
                stderr: null
            };
        }

        // Update callbacks to point to current component instance
        window.rooltsPyodideCallbacks.stdout = (text) => {
            if (isMounted) setOutput(prev => [...prev, { type: 'output', content: text }]);
        };
        window.rooltsPyodideCallbacks.stderr = (text) => {
            if (isMounted) setOutput(prev => [...prev, { type: 'error', content: text }]);
        };

        const loadPython = async () => {
            // Case 1: Already initialized globally
            if (window.rooltsPyodide) {
                if (isMounted) {
                    setPyodide(window.rooltsPyodide);
                    setIsLoading(false);
                }
                return;
            }

            try {
                // Safety timeout
                setTimeout(() => {
                    if (isMounted && isLoading && !window.rooltsPyodide) {
                        setOutput(prev => [...prev, { type: 'error', content: 'Initialization timed out. Please try refreshing or check your connection.' }]);
                        setIsLoading(false);
                    }
                }, 15000);

                // Determine if script needs loading
                let scriptLoaded = !!window.loadPyodide;

                if (!scriptLoaded) {
                    if (!document.querySelector('script[src="https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js"]')) {
                        const script = document.createElement('script');
                        script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js";
                        script.async = true;
                        document.body.appendChild(script);
                        await new Promise((resolve, reject) => {
                            script.onload = resolve;
                            script.onerror = () => reject(new Error("Failed to load Pyodide script"));
                        });
                    } else {
                        // Script tag exists but window.loadPyodide might not be ready
                        let attempts = 0;
                        while (!window.loadPyodide && attempts < 100) {
                            await new Promise(r => setTimeout(r, 100));
                            attempts++;
                        }
                        if (!window.loadPyodide) throw new Error("Pyodide script loaded but window.loadPyodide not found.");
                    }
                }

                // Initialize Pyodide (Runs only once per session)
                if (!window.rooltsPyodide) {
                    const py = await window.loadPyodide({
                        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/",
                        stdout: (text) => {
                            if (window.rooltsPyodideCallbacks.stdout) {
                                window.rooltsPyodideCallbacks.stdout(text);
                            }
                        },
                        stderr: (text) => {
                            if (window.rooltsPyodideCallbacks.stderr) {
                                window.rooltsPyodideCallbacks.stderr(text);
                            }
                        }
                    });

                    window.rooltsPyodide = py;

                    if (isMounted) {
                        setPyodide(py);
                        setIsLoading(false);
                        setOutput(prev => [...prev,
                        { type: 'system', content: `Python ${py.runPython('import sys; sys.version').split('[')[0]}` },
                        { type: 'system', content: 'Type "help", "copyright", "credits" or "license" for more information.' }
                        ]);
                    }
                } else {
                    if (isMounted) {
                        setPyodide(window.rooltsPyodide);
                        setIsLoading(false);
                    }
                }

            } catch (err) {
                if (isMounted) {
                    setOutput(prev => [...prev, { type: 'error', content: `Failed to load Python: ${err.message}` }]);
                    setIsLoading(false);
                }
            }
        };

        loadPython();

        return () => {
            isMounted = false;
        };
    }, []);

    // Auto-scroll
    useEffect(() => {
        outputEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [output]);

    const handleRun = async (cmd) => {
        if (!cmd.trim()) {
            setOutput(prev => [...prev, { type: 'command', content: '' }]);
            return;
        }

        // Add to output
        setOutput(prev => [...prev, { type: 'command', content: cmd }]);

        // Add to history
        const newHistory = [...history, cmd];
        setHistory(newHistory);
        setHistoryIndex(newHistory.length);

        if (!pyodide) {
            setOutput(prev => [...prev, { type: 'error', content: 'Python is not ready yet.' }]);
            return;
        }

        try {
            // Check if it's an expression or statement
            // We want to print the result if it's an expression (like REPL)
            // A simple heuristic is to try evaluating it. 
            // However, pyodide.runPython returns the result of the last expression.
            const result = await pyodide.runPythonAsync(cmd);
            if (result !== undefined) {
                setOutput(prev => [...prev, { type: 'result', content: String(result) }]);
            }
        } catch (err) {
            // Format error nicely
            const errorMsg = err.toString().split('PythonError: Traceback (most recent call last):')[1] || err.toString();
            setOutput(prev => [...prev, { type: 'error', content: errorMsg.trim() }]);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleRun(input);
            setInput('');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setInput(history[newIndex]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex < history.length - 1) {
                const newIndex = historyIndex + 1;
                setHistoryIndex(newIndex);
                setInput(history[newIndex]);
            } else {
                setHistoryIndex(history.length);
                setInput('');
            }
        } else if (e.key === 'l' && e.ctrlKey) {
            e.preventDefault();
            setOutput([]);
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: '#1e1e1e',
            color: '#d4d4d4',
            borderRadius: isWindowed ? '0' : '16px', // Rounded if embedded
            overflow: 'hidden',
            fontFamily: 'Consolas, "Courier New", monospace',
            fontSize: '14px'
        }}>
            {/* Header */}
            <div style={{
                padding: '10px 15px',
                backgroundColor: '#252526',
                borderBottom: '1px solid #333',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {!isWindowed && onBack && (
                        <button onClick={onBack} className="btn btn--ghost btn--icon" title="Back">
                            <FiArrowLeft color="#ccc" />
                        </button>
                    )}
                    <FiTerminal color="#FFD43B" /> {/* Python Yellow/Blueish */}
                    <span style={{ fontWeight: 600 }}>Quick Python</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setOutput([])} className="btn btn--ghost btn--icon" title="Clear Console (Ctrl+L)">
                        <FiTrash2 size={14} color="#ccc" />
                    </button>
                    {!isWindowed && (
                        <>
                            <button onClick={onPopOut} className="btn btn--ghost btn--icon" title="Pop Out">
                                <FiExternalLink size={14} color="#ccc" />
                            </button>
                            <button onClick={onOpenNewWindow} className="btn btn--ghost btn--icon" title="Open in New Window">
                                <FiMaximize size={14} color="#ccc" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Terminal Area */}
            <div
                style={{ flex: 1, padding: '15px', overflowY: 'auto', cursor: 'text', position: 'relative' }}
                onClick={() => inputRef.current?.focus()}
            >
                {isLoading && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(30, 30, 30, 0.9)',
                        zIndex: 10
                    }}>
                        <FiRefreshCw className="pulsing" size={24} color="#FFD43B" style={{ marginBottom: '15px' }} />
                        <div style={{ color: '#aaa', fontStyle: 'italic' }}>
                            Initializing Python Environment...
                        </div>
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '5px' }}>
                            (Downloads Pyodide engine once)
                        </div>
                        <button
                            onClick={() => setIsLoading(false)}
                            style={{
                                marginTop: '15px',
                                background: 'transparent',
                                border: '1px solid #555',
                                color: '#aaa',
                                padding: '5px 10px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            Cancel / Force Start
                        </button>
                    </div>
                )}

                {output.map((line, i) => (
                    <div key={i} style={{
                        marginBottom: '4px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        color: line.type === 'error' ? '#f44336' :
                            line.type === 'command' ? '#d4d4d4' :
                                line.type === 'result' ? '#a5d6a7' : '#d4d4d4'
                    }}>
                        {line.type === 'command' && <span style={{ color: '#569cd6', marginRight: '8px' }}>&gt;&gt;&gt;</span>}
                        {line.content}
                    </div>
                ))}

                {/* Input Line */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ color: '#569cd6', marginRight: '8px' }}>&gt;&gt;&gt;</span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading}
                        style={{
                            flex: 1,
                            backgroundColor: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: '#d4d4d4',
                            fontFamily: 'inherit',
                            fontSize: 'inherit'
                        }}
                        autoFocus
                    />
                </div>
                <div ref={outputEndRef} />
            </div>
        </div>
    );
};

export default QuickPythonApp;

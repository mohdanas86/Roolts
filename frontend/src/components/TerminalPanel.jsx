import React, { useState, useEffect, useRef } from 'react';
import { FiTerminal, FiCopy, FiTrash2 } from 'react-icons/fi';
import { useTerminalStore, useUIStore } from '../store';
import { terminalService } from '../services/terminalService';

function TerminalPanel() {
    const { lines, commandHistory, cwd, isRunning, addLine, addCommand, setCwd, setRunning, clearTerminal, getFromHistory } = useTerminalStore();
    const { addNotification } = useUIStore();
    const [input, setInput] = useState('');
    const terminalRef = useRef(null);
    const inputRef = useRef(null);

    // Initialize cwd on mount
    useEffect(() => {
        const initCwd = async () => {
            const currentCwd = await terminalService.getCwd();
            if (currentCwd) setCwd(currentCwd);
        };
        initCwd();
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [lines]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const command = input.trim();
        if (!command) return;

        // Add command to history and display
        addCommand(command);
        addLine({ type: 'command', content: command, cwd });
        setInput('');
        setRunning(true);

        // Handle clear command locally
        if (command.toLowerCase() === 'clear' || command.toLowerCase() === 'cls') {
            clearTerminal();
            setRunning(false);
            return;
        }

        // Handle copy command locally
        if (command.toLowerCase() === 'copy') {
            copyTerminal();
            setRunning(false);
            return;
        }

        try {
            const result = await terminalService.execute(command);

            if (result.output) {
                addLine({ type: 'output', content: result.output });
            }
            if (result.error) {
                addLine({ type: 'error', content: result.error });
            }
            if (result.cwd) {
                setCwd(result.cwd);
            }
        } catch (error) {
            addLine({ type: 'error', content: `Error: ${error.message}` });
        }

        setRunning(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const cmd = getFromHistory('up');
            setInput(cmd || '');
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const cmd = getFromHistory('down');
            setInput(cmd || '');
        }
    };

    const getShortCwd = (fullCwd) => {
        if (!fullCwd) return 'PS>';
        const parts = fullCwd.split('\\');
        return parts.length > 2 ? `...\\${parts.slice(-2).join('\\')}` : fullCwd;
    };

    const copyTerminal = () => {
        const text = lines.map(line => {
            if (line.type === 'command') return `PS ${line.cwd}> ${line.content}`;
            return line.content;
        }).join('\n');
        navigator.clipboard.writeText(text);
        addNotification({ type: 'success', message: 'Terminal output copied to clipboard' });
    };

    const handleTerminalClick = () => {
        if (!window.getSelection().toString()) {
            inputRef.current?.focus();
        }
    };

    return (
        <div className="terminal-panel">
            <div className="terminal-header">
                <FiTerminal size={14} />
                <span>PowerShell</span>
                <button
                    className="btn btn--ghost btn--icon"
                    onClick={copyTerminal}
                    title="Copy All Output"
                >
                    <FiCopy size={14} />
                </button>
                <button
                    className="btn btn--ghost btn--icon"
                    onClick={clearTerminal}
                    title="Clear Terminal"
                    style={{ marginLeft: 'auto' }}
                >
                    <FiTrash2 size={14} />
                </button>
            </div>
            <div className="terminal-output" ref={terminalRef} onClick={handleTerminalClick}>
                {lines.map((line, index) => (
                    <div key={index} className={`terminal-line terminal-line--${line.type}`}>
                        {line.type === 'command' && (
                            <span className="terminal-prompt">PS {getShortCwd(line.cwd)}{'>'} </span>
                        )}
                        <span className="terminal-content">{line.content}</span>
                    </div>
                ))}
                {isRunning && (
                    <div className="terminal-line terminal-line--system">
                        <span className="spinner" style={{ width: '12px', height: '12px' }} /> Running...
                    </div>
                )}
            </div>
            <form className="terminal-input-form" onSubmit={handleSubmit}>
                <span className="terminal-prompt">PS {getShortCwd(cwd)}{'>'}</span>
                <input
                    ref={inputRef}
                    type="text"
                    className="terminal-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type command..."
                    disabled={isRunning}
                    autoFocus
                />
            </form>
        </div>
    );
}

export default TerminalPanel;

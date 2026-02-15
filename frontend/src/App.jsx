import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import {
    FiPlus, FiUploadCloud, FiSave, FiSettings, FiChevronLeft, FiChevronRight,
    FiPlay, FiTerminal, FiCode, FiX, FiCheckCircle, FiAlertCircle
} from 'react-icons/fi';
import {
    useUIStore, useFileStore, useExecutionStore,
    useNotesStore, useSettingsStore
} from './store';
import { collaborationService } from './services/collaborationService';

import { executorService } from './services/executorService';

// Refactored Components
import FileExplorer from './components/FileExplorer';
import EditorTabs from './components/EditorTabs';
import CodeEditor from './components/CodeEditor';
import TerminalPanel from './components/TerminalPanel';
import RightPanel from './components/RightPanel';
import StatusBar from './components/StatusBar';
import Notifications from './components/Notifications';
import SyncManager from './components/SyncManager';
import ActivityBar from './components/ActivityBar';
import GitPanel from './components/GitPanel';

// Lazy loaded modals
const SettingsModal = lazy(() => import('./components/SettingsModal.jsx'));
const NewFileModal = lazy(() => import('./components/NewFileModal.jsx'));

// Utility Components
import RemoteControlOverlay from './components/RemoteControlOverlay';

// Logic helpers
const detectInputRequirement = (code, language) => {
    if (!code) return false;
    const c = code;
    switch (language) {
        case 'python': return /\binput\s*\(/.test(c);
        case 'java': return /Scanner\s*\(System\.in\)/.test(c) || /Console\.readLine/.test(c) || /BufferedReader.*InputStreamReader/.test(c);
        case 'javascript': return /readline/.test(c) || /process\.stdin/.test(c) || /prompt\s*\(/.test(c);
        case 'c':
        case 'cpp': return /scanf/.test(c) || /cin\s*>>/.test(c) || /getline/.test(c) || /gets/.test(c);
        case 'go': return /fmt\.Scan/.test(c) || /fmt\.Fscan/.test(c) || /reader\.ReadString/.test(c);
        default: return false;
    }
};

function InputRequestModal({ isOpen, onSubmit, onCancel }) {
    const [inputVal, setInputVal] = useState('');
    if (!isOpen) return null;
    return (
        <div className="modal-overlay">
            <div className="modal" style={{ width: '400px' }}>
                <div className="modal__header">
                    <h3 className="modal__title">Program Input Required</h3>
                    <button className="btn btn--ghost btn--icon" onClick={onCancel}><FiX /></button>
                </div>
                <div className="modal__body">
                    <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '13px' }}>
                        This program requires input. Enter values below (one per line).
                    </p>
                    <textarea
                        className="input"
                        value={inputVal}
                        onChange={(e) => setInputVal(e.target.value)}
                        placeholder="Enter input..."
                        style={{ minHeight: '100px', fontSize: '14px', fontFamily: 'var(--font-mono)' }}
                        autoFocus
                    />
                </div>
                <div className="modal__footer">
                    <button className="btn btn--secondary" onClick={onCancel}>Cancel</button>
                    <button className="btn btn--primary" onClick={() => onSubmit(inputVal)}>Run Program</button>
                </div>
            </div>
        </div>
    );
}

function HighlightModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [data, setData] = useState(null);
    const { addHighlight, activeFileId, files } = useFileStore();

    useEffect(() => {
        const handleOpen = (e) => { setIsOpen(true); setData(e.detail); };
        window.addEventListener('open-highlight-modal', handleOpen);
        return () => window.removeEventListener('open-highlight-modal', handleOpen);
    }, []);

    if (!isOpen || !data) return null;

    const handleSelectColor = (color) => {
        if (data && data.selection) {
            const highlight = { id: Date.now().toString(), color: color, range: data.selection };
            addHighlight(data.fileId || activeFileId, highlight);
        }
        setIsOpen(false);
        setData(null);
    };

    const colors = [
        { name: 'yellow', bg: '#fef3c7', text: '#92400e' },
        { name: 'green', bg: '#d1fae5', text: '#065f46' },
        { name: 'blue', bg: '#dbeafe', text: '#1e40af' },
        { name: 'pink', bg: '#fce7f3', text: '#9d174d' },
        { name: 'red', bg: '#fee2e2', text: '#991b1b' },
        { name: 'purple', bg: '#f3e8ff', text: '#6b21a8' }
    ];

    return (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
            <div className="modal highlight-modal animate-fade-in-up" onClick={(e) => e.stopPropagation()} style={{ width: '320px', padding: '24px' }}>
                <div className="modal__header" style={{ marginBottom: '20px' }}>
                    <h3 className="modal__title" style={{ fontSize: '1.2rem', fontWeight: 700 }}>Choose Marker</h3>
                    <button className="btn btn--ghost btn--icon" onClick={() => setIsOpen(false)}><FiX /></button>
                </div>
                <div className="modal__body" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    {colors.map(c => (
                        <button
                            key={c.name}
                            className="color-picker-btn"
                            style={{
                                background: c.bg,
                                color: c.text,
                                border: `1px solid ${c.text}22`,
                                padding: '16px 8px',
                                borderRadius: '12px',
                                fontWeight: 600,
                                fontSize: '12px',
                                textTransform: 'capitalize',
                                transition: 'transform 0.2s',
                                cursor: 'pointer'
                            }}
                            onClick={() => handleSelectColor(c.name)}
                            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            {c.name}
                        </button>
                    ))}
                </div>
                <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                    <FiAlertCircle style={{ marginRight: '4px' }} />
                    Tip: Right-click any highlighted area to remove it.
                </div>
            </div>
        </div>
    );
}


function App() {
    const {
        sidebarOpen, toggleSidebar, openModal, addNotification, editorMinimized, toggleEditorMinimized,
        rightPanelOpen, toggleRightPanel, setRightPanelTab, rightPanelWidth, setRightPanelWidth, lastOpenWidth, setLastOpenWidth,
        isResizing, setIsResizing
    } = useUIStore();
    const { files, activeFileId, removeLastDrawing, clearDrawings, markFileSaved } = useFileStore();
    const {
        isExecuting, setExecuting, setOutput, setError, setExecutionTime,
        addToHistory, setShowOutput, inputRequestOpen, setInputRequestOpen, setInput
    } = useExecutionStore();

    const { theme, backgroundImage, backgroundOpacity, uiFontSize, uiFontFamily, experimental } = useSettingsStore();

    const [terminalOpen, setTerminalOpen] = useState(false);
    const [isController, setIsController] = useState(false);
    const [isBeingControlled, setIsBeingControlled] = useState(false);
    const [isScribbleMode, setIsScribbleMode] = useState(false);
    const [scribbleTool, setScribbleTool] = useState('pen');
    const [scribbleColor, setScribbleColor] = useState('#ff0000');

    const [terminalHeight, setTerminalHeight] = useState(250);
    const mainRef = useRef(null);

    const activeFile = files.find(f => f.id === activeFileId);

    // Sidebar View State
    const [activeView, setActiveView] = useState('explorer');

    const handleActivityClick = (viewId) => {
        if (activeView === viewId) {
            // Toggle sidebar if clicking active view
            toggleSidebar();
        } else {
            // Switch view and ensure sidebar is open
            setActiveView(viewId);
            if (!sidebarOpen) toggleSidebar();
        }
    };

    // Initial setup and OAuth callbacks
    useEffect(() => {
        // Theme application
        document.body.classList.remove('theme-light', 'theme-nord', 'theme-dracula', 'theme-solarized-light');
        if (theme !== 'vs-dark') document.body.classList.add(`theme-${theme}`);

        document.documentElement.style.fontSize = `${uiFontSize}px`;
        if (uiFontFamily) document.documentElement.style.setProperty('--font-sans', uiFontFamily);

        if (backgroundImage && experimental?.customBackground) {
            document.body.style.backgroundImage = `url(${backgroundImage})`;
            document.body.classList.add('has-bg-image');
        } else {
            document.body.style.backgroundImage = '';
            document.body.classList.remove('has-bg-image');
        }
        document.documentElement.style.setProperty('--bg-opacity', (backgroundOpacity && experimental?.customBackground) ? backgroundOpacity : 0.85);
    }, [theme, uiFontSize, uiFontFamily, backgroundImage, backgroundOpacity, experimental]);

    // Resizing logic
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing || !mainRef.current) return;
            const mainRect = mainRef.current.getBoundingClientRect();
            if (isResizing === 'right') {
                const newWidth = Math.max(200, Math.min(1200, mainRect.right - e.clientX));
                setRightPanelWidth(newWidth);
                setLastOpenWidth(newWidth);
            } else if (isResizing === 'terminal') {
                const wrapper = mainRef.current.querySelector('.editor-terminal-wrapper');
                if (wrapper) setTerminalHeight(Math.max(100, Math.min(500, wrapper.getBoundingClientRect().bottom - e.clientY)));
            }
        };
        const handleMouseUp = () => setIsResizing(null);
        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    const handleRunCode = useCallback(async () => {
        if (!activeFile) return addNotification({ type: 'error', message: 'No file selected' });

        const isWeb = activeFile.language === 'html' ||
            (activeFile.language === 'javascript' && (activeFile.content.includes('import React') || activeFile.name.endsWith('.jsx')));

        if (isWeb) {
            if (!rightPanelOpen) toggleRightPanel();
            setRightPanelTab('preview');
            return;
        }

        // Input detection disabled per user request
        /*
        const needsInput = detectInputRequirement(activeFile.content, activeFile.language);
        if (needsInput && !useExecutionStore.getState().input) {
            setInputRequestOpen(true);
            return;
        }
        */

        setExecuting(true);
        setOutput('');
        setError(null);
        const startTime = Date.now();

        try {
            const { input } = useExecutionStore.getState();
            const result = await executorService.execute(activeFile.content, activeFile.language, activeFile.name, input);
            setExecutionTime(Date.now() - startTime);
            setShowOutput(true);

            if (result.success) {
                setOutput(result.output || 'Done (no output)');
                addToHistory({ success: true, language: activeFile.language, output: result.output });
            } else {
                setError(result.error);
                addToHistory({ success: false, language: activeFile.language, error: result.error });
            }
        } catch (e) {
            setError(e.message);
        }
        setExecuting(false);
    }, [activeFile, rightPanelOpen, toggleRightPanel, setRightPanelTab, setExecuting, setOutput, setError, setExecutionTime, setShowOutput, addToHistory, addNotification]);

    const handleSaveAs = useCallback(() => {
        if (!activeFile) return;
        const blob = new Blob([activeFile.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = activeFile.name; a.click();
        URL.revokeObjectURL(url);
        markFileSaved(activeFileId);
        addNotification({ type: 'success', message: `Saved ${activeFile.name}` });
    }, [activeFile, activeFileId, markFileSaved, addNotification]);

    return (
        <div className="app">
            <header className="header">
                <div className="header__brand"><div className="header__logo">R</div><h1 className="header__title">Roolts</h1></div>
                <div className="header__actions">
                    <button className="btn btn--success" onClick={handleRunCode} disabled={isExecuting}>
                        {isExecuting ? <span className="spinner" /> : <FiPlay />} Run
                    </button>
                    <button className="btn btn--ghost btn--icon" onClick={handleSaveAs}><FiSave /></button>
                    <button className="btn btn--ghost btn--icon" onClick={() => openModal('newFile')}><FiPlus /></button>
                    <button className="btn btn--ghost btn--icon" onClick={() => openModal('settings')}><FiSettings /></button>
                </div>
            </header>

            <main className={`main ${editorMinimized ? 'main--editor-minimized' : ''}`} ref={mainRef}>
                <aside className="sidebar-container">
                    <ActivityBar activeView={activeView} onActivityClick={handleActivityClick} onSettingsClick={() => openModal('settings')} />
                    {sidebarOpen && (
                        <div className="sidebar-panel">
                            <div className="sidebar__header">
                                <span className="sidebar__title">{activeView.toUpperCase()}</span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button className="btn btn--ghost btn--icon" onClick={toggleSidebar}><FiChevronLeft /></button>
                                </div>
                            </div>
                            <div className="sidebar-content">
                                {activeView === 'explorer' && <FileExplorer />}
                                {activeView === 'git' && <GitPanel />}
                            </div>
                            {/* Terminal Toggle moved to Status Bar or kept in panel? Keeping relevant to panel for now if needed, but VS Code usually has terminal at bottom globally. 
                                The old sidebar had a terminal toggle. Let's keep it in the sidebar footer for now if user wants it there, or rely on bottom panel toggle.
                            */}
                        </div>
                    )}
                </aside>

                <div className="editor-terminal-wrapper">
                    <div className={`editor-container ${terminalOpen ? 'editor-container--with-terminal' : ''}`}>
                        <EditorTabs
                            isScribbleMode={isScribbleMode}
                            toggleScribbleMode={() => setIsScribbleMode(!isScribbleMode)}
                            scribbleTool={scribbleTool} setScribbleTool={setScribbleTool}
                            scribbleColor={scribbleColor} setScribbleColor={setScribbleColor}
                            onUndo={() => removeLastDrawing(activeFileId)} onClear={() => clearDrawings(activeFileId)}
                        />
                        <CodeEditor
                            isScribbleMode={isScribbleMode}
                            scribbleTool={scribbleTool}
                            scribbleColor={scribbleColor}
                            rightPanelWidth={rightPanelWidth}
                            terminalHeight={terminalHeight}
                            terminalOpen={terminalOpen}
                        />
                    </div>
                    {terminalOpen && (
                        <>
                            <div className="resize-handle resize-handle--vertical" onMouseDown={() => setIsResizing('terminal')} />
                            <div className="terminal-bottom-panel" style={{ height: terminalHeight }}>
                                <div className="terminal-panel-header">
                                    <div className="terminal-panel-tabs"><button className="terminal-panel-tab terminal-panel-tab--active"><FiTerminal size={14} /> Terminal</button></div>
                                    <button className="btn btn--ghost btn--icon" onClick={() => setTerminalOpen(false)}><FiX size={14} /></button>
                                </div>
                                <TerminalPanel />
                            </div>
                        </>
                    )}
                </div>

                <div className="resize-handle resize-handle--horizontal" onMouseDown={() => setIsResizing('right')} />
                <RightPanel style={{ width: rightPanelWidth }} editorMinimized={editorMinimized} />
            </main>

            <StatusBar terminalOpen={terminalOpen} setTerminalOpen={setTerminalOpen} />
            <Suspense fallback={null}>
                <SettingsModal />
                <NewFileModal />
            </Suspense>
            <HighlightModal />

            <SyncManager />
            <Notifications />
            <RemoteControlOverlay isController={isController} isBeingControlled={isBeingControlled} />
        </div>
    );
}

export default App;



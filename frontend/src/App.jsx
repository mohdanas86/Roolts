import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import {
    FiPlus, FiUploadCloud, FiSave, FiSettings, FiChevronLeft, FiChevronRight,
    FiTerminal, FiCode, FiX, FiCheckCircle, FiAlertCircle, FiSidebar, FiFolder, FiUser,
    FiMaximize2, FiMinimize2, FiExternalLink, FiMessageSquare, FiZap, FiImage, FiGrid
} from 'react-icons/fi';
import {
    useUIStore, useFileStore, useSettingsStore
} from './store';
import { collaborationService } from './services/collaborationService';
import { authService } from './services/authService';
import { audioManager } from './services/audioManager';

// Refactored Components
import FileExplorer from './components/FileExplorer';
import EditorTabs from './components/EditorTabs';
import CodeEditor from './components/CodeEditor';
import TerminalPanel from './components/TerminalPanel';
import RightPanel from './components/RightPanel';
import StatusBar from './components/StatusBar';
import Notifications from './components/Notifications';
import SyncManager from './components/SyncManager';
import RemoteControlOverlay from './components/RemoteControlOverlay';
import ActivityBar from './components/ActivityBar';
import { StickerOverlay, StickerUploadButton } from './components/StickerOverlay';

// Lazy loaded modals
const SettingsModal = lazy(() => import('./components/SettingsModal.jsx'));
const NewFileModal = lazy(() => import('./components/NewFileModal.jsx'));
const AuthModal = lazy(() => import('./components/AuthModal.jsx'));

// Utility Components

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
    // ── Standalone View Logic ────────────────────────
    const urlParams = new URLSearchParams(window.location.search);
    const isTerminalView = urlParams.get('view') === 'terminal';

    const {
        sidebarOpen, toggleSidebar, openModal, addNotification,
        editorMinimized, rightPanelOpen, toggleRightPanel, rightPanelTab,
        setRightPanelTab, toggleRightPanelApp, rightPanelWidth, setRightPanelWidth,
        setLastOpenWidth, isResizing, setIsResizing, openApps, closeApp, openApp
    } = useUIStore(state => ({
        sidebarOpen: state.sidebarOpen,
        toggleSidebar: state.toggleSidebar,
        openModal: state.openModal,
        addNotification: state.addNotification,
        editorMinimized: state.editorMinimized,
        rightPanelOpen: state.rightPanelOpen,
        toggleRightPanel: state.toggleRightPanel,
        rightPanelTab: state.rightPanelTab,
        setRightPanelTab: state.setRightPanelTab,
        toggleRightPanelApp: state.toggleRightPanelApp,
        rightPanelWidth: state.rightPanelWidth,
        setRightPanelWidth: state.setRightPanelWidth,
        setLastOpenWidth: state.setLastOpenWidth,
        isResizing: state.isResizing,
        setIsResizing: state.setIsResizing,
        openApps: state.openApps,
        closeApp: state.closeApp,
        openApp: state.openApp
    }), (a, b) => Object.keys(a).every(k => a[k] === b[k]));

    const activeFileId = useFileStore(state => state.activeFileId);
    const removeLastDrawing = useFileStore(state => state.removeLastDrawing);
    const clearDrawings = useFileStore(state => state.clearDrawings);
    const markFileSaved = useFileStore(state => state.markFileSaved);
    const addSticker = useFileStore(state => state.addSticker);
    const updateSticker = useFileStore(state => state.updateSticker);
    const removeSticker = useFileStore(state => state.removeSticker);

    const activeFile = useFileStore(
        state => state.files.find(f => f.id === state.activeFileId),
        (a, b) => a?.id === b?.id && a?.name === b?.name && a?.stickers?.length === b?.stickers?.length
    );


    const {
        theme, backgroundImage, backgroundOpacity, uiFontSize,
        uiFontFamily, features, experimental
    } = useSettingsStore(state => ({
        theme: state.theme,
        backgroundImage: state.backgroundImage,
        backgroundOpacity: state.backgroundOpacity,
        uiFontSize: state.uiFontSize,
        uiFontFamily: state.uiFontFamily,
        features: state.features,
        experimental: state.experimental
    }), (a, b) => Object.keys(a).every(k => a[k] === b[k]));

    const [terminalOpen, setTerminalOpen] = useState(false);
    const [terminalMaximized, setTerminalMaximized] = useState(false);
    const [isController, setIsController] = useState(false);
    const [isBeingControlled, setIsBeingControlled] = useState(false);
    const [isScribbleMode, setIsScribbleMode] = useState(false);
    const [scribbleTool, setScribbleTool] = useState('pen');
    const [scribbleColor, setScribbleColor] = useState('#ff0000');

    const [terminalHeight, setTerminalHeight] = useState(250);
    const mainRef = useRef(null);

    // activeFile derived above via selector

    const [activeView, setActiveView] = useState('explorer');

    // Global Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // F5 - Run Program
            if (e.key === 'F5') {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent('run-program'));
                return;
            }
            // Alt + T - Toggle Terminal
            if (e.altKey && (e.key === 't' || e.key === 'T')) {
                e.preventDefault();
                setTerminalOpen(prev => !prev);
                return;
            }
            // Alt + X - Toggle Sidebar
            if (e.altKey && (e.key === 'x' || e.key === 'X')) {
                e.preventDefault();
                useUIStore.getState().toggleSidebar();
                return;
            }
            // Alt + M - Toggle Terminal Maximize
            if (e.altKey && (e.key === 'm' || e.key === 'M')) {
                e.preventDefault();
                setTerminalMaximized(prev => !prev);
                return;
            }

            // Typing Sounds
            const excludedKeys = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Escape', 'GroupPrevious', 'GroupNext'];
            if (!excludedKeys.includes(e.key)) {
                const soundType = useSettingsStore.getState().typingSound;
                if (soundType && soundType !== 'none') {
                    audioManager.playTypingSound(soundType);
                }
            }
        };
        // Use capture: true to ensure we catch events before Monaco or other components intercept them
        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, []);

    // Initial setup and OAuth callbacks
    useEffect(() => {
        // Force reset Dracula theme if it was selected
        useSettingsStore.getState().resetDracula();

        // Theme application
        document.body.classList.remove('theme-light', 'theme-nord', 'theme-dracula', 'theme-solarized-light');
        if (theme !== 'vs-dark') document.body.classList.add(`theme-${theme}`);

        document.documentElement.style.fontSize = `${uiFontSize}px`;
        if (uiFontFamily) document.documentElement.style.setProperty('--font-sans', uiFontFamily);



        document.documentElement.style.setProperty('--bg-opacity', (backgroundOpacity && features?.customBackground) ? backgroundOpacity : 0.85);
    }, [theme, uiFontSize, uiFontFamily, backgroundOpacity, features]);

    // Google Auth Popup Listener
    useEffect(() => {
        const handleAuthMessage = async (event) => {
            if (event.data?.type === 'google-auth-success' && event.data?.code) {
                try {
                    await authService.googleCallback(event.data.code);
                    addNotification({ type: 'success', message: 'Google Account Connected!' });
                } catch (error) {
                    addNotification({ type: 'error', message: 'Failed to connect Google account' });
                }
            }
        };

        window.addEventListener('message', handleAuthMessage);
        return () => window.removeEventListener('message', handleAuthMessage);
    }, [addNotification]);

    // Remote Control Listeners
    useEffect(() => {
        const handleControlGranted = (e) => setIsController(e.detail.isController);
        const handleBeingControlled = (e) => setIsBeingControlled(e.detail.isBeingControlled);

        window.addEventListener('control-granted', handleControlGranted);
        window.addEventListener('being-controlled', handleBeingControlled);

        return () => {
            window.removeEventListener('control-granted', handleControlGranted);
            window.removeEventListener('being-controlled', handleBeingControlled);
        };
    }, []);

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

    // ── Standalone Terminal View ──────────────────────
    if (isTerminalView) {
        return (
            <div className={`app theme-${theme}`} style={{ background: 'var(--bg-primary)', height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <TerminalPanel />
                <style>{`
                    .terminal-panel { height: 100vh !important; flex: 1; border: none !important; }
                    .terminal-output { flex: 1; height: calc(100vh - 80px) !important; }
                `}</style>
            </div>
        );
    }

    return (
        <div className="app">
            <header className="header">
                <div className="header__brand">
                    <div className="header__logo">R</div>
                    <h1 className="header__title">Roolts</h1>
                </div>

                {/* Quick Access Apps in Header */}
                {experimental?.headerApps && (
                    <div className="header__middle" style={{ display: 'flex', gap: '8px', flex: 1, justifyContent: 'center' }}>
                        <button
                            className="btn btn--ghost btn--icon"
                            onClick={() => {
                                openApp('notes');
                                if (useUIStore.getState().sidebarOpen) useUIStore.getState().toggleSidebar();
                            }}
                            title="Notes"
                            style={{ background: rightPanelTab === 'notes' && rightPanelOpen ? 'var(--bg-elevated)' : 'transparent' }}
                        >
                            <FiMessageSquare size={16} color={rightPanelTab === 'notes' && rightPanelOpen ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                        </button>
                        <button
                            className="btn btn--ghost btn--icon"
                            onClick={() => {
                                openApp('learn');
                                if (useUIStore.getState().sidebarOpen) useUIStore.getState().toggleSidebar();
                            }}
                            title="AI Assistant"
                            style={{ background: rightPanelTab === 'learn' && rightPanelOpen ? 'var(--bg-elevated)' : 'transparent' }}
                        >
                            <FiZap size={16} color={rightPanelTab === 'learn' && rightPanelOpen ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                        </button>
                        <button
                            className="btn btn--ghost btn--icon"
                            onClick={() => {
                                openApp('codechamp');
                                if (useUIStore.getState().sidebarOpen) useUIStore.getState().toggleSidebar();
                            }}
                            title="CodeChamp"
                            style={{ background: rightPanelTab === 'codechamp' && rightPanelOpen ? 'var(--bg-elevated)' : 'transparent' }}
                        >
                            <FiCode size={16} color={rightPanelTab === 'codechamp' && rightPanelOpen ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                        </button>
                        <button
                            className="btn btn--ghost btn--icon"
                            onClick={() => {
                                openApp('snapshots');
                                if (useUIStore.getState().sidebarOpen) useUIStore.getState().toggleSidebar();
                            }}
                            title="Snapshots"
                            style={{ background: rightPanelTab === 'snapshots' && rightPanelOpen ? 'var(--bg-elevated)' : 'transparent' }}
                        >
                            <FiImage size={16} color={rightPanelTab === 'snapshots' && rightPanelOpen ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                        </button>
                        <button
                            className="btn btn--ghost btn--icon"
                            onClick={() => {
                                openApp('apps');
                                if (useUIStore.getState().sidebarOpen) useUIStore.getState().toggleSidebar();
                            }}
                            title="App Grid"
                            style={{ background: rightPanelTab === 'apps' && rightPanelOpen ? 'var(--bg-elevated)' : 'transparent' }}
                        >
                            <FiGrid size={16} color={rightPanelTab === 'apps' && rightPanelOpen ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                        </button>
                    </div>
                )}
                <div className="header__actions">
                    <button className="btn btn--ghost btn--icon" onClick={handleSaveAs} title="Save As"><FiSave /></button>
                    <button className="btn btn--ghost btn--icon" onClick={() => openModal('newFile')} title="New File"><FiPlus /></button>

                    <div
                        className="header__profile"
                        onClick={() => openModal('auth')}
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: authService.isAuthenticated() ? 'var(--accent-primary)' : 'transparent',
                            color: authService.isAuthenticated() ? 'white' : 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            marginLeft: '4px'
                        }}
                        title={authService.isAuthenticated() ? "Account Settings" : "Sign In"}
                    >
                        {authService.isAuthenticated() && authService.getCurrentUser()
                            ? (authService.getCurrentUser().name?.charAt(0).toUpperCase() || authService.getCurrentUser().email?.charAt(0).toUpperCase())
                            : <FiUser size={16} />}
                    </div>

                    <button className="btn btn--ghost btn--icon" onClick={() => openModal('settings')} title="Global Settings"><FiSettings /></button>
                </div>
            </header>

            <main
                className={`main ${editorMinimized ? 'main--editor-minimized' : ''}`}
                ref={mainRef}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                    try {
                        const data = JSON.parse(e.dataTransfer.getData('application/json'));
                        if (data.type === 'snapshot' && data.src) {
                            e.preventDefault();
                            const rect = mainRef.current.getBoundingClientRect();
                            const x = e.clientX - rect.left - 75; // Subtract half icon size so it drops exactly under cursor
                            const y = e.clientY - rect.top - 75;

                            if (activeFileId) {
                                addSticker(activeFileId, {
                                    id: Date.now().toString(),
                                    src: data.src,
                                    x: Math.max(0, x),
                                    y: Math.max(0, y),
                                    rotation: 0,
                                    flipX: false,
                                    flipY: false,
                                    inverted: false,
                                    scale: 1,
                                });
                            }
                        }
                    } catch (err) {
                        // ignore non-json drops
                    }
                }}
            >
                {sidebarOpen ? (
                    <aside className="sidebar-container">
                        <div className="sidebar-panel">
                            <div className="sidebar-content">
                                <FileExplorer />
                            </div>
                        </div>
                    </aside>
                ) : (
                    <aside className="sidebar-container">
                        <ActivityBar
                            activeView={rightPanelTab === 'apps' ? 'apps' : ''}
                            onActivityClick={(id) => {
                                if (id === 'explorer') {
                                    toggleSidebar();
                                } else {
                                    setRightPanelTab(id);
                                    if (!rightPanelOpen) toggleRightPanel();
                                }
                            }}
                            openApps={openApps}
                            onCloseApp={closeApp}
                            onOpenApp={openApp}
                        />
                    </aside>
                )}

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
                            {!terminalMaximized && <div className="resize-handle resize-handle--vertical" onMouseDown={() => setIsResizing('terminal')} />}
                            <div
                                className="terminal-bottom-panel"
                                style={terminalMaximized ? {
                                    position: 'fixed', top: '60px', left: sidebarOpen ? '260px' : '48px', right: 0, bottom: 0, height: 'auto', width: 'auto', zIndex: 10000,
                                    borderTop: 'none', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column'
                                } : { height: terminalHeight, display: 'flex', flexDirection: 'column' }}
                            >
                                <div className="terminal-panel-header" style={{ height: '44px', padding: '0 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}>
                                    <div className="terminal-panel-tabs">
                                        <button className="editor-tab editor-tab--active" style={{ height: '32px', padding: '0 12px' }}>
                                            <FiTerminal size={14} /> Terminal
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <button
                                            className="btn btn--ghost btn--icon"
                                            onClick={() => window.open(window.location.origin + window.location.pathname + '?view=terminal', '_blank', 'width=800,height=600')}
                                            title="Pop Out Terminal"
                                            style={{ width: '28px', height: '28px' }}
                                        >
                                            <FiExternalLink size={14} />
                                        </button>
                                        <button
                                            className="btn btn--ghost btn--icon"
                                            onClick={() => setTerminalMaximized(!terminalMaximized)}
                                            title={terminalMaximized ? "Restore" : "Maximize (Alt+M)"}
                                            style={{ width: '28px', height: '28px' }}
                                        >
                                            {terminalMaximized ? <FiMinimize2 size={14} /> : <FiMaximize2 size={14} />}
                                        </button>
                                        <button className="btn btn--ghost btn--icon" onClick={() => setTerminalOpen(false)} title="Close Panel" style={{ width: '28px', height: '28px' }}><FiX size={14} /></button>
                                    </div>
                                </div>
                                <TerminalPanel />
                            </div>
                        </>
                    )}
                </div>

                {(!experimental?.headerApps || rightPanelOpen) && (
                    <>
                        <div className="resize-handle resize-handle--horizontal" onMouseDown={() => setIsResizing('right')} />
                        <RightPanel style={{ width: rightPanelWidth }} editorMinimized={editorMinimized} />
                    </>
                )}
            </main>

            <StatusBar terminalOpen={terminalOpen} setTerminalOpen={setTerminalOpen} />
            <Suspense fallback={null}>
                <SettingsModal />
                <NewFileModal />
                <AuthModal />
            </Suspense>
            <HighlightModal />

            <SyncManager />
            <Notifications />
            <RemoteControlOverlay isController={isController} isBeingControlled={isBeingControlled} />
            <StickerOverlay
                stickers={activeFile?.stickers || []}
                activeFileId={activeFileId}
                updateSticker={updateSticker}
                removeSticker={removeSticker}
            />
        </div>
    );
}

export default App;



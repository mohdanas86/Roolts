import React, { useCallback } from 'react';
import { FiTerminal, FiX, FiTrash2, FiEdit3, FiRotateCcw, FiEdit2, FiCheckCircle, FiLayout, FiMonitor, FiColumns, FiSidebar, FiPlay } from 'react-icons/fi';
import { LuEraser } from 'react-icons/lu';
import { useFileStore, useExecutionStore, useSettingsStore, useUIStore } from '../store';
import { executorService } from '../services/executorService';
import socketService from '../services/socketService';
import { isGUICode, detectGUILibrary } from '../utils/detectGUI';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import EditorTab from './EditorTab';

function EditorTabs({ isScribbleMode, toggleScribbleMode, scribbleTool, setScribbleTool, scribbleColor, setScribbleColor, onUndo, onClear }) {
    const openFilesData = useFileStore(
        state => state.openFiles.map(id => {
            const f = state.files.find(file => file.id === id);
            return f ? { id: f.id, name: f.name, language: f.language, modified: f.modified, content: f.content } : null;
        }).filter(Boolean),
        (a, b) => a.length === b.length && a.every((f, i) => f.id === b[i].id && f.name === b[i].name && f.modified === b[i].modified)
    );

    const activeFileId = useFileStore(state => state.activeFileId);
    const openFiles = useFileStore(state => state.openFiles, (a, b) => a.length === b.length && a.every((id, i) => id === b[i]));
    const setActiveFile = useFileStore(state => state.setActiveFile);
    const closeFile = useFileStore(state => state.closeFile);
    const closeFiles = useFileStore(state => state.closeFiles);

    const showOutput = useExecutionStore(state => state.showOutput);
    const setShowOutput = useExecutionStore(state => state.setShowOutput);
    const isSplitMode = useExecutionStore(state => state.isSplitMode);
    const setSplitMode = useExecutionStore(state => state.setSplitMode);
    const isGUIExecuting = useExecutionStore(state => state.isGUIExecuting);
    const setIsGUIExecuting = useExecutionStore(state => state.setIsGUIExecuting);

    const features = useSettingsStore(state => state.features);
    const addNotification = useUIStore(state => state.addNotification);

    const [contextMenu, setContextMenu] = React.useState(null);

    // Close context menu on global click
    React.useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const handleContextMenu = (e, fileId) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            fileId
        });
    };

    const handleCloseRight = (fileId) => {
        const index = openFiles.indexOf(fileId);
        if (index !== -1 && index < openFiles.length - 1) {
            const filesToClose = openFiles.slice(index + 1);
            if (filesToClose.length > 0) {
                closeFiles(filesToClose);
            }
        }
        setContextMenu(null);
    };

    const handleCloseOthers = (fileId) => {
        const filesToClose = openFiles.filter(id => id !== fileId);
        if (filesToClose.length > 0) {
            closeFiles(filesToClose);
        }
        setContextMenu(null);
    };

    const handleUndo = () => {
        onUndo();
        addNotification({ type: 'info', message: 'Last scribble undone' });
    };

    const handleClear = () => {
        onClear();
        addNotification({ type: 'success', message: 'All scribbles cleared' });
    };

    // Drag and Drop for Tabs using dnd-kit
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            const oldIndex = openFiles.indexOf(active.id);
            const newIndex = openFiles.indexOf(over.id);

            useFileStore.getState().reorderTabs(oldIndex, newIndex);
        }
    };


    const handleRunCode = useCallback(async () => {
        const activeFile = useFileStore.getState().files.find(f => f.id === activeFileId);
        if (!activeFile) return addNotification({ type: 'error', message: 'No file selected' });

        // Guard: do not start a new run if one is already in progress
        if (useExecutionStore.getState().isExecuting || useExecutionStore.getState().isGUIExecuting) return;

        const isWeb = activeFile.language === 'html' ||
            (activeFile.language === 'javascript' && (activeFile.content.includes('import React') || activeFile.name.endsWith('.jsx')));

        // If it's a basic frontend react/html file, use the old static WebPreview
        if (isWeb && !activeFile.content.includes('express') && !activeFile.content.includes('http')) {
            if (!useUIStore.getState().rightPanelOpen) useUIStore.getState().toggleRightPanel();
            useUIStore.getState().setRightPanelTab('preview');
            return;
        }

        // GUI execution path — detected via import patterns
        if (isGUICode(activeFile.content, activeFile.language)) {
            useExecutionStore.getState().setShowOutput(true);
            useExecutionStore.getState().setIsGUIExecuting(true);
            // Emit gui:start — OutputPanel listens for gui:frame/gui:finished/gui:error
            socketService.emit('gui:start', {
                language: activeFile.language,
                code: activeFile.content,
            });
            return;
        }

        // Prevent rapid clicks
        if (useExecutionStore.getState().isExecuting) {
            executorService.stopExecution();
        }

        useExecutionStore.getState().setShowOutput(true);
        useExecutionStore.getState().setExecuting(true);
        useExecutionStore.getState().setOutput('');
        useExecutionStore.getState().setError(null);

        // GUI/Web Apps (Flask, Node Server, Pygame, Tkinter, etc)
        // For standard languages, we'll use the new startApp to spawn a VNC container
        const isApp = ['python', 'javascript', 'js'].includes(activeFile.language);

        setTimeout(() => {
            if (isApp) {
                executorService.startApp(activeFile.content, activeFile.language);
            } else {
                executorService.executeInteractive(activeFile.content, activeFile.language);
            }
        }, 200);
    }, [activeFileId, addNotification]);

    React.useEffect(() => {
        const handleGlobalRun = () => handleRunCode();
        window.addEventListener('run-program', handleGlobalRun);

        // Auto-open CodeChamp when GUI mode is detected by backend
        const handleGuiMode = () => {
            const { rightPanelOpen, toggleRightPanel, setRightPanelTab } = useUIStore.getState();
            if (!rightPanelOpen) {
                toggleRightPanel();
            }
            setRightPanelTab('codechamp');
        };
        socketService.on('exec:gui-mode', handleGuiMode);

        return () => {
            window.removeEventListener('run-program', handleGlobalRun);
            socketService.off('exec:gui-mode', handleGuiMode);
        };
    }, [handleRunCode]);

    const isExecuting = useExecutionStore(state => state.isExecuting);

    // Active file content + language for the GUI badge
    const activeFileForBadge = useFileStore(
        state => {
            const f = state.files.find(file => file.id === state.activeFileId);
            return f ? { content: f.content, language: f.language } : null;
        },
        (a, b) => a?.language === b?.language && a?.content === b?.content
    );
    const showGUIBadge = activeFileForBadge
        ? isGUICode(activeFileForBadge.content, activeFileForBadge.language)
        : false;
    const guiLibLabel = showGUIBadge && activeFileForBadge
        ? detectGUILibrary(activeFileForBadge.content, activeFileForBadge.language)
        : '';

    return (
        <div className="editor-tabs">

            <div style={{ flex: 1, display: 'flex', overflowX: 'auto', overflowY: 'hidden', minWidth: 0, paddingRight: '8px', scrollbarWidth: 'none' }} className="hide-scrollbar">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={openFiles}
                        strategy={horizontalListSortingStrategy}
                    >
                        {openFilesData.map((file) => (
                            <EditorTab
                                key={file.id}
                                file={file}
                                activeFileId={activeFileId}
                                showOutput={showOutput}
                                setActiveFile={(id) => {
                                    setActiveFile(id);
                                    if (!isSplitMode) {
                                        setShowOutput(false);
                                    }
                                }}
                                setShowOutput={setShowOutput}
                                closeFile={closeFile}
                                handleContextMenu={handleContextMenu}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
            </div>


            {contextMenu && (
                <div
                    style={{
                        position: 'fixed',
                        top: contextMenu.y,
                        left: contextMenu.x,
                        zIndex: 1000,
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: '4px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
                        padding: '4px 0',
                        minWidth: '150px'
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            width: '100%',
                            padding: '6px 12px',
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            fontSize: '13px',
                            textAlign: 'left'
                        }}
                        className="context-menu-item"
                        onClick={() => handleCloseOthers(contextMenu.fileId)}
                    >
                        <span style={{ marginRight: '8px' }}>🔄</span>
                        Close Others
                    </button>

                    <button
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            width: '100%',
                            padding: '6px 12px',
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            fontSize: '13px',
                            textAlign: 'left'
                        }}
                        className="context-menu-item"
                        onClick={() => handleCloseRight(contextMenu.fileId)}
                    >
                        <span style={{ marginRight: '8px' }}>➡️</span>
                        Close to Right
                    </button>

                    <button
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            width: '100%',
                            padding: '6px 12px',
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--danger)',
                            cursor: 'pointer',
                            fontSize: '13px',
                            textAlign: 'left'
                        }}
                        className="context-menu-item"
                        onClick={() => {
                            closeFile(contextMenu.fileId);
                            setContextMenu(null);
                        }}
                    >
                        <FiX size={14} style={{ marginRight: '8px' }} />
                        Close
                    </button>
                </div>
            )}

            {/* GUI detection badge */}
            {showGUIBadge && (
                <span
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(63, 185, 80, 0.1)',
                        border: '1px solid rgba(63, 185, 80, 0.3)',
                        color: 'var(--success)',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        marginRight: '4px',
                    }}
                    title={`${guiLibLabel} — will open in GUI viewer`}
                >
                    🖼️ {guiLibLabel} — GUI viewer
                </span>
            )}

            {/* Run Button */}
            <button
                className="btn btn--success"
                onClick={handleRunCode}
                disabled={isExecuting || isGUIExecuting}
                style={{
                    marginRight: '8px',
                    padding: '4px 16px',
                    fontSize: '12px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'var(--success)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    cursor: (isExecuting || isGUIExecuting) ? 'not-allowed' : 'pointer',
                    opacity: (isExecuting || isGUIExecuting) ? 0.7 : 1,
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 10px rgba(63, 185, 80, 0.3)',
                    fontWeight: 600
                }}
                title="Run Code (Ctrl+Enter)"
            >
                {(isExecuting || isGUIExecuting) ? <span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }} /> : <FiPlay size={12} fill="currentColor" />}
                <span>Run</span>
            </button>

            {/* Output Tab - Acts like a program tab */}
            <button
                className={`editor-tab ${showOutput && !isSplitMode ? 'editor-tab--active' : ''}`}
                onClick={() => {
                    setShowOutput(true);
                    setSplitMode(false);
                }}
                style={{ marginLeft: 'auto', marginRight: '8px' }}
                title="Output Terminal"
            >
                <FiTerminal size={14} style={{ color: showOutput && !isSplitMode ? 'white' : 'var(--accent-primary)' }} />
                <span>Output</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '12px', flexShrink: 0 }}>
                <button
                    className={`btn btn--icon ${isSplitMode ? 'btn--active' : ''}`}
                    onClick={() => {
                        const newSplitState = !isSplitMode;
                        setSplitMode(newSplitState);
                        setShowOutput(newSplitState); // If we split, show output. If we un-split, hide output (reverting to editor-only).
                    }}
                    title={isSplitMode ? "Close Split View" : "Split Editor Right"}
                    style={{
                        padding: '6px',
                        height: '28px',
                        width: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        background: isSplitMode ? 'var(--bg-tertiary)' : 'transparent',
                        color: isSplitMode ? 'var(--text-primary)' : 'var(--text-secondary)'
                    }}
                >
                    <FiColumns size={16} />
                </button>

                {features?.scribble && (
                    <>
                        {isScribbleMode && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'var(--bg-tertiary)',
                                padding: '2px 10px',
                                borderRadius: '20px',
                                border: '1px solid var(--border-primary)',
                                boxShadow: 'var(--shadow-lg)',
                                animation: 'slideInRight 0.3s ease'
                            }}>
                                <button
                                    className={`btn btn--icon ${scribbleTool === 'pen' ? 'btn--active' : ''}`}
                                    onClick={() => setScribbleTool('pen')}
                                    style={{ width: '28px', height: '28px', background: scribbleTool === 'pen' ? 'var(--accent-primary)' : 'transparent' }}
                                    title="Pen Tool (P)"
                                >
                                    <FiEdit2 size={15} color={scribbleTool === 'pen' ? 'white' : 'inherit'} />
                                </button>
                                <button
                                    className={`btn btn--icon ${scribbleTool === 'eraser' ? 'btn--active' : ''}`}
                                    onClick={() => setScribbleTool('eraser')}
                                    style={{ width: '28px', height: '28px', background: scribbleTool === 'eraser' ? 'var(--accent-primary)' : 'transparent' }}
                                    title="Eraser Tool (E)"
                                >
                                    <LuEraser size={18} color={scribbleTool === 'eraser' ? 'white' : 'inherit'} />
                                </button>

                                <div style={{ width: '1px', height: '20px', background: 'var(--border-primary)', margin: '0 6px' }} />

                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {['#ff4b2b', '#ffb347', '#00f2fe', '#4facfe', '#a8e063', '#ffffff'].map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setScribbleColor(color)}
                                            style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '50%',
                                                background: color,
                                                border: scribbleColor === color ? '2px solid white' : '1px solid rgba(255,255,255,0.2)',
                                                boxShadow: scribbleColor === color ? `0 0 10px ${color}` : 'none',
                                                cursor: 'pointer',
                                                padding: 0,
                                                transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                            }}
                                            className="color-btn"
                                            onMouseEnter={(e) => e.target.style.transform = 'scale(1.2)'}
                                            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                                        />
                                    ))}
                                </div>

                                <div style={{ width: '1px', height: '20px', background: 'var(--border-primary)', margin: '0 6px' }} />

                                <button className="btn btn--icon" onClick={handleUndo} style={{ width: '28px', height: '28px' }} title="Undo (Ctrl+Z)">
                                    <FiRotateCcw size={15} />
                                </button>
                                <button className="btn btn--icon" onClick={handleClear} style={{ width: '28px', height: '28px', color: 'var(--error)' }} title="Clear All Drawings">
                                    <FiTrash2 size={16} />
                                </button>
                            </div>
                        )}
                        <button
                            className={`btn btn--icon ${isScribbleMode ? 'btn--active' : ''}`}
                            onClick={toggleScribbleMode}
                            style={{
                                border: '1px solid var(--border-primary)',
                                borderRadius: '50%',
                                width: '32px',
                                height: '32px',
                                background: isScribbleMode ? 'var(--accent-primary)' : 'transparent',
                                color: isScribbleMode ? 'white' : 'var(--text-primary)',
                                boxShadow: isScribbleMode ? 'var(--shadow-glow)' : 'none',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                            title={isScribbleMode ? "Exit Scribble Mode" : "Scribble on Code"}
                        >
                            <FiEdit3 size={18} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

export default EditorTabs;

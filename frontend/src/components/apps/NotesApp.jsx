
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import ImageResize from 'quill-image-resize-module-react';
import {
    FiPlus, FiTrash2, FiImage, FiList, FiChevronLeft, FiFolder, FiTag,
    FiClock, FiStar, FiChevronRight, FiSearch, FiMoreHorizontal,
    FiBold, FiItalic, FiList as FiListIcon, FiCheckSquare, FiType, FiPaperclip,
    FiShare, FiSend, FiZap, FiSettings, FiMaximize2, FiMinimize2, FiSmile, FiX
} from 'react-icons/fi';
import { useNotesStore, useUIStore } from '../../store';
import { v4 as uuidv4 } from 'uuid';

// Register Quill modules
window.Quill = Quill;
Quill.register('modules/imageResize', ImageResize);

const SidebarSection = ({ title, items, activeId, onSelect, onAdd }) => (
    <div className="notes-sidebar-section">
        <div className="notes-sidebar-section-header">
            <span>{title}</span>
            {onAdd && <button onClick={onAdd}><FiPlus size={12} /></button>}
        </div>
        {items.map(item => (
            <div
                key={item.id}
                className={`notes-sidebar-item ${activeId === item.id ? 'active' : ''}`}
                onClick={() => onSelect(item.id)}
            >
                <item.icon size={16} />
                <span className="notes-sidebar-item-label">{item.name}</span>
                {item.count !== undefined && <span className="notes-sidebar-item-count">{item.count}</span>}
            </div>
        ))}
    </div>
);

const NoteRow = ({ note, isActive, onClick }) => {
    const dateLabel = useMemo(() => {
        const d = new Date(note.updatedAt || note.createdAt);
        const now = new Date();
        const isSameDay = (d1, d2) =>
            d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();

        if (isSameDay(d, now)) {
            return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        }

        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (isSameDay(d, yesterday)) return 'Yesterday';

        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }, [note]);

    const snippet = useMemo(() => {
        if (!note.content) return 'No additional text';
        const span = document.createElement('span');
        span.innerHTML = note.content;
        return span.textContent || span.innerText || 'No additional text';
    }, [note.content]);

    return (
        <div className={`note-list-row ${isActive ? 'active' : ''}`} onClick={onClick}>
            <div className="note-list-row-header">
                <span className="note-list-row-title">{note.title || 'Untitled'}</span>
                <span className="note-list-row-date">{dateLabel}</span>
            </div>
            <div className="note-list-row-snippet">{snippet}</div>
            {note.folderName && (
                <div className="note-list-row-folder">
                    <FiFolder size={10} /> {note.folderName}
                </div>
            )}
        </div>
    );
};

const RooltsNotes = ({ onBack, isWindowed }) => {
    const {
        notes, folders, activeNoteId, activeFolderId, searchQuery,
        setActiveNote, setActiveFolder, setSearchQuery,
        addNote, updateNote, deleteNote, addFolder,
        aiSidebarOpen, setAiSidebarOpen, aiSidebarWidth, setAiSidebarWidth,
        aiExpanded, setAiExpanded, aiMessages, addAiMessage, clearAiMessages
    } = useNotesStore();

    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [editorTitle, setEditorTitle] = useState('');
    const [editorContent, setEditorContent] = useState('');
    const [isResizingAI, setIsResizingAI] = useState(false);
    const [aiInput, setAiInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const quillRef = useRef(null);
    const messageEndRef = useRef(null);

    const activeNote = notes.find(n => n.id === activeNoteId);

    // Date grouping logic (Native)
    const groupedNotes = useMemo(() => {
        const groups = { 'Today': [], 'Yesterday': [], 'Previous 7 Days': [], 'Older': [] };
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(startOfToday); yesterday.setDate(startOfToday.getDate() - 1);
        const lastWeek = new Date(startOfToday); lastWeek.setDate(startOfToday.getDate() - 7);

        const filtered = notes.filter(n => {
            if (activeFolderId === 'all') return true;
            if (activeFolderId === 'today') return new Date(n.updatedAt || n.createdAt) >= startOfToday;
            if (activeFolderId.startsWith('tag:')) {
                const tag = activeFolderId.replace('tag:', '');
                return n.content?.includes(`#${tag}`) || n.title?.includes(`#${tag}`);
            }
            return n.folderId === activeFolderId;
        }).filter(n => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return n.title?.toLowerCase().includes(q) || n.content?.toLowerCase().includes(q);
        }).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

        filtered.forEach(n => {
            const d = new Date(n.updatedAt || n.createdAt);
            if (d >= startOfToday) groups['Today'].push(n);
            else if (d >= yesterday) groups['Yesterday'].push(n);
            else if (d >= lastWeek) groups['Previous 7 Days'].push(n);
            else groups['Older'].push(n);
        });

        return Object.entries(groups).filter(([_, items]) => items.length > 0);
    }, [notes, activeFolderId, searchQuery]);

    const allTags = useMemo(() => {
        const tags = new Set();
        notes.forEach(n => {
            const matches = n.content?.match(/#(\w+)/g);
            if (matches) matches.forEach(m => tags.add(m.replace('#', '')));
        });
        return Array.from(tags).sort();
    }, [notes]);

    // Keyboard shortcut for AI Column (Ctrl+Shift+A)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                setAiSidebarOpen(!aiSidebarOpen);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [aiSidebarOpen, setAiSidebarOpen]);

    // Resizing Logic for AI Assistant
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizingAI) return;
            const newWidth = window.innerWidth - e.clientX;
            const constrainedWidth = Math.max(400, Math.min(newWidth, window.innerWidth * 0.9));
            setAiSidebarWidth(constrainedWidth);
            // Auto-expand if dragged beyond 80%
            if (constrainedWidth > window.innerWidth * 0.8) setAiExpanded(true);
            else if (constrainedWidth < window.innerWidth * 0.7 && aiExpanded) setAiExpanded(false);
        };
        const handleMouseUp = () => setIsResizingAI(false);
        if (isResizingAI) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizingAI, aiExpanded, setAiSidebarWidth, setAiExpanded]);

    // Auto-save logic
    useEffect(() => {
        const timer = setTimeout(() => {
            if (activeNote && (editorContent !== activeNote.content || editorTitle !== activeNote.title)) {
                updateNote(activeNote.id, { title: editorTitle, content: editorContent });
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [editorContent, editorTitle, activeNote, updateNote]);

    useEffect(() => {
        if (activeNote) {
            setEditorTitle(activeNote.title || '');
            setEditorContent(activeNote.content || '');
        }
    }, [activeNoteId]);

    // Scroll to bottom of chat
    useEffect(() => {
        if (messageEndRef.current) messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, [aiMessages]);

    const handleCreateNote = () => {
        const newNote = {
            id: uuidv4(), title: '', content: '',
            folderId: activeFolderId !== 'all' && activeFolderId !== 'today' && !activeFolderId.startsWith('tag:') ? activeFolderId : null,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        addNote(newNote);
        setActiveNote(newNote.id);
    };

    const handleSendAi = async () => {
        if (!aiInput.trim()) return;
        const query = aiInput;
        setAiInput('');
        addAiMessage({ role: 'user', content: query });
        setIsStreaming(true);

        // Context awareness simulation
        const contextText = activeNote ? `Note: ${activeNote.title}\n${activeNote.content}` : "";

        setTimeout(() => {
            addAiMessage({
                role: 'assistant',
                content: `I've analyzed your notes "${activeNote?.title || 'Note'}". Based on the context, here's a suggestion for "${query}":\n\nI recommend adding a section about sustainable architecture to match your recent macOS Tahoe design principles.`
            });
            setIsStreaming(false);
        }, 1500);
    };

    const insertResponseToNote = (content) => {
        if (!quillRef.current || !activeNote) return;
        const quill = quillRef.current.getEditor();
        const range = quill.getSelection() || { index: quill.getLength(), length: 0 };
        quill.insertText(range.index, `\n\n--- AI Suggestion ---\n${content}\n`);
    };

    const modules = useMemo(() => ({
        toolbar: false,
        imageResize: { modules: ['Resize', 'DisplaySize'] }
    }), []);

    return (
        <div className={`notes-app ${aiExpanded ? 'exclusive-ai-mode' : ''}`}>
            {/* Column 1: Workspace Sidebar */}
            {!sidebarCollapsed && !aiExpanded && (
                <div className="notes-sidebar">
                    <div className="notes-sidebar-header">
                        <div className="notes-search-box">
                            <FiSearch size={14} />
                            <input type="text" placeholder="Search notes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        </div>
                    </div>
                    <div className="notes-sidebar-content">
                        <SidebarSection title="Favorites" activeId={activeFolderId} onSelect={setActiveFolder} items={[{ id: 'all', name: 'All Notes', icon: FiList }, { id: 'today', name: 'Today', icon: FiClock }]} />
                        <SidebarSection title="Folders" onAdd={() => { const name = prompt('Folder Name:'); if (name) addFolder({ name }); }} activeId={activeFolderId} onSelect={setActiveFolder} items={folders.filter(f => f.type !== 'smart').map(f => ({ id: f.id, name: f.name, icon: FiFolder }))} />
                        <SidebarSection title="Tags" activeId={activeFolderId} onSelect={setActiveFolder} items={allTags.map(t => ({ id: `tag:${t}`, name: t, icon: FiTag }))} />
                    </div>
                    <div className="notes-sidebar-footer">
                        <button onClick={handleCreateNote} className="btn btn--primary" style={{ width: '100%', gap: '8px' }}><FiPlus size={14} /> New Note</button>
                    </div>
                </div>
            )}

            {/* Column 2: Rich-Text Editor */}
            {!aiExpanded && (
                <div className="notes-editor-column">
                    <header className="notes-editor-header">
                        <div className="notes-editor-toolbar">
                            <button className="btn btn--ghost btn--icon" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title="Toggle Workspace Sidebar">
                                <FiList size={16} />
                            </button>
                            <div className="notes-toolbar-group">
                                <button className="btn btn--ghost btn--icon" onClick={() => quillRef.current.getEditor().format('bold', !quillRef.current.getEditor().getFormat().bold)}><FiBold size={14} /></button>
                                <button className="btn btn--ghost btn--icon" onClick={() => quillRef.current.getEditor().format('italic', !quillRef.current.getEditor().getFormat().italic)}><FiItalic size={14} /></button>
                                <button className="btn btn--ghost btn--icon" onClick={() => { const q = quillRef.current.getEditor(); q.format('list', q.getFormat().list === 'bullet' ? false : 'bullet'); }}><FiListIcon size={14} /></button>
                                <button className="btn btn--ghost btn--icon" onClick={() => { const q = quillRef.current.getEditor(); q.format('list', q.getFormat().list === 'check' ? false : 'check'); }}><FiCheckSquare size={14} /></button>
                            </div>
                        </div>
                        <div className="notes-editor-actions">
                            <button className={`btn btn--ghost btn--icon ${aiSidebarOpen ? 'active' : ''}`} onClick={() => setAiSidebarOpen(!aiSidebarOpen)} title="Toggle Notes Assistant (Ctrl+Shift+A)"><FiZap size={14} /></button>
                            <button className="btn btn--ghost btn--icon" onClick={() => deleteNote(activeNoteId)} style={{ color: 'var(--error)' }}><FiTrash2 size={14} /></button>
                        </div>
                    </header>
                    <div className="notes-editor-content">
                        {activeNote ? (
                            <>
                                <input className="notes-editor-title-input" value={editorTitle} onChange={(e) => setEditorTitle(e.target.value)} placeholder="Title" />
                                <div className="notes-editor-metadata">
                                    <span>{activeNote.updatedAt ? new Date(activeNote.updatedAt).toLocaleString() : ''}</span>
                                    {activeNote.folderId && <span>in {folders.find(f => f.id === activeNote.folderId)?.name}</span>}
                                </div>
                                <ReactQuill ref={quillRef} theme="snow" value={editorContent} onChange={setEditorContent} modules={modules} placeholder="Start writing..." />
                            </>
                        ) : <div className="notes-no-selection"><FiPlus size={48} /><span>Select a note</span></div>}
                    </div>
                </div>
            )}

            {/* Custom Resizing Handle for AI */}
            {aiSidebarOpen && !aiExpanded && <div className="notes-resizer" onMouseDown={() => setIsResizingAI(true)} />}

            {/* Column 4: Roolts AI (Notes Assistant) */}
            {aiSidebarOpen && (
                <div
                    className="notes-ai-column"
                    style={{ width: aiExpanded ? '100%' : aiSidebarWidth }}
                >
                    <header className="notes-ai-header">
                        <div className="notes-ai-header-left">
                            <FiZap style={{ color: 'var(--accent-primary)' }} />
                            <span className="notes-ai-title">Notes Assistant</span>
                        </div>
                        <div className="notes-ai-actions">
                            <button className="btn btn--ghost btn--icon" onClick={() => setAiExpanded(!aiExpanded)} title={aiExpanded ? "Collapse" : "Expand Full Screen"}>
                                {aiExpanded ? <FiMinimize2 size={14} /> : <FiMaximize2 size={14} />}
                            </button>
                            <button className="btn btn--ghost btn--icon" onClick={() => clearAiMessages()}><FiTrash2 size={14} /></button>
                            <button className="btn btn--ghost btn--icon" onClick={() => setAiSidebarOpen(false)}><FiX size={14} /></button>
                        </div>
                    </header>

                    <div className="notes-ai-chat">
                        {aiMessages.length === 0 ? (
                            <div className="notes-ai-welcome">
                                <FiZap size={40} style={{ color: 'var(--accent-primary)', marginBottom: '12px' }} />
                                <h3>Notes Intelligence</h3>
                                <p>Analyze, summarize, or extend your notes. Try asking about the current note.</p>
                            </div>
                        ) : (
                            aiMessages.map(msg => (
                                <div key={msg.id} className={`notes-ai-bubble-container ${msg.role}`}>
                                    <div className={`notes-ai-bubble ${msg.role}`}>
                                        <div className="bubble-content">{msg.content}</div>
                                        {msg.role === 'assistant' && (
                                            <div className="bubble-actions">
                                                <button className="btn--text" onClick={() => insertResponseToNote(msg.content)}><FiPlus /> Insert to Note</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                        {isStreaming && <div className="notes-ai-loading">Assistant is thinking...</div>}
                        <div ref={messageEndRef} />
                    </div>

                    <div className="notes-ai-input-area">
                        <div className="notes-ai-input-wrapper">
                            <textarea
                                placeholder="Ask about this note..."
                                value={aiInput}
                                onChange={(e) => setAiInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendAi(); } }}
                            />
                            <button onClick={handleSendAi} className={`notes-ai-send ${aiInput.trim() ? 'active' : ''}`}><FiSend /></button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .notes-app { 
                    height: 100%; display: flex; overflow: hidden; background: var(--bg-primary); color: var(--text-primary);
                    font-family: var(--font-body);
                }
                .notes-sidebar { 
                    width: 180px; border-right: 1px solid var(--border-primary); background: var(--bg-secondary);
                    display: flex; flex-direction: column;
                }
                .notes-sidebar-header { padding: 12px; }
                .notes-search-box {
                    background: var(--bg-primary); border: 1px solid var(--border-primary);
                    border-radius: var(--radius-md); padding: 6px 10px; display: flex; align-items: center; gap: 6px;
                }
                .notes-search-box input { background: transparent; border: none; outline: none; color: var(--text-primary); width: 100%; font-size: 12px; }
                
                .notes-sidebar-content { flex: 1; overflow-y: auto; padding: 0 4px; }
                .notes-sidebar-section { margin-bottom: 20px; }
                .notes-sidebar-section-header { 
                    padding: 6px 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; 
                    color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;
                }
                .notes-sidebar-item {
                    display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: var(--radius-sm);
                    cursor: pointer; font-size: 12px; color: var(--text-secondary); transition: all 0.2s;
                }
                .notes-sidebar-item:hover { background: var(--bg-tertiary); color: var(--text-primary); }
                .notes-sidebar-item.active { background: var(--bg-tertiary); color: var(--accent-primary); font-weight: 600; }
                .notes-sidebar-item-count { margin-left: auto; font-size: 10px; opacity: 0.6; }
                .notes-sidebar-footer { padding: 12px; border-top: 1px solid var(--border-primary); }

                .notes-editor-column { flex: 1; display: flex; flex-direction: column; background: var(--bg-primary); }
                .notes-editor-header { height: 52px; border-bottom: 1px solid var(--border-primary); display: flex; align-items: center; justify-content: space-between; padding: 0 16px; }
                .notes-editor-toolbar { display: flex; align-items: center; gap: 8px; }
                .notes-toolbar-group { display: flex; gap: 4px; align-items: center; padding-left: 12px; border-left: 1px solid var(--border-secondary); }
                .notes-editor-actions { display: flex; gap: 8px; align-items: center; }
                
                .notes-editor-content { 
                    flex: 1; display: flex; flex-direction: column; 
                    padding: 24px 10%; /* Responsive padding for focus */
                    max-width: 900px; margin: 0 auto; width: 100%;
                    overflow-y: auto; 
                }
                .notes-editor-title-input { 
                    font-size: 28px; font-weight: 700; border: none; background: transparent; outline: none; 
                    color: var(--text-primary); width: 100%; margin-bottom: 8px;
                }
                .notes-editor-metadata { font-size: 11px; color: var(--text-muted); margin-bottom: 20px; display: flex; gap: 10px; }
                .notes-no-selection { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-muted); gap: 12px; }

                .notes-resizer { width: 4px; cursor: col-resize; background: transparent; transition: background 0.2s; }
                .notes-resizer:hover { background: var(--accent-primary); }

                .notes-ai-column { 
                    width: 500px; /* Enlarge for "Large Assistant" */
                    border-left: 1px solid var(--border-primary); background: var(--bg-secondary);
                    display: flex; flex-direction: column; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .notes-ai-header { height: 44px; border-bottom: 1px solid var(--border-primary); display: flex; align-items: center; justify-content: space-between; padding: 0 12px; }
                .notes-ai-header-left { display: flex; align-items: center; gap: 6px; font-weight: 600; }
                .notes-ai-title { font-size: 13px; }
                .notes-ai-actions { display: flex; gap: 2px; }

                .notes-ai-chat { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
                .notes-ai-welcome { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px; color: var(--text-secondary); }
                
                .notes-ai-bubble-container { display: flex; width: 100%; }
                .notes-ai-bubble-container.user { justify-content: flex-end; }
                .notes-ai-bubble-container.assistant { justify-content: flex-start; }
                
                .notes-ai-bubble { max-width: 90%; padding: 8px 12px; border-radius: var(--radius-md); font-size: 12px; line-height: 1.5; }
                .notes-ai-bubble.user { background: var(--accent-primary); color: white; border-bottom-right-radius: 2px; }
                .notes-ai-bubble.assistant { background: var(--bg-tertiary); border: 1px solid var(--border-primary); color: var(--text-primary); border-bottom-left-radius: 2px; }
                
                .bubble-actions { margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border-primary); }
                .btn--text { background: transparent; border: none; color: var(--accent-primary); font-size: 10px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px; }

                .notes-ai-input-area { padding: 12px; border-top: 1px solid var(--border-primary); background: var(--bg-secondary); }
                .notes-ai-input-wrapper { background: var(--bg-primary); border: 1px solid var(--border-primary); border-radius: var(--radius-md); padding: 6px 10px; display: flex; gap: 10px; align-items: center; position: relative; }
                .notes-ai-input-wrapper textarea { flex: 1; background: transparent; border: none; outline: none; color: var(--text-primary); font-size: 12px; resize: none; max-height: 80px; }
                .notes-ai-send { background: transparent; border: none; color: var(--text-muted); cursor: pointer; transition: color 0.2s; }
                .notes-ai-send.active { color: var(--accent-primary); }
                .notes-ai-loading { font-size: 10px; color: var(--text-muted); font-style: italic; }

                .exclusive-ai-mode .notes-sidebar, .exclusive-ai-mode .notes-list-column, .exclusive-ai-mode .notes-editor-column { display: none; }
                .exclusive-ai-mode .notes-ai-column { border-left: none; width: 100% !important; }

                /* Quill Overrides for Professional Look */
                .ql-container.ql-snow { border: none !important; font-family: var(--font-body) !important; font-size: 15px; }
                .ql-editor { padding: 0 !important; color: var(--text-primary); line-height: 1.6; }
                .ql-editor.ql-blank::before { color: var(--text-muted); font-style: normal; left: 0; }
            `}</style>
        </div>
    );
};

export default RooltsNotes;

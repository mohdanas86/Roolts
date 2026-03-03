
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import ImageResize from 'quill-image-resize-module-react';
import {
    FiPlus, FiTrash2, FiImage, FiList, FiChevronLeft, FiFolder, FiTag,
    FiClock, FiStar, FiChevronRight, FiSearch, FiMoreHorizontal,
    FiBold, FiItalic, FiList as FiListIcon, FiCheckSquare, FiType, FiPaperclip,
    FiShare, FiSend, FiZap, FiSettings, FiMaximize2, FiMinimize2, FiSmile, FiX, FiHelpCircle,
    FiFileText, FiEdit3
} from 'react-icons/fi';
import { useNotesStore, useUIStore } from '../../store';
import { aiService } from '../../services/api';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

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
                <item.icon size={14} />
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
    const [contextMenu, setContextMenu] = useState(null);
    const quillRef = useRef(null);
    const messageEndRef = useRef(null);

    const activeNote = notes.find(n => n.id === activeNoteId);

    // Date grouping logic
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

    const totalFilteredCount = useMemo(() => {
        return groupedNotes.reduce((acc, [_, items]) => acc + items.length, 0);
    }, [groupedNotes]);

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

    const handleSendAi = async (forcedQuery = null) => {
        const query = forcedQuery || aiInput;
        if (!query || !query.trim()) return;

        if (!forcedQuery) setAiInput('');
        addAiMessage({ role: 'user', content: query });
        setIsStreaming(true);

        try {
            const systemPrompt = `[SYSTEM: You are a helpful assistant reading from a notepad. Explain concepts simply and naturally, focusing on the content's meaning. Do NOT explain HTML tags, technical rendering details, or markup syntax unless explicitly asked. Treat the content as plain text notes.]`;
            const context = activeNote
                ? `${systemPrompt}\n\n[CONTEXT: The user is currently viewing a note titled "${activeNote.title}". Content:\n${activeNote.content}]\n\nUser Query: ${query}`
                : `${systemPrompt}\n\nUser Query: ${query}`;

            const response = await aiService.chat(
                activeNote?.content || '',
                'markdown',
                context,
                aiMessages.map(m => ({ role: m.role, content: m.content }))
            );

            const aiResponse = response?.data?.response || response?.response || "I couldn't generate a response.";
            addAiMessage({
                role: 'assistant',
                content: aiResponse
            });
        } catch (error) {
            console.error(error);
            addAiMessage({ role: 'assistant', content: "Error: Failed to contact AI service. Please check your connection or settings." });
        } finally {
            setIsStreaming(false);
        }
    };

    // Context Menu Handler
    const handleContextMenu = (e) => {
        const selection = window.getSelection().toString();
        if (selection && selection.trim().length > 0) {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, selection });
        } else {
            setContextMenu(null);
        }
    };

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

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
                        <SidebarSection title="Favorites" activeId={activeFolderId} onSelect={setActiveFolder} items={[
                            { id: 'all', name: 'All Notes', icon: FiList, count: notes.length },
                            { id: 'today', name: 'Today', icon: FiClock }
                        ]} />
                        <SidebarSection title="Folders" onAdd={() => { const name = prompt('Folder Name:'); if (name) addFolder({ name }); }} activeId={activeFolderId} onSelect={setActiveFolder} items={folders.filter(f => f.type !== 'smart' && f.type !== 'section').map(f => ({ id: f.id, name: f.name, icon: FiFolder }))} />
                        <SidebarSection title="Tags" activeId={activeFolderId} onSelect={setActiveFolder} items={allTags.map(t => ({ id: `tag:${t}`, name: t, icon: FiTag }))} />
                    </div>
                    <div className="notes-sidebar-footer">
                        <button onClick={handleCreateNote} className="btn btn--primary" style={{ width: '100%', gap: '8px' }}><FiPlus size={14} /> New Note</button>
                    </div>
                </div>
            )}

            {/* Column 2: Note List (RESTORED) */}
            {!aiExpanded && (
                <div className="notes-list-column">
                    <div className="notes-list-header">
                        <div className="notes-list-header-top">
                            {sidebarCollapsed && (
                                <button className="btn btn--ghost btn--icon" onClick={() => setSidebarCollapsed(false)} title="Show Sidebar">
                                    <FiChevronRight size={14} />
                                </button>
                            )}
                            <span className="notes-list-title">{totalFilteredCount} Note{totalFilteredCount !== 1 ? 's' : ''}</span>
                            <button className="btn btn--ghost btn--icon notes-list-new-btn" onClick={handleCreateNote} title="New Note">
                                <FiEdit3 size={14} />
                            </button>
                        </div>
                    </div>
                    <div className="notes-list-body">
                        {groupedNotes.length > 0 ? (
                            groupedNotes.map(([groupName, groupNotes]) => (
                                <div key={groupName} className="notes-list-group">
                                    <div className="notes-list-group-header">{groupName}</div>
                                    {groupNotes.map(note => (
                                        <NoteRow
                                            key={note.id}
                                            note={note}
                                            isActive={activeNoteId === note.id}
                                            onClick={() => setActiveNote(note.id)}
                                        />
                                    ))}
                                </div>
                            ))
                        ) : (
                            <div className="notes-list-empty">
                                <FiFileText size={32} />
                                <span>No notes yet</span>
                                <button className="btn btn--primary btn--sm" onClick={handleCreateNote}>
                                    <FiPlus size={12} /> Create Note
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Column 3: Rich-Text Editor */}
            {!aiExpanded && (
                <div className="notes-editor-column">
                    <header className="notes-editor-header">
                        <div className="notes-editor-toolbar">
                            <button className="btn btn--ghost btn--icon" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title="Toggle Workspace Sidebar">
                                <FiList size={16} />
                            </button>
                            <div className="notes-toolbar-group">
                                <button className="btn btn--ghost btn--icon" onClick={() => { const q = quillRef.current?.getEditor(); if (q) q.format('bold', !q.getFormat().bold); }}><FiBold size={14} /></button>
                                <button className="btn btn--ghost btn--icon" onClick={() => { const q = quillRef.current?.getEditor(); if (q) q.format('italic', !q.getFormat().italic); }}><FiItalic size={14} /></button>
                                <button className="btn btn--ghost btn--icon" onClick={() => { const q = quillRef.current?.getEditor(); if (q) q.format('list', q.getFormat().list === 'bullet' ? false : 'bullet'); }}><FiListIcon size={14} /></button>
                                <button className="btn btn--ghost btn--icon" onClick={() => { const q = quillRef.current?.getEditor(); if (q) q.format('list', q.getFormat().list === 'check' ? false : 'check'); }}><FiCheckSquare size={14} /></button>
                            </div>
                        </div>
                        <div className="notes-editor-actions">
                            <button className={`btn btn--ghost btn--icon ${aiSidebarOpen ? 'active' : ''}`} onClick={() => setAiSidebarOpen(!aiSidebarOpen)} title="Toggle Notes Assistant (Ctrl+Shift+A)"><FiZap size={14} /></button>
                            <button className="btn btn--ghost btn--icon" onClick={() => { if (activeNoteId && window.confirm('Delete this note?')) deleteNote(activeNoteId); }} style={{ color: 'var(--error)' }}><FiTrash2 size={14} /></button>
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
                                <div onContextMenu={handleContextMenu} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <ReactQuill ref={quillRef} theme="snow" value={editorContent} onChange={setEditorContent} modules={modules} placeholder="Start writing..." style={{ flex: 1 }} />
                                </div>
                            </>
                        ) : <div className="notes-no-selection"><FiFileText size={40} style={{ opacity: 0.3 }} /><span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Select or create a note</span></div>}
                    </div>
                    {/* Custom Context Menu */}
                    {contextMenu && (
                        <div
                            className="notes-context-menu"
                            style={{ top: contextMenu.y, left: contextMenu.x }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setAiSidebarOpen(true);
                                handleSendAi(`[SYSTEM: Explain this simply as if reading a note. Do not explain technical tags.]\n\nExplain this selection:\n"${contextMenu.selection}"`);
                                setContextMenu(null);
                            }}
                        >
                            <FiZap size={14} className="icon-pulse" />
                            <span>Explain with AI</span>
                        </div>
                    )}
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
                                        {msg.role === 'assistant' ? (
                                            <div className="bubble-content">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        code({ node, className, children, ...props }) {
                                                            const match = /language-(\w+)/.exec(className || '');
                                                            const codeContent = String(children).replace(/\n$/, '');
                                                            const isInline = !match;
                                                            return !isInline ? (
                                                                <div className="notes-code-block">
                                                                    <div className="notes-code-header">
                                                                        <span>{match ? match[1] : 'text'}</span>
                                                                    </div>
                                                                    <SyntaxHighlighter
                                                                        style={vscDarkPlus}
                                                                        language={match ? match[1] : 'plaintext'}
                                                                        PreTag="div"
                                                                        customStyle={{ margin: 0, padding: '12px', background: 'transparent', fontSize: '12px' }}
                                                                    >
                                                                        {codeContent}
                                                                    </SyntaxHighlighter>
                                                                </div>
                                                            ) : (
                                                                <code className="notes-inline-code" {...props}>{children}</code>
                                                            );
                                                        },
                                                        table({ children, ...props }) {
                                                            return (
                                                                <div className="notes-table-wrapper">
                                                                    <table {...props}>{children}</table>
                                                                </div>
                                                            );
                                                        }
                                                    }}
                                                >
                                                    {msg.content}
                                                </ReactMarkdown>
                                            </div>
                                        ) : (
                                            <div className="bubble-content">{msg.content}</div>
                                        )}
                                        {msg.role === 'assistant' && (
                                            <div className="bubble-actions">
                                                <button className="btn--text" onClick={() => insertResponseToNote(msg.content)}><FiPlus /> Insert to Note</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                        {isStreaming && (
                            <div className="notes-ai-loading">
                                <div className="assistant-typing"><span></span><span></span><span></span></div>
                            </div>
                        )}
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

                /* ── Sidebar ── */
                .notes-sidebar { 
                    width: 160px; border-right: 1px solid var(--border-primary); background: var(--bg-secondary);
                    display: flex; flex-direction: column; flex-shrink: 0;
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
                .notes-sidebar-section-header button { background: none; border: none; color: var(--text-muted); cursor: pointer; }
                .notes-sidebar-section-header button:hover { color: var(--accent-primary); }
                .notes-sidebar-item {
                    display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: var(--radius-sm);
                    cursor: pointer; font-size: 12px; color: var(--text-secondary); transition: all 0.15s ease;
                }
                .notes-sidebar-item:hover { background: var(--bg-tertiary); color: var(--text-primary); }
                .notes-sidebar-item.active { background: var(--bg-tertiary); color: var(--accent-primary); font-weight: 600; }
                .notes-sidebar-item-count { margin-left: auto; font-size: 10px; opacity: 0.5; background: var(--bg-tertiary); padding: 1px 6px; border-radius: 10px; }
                .notes-sidebar-item-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .notes-sidebar-footer { padding: 12px; border-top: 1px solid var(--border-primary); }

                /* ── Note List Column (NEW) ── */
                .notes-list-column {
                    width: 210px; min-width: 180px; flex-shrink: 0;
                    border-right: 1px solid var(--border-primary);
                    display: flex; flex-direction: column;
                    background: var(--bg-secondary);
                }
                .notes-list-header {
                    padding: 12px 14px 8px; border-bottom: 1px solid var(--border-secondary);
                }
                .notes-list-header-top {
                    display: flex; align-items: center; justify-content: space-between;
                }
                .notes-list-title {
                    font-size: 12px; font-weight: 600; color: var(--text-secondary); letter-spacing: 0.02em;
                }
                .notes-list-new-btn {
                    color: var(--accent-primary) !important;
                }
                .notes-list-body {
                    flex: 1; overflow-y: auto; padding: 4px;
                }
                .notes-list-group { margin-bottom: 8px; }
                .notes-list-group-header {
                    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
                    color: var(--text-muted); padding: 8px 10px 4px; 
                }

                /* Note Row */
                .note-list-row {
                    padding: 10px 12px; border-radius: var(--radius-sm); cursor: pointer;
                    transition: all 0.15s ease; margin: 2px 4px;
                    border: 1px solid transparent;
                }
                .note-list-row:hover {
                    background: rgba(var(--accent-primary-rgb), 0.06);
                    border-color: rgba(var(--accent-primary-rgb), 0.1);
                }
                .note-list-row.active {
                    background: rgba(var(--accent-primary-rgb), 0.1);
                    border-color: rgba(var(--accent-primary-rgb), 0.2);
                }
                .note-list-row-header {
                    display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;
                }
                .note-list-row-title {
                    font-size: 13px; font-weight: 600; color: var(--text-primary);
                    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;
                }
                .note-list-row-date {
                    font-size: 10px; color: var(--text-muted); flex-shrink: 0; margin-left: 8px;
                }
                .note-list-row-snippet {
                    font-size: 11px; color: var(--text-muted); line-height: 1.4;
                    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
                    overflow: hidden; word-break: break-word;
                }
                .note-list-row-folder {
                    font-size: 10px; color: var(--text-muted); margin-top: 4px; display: flex; align-items: center; gap: 4px;
                }

                /* Empty state */
                .notes-list-empty {
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    height: 100%; gap: 10px; color: var(--text-muted); opacity: 0.7; padding: 20px;
                }
                .notes-list-empty span { font-size: 13px; }
                .btn--sm { padding: 4px 12px; font-size: 11px; }

                /* ── Editor Column ── */
                .notes-editor-column { flex: 1; display: flex; flex-direction: column; background: var(--bg-primary); min-width: 0; }
                .notes-editor-header { height: 44px; border-bottom: 1px solid var(--border-primary); display: flex; align-items: center; justify-content: space-between; padding: 0 12px; flex-shrink: 0; }
                .notes-editor-toolbar { display: flex; align-items: center; gap: 4px; }
                .notes-toolbar-group { display: flex; gap: 2px; align-items: center; padding-left: 8px; border-left: 1px solid var(--border-secondary); }
                .notes-editor-actions { display: flex; gap: 4px; align-items: center; }
                
                .notes-editor-content { 
                    flex: 1; display: flex; flex-direction: column; 
                    padding: 12px 16px;
                    width: 100%;
                    overflow-y: auto; 
                }
                .notes-editor-title-input { 
                    font-size: 24px; font-weight: 700; border: none; background: transparent; outline: none; 
                    color: var(--text-primary); width: 100%; margin-bottom: 6px;
                    font-family: var(--font-heading);
                }
                .notes-editor-metadata { font-size: 11px; color: var(--text-muted); margin-bottom: 16px; display: flex; gap: 10px; }
                .notes-no-selection { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-muted); gap: 10px; }

                /* ── Resizer ── */
                .notes-resizer { width: 4px; cursor: col-resize; background: transparent; transition: background 0.2s; flex-shrink: 0; }
                .notes-resizer:hover { background: var(--accent-primary); }

                /* ── AI Column ── */
                .notes-ai-column { 
                    border-left: 1px solid var(--border-primary); background: var(--bg-secondary);
                    display: flex; flex-direction: column; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    flex-shrink: 0;
                }
                .notes-ai-header { height: 44px; border-bottom: 1px solid var(--border-primary); display: flex; align-items: center; justify-content: space-between; padding: 0 12px; flex-shrink: 0; }
                .notes-ai-header-left { display: flex; align-items: center; gap: 6px; font-weight: 600; }
                .notes-ai-title { font-size: 13px; }
                .notes-ai-actions { display: flex; gap: 2px; }

                .notes-ai-chat { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
                .notes-ai-welcome { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px; color: var(--text-secondary); }
                .notes-ai-welcome h3 { margin-bottom: 8px; font-family: var(--font-heading); }
                .notes-ai-welcome p { font-size: 12px; line-height: 1.5; }
                
                .notes-ai-bubble-container { display: flex; width: 100%; }
                .notes-ai-bubble-container.user { justify-content: flex-end; }
                .notes-ai-bubble-container.assistant { justify-content: flex-start; }
                
                .notes-ai-bubble { max-width: 90%; padding: 8px 12px; border-radius: var(--radius-md); font-size: 12px; line-height: 1.5; }
                .notes-ai-bubble.user { background: var(--accent-primary); color: white; border-bottom-right-radius: 2px; }
                .notes-ai-bubble.assistant { background: var(--bg-tertiary); border: 1px solid var(--border-primary); color: var(--text-primary); border-bottom-left-radius: 2px; }
                
                .bubble-content { word-break: break-word; }
                .notes-ai-bubble.user .bubble-content { white-space: pre-wrap; }
                .bubble-actions { margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border-primary); }
                .btn--text { background: transparent; border: none; color: var(--accent-primary); font-size: 10px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px; }

                /* ── Markdown Typography in AI Bubbles ── */
                .notes-ai-bubble.assistant h1, .notes-ai-bubble.assistant h2, .notes-ai-bubble.assistant h3 {
                    margin: 1em 0 0.4em 0; color: var(--accent-primary); font-weight: 700; font-family: var(--font-heading);
                }
                .notes-ai-bubble.assistant h1:first-child, .notes-ai-bubble.assistant h2:first-child, .notes-ai-bubble.assistant h3:first-child { margin-top: 0; }
                .notes-ai-bubble.assistant h1 { font-size: 1.3em; border-bottom: 1px solid var(--border-primary); padding-bottom: 6px; }
                .notes-ai-bubble.assistant h2 { font-size: 1.15em; }
                .notes-ai-bubble.assistant h3 { font-size: 1.05em; }
                .notes-ai-bubble.assistant p { margin-bottom: 0.8em; }
                .notes-ai-bubble.assistant p:last-child { margin-bottom: 0; }
                .notes-ai-bubble.assistant ul, .notes-ai-bubble.assistant ol { margin-bottom: 0.8em; padding-left: 20px; }
                .notes-ai-bubble.assistant li { margin-bottom: 0.4em; }
                .notes-ai-bubble.assistant li::marker { color: var(--accent-primary); }
                .notes-ai-bubble.assistant strong { color: var(--accent-secondary); font-weight: 700; }
                .notes-ai-bubble.assistant blockquote {
                    border-left: 3px solid var(--accent-primary); margin: 12px 0; padding: 8px 12px;
                    background: rgba(var(--accent-primary-rgb), 0.05); font-style: italic; color: var(--text-secondary);
                    border-radius: 0 6px 6px 0;
                }
                .notes-ai-bubble.assistant a { color: var(--accent-primary); text-decoration: none; font-weight: 600; }

                /* Code Blocks */
                .notes-code-block {
                    margin: 10px 0; border-radius: 8px; overflow: hidden;
                    border: 1px solid var(--border-primary); background: #1e1e1e;
                }
                .notes-code-header {
                    padding: 4px 10px; font-size: 10px; font-weight: 600; color: var(--text-muted);
                    text-transform: uppercase; letter-spacing: 0.5px; background: rgba(255,255,255,0.03);
                    border-bottom: 1px solid var(--border-primary);
                }
                .notes-inline-code {
                    background: rgba(var(--accent-primary-rgb), 0.1); color: var(--accent-primary);
                    padding: 1px 5px; border-radius: 4px; font-size: 0.9em; font-family: var(--font-mono);
                }

                /* Tables */
                .notes-table-wrapper {
                    overflow-x: auto; margin: 12px 0; border-radius: 8px;
                    border: 1px solid var(--border-primary);
                }
                .notes-ai-bubble.assistant table { width: 100%; border-collapse: collapse; font-size: 11px; }
                .notes-ai-bubble.assistant th {
                    background: rgba(var(--accent-primary-rgb), 0.08); font-weight: 700;
                    color: var(--accent-primary); text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;
                    padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--border-primary);
                }
                .notes-ai-bubble.assistant td { padding: 6px 12px; border-bottom: 1px solid var(--border-secondary); }
                .notes-ai-bubble.assistant tr:last-child td { border-bottom: none; }

                .notes-ai-input-area { padding: 12px; border-top: 1px solid var(--border-primary); background: var(--bg-secondary); flex-shrink: 0; }
                .notes-ai-input-wrapper { background: var(--bg-primary); border: 1px solid var(--border-primary); border-radius: var(--radius-md); padding: 6px 10px; display: flex; gap: 10px; align-items: center; }
                .notes-ai-input-wrapper textarea { flex: 1; background: transparent; border: none; outline: none; color: var(--text-primary); font-size: 12px; resize: none; max-height: 80px; font-family: var(--font-body); }
                .notes-ai-send { background: transparent; border: none; color: var(--text-muted); cursor: pointer; transition: color 0.2s; }
                .notes-ai-send.active { color: var(--accent-primary); }
                .notes-ai-loading { font-size: 10px; color: var(--text-muted); font-style: italic; }

                .exclusive-ai-mode .notes-sidebar, .exclusive-ai-mode .notes-list-column, .exclusive-ai-mode .notes-editor-column { display: none; }
                .exclusive-ai-mode .notes-ai-column { border-left: none; width: 100% !important; }

                /* Quill Overrides */
                .ql-container.ql-snow { border: none !important; font-family: var(--font-body) !important; font-size: 14px; flex: 1; display: flex; flex-direction: column; }
                .ql-editor { padding: 0 !important; color: var(--text-primary); line-height: 1.6; flex: 1; min-height: 300px; }
                .ql-editor.ql-blank::before { color: var(--text-muted); font-style: normal; left: 0; }

                /* Context Menu */
                .notes-context-menu {
                    position: fixed; z-index: 1000;
                    background: var(--bg-tertiary); border: 1px solid var(--border-primary);
                    padding: 8px 12px; border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                    display: flex; align-items: center; gap: 8px; cursor: pointer;
                    font-size: 13px; color: var(--text-primary);
                    animation: fadeIn 0.1s ease-out;
                }
                .notes-context-menu:hover { background: var(--accent-primary); color: white; }
                .notes-context-menu .icon-pulse { animation: pulse 2s infinite; }

                /* Typing animation */
                .assistant-typing { display: flex; gap: 4px; padding: 8px; }
                .assistant-typing span {
                    width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted);
                    animation: typingDot 1.4s infinite ease-in-out both;
                }
                .assistant-typing span:nth-child(1) { animation-delay: -0.32s; }
                .assistant-typing span:nth-child(2) { animation-delay: -0.16s; }
                @keyframes typingDot {
                    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                    40% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default RooltsNotes;

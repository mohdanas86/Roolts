import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiCopy, FiCode, FiSearch } from 'react-icons/fi';
import { useSnippetStore, useFileStore, useUIStore } from '../store';
import { snippetService } from '../services/snippetService';

const SnippetPanel = () => {
    const { snippets, setSnippets, addSnippet, removeSnippet, isLoading, setLoading } = useSnippetStore();
    const { activeFileId, updateFileContent, files } = useFileStore();
    const { addNotification } = useUIStore();

    const [isCreating, setIsCreating] = useState(false);
    const [newSnippet, setNewSnippet] = useState({ title: '', content: '', language: 'javascript' });
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadSnippets();
    }, []);

    const loadSnippets = async () => {
        setLoading(true);
        try {
            const data = await snippetService.getAll();
            setSnippets(data);
        } catch (error) {
            console.error('Failed to load snippets:', error);
            addNotification({ type: 'error', message: 'Failed to load snippets' });
        }
        setLoading(false);
    };

    const handleCreate = async () => {
        if (!newSnippet.title || !newSnippet.content) return;

        try {
            const created = await snippetService.create(newSnippet);
            addSnippet(created);
            setIsCreating(false);
            setNewSnippet({ title: '', content: '', language: 'javascript' });
            addNotification({ type: 'success', message: 'Snippet created!' });
        } catch (error) {
            addNotification({ type: 'error', message: 'Failed to create snippet' });
        }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (window.confirm('Delete this snippet?')) {
            try {
                await snippetService.delete(id);
                removeSnippet(id);
                addNotification({ type: 'success', message: 'Snippet deleted' });
            } catch (error) {
                addNotification({ type: 'error', message: 'Failed to delete snippet' });
            }
        }
    };

    const handleInsert = (content) => {
        if (!activeFileId) {
            addNotification({ type: 'warning', message: 'Open a file to insert snippet' });
            return;
        }

        const activeFile = files.find(f => f.id === activeFileId);
        if (activeFile) {
            // Append to end of file for now (monaco insertion at cursor requires ref access)
            const newContent = activeFile.content + '\n' + content;
            updateFileContent(activeFileId, newContent);
            addNotification({ type: 'success', message: 'Snippet inserted!' });
        }
    };

    const filteredSnippets = snippets.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.language.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="snippet-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header" style={{ padding: '1rem', borderBottom: '1px solid var(--border-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0 }}>Snippets</h3>
                    <button
                        className="btn btn--primary btn--sm"
                        onClick={() => setIsCreating(!isCreating)}
                    >
                        {isCreating ? 'Cancel' : <><FiPlus /> New</>}
                    </button>
                </div>

                {!isCreating && (
                    <div className="search-box" style={{ position: 'relative' }}>
                        <FiSearch style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            className="input"
                            placeholder="Search snippets..."
                            style={{ paddingLeft: '32px', width: '100%' }}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                )}
            </div>

            <div className="panel-body" style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                {isCreating ? (
                    <div className="create-form">
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="label">Title</label>
                            <input
                                type="text"
                                className="input"
                                value={newSnippet.title}
                                onChange={(e) => setNewSnippet({ ...newSnippet, title: e.target.value })}
                                placeholder="e.g. React Component"
                                autoFocus
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="label">Language</label>
                            <select
                                className="input"
                                value={newSnippet.language}
                                onChange={(e) => setNewSnippet({ ...newSnippet, language: e.target.value })}
                            >
                                <option value="javascript">JavaScript</option>
                                <option value="python">Python</option>
                                <option value="java">Java</option>
                                <option value="html">HTML</option>
                                <option value="css">CSS</option>
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="label">Code</label>
                            <textarea
                                className="input"
                                value={newSnippet.content}
                                onChange={(e) => setNewSnippet({ ...newSnippet, content: e.target.value })}
                                rows={8}
                                placeholder="Paste code here..."
                                style={{ fontFamily: 'monospace' }}
                            />
                        </div>
                        <button className="btn btn--primary" style={{ width: '100%' }} onClick={handleCreate}>
                            Save Snippet
                        </button>
                    </div>
                ) : (
                    <div className="snippets-list">
                        {isLoading ? (
                            <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
                        ) : filteredSnippets.length === 0 ? (
                            <div className="empty-state" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                                <FiCode size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                                <p>No snippets found</p>
                            </div>
                        ) : (
                            filteredSnippets.map(snippet => (
                                <div key={snippet.id} className="snippet-card" style={{
                                    border: '1px solid var(--border-primary)',
                                    borderRadius: '8px',
                                    marginBottom: '1rem',
                                    background: 'var(--bg-secondary)',
                                    overflow: 'hidden'
                                }}>
                                    <div className="card-header" style={{
                                        padding: '0.75rem',
                                        borderBottom: '1px solid var(--border-primary)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        background: 'var(--bg-tertiary)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{snippet.title}</span>
                                            <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
                                                {snippet.language}
                                            </span>
                                        </div>
                                        <button
                                            className="btn btn--ghost btn--icon btn--sm"
                                            onClick={(e) => handleDelete(snippet.id, e)}
                                            style={{ color: 'var(--error)' }}
                                            title="Delete"
                                        >
                                            <FiTrash2 />
                                        </button>
                                    </div>
                                    <div className="card-body" style={{ padding: '0.75rem' }}>
                                        <pre style={{
                                            margin: 0,
                                            fontSize: '0.8rem',
                                            maxHeight: '100px',
                                            overflow: 'hidden',
                                            opacity: 0.8
                                        }}>
                                            {snippet.content}
                                        </pre>
                                    </div>
                                    <div className="card-footer" style={{ padding: '0.5rem', borderTop: '1px solid var(--border-primary)' }}>
                                        <button
                                            className="btn btn--secondary btn--sm"
                                            style={{ width: '100%' }}
                                            onClick={() => handleInsert(snippet.content)}
                                        >
                                            <FiCopy style={{ marginRight: '6px' }} /> Insert Code
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SnippetPanel;

import React, { useState, useMemo } from 'react';
import { FiSearch, FiFile, FiX } from 'react-icons/fi';
import { useFileStore } from '../store';
import { getFileIcon } from '../services/iconHelper.jsx';

const SearchPanel = () => {
    const [query, setQuery] = useState('');
    const { files, openFile } = useFileStore();

    const results = useMemo(() => {
        if (!query.trim()) return [];
        const q = query.toLowerCase();
        return files.filter(file =>
            file.name.toLowerCase().includes(q) ||
            file.content.toLowerCase().includes(q)
        );
    }, [query, files]);

    return (
        <div className="search-panel">
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-primary)' }}>
                <div style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--bg-secondary)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    border: '1px solid var(--border-primary)'
                }}>
                    <FiSearch style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
                    <input
                        type="text"
                        placeholder="Search files..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-primary)',
                            fontSize: '13px',
                            width: '100%',
                            outline: 'none'
                        }}
                        autoFocus
                    />
                    {query && (
                        <FiX
                            style={{ cursor: 'pointer', color: 'var(--text-muted)' }}
                            onClick={() => setQuery('')}
                        />
                    )}
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                {query.trim() === '' ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        Type something to search across your workspace.
                    </div>
                ) : results.length > 0 ? (
                    results.map(file => (
                        <div
                            key={file.id}
                            onClick={() => openFile(file.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '8px 16px',
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                                borderBottom: '1px solid rgba(255,255,255,0.03)'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <div style={{ marginRight: '12px', display: 'flex', alignItems: 'center' }}>
                                {getFileIcon(file.language)}
                            </div>
                            <div style={{ overflow: 'hidden' }}>
                                <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {file.name}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {file.language}
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        No results found for "{query}"
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchPanel;

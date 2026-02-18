import React, { useState } from 'react';
import {
    FiGitBranch, FiGitCommit, FiGitPullRequest, FiRefreshCw,
    FiPlus, FiCheck, FiMoreVertical, FiChevronDown, FiChevronRight
} from 'react-icons/fi';

const GitPanel = () => {
    const [commitMessage, setCommitMessage] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Current state (could be integrated with real git backend later)
    const repoInfo = {
        branch: 'main',
        staged: [],
        unstaged: [
            { name: 'main.py', status: 'modified', type: 'M' },
            { name: 'App.jsx', status: 'modified', type: 'M' },
            { name: 'styles.css', status: 'added', type: 'A' }
        ]
    };

    const handleRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 800);
    };

    return (
        <div className="git-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-secondary)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}>
                        <FiGitBranch style={{ color: 'var(--accent-primary)' }} />
                        <span style={{ opacity: 0.9 }}>{repoInfo.branch}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                            className={`btn btn--ghost btn--icon btn--sm ${isRefreshing ? 'animate-spin' : ''}`}
                            onClick={handleRefresh}
                            title="Refresh"
                        >
                            <FiRefreshCw size={14} />
                        </button>
                        <button className="btn btn--ghost btn--icon btn--sm"><FiMoreVertical size={14} /></button>
                    </div>
                </div>

                <div className="git-commit-box">
                    <textarea
                        className="input"
                        placeholder="Message (Ctrl+Enter to commit)"
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                        style={{
                            height: '70px',
                            fontSize: '12px',
                            resize: 'none',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-secondary)',
                            borderRadius: '6px',
                            padding: '8px',
                            marginBottom: '10px'
                        }}
                    />
                    <button
                        className="btn btn--primary"
                        style={{ width: '100%', fontSize: '12px', height: '32px', borderRadius: '6px', gap: '8px' }}
                        disabled={!commitMessage.trim()}
                    >
                        <FiGitCommit size={14} /> Commit
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px 4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                }}>
                    <FiChevronDown style={{ marginRight: '4px' }} />
                    Changes
                    <span style={{ marginLeft: 'auto', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '10px' }}>
                        {repoInfo.unstaged.length}
                    </span>
                </div>

                <div className="git-changes-list" style={{ marginTop: '8px' }}>
                    {repoInfo.unstaged.map(file => (
                        <div
                            key={file.name}
                            className="git-change-item"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '6px 16px',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                transition: 'background 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                <span style={{
                                    color: file.type === 'M' ? 'var(--warning)' : 'var(--success)',
                                    fontSize: '10px',
                                    fontWeight: 800,
                                    width: '12px'
                                }}>
                                    {file.type}
                                </span>
                                <span style={{
                                    fontSize: '12px',
                                    color: 'var(--text-secondary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {file.name}
                                </span>
                            </div>
                            <div className="git-item-actions" style={{ display: 'flex', gap: '2px' }}>
                                <button className="btn btn--ghost btn--icon btn--sm" title="Stage Change">
                                    <FiPlus size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {repoInfo.unstaged.length === 0 && (
                        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                            All clear! No pending changes.
                        </div>
                    )}
                </div>
            </div>

            <div style={{ padding: '16px', borderTop: '1px solid var(--border-primary)', background: 'rgba(0,0,0,0.05)' }}>
                <button className="btn btn--ghost" style={{
                    width: '100%',
                    justifyContent: 'center',
                    fontSize: '12px',
                    gap: '8px',
                    border: '1px solid var(--border-secondary)',
                    height: '36px'
                }}>
                    <FiGitPullRequest size={14} /> Sync & Push
                </button>
            </div>

            <style>{`
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default GitPanel;

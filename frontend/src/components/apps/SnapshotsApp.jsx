import React, { useRef, useState, useEffect } from 'react';
import { FiImage, FiUpload, FiTrash2, FiMaximize2, FiDownload, FiCopy, FiX } from 'react-icons/fi';
import { snapshotsDB } from '../../services/snapshotsDB';

const SnapshotsApp = ({ onBack, isWindowed = false }) => {
    const [snapshots, setSnapshots] = useState([]);
    const [selectedSnapshot, setSelectedSnapshot] = useState(null);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    // Load from DB on mount
    useEffect(() => {
        snapshotsDB.getAll().then(data => {
            if (data && data.length > 0) {
                // Sort by ID descending (newest first)
                setSnapshots(data.sort((a, b) => b.id - a.id));
            }
        });
    }, []);

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        setError('');
        let newSnaps = [];

        for (const file of files) {
            // 10MB limit per file
            if (file.size > 10 * 1024 * 1024) {
                setError(`File ${file.name} is too large (max 10MB)`);
                continue;
            }

            const reader = new FileReader();
            await new Promise(resolve => {
                reader.onload = async (ev) => {
                    const snap = {
                        id: Date.now() + Math.random(),
                        src: ev.target.result,
                        name: file.name
                    };
                    await snapshotsDB.add(snap);
                    newSnaps.push(snap);
                    resolve();
                };
                reader.readAsDataURL(file);
            });
        }

        if (newSnaps.length > 0) {
            setSnapshots(prev => [...newSnaps, ...prev]);
        }
        e.target.value = '';
    };

    const deleteSnapshot = async (id, e) => {
        if (e) e.stopPropagation();
        await snapshotsDB.delete(id);
        setSnapshots(prev => prev.filter(s => s.id !== id));
        if (selectedSnapshot?.id === id) setSelectedSnapshot(null);
    };

    const copySnapshot = async (src, e) => {
        if (e) e.stopPropagation();
        try {
            // Convert base64 to blob
            const res = await fetch(src);
            const blob = await res.blob();
            await navigator.clipboard.write([
                new ClipboardItem({ [blob.type]: blob })
            ]);
        } catch (err) {
            try {
                // Fallback to copying Data URL text
                await navigator.clipboard.writeText(src);
            } catch (err2) {
                console.error("Copy failed", err2);
            }
        }
    };

    const downloadSnapshot = (src, name, e) => {
        if (e) e.stopPropagation();
        const a = document.createElement('a');
        a.href = src;
        a.download = name || 'snapshot.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };




    const handleDragStart = (e, snapshot) => {
        // Set drag data so App.jsx can read it on drop
        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'snapshot', src: snapshot.src }));
        e.dataTransfer.effectAllowed = 'copy';
        // Optional: set a custom drag image
    };

    return (
        <div className={`app-panel ${isWindowed ? 'app-panel--windowed' : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
            <div className="app-panel-header">
                {onBack && (
                    <button className="btn btn--ghost btn--icon" onClick={onBack} title="Back">
                        <FiMaximize2 style={{ transform: 'rotate(180deg)' }} />
                    </button>
                )}
                <h3 className="app-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FiImage /> Snapshots Library
                </h3>
            </div>

            <div className="app-panel-content p-4" style={{ flex: 1, overflowY: 'auto' }}>
                {error && (
                    <div style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '4px', marginBottom: '16px', fontSize: '13px' }}>
                        {error}
                    </div>
                )}


                <div
                    className="upload-dropzone"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                        border: '2px dashed rgba(var(--accent-primary-rgb), 0.4)',
                        borderRadius: '12px',
                        padding: '32px 24px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        marginBottom: '24px',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        background: 'linear-gradient(180deg, rgba(var(--accent-primary-rgb), 0.05) 0%, rgba(var(--bg-secondary-rgb), 0) 100%)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-primary)';
                        e.currentTarget.style.background = 'rgba(var(--accent-primary-rgb), 0.1)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(var(--accent-primary-rgb), 0.4)';
                        e.currentTarget.style.background = 'linear-gradient(180deg, rgba(var(--accent-primary-rgb), 0.05) 0%, rgba(var(--bg-secondary-rgb), 0) 100%)';
                        e.currentTarget.style.transform = 'translateY(0)';
                    }}
                >
                    <FiUpload size={28} style={{ color: 'var(--accent-primary)', marginBottom: '12px' }} />
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Click or drag to upload snapshots</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Supports PNG, JPG, GIF, WebP</div>
                </div>
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                />

                <style>{`
                    .snapshots-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
                        gap: 16px;
                    }
                    .snapshot-item {
                        position: relative;
                        border-radius: 12px;
                        overflow: hidden;
                        background: var(--bg-tertiary);
                        border: 1px solid rgba(255,255,255,0.08);
                        cursor: grab;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    }
                    .snapshot-item:hover {
                        transform: translateY(-4px) scale(1.02);
                        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
                        border-color: rgba(var(--accent-primary-rgb), 0.5);
                    }
                    .snapshot-item:active {
                        cursor: grabbing;
                        transform: scale(0.95);
                    }
                    .snapshot-img {
                        width: 100%;
                        display: block;
                        object-fit: cover;
                        transition: transform 0.3s ease;
                    }
                    .snapshot-item:hover .snapshot-img {
                        transform: scale(1.05);
                    }
                    .snapshot-actions {
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0,0,0,0.6);
                        display: flex;
                        gap: 8px;
                        align-items: center;
                        justify-content: center;
                        opacity: 0;
                        transition: opacity 0.2s;
                        backdrop-filter: blur(2px);
                    }
                    .snapshot-item:hover .snapshot-actions {
                        opacity: 1;
                    }
                    .snapshot-action-btn {
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        background: rgba(255,255,255,0.1);
                        color: white;
                        border: 1px solid rgba(255,255,255,0.2);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .snapshot-action-btn:hover {
                        background: rgba(255,255,255,0.2);
                        transform: scale(1.1);
                    }
                    .snapshot-action-btn.delete:hover {
                        background: #ef4444;
                        border-color: #ef4444;
                    }
                    /* View Modal */
                    .snapshot-modal-overlay {
                        position: absolute;
                        inset: 0;
                        background: rgba(0,0,0,0.8);
                        backdrop-filter: blur(4px);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 100;
                        padding: 24px;
                    }
                    .snapshot-modal-content {
                        position: relative;
                        max-width: 100%;
                        max-height: 100%;
                        display: flex;
                        flex-direction: column;
                    }
                    .snapshot-modal-img {
                        max-width: 100%;
                        max-height: calc(100vh - 120px);
                        object-fit: contain;
                        border-radius: 8px;
                        box-shadow: 0 12px 48px rgba(0,0,0,0.5);
                    }
                    .snapshot-modal-close {
                        position: absolute;
                        top: -40px;
                        right: 0;
                        color: white;
                        background: none;
                        border: none;
                        cursor: pointer;
                        padding: 8px;
                        opacity: 0.7;
                        transition: opacity 0.2s;
                    }
                    .snapshot-modal-close:hover { opacity: 1; }
                `}</style>
                <div className="snapshots-grid">
                    {snapshots.map(snap => (
                        <div
                            key={snap.id}
                            className="snapshot-item"
                            draggable
                            onClick={() => setSelectedSnapshot(snap)}
                            onDragStart={(e) => handleDragStart(e, snap)}
                            title="Drag onto compiler, or click to view."
                        >
                            <img
                                className="snapshot-img"
                                src={snap.src}
                                alt={snap.name}
                                draggable={false}
                            />
                            <div className="snapshot-actions">
                                <button className="snapshot-action-btn" onClick={(e) => copySnapshot(snap.src, e)} title="Copy Image">
                                    <FiCopy size={14} />
                                </button>
                                <button className="snapshot-action-btn" onClick={(e) => downloadSnapshot(snap.src, snap.name, e)} title="Download">
                                    <FiDownload size={14} />
                                </button>
                                <button className="snapshot-action-btn delete" onClick={(e) => deleteSnapshot(snap.id, e)} title="Delete">
                                    <FiTrash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {snapshots.length === 0 && (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                            <FiImage size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>Your Library is Empty</div>
                            <div style={{ fontSize: '13px' }}>Upload photos or screenshots above to use them as stickers on your code!</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Full View Modal */}
            {selectedSnapshot && (
                <div className="snapshot-modal-overlay" onClick={() => setSelectedSnapshot(null)}>
                    <div className="snapshot-modal-content" onClick={e => e.stopPropagation()}>
                        <button className="snapshot-modal-close" onClick={() => setSelectedSnapshot(null)}>
                            <FiX size={24} />
                        </button>
                        <img className="snapshot-modal-img" src={selectedSnapshot.src} alt="Full View" />
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px' }}>
                            <button className="btn btn--secondary" onClick={(e) => copySnapshot(selectedSnapshot.src, e)}>
                                <FiCopy /> Copy Image
                            </button>
                            <button className="btn btn--primary" onClick={(e) => downloadSnapshot(selectedSnapshot.src, selectedSnapshot.name, e)}>
                                <FiDownload /> Download Original
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SnapshotsApp;

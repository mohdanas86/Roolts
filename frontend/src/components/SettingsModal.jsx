import React, { useState } from 'react';
import {
    FiX, FiImage, FiEdit3, FiCpu, FiStar, FiMessageSquare, FiTrash2, FiList, FiCheckCircle
} from 'react-icons/fi';
import { SiMicrosoftonedrive, SiEvernote } from 'react-icons/si';
import { useUIStore, useSettingsStore, useNotesStore } from '../store';

function SettingsModal() {
    const { modals, closeModal } = useUIStore();
    const {
        theme, backgroundImage, backgroundOpacity, format, features, experimental,
        uiFontSize, uiFontFamily, scribblePenSize, scribbleEraserSize,
        setTheme, setBackgroundImage, setBackgroundOpacity,
        setUiFontSize, setUiFontFamily,
        updateFormat, toggleFeature, setFeature, toggleExperimental, setScribbleSize
    } = useSettingsStore();

    const { selectedProvider, setProvider } = useNotesStore();
    const [activeTab, setActiveTab] = useState('theme');

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setBackgroundImage(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    if (!modals.settings) return null;

    return (
        <div className="modal-overlay">
            <div className="modal modal--large" style={{ maxWidth: '600px', height: 'auto' }}>
                <div className="modal__header">
                    <h2 className="modal__title">Settings</h2>
                    <button className="btn btn--ghost btn--icon" onClick={() => closeModal('settings')}>
                        <FiX />
                    </button>
                </div>
                <div className="modal__body" style={{ padding: 0 }}>
                    <div className="settings-container" style={{ display: 'flex', minHeight: '400px' }}>
                        {/* Settings Sidebar */}
                        <div className="settings-sidebar" style={{ width: '150px', borderRight: '1px solid var(--border-primary)', padding: '1rem 0' }}>
                            <button
                                className={`settings-tab-btn ${activeTab === 'theme' ? 'active' : ''}`}
                                onClick={() => setActiveTab('theme')}
                                style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0.75rem 1rem', background: 'none', border: 'none', color: activeTab === 'theme' ? 'var(--accent-primary)' : 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left' }}
                            >
                                <FiImage style={{ marginRight: '8px' }} /> Appearance
                            </button>
                            <button
                                className={`settings-tab-btn ${activeTab === 'format' ? 'active' : ''}`}
                                onClick={() => setActiveTab('format')}
                                style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0.75rem 1rem', background: 'none', border: 'none', color: activeTab === 'format' ? 'var(--accent-primary)' : 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left' }}
                            >
                                <FiEdit3 style={{ marginRight: '8px' }} /> Editor
                            </button>
                            <button
                                className={`settings-tab-btn ${activeTab === 'features' ? 'active' : ''}`}
                                onClick={() => setActiveTab('features')}
                                style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0.75rem 1rem', background: 'none', border: 'none', color: activeTab === 'features' ? 'var(--accent-primary)' : 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left' }}
                            >
                                <FiCpu style={{ marginRight: '8px' }} /> Features
                            </button>
                            <button
                                className={`settings-tab-btn ${activeTab === 'experimental' ? 'active' : ''}`}
                                onClick={() => setActiveTab('experimental')}
                                style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0.75rem 1rem', background: 'none', border: 'none', color: activeTab === 'experimental' ? 'var(--accent-primary)' : 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left' }}
                            >
                                <FiStar style={{ marginRight: '8px' }} /> Experimental
                            </button>
                            <button
                                className={`settings-tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
                                onClick={() => setActiveTab('notes')}
                                style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0.75rem 1rem', background: 'none', border: 'none', color: activeTab === 'notes' ? 'var(--accent-primary)' : 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left' }}
                            >
                                <FiMessageSquare style={{ marginRight: '8px' }} /> Notes
                            </button>
                        </div>

                        {/* Settings Content */}
                        <div className="settings-content" style={{ flex: 1, padding: '1.5rem' }}>
                            {activeTab === 'theme' && (
                                <div className="settings-section">
                                    <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-primary)', paddingBottom: '0.5rem' }}>Appearance</h3>

                                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                        <label>Editor Theme</label>
                                        <select
                                            className="input-select"
                                            value={theme}
                                            onChange={(e) => setTheme(e.target.value)}
                                            style={{ width: '100%' }}
                                        >
                                            <option value="vs-dark">Dark (Default)</option>
                                            <option value="light">Light</option>
                                            <option value="hc-black">High Contrast</option>
                                            <option value="nord">Nord</option>
                                            <option value="dracula">Dracula</option>
                                            <option value="solarized-light">Solarized Light</option>
                                        </select >
                                    </div >

                                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                        <label>UI Font Size ({uiFontSize}px)</label>
                                        <input
                                            type="range"
                                            min="12"
                                            max="20"
                                            value={uiFontSize}
                                            onChange={(e) => setUiFontSize(parseInt(e.target.value))}
                                            style={{ width: '100%' }}
                                        />
                                    </div>

                                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                        <label>UI Font Family</label>
                                        <select
                                            className="input-select"
                                            value={uiFontFamily}
                                            onChange={(e) => setUiFontFamily(e.target.value)}
                                            style={{ width: '100%' }}
                                        >
                                            <option value="Inter">Inter (Default)</option>
                                            <option value="Roboto">Roboto</option>
                                            <option value="Segoe UI">Segoe UI</option>
                                            <option value="Arial">Arial</option>
                                            <option value="Helvetica">Helvetica</option>
                                            <option value="'Courier New'">Courier New (Monospace)</option>
                                        </select>
                                    </div>

                                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                        <h4 style={{ fontSize: '13px', marginBottom: '8px', color: 'var(--text-secondary)' }}>Scribble Tool Sizes</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div>
                                                <label style={{ fontSize: '11px' }}>Pen Size ({scribblePenSize}px)</label>
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="10"
                                                    value={scribblePenSize}
                                                    onChange={(e) => setScribbleSize('pen', parseInt(e.target.value))}
                                                    style={{ width: '100%' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '11px' }}>Eraser Size ({scribbleEraserSize}px)</label>
                                                <input
                                                    type="range"
                                                    min="5"
                                                    max="50"
                                                    value={scribbleEraserSize}
                                                    onChange={(e) => setScribbleSize('eraser', parseInt(e.target.value))}
                                                    style={{ width: '100%' }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div >
                            )}

                            {activeTab === 'format' && (
                                <div className="settings-section">
                                    <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-primary)', paddingBottom: '0.5rem' }}>Editor Format</h3>

                                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                                        <label>Font Size ({format.fontSize}px)</label>
                                        <input
                                            type="range"
                                            min="10"
                                            max="32"
                                            value={format.fontSize}
                                            onChange={(e) => updateFormat('fontSize', parseInt(e.target.value))}
                                            style={{ width: '100%' }}
                                        />
                                    </div>

                                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                                        <label>Tab Size</label>
                                        <select
                                            className="input-select"
                                            value={format.tabSize}
                                            onChange={(e) => updateFormat('tabSize', parseInt(e.target.value))}
                                            style={{ width: '100%' }}
                                        >
                                            <option value="2">2 Spaces</option>
                                            <option value="4">4 Spaces</option>
                                            <option value="8">8 Spaces</option>
                                        </select>
                                    </div>

                                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                                        <label>Word Wrap</label>
                                        <select
                                            className="input-select"
                                            value={format.wordWrap}
                                            onChange={(e) => updateFormat('wordWrap', e.target.value)}
                                            style={{ width: '100%' }}
                                        >
                                            <option value="on">On</option>
                                            <option value="off">Off</option>
                                            <option value="wordWrapColumn">Wrap at Column</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'features' && (
                                <div className="settings-section">
                                    <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-primary)', paddingBottom: '0.5rem' }}>Features</h3>

                                    <div className="form-check" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={features.minimap}
                                            onChange={() => toggleFeature('minimap')}
                                            style={{ marginRight: '8px' }}
                                        />
                                        <label>Show Minimap</label>
                                    </div>

                                    <div className="form-check" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={features.lineNumbers === 'on'}
                                            onChange={(e) => setFeature('lineNumbers', e.target.checked ? 'on' : 'off')}
                                            style={{ marginRight: '8px' }}
                                        />
                                        <label>Show Line Numbers</label>
                                    </div>

                                    <div className="form-check" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={features.livePreview}
                                            onChange={() => toggleFeature('livePreview')}
                                            style={{ marginRight: '8px' }}
                                        />
                                        <label>Live Web Preview (Auto-open)</label>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'experimental' && (
                                <div className="settings-section" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-primary)', paddingBottom: '0.5rem' }}>Experimental Features</h3>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                        These features are in development and may be unstable.
                                    </p>

                                    <div className="form-check" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={experimental?.customBackground}
                                            onChange={() => toggleExperimental('customBackground')}
                                            style={{ marginRight: '8px' }}
                                        />
                                        <label>Custom Background Image (Experimental)</label>
                                    </div>

                                    <div className="form-check" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={experimental?.githubPanel}
                                            onChange={() => toggleExperimental('githubPanel')}
                                            style={{ marginRight: '8px' }}
                                        />
                                        <label>GitHub Integration (Experimental)</label>
                                    </div>

                                    <div className="form-check" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={experimental?.socialPanel}
                                            onChange={() => toggleExperimental('socialPanel')}
                                            style={{ marginRight: '8px' }}
                                        />
                                        <label>Social Sharing Features (LinkedIn/Twitter)</label>
                                    </div>

                                    <div className="form-check" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={experimental?.vscodeApp}
                                            onChange={() => toggleExperimental('vscodeApp')}
                                            style={{ marginRight: '8px' }}
                                        />
                                        <label>VS Code Marketplace Support</label>
                                    </div>

                                    {experimental?.customBackground && (
                                        <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-primary)', marginBottom: '1.5rem' }}>
                                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                                <label>Background Image</label>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    {backgroundImage ? (
                                                        <div style={{ position: 'relative', width: '100%', height: '150px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-primary)' }}>
                                                            <img src={backgroundImage} alt="Background" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            <button
                                                                className="btn btn--ghost btn--icon"
                                                                onClick={() => setBackgroundImage(null)}
                                                                style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(0,0,0,0.5)', color: 'white', padding: '4px' }}
                                                                title="Remove Image"
                                                            >
                                                                <FiTrash2 />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div style={{
                                                            border: '2px dashed var(--border-primary)',
                                                            borderRadius: '8px',
                                                            padding: '1.5rem',
                                                            textAlign: 'center',
                                                            cursor: 'pointer',
                                                            position: 'relative'
                                                        }}>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                onChange={handleImageUpload}
                                                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                                                            />
                                                            <FiImage size={24} style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)' }} />
                                                            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '12px' }}>Click to upload image</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label>Background Opacity ({Math.round(backgroundOpacity * 100)}%)</label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="1"
                                                    step="0.05"
                                                    value={backgroundOpacity}
                                                    onChange={(e) => setBackgroundOpacity(parseFloat(e.target.value))}
                                                    style={{ width: '100%' }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="form-check" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={experimental?.scribble}
                                            onChange={() => toggleExperimental('scribble')}
                                            style={{ marginRight: '8px' }}
                                        />
                                        <label>Scribble Feature (Canvas Overlay)</label>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'notes' && (
                                <div className="settings-section">
                                    <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-primary)', paddingBottom: '0.5rem' }}>Notes Settings</h3>
                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                                        Choose where your notes are stored.
                                    </p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {[
                                            { id: 'roolts', name: 'Roolts Notes', icon: <FiList size={20} />, description: 'Local storage, fast and private.' },
                                            { id: 'onedrive', name: 'OneDrive', icon: <SiMicrosoftonedrive size={20} />, description: 'Sync with your Microsoft account.' },
                                            { id: 'evernote', name: 'Evernote', icon: <SiEvernote size={20} />, description: 'Sync with your Evernote account.' }
                                        ].map(p => (
                                            <div
                                                key={p.id}
                                                onClick={() => setProvider(p.id)}
                                                style={{
                                                    padding: '12px 16px',
                                                    background: selectedProvider === p.id ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                                                    borderRadius: '8px',
                                                    border: `1px solid ${selectedProvider === p.id ? 'var(--accent-primary)' : 'var(--border-primary)'}`,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <div style={{ color: selectedProvider === p.id ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                                                    {p.icon}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{p.name}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{p.description}</div>
                                                </div>
                                                {selectedProvider === p.id && (
                                                    <FiCheckCircle size={16} style={{ color: 'var(--accent-primary)' }} />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div >
                    </div >
                </div >
            </div >
        </div >
    );
}

export default SettingsModal;

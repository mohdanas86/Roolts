import React, { useState } from 'react';
import {
    FiX, FiImage, FiEdit3, FiCpu, FiStar, FiMessageSquare, FiTrash2, FiList, FiCheckCircle
} from 'react-icons/fi';
import { SiMicrosoftonedrive, SiEvernote } from 'react-icons/si';
import { useUIStore, useSettingsStore, useNotesStore, useExtensionStore } from '../store';
import { adminService } from '../services/api';
import { FiLock, FiUnlock, FiKey } from 'react-icons/fi';

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
    const { installedExtensions } = useExtensionStore();
    const [activeTab, setActiveTab] = useState('theme');

    // Admin State
    const [adminPassword, setAdminPassword] = useState('');
    const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
    const [adminError, setAdminError] = useState('');
    const [adminKeys, setAdminKeys] = useState({ pollinations: '' });
    const [keysStatus, setKeysStatus] = useState({});
    const [isSavingAdmin, setIsSavingAdmin] = useState(false);

    const handleAdminUnlock = async (e) => {
        e.preventDefault();
        setAdminError('');
        try {
            const res = await adminService.verifyPassword(adminPassword);
            if (res.data.success) {
                setIsAdminUnlocked(true);
                // Fetch current key status
                const statusRes = await adminService.getKeysStatus(adminPassword);
                setKeysStatus(statusRes.data.keys || {});
            }
        } catch (err) {
            setAdminError(err.response?.data?.error || 'Invalid password');
        }
    };

    const handleSaveAdminKeys = async () => {
        setIsSavingAdmin(true);
        try {
            await adminService.updateKeys(adminPassword, adminKeys);
            const statusRes = await adminService.getKeysStatus(adminPassword);
            setKeysStatus(statusRes.data.keys || {});
            setAdminKeys({ pollinations: '' }); // Clear input field after save
            setAdminError('Saved successfully!');
            setTimeout(() => setAdminError(''), 3000);
        } catch (err) {
            setAdminError(err.response?.data?.error || 'Failed to save keys');
        } finally {
            setIsSavingAdmin(false);
        }
    };

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
                            <button
                                className={`settings-tab-btn ${activeTab === 'shortcuts' ? 'active' : ''}`}
                                onClick={() => setActiveTab('shortcuts')}
                                style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0.75rem 1rem', background: 'none', border: 'none', color: activeTab === 'shortcuts' ? 'var(--accent-primary)' : 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left' }}
                            >
                                <FiList style={{ marginRight: '8px' }} /> Shortcuts
                            </button>
                            <button
                                className={`settings-tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
                                onClick={() => setActiveTab('admin')}
                                style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0.75rem 1rem', background: 'none', border: 'none', color: activeTab === 'admin' ? 'var(--accent-primary)' : 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left', marginTop: 'auto' }}
                            >
                                <FiKey style={{ marginRight: '8px' }} /> Admin Config
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
                                            {installedExtensions.filter(ext => ext.themes && ext.themes.length > 0).map(ext => (
                                                <optgroup label={ext.displayName || ext.name} key={ext.id}>
                                                    {ext.themes.map(t => (
                                                        <option key={t.id || t.label} value={t.label || t.id}>
                                                            {t.label || t.id}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            ))}
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

                                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                                        <label>Typing Sound</label>
                                        <select
                                            className="input-select"
                                            value={useSettingsStore.getState().typingSound || 'none'}
                                            onChange={(e) => useSettingsStore.getState().setTypingSound(e.target.value)}
                                            style={{ width: '100%' }}
                                        >
                                            <option value="none">None</option>
                                            <option value="mechanical">Mechanical Keyboard</option>
                                            <option value="typewriter">Vintage Typewriter</option>
                                            <option value="click">Soft Click</option>
                                            <option value="pop">Bubbly Pop</option>
                                        </select>
                                    </div>

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
                                            checked={features.hideExtensions}
                                            onChange={() => toggleFeature('hideExtensions')}
                                            style={{ marginRight: '8px' }}
                                        />
                                        <label>Hide File Extensions</label>
                                    </div>

                                    <div className="form-check" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={features.currentLineHighlight}
                                            onChange={() => toggleFeature('currentLineHighlight')}
                                            style={{ marginRight: '8px' }}
                                        />
                                        <label>Highlight Current Line in Editor</label>
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

                                    <div className="form-check" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={features.customBackground}
                                            onChange={() => toggleFeature('customBackground')}
                                            style={{ marginRight: '8px' }}
                                        />
                                        <label>Custom Background Image</label>
                                    </div>

                                    {features.customBackground && (
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
                                            checked={features.scribble}
                                            onChange={() => toggleFeature('scribble')}
                                            style={{ marginRight: '8px' }}
                                        />
                                        <label>Scribble Feature (Canvas Overlay)</label>
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
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>More experimental features coming soon.</span>
                                        </div>
                                    </div>

                                    <div className="form-check" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', borderTop: '1px solid var(--border-primary)', paddingTop: '1rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={features.superSimpleMode}
                                            onChange={() => toggleFeature('superSimpleMode')}
                                            style={{ marginRight: '8px' }}
                                        />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <label style={{ cursor: 'pointer' }}>Super Simple Mode</label>
                                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Hides all distractions (Sidebar, Activity Bar, etc.)</span>
                                        </div>
                                    </div>

                                    <div className="form-check" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={experimental?.leetcodeMode}
                                            onChange={() => toggleExperimental('leetcodeMode')}
                                            style={{ marginRight: '8px' }}
                                        />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <label style={{ cursor: 'pointer' }}>LeetCode Mode</label>
                                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Executes Solution classes without a main block (Python).</span>
                                        </div>
                                    </div>

                                    <div className="form-check" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={experimental?.headerApps}
                                            onChange={() => toggleExperimental('headerApps')}
                                            style={{ marginRight: '8px' }}
                                        />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <label style={{ cursor: 'pointer' }}>Quick Access Header Apps</label>
                                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Shows app icons (Notes, AI, etc.) in the center of the top bar.</span>
                                        </div>
                                    </div>

                                    <div className="form-check" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={experimental?.snapshots}
                                            onChange={() => toggleExperimental('snapshots')}
                                            style={{ marginRight: '8px' }}
                                        />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <label style={{ cursor: 'pointer' }}>Snapshots Library</label>
                                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Image and sticker library in the apps grid.</span>
                                        </div>
                                    </div>

                                    <div className="form-check" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={experimental?.collaborativeHub}
                                            onChange={() => toggleExperimental('collaborativeHub')}
                                            style={{ marginRight: '8px' }}
                                        />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <label style={{ cursor: 'pointer' }}>Collaborative Hub</label>
                                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Enables the Collaboration app for remote screen control and chat.</span>
                                        </div>
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

                            {activeTab === 'shortcuts' && (
                                <div className="settings-section">
                                    <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-primary)', paddingBottom: '0.5rem' }}>Keyboard Shortcuts</h3>
                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                                        Boost your productivity with these global keyboard shortcuts.
                                    </p>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {[
                                            { key: 'F5', label: 'Run Code' },
                                            { key: 'Alt + T', label: 'Toggle Terminal Panel' },
                                            { key: 'Alt + M', label: 'Maximize/Restore Terminal' },
                                            { key: 'Alt + X', label: 'Toggle Left Sidebar' },
                                            { key: 'Ctrl + / (Cmd + /)', label: 'Toggle Line Comment (Editor)' },
                                            { key: 'Ctrl + S (Cmd + S)', label: 'Save File (Editor)' },
                                            { key: 'Shift + Alt + F', label: 'Format Document (Editor)' },
                                        ].map((shortcut, i) => (
                                            <div key={i} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '8px 12px',
                                                background: 'var(--bg-secondary)',
                                                borderRadius: '6px',
                                                border: '1px solid var(--border-primary)'
                                            }}>
                                                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{shortcut.label}</span>
                                                <kbd style={{
                                                    background: 'var(--bg-tertiary)',
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '12px',
                                                    fontFamily: 'monospace',
                                                    border: '1px solid var(--border-primary)',
                                                    boxShadow: '0 1px 1px rgba(0,0,0,0.1)'
                                                }}>{shortcut.key}</kbd>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'admin' && (
                                <div className="settings-section">
                                    <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-primary)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {isAdminUnlocked ? <FiUnlock className="text-success" /> : <FiLock className="text-warning" />} Admin Configuration
                                    </h3>

                                    {!isAdminUnlocked ? (
                                        <div style={{ background: 'var(--bg-secondary)', padding: '2rem', borderRadius: '8px', textAlign: 'center', marginTop: '2rem' }}>
                                            <FiLock size={40} style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }} />
                                            <h4 style={{ marginBottom: '1rem' }}>Master Password Required</h4>
                                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                                                System-level configuration is locked. Please enter the master password to access API keys.
                                            </p>
                                            <form onSubmit={handleAdminUnlock} style={{ display: 'flex', gap: '8px', maxWidth: '300px', margin: '0 auto', flexDirection: 'column' }}>
                                                <input
                                                    type="password"
                                                    value={adminPassword}
                                                    onChange={e => setAdminPassword(e.target.value)}
                                                    placeholder="Enter Master Password..."
                                                    className="input-field"
                                                    autoFocus
                                                />
                                                <button type="submit" className="btn btn--primary" style={{ width: '100%' }}>
                                                    Unlock
                                                </button>
                                                {adminError && <div style={{ color: 'var(--error-color)', fontSize: '12px', marginTop: '8px' }}>{adminError}</div>}
                                            </form>
                                        </div>
                                    ) : (
                                        <div>
                                            <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '6px', marginBottom: '1.5rem', borderLeft: '4px solid var(--warning-color)' }}>
                                                <p style={{ fontSize: '12px', margin: 0, color: 'var(--text-primary)' }}>
                                                    <strong>CAUTION:</strong> These keys are applied system-wide for all users. They bypass free rate limits and use direct billing. Keys are securely stored in the local encrypted vault.
                                                </p>
                                            </div>

                                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span>Pollinations API Key</span>
                                                    {keysStatus.pollinations ? (
                                                        <span style={{ fontSize: '11px', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <FiCheckCircle /> Configured
                                                        </span>
                                                    ) : (
                                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Not Set</span>
                                                    )}
                                                </label>
                                                <input
                                                    type="password"
                                                    className="input-field"
                                                    value={adminKeys.pollinations}
                                                    onChange={(e) => setAdminKeys({ ...adminKeys, pollinations: e.target.value })}
                                                    placeholder={keysStatus.pollinations ? "•••••••••••••••• (Leave blank to keep current)" : "sk-..."}
                                                    style={{ width: '100%', fontFamily: 'monospace' }}
                                                />
                                                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                                                    Required for the `Standard AI` fallback to avoid 502/504 traffic congestion errors. Use empty string to remove.
                                                </p>
                                            </div>

                                            <button
                                                className="btn btn--primary"
                                                onClick={handleSaveAdminKeys}
                                                disabled={isSavingAdmin}
                                                style={{ width: '100%', marginTop: '1rem' }}
                                            >
                                                {isSavingAdmin ? 'Saving securely to Vault...' : 'Save Configuration'}
                                            </button>

                                            {adminError && (
                                                <div style={{
                                                    background: adminError.includes('success') ? 'var(--success-color-soft, rgba(46, 204, 113, 0.1))' : 'var(--error-color-soft, rgba(231, 76, 60, 0.1))',
                                                    color: adminError.includes('success') ? 'var(--success-color)' : 'var(--error-color)',
                                                    padding: '12px',
                                                    borderRadius: '6px',
                                                    marginTop: '1rem',
                                                    fontSize: '13px',
                                                    textAlign: 'center'
                                                }}>
                                                    {adminError}
                                                </div>
                                            )}
                                        </div>
                                    )}
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

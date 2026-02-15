import React, { useState } from 'react';
import { FiDownload, FiEye, FiLayout, FiCheck, FiX } from 'react-icons/fi';
import { useUIStore, useFileStore } from '../store';
import api from '../services/api';

const PortfolioGenerator = () => {
    const { closeModal } = useUIStore();
    const { files } = useFileStore();

    // Default data
    const [formData, setFormData] = useState({
        name: 'User Name',
        tagline: 'Full Stack Developer | AI Enthusiast',
        bio: 'I build scalable web applications and explore the frontiers of AI.',
        skills: 'React, Node.js, Python, TypeScript, AI/ML',
        projects: [
            { name: 'Roolts', description: 'AI-Powered Code Editor', link: '#' }
        ],
        primaryColor: '#3b82f6',
        isDark: false
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleProjectChange = (index, field, value) => {
        const newProjects = [...formData.projects];
        newProjects[index][field] = value;
        setFormData(prev => ({ ...prev, projects: newProjects }));
    };

    const addProject = () => {
        setFormData(prev => ({
            ...prev,
            projects: [...prev.projects, { name: '', description: '', link: '' }]
        }));
    };

    const removeProject = (index) => {
        setFormData(prev => ({
            ...prev,
            projects: prev.projects.filter((_, i) => i !== index)
        }));
    };

    const getPayload = () => ({
        ...formData,
        skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean)
    });

    const handlePreview = async () => {
        setIsGenerating(true);
        try {
            const response = await api.post('/portfolio/preview', getPayload());
            const blob = new Blob([response.data.html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
        } catch (error) {
            console.error('Preview failed:', error);
            alert('Failed to generate preview');
        }
        setIsGenerating(false);
    };

    const handleDownload = async () => {
        setIsGenerating(true);
        try {
            const response = await api.post('/portfolio/download', getPayload(), { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'portfolio.zip');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Download failed:', error);
            alert('Failed to download portfolio');
        }
        setIsGenerating(false);
    };

    return (
        <div className="portfolio-generator premium-glass" style={{ display: 'flex', height: '100%', gap: '0' }}>
            {/* Configuration Form */}
            <div className="config-panel" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="premium-header" style={{ background: 'transparent', padding: '0 0 1.5rem 0', border: 'none' }}>
                    <div className="brand-badge">
                        <FiLayout className="brand-badge__icon" />
                        <span>Portfolio Builder</span>
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="label">Full Name</label>
                    <input
                        className="premium-input-container"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px', width: '100%', color: 'var(--text-primary)' }}
                        value={formData.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                    />
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="label">Tagline</label>
                    <input
                        className="premium-input-container"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px', width: '100%', color: 'var(--text-primary)' }}
                        value={formData.tagline}
                        onChange={(e) => handleChange('tagline', e.target.value)}
                    />
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="label">Bio</label>
                    <textarea
                        className="premium-input-container"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px', width: '100%', color: 'var(--text-primary)', minHeight: '100px' }}
                        rows={4}
                        value={formData.bio}
                        onChange={(e) => handleChange('bio', e.target.value)}
                    />
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="label">Skills</label>
                    <input
                        className="premium-input-container"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px', width: '100%', color: 'var(--text-primary)' }}
                        value={formData.skills}
                        placeholder="React, Node.js, AI..."
                        onChange={(e) => handleChange('skills', e.target.value)}
                    />
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                    <div className="label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span>Project Showcases</span>
                        <button className="icon-btn" onClick={addProject} title="Add Project" style={{ background: 'var(--bg-elevated)', width: '30px', height: '30px' }}>+</button>
                    </div>
                    {formData.projects.map((proj, i) => (
                        <div key={i} className="premium-card" style={{
                            marginBottom: '1rem',
                            position: 'relative',
                            background: 'rgba(255,255,255,0.02)'
                        }}>
                            <button
                                onClick={() => removeProject(i)}
                                className="icon-btn"
                                style={{
                                    position: 'absolute', right: '8px', top: '8px',
                                    width: '24px', height: '24px', background: 'rgba(248, 81, 73, 0.1)', color: 'var(--error)'
                                }}
                            >
                                <FiX size={14} />
                            </button>
                            <div className="premium-card__body" style={{ padding: '1rem', paddingTop: '1.5rem' }}>
                                <input
                                    className="premium-input-container"
                                    placeholder="Project Name"
                                    style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '8px', width: '100%', color: 'var(--text-primary)', marginBottom: '0.75rem' }}
                                    value={proj.name}
                                    onChange={(e) => handleProjectChange(i, 'name', e.target.value)}
                                />
                                <input
                                    className="premium-input-container"
                                    placeholder="Brief Description"
                                    style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '8px', width: '100%', color: 'var(--text-primary)' }}
                                    value={proj.description}
                                    onChange={(e) => handleProjectChange(i, 'description', e.target.value)}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="form-group" style={{ marginBottom: '2rem' }}>
                    <label className="label">Customization</label>
                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', padding: '1rem', background: 'var(--bg-elevated)', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                type="color"
                                value={formData.primaryColor}
                                onChange={(e) => handleChange('primaryColor', e.target.value)}
                                style={{ width: '32px', height: '32px', padding: 0, border: '2px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '0.85rem' }}>Accent</span>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                style={{ width: '18px', height: '18px' }}
                                checked={formData.isDark}
                                onChange={(e) => handleChange('isDark', e.target.checked)}
                            />
                            <span style={{ fontSize: '0.85rem' }}>Dark Theme</span>
                        </label>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        className="premium-send-btn"
                        onClick={handlePreview}
                        disabled={isGenerating}
                        style={{ flex: 1, height: '45px' }}
                    >
                        <FiEye /> <span>Preview</span>
                    </button>
                    <button
                        className="btn btn--secondary"
                        onClick={handleDownload}
                        disabled={isGenerating}
                        style={{ flex: 1, borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                        <FiDownload /> Download ZIP
                    </button>
                </div>
            </div>

            {/* Preview Panel */}
            <div className="preview-panel" style={{ flex: 1.2, background: '#0a0c10', position: 'relative' }}>
                {previewUrl ? (
                    <iframe
                        src={previewUrl}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        title="Portfolio Preview"
                    />
                ) : (
                    <div className="welcome-hero" style={{ height: '100%', padding: '2rem' }}>
                        <div className="welcome-hero__visual">
                            <div className="glow-orb" style={{ opacity: 0.3 }}></div>
                            <FiLayout size={48} className="floating-icon" style={{ opacity: 0.5 }} />
                        </div>
                        <h2>Site Preview</h2>
                        <p>Adjust the details on the left and click "Preview" to see your professional portfolio site in real-time.</p>
                    </div>
                )}
                {isGenerating && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                        <FiActivity className="spin" size={32} color="var(--accent-primary)" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default PortfolioGenerator;

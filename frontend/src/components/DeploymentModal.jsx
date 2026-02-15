import React, { useState } from 'react';
import { FiCloud, FiCheck, FiX } from 'react-icons/fi';
import { useUIStore, useFileStore } from '../store';
import api from '../services/api';

const DeploymentModal = () => {
    const { closeModal, addNotification } = useUIStore();
    const { addFile } = useFileStore();

    const [platform, setPlatform] = useState('vercel');
    const [framework, setFramework] = useState('static');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const response = await api.post('/deployment/generate-config', {
                platform,
                framework
            });

            const { filename, content } = response.data;

            // Add config file to file store
            addFile(filename, content, 'json');

            addNotification({
                type: 'success',
                message: `${filename} created! Ready for deployment.`
            });

            closeModal('deployment');
        } catch (error) {
            console.error('Failed to generate config:', error);
            addNotification({
                type: 'error',
                message: 'Failed to generate deployment config'
            });
        }
        setIsGenerating(false);
    };

    return (
        <div className="deployment-modal" style={{ padding: '1rem' }}>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="label">Platform</label>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    <button
                        className={`btn ${platform === 'vercel' ? 'btn--primary' : 'btn--secondary'}`}
                        onClick={() => setPlatform('vercel')}
                        style={{ flex: 1 }}
                    >
                        {platform === 'vercel' && <FiCheck style={{ marginRight: '6px' }} />}
                        Vercel
                    </button>
                    <button
                        className={`btn ${platform === 'netlify' ? 'btn--primary' : 'btn--secondary'}`}
                        onClick={() => setPlatform('netlify')}
                        style={{ flex: 1 }}
                    >
                        {platform === 'netlify' && <FiCheck style={{ marginRight: '6px' }} />}
                        Netlify
                    </button>
                </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="label">Framework</label>
                <select
                    className="input"
                    value={framework}
                    onChange={(e) => setFramework(e.target.value)}
                >
                    <option value="static">Static HTML/CSS</option>
                    <option value="react">React (Vite)</option>
                    <option value="python">Python (Flask)</option>
                </select>
            </div>

            <div className="info-box" style={{
                background: 'var(--bg-tertiary)',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                fontSize: '0.9rem',
                lineHeight: '1.6'
            }}>
                <strong>Next Steps:</strong>
                <ol style={{ margin: '0.5rem 0 0 1.2rem', padding: 0 }}>
                    <li>Click "Generate Config" to create the deployment file</li>
                    <li>Push your project to GitHub</li>
                    <li>Connect your GitHub repo to {platform === 'vercel' ? 'Vercel' : 'Netlify'}</li>
                    <li>Your site will auto-deploy!</li>
                </ol>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                    className="btn btn--secondary"
                    onClick={() => closeModal('deployment')}
                    style={{ flex: 1 }}
                >
                    Cancel
                </button>
                <button
                    className="btn btn--primary"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    style={{ flex: 1 }}
                >
                    {isGenerating ? 'Generating...' : <><FiCloud /> Generate Config</>}
                </button>
            </div>
        </div>
    );
};

export default DeploymentModal;

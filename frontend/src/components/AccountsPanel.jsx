import React, { useState, useEffect } from 'react';
import { FiUser, FiMail, FiTwitter, FiLinkedin, FiLogOut, FiExternalLink, FiCheckCircle } from 'react-icons/fi';
import { authService } from '../services/authService';
import { useUIStore } from '../store';

const AccountsPanel = () => {
    const [user, setUser] = useState(authService.getCurrentUser());
    const [connections, setConnections] = useState([]);
    const { addNotification } = useUIStore();

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const profile = await authService.getProfile();
                setUser(profile);
                const socialConnections = await authService.getConnections();
                setConnections(socialConnections);
            } catch (error) {
                console.error('Error fetching profile:', error);
            }
        };

        if (authService.isAuthenticated()) {
            fetchProfile();
        }
    }, []);

    const handleLogout = () => {
        authService.logout();
        addNotification({ type: 'info', message: 'Logged out successfully' });
        window.location.reload();
    };

    if (!user) {
        return (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <FiUser size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                <h4 style={{ marginBottom: '8px' }}>Not Signed In</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                    Sign in to sync your work across devices and connect social accounts.
                </p>
                <button
                    className="btn btn--primary"
                    style={{ width: '100%' }}
                    onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal'))}
                >
                    Sign In / Register
                </button>
            </div>
        );
    }

    return (
        <div className="accounts-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '24px 16px', textAlign: 'center', borderBottom: '1px solid var(--border-primary)' }}>
                <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: 'var(--accent-primary)',
                    margin: '0 auto 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    color: 'white',
                    fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}>
                    {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                </div>
                <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>{user.name || 'User'}</h3>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <FiMail size={12} />
                    {user.email}
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px', letterSpacing: '0.05em' }}>
                    Connected Accounts
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{
                        padding: '12px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        border: '1px solid var(--border-primary)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <FiTwitter style={{ color: '#1DA1F2' }} />
                            <span style={{ fontSize: '13px' }}>Twitter / X</span>
                        </div>
                        {connections.includes('twitter') ? (
                            <FiCheckCircle style={{ color: 'var(--success)' }} />
                        ) : (
                            <button className="btn btn--ghost btn--sm" style={{ fontSize: '11px' }}>Connect</button>
                        )}
                    </div>

                    <div style={{
                        padding: '12px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        border: '1px solid var(--border-primary)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <FiLinkedin style={{ color: '#0A66C2' }} />
                            <span style={{ fontSize: '13px' }}>LinkedIn</span>
                        </div>
                        {connections.includes('linkedin') ? (
                            <FiCheckCircle style={{ color: 'var(--success)' }} />
                        ) : (
                            <button className="btn btn--ghost btn--sm" style={{ fontSize: '11px' }}>Connect</button>
                        )}
                    </div>
                </div>

                <div style={{ marginTop: '24px' }}>
                    <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px', letterSpacing: '0.05em' }}>
                        Actions
                    </h4>
                    <button className="btn btn--ghost" style={{ width: '100%', justifyContent: 'flex-start', gap: '10px', fontSize: '13px', padding: '10px 12px' }}>
                        <FiExternalLink /> View Portfolio
                    </button>
                </div>
            </div>

            <div style={{ padding: '16px', borderTop: '1px solid var(--border-primary)' }}>
                <button
                    className="btn btn--secondary"
                    style={{ width: '100%', gap: '8px', color: 'var(--error)' }}
                    onClick={handleLogout}
                >
                    <FiLogOut /> Logout
                </button>
            </div>
        </div>
    );
};

export default AccountsPanel;

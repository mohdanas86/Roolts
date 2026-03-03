import React, { useState, useEffect } from 'react';
import { FiUser, FiMail, FiTwitter, FiLinkedin, FiLogOut, FiExternalLink, FiCheckCircle } from 'react-icons/fi';
import { authService } from '../services/authService';
import { useUIStore } from '../store';

const AccountsPanel = () => {
    const [user, setUser] = useState(authService.getCurrentUser());
    const [connections, setConnections] = useState([]);
    const addNotification = useUIStore(state => state.addNotification);

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
    }, [authService.getCurrentUser()?.id]);

    const handleLogout = () => {
        authService.logout();
        addNotification({ type: 'info', message: 'Logged out successfully' });
        window.location.reload();
    };

    return (
        <div className="accounts-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {user ? (
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
            ) : (
                <div style={{ padding: '24px 16px', textAlign: 'center', borderBottom: '1px solid var(--border-primary)' }}>
                    <FiUser size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                    <h4 style={{ marginBottom: '8px' }}>Sign in to Roolts</h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        Connect an account below to sync your progress!
                    </p>
                </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px', letterSpacing: '0.05em' }}>
                    Connected Accounts
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

                    {/* Google Connection */}
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
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            <span style={{ fontSize: '13px' }}>Google</span>
                        </div>
                        {connections.includes('google') ? (
                            <FiCheckCircle style={{ color: 'var(--success)' }} />
                        ) : (
                            <button
                                className="btn btn--ghost btn--sm"
                                style={{ fontSize: '11px' }}
                                onClick={async () => {
                                    try {
                                        const url = await authService.connectGoogle();
                                        // Open in popup to prevent losing App state
                                        const width = 500;
                                        const height = 600;
                                        const left = window.screen.width / 2 - width / 2;
                                        const top = window.screen.height / 2 - height / 2;
                                        window.open(url, 'Google Auth', `width=${width},height=${height},left=${left},top=${top}`);
                                    } catch (err) {
                                        addNotification({ type: 'error', message: 'Failed to initiate Google sign-in' });
                                    }
                                }}
                            >
                                Connect
                            </button>
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

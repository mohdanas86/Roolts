import React from 'react';
import { FiX } from 'react-icons/fi';
import { useUIStore } from '../store';
import AccountsPanel from './AccountsPanel';

const AuthModal = () => {
    const { modals, closeModal } = useUIStore();

    if (!modals.auth) return null;

    return (
        <div className="modal-overlay" onClick={() => closeModal('auth')}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '400px', maxWidth: '90vw', height: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal__header">
                    <h2 className="modal__title">Account</h2>
                    <button className="btn btn--ghost btn--icon" onClick={() => closeModal('auth')}>
                        <FiX />
                    </button>
                </div>
                <div className="modal__body" style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
                    <AccountsPanel />
                </div>
            </div>
        </div>
    );
};

export default AuthModal;

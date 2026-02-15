import React from 'react';
import { FiCheckCircle, FiAlertCircle, FiX } from 'react-icons/fi';
import { useUIStore } from '../store';

function Notifications() {
    const { notifications, removeNotification } = useUIStore();

    return (
        <div className="notifications-container" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {notifications.map((notification) => (
                <div
                    key={notification.id}
                    className={`notification notification--${notification.type}`}
                >
                    {notification.type === 'success' && <FiCheckCircle style={{ color: 'var(--success)' }} />}
                    {notification.type === 'error' && <FiAlertCircle style={{ color: 'var(--error)' }} />}
                    <span>{notification.message}</span>
                    <button
                        className="btn btn--ghost btn--icon"
                        onClick={() => removeNotification(notification.id)}
                        style={{ marginLeft: 'auto' }}
                    >
                        <FiX size={14} />
                    </button>
                </div>
            ))}
        </div>
    );
}

export default Notifications;

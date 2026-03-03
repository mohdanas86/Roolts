import React, { useState, useEffect } from 'react';
import { FiX, FiRefreshCw, FiExternalLink } from 'react-icons/fi';

const BrowserPreview = ({ url, onClose }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [key, setKey] = useState(0);

    const handleRefresh = () => {
        setIsLoading(true);
        setKey(prev => prev + 1);
    };

    const handleOpenExternal = () => {
        if (url) {
            window.open(url, '_blank');
        }
    };

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#fff' }}>
            {/* Browser Address Bar / Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 12px',
                background: '#f1f1f1',
                borderBottom: '1px solid #ddd',
                gap: '8px'
            }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                        onClick={handleRefresh}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '4px',
                            color: '#555'
                        }}
                        title="Refresh"
                        onMouseEnter={e => e.currentTarget.style.background = '#e0e0e0'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <FiRefreshCw size={14} />
                    </button>
                    <button
                        onClick={handleOpenExternal}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '4px',
                            color: '#555'
                        }}
                        title="Open in New Tab"
                        onMouseEnter={e => e.currentTarget.style.background = '#e0e0e0'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <FiExternalLink size={14} />
                    </button>
                </div>

                {/* Address Bar */}
                <div style={{
                    flex: 1,
                    background: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    padding: '4px 12px',
                    fontSize: '12px',
                    color: '#333',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    userSelect: 'all'
                }}>
                    {url || 'about:blank'}
                </div>

                {onClose && (
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '4px',
                            color: '#666'
                        }}
                        title="Close Preview"
                        onMouseEnter={e => e.currentTarget.style.background = '#e0e0e0'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <FiX size={16} />
                    </button>
                )}
            </div>

            {/* Iframe Content */}
            <div style={{ flex: 1, position: 'relative' }}>
                {isLoading && (
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: '#fff', zIndex: 10, color: '#666'
                    }}>
                        <span className="spinner" style={{ marginRight: '8px', width: '16px', height: '16px' }}></span>
                        Connecting to application...
                    </div>
                )}
                {url ? (
                    <iframe
                        key={key}
                        src={url}
                        title="Application Preview"
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
                        onLoad={() => setIsLoading(false)}
                        onError={() => setIsLoading(false)}
                    />
                ) : (
                    <div style={{
                        width: '100%', height: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#999', background: '#f9f9f9'
                    }}>
                        No application running
                    </div>
                )}
            </div>
        </div>
    );
};

export default BrowserPreview;

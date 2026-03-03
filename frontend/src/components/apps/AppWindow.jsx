import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { FiX, FiSquare, FiMinus, FiMaximize2 } from 'react-icons/fi';

const AppWindow = ({ id, title, icon, onClose, children, zIndex = 10, initialSize = { w: 600, h: 400 }, initialPosition = { x: 50, y: 50 } }) => {
    // ... (state hooks same as before) ...
    const [isMaximized, setIsMaximized] = useState(false);
    const [position, setPosition] = useState(initialPosition);
    const [size, setSize] = useState(initialSize);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Previous state to restore after minimize/maximize
    const prevBounds = useRef({ position: initialPosition, size: initialSize });
    const windowRef = useRef(null);

    const toggleMaximize = () => {
        if (!isMaximized) {
            prevBounds.current = { position, size };
            setIsMaximized(true);
        } else {
            setPosition(prevBounds.current.position);
            setSize(prevBounds.current.size);
            setIsMaximized(false);
        }
    };

    // Drag Logic
    const handleMouseDown = (e) => {
        if (isMaximized) return;
        if (e.target.closest('.window-controls')) return;

        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    // Resize Logic
    const handleResizeMouseDown = (e) => {
        e.stopPropagation();
        setIsResizing(true);
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDragging) {
                const newX = e.clientX - dragOffset.x;
                const newY = e.clientY - dragOffset.y;
                setPosition({ x: newX, y: newY });
            }

            if (isResizing) {
                const newWidth = Math.max(300, e.clientX - position.x);
                const newHeight = Math.max(200, e.clientY - position.y);
                setSize({ w: newWidth, h: newHeight });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setIsResizing(false);
        };

        if (isDragging || isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing, dragOffset, position]);

    const windowStyle = isMaximized ? {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: zIndex + 100, // Ensure maximized is on top but respects base
        borderRadius: 0
    } : {
        position: 'absolute',
        top: position.y,
        left: position.x,
        width: size.w,
        height: size.h,
        zIndex: zIndex,
        borderRadius: '8px'
    };

    return ReactDOM.createPortal(
        <div
            ref={windowRef}
            style={{
                ...windowStyle,
                backgroundColor: 'var(--bg-primary)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: isDragging || isResizing ? 'none' : 'width 0.2s, height 0.2s, top 0.2s, left 0.2s'
            }}
        >
            {/* Window Header */}
            <div
                onMouseDown={handleMouseDown}
                style={{
                    height: '40px',
                    backgroundColor: 'rgba(30, 30, 30, 0.95)',
                    backdropFilter: 'blur(10px)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 16px',
                    cursor: isMaximized ? 'default' : 'grab',
                    userSelect: 'none',
                    position: 'relative'
                }}
            >
                {/* Traffic Light Controls */}
                <div className="window-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 10 }}>
                    <div
                        onClick={onClose}
                        style={{
                            width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff5f56',
                            cursor: 'pointer', boxShadow: '0 0 0 1px rgba(0,0,0,0.1) inset'
                        }}
                        className="mac-btn"
                        title="Close"
                    />
                    <div
                        onClick={toggleMaximize}
                        style={{
                            width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#28c840',
                            cursor: 'pointer', boxShadow: '0 0 0 1px rgba(0,0,0,0.1) inset'
                        }}
                        className="mac-btn"
                        title={isMaximized ? "Restore" : "Maximize"}
                    />
                </div>

                {/* Centered Title */}
                <div style={{ position: 'absolute', left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    {icon && <span style={{ marginRight: '8px', display: 'flex', alignItems: 'center', opacity: 0.9, color: 'var(--text-primary)' }}>{icon}</span>}
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>{title}</span>
                </div>
            </div>

            {/* Window Content */}
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {children}
            </div>

            {/* Resize Handle */}
            {!isMaximized && (
                <div
                    onMouseDown={handleResizeMouseDown}
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: '15px',
                        height: '15px',
                        cursor: 'se-resize',
                        zIndex: 20
                    }}
                />
            )}

            <style>{`
                .mac-btn:hover { filter: brightness(0.8); }
            `}</style>
        </div>,
        document.body
    );
};

export default AppWindow;

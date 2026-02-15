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
                    backgroundColor: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 10px',
                    cursor: isMaximized ? 'default' : 'grab',
                    userSelect: 'none'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {icon}
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>{title}</span>
                </div>

                <div className="window-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                        onClick={toggleMaximize}
                        style={{ cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                        className="hover-bg"
                    >
                        {isMaximized ? <FiMinus size={14} /> : <FiSquare size={12} />}
                    </div>
                    <div
                        onClick={onClose}
                        style={{ cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                        className="hover-bg-danger"
                    >
                        <FiX size={14} />
                    </div>
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
                .hover-bg:hover { background-color: rgba(255,255,255,0.1); }
                .hover-bg-danger:hover { background-color: var(--color-danger); color: white; }
            `}</style>
        </div>,
        document.body
    );
};

export default AppWindow;

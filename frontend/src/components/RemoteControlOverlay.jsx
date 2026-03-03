import React, { useEffect, useRef, useState } from 'react';
import { collaborationService } from '../services/collaborationService';
import { FiMousePointer } from 'react-icons/fi';

/**
 * RemoteControlOverlay - Handles remote control functionality
 * 
 * When user has control: Captures mouse/keyboard and sends to remote
 * When being controlled: Shows remote cursor and executes remote actions
 */
const RemoteControlOverlay = ({ isController, isBeingControlled, onControlEnd }) => {
    const [remoteCursor, setRemoteCursor] = useState({ x: 0, y: 0, visible: false });
    const overlayRef = useRef(null);

    useEffect(() => {
        if (isBeingControlled) {
            // Listen for remote control events
            collaborationService.onRemoteMouseMove = ({ percentX, percentY }) => {
                const x = (percentX / 100) * window.innerWidth;
                const y = (percentY / 100) * window.innerHeight;
                setRemoteCursor({ x, y, visible: true });
            };

            collaborationService.onRemoteClick = ({ percentX, percentY, button }) => {
                const x = (percentX / 100) * window.innerWidth;
                const y = (percentY / 100) * window.innerHeight;

                // Find element at position and simulate click
                const element = document.elementFromPoint(x, y);
                if (element) {
                    // Visual feedback
                    setRemoteCursor(prev => ({ ...prev, clicking: true }));
                    setTimeout(() => setRemoteCursor(prev => ({ ...prev, clicking: false })), 150);

                    // Trigger click
                    element.click();
                    element.focus?.();
                }
            };

            collaborationService.onRemoteKeyPress = ({ key, code, modifiers }) => {
                const activeElement = document.activeElement;
                if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
                    // For regular text input
                    if (key.length === 1 && !modifiers.ctrlKey && !modifiers.metaKey) {
                        // Insert character
                        const event = new InputEvent('input', {
                            bubbles: true,
                            cancelable: true,
                            inputType: 'insertText',
                            data: key
                        });

                        // For input/textarea, update value directly
                        if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
                            const start = activeElement.selectionStart || 0;
                            const end = activeElement.selectionEnd || 0;
                            const value = activeElement.value;
                            activeElement.value = value.slice(0, start) + key + value.slice(end);
                            activeElement.selectionStart = activeElement.selectionEnd = start + 1;
                            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    } else if (key === 'Backspace') {
                        if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
                            const start = activeElement.selectionStart || 0;
                            const end = activeElement.selectionEnd || 0;
                            const value = activeElement.value;
                            if (start === end && start > 0) {
                                activeElement.value = value.slice(0, start - 1) + value.slice(end);
                                activeElement.selectionStart = activeElement.selectionEnd = start - 1;
                            } else {
                                activeElement.value = value.slice(0, start) + value.slice(end);
                                activeElement.selectionStart = activeElement.selectionEnd = start;
                            }
                            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    } else if (key === 'Enter') {
                        activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
                    }
                }

                // For Monaco editor, dispatch keyboard event
                const monacoEditor = document.querySelector('.monaco-editor textarea');
                if (monacoEditor) {
                    const keyEvent = new KeyboardEvent('keydown', {
                        key,
                        code,
                        bubbles: true,
                        ctrlKey: modifiers.ctrlKey || false,
                        shiftKey: modifiers.shiftKey || false,
                        altKey: modifiers.altKey || false,
                        metaKey: modifiers.metaKey || false
                    });
                    monacoEditor.dispatchEvent(keyEvent);

                    if (key.length === 1 && !modifiers.ctrlKey && !modifiers.metaKey) {
                        monacoEditor.dispatchEvent(new InputEvent('input', {
                            bubbles: true,
                            data: key,
                            inputType: 'insertText'
                        }));
                    }
                }
            };

            collaborationService.onRemoteScroll = ({ deltaX, deltaY }) => {
                window.scrollBy(deltaX, deltaY);
            };
        }

        return () => {
            collaborationService.onRemoteMouseMove = null;
            collaborationService.onRemoteClick = null;
            collaborationService.onRemoteKeyPress = null;
            collaborationService.onRemoteScroll = null;
        };
    }, [isBeingControlled]);

    // Controller mode: Capture events and send to remote
    useEffect(() => {
        if (!isController) return;

        const handleMouseMove = (e) => {
            const percentX = (e.clientX / window.innerWidth) * 100;
            const percentY = (e.clientY / window.innerHeight) * 100;
            collaborationService.sendMouseMove(e.clientX, e.clientY, percentX, percentY);
        };

        const handleClick = (e) => {
            const percentX = (e.clientX / window.innerWidth) * 100;
            const percentY = (e.clientY / window.innerHeight) * 100;
            collaborationService.sendClick(e.clientX, e.clientY, percentX, percentY, e.button);
        };

        const handleKeyDown = (e) => {
            // Don't capture if typing in local inputs while controlling
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            e.preventDefault();
            collaborationService.sendKeyPress(e.key, e.code, {
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                altKey: e.altKey,
                metaKey: e.metaKey
            });
        };

        const handleScroll = (e) => {
            collaborationService.sendScroll(e.deltaX, e.deltaY);
        };

        // Add event listeners
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('click', handleClick);
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('wheel', handleScroll);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('click', handleClick);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('wheel', handleScroll);
        };
    }, [isController]);

    // Don't render anything if not in control mode
    if (!isController && !isBeingControlled) return null;

    return (
        <>
            {/* Remote cursor indicator (when being controlled) */}
            {isBeingControlled && remoteCursor.visible && (
                <div
                    style={{
                        position: 'fixed',
                        left: remoteCursor.x,
                        top: remoteCursor.y,
                        transform: 'translate(-2px, -2px)',
                        pointerEvents: 'none',
                        zIndex: 99999,
                        // Add linear interpolation so it smoothly glides between the 30ms updates
                        transition: 'left 0.1s linear, top 0.1s linear'
                    }}
                >
                    <div style={{
                        width: '20px',
                        height: '20px',
                        position: 'relative'
                    }}>
                        {/* Cursor icon */}
                        <FiMousePointer
                            size={20}
                            color="#e74c3c"
                            style={{
                                filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.5))',
                                transform: remoteCursor.clicking ? 'scale(0.8)' : 'scale(1)',
                                transition: 'transform 0.1s'
                            }}
                        />
                        {/* Click ripple effect */}
                        {remoteCursor.clicking && (
                            <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                border: '2px solid #e74c3c',
                                transform: 'translate(-50%, -50%)',
                                animation: 'ripple 0.3s ease-out'
                            }} />
                        )}
                    </div>
                    <span style={{
                        position: 'absolute',
                        top: '20px',
                        left: '10px',
                        backgroundColor: '#e74c3c',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '10px',
                        whiteSpace: 'nowrap'
                    }}>
                        Remote
                    </span>
                </div>
            )}

            {isController && (
                <div style={{
                    position: 'fixed',
                    bottom: '30px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.95), rgba(39, 174, 96, 0.95))',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    color: 'white',
                    padding: '10px 24px',
                    borderRadius: '30px',
                    fontSize: '14px',
                    fontWeight: '600',
                    zIndex: 99999,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: '0 8px 32px rgba(46, 204, 113, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    animation: 'slideUp 0.3s ease-out'
                }}>
                    <FiMousePointer size={16} />
                    Controlling remote screen
                    <div style={{
                        marginLeft: '8px',
                        padding: '4px 8px',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: '12px',
                        fontSize: '11px',
                        letterSpacing: '0.5px'
                    }}>
                        Press ESC to stop
                    </div>
                </div>
            )}

            <style>{`
                @keyframes ripple {
                    0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
                    100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
                }
                @keyframes slideUp {
                    from { transform: translate(-50%, 20px); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
            `}</style>
        </>
    );
};

export default RemoteControlOverlay;

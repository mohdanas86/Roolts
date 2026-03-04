/**
 * GUIViewer.jsx
 * Renders live GUI frames (base64 PNG) streamed from the backend onto a <canvas>.
 *
 * Hard rule compliance: base64 frame data is NEVER stored in React state.
 * Frames are drawn directly onto the canvas imperatively via the `drawFrame`
 * method exposed through a forwarded ref (forwardRef + useImperativeHandle).
 *
 * Usage (parent example):
 *   const guiViewerRef = useRef(null);
 *   // on frame: guiViewerRef.current?.drawFrame(base64string)
 *   <GUIViewer ref={guiViewerRef} isRunning={...} finished={...} error={...} onStop={...} />
 */

import React, {
    forwardRef,
    useImperativeHandle,
    useRef,
    useCallback,
} from 'react';
import { FiSquare, FiAlertCircle, FiMonitor } from 'react-icons/fi';

const GUIViewer = forwardRef(function GUIViewer(
    { isRunning, finished, error, onStop },
    ref
) {
    const canvasRef = useRef(null);
    const imgRef = useRef(new Image());

    // Expose drawFrame() imperatively — base64 is NEVER stored in React state
    useImperativeHandle(ref, () => ({
        drawFrame(base64Png) {
            if (!base64Png || !canvasRef.current) return;
            const img = imgRef.current;
            img.onload = () => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                if (
                    canvas.width !== img.naturalWidth ||
                    canvas.height !== img.naturalHeight
                ) {
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                }
                canvas.getContext('2d').drawImage(img, 0, 0);
                // Unhide canvas once we have a real frame
                canvas.style.display = 'block';
            };
            img.src = `data:image/png;base64,${base64Png}`;
        },
    }));

    const handleStop = useCallback(() => {
        if (onStop) onStop();
    }, [onStop]);

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                background: 'var(--bg-primary)',
                overflow: 'hidden',
            }}
        >
            {/* Header bar */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    background: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border-primary)',
                    flexShrink: 0,
                }}
            >
                <FiMonitor size={13} style={{ color: 'var(--accent-primary)' }} />
                <span
                    style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}
                >
                    GUI Output
                </span>
                {isRunning && (
                    <span
                        style={{
                            marginLeft: '4px',
                            fontSize: '11px',
                            color: 'var(--success)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                        }}
                    >
                        <span
                            className="spinner"
                            style={{ width: '10px', height: '10px', borderWidth: '2px' }}
                        />
                        Running…
                    </span>
                )}
                <div style={{ flex: 1 }} />
                {isRunning && (
                    <button
                        className="btn btn--icon"
                        onClick={handleStop}
                        title="Stop GUI execution"
                        style={{
                            padding: '4px 10px',
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: 'var(--error)',
                            border: '1px solid var(--error)',
                            borderRadius: 'var(--radius-md)',
                            background: 'transparent',
                            cursor: 'pointer',
                        }}
                    >
                        <FiSquare size={11} />
                        Stop
                    </button>
                )}
            </div>

            {/* Scrollable content area */}
            <div
                style={{
                    flex: 1,
                    overflow: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '12px',
                    gap: '12px',
                }}
            >
                {/* "Starting virtual display…" — shown while running before first frame */}
                {isRunning && !error && (
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '10px',
                            color: 'var(--text-secondary)',
                            fontSize: '13px',
                            padding: '24px',
                        }}
                    >
                        <span
                            className="spinner"
                            style={{ width: '20px', height: '20px', borderWidth: '2px' }}
                        />
                        <span>Starting virtual display…</span>
                        <span style={{ fontSize: '11px', opacity: 0.6 }}>
                            The first frame will appear here shortly.
                        </span>
                    </div>
                )}

                {/* Idle state */}
                {!isRunning && !finished && !error && (
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '8px',
                            color: 'var(--text-secondary)',
                            opacity: 0.5,
                            fontSize: '13px',
                        }}
                    >
                        <FiMonitor size={32} />
                        <span>Run a GUI program to see output here.</span>
                    </div>
                )}

                {/* Error state */}
                {error && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                            background: 'rgba(255, 71, 87, 0.08)',
                            border: '1px solid var(--error)',
                            borderRadius: 'var(--radius-md)',
                            padding: '10px 14px',
                            color: 'var(--error)',
                            fontSize: '13px',
                            maxWidth: '600px',
                            width: '100%',
                        }}
                    >
                        <FiAlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                        <pre
                            style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                        >
                            {error}
                        </pre>
                    </div>
                )}

                {/* Canvas — hidden until first frame, then revealed in drawFrame() */}
                <canvas
                    ref={canvasRef}
                    style={{
                        display: 'none',
                        maxWidth: '100%',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                        imageRendering: 'pixelated',
                        background: '#ffffff',
                    }}
                />

                {/* Finished — stdout / stderr */}
                {finished && (
                    <div style={{ width: '100%', maxWidth: '800px', fontSize: '12px' }}>
                        {finished.stdout && (
                            <div style={{ marginBottom: '8px' }}>
                                <div
                                    style={{
                                        color: 'var(--text-secondary)',
                                        marginBottom: '4px',
                                        fontSize: '11px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                    }}
                                >
                                    stdout
                                </div>
                                <pre
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-primary)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: '8px 12px',
                                        margin: 0,
                                        color: 'var(--text-primary)',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        fontFamily: 'var(--font-mono, monospace)',
                                    }}
                                >
                                    {finished.stdout}
                                </pre>
                            </div>
                        )}
                        {finished.stderr && (
                            <div>
                                <div
                                    style={{
                                        color: 'var(--text-secondary)',
                                        marginBottom: '4px',
                                        fontSize: '11px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        opacity: 0.7,
                                    }}
                                >
                                    output log
                                </div>
                                <pre
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-primary)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: '8px 12px',
                                        margin: 0,
                                        color: 'var(--text-secondary)',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        fontFamily: 'var(--font-mono, monospace)',
                                    }}
                                >
                                    {finished.stderr}
                                </pre>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

export default GUIViewer;

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FiUpload, FiTrash2, FiX, FiRotateCw, FiRotateCcw, FiRefreshCw } from 'react-icons/fi';

/* ── Single draggable, rotatable sticker ────────────────────────── */
function Sticker({ sticker, onUpdate, onDelete, isSelected, onSelect }) {
    const startDrag = useRef(null);
    const startRotate = useRef(null);
    const startResize = useRef(null);
    const el = useRef(null);

    const handleMouseDown = (e) => {
        if (e.target.classList.contains('sticker-rotate-handle') || e.target.classList.contains('sticker-resize-handle')) return;
        e.preventDefault();
        onSelect(sticker.id);
        startDrag.current = { mx: e.clientX, my: e.clientY, sx: sticker.x, sy: sticker.y };

        const onMove = (me) => {
            const dx = me.clientX - startDrag.current.mx;
            const dy = me.clientY - startDrag.current.my;
            // Direct DOM manipulation for lag-free dragging
            if (el.current) {
                const flipXVal = sticker.flipX ? -1 : 1;
                const flipYVal = sticker.flipY ? -1 : 1;
                const scaleVal = sticker.scale || 1;
                const rotVal = sticker.rotation || 0;
                el.current.style.transform = `translate(${startDrag.current.sx + dx}px, ${startDrag.current.sy + dy}px) rotate(${rotVal}deg) scale(${flipXVal * scaleVal}, ${flipYVal * scaleVal})`;
            }
        };
        const onUp = (me) => {
            const dx = me.clientX - startDrag.current.mx;
            const dy = me.clientY - startDrag.current.my;
            onUpdate(sticker.id, { x: startDrag.current.sx + dx, y: startDrag.current.sy + dy });
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    const handleRotateMouseDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = el.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        startRotate.current = { cx, cy };

        const onMove = (me) => {
            const angle = Math.atan2(me.clientY - startRotate.current.cy, me.clientX - startRotate.current.cx) * (180 / Math.PI);
            // Direct DOM
            if (el.current) {
                const flipXVal = sticker.flipX ? -1 : 1;
                const flipYVal = sticker.flipY ? -1 : 1;
                const scaleVal = sticker.scale || 1;
                el.current.style.transform = `translate(${sticker.x}px, ${sticker.y}px) rotate(${angle + 90}deg) scale(${flipXVal * scaleVal}, ${flipYVal * scaleVal})`;
            }
        };
        const onUp = (me) => {
            const angle = Math.atan2(me.clientY - startRotate.current.cy, me.clientX - startRotate.current.cx) * (180 / Math.PI);
            onUpdate(sticker.id, { rotation: angle + 90 });
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    const handleResizeMouseDown = (e, direction) => {
        e.preventDefault();
        e.stopPropagation();
        startResize.current = {
            mx: e.clientX,
            my: e.clientY,
            startScale: sticker.scale || 1,
            direction
        };

        const onMove = (me) => {
            const dx = me.clientX - startResize.current.mx;
            // Simplistic optical scaling based on horizontal mouse movement relative to the corner
            let scaleDiff = 0;
            if (startResize.current.direction === 'se') {
                scaleDiff = dx * 0.005;
            } else if (startResize.current.direction === 'nw') {
                scaleDiff = -dx * 0.005;
            } else if (startResize.current.direction === 'sw') {
                scaleDiff = -dx * 0.005;
            } else if (startResize.current.direction === 'ne') {
                scaleDiff = dx * 0.005;
            }

            const newScale = Math.max(0.1, startResize.current.startScale + scaleDiff);
            // Direct DOM for smooth scaling
            if (el.current) {
                const flipXVal = sticker.flipX ? -1 : 1;
                const flipYVal = sticker.flipY ? -1 : 1;
                const rotVal = sticker.rotation || 0;
                el.current.style.transform = `translate(${sticker.x}px, ${sticker.y}px) rotate(${rotVal}deg) scale(${flipXVal * newScale}, ${flipYVal * newScale})`;
            }
        };

        const onUp = (me) => {
            const dx = me.clientX - startResize.current.mx;
            let scaleDiff = 0;
            if (startResize.current.direction === 'se') scaleDiff = dx * 0.005;
            else if (startResize.current.direction === 'nw') scaleDiff = -dx * 0.005;
            else if (startResize.current.direction === 'sw') scaleDiff = -dx * 0.005;
            else if (startResize.current.direction === 'ne') scaleDiff = dx * 0.005;

            const newScale = Math.max(0.1, startResize.current.startScale + scaleDiff);
            onUpdate(sticker.id, { scale: newScale });

            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    const flipX = sticker.flipX ? -1 : 1;
    const flipY = sticker.flipY ? -1 : 1;
    const scale = sticker.scale || 1;

    const transform = `
        translate(${sticker.x}px, ${sticker.y}px)
        rotate(${sticker.rotation || 0}deg)
        scale(${flipX * scale}, ${flipY * scale})
    `;

    const filter = sticker.inverted ? 'invert(1) hue-rotate(180deg)' : 'none';

    return (
        <div
            ref={el}
            className={`sticker ${isSelected ? 'sticker--selected' : ''}`}
            style={{ transform, filter }}
            onMouseDown={handleMouseDown}
            onClick={() => onSelect(sticker.id)}
        >
            <img src={sticker.src} alt="sticker" draggable={false} />
            {isSelected && (
                <>
                    <div className="sticker-rotate-handle" onMouseDown={handleRotateMouseDown} title="Drag to rotate">
                        <FiRotateCw size={12} />
                    </div>
                    {/* Add corner resize handles */}
                    <div className="sticker-resize-handle nw" onMouseDown={(e) => handleResizeMouseDown(e, 'nw')} />
                    <div className="sticker-resize-handle ne" onMouseDown={(e) => handleResizeMouseDown(e, 'ne')} />
                    <div className="sticker-resize-handle sw" onMouseDown={(e) => handleResizeMouseDown(e, 'sw')} />
                    <div className="sticker-resize-handle se" onMouseDown={(e) => handleResizeMouseDown(e, 'se')} />

                    <button className="sticker-delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(sticker.id); }} title="Delete sticker">
                        <FiX size={11} />
                    </button>
                </>
            )}
        </div>
    );
}

/* ── Toolbar shown when a sticker is selected ───────────────────── */
function StickerToolbar({ sticker, onUpdate }) {
    if (!sticker) return null;
    return (
        <div className="sticker-toolbar">
            <span className="sticker-toolbar-label">✦ Sticker Controls</span>
            <div className="sticker-toolbar-controls">
                <button
                    className="sticker-ctrl-btn"
                    title="Rotate -15°"
                    onClick={() => onUpdate(sticker.id, { rotation: (sticker.rotation || 0) - 15 })}
                >
                    <FiRotateCcw size={14} />
                </button>
                <button
                    className="sticker-ctrl-btn"
                    title="Rotate +15°"
                    onClick={() => onUpdate(sticker.id, { rotation: (sticker.rotation || 0) + 15 })}
                >
                    <FiRotateCw size={14} />
                </button>
                <div className="sticker-divider" />
                <button
                    className={`sticker-ctrl-btn ${sticker.flipX ? 'active' : ''}`}
                    title="Flip Horizontal"
                    onClick={() => onUpdate(sticker.id, { flipX: !sticker.flipX })}
                >
                    ↔
                </button>
                <button
                    className={`sticker-ctrl-btn ${sticker.flipY ? 'active' : ''}`}
                    title="Flip Vertical"
                    onClick={() => onUpdate(sticker.id, { flipY: !sticker.flipY })}
                >
                    ↕
                </button>
                <div className="sticker-divider" />
                <button
                    className={`sticker-ctrl-btn ${sticker.inverted ? 'active' : ''}`}
                    title="Invert Colors"
                    onClick={() => onUpdate(sticker.id, { inverted: !sticker.inverted })}
                >
                    ◑
                </button>
                <div className="sticker-divider" />
                <button
                    className="sticker-ctrl-btn"
                    title="Reset"
                    onClick={() => onUpdate(sticker.id, { rotation: 0, flipX: false, flipY: false, inverted: false, scale: 1 })}
                >
                    <FiRefreshCw size={13} />
                </button>
            </div>
        </div>
    );
}

/* ── Upload button (floating, bottom-right of editor area) ─────── */
export function StickerUploadButton({ onUpload }) {
    const inputRef = useRef(null);

    const handleFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            onUpload({
                id: Date.now(),
                src: ev.target.result,
                x: 80,
                y: 80,
                rotation: 0,
                flipX: false,
                flipY: false,
                inverted: false,
                scale: 1,
            });
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    return (
        <>
            <button
                className="sticker-upload-fab"
                title="Add a sticker (screenshot/image)"
                onClick={() => inputRef.current.click()}
            >
                <FiUpload size={16} />
                <span>Sticker</span>
            </button>
            <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        </>
    );
}

/* ── Main overlay (renders all stickers + toolbar) ─────────────── */
export function StickerOverlay({ stickers, activeFileId, updateSticker: globalUpdateSticker, removeSticker: globalRemoveSticker }) {
    const [selectedId, setSelectedId] = useState(null);

    const selected = stickers.find(s => s.id === selectedId) || null;

    const updateSticker = useCallback((id, patch) => {
        if (activeFileId) {
            globalUpdateSticker(activeFileId, id, patch);
        }
    }, [globalUpdateSticker, activeFileId]);

    const deleteSticker = useCallback((id) => {
        if (activeFileId) {
            globalRemoveSticker(activeFileId, id);
            setSelectedId(null);
        }
    }, [globalRemoveSticker, activeFileId]);

    // Deselect on Escape or clicking outside
    useEffect(() => {
        const handleKeyDown = (e) => { if (e.key === 'Escape') setSelectedId(null); };

        const handlePointerDown = (e) => {
            if (!e.target.closest('.sticker') && !e.target.closest('.sticker-toolbar')) {
                setSelectedId(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        document.addEventListener('pointerdown', handlePointerDown, true);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('pointerdown', handlePointerDown, true);
        };
    }, []);

    if (stickers.length === 0 && !selectedId) return null;

    return (
        <>
            <StickerToolbar sticker={selected} onUpdate={updateSticker} />
            <div
                className="sticker-canvas"
                onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
            >
                {stickers.map(s => (
                    <Sticker
                        key={s.id}
                        sticker={s}
                        onUpdate={updateSticker}
                        onDelete={deleteSticker}
                        isSelected={selectedId === s.id}
                        onSelect={setSelectedId}
                    />
                ))}
            </div>

            <style>{`
                /* ── Sticker Canvas ── */
                .sticker-canvas {
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    z-index: 50;
                }
                /* ── Individual Sticker ── */
                .sticker {
                    position: absolute;
                    top: 0; left: 0;
                    transform-origin: center center;
                    cursor: grab;
                    pointer-events: all;
                    user-select: none;
                    will-change: transform;
                    transition: filter 0.2s;
                }
                .sticker:active { cursor: grabbing; }
                .sticker img {
                    display: block;
                    max-width: 280px;
                    max-height: 280px;
                    min-width: 60px;
                    border-radius: 10px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.45);
                    pointer-events: none;
                    border: 2px solid transparent;
                    transition: border-color 0.2s;
                }
                .sticker--selected img {
                    border-color: var(--accent-primary);
                    box-shadow: 0 0 0 2px rgba(var(--accent-primary-rgb), 0.35), 0 8px 32px rgba(0,0,0,0.5);
                }
                /* ── Rotate Handle ── */
                .sticker-rotate-handle {
                    position: absolute;
                    top: -32px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 26px; height: 26px;
                    background: var(--accent-primary);
                    border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    cursor: crosshair;
                    color: white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                    pointer-events: all;
                    z-index: 10;
                    border: 2px solid rgba(255,255,255,0.3);
                    transition: transform 0.15s, box-shadow 0.15s;
                }
                .sticker-rotate-handle:hover {
                    transform: translateX(-50%) scale(1.15);
                    box-shadow: 0 0 12px rgba(var(--accent-primary-rgb), 0.6);
                }
                /* ── Delete Button ── */
                .sticker-delete-btn {
                    position: absolute;
                    top: -12px; right: -12px;
                    width: 22px; height: 22px;
                    background: #ef4444;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-radius: 50%;
                    color: white;
                    cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    z-index: 10;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                    transition: transform 0.15s, box-shadow 0.15s;
                }
                .sticker-delete-btn:hover { transform: scale(1.2); box-shadow: 0 0 10px rgba(239,68,68,0.6); }
                /* ── Upload FAB ── */
                .sticker-upload-fab {
                    position: absolute;
                    right: 14px;
                    top: 52px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 7px 14px;
                    background: linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.15), rgba(var(--accent-secondary-rgb), 0.1));
                    border: 1px solid rgba(var(--accent-primary-rgb), 0.3);
                    border-radius: 20px;
                    color: var(--accent-primary);
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    z-index: 60;
                    backdrop-filter: blur(8px);
                    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    letter-spacing: 0.02em;
                }
                .sticker-upload-fab:hover {
                    background: linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.25), rgba(var(--accent-secondary-rgb), 0.2));
                    border-color: var(--accent-primary);
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(var(--accent-primary-rgb), 0.25);
                }
                /* ── Toolbar ── */
                .sticker-toolbar {
                    position: absolute;
                    top: 52px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 60;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    background: rgba(16, 16, 20, 0.88);
                    backdrop-filter: blur(16px);
                    border: 1px solid rgba(var(--accent-primary-rgb), 0.2);
                    border-radius: 16px;
                    padding: 10px 16px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04);
                    animation: tbFadeIn 0.2s ease-out;
                    pointer-events: all;
                }
                @keyframes tbFadeIn { from { opacity: 0; transform: translateX(-50%) translateY(-6px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
                .sticker-toolbar-label {
                    font-size: 10px;
                    font-weight: 700;
                    color: var(--accent-primary);
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    opacity: 0.85;
                }
                .sticker-toolbar-controls {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .sticker-ctrl-btn {
                    width: 30px; height: 30px;
                    border-radius: 8px;
                    border: 1px solid rgba(255,255,255,0.06);
                    background: rgba(255,255,255,0.04);
                    color: rgba(255,255,255,0.7);
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.15s;
                }
                .sticker-ctrl-btn:hover {
                    background: rgba(var(--accent-primary-rgb), 0.18);
                    color: var(--accent-primary);
                    border-color: rgba(var(--accent-primary-rgb), 0.3);
                }
                .sticker-ctrl-btn.active {
                    background: rgba(var(--accent-primary-rgb), 0.25);
                    color: var(--accent-primary);
                    border-color: rgba(var(--accent-primary-rgb), 0.5);
                    box-shadow: 0 0 8px rgba(var(--accent-primary-rgb), 0.2);
                }
                .sticker-divider {
                    width: 1px; height: 20px;
                    background: rgba(255,255,255,0.08);
                    margin: 0 3px;
                }
                .sticker-scale-slider {
                    width: 72px;
                    accent-color: var(--accent-primary);
                    cursor: pointer;
                }
                .sticker-scale-label {
                    font-size: 10px;
                    color: rgba(255,255,255,0.45);
                    min-width: 32px;
                    text-align: center;
                }
            `}</style>
        </>
    );
}

export default StickerOverlay;

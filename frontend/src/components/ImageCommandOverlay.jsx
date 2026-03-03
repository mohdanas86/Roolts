import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiMove, FiMaximize2, FiTrash2 } from 'react-icons/fi';
import { useFileStore } from '../store';

/**
 * ImageCommandOverlay
 * Reads `#rooltscommand placeimage` comments from the code and renders them as
 * visually floating, draggable, resizable images over the editor.
 * When an image is moved/resized, it updates the text comment directly via the Monaco API.
 */
function ImageCommandOverlay({ fileId, content, editor, onDockLeftChange }) {
    const { files, removeImage } = useFileStore();
    const file = files.find(f => f.id === fileId);

    // Parsed image commands from the code
    const [imageCommands, setImageCommands] = useState([]);
    const [scrollTop, setScrollTop] = useState(0);

    // Parse logic
    useEffect(() => {
        if (!editor) return;
        const model = editor.getModel();
        if (!model) return;

        const parseSync = () => {
            if (model.isDisposed()) return;
            const lines = model.getLinesContent();
            const parsed = [];

            lines.forEach((line, index) => {
                const match = line.match(/(#|\/\/|<!--|--)\s*#rooltscommand placeimage\s+id=([^\s]+)\s+x=([\d.-]+)\s+y=([\d.-]+)\s+w=([\d.-]+)\s+h=([\d.-]+)/);
                if (match) {
                    parsed.push({
                        id: match[2],
                        x: parseFloat(match[3]),
                        y: parseFloat(match[4]),
                        w: parseFloat(match[5]),
                        h: parseFloat(match[6]),
                        range: {
                            startLineNumber: index + 1,
                            startColumn: 1,
                            endLineNumber: index + 1,
                            endColumn: line.length + 1
                        },
                        commentPrefix: match[1]
                    });
                }
            });

            setImageCommands(parsed);
        };

        // Initial parse
        parseSync();

        // Re-parse on content changes or when image list in store changes (triggers re-render)
        const disposable = model.onDidChangeContent(parseSync);
        return () => disposable.dispose();
    }, [editor, file?.images?.length]);

    // Handle scroll syncing
    useEffect(() => {
        if (!editor) return;
        const disposable = editor.onDidScrollChange((e) => {
            setScrollTop(e.scrollTop);
        });
        setScrollTop(editor.getScrollTop());
        return () => disposable.dispose();
    }, [editor]);

    // Handle left dock width
    useEffect(() => {
        if (!onDockLeftChange) return;

        let maxWidth = 0;
        imageCommands.forEach(cmd => {
            // Treat images hovering within the left margin area as "docked"
            if (cmd.x < 100) {
                maxWidth = Math.max(maxWidth, cmd.w + cmd.x + 20);
            }
        });

        onDockLeftChange(maxWidth);
    }, [imageCommands, onDockLeftChange]);

    // Handle updates to the code when an image is moved/resized
    const updateImageCommandInCode = useCallback((id, newX, newY, newW, newH) => {
        if (!editor) return;
        const model = editor.getModel();
        if (!model) return;

        const targetCommand = imageCommands.find(c => c.id === id);
        if (!targetCommand) return;

        const newText = `${targetCommand.commentPrefix} #rooltscommand placeimage id=${id} x=${Math.round(newX)} y=${Math.round(newY)} w=${Math.round(newW)} h=${Math.round(newH)}`;

        // Execute edit
        editor.executeEdits('image-overlay', [{
            range: targetCommand.range,
            text: newText,
            forceMoveMarkers: true
        }]);

        // We don't need to manually update state; the change in content will re-trigger the parse effect!
    }, [editor, imageCommands]);

    const handleDelete = useCallback((id) => {
        if (!editor || !fileId) return;
        const model = editor.getModel();
        if (!model) return;

        const targetCommand = imageCommands.find(c => c.id === id);
        if (!targetCommand) return;

        // Delete the line containing the command
        const lineRange = {
            startLineNumber: targetCommand.range.startLineNumber,
            startColumn: 1,
            endLineNumber: targetCommand.range.endLineNumber + 1,
            endColumn: 1
        };

        editor.executeEdits('image-overlay-delete', [{
            range: lineRange,
            text: ''
        }]);

        removeImage(fileId, id);
    }, [editor, fileId, imageCommands, removeImage]);

    if (!imageCommands.length || !file?.images?.length) return null;

    return (
        <div style={{ position: 'absolute', top: -scrollTop, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 999 }}>
            {imageCommands.map(cmd => {
                const imgData = file.images.find(img => img.id === cmd.id);
                if (!imgData) return null;

                return (
                    <DraggableResizableImage
                        key={cmd.id}
                        cmd={cmd}
                        src={imgData.src}
                        onChange={(newX, newY, newW, newH) => updateImageCommandInCode(cmd.id, newX, newY, newW, newH)}
                        onDelete={() => handleDelete(cmd.id)}
                    />
                );
            })}
        </div>
    );
}

function DraggableResizableImage({ cmd, src, onChange, onDelete }) {
    const el = useRef(null);
    const startDrag = useRef(null);
    const [isHovered, setIsHovered] = useState(false);

    // Store local position to prevent spamming the Monaco editor history
    const [local, setLocal] = useState({ x: cmd.x, y: cmd.y, w: cmd.w, h: cmd.h });
    const localRef = useRef(local);

    useEffect(() => {
        const newLocal = { x: cmd.x, y: cmd.y, w: cmd.w, h: cmd.h };
        setLocal(newLocal);
        localRef.current = newLocal;
    }, [cmd.x, cmd.y, cmd.w, cmd.h]);

    const handleDragStart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        startDrag.current = {
            type: 'move',
            mx: e.clientX,
            my: e.clientY,
            sx: localRef.current.x,
            sy: localRef.current.y
        };

        const onMove = (me) => {
            const dx = me.clientX - startDrag.current.mx;
            const dy = me.clientY - startDrag.current.my;
            const newX = startDrag.current.sx + dx;
            const newY = startDrag.current.sy + dy;

            const updated = { ...localRef.current, x: newX, y: newY };
            setLocal(updated);
            localRef.current = updated;
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            onChange(localRef.current.x, localRef.current.y, localRef.current.w, localRef.current.h);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    const handleResizeStart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        startDrag.current = {
            type: 'resize',
            mx: e.clientX,
            my: e.clientY,
            sw: localRef.current.w,
            sh: localRef.current.h
        };

        const onMove = (me) => {
            const dx = me.clientX - startDrag.current.mx;
            const dy = me.clientY - startDrag.current.my;
            const newW = Math.max(20, startDrag.current.sw + dx);
            const newH = Math.max(20, startDrag.current.sh + dy);

            const updated = { ...localRef.current, w: newW, h: newH };
            setLocal(updated);
            localRef.current = updated;
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            onChange(localRef.current.x, localRef.current.y, localRef.current.w, localRef.current.h);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    return (
        <div
            ref={el}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                position: 'absolute',
                left: local.x,
                top: local.y,
                width: local.w,
                height: local.h,
                pointerEvents: 'all',
                cursor: startDrag.current ? (startDrag.current.type === 'move' ? 'grabbing' : 'se-resize') : 'grab',
                border: isHovered ? '2px solid var(--accent-primary)' : '2px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                boxShadow: isHovered ? '0 12px 40px rgba(0,0,0,0.6)' : '0 4px 12px rgba(0,0,0,0.3)',
                transition: startDrag.current ? 'none' : 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(4px)',
                padding: '4px',
                overflow: 'visible',
                zIndex: isHovered ? 1000 : 999
            }}
            onMouseDown={handleDragStart}
        >
            <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', borderRadius: '8px' }}>
                <img
                    src={src}
                    draggable={false}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        filter: isHovered ? 'brightness(1.1)' : 'brightness(1)',
                        transition: 'filter 0.3s'
                    }}
                />
            </div>

            {isHovered && (
                <>
                    <button
                        onMouseDown={(e) => { e.stopPropagation(); onDelete(); }}
                        style={{
                            position: 'absolute',
                            top: -12,
                            right: -12,
                            width: 28,
                            height: 28,
                            backgroundColor: '#ff4d4d',
                            color: 'white',
                            border: '2px solid rgba(255,255,255,0.2)',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(255, 77, 77, 0.4)',
                            zIndex: 10,
                            transition: 'transform 0.2s',
                            padding: 0
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <FiTrash2 size={14} />
                    </button>

                    <div
                        onMouseDown={handleResizeStart}
                        style={{
                            position: 'absolute',
                            bottom: -8,
                            right: -8,
                            width: 20,
                            height: 20,
                            backgroundColor: 'var(--accent-primary)',
                            borderRadius: '6px',
                            cursor: 'se-resize',
                            border: '3px solid white',
                            boxShadow: '0 4px 12px rgba(var(--accent-primary-rgb), 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 10
                        }}
                    >
                        <FiMaximize2 size={10} color="white" />
                    </div>
                </>
            )}
        </div>
    );
}

export default ImageCommandOverlay;

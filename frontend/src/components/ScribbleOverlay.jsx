import React, { useRef, useState, useEffect } from 'react';
import './ScribbleOverlay.css';

const ScribbleOverlay = ({ fileId, drawings = [], onAddDrawing, onUndo, onClear, isActive, tool, color, penSize = 3, eraserSize = 15, editor }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPath, setCurrentPath] = useState([]);
    const [context, setContext] = useState(null);

    const lineWidth = tool === 'eraser' ? eraserSize : penSize;

    // Initialize canvas context
    useEffect(() => {
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            setContext(ctx);
        }
    }, []);

    // Resize canvas to match parent
    useEffect(() => {
        const handleResize = () => {
            if (canvasRef.current && canvasRef.current.parentElement) {
                canvasRef.current.width = canvasRef.current.parentElement.offsetWidth;
                canvasRef.current.height = canvasRef.current.parentElement.offsetHeight;
                redraw();
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, [drawings, context]);

    // Redraw on state changes or scroll
    useEffect(() => {
        if (!editor || !context) return;

        let requestRef;
        const throttledRedraw = () => {
            if (requestRef) cancelAnimationFrame(requestRef);
            requestRef = requestAnimationFrame(redraw);
        };

        // Redraw immediately for state changes
        redraw();

        const disposable = editor.onDidScrollChange(throttledRedraw);
        return () => {
            disposable.dispose();
            if (requestRef) cancelAnimationFrame(requestRef);
        };
    }, [editor, drawings, context, currentPath, isDrawing]);

    const getScreenY = (initialLine, relY) => {
        if (!editor) return relY;
        const top = editor.getTopForLineNumber(initialLine);
        const scrollTop = editor.getScrollTop();
        // The +16 corresponds to the editor's paddingTop.
        return (top + relY) - scrollTop + 16;
    };

    const redraw = () => {
        if (!canvasRef.current || !context || !editor) return;

        const ctx = context;
        const canvas = canvasRef.current;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw saved drawings
        drawings.forEach(drawing => {
            renderPath(drawing.points, drawing.initialLine, drawing.tool, drawing.color, drawing.width);
        });

        // Draw current active path
        if (isDrawing && currentPath.length > 1) {
            renderPath(currentPath, currentPath[0].line, tool, color, lineWidth);
        }

        ctx.globalCompositeOperation = 'source-over';
    };

    const renderPath = (points, initialLine, pTool, pColor, pWidth) => {
        if (points.length < 2 || !context || !editor) return;
        const ctx = context;

        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = pTool === 'eraser' ? 'rgba(0,0,0,1)' : pColor;
        ctx.lineWidth = pWidth;
        ctx.globalCompositeOperation = pTool === 'eraser' ? 'destination-out' : 'source-over';

        const lineTop = editor.getTopForLineNumber(initialLine);
        const scrollTop = editor.getScrollTop();
        const offset = lineTop - scrollTop + 16;

        const firstPoint = points[0];
        ctx.moveTo(firstPoint.x, firstPoint.relY + offset);

        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].relY + offset);
        }
        ctx.stroke();
        ctx.restore();
    };

    const getCoordinates = (e) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const startDrawing = (e) => {
        if (!editor) return;
        const { x, y } = getCoordinates(e);

        const target = editor.getTargetAtClientPoint(e.clientX, e.clientY);
        const line = target?.position?.lineNumber || 1;
        const lineTop = editor.getTopForLineNumber(line);
        const scrollTop = editor.getScrollTop();

        // relY is stored absolute relative to the model's top for that specific line
        const relY = (y + scrollTop - 16) - lineTop;

        setIsDrawing(true);
        setCurrentPath([{ x, relY, line }]);
    };

    const draw = (e) => {
        if (!isDrawing || !context || !editor) return;
        const { x, y } = getCoordinates(e);

        const initialPoint = currentPath[0];
        const lineTop = editor.getTopForLineNumber(initialPoint.line);
        const scrollTop = editor.getScrollTop();
        const relY = (y + scrollTop - 16) - lineTop;

        setCurrentPath(prev => [...prev, { x, relY, line: initialPoint.line }]);
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);

        if (currentPath.length > 1) {
            onAddDrawing(fileId, {
                id: Date.now().toString(),
                points: currentPath,
                initialLine: currentPath[0].line,
                color: color,
                width: lineWidth,
                tool: tool
            });
        }
        setCurrentPath([]);
    };

    return (
        <div className="scribble-overlay" style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 'calc(100% - 14px)',
            height: '100%',
            pointerEvents: isActive ? 'auto' : 'none',
            zIndex: 100
        }}>
            <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                style={{
                    cursor: tool === 'eraser' ? 'cell' : 'crosshair',
                    display: 'block',
                    touchAction: 'none'
                }}
            />
        </div>
    );
};

export default ScribbleOverlay;

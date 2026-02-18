import React from 'react';
import { FiX } from 'react-icons/fi';
import { getFileIcon } from '../services/iconHelper.jsx';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const EditorTab = React.memo(({ file, activeFileId, showOutput, setActiveFile, setShowOutput, closeFile, handleContextMenu }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: file.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'pointer',
        userSelect: 'none',
        position: 'relative',
        zIndex: isDragging ? 1000 : 1
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`editor-tab ${activeFileId === file.id && !showOutput ? 'editor-tab--active' : ''}`}
            onClick={() => { setActiveFile(file.id); setShowOutput(false); }}
            onContextMenu={(e) => handleContextMenu(e, file.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    setActiveFile(file.id);
                    setShowOutput(false);
                }
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px' }}>
                {getFileIcon(file.language || 'plaintext')}
            </div>
            <span style={{ fontSize: '12px' }}>{file.name}</span>
            <span
                className="editor-tab__close"
                onClick={(e) => {
                    e.stopPropagation();
                    closeFile(file.id);
                }}
                style={{ display: 'flex', alignItems: 'center' }}
            >
                <FiX size={12} />
            </span>
        </div>
    );
});

export default EditorTab;

import React from 'react';
import { useDroppable } from '@dnd-kit/core';

const DroppableFolder = ({ folderId, path, children, className, style }) => {
    const { isOver, setNodeRef } = useDroppable({
        id: folderId,
        data: { type: 'folder', id: folderId, path }
    });

    const activeStyle = {
        backgroundColor: isOver ? 'var(--bg-tertiary)' : undefined,
        outline: isOver ? '1px dashed var(--accent-primary)' : undefined,
        ...style
    };

    return (
        <div ref={setNodeRef} className={className} style={activeStyle}>
            {children}
        </div>
    );
};

export default DroppableFolder;

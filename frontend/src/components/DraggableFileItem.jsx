import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import SimpleFileItem from './SimpleFileItem';

const DraggableFileItem = (props) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: props.file.id,
        data: { type: 'file', file: props.file }
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 999,
        position: 'relative'
    } : undefined;

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            <SimpleFileItem {...props} />
        </div>
    );
};

export default DraggableFileItem;

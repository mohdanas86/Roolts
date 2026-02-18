import React, { useState } from 'react';
import { FiFolder, FiChevronRight, FiChevronDown, FiFile } from 'react-icons/fi';
import DraggableFileItem from './DraggableFileItem';
import DroppableFolder from './DroppableFolder';

const FolderItem = ({
    item,
    level = 0,
    activeFileId,
    openFile,
    renamingId,
    handleContextMenu,
    handleRename,
    deleteFile,
    setRenamingId,
    handleFolderContextMenu
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleFolder = (e) => {
        e.stopPropagation();
        setIsOpen(!isOpen);
    };

    if (item.type === 'file') {
        // Compute indentation style
        const indentStyle = { paddingLeft: `${level * 16 + 12}px` };
        // We wrap FileItem to apply indentation or pass it down?
        // FileItem has its own styles. 
        // Better to pass level to FileItem or wrap it in a div with padding.
        // Let's modify FileItem props or wrap it.
        // Better to pass level to FileItem or wrap it.
        // But FileItem is complex with DnD.
        // For now, let's wrap it in a custom style div that DnD might ignore (issue).
        // Actually, DnD usually requires flat list for simple sorting.
        // Nested DnD is hard. We might lose DnD for nested files for now.
        return (
            <div style={{ paddingLeft: `${level * 12}px` }}>
                <DraggableFileItem
                    file={item}
                    activeFileId={activeFileId}
                    renamingId={renamingId}
                    openFile={openFile}
                    handleContextMenu={handleContextMenu}
                    handleRename={handleRename}
                    deleteFile={deleteFile}
                    setRenamingId={setRenamingId}
                />
            </div>
        );
    }

    return (
        <div className="folder-item">
            <DroppableFolder folderId={item.id} path={item.path}>
                <div
                    className="folder-header"
                    onClick={toggleFolder}
                    onContextMenu={(e) => handleFolderContextMenu && handleFolderContextMenu(e, item)}
                    style={{
                        paddingLeft: `${level * 12 + 4}px`,
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        paddingTop: '6px',
                        paddingBottom: '6px',
                        color: 'var(--text-secondary)',
                        fontSize: '13px'
                    }}
                >
                    <span style={{ marginRight: '4px', display: 'flex' }}>
                        {isOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                    </span>
                    <FiFolder size={18} style={{ marginRight: '6px', color: isOpen ? 'var(--text-primary)' : 'inherit' }} />
                    <span style={{ fontWeight: 500 }}>{item.name}</span>
                </div>
            </DroppableFolder>

            {isOpen && (
                <div className="folder-children">
                    {item.children.map(child => (
                        <FolderItem
                            key={child.id}
                            item={child}
                            level={level + 1}
                            activeFileId={activeFileId}
                            openFile={openFile}
                            renamingId={renamingId}
                            handleContextMenu={handleContextMenu}
                            handleRename={handleRename}
                            deleteFile={deleteFile}
                            setRenamingId={setRenamingId}
                            handleFolderContextMenu={handleFolderContextMenu}
                        />
                    ))}
                </div>
            )}

            <style>{`
                .folder-header:hover {
                    background: var(--bg-tertiary);
                    color: var(--text-primary);
                }
            `}</style>
        </div>
    );
};

export default FolderItem;

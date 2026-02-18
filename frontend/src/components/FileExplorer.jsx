import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiPlus, FiX, FiTrash2, FiEdit3, FiFilePlus, FiFolder, FiFolderPlus, FiUpload, FiDownload, FiChevronRight, FiChevronDown, FiAlertCircle } from 'react-icons/fi';
import { useFileStore, useUIStore } from '../store';
import { getFileIcon } from '../services/iconHelper.jsx';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import FileItem from './FileItem';
function FileExplorer() {
    const { files, activeFileId, openFile, deleteFile, renameFile, addFile, openFiles, closeFile, closeFiles, deleteFiles } = useFileStore();
    const { openModal, addNotification } = useUIStore();
    const [renamingId, setRenamingId] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);
    const contextMenuRef = useRef(null);

    // Close context menu on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(event.target)) {
                setContextMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getLanguageFromExtension = (filename) => {
        const ext = filename.split('.').pop().toLowerCase();
        const map = {
            'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
            'py': 'python', 'java': 'java', 'c': 'c', 'cpp': 'cpp', 'html': 'html',
            'css': 'css', 'json': 'json', 'md': 'markdown', 'rs': 'rust', 'go': 'go'
        };
        return map[ext] || 'plaintext';
    };

    const readFileContent = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    };

    const handleFileUpload = async (e) => {
        const uploadedFiles = e.target.files;
        if (!uploadedFiles) return;

        let count = 0;
        for (let i = 0; i < uploadedFiles.length; i++) {
            const file = uploadedFiles[i];
            const content = await readFileContent(file);
            const language = getLanguageFromExtension(file.name);
            const result = addFile(file.name, content, language);
            if (result) count++;
        }

        if (count > 0) {
            addNotification({ type: 'success', message: `Successfully uploaded ${count} file(s)` });
        }
    };

    const handleFolderUpload = async (e) => {
        const uploadedFiles = e.target.files;
        if (!uploadedFiles) return;

        let count = 0;
        for (let i = 0; i < uploadedFiles.length; i++) {
            const file = uploadedFiles[i];
            const path = file.webkitRelativePath || file.name;
            const content = await readFileContent(file);
            const language = getLanguageFromExtension(file.name);
            const result = addFile(path, content, language);
            if (result) count++;
        }

        if (count > 0) {
            addNotification({ type: 'success', message: `Successfully uploaded folder with ${count} file(s)` });
        }
    };

    const handleContextMenu = useCallback((e, fileId) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, fileId });
    }, []);

    const handleRename = useCallback((fileId, newName) => {
        if (newName && newName.trim() !== '') {
            renameFile(fileId, newName);
        }
        setRenamingId(null);
    }, [renameFile]);

    const handleDelete = useCallback((fileId) => {
        if (window.confirm('Delete this file?')) {
            deleteFile(fileId);
        }
        setContextMenu(null);
    }, [deleteFile]);

    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        const items = e.dataTransfer.items;
        if (!items) return;

        let uploadedCount = 0;
        const scanFiles = async (entry, path = '') => {
            if (entry.isFile) {
                const file = await new Promise((resolve) => entry.file(resolve));
                const content = await readFileContent(file);
                const language = getLanguageFromExtension(file.name);
                const fullPath = path ? `${path}/${file.name}` : file.name;
                const result = addFile(fullPath, content, language);
                if (result) uploadedCount++;
            } else if (entry.isDirectory) {
                const reader = entry.createReader();
                const entries = await new Promise((resolve) => reader.readEntries(resolve));
                for (const child of entries) {
                    await scanFiles(child, path ? `${path}/${entry.name}` : entry.name);
                }
            }
        };

        for (let i = 0; i < items.length; i++) {
            const item = items[i].webkitGetAsEntry();
            if (item) {
                await scanFiles(item);
            }
        }

        if (uploadedCount > 0) {
            addNotification({ type: 'success', message: `Imported ${uploadedCount} files/folders` });
        }
    }, [addFile, addNotification, readFileContent, getLanguageFromExtension]);

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = files.findIndex((f) => f.id === active.id);
            const newIndex = files.findIndex((f) => f.id === over.id);

            useFileStore.getState().reorderFiles(oldIndex, newIndex);
        }
    };

    return (
        <div
            className="file-explorer"
            style={{ position: 'relative', height: '100%' }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >

            {/* Hidden file inputs */}
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                multiple
                onChange={handleFileUpload}
            />
            <input
                type="file"
                ref={folderInputRef}
                style={{ display: 'none' }}
                webkitdirectory="true"
                multiple
                onChange={handleFolderUpload}
            />

            <div className="file-explorer__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-primary)' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>Files</h3>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn btn--icon btn--ghost" onClick={() => openModal('newFile')} title="New File"><FiFilePlus size={16} /></button>
                    <button className="btn btn--icon btn--ghost" onClick={() => folderInputRef.current.click()} title="Upload Folder"><FiFolderPlus size={16} /></button>
                    <button className="btn btn--icon btn--ghost" onClick={() => fileInputRef.current.click()} title="Upload Files"><FiUpload size={16} /></button>
                </div>
            </div>

            <div className="file-explorer__list" style={{ padding: '8px 0', overflowY: 'auto', flex: 1 }}>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={files.map(f => f.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {Array.isArray(files) && files.length > 0 ? (
                            files.map((file) => (
                                <FileItem
                                    key={file.id}
                                    file={file}
                                    activeFileId={activeFileId}
                                    renamingId={renamingId}
                                    openFile={openFile}
                                    handleContextMenu={handleContextMenu}
                                    handleRename={handleRename}
                                    deleteFile={handleDelete}
                                    setRenamingId={setRenamingId}
                                />
                            ))
                        ) : (
                            <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5, fontSize: '12px' }}>
                                No files open. Click + to create one.
                            </div>
                        )}
                    </SortableContext>
                </DndContext>
            </div>

            {contextMenu && (
                <div
                    ref={contextMenuRef}
                    className="context-menu"
                    style={{
                        position: 'fixed',
                        top: contextMenu.y,
                        left: contextMenu.x,
                        zIndex: 1000,
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: '6px',
                        padding: '4px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        minWidth: '120px'
                    }}
                    onClick={() => setContextMenu(null)}
                >
                    <button
                        className="context-menu-item"
                        onClick={() => {
                            setRenamingId(contextMenu.fileId);
                            setContextMenu(null);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', width: '100%', border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: '12px' }}
                    >
                        <FiEdit3 size={14} /> Rename
                    </button>
                    <button
                        className="context-menu-item"
                        onClick={() => handleDelete(contextMenu.fileId)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', width: '100%', border: 'none', background: 'transparent', color: 'var(--error)', cursor: 'pointer', textAlign: 'left', fontSize: '12px' }}
                    >
                        <FiTrash2 size={14} /> Delete
                    </button>
                </div>
            )}

        </div>
    );
}

export default FileExplorer;

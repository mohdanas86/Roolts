import React, { useState, useEffect } from 'react';
import { FiGrid, FiActivity, FiMessageSquare, FiCode, FiPhone, FiCpu, FiMusic, FiPackage, FiSettings, FiCamera, FiChrome, FiMap, FiMail, FiZap, FiBookOpen } from 'react-icons/fi';
import CallingPanel from './CallingPanel';
import { useSettingsStore } from '../store';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    rectSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableAppItem = ({ app, onOpenApp, setActiveAppId }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: app.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
        border: 'none',
        background: 'transparent',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={() => {
                if (app.id === 'calls') {
                    setActiveAppId('calls');
                } else {
                    onOpenApp && onOpenApp(app.id);
                }
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (app.id === 'calls') {
                        setActiveAppId('calls');
                    } else {
                        onOpenApp && onOpenApp(app.id);
                    }
                }
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = transform ? `${CSS.Transform.toString(transform)} scale(1.05)` : 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = transform ? CSS.Transform.toString(transform) : 'scale(1)'}
            tabIndex={0}
            role="button"
        >
            <div style={{
                width: '48px',
                height: '48px',
                backgroundColor: app.color,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '24px',
                marginBottom: '6px',
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
            }}>
                {app.icon}
            </div>
            <div style={{
                fontSize: '11px',
                textAlign: 'center',
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
                width: '70px'
            }}>
                {app.name}
            </div>
        </div>
    );
};

const AppsPanel = ({ onOpenApp }) => {
    const [activeAppId, setActiveAppId] = useState(null);
    const { experimental, appOrder, reorderApps } = useSettingsStore();

    // Built-in apps
    const baseApps = [
        ...(experimental?.vscodeApp ? [{ id: 'vscode', name: 'VS Code', icon: <FiPackage />, color: '#007acc' }] : []),
        { id: 'notes', name: 'Notes', icon: <FiMessageSquare />, color: '#f1c40f' },
        { id: 'learn', name: 'Learn', icon: <FiBookOpen />, color: '#7f5af0' },
        { id: 'codechamp', name: 'CodeChamp', icon: <FiZap />, color: '#8e44ad' },
        { id: 'quickpython', name: 'Quick Python', icon: <FiCode />, color: '#3498db' },
        { id: 'calls', name: 'Calls', icon: <FiPhone />, color: '#2ecc71' },
    ];

    const [orderedApps, setOrderedApps] = useState(baseApps);

    useEffect(() => {
        if (appOrder && appOrder.length > 0) {
            const sorted = [...baseApps].sort((a, b) => {
                const indexA = appOrder.indexOf(a.id);
                const indexB = appOrder.indexOf(b.id);
                // If both are in order, sort by index
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                // If only a is in order, a comes first
                if (indexA !== -1) return -1;
                // If only b is in order, b comes first
                if (indexB !== -1) return 1;
                // If neither, keep original order (or sort alphabetically/id if needed)
                return 0;
            });
            setOrderedApps(sorted);
        } else {
            setOrderedApps(baseApps);
        }
    }, [experimental?.vscodeApp, appOrder]);


    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            const oldIndex = orderedApps.findIndex((item) => item.id === active.id);
            const newIndex = orderedApps.findIndex((item) => item.id === over.id);

            const newOrderedApps = arrayMove(orderedApps, oldIndex, newIndex);
            setOrderedApps(newOrderedApps);
            reorderApps(newOrderedApps.map(app => app.id));
        }
    };

    // Get current time
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    if (activeAppId === 'calls') {
        return <CallingPanel onBack={() => setActiveAppId(null)} />;
    }

    return (
        <div className="panel-content" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', fontSize: '18px' }}>
                    Apps
                </h3>
                <span style={{ fontSize: '12px', opacity: 0.6 }}>{timeString}</span>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={orderedApps.map(app => app.id)}
                    strategy={rectSortingStrategy}
                >
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))',
                        gap: '12px',
                        justifyContent: 'center'
                    }}>
                        {orderedApps.map(app => (
                            <SortableAppItem
                                key={app.id}
                                app={app}
                                onOpenApp={onOpenApp}
                                setActiveAppId={setActiveAppId}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    );
}

export default AppsPanel;

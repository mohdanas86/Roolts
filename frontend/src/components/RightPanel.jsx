import React, { Suspense, lazy } from 'react';
import {
    FiChevronLeft, FiChevronRight, FiChevronDown, FiChevronUp,
    FiEye, FiGithub, FiShare2, FiBookOpen, FiGrid, FiPackage, FiZap
} from 'react-icons/fi';
import { useUIStore, useFileStore, useSettingsStore } from '../store';
import WebPreview from './WebPreview';
import LearningPanel from './LearningPanel';
import AppsPanel from './AppsPanel';

// Lazy load apps
const NotesApp = lazy(() => import('./apps/NotesApp.jsx'));
const VSCodeApp = lazy(() => import('./apps/VSCodeApp.jsx'));
const QuickPythonApp = lazy(() => import('./apps/QuickPythonApp.jsx'));
const CodeChampApp = lazy(() => import('./apps/CodeChampApp.jsx'));

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableTab({ tab, isActive, onClick }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: tab.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1000 : 'auto',
        opacity: isDragging ? 0.5 : 1,
        position: 'relative'
    };

    return (
        <button
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`panel-tab ${isActive ? 'panel-tab--active' : ''}`}
            onClick={onClick}
            title={tab.label}
        >
            {tab.icon}
        </button>
    );
}

function RightPanel({ style, editorMinimized }) {
    const {
        rightPanelOpen, rightPanelTab, setRightPanelTab, toggleRightPanel,
        rightPanelExpanded, toggleRightPanelExpanded,
        rightPanelTabOrder, reorderRightPanelTabs,
        rightPanelWidth, setRightPanelWidth,
        lastOpenWidth, setLastOpenWidth,
        isResizing
    } = useUIStore();
    const { files, activeFileId } = useFileStore();
    const { experimental } = useSettingsStore();

    const [isAnimating, setIsAnimating] = React.useState(false);

    const handleDoubleClick = () => {
        setIsAnimating(true);
        if (rightPanelOpen) {
            toggleRightPanel();
        } else {
            setRightPanelWidth(lastOpenWidth || window.innerWidth / 2);
            toggleRightPanel();
        }
        setTimeout(() => setIsAnimating(false), 300);
    };


    // Window Resize Awareness
    React.useEffect(() => {
        const handleWindowResize = () => {
            const maxAllowedWidth = window.innerWidth * 0.8;
            if (rightPanelWidth > maxAllowedWidth) {
                setRightPanelWidth(Math.max(320, maxAllowedWidth));
            }
            if (window.innerWidth < 800 && rightPanelOpen) {
                toggleRightPanel();
            }
        };
        window.addEventListener('resize', handleWindowResize);
        return () => window.removeEventListener('resize', handleWindowResize);
    }, [rightPanelWidth, rightPanelOpen, toggleRightPanel, setRightPanelWidth]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            const oldIndex = rightPanelTabOrder.indexOf(active.id);
            const newIndex = rightPanelTabOrder.indexOf(over.id);
            reorderRightPanelTabs(oldIndex, newIndex);
        }
    };

    if (!rightPanelOpen) {
        return (
            <div
                className={`right-panel right-panel--collapsed ${isAnimating ? 'right-panel--animate' : ''}`}
                style={{ width: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '12px' }}
            >
                <button
                    className="btn btn--ghost btn--icon"
                    onClick={toggleRightPanel}
                >
                    <FiChevronLeft />
                </button>
            </div>
        );
    }

    const allTabs = [
        { id: 'learn', label: 'Learn', icon: <FiBookOpen /> },
        { id: 'apps', label: 'Apps', icon: <FiGrid /> },
        ...(experimental?.vscodeApp ? [{ id: 'vscode', label: 'VS Code', icon: <FiPackage /> }] : []),
        { id: 'codechamp', label: 'CodeChamp', icon: <FiZap /> }
    ];

    // Filter to ensure we only show enabled tabs but in the correct order
    const orderedTabs = (rightPanelTabOrder || allTabs.map(t => t.id))
        .map(id => allTabs.find(t => t.id === id))
        .filter(Boolean);

    // If there are new tabs compliant with features not yet in order, append them
    allTabs.forEach(tab => {
        if (!orderedTabs.find(t => t.id === tab.id)) {
            orderedTabs.push(tab);
        }
    });

    const panelStyle = rightPanelExpanded
        ? (editorMinimized ? { maxWidth: 'calc(100% - 60px)' } : {})
        : style;

    return (
        <div
            className={`right-panel ${rightPanelExpanded ? 'right-panel--expanded' : ''} ${isAnimating || !isResizing ? 'right-panel--animate' : ''}`}
            style={{ ...panelStyle, width: `${rightPanelWidth}px`, position: 'relative' }}
            role="complementary"
            aria-label="AI Assistant Sidebar"
        >
            {true && (
                <div className="panel-tabs">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={orderedTabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
                            {orderedTabs.map((tab) => (
                                <SortableTab
                                    key={tab.id}
                                    tab={tab}
                                    isActive={rightPanelTab === tab.id}
                                    onClick={() => setRightPanelTab(tab.id)}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>

                    <div style={{ flex: 1 }} />

                    <button
                        className="btn btn--ghost btn--icon"
                        onClick={toggleRightPanelExpanded}
                        title={rightPanelExpanded ? "Collapse Panel" : "Expand Panel (minimize editor)"}
                    >
                        {rightPanelExpanded ? <FiChevronDown /> : <FiChevronUp />}
                    </button>
                    <button className="btn btn--ghost btn--icon" onClick={toggleRightPanel}>
                        <FiChevronRight />
                    </button>
                </div>
            )}

            <Suspense fallback={<div className="panel-loading"><div className="spinner"></div> Loading...</div>}>
                {rightPanelTab === 'preview' && (
                    <WebPreview
                        files={files}
                        activeFileId={activeFileId}
                        onClose={() => setRightPanelTab('apps')}
                    />
                )}
                {rightPanelTab === 'learn' && <LearningPanel onBack={() => setRightPanelTab('apps')} />}
                {rightPanelTab === 'apps' && <AppsPanel onOpenApp={setRightPanelTab} />}

                {rightPanelTab === 'notes' && (
                    <NotesApp onBack={() => setRightPanelTab('apps')} isWindowed={false} />
                )}
                {rightPanelTab === 'vscode' && experimental?.vscodeApp && (
                    <VSCodeApp onBack={() => setRightPanelTab('apps')} isWindowed={false} />
                )}
                {rightPanelTab === 'quickpython' && (
                    <QuickPythonApp onBack={() => setRightPanelTab('apps')} isWindowed={false} />
                )}
                {rightPanelTab === 'codechamp' && (
                    <CodeChampApp onClose={() => setRightPanelTab('apps')} />
                )}
            </Suspense>
        </div>
    );
}

export default RightPanel;

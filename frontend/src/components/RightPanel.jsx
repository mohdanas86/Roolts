import React, { Suspense, lazy } from 'react';
import {
    FiChevronLeft, FiChevronRight, FiChevronDown, FiChevronUp,
    FiEye, FiGithub, FiShare2, FiBookOpen, FiGrid, FiPackage, FiZap
} from 'react-icons/fi';
import { useUIStore, useFileStore } from '../store';
import AILogo from './AILogo';

// Lazy load all panels and apps for maximum performance
const WebPreview = lazy(() => import('./WebPreview'));
const BrowserPreview = lazy(() => import('./BrowserPreview'));
const LearningPanel = lazy(() => import('./LearningPanel.jsx'));
const CodeChampApp = lazy(() => import('./apps/CodeChampApp'));
const AppsPanel = lazy(() => import('./AppsPanel'));
const NotesApp = lazy(() => import('./apps/NotesApp.jsx'));
const QuickPythonApp = lazy(() => import('./apps/QuickPythonApp.jsx'));
const VSCodeApp = lazy(() => import('./apps/VSCodeApp.jsx'));
const SnapshotsApp = lazy(() => import('./apps/SnapshotsApp.jsx'));
const LearnApp = lazy(() => import('./apps/LearnApp.jsx'));



function RightPanel({ style, editorMinimized }) {
    const rightPanelOpen = useUIStore(state => state.rightPanelOpen);
    const rightPanelTab = useUIStore(state => state.rightPanelTab);
    const setRightPanelTab = useUIStore(state => state.setRightPanelTab);
    const toggleRightPanel = useUIStore(state => state.toggleRightPanel);
    const rightPanelExpanded = useUIStore(state => state.rightPanelExpanded);
    const toggleRightPanelExpanded = useUIStore(state => state.toggleRightPanelExpanded);
    const rightPanelWidth = useUIStore(state => state.rightPanelWidth);
    const setRightPanelWidth = useUIStore(state => state.setRightPanelWidth);
    const isResizing = useUIStore(state => state.isResizing);
    const appPreviewUrl = useUIStore(state => state.appPreviewUrl);
    const setAppPreviewUrl = useUIStore(state => state.setAppPreviewUrl);

    // files & activeFileId removed (handed off to WebPreview)
    const [isAnimating, setIsAnimating] = React.useState(false);

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

    const panelStyle = rightPanelExpanded
        ? (editorMinimized ? { maxWidth: 'calc(100% - 60px)' } : {})
        : style;

    return (
        <div
            className={`right-panel ${!rightPanelOpen ? 'right-panel--collapsed' : ''} ${rightPanelExpanded ? 'right-panel--expanded' : ''} ${isAnimating || !isResizing ? 'right-panel--animate' : ''}`}
            style={{
                ...panelStyle,
                width: rightPanelOpen ? `${rightPanelWidth}px` : '50px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column'
            }}
            role="complementary"
            aria-label="AI Assistant Sidebar"
        >
            {/* Collapsed Sidebar Content */}
            {!rightPanelOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '12px', gap: '16px', height: '100%', background: 'var(--bg-secondary)' }}>
                    <button
                        className="btn btn--ghost btn--icon"
                        onClick={() => { setRightPanelTab('learn'); toggleRightPanel(); }}
                        title="AI Assistant"
                        style={{ width: '36px', height: '36px', borderRadius: '8px', color: rightPanelTab === 'learn' ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                    >
                        <AILogo size={20} active={rightPanelTab === 'learn'} />
                    </button>
                    <button
                        className="btn btn--ghost btn--icon"
                        onClick={() => { setRightPanelTab('apps'); toggleRightPanel(); }}
                        title="Apps"
                        style={{ width: '36px', height: '36px', borderRadius: '8px', color: rightPanelTab === 'apps' ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                    >
                        <FiGrid size={20} />
                    </button>
                    <button
                        className="btn btn--ghost btn--icon"
                        onClick={() => { setRightPanelTab('codechamp'); toggleRightPanel(); }}
                        title="CodeChamp"
                        style={{ width: '36px', height: '36px', borderRadius: '8px', color: rightPanelTab === 'codechamp' ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                    >
                        <FiZap size={20} />
                    </button>
                </div>
            )}

            {/* Expanded Sidebar Content */}
            <div style={{ display: rightPanelOpen ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <div className="panel-tabs" style={{ justifyContent: 'flex-start', gap: '8px' }}>
                    <button
                        className={`panel-tab ${rightPanelTab === 'learn' ? 'panel-tab--active' : ''}`}
                        onClick={() => setRightPanelTab('learn')}
                        title="AI Assistant"
                    >
                        <AILogo size={14} active={rightPanelTab === 'learn'} /> <span style={{ marginLeft: '6px' }}>AI</span>
                    </button>
                    <button
                        className={`panel-tab ${rightPanelTab === 'apps' ? 'panel-tab--active' : ''}`}
                        onClick={() => setRightPanelTab('apps')}
                        title="Applications"
                    >
                        <FiGrid /> <span style={{ marginLeft: '6px' }}>Apps</span>
                    </button>
                    <button
                        className={`panel-tab ${rightPanelTab === 'codechamp' ? 'panel-tab--active' : ''}`}
                        onClick={() => setRightPanelTab('codechamp')}
                        title="CodeChamp"
                    >
                        <FiZap /> <span style={{ marginLeft: '6px' }}>CodeChamp</span>
                    </button>

                    <div style={{ flex: 1 }} />

                    <button
                        className="btn btn--ghost btn--icon"
                        onClick={toggleRightPanelExpanded}
                        title={rightPanelExpanded ? "Collapse Panel" : "Expand Panel (minimize editor)"}
                    >
                        {rightPanelExpanded ? <FiChevronDown /> : <FiChevronUp />}
                    </button>
                    <button
                        className="btn btn--ghost btn--icon"
                        onClick={toggleRightPanel}
                        title="Minimize Sidebar"
                        style={{ marginLeft: '4px' }}
                    >
                        <FiChevronRight />
                    </button>
                </div>

                <div style={{ flex: 1, position: 'relative', overflow: 'hidden', pointerEvents: isResizing ? 'none' : 'auto' }}>
                    <Suspense fallback={<div className="panel-loading"><div className="spinner"></div> Loading...</div>}>
                        {rightPanelTab === 'preview' && (
                            appPreviewUrl ? (
                                <BrowserPreview
                                    url={appPreviewUrl}
                                    onClose={() => {
                                        setAppPreviewUrl(null);
                                        setRightPanelTab('apps');
                                    }}
                                />
                            ) : (
                                <WebPreview
                                    onClose={() => setRightPanelTab('apps')}
                                />
                            )
                        )}

                        {/* Only mount the active panel to save memory */}
                        {rightPanelTab === 'learn' && (
                            <LearningPanel onBack={() => setRightPanelTab('apps')} />
                        )}

                        {rightPanelTab === 'codechamp' && (
                            <CodeChampApp onClose={() => setRightPanelTab('apps')} />
                        )}

                        {rightPanelTab === 'apps' && <AppsPanel onOpenApp={setRightPanelTab} />}

                        {rightPanelTab === 'notes' && (
                            <NotesApp onBack={() => setRightPanelTab('apps')} isWindowed={false} />
                        )}
                        {rightPanelTab === 'snapshots' && (
                            <SnapshotsApp onBack={() => setRightPanelTab('apps')} isWindowed={false} />
                        )}
                        {rightPanelTab === 'quickpython' && (
                            <QuickPythonApp onBack={() => setRightPanelTab('apps')} isWindowed={false} />
                        )}
                        {rightPanelTab === 'extensions' && (
                            <VSCodeApp onBack={() => setRightPanelTab('apps')} />
                        )}
                        {rightPanelTab === 'learn_app' && (
                            <LearnApp onClose={() => setRightPanelTab('apps')} />
                        )}
                    </Suspense>
                </div>
            </div>
        </div>
    );
}

export default RightPanel;

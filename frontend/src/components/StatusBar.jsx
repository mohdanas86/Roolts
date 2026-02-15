import { FiCheckCircle, FiAlertCircle, FiCpu, FiTerminal, FiGrid, FiBookOpen } from 'react-icons/fi';
import { useFileStore, useUIStore } from '../store';
import { getFileIcon } from '../services/iconHelper.jsx';

function StatusBar({ terminalOpen, setTerminalOpen }) {
    const { files, activeFileId } = useFileStore();
    const activeFile = files.find((f) => f.id === activeFileId);
    const { toggleRightPanel, setRightPanelTab, rightPanelOpen, rightPanelTab } = useUIStore();

    return (
        <div className="status-bar">
            <div className="status-bar__left">
                <button
                    className={`status-bar__item btn btn--ghost ${terminalOpen ? 'status-bar__item--active' : ''}`}
                    onClick={() => setTerminalOpen(!terminalOpen)}
                    style={{ padding: '0 8px', height: '100%', borderRadius: 0, border: 'none' }}
                >
                    <FiTerminal size={14} style={{ marginRight: '4px' }} />
                    Terminal
                </button>
            </div>
            <div className="status-bar__right">
                {activeFile && (
                    <>
                        <span className="status-bar__item" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {getFileIcon(activeFile.language)}
                            {activeFile.language}
                        </span>
                        <span className="status-bar__item">UTF-8</span>
                        <span className="status-bar__item">
                            {activeFile.content.split('\n').length} lines
                        </span>
                    </>
                )}
                <span className="status-bar__item">
                    <FiCpu size={12} /> Roolts Ready
                </span>

                <div className="status-bar__divider" style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

                <button
                    className={`status-bar__item btn btn--ghost ${rightPanelOpen && rightPanelTab === 'learn' ? 'status-bar__item--active' : ''}`}
                    onClick={() => {
                        setRightPanelTab('learn');
                        if (!rightPanelOpen) toggleRightPanel();
                    }}
                    title="Open Roolts AI"
                    style={{ padding: '0 8px', height: '100%', borderRadius: 0, border: 'none' }}
                >
                    <FiBookOpen size={13} style={{ color: 'var(--accent-primary)' }} />
                </button>

                <button
                    className={`status-bar__item btn btn--ghost ${rightPanelOpen && rightPanelTab === 'apps' ? 'status-bar__item--active' : ''}`}
                    onClick={() => {
                        setRightPanelTab('apps');
                        if (!rightPanelOpen) toggleRightPanel();
                    }}
                    title="Open Apps"
                    style={{ padding: '0 8px', height: '100%', borderRadius: 0, border: 'none' }}
                >
                    <FiGrid size={13} />
                </button>
            </div>
        </div>
    );
}

export default StatusBar;

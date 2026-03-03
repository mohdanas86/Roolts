import React, { useState } from 'react';
import { FiCopy, FiSearch, FiGitBranch, FiBox, FiSettings, FiUser, FiGrid, FiX, FiMessageSquare, FiBookOpen, FiZap, FiCode, FiMonitor, FiLayers, FiImage } from 'react-icons/fi';

const ActivityBar = ({ activeView, onActivityClick, onSettingsClick }) => {

    const topActivities = [
        { id: 'explorer', icon: <FiLayers size={26} strokeWidth={1.5} />, label: 'Explorer' }
    ];

    const bottomActivities = [];

    const appIcons = {
        notes: <FiMessageSquare size={22} />,
        learn_app: <FiBookOpen size={22} />,
        codechamp: <FiZap size={22} />,
        snapshots: <FiImage size={22} />,
        quickpython: <FiCode size={22} />,
        calls: <FiMonitor size={22} />
    };

    const appNames = {
        notes: 'Notes',
        learn_app: 'Learn',
        codechamp: 'CodeChamp',
        snapshots: 'Snapshots',
        quickpython: 'Python',
        calls: 'Collaboration'
    };

    return (
        <div className="activity-bar">
            <div className="activity-bar__top">
                {topActivities.map(activity => (
                    <div
                        key={activity.id}
                        className={`activity-item ${activeView === activity.id ? 'activity-item--active' : ''}`}
                        onClick={() => onActivityClick(activity.id)}
                        title={activity.label}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
                    >
                        {activity.icon}
                        {activity.id === 'explorer' && (
                            <span style={{
                                fontSize: '9px',
                                fontWeight: '600',
                                writingMode: 'vertical-rl',
                                textOrientation: 'mixed',
                                transform: 'rotate(180deg)',
                                marginTop: '6px',
                                letterSpacing: '1.5px',
                                textTransform: 'uppercase',
                                opacity: 0.8,
                                transition: 'opacity 0.2s'
                            }}>
                                EXPLORER
                            </span>
                        )}
                    </div>
                ))}

                <div className="activity-divider" style={{ width: '20px', height: '1px', background: 'var(--border-primary)', margin: '8px 0' }} />
            </div>
            <div className="activity-bar__bottom">
                {bottomActivities.map(activity => (
                    <div
                        key={activity.id}
                        className={`activity-item ${activeView === activity.id ? 'activity-item--active' : ''}`}
                        onClick={() => activity.onClick ? activity.onClick() : onActivityClick(activity.id)}
                        title={activity.label}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        {activity.icon}
                    </div>
                ))}
            </div>

            <style>{`
                .activity-bar {
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    background: var(--bg-secondary);
                    border-right: 1px solid var(--border-primary);
                    width: 48px;
                    padding: 8px 0;
                    flex-shrink: 0;
                }
                .activity-app-item {
                    margin-bottom: 4px;
                }
                .activity-item-close:hover {
                    color: var(--error) !important;
                    background: rgba(248, 81, 73, 0.1) !important;
                }
            `}</style>
        </div>
    );
};

export default ActivityBar;

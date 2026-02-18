import React from 'react';
import { FiCopy, FiSearch, FiGitBranch, FiBox, FiSettings, FiUser, FiGrid } from 'react-icons/fi';

const ActivityBar = ({ activeView, onActivityClick, onSettingsClick }) => {
    const topActivities = [
        { id: 'explorer', icon: <FiCopy size={24} />, label: 'Explorer' }
    ];

    const bottomActivities = [
        { id: 'settings', icon: <FiSettings size={24} />, label: 'Settings', onClick: onSettingsClick }
    ];

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
            </div>
            <div className="activity-bar__bottom">
                {bottomActivities.map(activity => (
                    <div
                        key={activity.id}
                        className={`activity-item ${activeView === activity.id ? 'activity-item--active' : ''}`}
                        onClick={() => activity.onClick ? activity.onClick() : onActivityClick(activity.id)}
                        title={activity.label}
                    >
                        {activity.icon}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ActivityBar;

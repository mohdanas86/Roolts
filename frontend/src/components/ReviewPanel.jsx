import React, { useState } from 'react';
import { FiAlertCircle, FiCheckCircle, FiInfo, FiPlay, FiCpu } from 'react-icons/fi';
import { useLearningStore, useFileStore, useUIStore } from '../store';
import aiHubService from '../services/aiHubService';

const ReviewPanel = () => {
    const {
        reviewResults,
        isReviewing,
        setReviewResults,
        setReviewing
    } = useLearningStore();

    const { activeFileId, files } = useFileStore();
    const { addNotification } = useUIStore();

    const activeFile = files.find(f => f.id === activeFileId);

    const handleReview = async () => {
        if (!activeFile) return;

        setReviewing(true);
        try {
            const data = await aiHubService.reviewCode(activeFile.content, activeFile.language);

            if (data.review) {
                setReviewResults(data.review);
                if (data.review.issues.length === 0) {
                    addNotification({ type: 'success', message: 'No issues found! Great job!' });
                } else {
                    addNotification({ type: 'success', message: `Found ${data.review.issues.length} issues.` });
                }
            }
        } catch (error) {
            console.error('Review failed:', error);
            addNotification({ type: 'error', message: 'Code review failed. Try again.' });
        } finally {
            setReviewing(false);
        }
    };

    if (!activeFile) {
        return (
            <div className="panel-empty-state">
                <FiAlertCircle size={48} />
                <p>No file selected</p>
            </div>
        );
    }

    return (
        <div className="review-panel premium-glass">
            <div className="premium-header">
                <div className="premium-header__left">
                    <div className="brand-badge">
                        <FiCpu className="brand-badge__icon" />
                        <span>AI Code Review</span>
                    </div>
                </div>
                <div className="premium-header__right">
                    <button
                        className="premium-send-btn"
                        onClick={handleReview}
                        disabled={isReviewing}
                        style={{ padding: '8px 16px', height: 'auto' }}
                    >
                        {isReviewing ? (
                            <FiActivity className="spin" />
                        ) : (
                            <><FiCpu /> <span>Analyze Code</span></>
                        )}
                    </button>
                </div>
            </div>

            <div className="review-content" style={{ padding: '1.5rem', height: 'calc(100% - 70px)', overflowY: 'auto' }}>
                {reviewResults && (
                    <div className="review-results">
                        {reviewResults.issues.length === 0 ? (
                            <div className="welcome-hero">
                                <div className="welcome-hero__visual">
                                    <div className="glow-orb" style={{ background: 'rgba(16, 185, 129, 0.2)' }}></div>
                                    <FiCheckCircle size={48} style={{ color: 'var(--success)' }} className="floating-icon" />
                                </div>
                                <h2>No Issues Found!</h2>
                                <p>Your code looks clean, efficient, and secure. Great job!</p>
                            </div>
                        ) : (
                            <div className="issues-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {reviewResults.issues.map((issue, index) => (
                                    <div key={index} className={`premium-card issue-card--${issue.type}`} style={{
                                        borderLeft: `4px solid ${issue.type === 'error' ? 'var(--error)' :
                                            issue.type === 'warning' ? 'var(--warning)' : 'var(--info)'
                                            }`
                                    }}>
                                        <div className="premium-card__header" style={{
                                            color: issue.type === 'error' ? 'var(--error)' :
                                                issue.type === 'warning' ? 'var(--warning)' : 'var(--info)'
                                        }}>
                                            {issue.type === 'error' && <FiAlertCircle />}
                                            {issue.type === 'warning' && <FiAlertCircle />}
                                            {issue.type === 'info' && <FiInfo />}

                                            <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.75rem' }}>{issue.type}</span>
                                            {issue.line && (
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    padding: '2px 8px',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    borderRadius: '20px',
                                                    marginLeft: 'auto'
                                                }}>Line {issue.line}</span>
                                            )}
                                        </div>
                                        <div className="premium-card__body">
                                            <p style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '0.95rem' }}>{issue.message}</p>
                                            {issue.fix && (
                                                <div className="premium-code-block" style={{ marginTop: '0.5rem' }}>
                                                    <div className="premium-code-header">
                                                        <span className="lang-tag">Suggestion</span>
                                                    </div>
                                                    <div style={{ padding: '12px', background: '#0a0c10', borderRadius: '0 0 8px 8px', fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>
                                                        {issue.fix}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {!reviewResults && !isReviewing && (
                    <div className="welcome-hero">
                        <div className="welcome-hero__visual">
                            <div className="glow-orb"></div>
                            <FiCpu size={48} className="floating-icon" />
                        </div>
                        <h2>Smart Code Review</h2>
                        <p>Let AI analyze your implementation for potential bugs, security holes, and optimization opportunities.</p>
                        <button className="btn btn--primary" onClick={handleReview} style={{ marginTop: '1rem' }}>
                            <FiPlay /> Start Analysis
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReviewPanel;

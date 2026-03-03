import React from 'react';

const AILogo = ({ size = 24, active = false }) => {
    return (
        <div className={`ai-logo-container ${active ? 'ai-logo--active' : ''}`} style={{ width: size, height: size }}>
            <div className="ai-logo-core">
                <div className="ai-logo-orb"></div>
                <div className="ai-logo-ring ring-1"></div>
                <div className="ai-logo-ring ring-2"></div>
            </div>
            {active && <div className="ai-logo-glow"></div>}

            <style>{`
                .ai-logo-container {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }

                .ai-logo-core {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .ai-logo-orb {
                    width: 40%;
                    height: 40%;
                    background: var(--accent-gradient);
                    border-radius: 50%;
                    z-index: 2;
                    box-shadow: 0 0 15px var(--accent-primary);
                    animation: orb-float 3s infinite ease-in-out;
                }

                .ai-logo-ring {
                    position: absolute;
                    border: 1.5px solid var(--accent-primary);
                    border-radius: 50%;
                    opacity: 0.6;
                    transition: all 0.4s ease;
                }

                .ring-1 {
                    width: 70%;
                    height: 70%;
                    border-color: var(--accent-secondary);
                    animation: rotate-reverse 4s infinite linear;
                }

                .ring-2 {
                    width: 100%;
                    height: 100%;
                    border-style: dashed;
                    border-width: 1px;
                    animation: rotate 8s infinite linear;
                }

                .ai-logo-glow {
                    position: absolute;
                    width: 150%;
                    height: 150%;
                    background: radial-gradient(circle, rgba(var(--accent-primary-rgb), 0.2) 0%, transparent 70%);
                    pointer-events: none;
                    animation: glow-pulse 2s infinite ease-in-out;
                }

                /* Active State */
                .ai-logo--active .ai-logo-orb {
                    transform: scale(1.2);
                    box-shadow: 0 0 25px var(--accent-secondary);
                }
                .ai-logo--active .ring-1 {
                    border-color: var(--accent-primary);
                    opacity: 1;
                    width: 80%;
                    height: 80%;
                }

                /* Hover State */
                .ai-logo-container:hover {
                    transform: scale(1.05);
                }
                .ai-logo-container:hover .ring-1 {
                    transform: scale(1.2);
                    opacity: 1;
                }
                .ai-logo-container:hover .ring-2 {
                    transform: scale(0.9);
                    opacity: 0.8;
                }

                @keyframes orb-float {
                    0%, 100% { transform: translateY(0) scale(1); }
                    50% { transform: translateY(-10%) scale(1.05); }
                }

                @keyframes rotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                @keyframes rotate-reverse {
                    from { transform: rotate(360deg); }
                    to { transform: rotate(0deg); }
                }

                @keyframes glow-pulse {
                    0%, 100% { opacity: 0.4; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.2); }
                }
            `}</style>
        </div>
    );
};

export default AILogo;

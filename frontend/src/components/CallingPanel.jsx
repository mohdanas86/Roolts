import React, { useState, useEffect, useRef } from 'react';
import { FiArrowLeft, FiMonitor, FiShield, FiCopy, FiCheck, FiMessageSquare, FiSend, FiX, FiUsers, FiSettings, FiMousePointer } from 'react-icons/fi';
import { collaborationService } from '../services/collaborationService';

const CallingPanel = ({ onBack }) => {
    const [view, setView] = useState('dialer'); // dialer, calling
    const [roomId, setRoomId] = useState('');
    const [username, setUsername] = useState('User-' + Math.floor(Math.random() * 9999));
    const [callStatus, setCallStatus] = useState('Ready to collaborate');
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [remoteStreams, setRemoteStreams] = useState({}); // sid -> { stream, username }
    const [localStream, setLocalStream] = useState(null);
    const [controlRequest, setControlRequest] = useState(null);
    const [hasControl, setHasControl] = useState(false);
    const [isBeingControlled, setIsBeingControlled] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [participants, setParticipants] = useState([]);

    const localVideoRef = useRef(null);
    const remoteVideoRefs = useRef({});
    const chatEndRef = useRef(null);

    // Generate random room ID
    const generateRoomId = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setRoomId(result);
    };

    // Copy room link
    const copyRoomLink = () => {
        navigator.clipboard.writeText(roomId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    useEffect(() => {
        // Initialize service listeners
        collaborationService.onUserJoined = ({ username, sid }) => {
            setCallStatus(`${username} joined`);
            setParticipants(prev => [...prev.filter(p => p.sid !== sid), { sid, username }]);
            setRemoteStreams(prev => ({
                ...prev,
                [sid]: { ...prev[sid], username }
            }));
        };

        collaborationService.onUserLeft = ({ sid }) => {
            setParticipants(prev => prev.filter(p => p.sid !== sid));
            setRemoteStreams(prev => {
                const updated = { ...prev };
                delete updated[sid];
                return updated;
            });
        };

        collaborationService.onStream = ({ stream, sid }) => {
            setRemoteStreams(prev => ({
                ...prev,
                [sid]: { ...prev[sid], stream }
            }));
        };

        collaborationService.onRequestControl = ({ username, requester }) => {
            setControlRequest({ username, requester });
        };

        collaborationService.onGrantControl = () => {
            setHasControl(true);
            setCallStatus('Control granted! You can now control the remote screen.');
            // Trigger global state in App via custom event if needed, but we'll handle it via props/store soon
            window.dispatchEvent(new CustomEvent('control-granted', { detail: { isController: true } }));
        };

        collaborationService.onRevokeControl = () => {
            setHasControl(false);
            setIsBeingControlled(false);
            window.dispatchEvent(new CustomEvent('control-granted', { detail: { isController: false } }));
        };

        collaborationService.onChatMessage = ({ username, message, timestamp }) => {
            setChatMessages(prev => [...prev, { username, message, timestamp }]);
        };

        return () => {
            collaborationService.leaveRoom();
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    useEffect(() => {
        if (localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        Object.entries(remoteStreams).forEach(([sid, data]) => {
            if (data?.stream && remoteVideoRefs.current[sid]) {
                remoteVideoRefs.current[sid].srcObject = data.stream;
            }
        });
    }, [remoteStreams]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const startSession = async () => {
        if (!roomId) {
            generateRoomId();
            return;
        }

        setView('calling');
        setCallStatus('Connecting...');
        collaborationService.connect();
        collaborationService.joinRoom(roomId, username);

        // Poll for actual connection instead of hardcoded delay
        let retries = 0;
        const checkConnection = setInterval(() => {
            retries++;
            if (collaborationService.isConnected()) {
                clearInterval(checkConnection);
                setCallStatus('Connected. Ready to share.');
            } else if (retries > 10) {
                clearInterval(checkConnection);
                setCallStatus('Connection may be slow. Try again if issues persist.');
            }
        }, 500);
    };

    const handleScreenShare = async () => {
        if (isScreenSharing) {
            // Stop sharing
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            setLocalStream(null);
            setIsScreenSharing(false);
            setCallStatus('Screen sharing stopped.');
        } else {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: { cursor: "always" },
                    audio: false
                });
                setLocalStream(stream);
                collaborationService.setLocalStream(stream);
                setIsScreenSharing(true);
                setCallStatus('Sharing your screen.');

                // When user clicks 'Stop sharing' in the browser bar
                stream.getVideoTracks()[0].onended = () => {
                    // Direct cleanup — avoid recursive call to handleScreenShare
                    stream.getTracks().forEach(track => track.stop());
                    setLocalStream(null);
                    setIsScreenSharing(false);
                    setCallStatus('Screen sharing stopped.');
                };
            } catch (err) {
                console.error("Failed to share screen", err);
                setCallStatus('Screen share cancelled.');
            }
        }
    };

    const grantControl = () => {
        if (controlRequest) {
            collaborationService.grantControl(controlRequest.requester);
            setControlRequest(null);
            setIsBeingControlled(true);
            window.dispatchEvent(new CustomEvent('being-controlled', { detail: { isBeingControlled: true } }));
        }
    };

    const revokeControl = () => {
        collaborationService.revokeControl();
        setIsBeingControlled(false);
        window.dispatchEvent(new CustomEvent('being-controlled', { detail: { isBeingControlled: false } }));
    };

    const endSession = () => {
        collaborationService.leaveRoom();
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        setLocalStream(null);
        setRemoteStreams({});
        setParticipants([]);
        setHasControl(false);
        setIsBeingControlled(false);
        setView('dialer');
    };

    const requestControl = () => {
        collaborationService.requestControl(username);
        setCallStatus('Requesting control...');
    };

    const sendChat = () => {
        if (!chatInput.trim()) return;
        collaborationService.sendChatMessage(username, chatInput);
        setChatMessages(prev => [...prev, { username: 'You', message: chatInput, timestamp: Date.now() }]);
        setChatInput('');
    };

    const getGridStyle = () => {
        const count = Object.keys(remoteStreams).length;
        if (count === 0) return {};
        if (count === 1) return { gridTemplateColumns: '1fr' };
        return { gridTemplateColumns: 'repeat(2, 1fr)' };
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#1a1a1a', color: 'white' }}>
            {/* Header */}
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #333', backgroundColor: '#222', gap: '12px' }}>
                <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <FiArrowLeft size={20} />
                </button>
                <h3 style={{ margin: 0, fontSize: '16px', flex: 1 }}>
                    {view === 'calling' ? `Session: ${roomId}` : 'Collaboration Hub'}
                </h3>
                {view === 'calling' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <FiUsers size={14} /> {participants.length + 1}
                        </span>
                        <button onClick={copyRoomLink} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', padding: '6px 12px', borderRadius: '4px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                            {copied ? <FiCheck size={14} /> : <FiCopy size={14} />}
                            {copied ? 'Copy ID' : 'Copy ID'}
                        </button>
                    </div>
                )}
            </div>

            {view === 'dialer' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '20px', padding: '20px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '10px' }}>🤝</div>
                    <h2 style={{ margin: 0, fontSize: '20px' }}>Real-time Collaboration</h2>
                    <p style={{ color: '#888', fontSize: '14px', textAlign: 'center', maxWidth: '360px' }}>
                        Share your screen and grant permission for others to control your window for seamless pair programming.
                    </p>

                    <input
                        type="text"
                        placeholder="Your name"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        style={{ padding: '12px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#333', color: 'white', fontSize: '14px', width: '250px', textAlign: 'center' }}
                    />

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input
                            type="text"
                            placeholder="Enter Session ID"
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value)}
                            style={{ padding: '12px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#333', color: 'white', fontSize: '14px', width: '250px', textAlign: 'center' }}
                        />
                        <button onClick={generateRoomId} title="Generate Session ID" style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#444', border: 'none', color: 'white', cursor: 'pointer' }}>
                            🎲
                        </button>
                    </div>

                    <button onClick={startSession} style={{ padding: '14px 40px', borderRadius: '25px', backgroundColor: '#2ecc71', border: 'none', color: 'white', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, marginTop: '10px' }}>
                        <FiMonitor /> {roomId ? 'Join Session' : 'Start Session'}
                    </button>
                </div>
            )}

            {view === 'calling' && (
                <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
                    {/* Main Content Area */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {/* Stream Grid */}
                        <div style={{ flex: 1, display: 'grid', gap: '4px', padding: '8px', backgroundColor: '#000', ...getGridStyle() }}>
                            {Object.keys(remoteStreams).length === 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ fontSize: '48px' }}>⏳</div>
                                    <p>Waiting for collaborators...</p>
                                    <p style={{ fontSize: '12px', color: '#444' }}>Share Session ID: <strong>{roomId}</strong></p>
                                </div>
                            ) : (
                                Object.entries(remoteStreams).map(([sid, data]) => (
                                    <div key={sid} style={{ position: 'relative', backgroundColor: '#222', borderRadius: '8px', overflow: 'hidden' }}>
                                        {data?.stream ? (
                                            <video
                                                ref={el => remoteVideoRefs.current[sid] = el}
                                                autoPlay
                                                playsInline
                                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                            />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#333' }}>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>👤</div>
                                                    <div style={{ fontSize: '14px' }}>{data?.username} (No stream)</div>
                                                </div>
                                            </div>
                                        )}
                                        <div style={{ position: 'absolute', bottom: '8px', left: '8px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                                            <span>{data?.username || 'Collaborator'}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Local Stream Overlay */}
                        <div style={{
                            position: 'absolute',
                            top: '16px',
                            right: showChat ? '316px' : '16px',
                            width: '200px',
                            height: '150px',
                            backgroundColor: '#333',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '2px solid rgba(255,255,255,0.2)',
                            transition: 'right 0.3s'
                        }}>
                            {isScreenSharing ? (
                                <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#444' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <FiMonitor size={24} style={{ opacity: 0.5, marginBottom: '8px' }} />
                                        <div style={{ fontSize: '11px', color: '#888' }}>Screen not shared</div>
                                    </div>
                                </div>
                            )}
                            <div style={{ position: 'absolute', bottom: '4px', left: '4px', fontSize: '10px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: '3px' }}>
                                You (Local Window)
                            </div>
                        </div>

                        {/* Being Controlled Banner */}
                        {isBeingControlled && (
                            <div style={{ position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#e74c3c', padding: '8px 16px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', zIndex: 10 }}>
                                <FiShield /> Your window is being controlled
                                <button onClick={revokeControl} style={{ background: 'rgba(0,0,0,0.3)', border: 'none', padding: '4px 8px', borderRadius: '4px', color: 'white', cursor: 'pointer', fontSize: '12px' }}>
                                    Stop Access
                                </button>
                            </div>
                        )}

                        {/* Controls */}
                        <div style={{ padding: '16px', display: 'flex', justifyContent: 'center', gap: '12px', backgroundColor: 'rgba(0,0,0,0.9)' }}>
                            <button onClick={handleScreenShare} title={isScreenSharing ? 'Stop Sharing' : 'Share My Window'} style={{ padding: '12px 24px', borderRadius: '25px', backgroundColor: isScreenSharing ? '#e74c3c' : '#3498db', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                                <FiMonitor /> {isScreenSharing ? 'Stop Sharing' : 'Share Window'}
                            </button>
                            <button
                                onClick={requestControl}
                                title="Request remote access"
                                style={{
                                    padding: '12px 24px',
                                    borderRadius: '25px',
                                    background: hasControl
                                        ? 'linear-gradient(135deg, #2ecc71, #27ae60)'
                                        : 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
                                    border: hasControl ? 'none' : '1px solid rgba(255,255,255,0.2)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    fontWeight: 600,
                                    boxShadow: hasControl ? '0 4px 15px rgba(46, 204, 113, 0.4)' : 'none',
                                    transition: 'all 0.2s',
                                    animation: hasControl ? 'pulse 2s infinite' : 'none'
                                }}
                            >
                                <FiMousePointer size={18} /> {hasControl ? 'Controlling Remote...' : 'Request Remote Access'}
                            </button>
                            <button onClick={() => setShowChat(!showChat)} style={{ padding: '14px', borderRadius: '50%', backgroundColor: showChat ? '#9b59b6' : 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer' }}>
                                <FiMessageSquare color="white" size={20} />
                            </button>
                            <button onClick={endSession} style={{ padding: '12px 24px', borderRadius: '25px', backgroundColor: '#444', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
                                Leave
                            </button>
                        </div>
                    </div>

                    {/* Chat Panel */}
                    {showChat && (
                        <div style={{ width: '300px', backgroundColor: '#222', borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '12px 16px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 600 }}>Chat</span>
                                <button onClick={() => setShowChat(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                                    <FiX size={18} />
                                </button>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                                {chatMessages.map((msg, i) => (
                                    <div key={i} style={{ marginBottom: '12px' }}>
                                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>{msg.username}</div>
                                        <div style={{ fontSize: '13px', backgroundColor: '#333', padding: '8px 10px', borderRadius: '8px' }}>{msg.message}</div>
                                    </div>
                                ))}
                                <div ref={chatEndRef} />
                            </div>
                            <div style={{ padding: '12px', borderTop: '1px solid #333', display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    placeholder="Type a message..."
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                                    style={{ flex: 1, padding: '10px', borderRadius: '20px', border: 'none', backgroundColor: '#333', color: 'white', fontSize: '13px' }}
                                />
                                <button onClick={sendChat} style={{ padding: '10px', borderRadius: '50%', backgroundColor: '#3498db', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <FiSend color="white" size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Control Request Popup */}
                    {controlRequest && (
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            backdropFilter: 'blur(4px)',
                            WebkitBackdropFilter: 'blur(4px)',
                            zIndex: 9998,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            animation: 'fadeIn 0.2s ease-out'
                        }}>
                            <div style={{
                                backgroundColor: '#222',
                                padding: '30px',
                                borderRadius: '16px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '20px',
                                width: '360px',
                                boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                animation: 'scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                            }}>
                                <div style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, rgba(52, 152, 219, 0.2), rgba(41, 128, 185, 0.1))',
                                    border: '1px solid rgba(52, 152, 219, 0.5)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#3498db',
                                    fontSize: '32px',
                                    marginBottom: '4px'
                                }}>
                                    <FiMousePointer />
                                </div>

                                <div style={{ textAlign: 'center' }}>
                                    <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px 0', color: 'white' }}>
                                        Remote Control Request
                                    </h3>
                                    <p style={{ fontSize: '14px', color: '#aaa', margin: 0, lineHeight: '1.5' }}>
                                        <strong style={{ color: 'white' }}>{controlRequest.username}</strong> would like to control your screen.
                                        They will be able to move your mouse and type on your keyboard.
                                    </p>
                                </div>

                                <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '8px' }}>
                                    <button
                                        onClick={() => setControlRequest(null)}
                                        style={{
                                            flex: 1,
                                            padding: '12px',
                                            backgroundColor: 'transparent',
                                            border: '1px solid #555',
                                            borderRadius: '8px',
                                            color: '#bbb',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={(e) => { e.target.style.backgroundColor = '#333'; e.target.style.color = 'white'; }}
                                        onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#bbb'; }}
                                    >
                                        Deny
                                    </button>
                                    <button
                                        onClick={grantControl}
                                        style={{
                                            flex: 1,
                                            padding: '12px',
                                            background: 'linear-gradient(135deg, #3498db, #2980b9)',
                                            border: 'none',
                                            borderRadius: '8px',
                                            color: 'white',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            boxShadow: '0 4px 15px rgba(52, 152, 219, 0.4)',
                                            transition: 'transform 0.1s'
                                        }}
                                        onMouseDown={(e) => e.target.style.transform = 'scale(0.98)'}
                                        onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
                                    >
                                        Grant Access
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CallingPanel;

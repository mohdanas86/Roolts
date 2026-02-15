import React, { useState, useEffect, useRef } from 'react';
import { FiPhone, FiPhoneOff, FiUser, FiVideo, FiVideoOff, FiMic, FiMicOff, FiArrowLeft, FiMonitor, FiShield, FiCopy, FiCheck, FiMessageSquare, FiSend, FiX, FiUsers, FiSettings } from 'react-icons/fi';
import { collaborationService } from '../services/collaborationService';

const CallingPanel = ({ onBack }) => {
    const [view, setView] = useState('dialer'); // dialer, calling, settings
    const [roomId, setRoomId] = useState('');
    const [username, setUsername] = useState('User-' + Math.floor(Math.random() * 9999));
    const [callStatus, setCallStatus] = useState('Ready to call');
    const [isMuted, setIsMuted] = useState(false);
    const [isVideo, setIsVideo] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [remoteStreams, setRemoteStreams] = useState({}); // sid -> { stream, username, muted, videoOff }
    const [localStream, setLocalStream] = useState(null);
    const [controlRequest, setControlRequest] = useState(null);
    const [hasControl, setHasControl] = useState(false);
    const [isBeingControlled, setIsBeingControlled] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [participants, setParticipants] = useState([]);

    // Device selection state
    const [audioDevices, setAudioDevices] = useState([]);
    const [videoDevices, setVideoDevices] = useState([]);
    const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
    const [selectedVideoDevice, setSelectedVideoDevice] = useState('');
    const [deviceError, setDeviceError] = useState('');
    const [testingDevices, setTestingDevices] = useState(false);

    // Speaking indicator state
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [speakingUsers, setSpeakingUsers] = useState({}); // sid -> boolean

    const localVideoRef = useRef(null);
    const remoteVideoRefs = useRef({});
    const chatEndRef = useRef(null);
    const previewVideoRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const remoteAnalysersRef = useRef({});

    // Enumerate available devices
    const enumerateDevices = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            console.warn("Media devices API not available");
            return { audioInputs: [], videoInputs: [] };
        }
        try {
            // Request permission first to get device labels
            await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
                .then(stream => {
                    stream.getTracks().forEach(track => track.stop());
                })
                .catch(() => { });

            const devices = await navigator.mediaDevices.enumerateDevices();

            const audioInputs = devices.filter(d => d.kind === 'audioinput');
            const videoInputs = devices.filter(d => d.kind === 'videoinput');

            setAudioDevices(audioInputs);
            setVideoDevices(videoInputs);

            // Auto-select first available device
            if (audioInputs.length > 0 && !selectedAudioDevice) {
                setSelectedAudioDevice(audioInputs[0].deviceId);
            }
            if (videoInputs.length > 0 && !selectedVideoDevice) {
                setSelectedVideoDevice(videoInputs[0].deviceId);
            }

            setDeviceError('');
            return { audioInputs, videoInputs };
        } catch (err) {
            console.error('Failed to enumerate devices:', err);
            setDeviceError('Unable to access media devices. Please check permissions.');
            return { audioInputs: [], videoInputs: [] };
        }
    };

    // Test selected devices
    const testDevices = async () => {
        setTestingDevices(true);
        setDeviceError('');

        try {
            const constraints = {
                audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true,
                video: selectedVideoDevice ? { deviceId: { exact: selectedVideoDevice } } : true
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);

            // Show preview
            if (previewVideoRef.current) {
                previewVideoRef.current.srcObject = stream;
            }

            // Check if tracks are active
            const audioTrack = stream.getAudioTracks()[0];
            const videoTrack = stream.getVideoTracks()[0];

            if (audioTrack) {
                setCallStatus(`✓ Mic: ${audioTrack.label}`);
            }
            if (videoTrack) {
                setTimeout(() => setCallStatus(`✓ Camera: ${videoTrack.label}`), 1500);
            }

            // Keep stream for call or stop after preview
            setTimeout(() => {
                stream.getTracks().forEach(track => track.stop());
                if (previewVideoRef.current) {
                    previewVideoRef.current.srcObject = null;
                }
                setCallStatus('Devices working! Ready to call.');
            }, 3000);

        } catch (err) {
            console.error('Device test failed:', err);
            if (err.name === 'NotAllowedError') {
                setDeviceError('Permission denied. Please allow camera/mic access.');
            } else if (err.name === 'NotFoundError') {
                setDeviceError('Selected device not found. Try another device.');
            } else if (err.name === 'NotReadableError') {
                setDeviceError('Device is in use by another application.');
            } else {
                setDeviceError(`Device error: ${err.message}`);
            }
        }

        setTestingDevices(false);
    };

    // Load devices on mount
    useEffect(() => {
        enumerateDevices();

        // Listen for device changes
        if (navigator.mediaDevices) {
            navigator.mediaDevices.addEventListener('devicechange', enumerateDevices);
            return () => {
                navigator.mediaDevices.removeEventListener('devicechange', enumerateDevices);
            };
        }
    }, []);

    // Audio level analysis for speaking indicator
    const startAudioAnalysis = (stream, isLocal = true, sid = null) => {
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }

            const audioContext = audioContextRef.current;
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;

            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const checkAudioLevel = () => {
                analyser.getByteFrequencyData(dataArray);

                // Calculate average volume
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const average = sum / dataArray.length;

                // Threshold for speaking (adjust this value if needed)
                const isSpeakingNow = average > 20;

                if (isLocal) {
                    setIsSpeaking(isSpeakingNow);
                } else if (sid) {
                    setSpeakingUsers(prev => ({
                        ...prev,
                        [sid]: isSpeakingNow
                    }));
                }

                // Continue checking
                requestAnimationFrame(checkAudioLevel);
            };

            checkAudioLevel();

            if (isLocal) {
                analyserRef.current = analyser;
            } else if (sid) {
                remoteAnalysersRef.current[sid] = analyser;
            }

        } catch (err) {
            console.error('Audio analysis error:', err);
        }
    };

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
        };

        collaborationService.onRevokeControl = () => {
            setHasControl(false);
            setIsBeingControlled(false);
        };

        collaborationService.onChatMessage = ({ username, message, timestamp }) => {
            setChatMessages(prev => [...prev, { username, message, timestamp }]);
        };

        collaborationService.onTrackToggle = ({ sid, type, enabled }) => {
            setRemoteStreams(prev => ({
                ...prev,
                [sid]: {
                    ...prev[sid],
                    [type === 'audio' ? 'muted' : 'videoOff']: !enabled
                }
            }));
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

    const startCall = async () => {
        if (!roomId) {
            generateRoomId();
            return;
        }

        // Check if it's a Google Meet link
        const meetLinkPattern = /meet\.google\.com\/([a-z\-]+)/i;
        const meetMatch = roomId.match(meetLinkPattern);

        if (meetMatch || roomId.includes('meet.google.com')) {
            // Extract the clean URL
            let meetUrl = roomId;
            if (!meetUrl.startsWith('http')) {
                meetUrl = 'https://' + meetUrl;
            }

            // Open Google Meet in a popup window
            const width = 1200;
            const height = 800;
            const left = (window.screen.width - width) / 2;
            const top = (window.screen.height - height) / 2;

            window.open(
                meetUrl,
                'Google Meet',
                `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
            );

            setCallStatus('Opened Google Meet in new window');
            return;
        }

        // Regular Roolts call
        setView('calling');
        setCallStatus('Connecting...');

        try {
            // Use selected devices if available
            const constraints = {
                audio: selectedAudioDevice
                    ? { deviceId: { exact: selectedAudioDevice } }
                    : true,
                video: selectedVideoDevice
                    ? { deviceId: { exact: selectedVideoDevice } }
                    : true
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setLocalStream(stream);
            collaborationService.setLocalStream(stream);
            collaborationService.joinRoom(roomId, username);

            // Start audio analysis for speaking indicator
            startAudioAnalysis(stream, true);

            const audioTrack = stream.getAudioTracks()[0];
            const videoTrack = stream.getVideoTracks()[0];
            setCallStatus(`Using: ${audioTrack?.label || 'Default mic'} | ${videoTrack?.label || 'Default camera'}`);

            setTimeout(() => setCallStatus('Waiting for others...'), 2000);
        } catch (err) {
            console.error("Failed to get local stream", err);
            if (err.name === 'NotAllowedError') {
                setCallStatus('⚠️ Permission denied - click Settings to select devices');
            } else if (err.name === 'NotFoundError') {
                setCallStatus('⚠️ Device not found - click Settings to select another');
            } else if (err.name === 'NotReadableError') {
                setCallStatus('⚠️ Device in use - close other apps using camera/mic');
            } else {
                setCallStatus(`⚠️ Error: ${err.message}`);
            }
            setView('dialer');
        }
    };

    const toggleMic = () => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                // isMuted is the CURRENT state, so we set enabled to the opposite
                // If currently muted (isMuted=true), we want to unmute (enabled=true)
                const newMutedState = !isMuted;
                audioTrack.enabled = !newMutedState; // enabled = opposite of muted
                setIsMuted(newMutedState);
                collaborationService.sendTrackToggle('audio', !newMutedState);
            }
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !isVideo;
                setIsVideo(!isVideo);
                collaborationService.sendTrackToggle('video', !isVideo);
            }
        }
    };

    const handleScreenShare = async () => {
        if (isScreenSharing) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            collaborationService.replaceStream(localStream, stream);
            setIsScreenSharing(false);
        } else {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                setLocalStream(stream);
                collaborationService.replaceStream(null, stream);
                setIsScreenSharing(true);
                stream.getVideoTracks()[0].onended = () => handleScreenShare();
            } catch (err) {
                console.error("Failed to share screen", err);
            }
        }
    };

    const grantControl = () => {
        if (controlRequest) {
            collaborationService.grantControl(controlRequest.requester);
            setControlRequest(null);
            setIsBeingControlled(true);
        }
    };

    const revokeControl = () => {
        collaborationService.revokeControl();
        setIsBeingControlled(false);
    };

    const endCall = () => {
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
        if (count <= 4) return { gridTemplateColumns: 'repeat(2, 1fr)' };
        return { gridTemplateColumns: 'repeat(3, 1fr)' };
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#1a1a1a', color: 'white' }}>
            {/* Header */}
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #333', backgroundColor: '#222', gap: '12px' }}>
                <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <FiArrowLeft size={20} />
                </button>
                <h3 style={{ margin: 0, fontSize: '16px', flex: 1 }}>
                    {view === 'calling' ? `Room: ${roomId}` : 'Video Collaboration'}
                </h3>
                {view === 'calling' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <FiUsers size={14} /> {participants.length + 1}
                        </span>
                        <button onClick={copyRoomLink} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', padding: '6px 12px', borderRadius: '4px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                            {copied ? <FiCheck size={14} /> : <FiCopy size={14} />}
                            {copied ? 'Copied!' : 'Copy ID'}
                        </button>
                    </div>
                )}
            </div>

            {view === 'dialer' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '20px', padding: '20px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '10px' }}>📹</div>
                    <h2 style={{ margin: 0, fontSize: '20px' }}>Start Video Collaboration</h2>
                    <p style={{ color: '#888', fontSize: '14px', textAlign: 'center', maxWidth: '360px' }}>
                        Create or join a room for video calling with screen sharing and remote control.
                        <br /><strong style={{ color: '#3498db' }}>Or paste a Google Meet link!</strong>
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
                            placeholder="Room ID or Google Meet link"
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value)}
                            style={{ padding: '12px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#333', color: 'white', fontSize: '14px', width: '280px', textAlign: 'center' }}
                        />
                        <button onClick={generateRoomId} title="Generate Room ID" style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#444', border: 'none', color: 'white', cursor: 'pointer' }}>
                            🎲
                        </button>
                    </div>

                    {/* Device Selection */}
                    <div style={{ width: '100%', maxWidth: '350px', padding: '16px', backgroundColor: '#2a2a2a', borderRadius: '12px', marginTop: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <FiSettings size={16} />
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>Device Settings</span>
                        </div>

                        {/* Microphone Selection */}
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '4px' }}>
                                <FiMic size={12} style={{ marginRight: '4px' }} /> Microphone
                            </label>
                            <select
                                value={selectedAudioDevice}
                                onChange={(e) => setSelectedAudioDevice(e.target.value)}
                                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #444', backgroundColor: '#333', color: 'white', fontSize: '12px' }}
                            >
                                {audioDevices.length === 0 ? (
                                    <option value="">No microphones found</option>
                                ) : (
                                    audioDevices.map(device => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>

                        {/* Camera Selection */}
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '4px' }}>
                                <FiVideo size={12} style={{ marginRight: '4px' }} /> Camera
                            </label>
                            <select
                                value={selectedVideoDevice}
                                onChange={(e) => setSelectedVideoDevice(e.target.value)}
                                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #444', backgroundColor: '#333', color: 'white', fontSize: '12px' }}
                            >
                                {videoDevices.length === 0 ? (
                                    <option value="">No cameras found</option>
                                ) : (
                                    videoDevices.map(device => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>

                        {/* Test Button */}
                        <button
                            onClick={testDevices}
                            disabled={testingDevices}
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#3498db', border: 'none', color: 'white', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                            {testingDevices ? '⏳ Testing...' : '🎤 Test Devices'}
                        </button>

                        {/* Preview Video */}
                        <video
                            ref={previewVideoRef}
                            autoPlay
                            muted
                            playsInline
                            style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', marginTop: '12px', backgroundColor: '#111', display: previewVideoRef.current?.srcObject ? 'block' : 'none' }}
                        />

                        {/* Device Status */}
                        {deviceError && (
                            <div style={{ marginTop: '8px', padding: '8px', backgroundColor: 'rgba(231,76,60,0.2)', borderRadius: '6px', fontSize: '11px', color: '#e74c3c' }}>
                                ⚠️ {deviceError}
                            </div>
                        )}

                        {callStatus && callStatus.includes('✓') && (
                            <div style={{ marginTop: '8px', padding: '8px', backgroundColor: 'rgba(46,204,113,0.2)', borderRadius: '6px', fontSize: '11px', color: '#2ecc71' }}>
                                {callStatus}
                            </div>
                        )}
                    </div>

                    <button onClick={startCall} style={{ padding: '14px 40px', borderRadius: '25px', backgroundColor: '#2ecc71', border: 'none', color: 'white', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, marginTop: '10px' }}>
                        <FiVideo /> {roomId ? 'Join Room' : 'Create Room'}
                    </button>
                </div>
            )}

            {view === 'calling' && (
                <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
                    {/* Main Video Area */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {/* Video Grid */}
                        <div style={{ flex: 1, display: 'grid', gap: '4px', padding: '8px', backgroundColor: '#000', ...getGridStyle() }}>
                            {Object.keys(remoteStreams).length === 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ fontSize: '48px' }}>⏳</div>
                                    <p>Waiting for participants...</p>
                                    <p style={{ fontSize: '12px', color: '#444' }}>Share room ID: <strong>{roomId}</strong></p>
                                </div>
                            ) : (
                                Object.entries(remoteStreams).map(([sid, data]) => (
                                    <div key={sid} style={{
                                        position: 'relative',
                                        backgroundColor: '#222',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        minHeight: '150px',
                                        border: speakingUsers[sid] ? '3px solid #2ecc71' : '3px solid transparent',
                                        boxShadow: speakingUsers[sid] ? '0 0 15px rgba(46, 204, 113, 0.6)' : 'none',
                                        transition: 'border 0.15s ease, box-shadow 0.15s ease'
                                    }}>
                                        {data?.videoOff ? (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#333' }}>
                                                <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                                                    {data?.username?.charAt(0) || '?'}
                                                </div>
                                            </div>
                                        ) : (
                                            <video
                                                ref={el => remoteVideoRefs.current[sid] = el}
                                                autoPlay
                                                playsInline
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        )}
                                        <div style={{ position: 'absolute', bottom: '8px', left: '8px', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                                            {data?.muted && <FiMicOff size={12} color="#e74c3c" />}
                                            <span>{data?.username || 'Participant'}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Local Video Overlay */}
                        <div style={{
                            position: 'absolute',
                            top: '16px',
                            right: showChat ? '316px' : '16px',
                            width: '160px',
                            height: '120px',
                            backgroundColor: '#333',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: isSpeaking ? '3px solid #2ecc71' : '2px solid rgba(255,255,255,0.2)',
                            boxShadow: isSpeaking ? '0 0 15px rgba(46, 204, 113, 0.6)' : 'none',
                            transition: 'border 0.15s ease, box-shadow 0.15s ease, right 0.3s'
                        }}>
                            {isVideo ? (
                                <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#444' }}>
                                    <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                                        {username.charAt(0)}
                                    </div>
                                </div>
                            )}
                            <div style={{ position: 'absolute', bottom: '4px', left: '4px', fontSize: '10px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {isSpeaking && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2ecc71', animation: 'pulse 1s infinite' }} />}
                                You {isMuted && '🔇'}
                            </div>
                        </div>

                        {/* Being Controlled Banner */}
                        {isBeingControlled && (
                            <div style={{ position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#e74c3c', padding: '8px 16px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                                <FiShield /> Screen is being controlled
                                <button onClick={revokeControl} style={{ background: 'rgba(0,0,0,0.3)', border: 'none', padding: '4px 8px', borderRadius: '4px', color: 'white', cursor: 'pointer', fontSize: '12px' }}>
                                    Stop
                                </button>
                            </div>
                        )}

                        {/* Controls */}
                        <div style={{ padding: '16px', display: 'flex', justifyContent: 'center', gap: '12px', backgroundColor: 'rgba(0,0,0,0.9)' }}>
                            <button onClick={toggleMic} title={isMuted ? 'Unmute' : 'Mute'} style={{ padding: '14px', borderRadius: '50%', backgroundColor: isMuted ? '#e74c3c' : 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}>
                                {isMuted ? <FiMicOff color="white" size={20} /> : <FiMic color="white" size={20} />}
                            </button>
                            <button onClick={toggleVideo} title={isVideo ? 'Turn off camera' : 'Turn on camera'} style={{ padding: '14px', borderRadius: '50%', backgroundColor: !isVideo ? '#e74c3c' : 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}>
                                {isVideo ? <FiVideo color="white" size={20} /> : <FiVideoOff color="white" size={20} />}
                            </button>
                            <button onClick={handleScreenShare} title={isScreenSharing ? 'Stop sharing' : 'Share screen'} style={{ padding: '14px', borderRadius: '50%', backgroundColor: isScreenSharing ? '#3498db' : 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer' }}>
                                <FiMonitor color="white" size={20} />
                            </button>
                            <button onClick={requestControl} title="Request remote control" style={{ padding: '14px', borderRadius: '50%', backgroundColor: hasControl ? '#2ecc71' : 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer' }}>
                                <FiShield color="white" size={20} />
                            </button>
                            <button onClick={() => setShowChat(!showChat)} title="Chat" style={{ padding: '14px', borderRadius: '50%', backgroundColor: showChat ? '#9b59b6' : 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer' }}>
                                <FiMessageSquare color="white" size={20} />
                            </button>
                            <button onClick={endCall} title="Leave call" style={{ padding: '14px 28px', borderRadius: '25px', backgroundColor: '#e74c3c', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FiPhoneOff color="white" size={20} />
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
                                {chatMessages.length === 0 ? (
                                    <p style={{ color: '#666', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>No messages yet</p>
                                ) : (
                                    chatMessages.map((msg, i) => (
                                        <div key={i} style={{ marginBottom: '12px' }}>
                                            <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>{msg.username}</div>
                                            <div style={{ fontSize: '13px', backgroundColor: '#333', padding: '8px 10px', borderRadius: '8px' }}>{msg.message}</div>
                                        </div>
                                    ))
                                )}
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
                                <button onClick={sendChat} style={{ padding: '10px', borderRadius: '50%', backgroundColor: '#3498db', border: 'none', cursor: 'pointer' }}>
                                    <FiSend color="white" size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Control Request Popup */}
                    {controlRequest && (
                        <div style={{ position: 'absolute', top: '80px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#333', padding: '16px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', zIndex: 100 }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <FiUser size={20} />
                            </div>
                            <div>
                                <div style={{ fontSize: '14px', fontWeight: 600 }}>{controlRequest.username}</div>
                                <div style={{ fontSize: '12px', color: '#aaa' }}>Wants to control your screen</div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginLeft: '10px' }}>
                                <button onClick={() => setControlRequest(null)} style={{ padding: '8px 16px', backgroundColor: '#555', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '13px' }}>Deny</button>
                                <button onClick={grantControl} style={{ padding: '8px 16px', backgroundColor: '#2ecc71', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '13px' }}>Allow</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CallingPanel;

import io from 'socket.io-client';
import SimplePeer from 'simple-peer';

// Polyfill for global in Vite environment (needed for simple-peer)
if (typeof window !== 'undefined' && window.global === undefined) {
    window.global = window;
}

class CollaborationService {
    constructor() {
        this.socket = null;
        this.peers = {}; // sid -> SimplePeer instance
        this.roomId = null;
        this.username = null;
        this.stream = null; // Local stream
        this.hasControl = false;
        this.controlTarget = null; // Who we're controlling

        // Callbacks
        this.onUserJoined = null;
        this.onUserLeft = null;
        this.onSignal = null;
        this.onStream = null;
        this.onCodeChange = null;
        this.onRequestControl = null;
        this.onGrantControl = null;
        this.onRevokeControl = null;
        this.onCursorMove = null;
        this.onChatMessage = null;
        this.onTrackToggle = null;

        // Remote control callbacks
        this.onRemoteMouseMove = null;
        this.onRemoteClick = null;
        this.onRemoteKeyPress = null;
        this.onRemoteScroll = null;
    }

    connect(url = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000') {
        if (this.socket) return;

        this.socket = io(url);

        this.socket.on('connect', () => {
            console.log('Connected to collaboration server');
        });

        this.socket.on('user-joined', ({ username, sid }) => {
            console.log('User joined:', username, sid);
            this.createPeer(sid, true); // Initiator
            if (this.onUserJoined) this.onUserJoined({ username, sid });
        });

        this.socket.on('user-left', ({ sid }) => {
            console.log('User left:', sid);
            if (this.peers[sid]) {
                this.peers[sid].destroy();
                delete this.peers[sid];
            }
            if (this.onUserLeft) this.onUserLeft({ sid });
        });

        this.socket.on('signal', ({ signal, sender }) => {
            if (this.peers[sender]) {
                this.peers[sender].signal(signal);
            } else {
                this.createPeer(sender, false, signal); // Not initiator
            }
        });

        this.socket.on('code-change', (data) => {
            if (this.onCodeChange) this.onCodeChange(data);
        });

        this.socket.on('request-control', (data) => {
            if (this.onRequestControl) this.onRequestControl(data);
        });

        this.socket.on('grant-control', (data) => {
            this.hasControl = true;
            this.controlTarget = data.granter;
            if (this.onGrantControl) this.onGrantControl(data);
        });

        this.socket.on('revoke-control', () => {
            this.hasControl = false;
            this.controlTarget = null;
            if (this.onRevokeControl) this.onRevokeControl();
        });

        this.socket.on('cursor-move', (data) => {
            if (this.onCursorMove) this.onCursorMove(data);
        });

        this.socket.on('chat-message', (data) => {
            if (this.onChatMessage) this.onChatMessage(data);
        });

        this.socket.on('track-toggle', (data) => {
            if (this.onTrackToggle) this.onTrackToggle(data);
        });

        // Remote control events
        this.socket.on('remote-mouse-move', (data) => {
            if (this.onRemoteMouseMove) this.onRemoteMouseMove(data);
        });

        this.socket.on('remote-click', (data) => {
            if (this.onRemoteClick) this.onRemoteClick(data);
        });

        this.socket.on('remote-keypress', (data) => {
            if (this.onRemoteKeyPress) this.onRemoteKeyPress(data);
        });

        this.socket.on('remote-scroll', (data) => {
            if (this.onRemoteScroll) this.onRemoteScroll(data);
        });
    }

    joinRoom(roomId, username) {
        if (!this.socket) this.connect();
        this.roomId = roomId;
        this.username = username;
        this.socket.emit('join-room', { roomId, username });
    }

    leaveRoom() {
        if (this.socket) {
            this.socket.emit('leave-room', { roomId: this.roomId });
            this.socket.disconnect();
            this.socket = null;
        }
        Object.values(this.peers).forEach(peer => peer.destroy());
        this.peers = {};
        this.stream = null;
        this.hasControl = false;
        this.controlTarget = null;
    }

    createPeer(targetSid, initiator, incomingSignal = null) {
        const peer = new SimplePeer({
            initiator,
            stream: this.stream,
            trickle: false,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        });

        peer.on('signal', (signal) => {
            this.socket.emit('signal', {
                signal,
                target: targetSid
            });
        });

        peer.on('stream', (remoteStream) => {
            if (this.onStream) this.onStream({ stream: remoteStream, sid: targetSid });
        });

        peer.on('error', (err) => {
            console.error('Peer error:', err);
        });

        if (incomingSignal) {
            peer.signal(incomingSignal);
        }

        this.peers[targetSid] = peer;
        return peer;
    }

    setLocalStream(stream) {
        this.stream = stream;
        Object.values(this.peers).forEach(peer => {
            try {
                peer.addStream(stream);
            } catch (e) {
                console.warn("Failed to add stream to peer", e);
            }
        });
    }

    replaceStream(oldStream, newStream) {
        this.stream = newStream;
        Object.values(this.peers).forEach(peer => {
            try {
                if (oldStream) peer.removeStream(oldStream);
                peer.addStream(newStream);
            } catch (e) {
                console.warn("Failed to replace stream", e);
            }
        });
    }

    sendCodeChange(content, fileId) {
        if (this.socket && this.roomId) {
            this.socket.emit('code-change', { roomId: this.roomId, content, fileId });
        }
    }

    sendCursorMove(position, fileId) {
        if (this.socket && this.roomId) {
            this.socket.emit('cursor-move', { roomId: this.roomId, position, fileId, username: this.username });
        }
    }

    requestControl(username) {
        if (this.socket && this.roomId) {
            this.socket.emit('request-control', { roomId: this.roomId, username });
        }
    }

    grantControl(targetSid) {
        if (this.socket) {
            this.socket.emit('grant-control', { target: targetSid, granter: this.socket.id });
        }
    }

    revokeControl() {
        if (this.socket && this.roomId) {
            this.socket.emit('revoke-control', { roomId: this.roomId });
        }
    }

    sendChatMessage(username, message) {
        if (this.socket && this.roomId) {
            this.socket.emit('chat-message', { roomId: this.roomId, username, message, timestamp: Date.now() });
        }
    }

    sendTrackToggle(type, enabled) {
        if (this.socket && this.roomId) {
            this.socket.emit('track-toggle', { roomId: this.roomId, type, enabled, sid: this.socket.id });
        }
    }

    // Remote control methods
    sendMouseMove(x, y, percentX, percentY) {
        if (this.socket && this.hasControl && this.controlTarget) {
            this.socket.emit('remote-mouse-move', {
                target: this.controlTarget,
                x, y, percentX, percentY,
                sender: this.socket.id
            });
        }
    }

    sendClick(x, y, percentX, percentY, button = 0) {
        if (this.socket && this.hasControl && this.controlTarget) {
            this.socket.emit('remote-click', {
                target: this.controlTarget,
                x, y, percentX, percentY, button,
                sender: this.socket.id
            });
        }
    }

    sendKeyPress(key, code, modifiers = {}) {
        if (this.socket && this.hasControl && this.controlTarget) {
            this.socket.emit('remote-keypress', {
                target: this.controlTarget,
                key, code, modifiers,
                sender: this.socket.id
            });
        }
    }

    sendScroll(deltaX, deltaY) {
        if (this.socket && this.hasControl && this.controlTarget) {
            this.socket.emit('remote-scroll', {
                target: this.controlTarget,
                deltaX, deltaY,
                sender: this.socket.id
            });
        }
    }

    isConnected() {
        return this.socket && this.socket.connected;
    }

    getSocketId() {
        return this.socket?.id;
    }
}

export const collaborationService = new CollaborationService();

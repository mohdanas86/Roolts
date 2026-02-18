import { io } from 'socket.io-client';

const backendUrl = import.meta.env.VITE_API_URL || window.location.origin;

class SocketService {
    constructor() {
        this.socket = null;
        this.listeners = new Map();
    }

    connect() {
        if (this.socket) return this.socket;

        this.socket = io(backendUrl, {
            transports: ['websocket'],
            autoConnect: true,
            reconnection: true
        });

        this.socket.on('connect', () => {
            console.log('[SocketService] Connected');
        });

        this.socket.on('disconnect', () => {
            console.log('[SocketService] Disconnected');
        });

        return this.socket;
    }

    getSocket() {
        if (!this.socket) return this.connect();
        return this.socket;
    }

    on(event, callback) {
        const socket = this.getSocket();
        socket.on(event, callback);
    }

    off(event, callback) {
        if (this.socket) {
            this.socket.off(event, callback);
        }
    }

    emit(event, data) {
        const socket = this.getSocket();
        socket.emit(event, data);
    }
}

export const socketService = new SocketService();
export default socketService;

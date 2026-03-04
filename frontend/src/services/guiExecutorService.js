/**
 * guiExecutorService.js
 * Manages GUI code execution over the existing Socket.IO connection.
 *
 * Events emitted  → backend:
 *   gui:start   { language, code }
 *   gui:stop    {}
 *
 * Events received  ← backend:
 *   gui:frame     { frame: "<base64 PNG>" }
 *   gui:finished  { stdout: "...", stderr: "..." }
 *   gui:error     { message: "..." }
 */

import socketService from './socketService';

class GUIExecutorService {
    constructor() {
        // Per-run callback refs so we can detach them cleanly after each run
        this._onFrame = null;
        this._onFinished = null;
        this._onError = null;
        this._active = false;
    }

    /**
     * Start a GUI execution session.
     *
     * @param {object} opts
     * @param {string}   opts.language
     * @param {string}   opts.code
     * @param {function} opts.onFrame     (base64PngString) => void
     * @param {function} opts.onFinished  (stdout, stderr)  => void
     * @param {function} opts.onError     (message)         => void
     */
    runGUI({ language, code, onFrame, onFinished, onError }) {
        // Clean stale listeners from previous run
        this._detachListeners();

        this._active = true;

        this._onFrame = (data) => {
            if (data && data.frame) onFrame(data.frame);
        };

        this._onFinished = (data) => {
            this._active = false;
            this._detachListeners();
            onFinished(data?.stdout ?? '', data?.stderr ?? '');
        };

        this._onError = (data) => {
            this._active = false;
            this._detachListeners();
            onError(data?.message ?? 'Unknown GUI execution error');
        };

        socketService.on('gui:frame', this._onFrame);
        socketService.on('gui:finished', this._onFinished);
        socketService.on('gui:error', this._onError);

        socketService.emit('gui:start', { language, code });
    }

    /**
     * Stop the currently running GUI execution.
     */
    stopGUI() {
        if (this._active) {
            socketService.emit('gui:stop', {});
            this._active = false;
            this._detachListeners();
        }
    }

    /** Remove all live listeners from the socket. */
    _detachListeners() {
        if (this._onFrame) {
            socketService.off('gui:frame', this._onFrame);
            this._onFrame = null;
        }
        if (this._onFinished) {
            socketService.off('gui:finished', this._onFinished);
            this._onFinished = null;
        }
        if (this._onError) {
            socketService.off('gui:error', this._onError);
            this._onError = null;
        }
    }
}

const guiExecutorService = new GUIExecutorService();
export default guiExecutorService;

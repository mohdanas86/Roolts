"""
gui_execute.py
==============
Registers Socket.IO events for live GUI code execution.

Call `register_gui_events(socketio)` once from app.py after socketio is
initialised.

Socket events (client → server):
  gui:start   { language: str, code: str }
  gui:stop    {}

Socket events (server → client, room = request.sid):
  gui:frame     { frame: "<base64 PNG>" }
  gui:finished  { stdout: str, stderr: str }
  gui:error     { message: str }
"""

from flask import request
from flask_socketio import emit

from services.gui_executor import (
    start_gui_session,
    stop_gui_session,
    stop_all_for_session,
)


def register_gui_events(socketio):
    """Attach GUI Socket.IO event handlers to the given SocketIO instance."""

    @socketio.on("gui:start")
    def handle_gui_start(data):
        """Client requests a new GUI execution session."""
        sid = request.sid
        language = (data.get("language") or "python").lower()
        code = data.get("code") or ""

        if not code.strip():
            emit("gui:error", {"message": "No code provided."})
            return

        # Acknowledge immediately so the frontend can switch to the GUI tab
        emit("gui:start-ack", {})

        # Build per-room emit callbacks (thread-safe via socketio.emit with room=)
        def on_frame(base64_png: str):
            socketio.emit("gui:frame", {"frame": base64_png}, room=sid)

        def on_finished(stdout: str, stderr: str):
            socketio.emit(
                "gui:finished", {"stdout": stdout, "stderr": stderr}, room=sid
            )

        def on_error(message: str):
            socketio.emit("gui:error", {"message": message}, room=sid)

        # Delegate to the executor service
        socketio.start_background_task(
            start_gui_session,
            sid, language, code, on_frame, on_finished, on_error,
        )

    @socketio.on("gui:stop")
    def handle_gui_stop(_data=None):
        """Client requests stopping the current GUI session."""
        stop_gui_session(request.sid)

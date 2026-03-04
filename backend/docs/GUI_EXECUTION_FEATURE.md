# Live GUI Execution — Implementation Guide

## Overview

The Live GUI Execution feature allows users to run Python (Tkinter, Turtle, Pygame, Matplotlib, PyQt, PySide, CustomTkinter, Kivy, wxPython, GTK) and Java (Swing, AWT, JavaFX) programs directly inside the Roolts browser-based IDE. A virtual display (Xvfb) is launched on the server, the user's code runs inside it, and screenshots are captured with `scrot` every ~50 ms and streamed back to the browser over Socket.IO as base64-encoded PNG frames, which are rendered onto an HTML `<canvas>`.

Non-GUI code (Python console apps, JavaScript, C, C++, Go, Kotlin, C#, Java console apps) is **not affected** and continues to run through the existing terminal execution path unchanged.

---

## Full Architecture Diagram

```
Browser                                     Server
  │                                            │
  │── socketService.emit('gui:start') ────────►│
  │                                            │── gui_execute.py (SocketIO handler)
  │                                            │── services/gui_executor.py
  │                                            │   ├─ Xvfb  :N  (virtual display)
  │                                            │   ├─ User Process  (DISPLAY=:N)
  │                                            │   └─ scrot every 50ms ──► base64 PNG
  │◄── socketio.emit('gui:frame', {frame}) ────│
  │   GUIViewer.drawFrame(base64) → <canvas>  │
  │                                            │
  │◄── socketio.emit('gui:finished', {...}) ───│ (process exits)
  │◄── socketio.emit('gui:error', {...}) ──────│ (timeout / crash)
  │── socketService.emit('gui:stop') ─────────►│── stop Xvfb + user process
```

---

## How It Works (Step by Step)

1. **Detection** — When the user clicks "Run", `EditorTabs.jsx` calls `isGUICode(code, language)` (from `utils/detectGUI.js`). If imports matching known GUI libraries are found, the GUI execution path is taken.

2. **Routing** — `EditorTabs.jsx` emits `gui:start { language, code }` over the existing Socket.IO connection (`socketService`). The existing terminal execution path is skipped entirely.

3. **Session creation** — `routes/gui_execute.py` receives the `gui:start` event and calls `services/gui_executor.py:start_gui_session()` in a background thread. A per-session `_GUISession` object is created in the global sessions registry.

4. **Virtual display** — `_GUISession.start()` spawns `Xvfb :<N>` on a unique display number. The OS assigns a random but permanent virtual framebuffer for the duration of the session.

5. **User process** — The user's code is written to a temp file and executed with `DISPLAY=:<N>` pointing to Xvfb. For Java, the source is compiled with `javac` first before `java` is invoked.

6. **Frame capture** — A background thread calls `scrot -D :<N> screenshot.png` every 50 ms (~20 fps), reads the file, base64-encodes it, and emits `gui:frame { frame: "<base64>" }` to the browser via `socketio.emit(..., room=sid)`.

7. **Canvas rendering** — `OutputPanel.jsx` listens for `gui:frame` events and calls `guiViewerRef.current.drawFrame(base64)`. Inside `GUIViewer.jsx`, the data is decoded via an `<img>` element and drawn directly onto a `<canvas>` with no React state update per frame (satisfying the performance constraint).

8. **Completion** — When the user's process exits naturally, `_GUISession._wait_for_exit()` collects stdout/stderr and emits `gui:finished { stdout, stderr }`. The Xvfb process is killed and the temp directory is deleted.

9. **Stop** — If the user clicks Stop (or disconnects), `gui:stop` / the disconnect handler calls `stop_gui_session(sid)`, which terminates Xvfb and the user process and cleans up all resources.

10. **Timeout** — The capture loop tracks elapsed time. After `max_runtime` seconds (default 60 s), the session is terminated with a clear timeout message.

---

## Files Created

| File | Purpose |
|------|---------|
| `backend/services/gui_executor.py` | Core service: manages Xvfb, user process lifecycle, scrot capture loop, concurrency limit, cleanup |
| `backend/routes/gui_execute.py` | Socket.IO event handlers (`gui:start`, `gui:stop`); registers via `register_gui_events(socketio)` |
| `frontend/src/utils/detectGUI.js` | `isGUICode(code, language)` and `detectGUILibrary(code, language)` — regex-based detection |
| `frontend/src/services/guiExecutorService.js` | Thin client wrapper around Socket.IO for `gui:start` / `gui:stop`; also used for `stopGUI()` from the Stop button |
| `frontend/src/components/GUIViewer.jsx` | Canvas component; uses `forwardRef + useImperativeHandle` to expose `drawFrame(base64)` — frames are NEVER stored in React state |

---

## Files Modified

| File | What Changed |
|------|-------------|
| `backend/app.py` | Added `register_gui_events(socketio)` call after SocketIO init; added GUI session cleanup in the disconnect handler |
| `backend/requirements.txt` | Added `simple-websocket>=0.9.0` and `Pillow>=10.0.0` |
| `backend/Dockerfile` | Added `xvfb scrot x11-utils` to the `apt-get install` line |
| `frontend/src/components/EditorTabs.jsx` | Added GUI detection imports; modified `handleRunCode` to branch to GUI path; added GUI detection badge near Run button; updated Run button disabled state to include `isGUIExecuting` |
| `frontend/src/components/OutputPanel.jsx` | Added GUI tab state (`useState`); added `gui:frame/finished/error` socket listeners; added Terminal / GUI Output tab switcher; added `<GUIViewer>` rendering |
| `frontend/src/store/index.js` | Added `isGUIExecuting` flag and `setIsGUIExecuting` action to `useExecutionStore` |

---

## System Dependencies

These must be installed on the Linux server (or inside the Docker container):

```bash
apt-get update && apt-get install -y xvfb scrot x11-utils
```

| Package | Purpose |
|---------|---------|
| `xvfb` | Creates a virtual framebuffer X server (headless display) |
| `scrot` | Screen-capture tool that targets a specific DISPLAY |
| `x11-utils` | Provides `xdpyinfo` and other X11 diagnostic helpers |

> **Note:** This feature is Linux-only. On Windows the backend will gracefully return an error message ("Xvfb failed to start") because `Xvfb` is not available.

---

## Python Dependencies Added

| Package | Reason |
|---------|-------|
| `simple-websocket>=0.9.0` | Required by newer versions of `flask-socketio` for WebSocket transport |
| `Pillow>=10.0.0` | Available for future image post-processing (e.g., downscaling frames); not strictly required by the current implementation which delegates to `scrot` |

---

## Frontend Dependencies Added

None. `socket.io-client` was already present in `frontend/package.json` (`^4.8.3`).

---

## Supported GUI Libraries (Detection Patterns)

| Language | Library | Import Pattern |
|----------|---------|---------------|
| Python | Tkinter | `import tkinter`, `from tkinter` |
| Python | Turtle | `import turtle`, `from turtle` |
| Python | Pygame | `import pygame`, `from pygame` |
| Python | Matplotlib | `import matplotlib`, `from matplotlib` |
| Python | PyQt5/6 | `import PyQt5`, `from PyQt5`, `import PyQt6`, `from PyQt6` |
| Python | PySide2/6 | `import PySide2`, `from PySide2`, `import PySide6`, `from PySide6` |
| Python | CustomTkinter | `import customtkinter`, `from customtkinter` |
| Python | Kivy | `import kivy`, `from kivy` |
| Python | wxPython | `import wx`, `from wx` |
| Python | GTK (gi) | `import gi`, `from gi` |
| Java | Swing | `import javax.swing` |
| Java | AWT | `import java.awt` |
| Java | JavaFX | `import javafx` |

---

## Concurrency & Resource Limits

- **Hard cap:** `MAX_GUI_SESSIONS = 10` concurrent sessions (configured at the top of `gui_executor.py`).
- Exceeding the limit returns an immediate `gui:error` with a human-readable message.
- **Timeout:** `DEFAULT_MAX_RUNTIME = 60` seconds per session. Configurable per request (not currently exposed in the frontend).
- **Cleanup:** Temp directories and Xvfb processes are cleaned up on normal exit, timeout, error, and client disconnect.
- Orphaned processes cannot accumulate: the global `_sessions` registry is keyed by socket `sid`; the disconnect handler always calls `stop_all_for_session(sid)`.

---

## Security Model

- **Process isolation:** User code always runs as a subprocess of the Flask server process, not as a privileged user. It inherits only the `DISPLAY` environment variable pointing to the private Xvfb instance.
- **No host filesystem access beyond temp dir:** The user's code and all output are confined to a `tempfile.mkdtemp()` directory that is deleted on cleanup.
- **No network in user process:** No explicit firewall rules are added; the user process can technically access the network. For production hardening, run the user subprocess in a container or under a restricted user (see Production Hardening below).
- **Timeout enforcement:** The capture loop kills the user process and Xvfb unconditionally after `max_runtime` seconds.
- **Room-scoped events:** All `socketio.emit(...)` calls use `room=sid` so frames from one user's execution are never broadcast to another user's browser.

---

## Adding Support for a New GUI Library

1. Open `frontend/src/utils/detectGUI.js`.
2. Locate the `GUI_PATTERNS` map for the appropriate language.
3. Add a new object: `{ pattern: /import\s+new_lib|from\s+new_lib/, label: 'NewLib' }`.
4. Test: open a file with `import new_lib` and verify the badge appears and the GUI path is taken.
5. If the library requires special display flags or init steps on the backend, update `_GUISession._build_run_cmd()` in `backend/services/gui_executor.py`.

No other changes are required.

---

## Production Hardening

### eventlet mode (recommended for production)

```bash
pip install eventlet
```

In `backend/app.py`, change `async_mode='threading'` to `async_mode='eventlet'`.

### gunicorn with eventlet workers

```bash
gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:$PORT app:app
```

> Use only 1 worker with eventlet — multiple workers share no memory and the session registry would be per-worker.

### Docker notes

The `backend/Dockerfile` already installs `xvfb scrot x11-utils`. Ensure the container runs as a non-root user for security:

```dockerfile
RUN useradd -m appuser
USER appuser
```

If running as non-root, ensure the user has write access to `/tmp` (tempfile default) and can execute `Xvfb`.

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| `gui:error` — "Xvfb failed to start" | `xvfb` not installed or not on PATH | `apt-get install xvfb` |
| `gui:error` — "scrot not found" | `scrot` not installed | `apt-get install scrot` |
| Canvas stays blank after "Starting virtual display…" | GUI program opens no window (e.g., crashes immediately) | Check `stderr` shown after execution ends |
| `gui:error` — "Server is at capacity" | 10 concurrent GUI sessions active | Wait for existing sessions to finish or increase `MAX_GUI_SESSIONS` |
| Frames stop updating mid-execution | `scrot` capture failure (e.g., window closed) | Non-fatal; execution continues until process exits |
| Java programs not detected | `import java.awt` not present (e.g., uses reflection) | Add a pattern to `GUI_PATTERNS.java` in `detectGUI.js` |
| Run button stays disabled after GUI error | `isGUIExecuting` not reset | The `gui:error` handler in `OutputPanel.jsx` calls `setIsGUIExecuting(false)` |
| Large memory usage | Each session creates an Xvfb process | Reduce `MAX_GUI_SESSIONS` or add swap |

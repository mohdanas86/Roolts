"""
gui_executor.py
================
Service that runs GUI code (Python Tkinter, Turtle, Pygame, Matplotlib;
Java Swing/AWT) inside a headless Xvfb virtual display, captures frames
with scrot every ~50 ms, and streams them as base64-encoded PNG over
Socket.IO back to the requesting browser session.

System dependencies (Linux only):
  apt-get install -y xvfb scrot x11-utils

Concurrency: at most MAX_GUI_SESSIONS simultaneous sessions.
All Xvfb processes are cleaned up on normal exit, timeout, error, and
socket disconnect.
"""

import base64
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import traceback

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_GUI_SESSIONS = 10        # hard cap on concurrent executions
DEFAULT_MAX_RUNTIME = 60     # seconds before timeout kills the session
FRAME_INTERVAL = 0.05        # seconds between scrot captures (~20 fps)
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
SCREEN_DEPTH = 24

# ---------------------------------------------------------------------------
# Known-benign exit tracebacks (e.g. user closes the window mid-run)
# ---------------------------------------------------------------------------

# Each pattern is matched against the *last non-empty line* of a Traceback
# block.  If the entire stderr consists only of such benign blocks it is
# suppressed completely so users are not alarmed by routine close actions.
_BENIGN_EXIT_PATTERNS = [
    r"^turtle\.Terminator\s*$",
    r"^_tkinter\.TclError:.*application has been destroyed",
    r"^_tkinter\.TclError:.*main window.*deleted",
    r"^_tkinter\.TclError:.*invalid command name",
    r"^tkinter\.TclError:.*application has been destroyed",
    r"^SystemExit:\s*0\s*$",
    r"^KeyboardInterrupt\s*$",
]


def _sanitize_stderr(text: str) -> str:
    """
    Strip well-known benign exit tracebacks from stderr so users don't see
    alarming error text for normal GUI interactions such as closing a window.

    If *all* content in stderr is benign the function returns an empty string.
    Non-benign content is left untouched.
    """
    if not text.strip():
        return ""

    # Split by traceback header so each block can be judged independently.
    # A block that doesn't start with "Traceback" is kept as-is.
    raw_blocks = re.split(r"(?=Traceback \(most recent call last\):)", text)
    kept: list[str] = []

    for block in raw_blocks:
        stripped = block.strip()
        if not stripped:
            continue
        if stripped.startswith("Traceback"):
            lines = [ln for ln in stripped.splitlines() if ln.strip()]
            last_line = lines[-1].strip() if lines else ""
            if any(re.search(p, last_line) for p in _BENIGN_EXIT_PATTERNS):
                continue  # discard this benign block
        kept.append(stripped)

    return "\n\n".join(kept)


# ---------------------------------------------------------------------------
# Session registry  (session_id -> _GUISession)
# ---------------------------------------------------------------------------

_sessions: dict[str, "_GUISession"] = {}
_sessions_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Helper: unique Xvfb display number
# ---------------------------------------------------------------------------

_next_display = 100          # start well above :0 / :1 used by the host
_display_lock = threading.Lock()


def _alloc_display() -> int:
    global _next_display
    with _display_lock:
        d = _next_display
        _next_display = (_next_display % 998) + 100  # cycle 100-1099?
        return d


# ---------------------------------------------------------------------------
# _GUISession
# ---------------------------------------------------------------------------

class _GUISession:
    """One live GUI execution session."""

    def __init__(self, sid: str, language: str, code: str,
                 on_frame, on_finished, on_error,
                 max_runtime: int = DEFAULT_MAX_RUNTIME):
        self.sid = sid
        self.language = language
        self.code = code
        self.on_frame = on_frame
        self.on_finished = on_finished
        self.on_error = on_error
        self.max_runtime = max_runtime

        self.display_num = _alloc_display()
        self.display = f":{self.display_num}"

        self._xvfb_proc = None
        self._user_proc = None
        self._temp_dir = None
        self._running = False
        self._stopped = False

    # ------------------------------------------------------------------
    # Start
    # ------------------------------------------------------------------

    def start(self):
        """Launch user process (+ Xvfb on Linux) then start capture thread."""
        try:
            import platform as _platform
            is_windows = _platform.system() == "Windows"

            # ── Linux pre-flight ───────────────────────────────────────────────
            if not is_windows:
                if not shutil.which("Xvfb"):
                    self._cleanup()
                    self.on_error(
                        "Xvfb is not installed on this server.\n"
                        "Install with: apt-get install xvfb scrot x11-utils"
                    )
                    return
                if not shutil.which("scrot"):
                    self._cleanup()
                    self.on_error(
                        "scrot is not installed on this server.\n"
                        "Install with: apt-get install scrot"
                    )
                    return

            self._temp_dir = tempfile.mkdtemp(prefix="roolts_gui_")
            self._running = True

            # ── Xvfb (Linux only) ─────────────────────────────────────────────
            if not is_windows:
                xvfb_cmd = [
                    "Xvfb", self.display,
                    "-screen", "0",
                    f"{SCREEN_WIDTH}x{SCREEN_HEIGHT}x{SCREEN_DEPTH}",
                    "-ac",
                    "+extension", "GLX",
                ]
                self._xvfb_proc = subprocess.Popen(
                    xvfb_cmd,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                time.sleep(0.5)
                if self._xvfb_proc.poll() is not None:
                    raise RuntimeError(
                        f"Xvfb failed to start (exit {self._xvfb_proc.returncode}).\n"
                        "Is xvfb installed? (apt-get install xvfb)"
                    )

            # ── Compile if needed ─────────────────────────────────────────────
            compile_error = self._compile_if_needed()
            if compile_error:
                self._cleanup()
                self.on_error(f"Compilation error:\n{compile_error}")
                return

            run_cmd = self._build_run_cmd()
            child_env = os.environ.copy()
            if not is_windows:
                child_env["DISPLAY"] = self.display
            if self.language == "python":
                child_env["PYTHONUNBUFFERED"] = "1"

            popen_kwargs = dict(
                cwd=self._temp_dir,
                env=child_env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            if is_windows:
                # Don't open a separate console window on Windows
                popen_kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW

            self._user_proc = subprocess.Popen(run_cmd, **popen_kwargs)

            # ── Start capture + wait threads ──────────────────────────────────
            capture_target = (
                self._capture_loop_windows if is_windows
                else self._capture_loop
            )
            threading.Thread(target=capture_target, daemon=True).start()
            threading.Thread(target=self._wait_for_exit, daemon=True).start()

        except Exception as exc:
            traceback.print_exc()
            self._cleanup()
            self.on_error(str(exc))

    # ------------------------------------------------------------------
    # Stop (called by client or timeout)
    # ------------------------------------------------------------------

    def stop(self):
        """Signal the session to stop and clean up."""
        if self._stopped:
            return
        self._stopped = True
        self._running = False
        self._kill_processes()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_code_file(self) -> str:
        """Write code to a temp file. Returns the file path."""
        ext_map = {
            "python": ".py",
            "java": ".java",
        }
        ext = ext_map.get(self.language, ".txt")

        # For Java, file must match public class name
        if self.language == "java":
            m = re.search(r"public\s+class\s+([A-Za-z0-9_]+)", self.code)
            fname = (m.group(1) if m else "Main") + ".java"
        else:
            fname = "script" + ext

        path = os.path.join(self._temp_dir, fname)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(self.code)
        return path, fname

    def _compile_if_needed(self) -> str | None:
        """Compile Java. Returns error string or None."""
        if self.language != "java":
            return None

        _code_path, _fname = self._build_code_file()
        self._java_class = re.search(
            r"public\s+class\s+([A-Za-z0-9_]+)", self.code
        )
        self._java_class = (
            self._java_class.group(1) if self._java_class else "Main"
        )

        javac = shutil.which("javac") or "javac"
        result = subprocess.run(
            [javac, _fname],
            cwd=self._temp_dir,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            return result.stderr
        return None

    def _build_run_cmd(self) -> list[str]:
        if self.language == "python":
            code_path, _ = self._build_code_file()
            py = sys.executable or "python3"
            return [py, "-u", code_path]

        elif self.language == "java":
            # Class files already compiled into _temp_dir
            java = shutil.which("java") or "java"
            return [
                java,
                "-Xmx128m", "-Xms32m",
                "-cp", self._temp_dir,
                self._java_class,
            ]

        else:
            raise ValueError(f"Unsupported GUI language: {self.language}")

    def _capture_loop(self):
        """Linux: capture frames using scrot against the Xvfb display."""
        screenshot_path = os.path.join(self._temp_dir, "_screen.png")
        start_time = time.monotonic()
        time.sleep(0.3)  # let the window open

        while self._running:
            elapsed = time.monotonic() - start_time
            if elapsed >= self.max_runtime:
                print(f"[GUIExecutor] Timeout for session {self.sid[:8]}")
                self.on_error(
                    f"Execution exceeded the {self.max_runtime}s time limit."
                )
                self.stop()
                return

            try:
                scrot = shutil.which("scrot") or "scrot"
                result = subprocess.run(
                    [scrot, "-D", self.display, screenshot_path],
                    capture_output=True,
                    timeout=2,
                    env={**os.environ, "DISPLAY": self.display},
                )
                if result.returncode == 0 and os.path.exists(screenshot_path):
                    with open(screenshot_path, "rb") as fh:
                        encoded = base64.b64encode(fh.read()).decode("ascii")
                    self.on_frame(encoded)
            except Exception:
                pass

            time.sleep(FRAME_INTERVAL)

    # ------------------------------------------------------------------
    # Windows capture helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _get_windows_for_pid(pid: int) -> list:
        """
        Return list of (left, top, right, bottom) for every visible window
        that belongs to the given PID, using pure ctypes (no pywin32 needed).
        """
        import ctypes
        import ctypes.wintypes

        user32 = ctypes.windll.user32
        results = []

        EnumWindowsProc = ctypes.WINFUNCTYPE(
            ctypes.c_bool, ctypes.c_size_t, ctypes.c_size_t
        )

        def _callback(hwnd, _):
            pid_buf = ctypes.c_ulong(0)
            user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid_buf))
            if pid_buf.value != pid:
                return True
            if not user32.IsWindowVisible(hwnd):
                return True
            rect = ctypes.wintypes.RECT()
            user32.GetWindowRect(hwnd, ctypes.byref(rect))
            w = rect.right - rect.left
            h = rect.bottom - rect.top
            if w > 10 and h > 10:  # ignore tiny/zero-size windows
                results.append((rect.left, rect.top, rect.right, rect.bottom))
            return True

        user32.EnumWindows(EnumWindowsProc(_callback), 0)
        return results

    def _capture_loop_windows(self):
        """
        Windows: find the GUI window spawned by the user process (by PID)
        and capture it every FRAME_INTERVAL seconds using PIL.ImageGrab.
        Falls back to a full-screen capture if the window cannot be located.
        """
        try:
            from PIL import ImageGrab
        except ImportError:
            self.on_error(
                "Pillow is not installed.\nRun: pip install Pillow"
            )
            return

        import io as _io

        start_time = time.monotonic()
        # Give the process time to create its window
        time.sleep(1.0)

        while self._running:
            elapsed = time.monotonic() - start_time
            if elapsed >= self.max_runtime:
                print(f"[GUIExecutor/Win] Timeout for session {self.sid[:8]}")
                self.on_error(
                    f"Execution exceeded the {self.max_runtime}s time limit."
                )
                self.stop()
                return

            try:
                bbox = None
                if self._user_proc and self._user_proc.pid:
                    windows = self._get_windows_for_pid(self._user_proc.pid)
                    if windows:
                        # Use the largest window (by area)
                        windows.sort(
                            key=lambda r: (r[2] - r[0]) * (r[3] - r[1]),
                            reverse=True,
                        )
                        left, top, right, bottom = windows[0]
                        # Add a small padding and clamp to screen
                        pad = 2
                        bbox = (
                            max(0, left - pad),
                            max(0, top - pad),
                            right + pad,
                            bottom + pad,
                        )

                img = ImageGrab.grab(bbox=bbox, all_screens=True)
                buf = _io.BytesIO()
                img.save(buf, format="PNG")
                encoded = base64.b64encode(buf.getvalue()).decode("ascii")
                self.on_frame(encoded)
            except Exception:
                pass  # individual frame failures are non-fatal

            time.sleep(FRAME_INTERVAL)

    def _wait_for_exit(self):
        """Wait for the user process to exit; emit finished or cleanup."""
        if not self._user_proc:
            return
        try:
            stdout_bytes, stderr_bytes = self._user_proc.communicate(
                timeout=self.max_runtime + 5
            )
            stdout = stdout_bytes.decode("utf-8", errors="replace")
            stderr = _sanitize_stderr(
                stderr_bytes.decode("utf-8", errors="replace")
            )
        except subprocess.TimeoutExpired:
            self._user_proc.kill()
            stdout, stderr = "", "Process timed out."
        except Exception as exc:
            stdout, stderr = "", str(exc)
        finally:
            self._running = False

        if not self._stopped:
            self._cleanup()
            self.on_finished(stdout, stderr)

    def _kill_processes(self):
        """Forcibly terminate user process (and Xvfb on Linux)."""
        import platform as _platform
        is_windows = _platform.system() == "Windows"

        if is_windows and self._user_proc is not None:
            pid = self._user_proc.pid
            try:
                # Kill the whole process tree so child processes also die
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(pid)],
                    capture_output=True,
                    timeout=5,
                )
            except Exception:
                pass
            try:
                self._user_proc.wait(timeout=2)
            except Exception:
                pass
            return

        for proc in [self._user_proc, self._xvfb_proc]:
            if proc is None:
                continue
            try:
                proc.terminate()
                try:
                    proc.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    proc.kill()
            except Exception:
                pass

    def _cleanup(self):
        """Kill processes and remove temp directory."""
        self._running = False
        self._kill_processes()
        if self._temp_dir and os.path.isdir(self._temp_dir):
            try:
                shutil.rmtree(self._temp_dir, ignore_errors=True)
            except Exception:
                pass
        # Remove from global registry
        with _sessions_lock:
            _sessions.pop(self.sid, None)


# ---------------------------------------------------------------------------
# Public API (called from socket-event handlers in app.py)
# ---------------------------------------------------------------------------

def start_gui_session(
    sid: str,
    language: str,
    code: str,
    on_frame,
    on_finished,
    on_error,
    max_runtime: int = DEFAULT_MAX_RUNTIME,
) -> None:
    """
    Create and start a new GUI session for socket `sid`.
    Enforces the MAX_GUI_SESSIONS concurrency limit.
    """
    with _sessions_lock:
        if len(_sessions) >= MAX_GUI_SESSIONS:
            on_error(
                f"Server is at capacity ({MAX_GUI_SESSIONS} concurrent GUI "
                "sessions). Please try again in a moment."
            )
            return

        # Stop any existing session for this sid before starting a new one
        existing = _sessions.get(sid)
        if existing:
            existing.stop()

        session = _GUISession(
            sid, language, code, on_frame, on_finished, on_error, max_runtime
        )
        _sessions[sid] = session

    # Start outside the lock to avoid deadlock in callbacks
    session.start()


def stop_gui_session(sid: str) -> None:
    """Stop an active GUI session by socket id."""
    with _sessions_lock:
        session = _sessions.pop(sid, None)
    if session:
        session.stop()


def stop_all_for_session(sid: str) -> None:
    """Alias used by disconnect handler."""
    stop_gui_session(sid)


def active_session_count() -> int:
    with _sessions_lock:
        return len(_sessions)

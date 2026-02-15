"""
LSP Manager — Manages Language Server Protocol processes for the Roolts editor.

Architecture:
  Browser (Monaco) <--SocketIO--> Flask <--stdin/stdout--> Language Server Process

Each language gets its own server process. The manager handles:
  - Spawning language server processes
  - Routing JSON-RPC messages between SocketIO and the process
  - Graceful shutdown when client disconnects
"""

import subprocess
import threading
import json
import os
import sys
from pathlib import Path

# Portable runtimes directory
COMPILER_DIR = (Path(__file__).parent.parent / "compiler").resolve()
LSP_DATA_DIR = (Path(__file__).parent.parent / "lsp_servers").resolve()


# ── Language Server Configurations ──────────────────────────────────────────

def _get_python_lsp_cmd():
    """Get command to run Python LSP server."""
    portable_python = COMPILER_DIR / "python" / "python.exe"
    if portable_python.exists():
        return [str(portable_python), "-m", "pylsp"]
    # Fallback to system python
    return [sys.executable, "-m", "pylsp"]


def _get_clangd_cmd():
    """Get command to run clangd for C/C++."""
    # clangd is NOT in w64devkit by default, but we can check
    clangd_path = COMPILER_DIR / "c_cpp" / "w64devkit" / "bin" / "clangd.exe"
    if clangd_path.exists():
        return [str(clangd_path)]
    # Try system clangd
    return ["clangd"]


def _get_java_lsp_cmd():
    """Get command to run Eclipse JDTLS for Java."""
    jdtls_dir = LSP_DATA_DIR / "jdtls"
    java_exe = COMPILER_DIR / "java" / "jdk-21.0.2+13" / "bin" / "java.exe"

    if not java_exe.exists():
        return None

    # Find the launcher JAR
    plugins_dir = jdtls_dir / "plugins"
    if not plugins_dir.exists():
        return None

    launcher_jar = None
    for f in plugins_dir.iterdir():
        if f.name.startswith("org.eclipse.equinox.launcher_") and f.name.endswith(".jar"):
            launcher_jar = f
            break

    if not launcher_jar:
        return None

    # Config directory (win)
    config_dir = jdtls_dir / "config_win"
    if not config_dir.exists():
        config_dir = jdtls_dir / "config_ss_win"
    if not config_dir.exists():
        # Try any config directory
        for d in jdtls_dir.iterdir():
            if d.is_dir() and d.name.startswith("config"):
                config_dir = d
                break

    # Workspace data directory
    workspace_dir = LSP_DATA_DIR / "jdtls_workspace"
    workspace_dir.mkdir(parents=True, exist_ok=True)

    return [
        str(java_exe),
        "-Declipse.application=org.eclipse.jdt.ls.core.id1",
        "-Dosgi.bundles.defaultStartLevel=4",
        "-Declipse.product=org.eclipse.jdt.ls.core.product",
        "-Dlog.level=ALL",
        "-Xmx512m",
        "--add-modules=ALL-SYSTEM",
        "--add-opens", "java.base/java.util=ALL-UNNAMED",
        "--add-opens", "java.base/java.lang=ALL-UNNAMED",
        "-jar", str(launcher_jar),
        "-configuration", str(config_dir),
        "-data", str(workspace_dir),
    ]


LSP_CONFIGS = {
    "python": {
        "get_cmd": _get_python_lsp_cmd,
        "name": "Python Language Server (pylsp)",
    },
    "c": {
        "get_cmd": _get_clangd_cmd,
        "name": "Clangd (C/C++)",
    },
    "cpp": {
        "get_cmd": _get_clangd_cmd,
        "name": "Clangd (C/C++)",
    },
    "java": {
        "get_cmd": _get_java_lsp_cmd,
        "name": "Eclipse JDTLS (Java)",
    },
}


class LSPServerProcess:
    """Manages a single language server process."""

    def __init__(self, language, on_message_callback):
        self.language = language
        self.process = None
        self.on_message = on_message_callback
        self._reader_thread = None
        self._running = False
        self._write_lock = threading.Lock()

    def start(self):
        """Start the language server process."""
        config = LSP_CONFIGS.get(self.language)
        if not config:
            raise ValueError(f"No LSP configuration for language: {self.language}")

        cmd = config["get_cmd"]()
        if cmd is None:
            raise RuntimeError(f"Language server for {self.language} is not installed. "
                               f"Install it first via the setup script.")

        print(f"[LSP] Starting {config['name']}: {' '.join(cmd)}")

        env = os.environ.copy()
        # Add portable runtimes to PATH
        extra_paths = [
            str(COMPILER_DIR / "python"),
            str(COMPILER_DIR / "python" / "Scripts"),
            str(COMPILER_DIR / "nodejs" / "node-v18.17.0-win-x64"),
            str(COMPILER_DIR / "c_cpp" / "w64devkit" / "bin"),
            str(COMPILER_DIR / "java" / "jdk-21.0.2+13" / "bin"),
        ]
        env["PATH"] = ";".join(extra_paths) + ";" + env.get("PATH", "")

        try:
            self.process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0,
            )
            self._running = True

            # Start reader thread to read LSP responses from stdout
            self._reader_thread = threading.Thread(
                target=self._read_loop, daemon=True, name=f"lsp-reader-{self.language}"
            )
            self._reader_thread.start()

            # Start stderr reader for debugging
            self._stderr_thread = threading.Thread(
                target=self._stderr_loop, daemon=True, name=f"lsp-stderr-{self.language}"
            )
            self._stderr_thread.start()

            print(f"[LSP] {config['name']} started (PID: {self.process.pid})")
            return True

        except FileNotFoundError:
            print(f"[LSP] ERROR: Command not found: {cmd[0]}")
            raise RuntimeError(f"Language server binary not found: {cmd[0]}")
        except Exception as e:
            print(f"[LSP] ERROR starting {config['name']}: {e}")
            raise

    def send_message(self, message):
        """Send a JSON-RPC message to the language server via stdin."""
        if not self.process or not self._running:
            return

        try:
            if isinstance(message, str):
                content = message.encode("utf-8")
            elif isinstance(message, dict):
                content = json.dumps(message).encode("utf-8")
            else:
                content = message

            header = f"Content-Length: {len(content)}\r\n\r\n".encode("utf-8")

            with self._write_lock:
                self.process.stdin.write(header + content)
                self.process.stdin.flush()
        except (BrokenPipeError, OSError) as e:
            print(f"[LSP] Write error for {self.language}: {e}")
            self.stop()

    def _read_loop(self):
        """Read LSP JSON-RPC messages from stdout (Content-Length framing)."""
        try:
            while self._running and self.process and self.process.poll() is None:
                # Read headers
                headers = {}
                while True:
                    line = self.process.stdout.readline()
                    if not line:
                        self._running = False
                        return
                    line = line.decode("utf-8", errors="replace").strip()
                    if line == "":
                        break  # End of headers
                    if ":" in line:
                        key, value = line.split(":", 1)
                        headers[key.strip()] = value.strip()

                content_length = int(headers.get("Content-Length", 0))
                if content_length == 0:
                    continue

                # Read body
                body = b""
                while len(body) < content_length:
                    chunk = self.process.stdout.read(content_length - len(body))
                    if not chunk:
                        self._running = False
                        return
                    body += chunk

                try:
                    message = json.loads(body.decode("utf-8"))
                    self.on_message(message)
                except json.JSONDecodeError as e:
                    print(f"[LSP] JSON parse error from {self.language}: {e}")

        except Exception as e:
            if self._running:
                print(f"[LSP] Reader error for {self.language}: {e}")
        finally:
            self._running = False

    def _stderr_loop(self):
        """Read stderr for debug logging."""
        try:
            while self._running and self.process and self.process.poll() is None:
                line = self.process.stderr.readline()
                if not line:
                    break
                text = line.decode("utf-8", errors="replace").strip()
                if text:
                    print(f"[LSP-{self.language}] {text}")
        except Exception:
            pass

    def stop(self):
        """Stop the language server process."""
        self._running = False
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=5)
            except Exception:
                try:
                    self.process.kill()
                except Exception:
                    pass
            self.process = None
            print(f"[LSP] Stopped server for {self.language}")

    @property
    def is_running(self):
        return self._running and self.process is not None and self.process.poll() is None


class LSPManager:
    """Manages multiple language server processes, one per language per session."""

    def __init__(self):
        self._servers = {}  # key: (session_id, language) -> LSPServerProcess
        self._lock = threading.Lock()

    def start_server(self, session_id, language, on_message):
        """Start a language server for a given session and language."""
        key = (session_id, language)

        with self._lock:
            # Stop existing server for this session/language if any
            if key in self._servers:
                self._servers[key].stop()

            server = LSPServerProcess(language, on_message)
            server.start()
            self._servers[key] = server

        return True

    def send_message(self, session_id, language, message):
        """Send a message to the language server."""
        key = (session_id, language)
        server = self._servers.get(key)
        if server and server.is_running:
            server.send_message(message)
        else:
            print(f"[LSP] No running server for {language} (session: {session_id[:8]})")

    def stop_server(self, session_id, language):
        """Stop a specific language server."""
        key = (session_id, language)
        with self._lock:
            server = self._servers.pop(key, None)
            if server:
                server.stop()

    def stop_all_for_session(self, session_id):
        """Stop all language servers for a given session."""
        with self._lock:
            keys_to_remove = [k for k in self._servers if k[0] == session_id]
            for key in keys_to_remove:
                server = self._servers.pop(key)
                server.stop()

    def stop_all(self):
        """Stop all language servers."""
        with self._lock:
            for server in self._servers.values():
                server.stop()
            self._servers.clear()

    def get_available_languages(self):
        """Return which languages have LSP support available."""
        available = {}
        for lang, config in LSP_CONFIGS.items():
            try:
                cmd = config["get_cmd"]()
                available[lang] = {
                    "name": config["name"],
                    "installed": cmd is not None,
                }
            except Exception:
                available[lang] = {
                    "name": config["name"],
                    "installed": False,
                }
        return available

    def get_status(self):
        """Return status of all running servers."""
        status = {}
        for (sid, lang), server in self._servers.items():
            status[f"{sid[:8]}-{lang}"] = {
                "language": lang,
                "running": server.is_running,
                "pid": server.process.pid if server.process else None,
            }
        return status


# Global singleton
lsp_manager = LSPManager()

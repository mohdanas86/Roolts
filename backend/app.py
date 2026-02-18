"""
Roolts Backend - Flask Application
AI-Powered Portfolio with Multi-AI Integration
"""

import os
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from .env file in the same directory as app.py
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

# PATCH: Apply nest_asyncio to allow nested event loops (Fixes 500 errors with SocketIO + Async)
import nest_asyncio
nest_asyncio.apply()

# Configure Logging
import logging
logging.basicConfig(
    filename='backend.log',
    level=logging.DEBUG,
    format='%(asctime)s %(levelname)s: %(message)s'
)
logging.info("Backend starting...")

# Import database models
from models import db, init_db

# Import compiler setup
from utils.compiler_manager import setup_compiler

# Import routes
from routes.files import files_bp
from routes.ai import ai_bp
from routes.auth import auth_bp
from routes.ai_hub import ai_hub_bp
from routes.terminal import terminal_bp
from routes.snippets import snippets_bp
from routes.portfolio import portfolio_bp
from routes.deployment import deployment_bp
from routes.executor import executor_bp
from routes.virtual_env import virtual_env_bp

from routes.extension_proxy import extension_proxy_bp
from routes.analyzer_proxy import analyzer_proxy_bp
# Import Terminal Session Management
from routes.terminal import get_session


def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)
    
    # Setup portable compilers and runtimes if needed
    # Setup portable compilers and runtimes in background
    try:
        from utils.compiler_manager import setup_all_runtimes
        import threading
        # Run setup in a separate thread to avoid blocking startup
        setup_thread = threading.Thread(target=setup_all_runtimes, daemon=True)
        setup_thread.start()
        print(f"Started background runtime initialization")
    except Exception as e:
        print(f"Warning: Failed to setup portable runtimes: {e}")
    
    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    app.config['JSON_SORT_KEYS'] = False
    
    # Initialize database
    init_db(app)
    
    # Enable CORS for frontend access
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)
    
    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')      # Authentication
    app.register_blueprint(ai_hub_bp, url_prefix='/api/ai-hub')  # Multi-AI Chat
    app.register_blueprint(files_bp, url_prefix='/api/files')    # File management
    app.register_blueprint(ai_bp, url_prefix='/api/ai')          # AI learning features
    app.register_blueprint(terminal_bp, url_prefix='/api/terminal')  # Terminal
    app.register_blueprint(snippets_bp, url_prefix='/api/snippets')  # Snippets
    app.register_blueprint(portfolio_bp, url_prefix='/api/portfolio')  # Portfolio Generator
    app.register_blueprint(deployment_bp, url_prefix='/api/deployment')  # Deployment
    app.register_blueprint(executor_bp, url_prefix='/api/executor')  # Code Execution
    app.register_blueprint(virtual_env_bp, url_prefix='/api/virtual-env')  # Virtual Environments
    app.register_blueprint(extension_proxy_bp, url_prefix='/api/extensions')  # Extension Marketplace Proxy
    app.register_blueprint(analyzer_proxy_bp, url_prefix='/api/analyzer-proxy') # Java Analyzer Proxy
    
    @app.route('/api/health')
    def main_health_check():
        from utils.compiler_manager import get_setup_status
        setup_status = get_setup_status()
        
        return jsonify({
            'status': 'healthy',
            'service': 'roolts-backend',
            'version': '2.0.0',
            'backend': 'flask',
            'socketio': 'active',
            'runtimes': {
                'initialized': setup_status['completed'],
                'failed': setup_status['failed_langs'],
                'count': len(setup_status['total_paths'])
            }
        })
    
    # Root endpoint
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        """Serve the frontend static files."""
        static_folder = Path(app.root_path).parent / "frontend" / "dist"
        
        if path != "" and os.path.exists(static_folder / path):
            return send_from_directory(static_folder, path)
        else:
            if os.path.exists(static_folder / "index.html"):
                return send_from_directory(static_folder, "index.html")
            else:
                return jsonify({
                    'name': 'Roolts API',
                    'version': '2.0.0',
                    'description': 'AI-Powered Portfolio Backend (Frontend build missing)',
                    'endpoints': {
                        'health': '/api/health'
                    }
                })
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not found', 'message': str(error)}), 404
    
    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({'error': 'Unauthorized', 'message': 'Authentication required'}), 401
    
    @app.errorhandler(500)
    def internal_error(error):
        import traceback
        import time
        
        # Try to get the original exception if wrapped
        original_error = getattr(error, 'original_exception', error)
        
        print(f"!!! INTERNAL SERVER ERROR DETECTED: {original_error}")
        
        # Format the traceback of the TRUE cause
        full_traceback = "".join(traceback.format_exception(type(original_error), original_error, original_error.__traceback__)) if hasattr(original_error, '__traceback__') else traceback.format_exc()
        
        # Log to file
        try:
            with open("flask_error.log", "a") as f:
                timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
                f.write(f"\n--- {timestamp} ---\n{full_traceback}\n")
        except:
            pass
            
        return jsonify({
            'error': 'Internal server error',
            'message': full_traceback,
            'exception': str(original_error)
        }), 500
    
    return app


# Create the app instance
app = create_app()

# Initialize SocketIO
from flask_socketio import SocketIO, emit, join_room, leave_room

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='threading'
)

# Socket Events
@socketio.on('connect')
def handle_connect():
    print(f"Client connected: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    print(f"Client disconnected: {request.sid}")

# Catch-all for debugging
@socketio.on_error_default
def default_error_handler(e):
    print(f"[SocketIO Error] Request failed: {e}")

@socketio.on('join-room')
def handle_join_room(data):
    room = data.get('roomId')
    username = data.get('username')
    join_room(room)
    print(f"{username} joined room {room}")
    emit('user-joined', {'username': username, 'sid': request.sid}, to=room, include_self=False)

@socketio.on('signal')
def handle_signal(data):
    # Relay WebRTC signals (offer, answer, candidate) to the specific peer
    target_sid = data.get('target')
    if target_sid:
        emit('signal', {
            'signal': data.get('signal'),
            'sender': request.sid
        }, room=target_sid)

@socketio.on('request-control')
def handle_request_control(data):
    room = data.get('roomId')
    emit('request-control', {'requester': request.sid, 'username': data.get('username')}, to=room, include_self=False)

@socketio.on('grant-control')
def handle_grant_control(data):
    target_sid = data.get('target')
    if target_sid:
        emit('grant-control', {'granted': True, 'granter': request.sid}, room=target_sid)

@socketio.on('revoke-control')
def handle_revoke_control(data):
    room = data.get('roomId')
    emit('revoke-control', {}, to=room, include_self=False)

@socketio.on('code-change')
def handle_code_change(data):
    room = data.get('roomId')
    # Broadcast code changes to everyone else in the room
    emit('code-change', data, to=room, include_self=False)

@socketio.on('cursor-move')
def handle_cursor_move(data):
    room = data.get('roomId')
    emit('cursor-move', data, to=room, include_self=False)

@socketio.on('chat-message')
def handle_chat_message(data):
    room = data.get('roomId')
    emit('chat-message', data, to=room, include_self=False)

@socketio.on('track-toggle')
def handle_track_toggle(data):
    room = data.get('roomId')
    emit('track-toggle', data, to=room, include_self=False)

@socketio.on('leave-room')
def handle_leave_room(data):
    room = data.get('roomId')
    if room:
        leave_room(room)
        emit('user-left', {'sid': request.sid}, to=room, include_self=False)

# Remote control events
@socketio.on('remote-mouse-move')
def handle_remote_mouse_move(data):
    target_sid = data.get('target')
    if target_sid:
        emit('remote-mouse-move', data, room=target_sid)

@socketio.on('remote-click')
def handle_remote_click(data):
    target_sid = data.get('target')
    if target_sid:
        emit('remote-click', data, room=target_sid)

@socketio.on('remote-keypress')
def handle_remote_keypress(data):
    target_sid = data.get('target')
    if target_sid:
        emit('remote-keypress', data, room=target_sid)

@socketio.on('remote-scroll')
def handle_remote_scroll(data):
    target_sid = data.get('target')
    if target_sid:
        emit('remote-scroll', data, room=target_sid)

# --- Terminal Socket Events ---
@socketio.on('terminal:join')
def handle_terminal_join(data):
    """Client joining terminal session"""
    try:
        session_id = data.get('sessionId', 'default')
        # session = get_session(session_id) 
        emit('terminal:ready', {'sessionId': session_id})
    except Exception as e:
        print(f"Error in terminal:join: {e}")
        traceback.print_exc()

@socketio.on('terminal:input')
def handle_terminal_input(data):
    """Client sending input to terminal"""
    try:
        session_id = data.get('sessionId', 'default')
        command = data.get('data', '')
        
        session = get_session(session_id)
        
        cmd_text = command.strip()
        if cmd_text:
            result = session.execute(cmd_text)
            
            output_text = result.get('output', '')
            error_text = result.get('error', '')
            
            if output_text:
                emit('terminal:data', {'data': output_text})
            
            if error_text:
                emit('terminal:data', {'data': error_text})
    except Exception as e:
        print(f"Error in terminal:input: {e}")
        traceback.print_exc()
        emit('terminal:data', {'data': f"\r\nError executing command: {str(e)}\r\n"})



# --- Interactive Execution Socket Events ---
import threading
import select
import traceback
import os # Added for os.name and os.remove

active_execs = {} # sid -> {socket, thread, running, type, ...}
exec_lock = threading.Lock() # Global lock for thread-safe access to active_execs

@socketio.on('exec:start')
def handle_exec_start(data):
    """Start an interactive execution (Docker with Local Fallback)"""
    sid = request.sid
    
    # 0. Automatically stop any existing execution for this session
    # This prevents lag and overlapping output when clicking "Run" multiple times
    with exec_lock:
        if sid in active_execs:
            print(f"[Exec-SocketIO] Stopping existing execution for {sid[:8]} before new start")
            # We call the core logic directly to avoid lock re-entrancy if handle_exec_stop used the lock
            _internal_stop_execution(sid, emit_finished=False)
    
    code = data.get('code', '')
    language = data.get('language', 'python').lower() # Normalize to lowercase
    
    print(f"[Exec-SocketIO] START requested language={language} sid={sid[:8]}")
    emit('exec:data', {'data': f">>> Initializing {language} environment...\n"})
    
    try:
        docker_manager = get_docker_manager()
        
        # Check if Docker is available
        if docker_manager.client:
            try:
                # 1. Find or create an environment for this user/session
                envs = docker_manager.list_user_environments(0)
                container_id = None
                if envs:
                    for e in envs:
                        if e['env_type'] == language:
                            container_id = e['id']
                            break
                    if not container_id:
                        container_id = envs[0]['id']
                
                if not container_id:
                    container_id, _ = docker_manager.create_environment(0, 999, language, f"interactive_{language}")
                    docker_manager.start_environment(container_id)

                # 2. Write code to a file in the container
                file_path = f"/workspace/interactive_script"
                if language == 'python': file_path += ".py"
                elif language == 'javascript' or language == 'js': file_path += ".js"
                
                from services.file_manager import get_file_manager
                file_manager = get_file_manager()
                file_manager.write_file(container_id, file_path, code)

                # 3. Create interactive execution
                command = []
                if language == 'python': command = ['python', '-u', file_path]
                elif language == 'javascript' or language == 'js': command = ['node', file_path]
                else: command = ['sh', '-c', code]
                
                sock, exec_id = docker_manager.create_interactive_exec(container_id, command)
                
                with exec_lock:
                    active_execs[sid] = {
                        'type': 'docker',
                        'socket': sock,
                        'exec_id': exec_id,
                        'container_id': container_id,
                        'running': True
                    }

                def read_from_container(session_id, container_sock):
                    try:
                        while True:
                            with exec_lock:
                                if not active_execs.get(session_id, {}).get('running'):
                                    break
                            try:
                                ready = select.select([container_sock], [], [], 0.1)
                                if ready[0]:
                                    data = container_sock.recv(4096)
                                    if not data: break
                                    socketio.emit('exec:data', {'data': data.decode('utf-8', errors='replace')}, room=session_id)
                            except:
                                try:
                                    container_sock.setblocking(False)
                                    data = container_sock.recv(4096)
                                    if data:
                                        socketio.emit('exec:data', {'data': data.decode('utf-8', errors='replace')}, room=session_id)
                                except:
                                    import time
                                    time.sleep(0.1)
                    except Exception as e:
                        print(f"[Exec-SocketIO] Docker read error: {e}")
                    finally:
                        _internal_stop_execution(session_id)
                        socketio.emit('exec:finished', {}, room=session_id)

                socketio.start_background_task(read_from_container, sid, sock)
                emit('exec:started', {'status': 'running'})
                return
            except Exception as e:
                print(f"[Exec-SocketIO] Docker creation failed: {e}. Falling back to LOCAL mode.")
                emit('exec:data', {'data': f">>> [WARNING] Docker failed. Switching to Local Portable Runtime...\n"})

        # --- LOCAL FALLBACK ---
        import subprocess
        import tempfile
        import shutil
        import re
        from pathlib import Path
        from utils.compiler_manager import get_executable_path, get_gcc_path, get_gplusplus_path, get_runtime_root
        
        # 1. Create a workspace directory
        temp_dir = tempfile.mkdtemp(prefix='roolts_interactive_')
        temp_dir_path = Path(temp_dir)
        
        # 2. Determine file name and command
        fname = "script.txt"
        compile_cmd = None
        run_cmd = None
        
        if language == 'python':
            fname = "script.py"
            exe = get_executable_path('python', 'python')
            run_cmd = [exe, '-u', fname]
        elif language in ['javascript', 'js']:
            fname = "script.js"
            exe = get_executable_path('nodejs', 'node')
            run_cmd = [exe, fname]
        elif language == 'java':
            # Check for class name if possible, default to Main
            class_match = re.search(r'public\s+class\s+([A-Za-z0-9_]+)', code)
            class_name = class_match.group(1) if class_match else "Main"
            fname = f"{class_name}.java"
            javac = get_executable_path('java', 'javac')
            java = get_executable_path('java', 'java')
            compile_cmd = [javac, '-J-Xmx64m', '-J-Xms32m', fname]
            run_cmd = [java, '-Xmx64m', '-Xms32m', class_name]
        elif language == 'c':
            fname = "main.c"
            exe_name = "program.exe" if os.name == 'nt' else "program"
            gcc = get_gcc_path()
            compile_cmd = [gcc, fname, '-o', exe_name]
            run_cmd = [f"./{exe_name}" if os.name != 'nt' else exe_name]
        elif language in ['cpp', 'c++']:
            fname = "main.cpp"
            exe_name = "program.exe" if os.name == 'nt' else "program"
            gpp = get_gplusplus_path()
            compile_cmd = [gpp, fname, '-o', exe_name]
            run_cmd = [f"./{exe_name}" if os.name != 'nt' else exe_name]
        elif language == 'go':
            fname = "main.go"
            go = get_executable_path('go', 'go')
            run_cmd = [go, 'run', fname]
        elif language == 'kotlin':
            fname = "Main.kt"
            jar_name = "output.jar"
            kotlinc = get_executable_path('kotlin', 'kotlinc')
            java = get_executable_path('java', 'java')
            compile_cmd = [kotlinc, '-J-Xmx64m', '-J-Xms32m', fname, '-include-runtime', '-d', jar_name]
            run_cmd = [java, '-Xmx64m', '-Xms32m', '-jar', jar_name]
        elif language in ['csharp', 'c#']:
            fname = "Program.cs"
            dotnet = get_executable_path('csharp', 'dotnet')
            # C# is slow with 'dotnet run', but 'dotnet new console' + 'dotnet run' is the portable way
            # For interactive, we'll try a simpler approach if possible later, but for now:
            # We'll stick to executor.py's way but it's hard for interactive.
            # Simplified: just node/python/c/cpp/java/go for now as requested "all available"
            run_cmd = [dotnet, 'run'] # Requires project file, handled below
        else:
            emit('exec:error', {'error': f"Local fallback not supported for {language}"})
            shutil.rmtree(temp_dir, ignore_errors=True)
            return

        # 3. Write code to file
        file_path = temp_dir_path / fname
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(code)

        # 4. Environment and Special Setup
        child_env = os.environ.copy()
        
        if language == 'go':
            go_root = get_runtime_root('go')
            if go_root:
                child_env['GOROOT'] = go_root
                child_env['PATH'] = os.path.join(go_root, 'bin') + os.pathsep + child_env.get('PATH', '')
                compiler_dir = Path(go_root).parent
                child_env['GOPATH'] = str((compiler_dir / "gopath").absolute())
                child_env['GOCACHE'] = str((compiler_dir / "gocache").absolute())
                os.makedirs(child_env['GOPATH'], exist_ok=True)
                os.makedirs(child_env['GOCACHE'], exist_ok=True)
        
        elif language in ['csharp', 'c#']:
            dotnet = get_executable_path('csharp', 'dotnet')
            dotnet_root = get_runtime_root('csharp')
            if dotnet_root:
                child_env['DOTNET_ROOT'] = dotnet_root
                child_env['PATH'] = dotnet_root + os.pathsep + child_env.get('PATH', '')
            
            # Nuget and Profile isolation
            dotnet_home = temp_dir_path / ".dotnet_home"
            os.makedirs(dotnet_home, exist_ok=True)
            child_env['USERPROFILE'] = str(dotnet_home.absolute())
            child_env['HOME'] = str(dotnet_home.absolute())
            child_env['NUGET_PACKAGES'] = str((temp_dir_path / ".nuget").absolute())
            
            # Setup project
            subprocess.run([dotnet, 'new', 'console', '--force'], cwd=temp_dir, env=child_env, capture_output=True)

        elif language == 'java':
            java_bin = get_runtime_root('java') # Usually contains bin
            if java_bin:
                child_env['PATH'] = java_bin + os.pathsep + child_env.get('PATH', '')

        # 5. Compilation Step
        if compile_cmd:
            emit('exec:data', {'data': f">>> Compiling {language}...\n"})
            comp_proc = subprocess.run(
                compile_cmd,
                cwd=temp_dir,
                env=child_env,
                capture_output=True,
                text=True,
                errors='replace'
            )
            if comp_proc.returncode != 0:
                emit('exec:data', {'data': f"\n>>> Compilation Failed:\n{comp_proc.stderr}\n"})
                emit('exec:finished', {'status': 'error'})
                shutil.rmtree(temp_dir, ignore_errors=True)
                return
            emit('exec:data', {'data': ">>> Compilation Successful. Starting...\n"})

        # 6. Start interactive process
        try:
            # For C/C++ on Windows, we need the full path to the .exe
            if language in ['c', 'cpp', 'c++'] and os.name == 'nt':
                run_cmd[0] = str((temp_dir_path / run_cmd[0]).absolute())

            print(f"[Exec-SocketIO] Starting Popen: {run_cmd} (SID: {sid[:8]})")
            proc = subprocess.Popen(
                run_cmd,
                cwd=temp_dir,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                errors='replace',
                bufsize=1,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0,
                env=child_env
            )
            print(f"[Exec-SocketIO] Process started with PID {proc.pid}")
            
            with exec_lock:
                active_execs[sid] = {
                    'type': 'local',
                    'process': proc,
                    'temp_dir': temp_dir,
                    'running': True
                }

            def read_from_local(session_id, process):
                import queue
                import time
                
                # Queue for data chunks to decouple blocking read from emitting
                data_queue = queue.Queue()
                
                # Worker thread to read execution output blocking-ly
                def reader_thread():
                    try:
                        while True:
                            with exec_lock:
                                if not active_execs.get(session_id, {}).get('running'): break
                            
                            # Read 1 char (blocking)
                            # We use read(1) because read(N) blocks until N chars or EOF, which is bad for prompts
                            char = process.stdout.read(1)
                            if char == '':
                                if process.poll() is not None: break
                                time.sleep(0.01)
                                continue
                            data_queue.put(char)
                    except: pass
                    # Signal EOF
                    data_queue.put(None)

                # Start reader in background (this is a separate thread from the sender loop below)
                socketio.start_background_task(reader_thread)

                print(f"[Exec-SocketIO] Local sender thread started for {session_id[:8]}")
                try:
                    while True:
                        with exec_lock:
                            if not active_execs.get(session_id, {}).get('running'): break
                        
                        # Collect batch
                        buffer = []
                        try:
                            # Blocking wait for first item (with timeout to check running status)
                            item = data_queue.get(timeout=0.05)
                            if item is None: break # EOF
                            buffer.append(item)
                            
                            # Opportunistically grab more without blocking to form a chunk
                            # This drastically reduces WebSocket overhead (1 event vs 1000 events)
                            while not data_queue.empty() and len(buffer) < 4096:
                                try:
                                    item = data_queue.get_nowait()
                                    if item is None: break
                                    buffer.append(item)
                                except queue.Empty:
                                    break
                        except queue.Empty:
                            # Check if process finished
                            if process.poll() is not None and data_queue.empty():
                                break
                            continue
                            
                        if buffer:
                            # Join and emit as one chunk
                            socketio.emit('exec:data', {'data': "".join(buffer)}, room=session_id)
                            
                except Exception as e:
                    print(f"[Exec-SocketIO] Local sender error: {e}")
                finally:
                    print(f"[Exec-SocketIO] Local sender finished for {session_id[:8]}")
                    handle_exec_stop(sid=session_id)
            
            socketio.start_background_task(read_from_local, sid, proc)
            emit('exec:started', {'status': 'running'})

        except Exception as e:
            print(f"[Exec-SocketIO] Failed to start local process: {e}")
            emit('exec:error', {'error': f"Failed to start local process: {str(e)}"})
            shutil.rmtree(temp_dir, ignore_errors=True)

    except Exception as e:
        print(f"[Exec-SocketIO] Critical error: {e}")
        traceback.print_exc()
        emit('exec:error', {'error': str(e)})

@socketio.on('exec:input')
def handle_exec_input(data):
    """Send input to the running execution (Docker or Local)"""
    sid = request.sid
    with exec_lock:
        exec_data = active_execs.get(sid)
    
    print(f"[Exec-SocketIO] INPUT received from {sid[:8]} data: {data}")
    
    if not exec_data or not exec_data.get('running'):
        print(f"[Exec-SocketIO] INPUT rejected - no active execution for {sid[:8]}")
        return
        
    input_text = data.get('input', data.get('data', '')) # Support both 'input' and 'data' keys
    
    try:
        if exec_data['type'] == 'docker':
            sock = exec_data.get('socket')
            if sock:
                sock.send(input_text.encode('utf-8'))
        elif exec_data['type'] == 'local':
            proc = exec_data.get('process')
            if proc and proc.stdin:
                proc.stdin.write(input_text)
                proc.stdin.flush()
    except Exception as e:
        print(f"[Exec-SocketIO] Input error ({exec_data['type']}): {e}")

@socketio.on('exec:stop')
def handle_exec_stop(data=None, sid=None, emit_finished=True):
    """Socket action wrapper for stop"""
    if sid is None:
        try:
            from flask import request as flask_request
            sid = flask_request.sid
        except:
            return
    
    _internal_stop_execution(sid, emit_finished=emit_finished)

def _internal_stop_execution(sid, emit_finished=True):
    """Core logic to stop and cleanup an execution (Thread-safe)"""
    with exec_lock:
        if sid not in active_execs:
            return
            
        exec_data = active_execs[sid]
        if not exec_data.get('running'):
            # Already stopping or stopped
            return
            
        exec_data['running'] = False
        print(f"[Exec-SocketIO] Internal Stopping execution for {sid[:8]} type={exec_data['type']}")
        
        try:
            if exec_data['type'] == 'docker':
                # Docker cleanup
                try: exec_data['socket'].close()
                except: pass
                # Note: exec_id cleanup is automated by Docker when socket closes
            elif exec_data['type'] == 'local':
                # Local process cleanup
                proc = exec_data.get('process')
                if proc:
                    try:
                        if os.name == 'nt':
                            # Aggressive kill on Windows (Force + Tree)
                            import subprocess as sp
                            print(f"[Exec-SocketIO] Killing process tree for PID {proc.pid}")
                            sp.run(['taskkill', '/F', '/T', '/PID', str(proc.pid)], capture_output=True)
                        else:
                            import signal
                            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                    except Exception as kill_err:
                        print(f"[Exec-SocketIO] Kill error: {kill_err}")
                        try: proc.kill()
                        except: pass
                
                # Cleanup workspace directory
                temp_dir = exec_data.get('temp_dir')
                if temp_dir:
                    try:
                        import shutil
                        shutil.rmtree(temp_dir, ignore_errors=True)
                    except: pass
        except Exception as e:
            print(f"[Exec-SocketIO] Error during stop: {e}")
        finally:
            if sid in active_execs:
                del active_execs[sid]
            
            if emit_finished:
                socketio.emit('exec:finished', {'status': 'stopped'}, room=sid)


# ── LSP (Language Server Protocol) Integration ──────────────────────────────
from services.docker_manager import get_docker_manager
from services.lsp_manager import lsp_manager

@app.route('/api/lsp/status', methods=['GET'])
def lsp_status():
    """Return LSP server availability and status."""
    return jsonify({
        'available': lsp_manager.get_available_languages(),
        'running': lsp_manager.get_status(),
    })

@app.route('/api/lsp/install/<language>', methods=['POST'])
def lsp_install(language):
    """Trigger installation of a language server."""
    import importlib
    try:
        setup = importlib.import_module('scripts.setup_lsp')
        if language == 'python':
            ok = setup.install_python_lsp()
        elif language == 'java':
            ok = setup.install_jdtls()
        else:
            return jsonify({'error': f'No installer for {language}'}), 400
        return jsonify({'success': ok})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@socketio.on('lsp:start')
def handle_lsp_start(data):
    """Client requests a language server."""
    from flask import request as flask_request
    language = data.get('language')
    session_id = flask_request.sid

    if not language:
        emit('lsp:error', {'error': 'No language specified'})
        return

    print(f"[LSP-SocketIO] Start requested: {language} for session {session_id[:8]}")

    def on_lsp_message(message):
        """Callback when language server sends a message."""
        socketio.emit('lsp:message', {
            'language': language,
            'message': message,
        }, room=session_id)

    try:
        lsp_manager.start_server(session_id, language, on_lsp_message)
        emit('lsp:started', {'language': language, 'status': 'running'})
    except Exception as e:
        print(f"[LSP-SocketIO] Failed to start {language}: {e}")
        emit('lsp:error', {'language': language, 'error': str(e)})

@socketio.on('lsp:message')
def handle_lsp_message(data):
    """Client sends a JSON-RPC message to the language server."""
    from flask import request as flask_request
    language = data.get('language')
    message = data.get('message')
    session_id = flask_request.sid

    if language and message:
        lsp_manager.send_message(session_id, language, message)

@socketio.on('lsp:stop')
def handle_lsp_stop(data):
    """Client requests stopping a language server."""
    from flask import request as flask_request
    language = data.get('language')
    session_id = flask_request.sid

    if language:
        lsp_manager.stop_server(session_id, language)
        emit('lsp:stopped', {'language': language})

# Clean up LSP servers when client disconnects
_original_disconnect = handle_disconnect
@socketio.on('disconnect')
def handle_disconnect_with_lsp():
    from flask import request as flask_request
    session_id = flask_request.sid
    
    # 1. Clean up LSP Servers
    lsp_manager.stop_all_for_session(session_id)
    print(f"[LSP-SocketIO] Cleaned up servers for session {session_id[:8]}")
    
    # 2. Clean up any active executions
    _internal_stop_execution(session_id)
    
    print(f"Client disconnected: {session_id}")


if __name__ == '__main__':
    print("\n>>> Roolts Backend Starting (with SocketIO)...")
    print("=" * 50)
    print("API Server: http://127.0.0.1:5000")
    print("SocketIO:   Enabled (Threading Mode)")
    print("Features:   Video Calling, Remote Control, Chat, LSP")
    print("=" * 50)
    print("\nPress Ctrl+C to stop\n")
    
    port = int(os.environ.get("PORT", 5000))
    # Use 0.0.0.0 to avoid 127.0.0.1 vs localhost resolution issues on Windows
    socketio.run(app, host='0.0.0.0', port=port, debug=True, allow_unsafe_werkzeug=True)



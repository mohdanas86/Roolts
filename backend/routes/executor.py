
"""
Executor Routes
Handles code execution for the Roolts IDE
"""

import subprocess
import os
import uuid
import tempfile
import shutil
import sys
import re
from flask import Blueprint, jsonify, request
import traceback
from pathlib import Path
from utils.compiler_manager import get_gcc_path, get_gplusplus_path, get_executable_path, get_runtime_root, setup_runtime

executor_bp = Blueprint('executor', __name__)

@executor_bp.route('/execute', methods=['POST'])
def execute_code():
    """Execute code in the specified language"""
    try:
        data = request.get_json(silent=True)
    except Exception as e:
        return jsonify({'success': False, 'error': f'Invalid JSON: {str(e)}'}), 400
    
    if data is None:
        return jsonify({'success': False, 'error': 'No data provided in request body'}), 400

    if not isinstance(data, dict):

        return jsonify({
            'success': False, 
            'error': 'Invalid request format. Expected a JSON object.'
        }), 400

    code = data.get('code', '')
    raw_language = data.get('language', 'python').lower()
    filename = data.get('filename', '')
    stdin_input = data.get('input', '')
    
    # Normalize language using substring matching
    language = raw_language
    lang_map = {
        'python': 'python',
        'javascript': 'javascript',
        'js': 'javascript',
        'java': 'java',
        'cpp': 'cpp',
        'c++': 'cpp',
        'c-': 'c', # matches 'c-extension'
        'go': 'go',
        'kotlin': 'kotlin',
        'csharp': 'csharp',
        'c#': 'csharp',
        'ruby': 'ruby'
    }
    
    for key, val in lang_map.items():
        if key in raw_language:
            language = val
            break
    
    if not code:
        return jsonify({'success': False, 'error': 'No code provided'}), 400

    # Create a unique temporary directory for this execution
    temp_dir = tempfile.mkdtemp(prefix='roolts_exec_')
    
    try:
        output = ""
        error = ""
        success = False
        
        if language == 'python':
            fname = filename if filename and filename.endswith('.py') else 'script.py'
            file_path = os.path.join(temp_dir, fname)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(code)
            
            # Execute Python using portable runtime if available
            python_exe = get_executable_path('python', 'python')
            if python_exe == 'python': # Try setup if not found
                setup_runtime('python')
                python_exe = get_executable_path('python', 'python')
            
            # Execute Python
            result = subprocess.run(
                [python_exe, '-u', file_path],
                cwd=temp_dir,
                capture_output=True,
                text=True,
                input=stdin_input,
                timeout=60,
                errors='replace'
            )
            output = result.stdout
            error = result.stderr
            success = result.returncode == 0
            
        elif language == 'javascript' or language == 'js':
            fname = filename if filename and filename.endswith('.js') else 'script.js'
            file_path = os.path.join(temp_dir, fname)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(code)
            
            # Execute Node.js using portable runtime if available
            node_exe = get_executable_path('nodejs', 'node')
            if node_exe == 'node': # Try setup if not found
                setup_runtime('nodejs')
                node_exe = get_executable_path('nodejs', 'node')
            
            result = subprocess.run(
                [node_exe, file_path],
                cwd=temp_dir,
                capture_output=True,
                text=True,
                input=stdin_input,
                timeout=60,
                errors='replace'
            )
            output = result.stdout
            error = result.stderr
            success = result.returncode == 0
            
        elif language == 'java':
            if filename:
                fname = filename
                if not fname.endswith('.java'):
                    fname += '.java'
            else:
                fname = 'Main.java'

            # Check for package declaration
            package_match = re.search(r'^\s*package\s+([a-zA-Z0-9_.]+)\s*;', code, re.MULTILINE)
            package_name = package_match.group(1) if package_match else None

            class_name = os.path.splitext(fname)[0]
            if package_name:
                full_class_name = f"{package_name}.{class_name}"
            else:
                full_class_name = class_name

            file_path = os.path.join(temp_dir, fname)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(code)
            
            # Compile Java using portable javac if available
            javac_exe = get_executable_path('java', 'javac')
            compile_cmd = [javac_exe, '-J-Xmx64m', '-J-Xms32m', '-d', '.', fname]
            
            compile_result = subprocess.run(
                compile_cmd,
                cwd=temp_dir,
                capture_output=True,
                text=True,
                timeout=60,
                errors='replace'
            )
            
            if compile_result.returncode != 0:
                output = compile_result.stdout
                error = "Compilation Error:\n" + compile_result.stderr
                success = False
            else:
                # Run Java using portable java if available
                java_exe = get_executable_path('java', 'java')
                if java_exe == 'java':
                    setup_runtime('java')
                    java_exe = get_executable_path('java', 'java')
                    
                run_result = subprocess.run(
                    [java_exe, '-Xmx64m', '-Xms32m', full_class_name],
                    cwd=temp_dir,
                    capture_output=True,
                    text=True,
                    input=stdin_input,
                    timeout=60,
                    errors='replace'
                )
                output = run_result.stdout
                error = run_result.stderr
                success = run_result.returncode == 0
                
        elif language == 'c':
            fname = filename if filename and filename.endswith('.c') else 'main.c'
            file_path = os.path.join(temp_dir, fname)
            exe_path = os.path.join(temp_dir, 'program')
            if os.name == 'nt':
                exe_path += '.exe'
                
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(code)
            
            # Compile C using absolute path
            gcc_path = get_gcc_path()
            if gcc_path == 'gcc' or not os.path.exists(gcc_path):
                setup_runtime('c_cpp')
                gcc_path = get_gcc_path()
                
            compile_cmd = [gcc_path, file_path, '-o', exe_path]
            
            compile_result = subprocess.run(
                compile_cmd,
                cwd=temp_dir,
                capture_output=True,
                text=True,
                timeout=60,
                errors='replace'
            )
            
            if compile_result.returncode != 0:
                output = compile_result.stdout
                error = "Compilation Error:\n" + compile_result.stderr
                success = False
            else:
                # Run C Executable
                run_result = subprocess.run(
                    [exe_path],
                    cwd=temp_dir,
                    capture_output=True,
                    text=True,
                    input=stdin_input,
                    timeout=60,
                    errors='replace'
                )
                output = run_result.stdout
                error = run_result.stderr
                success = run_result.returncode == 0

        elif language == 'cpp' or language == 'c++':
            fname = filename if filename and filename.endswith('.cpp') else 'main.cpp'
            file_path = os.path.join(temp_dir, fname)
            exe_path = os.path.join(temp_dir, 'program')
            if os.name == 'nt':
                exe_path += '.exe'
                
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(code)
            
            # Compile C++ using absolute path
            gpp_path = get_gplusplus_path()
            compile_cmd = [gpp_path, file_path, '-o', exe_path]
            
            compile_result = subprocess.run(
                compile_cmd,
                cwd=temp_dir,
                capture_output=True,
                text=True,
                timeout=60,
                errors='replace'
            )
            
            if compile_result.returncode != 0:
                output = compile_result.stdout
                error = "Compilation Error:\n" + compile_result.stderr
                success = False
            else:
                # Run C++ Executable
                run_result = subprocess.run(
                    [exe_path],
                    cwd=temp_dir,
                    capture_output=True,
                    text=True,
                    input=stdin_input,
                    timeout=60,
                    errors='replace'
                )
                output = run_result.stdout
                error = run_result.stderr
                success = run_result.returncode == 0

        elif language == 'go':
            fname = filename if filename and filename.endswith('.go') else 'main.go'
            file_path = os.path.join(temp_dir, fname)
            exe_path = os.path.join(temp_dir, 'program')
            if os.name == 'nt':
                exe_path += '.exe'
                
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(code)
            
            # Compile/Run Go using portable runtime if available
            go_exe = get_executable_path('go', 'go')
            if go_exe == 'go':
                setup_runtime('go')
                go_exe = get_executable_path('go', 'go')
            
            go_root = get_runtime_root('go')
            
            # Prepare Go environment
            go_env = os.environ.copy()
            if go_root:
                go_env['GOROOT'] = go_root
                # Add bin to path just in case
                go_env['PATH'] = os.path.join(go_root, 'bin') + os.pathsep + go_env.get('PATH', '')
            
                # Use stable paths in the compiler directory for GOPATH and GOCACHE to ensure persistence
                compiler_dir = Path(go_root).parent
                go_env['GOPATH'] = str((compiler_dir / "gopath").absolute())
                go_env['GOCACHE'] = str((compiler_dir / "gocache").absolute())
                go_env['GOTOOLCHAIN'] = 'local'
            
            # Use 'go run' for faster performance on script-like execution
            # Ensure GOPATH and GOCACHE dirs exist to prevent startup delays/errors
            if go_root:
                gopath = go_env.get('GOPATH')
                gocache = go_env.get('GOCACHE')
                if gopath: os.makedirs(gopath, exist_ok=True)
                if gocache: os.makedirs(gocache, exist_ok=True)

            run_result = subprocess.run(
                [go_exe, 'run', fname],
                cwd=temp_dir,
                capture_output=True,
                text=True,
                input=stdin_input,
                env=go_env,
                timeout=60,
                errors='replace'
            )
            output = run_result.stdout
            error = run_result.stderr
            success = run_result.returncode == 0

        elif language == 'kotlin':
            fname = filename if filename and filename.endswith('.kt') else 'Main.kt'
            file_path = os.path.join(temp_dir, fname)
            jar_name = 'output.jar'
            jar_path = os.path.join(temp_dir, jar_name)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(code)
            
            # Use portable kotlinc
            kotlinc_exe = get_executable_path('kotlin', 'kotlinc')
            if kotlinc_exe == 'kotlinc': # Not found locally
                 setup_runtime('kotlin')
                 kotlinc_exe = get_executable_path('kotlin', 'kotlinc')

            # Compile: kotlinc Main.kt -include-runtime -d output.jar
            compile_result = subprocess.run(
                [kotlinc_exe, '-J-Xmx64m', '-J-Xms32m', file_path, '-include-runtime', '-d', jar_path],
                cwd=temp_dir,
                capture_output=True,
                text=True,
                timeout=60,
                errors='replace'
            )

            if compile_result.returncode != 0:
                output = compile_result.stdout
                error = "Compilation Error:\n" + compile_result.stderr
                success = False
            else:
                # Run: java -jar output.jar
                java_exe = get_executable_path('java', 'java')
                if java_exe == 'java':
                     setup_runtime('java')
                     java_exe = get_executable_path('java', 'java')
                     
                run_result = subprocess.run(
                    [java_exe, '-Xmx64m', '-Xms32m', '-jar', jar_path],
                    cwd=temp_dir,
                    capture_output=True,
                    text=True,
                    input=stdin_input,
                    timeout=60,
                    errors='replace'
                )
                output = run_result.stdout
                error = run_result.stderr
                success = run_result.returncode == 0
        
        elif language == 'csharp' or language == 'c#':
            # Create a simple .NET console project structure
            dotnet_exe = get_executable_path('csharp', 'dotnet')
            if dotnet_exe == 'dotnet':
                 setup_runtime('csharp')
                 dotnet_exe = get_executable_path('csharp', 'dotnet')
                 
            # Prepare Dotnet environment
            dotnet_env = os.environ.copy()
            dotnet_root = get_runtime_root('csharp')
            if dotnet_root:
                dotnet_env['DOTNET_ROOT'] = dotnet_root
                dotnet_env['PATH'] = dotnet_root + os.pathsep + dotnet_env.get('PATH', '')
                
            # Isolate NuGet and Dotnet profile to prevent system-wide config interference
            # Create a dedicated home for dotnet within temp
            dotnet_home = os.path.join(temp_dir, '.dotnet_home')
            os.makedirs(dotnet_home, exist_ok=True)
            dotnet_env['USERPROFILE'] = dotnet_home
            dotnet_env['HOME'] = dotnet_home
            dotnet_env['LOCALAPPDATA'] = os.path.join(dotnet_home, 'AppData', 'Local')
            dotnet_env['APPDATA'] = os.path.join(dotnet_home, 'AppData', 'Roaming')
            os.makedirs(dotnet_env['LOCALAPPDATA'], exist_ok=True)
            os.makedirs(dotnet_env['APPDATA'], exist_ok=True)
            
            nuget_cache = os.path.join(temp_dir, '.nuget')
            os.makedirs(nuget_cache, exist_ok=True)
            dotnet_env['NUGET_PACKAGES'] = nuget_cache
            dotnet_env['DOTNET_SKIP_FIRST_TIME_EXPERIENCE'] = 'true'
            dotnet_env['DOTNET_CLI_TELEMETRY_OPTOUT'] = '1'
            dotnet_env['DOTNET_MULTILEVEL_LOOKUP'] = '0'

            # Create a local NuGet.config to clear fallback folders
            nuget_config_path = os.path.join(temp_dir, 'NuGet.config')
            with open(nuget_config_path, 'w', encoding='utf-8') as f:
                f.write('<?xml version="1.0" encoding="utf-8"?>\n'
                        '<configuration>\n'
                        '  <packageSources>\n'
                        '    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />\n'
                        '  </packageSources>\n'
                        '  <fallbackPackageFolders>\n'
                        '    <clear />\n'
                        '  </fallbackPackageFolders>\n'
                        '</configuration>')

            # Create project
            subprocess.run(
                [dotnet_exe, 'new', 'console', '--force'],
                cwd=temp_dir,
                capture_output=True,
                text=True,
                env=dotnet_env,
                errors='replace'
            )
            
            # Overwrite Program.cs
            program_cs = os.path.join(temp_dir, 'Program.cs')
            with open(program_cs, 'w', encoding='utf-8') as f:
                f.write(code)
                
            # Run
            run_result = subprocess.run(
                [dotnet_exe, 'run'],
                cwd=temp_dir,
                capture_output=True,
                text=True,
                input=stdin_input,
                timeout=60,
                env=dotnet_env,
                errors='replace'
            )
            
            output = run_result.stdout
            error = run_result.stderr
            success = run_result.returncode == 0

        elif language == 'ruby':
            fname = filename if filename and filename.endswith('.rb') else 'script.rb'
            file_path = os.path.join(temp_dir, fname)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(code)
            
            ruby_exe = get_executable_path('ruby', 'ruby')
            if ruby_exe == 'ruby':
                 setup_runtime('ruby')
                 ruby_exe = get_executable_path('ruby', 'ruby')
            
            run_result = subprocess.run(
                [ruby_exe, file_path],
                cwd=temp_dir,
                capture_output=True,
                text=True,
                input=stdin_input,
                timeout=60,
                errors='replace'
            )
            
            output = run_result.stdout
            error = run_result.stderr
            success = run_result.returncode == 0

        else:
            return jsonify({'success': False, 'error': f'Unsupported language: {language}'}), 400

        return jsonify({
            'success': success,
            'output': output,
            'error': error
        })

    except FileNotFoundError as e:
        # distinct handling for missing executables
        missing_file = e.filename or f"for {language}"
        return jsonify({
            'success': False,
            'error': f'Compiler or interpreter not found: {missing_file}. Please install it and add to PATH.'
        }), 400
    except subprocess.TimeoutExpired:
        return jsonify({
            'success': False,
            'error': 'Execution timed out (60s limit)'
        }), 408
    except PermissionError as e:
        # Handling common permission issues (e.g., file in use)
        return jsonify({
            'success': False,
            'error': f'Permission denied: {str(e)}. The executable might be blocked or already running.'
        }), 403
    except Exception as e:
        # Log the full error to console for the developer
        print(f"[ERROR] Exception in execute_code ({language}): {str(e)}")
        traceback.print_exc()
        
        # Check if it's a "file not found" error that wasn't caught by FileNotFoundError
        msg = str(e)
        if "The system cannot find the file specified" in msg:
             return jsonify({
                'success': False,
                'error': f'System could not find the required executable for {language}. Please ensure portable runtimes are set up correctly.'
            }), 400
            
            
        error_details = traceback.format_exc() # Always return details for debugging

        
        return jsonify({
            'success': False,
            'error': f"Internal Server Error: {str(e)}",
            'details': error_details
        }), 500
    finally:
        # Cleanup temporary directory
        try:
            shutil.rmtree(temp_dir)
        except:
            pass
            
@executor_bp.route('/health', methods=['GET'])
def executor_health_check():
    return jsonify({'status': 'online', 'service': 'code-executor'})

@executor_bp.route('/languages', methods=['GET'])
def get_languages():
    return jsonify([
        {'id': 'python', 'name': 'Python', 'version': '3.x'},
        {'id': 'javascript', 'name': 'JavaScript', 'version': 'Node.js'},
        {'id': 'java', 'name': 'Java', 'version': 'OpenJDK'},
        {'id': 'c', 'name': 'C', 'version': 'GCC'},
        {'id': 'cpp', 'name': 'C++', 'version': 'G++'},
        {'id': 'go', 'name': 'Go', 'version': '1.x'},
        {'id': 'kotlin', 'name': 'Kotlin', 'version': '1.9.x'},
        {'id': 'csharp', 'name': 'C#', 'version': '.NET 8'},
        {'id': 'ruby', 'name': 'Ruby', 'version': '3.2.x'}
    ])

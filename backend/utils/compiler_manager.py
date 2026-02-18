import os
import sys
import zipfile
import subprocess
import requests
import shutil
import threading
from pathlib import Path

# Configuration for portable runtimes
# Make sure RUNTIMES_DIR is absolute, relative to this file's location
# Path of this file: .../backend/utils/compiler_manager.py
# We want: .../backend/compiler
RUNTIMES_DIR = (Path(__file__).parent.parent / "compiler").resolve()

RUNTIME_CONFIG = {
    'c_cpp': {
        'url': "https://github.com/skeeto/w64devkit/releases/download/v1.21.0/w64devkit-1.21.0.zip",
        'zip_name': "w64devkit.zip",
        'extract_dir': "c_cpp",
        'bin_path': "w64devkit/bin",
        'executables': {
            'gcc': 'gcc.exe',
            'g++': 'g++.exe',
            'make': 'make.exe'
        }
    },
    'python': {
        'url': "https://www.python.org/ftp/python/3.11.4/python-3.11.4-embed-amd64.zip",
        'zip_name': "python_portable.zip",
        'extract_dir': "python",
        'bin_path': "",
        'executables': {
            'python': 'python.exe'
        }
    },
    'nodejs': {
        'url': "https://nodejs.org/dist/v18.17.0/node-v18.17.0-win-x64.zip",
        'zip_name': "node_portable.zip",
        'extract_dir': "nodejs",
        'bin_path': "node-v18.17.0-win-x64",
        'executables': {
            'node': 'node.exe',
            'npm': 'npm.cmd'
        }
    },
    'java': {
        'url': "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jdk_x64_windows_hotspot_21.0.2_13.zip",
        'zip_name': "openjdk.zip",
        'extract_dir': "java", 
        'bin_path': "jdk-21.0.2+13/bin", # Temurin has this nested
        'executables': {
            'java': 'java.exe',
            'javac': 'javac.exe'
        }
    },
    'go': {
        'url': "https://go.dev/dl/go1.21.6.windows-amd64.zip",
        'zip_name': "go_portable.zip",
        'extract_dir': "go_runtime",
        'bin_path': "go/bin",
        'executables': {
            'go': 'go.exe'
        }
    },
    'kotlin': {
        'url': "https://github.com/JetBrains/kotlin/releases/download/v1.9.22/kotlin-compiler-1.9.22.zip",
        'zip_name': "kotlin_portable.zip",
        'extract_dir': "kotlin",
        'bin_path': "kotlinc/bin",
        'executables': {
            'kotlinc': 'kotlinc.bat',
            'kotlin': 'kotlin.bat'
        }
    },
    'csharp': {
        'url': "https://dotnetcli.azureedge.net/dotnet/Sdk/8.0.201/dotnet-sdk-8.0.201-win-x64.zip",
        'zip_name': "dotnet_sdk.zip",
        'extract_dir': "dotnet",
        'bin_path': "", # Binaries are in root of valid dotnet zip
        'executables': {
            'dotnet': 'dotnet.exe',
            'csc': 'sdk/8.0.201/Roslyn/bincore/csc.dll' # CSC is often a DLL in SDK run via dotnet
        }
    }
}

# Thread-safe setup tracking
_setup_lock = threading.Lock()
_setup_thread = None
_setup_status = {
    'completed': False,
    'failed_langs': [],
    'total_paths': []
}

def is_tool_installed(name):
    """Check if a tool is available in the current PATH."""
    try:
        # shutil.which is more reliable for simple presence check
        return shutil.which(name) is not None
    except:
        return False

def setup_runtime(lang_key):
    """
    Downloads and sets up a portable runtime for a specific language.
    """
    config = RUNTIME_CONFIG.get(lang_key)
    if not config:
        return None

    extract_to = RUNTIMES_DIR / config['extract_dir']
    bin_dir = extract_to / config['bin_path']
    
    # Check if first executable exists
    first_exe_name = list(config['executables'].keys())[0]
    if os.path.exists(get_executable_path(lang_key, first_exe_name)):
        return str(bin_dir.absolute())

    print(f"[{lang_key}] Portable runtime not found. Downloading...")
    
    try:
        with _setup_lock:
            RUNTIMES_DIR.mkdir(exist_ok=True)
            # Also ensure extraction subfolder exists
            extract_to.mkdir(exist_ok=True)
            
            zip_path = RUNTIMES_DIR / config['zip_name']
            
            # Download
            print(f"[{lang_key}] Downloading from {config['url']}...")
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            # Set a timeout for the request
            response = requests.get(config['url'], stream=True, headers=headers, timeout=15)
            response.raise_for_status()
            
            with open(zip_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
                    
            # Extract
            if config['zip_name'].endswith('.7z'):
                 # Use tar to extract 7z (available on Windows 10+)
                 print(f"[{lang_key}] Extracting 7z archive...")
                 subprocess.run(['tar', '-x', '-f', str(zip_path), '-C', str(extract_to)], check=True)
            else:
                print(f"[{lang_key}] Extracting zip archive...")
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(extract_to)
            
            # Cleanup zip/7z
            if zip_path.exists():
                os.remove(zip_path)

            print(f"[{lang_key}] Setup complete.")
            return str(bin_dir.absolute())
            
    except Exception as e:
        print(f"[{lang_key}] Critical failure during setup: {e}")
        import traceback
        traceback.print_exc()
        return None

def enable_python_pip(python_dir):
    """
    Enables pip for the portable embeddable Python distribution.
    1. Modifies the ._pth file to enable site-packages.
    2. Downloads and runs get-pip.py if pip is missing.
    """
    python_dir = Path(python_dir).resolve()
    
    # 1. Update ._pth file
    # Find the pythonXX._pth file
    pth_files = list(python_dir.glob("python*._pth"))
    if pth_files:
        pth_file = pth_files[0]
        try:
            with open(pth_file, 'r') as f:
                content = f.read()
            
            # Uncomment 'import site' if it exists and is commented
            if "#import site" in content:
                print(f"[python] Enabling site-packages in {pth_file.name}")
                content = content.replace("#import site", "import site")
                with open(pth_file, 'w') as f:
                    f.write(content)
        except Exception as e:
            print(f"[python] Warning: Failed to modify ._pth file: {e}")

    # 2. Install pip if missing
    python_exe = (python_dir / "python.exe").resolve()
    scripts_dir = (python_dir / "Scripts").resolve()
    pip_exe = (scripts_dir / "pip.exe").resolve()
    
    if not pip_exe.exists():
        print("[python] pip not found. Installing pip...")
        get_pip_path = (RUNTIMES_DIR / "get-pip.py").resolve()
        try:
            if not get_pip_path.exists():
                print("[python] Downloading get-pip.py...")
                url = "https://bootstrap.pypa.io/get-pip.py"
                r = requests.get(url)
                with open(get_pip_path, 'wb') as f:
                    f.write(r.content)
            
            # Run get-pip.py using absolute paths
            print(f"[python] Running get-pip.py with {python_exe}...")
            # We don't set cwd here to avoid confusion; usage of absolute paths handles it.
            # But pip installation might detail into site-packages relative to executable location.
            # Python's behavior relative to executable should be fine if we run it directly.
            subprocess.run([str(python_exe), str(get_pip_path)], cwd=str(python_dir), check=True, capture_output=True)
            print("[python] pip installed successfully.")
        except Exception as e:
            print(f"[python] Failed to install pip: {e}")
            if hasattr(e, 'stderr') and e.stderr:
                print(f"Error output: {e.stderr.decode() if isinstance(e.stderr, bytes) else e.stderr}")
            elif hasattr(e, 'output') and e.output:
                 print(f"Output: {e.output.decode() if isinstance(e.output, bytes) else e.output}")

def _setup_worker():
    """Background worker to setup all runtimes."""
    global _setup_status
    print("\n[Background] Starting portable runtime initialization...")
    
    for lang in RUNTIME_CONFIG:
        path = setup_runtime(lang)
        if path:
            _setup_status['total_paths'].append(path)
            
            # Additional setup for Python
            if lang == 'python':
                enable_python_pip(path)
                scripts_path = str((Path(path) / "Scripts").absolute())
                if scripts_path not in os.environ["PATH"]:
                    os.environ["PATH"] = scripts_path + os.environ.get("PATHEXT", "") + os.pathsep + os.environ["PATH"]

            if path not in os.environ["PATH"]:
                os.environ["PATH"] = path + os.pathsep + os.environ["PATH"]
        else:
            _setup_status['failed_langs'].append(lang)
            
    _setup_status['completed'] = True
    print(f"[Background] Runtime initialization finished. Success: {len(_setup_status['total_paths'])}, Failed: {len(_setup_status['failed_langs'])}")

def setup_all_runtimes():
    """Starts the background setup of all portable runtimes."""
    global _setup_thread
    
    if _setup_thread and _setup_thread.is_alive():
        return []

    _setup_thread = threading.Thread(target=_setup_worker, daemon=True)
    _setup_thread.start()
    
    # Return empty list immediately as we are now async
    return []

def get_setup_status():
    """Returns the current status of background setup."""
    return _setup_status

def get_executable_path(lang_key, tool_name):
    """Returns the absolute path to a specific tool."""
    config = RUNTIME_CONFIG.get(lang_key)
    if not config or tool_name not in config['executables']:
        return tool_name # Fallback to system name

    portable_path = RUNTIMES_DIR / config['extract_dir'] / config['bin_path'] / config['executables'][tool_name]
    if portable_path.exists():
        return str(portable_path.absolute())
    
    return tool_name

def get_runtime_root(lang_key):
    """Returns the root directory of a runtime (e.g., GOROOT)."""
    config = RUNTIME_CONFIG.get(lang_key)
    if not config:
        return None
    
    # For Go, the root is compiler/go_runtime/go
    # For others, it might just be the extract_dir
    root_path = RUNTIMES_DIR / config['extract_dir']
    
    # Handle nested folders like 'go/bin' -> root is 'go'
    if config['bin_path']:
        # If bin_path is 'go/bin', we want the part before 'bin'
        bin_parts = Path(config['bin_path']).parts
        if 'bin' in bin_parts:
            # Join all parts before 'bin'
            bin_idx = bin_parts.index('bin')
            root_path = root_path.joinpath(*bin_parts[:bin_idx])
            
    if root_path.exists():
        return str(root_path.absolute())
    return None

# Legacy aliases for backward compatibility
def get_gcc_path(): return get_executable_path('c_cpp', 'gcc')
def get_gplusplus_path(): return get_executable_path('c_cpp', 'g++')
def setup_compiler(): return setup_runtime('c_cpp')


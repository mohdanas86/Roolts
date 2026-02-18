import os
import sys
from pathlib import Path

# Mock RUNTIMES_DIR as it is in backend/utils/compiler_manager.py
# backend/utils/compiler_manager.py: Path(__file__).parent.parent / "compiler"
# Here we are at root, so we mimic that logic
DUMMY_FILE = Path("backend/utils/compiler_manager.py")
RUNTIMES_DIR = (DUMMY_FILE.parent.parent / "compiler").resolve()

print(f"Computed RUNTIMES_DIR: {RUNTIMES_DIR}")
print(f"Exists: {RUNTIMES_DIR.exists()}")

def get_executable_path(lang_key, tool_name):
    RUNTIME_CONFIG = {
        'python': { 'extract_dir': "python", 'bin_path': "", 'executables': { 'python': 'python.exe' } },
        'c_cpp': { 'extract_dir': "c_cpp", 'bin_path': "w64devkit/bin", 'executables': { 'gcc': 'gcc.exe', 'g++': 'g++.exe' } }
    }
    config = RUNTIME_CONFIG.get(lang_key)
    if not config: return tool_name
    portable_path = RUNTIMES_DIR / config['extract_dir'] / config['bin_path'] / config['executables'][tool_name]

    print(f"Checking path: {portable_path}")
    if portable_path.exists():
        return str(portable_path.absolute())
    return tool_name

python_path = get_executable_path('python', 'python')
print(f"Resolved Python Path: {python_path}")

gcc_path = get_executable_path('c_cpp', 'gcc')
print(f"Resolved GCC Path: {gcc_path}")
print(f"GCC Exists: {os.path.exists(gcc_path)}")

# Try to run python
import subprocess
try:
    result = subprocess.run([python_path, "--version"], capture_output=True, text=True)
    print(f"Python Execution OK: {result.stdout.strip()}")
except Exception as e:
    print(f"Python Execution Failed: {e}")

# Try to run gcc
try:
    result = subprocess.run([gcc_path, "--version"], capture_output=True, text=True)
    print(f"GCC Execution OK: {result.stdout.splitlines()[0]}")
except Exception as e:
    print(f"GCC Execution Failed: {e}")

# Try to run pip
pip_path = os.path.join(os.path.dirname(python_path), "Scripts", "pip.exe")
print(f"Checking Pip Path: {pip_path}")
if os.path.exists(pip_path):
    try:
        result = subprocess.run([pip_path, "--version"], capture_output=True, text=True)
        print(f"Pip Execution OK: {result.stdout.strip()}")
    except Exception as e:
        print(f"Pip Execution Failed: {e}")
else:
    print("Pip not found in Scripts folder.")



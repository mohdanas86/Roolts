import os
import shutil
import sys
from pathlib import Path

# Add current directory to path to allow importing utils
sys.path.append(os.getcwd())

from utils.compiler_manager import setup_runtime, RUNTIMES_DIR, RUNTIME_CONFIG

def force_reinstall_python():
    print("Starting forced re-installation of Portable Python 3.11...")
    
    python_config = RUNTIME_CONFIG.get('python')
    if not python_config:
        print("Error: Python configuration not found.")
        return

    python_dir = RUNTIMES_DIR / python_config['extract_dir']
    
    if python_dir.exists():
        print(f"Removing existing python directory: {python_dir}")
        try:
            shutil.rmtree(python_dir)
            print("Cleanup successful.")
        except Exception as e:
            print(f"Error removing directory: {e}")
            return

    print("Triggering setup_runtime('python')...")
    result_path = setup_runtime('python')
    
    if result_path:
        print(f"Python installation successful. Path: {result_path}")
    else:
        print("Python installation FAILED.")

if __name__ == "__main__":
    force_reinstall_python()

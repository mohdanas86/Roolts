
import time
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

print("Starting benchmark...")
start_time = time.time()

try:
    from app import create_app
    print(f"Import time: {time.time() - start_time:.4f}s")
    
    app_start = time.time()
    app = create_app()
    print(f"App creation time: {time.time() - app_start:.4f}s")
    
    print(f"Total startup time: {time.time() - start_time:.4f}s")
except Exception as e:
    print(f"Error: {e}")

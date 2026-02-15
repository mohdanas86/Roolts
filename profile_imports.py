
import time
import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'backend'))

def benchmark_import(module_name):
    start = time.time()
    try:
        __import__(module_name)
        print(f"Import {module_name}: {time.time() - start:.4f}s")
    except Exception as e:
        print(f"Import {module_name} FAILED: {e}")

print("Benchmarking imports...")
benchmark_import('flask')
benchmark_import('flask_sqlalchemy')
benchmark_import('huggingface_hub')
benchmark_import('services.multi_ai')
benchmark_import('routes.ai_hub')
benchmark_import('routes.files')
benchmark_import('app')

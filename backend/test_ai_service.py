import os
import sys

# Add backend to path
sys.path.append(os.path.abspath('.'))

print(">>> Testing AI Service Imports...")
try:
    from app import create_app
    print("[OK] app.py imported")
    
    from models import db, User
    print("[OK] models.py imported")
    
    from services.multi_ai import MultiAIService
    print("[OK] MultiAIService imported")
    
    from routes.ai import ai_status
    print("[OK] routes.ai imported")
    
    # Try initializing MultiAIService
    print(">>> Initializing MultiAIService...")
    service = MultiAIService({})
    print("[OK] MultiAIService initialized")
    
    # Try calling get_available_models
    print(">>> Calling get_available_models...")
    available = service.get_available_models()
    print(f"[OK] Available models: {available}")
    
    print("\n>>> ALL TESTS PASSED!")
except Exception as e:
    print(f"\n[FAIL] Error occurred: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

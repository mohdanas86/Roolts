import os
import sys
from flask import Flask

# Add backend to path
sys.path.append(os.path.abspath('.'))

from app import create_app
from routes.ai import ai_status

app = create_app()

print(">>> Testing /api/ai/status with app context...")
with app.test_request_context('/api/ai/status'):
    try:
        response = ai_status()
        print(f"[OK] Status code: {response[1] if isinstance(response, tuple) else 200}")
        print(f"[OK] Response: {response.get_json() if hasattr(response, 'get_json') else response}")
    except Exception as e:
        print(f"\n[FAIL] Error occurred during route execution: {e}")
        import traceback
        traceback.print_exc()

print("\n>>> Testing /api/ai/chat with app context...")
from routes.ai import chat_with_ai
with app.test_request_context('/api/ai/chat', method='POST', json={'query': 'hi'}):
    try:
        # Mock request data if needed, but test_request_context handles it
        response = chat_with_ai()
        print(f"[OK] Status code: {response[1] if isinstance(response, tuple) else 200}")
        print(f"[OK] Response: {response.get_json() if hasattr(response, 'get_json') else response}")
    except Exception as e:
        print(f"\n[FAIL] Error occurred during route execution: {e}")
        import traceback
        traceback.print_exc()

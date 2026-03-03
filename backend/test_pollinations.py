import requests
import json

base_url = "https://text.pollinations.ai/"
headers = {'Content-Type': 'application/json', 'Authorization': 'Bearer sk_LDciH0Fri7SHrgohCYQX0M8vBkLJlSFu'}
payload = {
    'messages': [{'role': 'user', 'content': 'Hello, are you there?'}],
    'model': 'openai',
    'jsonMode': False
}

try:
    print("Testing pollinations...")
    res = requests.post(base_url, headers=headers, json=payload, timeout=10)
    print(f"Status: {res.status_code}")
    print(f"Response (trunc): {res.text[:200]}")
except Exception as e:
    print(f"Exception: {e}")

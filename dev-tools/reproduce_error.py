import requests
import json

url = "http://127.0.0.1:5000/api/executor/execute"
payload = {
    "code": "print('Hello World')",
    "language": "python",
    "filename": "test.py"
}

try:
    print(f"Sending request to {url}...")
    response = requests.post(url, json=payload, timeout=10)
    print(f"Status Code: {response.status_code}")
    print("Response Body:")
    print(response.text)
except Exception as e:
    print(f"Failed to connect: {e}")


import requests
import json

url = "http://127.0.0.1:5000/api/executor/execute"
payload = {
    "code": "print('hello world')",
    "language": "python",
    "filename": "test.py",
    "input": ""
}
headers = {'Content-Type': 'application/json'}

try:
    response = requests.post(url, data=json.dumps(payload), headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")
except Exception as e:
    print(f"Connection failed: {e}")


import os
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join('backend', '.env'))

api_key = os.getenv('GEMINI_API_KEY')
print(f"Testing Gemini Key: {api_key[:10]}...")

url = f"https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key={api_key}"

contents = [{
    'role': 'user',
    'parts': [{'text': 'Hello, are you working?'}]
}]

try:
    response = requests.post(url, json={'contents': contents})
    data = response.json()
    print("Response Status:", response.status_code)
    print("Response Data:", data)
except Exception as e:
    print("Error:", str(e))

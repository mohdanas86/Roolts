import os
import requests
from dotenv import load_dotenv

load_dotenv('backend/.env')
key = os.getenv('DEEPSEEK_API_KEY')

print(f"Testing key: {key[:5]}...{key[-5:] if key else ''}")

# 1. Test DeepSeek
try:
    print("\nTesting DeepSeek API (https://api.deepseek.com/chat/completions)...")
    resp = requests.post(
        "https://api.deepseek.com/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"model": "deepseek-chat", "messages": [{"role": "user", "content": "hi"}]},
        timeout=10
    )
    print(f"DeepSeek Status: {resp.status_code}")
    print(f"DeepSeek Response: {resp.text[:200]}")
except Exception as e:
    print(f"DeepSeek Error: {e}")

# 2. Test Moonshot (Kimi) - common for 'k_' keys
try:
    print("\nTesting Moonshot API (https://api.moonshot.cn/v1/chat/completions)...")
    resp = requests.post(
        "https://api.moonshot.cn/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"model": "moonshot-v1-8k", "messages": [{"role": "user", "content": "hi"}]},
        timeout=10
    )
    print(f"Moonshot Status: {resp.status_code}")
    print(f"Moonshot Response: {resp.text[:200]}")
except Exception as e:
    print(f"Moonshot Error: {e}")

import requests
res = requests.post('http://localhost:5000/api/ai/chat', json={'query': 'hi', 'history': [{'role': 'user', 'content': 'prev'}], 'code': ''})
print(res.status_code); print(res.text)

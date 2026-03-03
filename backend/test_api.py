import requests
res = requests.post('http://localhost:5000/api/ai/chat', json={'prompt': 'hi'})
print(res.status_code); print(res.text)

# 🔐 Simple Environment Variables

Since you are using **Hugging Face**, you only need **one main token** to power all AI features.

### **Required variables for Render**

| Variable | Value | Description |
| :--- | :--- | :--- |
| `HF_TOKEN` | `hf_...` | Your Hugging Face token ([Get it here](https://huggingface.co/settings/tokens)) |
| `SECRET_KEY` | `random_string` | Any long random string to secure your sessions. |

### **Optional (For extra power)**
| Variable | Description |
| :--- | :--- |
| `GEMINI_API_KEY` | Use Google Gemini for research features. |
| `CLAUDE_API_KEY` | Use Anthropic Claude for writing tasks. |
| `DEEPSEEK_API_KEY`| Direct DeepSeek API for faster coding. |

---

### **Local Development (Docker Compose)**
If you are running locally, just create a `.env` file in the root:
```env
HF_TOKEN=your_token_here
SECRET_KEY=secret123
```
Then run: `docker-compose up -d --build`

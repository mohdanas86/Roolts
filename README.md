# Roolts - Advanced AI-Powered Code Editor and Portfolio Enhancement Application


<p align="center">
  <img src="frontend/public/favicon.svg" alt="Roolts Logo" width="80" height="80">
</p>

<p align="center">
  <strong>Build. Learn. Share.</strong>
</p>

<p align="center">
  Your AI-powered portfolio with integrated code editor, learning tools, and direct social media publishing.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#api-reference">API Reference</a>
</p>

---
This application is currently in development.This project has over 50 commits but since it was turned to private.It will not show.This project will be regularly updated

## ✨ Features

### 🤖 Multi-AI Hub
- **Smart AI Router** - Automatically selects the best AI for your task
- **4 AI Providers** - Gemini, Claude, DeepSeek, Qwen
- **Real-time Suggestions** - AI-powered suggestions as you type

### 💻 Xcode-like Code Editor
- **Monaco Editor** - Same editor as VS Code
- **Multi-language Support** - Python, Java, JavaScript
- **Live Execution** - Run code and see results instantly

### 📱 Social Publishing
- **Direct Posting** - Post to Twitter/X and LinkedIn
- **AI Suggestions** - Get AI-generated post ideas
- **OAuth Integration** - Secure account connection

### 📚 Learning Hub
- **Visual Explanations** - Code explanations with diagrams
- **Interactive Q&A** - Ask coding questions
- **Resource Suggestions** - Get relevant tutorials

### 🔐 User Authentication
- **Secure Login** - JWT-based authentication
- **Profile Management** - Customize your portfolio
- **API Key Storage** - Store your AI API keys securely

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Monaco Editor, Zustand, Vite |
| **Backend** | Python Flask, SQLAlchemy, JWT |
| **Executor** | Java Spring Boot |
| **AI** | Gemini, Claude, DeepSeek, Qwen APIs |
| **Social** | Twitter API v2, LinkedIn API |

---

## 🚀 Getting Started

### One-Click Setup (Windows)
For the easiest experience, simply run:
```bash
Roolts_QuickStart.bat
```
This script will automatically detect your environment, install necessary dependencies for both frontend and backend, and launch the application.

---

### Manual Installation

#### Prerequisites
- **Node.js 18+** and npm
- **Python 3.10+**
- **Java 17+** (for code execution)
- **Git**

#### 1. Clone & Prepare
```bash
git clone https://github.com/yourusername/roolts.git
cd roolts
```

#### 2. Backend Setup
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# Initial Setup
python scripts/vault_tool.py add huggingface HF_...
# OR use the .env
cp .env.example .env
python app.py
```

#### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Monaco Editor, Zustand, Vite |
| **Backend** | Python Flask, SQLAlchemy, JWT |
| **Compiler** | Portable Runtimes (Node, Python, GCC, JDk) |
| **AI Hub** | Gemini, Claude, DeepSeek, Qwen APIs |

---

## 📁 Documentation & Troubleshooting
Detailed guides are available in the `backend/docs/troubleshooting/` directory:
- [Virtual Environment Setup](backend/docs/troubleshooting/VIRTUAL_ENV_README.md)
- [Network & Port Fixes](backend/docs/troubleshooting/NETWORK_FIX.md)
- [Encoding Issues](backend/docs/troubleshooting/ENCODING_FIX.md)
- [Testing Guide](backend/docs/troubleshooting/TESTING_GUIDE.md)
- [Docker Setup Guide](DOCKER_SETUP.md)

---

```
roolts/
├── frontend/                 # React + Vite application
│   ├── src/
│   │   ├── App.jsx          # Main application
│   │   ├── store/           # Zustand state management
│   │   └── services/
│   │       ├── api.js       # Base API client
│   │       ├── authService.js    # Authentication
│   │       ├── aiHubService.js   # Multi-AI chat
│   │       └── executorService.js # Code execution
│   └── package.json
│
├── backend/                  # Python Flask API
│   ├── app.py               # Main entry point
│   ├── models.py            # User & OAuth models
│   ├── routes/
│   │   ├── auth.py          # Authentication endpoints
│   │   ├── ai_hub.py        # Multi-AI endpoints
│   │   ├── github.py        # GitHub integration
│   │   ├── social.py        # Twitter/LinkedIn
│   │   └── ai.py            # Learning features
│   └── services/
│       └── multi_ai.py      # AI provider integration
│
└── java-service/             # Java Spring Boot executor
    └── src/main/java/com/roolts/
        ├── controller/
        │   └── ExecutorController.java
        └── service/
            └── CodeExecutorService.java
```

---

## 📡 API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Login & get JWT |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/profile` | Update profile |
| PUT | `/api/auth/api-keys` | Save AI API keys |
| GET | `/api/auth/twitter/connect` | Start Twitter OAuth |
| GET | `/api/auth/linkedin/connect` | Start LinkedIn OAuth |

### AI Hub
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ai-hub/models` | List available AI models |
| POST | `/api/ai-hub/chat` | Send message (auto/manual model) |
| POST | `/api/ai-hub/suggest` | Get typing suggestions |
| POST | `/api/ai-hub/analyze-prompt` | Analyze best model for prompt |

### Code Execution
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/execute/python` | Run Python code |
| POST | `/api/execute/java` | Run Java code |
| POST | `/api/execute/javascript` | Run JavaScript code |
| GET | `/api/execute/languages` | List supported languages |

### Social Media
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/social/twitter/post` | Post to Twitter |
| POST | `/api/social/linkedin/post` | Post to LinkedIn |

---

## 🔧 Development

```bash
# Run all services
# Terminal 1 - Frontend
cd frontend && npm run dev

# Terminal 2 - Backend
cd backend && python app.py

# Terminal 3 - Java Service (optional)
cd java-service && ./gradlew bootRun
```

---

## 🔐 Secure Key Management

Roolts uses an encrypted vault to store your API keys safely. You can manage them via the command line:

```bash
cd backend
# Add a key
python scripts/vault_tool.py add huggingface YOUR_TOKEN_HERE

# List current keys (masked)
python scripts/vault_tool.py list
```

The app will look for keys in this order:
1. **Encrypted Vault** (Highest priority)
2. **Environment Variables** (e.g. `.env` file)
3. **Mock Fallback** (Always works for testing)

---

## 🛡️ Commit Safety Checklist

Before pushing to GitHub, ensure you aren't leaking secrets:

1. [ ] Check `backend/.env` is NOT tracked (should be grey/ignored in VS Code)
2. [ ] Check `backend/.vault_key` is NOT tracked
3. [ ] Check `backend/config/sealed_secrets.bin` is NOT tracked
4. [ ] Verify `backend/.env.example` contains only placeholders

If you accidentally tracked a secret:
```bash
git rm --cached backend/.env
```

---

## 🤖 AI Model Selection Algorithm

The smart router selects the best AI based on:

| Task Type | Best Model | Why |
|-----------|------------|-----|
| **Coding** | DeepSeek | Optimized for code generation |
| **Writing** | Claude | Nuanced, creative text |
| **Research** | Gemini | Factual, up-to-date info |
| **Multilingual** | Qwen | Excellent non-English support |

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  Made with ❤️ for developers who want to build, learn, and share
</p>

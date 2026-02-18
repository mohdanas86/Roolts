# Contributing to Roolts

Thank you for your interest in contributing to Roolts! To maintain a high standard of security and reliability, please follow these guidelines.

## 🔐 Security First

We strictly prohibit committing API keys or sensitive secrets to the repository.

### **Pre-Commit Checklist**
Before submitting a pull request, please verify:
1. **No Cleartext Keys**: Search for `hf_`, `AIZa`, `sk-`, or `qwen` patterns.
2. **Ignored Files**: Ensure `.env`, `.vault_key`, and `sealed_secrets.bin` are NOT staged for commit.
3. **Example Files**: Only placeholders (e.g., `your-api-key`) should be in `.env.example`.

### **Using the Vault**
Always prefer the built-in vault tool for managing your local keys:
```bash
python backend/scripts/vault_tool.py add <provider> <key>
```

## 🛠 Development Workflow

1. **Backend**: Keep `multi_ai.py` logic clean. If you add a new provider, ensure it has a `is_configured()` check and a graceful fallback.
2. **Frontend**: Use `import.meta.env` for all configuration. Never hardcode URLs.
3. **Drafting Posts**: Ensure any AI-generated content follows the platform's safety guidelines.

## 🧪 Testing

Run the route tests before submitting:
```bash
python route_test.py
```

---
Happy Coding! 🚀

# Docker Setup Guide for Roolts

To enable secure, isolated, and interactive code execution, Roolts uses Docker. Follow these steps to set it up on your Windows machine.

## 1. Install Docker Desktop
1.  **Download**: Go to [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) and download the installer.
2.  **Install**: Run the installer. Ensure **"Use WSL 2 instead of Hyper-V"** is checked (recommended).
3.  **Restart**: You may need to restart your computer after installation.

## 2. Start & Configure Docker
1.  Open **Docker Desktop** from your Start menu.
2.  Wait for the whale icon in the taskbar to turn solid green (this means "Docker is running").
3.  **Settings (Optional)**:
    *   Click the **Gear icon** (Settings) -> **General**.
    *   Ensure "Expose daemon on tcp://localhost:2375 without TLS" is **OFF** (standard installation works fine with default settings).

## 3. Pull Sandbox Images
Open your terminal (PowerShell or Command Prompt) and run these commands to pre-download the environments the app uses:

```bash
# For Python execution
docker pull python:3.11-alpine

# For JavaScript execution
docker pull node:18-alpine

# For C/C++ execution
docker pull gcc:latest
```

## 4. Verify Connection
Restart your Roolts backend (`python app.py`). You should see this in the logs:
```text
[OK] Docker connection established
```

## How it Works
*   **Docker Mode**: If Docker is running, Roolts creates a temporary container for every "Run" command. This is the most secure way to run code.
*   **Local Fallback**: If Docker is closed, Roolts automatically switches to "Local Mode" using your portable runtimes. You don't have to change any settings!

## Troubleshooting
*   **Permission Denied**: Run your terminal (or IDE) as Administrator.
*   **Docker not found**: Ensure `docker` is in your system PATH (Docker Desktop usually does this automatically). Try running `docker version` in a new terminal to check.

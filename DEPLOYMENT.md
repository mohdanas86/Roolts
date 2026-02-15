# Roolts Deployment Guide

Your application is now prepared for cloud deployment as a single unified website.

## 🚀 One-Click Deployment (Recommended)

The easiest way to deploy is using **Render** with the included `Dockerfile`.

1.  **Push to GitHub**: Create a new repository and push all files.
2.  **Connect to Render**:
    -   Go to [Render.com](https://render.com) and create a new **Web Service**.
    -   Select your repository.
    -   Render will automatically detect the `backend/Dockerfile`.
3.  **Environment Variables**:
    -   `PORT`: `5000` (Render handles this automatically)
    -   `DATABASE_URL`: `sqlite:///roolts.db`
    -   `GEMINI_API_KEY`: *your-key*
    -   `CLAUDE_API_KEY`: *your-key*
    -   `DEEPSEEK_API_KEY`: *your-key*
    -   `QWEN_API_KEY`: *your-key*

## 🐳 Docker Deployment

If you have a VPS, you can run the whole app with one command:

```bash
docker-compose up -d
```

## 🛠 Manual Configuration

-   **Frontend Build**: I have already generated the production assets in `frontend/dist`.
-   **Static Serving**: The backend is configured to serve these files automatically. When you visit the backend URL, it will load the frontend.

## 📡 Health Check
Once deployed, you can verify your service at:
`https://your-app.onrender.com/api/health`

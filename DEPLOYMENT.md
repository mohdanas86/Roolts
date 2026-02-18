# 🚀 Simple One-Click Deployment

You can now deploy the **entire application** (Frontend, Backend, AND Java Analysis) as a single service on Render.

### **Step-by-Step for Render.com**

1.  **New Web Service**: Click **New +** > **Web Service** on [Render](https://render.com).
2.  **Connect Repo**: Select your GitHub repository.
3.  **Settings**:
    -   **Name**: `roolts-app`
    -   **Runtime**: `Docker`
4.  **Environment Variables**: Just click **Advanced** > **Add Environment Variable**:
    | Key | Value |
    | :--- | :--- |
    | `HF_TOKEN` | `your_hugging_face_token_here` |
    | `SECRET_KEY` | `any_random_string` |

5.  **Deploy!** Click **Create Web Service**.

---

### 💡 Why is this better?
-   **One Service**: You don't need to deploy two separate apps.
-   **One Key**: Since you have your Hugging Face token, the app will automatically use **DeepSeek-R1** for all AI features.
-   **Automatic Connectivity**: Everything is pre-configured to talk to each other inside the single container.

### 🔐 Need more details?
Check out [ENV_VARS.md](file:///d:/Roolts-main(6)/Roolts-main/ENV_VARS.md) for a full list of optional keys.

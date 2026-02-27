# Deployment Guide

Snakey.io consists of a Node.js backend (Socket.io) and a React Vite frontend. Because they communicate via real-time WebSockets, they need to be deployed properly.

## 1. Backend Deployment (Docker / Railway / Render)

The backend needs a Node.js environment that supports WebSockets and sticky sessions.

### Option A: Using Docker (Recommended for VPS)

A `Dockerfile` is included in the `backend/` directory.

```bash
cd backend
docker build -t snakey-backend .
docker run -p 3001:3001 -d snakey-backend
```

### Option B: Platform as a Service (Railway / Render)

1. Push your code to a GitHub repository.
2. Go to [Railway.app](https://railway.app/) or [Render.com](https://render.com/).
3. Create a new Web Service and point it to the `backend/` folder of your repository.
4. Set the Start Command to `npm start`.
5. Once deployed, copy the generated URL (e.g., `https://snakey-backend-production.up.railway.app`).

---

## 2. Frontend Deployment (Vercel / Netlify)

The React frontend can be hosted cheaply or for free on static hosting platforms.

1. **Set Environment Variable:**
   In your frontend build settings (on Vercel/Netlify), add an environment variable pointing to your deployed backend URL.
   - **Key:** `VITE_BACKEND_URL`
   - **Value:** `https://your-backend-url.com` (from step 1)

2. **Deploy to Vercel/Netlify:**
   - Connect your GitHub repository.
   - Set the Root Directory to `frontend`.
   - The framework should auto-detect as **Vite**.
   - Build command: `npm run build`
   - Output directory: `dist`
   - Deploy!

## 3. Database Notes (SQLite)

The game currently uses SQLite (`database.sqlite`).

- On PaaS providers like Railway, local files are ephemeral (deleted on restart).
- To persist data permanently, either use a Railway persistent volume attached to `/usr/src/app` or migrate to PostgreSQL by updating `Database.js`.

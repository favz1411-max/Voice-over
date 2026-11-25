# Cadence Studio

Full-stack voiceover generator and audio mastering workspace powered by Gemini 3.8 TTS, Express, React, and Vite.

## Deploying from a Connected GitHub Repo

1. Push this repository to GitHub.
2. Connect the repository in your hosting provider (**Google Cloud Run**, **Render**, **Railway**, or **Fly.io**).
3. Configure the required environment variable:
   - `GEMINI_API_KEY` — Your Gemini API key (server-side only).
4. Use these settings (auto-detected via `Dockerfile` or `render.yaml`):
   - **Node version**: `22+`
   - **Build command**: `npm install && npm run build`
   - **Start command**: `npm start`
   - **Health check path**: `/api/health`

## Local Development

```bash
cp .env.example .env
# Add GEMINI_API_KEY to .env
npm install
npm run dev
```

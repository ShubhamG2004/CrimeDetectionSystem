# Vercel Deployment

This repo is a multi-service app. Deploy the `frontend` folder to Vercel, and host the long-running `backend` service separately because it uses Express, Socket.IO, uploads, and server-side secrets.

The Python AI service must also be deployed separately and exposed over HTTPS so the backend can call it through `AI_SERVER_URL`.

## 1. Deploy The Backend First

Use a Node host that supports long-running servers and WebSockets, such as Render, Railway, Fly.io, or a VM.

Backend settings:

- Root directory: `backend`
- Install command: `npm install`
- Start command: `npm start`
- Health check path: `/health`
- Required environment variables: copy from `backend/.env.example` and fill real values.
- Set `AI_SERVER_URL` to the public HTTPS URL of the AI server.

After deploy, save the public URL, for example:

```text
https://crime-detection-api.example.com
```

Set backend `CORS_ORIGIN` to your Vercel frontend URL. Multiple origins can be comma-separated.

## 2. Deploy The Frontend To Vercel

In Vercel, import the GitHub repository and use these project settings:

- Framework preset: Next.js
- Root directory: `frontend`
- Build command: `npm run build`
- Install command: `npm install`
- Output directory: leave default

Add frontend environment variables from `frontend/.env.example`.

Important:

```text
NEXT_PUBLIC_API_URL=https://your-backend-url.example.com
```

Do not use `localhost` in Vercel environment variables.

## 3. Deploy The AI Server

Deploy `ai-server` to a Python host that supports long-running web services, such as Render, Railway, Fly.io, or a VM.

Suggested settings:

- Root directory: `ai-server`
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn image_detector:app --bind 0.0.0.0:$PORT`

Required environment variables:

- `PORT` if your host does not provide one automatically
- Any model or path settings used by the AI service

After deploy, copy the AI server URL and set it as `AI_SERVER_URL` in the backend environment.

## 4. Firebase Authorized Domains

In Firebase Console, add your Vercel domain to Authentication authorized domains:

```text
your-project.vercel.app
```

Also add your custom domain if you connect one later.

## 5. Final Checks

After both deployments:

- Open `https://your-backend-url/health`.
- Open the Vercel app and sign in.
- Test pages that call the backend: cameras, incidents, image detection, messages, and admin pages.
- If browser requests fail, check backend `CORS_ORIGIN` and frontend `NEXT_PUBLIC_API_URL`.

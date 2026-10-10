# Zovari — Vercel deployment notes

This repository is intended to be deployed as two Vercel projects from the same GitHub repository.

## 1. Frontend project
- Import the repository in Vercel.
- Set **Root Directory** to `frontend`.
- Framework preset: **Other**. Leave build command blank; static files are served directly.
- After the backend project is deployed, edit `frontend/config.js` and replace `https://REPLACE-WITH-YOUR-BACKEND.vercel.app/api` with the actual backend URL ending in `/api`. Commit and push the change.

## 2. Backend project
- Create another Vercel project from the same repository.
- Set **Root Directory** to `zovari-backend`.
- Framework preset: **Other** (Vercel should detect the Node/Express server entry).
- Add environment variables in Vercel Project Settings → Environment Variables: `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `EMAIL_USER`, and `EMAIL_PASS` as required by the enabled features. Never upload `.env`.
- Set `CLIENT_URL` to the exact deployed frontend origin, e.g. `https://your-frontend.vercel.app` (no trailing slash). Multiple origins can be comma-separated.
- Deploy, then test the root URL; it should return a JSON health message.

## 3. Real-time Socket.IO
- Frontend config uses the backend's `/api` base URL and the Socket.IO client is configured for WebSocket transport only, because Vercel Functions do not provide sticky sessions for Socket.IO's default HTTP long-polling.
- Vercel WebSocket support is a public beta. Test messages, notifications, 1:1 calls, and group-call flows with two separate accounts/devices. This code-level preparation does not guarantee every real-time workflow works in production. In-memory online-user and group-call maps are instance-local; cross-instance presence/group-call consistency may require a shared adapter/store (e.g. Redis).

## 4. Security
- `.env` is intentionally excluded from the deployment package. Set secrets only in Vercel's Environment Variables. If real credentials were ever pushed to Git or shared in a ZIP, rotate them.
- Do not commit `.vercel` directories or `node_modules`.

## Verification status
JavaScript syntax checks can be run locally, but a successful Vercel build, MongoDB connectivity, email delivery, Cloudinary uploads, and live WebSocket behavior require deployment credentials and live testing.

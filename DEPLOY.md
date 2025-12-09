# Deployment Guide (Vercel)

This project is configured to run on Vercel with a Next.js frontend and a Python (FastAPI) backend.

## Prerequisites
1. A [Vercel](https://vercel.com) account.
2. The project pushed to GitHub (already done).

## Steps to Deploy

1.  **Import to Vercel**:
    *   Go to your Vercel Dashboard.
    *   Click **"Add New..."** -> **"Project"**.
    *   Select your GitHub repository: `Codushan/Matrix`.
    *   **Vercel should automatically detect settings** based on `vercel.json`.

2.  **Environment Variables**:
    *   In the "Deploy" screen or "Settings", add the following environment variable:
        *   `API_URL`: Leave this **empty** or set to `/` so the frontend calls the backend relative to the current domain (e.g., `https://your-app.vercel.app/evaluate`).

3.  **Deploy**:
    *   Click **Deploy**.
    *   Vercel will build both the Python backend and the Next.js frontend.

## Troubleshooting
- If you see "404 Not Found" for `/evaluate`:
    - Check the logs in Vercel.
    - Ensure `vercel.json` is at the root.

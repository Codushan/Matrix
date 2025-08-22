# Deploying Matrix Calculator to Vercel

## Prerequisites
- GitHub account
- Vercel account (free at [vercel.com](https://vercel.com))

## Step 1: Prepare Your Repository

1. **Push your code to GitHub:**
   ```bash
   cd web
   git init
   git add .
   git commit -m "Initial commit: Matrix Calculator"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/matrix-calculator.git
   git push -u origin main
   ```

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Recommended)

1. **Go to [vercel.com](https://vercel.com) and sign in**
2. **Click "New Project"**
3. **Import your GitHub repository:**
   - Select your matrix-calculator repository
   - Vercel will auto-detect it's a Next.js project
4. **Configure environment variables:**
   - Add `NEXT_PUBLIC_API_URL` with your backend URL
   - For production, this should be your deployed backend URL
5. **Click "Deploy"**

### Option B: Deploy via Vercel CLI

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   cd web
   vercel
   ```

## Step 3: Configure Environment Variables

In your Vercel project dashboard:

1. **Go to Settings → Environment Variables**
2. **Add the following variable:**
   - **Name:** `NEXT_PUBLIC_API_URL`
   - **Value:** Your backend API URL (e.g., `https://your-backend.herokuapp.com`)
   - **Environment:** Production, Preview, Development

## Step 4: Deploy Your Backend

Since Vercel only hosts frontend, you need to deploy your Python backend separately:

### Option A: Deploy to Railway
1. Go to [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Deploy the `server` folder
4. Get your production URL and update `NEXT_PUBLIC_API_URL`

### Option B: Deploy to Render
1. Go to [render.com](https://render.com)
2. Create a new Web Service
3. Point to your `server` folder
4. Set build command: `pip install -r requirements.txt`
5. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Option C: Deploy to Heroku
1. Create a `Procfile` in your server directory:
   ```
   web: uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
2. Deploy using Heroku CLI or GitHub integration

## Step 5: Update CORS Settings

Update your backend CORS settings to allow your Vercel domain:

```python
# In server/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://your-app.vercel.app",  # Add your Vercel domain
        "https://*.vercel.app"  # Or allow all Vercel subdomains
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Step 6: Test Your Deployment

1. **Visit your Vercel URL** (e.g., `https://your-app.vercel.app`)
2. **Test the matrix calculator functionality**
3. **Verify API calls work with your deployed backend**

## Troubleshooting

### Common Issues:

1. **API calls failing:**
   - Check CORS settings in your backend
   - Verify `NEXT_PUBLIC_API_URL` is set correctly
   - Ensure backend is accessible from the internet

2. **Build errors:**
   - Check that all dependencies are in `package.json`
   - Verify Node.js version compatibility

3. **Environment variables not working:**
   - Ensure variables start with `NEXT_PUBLIC_` for client-side access
   - Redeploy after adding environment variables

## Cost

- **Vercel:** Free tier includes unlimited deployments
- **Railway:** Free tier available
- **Render:** Free tier available
- **Heroku:** Free tier discontinued, paid plans start at $7/month

## Next Steps

After successful deployment:
1. Set up a custom domain (optional)
2. Configure automatic deployments from GitHub
3. Set up monitoring and analytics
4. Consider setting up staging environments

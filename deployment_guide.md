# Safe Scanner - Step-by-Step Production Deployment Guide

Follow these exact steps to host the Safe Scanner full-stack application for free in production.

---

## Prerequisites
1. A **GitHub** account with this codebase pushed to a repository.
2. A free account on **MongoDB Atlas** ([mongodb.com](https://www.mongodb.com/cloud/atlas)).
3. A free account on **Render** ([render.com](https://render.com)).
4. A free account on **Vercel** ([vercel.com](https://vercel.com)).

---

## Step 1: Connect MongoDB Atlas
1. **Create Cluster**: Log into MongoDB Atlas, click **Create**, select the **M1 Sandbox (Shared Free Tier)** cluster, choose a cloud provider (e.g. AWS), and click **Create Cluster**.
2. **Database Security User**: Navigate to **Database Access** > **Add New Database User**. Choose **Password Authentication**, configure a username (e.g. `scanner_admin`) and a secure password. Assign the role **Read and Write to any Database**.
3. **Network Rules**: Navigate to **Network Access** > **Add IP Address**. Choose **Allow Access from Anywhere** (`0.0.0.0/0`) to ensure Render's dynamic web service IPs can communicate with your database cluster. Click **Confirm**.
4. **Copy Connection String**: Go to **Database** > **Connect** > **Drivers**. Copy the connection URI string.
   - It will look like this: `mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
   - Replace `<username>` and `<password>` with your database user credentials. Change the database name suffix to `safescanner` (e.g., `...mongodb.net/safescanner?...`).

---

## Step 2: Deploy Backend API on Render
1. **New Web Service**: Log into Render, click **New +** > **Web Service**.
2. **Connect Git**: Connect your GitHub account and select your `verified_upi_tracker` repository.
3. **Configure Settings**:
   - **Name**: `safe-scanner-api`
   - **Region**: Select region closest to your users.
   - **Branch**: `main` (or active branch)
   - **Runtime**: `Node`
   - **Build Command**: `npm install --prefix server`
   - **Start Command**: `npm start --prefix server`
   - **Instance Type**: `Free`
4. **Configure Environment Variables**: Click **Advanced** and add:
   - `MONGO_URI` = `your_mongodb_connection_string`
   - `PORT` = `5000`
   - `NODE_ENV` = `production`
5. **Deploy**: Click **Create Web Service**. 
   - *Seeding*: Mongoose will connect to Atlas and detect if the collection is new. It will automatically load and seed your MongoDB database with the default verified merchants, reported lists, and scans!
   - *ML Engine*: Because Render's Free tier restricts RAM (512MB), we utilize our JavaScript risk engine fallback. If Python libraries fail to install or exceed memory limits, the server automatically routes all risk scores through our native JS risk evaluator seamlessly.
6. **Copy Live URL**: Copy your backend domain once deployment finishes (e.g., `https://safe-scanner-api.onrender.com`).

---

## Step 3: Deploy Frontend Client on Vercel
1. **New Project**: Log into Vercel, click **Add New** > **Project**.
2. **Import Repository**: Import your `verified_upi_tracker` repository.
3. **Configure Build Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Select `client` (Click Edit, select `client` directory, and confirm).
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. **Configure Environment Variables**: Add a new environment variable:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://your-render-backend-url.onrender.com/api` (Remember to append `/api` at the end and exclude any trailing slash).
5. **Deploy**: Click **Deploy**. Vercel will bundle the assets and host them on a secure HTTPS server.
6. **Vercel Routing**: Our package contains `client/vercel.json`, which instructs Vercel's edge router to rewrite all incoming URLs to `index.html` to keep React single page navigation working perfectly on page reloads.

---

## Step 4: Verify Live System
1. Open your Vercel deployment URL (e.g. `https://safe-scanner.vercel.app`).
2. Input any username (e.g., `guest`), leave the password field blank, and click **User Portal** to log in.
3. Go to the Scanner tab:
   - Click the **Verified Outlet (Safe)** preset. The dial should transition to Green, play the voice alert *"Safe to proceed"*, and log the transaction in the history table.
   - Click the **Blacklisted Account (High Risk)** preset. The dial should turn Red and warn you that the UPI ID is blacklisted.
4. Try reporting a fake merchant using the **Report Scam QR** button, then log out.
5. Log back in as Admin (Username: `admin` | Password: `admin`):
   - Go to the reports dashboard. You will see the report you just submitted!
   - Click **Verify** next to the report. It will be approved, moved to the active database blacklist, and automatically flagged on any future scans of that merchant.

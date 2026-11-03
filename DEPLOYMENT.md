# Production Deployment Guide (Free-Tier Cloud Topology)

This document details the configuration and deployment procedures for hosting Sunday Funday ERP on a zero-cost, high-availability cloud topology:

| Layer | Provider | Free Tier Specification |
|---|---|---|
| **Relational Database** | [Neon.tech](https://neon.tech) | Serverless PostgreSQL 16 (0.5 GB RAM, pooled connection string, SSL) |
| **Backend API** | [Koyeb](https://koyeb.com) or [Render](https://render.com) | Docker container (512 MB RAM, automatic HTTPS, health check) |
| **Frontend UI** | [Vercel](https://vercel.com) | Edge-optimized Next.js 14 App Router (automatic CI/CD on git push) |

---

## 1. Relational Database (Neon.tech)

1. **Create Project:**
   - Create a project named `sunday-funday-erp` in the closest geographic region (e.g., `Singapore / ap-southeast-1`).
   - Copy the Pooled Connection String:
     ```
     postgresql://<username>:<password>@<ep-identifier>-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
     ```
2. **Apply Schema & Generate Prisma Client:**
   - From your local terminal or CI pipeline:
     ```bash
     cd apps/api
     DATABASE_URL="postgresql://<username>:<password>@<ep-identifier>-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" npx prisma db push
     ```
   - On first startup, the backend automatically initializes the isolated Recruiter Sandbox account (`id = 2`).

---

## 2. Backend API Service (Koyeb / Render)

### Option A: Koyeb (Recommended)
1. **Create App & Service:**
   - Select **GitHub Repository** -> `mondaymondayv2`.
   - Set **Work Directory**: `apps/api`.
   - Select **Dockerfile** build method (`apps/api/Dockerfile`).
2. **Environment Variables:**
   | Variable | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | `3001` |
   | `DATABASE_URL` | `postgresql://<user>:<pwd>@<neon-host>/neondb?sslmode=require` |
   | `JWT_SECRET` | Strong 64-character secret string |
   | `CORS_ORIGIN` | `https://<your-vercel-app>.vercel.app` |
3. **Health Check:**
   - Protocol: `HTTP`
   - Path: `/api/auth/session` or `/`
   - Port: `3001`

### Option B: Render Web Service
1. Create a **Web Service** pointing to the GitHub repository.
2. Root Directory: `apps/api`.
3. Runtime: **Docker**.
4. Configure the same environment variables as above.

---

## 3. Frontend Web Application (Vercel)

1. **Import Git Repository:**
   - Select repository `mondaymondayv2`.
2. **Configure Project Settings:**
   - **Framework Preset:** Next.js
   - **Root Directory:** `apps/web`
3. **Environment Variables:**
   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://<your-api-domain>.koyeb.app` (no trailing slash) |
4. **Deploy:**
   - Click **Deploy**. Vercel will compile all 18 routes with Turbopack and optimize server/client bundles.

---

## 4. Post-Deployment Verification

1. Navigate to the deployed Vercel URL (e.g. `https://sunday-funday.vercel.app/login`).
2. Verify that `accountName`, `username`, and `password` fields are blank.
3. Click **Explore Portfolio Sandbox (Recruiter Demo) →**.
4. Confirm access to the dashboard (`10/2026`), test the **Privacy Eye Mask** toggle using demo password `Recruiter2026!`, and test the 10-second balance reconciliation workflow.

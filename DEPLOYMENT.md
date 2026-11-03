# Production Deployment Guide (100% Free Cloud Topology)

This document details the configuration and deployment procedures for hosting Sunday Funday ERP on a zero-cost, high-availability cloud topology without requiring a credit card:

| Layer | Provider | Free Tier Specification |
|---|---|---|
| **Relational Database** | [Neon.tech](https://neon.tech) | Serverless PostgreSQL 16/18 (0.5 GB RAM, connection pooling, SSL) |
| **Backend API** | [Vercel Serverless](https://vercel.com) | Express/NestJS Serverless Function (warm execution cache, automatic HTTPS) |
| **Frontend UI** | [Vercel](https://vercel.com) | Edge-optimized Next.js 14 App Router (automatic CI/CD on git push) |

---

## 1. Relational Database Setup (Neon.tech)

1. **Create Project:**
   - Sign up at [neon.tech](https://neon.tech) (GitHub auth, no credit card required).
   - Create a project named `sunday-funday-erp` in region `Singapore (ap-southeast-1)`.
   - Neon provides two connection strings:
     - **Pooled URL (`-pooler`):** Use for runtime API connections (`DATABASE_URL`).
       ```text
       postgresql://neondb_owner:<password>@<ep-name>-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
       ```
     - **Direct URL:** Use for schema pushes and initial database cloning.
       ```text
       postgresql://neondb_owner:<password>@<ep-name>.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
       ```

2. **1-Command Database Migration from Local:**
   - Run the automated database cloner from your local workspace:
     ```bash
     $env:CLOUD_DATABASE_URL="postgresql://neondb_owner:<password>@<ep-name>.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
     npm run db:push-to-cloud
     ```
   - This executes schema sync (`prisma db push`), clones all 15 relational tables atomically, and realigns PostgreSQL auto-increment sequences (`setval`).

---

## 2. Backend API Deployment (`apps/api` on Vercel)

The backend is configured for Vercel Serverless via `apps/api/src/serverless.ts`, `apps/api/api/index.js`, and `apps/api/vercel.json`.

1. **Import Git Repository on Vercel:**
   - Log in to [vercel.com](https://vercel.com) and click **Add New... -> Project**.
   - Select your repository (`gabandreas/sundayfundayv2`).
2. **Project Settings:**
   - **Project Name:** `sunday-funday-api`
   - **Framework Preset:** `Other`
   - **Root Directory:** Click **Edit** and select `apps/api`.
   - **Build Command:** `npx prisma generate && npm run build` (set automatically by `vercel.json`).
   - **Output Directory:** `dist`
3. **Environment Variables:**
   | Variable | Value | Notes |
   |---|---|---|
   | `DATABASE_URL` | `postgresql://neondb_owner:...-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` | Use Neon Pooled Connection String |
   | `JWT_SECRET` | Strong 64-character random string | Used for signing 30-minute JWT auth tokens |
   | `CORS_ORIGIN` | `https://sunday-funday.vercel.app` | Set to your frontend Vercel URL |
   | `NODE_ENV` | `production` | Enables production optimizations |
4. **Deploy:**
   - Click **Deploy**. Vercel routes `/api/*` and root routes to the serverless entrypoint.

---

## 3. Frontend Web Application (`apps/web` on Vercel)

1. **Create Second Project on Vercel:**
   - From Vercel dashboard, click **Add New... -> Project**.
   - Select the same repository (`gabandreas/sundayfundayv2`).
2. **Project Settings:**
   - **Project Name:** `sunday-funday` (or your chosen frontend domain).
   - **Framework Preset:** `Next.js`
   - **Root Directory:** Click **Edit** and select `apps/web`.
3. **Environment Variables:**
   | Variable | Value | Notes |
   |---|---|---|
   | `NEXT_PUBLIC_API_URL` | `https://sunday-funday-api.vercel.app` | Point to your deployed API project URL (no trailing slash) |
4. **Deploy:**
   - Click **Deploy**. Vercel compiles all 18 routes with zero errors.

---

## 4. Post-Deployment Verification & Sandbox Access

1. Navigate to your frontend URL: `https://sunday-funday.vercel.app/login`.
2. **Security Check:** Confirm all credential fields (`accountName`, `username`, `password`) are unpopulated.
3. **General Demo Sandbox Access:**
   - Click **"Explore General Sandbox (Demo) →"** to access the isolated demonstration workspace in 1 click.
   - Alternatively, enter credentials:
     - **Account Name:** `demo`
     - **Username:** `guest`
     - **Password:** `Sandbox2026!`
4. **Interactive Feature Validation:**
   - **Privacy Eye Mask:** Verify financial figures default to `Rp •••••••`. Click **Reveal** and enter `Sandbox2026!` to unmask.
   - **Dynamic Spend Pacing:** Inspect the payday-to-payday variable consumption window and status indicators.
   - **10-Second Balance Reconciler:** Execute real-time balance checkpoints against the operational pool.

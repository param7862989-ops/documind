# DocuMind - Production Cloud Deployment Guide

This guide details how to deploy **DocuMind** completely independently of your local computer or development server.

---

## 1. Cloud Architecture Overview

```text
[ Users Worldwide ] ─── HTTPS ───▶ [ Next.js Frontend ] (Vercel / Cloudflare / Docker)
                                            │
                                            ▼
                                   [ FastAPI Backend ] (Render / Railway / AWS ECS / Fly.io)
                                            │
                  ┌─────────────────────────┼─────────────────────────┐
                  ▼                         ▼                         ▼
         [ PostgreSQL + pgvector ]   [ Cloud Object Storage ]   [ OpenAI API ]
           (Supabase / Neon)          (AWS S3 / Cloudflare R2)
```

---

## 2. Infrastructure Setup (Free/Managed Cloud Tiers Available)

### Step 1: Managed Database (PostgreSQL with `pgvector`)
You can use **Supabase** (Free), **Neon**, or **AWS RDS**:
1. Create a project on [Supabase](https://supabase.com) or [Neon](https://neon.tech).
2. Run the SQL query to enable `pgvector`:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Copy your connection URI (e.g. `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`).

### Step 2: Cloud Object Storage (AWS S3 or Cloudflare R2)
1. **Cloudflare R2** (Zero egress fees) or **AWS S3**:
   - Create bucket: `documind-production-docs`
   - Create API Access Key & Secret Key.
   - Note the region and endpoint URL.

---

## 3. Backend Deployment (e.g., Render, Railway, or Fly.io)

### Deploying via Docker (Render / Railway / GCP Cloud Run):
1. Connect your GitHub repository: `https://github.com/param7862989-ops/documind.git`
2. Set Root Directory: `backend`
3. Select Environment: `Docker` (Dockerfile is located at `backend/Dockerfile`)
4. Configure Environment Variables:
   ```env
   ENVIRONMENT=production
   DATABASE_URL=postgresql://user:password@db-host:5432/documind
   SECRET_KEY=generate_a_strong_random_jwt_secret_32_characters_long
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-4o-mini
   EMBEDDING_MODEL=text-embedding-3-small
   STORAGE_PROVIDER=s3
   S3_BUCKET_NAME=documind-production-docs
   S3_REGION=us-east-1
   S3_ACCESS_KEY=your_access_key
   S3_SECRET_KEY=your_secret_key
   S3_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
   BACKEND_CORS_ORIGINS=["https://documind.yourdomain.com","https://documind-frontend.vercel.app"]
   ```
5. Deploy. Note your live backend URL (e.g., `https://documind-api.onrender.com`).

---

## 4. Frontend Deployment (e.g., Vercel)

1. Import your GitHub repository to [Vercel](https://vercel.com).
2. Set Root Directory to: `frontend`
3. Framework Preset: `Next.js`
4. Set Environment Variable:
   ```env
   NEXT_PUBLIC_API_URL=https://documind-api.onrender.com/api/v1
   ```
5. Click **Deploy**.

---

## 5. Automated Database Migrations

When running migrations on production database:
```bash
cd backend
alembic upgrade head
```
*(The backend also runs automatic table creation and vector validation on startup via lifespan handler).*

---

## 6. Verification Checklist

- [ ] Backend health check responds: `GET https://<backend-url>/api/v1/health`
- [ ] Swagger API docs available: `GET https://<backend-url>/api/v1/docs`
- [ ] User registration and JWT login generate valid tokens
- [ ] PDF, DOCX, TXT upload successfully saves to S3/R2 storage
- [ ] Background vector indexing processes document to `READY` status
- [ ] Grounded RAG query returns answers with page-level citations
- [ ] Multi-document comparison returns side-by-side matrices

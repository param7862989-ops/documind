# DocuMind - Production Cloud Deployment Guide

This guide provides exact, step-by-step instructions for deploying the **DocuMind** application completely independently of any local computer, development machine, or IDE.

---

## Production Architecture Overview

```text
[ Global Users / Browsers ]
            │ HTTPS
            ▼
┌────────────────────────────────────────────────────────┐
│     Cloud Frontend: Next.js 14 Standalone / Vercel     │
│        (Configured via NEXT_PUBLIC_API_URL)            │
└───────────────────────────┬────────────────────────────┘
                            │ REST API + Bearer JWT
                            ▼
┌────────────────────────────────────────────────────────┐
│     Cloud Backend: FastAPI Container (Render / ECS)    │
│  - Structured JSON Logging & Request ID Tracing        │
│  - Sliding Window Rate Limiting & AI Quota Protection  │
│  - Ingestion Pipeline & Prompt-Injection Defenses      │
└─────────────┬───────────────────────────┬──────────────┘
              │                           │
              ▼                           ▼
┌───────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐
│   Managed PostgreSQL 16   │ │   Cloud Object Storage   │ │   Google Gemini AI API   │
│      with pgvector        │ │ (AWS S3 / Cloudflare R2) │ │ (gemini-2.5-flash /      │
│   (Supabase / Neon / RDS) │ │  - Zero Local Disk Dep   │ │  gemini-embedding-2     │
│  - 1536-dim HNSW indexing │ │  - Persistent Storage    │ │  1536-dim dense vectors) │
└───────────────────────────┘ └──────────────────────────┘ └──────────────────────────┘
```

---

## 16-Step Production Deployment Walkthrough

### Step 1: Create Managed PostgreSQL Database
Deploy a managed PostgreSQL 16 instance using **Supabase**, **Neon**, **AWS RDS**, or **DigitalOcean Managed Databases**:
- Database Name: `documind`
- Note the connection URI: `postgresql://<user>:<password>@<db-host>:5432/<dbname>`

### Step 2: Enable pgvector Extension
In your database console (or SQL editor), execute:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Step 3: Configure Backend Environment Variables
Set the following environment variables in your cloud backend service (Render, Railway, Fly.io, AWS ECS, Google Cloud Run):

| Variable | Required | Description | Example |
| :--- | :---: | :--- | :--- |
| `ENVIRONMENT` | Yes | App runtime mode | `production` |
| `PROJECT_NAME` | No | Display name | `DocuMind AI` |
| `DATABASE_URL` | Yes | Managed PostgreSQL connection URI | `postgresql://user:pass@host:5432/documind` |
| `SECRET_KEY` | Yes | 32+ character random JWT secret | *(Generate with `openssl rand -hex 32`)* |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Session token lifetime | `1440` (24 hours) |
| `BACKEND_CORS_ORIGINS` | Yes | Allowed frontend domain(s) | `https://documind.vercel.app` |
| `STORAGE_PROVIDER` | Yes | Storage engine (`s3` recommended) | `s3` |
| `S3_BUCKET_NAME` | If s3 | Bucket identifier | `documind-production-documents` |
| `S3_REGION` | If s3 | AWS/R2 Region | `us-east-1` |
| `S3_ACCESS_KEY` | If s3 | IAM / R2 Access Key | `AKIA...` |
| `S3_SECRET_KEY` | If s3 | IAM / R2 Secret Key | `...` |
| `S3_ENDPOINT_URL` | Optional | Custom S3 URL (for Cloudflare R2) | `https://<account_id>.r2.cloudflarestorage.com` |
| `AI_PROVIDER` | Yes | Primary AI provider | `gemini` |
| `GEMINI_API_KEY` | Yes | Google Gemini API Key | `AIza...` |
| `GEMINI_MODEL` | No | Gemini text model | `gemini-2.5-flash` |
| `GEMINI_EMBEDDING_MODEL` | No | Gemini embedding model | `gemini-embedding-2` |
| `EMBEDDING_PROVIDER` | No | Embedding provider | `gemini` |
| `EMBEDDING_MODEL` | No | Active embedding model | `gemini-embedding-2` |
| `EMBEDDING_DIMENSION` | No | Vector dimension (pgvector schema) | `1536` |
| `AI_QUOTA_PER_USER_DAILY`| No | Max AI queries/user/day | `200` |
| `RATE_LIMITING_ENABLED` | No | Enable sliding window limits | `true` |

*(Optional Alternative: To use OpenAI instead of Google Gemini, set `AI_PROVIDER=openai`, `EMBEDDING_PROVIDER=openai`, `OPENAI_API_KEY=sk-...`, `OPENAI_MODEL=gpt-4o-mini`, and `EMBEDDING_MODEL=text-embedding-3-small`).*

### Step 4: Configure Cloud Object Storage (Cloudflare R2 or AWS S3)
1. Create a private bucket in **AWS S3** or **Cloudflare R2** (e.g. `documind-production-documents`).
2. Set bucket permissions to private with standard server-side encryption (SSE-S3).
3. Generate dedicated IAM credentials with scoped `PutObject`, `GetObject`, `DeleteObject` permissions on `uploads/*`.

### Step 5: Configure Google Gemini API (Primary Provider)
1. Obtain an API key from [Google AI Studio](https://aistudio.google.com/).
2. Confirm the account has access to Gemini generation (`gemini-2.5-flash`) and dense embeddings (`gemini-embedding-2` with 1536-dimensional vectors).
3. Set `GEMINI_API_KEY` in your backend cloud environment.

### Step 6: Deploy Backend Container (Render / ECS / Cloud Run)
1. Connect your GitHub repository: `https://github.com/param7862989-ops/documind.git`
2. Build target: `backend/Dockerfile` (Multi-stage Python 3.11-slim with `poppler-utils` and `tesseract-ocr`).
3. Port: `8000`.
4. Deploy the service and note the live URL: `https://api.yourdomain.com` (or `https://documind-backend.onrender.com`).

### Step 7: Run Database Migrations
Run Alembic migrations against the production database:
```bash
alembic upgrade head
```
*(The backend lifespan also automatically verifies table schema and the HNSW pgvector 1536-dimensional index on startup).*

### Step 8: Configure Frontend API URL
In your frontend hosting platform (Vercel / Cloudflare Pages / Netlify):
```env
NEXT_PUBLIC_API_URL=https://documind-backend.onrender.com/api/v1
```

### Step 9: Deploy Frontend on Vercel
1. Connect your GitHub repository to Vercel.
2. Root Directory: `frontend`
3. Framework Preset: `Next.js`
4. Build Command: `npm run build`
5. Deploy and note the live frontend URL: `https://documind.vercel.app`.

### Step 10: Configure Backend CORS
Ensure the live frontend domain from Step 9 is configured in `BACKEND_CORS_ORIGINS` in your backend service:
```env
BACKEND_CORS_ORIGINS=https://documind.vercel.app
```

### Step 11: Verify Health Endpoints
- **Liveness Probe**: `GET https://documind-backend.onrender.com/health` -> `{"status": "healthy", "service": "DocuMind API", "version": "1.0.0"}`
- **Readiness Probe**: `GET https://documind-backend.onrender.com/health/ready` -> `{"status": "ready", "database": "connected"}`

### Step 12: Verify User Registration and Login
1. Open `https://documind.vercel.app/register` and create an account.
2. Login at `https://documind.vercel.app/login` and verify redirection to `/dashboard`.
3. Check browser developer tools to verify JWT token storage and authenticated header propagation.

### Step 13: Verify Document Upload
1. In the dashboard, drag-and-drop or upload a PDF, DOCX, TXT, or Image file.
2. Verify that magic-byte validation passes and the file is uploaded to cloud object storage.

### Step 14: Verify Document Ingestion Lifecycle
1. Observe the document status transition: `UPLOADING` ➔ `PROCESSING` ➔ `READY`.
2. Inspect document metadata, page count, and chunk count in the UI.

### Step 15: Verify Grounded RAG & Citations
1. Ask a specific factual question about the uploaded document in the chat interface.
2. Verify Google Gemini generates a strictly grounded answer with inline citations `[Document Name, Page X]`.
3. Click a citation badge to open the citation modal and inspect the verbatim excerpt.

### Step 16: Verify Multi-Document Comparison & Cross-Tenant Security
1. Upload a second document.
2. Select both documents and submit a comparison query.
3. Verify the formatted Markdown comparison matrix renders.
4. Log out, create a separate user account, and confirm that the second user cannot see or query the first user's documents.

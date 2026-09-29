# DocuMind - Production Cloud Deployment Guide

This guide provides exact, step-by-step instructions for deploying the **DocuMind** application completely independently of any local computer, development machine, or IDE.

---

## Architecture Overview

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
│   Managed PostgreSQL 16   │ │   Cloud Object Storage   │ │   External LLM API       │
│      with pgvector        │ │ (AWS S3 / Cloudflare R2) │ │ (OpenAI GPT-4o / Embed)  │
│   (Supabase / Neon / RDS) │ │  - Zero Local Disk Dep   │ │  - Measured Latency/Tok  │
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
| `PROJECT_NAME` | No | Display name | `DocuMind API` |
| `DATABASE_URL` | Yes | PostgreSQL connection URI | `postgresql://user:pass@host:5432/documind` |
| `SECRET_KEY` | Yes | 32+ character random JWT secret | *(Generate with `openssl rand -hex 32`)* |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Session token lifetime | `1440` (24 hours) |
| `BACKEND_CORS_ORIGINS` | Yes | Allowed frontend domain(s) | `https://documind.yourdomain.com` |
| `STORAGE_PROVIDER` | Yes | Storage engine (`s3` or `local`) | `s3` |
| `S3_BUCKET_NAME` | If s3 | Bucket identifier | `documind-production-docs` |
| `S3_REGION` | If s3 | AWS/R2 Region | `us-east-1` |
| `S3_ACCESS_KEY` | If s3 | IAM / R2 Access Key | `AKIA...` |
| `S3_SECRET_KEY` | If s3 | IAM / R2 Secret Key | `...` |
| `S3_ENDPOINT_URL` | Optional | Custom S3 URL (for R2/MinIO) | `https://<account_id>.r2.cloudflarestorage.com` |
| `AI_PROVIDER` | No | AI provider (`gemini` or `openai`) | `gemini` |
| `GEMINI_API_KEY` | If gemini | Google Gemini API Key | `AIza...` |
| `GEMINI_MODEL` | No | Gemini text model | `gemini-2.5-flash` |
| `GEMINI_EMBEDDING_MODEL` | No | Gemini embedding model | `gemini-embedding-2` |
| `OPENAI_API_KEY` | If openai | OpenAI API Key | `sk-proj-...` |
| `OPENAI_MODEL` | No | Chat completion model | `gpt-4o-mini` |
| `EMBEDDING_PROVIDER` | No | Embedding provider (`gemini`/`openai`)| `gemini` |
| `EMBEDDING_DIMENSION` | No | Embedding vector dimension | `1536` |
| `AI_QUOTA_PER_USER_DAILY`| No | Max AI queries/user/day | `200` |
| `RATE_LIMITING_ENABLED` | No | Enable sliding window limits | `true` |

### Step 4: Configure Cloud Object Storage
1. Create a private bucket in **AWS S3** or **Cloudflare R2** (e.g. `documind-production-docs`).
2. Set bucket permissions to private with standard server-side encryption (SSE-S3).
3. Generate dedicated IAM credentials with scoped `PutObject`, `GetObject`, `DeleteObject` permissions on `uploads/*`.

### Step 5: Configure LLM & Embedding API
1. Obtain an API key from OpenAI.
2. Confirm the account has sufficient credit quota for `gpt-4o-mini` and `text-embedding-3-small`.

### Step 6: Deploy Backend Container
1. Connect your GitHub repository: `https://github.com/param7862989-ops/documind.git`
2. Build target: `backend/Dockerfile` (Multi-stage Python 3.11-slim with `poppler-utils` and `tesseract-ocr`).
3. Port: `8000`.
4. Deploy the service and note the live URL: `https://api.yourdomain.com` (or `https://documind-backend.onrender.com`).

### Step 7: Run Database Migrations
Run Alembic migrations against the production database:
```bash
alembic upgrade head
```
*(The backend lifespan also auto-verifies tables and the HNSW pgvector index on startup).*

### Step 8: Configure Frontend API URL
In your frontend hosting platform (Vercel / Cloudflare Pages / Netlify / Docker):
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
```

### Step 9: Deploy Frontend Container / App
1. Connect your GitHub repository.
2. Root Directory: `frontend`
3. Framework Preset: `Next.js`
4. Build Command: `npm run build` (or run container built from `frontend/Dockerfile`).
5. Deploy and note the live frontend URL: `https://documind.yourdomain.com`.

### Step 10: Configure Backend CORS
Ensure the frontend domain from Step 9 is included in `BACKEND_CORS_ORIGINS` in your backend configuration:
```env
BACKEND_CORS_ORIGINS=https://documind.yourdomain.com
```

### Step 11: Verify Health Endpoints
- **Liveness Probe**: `GET https://api.yourdomain.com/health` -> `{"status": "healthy", "service": "DocuMind API", "version": "1.0.0"}`
- **Readiness Probe**: `GET https://api.yourdomain.com/health/ready` -> `{"status": "ready", "database": "connected"}`

### Step 12: Verify User Registration and Login
1. Open `https://documind.yourdomain.com/register` and create an account.
2. Login at `https://documind.yourdomain.com/login` and verify redirection to `/dashboard`.
3. Check browser developer tools to verify JWT token storage and authenticated header propagation.

### Step 13: Verify Document Upload
1. In the dashboard, drag-and-drop or upload a PDF, DOCX, TXT, or Image file.
2. Verify that magic-byte validation passes and the file is uploaded to cloud object storage.

### Step 14: Verify Document Processing Lifecycle
1. Observe the document status transition: `UPLOADING` ➔ `PROCESSING` ➔ `READY`.
2. Inspect document metadata, page count, and chunk count.

### Step 15: Verify Grounded RAG & Citations
1. Ask a specific factual question about the document in the chat interface.
2. Verify the AI generates a strictly grounded answer with inline citations `[Document Name, Page X]`.
3. Click a citation badge to open the citation modal and inspect the verbatim excerpt.

### Step 16: Verify Multi-Document Comparison & Cross-Tenant Security
1. Upload a second document.
2. Select both documents and submit a comparison query.
3. Verify the formatted Markdown comparison matrix renders.
4. Log out, create a separate user account, and confirm that the second user cannot see or query the first user's documents.

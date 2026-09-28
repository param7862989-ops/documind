# DocuMind - Production-Grade AI Document Intelligence Platform

DocuMind is an enterprise-ready, independently deployable AI Document Intelligence SaaS application designed to ingest, process, index, and query multi-format documents (`PDF`, `DOCX`, `TXT`, and scanned images with OCR) using PostgreSQL + pgvector, hybrid semantic retrieval, strict citation grounding, and conversational memory.

---

## System Architecture

```text
                                  [ User Browser ]
                                         │ HTTPS
                                         ▼
                     ┌───────────────────────────────────────┐
                     │          Next.js Frontend UI          │
                     │  (Next.js 14, TypeScript, Tailwind)   │
                     └───────────────────┬───────────────────┘
                                         │ REST API + Bearer JWT
                                         ▼
                     ┌───────────────────────────────────────┐
                     │            FastAPI Backend            │
                     │  - Structured JSON Logging & Tracing  │
                     │  - Sliding Window Rate Limiting       │
                     │  - Ingestion & OCR Processing Pipeline│
                     │  - Prompt-Injection Defenses          │
                     └───────┬───────────────────────┬───────┘
                             │                       │
              ┌──────────────┴──────────┐     ┌──────┴────────────────┐
              ▼                         ▼     ▼                       ▼
     ┌─────────────────┐       ┌─────────────────┐   ┌─────────────────┐
     │ PostgreSQL 16   │       │ Cloud Object    │   │ External LLM /  │
     │ + pgvector      │       │ Storage         │   │ Embeddings API  │
     │ (HNSW Indexing) │       │ (S3 / R2/ MinIO)│   │ (OpenAI GPT-4o) │
     └─────────────────┘       └─────────────────┘   └─────────────────┘
```

---

## Core Features & Capabilities

1. **Multi-Format Ingestion Pipeline**:
   - **PDFs**: Structured text and page extraction via `pypdf` / `pdfplumber`.
   - **Scanned PDFs & Images**: Optical Character Recognition (OCR) via `pytesseract` and `Pillow`.
   - **Word Documents (`.docx`)**: Heading, paragraph, and table extraction with section tracking.
   - **Plain Text (`.txt`)**: Clean UTF-8 streaming ingestion.
   - **File Validation**: Content-type magic-byte inspection, file size limits (50 MB default), and SHA-256 deduplication.

2. **Retrieval-Augmented Generation (RAG) & Grounding**:
   - PostgreSQL `pgvector` HNSW cosine similarity vector index.
   - Hybrid lexical + semantic ranking with configurable similarity thresholding.
   - Prompt injection sanitization: isolates document excerpts between strict untrusted boundary tags.
   - Inline page and section citations: `[Document Title, Page X]`.
   - Deterministic refusal when source evidence is missing or insufficient.

3. **Multi-Document Comparison**:
   - Independent retrieval per document ensuring balanced cross-document representation.
   - Structured markdown comparison matrices displaying key provisions, differences, and citations.

4. **Observability, Guardrails & Security**:
   - Structured JSON logging with `X-Request-ID` distributed tracing.
   - Sliding-window in-memory rate limiting and daily AI usage quota protection.
   - Per-user document ownership and tenant isolation.
   - Strong password validation and bcrypt hashing.
   - Full CORS and HTTP security headers (`nosniff`, `DENY` clickjacking, strict referrer).

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons, Vitest |
| **Backend** | Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic, Uvicorn |
| **Database** | PostgreSQL 16 with `pgvector` (HNSW indexing) / SQLite for local offline testing |
| **Storage** | S3-Compatible Cloud Object Storage (AWS S3, Cloudflare R2, MinIO, Local Disk) |
| **AI / NLP** | OpenAI GPT-4o-mini, `text-embedding-3-small` (with local dense semantic fallback) |
| **OCR & Parsing**| `pypdf`, `pdfplumber`, `python-docx`, `pytesseract`, `Pillow` |
| **DevOps & CI** | Multi-stage Dockerfiles, Docker Compose, GitHub Actions CI/CD |

---

## Environment Variables Reference

### Backend Configuration (`backend/.env`):
```env
# Application
ENVIRONMENT=development                # "development" or "production"
PROJECT_NAME="DocuMind API"
VERSION=1.0.0
API_V1_STR=/api/v1
LOG_LEVEL=INFO

# Security (Requires 32+ characters in production)
SECRET_KEY=documind_local_development_jwt_secret_key_987654321
ACCESS_TOKEN_EXPIRE_MINUTES=1440
RATE_LIMITING_ENABLED=true
BACKEND_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Database
DATABASE_URL=sqlite:///./documind.db   # Or postgresql://user:pass@localhost:5432/documind

# Storage ("local" or "s3")
STORAGE_PROVIDER=local
LOCAL_STORAGE_DIR=./storage/uploads
MAX_FILE_SIZE_MB=50

# S3 Storage (When STORAGE_PROVIDER=s3)
S3_BUCKET_NAME=documind-documents
S3_REGION=us-east-1
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_ENDPOINT_URL=

# AI & LLM Provider
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSION=1536
AI_QUOTA_PER_USER_DAILY=200
```

### Frontend Configuration (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

---

## Local Development Quickstart

### Prerequisites
- Node.js 18+ (Node 20 recommended)
- Python 3.11+
- Tesseract OCR & Poppler (for image/scanned document processing)

### 1. Run with Docker Compose
```bash
docker-compose up --build
```
- Frontend UI: `http://localhost:3000`
- Backend REST API: `http://localhost:8000`
- Interactive Swagger Docs: `http://localhost:8000/api/v1/docs`

### 2. Run Manually

**Backend**:
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

**Frontend**:
```bash
cd frontend
npm install
npm run dev
```

---

## Testing & Quality Assurance

### Backend Automated Tests
```bash
cd backend
pytest tests/ -v
```
- **36 passing tests** verifying:
  - Authentication, Registration, and JWT Security
  - Document Upload, Magic-Byte Validation, and Ingestion Lifecycle
  - OCR Image and Scanned Document Processing
  - Conversational RAG with Memory Ordering
  - pgvector HNSW Vector Retrieval and Grounding
  - Multi-Document Comparison Matrix Generation
  - Prompt-Injection Defenses and System Prompt Leak Prevention
  - Cross-Tenant Document and Conversation Isolation
  - S3 Cloud Storage Abstraction and Alembic Database Migrations
  - Liveness & Readiness Probes (`/health`, `/health/ready`)
  - Request ID Tracing Middleware and AI Quota Guardrails

### Frontend Automated Tests & Build
```bash
cd frontend
npm test           # Runs Vitest unit & component test suite (10/10 passed)
npm run lint       # Runs ESLint checks (0 warnings/errors)
npx tsc --noEmit   # Runs TypeScript strict typecheck (0 errors)
npm run build      # Produces standalone production Next.js build
```

---

## Cloud Deployment

DocuMind is fully decoupled and ready for cloud deployment:
1. **Frontend**: Deploy to Vercel, Cloudflare Pages, or Docker container.
2. **Backend**: Deploy to Render, Railway, Fly.io, AWS ECS, or Google Cloud Run.
3. **Database**: Managed PostgreSQL with `pgvector` on Supabase, Neon, or AWS RDS.
4. **Storage**: AWS S3, Cloudflare R2, or MinIO.

For detailed step-by-step instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

---

## Known Limitations & Future Improvements

- **Async Task Queue**: For massive document volumes (>500 pages per document), background workers can be decoupled using Celery or AWS SQS + Redis instead of FastAPI background tasks.
- **Reranker Engine**: Support for cross-encoder rerankers (e.g. `Cohere Rerank` or `bge-reranker-large`) in addition to hybrid BM25 + dense vector ranking.
- **SSO / OAuth2**: Google and Microsoft SAML/OAuth2 login integration alongside email/password JWT authentication.

---

## License
MIT

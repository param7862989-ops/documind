# DocuMind - Production-Grade AI Document Intelligence Platform

DocuMind is a high-performance, deployable, full-stack AI Document Intelligence SaaS platform designed to ingest, process, index, and query complex multi-format documents (PDFs, Word documents, Plain text, and Images/Scanned files with OCR) using state-of-the-art Retrieval-Augmented Generation (RAG) and conversational memory.

---

## Architecture Overview

```text
                                 [ User / Browser ]
                                         │
                                         ▼
                     ┌───────────────────────────────────────┐
                     │          Next.js Frontend UI          │
                     │  (React 18/19, TypeScript, Tailwind)  │
                     └───────────────────┬───────────────────┘
                                         │ REST API / Auth
                                         ▼
                     ┌───────────────────────────────────────┐
                     │            FastAPI Backend            │
                     │ (Async, Pydantic v2, JWT, Pipelines)  │
                     └───────┬───────────────────────┬───────┘
                             │                       │
              ┌──────────────┴──────────┐     ┌──────┴────────────────┐
              ▼                         ▼     ▼                       ▼
     ┌─────────────────┐       ┌─────────────────┐   ┌─────────────────┐
     │ PostgreSQL 16   │       │ Cloud / S3      │   │ External LLM /  │
     │ + pgvector      │       │ Object Storage  │   │ Embeddings API  │
     │ (Vectors, Meta) │       │ (MinIO, R2, S3) │   │ (OpenAI, etc.)  │
     └─────────────────┘       └─────────────────┘   └─────────────────┘
```

---

## Technology Stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, Lucide React, Modern UI components.
- **Backend**: Python 3.11+, FastAPI, Pydantic Settings, SQLAlchemy / AsyncPG.
- **AI & RAG**: Vector similarity search with `pgvector`, OpenAI GPT-4o / GPT-4o-mini, `text-embedding-3-small`, hybrid chunking & metadata attribution.
- **Document Processing**: `pypdf`, `pdfplumber`, `python-docx`, `pytesseract` OCR, and `Pillow`.
- **Database & Storage**: PostgreSQL 16 with `pgvector`, S3-compatible cloud object storage abstraction (AWS S3 / Cloudflare R2 / MinIO / Local storage for dev).
- **DevOps & Containerization**: Multi-stage Dockerfiles and Docker Compose for 100% reproducible local and cloud deployment.

---

## Core Capabilities

1. **Multi-Format Ingestion**: Supports `.pdf`, `.docx`, `.txt`, `.png`, `.jpg`, `.jpeg` with OCR for scanned documents.
2. **Grounded RAG with Exact Citations**: Every claim is cited with source document name, page number, and relevant excerpt snippets.
3. **Multi-Document Comparison**: Compare clauses, obligations, renewal terms, or pricing across multiple uploaded contracts simultaneously.
4. **Conversational Memory**: Stateful multi-turn chat per document or across document collections.
5. **Role-Based Per-User Isolation**: User-level document ownership and tenant security with JWT authentication.
6. **Async Background Processing**: Non-blocking document ingestion pipeline with real-time status tracking (`UPLOADING` -> `PROCESSING` -> `READY` / `FAILED`).

---

## Getting Started Locally

### Prerequisites

- Node.js 18+ (Node 20+ recommended)
- Python 3.11+
- Docker & Docker Compose (optional, for containerized run)

### 1. Clone & Environment Configuration

```bash
cp .env.example .env
```

Set your `OPENAI_API_KEY` and other credentials in `.env`.

### 2. Run with Docker Compose (Recommended)

```bash
docker-compose up --build
```

- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000`
- **Swagger Docs**: `http://localhost:8000/api/v1/docs`

### 3. Run Manually

#### Backend:
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Unix/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### Frontend:
```bash
cd frontend
npm install
npm run dev
```

---

## License
MIT

# RAGtfm-FE

React + Vite frontend for the RAGtfm multimodal RAG pipeline. Allows users to register, login, upload PDF documents, and ask questions against them using the RAGtfm-BE backend.

## Stack

- React 19 with TypeScript
- Vite 8 for development and bundling
- Vanilla CSS
- Nginx for production static file serving and API proxying

## Architecture

```text
Browser -> Nginx (port 3000) -> ragtfm-api:8000 (backend)
```

In development, the Vite dev server proxies API calls to `localhost:8000`. In production (Docker), Nginx serves the built static files and proxies API routes to the backend container.

## Reference Dev System

```text
CPU : Intel Core i9 14900K 24C/32T
RAM : 64GB
GPU : Nvidia Geforce RTX 4090 24GB
```

## Available Features

### Health Checks
- [x] Notify users of downed service by blocking usage

### Auth
- [x] Login and register with email and password
- [x] JWT token persisted in localStorage
- [x] Logout

### Documents
- [x] Upload PDF documents
- [x] List all uploaded documents with status, chunk count, and file size
- [x] Delete documents
- [x] Refresh document list
- [x] Per-user document scoping (each user only sees their own documents)

### RAG Query
- [x] Ask questions against uploaded documents
- [x] Optional document selection — restrict the query to specific documents via checkboxes
- [x] Configurable source limit (1–20)
- [x] Answer display with source chunks
- [x] Retrieval performance metrics display (dense, BM25, RRF, rerank, total timings)

### UX
- [x] Toast notifications for success and error states
- [x] Loading states on all async actions
- [x] Workspace summary tile (total documents, ready documents, total chunks)
- [x] Auto-refresh for document ingestion status
- [x] Pagination for large document lists

## Project Structure

```text
src/
├── api.ts        # All API call functions and TypeScript types
├── App.tsx       # Main application component and all UI
├── App.css       # Component styles
├── index.css     # Global styles and CSS variables
└── main.tsx      # React entry point
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `` (empty) | Base URL for API calls. Leave empty to use relative URLs with the Nginx or Vite proxy. |

## Run Locally (Dev)

Requires the RAGtfm-BE backend running at `http://localhost:8000`.

```bash
npm install
npm run dev
```

The Vite dev server proxies the following paths to `http://localhost:8000`:

```text
/auth       -> http://localhost:8000
/documents  -> http://localhost:8000
/ingest     -> http://localhost:8000
/rag        -> http://localhost:8000
/retrieve   -> http://localhost:8000
```

## Run With Docker

Requires the RAGtfm-BE stack to be running first (so the shared Docker network exists).

```bash
# Start the backend first (from RAGtfm-BE)
docker compose up -d

# Then build and start the frontend (from RAGtfm-FE)
docker compose up -d --build
```

Frontend will be available at:

```text
http://localhost:3000
```

### Rebuild after code changes

```bash
docker compose up -d --build frontend
```

## Docker Overview

The Docker setup uses a two-stage build:

1. **Builder stage** — Node 22 installs dependencies and runs `npm run build` (TypeScript compile + Vite bundle)
2. **Serve stage** — Nginx serves the `dist/` output and proxies API routes to the backend container

Nginx proxies the same API paths as the Vite dev server, routing them to `ragtfm-api:8000` on the shared Docker network (`ragtfm-be_default`).

## API Reference

All API calls are defined in [`src/api.ts`](src/api.ts). The frontend communicates with the following backend endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/register` | Register a new user |
| `POST` | `/auth/login` | Login and receive a JWT token |
| `POST` | `/auth/logout` | Logout |
| `GET` | `/documents` | List documents for the current user |
| `DELETE` | `/documents/{id}` | Delete a document |
| `POST` | `/ingest/pdf` | Upload a PDF for processing |
| `POST` | `/rag/query` | Ask a question and get a grounded answer |
| `GET` | `/health/ready` | Check if the API can serve traffic |

## Current Limitations
- [ ] No markdown rendering for generated answers
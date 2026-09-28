# Security Policy

## Reporting Security Vulnerabilities

We take the security of DocuMind seriously. If you discover a vulnerability or security issue, please responsibly disclose it to our security team.

### How to Report

- **Email**: Report vulnerabilities by emailing `security@documind.ai`.
- **Details to Include**:
  - Description and potential impact of the vulnerability.
  - Step-by-step reproduction instructions or a proof-of-concept (PoC).
  - Component(s) affected (e.g., API router, file ingestion, storage abstraction, RAG retrieval).
- **Response Target**:
  - We acknowledge receipt of security reports within **48 hours**.
  - We provide regular status updates during triage and patch development.

Please do **NOT** file public GitHub issues for security vulnerabilities.

---

## Security Architecture & Defenses

DocuMind implements defense-in-depth security principles across the entire document processing and RAG pipeline:

### 1. Multi-Tenant Data Isolation & Ownership
- All document access, metadata lookups, vector embeddings, chunks, and conversation histories are strictly filtered by authenticated `user_id`.
- Foreign document access or conversation tampering attempts immediately result in `404 Not Found` or `403 Forbidden` errors.

### 2. Ingestion & File Validation
- File uploads are validated using streaming length checks (`MAX_FILE_SIZE_MB`), extension whitelists, and binary header/magic byte inspections (`verify_magic_bytes`).
- Executable binary signatures (e.g., Windows PE `MZ`, ELF, Mach-O) are unconditionally rejected.
- Uploaded files are treated strictly as untrusted static binary data; no file is ever executed or evaluated.

### 3. Storage Security
- Files are saved with sanitized UUID keys and isolated subdirectories (`uploads/{user_id}/{doc_id}/...`).
- Path traversal (`../`) checks are enforced on local storage paths to ensure files cannot escape the configured storage boundary.

### 4. RAG & Prompt Injection Protection
- Untrusted document text is enclosed within strict structured XML data boundaries (`[DOCUMENT DATA START]...[DOCUMENT DATA END]`).
- Adversarial override directives (such as instructions to reveal system prompts or ignore previous constraints) are sanitized before prompt synthesis.
- Native database vector queries utilize parameterized SQL statements to eliminate SQL injection risks.

### 5. Authentication & Secrets
- Passwords are encrypted using salted bcrypt hashing with complexity enforcement (minimum 8 characters with alphanumeric diversity).
- JSON Web Tokens (JWT) are signed using HS256 with expiration enforcement. In production environments, weak or default secret keys trigger immediate startup validation errors.
- Rate limiting is enforced on authentication, document upload, and AI query endpoints.

---

## Supported Versions

| Version | Supported |
| :--- | :--- |
| 1.0.x | :white_check_mark: |

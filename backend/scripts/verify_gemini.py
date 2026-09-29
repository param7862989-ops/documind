#!/usr/bin/env python3
"""
DocuMind - Google Gemini Integration Verification Script
Tests Gemini LLM generation and 1536-dimensional Gemini embedding output using official google-genai SDK.
Usage:
    python scripts/verify_gemini.py
or:
    GEMINI_API_KEY="your-key" python scripts/verify_gemini.py
"""

import os
import sys
import time

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.services.llm import GeminiLLMProvider
from app.services.embeddings import GeminiEmbeddingProvider


def mask_key(key: str) -> str:
    if not key or len(key) < 8:
        return "[NOT CONFIGURED]"
    return f"{key[:4]}...{key[-4:]}"


def main():
    print("=" * 65)
    print("  DocuMind - Google Gemini AI Provider Verification Tool")
    print("=" * 65)

    api_key = os.environ.get("GEMINI_API_KEY") or settings.GEMINI_API_KEY
    model = os.environ.get("GEMINI_MODEL") or settings.GEMINI_MODEL or "gemini-2.5-flash"
    emb_model = os.environ.get("GEMINI_EMBEDDING_MODEL") or settings.GEMINI_EMBEDDING_MODEL or "gemini-embedding-2"
    expected_dim = settings.EMBEDDING_DIMENSION or 1536

    print(f"\n[1] Configuration Check:")
    print(f"    - GEMINI_API_KEY:          {mask_key(api_key)}")
    print(f"    - GEMINI_MODEL:            {model}")
    print(f"    - GEMINI_EMBEDDING_MODEL:  {emb_model}")
    print(f"    - Expected Dimension:      {expected_dim}")

    if not api_key or len(api_key.strip()) < 5:
        print("\n[!] WARNING: GEMINI_API_KEY is not set.")
        print("    To run live manual tests, provide your key via:")
        print("    export GEMINI_API_KEY=\"AIza...\" (Linux/macOS) or $env:GEMINI_API_KEY=\"AIza...\" (PowerShell)")
        print("    or define GEMINI_API_KEY in backend/.env")
        sys.exit(1)

    # 2. Test Gemini Embeddings (1536 dimensions)
    print(f"\n[2] Testing Gemini Embeddings ({emb_model})...")
    try:
        emb_provider = GeminiEmbeddingProvider(
            api_key=api_key,
            model=emb_model,
            dimension=expected_dim,
        )

        test_sentences = [
            "DocuMind provides enterprise document intelligence and semantic search.",
            "PostgreSQL with pgvector performs vector cosine similarity lookups.",
        ]

        t0 = time.perf_counter()
        vectors = emb_provider.get_embeddings(test_sentences)
        t1 = time.perf_counter()

        assert len(vectors) == 2, f"Expected 2 embeddings, got {len(vectors)}"
        for idx, vec in enumerate(vectors):
            assert len(vec) == expected_dim, f"Vector {idx} length {len(vec)} != expected {expected_dim}"
            assert isinstance(vec[0], float), "Vector items must be floats"

        q_vec = emb_provider.get_embeddings(["How does hybrid RAG work?"])[0]
        assert len(q_vec) == expected_dim, f"Query vector length {len(q_vec)} != expected {expected_dim}"

        print(f"    [PASS] Successfully generated 2 chunk vectors + 1 query vector")
        print(f"    [PASS] Output Vector Dimension: {len(vectors[0])} (Matches pgvector schema: Vector(1536))")
        print(f"    [PASS] Embedding Latency:       {(t1 - t0) * 1000:.1f}ms")

    except Exception as e:
        print(f"    [FAIL] Embedding Test FAILED: {e}")
        sys.exit(1)

    # 3. Test Gemini LLM Text Generation
    print(f"\n[3] Testing Gemini LLM Generation ({model})...")
    try:
        llm_provider = GeminiLLMProvider(
            api_key=api_key,
            model=model,
        )

        system_instruction = "You are DocuMind AI. Provide a concise, one-sentence answer."
        user_prompt = "What is the primary purpose of a vector database in document intelligence?"

        t0 = time.perf_counter()
        res = llm_provider.generate_answer(
            system_prompt=system_instruction,
            user_prompt=user_prompt,
            temperature=0.1,
        )
        t1 = time.perf_counter()

        answer = res["answer"]
        token_count = res.get("token_count", 0)
        latency_ms = res.get("latency_ms", 0.0)

        print(f"    [PASS] Generation Successful")
        print(f"    [INFO] Model Used:          {res.get('model')}")
        print(f"    [INFO] Token Count:         {token_count}")
        print(f"    [INFO] Server Latency:      {latency_ms:.1f}ms")
        print(f"    [INFO] Response Excerpt:    \"{answer.strip()[:120]}...\"")

    except Exception as e:
        print(f"    [FAIL] LLM Generation Test FAILED: {e}")
        sys.exit(1)

    print("\n" + "=" * 65)
    print("  [SUCCESS] ALL GEMINI INTEGRATION TESTS PASSED (1536-dim embeddings & LLM)")
    print("=" * 65)


if __name__ == "__main__":
    main()

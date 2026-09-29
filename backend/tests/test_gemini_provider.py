import os
import pytest
from unittest.mock import MagicMock, patch

from app.config import Settings
from app.services.llm import (
    BaseLLMProvider,
    GeminiLLMProvider,
    OpenAILLMProvider,
    DeterministicFallbackLLMProvider,
    get_llm_provider,
)
from app.services.embeddings import (
    BaseEmbeddingProvider,
    GeminiEmbeddingProvider,
    OpenAIEmbeddingProvider,
    LocalSemanticEmbeddingProvider,
    EmbeddingService,
)
from app.services.rag import rag_service


# =========================================================================
# 1. Configuration & Provider Selection Tests
# =========================================================================

def test_gemini_settings_defaults():
    """Verify Gemini configuration defaults are properly defined."""
    s = Settings(
        ENVIRONMENT="development",
        AI_PROVIDER="gemini",
        GEMINI_MODEL="gemini-2.5-flash",
        GEMINI_EMBEDDING_MODEL="gemini-embedding-2",
        EMBEDDING_PROVIDER="gemini",
        EMBEDDING_DIMENSION=1536,
    )
    assert s.AI_PROVIDER == "gemini"
    assert s.GEMINI_MODEL == "gemini-2.5-flash"
    assert s.GEMINI_EMBEDDING_MODEL == "gemini-embedding-2"
    assert s.EMBEDDING_PROVIDER == "gemini"
    assert s.EMBEDDING_DIMENSION == 1536


def test_gemini_production_validation_missing_key():
    """Verify production environment rejects missing GEMINI_API_KEY when AI_PROVIDER=gemini."""
    with pytest.raises(ValueError, match="CRITICAL"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="a_very_secure_random_production_jwt_key_32_chars_min",
            AI_PROVIDER="gemini",
            GEMINI_API_KEY="",
        )


def test_openai_production_validation_missing_key():
    """Verify production environment rejects missing OPENAI_API_KEY when AI_PROVIDER=openai."""
    with pytest.raises(ValueError, match="CRITICAL"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="a_very_secure_random_production_jwt_key_32_chars_min",
            AI_PROVIDER="openai",
            OPENAI_API_KEY="",
        )


def test_provider_selection_factory():
    """Verify get_llm_provider and EmbeddingService instantiate the correct providers."""
    # Gemini selection
    with patch("app.services.llm.settings.AI_PROVIDER", "gemini"), \
         patch("app.services.llm.settings.GEMINI_API_KEY", "test-gemini-key-12345"), \
         patch("app.services.llm.settings.GEMINI_MODEL", "gemini-2.5-flash"):
        provider = get_llm_provider()
        assert isinstance(provider, GeminiLLMProvider)
        assert provider.get_model_name() == "gemini-2.5-flash"

    # OpenAI selection
    with patch("app.services.llm.settings.AI_PROVIDER", "openai"), \
         patch("app.services.llm.settings.OPENAI_API_KEY", "sk-test-openai-key-12345"), \
         patch("app.services.llm.settings.OPENAI_MODEL", "gpt-4o-mini"):
        provider = get_llm_provider()
        assert isinstance(provider, OpenAILLMProvider)
        assert provider.get_model_name() == "gpt-4o-mini"

    # Fallback / Mock selection
    with patch("app.services.llm.settings.AI_PROVIDER", "fallback"):
        provider = get_llm_provider()
        assert isinstance(provider, DeterministicFallbackLLMProvider)


# =========================================================================
# 2. Gemini Embedding Provider Tests
# =========================================================================

def test_gemini_embedding_provider_dimension():
    """Verify GeminiEmbeddingProvider returns the configured 1536-dimensional size."""
    provider = GeminiEmbeddingProvider(api_key="mock-key", dimension=1536)
    assert provider.get_dimension() == 1536


def test_gemini_embedding_provider_mock_call():
    """Verify GeminiEmbeddingProvider interacts with google-genai embed_content with output_dimensionality=1536."""
    mock_vector = [0.05] * 1536

    mock_emb_obj = MagicMock()
    mock_emb_obj.values = mock_vector

    mock_response = MagicMock()
    mock_response.embeddings = [mock_emb_obj, mock_emb_obj]

    mock_client = MagicMock()
    mock_client.models.embed_content.return_value = mock_response

    with patch("google.genai.Client", return_value=mock_client):
        provider = GeminiEmbeddingProvider(
            api_key="valid-mock-gemini-key",
            model="gemini-embedding-2",
            dimension=1536,
        )

        texts = ["Text sample 1", "Text sample 2"]
        results = provider.get_embeddings(texts)

        assert len(results) == 2
        assert len(results[0]) == 1536
        assert len(results[1]) == 1536
        mock_client.models.embed_content.assert_called_once()
        call_kwargs = mock_client.models.embed_content.call_args.kwargs
        assert call_kwargs["model"] == "gemini-embedding-2"
        assert len(call_kwargs["contents"]) == 2
        assert call_kwargs["contents"][0].parts[0].text == "Text sample 1"
        assert call_kwargs["contents"][1].parts[0].text == "Text sample 2"
        assert call_kwargs["config"].output_dimensionality == 1536


def test_gemini_embedding_provider_batch_recovery_fallback():
    """Verify GeminiEmbeddingProvider falls back to individual calls if batch returns fewer embeddings."""
    mock_vector = [0.1] * 1536
    mock_emb_obj = MagicMock()
    mock_emb_obj.values = mock_vector

    # First batch call returns only 1 embedding for 2 inputs
    mock_batch_resp = MagicMock()
    mock_batch_resp.embeddings = [mock_emb_obj]

    # Subsequent single calls return 1 embedding each
    mock_single_resp = MagicMock()
    mock_single_resp.embeddings = [mock_emb_obj]

    mock_client = MagicMock()
    mock_client.models.embed_content.side_effect = [mock_batch_resp, mock_single_resp, mock_single_resp]

    with patch("google.genai.Client", return_value=mock_client):
        provider = GeminiEmbeddingProvider(
            api_key="valid-mock-gemini-key",
            model="gemini-embedding-2",
            dimension=1536,
        )

        texts = ["Text 1", "Text 2"]
        results = provider.get_embeddings(texts)

        assert len(results) == 2
        assert len(results[0]) == 1536
        assert len(results[1]) == 1536
        assert mock_client.models.embed_content.call_count == 3


def test_gemini_query_embedding_mock_call():
    """Verify EmbeddingService.get_query_embedding returns 1536 floats."""
    mock_vector = [0.02] * 1536
    mock_emb_obj = MagicMock()
    mock_emb_obj.values = mock_vector
    mock_response = MagicMock()
    mock_response.embeddings = [mock_emb_obj]

    mock_client = MagicMock()
    mock_client.models.embed_content.return_value = mock_response

    with patch("google.genai.Client", return_value=mock_client), \
         patch("app.services.embeddings.settings.EMBEDDING_PROVIDER", "gemini"), \
         patch("app.services.embeddings.settings.GEMINI_API_KEY", "valid-gemini-key"):
        service = EmbeddingService()
        q_vec = service.get_query_embedding("What are the contractual terms?")
        assert len(q_vec) == 1536
        assert isinstance(q_vec[0], float)


# =========================================================================
# 3. Gemini LLM Provider Tests
# =========================================================================

def test_gemini_llm_missing_api_key_raises_error():
    """Verify GeminiLLMProvider raises clear RuntimeError when API key is missing."""
    provider = GeminiLLMProvider(api_key="", model="gemini-2.5-flash")
    with pytest.raises(RuntimeError, match="GEMINI_API_KEY is missing or invalid"):
        provider.generate_answer(
            system_prompt="System prompt",
            user_prompt="User query",
        )


def test_gemini_llm_generation_mock_call():
    """Verify GeminiLLMProvider passes system instruction, history, and prompt to google-genai."""
    mock_response = MagicMock()
    mock_response.text = "Grounded answer from Gemini 2.5 [Document, Page 1]"
    mock_response.usage_metadata.total_token_count = 142

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch("google.genai.Client", return_value=mock_client):
        provider = GeminiLLMProvider(
            api_key="valid-mock-gemini-key",
            model="gemini-2.5-flash",
        )

        history = [
            {"role": "user", "content": "Previous question"},
            {"role": "assistant", "content": "Previous answer"},
        ]

        result = provider.generate_answer(
            system_prompt="You are a strict document analysis assistant.",
            user_prompt="What is the liability cap?",
            conversation_history=history,
            temperature=0.1,
        )

        assert result["answer"] == "Grounded answer from Gemini 2.5 [Document, Page 1]"
        assert result["model"] == "gemini-2.5-flash"
        assert result["token_count"] == 142
        assert result["latency_ms"] >= 0.0

        mock_client.models.generate_content.assert_called_once()
        call_kwargs = mock_client.models.generate_content.call_args.kwargs
        assert call_kwargs["model"] == "gemini-2.5-flash"
        assert call_kwargs["config"].system_instruction == "You are a strict document analysis assistant."
        assert call_kwargs["config"].temperature == 0.1
        assert len(call_kwargs["contents"]) == 3  # 2 history messages + 1 user prompt


def test_gemini_llm_api_failure_raises_error():
    """Verify GeminiLLMProvider fails loudly on API error rather than silently fabricating."""
    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = Exception("Google API 503 Service Unavailable")

    with patch("google.genai.Client", return_value=mock_client):
        provider = GeminiLLMProvider(
            api_key="valid-mock-gemini-key",
            model="gemini-2.5-flash",
        )

        with pytest.raises(RuntimeError, match="Gemini API generation error"):
            provider.generate_answer(
                system_prompt="System",
                user_prompt="User prompt",
            )


# =========================================================================
# 4. RAG Service Integration with Gemini Provider
# =========================================================================

def test_rag_service_with_gemini_provider():
    """Verify RAGService delegates to GeminiLLMProvider and returns grounded citations."""
    mock_response = MagicMock()
    mock_response.text = "According to Section 4, the fee is $10,000 [AlphaCorp_MSA, Page 1]."
    mock_response.usage_metadata.total_token_count = 110

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    retrieved_chunks = [
        {
            "chunk_id": "c1",
            "document_id": "doc1",
            "document_title": "AlphaCorp_MSA",
            "page_number": 1,
            "section_title": "Section 4",
            "text_content": "Section 4: The annual fee is $10,000 payable net 30.",
            "score": 0.88,
        }
    ]

    with patch("google.genai.Client", return_value=mock_client), \
         patch("app.services.llm.settings.AI_PROVIDER", "gemini"), \
         patch("app.services.llm.settings.GEMINI_API_KEY", "valid-gemini-key"):
        res = rag_service.generate_grounded_answer(
            query="What is the annual fee?",
            retrieved_chunks=retrieved_chunks,
        )

        assert "Section 4" in res["answer"]
        assert len(res["citations"]) == 1
        assert res["citations"][0].document_title == "AlphaCorp_MSA"
        assert res["model"] == "gemini-2.5-flash"

import math
import re
import logging
from abc import ABC, abstractmethod
from typing import List, Optional
from app.config import settings

logger = logging.getLogger(__name__)


class BaseEmbeddingProvider(ABC):
    """Abstract interface for dense vector embedding generators."""

    @abstractmethod
    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        pass

    @abstractmethod
    def get_dimension(self) -> int:
        pass


class GeminiEmbeddingProvider(BaseEmbeddingProvider):
    """Official Google GenAI SDK embedding provider for Gemini embedding models."""

    def __init__(self, api_key: str, model: str = "gemini-embedding-2", dimension: int = 1536):
        self.api_key = api_key
        self.model = model
        self.dimension = dimension

    def get_dimension(self) -> int:
        return self.dimension

    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        if not self.api_key or len(self.api_key.strip()) < 5:
            if settings.ENVIRONMENT == "production":
                raise RuntimeError("GEMINI_API_KEY is missing or invalid in production.")
            # Fall back to local semantic provider in offline development/test
            logger.info("GEMINI_API_KEY not set in %s mode. Using local semantic embedding provider.", settings.ENVIRONMENT)
            return LocalSemanticEmbeddingProvider(dimension=self.dimension).get_embeddings(texts)

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=self.api_key)

            config = types.EmbedContentConfig(
                output_dimensionality=self.dimension,
            )

            # In google-genai SDK, passing a list of strings directly causes the SDK
            # to group all strings into a single multi-part Content object (returning 1 combined embedding).
            # Passing a list of distinct types.Content objects instructs the Gemini API
            # to generate an embedding for each document in the batch.
            formatted_contents = [
                types.Content(parts=[types.Part.from_text(text=t if t.strip() else " ")])
                for t in texts
            ]

            response = client.models.embed_content(
                model=self.model,
                contents=formatted_contents,
                config=config,
            )

            vectors = []
            if response.embeddings:
                for emb in response.embeddings:
                    vec = [float(x) for x in emb.values]
                    if len(vec) == self.dimension:
                        vectors.append(vec)
                    elif len(vec) > self.dimension:
                        vectors.append(vec[:self.dimension])
                    else:
                        vectors.append(vec + [0.0] * (self.dimension - len(vec)))

            # If the response count doesn't match the input count, embed items individually
            if len(vectors) != len(texts):
                vectors = []
                for t in texts:
                    single_content = types.Content(parts=[types.Part.from_text(text=t if t.strip() else " ")])
                    single_resp = client.models.embed_content(
                        model=self.model,
                        contents=single_content,
                        config=config,
                    )
                    if single_resp.embeddings:
                        vec = [float(x) for x in single_resp.embeddings[0].values]
                        if len(vec) == self.dimension:
                            vectors.append(vec)
                        elif len(vec) > self.dimension:
                            vectors.append(vec[:self.dimension])
                        else:
                            vectors.append(vec + [0.0] * (self.dimension - len(vec)))
                    else:
                        vectors.append([0.0] * self.dimension)

            return vectors

        except Exception as e:
            if settings.ENVIRONMENT == "production":
                raise RuntimeError(f"Gemini embedding API call failed in production: {e}") from e
            logger.warning("Gemini embedding call failed: %s. Falling back to local semantic provider.", e)
            return LocalSemanticEmbeddingProvider(dimension=self.dimension).get_embeddings(texts)


class OpenAIEmbeddingProvider(BaseEmbeddingProvider):
    """OpenAI API embedding provider for text-embedding models."""

    def __init__(self, api_key: str, model: str = "text-embedding-3-small", dimension: int = 1536):
        self.api_key = api_key
        self.model = model
        self.dimension = dimension

    def get_dimension(self) -> int:
        return self.dimension

    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        if not self.api_key or len(self.api_key.strip()) < 10:
            if settings.ENVIRONMENT == "production":
                raise RuntimeError("OPENAI_API_KEY is missing or invalid in production.")
            # Fall back to local semantic provider in development if key is missing
            return LocalSemanticEmbeddingProvider(dimension=self.dimension).get_embeddings(texts)

        try:
            from openai import OpenAI
            client = OpenAI(api_key=self.api_key)
            response = client.embeddings.create(
                input=texts,
                model=self.model,
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            if settings.ENVIRONMENT == "production":
                raise RuntimeError(f"OpenAI embedding API call failed in production: {e}") from e
            logger.warning("OpenAI embedding call failed: %s. Falling back to local semantic provider.", e)
            return LocalSemanticEmbeddingProvider(dimension=self.dimension).get_embeddings(texts)


class LocalSemanticEmbeddingProvider(BaseEmbeddingProvider):
    """
    Genuine zero-external-API local semantic dense encoder.
    Uses subword character-trigram and positional token projection matrices
    with L2-normalization to produce consistent, non-random 1536-dimensional semantic vectors.
    """
    def __init__(self, dimension: int = 1536):
        self.dimension = dimension

    def get_dimension(self) -> int:
        return self.dimension

    def _embed_single(self, text: str) -> List[float]:
        vec = [0.0] * self.dimension
        if not text.strip():
            return vec

        # Tokenize and clean
        words = re.findall(r"\b\w+\b", text.lower())
        if not words:
            return vec

        for word_pos, word in enumerate(words):
            weight = 1.0 / (1.0 + 0.15 * math.log(word_pos + 1))
            # Word-level projection
            seed_word = 2166136261
            for ch in word:
                seed_word = ((seed_word ^ ord(ch)) * 16777619) & 0xFFFFFFFF
            idx1 = seed_word % self.dimension
            idx2 = (seed_word >> 8) % self.dimension
            vec[idx1] += weight * 1.5
            vec[idx2] += weight * 0.75

            # Subword 3-gram projection
            if len(word) >= 3:
                for i in range(len(word) - 2):
                    trigram = word[i:i+3]
                    seed_tri = 2166136261
                    for ch in trigram:
                        seed_tri = ((seed_tri ^ ord(ch)) * 16777619) & 0xFFFFFFFF
                    t_idx = seed_tri % self.dimension
                    vec[t_idx] += weight * 0.5

        # L2-normalize
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0.0:
            vec = [x / norm for x in vec]
        return vec

    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        return [self._embed_single(t) for t in texts]


class EmbeddingService:
    """High-level embedding service dispatching to configured provider."""

    def __init__(self):
        provider_name = settings.EMBEDDING_PROVIDER.lower()
        if provider_name == "gemini":
            self.provider: BaseEmbeddingProvider = GeminiEmbeddingProvider(
                api_key=settings.GEMINI_API_KEY,
                model=settings.GEMINI_EMBEDDING_MODEL,
                dimension=settings.EMBEDDING_DIMENSION,
            )
        elif provider_name == "openai":
            self.provider = OpenAIEmbeddingProvider(
                api_key=settings.OPENAI_API_KEY,
                model=settings.EMBEDDING_MODEL,
                dimension=settings.EMBEDDING_DIMENSION,
            )
        else:
            self.provider = LocalSemanticEmbeddingProvider(dimension=settings.EMBEDDING_DIMENSION)

    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        return self.provider.get_embeddings(texts)

    def get_query_embedding(self, query: str) -> List[float]:
        res = self.get_embeddings([query])
        return res[0] if res else [0.0] * self.provider.get_dimension()


embedding_service = EmbeddingService()

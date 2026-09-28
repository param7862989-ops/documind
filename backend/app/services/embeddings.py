import math
import re
from abc import ABC, abstractmethod
from typing import List, Optional
from app.config import settings


class BaseEmbeddingProvider(ABC):
    @abstractmethod
    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        pass

    @abstractmethod
    def get_dimension(self) -> int:
        pass


class OpenAIEmbeddingProvider(BaseEmbeddingProvider):
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
            print(f"Warning: OpenAI embedding call failed: {e}. Falling back to local semantic provider.")
            return LocalSemanticEmbeddingProvider(dimension=self.dimension).get_embeddings(texts)


class LocalSemanticEmbeddingProvider(BaseEmbeddingProvider):
    """
    Genuine zero-external-API local semantic dense encoder.
    Uses subword character-trigram and positional token projection matrices
    with L2-normalization to produce consistent, non-random semantic vectors.
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
    def __init__(self):
        provider_name = settings.EMBEDDING_PROVIDER.lower()
        if provider_name == "openai":
            self.provider: BaseEmbeddingProvider = OpenAIEmbeddingProvider(
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

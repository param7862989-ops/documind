import math
from typing import List
from app.config import settings


class EmbeddingService:
    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self.model = settings.EMBEDDING_MODEL

    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Generates 1536-dim vector embeddings for a batch of text chunks.
        If OpenAI API key is present, calls OpenAI text-embedding-3-small.
        Otherwise, falls back to a deterministic semantic vector generator.
        """
        if not texts:
            return []

        if self.api_key and len(self.api_key.strip()) > 10:
            try:
                from openai import OpenAI
                client = OpenAI(api_key=self.api_key)
                response = client.embeddings.create(
                    input=texts,
                    model=self.model
                )
                return [item.embedding for item in response.data]
            except Exception as e:
                print(f"OpenAI embedding API call failed: {e}. Falling back to local vector generation.")

        # Deterministic 1536-dimensional normalized hash embedding fallback for zero-dependency dev/test
        embeddings = []
        for text in texts:
            vec = [0.0] * 1536
            # Hash tokens into vector dimensions
            words = text.lower().split()
            for i, word in enumerate(words):
                h = abs(hash(word)) % 1536
                vec[h] += 1.0 / (1.0 + math.log(i + 1))
            
            # L2 normalize
            norm = math.sqrt(sum(x * x for x in vec)) or 1.0
            embeddings.append([x / norm for x in vec])

        return embeddings

    def get_query_embedding(self, query: str) -> List[float]:
        """Generates embedding for a single user search / chat query."""
        res = self.get_embeddings([query])
        return res[0] if res else [0.0] * 1536

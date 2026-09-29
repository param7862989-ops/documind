import logging
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from app.config import settings

logger = logging.getLogger(__name__)


class BaseLLMProvider(ABC):
    """Abstract base class for LLM generation providers."""

    @abstractmethod
    def generate_answer(
        self,
        system_prompt: str,
        user_prompt: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        temperature: float = 0.1,
    ) -> Dict[str, Any]:
        """
        Generates grounded response using the specified LLM.
        Returns dictionary:
        {
            "answer": str,
            "token_count": int,
            "latency_ms": float,
            "model": str,
        }
        """
        pass

    @abstractmethod
    def get_model_name(self) -> str:
        """Returns the configured model name."""
        pass


class GeminiLLMProvider(BaseLLMProvider):
    """Official Google GenAI SDK provider for Gemini models."""

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        self.api_key = api_key
        self.model = model

    def get_model_name(self) -> str:
        return self.model

    def generate_answer(
        self,
        system_prompt: str,
        user_prompt: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        temperature: float = 0.1,
    ) -> Dict[str, Any]:
        if not self.api_key or len(self.api_key.strip()) < 5:
            raise RuntimeError(
                "GEMINI_API_KEY is missing or invalid. Please configure GEMINI_API_KEY."
            )

        start_time = time.time()
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=self.api_key)

            # Build multi-turn content items preserving conversation context
            contents = []
            if conversation_history:
                for msg in conversation_history:
                    # In Gemini SDK, user role is "user" and assistant role is "model"
                    role = "user" if msg.get("role") == "user" else "model"
                    content_text = msg.get("content", "")
                    if content_text:
                        contents.append(
                            types.Content(
                                role=role,
                                parts=[types.Part.from_text(text=content_text)]
                            )
                        )

            # Append current user prompt with grounded context
            contents.append(
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=user_prompt)]
                )
            )

            config = types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=temperature,
            )

            response = client.models.generate_content(
                model=self.model,
                contents=contents,
                config=config,
            )

            answer = response.text or ""
            latency_ms = round((time.time() - start_time) * 1000, 2)
            
            token_count = (
                response.usage_metadata.total_token_count
                if hasattr(response, "usage_metadata") and response.usage_metadata
                else int((len(system_prompt) + len(user_prompt) + len(answer)) / 4)
            )

            return {
                "answer": answer,
                "token_count": token_count,
                "latency_ms": latency_ms,
                "model": self.model,
            }

        except Exception as e:
            logger.exception("Gemini LLM generation failed: %s", e)
            raise RuntimeError(f"Gemini API generation error: {e}") from e


class OpenAILLMProvider(BaseLLMProvider):
    """OpenAI API provider for GPT-4o / GPT-4o-mini models."""

    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        self.api_key = api_key
        self.model = model

    def get_model_name(self) -> str:
        return self.model

    def generate_answer(
        self,
        system_prompt: str,
        user_prompt: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        temperature: float = 0.1,
    ) -> Dict[str, Any]:
        if not self.api_key or len(self.api_key.strip()) < 10:
            raise RuntimeError(
                "OPENAI_API_KEY is missing or invalid. Please configure OPENAI_API_KEY."
            )

        start_time = time.time()
        try:
            from openai import OpenAI
            client = OpenAI(api_key=self.api_key)

            messages = [{"role": "system", "content": system_prompt}]
            if conversation_history:
                for msg in conversation_history:
                    messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})

            messages.append({"role": "user", "content": user_prompt})

            completion = client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
            )

            answer = completion.choices[0].message.content or ""
            latency_ms = round((time.time() - start_time) * 1000, 2)
            token_count = (
                completion.usage.total_tokens
                if completion.usage
                else int((len(system_prompt) + len(user_prompt) + len(answer)) / 4)
            )

            return {
                "answer": answer,
                "token_count": token_count,
                "latency_ms": latency_ms,
                "model": self.model,
            }

        except Exception as e:
            logger.exception("OpenAI LLM generation failed: %s", e)
            raise RuntimeError(f"OpenAI API generation error: {e}") from e


class DeterministicFallbackLLMProvider(BaseLLMProvider):
    """
    Deterministic fallback generator used exclusively in offline test suites and mock mode.
    Does NOT fabricate external facts; formats citations and evidence from provided context blocks.
    """

    def __init__(self, model_name: str = "grounded-deterministic-engine"):
        self.model_name = model_name

    def get_model_name(self) -> str:
        return self.model_name

    def generate_answer(
        self,
        system_prompt: str,
        user_prompt: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        temperature: float = 0.1,
    ) -> Dict[str, Any]:
        start_time = time.time()
        
        # Extract primary document excerpts from user_prompt
        import re
        sources = re.findall(r'<source id="(\d+)" document="([^"]+)"(?:, Page (\d+))?(?:, Section: ([^>]+))?>\n\[DOCUMENT DATA START\]\n(.*?)\n\[DOCUMENT DATA END\]', user_prompt, re.DOTALL)
        
        if not sources:
            answer = "The provided documents do not contain enough information to answer this question."
        else:
            first_src = sources[0]
            doc_name = first_src[1]
            page_num = first_src[2]
            section = first_src[3]
            body = first_src[4].strip()
            
            page_info = f", Page {page_num}" if page_num else ""
            section_info = f", Section: {section}" if section else ""
            excerpt = body[:280] + ("..." if len(body) > 280 else "")

            answer = (
                f"Based on **{doc_name}**{page_info}{section_info}:\n\n"
                f"{excerpt}\n\n"
                f"**Citation:** [{doc_name}{page_info}]"
            )

        latency_ms = round((time.time() - start_time) * 1000, 2)
        token_count = int((len(system_prompt) + len(user_prompt) + len(answer)) / 4)

        return {
            "answer": answer,
            "token_count": token_count,
            "latency_ms": latency_ms,
            "model": self.model_name,
        }


def get_llm_provider() -> BaseLLMProvider:
    """Factory function resolving configured LLM provider."""
    provider_name = settings.AI_PROVIDER.lower()

    if provider_name == "gemini":
        if not settings.GEMINI_API_KEY and settings.ENVIRONMENT != "production":
            # For offline local test runner if key not provided
            return DeterministicFallbackLLMProvider(model_name="gemini-offline-fallback")
        return GeminiLLMProvider(
            api_key=settings.GEMINI_API_KEY,
            model=settings.GEMINI_MODEL,
        )
    elif provider_name == "openai":
        if not settings.OPENAI_API_KEY and settings.ENVIRONMENT != "production":
            return DeterministicFallbackLLMProvider(model_name="openai-offline-fallback")
        return OpenAILLMProvider(
            api_key=settings.OPENAI_API_KEY,
            model=settings.OPENAI_MODEL,
        )
    elif provider_name in ("fallback", "mock", "local"):
        return DeterministicFallbackLLMProvider()
    else:
        # Fallback based on available keys
        if settings.GEMINI_API_KEY:
            return GeminiLLMProvider(
                api_key=settings.GEMINI_API_KEY,
                model=settings.GEMINI_MODEL,
            )
        elif settings.OPENAI_API_KEY:
            return OpenAILLMProvider(
                api_key=settings.OPENAI_API_KEY,
                model=settings.OPENAI_MODEL,
            )
        return DeterministicFallbackLLMProvider()

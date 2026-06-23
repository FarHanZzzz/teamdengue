"""Multi-provider LLM client with automatic fallback.

The agent and citizen assistant call `llm_complete`. It tries providers in
order — OpenRouter's free open-source models first, then Gemini as a backup
when OpenRouter is exhausted (token/rate limit). The first successful
completion wins. If no key is configured or everything fails, it returns
``None`` and callers fall back to the deterministic engine — so the product
never breaks.
"""
from __future__ import annotations

import logging

import httpx

from app.core.config import settings

log = logging.getLogger("prevdengue.llm")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

# Free OpenRouter models, tried in order. First to answer wins.
# Verified available on the free tier; the chain absorbs rate-limits/downtime.
FREE_MODELS = [
    "openai/gpt-oss-120b:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemma-4-31b-it:free",
    "openai/gpt-oss-20b:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
]

# Gemini backup models, tried in order.
GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-2.0-flash",
]


def llm_available() -> bool:
    return bool(settings.openrouter_api_key or settings.gemini_api_key)


def _try_openrouter(system: str, user: str, max_tokens: int, temperature: float) -> str | None:
    if not settings.openrouter_api_key:
        return None
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "HTTP-Referer": settings.openrouter_referer,
        "X-Title": "PrevDengue",
        "Content-Type": "application/json",
    }
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
    for model in (settings.openrouter_models or FREE_MODELS):
        try:
            resp = httpx.post(
                OPENROUTER_URL,
                headers=headers,
                json={"model": model, "messages": messages,
                      "max_tokens": max_tokens, "temperature": temperature},
                timeout=30.0,
            )
            if resp.status_code != 200:
                log.warning("OpenRouter %s -> HTTP %s: %s", model, resp.status_code, resp.text[:160])
                continue
            data = resp.json()
            content = (data.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
            if content:
                log.info("OpenRouter answered via %s", model)
                return content
        except Exception as exc:  # noqa: BLE001
            log.warning("OpenRouter %s failed: %s", model, exc)
            continue
    return None


def _try_gemini(system: str, user: str, max_tokens: int, temperature: float) -> str | None:
    if not settings.gemini_api_key:
        return None
    payload = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "temperature": temperature,
            # Disable "thinking" so the token budget is spent on the answer, not
            # internal reasoning (otherwise thinking models truncate the reply).
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    for model in (settings.gemini_models or GEMINI_MODELS):
        try:
            resp = httpx.post(
                GEMINI_URL.format(model=model),
                params={"key": settings.gemini_api_key},
                json=payload,
                timeout=30.0,
            )
            if resp.status_code != 200:
                log.warning("Gemini %s -> HTTP %s: %s", model, resp.status_code, resp.text[:160])
                continue
            data = resp.json()
            parts = (data.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
            content = "".join(p.get("text", "") for p in parts).strip()
            if content:
                log.info("Gemini answered via %s", model)
                return content
        except Exception as exc:  # noqa: BLE001
            log.warning("Gemini %s failed: %s", model, exc)
            continue
    return None


def llm_complete(
    system: str,
    user: str,
    *,
    max_tokens: int = 400,
    temperature: float = 0.4,
) -> str | None:
    # 1) OpenRouter free models, then 2) Gemini backup.
    out = _try_openrouter(system, user, max_tokens, temperature)
    if out:
        return out
    out = _try_gemini(system, user, max_tokens, temperature)
    if out:
        return out
    log.warning("All LLM providers failed; using deterministic fallback.")
    return None

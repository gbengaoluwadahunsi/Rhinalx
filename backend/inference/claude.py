"""Anthropic (Claude) reasoning backend.

Used for the smart steps — gap detection, interview question generation, "why"
narrative assembly, precedent explanation, consolidation — when POLICY=claude and
a key is present. The API key is read from the environment, never hardcoded.
"""
from __future__ import annotations

from anthropic import Anthropic, APIError

from backend.config import settings


class ClaudeError(RuntimeError):
    """Raised when the Anthropic call fails (so the router can fall back to local)."""


def available() -> bool:
    return bool(settings.anthropic_api_key)


def reason(prompt: str, *, system: str | None = None, max_tokens: int = 1024,
           temperature: float = 0.2) -> str:
    """Reason with Claude.

    Note: the latest models (claude-sonnet-5 / opus-4-8) reject `temperature`
    (400) and run adaptive thinking by default — thinking tokens would eat into
    `max_tokens`. For Rhinalx's structured JSON extraction we disable thinking so
    the whole budget goes to the answer, and steer via the prompt, not sampling.
    The `temperature` arg is accepted for interface parity but not sent.
    """
    if not settings.anthropic_api_key:
        raise ClaudeError("no ANTHROPIC_API_KEY set")
    client = Anthropic(api_key=settings.anthropic_api_key)
    try:
        msg = client.messages.create(
            model=settings.model,
            max_tokens=max_tokens,
            thinking={"type": "disabled"},
            system=system or "",
            messages=[{"role": "user", "content": prompt}],
        )
    except APIError as exc:
        raise ClaudeError(f"Anthropic API error: {exc}") from exc
    return "".join(block.text for block in msg.content if block.type == "text").strip()

"""The single interface for all model calls.

Feature code calls `router.embed()` / `router.reason()` and never imports a backend
directly. Embeddings are always local (offline-first). Reasoning is policy-routed
(Claude when allowed, local fallback) and lands in Phase 2. Every served call is
logged via base.record_call so the UI can show which backend answered.
"""
from __future__ import annotations

import logging
import time

from backend.config import settings
from backend.inference import claude, local
from backend.inference.base import BackendCall, ReasonResult, Vector, record_call
from backend.inference.claude import ClaudeError

logger = logging.getLogger("rhinalx.inference")

# Runtime-mutable reasoning policy (starts from POLICY in the env). The UI toggles
# this live so the demo can switch backends without a restart. Embeddings are
# always local regardless of policy.
_POLICY: dict[str, str] = {"value": settings.policy if settings.policy in ("claude", "local") else "claude"}


def current_policy() -> str:
    return _POLICY["value"]


def set_policy(policy: str) -> str:
    if policy not in ("claude", "local"):
        raise ValueError("policy must be 'claude' or 'local'")
    _POLICY["value"] = policy
    logger.info("policy set to %s", policy)
    return policy


def embed(texts: list[str]) -> list[Vector]:
    """Embed texts. Always served locally (per CLAUDE.md), and logged."""
    t0 = time.perf_counter()
    vectors = local.embed(texts)
    ms = int((time.perf_counter() - t0) * 1000)
    record_call(
        BackendCall(
            kind="embed",
            backend="local",
            model=settings.embed_model,
            n=len(texts),
            ms=ms,
        )
    )
    return vectors


def reason(prompt: str, *, system: str | None = None, max_tokens: int = 1024,
           temperature: float = 0.2) -> ReasonResult:
    """Reason via the policy-selected backend, with logging + fallback.

    POLICY=claude uses Claude when a key is present, falling back to the local LLM
    on any Claude error (so the core loop never hard-depends on the cloud).
    POLICY=local always uses the local LLM. The served backend is recorded and
    returned so the UI can show who answered.
    """
    t0 = time.perf_counter()
    use_claude = current_policy() == "claude" and claude.available()
    note = ""

    if use_claude:
        try:
            text = claude.reason(prompt, system=system, max_tokens=max_tokens,
                                  temperature=temperature)
            backend, model = "claude", settings.model
        except ClaudeError as exc:
            logger.warning("Claude failed (%s); falling back to local LLM", exc)
            text = local.reason(prompt, system=system, max_tokens=max_tokens,
                                temperature=temperature)
            backend, model, note = "local", settings.local_llm_model, "claude fallback"
    else:
        text = local.reason(prompt, system=system, max_tokens=max_tokens,
                            temperature=temperature)
        backend, model = "local", settings.local_llm_model

    ms = int((time.perf_counter() - t0) * 1000)
    record_call(BackendCall(kind="reason", backend=backend, model=model, n=1, ms=ms, note=note))
    return ReasonResult(text=text, backend=backend, model=model, note=note)

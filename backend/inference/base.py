"""Shared inference types + a call log.

CLAUDE.md requires that every model call be routed through the router and that we
log *which backend served each call* (so the hybrid story is visible in the UI).
This module holds the small shared pieces both backends and the router use.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal

logger = logging.getLogger("rhinalx.inference")

Kind = Literal["embed", "reason"]
Backend = Literal["local", "claude"]

# Embedding vectors are plain lists of floats.
Vector = list[float]


@dataclass
class BackendCall:
    """One served inference call — recorded so the UI can show who answered."""

    kind: Kind
    backend: Backend
    model: str
    n: int
    ms: int
    note: str = ""


@dataclass
class ReasonResult:
    """A reasoning-model response plus which backend actually served it."""

    text: str
    backend: Backend
    model: str
    note: str = ""


# In-memory log of served calls. Small and bounded; exposed via the API later
# (Phase 6) to make the Claude/Local split visible in the demo.
_CALL_LOG: list[BackendCall] = []


def record_call(call: BackendCall) -> BackendCall:
    _CALL_LOG.append(call)
    logger.info(
        "inference: %s served by %s (%s) n=%d %dms %s",
        call.kind,
        call.backend,
        call.model,
        call.n,
        call.ms,
        call.note,
    )
    return call


def recent_calls(limit: int = 50) -> list[BackendCall]:
    return _CALL_LOG[-limit:]

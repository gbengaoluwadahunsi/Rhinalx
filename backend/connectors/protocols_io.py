"""protocols.io connector - fetch a canonical protocol to diff against (read-only).

Live path for the deviation-diff engine: given a protocols.io protocol id, DOI, or
URL, pull the canonical method over the API and normalize it into the step list the
deviation engine consumes. Opt-in and token-gated (PROTOCOLS_IO_TOKEN from env); the
engine also works on a pasted/uploaded canonical when no token is present.

  GET {base}/protocols/{id}   Authorization: Bearer <token>

The protocol JSON's step schema is nested and version-dependent, so step text is
extracted defensively (collect human-readable strings, strip HTML) rather than
assuming a fixed shape.
"""
from __future__ import annotations

import html as _html
import re
from typing import Any

import httpx

from backend.config import settings

_TAG = re.compile(r"<[^>]+>")
_WS = re.compile(r"\s+")
_IDISH = re.compile(r"^[0-9a-fA-F-]{16,}$|^\d+$|^https?://")


class ProtocolsIoError(RuntimeError):
    """Raised for any connector failure, with a user-facing message."""


def extract_id(ref: str) -> str:
    """Pull a protocol id/slug from a URL, DOI, or bare id."""
    ref = (ref or "").strip()
    m = re.search(r"protocols\.io/(?:view|edit|run)/([a-z0-9-]+)", ref, re.I)
    if m:
        return m.group(1)
    m = re.search(r"protocols\.io\.([a-z0-9-]+)", ref, re.I)  # DOI form
    if m:
        return m.group(1)
    return ref


def _clean(s: str) -> str:
    return _WS.sub(" ", _html.unescape(_TAG.sub(" ", s))).strip()


def _step_text(step: Any) -> str:
    """Collect readable text from a (nested) step object, skipping ids/urls."""
    out: list[str] = []

    def walk(x: Any) -> None:
        if isinstance(x, str):
            c = _clean(x)
            if c and not _IDISH.match(c) and (" " in c or len(c) > 12):
                out.append(c)
        elif isinstance(x, dict):
            for k, v in x.items():
                if k in {"guid", "id", "uuid", "previous_id", "developer_id", "created_on", "changed_on"}:
                    continue
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)

    walk(step)
    seen: set[str] = set()
    uniq: list[str] = []
    for t in out:
        key = t.lower()
        if key not in seen:
            seen.add(key)
            uniq.append(t)
    return " | ".join(uniq)[:600]


def fetch_protocol(ref: str) -> dict[str, Any]:
    """Fetch and normalize a protocol into {doi, version, title, steps:[{step,text}]}."""
    token = settings.protocolsio_token
    if not token:
        raise ProtocolsIoError(
            "PROTOCOLS_IO_TOKEN is not set - add it to .env to use the live "
            "protocols.io connector (or paste the canonical protocol instead)."
        )
    pid = extract_id(ref)
    url = f"{settings.protocolsio_base.rstrip('/')}/protocols/{pid}"
    try:
        resp = httpx.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=20.0)
    except httpx.HTTPError as exc:
        raise ProtocolsIoError(f"could not reach protocols.io: {exc}") from exc

    if resp.status_code in (401, 403):
        raise ProtocolsIoError("protocols.io rejected the token (auth). Check PROTOCOLS_IO_TOKEN.")
    if resp.status_code == 404:
        raise ProtocolsIoError(f"protocol '{pid}' not found on protocols.io (404).")
    if resp.status_code >= 400:
        raise ProtocolsIoError(f"protocols.io error {resp.status_code}: {resp.text[:200]}")

    data = resp.json()
    proto = data.get("protocol") if isinstance(data, dict) and "protocol" in data else data
    if not isinstance(proto, dict):
        raise ProtocolsIoError("unexpected protocols.io response shape")

    steps: list[dict[str, str]] = []
    for i, st in enumerate(proto.get("steps") or [], 1):
        text = _step_text(st)
        if text:
            steps.append({"step": str(st.get("number") or st.get("id") or i), "text": text})

    return {
        "doi": proto.get("doi") or proto.get("uri") or pid,
        "version": str(proto.get("version_id") or proto.get("version") or "current"),
        "title": proto.get("title") or proto.get("name"),
        "id": proto.get("id"),
        "steps": steps,
        "url": f"https://www.protocols.io/view/{proto.get('uri') or pid}",
    }

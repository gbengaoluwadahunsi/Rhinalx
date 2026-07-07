"""Inference package.

Single interface for all model calls (per CLAUDE.md): feature code never calls
Anthropic or Ollama directly. Modules land here in later phases:
  base.py    — reason() / embed() interface + types
  claude.py  — Anthropic backend
  local.py   — Ollama backend (embeddings always; LLM fallback)
  router.py  — POLICY-based backend selection + per-call logging
"""

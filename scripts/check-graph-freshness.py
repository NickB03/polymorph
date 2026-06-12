#!/usr/bin/env python3
"""Fail if graphify-out/graph.json is stale relative to the code.

Deterministic CI guard: re-runs tree-sitter AST extraction over the code and
compares the set of code symbols against what the committed graph.json records.
No clustering, no LLM, no network, so it is reproducible and cheap.

Why it keys on (source_file, label) and NOT node id:
    graphify derives the AST node *id* for some files (notably top-level config
    files like components.json/tsconfig.json) from the checkout path, so the id
    differs between e.g. /home/user/polymorph and GitHub's /home/runner/work/...
    Comparing ids would red-fail on every clone/CI run with phantom staleness.
    `source_file` (always relative to the repo root) and `label` (the symbol or
    key name) are path-stable, so (source_file, label) is reproducible anywhere.

Scope and intent:
    * Compares the set of (source_file, label) over AST nodes, deduping fresh
      nodes by id first to mirror how graph.json collapses same-id nodes.
      Catches the high-signal staleness cases — files, functions, classes,
      types, exports added/removed/renamed — with effectively zero false
      positives.
    * Deliberately does NOT diff edges: the built graph.json is a simple
      undirected graph that collapses parallel edges, so a raw edge diff is
      unreliable. Edge/semantic relationships are refreshed deliberately via
      `/graphify`, not on every code change.
    * Committed AST nodes are identified by an explicit ``_origin == "ast"``.
      Doc/semantic concept nodes have no ``_origin`` key and are excluded.

Exit 0 when in sync, 1 when stale (with an actionable message).
"""
from __future__ import annotations

from pathlib import Path
import json

from graphify.detect import detect
from graphify.extract import collect_files, extract

ROOT = Path(".").resolve()
GRAPH = Path("graphify-out/graph.json")


def _rel(source_file: str) -> str:
    """Normalize source_file to a repo-root-relative path (defensive — committed
    and fresh values are already relative, but absolute paths must not leak in)."""
    p = Path(source_file)
    if p.is_absolute():
        try:
            return str(p.relative_to(ROOT))
        except ValueError:
            return source_file
    return source_file


def _committed_signature(nodes) -> set:
    return {
        (_rel(n.get("source_file") or ""), n.get("label"))
        for n in nodes
        if n.get("_origin") == "ast"
    }


def _fresh_signature(nodes) -> set:
    # graph.json collapses nodes that share an id (e.g. a const `feedback` and a
    # type `Feedback` both normalize to db_schema_feedback), keeping the FIRST.
    # Mirror that collapse so the raw extraction matches what the graph stores.
    first_by_id: dict = {}
    for n in nodes:
        first_by_id.setdefault(n.get("id"), n)
    return {
        (_rel(n.get("source_file") or ""), n.get("label"))
        for n in first_by_id.values()
    }


def _sample(pairs: set, label: str) -> None:
    if pairs:
        print(f"  {label}:")
        for sf, lbl in sorted(pairs)[:10]:
            print(f"    {sf}::{lbl}")


def main() -> int:
    if not GRAPH.exists():
        print(
            "::error:: graphify-out/graph.json is missing — "
            "run `/graphify` and commit graphify-out/."
        )
        return 1

    graph = json.loads(GRAPH.read_text(encoding="utf-8"))
    committed = _committed_signature(graph["nodes"])

    det = detect(Path("."))
    code_files = []
    for f in det.get("files", {}).get("code", []):
        p = Path(f)
        code_files.extend(collect_files(p) if p.is_dir() else [p])
    fresh = extract(code_files, cache_root=Path("."))
    current = _fresh_signature(fresh["nodes"])

    added = current - committed  # in code but not graphed
    missing = committed - current  # graphed but gone from code

    if not (added or missing):
        print(f"graph.json is in sync with the code ({len(current)} AST symbols). OK")
        return 0

    print("::error:: graphify-out/graph.json is stale relative to the code.")
    print(
        f"  {len(added)} symbol(s) in code but not graphed, "
        f"{len(missing)} graphed symbol(s) no longer in code."
    )
    _sample(added, "new code symbols (not in graph)")
    _sample(missing, "graphed symbols no longer in code")
    print()
    print(
        "Fix: run `graphify update .` (or `/graphify` for a full rebuild), "
        "then commit graphify-out/."
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

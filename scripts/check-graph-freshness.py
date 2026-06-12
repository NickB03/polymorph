#!/usr/bin/env python3
"""Fail if graphify-out/graph.json is stale relative to the code.

Deterministic CI guard: re-runs tree-sitter AST extraction over the code and
compares the set of code symbols (AST node ids) against what the committed
graph.json records. No clustering, no LLM, no network, so it is reproducible
and cheap.

Scope and intent:

* It compares AST *node ids* only. That catches the high-signal staleness
  cases — files, functions, classes, types, or exports added, removed, or
  renamed — with effectively zero false positives.
* It deliberately does NOT diff edges. The built graph.json is a simple
  undirected graph that collapses parallel edges, so a raw edge diff against it
  is unreliable. Edge-level and semantic relationships are refreshed
  deliberately via `/graphify`, not on every code change.
* Committed AST nodes are identified by an explicit ``_origin == "ast"``.
  Doc/semantic concept nodes have no ``_origin`` key and are excluded.

Exit 0 when in sync, 1 when stale (with an actionable message).
"""
from __future__ import annotations

from pathlib import Path
import json

from graphify.detect import detect
from graphify.extract import collect_files, extract

ROOT = Path(".")
GRAPH = ROOT / "graphify-out" / "graph.json"


def _sample(ids, label):
    if ids:
        print(f"  {label}:")
        for x in sorted(ids)[:10]:
            print(f"    {x}")


def main() -> int:
    if not GRAPH.exists():
        print(
            "::error:: graphify-out/graph.json is missing — "
            "run `/graphify` and commit graphify-out/."
        )
        return 1

    graph = json.loads(GRAPH.read_text(encoding="utf-8"))
    committed = {n["id"] for n in graph["nodes"] if n.get("_origin") == "ast"}

    det = detect(ROOT)
    code_files = []
    for f in det.get("files", {}).get("code", []):
        p = Path(f)
        code_files.extend(collect_files(p) if p.is_dir() else [p])
    fresh = extract(code_files, cache_root=ROOT)
    current = {n["id"] for n in fresh["nodes"]}

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

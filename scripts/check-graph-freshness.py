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

``--fix`` repairs graph.json in place: adds the missing AST nodes and drops the
stale ones (plus links left dangling by a dropped node), touching nothing else.
Use this instead of `graphify update .`, which rebuilds from code only and
DROPS the LLM-extracted doc/semantic nodes the committed graph carries. Run it
with the CI-pinned extractor (see .github/workflows/ci.yml) from a clean
checkout — untracked local dirs would otherwise leak phantom nodes in.
"""
from __future__ import annotations

from pathlib import Path
import json
import sys

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


def _key(n) -> tuple:
    return (_rel(n.get("source_file") or ""), n.get("label"))


def _fix(graph: dict, fresh_nodes: list, added: set, missing: set) -> set:
    """Repair graph.json in place; returns the `added` keys it could NOT insert."""
    nodes = graph["nodes"]
    dropped = {n["id"] for n in nodes if n.get("_origin") == "ast" and _key(n) in missing}
    nodes[:] = [n for n in nodes if n["id"] not in dropped]
    # Inherit a community from a sibling in the same file so clustering-based
    # queries still place the new node; a full `/graphify` re-clusters properly.
    community_by_file = {
        n.get("source_file"): n["community"] for n in nodes if "community" in n
    }
    have = {n["id"] for n in nodes}
    inserted: set = set()
    blocked = set()
    for n in fresh_nodes:
        if _key(n) not in added:
            continue
        if n["id"] in inserted:
            continue  # same-id duplicate of a node just added (first wins)
        if n["id"] in have:
            # id already taken by a retained (doc/semantic) node — inserting
            # would duplicate the id, skipping would leave the graph stale.
            blocked.add(_key(n))
            continue
        inserted.add(n["id"])
        new = {**n, "source_file": _rel(n.get("source_file") or ""), "_origin": "ast"}
        if new["source_file"] in community_by_file:
            new["community"] = community_by_file[new["source_file"]]
        nodes.append(new)
    graph["links"] = [
        l
        for l in graph.get("links", [])
        if l.get("source") not in dropped and l.get("target") not in dropped
    ]
    GRAPH.write_text(json.dumps(graph, indent=2) + "\n", encoding="utf-8")
    return blocked


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
    if "--fix" in sys.argv[1:]:
        blocked = _fix(graph, fresh["nodes"], added, missing)
        if blocked:
            print("::error:: --fix could not add symbols whose node id is already used by a doc/semantic node; run a full `/graphify` rebuild.")
            _sample(blocked, "blocked by id collision")
            return 1
        print(f"Fixed: +{len(added)} / -{len(missing)} AST node(s). Commit graphify-out/graph.json.")
        return 0
    print(
        "Fix: run `python scripts/check-graph-freshness.py --fix` with the "
        "CI-pinned graphify from a clean checkout, then commit graph.json. "
        "Do NOT use `graphify update .` — it drops the doc/semantic nodes."
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

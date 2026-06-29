#!/usr/bin/env python3
"""Refresh graphify-out/graph.json so its AST symbol set matches the code.

This mirrors scripts/check-graph-freshness.py EXACTLY — same detect() + extract()
over the same corpus (so .graphifyignore is honored identically) — then
reconciles the committed graph's AST nodes to that fresh set: it adds new code
symbols and removes ones that disappeared. Semantic/doc concept nodes, edges
(links), hyperedges, and the curated GRAPH_REPORT.md are left untouched.

Because it reuses the guard's own extraction, the guard passes by construction
after this runs. AST-only: no LLM, no network, no token cost.

Note: this is deliberately NOT `graphify update .` — that command does a full
rebuild that re-ASTs documentation into the graph and diverges from the curated
semantic structure, which then fails the freshness guard.
"""
from __future__ import annotations

from pathlib import Path
import json

from graphify.detect import detect
from graphify.extract import collect_files, extract

GRAPH = Path("graphify-out/graph.json")
ROOT = Path(".").resolve()


def _rel(source_file: str) -> str:
    """Normalize to a repo-root-relative path — identical to the freshness
    guard, so reconciliation keys match what CI compares."""
    p = Path(source_file or "")
    if p.is_absolute():
        try:
            return str(p.relative_to(ROOT))
        except ValueError:
            return source_file or ""
    return source_file or ""


def main() -> int:
    if not GRAPH.exists():
        print(
            "graphify-out/graph.json is missing — run `/graphify` for a full "
            "(semantic) build before using this incremental refresh."
        )
        return 1

    # Identical extraction to the freshness guard.
    det = detect(Path("."))
    code_files: list[Path] = []
    for f in det.get("files", {}).get("code", []):
        p = Path(f)
        code_files.extend(collect_files(p) if p.is_dir() else [p])
    fresh = extract(code_files, cache_root=Path("."))

    # The guard keys on (source_file, label) — NOT node id, which is path-derived
    # and environment-dependent. Reconcile on the same key so this passes by
    # construction and never churns on id differences between machines/CI.
    #
    # Mirror the guard's collapse: dedupe fresh nodes by id (keep first), then
    # index by (rel source_file, label).
    fresh_by_id: dict = {}
    for n in fresh["nodes"]:
        fresh_by_id.setdefault(n["id"], n)
    fresh_by_sig: dict = {}
    for n in fresh_by_id.values():
        fresh_by_sig.setdefault((_rel(n.get("source_file") or ""), n.get("label")), n)
    fresh_sigs = set(fresh_by_sig)

    g = json.loads(GRAPH.read_text(encoding="utf-8"))
    committed_sigs = {
        (_rel(n.get("source_file") or ""), n.get("label"))
        for n in g["nodes"]
        if n.get("_origin") == "ast"
    }

    add_sigs = fresh_sigs - committed_sigs
    remove_sigs = committed_sigs - fresh_sigs

    if not add_sigs and not remove_sigs:
        print(f"graph.json already in sync ({len(fresh_sigs)} AST symbols).")
        return 0

    # Drop AST nodes whose symbols disappeared, plus any links touching them.
    if remove_sigs:
        removed_ids = {
            n["id"]
            for n in g["nodes"]
            if n.get("_origin") == "ast"
            and (_rel(n.get("source_file") or ""), n.get("label")) in remove_sigs
        }
        g["nodes"] = [n for n in g["nodes"] if n.get("id") not in removed_ids]
        link_key = "links" if "links" in g else "edges"
        g[link_key] = [
            e
            for e in g.get(link_key, [])
            if e.get("source") not in removed_ids and e.get("target") not in removed_ids
        ]

    # Append new AST symbols into a dedicated community. They carry no edges —
    # relationships/communities are refreshed deliberately by a full `/graphify`
    # rebuild; the guard only checks the symbol set.
    if add_sigs:
        new_community = (
            max((n.get("community", 0) for n in g["nodes"]), default=0) + 1
        )
        for sig in add_sigs:
            n = fresh_by_sig[sig]
            g["nodes"].append(
                {
                    "label": n.get("label"),
                    "file_type": n.get("file_type", "code"),
                    "source_file": _rel(n.get("source_file") or ""),
                    "source_location": n.get("source_location", "L1"),
                    "metadata": n.get("metadata", {}),
                    "_origin": "ast",
                    "id": n.get("id"),
                    "community": new_community,
                    "norm_label": n.get("norm_label", n.get("label")),
                }
            )

    # Match graphify's serialization (2-space indent, no trailing newline) so the
    # diff stays minimal and the merge driver stays happy.
    GRAPH.write_text(json.dumps(g, indent=2, ensure_ascii=False), encoding="utf-8")
    print(
        f"Refreshed graph.json: +{len(add_sigs)} / -{len(remove_sigs)} AST symbols "
        f"({len(fresh_sigs)} total)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

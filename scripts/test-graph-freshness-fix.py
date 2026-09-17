#!/usr/bin/env python3
"""Self-check for `check-graph-freshness.py --fix`.

Runs against a temp copy of graph.json (via GRAPH_JSON), so the committed graph
is never touched. Needs the CI-pinned graphify and a clean, in-sync checkout:

    python scripts/test-graph-freshness-fix.py
"""
import json
import os
import subprocess
import sys
import tempfile

SRC = "graphify-out/graph.json"


def run(path, *extra):
    r = subprocess.run(
        [sys.executable, "scripts/check-graph-freshness.py", *extra],
        env={**os.environ, "GRAPH_JSON": path},
        capture_output=True,
        text=True,
    )
    return r.returncode


def touches(link, node_id):
    return node_id in (link["source"], link["target"])


def pairs(graph):
    return [frozenset((l["source"], l["target"])) for l in graph["links"]]


def main():
    orig = json.load(open(SRC))
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "graph.json")

        def write(graph):
            json.dump(graph, open(path, "w"), indent=2)

        write(orig)
        assert run(path) == 0, "baseline must be in sync (clean checkout + pinned graphify?)"

        # 1. Remove a real AST node and its links; add a ghost node + dangling link.
        g = json.loads(json.dumps(orig))
        i = next(
            i
            for i, n in enumerate(g["nodes"])
            if n.get("_origin") == "ast" and any(touches(l, n["id"]) for l in g["links"])
        )
        gone = g["nodes"].pop(i)
        g["links"] = [l for l in g["links"] if not touches(l, gone["id"])]
        g["nodes"].append(
            {"label": "ghost()", "source_file": "lib/ghost.ts", "_origin": "ast", "id": "ghost_x"}
        )
        g["links"].append({"relation": "contains", "source": "ghost_x", "target": gone["id"]})
        write(g)

        assert run(path) == 1, "injected staleness must fail"
        assert run(path, "--fix") == 0
        assert run(path) == 0, "must be in sync after --fix"

        fixed = json.load(open(path))
        ids = {n["id"] for n in fixed["nodes"]}
        assert "ghost_x" not in ids and gone["id"] in ids
        assert not any(touches(l, "ghost_x") for l in fixed["links"]), "dangling link dropped"
        assert any(touches(l, gone["id"]) for l in fixed["links"]), "restored node not isolated"
        dupes = lambda gr: len(pairs(gr)) - len(set(pairs(gr)))
        assert dupes(fixed) == dupes(orig), "no new duplicate links"
        non_ast = lambda gr: [n for n in gr["nodes"] if n.get("_origin") != "ast"]
        assert non_ast(fixed) == non_ast(orig), "doc/semantic nodes untouched"

        # 2. A doc node squatting on the missing symbol's id must fail loudly.
        g = json.loads(json.dumps(orig))
        g["nodes"] = [n for n in g["nodes"] if n["id"] != gone["id"]]
        g["nodes"].append({"label": "Doc concept", "source_file": "docs/x.md", "id": gone["id"]})
        write(g)
        assert run(path, "--fix") == 1, "id collision must not report success"

    print("OK")


if __name__ == "__main__":
    main()

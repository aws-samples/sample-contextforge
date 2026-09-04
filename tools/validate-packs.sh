#!/usr/bin/env bash
# Validate every pack twice:
#
#   Pass 1  coa-pack's own offline validator (fast, no COA checkout needed)
#   Pass 2  against Context Ontology Accelerator's REAL artifacts:
#             - COA's actual coa_metrics.osi_parser, imported and run
#             - COA's actual _RDFLIB_FORMATS map, extracted from source and
#               diffed against the mirror in coa_pack.pack so the two can't drift
#
# Pass 2 deliberately does NOT import coa_ontology.catalog.ingest. That module
# transitively imports coa_control_plane_server, which only exists after
# `make generate` has run inside a COA checkout. Extracting the map from source
# text keeps this script runnable against a plain `git clone` of COA.
#
# Requires: uv, and a COA checkout at ./context-ontology-accelerator
# Usage:    tools/validate-packs.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COA_DIR="context-ontology-accelerator"
PACKS_DIR="packs"

echo "── Pass 1: coa-pack offline validation ─────────────────────────────────"
PYTHONPATH=tools/coa-pack/src uv run --quiet --python 3.12 \
    --with rdflib --with pyyaml --with click --with httpx \
    python -m coa_pack.cli list "$PACKS_DIR"

if [ ! -d "$COA_DIR" ]; then
    echo ""
    echo "⚠ COA checkout not found at $COA_DIR — skipping pass 2"
    exit 0
fi

echo ""
echo "── Pass 2: against COA's real parsers ──────────────────────────────────"
COA_DIR="$COA_DIR" \
PYTHONPATH="$COA_DIR/packages/metric-service/src:$COA_DIR/libs/common/src:tools/coa-pack/src" \
uv run --quiet --python 3.12 \
    --with pyyaml --with structlog --with pydantic --with pydantic-settings \
    --with boto3 --with rdflib --with httpx --with click \
    python - <<'PY'
import ast
import os
import sys
from pathlib import Path

from coa_metrics.osi_parser import parse_osi_yaml
from rdflib import OWL, RDF, Graph

from coa_pack.pack import _EXTENSION_MAP

failures = 0
coa_dir = Path(os.environ["COA_DIR"])


def extract_coa_format_map() -> dict[str, str] | None:
    """Pull _RDFLIB_FORMATS out of COA's ingest.py without importing it.

    ingest.py imports coa_control_plane_server (Smithy-generated, gitignored), so
    importing it would require a full COA build. We only need one module-level
    dict literal, which ast can give us safely.
    """
    source_path = (
        coa_dir / "packages/ontology-engine/src/coa_ontology/catalog/ingest.py"
    )
    if not source_path.is_file():
        return None
    tree = ast.parse(source_path.read_text(encoding="utf-8"))
    for node in tree.body:
        if not isinstance(node, ast.Assign):
            continue
        for target in node.targets:
            if isinstance(target, ast.Name) and target.id == "_RDFLIB_FORMATS":
                return ast.literal_eval(node.value)
    return None


# ── Guard: our extension map must agree with COA's format map ────────────────
coa_formats = extract_coa_format_map()
if coa_formats is None:
    print("⚠ could not locate _RDFLIB_FORMATS in COA's ingest.py — skipping drift check")
else:
    drift = []
    for ext, (_content_type, ingest_format, rdflib_format) in _EXTENSION_MAP.items():
        if ingest_format not in coa_formats:
            drift.append(
                f"{ext}: coa_pack sends format '{ingest_format}', which COA does not map"
            )
        elif coa_formats[ingest_format] != rdflib_format:
            drift.append(
                f"{ext}: coa_pack expects rdflib '{rdflib_format}' for '{ingest_format}', "
                f"COA maps it to '{coa_formats[ingest_format]}'"
            )
    if drift:
        failures += len(drift)
        print("  FAIL  format map drift between coa_pack and COA:")
        for line in drift:
            print(f"        {line}")
    else:
        print(
            f"  OK    format map agrees with COA "
            f"({len(_EXTENSION_MAP)} extensions -> {len(coa_formats)} COA formats)"
        )

print()

# ── Per-pack validation ──────────────────────────────────────────────────────
for pack_dir in sorted(Path("packs").iterdir()):
    if not (pack_dir / "pack.yaml").is_file():
        continue
    print(f"{pack_dir.name}")

    for ttl in sorted(pack_dir.glob("*.ttl")):
        graph = Graph()
        try:
            graph.parse(str(ttl), format="turtle")
        except Exception as exc:
            failures += 1
            print(f"  FAIL  {ttl.name}: {type(exc).__name__}: {exc}")
            continue

        onts = list(graph.subjects(RDF.type, OWL.Ontology))
        classes = set(graph.subjects(RDF.type, OWL.Class))
        objprops = set(graph.subjects(RDF.type, OWL.ObjectProperty))
        transitive = set(graph.subjects(RDF.type, OWL.TransitiveProperty))

        if len(onts) != 1:
            failures += 1
            print(f"  FAIL  {ttl.name}: expected exactly 1 owl:Ontology, found {len(onts)}")
            continue
        if not classes:
            failures += 1
            print(f"  FAIL  {ttl.name}: no owl:Class declared")
            continue

        extra = f", {len(transitive)} transitive" if transitive else ""
        print(
            f"  OK    {ttl.name}: {len(graph)} triples, {len(classes)} classes, "
            f"{len(objprops)} object properties{extra}"
        )
        print(f"        iri = {onts[0]}")

    for osi in sorted(pack_dir.glob("*.osi.yaml")):
        result = parse_osi_yaml(osi.read_text(encoding="utf-8"))
        if not result.success:
            failures += 1
            print(f"  FAIL  {osi.name}")
            for err in result.errors:
                print(f"        {err.path}: {err.message}")
            continue
        doc = result.document
        print(
            f"  OK    {osi.name}: spec {doc.osi_spec_version}, "
            f"{len(doc.datasets)} datasets, {len(doc.metrics)} metrics"
        )
        for metric in doc.metrics:
            dialects = ", ".join(d.dialect for d in metric.expression)
            print(f"        - {metric.name} [{dialects}]")

print()
if failures:
    print(f"✗ {failures} failure(s)")
    sys.exit(1)
print("✓ all packs valid against COA's real parsers")
PY

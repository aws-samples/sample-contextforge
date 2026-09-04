"""Shared fixtures: builders for on-disk packs."""

from __future__ import annotations

import textwrap
from pathlib import Path

import pytest

VALID_TTL = textwrap.dedent(
    """\
    @prefix ex:   <https://example.org/test#> .
    @prefix owl:  <http://www.w3.org/2002/07/owl#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

    <https://example.org/test> a owl:Ontology ;
        owl:versionInfo "1.0.0" .

    ex:Widget a owl:Class ;
        rdfs:label "Widget" .

    ex:Gadget a owl:Class ;
        rdfs:label "Gadget" .

    ex:connectsTo a owl:ObjectProperty, owl:TransitiveProperty ;
        rdfs:domain ex:Widget ;
        rdfs:range ex:Gadget .
    """
)

VALID_OSI = textwrap.dedent(
    """\
    osi_spec_version: "1.0"
    datasets:
      - name: public.widgets
        data_source_id: ds-test
    metrics:
      - name: widget_count
        description: "Count of widgets"
        expression:
          dialects:
            - dialect: ANSI_SQL
              expression: "COUNT(*)"
        ai_context:
          synonyms: ["widgets"]
          instructions: "Use for widget counting questions."
        x_coa:
          data_source_id: ds-test
          source_table: public.widgets
          return_type: integer
    """
)

VALID_MANIFEST = textwrap.dedent(
    """\
    name: Test Pack
    version: 1.0.0
    description: A pack for tests
    ontology: ontology.ttl
    metrics: metrics.osi.yaml
    """
)


@pytest.fixture
def make_pack(tmp_path: Path):
    """Build a pack directory. Pass None for a file to omit it entirely."""

    def _make(
        *,
        manifest: str | None = VALID_MANIFEST,
        ontology: str | None = VALID_TTL,
        metrics: str | None = VALID_OSI,
        sources: str | None = None,
        ontology_filename: str = "ontology.ttl",
        name: str = "test-pack",
    ) -> Path:
        root = tmp_path / name
        root.mkdir(parents=True, exist_ok=True)
        if manifest is not None:
            (root / "pack.yaml").write_text(manifest, encoding="utf-8")
        if ontology is not None:
            (root / ontology_filename).write_text(ontology, encoding="utf-8")
        if metrics is not None:
            (root / "metrics.osi.yaml").write_text(metrics, encoding="utf-8")
        if sources is not None:
            (root / "sources.yaml").write_text(sources, encoding="utf-8")
        return root

    return _make

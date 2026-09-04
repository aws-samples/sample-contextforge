"""CLI behaviour: exit codes, error rendering, and argument guards.

Exit codes matter because validate is meant to run in CI:
  0  success
  1  a pack is invalid, or an install failed
  2  the invocation itself was wrong (missing --token, --owner, etc.)
"""

from __future__ import annotations

import textwrap

import httpx
import pytest
import respx
from click.testing import CliRunner

from coa_pack.cli import main

BASE = "https://api.example.com/prod"


@pytest.fixture
def runner():
    return CliRunner()


# ── validate ─────────────────────────────────────────────────────────────────


def test_validate_succeeds_on_good_pack(runner, make_pack):
    result = runner.invoke(main, ["validate", str(make_pack())])

    assert result.exit_code == 0
    assert "Test Pack" in result.output
    assert "https://example.org/test" in result.output
    assert "widget_count" in result.output


def test_validate_reports_ingest_format(runner, make_pack):
    """The operator needs to know what COA will be told, not just that it parsed."""
    result = runner.invoke(main, ["validate", str(make_pack())])
    assert "text/turtle" in result.output
    assert "turtle" in result.output


def test_validate_exits_1_and_lists_every_finding(runner, make_pack):
    pack = make_pack(manifest="ontology: ontology.ttl\n")
    result = runner.invoke(main, ["validate", str(pack)])

    assert result.exit_code == 1
    assert "$.name" in result.output
    assert "$.version" in result.output
    assert "$.description" in result.output


def test_validate_on_missing_directory_exits_2(runner, tmp_path):
    """click's exists=True guard fires before our code runs."""
    result = runner.invoke(main, ["validate", str(tmp_path / "nope")])
    assert result.exit_code == 2


def test_validate_reports_no_metrics_clearly(runner, make_pack):
    manifest = textwrap.dedent(
        """\
        name: Bare
        version: 1.0.0
        description: No metrics
        ontology: ontology.ttl
        """
    )
    result = runner.invoke(main, ["validate", str(make_pack(manifest=manifest, metrics=None))])

    assert result.exit_code == 0
    assert "metrics    none" in result.output


# ── list ─────────────────────────────────────────────────────────────────────


def test_list_shows_all_packs(runner, make_pack, tmp_path):
    make_pack(name="alpha")
    make_pack(name="beta")

    result = runner.invoke(main, ["list", str(tmp_path)])

    assert result.exit_code == 0
    assert "alpha" in result.output
    assert "beta" in result.output


def test_list_exits_1_when_any_pack_is_invalid(runner, make_pack, tmp_path):
    make_pack(name="good")
    make_pack(name="bad", ontology="not turtle {{{")

    result = runner.invoke(main, ["list", str(tmp_path)])

    assert result.exit_code == 1
    assert "good" in result.output
    assert "bad" in result.output


def test_list_on_empty_dir_is_not_an_error(runner, tmp_path):
    empty = tmp_path / "empty"
    empty.mkdir()
    result = runner.invoke(main, ["list", str(empty)])

    assert result.exit_code == 0
    assert "no packs found" in result.output


# ── install: argument guards ─────────────────────────────────────────────────


def test_install_without_token_exits_2(runner, make_pack, monkeypatch):
    monkeypatch.delenv("COA_TOKEN", raising=False)
    result = runner.invoke(
        main, ["install", str(make_pack()), "--namespace", "ns1", "--base-url", BASE]
    )

    assert result.exit_code == 2
    assert "--token is required" in result.output


def test_install_without_base_url_exits_2(runner, make_pack, monkeypatch):
    monkeypatch.delenv("COA_BASE_URL", raising=False)
    result = runner.invoke(
        main, ["install", str(make_pack()), "--namespace", "ns1", "--token", "t"]
    )

    assert result.exit_code == 2
    assert "--base-url is required" in result.output


def test_install_create_namespace_without_owner_exits_2(runner, make_pack):
    result = runner.invoke(
        main,
        [
            "install",
            str(make_pack()),
            "--namespace",
            "ns1",
            "--base-url",
            BASE,
            "--token",
            "t",
            "--create-namespace",
        ],
    )

    assert result.exit_code == 2
    assert "--owner is required" in result.output


def test_install_refuses_an_invalid_pack_before_calling_coa(runner, make_pack):
    """No partial install from a pack we already know is broken."""
    pack = make_pack(ontology="not turtle {{{")
    result = runner.invoke(
        main,
        ["install", str(pack), "--namespace", "ns1", "--base-url", BASE, "--token", "t"],
    )

    assert result.exit_code == 1
    assert "not installing" in result.output


def test_install_reads_credentials_from_env(runner, make_pack, monkeypatch):
    monkeypatch.setenv("COA_BASE_URL", BASE)
    monkeypatch.setenv("COA_TOKEN", "env-token")

    with respx.mock:
        respx.get(f"{BASE}/namespaces/ns1").mock(
            return_value=httpx.Response(404, json={})
        )
        result = runner.invoke(
            main, ["install", str(make_pack()), "--namespace", "ns1"]
        )

    # 404 without --create-namespace is a genuine failure, but it proves we got
    # past the credential guards using env vars alone.
    assert result.exit_code == 1
    assert "does not exist" in result.output


# ── install: dry run ─────────────────────────────────────────────────────────


def test_dry_run_needs_no_credentials(runner, make_pack):
    result = runner.invoke(
        main, ["install", str(make_pack()), "--namespace", "ns1", "--dry-run"]
    )

    assert result.exit_code == 0
    assert "dry run" in result.output
    assert "would " in result.output


# ── install: happy path over mocked HTTP ─────────────────────────────────────


@respx.mock
def test_install_end_to_end(runner, make_pack):
    respx.get(f"{BASE}/namespaces/ns1").mock(
        return_value=httpx.Response(200, json={"namespace": {"name": "ns1"}})
    )
    respx.post(f"{BASE}/namespaces/ns1/ontologies/upload-url").mock(
        return_value=httpx.Response(
            200,
            json={
                "uploadUrl": "https://s3.example.com/put",
                "s3Key": "ontology-uploads/ns1/abc/ontology.ttl",
                "ontologyId": "https://example.org/test",
            },
        )
    )
    respx.put("https://s3.example.com/put").mock(return_value=httpx.Response(200))
    respx.post(url__regex=rf"{BASE}/namespaces/ns1/ontologies/.+/ingest-from-s3").mock(
        return_value=httpx.Response(202, json={"result": {"jobId": "j1", "status": "pending"}})
    )
    respx.get(url__regex=rf"{BASE}/namespaces/ns1/ontologies/.+/ingest-status/j1").mock(
        return_value=httpx.Response(
            200, json={"status": "completed", "result": {"classCount": 2, "embeddingCount": 5}}
        )
    )
    respx.post(f"{BASE}/namespaces/ns1/import-osi").mock(
        return_value=httpx.Response(202, json={"jobId": "j2", "status": "IN_PROGRESS"})
    )
    respx.get(f"{BASE}/namespaces/ns1/import-jobs/j2").mock(
        return_value=httpx.Response(
            200, json={"status": "COMPLETED", "metricsCreated": 1, "metricsUpdated": 0}
        )
    )

    result = runner.invoke(
        main,
        [
            "install",
            str(make_pack()),
            "--namespace",
            "ns1",
            "--base-url",
            BASE,
            "--token",
            "t",
        ],
    )

    assert result.exit_code == 0, result.output
    assert "installed" in result.output
    assert "2 classes" in result.output
    assert "1 created" in result.output


@respx.mock
def test_install_surfaces_a_failed_ingest(runner, make_pack):
    respx.get(f"{BASE}/namespaces/ns1").mock(return_value=httpx.Response(200, json={}))
    respx.post(f"{BASE}/namespaces/ns1/ontologies/upload-url").mock(
        return_value=httpx.Response(
            200,
            json={
                "uploadUrl": "https://s3.example.com/put",
                "s3Key": "ontology-uploads/ns1/abc/ontology.ttl",
                "ontologyId": "https://example.org/test",
            },
        )
    )
    respx.put("https://s3.example.com/put").mock(return_value=httpx.Response(200))
    respx.post(url__regex=rf"{BASE}/namespaces/ns1/ontologies/.+/ingest-from-s3").mock(
        return_value=httpx.Response(202, json={"result": {"jobId": "j1"}})
    )
    respx.get(url__regex=rf"{BASE}/namespaces/ns1/ontologies/.+/ingest-status/j1").mock(
        return_value=httpx.Response(200, json={"status": "failed", "error": "IngestParseError"})
    )

    result = runner.invoke(
        main,
        ["install", str(make_pack()), "--namespace", "ns1", "--base-url", BASE, "--token", "t"],
    )

    assert result.exit_code == 1
    assert "install failed" in result.output
    assert "IngestParseError" in result.output


@respx.mock
def test_quiet_suppresses_progress_but_keeps_summary(runner, make_pack):
    respx.get(f"{BASE}/namespaces/ns1").mock(return_value=httpx.Response(200, json={}))
    respx.post(f"{BASE}/namespaces/ns1/ontologies/upload-url").mock(
        return_value=httpx.Response(
            200,
            json={
                "uploadUrl": "https://s3.example.com/put",
                "s3Key": "ontology-uploads/ns1/abc/ontology.ttl",
                "ontologyId": "https://example.org/test",
            },
        )
    )
    respx.put("https://s3.example.com/put").mock(return_value=httpx.Response(200))
    respx.post(url__regex=rf"{BASE}/namespaces/ns1/ontologies/.+/ingest-from-s3").mock(
        return_value=httpx.Response(202, json={"result": {"jobId": "j1"}})
    )
    respx.get(url__regex=rf"{BASE}/namespaces/ns1/ontologies/.+/ingest-status/j1").mock(
        return_value=httpx.Response(200, json={"status": "completed", "result": {}})
    )
    respx.post(f"{BASE}/namespaces/ns1/import-osi").mock(
        return_value=httpx.Response(202, json={"jobId": "j2", "status": "IN_PROGRESS"})
    )
    respx.get(f"{BASE}/namespaces/ns1/import-jobs/j2").mock(
        return_value=httpx.Response(200, json={"status": "COMPLETED", "metricsCreated": 1})
    )

    result = runner.invoke(
        main,
        [
            "install",
            str(make_pack()),
            "--namespace",
            "ns1",
            "--base-url",
            BASE,
            "--token",
            "t",
            "--quiet",
        ],
    )

    assert result.exit_code == 0, result.output
    assert "requesting upload url" not in result.output
    assert "installed" in result.output

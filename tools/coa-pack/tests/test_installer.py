"""Install orchestration: job polling, terminal states, and failure handling."""

from __future__ import annotations

from typing import Any

import pytest

from coa_pack.errors import CoaApiError, JobFailedError, JobTimeoutError
from coa_pack.installer import install
from coa_pack.pack import load_pack


class FakeClient:
    """Scripted stand-in for CoaClient.

    ``ingest_statuses`` and ``import_statuses`` are consumed one call at a time so
    a test can drive a job through intermediate states before a terminal one.
    """

    def __init__(
        self,
        *,
        namespace_exists: bool = True,
        ingest_statuses: list[dict[str, Any]] | None = None,
        import_statuses: list[dict[str, Any]] | None = None,
        ingest_raises: Exception | None = None,
    ) -> None:
        self._namespace_exists = namespace_exists
        self._ingest_statuses = list(ingest_statuses or [{"status": "completed"}])
        self._import_statuses = list(import_statuses or [{"status": "COMPLETED"}])
        self._ingest_raises = ingest_raises
        self.calls: list[str] = []

    # namespaces
    def namespace_exists(self, namespace_id: str) -> bool:
        self.calls.append(f"namespace_exists:{namespace_id}")
        return self._namespace_exists

    def create_namespace(self, name, owner, **kwargs):
        self.calls.append(f"create_namespace:{name}")
        self._namespace_exists = True
        return {"namespace": {"name": name}}

    # ontology
    def request_ontology_upload_url(self, namespace_id, filename, **kwargs):
        self.calls.append(f"upload_url:{filename}")
        return {
            "uploadUrl": "https://s3/upload",
            "s3Key": f"ontology-uploads/{namespace_id}/abc/{filename}",
            "ontologyId": kwargs.get("ontology_id") or "urn:ontology:upload-deadbeef",
        }

    def put_presigned(self, upload_url, data, content_type):
        self.calls.append(f"put:{len(data)}b:{content_type}")

    def ingest_ontology_from_s3(self, namespace_id, ontology_id, s3_key, **kwargs):
        self.calls.append(f"ingest:{ontology_id}")
        if self._ingest_raises is not None:
            raise self._ingest_raises
        return {"result": {"jobId": "job-1", "status": "pending"}}

    def get_ingest_status(self, namespace_id, ontology_id, job_id):
        self.calls.append(f"ingest_status:{job_id}")
        if len(self._ingest_statuses) > 1:
            return self._ingest_statuses.pop(0)
        return self._ingest_statuses[0]

    # metrics
    def import_osi(self, namespace_id, *, content=None, s3_key=None):
        self.calls.append("import_osi")
        return {"jobId": "job-2", "status": "IN_PROGRESS"}

    def get_import_job(self, namespace_id, job_id):
        self.calls.append(f"import_status:{job_id}")
        if len(self._import_statuses) > 1:
            return self._import_statuses.pop(0)
        return self._import_statuses[0]

    # sources and grants
    def create_source(self, namespace_id, source):
        name = source.get("databaseSource", source.get("documentSource", {})).get("name")
        self.calls.append(f"create_source:{name}")
        return {"sourceId": f"src-{name}", "status": "SCANNING"}

    def create_grant(self, namespace_id, grant):
        self.calls.append(f"create_grant:{grant['principalId']}")
        return {"grant": {"grantId": "g1"}}


@pytest.fixture(autouse=True)
def no_sleep(monkeypatch):
    """Polling backs off with time.sleep; tests should not actually wait."""
    monkeypatch.setattr("coa_pack.installer.time.sleep", lambda _: None)


# ── happy path ───────────────────────────────────────────────────────────────


def test_installs_ontology_then_metrics(make_pack):
    pack = load_pack(make_pack())
    client = FakeClient(
        ingest_statuses=[{"status": "completed", "result": {"classCount": 2, "embeddingCount": 7}}],
        import_statuses=[{"status": "COMPLETED", "metricsCreated": 1, "metricsUpdated": 0}],
    )

    report = install(client, pack, "ns1")

    assert report.classes_ingested == 2
    assert report.embeddings_created == 7
    assert report.metrics_created == 1
    # Ontology must land before metrics: metrics reference ontology_concepts.
    assert client.calls.index("ingest:https://example.org/test") < client.calls.index("import_osi")


def test_waits_through_embeddings_sync_before_reporting_done(make_pack):
    """embeddings_sync is NOT terminal.

    It exists because the job blocks on OpenSearch vector-index consistency.
    Treating it as done means the first semantic query can miss the new classes.
    """
    pack = load_pack(make_pack())
    client = FakeClient(
        ingest_statuses=[
            {"status": "pending"},
            {"status": "running"},
            {"status": "embeddings_sync"},
            {"status": "completed", "result": {"classCount": 2}},
        ]
    )

    report = install(client, pack, "ns1")

    assert report.classes_ingested == 2
    assert client.calls.count("ingest_status:job-1") == 4


def test_polls_import_job_until_completed(make_pack):
    pack = load_pack(make_pack())
    client = FakeClient(
        import_statuses=[
            {"status": "IN_PROGRESS"},
            {"status": "IN_PROGRESS"},
            {"status": "COMPLETED", "metricsCreated": 3, "metricsUpdated": 1},
        ]
    )

    report = install(client, pack, "ns1")

    assert report.metrics_created == 3
    assert report.metrics_updated == 1


# ── namespace handling ───────────────────────────────────────────────────────


def test_creates_namespace_when_asked(make_pack):
    pack = load_pack(make_pack())
    client = FakeClient(namespace_exists=False)

    report = install(client, pack, "ns1", owner="me@example.com", create_namespace=True)

    assert report.namespace_created is True
    assert "create_namespace:ns1" in client.calls


def test_reuses_existing_namespace_without_error(make_pack):
    pack = load_pack(make_pack())
    client = FakeClient(namespace_exists=True)

    report = install(client, pack, "ns1", owner="me@example.com", create_namespace=True)

    assert report.namespace_created is False
    assert "create_namespace:ns1" not in client.calls


def test_missing_namespace_without_flag_is_an_error(make_pack):
    pack = load_pack(make_pack())
    client = FakeClient(namespace_exists=False)

    with pytest.raises(CoaApiError) as exc_info:
        install(client, pack, "ghost")
    assert exc_info.value.status == 404


def test_create_namespace_without_owner_is_rejected(make_pack):
    pack = load_pack(make_pack())
    client = FakeClient(namespace_exists=False)

    with pytest.raises(ValueError, match="owner"):
        install(client, pack, "ns1", create_namespace=True)


# ── failure handling ─────────────────────────────────────────────────────────


def test_failed_ingest_raises_with_detail(make_pack):
    pack = load_pack(make_pack())
    client = FakeClient(
        ingest_statuses=[{"status": "failed", "error": "IngestParseError"}]
    )

    with pytest.raises(JobFailedError) as exc_info:
        install(client, pack, "ns1")

    assert exc_info.value.status == "failed"
    assert "IngestParseError" in str(exc_info.value)


def test_failed_import_raises_with_errors(make_pack):
    pack = load_pack(make_pack())
    client = FakeClient(
        import_statuses=[{"status": "FAILED", "errors": ["unresolvable data_source_id"]}]
    )

    with pytest.raises(JobFailedError) as exc_info:
        install(client, pack, "ns1")

    assert "unresolvable data_source_id" in str(exc_info.value)


def test_unrecognised_job_state_is_fatal_not_an_infinite_loop(make_pack):
    pack = load_pack(make_pack())
    client = FakeClient(ingest_statuses=[{"status": "quantum_superposition"}])

    with pytest.raises(JobFailedError, match="unrecognised job state"):
        install(client, pack, "ns1")


def test_ingest_timeout_raises(make_pack, monkeypatch):
    pack = load_pack(make_pack())
    client = FakeClient(ingest_statuses=[{"status": "running"}])

    # Advance the clock far past the budget on every check.
    ticks = iter([0.0] + [10_000.0] * 50)
    monkeypatch.setattr("coa_pack.installer.time.monotonic", lambda: next(ticks))

    with pytest.raises(JobTimeoutError) as exc_info:
        install(client, pack, "ns1", ingest_timeout=60.0)

    assert exc_info.value.last_status == "running"
    assert "may still complete server-side" in str(exc_info.value)


def test_conflicting_ontology_is_a_warning_not_a_failure(make_pack):
    """Re-running a partially failed install must not be blocked by a 409.

    COA returns 409 when the ontology IRI is already present, which is the
    expected outcome of a retry — the ontology is already where we want it.
    """
    pack = load_pack(make_pack())
    client = FakeClient(
        ingest_raises=CoaApiError("POST", "/ingest-from-s3", 409, "already exists")
    )

    report = install(client, pack, "ns1")

    assert any("409" in w for w in report.warnings)
    # The point of the test: the install proceeded to metrics rather than aborting.
    assert "import_osi" in client.calls
    # And it did not poll a job it never started.
    assert not any(c.startswith("ingest_status") for c in client.calls)


def test_non_409_ingest_error_propagates(make_pack):
    pack = load_pack(make_pack())
    client = FakeClient(
        ingest_raises=CoaApiError("POST", "/ingest-from-s3", 422, "not valid RDF")
    )

    with pytest.raises(CoaApiError) as exc_info:
        install(client, pack, "ns1")
    assert exc_info.value.status == 422


def test_import_warnings_are_surfaced(make_pack):
    pack = load_pack(make_pack())
    client = FakeClient(
        import_statuses=[
            {
                "status": "COMPLETED",
                "metricsCreated": 1,
                "warnings": ["data_source_id ds-test not found in sources registry"],
            }
        ]
    )

    report = install(client, pack, "ns1")

    assert any("ds-test not found" in w for w in report.warnings)


# ── dry run ──────────────────────────────────────────────────────────────────


def test_dry_run_makes_no_calls(make_pack):
    pack = load_pack(make_pack())
    client = FakeClient()

    report = install(client, pack, "ns1", dry_run=True)

    assert client.calls == []
    assert report.dry_run is True
    assert report.classes_ingested == 2
    assert report.metrics_created == 1


def test_dry_run_summary_says_would(make_pack):
    pack = load_pack(make_pack())
    report = install(FakeClient(), pack, "ns1", dry_run=True)
    assert any("would " in line for line in report.summary_lines())


# ── reporting ────────────────────────────────────────────────────────────────


def test_summary_lines_include_pack_and_namespace(make_pack):
    pack = load_pack(make_pack())
    report = install(FakeClient(), pack, "ns1")
    joined = "\n".join(report.summary_lines())
    assert "Test Pack" in joined
    assert "ns1" in joined

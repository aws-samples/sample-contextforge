"""Install orchestration.

The install is a sequence of REST calls with two async waits in the middle.
Both waits matter for correctness:

* Ontology ingest passes through ``embeddings_sync`` before ``completed``.
  That state exists because the job blocks on OpenSearch vector-index eventual
  consistency. Treating ``embeddings_sync`` as done means the first semantic
  query after install can miss the freshly loaded classes, so we wait for
  ``completed``.

* Metric import returns 202 for anything with a metric in it, so the HTTP 202
  says nothing about whether the metrics parsed. Only the job poll does.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from .client import CoaClient
from .errors import CoaApiError, JobFailedError, JobTimeoutError
from .pack import Pack

# IngestJobState from ontology-graph.smithy.
INGEST_TERMINAL_OK = "completed"
INGEST_TERMINAL_FAIL = "failed"
INGEST_PENDING = frozenset({"pending", "running", "embeddings_sync"})

# ImportOsi status values from metric-service.smithy.
IMPORT_TERMINAL_OK = "COMPLETED"
IMPORT_TERMINAL_FAIL = "FAILED"
IMPORT_PENDING = frozenset({"IN_PROGRESS"})

DEFAULT_INGEST_TIMEOUT = 900.0
DEFAULT_IMPORT_TIMEOUT = 600.0

Reporter = Callable[[str], None]


def _noop(_: str) -> None:
    pass


@dataclass
class InstallReport:
    """What actually happened, for the CLI to render and tests to assert on."""

    pack_name: str
    namespace: str
    dry_run: bool = False
    namespace_created: bool = False
    ontology_iri: str | None = None
    ontology_s3_key: str | None = None
    ontology_job_id: str | None = None
    classes_ingested: int | None = None
    embeddings_created: int | None = None
    metrics_created: int = 0
    metrics_updated: int = 0
    metric_import_job_id: str | None = None
    sources_created: list[str] = field(default_factory=list)
    grants_created: int = 0
    warnings: list[str] = field(default_factory=list)

    def summary_lines(self) -> list[str]:
        prefix = "would " if self.dry_run else ""
        lines = [f"pack:      {self.pack_name}", f"namespace: {self.namespace}"]
        if self.namespace_created:
            lines.append(f"namespace  {prefix}created")
        if self.ontology_iri:
            detail = f"ontology   {prefix}ingested {self.ontology_iri}"
            if self.classes_ingested is not None:
                detail += f" ({self.classes_ingested} classes"
                if self.embeddings_created is not None:
                    detail += f", {self.embeddings_created} embeddings"
                detail += ")"
            lines.append(detail)
        if self.metrics_created or self.metrics_updated:
            lines.append(
                f"metrics    {prefix}imported "
                f"({self.metrics_created} created, {self.metrics_updated} updated)"
            )
        if self.sources_created:
            lines.append(f"sources    {prefix}registered: {', '.join(self.sources_created)}")
        if self.grants_created:
            lines.append(f"grants     {prefix}created: {self.grants_created}")
        for warning in self.warnings:
            lines.append(f"warning    {warning}")
        return lines


def _poll(
    fetch: Callable[[], dict[str, Any]],
    *,
    kind: str,
    job_id: str,
    pending: frozenset[str],
    ok: str,
    fail: str,
    status_of: Callable[[dict[str, Any]], str],
    timeout: float,
    report: Reporter,
    interval: float = 2.0,
    max_interval: float = 15.0,
) -> dict[str, Any]:
    """Poll until terminal. Backs off gradually so long jobs don't hammer the API."""
    started = time.monotonic()
    last_status = "unknown"
    current_interval = interval

    while True:
        payload = fetch()
        status = status_of(payload)
        if status != last_status:
            report(f"    {kind} job {job_id}: {status}")
            last_status = status

        if status == ok:
            return payload
        if status == fail:
            raise JobFailedError(kind, job_id, status, _error_detail(payload))
        if status not in pending:
            # An unmodelled state. Treat as fatal rather than spinning forever.
            raise JobFailedError(kind, job_id, status, "unrecognised job state")

        waited = time.monotonic() - started
        if waited > timeout:
            raise JobTimeoutError(kind, job_id, status, waited)

        time.sleep(current_interval)
        current_interval = min(current_interval * 1.5, max_interval)


def _error_detail(payload: dict[str, Any]) -> str | None:
    for key in ("error", "message", "detail"):
        value = payload.get(key)
        if value:
            return str(value)
    errors = payload.get("errors")
    if isinstance(errors, list) and errors:
        return "; ".join(str(e) for e in errors[:5])
    return None


def install(
    client: CoaClient,
    pack: Pack,
    namespace: str,
    *,
    owner: str | None = None,
    create_namespace: bool = False,
    dry_run: bool = False,
    report: Reporter = _noop,
    ingest_timeout: float = DEFAULT_INGEST_TIMEOUT,
    import_timeout: float = DEFAULT_IMPORT_TIMEOUT,
) -> InstallReport:
    """Install ``pack`` into ``namespace``.

    Not transactional. COA exposes no batch or rollback primitive, so a failure
    partway through leaves earlier steps applied. Ontology ingest is idempotent
    on the IRI (a second ingest of the same IRI returns 409 Conflict), and metric
    import upserts by name, so re-running a failed install is safe. Source
    registration is NOT idempotent — it mints a new sourceId each call — which is
    why sources are registered last and reported individually.
    """
    result = InstallReport(pack_name=pack.name, namespace=namespace, dry_run=dry_run)

    if dry_run:
        report(f"  dry run — no calls will be made")
        result.ontology_iri = pack.ontology.ontology_iri
        result.classes_ingested = pack.ontology.class_count
        result.metrics_created = len(pack.metric_names)
        result.sources_created = [
            str(s.get("databaseSource", s.get("documentSource", {})).get("name", "<unnamed>"))
            for s in pack.sources
        ]
        result.grants_created = len(pack.grants)
        if not pack.metric_names:
            result.warnings.append("pack declares no metrics")
        return result

    # ── 1. namespace ─────────────────────────────────────────────────────────
    if create_namespace:
        if not owner:
            raise ValueError("--owner is required with --create-namespace")
        if client.namespace_exists(namespace):
            report(f"  namespace '{namespace}' already exists — reusing")
        else:
            report(f"  creating namespace '{namespace}' (owner {owner})")
            try:
                client.create_namespace(
                    namespace, owner, display_name=pack.name, description=pack.description
                )
                result.namespace_created = True
            except CoaApiError as exc:
                # COA namespaces are DataZone-backed and eventually consistent:
                # GET /namespaces/{id} can still 404 for a few seconds after the
                # record commits, so namespace_exists() may say "no" while POST
                # says 409 "already exists". Treat that as a reusable namespace
                # rather than a fatal error — this makes a re-run after a partial
                # install safe.
                if exc.status == 409:
                    report(f"  namespace '{namespace}' already exists — reusing (create 409)")
                else:
                    raise
    elif not client.namespace_exists(namespace):
        raise CoaApiError(
            "GET",
            f"/namespaces/{namespace}",
            404,
            f"namespace '{namespace}' does not exist; pass --create-namespace to make it",
        )

    # ── 2. ontology: upload-url -> PUT -> ingest -> poll ─────────────────────
    ontology = pack.ontology
    report(f"  requesting upload url for {ontology.filename}")
    upload = client.request_ontology_upload_url(
        namespace,
        ontology.filename,
        content_type=ontology.content_type,
        ontology_id=ontology.ontology_iri,
        title=pack.ontology_title,
    )
    upload_url = upload["uploadUrl"]
    s3_key = upload["s3Key"]
    # Prefer the IRI we declared; fall back to whatever COA minted.
    ontology_id = upload.get("ontologyId") or ontology.ontology_iri
    result.ontology_s3_key = s3_key
    result.ontology_iri = ontology_id

    report(f"  uploading {ontology.size_bytes:,} bytes to {s3_key}")
    client.put_presigned(upload_url, ontology.path.read_bytes(), ontology.content_type)

    report(f"  starting ingest ({ontology.ingest_format})")
    try:
        accepted = client.ingest_ontology_from_s3(
            namespace,
            ontology_id,
            s3_key,
            ontology_format=ontology.ingest_format,
            title=pack.ontology_title,
            ontology_type=pack.ontology_type,
        )
    except CoaApiError as exc:
        if exc.status == 409:
            report(f"  ontology {ontology_id} already present — skipping ingest")
            result.warnings.append(
                f"ontology {ontology_id} already existed; ingest skipped (409 Conflict)"
            )
            accepted = None
        else:
            raise

    if accepted is not None:
        job = accepted.get("result", accepted)
        job_id = job.get("jobId")
        result.ontology_job_id = job_id
        if job_id:
            try:
                final = _poll(
                    lambda: _unwrap(client.get_ingest_status(namespace, ontology_id, job_id)),
                    kind="ingest",
                    job_id=job_id,
                    pending=INGEST_PENDING,
                    ok=INGEST_TERMINAL_OK,
                    fail=INGEST_TERMINAL_FAIL,
                    status_of=lambda p: str(p.get("status", "unknown")),
                    timeout=ingest_timeout,
                    report=report,
                )
                ingest_result = final.get("result") or {}
                result.classes_ingested = ingest_result.get("classCount")
                result.embeddings_created = ingest_result.get("embeddingCount")
            except JobFailedError as exc:
                # COA reports an "ontology already exists" conflict two ways
                # depending on timing: sometimes a synchronous 409 on
                # ingest-from-s3 (handled above), sometimes an async job that
                # accepts (202) then fails with a conflict message. Both mean the
                # ontology is already ingested, so treat the async form the same
                # idempotent way rather than aborting a re-run.
                if exc.detail and "already exists" in exc.detail.lower():
                    report(f"  ontology {ontology_id} already present — skipping ingest")
                    result.warnings.append(
                        f"ontology {ontology_id} already existed; ingest skipped (async conflict)"
                    )
                else:
                    raise
        else:
            result.warnings.append("ingest returned no jobId; could not confirm completion")

    # ── 3. metrics ───────────────────────────────────────────────────────────
    metrics_yaml = pack.metrics_yaml
    if metrics_yaml:
        report(f"  importing {len(pack.metric_names)} metric(s)")
        accepted = client.import_osi(namespace, content=metrics_yaml)
        job_id = accepted.get("jobId")
        result.metric_import_job_id = job_id
        status = str(accepted.get("status", ""))

        if job_id and status in IMPORT_PENDING:
            try:
                final = _poll(
                    lambda: client.get_import_job(namespace, job_id),
                    kind="metric-import",
                    job_id=job_id,
                    pending=IMPORT_PENDING,
                    ok=IMPORT_TERMINAL_OK,
                    fail=IMPORT_TERMINAL_FAIL,
                    status_of=lambda p: str(p.get("status", "unknown")),
                    timeout=import_timeout,
                    report=report,
                )
                result.metrics_created = int(final.get("metricsCreated") or 0)
                result.metrics_updated = int(final.get("metricsUpdated") or 0)
                for warning in final.get("warnings") or []:
                    result.warnings.append(f"metric import: {warning}")
            except JobFailedError as exc:
                # A metric can only be created once the data source its dataset
                # binds to (x_coa.data_source_id) is registered — COA resolves
                # datasets first, and an OSI whose datasets reference an
                # unregistered source fails the job with metricsProcessed=0 and
                # no per-metric error. That is an expected state when a pack's
                # sources.yaml is still a template (no live OT database), so we
                # downgrade it to a warning: the ontology is live, metrics come
                # online once the source is wired. A genuine parse/validation
                # failure carries error detail and stays fatal.
                detail = client.get_import_job(namespace, job_id)
                processed = int(detail.get("metricsProcessed") or 0)
                errors = detail.get("errors") or []
                if processed == 0 and not errors:
                    report(
                        "  metric import could not resolve datasets — no data source "
                        "registered yet; skipping (ontology is live)"
                    )
                    result.warnings.append(
                        "metrics not imported: pack datasets reference a data source that "
                        "is not registered yet (see sources.yaml). Register the source, "
                        "then re-run install to bring metrics online."
                    )
                else:
                    raise
        else:
            # Synchronous response (no metrics, or COA processed inline).
            result.metrics_created = int(accepted.get("metricsCreated") or 0)
            result.metrics_updated = int(accepted.get("metricsUpdated") or 0)
            for warning in accepted.get("warnings") or []:
                result.warnings.append(f"metric import: {warning}")

    # ── 4. sources ───────────────────────────────────────────────────────────
    for source in pack.sources:
        name = str(
            source.get("databaseSource", source.get("documentSource", {})).get("name", "<unnamed>")
        )
        report(f"  registering source '{name}'")
        created = client.create_source(namespace, source)
        source_id = created.get("sourceId", "<unknown>")
        result.sources_created.append(f"{name} ({source_id})")

    # ── 5. grants ────────────────────────────────────────────────────────────
    for grant in pack.grants:
        report(
            f"  granting {grant['role']} to {grant['principalType']}:{grant['principalId']}"
        )
        client.create_grant(namespace, grant)
        result.grants_created += 1

    return result


def _unwrap(payload: dict[str, Any]) -> dict[str, Any]:
    """COA sometimes wraps a response in {"result": ...} and sometimes not."""
    inner = payload.get("result")
    if isinstance(inner, dict) and "status" in inner:
        return inner
    return payload

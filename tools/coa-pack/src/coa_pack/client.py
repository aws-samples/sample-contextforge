"""Thin REST client for the Context Ontology Accelerator control plane.

Every endpoint here was read off COA's Smithy models in
``models/src/main/smithy/`` rather than inferred, and the source model is cited
per method so drift is easy to spot when COA revs.

Deliberately not using COA's generated TypeScript/Python clients: they live in
``smithy-generated/``, which is gitignored and only exists after ``make generate``
has run inside a COA checkout. A dozen ``httpx`` calls is a smaller dependency
than requiring a working COA build to install a pack.
"""

from __future__ import annotations

import re
from typing import Any

import httpx

from .errors import CoaApiError

DEFAULT_TIMEOUT = 30.0

# Note for whoever writes the query-side client (the web UI):
# COA's serve tier strips these from QUERY request bodies and resolves them from
# grants instead (context-manager/src/coa_serve/main.py:806-812, 877-905).
# Sending them on a query is a silent no-op.
#
# They are, however, entirely valid on a CreateGrant body — a grant is precisely
# where COA expects authorization scope to be declared. This loader only creates
# grants, so there is nothing to guard against here; the constant is documentation.
QUERY_SERVER_RESOLVED_FIELDS = frozenset(
    {"globalRoles", "resourceRoles", "tableAllowlist", "columnDenylist", "allowedMetrics", "sub"}
)


class CoaClient:
    """Authenticated client for COA's REST API.

    ``base_url`` is the API Gateway invoke URL including stage, e.g.
    ``https://abc123.execute-api.us-east-1.amazonaws.com/prod``.
    ``token`` is an OIDC bearer token obtained via Authorization Code + PKCE;
    COA has no machine-to-machine credential flow, so this must be a real
    user's token. See COA's external-docs/content/agent-access.md.
    """

    def __init__(
        self,
        base_url: str,
        token: str,
        *,
        timeout: float = DEFAULT_TIMEOUT,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self._client = httpx.Client(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            timeout=timeout,
            transport=transport,
        )
        # Presigned S3 PUTs must not carry our Authorization header — S3 rejects
        # a request that has both a signed query string and a bearer token.
        self._unauth = httpx.Client(timeout=max(timeout, 120.0), transport=transport)

    def __enter__(self) -> CoaClient:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def close(self) -> None:
        self._client.close()
        self._unauth.close()

    # ── internals ────────────────────────────────────────────────────────────

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        response = self._client.request(method, path, **kwargs)
        if response.status_code >= 400:
            raise CoaApiError(method, path, response.status_code, response.text)
        if not response.content:
            return None
        try:
            return response.json()
        except ValueError:
            return response.text

    # ── namespaces (namespace.smithy) ────────────────────────────────────────

    def create_namespace(
        self, name: str, owner: str, *, display_name: str | None = None, description: str | None = None
    ) -> dict[str, Any]:
        """POST /namespaces -> 201. Required: name, owner (email)."""
        body: dict[str, Any] = {"name": name, "owner": owner}
        if display_name:
            body["displayName"] = display_name
        if description:
            body["description"] = description
        return self._request("POST", "/namespaces", json=body)

    def get_namespace(self, namespace_id: str) -> dict[str, Any]:
        """GET /namespaces/{namespaceId}."""
        return self._request("GET", f"/namespaces/{namespace_id}")

    def list_namespaces(self) -> dict[str, Any]:
        """GET /namespaces."""
        return self._request("GET", "/namespaces")

    def namespace_exists(self, namespace_id: str) -> bool:
        try:
            self.get_namespace(namespace_id)
            return True
        except CoaApiError as exc:
            if exc.status == 404:
                return False
            raise

    # ── ontologies (ontology-graph.smithy) ───────────────────────────────────

    def request_ontology_upload_url(
        self,
        namespace_id: str,
        filename: str,
        *,
        content_type: str | None = None,
        ontology_id: str | None = None,
        title: str | None = None,
    ) -> dict[str, Any]:
        """POST /namespaces/{ns}/ontologies/upload-url.

        Returns {uploadUrl, s3Key, ontologyId}. The presigned PUT expires in 900s
        and the key is scoped to ``ontology-uploads/{namespace}/``; ingest rejects
        any key outside that prefix.
        """
        body: dict[str, Any] = {"filename": filename}
        if content_type:
            body["contentType"] = content_type
        if ontology_id:
            body["ontologyId"] = ontology_id
        if title:
            body["title"] = title
        return self._request(
            "POST", f"/namespaces/{namespace_id}/ontologies/upload-url", json=body
        )

    def put_presigned(self, upload_url: str, data: bytes, content_type: str) -> None:
        """PUT bytes to a presigned S3 URL.

        Content-Type must match what was passed to the upload-url call or S3
        rejects the signature.

        COA presigns against the global endpoint (``<bucket>.s3.amazonaws.com``).
        For a bucket outside us-east-1, S3 answers a first PUT with 307
        TemporaryRedirect to the regional virtual-hosted endpoint and does NOT
        store the body — leaving ingest to fail later with NoSuchKey. The SigV2
        signature is not bound to the host, so we re-issue the same signed PUT to
        the regional endpoint S3 names in the redirect. (httpx will not replay a
        PUT body across a redirect on its own.)
        """
        headers = {"Content-Type": content_type}
        response = self._unauth.put(upload_url, content=data, headers=headers)

        if response.status_code == 307:
            endpoint = _redirect_endpoint(response)
            if endpoint:
                parsed = httpx.URL(upload_url)
                regional = parsed.copy_with(host=endpoint)
                response = self._unauth.put(str(regional), content=data, headers=headers)

        if response.status_code >= 400:
            raise CoaApiError("PUT", "<presigned-url>", response.status_code, response.text)

    def ingest_ontology_from_s3(
        self,
        namespace_id: str,
        ontology_id: str,
        s3_key: str,
        *,
        ontology_format: str | None = None,
        title: str | None = None,
        ontology_type: str | None = None,
    ) -> dict[str, Any]:
        """POST /namespaces/{ns}/ontologies/{id}/ingest-from-s3 -> 202.

        Returns {result: IngestJob}. Note this path runs with validate=False
        server-side, so Tier-1 semantic validation is skipped — which is exactly
        why coa_pack.pack validates thoroughly before we get here.
        """
        body: dict[str, Any] = {"s3Key": s3_key}
        if ontology_format:
            body["format"] = ontology_format
        if title:
            body["title"] = title
        if ontology_type:
            body["ontologyType"] = ontology_type
        return self._request(
            "POST",
            f"/namespaces/{namespace_id}/ontologies/{_escape(ontology_id)}/ingest-from-s3",
            json=body,
        )

    def get_ingest_status(
        self, namespace_id: str, ontology_id: str, job_id: str
    ) -> dict[str, Any]:
        """GET /namespaces/{ns}/ontologies/{id}/ingest-status/{jobId}."""
        return self._request(
            "GET",
            f"/namespaces/{namespace_id}/ontologies/{_escape(ontology_id)}"
            f"/ingest-status/{job_id}",
        )

    def list_ontologies(self, namespace_id: str) -> dict[str, Any]:
        """GET /namespaces/{ns}/ontologies."""
        return self._request("GET", f"/namespaces/{namespace_id}/ontologies")

    # ── metrics (metric-service.smithy) ──────────────────────────────────────

    def import_osi(
        self, namespace_id: str, *, content: str | None = None, s3_key: str | None = None
    ) -> dict[str, Any]:
        """POST /namespaces/{ns}/import-osi.

        Exactly one of content / s3Key. Any import with at least one metric is
        processed asynchronously and returns 202 with a jobId.
        """
        if (content is None) == (s3_key is None):
            raise ValueError("import_osi requires exactly one of content or s3_key")
        body = {"content": content} if content is not None else {"s3Key": s3_key}
        return self._request("POST", f"/namespaces/{namespace_id}/import-osi", json=body)

    def get_import_job(self, namespace_id: str, job_id: str) -> dict[str, Any]:
        """GET /namespaces/{ns}/import-jobs/{jobId}."""
        return self._request("GET", f"/namespaces/{namespace_id}/import-jobs/{job_id}")

    def list_metrics(self, namespace_id: str) -> dict[str, Any]:
        """GET /namespaces/{ns}/metrics."""
        return self._request("GET", f"/namespaces/{namespace_id}/metrics")

    # ── sources (unified-sources.smithy) ─────────────────────────────────────

    def create_source(self, namespace_id: str, source: dict[str, Any]) -> dict[str, Any]:
        """POST /namespaces/{ns}/sources.

        Body needs sourceType (DATABASE | DOCUMENTS) plus exactly one of
        databaseSource / documentSource.
        """
        return self._request("POST", f"/namespaces/{namespace_id}/sources", json=source)

    def list_sources(self, namespace_id: str) -> dict[str, Any]:
        """GET /namespaces/{ns}/sources."""
        return self._request("GET", f"/namespaces/{namespace_id}/sources")

    # ── grants (grant.smithy) ────────────────────────────────────────────────

    def create_grant(self, namespace_id: str, grant: dict[str, Any]) -> dict[str, Any]:
        """POST /namespaces/{ns}/grants.

        Required: principalType (USER|GROUP|AGENT), principalId, role.
        Optional data scoping: tableAllowlist, columnDenylist, allowedMetrics —
        legitimate here, unlike on a query body. See QUERY_SERVER_RESOLVED_FIELDS.
        """
        return self._request("POST", f"/namespaces/{namespace_id}/grants", json=grant)


def _redirect_endpoint(response: httpx.Response) -> str | None:
    """Extract the regional S3 host from a 307 TemporaryRedirect.

    S3 returns the target host in an ``<Endpoint>`` element of its XML error
    body; some responses also carry it in the ``x-amz-bucket-region`` header.
    Prefer the body since it names the exact virtual-hosted host to use.
    """
    body = response.text or ""
    match = re.search(r"<Endpoint>([^<]+)</Endpoint>", body)
    if match:
        return match.group(1).strip()
    region = response.headers.get("x-amz-bucket-region")
    host = response.request.url.host if response.request else ""
    if region and host and ".s3.amazonaws.com" in host:
        return host.replace(".s3.amazonaws.com", f".s3.{region}.amazonaws.com")
    return None


def _escape(ontology_id: str) -> str:
    """Percent-encode an ontology IRI for use in a path segment.

    COA's own delete endpoint takes the IRI as a query parameter specifically
    because API Gateway mangles encoded '#'. For path segments we encode ':' and
    '/' and leave '#' alone — IRIs used as path params in COA are the
    ``urn:ontology:...`` form, which has no fragment.
    """
    return ontology_id.replace("/", "%2F")

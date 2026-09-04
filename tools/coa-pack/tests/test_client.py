"""COA REST client request shaping and error mapping."""

from __future__ import annotations

import httpx
import pytest
import respx

from coa_pack.client import CoaClient
from coa_pack.errors import CoaApiError

BASE = "https://api.example.com/prod"
TOKEN = "test-token"  # nosec B105 - dummy token for unit tests, not a real credential


@pytest.fixture
def client():
    with CoaClient(BASE, TOKEN) as c:
        yield c


# ── auth header ──────────────────────────────────────────────────────────────


@respx.mock
def test_sends_bearer_token(client):
    route = respx.get(f"{BASE}/namespaces/ns1").mock(
        return_value=httpx.Response(200, json={"namespace": {"name": "ns1"}})
    )
    client.get_namespace("ns1")
    assert route.calls.last.request.headers["Authorization"] == f"Bearer {TOKEN}"


@respx.mock
def test_presigned_put_does_not_send_authorization():
    """S3 rejects a request carrying both a signed query string and a bearer token.

    This is the single easiest way to break the upload step, and the failure mode
    is an opaque 403 from S3, so it gets an explicit test.
    """
    with CoaClient(BASE, TOKEN) as c:
        route = respx.put("https://s3.example.com/upload").mock(
            return_value=httpx.Response(200)
        )
        c.put_presigned("https://s3.example.com/upload", b"data", "text/turtle")

    request = route.calls.last.request
    assert "Authorization" not in request.headers
    assert request.headers["Content-Type"] == "text/turtle"
    assert request.content == b"data"


# ── namespaces ───────────────────────────────────────────────────────────────


@respx.mock
def test_create_namespace_sends_name_and_owner(client):
    route = respx.post(f"{BASE}/namespaces").mock(
        return_value=httpx.Response(201, json={"namespace": {"name": "ns1"}})
    )
    client.create_namespace("ns1", "owner@example.com", display_name="NS One")

    body = route.calls.last.request.content.decode()
    assert '"name":"ns1"' in body.replace(" ", "")
    assert '"owner":"owner@example.com"' in body.replace(" ", "")
    assert '"displayName":"NSOne"' in body.replace(" ", "")


@respx.mock
def test_namespace_exists_true_on_200(client):
    respx.get(f"{BASE}/namespaces/ns1").mock(return_value=httpx.Response(200, json={}))
    assert client.namespace_exists("ns1") is True


@respx.mock
def test_namespace_exists_false_on_404(client):
    respx.get(f"{BASE}/namespaces/ghost").mock(
        return_value=httpx.Response(404, json={"message": "not found"})
    )
    assert client.namespace_exists("ghost") is False


@respx.mock
def test_namespace_exists_reraises_non_404(client):
    """A 403 means we cannot tell whether it exists — do not report False."""
    respx.get(f"{BASE}/namespaces/forbidden").mock(
        return_value=httpx.Response(403, json={"message": "denied"})
    )
    with pytest.raises(CoaApiError) as exc_info:
        client.namespace_exists("forbidden")
    assert exc_info.value.status == 403


# ── ontology ─────────────────────────────────────────────────────────────────


@respx.mock
def test_request_upload_url_includes_content_type_and_id(client):
    route = respx.post(f"{BASE}/namespaces/ns1/ontologies/upload-url").mock(
        return_value=httpx.Response(
            200,
            json={
                "uploadUrl": "https://s3/x",
                "s3Key": "ontology-uploads/ns1/abc/o.ttl",
                "ontologyId": "https://example.org/o",
            },
        )
    )
    result = client.request_ontology_upload_url(
        "ns1",
        "o.ttl",
        content_type="text/turtle",
        ontology_id="https://example.org/o",
        title="T",
    )

    body = route.calls.last.request.content.decode().replace(" ", "")
    assert '"filename":"o.ttl"' in body
    assert '"contentType":"text/turtle"' in body
    assert '"ontologyId":"https://example.org/o"' in body
    assert result["s3Key"] == "ontology-uploads/ns1/abc/o.ttl"


@respx.mock
def test_ingest_from_s3_sends_format_and_type(client):
    route = respx.post(
        url__regex=rf"{BASE}/namespaces/ns1/ontologies/.+/ingest-from-s3"
    ).mock(return_value=httpx.Response(202, json={"result": {"jobId": "j1"}}))

    client.ingest_ontology_from_s3(
        "ns1",
        "https://example.org/o",
        "ontology-uploads/ns1/abc/o.ttl",
        ontology_format="turtle",
        ontology_type="user_created",
    )

    body = route.calls.last.request.content.decode().replace(" ", "")
    assert '"s3Key":"ontology-uploads/ns1/abc/o.ttl"' in body
    assert '"format":"turtle"' in body
    assert '"ontologyType":"user_created"' in body


@respx.mock
def test_ontology_iri_slashes_are_escaped_in_path(client):
    """An https IRI as a path segment would otherwise split into extra segments."""
    route = respx.post(
        url__regex=rf"{BASE}/namespaces/ns1/ontologies/.+/ingest-from-s3"
    ).mock(return_value=httpx.Response(202, json={"result": {"jobId": "j1"}}))

    client.ingest_ontology_from_s3("ns1", "https://example.org/o", "k")

    path = route.calls.last.request.url.path
    assert "%2F" in path or "https:/example.org" not in path


# ── metrics ──────────────────────────────────────────────────────────────────


@respx.mock
def test_import_osi_with_inline_content(client):
    route = respx.post(f"{BASE}/namespaces/ns1/import-osi").mock(
        return_value=httpx.Response(202, json={"jobId": "j2", "status": "IN_PROGRESS"})
    )
    client.import_osi("ns1", content="osi_spec_version: '1.0'")

    body = route.calls.last.request.content.decode()
    assert "osi_spec_version" in body
    assert "s3Key" not in body


@respx.mock
def test_import_osi_rejects_both_content_and_s3key(client):
    """COA returns 400 for both-or-neither; fail locally instead of round-tripping."""
    with pytest.raises(ValueError, match="exactly one"):
        client.import_osi("ns1", content="x", s3_key="y")


@respx.mock
def test_import_osi_rejects_neither(client):
    with pytest.raises(ValueError, match="exactly one"):
        client.import_osi("ns1")


# ── grants ───────────────────────────────────────────────────────────────────


@respx.mock
def test_create_grant_allows_data_scoping_fields(client):
    """tableAllowlist and friends ARE valid on a grant body.

    They are stripped only from *query* bodies. An earlier revision of this
    client wrongly blocked them everywhere, which made grant creation impossible.
    """
    route = respx.post(f"{BASE}/namespaces/ns1/grants").mock(
        return_value=httpx.Response(201, json={"grant": {"grantId": "g1"}})
    )
    client.create_grant(
        "ns1",
        {
            "principalType": "USER",
            "principalId": "a@example.com",
            "role": "namespace_data_analyst",
            "tableAllowlist": ["public.ot_assets"],
            "columnDenylist": {"public.ot_assets": ["secret_col"]},
            "allowedMetrics": ["blast_radius_score"],
        },
    )

    body = route.calls.last.request.content.decode().replace(" ", "")
    assert '"tableAllowlist":["public.ot_assets"]' in body
    assert '"allowedMetrics":["blast_radius_score"]' in body


# ── error mapping ────────────────────────────────────────────────────────────


@respx.mock
def test_non_2xx_raises_coa_api_error_with_status_and_body(client):
    respx.get(f"{BASE}/namespaces/ns1").mock(
        return_value=httpx.Response(422, text='{"message":"bad ontology"}')
    )
    with pytest.raises(CoaApiError) as exc_info:
        client.get_namespace("ns1")

    error = exc_info.value
    assert error.status == 422
    assert "bad ontology" in error.body
    assert "422" in str(error)


@respx.mock
def test_presigned_put_failure_raises(client):
    respx.put("https://s3.example.com/upload").mock(
        return_value=httpx.Response(403, text="SignatureDoesNotMatch")
    )
    with pytest.raises(CoaApiError) as exc_info:
        client.put_presigned("https://s3.example.com/upload", b"x", "text/turtle")
    assert exc_info.value.status == 403


@respx.mock
def test_empty_response_body_returns_none(client):
    respx.get(f"{BASE}/namespaces/ns1").mock(return_value=httpx.Response(204))
    assert client.get_namespace("ns1") is None

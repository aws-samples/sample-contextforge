"""Exception hierarchy for coa-pack.

Kept deliberately small. Everything a user can cause is a ``PackError``
subclass so the CLI can render one clean message instead of a traceback.
"""

from __future__ import annotations


class PackError(Exception):
    """Base for every error this tool raises on purpose."""


class PackValidationError(PackError):
    """A pack on disk is malformed.

    Carries a list of ``(pointer, message)`` findings so the CLI can print
    every problem at once rather than making the author fix them one per run.
    """

    def __init__(self, findings: list[tuple[str, str]]) -> None:
        self.findings = findings
        detail = "\n".join(f"  {pointer}: {message}" for pointer, message in findings)
        super().__init__(f"pack validation failed ({len(findings)} finding(s)):\n{detail}")


class CoaApiError(PackError):
    """A COA REST call returned a non-2xx status."""

    def __init__(self, method: str, url: str, status: int, body: str) -> None:
        self.method = method
        self.url = url
        self.status = status
        self.body = body
        super().__init__(f"{method} {url} -> HTTP {status}: {body[:500]}")


class JobFailedError(PackError):
    """An async COA job reached a terminal failure state."""

    def __init__(self, kind: str, job_id: str, status: str, detail: str | None = None) -> None:
        self.kind = kind
        self.job_id = job_id
        self.status = status
        self.detail = detail
        suffix = f": {detail}" if detail else ""
        super().__init__(f"{kind} job {job_id} finished with status={status}{suffix}")


class JobTimeoutError(PackError):
    """An async COA job did not reach a terminal state within the budget."""

    def __init__(self, kind: str, job_id: str, last_status: str, waited: float) -> None:
        self.kind = kind
        self.job_id = job_id
        self.last_status = last_status
        self.waited = waited
        super().__init__(
            f"{kind} job {job_id} still {last_status} after {waited:.0f}s; giving up. "
            f"The job may still complete server-side — re-check before retrying."
        )

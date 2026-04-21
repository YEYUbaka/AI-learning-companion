"""Application-specific exceptions."""

from typing import Optional


class UpstreamServiceError(Exception):
    """Raised when a dependency fails and we want to preserve its status context."""

    def __init__(
        self,
        message: str,
        http_status: int,
        upstream_status: Optional[int] = None,
        provider: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.http_status = http_status
        self.upstream_status = upstream_status
        self.provider = provider

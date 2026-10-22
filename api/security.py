"""Security and firewall protections for Movie Roulette API.

Guards endpoints against abuse, oversized payloads, invalid input shapes,
and excessive list parsing.
"""

import re

from .utils import error_response

# Security thresholds
MAX_PAYLOAD_SIZE = 32 * 1024  # 32 KB
MAX_URLS = 5
MAX_URL_LENGTH = 255
MAX_SLUG_LENGTH = 120
SLUG_PATTERN = re.compile(r"^[a-z0-9\-]+$", re.IGNORECASE)


def init_security(app):
    """Initializes Flask app security configs and payload error handlers."""
    app.config["MAX_CONTENT_LENGTH"] = MAX_PAYLOAD_SIZE

    @app.errorhandler(413)
    def request_entity_too_large(error):
        return error_response("Payload too large", 413)


def validate_metadata_input(data):
    """Validates input payload for /api/metadata.

    Returns:
        tuple: (urls, None) on success, or (None, error_response) on failure.
    """
    raw_urls = (data or {}).get("urls", [])
    if not isinstance(raw_urls, list):
        return None, error_response("Invalid payload: urls must be a list", 400)

    urls = [u.strip() for u in raw_urls if isinstance(u, str) and u.strip()]
    if not urls:
        return None, error_response("No URLs")

    if len(urls) > MAX_URLS:
        return None, error_response(f"Maximum {MAX_URLS} lists allowed per request", 400)

    for url in urls:
        if len(url) > MAX_URL_LENGTH:
            return None, error_response("URL exceeds maximum length", 400)

    return urls, None


def validate_select_input(data):
    """Validates input payload for /api/select.

    Returns:
        tuple: (lists, total, mode, None) on success, or (None, None, None, error_response) on failure.
    """
    data = data or {}
    lists = data.get("lists", [])
    total = data.get("total", 0)
    mode = data.get("mode", "proportional")

    if not lists or not isinstance(lists, list):
        return None, None, None, error_response("No lists")

    if len(lists) > MAX_URLS:
        return None, None, None, error_response(f"Maximum {MAX_URLS} lists allowed", 400)

    if not isinstance(total, int) or total <= 0:
        return None, None, None, error_response("Invalid total movie count", 400)

    return lists, total, mode, None


def validate_details_input(data):
    """Validates input payload for /api/details.

    Returns:
        tuple: (slug, None) on success, or (None, error_response) on failure.
    """
    data = data or {}
    slug = data.get("slug")
    if not slug:
        return None, error_response("No slug")

    if (
        not isinstance(slug, str)
        or len(slug) > MAX_SLUG_LENGTH
        or not SLUG_PATTERN.match(slug)
    ):
        return None, error_response("Invalid movie slug", 400)

    return slug, None

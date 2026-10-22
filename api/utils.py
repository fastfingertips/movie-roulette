import json
import logging
import re
import time
from functools import wraps

from flask import jsonify
from letterboxdpy.core.exceptions import (
    AccessDeniedError,
    PrivateRouteError,
    ResourceNotFoundError,
)

logger = logging.getLogger("movie_roulette")

LETTERBOXD_UNAVAILABLE_MESSAGE = (
    "Don't worry—this isn't an issue on your side. Letterboxd is temporarily "
    "blocking requests from our server. Please try again later."
)


def progress_step(name):
    """Decorator to log and time specific backend operations"""

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start = time.time()
            logger.debug("Starting step -> %s", name)
            try:
                result = func(*args, **kwargs)
                duration = time.time() - start
                logger.debug("Finished step -> %s (%.2fs)", name, duration)
                return result
            except Exception as e:
                logger.warning("FAILED step -> %s - Error: %s", name, e)
                raise e

        return wrapper

    return decorator


class ExtractedInfo(tuple):
    def __new__(cls, user, slug, is_watchlist=False):
        instance = super().__new__(cls, (user, slug))
        instance.user = user
        instance.slug = slug
        instance.is_watchlist = is_watchlist
        return instance


def extract_info(val):
    val = val.strip().lower()
    # Strip query parameters and URL fragments
    val = re.sub(r"[?#].*$", "", val)

    if re.match(r"^https?://", val) and not re.match(
        r"^https?://(www\.)?letterboxd\.com/", val
    ):
        return None, None

    # Clean up standard URL prefixes
    val = re.sub(r"^https?://(www\.)?letterboxd\.com/", "", val)
    val = re.sub(r"^letterboxd\.com/", "", val)

    parts = [p for p in val.split("/") if p]

    # Handle single username (treat as watchlist)
    if len(parts) == 1 and parts[0] not in ("films", "lists", "activity", "members"):
        return ExtractedInfo(parts[0], "watchlist", is_watchlist=True)

    # Format: user/list/slug (always a custom list, even if slug is 'watchlist')
    if len(parts) >= 3 and parts[1] == "list":
        return ExtractedInfo(parts[0], parts[2], is_watchlist=False)
    # Format: user/slug or user/watchlist
    elif len(parts) >= 2:
        # ignore generic pages but ALLOW 'watchlist'
        if parts[1] == "watchlist":
            return ExtractedInfo(parts[0], "watchlist", is_watchlist=True)

        if parts[1] not in (
            "films",
            "following",
            "followers",
            "reviews",
            "lists",
        ):
            return ExtractedInfo(parts[0], parts[1], is_watchlist=False)

    return None, None


def get_error_response(e):
    """Maps exceptions to user-facing messages and HTTP status codes."""
    if isinstance(e, PrivateRouteError):
        return "This user's watchlist or list is private on Letterboxd.", 403

    if isinstance(e, ResourceNotFoundError):
        return "The requested list or user could not be found on Letterboxd.", 404

    if isinstance(e, AccessDeniedError):
        return LETTERBOXD_UNAVAILABLE_MESSAGE, 503

    msg = str(e)
    if any(
        marker in msg.lower()
        for marker in ("ip or vpn blocked", "letterboxd is blocking this request")
    ):
        return LETTERBOXD_UNAVAILABLE_MESSAGE, 503

    try:
        data = json.loads(msg)
        return data.get("message", msg), 500
    except Exception:
        try:
            return json.loads(msg.split("\n")[0]).get("message", msg), 500
        except Exception:
            return msg, 500


def json_error(e, log_message=None, logger_func=None):
    """Maps an exception to a JSON error response and logs it."""
    if log_message:
        log = logger_func or logger.exception
        log(log_message)
    msg, status = get_error_response(e)
    return jsonify({"error": msg}), status

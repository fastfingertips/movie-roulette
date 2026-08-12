import json
import re
import time
from functools import wraps


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
            print(f"DEBUG: Starting step -> {name}")
            try:
                result = func(*args, **kwargs)
                duration = time.time() - start
                print(f"DEBUG: Finished step -> {name} ({duration:.2f}s)")
                return result
            except Exception as e:
                print(f"DEBUG: FAILED step -> {name} - Error: {str(e)}")
                raise e

        return wrapper

    return decorator


def extract_info(val):
    val = val.strip().lower()
    if re.match(r"^https?://", val) and not re.match(
        r"^https?://(www\.)?letterboxd\.com/", val
    ):
        return None, None

    # Clean up standard URL prefixes
    val = re.sub(r"^https?://(www\.)?letterboxd\.com/", "", val)
    val = re.sub(r"^letterboxd\.com/", "", val)

    parts = [p for p in val.split("/") if p]

    # Handle single username (treat as watchlist)
    if len(parts) == 1:
        if parts[0] not in ("films", "lists", "activity", "members"):
            return parts[0], "watchlist"

    # Format: user/list/slug
    if len(parts) >= 3 and parts[1] == "list":
        return parts[0], parts[2]
    # Format: user/slug or user/watchlist
    elif len(parts) >= 2:
        # ignore generic pages but ALLOW 'watchlist'
        if parts[1] == "watchlist":
            return parts[0], "watchlist"

        if parts[1] not in (
            "films",
            "following",
            "followers",
            "reviews",
            "lists",
        ):
            return parts[0], parts[1]

    return None, None


def get_error_msg(e):
    msg = str(e)
    if any(
        marker in msg.lower()
        for marker in ("ip or vpn blocked", "letterboxd is blocking this request")
    ):
        return LETTERBOXD_UNAVAILABLE_MESSAGE
    try:
        # Check if the message itself is a JSON string
        data = json.loads(msg)
        return data.get("message", msg)
    except Exception:
        try:
            # letterboxdpy sometimes throws JSON-structured errors in the first line
            return json.loads(msg.split("\n")[0]).get("message", msg)
        except Exception:
            return msg

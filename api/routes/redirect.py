import logging
import random
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote_plus

from flask import Blueprint, jsonify, redirect, request
from letterboxdpy.core.exceptions import PrivateRouteError, ResourceNotFoundError

from api.scraper import (
    get_list_metadata,
    get_random_movie_meta,
    pick_weighted_list,
    resolve_metadata_error,
)
from api.security import MAX_URLS
from api.utils import extract_info, get_error_response

logger = logging.getLogger("movie_roulette")

redirect_bp = Blueprint("redirect", __name__)

NO_CACHE_HEADERS = {
    "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
    "Pragma": "no-cache",
}


def _apply_no_cache(response):
    """Sets cache prevention headers on redirects."""
    for header, value in NO_CACHE_HEADERS.items():
        response.headers[header] = value
    return response


def _build_error_redirect(message, offending_url=None):
    """Builds a 302 redirect back to the web UI with toast error parameters."""
    target = f"/?error={quote_plus(message)}"
    if offending_url:
        target += f"&url={quote_plus(offending_url)}"
    return _apply_no_cache(redirect(target, code=302))


def _wants_json():
    """Checks whether caller explicitly prefers JSON over HTTP redirect."""
    format_arg = request.args.get("format", "").lower()
    if format_arg == "json":
        return True
    accept = request.headers.get("Accept", "")
    return "application/json" in accept and "text/html" not in accept


def handle_redirect_request(list_path=None):
    """Executes server-side movie selection and responds with 302 Found redirect."""
    req_start = time.time()
    raw_tokens = []

    if list_path:
        raw_tokens.append(list_path.strip())

    for key in ("url", "urls", "src", "sources", "list", "lists"):
        for val in request.args.getlist(key):
            for part in val.split(","):
                part_clean = part.strip()
                if part_clean:
                    raw_tokens.append(part_clean)

    if not raw_tokens:
        logger.info("Redirect requested without URL, bouncing to home")
        return _build_error_redirect("No list URL provided")

    urls = raw_tokens[:MAX_URLS]
    first_url = urls[0]

    shuffle_arg = request.args.get("shuffle", "").lower()
    random_arg = request.args.get("random", "").lower()
    if shuffle_arg in ("1", "true") or random_arg in ("letterboxd", "shuffle"):
        random_mode = "letterboxd"
    else:
        random_mode = "custom"

    sampling_mode = request.args.get("mode", "proportional").lower()
    if sampling_mode not in ("proportional", "equal"):
        sampling_mode = "proportional"

    # Parse and validate each input list
    parsed_items = []
    seen_keys = set()
    for raw in urls:
        info = extract_info(raw)
        if not info or not info[0]:
            logger.warning("Invalid list URL in redirect: '%s'", raw)
            return _build_error_redirect(f"Invalid Letterboxd URL: '{raw}'", raw)
        user, slug = info[0], info[1]
        is_watchlist = getattr(info, "is_watchlist", slug == "watchlist")
        key = (user, slug, is_watchlist)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        parsed_items.append((user, slug, is_watchlist, raw))

    if not parsed_items:
        return _build_error_redirect("No valid Letterboxd lists provided", first_url)

    count_arg = request.args.get("count") or request.args.get("total")
    pages_arg = request.args.get("pages")
    hint_count = None

    if count_arg:
        try:
            val = int(count_arg)
            if val > 0:
                hint_count = val
        except (ValueError, TypeError):
            pass
    elif pages_arg:
        try:
            pages_val = int(pages_arg)
            if pages_val > 0:
                per_page = 28 if parsed_items[0][2] else 100
                hint_count = pages_val * per_page
        except (ValueError, TypeError):
            pass

    # Fast single-request path when count/pages hint is supplied for a single list
    if len(parsed_items) == 1 and hint_count and random_mode == "custom":
        user, slug, is_watchlist, raw = parsed_items[0]
        try:
            meta = get_random_movie_meta(
                user,
                slug,
                hint_count,
                is_watchlist=is_watchlist,
                random_mode="custom",
            )
        except (ResourceNotFoundError, PrivateRouteError) as err:
            resolved = resolve_metadata_error(err, user, slug, is_watchlist)
            msg, _ = get_error_response(resolved)
            return _build_error_redirect(msg, raw)
        except Exception as err:
            msg, _ = get_error_response(err)
            logger.warning("Fast hint_count redirect selection failed: %s", msg)
            return _build_error_redirect(msg, raw)

        if not meta or not meta.get("slug"):
            logger.warning("No movie selected with hint_count for '%s'", slug)
            return _build_error_redirect(
                "Failed to pick a movie from the list. Please try again.",
                raw,
            )

        film_slug = meta["slug"]
        dest_url = f"https://letterboxd.com/film/{film_slug}/"
        logger.info(
            "Single-request direct redirect to '%s' (hint_count: %d) in %.2fs",
            dest_url,
            hint_count,
            time.time() - req_start,
        )
        if _wants_json():
            return jsonify({"url": dest_url, "slug": film_slug, "meta": meta})
        return _apply_no_cache(redirect(dest_url, code=302))

    fetch_random_mode = random_mode if len(parsed_items) == 1 else "custom"

    def fetch_worker(item):
        user, slug, is_watchlist, raw = item
        try:
            data = get_list_metadata(
                user,
                slug,
                is_watchlist=is_watchlist,
                random_mode=fetch_random_mode,
            )
        except (ResourceNotFoundError, PrivateRouteError) as err:
            raise resolve_metadata_error(err, user, slug, is_watchlist) from err

        candidate = data[2] if len(data) > 2 else None
        return {
            "user": user,
            "slug": slug,
            "title": data[0],
            "count": data[1],
            "url": raw,
            "is_watchlist": is_watchlist,
            "candidate": candidate,
        }

    try:
        if len(parsed_items) == 1:
            results = [fetch_worker(parsed_items[0])]
        else:
            max_workers = min(len(parsed_items), 5)
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                results = list(executor.map(fetch_worker, parsed_items))
    except Exception as err:
        msg, _ = get_error_response(err)
        logger.warning("Metadata fetch in redirect failed: %s", msg)
        return _build_error_redirect(msg, first_url)

    # Validate non-empty counts
    for item in results:
        if item["count"] <= 0:
            target = (
                "watchlist"
                if item.get("is_watchlist")
                else f"list '{item['slug']}'"
            )
            msg = f"The {target} for '{item['user']}' is empty on Letterboxd"
            logger.info("Empty list in redirect: %s", msg)
            return _build_error_redirect(msg, item["url"])

    # Single list optimization with Letterboxd shuffle candidate
    if len(results) == 1 and results[0].get("candidate"):
        cand = results[0]["candidate"]
        film_slug = cand.get("slug")
        if film_slug:
            dest_url = f"https://letterboxd.com/film/{film_slug}/"
            logger.info(
                "Fast single-request redirect to '%s' (candidate) in %.2fs",
                dest_url,
                time.time() - req_start,
            )
            if _wants_json():
                return jsonify({"url": dest_url, "slug": film_slug, "meta": cand})
            return _apply_no_cache(redirect(dest_url, code=302))

    # Select list from pool
    if len(results) == 1:
        chosen_list = results[0]
    elif sampling_mode == "equal":
        chosen_list = random.choice(results)
    else:
        total = sum(i["count"] for i in results)
        chosen_list = pick_weighted_list(results, total)

    try:
        meta = get_random_movie_meta(
            chosen_list["user"],
            chosen_list["slug"],
            chosen_list["count"],
            is_watchlist=chosen_list.get("is_watchlist"),
            random_mode=random_mode,
        )
    except Exception as err:
        msg, _ = get_error_response(err)
        logger.warning("Random selection in redirect failed: %s", msg)
        return _build_error_redirect(msg, chosen_list["url"])

    if not meta or not meta.get("slug"):
        logger.warning("No movie selected in redirect for '%s'", chosen_list["slug"])
        return _build_error_redirect(
            "Failed to pick a movie from the list. Please try again.",
            chosen_list["url"],
        )

    film_slug = meta["slug"]
    dest_url = f"https://letterboxd.com/film/{film_slug}/"
    duration = time.time() - req_start
    logger.info(
        "Redirecting to '%s' from list '%s' in %.2fs",
        dest_url,
        chosen_list["slug"],
        duration,
    )

    if _wants_json():
        return jsonify({"url": dest_url, "slug": film_slug, "meta": meta})

    return _apply_no_cache(redirect(dest_url, code=302))


@redirect_bp.route("/r", methods=["GET"])
@redirect_bp.route("/api/redirect", methods=["GET"])
@redirect_bp.route("/api/r", methods=["GET"])
def route_redirect():
    return handle_redirect_request()


@redirect_bp.route("/r/<path:list_path>", methods=["GET"])
def route_redirect_path(list_path):
    return handle_redirect_request(list_path=list_path)

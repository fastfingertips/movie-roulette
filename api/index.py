import logging
import os
import random
import time
from concurrent.futures import ThreadPoolExecutor

from flask import Flask, jsonify, request, send_from_directory
from letterboxdpy.core.exceptions import PrivateRouteError, ResourceNotFoundError

from .constants import PORT, ROOT_DIR
from .scraper import (
    get_list_metadata,
    get_movie_details,
    get_random_movie_meta,
    pick_weighted_list,
    resolve_metadata_error,
)
from .security import (
    init_security,
    validate_details_input,
    validate_metadata_input,
    validate_select_input,
)
from .utils import error_response, extract_info, json_error

log_level = getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO)
logger = logging.getLogger("movie_roulette")
if not logger.handlers:
    logging.basicConfig(
        level=log_level,
        format="[%(asctime)s] [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
logger.setLevel(log_level)

STATIC_DIR = os.path.join(ROOT_DIR, "static")
app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="/static")
init_security(app)


@app.route("/")
@app.route("/index.html")
def index():
    return send_from_directory(ROOT_DIR, "index.html")


@app.route("/favicon.ico")
def favicon():
    return send_from_directory(STATIC_DIR, "favicon.svg", mimetype="image/svg+xml")


@app.route("/api/metadata", methods=["POST"])
@app.route("/metadata", methods=["POST"])
def api_metadata():
    try:
        req_start = time.time()
        urls, sampling_mode, random_mode, err = validate_metadata_input(request.json)
        if err:
            return err

        logger.info(
            "api_metadata requested with %d urls, sampling_mode: %s, random_mode: %s",
            len(urls),
            sampling_mode,
            random_mode,
        )

        # Pre-validate and extract user/slug upfront with duplicate detection
        parsed_items = []
        seen_keys = set()
        for url in urls:
            info = extract_info(url)
            if not info or not info[0]:
                return error_response("Invalid list URL")
            user, slug = info[0], info[1]
            is_watchlist = getattr(info, "is_watchlist", slug == "watchlist")
            key = (user, slug, is_watchlist)
            if key in seen_keys:
                if is_watchlist:
                    return error_response(f"Duplicate watchlist detected for '{user}'.")
                return error_response(f"Duplicate list detected: '{user}/{slug}'.")
            seen_keys.add(key)
            parsed_items.append((user, slug, is_watchlist, url))

        # Single-list vs multi-list random mode for metadata phase:
        # For single lists, Fast Shuffle fetches metadata and candidate in 1 request.
        # For multi-list, always use standard URLs ("custom") to avoid Cloudflare 403.
        fetch_random_mode = random_mode if len(parsed_items) == 1 else "custom"

        def fetch_metadata_worker(item):
            user, slug, is_watchlist, url = item
            try:
                try:
                    res = get_list_metadata(
                        user,
                        slug,
                        is_watchlist=is_watchlist,
                        random_mode=fetch_random_mode,
                    )
                except TypeError:
                    try:
                        res = get_list_metadata(user, slug, is_watchlist=is_watchlist)
                    except TypeError:
                        res = get_list_metadata(user, slug)
            except (ResourceNotFoundError, PrivateRouteError) as e:
                raise resolve_metadata_error(e, user, slug, is_watchlist) from e

            if len(res) == 3:
                title, count, candidate = res
            else:
                title, count = res
                candidate = None

            return {
                "user": user,
                "slug": slug,
                "title": title,
                "count": count,
                "url": url,
                "is_watchlist": is_watchlist,
                "candidate": candidate,
            }

        # Fetch metadata concurrently with ThreadPoolExecutor (order preserved)
        if len(parsed_items) == 1:
            try:
                results = [fetch_metadata_worker(parsed_items[0])]
            except Exception as e:
                return json_error(
                    e,
                    f"Metadata fetch failed for {parsed_items[0][3]} - {e}",
                    logger_func=logger.warning,
                )
        else:
            max_workers = min(len(parsed_items), 5)
            try:
                with ThreadPoolExecutor(max_workers=max_workers) as executor:
                    results = list(executor.map(fetch_metadata_worker, parsed_items))
            except Exception as e:
                return json_error(
                    e,
                    f"Metadata fetch failed - {e}",
                    logger_func=logger.warning,
                )

        list_data = []
        for item in results:
            if item["count"] <= 0:
                target = (
                    "watchlist"
                    if item.get("is_watchlist")
                    else f"list '{item['slug']}'"
                )
                return error_response(
                    f"The {target} for '{item['user']}' is empty on Letterboxd",
                    422,
                    user=item["user"],
                    slug=item["slug"],
                    is_watchlist=item.get("is_watchlist", False),
                    is_empty=True,
                )
            list_data.append(
                {
                    "user": item["user"],
                    "slug": item["slug"],
                    "title": item["title"],
                    "count": item["count"],
                    "is_watchlist": item["is_watchlist"],
                }
            )
            logger.debug("Found %d items in %s", item["count"], item["title"])

        total_count = sum(item["count"] for item in list_data)
        response_payload = {"lists": list_data, "total": total_count}

        # Fast Shuffle Optimization: Pre-select candidate in memory (0 extra requests)
        if random_mode == "letterboxd":
            valid_candidates = [
                item for item in results if item.get("candidate") and item["count"] > 0
            ]
            if valid_candidates:
                if sampling_mode == "equal":
                    winner_item = random.choice(valid_candidates)
                else:
                    winner_item = pick_weighted_list(valid_candidates, total_count)

                if winner_item and winner_item.get("candidate"):
                    response_payload["selected"] = {
                        "meta": winner_item["candidate"],
                        "list": {
                            "user": winner_item["user"],
                            "slug": winner_item["slug"],
                            "title": winner_item["title"],
                            "count": winner_item["count"],
                            "is_watchlist": winner_item["is_watchlist"],
                        },
                        "mode": sampling_mode,
                        "random_mode": "letterboxd",
                    }

        logger.info(
            "api_metadata success (%d lists, %d movies, pre_selected=%s) in %.2fs",
            len(list_data),
            total_count,
            bool(response_payload.get("selected")),
            time.time() - req_start,
        )
        return jsonify(response_payload)

    except Exception as e:
        return json_error(e, "api_metadata encountered an unexpected error")


@app.route("/api/select", methods=["POST"])
@app.route("/select", methods=["POST"])
def api_select():
    try:
        req_start = time.time()
        lists, total, mode, random_mode, err = validate_select_input(request.json)
        if err:
            return err

        logger.info(
            "api_select from %d lists, total pool: %d, mode: %s, random_mode: %s",
            len(lists),
            total,
            mode,
            random_mode,
        )

        # Pick a list: equal odds per list vs weighted by movie count
        if mode == "equal":
            selected = random.choice(lists)
        else:
            selected = pick_weighted_list(lists, total)

        if not selected:
            return error_response("Failed to pick a list")

        logger.debug(
            "Selected list: %s/%s (mode: %s, random_mode: %s)",
            selected["user"],
            selected["slug"],
            mode,
            random_mode,
        )
        # Get random movie meta
        meta = get_random_movie_meta(
            selected["user"],
            selected["slug"],
            selected["count"],
            is_watchlist=selected.get("is_watchlist"),
            random_mode=random_mode,
        )
        if not meta:
            return error_response(
                "Failed to pick a movie from the selected list. Please try again.",
                502,
            )

        duration = time.time() - req_start
        logger.info(
            "api_select picked movie: %s (%s) from '%s' in %.2fs",
            meta["name"],
            meta["slug"],
            selected["slug"],
            duration,
        )
        return jsonify(
            {
                "meta": meta,
                "list": selected,
                "mode": mode,
                "random_mode": random_mode,
            }
        )
    except Exception as e:
        return json_error(e, "api_select encountered an unexpected error")


@app.route("/api/details", methods=["POST"])
@app.route("/details", methods=["POST"])
def api_details():
    try:
        req_start = time.time()
        slug, err = validate_details_input(request.json)
        if err:
            return err

        movie = get_movie_details(slug)
        logger.info(
            "api_details success for '%s' in %.2fs", slug, time.time() - req_start
        )
        return jsonify({"movie": movie})
    except Exception as e:
        return json_error(
            e, f"api_details failed for slug: {(request.json or {}).get('slug')}"
        )


if __name__ == "__main__":
    logger.info("Starting server from: %s on port %s", ROOT_DIR, PORT)
    app.run(port=PORT, debug=True)

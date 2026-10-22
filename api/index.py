import logging
import os
import random
from concurrent.futures import ThreadPoolExecutor

from flask import Flask, jsonify, request, send_from_directory
from letterboxdpy.constants.project import DOMAIN
from letterboxdpy.core.exceptions import PrivateRouteError, ResourceNotFoundError
from letterboxdpy.core.scraper import parse_url

from .constants import PORT, ROOT_DIR
from .scraper import (
    get_list_metadata,
    get_movie_details,
    get_random_movie_meta,
    pick_weighted_list,
)
from .utils import error_response, extract_info, json_error

logger = logging.getLogger("movie_roulette")
if not logger.handlers:
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

STATIC_DIR = os.path.join(ROOT_DIR, "static")
app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="/static")


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
        urls = [u.strip() for u in (request.json or {}).get("urls", []) if u.strip()]
        logger.info("api_metadata requested with %d urls", len(urls))
        if not urls:
            return error_response("No URLs")

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

        def fetch_metadata_worker(item):
            user, slug, is_watchlist, url = item
            try:
                try:
                    title, count = get_list_metadata(user, slug, is_watchlist=is_watchlist)
                except TypeError:
                    title, count = get_list_metadata(user, slug)
            except ResourceNotFoundError as e:
                if is_watchlist:
                    # Watchlist 404: check profile to distinguish user-not-found vs watchlist-not-found
                    try:
                        parse_url(f"{DOMAIN}/{user}/")
                    except PrivateRouteError:
                        raise PrivateRouteError(
                            url=f"{DOMAIN}/{user}/watchlist/",
                            message=f"The watchlist or profile for '{user}' is private on Letterboxd"
                        ) from e
                    except Exception:
                        raise ResourceNotFoundError(
                            url=f"{DOMAIN}/{user}/",
                            message=f"User '{user}' could not be found on Letterboxd"
                        ) from e
                    # Profile exists but watchlist is gone/empty
                    raise ResourceNotFoundError(
                        url=f"{DOMAIN}/{user}/watchlist/",
                        message=f"User '{user}' exists, but their watchlist could not be found on Letterboxd"
                    ) from e
                raise ResourceNotFoundError(
                    url=f"{DOMAIN}/{user}/list/{slug}/",
                    message=f"The list '{user}/{slug}' could not be found on Letterboxd"
                ) from e
            except PrivateRouteError as e:
                # letterboxdpy already detected a 403; just add a user-friendly message
                target = "watchlist" if is_watchlist else f"list '{user}/{slug}'"
                raise PrivateRouteError(
                    url=e.url,
                    message=f"The {target} for '{user}' is private on Letterboxd"
                ) from e
            return {
                "user": user,
                "slug": slug,
                "title": title,
                "count": count,
                "url": url,
                "is_watchlist": is_watchlist,
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
                target = "watchlist" if item.get("is_watchlist") else f"list '{item['slug']}'"
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
        logger.info(
            "api_metadata success (%d lists, %d total movies)",
            len(list_data),
            total_count,
        )
        return jsonify({"lists": list_data, "total": total_count})

    except Exception as e:
        return json_error(e, "api_metadata encountered an unexpected error")


@app.route("/api/select", methods=["POST"])
@app.route("/select", methods=["POST"])
def api_select():
    try:
        data = request.json or {}
        lists = data.get("lists", [])
        total = data.get("total", 0)
        mode = data.get("mode", "proportional")
        logger.info(
            "api_select from %d lists, total pool: %d, mode: %s",
            len(lists),
            total,
            mode,
        )
        if not lists:
            return error_response("No lists")

        # Pick a list: equal odds per list vs weighted by movie count
        if mode == "equal":
            selected = random.choice(lists)
        else:
            selected = pick_weighted_list(lists, total)

        if not selected:
            return error_response("Failed to pick a list")

        logger.debug("Selected list: %s/%s (mode: %s)", selected["user"], selected["slug"], mode)
        # Get random movie meta
        meta = get_random_movie_meta(
            selected["user"],
            selected["slug"],
            selected["count"],
            is_watchlist=selected.get("is_watchlist"),
        )
        if not meta:
            return error_response(
                "Failed to pick a movie from the selected list. Please try again.",
                502,
            )

        logger.info("api_select picked movie: %s (%s)", meta["name"], meta["slug"])
        return jsonify({"meta": meta, "list": selected, "mode": mode})
    except Exception as e:
        return json_error(e, "api_select encountered an unexpected error")


@app.route("/api/details", methods=["POST"])
@app.route("/details", methods=["POST"])
def api_details():
    try:
        data = request.json or {}
        slug = data.get("slug")
        if not slug:
            return error_response("No slug")
        movie = get_movie_details(slug)
        return jsonify({"movie": movie})
    except Exception as e:
        return json_error(e, f"api_details failed for slug: {(request.json or {}).get('slug')}")



if __name__ == "__main__":
    logger.info("Starting server from: %s on port %s", ROOT_DIR, PORT)
    app.run(port=PORT, debug=True)

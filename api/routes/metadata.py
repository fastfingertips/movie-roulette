import logging
import random
import time
from concurrent.futures import ThreadPoolExecutor

from flask import Blueprint, jsonify, request
from letterboxdpy.core.exceptions import PrivateRouteError, ResourceNotFoundError

from api.scraper import (
    get_list_metadata,
    pick_weighted_list,
    resolve_metadata_error,
)
from api.security import validate_metadata_input
from api.utils import error_response, extract_info, json_error

logger = logging.getLogger("movie_roulette")

metadata_bp = Blueprint("metadata", __name__)


@metadata_bp.route("/api/metadata", methods=["POST"])
@metadata_bp.route("/metadata", methods=["POST"])
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

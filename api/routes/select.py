import logging
import random
import time

from flask import Blueprint, jsonify, request

from api.scraper import get_random_movie_meta, pick_weighted_list
from api.security import validate_select_input
from api.utils import error_response, json_error

logger = logging.getLogger("movie_roulette")

select_bp = Blueprint("select", __name__)


@select_bp.route("/api/select", methods=["POST"])
@select_bp.route("/select", methods=["POST"])
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

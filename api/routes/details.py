import logging
import time

from flask import Blueprint, jsonify, request

from api.scraper import get_movie_details
from api.security import validate_details_input
from api.utils import json_error

logger = logging.getLogger("movie_roulette")

details_bp = Blueprint("details", __name__)


@details_bp.route("/api/details", methods=["POST"])
@details_bp.route("/details", methods=["POST"])
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

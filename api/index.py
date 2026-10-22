import logging
import os

from flask import Flask, jsonify, request, send_from_directory

from .constants import PORT, ROOT_DIR
from .scraper import (
    get_list_metadata,
    get_movie_details,
    get_random_movie_meta,
    pick_weighted_list,
)
from .utils import extract_info, json_error

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
            return jsonify({"error": "No URLs"}), 400

        list_data = []
        for url in urls:
            user, slug = extract_info(url)
            if not user:
                return jsonify({"error": "Invalid list URL"}), 400

            try:
                # We only need the counts and names here
                title, count = get_list_metadata(user, slug)
            except Exception as e:
                return json_error(
                    e,
                    f"Metadata fetch failed for {url} - {e}",
                    logger_func=logger.warning,
                )

            if count <= 0:
                return jsonify({"error": "One of the lists is empty"}), 422

            list_data.append(
                {"user": user, "slug": slug, "title": title, "count": count}
            )
            logger.debug("Found %d items in %s", count, title)

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
        lists = request.json.get("lists", [])
        total = request.json.get("total", 0)
        logger.info("api_select from %d lists, total pool: %d", len(lists), total)
        if not lists:
            return jsonify({"error": "No lists"}), 400

        # Pick a list weighted by size
        selected = pick_weighted_list(lists, total)
        if not selected:
            return jsonify({"error": "Failed to pick a list"}), 400

        logger.debug("Selected list: %s/%s", selected["user"], selected["slug"])
        # Get random movie meta
        meta = get_random_movie_meta(
            selected["user"], selected["slug"], selected["count"]
        )
        if not meta:
            return (
                jsonify(
                    {
                        "error": "Failed to pick a movie from the selected list. Please try again."
                    }
                ),
                502,
            )

        logger.info("api_select picked movie: %s (%s)", meta["name"], meta["slug"])
        return jsonify({"meta": meta, "list": selected})
    except Exception as e:
        return json_error(e, "api_select encountered an unexpected error")


@app.route("/api/details", methods=["POST"])
@app.route("/details", methods=["POST"])
def api_details():
    try:
        slug = request.json.get("slug")
        if not slug:
            return jsonify({"error": "No slug"}), 400
        movie = get_movie_details(slug)
        return jsonify({"movie": movie})
    except Exception as e:
        return json_error(e, f"api_details failed for slug: {request.json.get('slug')}")


if __name__ == "__main__":
    logger.info("Starting server from: %s on port %s", ROOT_DIR, PORT)
    app.run(port=PORT, debug=True)

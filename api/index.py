import logging
import os

from flask import Flask, request, send_from_directory

from .constants import PORT, ROOT_DIR
from .routes import handle_redirect_request, init_routes
from .scraper import (
    get_list_metadata,
    get_movie_details,
    get_random_movie_meta,
    pick_weighted_list,
    resolve_metadata_error,
)
from .security import init_security

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

# Register modular route blueprints
init_routes(app)


@app.route("/")
@app.route("/index.html")
def index():
    if request.args.get("redirect") in ("1", "true"):
        return handle_redirect_request()
    return send_from_directory(ROOT_DIR, "index.html")


@app.route("/favicon.ico")
def favicon():
    return send_from_directory(STATIC_DIR, "favicon.svg", mimetype="image/svg+xml")


if __name__ == "__main__":
    logger.info("Starting server from: %s on port %s", ROOT_DIR, PORT)
    app.run(port=PORT, debug=True)

__all__ = [
    "app",
    "get_list_metadata",
    "get_movie_details",
    "get_random_movie_meta",
    "pick_weighted_list",
    "resolve_metadata_error",
]

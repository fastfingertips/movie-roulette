from .details import details_bp
from .metadata import metadata_bp
from .redirect import handle_redirect_request, redirect_bp
from .select import select_bp


def init_routes(app):
    """Registers all route blueprints on the Flask application."""
    app.register_blueprint(metadata_bp)
    app.register_blueprint(select_bp)
    app.register_blueprint(details_bp)
    app.register_blueprint(redirect_bp)


__all__ = [
    "details_bp",
    "handle_redirect_request",
    "init_routes",
    "metadata_bp",
    "redirect_bp",
    "select_bp",
]

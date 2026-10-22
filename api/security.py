"""Security and firewall protections for Movie Roulette API.

Implements industry-standard Pydantic v2 data models to validate,
sanitize, and guard all incoming request payloads against abuse,
oversized inputs, and malformed structures.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from .utils import error_response

# Global security thresholds
MAX_PAYLOAD_SIZE = 32 * 1024  # 32 KB
MAX_URLS = 5
MAX_URL_LENGTH = 255
MAX_SLUG_LENGTH = 120


class MetadataRequest(BaseModel):
    """Schema validation for /api/metadata requests."""

    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    urls: list[Annotated[str, Field(min_length=1, max_length=MAX_URL_LENGTH)]] = Field(
        min_length=1,
        max_length=MAX_URLS,
    )

    @field_validator("urls", mode="after")
    @classmethod
    def validate_urls_not_empty(cls, v: list[str]) -> list[str]:
        cleaned = [u for u in v if u]
        if not cleaned:
            raise ValueError("No URLs")
        return cleaned


class ListItem(BaseModel):
    """Schema for individual list metadata in select request."""

    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    user: str = Field(min_length=1, max_length=100)
    slug: str = Field(min_length=1, max_length=120)
    count: int = Field(gt=0)
    title: str | None = None
    is_watchlist: bool = False


class SelectRequest(BaseModel):
    """Schema validation for /api/select requests."""

    model_config = ConfigDict(extra="ignore")

    lists: list[ListItem] = Field(min_length=1, max_length=MAX_URLS)
    total: int = Field(gt=0)
    mode: Literal["proportional", "equal"] = "proportional"


class DetailsRequest(BaseModel):
    """Schema validation for /api/details requests."""

    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    slug: str = Field(
        min_length=1,
        max_length=MAX_SLUG_LENGTH,
        pattern=r"^[a-z0-9\-]+$",
    )


def init_security(app):
    """Initializes Flask app security configs and payload error handlers."""
    app.config["MAX_CONTENT_LENGTH"] = MAX_PAYLOAD_SIZE

    @app.errorhandler(413)
    def request_entity_too_large(error):
        return error_response("Payload too large", 413)


def format_validation_error(err: ValidationError) -> str:
    """Formats Pydantic ValidationError into a user-friendly API error message."""
    first_error = err.errors()[0]
    loc = first_error.get("loc", ())
    msg = first_error.get("msg", "Invalid request payload")
    err_type = first_error.get("type", "")

    if msg.startswith("Value error, "):
        msg = msg.replace("Value error, ", "")

    if "urls" in loc:
        if "too_short" in err_type:
            return "No URLs"
        if "too_long" in err_type:
            if loc == ("urls",):
                return f"Maximum {MAX_URLS} lists allowed per request"
            return "URL exceeds maximum length"

    if "lists" in loc:
        if "too_short" in err_type:
            return "No lists"
        if "too_long" in err_type:
            return f"Maximum {MAX_URLS} lists allowed"

    if "total" in loc:
        return "Invalid total movie count"

    if "slug" in loc:
        return "Invalid movie slug"

    return msg


def validate_metadata_input(data):
    """Validates /api/metadata input using Pydantic."""
    if not isinstance(data, dict):
        return None, error_response("Invalid payload", 400)
    try:
        req = MetadataRequest.model_validate(data)
        return req.urls, None
    except ValidationError as e:
        return None, error_response(format_validation_error(e), 400)


def validate_select_input(data):
    """Validates /api/select input using Pydantic."""
    if not isinstance(data, dict):
        return None, None, None, error_response("Invalid payload", 400)
    if "lists" in data and not data["lists"]:
        return None, None, None, error_response("No lists")
    try:
        req = SelectRequest.model_validate(data)
        lists = [item.model_dump() for item in req.lists]
        return lists, req.total, req.mode, None
    except ValidationError as e:
        return None, None, None, error_response(format_validation_error(e), 400)


def validate_details_input(data):
    """Validates /api/details input using Pydantic."""
    if not isinstance(data, dict):
        return None, error_response("Invalid payload", 400)
    if not data.get("slug"):
        return None, error_response("No slug")
    try:
        req = DetailsRequest.model_validate(data)
        return req.slug, None
    except ValidationError as e:
        return None, error_response(format_validation_error(e), 400)

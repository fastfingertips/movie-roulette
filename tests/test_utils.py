from letterboxdpy.core.exceptions import (
    AccessDeniedError,
    PrivateRouteError,
    ResourceNotFoundError,
)

from api.utils import extract_info, get_error_response, LETTERBOXD_UNAVAILABLE_MESSAGE
from tests.conftest import (
    TEST_LIST_URL,
    TEST_SLUG,
    TEST_USER,
    TEST_WATCHLIST_URL,
)


class TestExtractInfo:
    def test_plain_username_defaults_to_watchlist(self):
        user, slug = extract_info(TEST_USER)
        assert user == TEST_USER
        assert slug == "watchlist"

    def test_full_watchlist_url(self):
        user, slug = extract_info(TEST_WATCHLIST_URL)
        assert user == TEST_USER
        assert slug == "watchlist"

    def test_full_list_url(self):
        user, slug = extract_info(TEST_LIST_URL)
        assert user == TEST_USER
        assert slug == TEST_SLUG

    def test_list_with_detail_and_page(self):
        user, slug = extract_info(
            f"https://letterboxd.com/{TEST_USER}/list/{TEST_SLUG}/detail/page/2/"
        )
        assert user == TEST_USER
        assert slug == TEST_SLUG

    def test_short_user_slug_format(self):
        user, slug = extract_info(f"{TEST_USER}/{TEST_SLUG}")
        assert user == TEST_USER
        assert slug == TEST_SLUG

    def test_strips_query_and_hash(self):
        user, slug = extract_info(
            f"https://letterboxd.com/{TEST_USER}/list/{TEST_SLUG}/?sort=title#preview"
        )
        assert user == TEST_USER
        assert slug == TEST_SLUG

    def test_non_letterboxd_url_rejected(self):
        user, slug = extract_info("https://imdb.com/list/ls12345678/")
        assert user is None
        assert slug is None

    def test_system_routes_rejected(self):
        user, slug = extract_info("https://letterboxd.com/films/")
        assert user is None
        assert slug is None

    def test_empty_string(self):
        user, slug = extract_info("   ")
        assert user is None
        assert slug is None


class TestGetErrorResponse:
    def test_private_route_error(self):
        msg, status = get_error_response(PrivateRouteError("Private profile"))
        assert status == 403
        assert "private" in msg.lower()

    def test_resource_not_found_error(self):
        msg, status = get_error_response(ResourceNotFoundError("Not found"))
        assert status == 404
        assert "not be found" in msg.lower()

    def test_access_denied_error(self):
        msg, status = get_error_response(AccessDeniedError("Forbidden"))
        assert status == 503
        assert msg == LETTERBOXD_UNAVAILABLE_MESSAGE

    def test_ip_or_vpn_blocked_string(self):
        msg, status = get_error_response(
            Exception("Letterboxd is blocking this request from your IP")
        )
        assert status == 503
        assert msg == LETTERBOXD_UNAVAILABLE_MESSAGE

    def test_generic_exception(self):
        msg, status = get_error_response(Exception("Unknown internal error"))
        assert status == 500
        assert "Unknown internal error" in msg

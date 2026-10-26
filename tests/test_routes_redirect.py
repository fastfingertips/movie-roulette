from unittest.mock import patch

from letterboxdpy.core.exceptions import PrivateRouteError, ResourceNotFoundError

from .conftest import (
    TEST_LIST_TITLE,
    TEST_LIST_URL,
    TEST_MOVIE_META,
    TEST_MOVIE_SLUG,
    TEST_TOTAL_COUNT,
    TEST_USER,
    TEST_WATCHLIST_URL,
)


class TestRedirectRoutes:
    """Test suite for server-side 302 redirect functionality."""

    @patch("api.routes.redirect.get_random_movie_meta")
    @patch("api.routes.redirect.get_list_metadata")
    def test_redirect_standard_route_success(
        self, mock_metadata, mock_random, client
    ):
        mock_metadata.return_value = (TEST_LIST_TITLE, TEST_TOTAL_COUNT, None)
        mock_random.return_value = TEST_MOVIE_META

        response = client.get(f"/r?url={TEST_LIST_URL}")

        assert response.status_code == 302
        assert response.headers["Location"] == (
            f"https://letterboxd.com/film/{TEST_MOVIE_SLUG}/"
        )
        assert "no-cache" in response.headers["Cache-Control"]

    @patch("api.routes.redirect.get_random_movie_meta")
    @patch("api.routes.redirect.get_list_metadata")
    def test_redirect_path_shortcut(self, mock_metadata, mock_random, client):
        mock_metadata.return_value = (TEST_LIST_TITLE, TEST_TOTAL_COUNT, None)
        mock_random.return_value = TEST_MOVIE_META

        response = client.get(f"/r/{TEST_USER}/watchlist")

        assert response.status_code == 302
        assert response.headers["Location"] == (
            f"https://letterboxd.com/film/{TEST_MOVIE_SLUG}/"
        )

    @patch("api.routes.redirect.get_random_movie_meta")
    @patch("api.routes.redirect.get_list_metadata")
    def test_redirect_root_with_query_flag(
        self, mock_metadata, mock_random, client
    ):
        mock_metadata.return_value = (TEST_LIST_TITLE, TEST_TOTAL_COUNT, None)
        mock_random.return_value = TEST_MOVIE_META

        response = client.get(f"/?url={TEST_WATCHLIST_URL}&redirect=1")

        assert response.status_code == 302
        assert response.headers["Location"] == (
            f"https://letterboxd.com/film/{TEST_MOVIE_SLUG}/"
        )

    @patch("api.routes.redirect.get_random_movie_meta")
    @patch("api.routes.redirect.get_list_metadata")
    def test_redirect_root_with_redirect_true(
        self, mock_metadata, mock_random, client
    ):
        mock_metadata.return_value = (TEST_LIST_TITLE, TEST_TOTAL_COUNT, None)
        mock_random.return_value = TEST_MOVIE_META

        response = client.get(f"/?url={TEST_WATCHLIST_URL}&redirect=true")

        assert response.status_code == 302
        assert response.headers["Location"] == (
            f"https://letterboxd.com/film/{TEST_MOVIE_SLUG}/"
        )

    @patch("api.routes.redirect.get_random_movie_meta")
    @patch("api.routes.redirect.get_list_metadata")
    def test_redirect_api_alias(self, mock_metadata, mock_random, client):
        mock_metadata.return_value = (TEST_LIST_TITLE, TEST_TOTAL_COUNT, None)
        mock_random.return_value = TEST_MOVIE_META

        response = client.get(f"/api/redirect?url={TEST_LIST_URL}")

        assert response.status_code == 302
        assert response.headers["Location"] == (
            f"https://letterboxd.com/film/{TEST_MOVIE_SLUG}/"
        )

    @patch("api.routes.redirect.get_list_metadata")
    def test_redirect_shuffle_candidate_fast_path(self, mock_metadata, client):
        candidate = {"name": "The Substance", "slug": "the-substance-2024", "page": 1}
        mock_metadata.return_value = (TEST_LIST_TITLE, TEST_TOTAL_COUNT, candidate)

        response = client.get(f"/r?url={TEST_WATCHLIST_URL}&shuffle=1")

        assert response.status_code == 302
        assert response.headers["Location"] == (
            "https://letterboxd.com/film/the-substance-2024/"
        )

    @patch("api.routes.redirect.get_random_movie_meta")
    @patch("api.routes.redirect.get_list_metadata")
    def test_redirect_format_json(self, mock_metadata, mock_random, client):
        mock_metadata.return_value = (TEST_LIST_TITLE, TEST_TOTAL_COUNT, None)
        mock_random.return_value = TEST_MOVIE_META

        response = client.get(f"/r?url={TEST_LIST_URL}&format=json")

        assert response.status_code == 200
        data = response.get_json()
        assert data["slug"] == TEST_MOVIE_SLUG
        assert data["url"] == f"https://letterboxd.com/film/{TEST_MOVIE_SLUG}/"

    def test_redirect_missing_url(self, client):
        response = client.get("/r")

        assert response.status_code == 302
        assert "error=" in response.headers["Location"]
        assert "No+list+URL+provided" in response.headers["Location"]

    def test_redirect_invalid_url(self, client):
        response = client.get("/r?url=https://example.com/not-letterboxd")

        assert response.status_code == 302
        assert "error=" in response.headers["Location"]
        assert "Invalid+Letterboxd+URL" in response.headers["Location"]

    @patch("api.routes.redirect.get_list_metadata")
    def test_redirect_empty_list_redirects_to_ui(self, mock_metadata, client):
        mock_metadata.return_value = (TEST_LIST_TITLE, 0, None)

        response = client.get(f"/r?url={TEST_LIST_URL}")

        assert response.status_code == 302
        assert "error=" in response.headers["Location"]
        assert "empty" in response.headers["Location"].lower()

    @patch("api.routes.redirect.get_list_metadata")
    def test_redirect_private_list_error(self, mock_metadata, client):
        mock_metadata.side_effect = PrivateRouteError(
            url=TEST_WATCHLIST_URL,
            message="This watchlist is private",
        )

        response = client.get(f"/r?url={TEST_WATCHLIST_URL}")

        assert response.status_code == 302
        assert "error=" in response.headers["Location"]
        assert "private" in response.headers["Location"].lower()

    @patch("api.routes.redirect.get_list_metadata")
    def test_redirect_not_found_error(self, mock_metadata, client):
        mock_metadata.side_effect = ResourceNotFoundError(
            url=TEST_LIST_URL,
            message="User could not be found",
        )

        response = client.get(f"/r?url={TEST_LIST_URL}")

        assert response.status_code == 302
        assert "error=" in response.headers["Location"]
        assert "could+not+be+found" in response.headers["Location"].lower()

from unittest.mock import patch

from letterboxdpy.core.exceptions import ResourceNotFoundError

from tests.conftest import (
    TEST_LIST_ITEM,
    TEST_LIST_TITLE,
    TEST_LIST_URL,
    TEST_MOVIE_DETAILS,
    TEST_MOVIE_META,
    TEST_MOVIE_SLUG,
    TEST_TOTAL_COUNT,
)


class TestMockedRouteFlow:
    @patch("api.index.get_list_metadata")
    def test_metadata_success(self, mock_meta, client):
        mock_meta.return_value = (TEST_LIST_TITLE, TEST_TOTAL_COUNT)
        res = client.post("/api/metadata", json={"urls": [TEST_LIST_URL]})
        assert res.status_code == 200
        data = res.get_json()
        assert data["total"] == TEST_TOTAL_COUNT
        assert len(data["lists"]) == 1
        assert data["lists"][0]["title"] == TEST_LIST_TITLE

    @patch("api.index.get_list_metadata")
    def test_metadata_concurrent_multiple_urls_preserves_order(self, mock_meta, client):
        mock_meta.side_effect = lambda user, slug: (f"Title {slug}", 10 if slug == "list-1" else 20)
        res = client.post(
            "/api/metadata",
            json={"urls": ["user1/list-1", "user2/list-2"]},
        )
        assert res.status_code == 200
        data = res.get_json()
        assert data["total"] == 30
        assert len(data["lists"]) == 2
        assert data["lists"][0]["slug"] == "list-1"
        assert data["lists"][0]["title"] == "Title list-1"
        assert data["lists"][1]["slug"] == "list-2"
        assert data["lists"][1]["title"] == "Title list-2"

    @patch("api.index.get_list_metadata")
    def test_metadata_one_fails_propagates_error(self, mock_meta, client):
        def _side_effect(user, slug):
            if slug == "bad-list":
                raise ResourceNotFoundError("List not found")
            return ("Good List", 50)

        mock_meta.side_effect = _side_effect
        res = client.post(
            "/api/metadata",
            json={"urls": ["user1/good-list", "user2/bad-list"]},
        )
        assert res.status_code == 404
        data = res.get_json()
        assert "user2/bad-list" in data["error"]

    @patch("api.index.get_list_metadata")
    def test_metadata_one_empty_returns_422(self, mock_meta, client):
        mock_meta.side_effect = lambda user, slug: ("Empty List", 0) if slug == "empty" else ("Good List", 50)
        res = client.post(
            "/api/metadata",
            json={"urls": ["user1/good", "user2/empty"]},
        )
        assert res.status_code == 422

    @patch("api.index.get_random_movie_meta")
    def test_select_success(self, mock_select, client):
        mock_select.return_value = TEST_MOVIE_META
        res = client.post(
            "/api/select",
            json={"lists": [TEST_LIST_ITEM], "total": TEST_TOTAL_COUNT},
        )
        assert res.status_code == 200
        data = res.get_json()
        assert data["meta"]["name"] == TEST_MOVIE_META["name"]
        assert data["meta"]["slug"] == TEST_MOVIE_META["slug"]
        assert data["mode"] == "proportional"

    @patch("api.index.get_random_movie_meta")
    def test_select_equal_mode_success(self, mock_select, client):
        mock_select.return_value = TEST_MOVIE_META
        other_list = {"user": "other", "slug": "watchlist", "count": 10}
        res = client.post(
            "/api/select",
            json={
                "lists": [TEST_LIST_ITEM, other_list],
                "total": TEST_TOTAL_COUNT + 10,
                "mode": "equal",
            },
        )
        assert res.status_code == 200
        data = res.get_json()
        assert data["mode"] == "equal"
        assert data["list"]["slug"] in ("turkish", "watchlist")

    @patch("api.index.get_movie_details")
    def test_details_success(self, mock_details, client):
        mock_details.return_value = TEST_MOVIE_DETAILS
        res = client.post("/api/details", json={"slug": TEST_MOVIE_SLUG})
        assert res.status_code == 200
        data = res.get_json()
        assert data["movie"]["name"] == TEST_MOVIE_DETAILS["name"]
        assert data["movie"]["year"] == TEST_MOVIE_DETAILS["year"]

    def test_metadata_duplicate_watchlist_returns_400(self, client):
        res = client.post(
            "/api/metadata",
            json={"urls": ["bugracoskun", "bugracoskun/watchlist"]},
        )
        assert res.status_code == 400
        data = res.get_json()
        assert "Duplicate watchlist detected" in data["error"]

    def test_metadata_duplicate_list_returns_400(self, client):
        res = client.post(
            "/api/metadata",
            json={"urls": ["user1/list-1", "user1/list-1"]},
        )
        assert res.status_code == 400
        data = res.get_json()
        assert "Duplicate list detected" in data["error"]

    @patch("api.index.get_list_metadata")
    def test_metadata_allows_both_user_watchlist_and_custom_list_named_watchlist(
        self, mock_meta, client
    ):
        mock_meta.side_effect = lambda user, slug, is_watchlist=None: (
            f"{user}'s Watchlist" if is_watchlist else f"Custom List {slug}",
            15 if is_watchlist else 25,
        )
        res = client.post(
            "/api/metadata",
            json={"urls": ["user1", "user1/list/watchlist"]},
        )
        assert res.status_code == 200
        data = res.get_json()
        assert len(data["lists"]) == 2
        assert data["lists"][0]["is_watchlist"] is True
        assert data["lists"][0]["title"] == "user1's Watchlist"
        assert data["lists"][1]["is_watchlist"] is False
        assert data["lists"][1]["title"] == "Custom List watchlist"


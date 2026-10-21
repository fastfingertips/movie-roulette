from unittest.mock import patch

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

    @patch("api.index.get_movie_details")
    def test_details_success(self, mock_details, client):
        mock_details.return_value = TEST_MOVIE_DETAILS
        res = client.post("/api/details", json={"slug": TEST_MOVIE_SLUG})
        assert res.status_code == 200
        data = res.get_json()
        assert data["movie"]["name"] == TEST_MOVIE_DETAILS["name"]
        assert data["movie"]["year"] == TEST_MOVIE_DETAILS["year"]

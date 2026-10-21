import pytest

from api.scraper import get_list_metadata, get_random_movie_meta
from tests.conftest import TEST_SLUG, TEST_USER


@pytest.mark.smoke
class TestLiveLetterboxdSmoke:
    """Live smoke test that verifies Letterboxd website integration is functional."""

    def test_live_list_metadata(self):
        title, count = get_list_metadata(TEST_USER, TEST_SLUG)
        assert title is not None
        assert count > 0

    def test_live_random_movie_selection(self):
        meta = get_random_movie_meta(TEST_USER, TEST_SLUG, 10)
        assert meta is not None
        assert "name" in meta
        assert "slug" in meta

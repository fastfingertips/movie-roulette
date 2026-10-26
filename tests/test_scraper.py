from unittest.mock import MagicMock, patch

import pytest
from letterboxdpy.core.exceptions import ResourceNotFoundError

from api.scraper import get_list_metadata, get_random_movie_meta, pick_weighted_list


class TestPickWeightedList:
    def test_empty_lists_returns_none(self):
        assert pick_weighted_list([]) is None
        assert pick_weighted_list(None) is None

    def test_single_list_always_returned(self):
        single = [{"user": "alice", "slug": "watchlist", "count": 100}]
        picked = pick_weighted_list(single, 100)
        assert picked == single[0]

    def test_zero_total_fallback(self):
        lists = [
            {"user": "alice", "slug": "list-a", "count": 0},
            {"user": "bob", "slug": "list-b", "count": 0},
        ]
        picked = pick_weighted_list(lists, 0)
        assert picked in lists

    def test_statistical_distribution(self):
        # List A has 800 items (80%), List B has 200 items (20%)
        list_a = {"user": "alice", "slug": "list-a", "count": 800}
        list_b = {"user": "bob", "slug": "list-b", "count": 200}
        lists = [list_a, list_b]

        counts = {"list-a": 0, "list-b": 0}
        trials = 1000

        for _ in range(trials):
            choice = pick_weighted_list(lists, 1000)
            counts[choice["slug"]] += 1

        # Check that list-a is chosen roughly 80% (between 73% and 87%)
        ratio_a = counts["list-a"] / trials
        assert 0.73 <= ratio_a <= 0.87, f"Expected ~0.80, got {ratio_a}"


class TestScraperFallback:
    @patch("api.scraper.UserList")
    @patch("api.scraper.parse_url")
    def test_get_list_metadata_shuffle_fallback(self, mock_parse_url, mock_user_list):
        # Simulate Cloudflare 403 / challenge block on shuffle URL
        mock_parse_url.side_effect = Exception("Cloudflare 403 Challenge")
        mock_instance = MagicMock()
        mock_instance.get_title.return_value = "Fallback List"
        mock_instance.get_count.return_value = 42
        mock_user_list.return_value = mock_instance

        title, count, candidate = get_list_metadata(
            "alice", "my-list", random_mode="letterboxd"
        )
        assert title == "Fallback List"
        assert count == 42
        assert candidate is None

    @patch("api.scraper.parse_url")
    def test_get_list_metadata_reraises_404(self, mock_parse_url):
        mock_parse_url.side_effect = ResourceNotFoundError("List not found")
        with pytest.raises(ResourceNotFoundError):
            get_list_metadata("alice", "missing-list", random_mode="letterboxd")

    @patch("api.scraper.extract_movies_from_vertical_list")
    @patch("api.scraper.parse_url")
    def test_get_random_movie_meta_shuffle_fallback(
        self, mock_parse_url, mock_extract_movies
    ):
        # First call (shuffle_url) raises block, second call (page 1) succeeds
        mock_parse_url.side_effect = [
            Exception("Cloudflare 403 Challenge"),
            MagicMock(),  # page dom
        ]
        mock_extract_movies.return_value = {
            "movie-1": {"name": "Test Film", "slug": "test-film"}
        }

        meta = get_random_movie_meta(
            "alice", "my-list", count=10, random_mode="letterboxd"
        )
        assert meta is not None
        assert meta["slug"] == "test-film"
        assert meta["strategy"] == "custom"

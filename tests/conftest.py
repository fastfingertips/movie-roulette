import pytest

from api.index import app

# Shared Test Constants
TEST_USER = "bugracoskun"
TEST_SLUG = "turkish"
TEST_LIST_TITLE = "Turkish"
TEST_TOTAL_COUNT = 120
TEST_LIST_URL = f"https://letterboxd.com/{TEST_USER}/list/{TEST_SLUG}/"
TEST_WATCHLIST_URL = f"https://letterboxd.com/{TEST_USER}/watchlist/"

TEST_LIST_ITEM = {
    "user": TEST_USER,
    "slug": TEST_SLUG,
    "title": TEST_LIST_TITLE,
    "count": TEST_TOTAL_COUNT,
}

TEST_MOVIE_NAME = "Winter Sleep"
TEST_MOVIE_YEAR = 2014
TEST_MOVIE_SLUG = "winter-sleep"

TEST_MOVIE_META = {
    "name": TEST_MOVIE_NAME,
    "slug": TEST_MOVIE_SLUG,
    "page": 1,
}

TEST_MOVIE_DETAILS = {
    "name": TEST_MOVIE_NAME,
    "year": TEST_MOVIE_YEAR,
    "slug": TEST_MOVIE_SLUG,
    "url": f"https://letterboxd.com/film/{TEST_MOVIE_SLUG}/",
    "directors": [
        {
            "name": "Nuri Bilge Ceylan",
            "url": "https://letterboxd.com/director/nuri-bilge-ceylan/",
        }
    ],
    "cast": [],
    "genres": [{"name": "Drama", "url": "https://letterboxd.com/films/genre/drama/"}],
}


@pytest.fixture
def client():
    """Provides a clean Flask test client for tests."""
    app.config["TESTING"] = True
    with app.test_client() as test_client:
        yield test_client

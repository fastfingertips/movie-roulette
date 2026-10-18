import math
import random

from letterboxdpy.constants.project import DOMAIN
from letterboxdpy.core.scraper import parse_url
from letterboxdpy.pages.movie_profile import MovieProfile
from letterboxdpy.pages.user_list import UserList
from letterboxdpy.pages.user_watchlist import UserWatchlist
from letterboxdpy.utils.movies_extractor import extract_movies_from_vertical_list
from letterboxdpy.utils.utils_url import get_page_url

from .utils import progress_step


@progress_step("Fetching List Metadata")
def get_list_metadata(user, slug):
    """Returns (instance, title, count)"""
    if slug == "watchlist":
        watchlist = UserWatchlist(user)
        return watchlist, f"{user}'s Watchlist", watchlist.get_count()
    user_list = UserList(user, slug)
    return user_list, user_list.get_title(), user_list.get_count()


@progress_step("Selecting Random Movie from List")
def get_random_movie_meta(user, slug, count):
    """Fetches a random page from list and picks a movie slug"""
    if slug == "watchlist":
        list_url = f"{DOMAIN}/{user}/watchlist/"
        per_page = UserWatchlist.FILMS_PER_PAGE
    else:
        list_url = UserList.LIST_PATTERN % (user, slug)
        per_page = UserList.FILMS_PER_PAGE

    total_pages = math.ceil(count / per_page)
    random_page = random.randint(1, total_pages)
    page_dom = parse_url(get_page_url(list_url, random_page))

    movies_meta = extract_movies_from_vertical_list(page_dom)
    if not movies_meta and random_page > 1:
        page_dom = parse_url(get_page_url(list_url, 1))
        movies_meta = extract_movies_from_vertical_list(page_dom)

    if not movies_meta:
        return None

    candidate_id = random.choice(list(movies_meta.keys()))
    return movies_meta[candidate_id]  # {slug, name, year, url}


@progress_step("Fetching Film Details (Poster & Rating)")
def get_movie_details(slug):
    """Uses MovieProfile to get high-speed rich data"""
    profile = MovieProfile(slug)

    # Extract director from crew (include name and url)
    crew = profile.get_crew()
    directors = [
        {"name": d["name"], "url": d.get("url")} for d in crew.get("director", [])
    ]

    # Extract top cast (limit to 5, include name and url)
    cast_raw = profile.get_cast()
    cast = [
        {"name": c["name"], "role_name": c.get("role_name"), "url": c.get("url")}
        for c in cast_raw[:5]
    ]

    # Extract genre names (only actual genres, include name and url)
    genres_raw = profile.get_genres()
    genres = [
        {"name": g["name"], "url": g.get("url")}
        for g in genres_raw
        if g.get("type") == "genre"
    ]

    return {
        "name": profile.get_title(),
        "year": profile.get_year(),
        "slug": profile.slug,
        "url": profile.url,
        "poster": profile.get_poster(),
        "backdrop": profile.get_banner(),
        "rating": profile.get_rating(),
        "description": profile.get_description(),
        "tagline": profile.get_tagline(),
        "genres": genres,
        "cast": cast,
        "directors": directors,
    }

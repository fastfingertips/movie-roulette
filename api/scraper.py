import math
import random

from letterboxdpy.constants.project import DOMAIN
from letterboxdpy.core.exceptions import PrivateRouteError, ResourceNotFoundError
from letterboxdpy.core.scraper import parse_url
from letterboxdpy.pages.movie_profile import MovieProfile
from letterboxdpy.pages.user_list import UserList
from letterboxdpy.pages.user_watchlist import UserWatchlist
from letterboxdpy.utils.movies_extractor import extract_movies_from_vertical_list
from letterboxdpy.utils.utils_url import get_page_url

from .utils import progress_step


@progress_step("Fetching List Metadata")
def get_list_metadata(user, slug, is_watchlist=None):
    """Returns (title, count)"""
    if is_watchlist is True or (is_watchlist is None and slug == "watchlist"):
        watchlist = UserWatchlist(user)
        return f"{user}'s Watchlist", watchlist.get_count()
    user_list = UserList(user, slug)
    return user_list.get_title(), user_list.get_count()


def resolve_metadata_error(exc, user, slug, is_watchlist):
    """Enrich Letterboxd 404/403 exceptions with user-friendly messages."""
    if isinstance(exc, PrivateRouteError):
        target = "watchlist" if is_watchlist else f"list '{user}/{slug}'"
        return PrivateRouteError(
            url=exc.url,
            message=f"The {target} for '{user}' is private on Letterboxd",
        )

    if is_watchlist:
        # Watchlist 404: check profile to distinguish user vs watchlist 404
        try:
            parse_url(f"{DOMAIN}/{user}/")
        except PrivateRouteError:
            return PrivateRouteError(
                url=f"{DOMAIN}/{user}/watchlist/",
                message=(
                    f"The watchlist or profile for '{user}' "
                    "is private on Letterboxd"
                ),
            )
        except Exception:
            return ResourceNotFoundError(
                url=f"{DOMAIN}/{user}/",
                message=f"User '{user}' could not be found on Letterboxd",
            )
        # Profile exists but watchlist is gone/empty
        return ResourceNotFoundError(
            url=f"{DOMAIN}/{user}/watchlist/",
            message=(
                f"User '{user}' exists, but their watchlist "
                "could not be found on Letterboxd"
            ),
        )

    return ResourceNotFoundError(
        url=f"{DOMAIN}/{user}/list/{slug}/",
        message=f"The list '{user}/{slug}' could not be found on Letterboxd",
    )


def pick_weighted_list(lists, total=None):
    """Selects a list item weighted proportionally by its movie count."""
    if not lists:
        return None
    if total is None or total <= 0:
        total = sum(item.get("count", 0) for item in lists)
    if total <= 0:
        return random.choice(lists)

    target_index = random.randint(0, total - 1)
    current_sum = 0
    for item in lists:
        current_sum += item.get("count", 0)
        if target_index < current_sum:
            return item
    return lists[-1]


@progress_step("Selecting Random Movie from List")
def get_random_movie_meta(user, slug, count, is_watchlist=None):
    """Fetches a random page from list and picks a movie slug"""
    if is_watchlist is True or (is_watchlist is None and slug == "watchlist"):
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
        random_page = 1

    if not movies_meta:
        return None

    candidate_id = random.choice(list(movies_meta.keys()))
    meta = dict(movies_meta[candidate_id])
    meta["page"] = random_page
    return meta


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

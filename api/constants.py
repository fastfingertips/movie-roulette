import os

from letterboxdpy.pages.user_list import UserList
from letterboxdpy.pages.user_watchlist import UserWatchlist

# Server Configuration
PORT = 5050
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# App Limits & Logic
MAX_LIST_COUNT = 5
MOVIES_PER_PAGE_LIST = UserList.FILMS_PER_PAGE
MOVIES_PER_PAGE_WATCHLIST = UserWatchlist.FILMS_PER_PAGE
MOVIES_PER_PAGE = MOVIES_PER_PAGE_LIST
DEFAULT_ENGINE = "letterboxdpy-granular"

SERVER_TYPE = "Vercel/Flask"

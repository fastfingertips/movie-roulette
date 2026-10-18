import os

# Server Configuration
PORT = 5050
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# App Limits & Logic
MAX_LIST_COUNT = 5
MOVIES_PER_PAGE_LIST = 100
MOVIES_PER_PAGE_WATCHLIST = 28
MOVIES_PER_PAGE = MOVIES_PER_PAGE_LIST
DEFAULT_ENGINE = "letterboxdpy-granular"

SERVER_TYPE = "Vercel/Flask"

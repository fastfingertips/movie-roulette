import os

# Server Configuration
PORT = 5050
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# Letterboxd profile section slugs that are not valid user/list identifiers
RESERVED_SLUGS = frozenset(
    {"films", "following", "followers", "reviews", "lists", "activity", "members"}
)

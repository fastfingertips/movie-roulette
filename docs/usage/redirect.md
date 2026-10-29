# Direct Redirect (`/r`)

The `/r` endpoint resolves the list, selects a random film, and immediately returns an HTTP `302 Found` with `Location: https://letterboxd.com/film/<slug>/` — no frontend assets are loaded.

All responses include `Cache-Control: no-cache, no-store, must-revalidate` so bookmarks and automation triggers always receive a fresh pick.

## Examples

| Route | Description |
|---|---|
| `/r/<username>` | Pick from a user's watchlist (e.g. `/r/bugracoskun`) |
| `/r/<username>/list/<slug>` | Pick from a specific custom list |
| `/r/<username>/<slug>?count=1200` | Deep sample with known film count — skips the metadata request |
| `/r?url=<url>&shuffle=1` | Fast single-request pick using Letterboxd shuffle |
| `/r?url=user1,user2&mode=equal` | Combine multiple lists with equal selection chances |
| `/r?url=<username>&format=json` | JSON output with movie metadata and film URL |
| `/?url=<url>&redirect=1` | Direct redirect via the root URL parameter |
| `/generator` | Interactive URL Generator for building shareable links |

## Error Handling

If a target list is private, empty, or not found, the server redirects to `/?url=...&error=...` and displays an informative toast alert instead of returning a broken response.


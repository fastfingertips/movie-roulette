# JSON Response

Returned by `/r` when `format=json` is set, or when the `Accept` header contains `application/json` without `text/html`.

```json
{
  "url": "https://letterboxd.com/film/fallen-angels/",
  "slug": "fallen-angels",
  "meta": {
    "name": "Fallen Angels",
    "year": 1995,
    "slug": "fallen-angels",
    "url": "https://letterboxd.com/film/fallen-angels/",
    "page": 4,
    "strategy": "custom"
  }
}
```

| Field | Description |
|---|---|
| `url` | Letterboxd film page |
| `slug` | Letterboxd film slug |
| `meta.name` | Film title |
| `meta.year` | Release year |
| `meta.page` | List page the film was taken from |
| `meta.strategy` | Engine used: `custom` (Deep Sample) or `letterboxd` (Fast Shuffle) |

!!! warning
    On errors (private, empty, or missing list) `/r` still responds with a redirect to the app, not a JSON error body. Check for a non-JSON response in scripts.

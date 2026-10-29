# Internal API

These `POST` endpoints back the web app. They are not a stable public API; for scripts, use [`/r` with `format=json`](json.md).

Request bodies are validated with Pydantic v2. Invalid input returns `400` with an error message. Unknown fields are ignored.

## `POST /api/metadata`

Resolves lists and returns their film counts.

```json
{
  "urls": ["bugracoskun", "official/list/top-250-films"],
  "sampling_mode": "proportional",
  "random_mode": "custom"
}
```

| Field | Type | Rules |
|---|---|---|
| `urls` | string[] | 1 to 5 items, each 1 to 255 characters |
| `sampling_mode` | `proportional` \| `equal` | Optional |
| `random_mode` | `custom` \| `letterboxd` | Optional |

## `POST /api/select`

Picks a film from lists already resolved by `/api/metadata`.

```json
{
  "lists": [{ "user": "bugracoskun", "slug": "watchlist", "count": 420, "is_watchlist": true }],
  "total": 420,
  "mode": "proportional",
  "random_mode": "custom"
}
```

| Field | Type | Rules |
|---|---|---|
| `lists[].user` | string | 1 to 100 characters |
| `lists[].slug` | string | 1 to 120 characters |
| `lists[].count` | integer | Greater than 0 |
| `lists[].is_watchlist` | boolean | Optional |
| `total` | integer | Greater than 0 |

## `POST /api/details`

Returns poster, backdrop, rating, genres, director, cast, and tagline for a film.

```json
{ "slug": "fallen-angels" }
```

`slug` must match `^[a-z0-9-]+$`.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, or `ERROR` |

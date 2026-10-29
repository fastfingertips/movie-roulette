# API Routes

The backend is built with Flask Blueprints under `api/routes/`.

| Module | Route(s) | Description |
|---|---|---|
| `metadata.py` | `POST /api/metadata` | Concurrent multi-list metadata extraction via `ThreadPoolExecutor` |
| `select.py` | `POST /api/select` | Weighted and uniform random movie selection |
| `details.py` | `POST /api/details` | Movie profile enrichment (crew, cast, genres, banner) |
| `redirect.py` | `GET /r/...` | Server-side HTTP 302 redirection |

## Security

`api/security.py` applies Pydantic v2 schema validation on all incoming request bodies and sets security response headers on every route.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `INFO` | Python logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |


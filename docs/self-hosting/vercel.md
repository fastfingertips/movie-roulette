# Vercel Deployment

The production site runs on Vercel. Static files (`index.html`, `static/`) are served directly; only dynamic routes are rewritten to the Flask app in `api/index.py`.

## Routing (`vercel.json`)

| Source | Destination |
|---|---|
| `/` (with `redirect` query) | `api/index.py` |
| `/r`, `/r/*` | `api/index.py` |
| `/api`, `/api/*` | `api/index.py` |
| `/generator` | `index.html` |

Python functions have `maxDuration: 60`. Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) are applied to all paths.

## Deploying

1. Fork the repository.
2. Import it in the [Vercel dashboard](https://vercel.com/new).
3. Vercel detects the Python runtime from `requirements.txt`.
4. Deploy. No environment variables are required; `LOG_LEVEL` is optional.

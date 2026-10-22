# Movie Roulette 🎬

[![Website](https://img.shields.io/badge/website-roulette.bugra.co-ff8000?style=flat-square)](https://roulette.bugra.co)
![Python](https://img.shields.io/badge/python-3.12-blue?style=flat-square&logo=python)
![Flask](https://img.shields.io/badge/flask-3.1.3-black?style=flat-square&logo=flask)
![Vercel](https://img.shields.io/badge/vercel-deployed-black?style=flat-square&logo=vercel)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

A web application to pick a random movie from Letterboxd lists: **[roulette.bugra.co](https://roulette.bugra.co)**

> [!IMPORTANT]
> This repository is maintained as a boilerplate/draft. Most requests may fail during web scraping operations. While it works occasionally, it is not consistently stable, likely due to Cloudflare protection, and further optimization has not been prioritized.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/movie-roulette-dark.jpeg">
    <source media="(prefers-color-scheme: light)" srcset=".github/assets/movie-roulette-light.jpeg">
    <img alt="Movie Roulette Preview" src=".github/assets/movie-roulette-dark.jpeg" width="100%">
  </picture>
  <br>
  <sub><a href=".github/assets/movie-roulette-dark.jpeg" target="_blank">Dark Mode</a> | <a href=".github/assets/movie-roulette-light.jpeg" target="_blank">Light Mode</a></sub>
</p>


---

## Keyboard Shortcuts

| Shortcut | Context | Action |
|---|---|---|
| <kbd>Enter</kbd> | Form | Submit |
| <kbd>Shift</kbd> + <kbd>Enter</kbd> | Form | Add another list source |
| <kbd>Esc</kbd> | Any | Back to form / close modal |
| <kbd>R</kbd> | Result | Spin again |
| <kbd>L</kbd> | Result | Open on Letterboxd |
| <kbd>V</kbd> | Result | View in source list |
| <kbd>S</kbd> | Result | Copy shareable link |

---

## Local Development

### Prerequisites
- **Python 3.12+**
- **Node.js 24+** and **npm**

### Installation
```bash
git clone https://github.com/fastfingertips/movie-roulette.git
cd movie-roulette

pip install -r requirements.txt
npm install
```

### Run the Development Server
```bash
python -m api.index
```
Open **[http://127.0.0.1:5050](http://127.0.0.1:5050)**.

---

## Testing & Code Quality

```bash
# Python tests with coverage
npm test                          # or: pytest tests --cov=api

# JavaScript unit tests (Vitest)
npm run test:js

# Live Letterboxd smoke test
pytest tests -m smoke -v

# Linters
npm run lint                      # ESLint (JS)
npm run lint:css                  # Stylelint (CSS)
ruff check api tests              # Ruff (Python)

# Copy-paste detection
npm run cpd
```

---

## Contributing

[Husky](https://typicode.github.io/husky/) runs quality checks on every commit:

- **Pre-commit** — `lint-staged` runs ESLint on JS, Stylelint on CSS, and Ruff on Python
- **Commit-msg** — subject line must be **≤ 62 characters**

```text
# ✅ Valid
feat: cancel stale requests with AbortController

# ❌ Invalid (>62 chars)
feat: this commit message title is way too long and exceeds the limit
```

---

## Deployment

Deployed on **Vercel** as a serverless Python web service.

- Serverless timeout: `60s` ([vercel.json](vercel.json))
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`

---

## License

- Developed by **[@bugracoskun](https://letterboxd.com/bugracoskun/)** ([fastfingertips](https://github.com/fastfingertips))
- Powered by **[letterboxdpy](https://github.com/nmcassa/letterboxdpy)**
- **MIT License** — see [LICENSE](LICENSE)

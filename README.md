# Movie Roulette

[![Website](https://img.shields.io/badge/website-roulette.bugra.co-ff8000?style=flat-square)](https://roulette.bugra.co)
![Python](https://img.shields.io/badge/python-3.12-blue?style=flat-square&logo=python)
![Flask](https://img.shields.io/badge/flask-3.1.3-black?style=flat-square&logo=flask)
![Vercel](https://img.shields.io/badge/vercel-deployed-black?style=flat-square&logo=vercel)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

A fast, modern web application and direct redirect engine to pick a random movie from Letterboxd lists: **[roulette.bugra.co](https://roulette.bugra.co)**

> [!NOTE]
> Movie Roulette extracts public list metadata and film details via [letterboxdpy](https://github.com/nmcassa/letterboxdpy) without requiring Letterboxd API access tokens.

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

## Key Features

<!-- --8<-- [start:features] -->
- **Multi-List Aggregation:** Combine up to 5 Letterboxd watchlists and custom lists simultaneously into a single pool.
- **Dual Randomization Engines:**
  - **Deep Sample (Default):** Uniform sampling across all pages of large lists, so older entries have equal odds as recent additions.
  - **Fast Shuffle:** Uses Letterboxd native `/by/shuffle/` sorting for a fast, single-request pick on watchlists and lists.
- **Proportional vs. Equal Odds:** Choose between weighting movie probability by list size or giving each list equal selection chances.
- **Server-Side Direct Redirect (`/r`):** Redirects directly to a Letterboxd movie page without loading any frontend assets.
- **Automation and Headless Output:** Pass `format=json` or `Accept: application/json` on redirect routes for iOS Shortcuts, Raycast extensions, and CLI scripts.
- **Rich Movie Overviews:** Displays posters, backdrop banners, community ratings, genres, directors, top cast, and taglines.
- **Real-Time Validation:** Detects private lists, empty watchlists, 404 targets, and duplicate inputs with inline error badges.
- **Theme System:** Six palette families (Classic, Pine & Orchid, Citron & Berry, Forest & Lime, Letterboxd, AMOLED), each with a paired light and dark variant. Switches between System, Light, and Dark mode. Optional glass/translucency layer.
- **URL Generator:** Interactive modal at `/generator` that builds shareable pre-configured links and embed snippets without manual parameter editing.
- **Keyboard Navigation:** Keyboard shortcuts for rolling, opening Letterboxd, copying links, and navigating results.
<!-- --8<-- [end:features] -->

---

## Quick Example

```
https://roulette.bugra.co/r/<username>
```

Redirects straight to a random film from the user's watchlist. See the [documentation](https://docs.roulette.bugra.co/) for all routes, URL parameters, keyboard shortcuts, and API details.

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
Open **[http://127.0.0.1:5050](http://127.0.0.1:5050)** in your browser.

---

## Contributing

Contributions are welcome. Please refer to [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, commit conventions (Husky git hooks, subject <= 62 characters), and code style guidelines.

---

## License

- Developed by **[@bugracoskun](https://letterboxd.com/bugracoskun/)** ([fastfingertips](https://github.com/fastfingertips))
- Powered by **[letterboxdpy](https://github.com/nmcassa/letterboxdpy)**
- **MIT License** — see [LICENSE](LICENSE)

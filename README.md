# Movie Roulette

[![Website](https://img.shields.io/badge/website-roulette.bugra.co-ff8000?style=flat-square)](https://roulette.bugra.co)
[![Docs](https://img.shields.io/badge/docs-docs.roulette.bugra.co-blue?style=flat-square)](https://docs.roulette.bugra.co)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

Pick a random movie from one or more Letterboxd lists.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/movie-roulette-dark.jpeg">
    <source media="(prefers-color-scheme: light)" srcset=".github/assets/movie-roulette-light.jpeg">
    <img alt="Movie Roulette Preview" src=".github/assets/movie-roulette-dark.jpeg" width="100%">
  </picture>
</p>

## Features

<!-- --8<-- [start:features] -->
- Combine up to 5 watchlists and custom lists
- Deep Sample for equal odds across every page, or Fast Shuffle for a single request
- Proportional or equal weighting between lists
- `/r` links that redirect straight to a Letterboxd film page
- JSON output for scripts, Shortcuts, and Raycast
- Film details: poster, rating, genres, director, cast
- Light, dark, and system themes with six palettes
- Keyboard shortcuts and a URL generator for shareable links
<!-- --8<-- [end:features] -->

## Quick Start

```
https://roulette.bugra.co/r/<username>
```

Opens a random film from that user's watchlist. Routes, parameters, and integrations are in the **[documentation](https://docs.roulette.bugra.co)**.

## Local Development

Requires Python 3.12+ and Node.js 24+.

```bash
git clone https://github.com/fastfingertips/movie-roulette.git
cd movie-roulette
pip install -r requirements.txt
npm install
python -m api.index
```

Then open http://127.0.0.1:5050.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. Built by [@bugracoskun](https://letterboxd.com/bugracoskun/) ([fastfingertips](https://github.com/fastfingertips)), powered by [letterboxdpy](https://github.com/nmcassa/letterboxdpy).

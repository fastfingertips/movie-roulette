# Local Development

## Prerequisites

- Python 3.12+
- Node.js 24+ and npm

## Installation

```bash
git clone https://github.com/fastfingertips/movie-roulette.git
cd movie-roulette

pip install -r requirements.txt
npm install
```

## Running the Server

```bash
python -m api.index
```

Open [http://127.0.0.1:5050](http://127.0.0.1:5050) in your browser.

## Testing & Quality Assurance

```bash
# Python test suite
npm test                     # or: pytest tests

# JavaScript unit tests (Vitest)
npm run test:js

# Live Letterboxd integration smoke test
pytest tests -m smoke -v

# Linters
npm run lint                 # ESLint (JS)
npm run lint:css             # Stylelint (CSS)
ruff check api tests         # Ruff (Python)

# Duplicate code detection
npm run cpd
```


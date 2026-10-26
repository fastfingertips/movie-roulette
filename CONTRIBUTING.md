# Contributing to Movie Roulette

Thank you for contributing to **Movie Roulette**. This document outlines our development workflow, commit conventions, and automated quality checks.

---

## Development Setup

### Prerequisites
- **Python 3.12+**
- **Node.js 24+** and **npm**

### Installation
```bash
git clone https://github.com/fastfingertips/movie-roulette.git
cd movie-roulette

# Install dependencies
pip install -r requirements.txt
npm install
```

### Running Locally
```bash
python -m api.index
```
Open **[http://127.0.0.1:5050](http://127.0.0.1:5050)** in your browser.

---

## Git Commit Standards

[Husky](https://typicode.github.io/husky/) automatically validates commits:

### 1. Commit Message Subject Length (`commit-msg`)
The subject line (first line) of every commit must be **<= 62 characters**.

```text
# Valid (<= 62 chars)
feat: add debug logging toggle to navigation
fix: handle empty watchlist response gracefully

# Invalid (> 62 chars)
feat: this commit message title is way too long and exceeds the sixty-two character limit
```

### 2. Conventional Commit Types
Use standard Conventional Commit prefixes:
- `feat:` new user-facing functionality
- `fix:` bug fixes
- `refactor:` code restructuring without behavior changes
- `chore:` dependency updates, config tweaks
- `docs:` documentation updates
- `test:` adding or updating tests
- `ci:` workflow or deployment configuration

### 3. Pre-commit Quality Checks (`lint-staged`)
On `git commit`, `lint-staged` automatically runs:
- **JavaScript:** ESLint (`npm run lint`)
- **CSS:** Stylelint (`npm run lint:css`)
- **Python:** Ruff (`ruff check`)

---

## Testing & Quality Assurance

Run the automated test suites before opening a Pull Request:

```bash
# Python unit & route tests
npm test                          # or: pytest tests --cov=api

# JavaScript unit tests (Vitest)
npm run test:js

# Live Letterboxd integration smoke test
pytest tests -m smoke -v

# Linters
npm run lint                      # ESLint (JS)
npm run lint:css                  # Stylelint (CSS)
ruff check api tests              # Ruff (Python)

# Duplicate code detection
npm run cpd
```

---

## Pull Request Guidelines

1. Create a feature branch: `git checkout -b feat/your-feature-name`.
2. Ensure all tests and linters pass (`npm test`, `npm run test:js`, `npm run lint`).
3. Keep commit messages clear, scoped, and within the 62-character limit.
4. Open a Pull Request against `master`.

# Contributing to Movie Roulette

Thank you for contributing to **Movie Roulette**. This document outlines our development workflow, commit conventions, and automated quality checks.

---

## Development Setup

See [Local Development](https://github.com/fastfingertips/movie-roulette#local-development) in the README for prerequisites, installation, and running the server locally.

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

## Workflow

1. **Open an issue first.** Every change — feature, bug fix, or refactor — must be tracked by an issue before any code is written. PRs without a linked issue will not be merged.
2. **Create a branch** from `master` using the naming scheme `<type>/issue-<n>-<short-slug>`:
   ```
   feat/issue-26-url-generator
   fix/issue-12-empty-watchlist
   refactor/issue-39-dom-hydration
   ```
3. **Commit on the branch** following the Conventional Commit format above. Reference the issue number in the subject, e.g. `feat: add URL generator modal (#26)`.
4. **Pass all checks** before opening a PR (`npm test`, `npm run test:js`, `npm run lint`, `npm run lint:css`).
5. **Open a PR against `master`.** Include `Closes #<issue>` in the PR body so the issue closes automatically on merge.
6. **Merges are rebase-only.** No merge commits or squash commits. The branch must be rebased onto `master` before merging so the history stays linear.

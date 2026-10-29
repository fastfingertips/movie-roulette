# Getting Started

## Adding lists

Each input accepts any of these forms:

| Input | Resolves to |
|---|---|
| `bugracoskun` | The user's watchlist |
| `bugracoskun/list/top-films` | A custom list |
| `https://letterboxd.com/bugracoskun/watchlist/` | Full URL, watchlist |
| `https://letterboxd.com/bugracoskun/list/top-films/` | Full URL, custom list |

Press ++shift+enter++ to add another input. Up to 5 lists can be combined. Duplicate lists are ignored.

## Randomization engines

| Engine | How it works | Trade-off |
|---|---|---|
| **Deep Sample** (default) | Reads the list size, picks a random page, then a random film on it | Every film has equal odds; needs one extra request |
| **Fast Shuffle** | Uses Letterboxd's own `/by/shuffle/` order and takes a film from page 1 | Single request; draws only from what Letterboxd puts on the first shuffled page |

Toggle with **Use /shuffle** in the footer, or `shuffle=1` in the URL.

## Combining lists

When more than one list is added, a list is chosen first, then a film from that list:

- **Proportional** (default): larger lists are chosen more often, so every film across all lists has the same chance.
- **Equal**: each list has the same chance regardless of size.

Set with `mode=equal` in the URL.

## Sharing

Press ++s++ on a result to copy a link that reproduces the same setup. Opening it rolls automatically; add `run=0` to open with the inputs pre-filled but without rolling.

For links that skip the interface entirely, use the [URL Generator](https://roulette.bugra.co/generator) or see [Direct Redirect](redirect.md).

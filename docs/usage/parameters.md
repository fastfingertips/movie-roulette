# URL Parameters

The web application and redirect endpoints accept the following query parameters.

| Parameter | Accepted Values | Description |
|---|---|---|
| `url`, `urls`, `list`, `src` | Strings (comma-separated or multiple) | Letterboxd URLs or usernames (up to 5 sources) |
| `count`, `total` | Positive integer (e.g. `1200`) | Bypasses initial metadata request on `/r` for faster deep sampling |
| `redirect` | `1`, `true` | Bypasses the UI and performs an immediate server-side 302 redirect |
| `shuffle` | `1`, `true` | Enables the Fast Letterboxd `/by/shuffle/` engine |
| `random` | `custom`, `deep`, `letterboxd`, `shuffle` | Explicitly chooses the selection strategy |
| `mode` | `proportional`, `equal` | Balances candidate probability across multi-list pools |
| `format` | `json` | Returns JSON payload instead of HTTP 302 redirect |
| `run`, `auto` | `0` | Disables automatic rolling when opening a shareable link |
| `debug` | `1`, `true` | Enables verbose client console logging |


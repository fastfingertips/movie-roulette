# URL Parameters

Accepted by both the web app (`/`) and the redirect endpoint (`/r`).

## Sources

| Parameter | Value | Description |
|---|---|---|
| `url` | Username, list path, or URL | One or more lists, comma-separated or repeated. Aliases: `urls`, `list`, `lists`, `src`, `sources` |

## Selection

| Parameter | Value | Default | Description |
|---|---|---|---|
| `shuffle` | `1`, `true` | off | Use Fast Shuffle instead of Deep Sample |
| `random` | `custom`, `deep`, `letterboxd`, `shuffle` | `custom` | Explicit engine choice; `letterboxd` and `shuffle` equal `shuffle=1` |
| `mode` | `proportional`, `equal` | `proportional` | How lists are weighted when combined |
| `count` | Positive integer | none | Known film count for a single list. Skips the size lookup on `/r`. Alias: `total` |

## Output and behavior

| Parameter | Value | Description |
|---|---|---|
| `redirect` | `1`, `true` | On `/`, redirect to the film instead of showing the app |
| `format` | `json` | On `/r`, return [JSON](../reference/json.md) instead of a redirect |
| `run` | `0` | On `/`, pre-fill inputs without rolling. Alias: `auto` |
| `debug` | `1`, `true` | Verbose logs in the browser console |

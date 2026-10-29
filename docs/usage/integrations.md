# Integrations

## Browser address bar

Add a custom search engine in Chrome, Edge, or Firefox:

| Field | Value |
|---|---|
| Name | Movie Roulette |
| Shortcut | `mr` |
| URL | `https://roulette.bugra.co/r/%s` |

Type `mr bugracoskun` in the address bar to open a random film from that watchlist.

## Command line

```bash
curl -s "https://roulette.bugra.co/r/bugracoskun?format=json" | jq -r .url
```

Shell alias that opens a random film in the default browser:

=== "macOS"

    ```bash
    alias randfilm='open "$(curl -s "https://roulette.bugra.co/r/bugracoskun?format=json" | jq -r .url)"'
    ```

=== "Linux"

    ```bash
    alias randfilm='xdg-open "$(curl -s "https://roulette.bugra.co/r/bugracoskun?format=json" | jq -r .url)"'
    ```

=== "PowerShell"

    ```powershell
    function randfilm { Start-Process (Invoke-RestMethod "https://roulette.bugra.co/r/bugracoskun?format=json").url }
    ```

## iOS Shortcuts and Raycast

Use a **Get Contents of URL** (Shortcuts) or script command (Raycast) on `https://roulette.bugra.co/r/<user>?format=json`, then open the `url` field. Or open `https://roulette.bugra.co/r/<user>` directly and let the redirect do the work.

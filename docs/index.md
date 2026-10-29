# Movie Roulette

Pick a random movie from one or more Letterboxd lists.

[Open the app](https://roulette.bugra.co){ .md-button .md-button--primary }
[View on GitHub](https://github.com/fastfingertips/movie-roulette){ .md-button }

## Three ways to use it

=== "Web app"

    Open [roulette.bugra.co](https://roulette.bugra.co), paste a Letterboxd username or list URL, and press ++enter++.

=== "Direct link"

    ```
    https://roulette.bugra.co/r/<username>
    ```

    Skips the interface and lands straight on a random film page on Letterboxd.

=== "JSON"

    ```bash
    curl -s "https://roulette.bugra.co/r/<username>?format=json"
    ```

    Returns the picked film as JSON. See [JSON Response](reference/json.md).

## Features

--8<-- "README.md:features"

!!! note
    List data is read from public Letterboxd pages via [letterboxdpy](https://github.com/nmcassa/letterboxdpy). No Letterboxd account or API key is needed.

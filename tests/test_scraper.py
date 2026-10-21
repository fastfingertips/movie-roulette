from api.scraper import pick_weighted_list


class TestPickWeightedList:
    def test_empty_lists_returns_none(self):
        assert pick_weighted_list([]) is None
        assert pick_weighted_list(None) is None

    def test_single_list_always_returned(self):
        single = [{"user": "alice", "slug": "watchlist", "count": 100}]
        picked = pick_weighted_list(single, 100)
        assert picked == single[0]

    def test_zero_total_fallback(self):
        lists = [
            {"user": "alice", "slug": "list-a", "count": 0},
            {"user": "bob", "slug": "list-b", "count": 0},
        ]
        picked = pick_weighted_list(lists, 0)
        assert picked in lists

    def test_statistical_distribution(self):
        # List A has 800 items (80%), List B has 200 items (20%)
        list_a = {"user": "alice", "slug": "list-a", "count": 800}
        list_b = {"user": "bob", "slug": "list-b", "count": 200}
        lists = [list_a, list_b]

        counts = {"list-a": 0, "list-b": 0}
        trials = 1000

        for _ in range(trials):
            choice = pick_weighted_list(lists, 1000)
            counts[choice["slug"]] += 1

        # Check that list-a is chosen roughly 80% (between 73% and 87%)
        ratio_a = counts["list-a"] / trials
        assert 0.73 <= ratio_a <= 0.87, f"Expected ~0.80, got {ratio_a}"

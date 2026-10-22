class TestIndexRoute:
    def test_root_returns_html(self, client):
        res = client.get("/")
        assert res.status_code == 200
        assert b"<!doctype html>" in res.data or b"<html" in res.data

    def test_index_html_alias_returns_html(self, client):
        res = client.get("/index.html")
        assert res.status_code == 200
        assert b"<!doctype html>" in res.data or b"<html" in res.data

    def test_static_asset_accessible(self, client):
        res = client.get("/static/css/style.css")
        assert res.status_code == 200

    def test_favicon_accessible(self, client):
        res = client.get("/favicon.ico")
        assert res.status_code == 200

    def test_root_files_not_exposed(self, client):
        assert client.get("/requirements.txt").status_code == 404
        assert client.get("/vercel.json").status_code == 404
        assert client.get("/.env.local").status_code == 404


class TestMetadataRoute:
    def test_metadata_no_urls_returns_400(self, client):
        res = client.post("/api/metadata", json={"urls": []})
        assert res.status_code == 400
        data = res.get_json()
        assert "error" in data

    def test_metadata_invalid_url_returns_400(self, client):
        res = client.post("/api/metadata", json={"urls": ["https://google.com/search"]})
        assert res.status_code == 400
        data = res.get_json()
        assert "Invalid list URL" in data["error"]

    def test_metadata_too_many_urls_returns_400(self, client):
        res = client.post("/api/metadata", json={"urls": [f"user{i}/list-{i}" for i in range(6)]})
        assert res.status_code == 400
        data = res.get_json()
        assert "Maximum 5 lists allowed" in data["error"]

    def test_metadata_oversized_url_returns_400(self, client):
        res = client.post("/api/metadata", json={"urls": ["u/" + "a" * 300]})
        assert res.status_code == 400
        data = res.get_json()
        assert "maximum length" in data["error"]

    def test_metadata_oversized_payload_returns_413(self, client):
        res = client.post("/api/metadata", data="x" * (40 * 1024), content_type="application/json")
        assert res.status_code == 413
        data = res.get_json()
        assert "Payload too large" in data["error"]


class TestSelectRoute:
    def test_select_empty_lists_returns_400(self, client):
        res = client.post("/api/select", json={"lists": []})
        assert res.status_code == 400
        data = res.get_json()
        assert "error" in data

    def test_select_too_many_lists_returns_400(self, client):
        res = client.post(
            "/api/select",
            json={"lists": [{"user": f"u{i}", "slug": f"s{i}", "count": 10} for i in range(6)], "total": 60},
        )
        assert res.status_code == 400
        data = res.get_json()
        assert "Maximum 5 lists allowed" in data["error"]

    def test_select_invalid_total_returns_400(self, client):
        res = client.post(
            "/api/select",
            json={"lists": [{"user": "u", "slug": "s", "count": 10}], "total": -5},
        )
        assert res.status_code == 400
        data = res.get_json()
        assert "Invalid total movie count" in data["error"]


class TestDetailsRoute:
    def test_details_missing_slug_returns_400(self, client):
        res = client.post("/api/details", json={})
        assert res.status_code == 400
        data = res.get_json()
        assert "error" in data

    def test_details_invalid_slug_returns_400(self, client):
        res = client.post("/api/details", json={"slug": "../../etc/passwd"})
        assert res.status_code == 400
        data = res.get_json()
        assert "Invalid movie slug" in data["error"]

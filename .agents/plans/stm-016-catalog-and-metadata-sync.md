# Catalog & Metadata Synchronization

## Goal

1. **Keying `data/<author>.json` by unique `post_id` (with fallback to slug/URL)**:
   Ensure `data/<author>.json` entries are keyed by Substack's canonical numeric `post_id`. If a publisher updates an article's slug or headline later, rescraping updates the existing post in place rather than creating an orphaned duplicate entry.
2. **Metadata synchronization for existing files**:
   When posts already exist on disk (`overwrite=False` / skipped scrape), ensure the author's catalog retains or populates accurate records rather than omitting them or relying on stale runs.

---

## Architectural Context: How Metadata & Post ID are Obtained

Post metadata and identifiers are embedded directly in the Substack HTML page DOM and scripts (`extract_post_data` in `substack_scraper/scrapers/base.py`):
1. **Embedded Preloads (`window._preloads`)**:
   Substack embeds article data including the unique numeric post ID:
   ```javascript
   window._preloads = JSON.parse("{\"post\":{\"id\":214748970,\"slug\":\"building-codex-with-tibo-sottiaux\", ...}}");
   ```
   Can be extracted with a regex without extra API calls:
   ```python
   match = re.search(r'\\?"post\\?":\s*\{[^}]*\\?"id\\?":\s*(\d+)', html_content)
   post_id = int(match.group(1)) if match else None
   ```
2. **Embedded JSON-LD (`<script type="application/ld+json">`)**:
   Extracts `datePublished` (ISO date formatted to `YYYY-MM-DD`), author `name`, and cover `image` URL.
3. **HTML DOM Selectors**:
   - Title: `h1.post-title, h2`
   - Subtitle: `h3.subtitle, div.subtitle-HEEcLo`
   - Like count: `div.like-button-container button div.label`
   - Post content: `div.available-content`

---

## Trade-offs: HTML DOM / JSON-LD vs. Substack JSON API

Substack also provides public JSON API endpoints:
- Archive endpoint: `https://<publication>.substack.com/api/v1/archive?sort=new&limit=12&offset=0`
- Single post endpoint: `https://<publication>.substack.com/api/v1/posts/<slug>`

| Aspect | Current Approach (HTML DOM + JSON-LD + Preload ID) | Substack API (`/api/v1/archive` or `/api/v1/posts/<slug>`) |
| :--- | :--- | :--- |
| **HTTP Requests** | 1 request per post (HTML contains body, metadata, & `post_id`) | 1 request for HTML (body) + extra request for API, *OR* 1 bulk archive call |
| **Authentication & Paywalls** | Handled transparently by Playwright session or Requests | The JSON API for paid content sometimes returns truncated `body_html` unless authenticated cookies/headers are passed |
| **Post Discovery** | `sitemap.xml` + `feed.xml` | `/api/v1/archive?offset=...` can paginate and discover *all* posts (with metadata and `id` included upfront) |
| **Rate Limiting** | Prone to 429 on repetitive post HTML requests | `/api/v1/archive` paginates up to 50 posts per call, fetching all metadata in just a few requests |
| **Handling Slug Changes** | Extracting `post_id` from HTML allows mapping updated slugs back to the existing post | Archive API gives `post.id` and `post.slug` upfront |

---

## Key Questions for the Plan

1. **Identifier & Deduplication Strategy**:
   - **Canonical Key Priority**:
     1. `post_id` (numeric ID from Substack, e.g. `214748970`)
     2. `slug` (e.g. `building-codex-with-tibo-sottiaux`)
     3. `file_link` or source URL
   - Storing `post_id` in frontmatter (e.g. `post_id: 214748970`) and in `data/<author>.json` guarantees that if a publisher modifies their title or slug in the future, rescraping seamlessly detects the change and updates the existing record.
2. **Metadata Refresh on Skipped Posts**:
   - When running a scrape without `--force` (skipping existing `.md` files):
     - Check `data/<author>.json` for existing metadata.
     - If not in JSON, recover metadata from the local `.md` frontmatter (including `post_id`, title, date, likes).
     - This ensures `essays_data` remains complete for the catalog and HTML generation even when scraping is skipped.

---

## Proposed Changes

### 1. Post ID Extraction & Metadata Storage (`substack_scraper/scrapers/base.py`)

#### [MODIFY] `substack_scraper/scrapers/base.py`
- Update `extract_post_data`:
  - Extract numeric `post_id` from the raw HTML (`window._preloads` or embedded script).
  - Return `post_id` alongside existing metadata tuple.
- Update `combine_metadata_and_content`:
  - Include `post_id` in YAML frontmatter (`post_id: 214748970`).
- Update `save_essays_data_to_json(self, essays_data: list[dict]) -> None`:
  - Deduplicate and merge by `post_id` first, falling back to `slug` or `file_link`:
    ```python
    def _post_key(entry: dict) -> str:
        if entry.get("post_id"):
            return f"id:{entry['post_id']}"
        return entry.get("slug") or os.path.splitext(os.path.basename(entry.get("file_link", "")))[0]
    ```
  - If a post's slug changed, update `slug`, `file_link`, `title`, and `like_count` in place in `data/<author>.json`.
  - Preserve order and write updated list back to disk.
- Add frontmatter parser helper:
  - `_extract_metadata_from_md(md_filepath: str) -> dict | None`:
    Reads existing `.md` files on disk to reconstruct metadata (including `post_id`) when post downloads are skipped.
- Add post ID parser helper:
  - `_extract_post_id(html_content: str) -> int | None`:
    Extracts Substack's numeric post ID from script preloads in raw HTML.
- Update `scrape_posts(num_posts_to_scrape: int = 0)`:
  - When skipping an existing file (`overwrite=False`), load its metadata from existing JSON or local markdown frontmatter so `essays_data` has a complete view for the HTML catalog generator.

---

### 2. Test Suite (`tests/test_substack_scraper.py`)

#### [MODIFY] `tests/test_substack_scraper.py`
- Add unit tests:
  - `test_extract_post_data_extracts_post_id`: Verify numeric `post_id` is parsed from HTML script/preloads.
  - `test_save_essays_data_to_json_keys_by_post_id_and_updates_slug`: Verify updating an existing post with changed slug or updated `like_count` updates in place without duplicating records.
  - `test_scrape_posts_preserves_existing_metadata_in_catalog`: Verify skipping existing files keeps all entries in `data/<author>.json` and the generated catalog.

---

## Verification Plan

### Automated Tests
1. Run full test suite:
   ```bash
   uv run pytest -v
   ```
2. Run linter:
   ```bash
   uv run ruff check .
   ```

### Manual Verification
1. Test saving entries with identical `post_id` but updated `slug` and verify `data/<author>.json` merges the entry in place.


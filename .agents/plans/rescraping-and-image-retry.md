# Implementation Plan: Robust Rescraping & Image Retry Logic

This plan implements **Improvement Area 1 (Robustness & Rescraping)**:
1. **`--force` / `--overwrite` Option**: Allows overwriting already-downloaded markdown and HTML files when rescraping.
2. **Image Download Retry with Backoff**: Adds automatic retry (up to 3 attempts with exponential delay) to `download_image` for robust downloads across publications with many images.

---

## Proposed Changes

### 1. Image Download Pipeline (`substack_scraper/images.py`)

#### [MODIFY] `substack_scraper/images.py`
- Update `download_image(url: str, save_path: Path, pbar=None, timeout: int = 10, max_retries: int = 3) -> str | None`:
  - Add `max_retries: int = 3` parameter.
  - Implement a retry loop on transient `requests.RequestException` errors:
    - Attempt $1 \dots \text{max\_retries}$
    - If status code is $200$, write chunked stream and return `str(save_path)`.
    - If status is rate-limited (HTTP 429) or a connection/timeout error occurs and attempts remain, back off with short jittered delay (`1s, 2s, 4s`) before retrying.
    - If error persists after `max_retries`, log warning and gracefully return `None` (preserving remote URL in markdown as before).
- Update `_call_download_image` helper to forward `max_retries` kwargs cleanly.

---

### 2. Scraper Core Engine (`substack_scraper/scrapers/base.py`, `free.py`, `premium.py`)

#### [MODIFY] `substack_scraper/scrapers/base.py`
- In `BaseSubstackScraper.__init__`:
  - Add `overwrite: bool = False` argument and store as `self.overwrite: bool`.
- In `save_to_file(filepath: str, content: str, overwrite: bool = False)`:
  - Add `overwrite: bool = False`.
  - If `os.path.exists(filepath) and not overwrite: return`, otherwise write file.
- In `save_to_html_file(filepath: str, content: str, overwrite: bool = False)`:
  - Add `overwrite: bool = False`.
  - Check file existence if `not overwrite`.
- In `scrape_posts(num_posts_to_scrape: int = 0)`:
  - Update post check:
    ```python
    if self.overwrite or not os.path.exists(md_filepath):
        # Fetch, parse, download images, and save
    ```
  - Pass `overwrite=self.overwrite` to `save_to_file` and `save_to_html_file`.

#### [MODIFY] `substack_scraper/scrapers/free.py`
- Accept `overwrite: bool = False` in `SubstackScraper.__init__` and forward to `super().__init__`.

#### [MODIFY] `substack_scraper/scrapers/premium.py`
- Accept `overwrite: bool = False` in `PremiumSubstackScraper.__init__` and forward to `super().__init__`.

---

### 3. CLI Interface (`substack_scraper/cli.py`)

#### [MODIFY] `substack_scraper/cli.py`
- Add `--force` / `--overwrite` argument in `parse_args()`:
  ```python
  parser.add_argument(
      "--force",
      "--overwrite",
      dest="overwrite",
      action="store_true",
      help="Force rescraping and overwrite existing markdown and HTML files.",
  )
  ```
- Forward `overwrite=args.overwrite` when initializing `SubstackScraper` and `PremiumSubstackScraper`.

---

### 4. Test Suite (`tests/test_substack_scraper.py`)

#### [MODIFY] `tests/test_substack_scraper.py`
- **Image Retry Test**:
  - Test `download_image` retries on temporary failures and succeeds if a subsequent attempt passes before `max_retries`.
  - Verify backoff and exhaustion when all attempts fail.
- **Overwrite Flag Test**:
  - Verify that when `overwrite=False`, existing `.md` files are skipped (file content unchanged, soup not queried).
  - Verify that when `overwrite=True`, existing `.md` files are re-fetched and overwritten.
- **CLI Flag Test**:
  - Verify `--force` sets `overwrite=True` in parsed CLI arguments.

---

## Verification Plan

### Automated Tests
1. Run full test suite with verbose output:
   ```bash
   uv run pytest -v
   ```
2. Run code style and linter checks:
   ```bash
   uv run ruff check .
   ```

### Manual Verification
- Test running a single post with and without `--force`:
  - Scrape single post: file is written.
  - Re-run without `--force`: log displays `File already exists: ...` and finishes instantly.
  - Re-run with `--force`: scraper executes and refreshes file.

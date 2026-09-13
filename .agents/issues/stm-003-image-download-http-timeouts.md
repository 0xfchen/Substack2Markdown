# Add HTTP Timeouts and Fallback for Failed Image Downloads

## Problem Description

Network calls in the scraper lacked explicit HTTP timeouts:
1. When downloading images (`download_image`) or resolving headers (`sanitize_image_filename`), a slow or unresponsive remote CDN server could cause the scraper process to hang indefinitely without failing or making progress.
2. Sitemap and RSS feed fetching (`fetch_urls_from_sitemap`, `fetch_urls_from_feed`, `get_soup_from_url`) made unbounded `requests.get()` calls.
3. If an image download failed due to network errors or HTTP 404/403 responses, `process_markdown_images` still replaced the markdown image reference with a local relative path pointing to a non-existent file on disk, breaking image display in readers.

## Proposed Solution

1. **Explicit Default Request Timeout**:
   Introduce a global `DEFAULT_REQUEST_TIMEOUT = 30` seconds constant.
2. **Apply Timeouts to All Network Calls**:
   Pass `timeout=DEFAULT_REQUEST_TIMEOUT` (or shorter timeouts for head requests) to `requests.get` and `requests.head`.
3. **Preserve Original URL on Download Failure**:
   If `download_image` returns `None` or encounters an exception, preserve the original remote CDN URL in the markdown text so images can still be loaded from the web rather than referencing broken local file paths.

## Changes Made

- `substack_scraper.py` (later modularized into `substack_scraper/config.py` and `substack_scraper/images.py`):
  - Defined `DEFAULT_REQUEST_TIMEOUT: int = 30`.
  - Added `timeout` parameter to `download_image` and `sanitize_image_filename`.
  - Added `timeout=DEFAULT_REQUEST_TIMEOUT` to sitemap, feed, and post soup HTTP requests.
  - Updated `process_markdown_images()` to check if the download succeeded; if `download_image` returns `None`, keep the original remote image URL.
  - Replaced backslashes with forward slashes in relative markdown image links for cross-platform compatibility.
- `tests/test_substack_scraper.py`:
  - Added `test_download_image_uses_timeout` verifying timeout arguments are passed to requests.
  - Added `test_process_markdown_images_preserves_remote_url_on_download_failure` ensuring failed downloads retain remote URLs.

## Verification

- Automated pytest suite:
  ```bash
  uv run pytest tests/test_substack_scraper.py -k "timeout or preserves_remote_url"
  ```

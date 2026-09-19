# Fix: Playwright Navigation Interruption Handling and Transient Page Fetch Retry

## Problem Description

During premium or authenticated scraping with Playwright (e.g. `uv run substack_scraper --url https://newsletter.pragmaticengineer.com/ --premium --skip-login -n 5 --images`), scraping certain articles failed with two types of errors:

1. **Secondary Navigation Interruption**:
   ```text
   Error scraping post: Error fetching page: https://newsletter.pragmaticengineer.com/p/ai-skills-with-matt-pocock.
   Error: Page.goto: Navigation to "https://newsletter.pragmaticengineer.com/p/ai-skills-with-matt-pocock" is interrupted by another navigation to "https://newsletter.pragmaticengineer.com/p/ai-skills-with-matt-pocock"
   Call log:
     - navigating to "https://newsletter.pragmaticengineer.com/p/ai-skills-with-matt-pocock", waiting until "domcontentloaded"
   ```
   When Playwright first visits custom Substack publication domains with saved session state (`storage_state.json`), Substack's client-side auth synchronization or service worker scripts issue a secondary redirection or reload. In Playwright, secondary in-flight navigations abort any pending `page.goto(..., wait_until="domcontentloaded")` with an interrupted navigation exception.

2. **Premature Abort on Transient Timeout or Network Error**:
   ```text
   Error scraping post: Error fetching page: https://newsletter.pragmaticengineer.com/p/openai-software-factory.
   Error: Page.goto: Timeout 30000ms exceeded.
   Call log:
     - navigating to "https://newsletter.pragmaticengineer.com/p/openai-software-factory", waiting until "domcontentloaded"
   ```
   In `substack_scraper/scrapers/premium.py`, the `get_url_soup` method defined a `for attempt in range(1, max_attempts + 1):` retry loop, but directly caught `PlaywrightError` and immediately raised `ValueError` on attempt 1 without executing the remaining retry attempts. Consequently, transient network delays, heavy embed loads (e.g. YouTube, Twitter, Spotify), or temporary timeouts aborted the entire post scraping operation.

---

## Proposed Solution / Root Cause

1. **Catch and Await Settled Navigation State**:
   - Wrap `self.page.goto(url, wait_until="domcontentloaded")` in a targeted try-except block.
   - If a `PlaywrightError` containing `"interrupted by another navigation"` is encountered, recognize that the browser is actively executing the redirect. Rather than crashing, wait for the settled DOM content using `self.page.wait_for_load_state("domcontentloaded", timeout=15000)`.

2. **Retry Transient Playwright Errors**:
   - Update the outer `except PlaywrightError as exc:` block to retry up to `max_attempts` with a 2-second sleep between attempts, only raising `ValueError` once `attempt == max_attempts`.

---

## Changes Made

- [`substack_scraper/scrapers/premium.py`](../../substack_scraper/scrapers/premium.py):
  - Added inner exception handling for `interrupted by another navigation` to wait for settled DOM state.
  - Updated outer `PlaywrightError` handler to log warnings and retry up to `max_attempts` instead of immediately raising on attempt 1.

---

## Verification

### Automated Tests
- Run Python test suite:
  ```bash
  uv run pytest
  ```
  Result: 82 passed.
- Run Python linting:
  ```bash
  uv run ruff check .
  ```
  Result: All checks passed.

### Manual Verification
- Re-scraped the failing articles using the persistent storage state:
  ```bash
  uv run substack_scraper --url https://newsletter.pragmaticengineer.com/p/ai-skills-with-matt-pocock --premium --skip-login --images
  uv run substack_scraper --url https://newsletter.pragmaticengineer.com/p/openai-software-factory --premium --skip-login --images
  ```
  Result: Both articles successfully navigated, rendered, and saved with all images and frontmatter metadata.


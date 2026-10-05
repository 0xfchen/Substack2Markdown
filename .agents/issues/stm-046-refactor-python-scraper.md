# Python Scraper Deduplication and Configuration Consolidation

## Problem Description

An architectural audit of the scraper modules identified several duplication, configuration drift, and typing issues:

1. **Duplicated Post Body Extraction**:
   - Both [`scraper/scrapers/base.py`](../../scraper/scrapers/base.py) `extract_post_data()` and `scrape_post()` queried `div.available-content` directly without centralized helper methods or fallback selectors (`div.body.markup`, `article.single-post`) when markup structures vary.
2. **Duplicated Rate-Limit Handling**:
   - [`scraper/scrapers/free.py`](../../scraper/scrapers/free.py) and [`scraper/scrapers/premium.py`](../../scraper/scrapers/premium.py) contained identical logic checking for rate limiting (`body > pre` containing `"too many requests"`) and computing exponential backoff with $\pm 20\%$ jitter (`base = 2**attempt; delay = base + random.uniform(-0.2 * base, 0.2 * base)`).
3. **Hardcoded Playwright Timeout Constants**:
   - [`scraper/scrapers/premium.py`](../../scraper/scrapers/premium.py) hardcoded magic numbers (`15000`, `20000`, `5000`, `30`) directly in navigation, selector, hydration, and login polling loops instead of referencing centralized configuration constants in [`scraper/config.py`](../../scraper/config.py).
4. **Missing Type Annotations and Non-Descriptive Variable Names**:
   - Helper functions in [`scraper/images.py`](../../scraper/images.py) (`_get_requests`, `_call_download_image`, `replace_image`) lacked return or parameter type annotations.
   - Non-descriptive abbreviated variable names (`ss`) were present in [`scraper/cli.py`](../../scraper/cli.py) and [`scraper/images.py`](../../scraper/images.py), violating Rule 10.
5. **Redundant Post ID Resolution**:
   - `extract_post_data()` in [`scraper/scrapers/base.py`](../../scraper/scrapers/base.py) executed `preloaded.get("post_id") or self._extract_post_id(str(soup))` despite `_extract_preloaded_post_data()` already running `_extract_post_id()` as its internal fallback.

---

## Proposed Solution / Root Cause

- **Root Cause**: Independent evolution of the free requests scraper and premium Playwright scraper resulted in duplicated utility logic (rate limiting and backoff) and scattered timeout configuration.
- **Resolution**:
  - Centralize rate-limit detection, jittered exponential backoff calculation, and retry backoff sleeping in `BaseSubstackScraper`.
  - Extract reusable post body element and HTML extraction methods (`_extract_post_body_element`, `_extract_post_body_html`) with fallbacks in `BaseSubstackScraper`.
  - Consolidate all Playwright browser timeouts into exported constants in `scraper/config.py`.
  - Complete typing on helper functions and replace abbreviated `ss` identifiers with descriptive `scraper_module`.

---

## Verification

- **Python Test Suite**: `uv run pytest -v` (all tests passing including unit tests for rate-limiting detection, exponential delay bounds, fallback body selectors, and timeout constants).
- **Python Lint & Formatting**: `uv run ruff check .` and `uv run ruff format --check .`.
- **Reader Test Suite**: `nvs use lts; pnpm --dir reader test`.

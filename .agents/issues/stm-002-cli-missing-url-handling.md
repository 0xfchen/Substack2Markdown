# CLI Safe Default Behavior and Missing URL Handling

## Problem Description

Previously, the CLI defaulted `USE_PREMIUM` to `True` with a hardcoded URL:
1. Running the scraper without explicit flags caused it to attempt launching browser drivers (Selenium) and request premium credentials even when the user wanted to scrape free, public publications.
2. If `BASE_SUBSTACK_URL` was empty or cleared, running without `--url` would fail abruptly with cryptic exceptions instead of providing clear guidance on how to use the CLI.

## Proposed Solution / Root Cause

1. **Safe Default Scraper Mode**:
   Switch `USE_PREMIUM` default to `False`. Public scraping via standard HTTP requests should be the safe zero-configuration path; premium scraping requiring credentials or browser automation should be explicitly opted into.
2. **Missing URL Validation**:
   Check if `BASE_SUBSTACK_URL` is empty when `--url` is omitted. If no URL is provided, display a user-friendly error message and exit with status code 1 instead of crashing.

## Changes Made

- `substack_scraper.py` (later modularized into `substack_scraper/config.py` and `substack_scraper/cli.py`):
  - Changed `USE_PREMIUM: bool = False`.
  - Added explicit check in `main()`: if no URL is provided via arguments or defaults, print an actionable error message and call `sys.exit(1)`.
- `tests/test_substack_scraper.py`:
  - Added `test_default_use_premium_is_false` to ensure public scraping remains default.
  - Added `test_main_exits_when_no_url_and_empty_base_url` to verify clean exit status code on missing target publication.

## Verification

- Automated pytest suite:
  ```bash
  uv run pytest tests/test_substack_scraper.py -k "default_use_premium or missing_url"
  ```
- Confirmed bare invocation without arguments exits cleanly with guidance.


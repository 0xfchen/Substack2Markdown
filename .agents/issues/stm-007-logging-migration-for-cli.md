# Use Logging Instead of Print for CLI Messages

## Problem Description

The command-line interface and scraper logic relied on bare `print()` statements for notifications, status updates, and errors:
- Output was unformatted without timestamps or severity levels.
- Messages could not be filtered, redirected, or suppressed by downstream tools or programmatic callers.
- Errors printed to standard output rather than standard error streams.

## Proposed Solution

1. **Standard Library `logging` Module**:
   Establish a package logger `logging.getLogger("substack_scraper")` with structured log messages.
2. **CLI Logging Configuration**:
   Configure `logging.basicConfig` in `main()` with standard log formatting:
   `%(asctime)s [%(levelname)s] %(name)s: %(message)s` with `timefmt="%H:%M:%S"`.
3. **Appropriate Log Levels**:
   Use `logger.info()` for status notifications and `logger.error()` for failures and invalid input.

## Changes Made

- `substack_scraper.py` (later modularized into `substack_scraper/cli.py`):
  - Created `logger = logging.getLogger("substack_scraper")`.
  - Configured root logging in `main()`.
  - Converted CLI status and error `print()` statements to `logger.info()` and `logger.error()`.
- `tests/test_substack_scraper.py`:
  - Updated `test_main_exits_when_no_url_and_empty_base_url` to capture log output using pytest's `caplog` fixture and assert error message presence.

## Verification

- Automated pytest suite:
  ```bash
  uv run pytest tests/test_substack_scraper.py -k "empty_base_url"
  ```
- Verified log output format in terminal during scraping executions.


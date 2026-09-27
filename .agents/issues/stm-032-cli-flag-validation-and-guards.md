# CLI Flag Validation and Conflicting Option Guards

## Problem Description

Several CLI options in [`scraper/cli.py`](../../scraper/cli.py) can be combined in ways that produce silent failures, counter-intuitive behavior, or conflicting execution paths:

1. **Premium-only flags passed without `--premium`**:
   Passing browser automation options (`--browser`, `--headless`, `--persistent-profile`, `--skip-login`, `--storage-state`, `--cdp-url`, `--browser-path`, or `--user-agent`) without `-p / --premium` silently falls back to the basic `SubstackScraper` (which uses plain HTTP `requests.get()`). Users expecting browser automation (e.g. `--cdp-url http://localhost:9222`) have their flags silently ignored with no warning.

2. **`--cdp-url` combined with browser launch settings**:
   When `--cdp-url` is provided, Playwright connects directly to an already-running personal Chrome browser over Chrome DevTools Protocol (`pw.chromium.connect_over_cdp`). Browser launch options such as `--headless`, `--browser`, `--browser-path`, and `--persistent-profile` are completely bypassed and ignored, creating false expectations.

3. **`--persistent-profile` combined with `--storage-state`**:
   These represent two competing session persistence mechanisms:
   - `--persistent-profile`: Uses a full Chrome User Data Directory on disk (`~/.substack_scraper/chrome_profile/`).
   - `--storage-state`: Uses an ephemeral incognito browser context loaded from and saved to a JSON cookie state file.
   Combining them is contradictory and unsupported by persistent contexts.

4. **`--number > 1` applied to single-post URLs**:
   Passing `--number` greater than 1 when `--url` points to an individual post (`https://.../p/<slug>`) is contradictory and invalid since an individual post target can only yield at most 1 post.

---

## Proposed Solution

Add comprehensive argument validation in `parse_args()` in [`scraper/cli.py`](../../scraper/cli.py):

### 1. Require `--premium` for Browser-Specific Options
If any browser automation option is provided without `-p / --premium`, trigger a descriptive `parser.error()`:
```python
browser_flags_provided = any(
    [
        args.headless,
        args.persistent_profile,
        args.skip_login,
        bool(args.storage_state),
        bool(args.cdp_url),
        bool(args.browser_path),
        bool(args.user_agent),
        args.browser != "chrome",  # explicitly set to edge
    ]
)
if not args.premium and browser_flags_provided:
    parser.error(
        "Browser automation options (--headless, --cdp-url, --persistent-profile, "
        "--storage-state, --browser, etc.) require the -p / --premium flag."
    )
```

### 2. Disallow Launch Options When Using `--cdp-url`
When attaching to an existing browser via CDP, launch-time options are invalid:
```python
if args.cdp_url:
    incompatible_with_cdp = [
        ("--headless", args.headless),
        ("--browser-path", bool(args.browser_path)),
        ("--persistent-profile", args.persistent_profile),
        ("--storage-state", bool(args.storage_state)),
    ]
    for flag_name, is_set in incompatible_with_cdp:
        if is_set:
            parser.error(
                f"--cdp-url cannot be combined with {flag_name} (CDP attaches to an active external browser window)."
            )
```

### 3. Mutual Exclusivity: `--persistent-profile` vs `--storage-state`
```python
if args.persistent_profile and args.storage_state:
    parser.error("--persistent-profile and --storage-state are mutually exclusive session persistence strategies.")
```

### 4. Guard Single Post URLs Against `--number > 1`
```python
if is_post_url(args.url):
    if args.number > 1:
        parser.error(f"--number cannot be greater than 1 when scraping a single post URL ({args.url}).")
```

---

## Changes Required

- **[`scraper/cli.py`](../../scraper/cli.py)**:
  - Add `validate_args(args: argparse.Namespace, parser: argparse.ArgumentParser) -> None`.
  - Enforce validation rules for premium flags, CDP combinations, persistence strategies, and single-post targets.
- **[`tests/test_scraper.py`](../../tests/test_scraper.py)**:
  - Add unit tests verifying `parser.error` exits cleanly with expected messages for all conflicting combinations.
- **[`.agents/README.md`](../README.md)**:
  - Register `stm-032` under Category `fix`.

---

## Verification Plan

### Automated Tests
```bash
uv run pytest tests/test_scraper.py -k "cli_validation"
uv run ruff check .
uv run ruff format --check .
```

### Manual CLI Checks
```bash
# Expect error: requires --premium
uv run scraper --url https://example.substack.com --headless
uv run scraper --url https://example.substack.com --cdp-url http://localhost:9222

# Expect error: incompatible with CDP
uv run scraper --url https://example.substack.com --premium --cdp-url http://localhost:9222 --headless

# Expect error: mutually exclusive persistence
uv run scraper --url https://example.substack.com --premium --persistent-profile --storage-state state.json
```

# CLI Experience & Logging

## Goal

1. **Standardized Logging Framework**: Replace scattered `print()` statements across scrapers with standard Python logging (`logging.getLogger("substack_scraper")`).
2. **CLI Verbosity Controls**: Introduce `--verbose` / `-v` (sets log level to `DEBUG`) and `--quiet` / `-q` (sets log level to `WARNING` or `ERROR`) flags in `substack_scraper/cli.py` as a mutually exclusive pair.
3. **Streamlined Profile Resolution**: If `--persistent-profile` or an existing non-empty `storage_state.json` is detected when Substack credentials are not set, automatically default or infer `skip_login=True` with a clear informational log instead of abruptly raising a `ValueError`.

---

## Architectural Context

Currently:
- `substack_scraper/cli.py` configures `logging.basicConfig(level=logging.INFO, ...)` at line 155, but several components continue to use raw `print()` statements:
  - Directory creation messages in `substack_scraper/scrapers/base.py` (`Created md directory...`)
  - Sitemap / feed fallback error messages in `substack_scraper/scrapers/base.py`
  - Extraction failure debug dumps in `substack_scraper/scrapers/base.py` (`[EXTRACT FAIL] url=...`)
  - File existence skip messages in `substack_scraper/scrapers/base.py` (`File already exists: ...`)
  - Premium post skipping notifications in `substack_scraper/scrapers/free.py` (`Skipping premium article: ...`)
- If a user runs `substack_scraper --url ... --premium --persistent-profile` without setting `.env` / environment variables, `PremiumSubstackScraper.__init__` checks credentials before checking persistent profile directories, throwing a hard `ValueError` unless `--skip-login` is explicitly passed.

---

## Trade-offs and Key Considerations

| Dimension | Current Behavior | Proposed Behavior | Trade-offs & Notes |
| :--- | :--- | :--- | :--- |
| **Output Cleanliness** | Direct `print()` statements bypass log formatters, handlers, and filters. | All operational notifications use `logger.info`, `logger.debug`, or `logger.warning`. | Integrates cleanly into automated pipelines and log forwarders without stdout/stderr clutter. |
| **CLI Verbosity Control** | Fixed at `INFO`; debug details (e.g. extraction diagnostics) are either printed unconditionally or require manual code edits. | `--verbose` / `-v` unlocks detailed debug diagnostics (e.g. selector misses, image retry details). `--quiet` / `-q` silences normal progress. | Better user experience for cron jobs or quiet terminal workflows. |
| **Profile Credential Check** | Hard requirement on `SUBSTACK_EMAIL` and `SUBSTACK_PASSWORD` unless `--skip-login` is explicitly passed. | Auto-enables `skip_login=True` if a persistent profile or storage state already exists on disk. | Reduces friction when reusing an authenticated session without forcing users to pass redundant flags. |

---

## Key Design Decisions

1. **No `tqdm` Log-Wrapping**:
   - Standard Python logging writes directly to `sys.stderr` via standard stream handlers. Do not route logging calls through `tqdm` or use custom tqdm log handlers. Keep standard logging clean and decoupled.
2. **Mutual Exclusion of `-v` and `-q`**:
   - Enforced using `parser.add_mutually_exclusive_group()` for `-v` / `--verbose` and `-q` / `--quiet` so specifying both flags generates a clean CLI syntax error.

---

## Proposed Changes

### 1. CLI Arguments & Logging Setup (`substack_scraper/cli.py`)

#### [MODIFY] `substack_scraper/cli.py`
- In `parse_args()`:
  - Add mutually exclusive group for verbosity:
    - `-v`, `--verbose`: Enable debug logging (`logging.DEBUG`).
    - `-q`, `--quiet`: Silence standard output, only logging warnings and errors (`logging.WARNING`).
- In `main()`:
  - Adjust log level based on parsed arguments (`DEBUG` if `args.verbose`, `WARNING` if `args.quiet`, else `INFO`).
  - Configure format and datefmt cleanly.

---

### 2. Standardized Logger in Scrapers (`substack_scraper/scrapers/base.py` & `free.py`)

#### [MODIFY] `substack_scraper/scrapers/base.py`
- Initialize module-level logger: `logger = logging.getLogger(__name__)`.
- Replace `print(f"Created md directory {md_save_dir}")` -> `logger.info(...)`.
- Replace `print(f"Created html directory {self.html_save_dir}")` -> `logger.info(...)`.
- Replace sitemap/feed error prints -> `logger.warning(...)`.
- Replace `print(f"File already exists: {filepath}")` -> `logger.info(...)` or `logger.debug(...)`.
- Replace `[EXTRACT FAIL]` print block with formatted `logger.warning(...)` / `logger.debug(...)`.

#### [MODIFY] `substack_scraper/scrapers/free.py`
- Initialize module-level logger: `logger = logging.getLogger(__name__)`.
- Replace `print(f"Skipping premium article: {url}")` -> `logger.info(...)`.
- Replace 429 retry prints -> `logger.warning(...)`.

---

### 3. Streamlined Profile & Credential Resolution (`substack_scraper/scrapers/premium.py`)

#### [MODIFY] `substack_scraper/scrapers/premium.py`
- In `__init__`:
  - Check if persistent profile directory exists or `has_storage` is true.
  - If credentials are missing, but `use_persistent_profile` or `has_storage` or `cdp_url` is provided, automatically set `skip_login = True` and emit `logger.info("Credentials not provided; reusing existing persistent profile or storage state.")`.
  - Only raise `ValueError` if login is required and no credentials or reusable session can be found.

---

### 4. Tests (`tests/test_substack_scraper.py`)

#### [MODIFY] `tests/test_substack_scraper.py`
- Add unit tests:
  - `test_cli_verbose_and_quiet_mutually_exclusive`: Verify `--verbose` and `--quiet` cannot be combined.
  - `test_cli_verbose_and_quiet_flags`: Verify `--verbose` and `--quiet` set correct log levels.
  - `test_premium_auto_skip_login_with_persistent_profile`: Verify that when credentials are unset but `use_persistent_profile=True` or `storage_state` exists, `PremiumSubstackScraper` does not raise `ValueError`.
  - `test_scrapers_use_logging_instead_of_print`: Verify logger is called during file skip and directory creation.

---

## Verification Plan

### Automated Tests
1. Run pytest suite:
   ```bash
   uv run pytest -v
   ```
2. Run code style checks:
   ```bash
   uv run ruff check .
   uv run ruff format --check .
   ```

### Manual Verification
1. Run CLI with `-v` to confirm debug output appears.
2. Run CLI with `-q` to confirm non-warning output is suppressed.
3. Run CLI with both `-v` and `-q` to confirm mutual exclusion error.

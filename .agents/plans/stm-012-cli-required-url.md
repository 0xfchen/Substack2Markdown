# Make --url Required in CLI and Display Help on Bare Invocation

## Goal

1. Make the target newsletter `--url` a mandatory argument in the CLI.
2. Display formatted help and usage guidelines when the CLI is executed without arguments, rather than attempting to scrape hardcoded or default test URLs.

---

## Background & Problem

Previously, `substack_scraper` defaulted to scraping an author URL hardcoded in the codebase when invoked without `--url`.
This was confusing for users, as accidentally running `substack_scraper` without parameters would start downloading dozens of essays from an arbitrary newsletter.

---

## Proposed Changes

### 1. CLI Argument Enforcement (`substack_scraper/cli.py`)

- In `parse_args()`:
  - Check if `len(sys.argv) == 1` (bare invocation). If so, print full argument help (`parser.print_help()`) and exit with status code 2.
  - Mark `--url` argument as `required=True`.
- In `main()`:
  - Remove fallback to script defaults / hardcoded values.
  - Initialize scrapers directly with `args.url`.

### 2. Constructor Cleanups (`substack_scraper/scrapers/premium.py`)

- Ensure `PremiumSubstackScraper` properly validates that `base_substack_url` is provided and non-empty.

---

## Verification Plan

### Automated Tests
- In `tests/test_substack_scraper.py`:
  - `test_main_bare_command_shows_help_and_exits`: Test running without CLI arguments and verify `SystemExit` code is non-zero and help text is displayed on stdout/stderr.


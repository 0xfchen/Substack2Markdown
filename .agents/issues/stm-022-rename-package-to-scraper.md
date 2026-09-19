# Refactor: Rename Package and CLI from `substack_scraper` to `scraper`

## Problem Description

The project was initially structured under the package name `substack_scraper`, both as the source code folder and the primary CLI script entry point. To make the module naming cleaner, more concise, and aligned with the repository's generic scraper architecture, the package directory and CLI entrypoint were requested to be renamed directly to `scraper`.

---

## Proposed Solution / Root Cause

- Rename top-level Python package directory `substack_scraper/` to `scraper/`.
- Rename test module `tests/test_substack_scraper.py` to `tests/test_scraper.py`.
- Update `pyproject.toml` script definitions and setuptools package discovery to register `scraper = "scraper:main"`.
- Update internal module references (`sys.modules.get("scraper")`, `logging.getLogger("scraper")`) while preserving backwards-compatible fallbacks.
- Update documentation and architectural diagrams in `AGENTS.md` and `README.md`.

---

## Changes Made

- [`pyproject.toml`](../../pyproject.toml):
  - Updated `[project.scripts]` to register `scraper = "scraper:main"`.
  - Updated `[tool.setuptools]` packages list to `["scraper", "scraper.scrapers"]`.
- [`scraper/`](../../scraper/):
  - Moved from `substack_scraper/` to `scraper/`.
  - [`scraper/__main__.py`](../../scraper/__main__.py): Updated entry import to `from scraper import main`.
  - [`scraper/cli.py`](../../scraper/cli.py): Updated logger name to `"scraper"`, CLI help examples to `scraper --url ...`, and `sys.modules` lookup to `"scraper"`.
  - [`scraper/images.py`](../../scraper/images.py): Updated `sys.modules.get("scraper")` lookups for `requests` and `download_image` test patching.
- [`tests/test_scraper.py`](../../tests/test_scraper.py):
  - Moved from `tests/test_substack_scraper.py` to `tests/test_scraper.py`.
  - Updated imports and patch paths from `substack_scraper.*` to `scraper.*`.
  - Updated test CLI invocations in `sys.argv` to `scraper`.
- [`AGENTS.md`](../../AGENTS.md):
  - Updated Mermaid architectural flowcharts, module responsibility lists, command examples, and rules.
- [`README.md`](../../README.md):
  - Updated CLI usage examples to `uv run scraper --url ...` and `python -m scraper --url ...`.

---

## Verification

### Automated Tests
- Ran complete pytest suite:
  ```bash
  uv run pytest
  ```
  Result: 82 passed in 7.76s.

- Ran code linting and formatting:
  ```bash
  uv run ruff check .
  uv run ruff format --check .
  ```
  Result: All checks passed, 40 files formatted.

### Manual Verification
- Tested CLI help entrypoint:
  ```bash
  uv run scraper --help
  ```
  Result: Successfully displayed the updated scraper CLI help menu with options and examples.


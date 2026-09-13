# Remove config.py Fallback for Credentials in Favor of .env and Environment Variables

## Problem Description

Historically, the project encouraged storing Substack login credentials directly inside a root Python file `config.py`:
```python
EMAIL = "my-email@example.com"
PASSWORD = "my-password"
```
Even after environment variable and `.env` support was introduced, `get_credentials()` maintained a dynamic import fallback (`from config import EMAIL, PASSWORD`).
This created significant security risks:
- Users frequently committed sensitive account credentials to version control.
- Shipping or referencing `config.py` templates caused merge conflicts and confusion with `.env.example`.
- Having multiple competing configuration mechanisms complicated credential debugging.

## Proposed Solution

1. Deprecate and remove the `config.py` credential fallback entirely from `get_credentials()`.
2. Standardize credential resolution strictly on:
   - Environment variables: `SUBSTACK_EMAIL` and `SUBSTACK_PASSWORD`.
   - `.env` file loaded automatically via `python-dotenv`.
3. Provide `.env.example` as the canonical template.

## Changes Made

- `substack_scraper/config.py`:
  - Removed `try: from config import EMAIL, PASSWORD ...` block from `get_credentials()`.
  - Kept credential retrieval purely reliant on `os.getenv("SUBSTACK_EMAIL", "")` and `os.getenv("SUBSTACK_PASSWORD", "")` after `.env` discovery.
- `README.md` & `AGENTS.md`:
  - Removed all mentions of creating or editing `config.py` for credentials.
  - Documented `.env` file copying from `.env.example` and environment variable exports.
- `tests/test_substack_scraper.py`:
  - Removed legacy tests asserting `config.py` import precedence and verified environment variables and `.env` files take proper effect.

## Verification

- Automated pytest suite:
  ```bash
  uv run pytest tests/test_substack_scraper.py -k "credentials"
  ```
- Verified that `get_credentials()` returns empty strings safely when no `.env` or environment variables exist without failing with an ImportError.


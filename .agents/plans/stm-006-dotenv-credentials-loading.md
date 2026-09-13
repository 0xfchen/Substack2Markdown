# Load Credentials from .env File

## Goal

Provide a secure and convenient mechanism for users to supply Substack authentication credentials via a local `.env` file, eliminating the need to manually export shell environment variables or edit python scripts.

---

## Background & Problem

Substack premium content scraping requires login credentials (`SUBSTACK_EMAIL` and `SUBSTACK_PASSWORD`).
Previously, users had to either:
1. Export environment variables in their shell session (`export SUBSTACK_EMAIL=...`), which is session-volatile on Windows command line or PowerShell.
2. Edit a python file directly, which risks accidental Git commits.

---

## Proposed Changes

### 1. Dependency Integration (`pyproject.toml`)

- Add `python-dotenv>=1.0.0` to project dependencies.
- Update `uv.lock`.

### 2. Dotenv Loading Pipeline (`substack_scraper/config.py`)

- Update `get_credentials() -> tuple[str, str]`:
  - Dynamically load environment variables from the nearest `.env` file using `dotenv.find_dotenv(usecwd=True)` and `dotenv.load_dotenv(dotenv_path)`.
  - Read `os.getenv("SUBSTACK_EMAIL", "")` and `os.getenv("SUBSTACK_PASSWORD", "")`.

### 3. Template and Git Hygiene

- Create `.env.example`:
  ```ini
  # Substack credentials for premium content scraping
  SUBSTACK_EMAIL=your-email@example.com
  SUBSTACK_PASSWORD=your-password
  ```
- Ensure `.env` is ignored in `.gitignore`.

---

## Verification Plan

### Automated Tests
- In `tests/test_substack_scraper.py`:
  - `test_get_credentials_loads_from_env_file`: Create a temporary `.env` file in `tmp_path`, clear existing environment variables, and verify `get_credentials()` returns the expected email and password.


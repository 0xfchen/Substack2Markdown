# Premium Scraper Session Redirect Timeout and SSR Hydration Paywall Check

## Problem Description

When running the premium scraper on an account that already had saved session cookies (`storage_state.json` or persistent browser profile) or when scraping Substack articles on custom domains, two compounding issues prevented post scraping:

1. **30-Second Login Hang on Pre-authenticated Sessions**:
   In `substack_scraper/scrapers/premium.py`, if credentials existed in `.env` (or environment variables) and `--skip-login` was not explicitly supplied, `self._login()` was invoked unconditionally. When navigating to `https://substack.com/sign-in`, Substack detected the existing session cookies from `storage_state.json` and immediately redirected away from the login page to the user's dashboard/home feed (`https://substack.com/`). The scraper then attempted:
   ```python
   self.page.fill("input[name='email']", self.email)
   ```
   Because the page had already redirected to the home feed where no email input exists, Playwright blocked for the full 30,000 ms locator timeout before raising:
   ```text
   [WARNING] substack_scraper.scrapers.premium: Notice during form fill: Page.fill: Timeout 30000ms exceeded.
   ```
   Although this exception was caught and execution continued, the scraper stalled for 30 seconds unnecessarily on every invocation.

2. **Premature Paywall Detection Due to SSR Hydration Timing**:
   When fetching an article URL in `get_url_soup()`:
   ```python
   self.page.wait_for_selector(
       "div.available-content, h1.post-title, h2.paywall-title, body > pre",
       timeout=20000,
   )
   ```
   In Substack's Server-Side Rendered (SSR) HTML markup for paid articles, `h1.post-title` and `h2.paywall-title` are both present in the initial static DOM payload before client-side JavaScript runs. Because `h1.post-title` matches immediately upon page load (~50 ms), `wait_for_selector` returned before client-side React hydration ran.
   Immediately thereafter, the scraper checked:
   ```python
   if soup.find("h2", class_="paywall-title"):
       logger.info("Skipping premium article (no access): %s", url)
       return None
   ```
   Because `h2.paywall-title` was still present at that exact moment before React evaluated the session cookies and unlocked the body, the scraper falsely concluded that the user had no access and skipped the article.

---

## Proposed Solution / Root Cause

1. **Pre-authentication Redirect Check**:
   In `_login()`, after navigating to `https://substack.com/sign-in`, verify if `self.page.url` no longer contains `"sign-in"`. If Substack immediately redirected away to the homepage or dashboard, the session is already authenticated. The method logs the detected session, persists state via `_save_session_state()`, and returns immediately without attempting form fill. Additionally, a bounded `wait_for(state="visible", timeout=5000)` is used on the email field if on the sign-in page to fail fast rather than hanging for 30s.

2. **Hydration-Aware Paywall Evaluation**:
   In `get_url_soup()`, if `h2.paywall-title` is detected in the initial DOM, explicitly wait for client-side hydration to detach it:
   ```python
   if self.page.locator("h2.paywall-title").count() > 0:
       try:
           self.page.wait_for_selector("h2.paywall-title", state="detached", timeout=5000)
       except PlaywrightTimeoutError:
           pass
   ```
   Only if `h2.paywall-title` remains attached after hydration timeout does the scraper treat the post as paywalled without access.

---

## Changes Made

- [`substack_scraper/scrapers/premium.py`](../../substack_scraper/scrapers/premium.py):
  - Updated `_login()`:
    - Checks `if "sign-in" not in self.page.url:` right after navigation; logs session reuse and returns early.
    - Added `wait_for(state="visible", timeout=5000)` on the email input locator.
  - Updated `get_url_soup()`:
    - Added hydration wait (`self.page.wait_for_selector("h2.paywall-title", state="detached", timeout=5000)`) when `h2.paywall-title` is initially present in SSR markup.

---

## Verification

### Automated Tests
Ran full test suite to ensure no regressions in base or premium scrapers:
```bash
uv run pytest
```
Output: `81 passed in 8.19s` (100% pass rate).

### Linting & Formatting
```bash
uv run ruff check .
uv run ruff format --check .
```
Output: All checks passed; 42 files already formatted.

### Manual Verification
Tested live navigation against `https://newsletter.pragmaticengineer.com/p/what-is-happening-with-code-reviews` using pre-authenticated session state:
- Confirmed SSR initially rendered `h2.paywall-title=True`.
- Confirmed that waiting for hydration detached `h2.paywall-title` (`Paywall: False`, `Content: True`, 22,875 characters extracted).


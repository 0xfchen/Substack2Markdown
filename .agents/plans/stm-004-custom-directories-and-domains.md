# Custom Output Directories and Custom Substack Domains

## Goal

1. **Support Custom Substack Domains**:
   Enable scraping newsletters hosted on custom domains (e.g., `blog.bytebytego.com`, `newsletter.pragmaticengineer.com`, `newsletter.semianalysis.com`) by accurately extracting the canonical author/publication name (`bytebytego`, `pragmaticengineer`, `semianalysis`).
2. **Respect Custom Output Directories**:
   Ensure `generate_html_file()` and `BaseSubstackScraper` respect user-provided custom markdown and HTML output directory arguments instead of falling back to default directories.

---

## Background & Architecture

Previously, `extract_main_part()` performed a naive split on `.substack.com`:
```python
parts = urlparse(url).netloc.split(".")
return parts[1] if parts[0] == "www" else parts[0]
```
When encountering custom domains or subdomains like `blog.bytebytego.com` or `newsletter.pragmaticengineer.com`, it returned `"blog"` or `"newsletter"` instead of `"bytebytego"` or `"pragmaticengineer"`, creating incorrect output directories and filenames.
Furthermore, `generate_html_file()` wrote only to `BASE_HTML_DIR` and read only from `JSON_DATA_DIR`, ignoring CLI directory overrides.

---

## Proposed Changes

### 1. Robust Domain & Publication Name Parsing (`substack_scraper/url_utils.py`)

- Enhance `extract_main_part(url: str) -> str`:
  - Normalize hostnames, strip ports, and handle URLs missing explicit schemes (`https://`).
  - Handle Substack standard subdomains: strip `.substack.com` to isolate the subdomain slug.
  - Handle custom domain prefixes: recognize common prefixes (`www`, `blog`, `news`, `newsletter`) and extract the primary brand domain.
  - Provide fallback to `"substack"` for generic root domains.

### 2. Custom Output Directory Propagation (`substack_scraper/catalog.py` & `substack_scraper/scrapers/base.py`)

- Update `generate_html_file(author_name: str, html_dir: str | None = None, data_dir: str | None = None) -> None`:
  - Accept optional `html_dir` and `data_dir` parameters.
  - Default to global `BASE_HTML_DIR` and `JSON_DATA_DIR` when not provided.
  - Create the target HTML directory dynamically if it does not yet exist.
- Update `BaseSubstackScraper`:
  - Save `self.base_md_dir` and `self.base_html_dir`.
  - Pass `html_dir=self.base_html_dir` to `generate_html_file()`.

### 3. Viewer Asset Navigation (`assets/js/populate-essays.js`)

- Update `targetLink` resolution in `populateEssays()`:
  - Guard against null or missing links.
  - Support external links, absolute root paths, and relative paths without double-prepending `../`.

---

## Verification Plan

### Automated Tests
- Unit tests in `tests/test_substack_scraper.py`:
  - `test_extract_main_part_supports_custom_domains`: Test domain parsing against standard Substack URLs, custom apex domains, and custom subdomain publications.
  - `test_generate_html_file_honors_custom_directories`: Verify that passing custom directory paths writes `<author>.html` to the custom directory and loads data from the custom data directory.


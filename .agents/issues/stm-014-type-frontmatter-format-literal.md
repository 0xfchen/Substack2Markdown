# Type frontmatter_format with Literal['mdx', 'legacy']

## Problem Description

The `frontmatter_format` parameter across `BaseSubstackScraper`, `SubstackScraper`, and `PremiumSubstackScraper` was annotated loosely as `str`.
- IDEs and static type checkers (such as `mypy` or `pyright`) could not provide auto-completion or validate supported format names.
- Invalid format strings (e.g. typos like `"markdown"` or `"yaml"`) were not caught at type-check time.

## Proposed Solution

1. Define a strict type alias `FrontmatterFormat = Literal["mdx", "legacy"]`.
2. Apply `FrontmatterFormat` to method signatures and class constructor parameters across all scraper classes.
3. Export `FrontmatterFormat` from `substack_scraper` and `substack_scraper.scrapers` for public API consumers.

## Changes Made

- `substack_scraper/scrapers/base.py`:
  - Defined `FrontmatterFormat = Literal["mdx", "legacy"]`.
  - Updated `__init__`, `combine_metadata_and_content`, and related methods to type `frontmatter_format: FrontmatterFormat`.
- `substack_scraper/scrapers/free.py` & `substack_scraper/scrapers/premium.py`:
  - Updated constructors to use `frontmatter_format: FrontmatterFormat = "mdx"`.
- `substack_scraper/scrapers/__init__.py` & `substack_scraper/__init__.py`:
  - Exported `FrontmatterFormat` in `__all__`.

## Verification

- Automated pytest suite:
  ```bash
  uv run pytest tests/test_substack_scraper.py
  ```
- Lint and type checking via ruff:
  ```bash
  uv run ruff check .
  ```


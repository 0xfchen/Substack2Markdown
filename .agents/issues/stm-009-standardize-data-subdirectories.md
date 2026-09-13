# Standardize Output Folders into data/ Subdirectories

## Problem Description

The scraper generated outputs in multiple disjoint directories across the repository root:
- `substack_md_files/`: Scraped markdown articles.
- `substack_html_pages/`: Generated author catalog pages.
- `substack_images/`: Downloaded images.
- `data/`: Author JSON metadata records (`<author>.json`).

This scattered top-level directory structure cluttered the project root and complicated `.gitignore` and backup/sync workflows.

## Proposed Solution

Consolidate all scraped output files and metadata artifacts under a unified `data/` directory:
- `data/md_files/<author>/`: Markdown articles.
- `data/html_pages/<author>.html`: Author catalog listing pages.
- `data/images/<author>/<post_slug>/`: Downloaded post images.
- `data/<author>.json`: Author metadata records.

## Changes Made

- `substack_scraper/config.py`:
  - Updated default directory constants:
    - `BASE_MD_DIR = "data/md_files"`
    - `BASE_HTML_DIR = "data/html_pages"`
    - `BASE_IMAGE_DIR = "data/images"`
    - `JSON_DATA_DIR = "data"`
- `.gitignore`:
  - Replaced legacy output directory ignores with rules ignoring content inside `data/md_files/`, `data/html_pages/`, and `data/images/` while keeping `data/README.md`.
- `README.md` & `data/README.md`:
  - Updated all documentation, directory tree diagrams, and usage examples to reflect the new `data/` structure.
- `tests/test_substack_scraper.py`:
  - Updated directory path assertions in integration tests.

## Verification

- Automated pytest suite:
  ```bash
  uv run pytest -v
  ```
- Verified directory creation and clean separation under `data/` during sample scrape execution.


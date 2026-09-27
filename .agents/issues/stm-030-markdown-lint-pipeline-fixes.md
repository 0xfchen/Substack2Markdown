# Fix Systematic Markdown Lint Violations in Scraper Pipeline

## Problem Description

Running `pymarkdownlnt` against scraped articles reveals **363 violations across 14 rules** in a single representative file ([openai-software-factory.md](../../content/pragmaticengineer/posts/openai-software-factory.md)). These are not one-off typos — they are **systematic patterns** produced by the `html2text` conversion pipeline and post-processing in `BaseSubstackScraper`.

The issues cause articles to render with inconsistent formatting: extra whitespace in blockquotes, doubled blank lines between sections, irregular heading spacing, and mixed list markers.

### Violation Summary

| Count | Rule | Description | Root Cause |
|------:|------|-------------|------------|
| 173 | **MD013** | Line length > 80 chars | Long-form prose — **disable in lint config** |
| 76 | **MD007** | List indentation (2-space instead of 0) | `html2text` default list indent |
| 24 | **MD009** | Trailing spaces (1 space instead of 0 or 2) | Blockquote continuation lines |
| 23 | **MD027** | Multiple spaces after blockquote `>` | `html2text` `<blockquote>` rendering |
| 20 | **MD012** | Multiple consecutive blank lines (3–4) | Substack `<div>` spacer elements |
| 20 | **MD004** | Mixed list markers (`*` vs `-`) | `html2text` uses `*` for `<ul>` |
| 7 | **MD039** | Spaces inside link text `[ text ]` | `html2text` link formatting |
| 6 | **MD022** | Headings not surrounded by exactly 1 blank line | Excess blank lines above headings |
| 5 | **MD045** | Images missing alt text `![]()` | Source Substack HTML lacks `alt` attrs |
| 4 | **MD019** | Multiple spaces after `#` in ATX headings | `html2text` heading conversion |
| 2 | **MD032** | Lists not surrounded by blank lines | Missing blank line before first list item |
| 1 | **MD028** | Blank line inside blockquote | Paragraph break in `<blockquote>` |
| 1 | **MD041** | First line isn't a top-level heading | False positive (YAML frontmatter) — **disable in lint config** |
| 1 | **MD047** | File doesn't end with single newline | Missing trailing newline on write |

### Affected Code Paths

- [`scraper/scrapers/base.py`](../../scraper/scrapers/base.py) — `SubstackHTML2Text` class, `_clean_post_html()` (HTML DOM pre-processing), and `html_to_md()` pipeline
- [`scraper/images.py`](../../scraper/images.py) — Image alt text extraction (MD045)
- Post file write logic in `save_to_file()` (MD047)

## Proposed Solution

**Guiding principle:** Use existing library capabilities instead of hand-rolled regexes wherever possible.

### Part 1: Source-Level Fixes in `html2text` Config

Configure `SubstackHTML2Text.__init__()` to prevent issues at generation time:

| Setting | Effect | Fixes |
|---------|--------|-------|
| `self.dash_unordered_list = True` | Uses `-` instead of `*` for `<ul>` | **MD004** (20 violations) |
| `self.body_width = 0` | Already set — prevents hard-wrapping | **MD013** (already handled) |

These are single-line config changes that eliminate issues before they ever reach the markdown output.

### Part 2: Post-Conversion Formatting via `mdformat`

[`mdformat`](https://github.com/hukkin/mdformat) is an opinionated, AST-based markdown formatter (the "black for markdown"). It parses markdown into a syntax tree and regenerates it with consistent formatting, naturally fixing most violations without any custom regex:

| Violation | `mdformat` Behavior |
|-----------|---------------------|
| **MD009** (trailing spaces) | Strips all trailing whitespace |
| **MD012** (multiple blank lines) | Collapses to single blank lines |
| **MD019** (multiple spaces after `#`) | Normalizes ATX heading spacing |
| **MD022** (heading blank line spacing) | Ensures exactly 1 blank line around headings |
| **MD027** (multiple spaces after `>`) | Normalizes blockquote spacing |
| **MD032** (lists not surrounded by blank lines) | Adds required blank lines |
| **MD039** (spaces inside link text) | Normalizes `[ text ]` → `[text]` |
| **MD047** (missing trailing newline) | Ensures file ends with `\n` |

**Usage in pipeline:** Call `mdformat.text()` on the converted markdown string inside `html_to_md()`, after `SubstackHTML2Text.handle()` and before returning.

**Usage for retroactive fixing:** Run `mdformat` CLI directly on existing content files.

```bash
# Format all scraped content
mdformat content/

# Check without modifying (CI mode)
mdformat --check content/
```

#### Plugin: `mdformat-gfm`

Install `mdformat-gfm` to preserve GitHub Flavored Markdown features (tables, task lists, strikethrough) that appear in Substack posts.

### Part 3: List Indentation (MD007 — 76 violations)

`mdformat` normalizes list indentation to its opinionated default. Verify that nested lists are rendered correctly after formatting. If `mdformat`'s default indent differs from the desired style, this can be configured or accepted as-is.

### Part 4: Image Alt Text (MD045 — 5 violations)

Lower priority. Requires extracting the `alt` attribute from source `<img>` elements during HTML parsing and passing it through to the markdown image syntax. This touches `_clean_post_html()` and potentially `SubstackHTML2Text`. Not addressable by `mdformat`.

### Part 5: Unified Lint & Fix CLI (`scripts/check_markdown.py`)

A single CLI script that wraps both `pymarkdownlnt` (lint) and `mdformat` (fix):

1. **`--lint`:** Discovers `.md` files under `content/`, runs `pymarkdownlnt`, reports a summary table of violations grouped by rule.
2. **`--fix`:** Runs `mdformat` (via subprocess or API) on the target files, then re-lints to show remaining violations that `mdformat` can't address (e.g. MD045 missing alt text).
3. **`--lint --fix`:** Both in sequence.

**Usage**:
```bash
# Lint all scraped content — report only
uv run python scripts/check_markdown.py --lint

# Lint specific author
uv run python scripts/check_markdown.py --lint --path content/pragmaticengineer

# Auto-fix (runs mdformat, then re-lints)
uv run python scripts/check_markdown.py --fix

# Fix a single file
uv run python scripts/check_markdown.py --fix --path content/pragmaticengineer/posts/openai-software-factory.md
```

## Changes Required

- **`scraper/scrapers/base.py`**:
  - Configure `SubstackHTML2Text` with `self.dash_unordered_list = True`.
  - Update `html_to_md()` to run `mdformat.text()` on the converted output before returning.
- **`scripts/check_markdown.py`** [NEW]:
  - Unified CLI wrapping `pymarkdownlnt` (`--lint`) and `mdformat` (`--fix`).
  - `--fix` runs `mdformat` first, then re-lints to report remaining unfixable violations.
- **Lint config** (`.pymarkdownlnt.json` or inline):
  - Disable **MD013** (line length) — long-form prose should not be hard-wrapped.
  - Disable **MD041** (first line heading) — false positive from YAML frontmatter.
- **`pyproject.toml`**:
  - Add `mdformat` and `mdformat-gfm` as runtime dependencies.
  - Add `pymarkdownlnt` as an optional dev dependency.
- **`tests/test_scraper.py`**:
  - Add integration test verifying a round-tripped post passes lint after `mdformat` processing.

## Verification Plan

### Automated Tests
```bash
uv run pytest -v
uv run ruff check .
uv run ruff format --check .
```

### Manual Verification
- Scrape a known article (e.g. `openai-software-factory`) and re-run `pymarkdownlnt` — confirm violation count drops to near-zero.
- Run `mdformat --check content/` to verify all existing content is already formatted.
- Run `mdformat content/` on the full archive, then re-lint to verify idempotent cleanup.
- Visually inspect a handful of formatted articles in the Astro reader to confirm no rendering regressions (especially tables, code blocks, and nested lists).

# Streamline Library Hero Header and Eliminate Redundant Title

## Problem Description

On the Astro reader home page (`/`), the branding string **"Substack Reader"** (`SITE_TITLE`) was rendered twice in close vertical proximity:
1. In the top sticky navigation header (`Header.astro`) as the application logo brand link.
2. In the hero section (`index.astro`) right above the reading stats card, preceded by an uppercase `"ARCHIVE LIBRARY"` eyebrow badge.

This resulted in redundant visual repetition on the home page:
```
[Substack Reader]                 Library  Feed  Search
ARCHIVE LIBRARY
Substack Reader
Personal local archive of Substack essays and newsletters.
```

## Proposed Solution / Root Cause

Promote the functional title `"Archive Library"` directly into the page's primary `<h1>` element, eliminating the redundant `{SITE_TITLE}` hero heading and the superfluous `.eyebrow-accent` element:
```
[Substack Reader]                 Library  Feed  Search
Archive Library
Personal local archive of Substack essays and newsletters.
```

Benefits:
- Eliminates the repetitive "Substack Reader" branding between the top navigation bar and the hero block.
- Establishes a clean information hierarchy: the top navbar identifies the Application (`Substack Reader`), while the `<h1>` identifies the View (`Archive Library`).
- Reduces vertical header clutter, pulling the reading stats bar and article table higher up above the fold.

## Changes Made

- `reader/src/pages/index.astro`:
  - Promoted `"Archive Library"` into `<h1 class="page-title">`.
  - Removed redundant `<p class="eyebrow-accent">` and `{SITE_TITLE}` hero heading.
  - Cleaned up unused `.eyebrow-accent` CSS rules from `<style>`.
- `reader/public/library-preview.png`:
  - Regenerated high-resolution preview screenshot (2560x1600) reflecting the streamlined non-repetitive hero layout.
- `reader/public/post-preview.png`:
  - Regenerated high-resolution preview screenshot (2880x1800) capturing both the left reading tick rail and the right TOC outline rail.
- `scripts/capture_previews.py`:
  - Reusable Playwright automation script to capture both Library and Article preview screenshots on demand with device scaling, responsive viewports, and hydration selectors.

## Verification

- **Vitest**: All 84 unit tests passing (`cd reader && pnpm test`).
- **Astro Check**: 0 errors, 0 warnings across 55 files (`cd reader && npx astro check`).
- **Python Linter & Pytest**: `ruff check` / `ruff format --check` passing; all 82 pytest tests passing.
- **Visual Verification**: Inspected `library-preview.png` and `post-preview.png`, confirming header streamlining and right rail TOC outline visibility.

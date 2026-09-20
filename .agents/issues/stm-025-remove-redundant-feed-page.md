# Remove Redundant Feed Page and Streamline Reader Navigation

## Problem Description

The Astro reader previously included two overlapping pages for browsing articles:
1. **The Archive Library (`/`)**: A rich reading tracker providing status filters (`To Read`, `Reading`, `Done`), reading progress metrics, multi-column sorting (date, title, author, length, status), author filtering, and BFCache row anchoring.
2. **The Feed (`/posts`)**: A legacy blog timeline view inherited from the upstream `astro-tone` starter theme (`PostFeed.astro`, `posts-index.css`), presenting a chronological list with horizontal category filtering.

In practice for Substack archive reader usage:
- Substack posts extract rich `tags: [...]` rather than an upstream single `category`, leaving the Feed page's category rail largely non-functional.
- The Feed page lacked all reading progress indicators, status buttons, author filters, and sortable columns.
- The top navigation bar displayed both `Library` and `Feed` simultaneously (`[Substack Reader]  Library  Feed  Search`), causing cognitive overlap and navigation ambiguity.

### Side-by-Side Comparison

| Feature | Main Page (`/` — Archive Library) | Feed Page (`/posts` — Feed) |
| :--- | :--- | :--- |
| **Primary Purpose** | Personal reading tracker & archive catalog | Editorial blog timeline |
| **Reading Progress & Status** | **Yes** — Interactive status (`To Read`, `Reading`, `Done`), read counts, progress fill lines | **No** — Has no concept of reading status or progress |
| **Reading Stats & Metrics** | **Yes** — Overview card with completion %, total reads, and status breakdown | **No** |
| **Author Filtering** | **Yes** — Dropdown to filter by publication/author across multiple scraped newsletters | **No** |
| **Sorting** | **Yes** — Sortable columns by Date, Title, Author, Reading Time, and Status | **No** — Strictly fixed reverse-chronological order |
| **Reading Time & Word Count** | **Yes** — Displayed per article (`18 min (3,600 words)`) | **No** |
| **Tag Support** | **Yes** — Displays scraped Substack tags | **Partial** — Only filters by `category`, which Substack posts don't produce by default |
| **Smart Back-Navigation** | **Yes** — Preserves scroll coordinates, active filters, search text, and pulses the row you read | **No** |
| **Search** | Instant in-memory search across title, subtitle, author, and tags | Simple client-side search input |

## Proposed Solution / Root Cause

Streamline the reader architecture by removing the redundant Feed view and unifying all browsing and archive tracking into the Archive Library:
- Remove `Feed` from the navigation links in `astro-theme-config.ts`, simplifying the navbar to `Library` and `Search`.
- Configure an automatic Astro redirect in `astro.config.mjs` from `/posts` to `/`.
- Direct fallback navigation links in `404.astro` and `search.astro` to the Library.
- Update related post links in `PostLayout.astro` and `ui.ts` to reference `Library →`.
- Remove dead components, styles, and scripts: `posts/index.astro`, `PostFeed.astro`, `post-feed.ts`, and `posts-index.css`.
- Regenerate documentation preview screenshots to reflect the streamlined header navigation.

## Changes Made

- `reader/astro-theme-config.ts`:
  - Removed `{ label: 'Feed', href: '/posts' }` from `config.nav`.
- `reader/astro.config.mjs`:
  - Added static redirect rule `redirects: { '/posts': '/' }`.
- `reader/src/layouts/PostLayout.astro`:
  - Updated related posts footer link from `postsBase` to `libraryBase` (`/`).
  - Removed unused `postsBase` import.
- `reader/src/ui.ts`:
  - Updated `allPosts` text from `'Feed →'` to `'Library →'`.
  - Cleaned up obsolete feed UI string constants (`postsEyebrow`, `postsTitle`, `postFeed`, etc.).
- `reader/src/pages/404.astro`:
  - Updated action buttons to `Library` (`/`) and `Search` (`/search`).
- `reader/src/pages/search.astro`:
  - Updated noscript fallback link from `/posts/` to the library archive (`/`).
- `reader/src/pages/index.astro`:
  - Removed obsolete `import '../styles/pages/posts-index.css'`.
- Deleted obsolete files:
  - `reader/src/pages/posts/index.astro`
  - `reader/src/components/PostFeed.astro`
  - `reader/src/scripts/post-feed.ts`
  - `reader/src/styles/pages/posts-index.css`
- `reader/public/library-preview.png`:
  - Regenerated preview screenshot showing the clean `Library  Search` navigation bar.
- `reader/public/post-preview.png`:
  - Regenerated preview screenshot showing the clean `Library  Search` navigation bar and right TOC outline rail.

## Verification

- **Astro Check**: 0 errors, 0 warnings across 52 files (`astro check`).
- **Vitest**: All 84 unit tests passing (`vitest run`).
- **Astro Build**: Successfully built static distribution with automatic `/posts` -> `/` redirect.
- **Visual Verification**: Regenerated and inspected `library-preview.png` and `post-preview.png`.


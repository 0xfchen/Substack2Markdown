# Interactive 3D Origami Crane for 404 Page and Contrast Enhancement

## Goal

1. **Primary Goal**: Create a delightful, interactive 3D Origami Crane (bird) using Three.js on the 404 Not Found page with realistic paper facet geometry, crease wireframe accents, animated wing flapping, zero-gravity hover bobbing, mouse parallax banking, and click-to-soar acrobatic spins.
2. **Secondary Goal**: Enhance the visual contrast and readability of the "404" status code in both Light and Dark themes, and streamline the 404 navigation action buttons to the two essential paths (`Library` and `Search`).

---

## Background & Architecture

The previous 404 page was basic and contained redundant navigation buttons ("Go to Library", "Go to Feed", "Search Posts"). Furthermore, the large "404" status text utilized a faint 10% opacity wash (`var(--fill-secondary)`) which made it barely legible in both light and dark modes.

To create a memorable and delightful reader experience when users hit non-existent URLs, we replaced the static layout with a responsive two-column grid featuring:
- A custom-modeled 3D Origami Crane (Japanese *Orizuru*) built procedurally with double-sided paper facets, crisp crease lines, and articulated flapping wings.
- Full dark/light theme awareness adapting paper shading and crease line luminosity via a `MutationObserver` on `data-theme`.
- Battery-conscious performance: pauses via `IntersectionObserver` when offscreen, resizes dynamically via `ResizeObserver`, and respects `prefers-reduced-motion`.
- High-contrast `.not-found-code` styling using `var(--label-secondary)` for clear legibility in light (`rgba(24, 31, 36, 0.72)`) and dark (`rgba(239, 247, 250, 0.76)`) modes.

---

## Proposed Changes

### 1. Reader Dependencies (`reader/package.json`, `reader/pnpm-lock.yaml`)
- Added `three` (`^0.186.0`) and `@types/three` (`^0.186.0`).

### 2. Three.js 404 Scene Component (`reader/src/components/Three404Scene.astro`)
- Created procedural origami crane with faceted body, neck, head, beak, tail, and articulated left/right wings.
- Integrated sine-wave wing flapping rhythm synchronized with vertical aerodynamic hover bobbing.
- Added mouse parallax tracking and click-to-soar acrobatic spin.
- Added ambient floating paper dust particles.
- Added dynamic dark/light theme observer and cleanup listeners.

### 3. 404 Page Template (`reader/src/pages/404.astro`)
- Updated layout to a clean two-column grid (`.not-found-grid`) embedding `<Three404Scene />`.
- Retained clean, essential navigation actions: `Library` and `Search`.

### 4. 404 Page Styles (`reader/src/styles/pages/not-found.css`)
- Increased `.not-found-code` contrast using `color: var(--label-secondary)`.
- Added responsive styling for the visual container and mobile stacking.

---

## Verification Plan

### Automated Tests
- TypeScript & Astro diagnostics:
  ```bash
  nvs use lts; cd reader; pnpm check
  ```
  *(Result: 0 errors, 0 warnings across 53 files)*
- Reader unit tests:
  ```bash
  nvs use lts; cd reader; pnpm test
  ```
  *(Result: 84 passed)*
- Scraper test suite:
  ```bash
  uv run pytest
  ```
  *(Result: 82 passed)*
- Python linting and formatting:
  ```bash
  uv run ruff check .
  uv run ruff format --check .
  ```

### Manual Verification
- Visual inspection of the 404 page in both Light and Dark themes via headless browser capture.
- Verified smooth wing-flapping animation, responsive layout on desktop and mobile viewports, and sharp legibility of the "404" header.

# Extract Inline Scripts from Astro Components into Dedicated Client Modules

## Problem Description

Multiple Astro components previously housed multi-line, inline `<script>` blocks embedded directly inside their `.astro` templates:
1. **[`reader/src/components/FloatingNavigation.astro`](../../reader/src/components/FloatingNavigation.astro#L97-L145)** contained 48 lines of raw DOM logic (scroll-to-top handler, scroll position threshold listener, and back-to-library navigation delegation).
2. **[`reader/src/components/ThreeGraphScene.astro`](../../reader/src/components/ThreeGraphScene.astro#L236-L258)** contained 22 lines of setup, teardown tracking, and dual `astro:page-load` + `DOMContentLoaded` fallback listeners.
3. **[`reader/src/components/Three404Scene.astro`](../../reader/src/components/Three404Scene.astro#L20-L30)** contained 10 lines of lifecycle setup listeners.
4. **[`reader/src/components/ReadingStatusButton.astro`](../../reader/src/components/ReadingStatusButton.astro#L23-L28)** contained 6 lines of split initialization logic.

### Deficiencies of Inline Scripts:
- **No Automated Unit Testability**: Logic embedded directly within `.astro` template blocks cannot be cleanly imported or tested under Vitest.
- **Divergent Lifecycle Handling**: Inconsistent handling of Astro View Transitions (`astro:page-load`, `DOMContentLoaded`, and teardown callbacks).
- **Bundling & Caching Inefficiencies**: Inline script tags complicate bundling and prevent effective browser caching compared to dedicated ESM client modules.

---

## Proposed Solution / Root Cause

### 1. Dedicated Client Module: `floating-navigation.ts`
Extracted all floating navigation logic into [`reader/src/scripts/floating-navigation.ts`](../../reader/src/scripts/floating-navigation.ts), exporting:
- `initFloatingNavigation()`: Idempotent DOM query and event listener setup.
- `mountFloatingNavigation()`: Lifecycle orchestration for `DOMContentLoaded` and `astro:page-load`.

### 2. Standardized Mounting Helpers Across Client Scripts
Exported unified `mountX()` functions that encapsulate setup, teardown idempotency, and Astro View Transitions:
- **[`reader/src/scripts/three-graph.ts`](../../reader/src/scripts/three-graph.ts)**: Added `mountThreeGraphScene()` managing active teardown functions across Astro page navigations.
- **[`reader/src/scripts/three-404.ts`](../../reader/src/scripts/three-404.ts)**: Added `mountThree404Scene()`.
- **[`reader/src/scripts/reading-status-button.ts`](../../reader/src/scripts/reading-status-button.ts)**: Added `mountReadingStatusButtons()`.

### 3. Streamlined Component Script Blocks
Reduced all four `.astro` script tags to uniform 4-line import-and-call invocations.

---

## Changes Made

1. **[`reader/src/scripts/floating-navigation.ts`](../../reader/src/scripts/floating-navigation.ts)**:
   - Created client module with Rule 10 compliant variables (`SCROLL_DISTANCE_THRESHOLD`, `scrollTopButton`, `homeLinkButton`, `updateScrollTopVisibility`).
2. **[`reader/src/scripts/__tests__/floating-navigation.test.ts`](../../reader/src/scripts/__tests__/floating-navigation.test.ts)**:
   - Added 6 unit tests covering scroll-top button click, scroll position threshold visibility toggling, homepage scroll-to-top, post-page back delegation, and idempotent initialization.
3. **[`reader/src/scripts/three-graph.ts`](../../reader/src/scripts/three-graph.ts)**:
   - Exported `mountThreeGraphScene()`.
4. **[`reader/src/scripts/three-404.ts`](../../reader/src/scripts/three-404.ts)**:
   - Exported `mountThree404Scene()`.
5. **[`reader/src/scripts/reading-status-button.ts`](../../reader/src/scripts/reading-status-button.ts)**:
   - Exported `mountReadingStatusButtons()`.
6. **Astro Components Refactored**:
   - [`reader/src/components/FloatingNavigation.astro`](../../reader/src/components/FloatingNavigation.astro)
   - [`reader/src/components/ThreeGraphScene.astro`](../../reader/src/components/ThreeGraphScene.astro)
   - [`reader/src/components/Three404Scene.astro`](../../reader/src/components/Three404Scene.astro)
   - [`reader/src/components/ReadingStatusButton.astro`](../../reader/src/components/ReadingStatusButton.astro)

---

## Verification Results

### Automated Test Suite
- `vitest run`: All 14 test files and 199 tests passed (including all 6 new tests in `floating-navigation.test.ts`).
- `astro check`: 0 errors, 0 warnings across all `.astro` and `.ts` files.
- `pytest`: All 114 Python unit and integration tests passed.
- `ruff check .` & `ruff format --check .`: Passed with zero lint errors or formatting discrepancies.


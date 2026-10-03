# Remove Dead Code Across Reader

## Problem Description

Over iterative feature additions, several obsolete properties, variables, and styles remained in the reader application:

1. **Unread Map in Graph Topology Generation (`postsByTag`)**:
   - In [`reader/src/utils/graph-data.ts`](../../reader/src/utils/graph-data.ts), `const postsByTag: Record<string, string[]> = {};` was allocated and populated for every tag of every post, but never referenced, exported, or returned in `buildGraphData`.
2. **Dead Properties on `GraphNode` (`group`, `color`, `x/y/z/vx/vy/vz`)**:
   - `group: string;`: Assigned on author, tag, and post nodes, but never read by Three.js rendering loops, simulation physics, or the inspector panel.
   - `color?: string;`: Statically calculated at SSG build time in `graph-data.ts`. However, Three.js dynamically calculates node color at runtime via `getNodeTopicColor(node, isDark)` / `getNodeReadingColor(node, isDark)` to support live theme and display mode toggles, making the precomputed string unused.
   - `x/y/z/vx/vy/vz` coordinate and velocity fields: Declared as optional numbers on `GraphNode`, but physics simulations use `SimNode extends GraphNode` which defines them as required non-optional numbers.
3. **Unused Component Props (`ThreeGraphScene.astro` & `graph.astro`)**:
   - `ThreeGraphScene.astro` declared `authors?: string[];` in its `Props` interface, but never destructured or consumed it.
   - `graph.astro` extracted unique authors via `[...new Set(posts.map(...))].sort()` and passed `authors={authors}` redundantly, as author nodes and clusters are already contained within `graphData.nodes`.
4. **Dead CSS Rules (`not-found.css`)**:
   - `.not-found-code-canvas` targeted a non-existent CSS class (the interactive 404 canvas uses `.four-oh-four-canvas`).
5. **Audited Non-Dead Items**:
   - `getReadingEntry` in [`reader/src/scripts/reading-tracker.ts`](../../reader/src/scripts/reading-tracker.ts) was audited; it is actively imported and consumed by [`reader/src/scripts/progress-rail.ts`](../../reader/src/scripts/progress-rail.ts) and must remain public.

---

## Proposed Solution / Root Cause

- Clean up dead code, redundant allocations, and unused props across the reader codebase.
- Maintain type integrity and verify that all test suites (`vitest`, `astro check`, `pytest`, `ruff`) continue passing.

---

## Changes Made

- [`reader/src/utils/graph-data.ts`](../../reader/src/utils/graph-data.ts):
  - Removed `postsByTag` variable and its loop population.
  - Removed `group: string;`, `color?: string;`, and `x/y/z/vx/vy/vz` optional properties from `GraphNode` interface.
  - Removed `group` and `color` properties from author, tag, and post node objects in `buildGraphData`.
  - Removed unused imports `getNodeTopicColor` and `hexToColorString`.
- [`reader/src/scripts/__tests__/graph-data.test.ts`](../../reader/src/scripts/__tests__/graph-data.test.ts):
  - Removed dead `expect(node?.color)` assertions.
- [`reader/src/scripts/__tests__/graph-physics.test.ts`](../../reader/src/scripts/__tests__/graph-physics.test.ts):
  - Removed obsolete `group: 'g'` from test node fixtures.
- [`reader/src/scripts/__tests__/graph-timeline.test.ts`](../../reader/src/scripts/__tests__/graph-timeline.test.ts):
  - Removed obsolete `group: 'test'` from test mock helper.
- [`reader/src/components/ThreeGraphScene.astro`](../../reader/src/components/ThreeGraphScene.astro):
  - Removed `authors?: string[];` from `Props`.
- [`reader/src/pages/graph.astro`](../../reader/src/pages/graph.astro):
  - Removed dead `authors` array generation and `authors={authors}` prop pass-through.
- [`reader/src/styles/pages/not-found.css`](../../reader/src/styles/pages/not-found.css):
  - Removed `.not-found-code-canvas` CSS rule.

---

## Verification Results

### Automated Test Suite
- `vitest run`: All 13 test files and 193 unit tests passed.
- `astro check`: 0 errors, 0 warnings across all 92 files.
- `pnpm --dir reader build`: 565 pages built and 561 indexed cleanly with Pagefind.
- `pytest`: All 114 Python scraper unit and integration tests passed.
- `ruff check .` & `ruff format --check .`: Clean compliance, 58 files formatted.

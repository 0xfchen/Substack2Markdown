# Modularize `graph.css` Stylesheet and Clean Up Redundant CSS Declarations

## Overview & Scope
Refactored the monolithic 1,005-line [`reader/src/styles/pages/graph.css`](../../reader/src/styles/pages/graph.css) into three focused, single-responsibility stylesheets (`graph-layout.css`, `graph-controls.css`, `graph-inspector.css`), collapsed redundant/overridden CSS property declarations, standardized dark theme selectors to `[data-theme='dark']`, added responsive mobile rules for <600px screens, and fixed flex wrapping on filter pills.

## Key Changes
1. **Modular Stylesheet Decomposition**:
   - [`reader/src/styles/pages/graph-layout.css`](../../reader/src/styles/pages/graph-layout.css): Full-bleed container, canvas cursor states, cursor tooltip, node legend with adaptive dark/light node shapes, timeline HUD scrubber, and layout breakpoints.
   - [`reader/src/styles/pages/graph-controls.css`](../../reader/src/styles/pages/graph-controls.css): Heads-Up Display (HUD) floating controls, glassmorphic panels, search input, filter pills with flex wrap, and control action buttons.
   - [`reader/src/styles/pages/graph-inspector.css`](../../reader/src/styles/pages/graph-inspector.css): Bottom-right selection inspector card, topic/hub badges, reading status pills, hub progress meters, scrollable article lists, tag badges, and reading actions.
   - [`reader/src/styles/pages/graph.css`](../../reader/src/styles/pages/graph.css): Re-export wrapper bundling `@import './graph-layout.css';`, `@import './graph-controls.css';`, and `@import './graph-inspector.css';` for backward compatibility.
2. **Defect & Redundancy Cleanups**:
   - Collapsed duplicate declarations:
     - `.graph-search-box`: Removed conflicting earlier `box-shadow` declaration.
     - `.graph-filter-btn`: Consolidated duplicate `background` and `border` declarations.
     - `.graph-action-btn`: Consolidated duplicate `background` and `border` declarations.
     - `.graph-timeline-hud`: Consolidated duplicate `background` declarations.
   - Standardized dark mode selectors: Replaced mixed `:root[data-theme='dark']` and compound selectors with uniform `[data-theme='dark']`.
   - Fixed pill clipping: Changed `.graph-filter-mode-group` from `flex-wrap: nowrap` to `flex-wrap: wrap` to prevent horizontal clipping on narrow screens (<380px).
   - Added mobile responsiveness (<600px): Added constraints for `.graph-inspector` (`max-height: 48vh`, internal scrolling) and compact HUD controls.
3. **Component Integration**:
   - Updated [`reader/src/pages/graph.astro`](../../reader/src/pages/graph.astro) to import `graph-layout.css`, `graph-controls.css`, and `graph-inspector.css` directly.

## Verification
- Astro check: 0 errors, 0 warnings across 95 files.
- Production build: `pnpm --dir reader build` completed successfully (565 pages built, Pagefind indexed).
- Vitest unit tests: 15 test files, 220 tests passing.
- Python test suite: 114 tests passing.
- Ruff checks: all checks passing, code formatted.


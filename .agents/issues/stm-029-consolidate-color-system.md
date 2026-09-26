# Consolidate Color System into Central TypeScript Registry and Tokens

## Problem Description

Color codes across the project were scattered and duplicated in multiple formats and locations:
- 3D WebGL scenes (`three-graph.ts`, `three-404.ts`, `vessel-factory.ts`) had hardcoded numeric hex values for materials, lighting, plumes, and stars.
- Reading status colors were specified both as numeric hexes in `graph-colors.ts` and CSS variables in `tokens.css`, with redundant fallback hexes duplicated across `.astro` components (`ReadingStatusButton.astro`, `index.astro`) and CSS files (`graph.css`).
- Legend dots in `graph.css` maintained disconnected raw hex literals rather than referencing the design tokens.

## Proposed Solution / Root Cause

1. Create a centralized TypeScript color registry in `reader/src/utils/colors.ts`:
   - Unifies all 3D WebGL / Three.js color hex integers (`READING_COLORS`, `GRAPH_SCENE_COLORS`, `AEROSPACE_404_COLORS`).
   - Houses the mathematical palettes (`CONSTELLATION_PALETTE`, `AUTHOR_PALETTE`, `ARCHITECTURAL_INK_PALETTE`, `ARCHITECTURAL_AUTHOR_PALETTE`).
   - Centralizes color conversion and hashing utilities (`hexToColorString`, `colorStringToHex`, `hashString`, `getDeterministicColor`).
2. Have `reader/src/utils/graph-colors.ts` re-export from `reader/src/utils/colors.ts` to preserve backwards compatibility for existing imports and test suites.
3. Update `three-404.ts`, `vessel-factory.ts`, `mesh-factory.ts`, and `three-graph.ts` to consume the consolidated `AEROSPACE_404_COLORS` and `GRAPH_SCENE_COLORS`.
4. Standardize CSS stylesheets (`tokens.css`, `graph.css`, `ReadingStatusButton.astro`, `index.astro`):
   - Add status unread and graph palette tokens to `tokens.css`.
   - Update `graph.css` legend dots and status badges to directly reference `--color-status-*` and graph tokens without duplicate magic hex literals.
   - Clean up `.astro` component styles to reference CSS variables cleanly.

## Changes Made

- `reader/src/utils/colors.ts`:
  - New centralized color registry containing all WebGL, palette, reading status, and 404 aerospace constants.
- `reader/src/scripts/__tests__/colors.test.ts`:
  - Unit test suite covering hashing, hex conversions, fallback behaviors, and palette structures.
- `reader/src/utils/graph-colors.ts`:
  - Re-exports core palettes and utilities from `colors.ts`, retaining node-specific coloring functions.
- `reader/src/scripts/graph/mesh-factory.ts`:
  - References `GRAPH_SCENE_COLORS` for link lines and background star points.
- `reader/src/scripts/three-graph.ts`:
  - References `GRAPH_SCENE_COLORS` for dynamic lighting and link themes.
- `reader/src/scripts/four-oh-four/vessel-factory.ts`:
  - References `AEROSPACE_404_COLORS` for Starship materials and paper textures.
- `reader/src/scripts/four-oh-four/starfield.ts`:
  - References `AEROSPACE_404_COLORS` for 2D starfield and motion warp streaks.
- `reader/src/scripts/three-404.ts`:
  - References `AEROSPACE_404_COLORS` for studio lighting rig, materials, papercraft typography, and star motes.
- `reader/src/styles/tokens.css`:
  - Adds `--color-status-unread` and graph legend color tokens (`--color-graph-author`, `--color-graph-tag`, `--color-graph-post`).
- `reader/src/styles/pages/graph.css`:
  - Connects legend dots, control filter buttons, timeline controls, and inspector status badges directly to design tokens.
- `reader/src/components/ReadingStatusButton.astro`:
  - Streamlines status button styles using design tokens and adds unread state styling.
- `reader/src/components/FloatingNavigation.astro` & `reader/src/components/ProgressRail.astro`:
  - Eliminates duplicate fallback hexes on `--color-teal`, `--color-teal-glow`, and system tokens.
- `reader/src/pages/index.astro`:
  - Streamlines stats counters and progress bar highlight styles to consume design tokens directly.


## Verification

- Automated Tests:
  - `pnpm test` (vitest): all test suites pass.
  - `pnpm tsc --noEmit`: 0 TypeScript errors.
  - `pnpm build`: static build and Pagefind search indexing succeed.
- Python Tests & Linting:
  - `pytest` (82 passed) and `ruff check .` clean.

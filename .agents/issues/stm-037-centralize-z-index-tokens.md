# Centralize Z-Index Scale Tokens, Deduplicate Tag Pill CSS, and Glassmorphic Background Token

## Problem Description

Stacking contexts (`z-index` properties) across the Astro reader were previously hardcoded as magic integer literals across more than 10 separate CSS and Astro files with no central registry or documented hierarchy:

1. **Colliding Z-Index Values**:
   - Both `.site-header` ([`reader/src/components/Header.astro`](../../reader/src/components/Header.astro#L85)) and `.reading-progress-toast` ([`reader/src/styles/layouts/post.css`](../../reader/src/styles/layouts/post.css#L245)) shared `z-index: 100`, creating ambiguous layering between sticky navigation and toast overlays.
   - Both `.skip-link` ([`reader/src/styles/base.css`](../../reader/src/styles/base.css#L10)) and `.annotations-drawer` ([`reader/src/styles/components/annotations.css`](../../reader/src/styles/components/annotations.css#L321)) shared `z-index: 9999`, creating potential stacking collisions between keyboard accessibility shortcuts and modal slide-out drawers.

2. **Scattered & Undocumented Layer Hierarchy**:
   - `FloatingNavigation.astro` used `z-index: 60`.
   - `ProgressRail.astro` used `z-index: 40`.
   - `annotations.css` used `z-index: 1000` (toolbar), `9998` (backdrop), `9999` (drawer).
   - `graph.css` used `z-index: 10` (HUD/inspector/legend), `15` (timeline HUD), and `20` (hover tooltip).
   - None of these layers referenced a centralized design token scale in [`reader/src/styles/tokens.css`](../../reader/src/styles/tokens.css).

3. **CSS Redundancy in `index.astro`**:
   - [`reader/src/pages/index.astro`](../../reader/src/pages/index.astro) contained ~40 lines of scoped `.tag-pill` CSS rules that duplicated the global rules defined and exported in [`reader/src/styles/utilities.css`](../../reader/src/styles/utilities.css#L90-L133).

4. **Duplicated Glassmorphic Background Mixes**:
   - The CSS declaration `color-mix(in srgb, var(--bg-primary) 82%, transparent)` was repeated verbatim across [`Header.astro`](../../reader/src/components/Header.astro#L113), [`FloatingNavigation.astro`](../../reader/src/components/FloatingNavigation.astro#L171), and [`graph.css`](../../reader/src/styles/pages/graph.css#L104,L129) without a unified token.

---

## Proposed Solution / Root Cause

### 1. Centralized Z-Index Scale & Glass Token in `tokens.css`

Added the following tokens to the `:root` block in [`reader/src/styles/tokens.css`](../../reader/src/styles/tokens.css):

```css
  /* ------------------------------------------------------------
     8. Z-INDEX SCALE
     ------------------------------------------------------------ */
  --z-base:              1;
  --z-card:              5;
  --z-graph-hud:        10;
  --z-graph-timeline:   15;
  --z-graph-tip:        20;
  --z-rail:             40;
  --z-float:            60;
  --z-toast:            70;
  --z-header:          100;
  --z-toolbar:        1000;
  --z-drawer-backdrop: 9998;
  --z-drawer:         9999;
  --z-skip:          10000;

  /* ------------------------------------------------------------
     9. GLASSMORPHIC SURFACE TOKENS
     ------------------------------------------------------------ */
  --glass-bg: color-mix(in srgb, var(--bg-primary) 82%, transparent);
```

### Stacking Hierarchy Rationale:
| Token | Value | Target Layer | Visual Role |
| :--- | :--- | :--- | :--- |
| `--z-base` | `1` | Base content overlays / fills | Component inner layers |
| `--z-card` | `5` | Interactive card hover layers | Hover lifts |
| `--z-graph-hud` | `10` | Graph HUD, Inspector, Legend | 3D canvas controls |
| `--z-graph-timeline` | `15` | Graph Timeline Bar | Floats above legend on mobile |
| `--z-graph-tip` | `20` | Graph Cursor Tooltip | Must clear all canvas HUD panels |
| `--z-rail` | `40` | Side reading progress rail | Stays below floating controls |
| `--z-float` | `60` | Floating navigation action button | Floats above reading rail |
| `--z-toast` | `70` | Reading progress toast notification | Floats above progress rail & nav |
| `--z-header` | `100` | Sticky top navigation bar | Sits above page content & toasts |
| `--z-toolbar` | `1000` | Text selection annotation toolbar | Sits above sticky header & content |
| `--z-drawer-backdrop` | `9998` | Annotation drawer backdrop overlay | Dimmer over whole viewport |
| `--z-drawer` | `9999` | Annotation slide-out drawer panel | Top-level modal container |
| `--z-skip` | `10000` | Accessibility Skip-to-Content link | Highest layer when focused |

---

## Changes Made

1. **[`reader/src/styles/tokens.css`](../../reader/src/styles/tokens.css)**:
   - Declared `--z-base` through `--z-skip` in `:root`.
   - Declared `--glass-bg` token in `:root`.
2. **Consuming Components & Styles**:
   - [`reader/src/styles/base.css`](../../reader/src/styles/base.css): Replaced `z-index: 9999` with `var(--z-skip)`.
   - [`reader/src/components/Header.astro`](../../reader/src/components/Header.astro): Replaced `z-index: 100` with `var(--z-header)` and scrolled background with `var(--glass-bg)`.
   - [`reader/src/components/FloatingNavigation.astro`](../../reader/src/components/FloatingNavigation.astro): Replaced `z-index: 60` with `var(--z-float)` and button background with `var(--glass-bg)`.
   - [`reader/src/components/ProgressRail.astro`](../../reader/src/components/ProgressRail.astro): Replaced `z-index: 40` with `var(--z-rail)`.
   - [`reader/src/styles/layouts/post.css`](../../reader/src/styles/layouts/post.css): Replaced toast `z-index: 100` with `var(--z-toast)` (70), resolving header collision.
   - [`reader/src/styles/components/annotations.css`](../../reader/src/styles/components/annotations.css): Replaced `1000` with `var(--z-toolbar)`, `9998` with `var(--z-drawer-backdrop)`, and `9999` with `var(--z-drawer)`.
   - [`reader/src/styles/pages/graph.css`](../../reader/src/styles/pages/graph.css): Replaced HUD, inspector, legend with `var(--z-graph-hud)`, timeline HUD with `var(--z-graph-timeline)`, tooltip with `var(--z-graph-tip)`, and panel/search glass with `var(--glass-bg)`.
3. **CSS Deduplication**:
   - [`reader/src/pages/index.astro`](../../reader/src/pages/index.astro): Removed redundant scoped `.tag-pill` and dark/light mode rules (already provided globally by `utilities.css`).

---

## Verification Results

### Automated Test Suite
- `vitest run`: All 13 test files and 193 tests passed.
- `astro check`: 0 errors, 0 warnings across all `.astro` and `.ts` files.
- `pytest`: All 114 Python unit and integration tests passed.
- `ruff check .` & `ruff format --check .`: Passed with zero lint errors or formatting discrepancies.


# Decompose Three.js Monolithic Scenes and Extract Shared Scene Lifecycle

## Overview & Scope
Decomposed the monolithic 3D WebGL entrypoints (`three-graph.ts` and `three-404.ts`), extracting a unified, universal scene lifecycle manager (`scene-lifecycle.ts`) and modular domain controllers for scene graph setup, raycasting interactions, dynamic filtering, flight simulation, and 3D typography. Added comprehensive unit tests for pure filter matching and direct scene lifecycle state machines.

## Key Changes
1. **Universal Scene Lifecycle Manager**:
   - [`reader/src/scripts/shared/scene-lifecycle.ts`](../../reader/src/scripts/shared/scene-lifecycle.ts): Created `createSceneLifecycle` consolidating `requestAnimationFrame` scheduling, `IntersectionObserver` off-screen pausing, `ResizeObserver` viewport updates, `MutationObserver` theme synchronization (`data-theme`), and Astro `astro:before-swap` / `pagehide` teardown.
2. **Knowledge Graph View Decomposition**:
   - [`reader/src/scripts/graph/scene-setup.ts`](../../reader/src/scripts/graph/scene-setup.ts): Extracted scene graph instantiation, perspective camera, WebGL renderer, OrbitControls, and studio directional lighting into `setupGraphScene`.
   - [`reader/src/scripts/graph/interaction.ts`](../../reader/src/scripts/graph/interaction.ts): Extracted raycasting, pointer move tracking, hover highlighting, neighbor link traversal, camera fly-to focusing, and cursor tooltip management into `setupGraphInteraction`.
   - [`reader/src/scripts/graph/filters.ts`](../../reader/src/scripts/graph/filters.ts): Extracted search and category pill filtering predicates (`matchesNodeCategory`, `matchesNodeSearch`) and DOM event bindings into `setupGraphFilterControls`. Added support for dual data attributes (`data-filter` and `data-graph-filter`) and reading status filtering (`status:completed`, `status:unread`, etc.).
   - [`reader/src/scripts/graph/selectors.ts`](../../reader/src/scripts/graph/selectors.ts): Created centralized type-safe DOM selector contract (`GRAPH_SELECTORS`) and `queryRequiredElement` fail-fast diagnostic utility to eliminate selector drift and prevent silent listener binding failures.
   - [`reader/src/scripts/three-graph.ts`](../../reader/src/scripts/three-graph.ts): Streamlined orchestrator delegating lifecycle, rendering, interaction, and filter logic to modular submodules. Updated color mode toggle (`[data-color-mode-btn]`) and reset camera button (`[data-reset-camera-btn]`) selectors, label updating, and filter group toggling (`[data-filters-topic]` and `[data-filters-reading]`).
   - [`reader/src/styles/pages/graph-layout.css`](../../reader/src/styles/pages/graph-layout.css) & [`reader/src/styles/utilities.css`](../../reader/src/styles/utilities.css): Ensured SVG visibility toggling for the timeline Play/Pause button (`.hidden { display: none !important; }`) and optical alignment.
3. **404 Aerospace Scene Decomposition**:
   - [`reader/src/scripts/four-oh-four/typography.ts`](../../reader/src/scripts/four-oh-four/typography.ts): Extracted extruded 3D "404" mesh generation, canvas texturing, materials, and positioning into `create404TypographyGroup`.
   - [`reader/src/scripts/four-oh-four/flight.ts`](../../reader/src/scripts/four-oh-four/flight.ts): Extracted flight curve progress tracking, interactive attitude aiming, and raycast vessel launch into `setupFlightController`. Resolved missing target coordinate projection where `homePosition` and `codePosition` remained at static `(0, 0, 0)` offsets rather than tracking `.three-404-container` and `.not-found-code-container`, causing vessels and typography to render collapsed behind DOM text. Restored exact perspective planar unprojection and default attitude quaternions for dark mode (Starship default aim) and light mode (Search button glide aim).
   - [`reader/src/scripts/four-oh-four/vessel-factory.ts`](../../reader/src/scripts/four-oh-four/vessel-factory.ts): Re-exported typography factory from the dedicated module for backward compatibility.
   - [`reader/src/scripts/three-404.ts`](../../reader/src/scripts/three-404.ts): Refactored to delegate lifecycle and flight loops to `createSceneLifecycle` and `setupFlightController`. Restored pixel-density responsive vessel and typography scaling based on container bounding boxes, initial positioning copies (`starshipGroup.position.copy(homePosition)`), and contextual flight hint text toggling (`.three-404-hint`).
   - [`reader/src/scripts/reading-tracker.ts`](../../reader/src/scripts/reading-tracker.ts) & [`reader/src/scripts/three-graph.ts`](../../reader/src/scripts/three-graph.ts): Resolved reading status ID mismatch where namespaced simulation IDs (`post:<slug>`) caused `getReadingStatus` to miss and overwrite all post nodes to `'unread'`. Extracted `rawNode.postId || rawNode.id.replace(/^post:/, '')` and added `_normalizeArticleSlug` defensive normalization throughout `reading-tracker.ts` (`getReadingEntry`, `getReadingStatus`, `setReadingStatus` for `inMemoryState`, `pendingUpdates`, and event detail broadcasting).
4. **Unit Test Suite Expansion**:
   - [`reader/src/scripts/__tests__/graph-filters.test.ts`](../../reader/src/scripts/__tests__/graph-filters.test.ts): Added 16 unit tests verifying search queries (by name, author, topic tags), category modes ('all', 'publications', 'tags', 'articles'), reading status modes ('status:completed', 'status:unread'), DOM controller interaction, and automated template drift verification against `ThreeGraphScene.astro`.
   - [`reader/src/scripts/__tests__/four-oh-four.test.ts`](../../reader/src/scripts/__tests__/four-oh-four.test.ts): Added 2 unit tests verifying 3D world coordinate unprojection (`getElementWorldPosition`) and flight controller position initialization, attitude aiming, and flight triggering state machine.
   - [`reader/src/scripts/__tests__/reading-tracker.test.ts`](../../reader/src/scripts/__tests__/reading-tracker.test.ts): Added unit test verifying `_normalizeArticleSlug` post prefix stripping in `getReadingStatus`, `getReadingEntry`, `setReadingStatus`, `getAllReadingStates`, and event detail dispatching.
   - [`reader/src/scripts/__tests__/three-lifecycle.test.ts`](../../reader/src/scripts/__tests__/three-lifecycle.test.ts): Added direct unit tests validating `createSceneLifecycle` state transitions, teardown idempotency, and frame scheduling fallback.

## Verification

### Automated Tests
- **Vitest Unit Tests**: 16 test files passed, 241 tests passing (`pnpm --dir reader test`):
  - `src/scripts/__tests__/four-oh-four.test.ts` (16 tests passing).
  - `src/scripts/__tests__/graph-filters.test.ts` (16 tests passing).
  - `src/scripts/__tests__/three-lifecycle.test.ts` (10 tests passing).
  - `src/scripts/__tests__/graph-physics.test.ts` (2 tests passing).
  - `src/scripts/__tests__/graph-timeline.test.ts` (4 tests passing).
  - All existing reader test suites (annotations, reading tracker, navigation, colors) green.
- **Astro / TypeScript Check**: 0 errors, 0 warnings across 103 files (`pnpm --dir reader check`).
- **Production Build**: Successfully compiled 565 static pages and generated Pagefind search index (`pnpm --dir reader build`).
- **Python Test Suite**: 114 tests passing (`uv run pytest`).
- **Python Linting & Formatting**: All checks passing (`uv run ruff check .` and `uv run ruff format --check .`).

### Manual Verification
1. **Interactive 3D Constellation Knowledge Graph (`/graph`)**:
   - **Scene Initialization & Controls**: Launch dev server (`pnpm --dir reader dev`) and open `http://localhost:4321/graph`. Verify the 3D scene mounts cleanly with no WebGL context errors. Rotate, pan, and zoom using mouse and trackpad gestures. Confirm auto-rotation halts immediately upon user interaction (`pointerdown`).
   - **Hover States & Dynamic Tooltips**: Move cursor across constellation nodes (articles, publication hubs, topic clusters). Confirm the cursor switches to pointer, the hover tooltip tracks the mouse displaying article title/meta, and immediate neighbor links illuminate with glowing blue lines while unrelated nodes dim.
   - **Selection & Inspector Drawer**: Click an article star or publication hub. Confirm the camera smoothly animates and centers on the selected node, and the bottom-right inspector card opens displaying reading status pills, tag lists, and word counts.
   - **Filters, Color Mode & Reset Controls**: Click "Publications", "Topics", and "Articles" filter pills to isolate corresponding node clusters. Click "Color: Topics" to toggle between topic coloring and reading status coloring ("Color: Reading Status"), ensuring reading status filter pills ("Read", "In Progress", "To Read", "Unread") appear and node colors update. Click "Reset View" to return camera to default coordinates, resume gentle auto-rotation, clear all active highlights, and close the inspector card.
   - **Timeline Expansion Playback**: Drag the chronological universe expansion slider and click the Play/Pause button. Verify only one icon (Play or Pause) is visible with optical centering, the timeline HUD counter updates, and nodes pop in sequentially according to publication date.
   - **Theme Synchronization**: Toggle dark/light theme using the header toggle. Confirm dark mode displays deep cosmic space with starfield particles and metallic spheres, while light mode renders architectural knowledge dendrograms with clean folios and diamonds.
   - **Astro Client-Side Navigation & Teardown**: Navigate to another page (e.g. `/posts`) via navigation links, then click browser Back to return. Confirm `requestAnimationFrame` and event listeners tear down cleanly without memory leaks or duplicate animation loops.

2. **Aerospace 404 Flight Scene (`/404`)**:
   - **Vessel Rendering & Typography**: Navigate to `http://localhost:4321/404` (or any non-existent URL). In dark mode, verify the chrome SpaceX Starship and extruded 3D "404" numbers render with reflective studio illumination. In light mode, verify the origami paper plane and notebook-ruled 3D typography render with clean crease edges.
   - **Cursor Attitude Aiming**: Move the cursor across the viewport. Confirm the vessel smoothly banks and pitches to track cursor movement.
   - **Aerobatic Flight Trajectory**: Click the vessel or screen to trigger flight. Verify the craft launches off its pad, accelerates along a 3D Catmull-Rom trajectory through deep space with animated engine plumes and flap flutter, and performs a return approach and touchdown flare.
   - **Theme Switching & Cleanup**: Switch themes while on the 404 page to verify instant model swap between Starship and Paper Plane. Navigate back to Home or Search and confirm all event listeners (`pointermove`, `pointerdown`, `click`) and WebGL resources are disposed.

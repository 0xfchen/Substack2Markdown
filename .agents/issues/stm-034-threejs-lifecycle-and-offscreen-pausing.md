# Three.js Animation Loop Off-Screen Pausing and Lifecycle Hardening

## Problem Description

The 3D WebGL scenes in the Astro reader ([`reader/src/scripts/three-graph.ts`](../../reader/src/scripts/three-graph.ts) and [`reader/src/scripts/three-404.ts`](../../reader/src/scripts/three-404.ts)) exhibit three lifecycle, interaction, and performance defects:

### 1. Animation Loops Never Pause Off-Screen (Continuous 60–144 Hz Busy Loop)
Both scenes utilize an `IntersectionObserver` to track when their container elements are within the viewport (`isVisible = entry.isIntersecting`). However, in both animation functions, `requestAnimationFrame(animate)` is scheduled unconditionally at the top of the function:

```typescript
// reader/src/scripts/three-graph.ts:747-750
function animate() {
  animationFrameId = requestAnimationFrame(animate);
  if (!isVisible) return;
  // ... rendering logic
```

```typescript
// reader/src/scripts/three-404.ts:532-535
function animate() {
  animationFrameId = requestAnimationFrame(animate);
  if (!isVisible) return;
  // ... rendering logic
```

Even when `isVisible` is `false` (e.g. when the user scrolls down the page or switches to a background tab), the browser continues waking up on every screen refresh (60–144 Hz) to invoke `animate()`, re-queue the next frame, and early return. This completely defeats the `IntersectionObserver`, consuming unnecessary CPU cycles, draining battery on mobile devices, and preventing the hardware from entering low-power idle states.

### 2. Async Reading State Sync Race Condition After Teardown
In [`reader/src/scripts/three-graph.ts`](../../reader/src/scripts/three-graph.ts), `fetchReadingState()` is initiated during initialization:

```typescript
// reader/src/scripts/three-graph.ts:713-716
syncReadingState();
fetchReadingState().then(() => {
  syncReadingState();
});
```

When the user navigates away before `fetchReadingState()` resolves, `teardown()` runs:
```typescript
// reader/src/scripts/three-graph.ts:923-939
geometries.dispose();
materials.dispose();
nodeMeshes.forEach((mesh) => {
  if (mesh.material instanceof THREE.Material) {
    mesh.material.dispose();
  }
});
controls.dispose();
renderer.dispose();
renderer.forceContextLoss();
scene.clear();
```

When the asynchronous network request subsequently resolves, `syncReadingState()` executes without checking whether the scene was disposed. It attempts to modify disposed materials (`mat.color.setHex(newColor); mat.emissive.setHex(newColor);`) and manipulate DOM elements (`showGraphInspector`), producing unhandled exceptions or silent WebGL state corruption.

### 3. Phantom Hover State When Cursor Exits Canvas
In [`reader/src/scripts/three-graph.ts`](../../reader/src/scripts/three-graph.ts), normalized device coordinates (NDC) are tracked via `pointermove`:

```typescript
// reader/src/scripts/three-graph.ts:330-340
function onPointerMove(event: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}
canvas.addEventListener('pointermove', onPointerMove, { passive: true });
```

There is no `pointerleave` listener on the canvas. When the user moves their cursor out of the canvas into adjacent UI or off the window, `mouse` retains its last NDC coordinates. Because the camera auto-rotates (`controls.autoRotate = true`) and `raycaster.setFromCamera(mouse, camera)` runs every frame in `animate()`, objects revolving through that stale screen coordinate trigger raycaster intersections, causing sporadic hover animations, node pulses, and tooltip updates while the cursor is nowhere near the canvas.

A similar cursor styling leak occurs in [`reader/src/scripts/three-404.ts`](../../reader/src/scripts/three-404.ts), where `pointermove` raycasting sets `document.body.style.cursor = hit.length > 0 ? 'pointer' : ''` without resetting it when the cursor exits the canvas bounds.

---

## Proposed Solution / Root Cause

### 1. Conditional Animation Frame Scheduling with Timestamp Reset
- Only schedule `requestAnimationFrame(animate)` when `isVisible` is `true`.
- When `IntersectionObserver` detects `!entry.isIntersecting`, cancel any queued `animationFrameId` and set it to `0`.
- When `entry.isIntersecting` becomes `true`, reset delta timing variables (`timeline.lastTimelineTime = performance.now()` in `three-graph.ts`; `lastTime = performance.now()` in `three-404.ts`) to prevent a large elapsed time step, and re-invoke `requestAnimationFrame(animate)` if not already scheduled.

```typescript
let animationFrameId = 0;
let isVisible = true;

const intersectionObserver = new IntersectionObserver(([entry]) => {
  const wasVisible = isVisible;
  isVisible = entry.isIntersecting;

  if (isVisible && !wasVisible) {
    timeline.lastTimelineTime = performance.now();
    if (!animationFrameId) {
      animationFrameId = requestAnimationFrame(animate);
    }
  } else if (!isVisible && animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
  }
});
```

Inside `animate()`:
```typescript
function animate() {
  if (!isVisible) {
    animationFrameId = 0;
    return;
  }
  animationFrameId = requestAnimationFrame(animate);
  // ... render
}
```

### 2. Guard Async Synchronization with `isDisposed`
- Hoist `let isDisposed = false;` to the top scope of `initThreeGraph()`.
- Add an early return guard inside `syncReadingState()`:
```typescript
function syncReadingState() {
  if (isDisposed) return;
  // ...
}
```

### 3. Canvas `pointerleave` Handlers and State Clearing
- Add `pointerleave` event listeners to both canvases.
- In `three-graph.ts`: reset `mouse.set(-999, -999)`, unhighlight any actively hovered nodes, and hide the hover tooltip.
- In `three-404.ts`: reset raycaster coordinates and restore `document.body.style.cursor = ''`.
- Ensure all newly registered event listeners are cleanly unregistered in `teardown()`.

---

## Changes Made

- **[`reader/src/scripts/three-graph.ts`](../../reader/src/scripts/three-graph.ts)**:
  - Hoisted `isDisposed` flag declaration and guarded `syncReadingState()` against running after teardown.
  - Paused `requestAnimationFrame` loop when `!isIntersecting` and resumed with updated `lastTimelineTime` on visibility restore.
  - Added `pointerleave` event listener resetting `mouse` coordinates to `(-999, -999)`, clearing active hover states/tooltips, and unregistered it in `teardown()`.
- **[`reader/src/scripts/three-404.ts`](../../reader/src/scripts/three-404.ts)**:
  - Refactored `animate()` and `intersectionObserver` to halt frame scheduling when off-screen and resume with refreshed `lastTime`.
  - Added `pointerleave` event listener to reset `clickMouse` coordinates to `(-999, -999)` and restore default body cursor.
  - Cleaned up event listeners and added `isDisposed` guard in `teardown()`.
- **[`reader/src/scripts/__tests__/three-lifecycle.test.ts`](../../reader/src/scripts/__tests__/three-lifecycle.test.ts)**:
  - Added 8 unit tests covering off-screen animation pausing, timing baseline reset, `pointerleave` coordinate resetting, hover clearing, and teardown lifecycle safety.
- **[`.agents/README.md`](../README.md)**:
  - Registered `stm-034` under Category `fix`.

---

## Verification

### Automated Tests
- **Vitest Suite**: 189 / 189 tests passing across 12 test suites:
  ```bash
  pnpm --dir reader test
  ```
- **Astro & TypeScript Diagnostics**: 0 errors, 0 warnings across 89 files:
  ```bash
  pnpm --dir reader check
  ```
- **Python Scraper Suite**: 114 / 114 tests passing:
  ```bash
  uv run pytest
  ```
- **Ruff Lint & Format**: Passed with 0 issues:
  ```bash
  uv run ruff check .
  uv run ruff format --check .
  ```

### Manual Verification
1. **Off-Screen Pause Verification**:
   - Open `/graph` in browser with Chrome DevTools Performance monitor or rendering stats (`FPS meter`).
   - Scroll down or hide the graph canvas.
   - Verify that CPU usage drops and `requestAnimationFrame` stops firing.
   - Scroll back into view and verify seamless animation resumption without visual jumping.
2. **Teardown Safety**:
   - Navigate away from `/graph` immediately after page load while remote reading state is being fetched.
   - Confirm no errors logged in browser console.
3. **Phantom Hover Check**:
   - Move cursor over nodes in `/graph`, then move cursor outside the canvas while nodes orbit.
   - Confirm no nodes highlight or trigger tooltips when the cursor is off-canvas.

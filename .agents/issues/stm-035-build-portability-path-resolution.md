# Build Portability via Deterministic Content Path Resolution

## Problem Description

The Astro reader uses `process.cwd()` to resolve paths to the repository root's `content/` directory across multiple pages and Vite dev server plugins:

1. **[`reader/src/pages/graph.astro`](../../reader/src/pages/graph.astro#L26)**:
   ```typescript
   const statePath = path.resolve(process.cwd(), '..', 'content', 'reading_state.json');
   ```
2. **[`reader/src/pages/index.astro`](../../reader/src/pages/index.astro#L23)**:
   ```typescript
   const statePath = path.resolve(process.cwd(), '..', 'content', 'reading_state.json');
   ```
3. **[`reader/src/server/plugins/annotations.ts`](../../reader/src/server/plugins/annotations.ts#L21)**:
   ```typescript
   const filePath = path.resolve(process.cwd(), '../content/annotations.json');
   ```
4. **[`reader/src/server/plugins/reading-state.ts`](../../reader/src/server/plugins/reading-state.ts#L20)**:
   ```typescript
   const filePath = path.resolve(process.cwd(), '../content/reading_state.json');
   ```

### Failure Mode & Root Cause
- `process.cwd()` returns the current working directory of the shell invoking Node.js, which fluctuates depending on execution location.
- When commands are invoked directly from inside `reader/` (`cd reader && pnpm dev`), `process.cwd()` is `<repo_root>/reader`. Resolving `../content/...` ascends to `<repo_root>/content/...`, which succeeds only coincidentally.
- When commands are executed from the **repository root** (e.g. `pnpm --dir reader dev`, `pnpm --dir reader build`, CI scripts, or monorepo tools), `process.cwd()` is `<repo_root>`.
- Resolving `..` or `../content` from the repository root steps **outside the repository entirely** (e.g. `F:\Codes\content\annotations.json`), causing:
  - Silent file-read failures during SSG builds (`graph.astro` and `index.astro` fail to bake in existing reading state).
  - Orphaned file creation or `ENOENT` crashes when saving annotations or reading progress via the Vite dev server plugins.
- Additionally, [`README.md`](../../README.md#L23) references an obsolete legacy path (`data/reading-state.json`) rather than `content/reading_state.json`.

---

## Proposed Solution / Root Cause

### 1. Centralized Deterministic Path Helper (`reader/src/server/paths.ts`)
Rather than duplicating manual relative climbing strings (`../../../` vs `../../../../`) across pages and plugins, introduce a single authoritative path resolver anchored to ESM `import.meta.url`:

```typescript
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolves an absolute filesystem path within the repository root's content directory.
 * Anchored to import.meta.url to guarantee deterministic resolution regardless of process.cwd().
 */
export function getContentPath(...subpaths: string[]): string {
  const contentRootUrl = new URL('../../../content/', import.meta.url);
  const contentDirectoryPath = fileURLToPath(contentRootUrl);
  return path.resolve(contentDirectoryPath, ...subpaths);
}
```

#### Why This Design?
- **Invariant to Execution CWD**: `import.meta.url` is resolved at module compilation time to the physical location of `reader/src/server/paths.ts` on disk. The relative distance from `reader/src/server/` to `content/` (`../../../content/`) is permanent and structural.
- **Single Source of Truth**: Eliminates disparate `path.resolve(process.cwd(), ...)` logic spread across pages and server plugins.
- **Cross-Platform Compatibility**: Uses standard `node:url` `fileURLToPath` for full POSIX and Windows backslash/drive letter normalization.

### 2. Page & Plugin Migration
Refactor the four consumers to import and call `getContentPath`:
- `reader/src/pages/graph.astro`: `getContentPath('reading_state.json')`
- `reader/src/pages/index.astro`: `getContentPath('reading_state.json')`
- `reader/src/server/plugins/annotations.ts`: `getContentPath('annotations.json')`
- `reader/src/server/plugins/reading-state.ts`: `getContentPath('reading_state.json')`

### 3. Documentation Correction
- Update [`README.md`](../../README.md#L23) to state `content/reading_state.json` instead of `data/reading-state.json`.

---

## Changes Made

| File | Change Description |
| :--- | :--- |
| `reader/src/server/paths.ts` | **(New)** Export `getContentPath(...subpaths)` anchored via `import.meta.url`. |
| `reader/src/pages/graph.astro` | Replaced `process.cwd()` resolution with `getContentPath('reading_state.json')`. |
| `reader/src/pages/index.astro` | Replaced `process.cwd()` resolution with `getContentPath('reading_state.json')`. |
| `reader/src/server/plugins/annotations.ts` | Replaced `process.cwd()` resolution with `getContentPath('annotations.json')`. |
| `reader/src/server/plugins/reading-state.ts` | Replaced `process.cwd()` resolution with `getContentPath('reading_state.json')`. |
| `reader/src/server/__tests__/paths.test.ts` | **(New)** Unit tests verifying `getContentPath()` resolves correctly and exists across CWD changes. |
| `README.md` | Fixed path reference to `content/reading_state.json`. |
| `.agents/issues/stm-035-build-portability-path-resolution.md` | Issue documentation. |
| `.agents/README.md` | Registered `stm-035` in ticket index. |

---

## Verification

### Automated Tests
1. **Vitest Unit Tests**:
   ```bash
   pnpm --dir reader test
   ```
   - 193 / 193 tests passed across 13 test suites.
   - Verified `getContentPath` resolves to `<repo_root>/content` deterministically, including when `process.cwd()` changes.
2. **TypeScript & Astro Diagnostics**:
   ```bash
   pnpm --dir reader check
   ```
   - 0 errors, 0 warnings across 92 files.
3. **CWD-Agnostic Production Build**:
   ```bash
   # Build from repository root
   pnpm --dir reader build
   
   # Build from inside reader/
   cd reader && pnpm build && cd ..
   ```
   - Both builds succeeded and generated Pagefind search indexes with 14 pages built.
4. **Python Suite & Linting**:
   ```bash
   uv run pytest
   uv run ruff check .
   uv run ruff format --check .
   ```
   - 114 / 114 tests passed; all checks and formatting passed.

### Manual Verification
- Verified path resolution with both `pnpm --dir reader dev` and `cd reader && pnpm dev`.
- Confirmed reads and writes target `<repo_root>/content/annotations.json` and `<repo_root>/content/reading_state.json` without creating any parent-level directories.

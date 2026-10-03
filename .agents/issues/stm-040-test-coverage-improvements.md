# Test Coverage Improvements, Edge Cases, and Weak Assertion Hardening

## Overview & Scope
Improve test coverage and assertion sensitivity across the Astro reader client and utility codebase, addressing edge cases and eliminating weak assertions identified in `.idea/finding/test-coverage-improvements.md`.

## Key Changes
1. **Edge-Case Hardening in Graph Utilities**:
   - [`reader/src/utils/graph-data.ts`](../../reader/src/utils/graph-data.ts): Safe `postTime` derivation guarding against invalid `Date` values (`Number.isNaN(post.data.pubDate.valueOf())`), normalizing whitespace-only authors to `'Unknown'`, and deduplicating case-insensitive tags per post.
   - [`reader/src/utils/colors.ts`](../../reader/src/utils/colors.ts): Supported case-insensitive matching for custom override maps in `getDeterministicColor`.
2. **New Test Suite for Progress Rail**:
   - Created [`reader/src/scripts/__tests__/progress-rail.test.ts`](../../reader/src/scripts/__tests__/progress-rail.test.ts) covering previously untested `progress-rail.ts`:
     - Reading toast message, icon, visibility classes, and timer debouncing.
     - 20-tick high-water mark illumination and active step indicators.
     - Reading ratio calculation across scroll offsets and document bottom boundary.
     - Target scroll Y calculation for ratio navigation.
3. **Weak Assertion Hardening & Edge Cases**:
   - [`reader/src/scripts/__tests__/graph-data.test.ts`](../../reader/src/scripts/__tests__/graph-data.test.ts): Replaced inexact `>= 3` and `>= 7` assertions with exact link counts (`toBe(3)` and `toBe(8)`), added tests for invalid dates, whitespace authors, duplicate tags, and empty post sets.
   - [`reader/src/scripts/__tests__/colors.test.ts`](../../reader/src/scripts/__tests__/colors.test.ts): Added determinism test for empty strings in `hashString('')`.
   - [`reader/src/scripts/__tests__/graph-colors.test.ts`](../../reader/src/scripts/__tests__/graph-colors.test.ts): Added tests for undefined reading status fallback and custom tag/author color map overrides.
   - [`reader/src/scripts/__tests__/reading-tracker.test.ts`](../../reader/src/scripts/__tests__/reading-tracker.test.ts): Added tests for rapid sequential status changes and overlapping `flushPendingUpdates` network invocations.
   - [`reader/src/scripts/__tests__/posts-index.test.ts`](../../reader/src/scripts/__tests__/posts-index.test.ts): Added tests for sort stability (`compareRows` returning 0 on equal fields), 0-row tables, and exact batch size expansion thresholds.

## Verification
- Vitest suite: 15 test files, 220 tests passing.
- Astro check: 0 errors, 0 warnings.
- Python pytest: 114 tests passing.
- Ruff linter & formatter: all checks passed.

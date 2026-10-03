# Strict Hex Color Parsing and 3-Digit Shorthand Expansion

## Problem Description

The color conversion utility `colorStringToHex` in [`reader/src/utils/colors.ts`](../../reader/src/utils/colors.ts#L46-L51) converts CSS hex strings (from user annotations, publication branding, and category tags) into 24-bit integer values for Three.js 3D graph materials and HTML5 canvas rendering:

```typescript
export function colorStringToHex(str: string): number {
  if (!str) return CONSTELLATION_PALETTE[0];
  const sanitizedHex = str.replace('#', '').trim();
  const numericColor = parseInt(sanitizedHex, 16);
  return Number.isNaN(numericColor) ? CONSTELLATION_PALETTE[0] : numericColor;
}
```

### Failure Modes & Root Cause

1. **3-Digit Shorthand Misinterpretation**:
   - Standard 3-digit CSS hex shorthand such as `#fff` or `#FFF` was passed directly to `parseInt("fff", 16)`.
   - `parseInt("fff", 16)` evaluates to `4095` (`0x000fff`).
   - Rather than rendering pure white (`0xffffff`), nodes and annotations rendered as deep blue (`0x000fff`).
2. **Greedy Prefix Parsing via `parseInt`**:
   - JavaScript's built-in `parseInt(str, 16)` parses characters sequentially and halts at the first non-hexadecimal character without rejecting the string.
   - For an invalid or malformed input like `"bad-input"`, `parseInt` parsed the leading `"bad"` as hex `2989` (`0x000bad`) instead of failing.
   - Because `Number.isNaN(2989)` is false, it returned dark blue instead of safely falling back to the designated default palette color (`CONSTELLATION_PALETTE[0]`).
3. **Incomplete Length and Format Validation**:
   - Truncated or oversized inputs like `#1234` or `#1234567` were partially evaluated rather than rejected.
   - Whitespace trimming occurred after `#` stripping rather than before.

---

## Proposed Solution / Root Cause

### 1. 3-Digit Shorthand Expansion & Strict Regex Validation
Refactor `colorStringToHex` in [`reader/src/utils/colors.ts`](../../reader/src/utils/colors.ts) to:
1. Trim whitespace and strip any leading `#`.
2. Expand 3-digit shorthand (`#xyz` -> `xxyyzz`) so `#fff` expands to `ffffff` (`0xffffff`).
3. Enforce strict 6-character hex validation via `/^[0-9a-fA-F]{6}$/`. Any string failing this test immediately falls back to `CONSTELLATION_PALETTE[0]`.
4. Parse the validated 6-digit hex string with `parseInt(expandedHexString, 16)`.
5. Adhere to Rule 10 descriptive variable naming (`colorString`, `sanitizedHexString`, `expandedHexString`).

```typescript
export function colorStringToHex(colorString: string): number {
  if (!colorString) return CONSTELLATION_PALETTE[0];
  const sanitizedHexString = colorString.trim().replace(/^#/, '');
  const expandedHexString =
    sanitizedHexString.length === 3
      ? sanitizedHexString[0] +
        sanitizedHexString[0] +
        sanitizedHexString[1] +
        sanitizedHexString[1] +
        sanitizedHexString[2] +
        sanitizedHexString[2]
      : sanitizedHexString;

  if (!/^[0-9a-fA-F]{6}$/.test(expandedHexString)) {
    return CONSTELLATION_PALETTE[0];
  }
  return parseInt(expandedHexString, 16);
}
```

---

## Changes Made

1. **[`reader/src/utils/colors.ts`](../../reader/src/utils/colors.ts)**:
   - Refactored `colorStringToHex` to expand 3-digit shorthand and validate strictly against 6 hex digits.
2. **[`reader/src/scripts/__tests__/colors.test.ts`](../../reader/src/scripts/__tests__/colors.test.ts)**:
   - Added unit test cases for `#fff`, `#FFF`, `fff`, `#f00`, `#0f0`, and whitespace-padded hex strings.
   - Added regression test cases asserting fallback to `CONSTELLATION_PALETTE[0]` for `"bad-input"`, `""`, whitespace strings, and invalid lengths (`#12345`, `#1234567`).

---

## Verification Results

### Automated Test Suite
- `vitest run`: All 13 test files and 193 tests passed, including 9 unit tests in `colors.test.ts`.
- `astro check`: 0 errors, 0 warnings across all `.astro` and `.ts` files.
- `pytest`: All 114 Python unit and integration tests passed.
- `ruff check .` & `ruff format --check .`: Passed with zero lint errors or formatting discrepancies.

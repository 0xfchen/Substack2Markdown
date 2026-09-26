export type ReadingStatus = 'unread' | 'pending' | 'in-progress' | 'completed';

export interface ReadingItemState {
  status: ReadingStatus;
  scrollRatio?: number;
  updatedAt: string;
  completedAt?: string;
  readCount?: number;
}

export type ReadingState = Record<string, ReadingItemState>;

export const READING_STATUS_CHANGE_EVENT = 'reading-status-changed';

export interface ReadingStatusChangeEventDetail {
  slug: string;
  status: ReadingStatus;
  state: ReadingItemState;
}

const LOCAL_STORAGE_KEY = 'substack_reading_state_cache_v1';
let inMemoryState: ReadingState = loadCachedState();
let isFetchingState = false;
let pendingSaveTimer: ReturnType<typeof setTimeout> | null = null;
const pendingUpdates: Record<string, Partial<ReadingItemState>> = {};

/**
 * Sanitize and validate reading state items to ensure valid lifecycle statuses.
 */
function sanitizeState(state: ReadingState): ReadingState {
  const result: ReadingState = {};
  for (const [slug, item] of Object.entries(state)) {
    if (!item) continue;
    const rawStatus = (item as any).status;
    if (rawStatus === 'unread') continue; // Unread items occupy 0 bytes, not stored in state
    let status: ReadingStatus;
    if (rawStatus === 'completed' || rawStatus === 'done') {
      status = 'completed';
    } else if (
      rawStatus === 'in-progress' ||
      rawStatus === 'reading' ||
      (typeof item.scrollRatio === 'number' && item.scrollRatio >= 0.08)
    ) {
      status = 'in-progress';
    } else {
      status = 'pending';
    }
    result[slug] = {
      ...item,
      status,
    };
  }
  return result;
}

/**
 * Load cached state synchronously from localStorage if available.
 */
function loadCachedState(): ReadingState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const sanitized = sanitizeState(parsed);
      cacheState(sanitized);
      return sanitized;
    }
  } catch {
    // Ignore storage parse errors
  }
  return {};
}

/**
 * Save state to localStorage cache synchronously.
 */
function cacheState(state: ReadingState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage write errors (e.g. quota exceeded)
  }
}

/**
 * Fetch authoritative reading state from the local dev server.
 */
export async function fetchReadingState(): Promise<ReadingState> {
  if (isFetchingState) return inMemoryState;
  isFetchingState = true;
  try {
    const res = await fetch('/api/reading-status');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rawServerState: ReadingState = await res.json();
    const serverState = sanitizeState(rawServerState);

    // Merge strategy: latest updatedAt wins per slug
    const merged: ReadingState = { ...inMemoryState };
    for (const [slug, serverItem] of Object.entries(serverState)) {
      const localItem = merged[slug];
      if (!localItem || new Date(serverItem.updatedAt) >= new Date(localItem.updatedAt)) {
        merged[slug] = serverItem;
      }
    }

    inMemoryState = sanitizeState(merged);
    cacheState(inMemoryState);
    return inMemoryState;
  } catch {
    // Graceful fallback to cached state on fetch failure or production static builds
    return inMemoryState;
  } finally {
    isFetchingState = false;
  }
}

/**
 * Get the reading state entry for a specific article slug.
 */
export function getReadingEntry(slug: string): ReadingItemState | undefined {
  return inMemoryState[slug];
}

/**
 * Get all reading items.
 */
export function getAllReadingStates(): ReadingState {
  return { ...inMemoryState };
}

export const getReadingState = getAllReadingStates;

/**
 * Get reading status for a specific article slug synchronously.
 */
export function getReadingStatus(slug: string): ReadingStatus {
  return getReadingEntry(slug)?.status || 'unread';
}

/**
 * Get total read count for a specific article slug synchronously.
 */
export function getReadCount(slug: string): number {
  const entry = getReadingEntry(slug);
  if (!entry) return 0;
  if (typeof entry.readCount === 'number') return entry.readCount;
  return entry.status === 'completed' ? 1 : 0;
}

/**
 * Set the reading status for a specific article slug and propagate changes.
 */
export function setReadingStatus(
  slug: string,
  status: ReadingStatus,
  options: { scrollRatio?: number; force?: boolean; readCount?: number } = {}
): void {
  if (!slug) return;
  const existing = inMemoryState[slug];
  const oldRatio = typeof existing?.scrollRatio === 'number' ? existing.scrollRatio : -1;
  const newRatio =
    options.scrollRatio !== undefined
      ? options.scrollRatio
      : status === 'completed'
        ? 1
        : status === 'pending' || status === 'unread'
          ? 0
          : existing?.scrollRatio ?? 0.1;

  const currentStatus = existing?.status || 'unread';
  const statusChanged = currentStatus !== status;
  const ratioChanged = Math.abs(oldRatio - newRatio) >= 0.02;

  // Don't no-op if ratio has noticeably changed even when status remains the same
  if (!options.force && !statusChanged && !ratioChanged) {
    return;
  }

  const finalRatio = newRatio !== undefined ? Math.max(0, Math.min(1, newRatio)) : 0;
  const now = new Date().toISOString();

  // Determine read count: increment when completing an uncompleted article,
  // preserve count when resetting to pending/in-progress for a reread.
  const existingCount = typeof existing?.readCount === 'number'
    ? existing.readCount
    : (existing?.status === 'completed' ? 1 : 0);

  let newReadCount = options.readCount !== undefined ? options.readCount : existingCount;
  if (options.readCount === undefined && status === 'completed' && existing?.status !== 'completed') {
    newReadCount = existingCount + 1;
  }

  if (status === 'unread') {
    delete inMemoryState[slug];
  } else {
    const entry: ReadingItemState = {
      status,
      scrollRatio: finalRatio,
      updatedAt: now,
      completedAt: status === 'completed' ? (existing?.completedAt || now) : undefined,
      readCount: newReadCount,
    };
    inMemoryState[slug] = entry;
  }

  cacheState(inMemoryState);

  const broadcastEntry: ReadingItemState = inMemoryState[slug] || {
    status: 'unread',
    scrollRatio: 0,
    updatedAt: now,
    readCount: newReadCount,
  };

  // Dispatch custom event for reactive UI updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<ReadingStatusChangeEventDetail>(READING_STATUS_CHANGE_EVENT, {
        detail: { slug, status, state: broadcastEntry },
      })
    );
  }

  // Queue server flush: sending { status: 'unread' } instructs server to remove from reading_state.json
  pendingUpdates[slug] = status === 'unread' ? { status: 'unread' } : inMemoryState[slug];
  if (pendingSaveTimer) {
    clearTimeout(pendingSaveTimer);
  }
  pendingSaveTimer = setTimeout(flushPendingUpdates, 1000);
}

/**
 * Get reading progress percent (0, 10, 20, ..., 100) derived from scrollRatio.
 */
export function getReadingProgressPercent(slug: string): number {
  const status = getReadingStatus(slug);
  if (status === 'completed') return 100;
  if (status === 'pending' || status === 'unread') return 0;

  const entry = getReadingEntry(slug);
  const ratio = entry?.scrollRatio;
  if (typeof ratio === 'number' && ratio > 0) {
    return Math.max(5, Math.min(95, Math.round(ratio * 20) * 5));
  }
  return 5;
}

/**
 * Update reading progress while scrolling, transitioning status as thresholds are met.
 * Progress operates as a monotonic high-water mark: scrolling up or jumping to the
 * top to review earlier material never reduces the recorded reading percentage.
 */
export function updateReadingProgress(
  slug: string,
  scrollRatio: number
): { statusChanged: boolean; status: ReadingStatus; percent: number; readCount: number } {
  const current = getReadingStatus(slug);
  const existingRatio = getReadingEntry(slug)?.scrollRatio ?? 0;
  // Ratchet upward: reading progress never goes down from scrolling up / clicking Top
  const effectiveRatio = Math.max(existingRatio, scrollRatio);
  const clampedRatio = Math.max(0, Math.min(1, Math.round(effectiveRatio * 1000) / 1000));
  let nextStatus: ReadingStatus = current;
  let statusChanged = false;

  if (clampedRatio >= 0.90 && current !== 'completed') {
    nextStatus = 'completed';
    statusChanged = true;
  } else if (clampedRatio >= 0.08 && (current === 'unread' || current === 'pending')) {
    nextStatus = 'in-progress';
    statusChanged = true;
  }

  const ratioDiff = Math.abs(existingRatio - clampedRatio);

  if (statusChanged || ratioDiff >= 0.03) {
    setReadingStatus(slug, nextStatus, {
      scrollRatio: clampedRatio,
      force: statusChanged,
    });
  }

  return {
    statusChanged,
    status: nextStatus,
    percent: getReadingProgressPercent(slug),
    readCount: getReadCount(slug),
  };
}

/**
 * Toggle reading status across unread -> pending -> in-progress -> completed -> unread.
 * When cycling from completed -> unread, removes entry from stored state.
 */
export function toggleReadingStatus(slug: string): ReadingStatus {
  const current = getReadingStatus(slug);
  let next: ReadingStatus = 'pending';
  let ratio = 0;
  if (current === 'unread') {
    next = 'pending';
    ratio = 0;
  } else if (current === 'pending') {
    next = 'in-progress';
    ratio = 0.1;
  } else if (current === 'in-progress') {
    next = 'completed';
    ratio = 1.0;
  } else if (current === 'completed') {
    next = 'unread';
    ratio = 0;
  }

  setReadingStatus(slug, next, { scrollRatio: ratio, force: true });
  return next;
}

/**
 * Flush accumulated updates to the file-based dev server endpoint.
 */
export async function flushPendingUpdates(): Promise<void> {
  if (pendingSaveTimer) {
    clearTimeout(pendingSaveTimer);
    pendingSaveTimer = null;
  }

  const toFlush = { ...pendingUpdates };
  Object.keys(pendingUpdates).forEach((k) => delete pendingUpdates[k]);

  if (Object.keys(toFlush).length === 0 || typeof window === 'undefined') return;

  const payload = JSON.stringify(toFlush);

  try {
    await fetch('/api/reading-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    });
  } catch (error) {
    console.warn('[reading-tracker] Failed to save state to server:', error);
  }
}

// Flush pending updates immediately on page unload or visibility hide
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    void flushPendingUpdates();
  });
  window.addEventListener('beforeunload', () => {
    void flushPendingUpdates();
  });
}

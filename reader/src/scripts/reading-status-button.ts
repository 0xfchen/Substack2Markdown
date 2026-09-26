/**
 * reading-status-button.ts
 *
 * Client-side runtime for ReadingStatusButton components.
 * Manages UI updates, multi-instance synchronization, click delegation,
 * and integration with the reading tracker state store.
 */

import {
  fetchReadingState,
  getReadingStatus,
  getReadCount,
  toggleReadingStatus,
  READING_STATUS_CHANGE_EVENT,
  type ReadingStatus,
  type ReadingStatusChangeEventDetail,
} from './reading-tracker';

declare global {
  interface Window {
    __readingControlListenerAttached?: boolean;
  }
}

export function updateControlUI(control: HTMLElement, status: ReadingStatus, readCount: number = 0): void {
  control.setAttribute('data-status', status);
  control.setAttribute('data-read-count', String(readCount));
  const icon = control.querySelector('[data-status-icon]');
  const text = control.querySelector('[data-status-text]');
  const badge = control.querySelector<HTMLElement>('[data-read-count]');
  const btn = control.querySelector<HTMLButtonElement>('[data-status-btn]');

  if (status === 'completed') {
    if (icon) icon.textContent = '\u2713';
    if (text) text.textContent = 'Complete';
    if (btn) {
      btn.title =
        readCount > 1
          ? 'Read ' + readCount + ' times \u2022 Click to start reread (reset to To Read)'
          : 'Complete \u2022 Click to start reread (reset to To Read)';
    }
    if (badge) {
      if (readCount > 1) {
        badge.textContent = readCount + '\u00d7';
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    }
  } else if (status === 'in-progress') {
    if (icon) icon.textContent = '\u25d1';
    if (text) text.textContent = 'Reading';
    if (badge) {
      if (readCount >= 1) {
        badge.textContent = readCount + '\u00d7';
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    }
    if (btn) {
      btn.title =
        readCount >= 1
          ? 'Reading (read ' + readCount + '\u00d7 before) \u2022 Click to mark complete'
          : 'Reading \u2022 Click to mark complete';
    }
  } else {
    if (icon) icon.textContent = '\u25cb';
    if (text) text.textContent = 'To Read';
    if (badge) {
      if (readCount >= 1) {
        badge.textContent = readCount + '\u00d7';
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    }
    if (btn) {
      btn.title =
        readCount >= 1
          ? 'To Read (read ' + readCount + '\u00d7 before) \u2022 Click to start reading'
          : 'Click to toggle reading status (To Read -> Reading -> Complete)';
    }
  }
}

export function syncAllControls(targetSlug?: string, targetStatus?: ReadingStatus, targetCount?: number): void {
  if (typeof document === 'undefined') return;
  const controls = document.querySelectorAll<HTMLElement>('[data-reading-status-control]');
  controls.forEach((control) => {
    const itemSlug = control.dataset.slug;
    if (!itemSlug) return;
    if (!targetSlug || itemSlug === targetSlug) {
      const status = targetSlug && targetStatus ? targetStatus : getReadingStatus(itemSlug);
      const count = targetSlug && targetCount !== undefined ? targetCount : getReadCount(itemSlug);
      updateControlUI(control, status, count);
    }
  });
}

export function initReadingStatusButtons(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Ensure global listeners are attached exactly once
  if (!window.__readingControlListenerAttached) {
    window.__readingControlListenerAttached = true;

    // Delegated click handler on document
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest<HTMLButtonElement>('[data-status-btn]');
      if (!btn) return;

      const control = btn.closest<HTMLElement>('[data-reading-status-control]');
      const slug = control?.dataset.slug;
      if (!slug) return;

      e.preventDefault();
      e.stopPropagation();
      toggleReadingStatus(slug);
    });

    // Reactive status change event listener
    window.addEventListener(READING_STATUS_CHANGE_EVENT, ((e: CustomEvent<ReadingStatusChangeEventDetail>) => {
      const { slug, status, state } = e.detail || {};
      syncAllControls(slug, status, state?.readCount);
    }) as EventListener);
  }

  // Initialize UI immediately and after remote fetch
  syncAllControls();
  fetchReadingState().then(() => {
    syncAllControls();
  });
}

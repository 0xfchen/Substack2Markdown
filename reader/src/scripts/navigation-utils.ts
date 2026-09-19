import { flushPendingUpdates } from './reading-tracker';

/**
 * Handles fast back-navigation from an article to the library table.
 *
 * 1. Stores the active article slug in sessionStorage for target row pulse-highlighting.
 * 2. Flushes any in-progress reading updates to disk.
 * 3. Checks if the user arrived from the library table (document.referrer).
 *    Note on BFCache guard: window.history.length reflects all tab history (including
 *    prior external sites). Therefore, history.length > 1 alone is insufficient. We pair it
 *    with a strict same-origin check and pathname comparison against document.referrer.
 *    This guarantees that the immediate previous history entry in this tab was indeed the
 *    same-origin library page, making history.back() safe and enabling 0ms BFCache restore.
 *
 * @param slug Active post slug, or null
 * @param targetHref Destination URL of the link (defaults to '/')
 * @returns true if history.back() was invoked (caller should preventDefault), false otherwise
 */
export function handleBackToLibrary(slug?: string | null, targetHref = '/'): boolean {
  if (slug && typeof window !== 'undefined') {
    try {
      sessionStorage.setItem('last_active_slug', slug);
    } catch {
      // ignore storage quota errors
    }
  }

  // Flush in-progress reading updates immediately
  void flushPendingUpdates();

  if (typeof window === 'undefined') return false;

  try {
    const targetPath = targetHref.split('#')[0].replace(/\/$/, '') || '/';
    const referrerUrl = document.referrer
      ? new URL(document.referrer, window.location.origin)
      : null;
    const isSameOrigin = referrerUrl ? referrerUrl.origin === window.location.origin : false;
    const referrerPath = isSameOrigin && referrerUrl
      ? referrerUrl.pathname.replace(/\/$/, '') || '/'
      : '';

    if (referrerPath === targetPath && window.history.length > 1) {
      window.history.back();
      return true;
    }
  } catch {
    // Fall back to standard anchor link navigation
  }

  return false;
}


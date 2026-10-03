/**
 * floating-navigation.ts
 *
 * Client-side runtime for FloatingNavigation component.
 * Handles scroll-to-top with smooth scrolling and dynamic threshold visibility,
 * plus smart back-to-library navigation with row anchor preservation.
 */

import { handleBackToLibrary } from './navigation-utils';

const SCROLL_DISTANCE_THRESHOLD = 180;

/**
 * Initializes floating navigation event listeners and initial visibility states.
 */
export function initFloatingNavigation(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const scrollTopButton = document.getElementById('floating-scroll-top');
  if (scrollTopButton && !scrollTopButton.hasAttribute('data-nav-ready')) {
    scrollTopButton.setAttribute('data-nav-ready', 'true');
    scrollTopButton.addEventListener('click', (event: MouseEvent) => {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    const updateScrollTopVisibility = () => {
      const isNearPageTop = window.scrollY <= SCROLL_DISTANCE_THRESHOLD;
      scrollTopButton.classList.toggle('is-hidden', isNearPageTop);
    };

    window.addEventListener('scroll', updateScrollTopVisibility, { passive: true });
    updateScrollTopVisibility();
  }

  const homeLinkButton = document.getElementById('floating-go-home');
  if (homeLinkButton && !homeLinkButton.hasAttribute('data-nav-ready')) {
    homeLinkButton.setAttribute('data-nav-ready', 'true');
    homeLinkButton.addEventListener('click', (event: MouseEvent) => {
      const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
      const targetHref = homeLinkButton.getAttribute('href') || '/';
      const targetPath = targetHref.split('#')[0].replace(/\/$/, '') || '/';
      if (currentPath === targetPath) {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const targetSlug = homeLinkButton.getAttribute('data-slug');
      if (handleBackToLibrary(targetSlug, targetHref)) {
        event.preventDefault();
      }
    });
  }
}

/**
 * Mounts floating navigation listeners, integrating with Astro lifecycle events.
 */
export function mountFloatingNavigation(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initFloatingNavigation(), { once: true });
  } else {
    initFloatingNavigation();
  }
  document.addEventListener('astro:page-load', () => initFloatingNavigation());
}


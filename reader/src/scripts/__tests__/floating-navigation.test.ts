import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initFloatingNavigation } from '../floating-navigation';
import * as navigationUtils from '../navigation-utils';

describe('initFloatingNavigation()', () => {
  let mockScrollTopButton: any;
  let mockHomeLinkButton: any;
  let scrollListeners: Array<() => void> = [];
  let scrollToSpy: ReturnType<typeof vi.fn>;
  let handleBackSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    scrollListeners = [];
    scrollToSpy = vi.fn();
    handleBackSpy = vi.spyOn(navigationUtils, 'handleBackToLibrary').mockReturnValue(true);

    const scrollTopAttributes = new Map<string, string>();
    const scrollTopClasses = new Set<string>();
    let scrollTopClickListener: ((e: any) => void) | null = null;

    mockScrollTopButton = {
      hasAttribute: vi.fn((attr: string) => scrollTopAttributes.has(attr)),
      setAttribute: vi.fn((attr: string, val: string) => scrollTopAttributes.set(attr, val)),
      getAttribute: vi.fn((attr: string) => scrollTopAttributes.get(attr) ?? null),
      classList: {
        toggle: vi.fn((className: string, force?: boolean) => {
          if (force !== undefined) {
            if (force) scrollTopClasses.add(className);
            else scrollTopClasses.delete(className);
          } else {
            if (scrollTopClasses.has(className)) scrollTopClasses.delete(className);
            else scrollTopClasses.add(className);
          }
        }),
        contains: vi.fn((className: string) => scrollTopClasses.has(className)),
      },
      addEventListener: vi.fn((event: string, fn: any) => {
        if (event === 'click') scrollTopClickListener = fn;
      }),
      click: () => {
        if (scrollTopClickListener) {
          const event = { preventDefault: vi.fn() };
          scrollTopClickListener(event);
          return event;
        }
        return { preventDefault: vi.fn() };
      },
    };

    const homeAttributes = new Map<string, string>([
      ['href', '/'],
      ['data-slug', 'sample-post'],
    ]);
    let homeClickListener: ((e: any) => void) | null = null;

    mockHomeLinkButton = {
      hasAttribute: vi.fn((attr: string) => homeAttributes.has(attr)),
      setAttribute: vi.fn((attr: string, val: string) => homeAttributes.set(attr, val)),
      getAttribute: vi.fn((attr: string) => homeAttributes.get(attr) ?? null),
      addEventListener: vi.fn((event: string, fn: any) => {
        if (event === 'click') homeClickListener = fn;
      }),
      click: () => {
        if (homeClickListener) {
          const event = { preventDefault: vi.fn() };
          homeClickListener(event);
          return event;
        }
        return { preventDefault: vi.fn() };
      },
    };

    (global as any).window = {
      scrollY: 0,
      scrollTo: scrollToSpy,
      location: {
        pathname: '/posts/sample-post/',
      },
      addEventListener: vi.fn((event: string, fn: any) => {
        if (event === 'scroll') scrollListeners.push(fn);
      }),
      removeEventListener: vi.fn(),
    };

    (global as any).document = {
      getElementById: vi.fn((id: string) => {
        if (id === 'floating-scroll-top') return mockScrollTopButton;
        if (id === 'floating-go-home') return mockHomeLinkButton;
        return null;
      }),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (global as any).window;
    delete (global as any).document;
  });

  it('initializes and marks buttons ready', () => {
    initFloatingNavigation();
    expect(mockScrollTopButton.setAttribute).toHaveBeenCalledWith('data-nav-ready', 'true');
    expect(mockHomeLinkButton.setAttribute).toHaveBeenCalledWith('data-nav-ready', 'true');
  });

  it('scrolls to top smoothly when scroll-top button is clicked', () => {
    initFloatingNavigation();
    const event = mockScrollTopButton.click();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('updates scroll-top button visibility depending on scrollY threshold', () => {
    (global as any).window.scrollY = 50;
    initFloatingNavigation();
    expect(mockScrollTopButton.classList.toggle).toHaveBeenCalledWith('is-hidden', true);

    (global as any).window.scrollY = 250;
    scrollListeners.forEach((fn) => fn());
    expect(mockScrollTopButton.classList.toggle).toHaveBeenCalledWith('is-hidden', false);
  });

  it('scrolls to top smoothly when home button is clicked on the homepage itself', () => {
    (global as any).window.location.pathname = '/';
    initFloatingNavigation();
    const event = mockHomeLinkButton.click();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    expect(handleBackSpy).not.toHaveBeenCalled();
  });

  it('delegates to handleBackToLibrary when home button is clicked from an article page', () => {
    initFloatingNavigation();
    const event = mockHomeLinkButton.click();
    expect(handleBackSpy).toHaveBeenCalledWith('sample-post', '/');
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('is idempotent and skips re-binding if data-nav-ready is already present', () => {
    mockScrollTopButton.hasAttribute = vi.fn(() => true);
    mockHomeLinkButton.hasAttribute = vi.fn(() => true);

    initFloatingNavigation();
    expect(mockScrollTopButton.addEventListener).not.toHaveBeenCalled();
    expect(mockHomeLinkButton.addEventListener).not.toHaveBeenCalled();
  });
});


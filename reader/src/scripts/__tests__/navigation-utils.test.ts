import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleBackToLibrary } from '../navigation-utils';
import * as readingTracker from '../reading-tracker';

describe('handleBackToLibrary()', () => {
  const mockStorage = new Map<string, string>();
  let backSpy: ReturnType<typeof vi.fn>;
  let flushSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockStorage.clear();
    backSpy = vi.fn();
    flushSpy = vi.spyOn(readingTracker, 'flushPendingUpdates').mockResolvedValue(undefined);

    (global as any).window = {
      location: {
        origin: 'http://localhost:4321',
        pathname: '/posts/my-post/',
      },
      history: {
        length: 2,
        back: backSpy,
      },
      sessionStorage: {
        setItem: vi.fn((k: string, v: string) => mockStorage.set(k, v)),
        getItem: vi.fn((k: string) => mockStorage.get(k) ?? null),
        removeItem: vi.fn((k: string) => mockStorage.delete(k)),
      },
    };
    (global as any).document = {
      referrer: 'http://localhost:4321/',
    };
    (global as any).sessionStorage = (global as any).window.sessionStorage;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).sessionStorage;
  });

  it('saves target slug into sessionStorage', () => {
    handleBackToLibrary('my-cool-post', '/');
    expect(mockStorage.get('last_active_slug')).toBe('my-cool-post');
  });

  it('flushes pending reading updates', () => {
    handleBackToLibrary('my-cool-post', '/');
    expect(flushSpy).toHaveBeenCalled();
  });

  it('invokes history.back() and returns true when referrer matches destination and history > 1', () => {
    const prevented = handleBackToLibrary('my-cool-post', '/');
    expect(prevented).toBe(true);
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it('returns false and does not call history.back() when referrer does not match target path', () => {
    (global as any).document.referrer = 'https://twitter.com/some/link';
    const prevented = handleBackToLibrary('my-cool-post', '/');
    expect(prevented).toBe(false);
    expect(backSpy).not.toHaveBeenCalled();
  });

  it('returns false and does not call history.back() when referrer has root path but different origin', () => {
    (global as any).document.referrer = 'https://google.com/';
    const prevented = handleBackToLibrary('my-cool-post', '/');
    expect(prevented).toBe(false);
    expect(backSpy).not.toHaveBeenCalled();
  });

  it('returns false and does not call history.back() when history.length <= 1', () => {
    (global as any).window.history.length = 1;
    const prevented = handleBackToLibrary('my-cool-post', '/');
    expect(prevented).toBe(false);
    expect(backSpy).not.toHaveBeenCalled();
  });
});


/**
 * scene-lifecycle.ts
 *
 * Universal WebGL and Three.js scene lifecycle controller.
 * Unifies requestAnimationFrame scheduling, IntersectionObserver off-screen pausing,
 * ResizeObserver container dimension synchronization, MutationObserver theme changes,
 * and clean Astro swap / pagehide disposal across 3D scenes.
 */

export interface SceneLifecycleOptions {
  container: HTMLElement;
  canvas?: HTMLCanvasElement;
  onAnimate: (timestamp: number) => void;
  onResize?: (width: number, height: number) => void;
  onThemeChange?: (isDark: boolean) => void;
  onVisibilityChange?: (isVisible: boolean) => void;
  onTeardown: () => void;
}

export interface SceneLifecycleController {
  start: () => void;
  teardown: () => void;
  isDisposed: () => boolean;
  isVisible: () => boolean;
}

function scheduleNextFrame(frameCallbackFunction: (timestamp: number) => void): number {
  if (typeof requestAnimationFrame !== 'undefined') {
    return requestAnimationFrame(frameCallbackFunction);
  }
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame !== 'undefined') {
    return window.requestAnimationFrame(frameCallbackFunction);
  }
  return (setTimeout(() => {
    frameCallbackFunction(Date.now());
  }, 16) as unknown) as number;
}

function cancelActiveFrame(frameIdentifier: number): void {
  if (typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(frameIdentifier);
    return;
  }
  if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame !== 'undefined') {
    window.cancelAnimationFrame(frameIdentifier);
    return;
  }
  clearTimeout(frameIdentifier);
}

/**
 * Creates and initializes a complete Three.js scene lifecycle manager.
 */
export function createSceneLifecycle(
  options: SceneLifecycleOptions
): SceneLifecycleController {
  let animationFrameIdentifier = 0;
  let isDisposedState = false;
  let isVisibleState = true;

  const frameCallback = (timestamp: number) => {
    if (!isVisibleState || isDisposedState) {
      animationFrameIdentifier = 0;
      return;
    }
    animationFrameIdentifier = scheduleNextFrame(frameCallback);
    options.onAnimate(timestamp);
  };

  const intersectionObserverInstance =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([entry]) => {
          const wasPreviouslyVisible = isVisibleState;
          isVisibleState = entry ? entry.isIntersecting : true;

          if (options.onVisibilityChange) {
            options.onVisibilityChange(isVisibleState);
          }

          if (isVisibleState && !wasPreviouslyVisible && !isDisposedState) {
            if (!animationFrameIdentifier) {
              animationFrameIdentifier = scheduleNextFrame(frameCallback);
            }
          } else if (!isVisibleState && animationFrameIdentifier) {
            cancelActiveFrame(animationFrameIdentifier);
            animationFrameIdentifier = 0;
          }
        })
      : null;

  intersectionObserverInstance?.observe(options.container);

  const resizeObserverInstance =
    typeof ResizeObserver !== 'undefined' && options.onResize
      ? new ResizeObserver(() => {
          if (isDisposedState) return;
          const containerWidth = options.container.clientWidth;
          const containerHeight = options.container.clientHeight;
          if (containerWidth > 0 && containerHeight > 0) {
            options.onResize?.(containerWidth, containerHeight);
          }
        })
      : null;

  resizeObserverInstance?.observe(options.container);

  const themeObserverInstance =
    typeof MutationObserver !== 'undefined' &&
    options.onThemeChange &&
    typeof document !== 'undefined'
      ? new MutationObserver((mutationRecords) => {
          if (isDisposedState) return;
          for (const mutationRecord of mutationRecords) {
            if (
              mutationRecord.type === 'attributes' &&
              mutationRecord.attributeName === 'data-theme'
            ) {
              const isDarkThemeActive =
                document.documentElement.getAttribute('data-theme') === 'dark';
              options.onThemeChange?.(isDarkThemeActive);
              break;
            }
          }
        })
      : null;

  if (themeObserverInstance && typeof document !== 'undefined') {
    themeObserverInstance.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }

  const handlePageUnload = () => {
    teardownScene();
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('astro:before-swap', handlePageUnload, {
      once: true,
    });
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', handlePageUnload, { once: true });
  }

  const teardownScene = () => {
    if (isDisposedState) return;
    isDisposedState = true;

    if (animationFrameIdentifier) {
      cancelActiveFrame(animationFrameIdentifier);
      animationFrameIdentifier = 0;
    }

    intersectionObserverInstance?.disconnect();
    resizeObserverInstance?.disconnect();
    themeObserverInstance?.disconnect();

    if (typeof document !== 'undefined') {
      document.removeEventListener('astro:before-swap', handlePageUnload);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', handlePageUnload);
    }

    options.onTeardown();
  };

  const startAnimation = () => {
    if (!animationFrameIdentifier && isVisibleState && !isDisposedState) {
      animationFrameIdentifier = scheduleNextFrame(frameCallback);
    }
  };

  return {
    start: startAnimation,
    teardown: teardownScene,
    isDisposed: () => isDisposedState,
    isVisible: () => isVisibleState,
  };
}

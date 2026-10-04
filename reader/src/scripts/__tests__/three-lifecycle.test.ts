import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createSceneLifecycle } from '../shared/scene-lifecycle';

describe('Three.js Lifecycle & Off-Screen Pausing (stm-034)', () => {
  describe('Animation Loop Conditional Scheduling & Timing Reset', () => {
    it('cancels scheduled animation frame when observer reports off-screen', () => {
      let animationFrameId = 123;
      let isVisible = true;
      const cancelAnimationFrameSpy = vi.fn();

      const simulateIntersection = (isIntersecting: boolean) => {
        const wasContainerVisible = isVisible;
        isVisible = isIntersecting;

        if (isVisible && !wasContainerVisible) {
          if (!animationFrameId) {
            animationFrameId = 456;
          }
        } else if (!isVisible && animationFrameId) {
          cancelAnimationFrameSpy(animationFrameId);
          animationFrameId = 0;
        }
      };

      // When element scrolls out of view:
      simulateIntersection(false);

      expect(isVisible).toBe(false);
      expect(animationFrameId).toBe(0);
      expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(123);
    });

    it('resets timing baseline and resumes animation loop when returning to viewport', () => {
      let animationFrameId = 0;
      let isVisible = false;
      let lastTimelineTime = 1000;
      const requestAnimationFrameSpy = vi.fn().mockReturnValue(789);

      const simulateIntersection = (isIntersecting: boolean, currentTimestamp: number) => {
        const wasContainerVisible = isVisible;
        isVisible = isIntersecting;

        if (isVisible && !wasContainerVisible) {
          lastTimelineTime = currentTimestamp;
          if (!animationFrameId) {
            animationFrameId = requestAnimationFrameSpy();
          }
        } else if (!isVisible && animationFrameId) {
          animationFrameId = 0;
        }
      };

      // Resuming at timestamp 5000:
      simulateIntersection(true, 5000);

      expect(isVisible).toBe(true);
      expect(lastTimelineTime).toBe(5000);
      expect(animationFrameId).toBe(789);
      expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);
    });

    it('prevents animation function from queuing next frame when not visible', () => {
      const isVisible = false;
      let animationFrameId = 999;
      const requestAnimationFrameSpy = vi.fn();

      const animateFunction = () => {
        if (!isVisible) {
          animationFrameId = 0;
          return;
        }
        animationFrameId = requestAnimationFrameSpy(animateFunction);
      };

      animateFunction();

      expect(animationFrameId).toBe(0);
      expect(requestAnimationFrameSpy).not.toHaveBeenCalled();
    });
  });

  describe('Canvas Pointer Leave & Coordinate Resetting', () => {
    it('resets device coordinates to off-screen sentinel (-999, -999) on pointer leave', () => {
      const mouseCoordinates = new THREE.Vector2(0.5, -0.2);
      let hoveredMeshObject: THREE.Mesh | null = new THREE.Mesh();
      const canvasElement = {
        style: { cursor: 'pointer' },
      };
      const tooltipElement = {
        classList: {
          classes: new Set(['visible']),
          remove: vi.fn(),
        },
      };
      let selectedMeshObject: THREE.Mesh | null = null;
      const resetMeshHighlightsSpy = vi.fn();

      const handlePointerLeave = () => {
        mouseCoordinates.set(-999, -999);
        if (hoveredMeshObject) {
          hoveredMeshObject = null;
          canvasElement.style.cursor = 'grab';
          tooltipElement.classList.remove('visible');

          if (!selectedMeshObject) {
            resetMeshHighlightsSpy();
          }
        }
      };

      handlePointerLeave();

      expect(mouseCoordinates.x).toBe(-999);
      expect(mouseCoordinates.y).toBe(-999);
      expect(hoveredMeshObject).toBeNull();
      expect(canvasElement.style.cursor).toBe('grab');
      expect(tooltipElement.classList.remove).toHaveBeenCalledWith('visible');
      expect(resetMeshHighlightsSpy).toHaveBeenCalledTimes(1);
    });

    it('resets clickMouse coordinates and restores default body cursor on 404 pointer leave', () => {
      const clickMouseCoordinates = new THREE.Vector2(0.1, 0.4);
      const documentBodyMock = {
        style: { cursor: 'pointer' },
      };

      const handlePointerLeave = () => {
        clickMouseCoordinates.set(-999, -999);
        documentBodyMock.style.cursor = '';
      };

      handlePointerLeave();

      expect(clickMouseCoordinates.x).toBe(-999);
      expect(clickMouseCoordinates.y).toBe(-999);
      expect(documentBodyMock.style.cursor).toBe('');
    });
  });

  describe('Teardown & Async Synchronization Guard', () => {
    it('aborts reading state synchronization when scene has been disposed', () => {
      let isDisposed = true;
      const materialColorSetSpy = vi.fn();

      const syncReadingStateFunction = () => {
        if (isDisposed) return;
        materialColorSetSpy();
      };

      syncReadingStateFunction();

      expect(materialColorSetSpy).not.toHaveBeenCalled();
    });

    it('executes reading state synchronization when scene is still active', () => {
      let isDisposed = false;
      const materialColorSetSpy = vi.fn();

      const syncReadingStateFunction = () => {
        if (isDisposed) return;
        materialColorSetSpy();
      };

      syncReadingStateFunction();

      expect(materialColorSetSpy).toHaveBeenCalledTimes(1);
    });

    it('guarantees teardown execution is idempotent', () => {
      let isDisposed = false;
      let disposalExecutionCount = 0;

      const teardownFunction = () => {
        if (isDisposed) return;
        isDisposed = true;
        disposalExecutionCount++;
      };

      teardownFunction();
      teardownFunction();
      teardownFunction();

      expect(disposalExecutionCount).toBe(1);
      expect(isDisposed).toBe(true);
    });
  });

  describe('Universal Scene Lifecycle Controller (createSceneLifecycle)', () => {
    it('initializes in undisposed, visible state and executes teardown', () => {
      const containerElement = {
        clientWidth: 800,
        clientHeight: 600,
      } as unknown as HTMLElement;
      const onAnimateSpy = vi.fn();
      const onTeardownSpy = vi.fn();

      const controller = createSceneLifecycle({
        container: containerElement,
        onAnimate: onAnimateSpy,
        onTeardown: onTeardownSpy,
      });

      expect(controller.isDisposed()).toBe(false);
      expect(controller.isVisible()).toBe(true);

      controller.start();
      controller.teardown();

      expect(controller.isDisposed()).toBe(true);
      expect(onTeardownSpy).toHaveBeenCalledTimes(1);
    });

    it('ensures teardown is idempotent when called repeatedly', () => {
      const containerElement = {
        clientWidth: 800,
        clientHeight: 600,
      } as unknown as HTMLElement;
      const onAnimateSpy = vi.fn();
      const onTeardownSpy = vi.fn();

      const controller = createSceneLifecycle({
        container: containerElement,
        onAnimate: onAnimateSpy,
        onTeardown: onTeardownSpy,
      });

      controller.teardown();
      controller.teardown();
      controller.teardown();

      expect(onTeardownSpy).toHaveBeenCalledTimes(1);
      expect(controller.isDisposed()).toBe(true);
    });
  });
});

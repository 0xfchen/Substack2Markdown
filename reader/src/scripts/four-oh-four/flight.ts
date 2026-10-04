/**
 * flight.ts
 *
 * Flight controller, cursor attitude aiming, and raycast click trigger
 * for the 3D Starship and Origami Paper Plane 404 scene.
 */

import * as THREE from 'three';
import {
  buildFlightCurve,
  makeAttitude,
} from './flight-trajectory';

export function getElementWorldPosition(
  element: HTMLElement,
  camera: THREE.PerspectiveCamera,
  targetZ = 0
): THREE.Vector3 {
  const boundingRectangle = element.getBoundingClientRect();
  const centerX = boundingRectangle.left + boundingRectangle.width / 2;
  const centerY = boundingRectangle.top + boundingRectangle.height / 2;
  const normalizedDeviceCoordinateX = (centerX / window.innerWidth) * 2 - 1;
  const normalizedDeviceCoordinateY = -(centerY / window.innerHeight) * 2 + 1;

  const visibleHeight =
    2 * (camera.position.z - targetZ) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const visibleWidth = visibleHeight * (window.innerWidth / window.innerHeight);
  return new THREE.Vector3(
    normalizedDeviceCoordinateX * (visibleWidth / 2),
    normalizedDeviceCoordinateY * (visibleHeight / 2),
    targetZ
  );
}

export interface FlightControllerOptions {
  containerElement: HTMLElement;
  canvasElement: HTMLCanvasElement;
  codeContainerElement?: HTMLElement | null;
  titleElement?: HTMLElement | null;
  hintElement?: HTMLElement | null;
  camera: THREE.PerspectiveCamera;
  starshipGroup: THREE.Group;
  plumeMaterial: THREE.Material;
  isDarkTheme: () => boolean;
  prefersReducedMotion: boolean;
}

export interface FlightController {
  updateTargetPositions: () => void;
  updateAimAtCursor: (clientX: number, clientY: number) => void;
  triggerFlight: () => void;
  completeFlight: () => void;
  isFlightActive: () => boolean;
  getFlightCurve: () => THREE.CatmullRomCurve3 | null;
  getFlightStartTime: () => number;
  handlePointerDown: (clientX: number, clientY: number) => void;
  handlePointerMove: (clientX: number, clientY: number) => void;
  handlePointerLeave: () => void;
  getHomePosition: () => THREE.Vector3;
  getCodePosition: () => THREE.Vector3;
  getTargetQuaternion: () => THREE.Quaternion;
  dispose: () => void;
}

export function setupFlightController(
  options: FlightControllerOptions
): FlightController {
  let isFlightActiveState = false;
  let activeFlightCurveInstance: THREE.CatmullRomCurve3 | null = null;
  let flightStartTimeNumber = 0;
  const homePosition = new THREE.Vector3(2.5, 0, 0);
  const codePosition = new THREE.Vector3(-2.5, 1.0, 0);
  const targetQuaternion = new THREE.Quaternion();

  const raycaster = new THREE.Raycaster();
  const clickMouseCoordinates = new THREE.Vector2(-999, -999);

  const upVector = new THREE.Vector3(0, 1, 0);
  const starshipDefaultAim = new THREE.Vector3(0.04, 0.98, 0.18).normalize();

  const getSearchButtonAim = (): { forward: THREE.Vector3; quat: THREE.Quaternion } => {
    const searchButtonElement =
      document.querySelector<HTMLElement>('.not-found-actions a[href*="search"]') ||
      document.querySelector<HTMLElement>('.not-found-actions');
    let targetWorldPos = new THREE.Vector3(-2.2, -1.1, 0);
    if (searchButtonElement && options.camera) {
      targetWorldPos = getElementWorldPosition(
        searchButtonElement,
        options.camera,
        0
      );
    }
    const forwardVector = targetWorldPos.clone().sub(homePosition);
    forwardVector.z = 0.12;
    forwardVector.normalize();
    const attitudeQuaternion = makeAttitude(
      [forwardVector.x, forwardVector.y, forwardVector.z],
      [0, 1, 0],
      -20
    );
    return { forward: forwardVector, quat: attitudeQuaternion };
  };

  const getActiveDefaultAttitude = (): { forward: THREE.Vector3; quat: THREE.Quaternion } => {
    if (options.isDarkTheme()) {
      return {
        forward: starshipDefaultAim.clone(),
        quat: new THREE.Quaternion().setFromUnitVectors(upVector, starshipDefaultAim),
      };
    }
    return getSearchButtonAim();
  };

  const updateTargetPositions = () => {
    if (options.containerElement && options.camera) {
      homePosition.copy(
        getElementWorldPosition(options.containerElement, options.camera, 0)
      );
    }

    if (options.codeContainerElement && options.camera) {
      const codeBoundingRect = options.codeContainerElement.getBoundingClientRect();
      const codeCenterY = codeBoundingRect.top + codeBoundingRect.height / 2;
      let codeCenterX = codeBoundingRect.left + codeBoundingRect.width / 2;
      if (options.titleElement) {
        const titleBoundingRect = options.titleElement.getBoundingClientRect();
        if (titleBoundingRect.width > 30) {
          codeCenterX = titleBoundingRect.left + titleBoundingRect.width / 2;
        }
      }

      const normalizedDeviceCoordinateX = (codeCenterX / window.innerWidth) * 2 - 1;
      const normalizedDeviceCoordinateY = -(codeCenterY / window.innerHeight) * 2 + 1;
      const visibleHeight =
        2 * options.camera.position.z * Math.tan(THREE.MathUtils.degToRad(options.camera.fov / 2));
      const visibleWidth = visibleHeight * (window.innerWidth / window.innerHeight);
      codePosition.set(
        normalizedDeviceCoordinateX * (visibleWidth / 2),
        normalizedDeviceCoordinateY * (visibleHeight / 2),
        0
      );
    }

    if (!isFlightActiveState) {
      targetQuaternion.copy(getActiveDefaultAttitude().quat);
      options.starshipGroup.quaternion.copy(targetQuaternion);
    }
  };

  const triggerFlight = () => {
    if (isFlightActiveState) return;

    if (options.prefersReducedMotion) {
      options.plumeMaterial.opacity = 0.5;
    }
    document.body.style.cursor = '';
    flightStartTimeNumber = performance.now();
    updateTargetPositions();
    activeFlightCurveInstance = buildFlightCurve(homePosition);
    isFlightActiveState = true;
    if (options.hintElement) {
      options.hintElement.style.opacity = '0';
    }
  };

  const completeFlight = () => {
    isFlightActiveState = false;
    activeFlightCurveInstance = null;
    if (options.hintElement) {
      options.hintElement.style.opacity = '';
    }
  };

  const handlePointerDown = (clientX: number, clientY: number) => {
    clickMouseCoordinates.x = (clientX / window.innerWidth) * 2 - 1;
    clickMouseCoordinates.y = -(clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(clickMouseCoordinates, options.camera);
    const intersectedObjects = raycaster.intersectObjects(
      [options.starshipGroup],
      true
    );

    if (intersectedObjects.length > 0) {
      triggerFlight();
    }
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (isFlightActiveState) return;

    clickMouseCoordinates.x = (clientX / window.innerWidth) * 2 - 1;
    clickMouseCoordinates.y = -(clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(clickMouseCoordinates, options.camera);
    const intersectedObjects = raycaster.intersectObjects(
      [options.starshipGroup],
      true
    );

    document.body.style.cursor = intersectedObjects.length > 0 ? 'pointer' : '';

    if (options.isDarkTheme()) {
      const starshipDefaultAimDirection = starshipDefaultAim.clone();
      const cursorWorldPosition = new THREE.Vector3(
        clickMouseCoordinates.x * 2.5,
        clickMouseCoordinates.y * 2.0,
        1.5
      );
      const cursorDirectionVector = cursorWorldPosition
        .sub(homePosition)
        .normalize();

      const combinedAimVector = new THREE.Vector3()
        .copy(starshipDefaultAimDirection)
        .lerp(cursorDirectionVector, 0.35)
        .normalize();

      targetQuaternion.setFromUnitVectors(upVector, combinedAimVector);
    } else {
      const searchAim = getSearchButtonAim();
      const cursorOffsetX = (clientX / window.innerWidth - 0.5) * 2;
      const cursorOffsetY = (clientY / window.innerHeight - 0.5) * 2;
      const distanceOffset = Math.hypot(cursorOffsetX, cursorOffsetY);

      const targetZDepth = Math.max(0.05, Math.min(0.40, 0.10 + distanceOffset * 0.05));
      const aimDirection = new THREE.Vector3(cursorOffsetX, -cursorOffsetY, targetZDepth).normalize();
      const blendFactor = THREE.MathUtils.clamp((distanceOffset - 0.3) / 1.0, 0, 1);
      const finalDirection = new THREE.Vector3()
        .lerpVectors(searchAim.forward, aimDirection, blendFactor * 0.55)
        .normalize();

      targetQuaternion.copy(
        makeAttitude(
          [finalDirection.x, finalDirection.y, finalDirection.z],
          [0, 1, 0],
          -20
        )
      );
    }
  };

  const handlePointerLeave = () => {
    clickMouseCoordinates.set(-999, -999);
    document.body.style.cursor = '';
  };

  const onContainerClick = () => {
    triggerFlight();
  };

  const onPointerDownListener = (event: PointerEvent) => {
    const targetElement = event.target as HTMLElement | null;
    if (targetElement?.closest('a, button, input, select, textarea')) return;
    handlePointerDown(event.clientX, event.clientY);
  };

  const onPointerMoveListener = (event: PointerEvent) => {
    handlePointerMove(event.clientX, event.clientY);
  };

  targetQuaternion.copy(getActiveDefaultAttitude().quat);
  options.starshipGroup.quaternion.copy(targetQuaternion);
  updateTargetPositions();
  options.starshipGroup.position.copy(homePosition);

  options.containerElement.addEventListener('click', onContainerClick);
  window.addEventListener('pointerdown', onPointerDownListener);
  window.addEventListener('pointermove', onPointerMoveListener, { passive: true });
  options.containerElement.addEventListener('pointerleave', handlePointerLeave);
  options.canvasElement.addEventListener('pointerleave', handlePointerLeave);
  document.addEventListener('pointerleave', handlePointerLeave);

  const dispose = () => {
    document.body.style.cursor = '';
    options.containerElement.removeEventListener('click', onContainerClick);
    window.removeEventListener('pointerdown', onPointerDownListener);
    window.removeEventListener('pointermove', onPointerMoveListener);
    options.containerElement.removeEventListener('pointerleave', handlePointerLeave);
    options.canvasElement.removeEventListener('pointerleave', handlePointerLeave);
    document.removeEventListener('pointerleave', handlePointerLeave);
  };

  return {
    updateTargetPositions,
    updateAimAtCursor: handlePointerMove,
    triggerFlight,
    completeFlight,
    isFlightActive: () => isFlightActiveState,
    getFlightCurve: () => activeFlightCurveInstance,
    getFlightStartTime: () => flightStartTimeNumber,
    handlePointerDown,
    handlePointerMove,
    handlePointerLeave,
    getHomePosition: () => homePosition,
    getCodePosition: () => codePosition,
    getTargetQuaternion: () => targetQuaternion,
    dispose,
  };
}

export const createFlightController = setupFlightController;


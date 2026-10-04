/**
 * three-404.ts
 *
 * Interactive 3D scene orchestrator for the 404 page.
 * Coordinates SpaceX Starship (Dark Mode) vs Origami Paper Plane (Light Mode),
 * 3D Chrome "404" extruded typography, 2D deep space starfield, and acrobatic flybys.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { StarfieldEngine } from './four-oh-four/starfield';
import {
  computeFlightProgress,
  computeFlightVelocity,
  computeThrottle,
  computeFlightOrientation,
  FLIGHT_DURATION,
} from './four-oh-four/flight-trajectory';
import type { FlightMotion } from './four-oh-four/types';
import {
  createStarshipRocket,
  createOrigamiPaperPlane,
  generatePaperTextures,
} from './four-oh-four/vessel-factory';
import { create3D404Typography } from './four-oh-four/typography';
import { createFlightController } from './four-oh-four/flight';
import { createSceneLifecycle } from './shared/scene-lifecycle';
import { AEROSPACE_404_COLORS } from '../utils/colors';

export function initThree404(): (() => void) | null {
  const canvasElement = document.querySelector<HTMLCanvasElement>(
    '[data-three-canvas]'
  );
  const containerElement = document.querySelector<HTMLElement>(
    '[data-three-404]'
  );
  const codeContainerElement = document.querySelector<HTMLElement>(
    '[data-three-code-container]'
  );
  const titleElement =
    document.querySelector<HTMLElement>('.not-found-title');
  const starfieldCanvas = document.querySelector<HTMLCanvasElement>(
    '[data-starfield-canvas]'
  );
  const hintElement =
    containerElement?.querySelector<HTMLElement>('.three-404-hint') ||
    document.querySelector<HTMLElement>('[data-flight-hint], [data-three-hint]');

  if (!canvasElement || !containerElement) return null;

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  // 1. Scene & Camera Setup
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 8);

  // 2. High-Performance WebGL Renderer with PMREM Room Environment
  const renderer = new THREE.WebGLRenderer({
    canvas: canvasElement,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const roomEnvironment = new RoomEnvironment();
  const environmentTexture = pmremGenerator.fromScene(roomEnvironment).texture;
  scene.environment = environmentTexture;

  const isDarkTheme = (): boolean => {
    return (
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      (!document.documentElement.getAttribute('data-theme') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  };

  // 3. Studio Lighting Rig
  const ambientLight = new THREE.AmbientLight(
    AEROSPACE_404_COLORS.ambientLight,
    isDarkTheme() ? 1.4 : 0.65
  );
  scene.add(ambientLight);

  const keyDirectionalLight = new THREE.DirectionalLight(
    AEROSPACE_404_COLORS.keyLight,
    isDarkTheme() ? 2.8 : 2.4
  );
  keyDirectionalLight.position.set(3, 6, 8);
  scene.add(keyDirectionalLight);

  const fillDirectionalLight = new THREE.DirectionalLight(
    AEROSPACE_404_COLORS.fillLight,
    isDarkTheme() ? 2.0 : 0.85
  );
  fillDirectionalLight.position.set(-5, 4, 7);
  scene.add(fillDirectionalLight);

  const rimDirectionalLightLeft = new THREE.DirectionalLight(
    isDarkTheme()
      ? AEROSPACE_404_COLORS.rimLightLDark
      : AEROSPACE_404_COLORS.rimLightLLight,
    isDarkTheme() ? 2.4 : 0.6
  );
  rimDirectionalLightLeft.position.set(-8, 1, -3);
  scene.add(rimDirectionalLightLeft);

  const rimDirectionalLightRight = new THREE.DirectionalLight(
    AEROSPACE_404_COLORS.rimLightR,
    isDarkTheme() ? 2.2 : 0.6
  );
  rimDirectionalLightRight.position.set(8, 2, -2);
  scene.add(rimDirectionalLightRight);

  const topDirectionalLight = new THREE.DirectionalLight(
    AEROSPACE_404_COLORS.topLight,
    isDarkTheme() ? 1.6 : 0.8
  );
  topDirectionalLight.position.set(0, 9, 2);
  scene.add(topDirectionalLight);

  const enginePointLight = new THREE.PointLight(
    AEROSPACE_404_COLORS.engineLight,
    0,
    12
  );
  enginePointLight.position.set(0, -1.5, 0);
  scene.add(enginePointLight);

  // 4. Materials
  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: AEROSPACE_404_COLORS.chromeDark,
    roughness: 0.04,
    metalness: 1.0,
    envMapIntensity: 2.4,
    side: THREE.DoubleSide,
  });

  const { diffuse: paperTexture, bump: paperBumpTexture } =
    generatePaperTextures();

  const paperFrontMaterial = new THREE.MeshStandardMaterial({
    color: AEROSPACE_404_COLORS.paperFront,
    flatShading: true,
    map: paperTexture,
    bumpMap: paperBumpTexture,
    bumpScale: 0.12,
    roughness: 0.95,
    metalness: 0.0,
    envMapIntensity: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });

  const paperSideMaterial = new THREE.MeshStandardMaterial({
    color: AEROSPACE_404_COLORS.paperSide,
    flatShading: true,
    map: paperTexture,
    bumpMap: paperBumpTexture,
    bumpScale: 0.12,
    roughness: 0.95,
    metalness: 0.0,
    envMapIntensity: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });

  const paperCodeCreaseMaterial = new THREE.LineBasicMaterial({
    color: AEROSPACE_404_COLORS.creaseLines,
    transparent: true,
    opacity: 0.85,
  });

  const engineBellMaterial = new THREE.MeshStandardMaterial({
    color: AEROSPACE_404_COLORS.engineBell,
    roughness: 0.3,
    metalness: 0.9,
  });

  const plumeMaterial = new THREE.MeshBasicMaterial({
    color: AEROSPACE_404_COLORS.plume,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const corePlumeMaterial = new THREE.MeshBasicMaterial({
    color: AEROSPACE_404_COLORS.corePlume,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  // 5. Vessel System: Starship (Dark Mode) + Origami Paper Plane (Light Mode)
  const starshipGroup = new THREE.Group();
  const rocketVessel = createStarshipRocket(
    chromeMaterial,
    engineBellMaterial,
    plumeMaterial,
    corePlumeMaterial
  );
  starshipGroup.add(rocketVessel.rocketGroup);

  const paperVessel = createOrigamiPaperPlane();
  starshipGroup.add(paperVessel.paperPlaneGroup);
  scene.add(starshipGroup);

  // 6. 3D Chrome / Origami Typography
  let typographyInstance: ReturnType<typeof create3D404Typography> | null =
    null;
  if (codeContainerElement) {
    typographyInstance = create3D404Typography(
      chromeMaterial,
      [paperFrontMaterial, paperSideMaterial],
      paperCodeCreaseMaterial
    );
    if (typographyInstance.chromeGroup && typographyInstance.paperGroup) {
      typographyInstance.chromeGroup.visible = isDarkTheme();
      typographyInstance.paperGroup.visible = !isDarkTheme();
    }
    scene.add(typographyInstance.code404Group);
  }

  // 7. Background 2D Canvas Starfield
  let starfieldEngine: StarfieldEngine | null = null;
  if (starfieldCanvas) {
    starfieldEngine = new StarfieldEngine(starfieldCanvas, 320);
  }

  // 8. Foreground Floating Space Motes
  const starCount = 30;
  const starParticleGeometry = new THREE.BufferGeometry();
  const starPositionsArray = new Float32Array(starCount * 3);
  const starSpeedsArray = new Float32Array(starCount);

  for (let i = 0; i < starCount; i++) {
    starPositionsArray[i * 3] = (Math.random() - 0.5) * 14;
    starPositionsArray[i * 3 + 1] = (Math.random() - 0.5) * 10;
    starPositionsArray[i * 3 + 2] = (Math.random() - 0.5) * 8;
    starSpeedsArray[i] = 0.002 + Math.random() * 0.005;
  }
  starParticleGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(starPositionsArray, 3)
  );

  const starParticleMaterial = new THREE.PointsMaterial({
    color: isDarkTheme()
      ? AEROSPACE_404_COLORS.starMotesDark
      : AEROSPACE_404_COLORS.starMotesLight,
    size: 0.055,
    transparent: true,
    opacity: 0.4,
  });
  const starFieldPoints = new THREE.Points(
    starParticleGeometry,
    starParticleMaterial
  );
  scene.add(starFieldPoints);

  // 9. Flight Controller (Coordinate Projection, Cursor Attitude Aiming, Triggering)
  const flightController = createFlightController({
    containerElement,
    canvasElement,
    codeContainerElement,
    titleElement,
    hintElement,
    camera,
    starshipGroup,
    plumeMaterial,
    isDarkTheme,
    prefersReducedMotion,
  });

  // 10. Dynamic Scaling & Resize
  let starshipScaleFactor = 0.55;
  const updateVesselScales = () => {
    const visibleHeight =
      2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const unitsPerPixel = visibleHeight / window.innerHeight;

    if (codeContainerElement && typographyInstance) {
      let targetCodeWidthPixels = Math.min(
        codeContainerElement.clientWidth * 0.95,
        270
      );
      if (titleElement) {
        const titleBoundingRect = titleElement.getBoundingClientRect();
        if (titleBoundingRect.width > 50) {
          targetCodeWidthPixels = Math.min(
            titleBoundingRect.width * 0.95,
            270
          );
        }
      }
      const targetCodeWidthUnits = targetCodeWidthPixels * unitsPerPixel;
      const typographyScale = targetCodeWidthUnits / 3.2;
      typographyInstance.code404Group.scale.set(
        typographyScale,
        typographyScale,
        typographyScale
      );
    }

    if (containerElement && starshipGroup) {
      const targetShipHeightPixels = Math.min(
        containerElement.clientHeight * 0.75,
        360
      );
      const targetShipHeightUnits = targetShipHeightPixels * unitsPerPixel;
      const vesselScale = targetShipHeightUnits / 4.2;
      starshipScaleFactor = vesselScale;
      if (!flightController.isFlightActive()) {
        starshipGroup.scale.set(vesselScale, vesselScale, vesselScale);
      }
    }
  };

  const handleResize = () => {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    if (windowWidth > 0 && windowHeight > 0) {
      camera.aspect = windowWidth / windowHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(windowWidth, windowHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      starfieldEngine?.resize(windowWidth, windowHeight);
      flightController.updateTargetPositions();
      updateVesselScales();
    }
  };

  let windowMousePositionX = 0.5;
  let windowMousePositionY = 0.5;

  const handleGlobalMouseMove = (mouseEvent: MouseEvent) => {
    windowMousePositionX = mouseEvent.clientX / window.innerWidth;
    windowMousePositionY = mouseEvent.clientY / window.innerHeight;
    flightController.updateAimAtCursor(mouseEvent.clientX, mouseEvent.clientY);
  };
  window.addEventListener('mousemove', handleGlobalMouseMove);

  // 11. Theme Synchronization
  const updateThemeColors = (isDark: boolean) => {
    rocketVessel.rocketGroup.visible = isDark;
    paperVessel.paperPlaneGroup.visible = !isDark;

    if (typographyInstance?.chromeGroup && typographyInstance?.paperGroup) {
      typographyInstance.chromeGroup.visible = isDark;
      typographyInstance.paperGroup.visible = !isDark;
    }

    if (hintElement) {
      hintElement.textContent = isDark
        ? 'Click Starship to fly'
        : 'Click Paper Plane to glide';
    }

    ambientLight.intensity = isDark ? 1.4 : 0.65;
    keyDirectionalLight.intensity = isDark ? 2.8 : 2.4;
    fillDirectionalLight.intensity = isDark ? 2.0 : 0.85;
    rimDirectionalLightLeft.color.setHex(
      isDark
        ? AEROSPACE_404_COLORS.rimLightLDark
        : AEROSPACE_404_COLORS.rimLightLLight
    );
    rimDirectionalLightLeft.intensity = isDark ? 2.4 : 0.6;
    rimDirectionalLightRight.intensity = isDark ? 2.2 : 0.6;
    topDirectionalLight.intensity = isDark ? 1.6 : 0.8;

    chromeMaterial.color.setHex(
      isDark
        ? AEROSPACE_404_COLORS.chromeDark
        : AEROSPACE_404_COLORS.chromeLight
    );
    chromeMaterial.envMapIntensity = isDark ? 2.4 : 1.2;
    starParticleMaterial.color.setHex(
      isDark
        ? AEROSPACE_404_COLORS.starMotesDark
        : AEROSPACE_404_COLORS.starMotesLight
    );
    starParticleMaterial.opacity = isDark ? 0.4 : 0.22;

    flightController.updateTargetPositions();
  };

  const handleScrollUpdate = () => {
    flightController.updateTargetPositions();
  };
  window.addEventListener('scroll', handleScrollUpdate);

  flightController.updateTargetPositions();
  updateVesselScales();
  starshipGroup.position.copy(flightController.getHomePosition());
  if (typographyInstance) {
    typographyInstance.code404Group.position.copy(
      flightController.getCodePosition()
    );
  }
  updateThemeColors(isDarkTheme());

  const animationStartTimestamp = performance.now();
  let previousFrameTimestamp = performance.now();
  const upUnitVector = new THREE.Vector3(0, 1, 0);

  // 12. Shared Scene Lifecycle
  const lifecycleController = createSceneLifecycle({
    container: containerElement,
    canvas: canvasElement,
    onAnimate: (currentTimestamp) => {
      const deltaSeconds = Math.min(
        (currentTimestamp - previousFrameTimestamp) * 0.001,
        0.05
      );
      previousFrameTimestamp = currentTimestamp;
      const elapsedSeconds =
        (currentTimestamp - animationStartTimestamp) * 0.001;

      let flightMotion: FlightMotion = { speedRatio: 0, vx: 0, vy: 0, vz: 0 };
      let rawFlightProgress = 0;
      let smoothedFlightProgress = 0;

      const activeFlightCurve = flightController.getFlightCurve();
      const isFlightCurrentlyActive = flightController.isFlightActive();

      if (isFlightCurrentlyActive && activeFlightCurve) {
        const flightElapsedSeconds =
          (performance.now() - flightController.getFlightStartTime()) * 0.001;
        rawFlightProgress = flightElapsedSeconds / FLIGHT_DURATION;

        if (rawFlightProgress >= 1.0) {
          flightController.completeFlight();
          starshipGroup.position.copy(flightController.getHomePosition());
          starshipGroup.quaternion.copy(flightController.getTargetQuaternion());
          plumeMaterial.opacity = 0;
          corePlumeMaterial.opacity = 0;
          enginePointLight.intensity = 0;
          rocketVessel.flaps.fwdLeftPivot.rotation.y = 0;
          rocketVessel.flaps.fwdRightPivot.rotation.y = 0;
          rocketVessel.flaps.aftLeftPivot.rotation.y = 0;
          rocketVessel.flaps.aftRightPivot.rotation.y = 0;
          paperVessel.paperPlaneGroup.rotation.set(0, 0, 0);
          starshipGroup.scale.set(
            starshipScaleFactor,
            starshipScaleFactor,
            starshipScaleFactor
          );
        } else {
          smoothedFlightProgress = computeFlightProgress(rawFlightProgress);
          const flightVelocityResult = computeFlightVelocity(
            activeFlightCurve,
            rawFlightProgress,
            FLIGHT_DURATION
          );
          flightMotion = {
            speedRatio: flightVelocityResult.speedRatio,
            warpRatio: flightVelocityResult.warpRatio,
            speed: flightVelocityResult.speed,
            vx: flightVelocityResult.velocity.x,
            vy: flightVelocityResult.velocity.y,
            vz: flightVelocityResult.velocity.z,
            isOutbound: flightVelocityResult.isOutbound,
          };
        }
      }

      starfieldEngine?.render(
        deltaSeconds,
        windowMousePositionX,
        windowMousePositionY,
        flightMotion,
        prefersReducedMotion,
        isDarkTheme()
      );

      const motePositionArray = starParticleGeometry.attributes.position
        .array as Float32Array;
      const activeWarpRatio = flightMotion.warpRatio ?? flightMotion.speedRatio;
      const flightSpeedMultiplier = 1.0 + 7.0 * activeWarpRatio;
      const moteRate =
        (prefersReducedMotion ? 0.06 : 0.28) * flightSpeedMultiplier;
      const lateralShift = -(flightMotion.vx ?? 0) * 0.06 * deltaSeconds;

      for (let i = 0; i < starCount; i++) {
        motePositionArray[i * 3 + 2] +=
          (moteRate + starSpeedsArray[i] * (12 + 20 * activeWarpRatio)) *
          deltaSeconds;
        if (flightMotion.speedRatio > 0.05) {
          motePositionArray[i * 3] += lateralShift;
        }
        if (motePositionArray[i * 3 + 2] > 8.8) {
          motePositionArray[i * 3 + 2] = -8.0;
          motePositionArray[i * 3] = (Math.random() - 0.5) * 14;
          motePositionArray[i * 3 + 1] = (Math.random() - 0.5) * 10;
        }
      }
      starParticleGeometry.attributes.position.needsUpdate = true;

      const bobbingDisplacement = Math.sin(elapsedSeconds * 1.2) * 0.03;

      if (isFlightCurrentlyActive && activeFlightCurve) {
        const trajectoryPoint = activeFlightCurve.getPoint(
          smoothedFlightProgress
        );
        starshipGroup.position.copy(trajectoryPoint);

        const flightOrientationQuaternion = computeFlightOrientation(
          activeFlightCurve,
          smoothedFlightProgress,
          rawFlightProgress,
          flightController.getTargetQuaternion(),
          upUnitVector
        );
        starshipGroup.quaternion.copy(flightOrientationQuaternion);

        const {
          plumeOpacity,
          coreOpacity,
          lightIntensity,
          plumeScale,
        } = computeThrottle(smoothedFlightProgress, isDarkTheme());
        plumeMaterial.opacity = plumeOpacity;
        corePlumeMaterial.opacity = coreOpacity;
        enginePointLight.intensity = lightIntensity;
        rocketVessel.plumeGroup.scale.set(
          plumeScale,
          plumeScale * (1.0 + Math.random() * 0.18),
          plumeScale
        );

        if (isDarkTheme()) {
          const highGFlapAngle =
            rawFlightProgress < 0.92
              ? Math.sin(elapsedSeconds * 6.0) * 0.14
              : 0;
          rocketVessel.flaps.fwdLeftPivot.rotation.y = highGFlapAngle;
          rocketVessel.flaps.fwdRightPivot.rotation.y = -highGFlapAngle;
          rocketVessel.flaps.aftLeftPivot.rotation.y = -highGFlapAngle * 0.8;
          rocketVessel.flaps.aftRightPivot.rotation.y = highGFlapAngle * 0.8;
        } else {
          const breezeAngle =
            rawFlightProgress < 0.92
              ? Math.sin(elapsedSeconds * 8.0) * 0.03
              : 0;
          paperVessel.paperPlaneGroup.rotation.z = breezeAngle;
        }
      } else {
        const homePosition = flightController.getHomePosition();
        const targetRestingPositionY = homePosition.y + bobbingDisplacement;
        starshipGroup.position.x +=
          (homePosition.x - starshipGroup.position.x) * 0.08;
        starshipGroup.position.y +=
          (targetRestingPositionY - starshipGroup.position.y) * 0.08;
        starshipGroup.position.z +=
          (homePosition.z - starshipGroup.position.z) * 0.08;

        if (!prefersReducedMotion) {
          starshipGroup.quaternion.slerp(
            flightController.getTargetQuaternion(),
            0.1
          );
        }

        rocketVessel.flaps.fwdLeftPivot.rotation.y = 0;
        rocketVessel.flaps.fwdRightPivot.rotation.y = 0;
        rocketVessel.flaps.aftLeftPivot.rotation.y = 0;
        rocketVessel.flaps.aftRightPivot.rotation.y = 0;

        if (paperVessel.paperPlaneGroup.visible && !prefersReducedMotion) {
          paperVessel.paperPlaneGroup.rotation.z =
            Math.sin(elapsedSeconds * 2.4) * 0.05;
          paperVessel.paperPlaneGroup.rotation.x =
            Math.cos(elapsedSeconds * 1.8) * 0.04;
        } else {
          paperVessel.paperPlaneGroup.rotation.set(0, 0, 0);
        }

        if (typographyInstance) {
          const codePosition = flightController.getCodePosition();
          const normalizedMouseOffsetX = windowMousePositionX - 0.5;
          const normalizedMouseOffsetY = windowMousePositionY - 0.5;
          typographyInstance.code404Group.position.set(
            codePosition.x,
            codePosition.y + bobbingDisplacement * 0.3,
            codePosition.z
          );
          if (!prefersReducedMotion) {
            typographyInstance.code404Group.rotation.y +=
              (normalizedMouseOffsetX * 0.35 -
                typographyInstance.code404Group.rotation.y) *
              0.06;
            typographyInstance.code404Group.rotation.x +=
              (normalizedMouseOffsetY * 0.25 -
                typographyInstance.code404Group.rotation.x) *
              0.06;
          }
        }
      }

      renderer.render(scene, camera);
    },
    onResize: () => {
      handleResize();
    },
    onThemeChange: (isDark) => {
      updateThemeColors(isDark);
    },
    onTeardown: () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScrollUpdate);
      window.removeEventListener('mousemove', handleGlobalMouseMove);

      flightController.dispose();
      pmremGenerator.dispose();
      roomEnvironment.dispose();
      environmentTexture.dispose();
      chromeMaterial.dispose();
      paperFrontMaterial.dispose();
      paperSideMaterial.dispose();
      paperCodeCreaseMaterial.dispose();
      paperTexture.dispose();
      paperBumpTexture.dispose();
      engineBellMaterial.dispose();
      plumeMaterial.dispose();
      corePlumeMaterial.dispose();
      starParticleMaterial.dispose();
      starParticleGeometry.dispose();
      rocketVessel.dispose();
      paperVessel.dispose();
      typographyInstance?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  });

  window.addEventListener('resize', handleResize);
  lifecycleController.start();

  return () => {
    lifecycleController.teardown();
  };
}

let activeThree404Teardown: (() => void) | null = null;

/**
 * Mounts the interactive 3D 404 scene, integrating with Astro lifecycle events.
 */
export function mountThree404Scene(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const setupScene = () => {
    if (typeof activeThree404Teardown === 'function') {
      activeThree404Teardown();
      activeThree404Teardown = null;
    }
    activeThree404Teardown = initThree404();
  };

  document.addEventListener('astro:page-load', setupScene);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupScene, { once: true });
  } else {
    setupScene();
  }
}

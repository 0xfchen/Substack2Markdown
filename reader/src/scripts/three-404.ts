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
  buildFlightCurve,
  computeFlightProgress,
  computeFlightVelocity,
  computeThrottle,
  computeFlightOrientation,
  makeAttitude,
  FLIGHT_DURATION,
} from './four-oh-four/flight-trajectory';
import type { FlightMotion } from './four-oh-four/types';
import {
  createStarshipRocket,
  createOrigamiPaperPlane,
  create3D404Typography,
  generatePaperTextures,
} from './four-oh-four/vessel-factory';

export function initThree404(): (() => void) | null {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-three-canvas]');
  const container = document.querySelector<HTMLElement>('[data-three-404]');
  const codeContainer = document.querySelector<HTMLElement>('[data-three-code-container]');
  const titleEl = document.querySelector<HTMLElement>('.not-found-title');
  const starfieldCanvas = document.querySelector<HTMLCanvasElement>('[data-starfield-canvas]');

  if (!canvas || !container) return null;

  const hintEl = container.querySelector<HTMLElement>('.three-404-hint');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Scene & Full-Viewport Camera
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 0, 9.2);

  // 2. High-Performance WebGL Renderer with PMREM Room Environment
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const roomEnv = new RoomEnvironment();
  const envTexture = pmremGenerator.fromScene(roomEnv).texture;
  scene.environment = envTexture;

  function isDark(): boolean {
    return (
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      (!document.documentElement.getAttribute('data-theme') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  }

  // 3. Studio Lighting Rig
  const ambientLight = new THREE.AmbientLight(0xffffff, isDark() ? 1.4 : 0.65);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, isDark() ? 2.8 : 2.4);
  keyLight.position.set(3, 6, 8);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xe2e8f0, isDark() ? 2.0 : 0.85);
  fillLight.position.set(-5, 4, 7);
  scene.add(fillLight);

  const rimLightL = new THREE.DirectionalLight(0x93c5fd, isDark() ? 2.4 : 0.6);
  rimLightL.position.set(-8, 1, -3);
  scene.add(rimLightL);

  const rimLightR = new THREE.DirectionalLight(0xe0f2fe, isDark() ? 2.2 : 0.6);
  rimLightR.position.set(8, 2, -2);
  scene.add(rimLightR);

  const topLight = new THREE.DirectionalLight(0xffffff, isDark() ? 1.6 : 0.8);
  topLight.position.set(0, 9, 2);
  scene.add(topLight);

  const engineLight = new THREE.PointLight(0x38bdf8, 0, 12);
  engineLight.position.set(0, -1.5, 0);
  scene.add(engineLight);

  // 4. Shared Materials
  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.04,
    metalness: 1.0,
    envMapIntensity: 2.4,
    side: THREE.DoubleSide,
  });

  const { diffuse: paperTexture, bump: paperBumpTexture } = generatePaperTextures();

  const paperFrontMaterial = new THREE.MeshStandardMaterial({
    color: 0xede9e1,
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
    color: 0xcbd5e1,
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
    color: 0x334155,
    transparent: true,
    opacity: 0.85,
  });

  const engineBellMaterial = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.3,
    metalness: 0.9,
  });

  const plumeMaterial = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const corePlumeMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
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
  let typography: ReturnType<typeof create3D404Typography> | null = null;
  if (codeContainer) {
    typography = create3D404Typography(
      chromeMaterial,
      [paperFrontMaterial, paperSideMaterial],
      paperCodeCreaseMaterial
    );
    if (typography.chromeGroup && typography.paperGroup) {
      typography.chromeGroup.visible = isDark();
      typography.paperGroup.visible = !isDark();
    }
    scene.add(typography.code404Group);
  }

  // 7. Background 2D Canvas Starfield
  let starfieldEngine: StarfieldEngine | null = null;
  if (starfieldCanvas) {
    starfieldEngine = new StarfieldEngine(starfieldCanvas, 320);
  }

  // 8. Foreground Floating Space Motes
  const starCount = 30;
  const starGeo = new THREE.BufferGeometry();
  const starPositions = new Float32Array(starCount * 3);
  const starSpeeds = new Float32Array(starCount);

  for (let i = 0; i < starCount; i++) {
    starPositions[i * 3] = (Math.random() - 0.5) * 14;
    starPositions[i * 3 + 1] = (Math.random() - 0.5) * 10;
    starPositions[i * 3 + 2] = (Math.random() - 0.5) * 8;
    starSpeeds[i] = 0.002 + Math.random() * 0.005;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

  const starMaterial = new THREE.PointsMaterial({
    color: isDark() ? 0x93c5fd : 0x64748b,
    size: 0.055,
    transparent: true,
    opacity: 0.4,
  });
  const starField = new THREE.Points(starGeo, starMaterial);
  scene.add(starField);

  // 9. Coordinate Projection & Dynamic Scaling
  function getElementWorldPos(element: HTMLElement, targetZ = 0): THREE.Vector3 {
    const rect = element.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const ndcX = (cx / window.innerWidth) * 2 - 1;
    const ndcY = -(cy / window.innerHeight) * 2 + 1;

    const vH = 2 * (camera.position.z - targetZ) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const vW = vH * (window.innerWidth / window.innerHeight);
    return new THREE.Vector3(ndcX * (vW / 2), ndcY * (vH / 2), targetZ);
  }

  let homePos = new THREE.Vector3(2.5, 0, 0);
  let codePos = new THREE.Vector3(-2.5, 1.0, 0);
  let starshipScaleFactor = 0.55;
  let isFlightActive = false;
  let flightStartTime = 0;
  let flightCurve: THREE.CatmullRomCurve3 | null = null;

  // Attitude Aiming & Theme Duality
  const upVector = new THREE.Vector3(0, 1, 0);
  const starshipDefaultAim = new THREE.Vector3(0.04, 0.98, 0.18).normalize();

  function getSearchButtonAim(): { forward: THREE.Vector3; quat: THREE.Quaternion } {
    const searchBtn =
      document.querySelector<HTMLElement>('.not-found-actions a[href*="search"]') ||
      document.querySelector<HTMLElement>('.not-found-actions');
    let targetPos = new THREE.Vector3(-2.2, -1.1, 0);
    if (searchBtn && camera) {
      targetPos = getElementWorldPos(searchBtn, 0);
    }
    const f = new THREE.Vector3().subVectors(targetPos, homePos);
    // Slight forward Z tilt (+0.12) to give rich 3D perspective to the glide
    f.z = 0.12;
    f.normalize();

    // Natural glide attitude: World Up [0, 1, 0] banked -20° so both the top wings
    // and the bottom folding keel/underside are clearly visible in 3D perspective
    const quat = makeAttitude([f.x, f.y, f.z], [0, 1, 0], -20);
    return { forward: f, quat };
  }

  function getActiveDefaultAttitude(): { forward: THREE.Vector3; quat: THREE.Quaternion } {
    if (isDark()) {
      return {
        forward: starshipDefaultAim.clone(),
        quat: new THREE.Quaternion().setFromUnitVectors(upVector, starshipDefaultAim),
      };
    }
    return getSearchButtonAim();
  }

  const targetQuat = getActiveDefaultAttitude().quat.clone();

  function updateTargetPositions() {
    if (container && camera) {
      homePos = getElementWorldPos(container, 0);
    }
    if (!isDark() && !isFlightActive) {
      targetQuat.copy(getSearchButtonAim().quat);
      starshipGroup.quaternion.copy(targetQuat);
    }
    if (codeContainer && camera) {
      const codeRect = codeContainer.getBoundingClientRect();
      const codeCy = codeRect.top + codeRect.height / 2;

      let cx = codeRect.left + codeRect.width / 2;
      if (titleEl) {
        const titleRect = titleEl.getBoundingClientRect();
        if (titleRect.width > 30) {
          cx = titleRect.left + titleRect.width / 2;
        }
      }

      const ndcX = (cx / window.innerWidth) * 2 - 1;
      const ndcY = -(codeCy / window.innerHeight) * 2 + 1;
      const vH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const vW = vH * (window.innerWidth / window.innerHeight);
      codePos = new THREE.Vector3(ndcX * (vW / 2), ndcY * (vH / 2), 0);
    }
  }

  function updateScales() {
    if (!camera) return;
    const vH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const unitsPerPixel = vH / window.innerHeight;

    if (codeContainer && typography) {
      let targetCodeWidthPx = Math.min(codeContainer.clientWidth * 0.95, 270);
      if (titleEl) {
        const titleRect = titleEl.getBoundingClientRect();
        if (titleRect.width > 50) {
          targetCodeWidthPx = Math.min(titleRect.width * 0.95, 270);
        }
      }
      const targetCodeWidthUnits = targetCodeWidthPx * unitsPerPixel;
      const codeScale = targetCodeWidthUnits / 3.2;
      typography.code404Group.scale.set(codeScale, codeScale, codeScale);
    }

    if (container && starshipGroup) {
      const targetShipHeightPx = Math.min(container.clientHeight * 0.75, 360);
      const targetShipHeightUnits = targetShipHeightPx * unitsPerPixel;
      const shipScale = targetShipHeightUnits / 4.2;
      starshipScaleFactor = shipScale;
      if (!isFlightActive) {
        starshipGroup.scale.set(shipScale, shipScale, shipScale);
      }
    }
  }

  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w > 0 && h > 0) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      starfieldEngine?.resize(w, h);
      updateTargetPositions();
      updateScales();
    }
  }

  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('scroll', updateTargetPositions, { passive: true });

  updateTargetPositions();
  updateScales();
  starshipGroup.position.copy(homePos);
  if (typography) {
    typography.code404Group.position.copy(codePos);
  }

  // 10. Mouse Cursor Attitude Aiming
  let windowMouseX = 0.5;
  let windowMouseY = 0.5;

  function updateAimAtCursor(clientX: number, clientY: number) {
    if (isFlightActive || !camera) return;

    const ndcX = (clientX / window.innerWidth) * 2 - 1;
    const ndcY = -(clientY / window.innerHeight) * 2 + 1;

    const vH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const vW = vH * (window.innerWidth / window.innerHeight);
    const mouseWorldX = ndcX * (vW / 2);
    const mouseWorldY = ndcY * (vH / 2);

    const dx = mouseWorldX - homePos.x;
    const dy = mouseWorldY - homePos.y;
    const dist = Math.hypot(dx, dy);

    if (isDark()) {
      const zDepth = Math.max(0.35, Math.min(1.1, 0.35 + dist * 0.12));
      const aimDir = new THREE.Vector3(dx, dy, zDepth).normalize();
      const blend = THREE.MathUtils.clamp((dist - 0.4) / 0.8, 0, 1);
      const finalDir = new THREE.Vector3().lerpVectors(starshipDefaultAim, aimDir, blend).normalize();
      targetQuat.setFromUnitVectors(upVector, finalDir);
    } else {
      const searchAim = getSearchButtonAim();
      const zDepth = Math.max(0.05, Math.min(0.40, 0.10 + dist * 0.05));
      const aimDir = new THREE.Vector3(dx, dy, zDepth).normalize();
      const blend = THREE.MathUtils.clamp((dist - 0.3) / 1.0, 0, 1);
      const finalDir = new THREE.Vector3().lerpVectors(searchAim.forward, aimDir, blend * 0.55).normalize();
      targetQuat.copy(makeAttitude([finalDir.x, finalDir.y, finalDir.z], [0, 1, 0], -20));
    }
  }

  // 11. Theme Synchronization
  function updateThemeColors() {
    const dark = isDark();
    chromeMaterial.color.setHex(0xe2e8f0);
    chromeMaterial.roughness = 0.04;
    chromeMaterial.metalness = 1.0;
    chromeMaterial.envMapIntensity = 2.4;
    starMaterial.color.setHex(dark ? 0x7dd3fc : 0x94a3b8);

    // 404 Typography: Chrome in Dark Mode, Archival Papercraft in Light Mode
    if (typography?.chromeGroup && typography?.paperGroup) {
      typography.chromeGroup.visible = dark;
      typography.paperGroup.visible = !dark;
    }

    ambientLight.intensity = dark ? 1.4 : 0.65;
    keyLight.intensity = dark ? 2.8 : 2.4;
    fillLight.intensity = dark ? 2.0 : 0.85;
    rimLightL.color.setHex(dark ? 0x38bdf8 : 0xf8fafc);
    rimLightL.intensity = dark ? 2.4 : 0.6;
    rimLightR.intensity = dark ? 2.2 : 0.6;
    topLight.intensity = dark ? 1.6 : 0.8;

    // Vessel Duality
    rocketVessel.rocketGroup.visible = dark;
    paperVessel.paperPlaneGroup.visible = !dark;
    rocketVessel.plumeGroup.visible = dark;
    if (engineLight) engineLight.intensity = 0;

    // Contextual rest orientation: Starship upright vs Paper Plane aimed at Search button
    targetQuat.copy(getActiveDefaultAttitude().quat);
    if (!isFlightActive) {
      starshipGroup.quaternion.copy(targetQuat);
    }

    // Contextual Text Updates
    if (hintEl) {
      hintEl.textContent = dark ? 'Click Starship to fly' : 'Click Paper Plane to glide';
    }
    const descEl = document.querySelector<HTMLElement>('.not-found-desc');
    if (descEl) {
      descEl.textContent = dark
        ? 'The URL may be wrong, or the page may have drifted away into the void.'
        : 'The URL may be wrong, or the dispatch caught a breeze and drifted away.';
    }
    if (codeContainer) {
      codeContainer.title = dark
        ? 'Click to launch Starship around 404'
        : 'Click to fly Paper Plane around 404';
    }
  }

  const themeObserver = new MutationObserver(() => updateThemeColors());
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  updateThemeColors();

  function onMouseMove(event: MouseEvent) {
    windowMouseX = event.clientX / window.innerWidth;
    windowMouseY = event.clientY / window.innerHeight;
    updateAimAtCursor(event.clientX, event.clientY);
  }

  window.addEventListener('mousemove', onMouseMove, { passive: true });

  // 12. Flight Triggering & Raycasting
  function triggerFlight() {
    if (isFlightActive) return;
    if (prefersReducedMotion) {
      plumeMaterial.opacity = 0.5;
      setTimeout(() => {
        plumeMaterial.opacity = 0;
      }, 800);
      return;
    }
    isFlightActive = true;
    flightStartTime = performance.now();
    updateTargetPositions();
    flightCurve = buildFlightCurve(homePos);
    if (hintEl) {
      hintEl.style.opacity = '0';
    }
  }

  container.addEventListener('click', triggerFlight);

  const raycaster = new THREE.Raycaster();
  const clickMouse = new THREE.Vector2();

  function onPointerDown(e: MouseEvent) {
    const target = e.target as HTMLElement | null;
    if (target?.closest('a, button, input, select, textarea')) return;

    clickMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    clickMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(clickMouse, camera);

    const hit = raycaster.intersectObjects([starshipGroup], true);
    if (hit.length > 0) {
      triggerFlight();
    }
  }
  window.addEventListener('pointerdown', onPointerDown);

  function onPointerMove(e: MouseEvent) {
    if (isFlightActive) return;
    clickMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    clickMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(clickMouse, camera);

    const hit = raycaster.intersectObjects([starshipGroup], true);
    document.body.style.cursor = hit.length > 0 ? 'pointer' : '';
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  // 13. Main Render Loop
  let animationFrameId: number;
  const startTime = performance.now();
  let lastTime = performance.now();
  let isVisible = true;

  const intersectionObserver = new IntersectionObserver(([entry]) => {
    isVisible = entry.isIntersecting;
  });
  intersectionObserver.observe(container);

  function animate() {
    animationFrameId = requestAnimationFrame(animate);
    if (!isVisible) return;

    const now = performance.now();
    const dt = Math.min((now - lastTime) * 0.001, 0.05);
    lastTime = now;
    const elapsedTime = (now - startTime) * 0.001;

    // Flight state & instantaneous velocity computation
    let flightMotion: FlightMotion = { speedRatio: 0, vx: 0, vy: 0, vz: 0 };
    let uRaw = 0;
    let u = 0;

    if (isFlightActive && flightCurve) {
      const elapsed = (performance.now() - flightStartTime) * 0.001;
      uRaw = elapsed / FLIGHT_DURATION;

      if (uRaw >= 1.0) {
        isFlightActive = false;
        starshipGroup.position.copy(homePos);
        targetQuat.copy(getActiveDefaultAttitude().quat);
        starshipGroup.quaternion.copy(targetQuat);
        plumeMaterial.opacity = 0;
        corePlumeMaterial.opacity = 0;
        engineLight.intensity = 0;
        rocketVessel.flaps.fwdLeftPivot.rotation.y = 0;
        rocketVessel.flaps.fwdRightPivot.rotation.y = 0;
        rocketVessel.flaps.aftLeftPivot.rotation.y = 0;
        rocketVessel.flaps.aftRightPivot.rotation.y = 0;
        paperVessel.paperPlaneGroup.rotation.set(0, 0, 0);
        starshipGroup.scale.set(starshipScaleFactor, starshipScaleFactor, starshipScaleFactor);
        if (hintEl) {
          hintEl.style.opacity = '';
        }
      } else {
        u = computeFlightProgress(uRaw);
        const vel = computeFlightVelocity(flightCurve, uRaw, FLIGHT_DURATION);
        flightMotion = {
          speedRatio: vel.speedRatio,
          warpRatio: vel.warpRatio,
          speed: vel.speed,
          vx: vel.velocity.x,
          vy: vel.velocity.y,
          vz: vel.velocity.z,
          isOutbound: vel.isOutbound,
        };
      }
    }

    // 2D Canvas Starfield (speed and lateral turn parallax synchronized with vessel travel)
    starfieldEngine?.render(dt, windowMouseX, windowMouseY, flightMotion, prefersReducedMotion, isDark());

    // Foreground Space Motes (drift rate and lateral parallax synchronized with vessel travel)
    if (starField) {
      const positions = starGeo.attributes.position.array as Float32Array;
      const warpRatio = flightMotion.warpRatio ?? flightMotion.speedRatio;
      const flightMult = 1.0 + 7.0 * warpRatio;
      const moteRate = (prefersReducedMotion ? 0.06 : 0.28) * flightMult;
      const lateralShift = -(flightMotion.vx ?? 0) * 0.06 * dt;
      for (let i = 0; i < starCount; i++) {
        positions[i * 3 + 2] += (moteRate + starSpeeds[i] * (12 + 20 * warpRatio)) * dt;
        if (flightMotion.speedRatio > 0.05) {
          positions[i * 3] += lateralShift;
        }
        if (positions[i * 3 + 2] > 8.8) {
          positions[i * 3 + 2] = -8.0;
          positions[i * 3] = (Math.random() - 0.5) * 14;
          positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
        }
      }
      starGeo.attributes.position.needsUpdate = true;
    }

    const bob = Math.sin(elapsedTime * 1.2) * 0.03;

    // Acrobatic Flight or Resting Float
    if (isFlightActive && flightCurve) {
      const pos = flightCurve.getPoint(u);
      starshipGroup.position.copy(pos);

      const flightQuat = computeFlightOrientation(flightCurve, u, uRaw, targetQuat, upVector);
      starshipGroup.quaternion.copy(flightQuat);

      // Throttle & Engine Ignition
      const { plumeOpacity, coreOpacity, lightIntensity, plumeScale } = computeThrottle(u, isDark());
      plumeMaterial.opacity = plumeOpacity;
      corePlumeMaterial.opacity = coreOpacity;
      engineLight.intensity = lightIntensity;
      rocketVessel.plumeGroup.scale.set(plumeScale, plumeScale * (1.0 + Math.random() * 0.18), plumeScale);

      // Dynamic aerodynamic deflection during flight
      if (isDark()) {
        const highGFlap = uRaw < 0.92 ? Math.sin(elapsedTime * 6.0) * 0.14 : 0;
        rocketVessel.flaps.fwdLeftPivot.rotation.y = highGFlap;
        rocketVessel.flaps.fwdRightPivot.rotation.y = -highGFlap;
        rocketVessel.flaps.aftLeftPivot.rotation.y = -highGFlap * 0.8;
        rocketVessel.flaps.aftRightPivot.rotation.y = highGFlap * 0.8;
      } else {
        const breeze = uRaw < 0.92 ? Math.sin(elapsedTime * 8.0) * 0.03 : 0;
        paperVessel.paperPlaneGroup.rotation.z = breeze;
      }
    } else {
      // Resting float
      const targetY = homePos.y + bob;
      starshipGroup.position.x += (homePos.x - starshipGroup.position.x) * 0.08;
      starshipGroup.position.y += (targetY - starshipGroup.position.y) * 0.08;
      starshipGroup.position.z += (homePos.z - starshipGroup.position.z) * 0.08;

      if (!prefersReducedMotion) {
        starshipGroup.quaternion.slerp(targetQuat, 0.10);
      }

      rocketVessel.flaps.fwdLeftPivot.rotation.y = 0;
      rocketVessel.flaps.fwdRightPivot.rotation.y = 0;
      rocketVessel.flaps.aftLeftPivot.rotation.y = 0;
      rocketVessel.flaps.aftRightPivot.rotation.y = 0;

      if (paperVessel.paperPlaneGroup.visible && !prefersReducedMotion) {
        paperVessel.paperPlaneGroup.rotation.z = Math.sin(elapsedTime * 2.4) * 0.05;
        paperVessel.paperPlaneGroup.rotation.x = Math.cos(elapsedTime * 1.8) * 0.04;
      } else {
        paperVessel.paperPlaneGroup.rotation.set(0, 0, 0);
      }

      // 404 typography float & tilt
      if (typography) {
        const mouseX = windowMouseX - 0.5;
        const mouseY = windowMouseY - 0.5;
        typography.code404Group.position.set(codePos.x, codePos.y + bob * 0.3, codePos.z);
        if (!prefersReducedMotion) {
          typography.code404Group.rotation.y += (mouseX * 0.35 - typography.code404Group.rotation.y) * 0.06;
          typography.code404Group.rotation.x += (mouseY * 0.25 - typography.code404Group.rotation.x) * 0.06;
        }
      }
    }

    renderer.render(scene, camera);
  }

  animate();

  // 14. Lifecycle Cleanup
  const teardown = () => {
    cancelAnimationFrame(animationFrameId);
    document.body.style.cursor = '';
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', updateTargetPositions);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    container.removeEventListener('click', triggerFlight);
    intersectionObserver.disconnect();
    themeObserver.disconnect();
    pmremGenerator.dispose();
    roomEnv.dispose();
    envTexture.dispose();
    chromeMaterial.dispose();
    paperFrontMaterial.dispose();
    paperSideMaterial.dispose();
    paperCodeCreaseMaterial.dispose();
    paperTexture.dispose();
    paperBumpTexture.dispose();
    engineBellMaterial.dispose();
    plumeMaterial.dispose();
    corePlumeMaterial.dispose();
    starMaterial.dispose();
    starGeo.dispose();
    rocketVessel.dispose();
    paperVessel.dispose();
    typography?.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    document.removeEventListener('astro:before-swap', teardown);
    window.removeEventListener('pagehide', teardown);
  };

  document.addEventListener('astro:before-swap', teardown, { once: true });
  window.addEventListener('pagehide', teardown, { once: true });

  return teardown;
}

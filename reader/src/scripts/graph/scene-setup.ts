/**
 * scene-setup.ts
 *
 * WebGL scene, camera, renderer, OrbitControls, and studio lighting setup
 * for the 3D Interactive Knowledge Graph View.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GRAPH_SCENE_COLORS } from '../../utils/colors';

export interface GraphSceneSetupResult {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  ambientLight: THREE.AmbientLight;
  directionalLight1: THREE.DirectionalLight;
  directionalLight2: THREE.DirectionalLight;
  defaultCameraPosition: THREE.Vector3;
  updateLightingForTheme: (isDarkTheme: boolean) => void;
  resizeViewport: (viewportWidth: number, viewportHeight: number) => void;
  dispose: () => void;
}

/**
 * Initializes Three.js camera, renderer, lighting rig, and OrbitControls for the graph scene.
 */
export function setupGraphScene(
  containerElement: HTMLElement,
  canvasElement: HTMLCanvasElement,
  initialIsDarkTheme: boolean
): GraphSceneSetupResult {
  const scene = new THREE.Scene();

  const viewportAspectRatio =
    containerElement.clientWidth > 0 && containerElement.clientHeight > 0
      ? containerElement.clientWidth / containerElement.clientHeight
      : 1;

  const camera = new THREE.PerspectiveCamera(50, viewportAspectRatio, 1, 3000);
  const defaultCameraPosition = new THREE.Vector3(0, 80, 240);
  camera.position.copy(defaultCameraPosition);

  const renderer = new THREE.WebGLRenderer({
    canvas: canvasElement,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(containerElement.clientWidth, containerElement.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const controls = new OrbitControls(camera, canvasElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 1.0;
  controls.panSpeed = 0.8;
  controls.maxDistance = 600;
  controls.minDistance = 20;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.35;

  const handlePointerDownInteraction = () => {
    controls.autoRotate = false;
  };
  canvasElement.addEventListener('pointerdown', handlePointerDownInteraction);

  const ambientLight = new THREE.AmbientLight(
    0xffffff,
    initialIsDarkTheme ? 1.4 : 1.5
  );
  scene.add(ambientLight);

  const directionalLight1 = new THREE.DirectionalLight(
    0xffffff,
    initialIsDarkTheme ? 1.5 : 1.4
  );
  directionalLight1.position.set(100, 150, 100);
  scene.add(directionalLight1);

  const directionalLight2 = new THREE.DirectionalLight(
    initialIsDarkTheme
      ? GRAPH_SCENE_COLORS.dirLightDark
      : GRAPH_SCENE_COLORS.dirLightLight,
    initialIsDarkTheme ? 1.0 : 0.7
  );
  directionalLight2.position.set(-100, -100, -80);
  scene.add(directionalLight2);

  const updateLightingForTheme = (isDarkTheme: boolean) => {
    ambientLight.intensity = isDarkTheme ? 1.4 : 1.5;
    directionalLight1.intensity = isDarkTheme ? 1.5 : 1.4;
    directionalLight2.color.setHex(
      isDarkTheme
        ? GRAPH_SCENE_COLORS.dirLightDark
        : GRAPH_SCENE_COLORS.dirLightLight
    );
    directionalLight2.intensity = isDarkTheme ? 1.0 : 0.7;
  };

  const resizeViewport = (
    viewportWidth: number,
    viewportHeight: number
  ) => {
    if (viewportWidth === 0 || viewportHeight === 0) return;
    camera.aspect = viewportWidth / viewportHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(viewportWidth, viewportHeight);
  };

  const dispose = () => {
    canvasElement.removeEventListener(
      'pointerdown',
      handlePointerDownInteraction
    );
    controls.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };

  return {
    scene,
    camera,
    renderer,
    controls,
    ambientLight,
    directionalLight1,
    directionalLight2,
    defaultCameraPosition,
    updateLightingForTheme,
    resizeViewport,
    dispose,
  };
}

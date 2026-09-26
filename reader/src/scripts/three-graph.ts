/**
 * three-graph.ts
 *
 * 3D Constellation Knowledge Graph View orchestrator for Substack2Markdown.
 * Renders an interactive 3D universe of articles, topic clusters, and publication hubs.
 * Integrates force-directed physics relaxation, chronological universe expansion scrubbing,
 * reading status synchronization, and detailed cosmic inspection.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  fetchReadingState,
  getReadingStatus,
  READING_STATUS_CHANGE_EVENT,
} from './reading-tracker';
import {
  getNodeReadingColor,
  getNodeTopicColor,
} from '../utils/graph-colors';
import type { GraphData, GraphLink, GraphNode, SimNode, ActiveLink } from './graph/types';
import { createGraphGeometries, createGraphMaterials } from './graph/mesh-factory';
import { showGraphInspector, hideGraphInspector } from './graph/inspector';
import { GraphPhysicsEngine } from './graph/physics';
import { TimelineManager } from './graph/timeline';

export type { GraphData, GraphLink, GraphNode, SimNode };

function isDarkTheme(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

export function initThreeGraph(): (() => void) | null {
  const containerEl = document.querySelector<HTMLElement>('[data-graph-container]');
  if (!containerEl) return null;

  const dataEl =
    document.getElementById('graph-data-payload') ||
    document.getElementById('graph-data');
  if (!dataEl || !dataEl.textContent) return null;

  let graphData: GraphData;
  try {
    graphData = JSON.parse(dataEl.textContent);
  } catch (err) {
    console.error('Failed to parse graph JSON data:', err);
    return null;
  }

  const canvasEl = containerEl.querySelector<HTMLCanvasElement>('[data-graph-canvas]');
  if (!canvasEl) return null;

  const container = containerEl;
  const canvas = canvasEl;

  // 1. Scene & Camera Setup
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
    0.1,
    2000
  );
  const defaultCameraPos = new THREE.Vector3(0, 45, 230);
  camera.position.copy(defaultCameraPos);
  camera.lookAt(0, 0, 0);

  // 2. WebGL Renderer
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);

  // 3. Orbit Controls
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 1.0;
  controls.panSpeed = 0.8;
  controls.maxDistance = 600;
  controls.minDistance = 20;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.35;

  const onPointerDown = () => {
    controls.autoRotate = false;
  };
  canvas.addEventListener('pointerdown', onPointerDown);

  // 4. Lighting: Architectural studio illumination for light paper, neon nebula for dark space
  const ambientLight = new THREE.AmbientLight(0xffffff, isDarkTheme() ? 1.4 : 1.5);
  scene.add(ambientLight);

  const dirLight1 = new THREE.DirectionalLight(0xffffff, isDarkTheme() ? 1.5 : 1.4);
  dirLight1.position.set(100, 150, 100);
  scene.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(
    isDarkTheme() ? 0x38bdf8 : 0xe2e8f0,
    isDarkTheme() ? 1.0 : 0.7
  );
  dirLight2.position.set(-100, -100, -80);
  scene.add(dirLight2);

  // 5. Geometries & Materials
  const geometries = createGraphGeometries();
  const materials = createGraphMaterials(isDarkTheme());

  const stars = new THREE.Points(geometries.starGeo, materials.starMat);
  stars.visible = isDarkTheme();
  scene.add(stars);

  // 6. Nodes & Initial Spherical Fibonacci Distribution
  const nodeMap = new Map<string, SimNode>();
  const nodeIndices = new Map<string, number>();
  let colorMode: 'topic' | 'reading' = 'topic';
  const showAuthorHubs = true;

  const nodesGroup = new THREE.Group();
  scene.add(nodesGroup);

  const nodeMeshes: THREE.Mesh[] = [];
  const nodes = graphData.nodes as SimNode[];

  nodes.forEach((node, i) => {
    nodeIndices.set(node.id, i);
    nodeMap.set(node.id, node);

    // Initial placement in 3D spherical volume with breathing room
    const clamped = Math.max(
      -1,
      Math.min(1, -1 + (2 * (i + 0.5)) / Math.max(1, nodes.length))
    );
    const phi = Math.acos(clamped);
    const theta = Math.sqrt(nodes.length * Math.PI) * phi;
    let radius = 130 + (i % 30) * 3.5;
    if (node.type === 'author') radius = 45;
    else if (node.type === 'tag') radius = 85 + (i % 15) * 2.5;

    node.x = Number.isFinite(radius * Math.cos(theta) * Math.sin(phi))
      ? radius * Math.cos(theta) * Math.sin(phi)
      : 0;
    node.y = Number.isFinite(radius * Math.sin(theta) * Math.sin(phi))
      ? radius * Math.sin(theta) * Math.sin(phi)
      : 0;
    node.z = Number.isFinite(radius * Math.cos(phi)) ? radius * Math.cos(phi) : 0;
    node.vx = 0;
    node.vy = 0;
    node.vz = 0;

    const isDark = isDarkTheme();
    const geo = geometries.getNodeGeo(node, isDark);
    const initialColor =
      colorMode === 'topic' ? getNodeTopicColor(node, isDark) : getNodeReadingColor(node, isDark);

    const mat = new THREE.MeshStandardMaterial({
      color: initialColor,
      roughness: isDark ? 0.25 : 0.38,
      metalness: isDark ? 0.1 : 0.02,
      emissive: isDark ? initialColor : 0x000000,
      emissiveIntensity: isDark ? 0.35 : 0.0,
      transparent: true,
      opacity: isDark ? 0.94 : 0.96,
    });

    // Hierarchical Scale: Planet (Largest) > Star (Medium) > Asteroid (Smallest)
    const baseScale =
      node.type === 'author'
        ? 2.2
        : node.type === 'tag'
          ? Math.max(1.3, Math.min(1.8, (node.val || 3.0) / 2.5))
          : 0.85;

    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(baseScale, baseScale, baseScale);
    mesh.position.set(node.x, node.y, node.z);
    mesh.userData = { node, originalColor: initialColor, index: i, baseScale };
    mesh.visible = true;
    nodesGroup.add(mesh);
    nodeMeshes.push(mesh);
  });

  // 7. Edges & Links Geometry
  const validLinks: ActiveLink[] = [];
  graphData.links.forEach((link) => {
    const sIdx = nodeIndices.get(link.source);
    const tIdx = nodeIndices.get(link.target);
    if (sIdx !== undefined && tIdx !== undefined) {
      validLinks.push({ sourceIdx: sIdx, targetIdx: tIdx, type: link.type, weight: link.weight });
    }
  });

  const linkPositions = new Float32Array(validLinks.length * 6);
  const linkGeometry = new THREE.BufferGeometry();
  linkGeometry.setAttribute('position', new THREE.BufferAttribute(linkPositions, 3));
  const linkLines = new THREE.LineSegments(linkGeometry, materials.linkMaterial);
  scene.add(linkLines);

  const maxActiveLinks = 256;
  const activeLinkPositions = new Float32Array(maxActiveLinks * 6);
  const activeLinkGeometry = new THREE.BufferGeometry();
  activeLinkGeometry.setAttribute('position', new THREE.BufferAttribute(activeLinkPositions, 3));
  const activeLinkLines = new THREE.LineSegments(activeLinkGeometry, materials.activeLinkMaterial);
  activeLinkLines.visible = false;
  scene.add(activeLinkLines);

  // 8. Physics Engine & Pre-warm
  let currentHighlightedIdx: number | null = null;
  const physics = new GraphPhysicsEngine(
    nodes,
    validLinks,
    nodeMeshes,
    linkGeometry,
    activeLinkGeometry,
    { showAuthorHubs, maxActiveLinks }
  );

  // Pre-warm 55 ticks synchronously so the initial frame has formed relaxed clusters
  physics.prewarm(55);

  // 9. Timeline Manager
  const timeline = new TimelineManager(nodes);

  // 10. Raycasting & Interaction
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points = { threshold: 2.0 };
  const mouse = new THREE.Vector2(-999, -999);
  let hoveredMesh: THREE.Mesh | null = null;
  let selectedMesh: THREE.Mesh | null = null;

  let targetCameraPos: THREE.Vector3 | null = null;
  let targetControlsTarget: THREE.Vector3 | null = null;

  const tooltip = container.querySelector<HTMLElement>('[data-graph-tooltip]');
  const tooltipTitle = container.querySelector<HTMLElement>('[data-tooltip-title]');
  const tooltipSub = container.querySelector<HTMLElement>('[data-tooltip-sub]');
  const inspectorClose = container.querySelector<HTMLElement>('[data-inspector-close]');

  const legendTopics = container.querySelector<HTMLElement>('[data-legend-topics]');
  const legendReading = container.querySelector<HTMLElement>('[data-legend-reading]');

  let activeFilter: string = 'all';

  function resetMeshHighlights() {
    currentHighlightedIdx = null;
    activeLinkLines.visible = false;
    const dark = isDarkTheme();
    materials.linkMaterial.opacity = dark ? 0.1 : 0.22;

    nodeMeshes.forEach((m) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      const baseScale = (m.userData.baseScale as number) || 1.0;
      mat.opacity = dark ? 0.94 : 0.96;
      mat.emissiveIntensity = dark ? 0.35 : 0.0;
      m.scale.set(baseScale, baseScale, baseScale);
    });
    applyVisibility();
  }

  function highlightNeighbors(targetIdx: number) {
    currentHighlightedIdx = targetIdx;
    const neighborIndices = new Set<number>([targetIdx]);
    let activeCount = 0;
    const activePos = activeLinkGeometry.attributes.position.array as Float32Array;

    validLinks.forEach((link) => {
      if (!showAuthorHubs && link.type === 'author') return;
      const aMesh = nodeMeshes[link.sourceIdx];
      const bMesh = nodeMeshes[link.targetIdx];
      if (!aMesh?.visible || !bMesh?.visible) return;
      if (link.sourceIdx === targetIdx || link.targetIdx === targetIdx) {
        neighborIndices.add(link.sourceIdx);
        neighborIndices.add(link.targetIdx);
        if (activeCount < maxActiveLinks) {
          const a = nodes[link.sourceIdx];
          const b = nodes[link.targetIdx];
          const off = activeCount * 6;
          activePos[off] = Number.isFinite(a.x) ? a.x : 0;
          activePos[off + 1] = Number.isFinite(a.y) ? a.y : 0;
          activePos[off + 2] = Number.isFinite(a.z) ? a.z : 0;
          activePos[off + 3] = Number.isFinite(b.x) ? b.x : 0;
          activePos[off + 4] = Number.isFinite(b.y) ? b.y : 0;
          activePos[off + 5] = Number.isFinite(b.z) ? b.z : 0;
          activeCount++;
        }
      }
    });

    activeLinkGeometry.setDrawRange(0, activeCount * 2);
    activeLinkGeometry.attributes.position.needsUpdate = true;
    activeLinkLines.visible = true;

    // Dim background web
    const dark = isDarkTheme();
    materials.linkMaterial.opacity = dark ? 0.015 : 0.04;

    // Highlight target and immediate neighbors; dim unrelated stars
    nodeMeshes.forEach((m, i) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      const baseScale = (m.userData.baseScale as number) || 1.0;
      if (i === targetIdx) {
        mat.opacity = 1.0;
        mat.emissiveIntensity = dark ? 0.9 : 0.25;
        m.scale.set(baseScale * 2.4, baseScale * 2.4, baseScale * 2.4);
      } else if (neighborIndices.has(i)) {
        mat.opacity = 0.95;
        mat.emissiveIntensity = dark ? 0.6 : 0.12;
        m.scale.set(baseScale * 1.5, baseScale * 1.5, baseScale * 1.5);
      } else {
        mat.opacity = dark ? 0.06 : 0.12;
        mat.emissiveIntensity = 0.0;
        m.scale.set(baseScale * 0.55, baseScale * 0.55, baseScale * 0.55);
      }
    });
  }

  const onInspectorClose = () => {
    hideGraphInspector(container);
    selectedMesh = null;
    resetMeshHighlights();
  };
  inspectorClose?.addEventListener('click', onInspectorClose);

  function onPointerMove(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    if (tooltip) {
      tooltip.style.left = `${e.clientX - rect.left}px`;
      tooltip.style.top = `${e.clientY - rect.top}px`;
    }
  }
  canvas.addEventListener('pointermove', onPointerMove, { passive: true });

  function onCanvasClick() {
    raycaster.setFromCamera(mouse, camera);
    const visibleMeshes = nodeMeshes.filter((m) => m.visible);
    const intersects = raycaster.intersectObjects(visibleMeshes);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object as THREE.Mesh;
      const node = hitMesh.userData.node as GraphNode;
      selectedMesh = hitMesh;

      highlightNeighbors(hitMesh.userData.index);
      showGraphInspector(container, node, nodes);

      const nodePos = hitMesh.position;
      targetControlsTarget = nodePos.clone();
      const offset = camera.position.clone().sub(controls.target).normalize().multiplyScalar(45);
      targetCameraPos = nodePos.clone().add(offset);
    } else {
      selectedMesh = null;
      resetMeshHighlights();
      tooltip?.classList.remove('visible');
      hideGraphInspector(container);
    }
  }
  canvas.addEventListener('click', onCanvasClick);

  // 11. Timeline Controls
  const timelineSlider = container.querySelector<HTMLInputElement>('[data-timeline-slider]');
  const timelinePlayBtn = container.querySelector<HTMLButtonElement>('[data-timeline-play-btn]');
  const timelineSpeedBtn = container.querySelector<HTMLButtonElement>('[data-timeline-speed-btn]');
  const timelinePresentBtn = container.querySelector<HTMLButtonElement>('[data-timeline-present-btn]');

  function applyVisibility() {
    const searchEl = container.querySelector<HTMLInputElement>('[data-graph-search]');
    const q = searchEl?.value.trim().toLowerCase() || '';
    const isPresent = timeline.isPresent();
    const cutoffTime = timeline.getCutoffTime();
    const dark = isDarkTheme();

    let visiblePosts = 0;
    let totalPosts = 0;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const m = nodeMeshes[i];
      const mat = m.material as THREE.MeshStandardMaterial;
      const baseScale = (m.userData.baseScale as number) || 1.0;

      if (node.type === 'post') totalPosts++;

      // 1. Timeline Chronological Cutoff
      const birthTime = timeline.nodeBirthTimestamps[i];
      const isBorn = isPresent || birthTime <= cutoffTime;

      if (node.type === 'post' && isBorn) {
        visiblePosts++;
      }

      if (!isBorn) {
        timeline.wasBorn[i] = 0;
        timeline.activePopAnimations.delete(i);
        m.visible = false;
        m.scale.set(0, 0, 0);
        continue;
      }

      // If becoming born just now, trigger elastic pop
      if (timeline.wasBorn[i] === 0) {
        timeline.wasBorn[i] = 1;
        timeline.activePopAnimations.set(i, {
          startTime: performance.now(),
          duration: 480,
        });
      }
      m.visible = true;

      // 2. Category & Reading Status Filter
      let matchesCategory = true;
      if (activeFilter === 'publications') {
        matchesCategory = node.type === 'author';
      } else if (activeFilter === 'tags') {
        matchesCategory = node.type === 'tag';
      } else if (activeFilter === 'articles') {
        matchesCategory = node.type === 'post';
      } else if (activeFilter.startsWith('status:')) {
        const targetStatus = activeFilter.replace('status:', '');
        matchesCategory = node.type === 'post' && (node.readingStatus || 'unread') === targetStatus;
      }

      // 3. Search Filter
      let matchesSearch = true;
      if (q) {
        const nameMatch = node.name.toLowerCase().includes(q);
        const tagMatch = (node.tags || []).some((t) => t.toLowerCase().includes(q));
        const authorMatch = (node.author || '').toLowerCase().includes(q);
        matchesSearch = nameMatch || tagMatch || authorMatch;
      }

      if (!timeline.activePopAnimations.has(i)) {
        if (matchesCategory && matchesSearch) {
          mat.opacity = dark ? 0.94 : 0.96;
          m.scale.set(baseScale, baseScale, baseScale);
        } else {
          mat.opacity = dark ? 0.05 : 0.08;
          const dimScale = baseScale * 0.55;
          m.scale.set(dimScale, dimScale, dimScale);
        }
      }
    }

    physics.updateLinkEndpoints();
    timeline.updateHUD(container, visiblePosts, totalPosts);
  }

  const onTimelineInput = () => {
    timeline.setPlaying(container, false);
    if (timelineSlider) {
      const val = parseInt(timelineSlider.value, 10);
      timeline.timelineFraction = Math.max(0, Math.min(1, val / 1000));
      applyVisibility();
    }
  };
  timelineSlider?.addEventListener('input', onTimelineInput);

  const onPlayToggle = () => {
    if (timeline.isPlaying) {
      timeline.setPlaying(container, false);
    } else {
      if (timeline.timelineFraction >= 0.999) {
        timeline.timelineFraction = 0.0;
        if (timelineSlider) timelineSlider.value = '0';
      }
      timeline.setPlaying(container, true);
      timeline.lastTimelineTime = performance.now();
    }
  };
  timelinePlayBtn?.addEventListener('click', onPlayToggle);

  const onSpeedClick = () => {
    timeline.cycleSpeed(container);
  };
  timelineSpeedBtn?.addEventListener('click', onSpeedClick);

  const onPresentClick = () => {
    timeline.setPlaying(container, false);
    timeline.timelineFraction = 1.0;
    if (timelineSlider) timelineSlider.value = '1000';
    applyVisibility();
  };
  timelinePresentBtn?.addEventListener('click', onPresentClick);

  // 12. Search & Filter Controls
  const searchInput = container.querySelector<HTMLInputElement>('[data-graph-search]');
  const onSearchInput = () => {
    applyVisibility();
  };
  searchInput?.addEventListener('input', onSearchInput);

  const filterButtons = container.querySelectorAll<HTMLButtonElement>('[data-filter]');
  const onFilterClick = (btn: HTMLButtonElement) => {
    const parentGroup = btn.closest('.graph-filter-mode-group');
    if (parentGroup) {
      parentGroup.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) => b.classList.remove('active'));
    } else {
      filterButtons.forEach((b) => b.classList.remove('active'));
    }
    btn.classList.add('active');
    const filterVal = btn.dataset.filter || 'all';
    activeFilter = filterVal;

    nodeMeshes.forEach((m) => {
      const node = m.userData.node as GraphNode;
      const mat = m.material as THREE.MeshStandardMaterial;
      const baseScale = (m.userData.baseScale as number) || 1.0;

      let visible = true;
      if (filterVal === 'publications') {
        visible = node.type === 'author';
      } else if (filterVal === 'tags') {
        visible = node.type === 'tag';
      } else if (filterVal === 'articles') {
        visible = node.type === 'post';
      } else if (filterVal.startsWith('status:')) {
        const targetStatus = filterVal.replace('status:', '');
        visible = node.type === 'post' && (node.readingStatus || 'unread') === targetStatus;
      }

      mat.opacity = visible ? 0.92 : 0.06;
      const scaleMult = visible ? 1.0 : 0.5;
      m.scale.set(baseScale * scaleMult, baseScale * scaleMult, baseScale * scaleMult);
    });

    applyVisibility();
    physics.reheat(0.15);
  };

  const filterListeners: { btn: HTMLButtonElement; fn: () => void }[] = [];
  filterButtons.forEach((btn) => {
    const fn = () => onFilterClick(btn);
    btn.addEventListener('click', fn);
    filterListeners.push({ btn, fn });
  });

  // Color Mode Switcher
  const colorModeBtn = container.querySelector<HTMLButtonElement>('[data-color-mode-btn]');
  const colorModeLabel = container.querySelector<HTMLElement>('[data-color-mode-label]');

  const onColorModeClick = () => {
    colorMode = colorMode === 'topic' ? 'reading' : 'topic';
    const isReading = colorMode === 'reading';

    if (colorModeLabel) {
      colorModeLabel.textContent = isReading ? 'Color: Reading Status' : 'Color: Topics';
    }

    legendTopics?.classList.toggle('hidden', isReading);
    legendReading?.classList.toggle('hidden', !isReading);

    const filtersTopics = container.querySelector('[data-filters-topic]');
    const filtersReading = container.querySelector('[data-filters-reading]');
    filtersTopics?.classList.toggle('hidden', isReading);
    filtersReading?.classList.toggle('hidden', !isReading);

    const activeGroup = isReading ? filtersReading : filtersTopics;
    const allBtn = activeGroup?.querySelector<HTMLButtonElement>('[data-filter="all"]');
    if (allBtn) {
      onFilterClick(allBtn);
    }

    nodeMeshes.forEach((m) => {
      const node = m.userData.node as GraphNode;
      const dark = isDarkTheme();
      const newColor =
        colorMode === 'topic' ? getNodeTopicColor(node, dark) : getNodeReadingColor(node, dark);
      m.userData.originalColor = newColor;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.color.setHex(newColor);
      mat.emissive.setHex(dark ? newColor : 0x000000);
      mat.emissiveIntensity = dark ? 0.35 : 0.0;
    });
  };
  colorModeBtn?.addEventListener('click', onColorModeClick);

  // Reset Camera Button
  const resetCameraBtn = container.querySelector<HTMLButtonElement>('[data-reset-camera-btn]');
  const onResetCameraClick = () => {
    targetCameraPos = defaultCameraPos.clone();
    targetControlsTarget = new THREE.Vector3(0, 0, 0);
    controls.autoRotate = true;
    resetMeshHighlights();
    hideGraphInspector(container);
  };
  resetCameraBtn?.addEventListener('click', onResetCameraClick);

  // 13. Theme Changes Observer
  function updateTheme() {
    const dark = isDarkTheme();
    materials.linkMaterial.color.setHex(dark ? 0x334155 : 0xcbd5e1);

    ambientLight.intensity = dark ? 1.4 : 1.5;
    dirLight1.intensity = dark ? 1.5 : 1.4;
    dirLight2.color.setHex(dark ? 0x38bdf8 : 0xe2e8f0);
    dirLight2.intensity = dark ? 1.0 : 0.7;

    stars.visible = dark;

    materials.linkMaterial.color.setHex(dark ? 0x334155 : 0x94a3b8);
    materials.linkMaterial.opacity =
      currentHighlightedIdx !== null
        ? (dark ? 0.015 : 0.04)
        : (dark ? 0.1 : 0.22);
    materials.activeLinkMaterial.color.setHex(dark ? 0x38bdf8 : 0x0284c7);

    if (colorMode === 'reading') {
      nodeMeshes.forEach((m) => {
        const node = m.userData.node as GraphNode;
        const color = getNodeReadingColor(node, dark);
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.color.setHex(color);
        mat.emissive.setHex(color);
      });
    }

    nodeMeshes.forEach((m) => {
      const node = m.userData.node as GraphNode;
      const color =
        colorMode === 'topic' ? getNodeTopicColor(node, dark) : getNodeReadingColor(node, dark);
      m.userData.originalColor = color;
      m.geometry = geometries.getNodeGeo(node, dark);
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.color.setHex(color);
      mat.roughness = dark ? 0.25 : 0.35;
      mat.metalness = dark ? 0.1 : 0.02;
      mat.emissive.setHex(dark ? color : 0x000000);
      mat.emissiveIntensity = dark ? 0.35 : 0.0;
      mat.opacity = dark ? 0.94 : 0.96;
    });

    // Option 3: The Knowledge Dendrogram / Intellectual Evolution Adaptive Nomenclature & Shapes
    const timelineTitle = container.querySelector<HTMLElement>('[data-timeline-title]');
    if (timelineTitle) {
      timelineTitle.textContent = dark ? 'Universe Expansion' : 'Knowledge Evolution';
    }

    const legendAuthor = container.querySelector<HTMLElement>('[data-legend-label="author"]');
    if (legendAuthor) {
      legendAuthor.textContent = dark ? 'Publication (Planet)' : 'Publication (Core Hub)';
    }

    const legendTag = container.querySelector<HTMLElement>('[data-legend-label="tag"]');
    if (legendTag) {
      legendTag.textContent = dark ? 'Topic (Star)' : 'Topic (Subject Diamond)';
    }

    const legendPost = container.querySelector<HTMLElement>('[data-legend-label="post"]');
    if (legendPost) {
      legendPost.textContent = dark ? 'Article (Asteroid)' : 'Article (Document Folio)';
    }

    if (timelinePresentBtn) {
      timelinePresentBtn.title = dark ? 'Reset to Present (Full Cosmos)' : 'Reset to Full Network';
    }
  }

  const themeObserver = new MutationObserver(() => updateTheme());
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  updateTheme();

  // 14. Reading State Sync
  function syncReadingState() {
    nodeMeshes.forEach((mesh) => {
      const node = mesh.userData.node as GraphNode;
      if (node.type !== 'post') return;

      const slug = node.postId || node.id.replace(/^post:/, '');
      const clientStatus = getReadingStatus(slug);
      if (clientStatus === 'completed') {
        node.readingStatus = 'completed';
      } else if (clientStatus === 'in-progress') {
        node.readingStatus = 'in-progress';
      } else if (clientStatus === 'pending') {
        node.readingStatus = 'pending';
      } else {
        node.readingStatus = 'unread';
      }

      if (colorMode === 'reading') {
        const newColor = getNodeReadingColor(node, isDarkTheme());
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color.setHex(newColor);
        mat.emissive.setHex(newColor);
      }
    });

    if (selectedMesh) {
      const activeNode = selectedMesh.userData.node as GraphNode;
      showGraphInspector(container, activeNode, nodes);
    }
  }

  syncReadingState();
  fetchReadingState().then(() => {
    syncReadingState();
  });

  const onReadingStatusChanged = () => {
    syncReadingState();
  };
  window.addEventListener(READING_STATUS_CHANGE_EVENT, onReadingStatusChanged);

  // 15. Responsive Resize
  function onResize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container);

  // 16. Animation Loop
  let animationFrameId: number;
  let isVisible = true;

  const intersectionObserver = new IntersectionObserver(([entry]) => {
    isVisible = entry.isIntersecting;
  });
  intersectionObserver.observe(container);

  function animate() {
    animationFrameId = requestAnimationFrame(animate);
    if (!isVisible) return;

    const now = performance.now();
    const dt = Math.min(100, now - timeline.lastTimelineTime);
    timeline.lastTimelineTime = now;

    if (timeline.isPlaying) {
      const fullDuration = 18000 / timeline.playbackSpeed;
      timeline.timelineFraction += dt / fullDuration;
      if (timeline.timelineFraction >= 1.0) {
        timeline.timelineFraction = 1.0;
        timeline.setPlaying(container, false);
      }
      if (timelineSlider) {
        timelineSlider.value = String(Math.round(timeline.timelineFraction * 1000));
      }
      applyVisibility();
    }

    timeline.updatePopAnimations(now, nodeMeshes, isDarkTheme());

    physics.step(currentHighlightedIdx);

    // Planetary rotation
    for (let i = 0; i < nodes.length; i++) {
      if (!nodeMeshes[i].visible) continue;
      const type = nodes[i].type;
      if (type === 'author') {
        nodeMeshes[i].rotation.y += 0.008;
        nodeMeshes[i].rotation.z += 0.002;
      } else if (type === 'post') {
        nodeMeshes[i].rotation.x += 0.006;
        nodeMeshes[i].rotation.y += 0.009;
      } else if (type === 'tag') {
        nodeMeshes[i].rotation.y += 0.004;
      }
    }

    if (targetCameraPos && targetControlsTarget) {
      camera.position.lerp(targetCameraPos, 0.08);
      controls.target.lerp(targetControlsTarget, 0.08);
      if (camera.position.distanceTo(targetCameraPos) < 1.0) {
        targetCameraPos = null;
        targetControlsTarget = null;
      }
    }

    controls.update();

    // Hover Raycasting
    raycaster.setFromCamera(mouse, camera);
    const visibleMeshes = nodeMeshes.filter((m) => m.visible);
    const intersects = raycaster.intersectObjects(visibleMeshes);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object as THREE.Mesh;
      if (hitMesh !== hoveredMesh) {
        hoveredMesh = hitMesh;
        canvas.style.cursor = 'pointer';

        if (!selectedMesh) {
          highlightNeighbors(hitMesh.userData.index);
        }

        const node = hitMesh.userData.node as GraphNode;
        if (tooltip && tooltipTitle && tooltipSub) {
          tooltipTitle.textContent = node.name;
          tooltipSub.textContent =
            node.type === 'post'
              ? `${node.author || 'Essay'} • ${node.readingTime || 5} min read`
              : node.type === 'tag'
                ? 'Topic Hub'
                : 'Publication';
          tooltip.classList.add('visible');
        }
      }
    } else {
      if (hoveredMesh) {
        hoveredMesh = null;
        canvas.style.cursor = 'grab';
        tooltip?.classList.remove('visible');

        if (!selectedMesh) {
          resetMeshHighlights();
        }
      }
    }

    renderer.render(scene, camera);
  }

  applyVisibility();
  animate();

  // 17. Programmatic API attached to window for automated testing and scripting
  (window as any).__threeGraph = {
    camera,
    controls,
    scene,
    nodes,
    nodeMeshes,
    timeline,
    physics,
    setTimelineFraction: (fraction: number) => {
      timeline.setPlaying(container, false);
      timeline.timelineFraction = Math.max(0, Math.min(1, fraction));
      if (timelineSlider) timelineSlider.value = String(Math.round(timeline.timelineFraction * 1000));
      applyVisibility();
    },
    playTimeline: () => {
      if (timeline.timelineFraction >= 0.999) timeline.timelineFraction = 0.0;
      timeline.setPlaying(container, true);
      timeline.lastTimelineTime = performance.now();
    },
    pauseTimeline: () => {
      timeline.setPlaying(container, false);
    },
    focusNode: (target: string) => {
      const idx = nodes.findIndex(
        (n) =>
          n.id.toLowerCase() === target.toLowerCase() ||
          n.name.toLowerCase() === target.toLowerCase() ||
          (n.author && n.author.toLowerCase() === target.toLowerCase())
      );
      if (idx !== -1) {
        const hitMesh = nodeMeshes[idx];
        selectedMesh = hitMesh;
        highlightNeighbors(idx);
        showGraphInspector(container, nodes[idx], nodes);
        const nodePos = hitMesh.position;
        targetControlsTarget = nodePos.clone();
        const offset = camera.position.clone().sub(controls.target).normalize().multiplyScalar(40);
        targetCameraPos = nodePos.clone().add(offset);
      }
    },
  };

  // 18. Teardown & Lifecycle Disposal
  let isDisposed = false;
  const teardown = () => {
    if (isDisposed) return;
    isDisposed = true;

    timeline.setPlaying(container, false);

    try {
      delete (window as any).__threeGraph;
    } catch {
      (window as any).__threeGraph = undefined;
    }

    document.removeEventListener('astro:before-swap', teardown);
    window.removeEventListener('pagehide', teardown);

    cancelAnimationFrame(animationFrameId);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    themeObserver.disconnect();

    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('click', onCanvasClick);
    inspectorClose?.removeEventListener('click', onInspectorClose);
    searchInput?.removeEventListener('input', onSearchInput);
    filterListeners.forEach(({ btn, fn }) => btn.removeEventListener('click', fn));
    colorModeBtn?.removeEventListener('click', onColorModeClick);
    resetCameraBtn?.removeEventListener('click', onResetCameraClick);
    window.removeEventListener(READING_STATUS_CHANGE_EVENT, onReadingStatusChanged);

    timelineSlider?.removeEventListener('input', onTimelineInput);
    timelinePlayBtn?.removeEventListener('click', onPlayToggle);
    timelineSpeedBtn?.removeEventListener('click', onSpeedClick);
    timelinePresentBtn?.removeEventListener('click', onPresentClick);

    // Dispose Geometries & Materials
    geometries.dispose();
    materials.dispose();
    linkGeometry.dispose();
    activeLinkGeometry.dispose();

    nodeMeshes.forEach((m) => {
      if (m.material instanceof THREE.Material) {
        m.material.dispose();
      }
    });

    controls.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    scene.clear();
  };

  document.addEventListener('astro:before-swap', teardown, { once: true });
  window.addEventListener('pagehide', teardown, { once: true });
  return teardown;
}

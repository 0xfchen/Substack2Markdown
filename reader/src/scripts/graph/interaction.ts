/**
 * interaction.ts
 *
 * Raycasting, pointer tracking, hover state, neighbor glow highlighting,
 * and cursor-tracking tooltip management for the 3D Knowledge Graph.
 */

import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GraphNode, SimNode, ActiveLink } from './types';
import { showGraphInspector, hideGraphInspector } from './inspector';
import { GRAPH_SELECTORS } from './selectors';

export interface GraphInteractionContext {
  containerElement: HTMLElement;
  canvasElement: HTMLCanvasElement;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  nodes: SimNode[];
  nodeMeshes: THREE.Mesh[];
  validLinks: ActiveLink[];
  activeLinkLines: THREE.LineSegments;
  activeLinkGeometry: THREE.BufferGeometry;
  linkMaterial: THREE.LineBasicMaterial;
  maxActiveLinks: number;
  isDarkTheme: () => boolean;
  getShowAuthorHubs: () => boolean;
  onResetHighlights: () => void;
  onCameraFocusRequested: (
    targetCameraPosition: THREE.Vector3,
    targetControlsTarget: THREE.Vector3
  ) => void;
}

export interface GraphInteractionManager {
  checkHover: () => void;
  highlightNeighbors: (targetNodeIndex: number) => void;
  resetMeshHighlights: () => void;
  selectNodeByIndex: (targetNodeIndex: number) => void;
  getSelectedMesh: () => THREE.Mesh | null;
  getHoveredMesh: () => THREE.Mesh | null;
  getCurrentHighlightedIndex: () => number | null;
  dispose: () => void;
}

/**
 * Initializes raycasting, hover tooltips, and click interactions for graph nodes.
 */
export function setupGraphInteraction(
  context: GraphInteractionContext
): GraphInteractionManager {
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points = { threshold: 2.0 };
  const mouseCoordinates = new THREE.Vector2(-999, -999);

  let hoveredMeshItem: THREE.Mesh | null = null;
  let selectedMeshItem: THREE.Mesh | null = null;
  let currentHighlightedNodeIndex: number | null = null;

  const tooltipElement = context.containerElement.querySelector<HTMLElement>(
    GRAPH_SELECTORS.tooltip
  );
  const tooltipTitleElement = context.containerElement.querySelector<HTMLElement>(
    GRAPH_SELECTORS.tooltipTitle
  );
  const tooltipSubElement = context.containerElement.querySelector<HTMLElement>(
    GRAPH_SELECTORS.tooltipSub
  );
  const inspectorCloseButton = context.containerElement.querySelector<HTMLButtonElement>(
    GRAPH_SELECTORS.inspectorCloseButton
  );

  const resetMeshHighlights = () => {
    currentHighlightedNodeIndex = null;
    context.activeLinkLines.visible = false;
    const isDark = context.isDarkTheme();
    context.linkMaterial.opacity = isDark ? 0.015 : 0.04;
    context.onResetHighlights();
  };

  const highlightNeighbors = (targetNodeIndex: number) => {
    currentHighlightedNodeIndex = targetNodeIndex;
    const neighborIndexSet = new Set<number>([targetNodeIndex]);
    let activeLinkCount = 0;
    const activePositionArray = context.activeLinkGeometry.attributes.position
      .array as Float32Array;

    context.validLinks.forEach((linkItem) => {
      if (!context.getShowAuthorHubs() && linkItem.type === 'author') return;
      const sourceMesh = context.nodeMeshes[linkItem.sourceIdx];
      const targetMesh = context.nodeMeshes[linkItem.targetIdx];
      if (!sourceMesh?.visible || !targetMesh?.visible) return;

      if (
        linkItem.sourceIdx === targetNodeIndex ||
        linkItem.targetIdx === targetNodeIndex
      ) {
        neighborIndexSet.add(linkItem.sourceIdx);
        neighborIndexSet.add(linkItem.targetIdx);

        if (activeLinkCount < context.maxActiveLinks) {
          const sourceNode = context.nodes[linkItem.sourceIdx];
          const targetNode = context.nodes[linkItem.targetIdx];
          const arrayOffset = activeLinkCount * 6;

          activePositionArray[arrayOffset] = Number.isFinite(sourceNode.x)
            ? (sourceNode.x as number)
            : 0;
          activePositionArray[arrayOffset + 1] = Number.isFinite(sourceNode.y)
            ? (sourceNode.y as number)
            : 0;
          activePositionArray[arrayOffset + 2] = Number.isFinite(sourceNode.z)
            ? (sourceNode.z as number)
            : 0;
          activePositionArray[arrayOffset + 3] = Number.isFinite(targetNode.x)
            ? (targetNode.x as number)
            : 0;
          activePositionArray[arrayOffset + 4] = Number.isFinite(targetNode.y)
            ? (targetNode.y as number)
            : 0;
          activePositionArray[arrayOffset + 5] = Number.isFinite(targetNode.z)
            ? (targetNode.z as number)
            : 0;
          activeLinkCount++;
        }
      }
    });

    for (let i = activeLinkCount * 6; i < context.maxActiveLinks * 6; i++) {
      activePositionArray[i] = 0;
    }
    context.activeLinkGeometry.attributes.position.needsUpdate = true;
    context.activeLinkGeometry.setDrawRange(0, activeLinkCount * 2);
    context.activeLinkLines.visible = activeLinkCount > 0;

    const isDark = context.isDarkTheme();
    context.linkMaterial.opacity = isDark ? 0.015 : 0.04;

    context.nodeMeshes.forEach((meshItem, nodeIndex) => {
      const standardMaterial = meshItem.material as THREE.MeshStandardMaterial;
      const baseScaleMultiplier =
        (meshItem.userData.baseScale as number) || 1.0;

      if (nodeIndex === targetNodeIndex) {
        standardMaterial.opacity = 1.0;
        const focusScaleMultiplier = baseScaleMultiplier * 1.5;
        meshItem.scale.set(
          focusScaleMultiplier,
          focusScaleMultiplier,
          focusScaleMultiplier
        );
      } else if (neighborIndexSet.has(nodeIndex)) {
        standardMaterial.opacity = isDark ? 0.9 : 0.95;
        const neighborScaleMultiplier = baseScaleMultiplier * 1.2;
        meshItem.scale.set(
          neighborScaleMultiplier,
          neighborScaleMultiplier,
          neighborScaleMultiplier
        );
      } else {
        standardMaterial.opacity = isDark ? 0.05 : 0.08;
        const dimmedScaleMultiplier = baseScaleMultiplier * 0.55;
        meshItem.scale.set(
          dimmedScaleMultiplier,
          dimmedScaleMultiplier,
          dimmedScaleMultiplier
        );
      }
    });
  };

  const selectNodeByIndex = (targetNodeIndex: number) => {
    const hitMesh = context.nodeMeshes[targetNodeIndex];
    if (!hitMesh) return;
    selectedMeshItem = hitMesh;
    highlightNeighbors(targetNodeIndex);
    showGraphInspector(
      context.containerElement,
      context.nodes[targetNodeIndex],
      context.nodes
    );
    const nodePosition = hitMesh.position;
    const targetControlsTargetVector = nodePosition.clone();
    const offsetVector = context.camera.position
      .clone()
      .sub(context.controls.target)
      .normalize()
      .multiplyScalar(40);
    const targetCameraPosVector = nodePosition.clone().add(offsetVector);
    context.onCameraFocusRequested(
      targetCameraPosVector,
      targetControlsTargetVector
    );
  };

  const handlePointerDown = () => {
    context.controls.autoRotate = false;
  };

  const handlePointerMove = (pointerEvent: PointerEvent) => {
    const canvasBounds = context.canvasElement.getBoundingClientRect();
    mouseCoordinates.x =
      ((pointerEvent.clientX - canvasBounds.left) / canvasBounds.width) * 2 - 1;
    mouseCoordinates.y =
      -((pointerEvent.clientY - canvasBounds.top) / canvasBounds.height) * 2 + 1;

    if (tooltipElement && tooltipElement.classList.contains('visible')) {
      const offsetX = 16;
      const offsetY = 16;
      const tooltipWidth = tooltipElement.offsetWidth || 160;
      const tooltipHeight = tooltipElement.offsetHeight || 60;
      let targetLeft = pointerEvent.clientX - canvasBounds.left + offsetX;
      let targetTop = pointerEvent.clientY - canvasBounds.top + offsetY;

      if (targetLeft + tooltipWidth > canvasBounds.width) {
        targetLeft = pointerEvent.clientX - canvasBounds.left - tooltipWidth - 8;
      }
      if (targetTop + tooltipHeight > canvasBounds.height) {
        targetTop =
          pointerEvent.clientY - canvasBounds.top - tooltipHeight - 8;
      }

      tooltipElement.style.left = `${Math.max(8, targetLeft)}px`;
      tooltipElement.style.top = `${Math.max(8, targetTop)}px`;
    }
  };

  const handlePointerLeave = () => {
    mouseCoordinates.set(-999, -999);
    if (hoveredMeshItem) {
      hoveredMeshItem = null;
      context.canvasElement.style.cursor = 'grab';
      tooltipElement?.classList.remove('visible');
      if (!selectedMeshItem) {
        resetMeshHighlights();
      }
    }
  };

  const handleCanvasClick = () => {
    const visibleMeshes = context.nodeMeshes.filter(
      (meshItem) => meshItem.visible
    );
    raycaster.setFromCamera(mouseCoordinates, context.camera);
    const intersectedObjects = raycaster.intersectObjects(visibleMeshes);

    if (intersectedObjects.length > 0) {
      const hitMesh = intersectedObjects[0].object as THREE.Mesh;
      const nodeIndex = hitMesh.userData.index as number;
      selectedMeshItem = hitMesh;

      highlightNeighbors(nodeIndex);
      showGraphInspector(
        context.containerElement,
        hitMesh.userData.node,
        context.nodes
      );

      const nodePosition = hitMesh.position;
      const targetControlsTargetVector = nodePosition.clone();
      const offsetVector = context.camera.position
        .clone()
        .sub(context.controls.target)
        .normalize()
        .multiplyScalar(40);
      const targetCameraPosVector = nodePosition.clone().add(offsetVector);
      context.onCameraFocusRequested(
        targetCameraPosVector,
        targetControlsTargetVector
      );
    } else {
      selectedMeshItem = null;
      resetMeshHighlights();
      tooltipElement?.classList.remove('visible');
      hideGraphInspector(context.containerElement);
    }
  };

  const handleInspectorClose = () => {
    hideGraphInspector(context.containerElement);
    selectedMeshItem = null;
    resetMeshHighlights();
  };

  context.canvasElement.addEventListener('pointerdown', handlePointerDown);
  context.canvasElement.addEventListener('pointermove', handlePointerMove);
  context.canvasElement.addEventListener('pointerleave', handlePointerLeave);
  context.canvasElement.addEventListener('click', handleCanvasClick);
  inspectorCloseButton?.addEventListener('click', handleInspectorClose);

  const checkHover = () => {
    if (mouseCoordinates.x === -999) return;

    const visibleMeshes = context.nodeMeshes.filter(
      (meshItem) => meshItem.visible
    );
    raycaster.setFromCamera(mouseCoordinates, context.camera);
    const intersectedObjects = raycaster.intersectObjects(visibleMeshes);

    if (intersectedObjects.length > 0) {
      const hitMesh = intersectedObjects[0].object as THREE.Mesh;
      if (hitMesh !== hoveredMeshItem) {
        hoveredMeshItem = hitMesh;
        context.canvasElement.style.cursor = 'pointer';

        if (!selectedMeshItem) {
          highlightNeighbors(hitMesh.userData.index);
        }

        const node = hitMesh.userData.node as GraphNode;
        if (tooltipElement && tooltipTitleElement && tooltipSubElement) {
          tooltipTitleElement.textContent = node.name;
          const statusText =
            node.type === 'post' && node.readingStatus
              ? ` · ${node.readingStatus}`
              : '';
          tooltipSubElement.textContent = `${node.type.toUpperCase()}${statusText}`;
          tooltipElement.classList.add('visible');
        }
      }
    } else if (hoveredMeshItem) {
      hoveredMeshItem = null;
      context.canvasElement.style.cursor = 'grab';
      tooltipElement?.classList.remove('visible');

      if (!selectedMeshItem) {
        resetMeshHighlights();
      }
    }
  };

  const dispose = () => {
    context.canvasElement.removeEventListener(
      'pointerdown',
      handlePointerDown
    );
    context.canvasElement.removeEventListener(
      'pointermove',
      handlePointerMove
    );
    context.canvasElement.removeEventListener(
      'pointerleave',
      handlePointerLeave
    );
    context.canvasElement.removeEventListener('click', handleCanvasClick);
    inspectorCloseButton?.removeEventListener('click', handleInspectorClose);
  };

  return {
    checkHover,
    highlightNeighbors,
    resetMeshHighlights,
    selectNodeByIndex,
    getSelectedMesh: () => selectedMeshItem,
    getHoveredMesh: () => hoveredMeshItem,
    getCurrentHighlightedIndex: () => currentHighlightedNodeIndex,
    dispose,
  };
}

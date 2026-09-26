/**
 * mesh-factory.ts
 *
 * Procedural geometry generation and materials lifecycle for the 3D Constellation Knowledge Graph.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GraphNode } from './types';

export function createRingedPlanetGeo(): THREE.BufferGeometry {
  const core = new THREE.SphereGeometry(0.65, 16, 16);
  const ring = new THREE.TorusGeometry(1.15, 0.10, 12, 36);
  ring.rotateX(Math.PI / 4.2);
  const merged = mergeGeometries([core, ring]);
  core.dispose();
  ring.dispose();
  return merged;
}

export interface GraphGeometries {
  // Dark mode (Astro / Cosmic)
  authorDarkGeo: THREE.BufferGeometry;
  tagDarkGeo: THREE.BufferGeometry;
  asteroidGeo8: THREE.BufferGeometry;
  asteroidGeo12: THREE.BufferGeometry;
  asteroidGeo16: THREE.BufferGeometry;

  // Light mode (Editorial Knowledge Dendrogram)
  authorLightGeo: THREE.BufferGeometry;
  tagLightGeo: THREE.BufferGeometry;
  folioGeo8: THREE.BufferGeometry;
  folioGeo12: THREE.BufferGeometry;
  folioGeo16: THREE.BufferGeometry;

  starGeo: THREE.BufferGeometry;
  getNodeGeo: (node: GraphNode, isDark: boolean) => THREE.BufferGeometry;
  getArticleGeo: (node: GraphNode) => THREE.BufferGeometry;
  authorGeo: THREE.BufferGeometry;
  tagGeo: THREE.BufferGeometry;
  dispose: () => void;
}

export function createGraphGeometries(): GraphGeometries {
  // Dark Mode: Deep Cosmic Observatory
  const authorDarkGeo = createRingedPlanetGeo();
  const tagDarkGeo = new THREE.SphereGeometry(0.48, 16, 16);
  const asteroidGeo8 = new THREE.OctahedronGeometry(0.28, 0);
  const asteroidGeo12 = new THREE.DodecahedronGeometry(0.30, 0);
  const asteroidGeo16 = new THREE.SphereGeometry(0.32, 4, 4);

  // Light Mode: Editorial Knowledge Dendrogram (Clean Solid Hubs, Prismatic Diamonds & Document Folios)
  const authorLightGeo = new THREE.SphereGeometry(0.68, 24, 24);
  const tagLightGeo = new THREE.OctahedronGeometry(0.48, 0);
  const folioGeo8 = new THREE.BoxGeometry(0.26, 0.26, 0.26);
  const folioGeo12 = new THREE.BoxGeometry(0.32, 0.32, 0.32);
  const folioGeo16 = new THREE.BoxGeometry(0.38, 0.38, 0.38);

  const starCount = 180;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 700;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 600;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 600;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));

  const getNodeGeo = (node: GraphNode, isDark: boolean): THREE.BufferGeometry => {
    if (node.type === 'author') {
      return isDark ? authorDarkGeo : authorLightGeo;
    }
    if (node.type === 'tag') {
      return isDark ? tagDarkGeo : tagLightGeo;
    }
    const rt = node.readingTime || 5;
    if (isDark) {
      if (rt <= 3) return asteroidGeo8;
      if (rt <= 7) return asteroidGeo12;
      return asteroidGeo16;
    } else {
      if (rt <= 3) return folioGeo8;
      if (rt <= 7) return folioGeo12;
      return folioGeo16;
    }
  };

  const getArticleGeo = (node: GraphNode): THREE.BufferGeometry => {
    return getNodeGeo(node, true);
  };

  const dispose = () => {
    authorDarkGeo.dispose();
    tagDarkGeo.dispose();
    asteroidGeo8.dispose();
    asteroidGeo12.dispose();
    asteroidGeo16.dispose();

    authorLightGeo.dispose();
    tagLightGeo.dispose();
    folioGeo8.dispose();
    folioGeo12.dispose();
    folioGeo16.dispose();

    starGeo.dispose();
  };

  return {
    authorDarkGeo,
    tagDarkGeo,
    asteroidGeo8,
    asteroidGeo12,
    asteroidGeo16,
    authorLightGeo,
    tagLightGeo,
    folioGeo8,
    folioGeo12,
    folioGeo16,
    starGeo,
    getNodeGeo,
    getArticleGeo,
    authorGeo: authorDarkGeo,
    tagGeo: tagDarkGeo,
    dispose,
  };
}

export interface GraphMaterials {
  starMat: THREE.PointsMaterial;
  linkMaterial: THREE.LineBasicMaterial;
  activeLinkMaterial: THREE.LineBasicMaterial;
  dispose: () => void;
}

export function createGraphMaterials(isDark: boolean): GraphMaterials {
  const starMat = new THREE.PointsMaterial({
    color: isDark ? 0x93c5fd : 0x64748b,
    size: 1.2,
    transparent: true,
    opacity: isDark ? 0.6 : 0.25,
  });

  const linkMaterial = new THREE.LineBasicMaterial({
    color: isDark ? 0x334155 : 0x94a3b8,
    transparent: true,
    opacity: isDark ? 0.1 : 0.22,
    blending: THREE.NormalBlending,
    depthWrite: false,
  });

  const activeLinkMaterial = new THREE.LineBasicMaterial({
    color: isDark ? 0x38bdf8 : 0x0284c7,
    transparent: true,
    opacity: 0.95,
    blending: THREE.NormalBlending,
    depthWrite: false,
  });

  const dispose = () => {
    starMat.dispose();
    linkMaterial.dispose();
    activeLinkMaterial.dispose();
  };

  return {
    starMat,
    linkMaterial,
    activeLinkMaterial,
    dispose,
  };
}

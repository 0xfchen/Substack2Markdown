/**
 * physics.ts
 *
 * 3D Force-Directed Relaxation Physics Simulation for the Constellation Knowledge Graph.
 */

import * as THREE from 'three';
import type { ActiveLink, SimNode } from './types';

export interface PhysicsEngineOptions {
  kCenter?: number;
  alphaDecay?: number;
  damping?: number;
  maxSpeed?: number;
  showAuthorHubs?: boolean;
  maxActiveLinks?: number;
}

export class GraphPhysicsEngine {
  public nodes: SimNode[];
  public validLinks: ActiveLink[];
  public nodeMeshes: THREE.Mesh[];
  public linkGeometry: THREE.BufferGeometry;
  public activeLinkGeometry: THREE.BufferGeometry;
  public alpha: number = 1.0;
  public alphaDecay: number;
  public kCenter: number;
  public damping: number;
  public maxSpeed: number;
  public showAuthorHubs: boolean;
  public maxActiveLinks: number;

  constructor(
    nodes: SimNode[],
    validLinks: ActiveLink[],
    nodeMeshes: THREE.Mesh[],
    linkGeometry: THREE.BufferGeometry,
    activeLinkGeometry: THREE.BufferGeometry,
    options: PhysicsEngineOptions = {}
  ) {
    this.nodes = nodes;
    this.validLinks = validLinks;
    this.nodeMeshes = nodeMeshes;
    this.linkGeometry = linkGeometry;
    this.activeLinkGeometry = activeLinkGeometry;
    this.kCenter = options.kCenter ?? 0.00035;
    this.alphaDecay = options.alphaDecay ?? 0.988;
    this.damping = options.damping ?? 0.84;
    this.maxSpeed = options.maxSpeed ?? 8.0;
    this.showAuthorHubs = options.showAuthorHubs ?? true;
    this.maxActiveLinks = options.maxActiveLinks ?? 256;
  }

  public updateLinkEndpoints(): void {
    const posArray = this.linkGeometry.attributes.position.array as Float32Array;
    const linksLen = this.validLinks.length;
    for (let i = 0; i < linksLen; i++) {
      const link = this.validLinks[i];
      const idx = i * 6;
      const aMesh = this.nodeMeshes[link.sourceIdx];
      const bMesh = this.nodeMeshes[link.targetIdx];
      if ((!this.showAuthorHubs && link.type === 'author') || !aMesh?.visible || !bMesh?.visible) {
        posArray[idx] = 0;
        posArray[idx + 1] = 0;
        posArray[idx + 2] = 0;
        posArray[idx + 3] = 0;
        posArray[idx + 4] = 0;
        posArray[idx + 5] = 0;
      } else {
        const a = this.nodes[link.sourceIdx];
        const b = this.nodes[link.targetIdx];
        posArray[idx] = Number.isFinite(a.x) ? a.x : 0;
        posArray[idx + 1] = Number.isFinite(a.y) ? a.y : 0;
        posArray[idx + 2] = Number.isFinite(a.z) ? a.z : 0;
        posArray[idx + 3] = Number.isFinite(b.x) ? b.x : 0;
        posArray[idx + 4] = Number.isFinite(b.y) ? b.y : 0;
        posArray[idx + 5] = Number.isFinite(b.z) ? b.z : 0;
      }
    }
    this.linkGeometry.attributes.position.needsUpdate = true;
  }

  public step(currentHighlightedIdx: number | null = null): void {
    if (this.alpha < 0.005) return;

    const nodesLen = this.nodes.length;
    const linksLen = this.validLinks.length;
    const currentAlpha = this.alpha;

    // 1. Centering gravity
    for (let i = 0; i < nodesLen; i++) {
      const n = this.nodes[i];
      n.vx -= n.x * this.kCenter;
      n.vy -= n.y * this.kCenter;
      n.vz -= n.z * this.kCenter;
    }

    // 2. Pairwise N-Body Electrostatic Repulsion
    const step = nodesLen > 400 ? 2 : 1;
    for (let i = 0; i < nodesLen; i += step) {
      const a = this.nodes[i];
      for (let j = i + 1; j < nodesLen; j += step) {
        const b = this.nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const distSq = dx * dx + dy * dy + dz * dz + 40;
        if (distSq < 32000) {
          const dist = Math.sqrt(distSq);
          const force = (currentAlpha * 26.0) / (distSq + 20);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          const fz = (dz / dist) * force;
          a.vx -= fx;
          a.vy -= fy;
          a.vz -= fz;
          b.vx += fx;
          b.vy += fy;
          b.vz += fz;
        }
      }
    }

    // 3. Link Spring Attraction
    for (let i = 0; i < linksLen; i++) {
      const link = this.validLinks[i];
      if (!this.showAuthorHubs && link.type === 'author') continue;

      const a = this.nodes[link.sourceIdx];
      const b = this.nodes[link.targetIdx];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;
      const targetDist = link.type === 'author' ? 65 : link.type === 'similarity' ? 36 : 48;
      const displacement = dist - targetDist;
      const springForce = displacement * 0.024 * link.weight * currentAlpha;
      const fx = (dx / dist) * springForce;
      const fy = (dy / dist) * springForce;
      const fz = (dz / dist) * springForce;

      a.vx += fx;
      a.vy += fy;
      a.vz += fz;
      b.vx -= fx;
      b.vy -= fy;
      b.vz -= fz;
    }

    // 4. Update Positions & Damping
    const damp = this.damping;
    const maxSpd = this.maxSpeed;
    for (let i = 0; i < nodesLen; i++) {
      const n = this.nodes[i];
      n.vx = Number.isFinite(n.vx) ? Math.max(-maxSpd, Math.min(maxSpd, n.vx * damp)) : 0;
      n.vy = Number.isFinite(n.vy) ? Math.max(-maxSpd, Math.min(maxSpd, n.vy * damp)) : 0;
      n.vz = Number.isFinite(n.vz) ? Math.max(-maxSpd, Math.min(maxSpd, n.vz * damp)) : 0;
      n.x = Number.isFinite(n.x + n.vx) ? n.x + n.vx : 0;
      n.y = Number.isFinite(n.y + n.vy) ? n.y + n.vy : 0;
      n.z = Number.isFinite(n.z + n.vz) ? n.z + n.vz : 0;
      this.nodeMeshes[i].position.set(n.x, n.y, n.z);
    }

    // 5. Update Line Endpoints
    const posArray = this.linkGeometry.attributes.position.array as Float32Array;
    for (let i = 0; i < linksLen; i++) {
      const link = this.validLinks[i];
      const idx = i * 6;
      if (!this.showAuthorHubs && link.type === 'author') {
        posArray[idx] = 0;
        posArray[idx + 1] = 0;
        posArray[idx + 2] = 0;
        posArray[idx + 3] = 0;
        posArray[idx + 4] = 0;
        posArray[idx + 5] = 0;
      } else {
        const a = this.nodes[link.sourceIdx];
        const b = this.nodes[link.targetIdx];
        posArray[idx] = Number.isFinite(a.x) ? a.x : 0;
        posArray[idx + 1] = Number.isFinite(a.y) ? a.y : 0;
        posArray[idx + 2] = Number.isFinite(a.z) ? a.z : 0;
        posArray[idx + 3] = Number.isFinite(b.x) ? b.x : 0;
        posArray[idx + 4] = Number.isFinite(b.y) ? b.y : 0;
        posArray[idx + 5] = Number.isFinite(b.z) ? b.z : 0;
      }
    }
    this.linkGeometry.attributes.position.needsUpdate = true;
    this.updateLinkEndpoints();

    // 6. Sync active links positions if a node is currently focused
    if (currentHighlightedIdx !== null) {
      let activeCount = 0;
      const activePos = this.activeLinkGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < linksLen; i++) {
        const link = this.validLinks[i];
        if (!this.showAuthorHubs && link.type === 'author') continue;
        const aMesh = this.nodeMeshes[link.sourceIdx];
        const bMesh = this.nodeMeshes[link.targetIdx];
        if (!aMesh.visible || !bMesh.visible) continue;
        if (link.sourceIdx === currentHighlightedIdx || link.targetIdx === currentHighlightedIdx) {
          if (activeCount < this.maxActiveLinks) {
            const a = this.nodes[link.sourceIdx];
            const b = this.nodes[link.targetIdx];
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
      }
      this.activeLinkGeometry.setDrawRange(0, activeCount * 2);
      this.activeLinkGeometry.attributes.position.needsUpdate = true;
    }

    this.alpha *= this.alphaDecay;
  }

  public prewarm(ticks: number = 55): void {
    for (let t = 0; t < ticks; t++) {
      this.step(null);
    }
  }

  public reheat(targetAlpha: number = 0.15): void {
    this.alpha = Math.max(this.alpha, targetAlpha);
  }
}

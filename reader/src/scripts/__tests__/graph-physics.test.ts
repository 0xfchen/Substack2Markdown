import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GraphPhysicsEngine } from '../graph/physics';
import type { ActiveLink, SimNode } from '../graph/types';

describe('GraphPhysicsEngine', () => {
  it('prewarms without generating NaN or infinite coordinates', () => {
    const nodes: SimNode[] = [
      { id: '1', name: 'N1', type: 'author', group: 'g', val: 2, x: 10, y: 10, z: 10, vx: 0, vy: 0, vz: 0 },
      { id: '2', name: 'N2', type: 'post', group: 'g', val: 1, x: 20, y: 20, z: 20, vx: 0, vy: 0, vz: 0 },
      { id: '3', name: 'N3', type: 'post', group: 'g', val: 1, x: -15, y: -15, z: -15, vx: 0, vy: 0, vz: 0 },
    ];
    const links: ActiveLink[] = [
      { sourceIdx: 1, targetIdx: 0, type: 'author', weight: 0.8 },
      { sourceIdx: 2, targetIdx: 0, type: 'author', weight: 0.8 },
    ];

    const geo = new THREE.BufferGeometry();
    const mat = new THREE.MeshBasicMaterial();
    const meshes = nodes.map((n) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(n.x, n.y, n.z);
      return m;
    });

    const linkGeo = new THREE.BufferGeometry();
    linkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(links.length * 6), 3));
    const activeGeo = new THREE.BufferGeometry();
    activeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(32 * 6), 3));

    const engine = new GraphPhysicsEngine(nodes, links, meshes, linkGeo, activeGeo);
    engine.prewarm(55);

    expect(engine.alpha).toBeLessThan(1.0);
    expect(Number.isFinite(nodes[0].x)).toBe(true);
    expect(Number.isFinite(nodes[0].y)).toBe(true);
    expect(Number.isFinite(nodes[0].z)).toBe(true);

    expect(meshes[0].position.x).toBe(nodes[0].x);
    expect(meshes[0].position.y).toBe(nodes[0].y);
    expect(meshes[0].position.z).toBe(nodes[0].z);
  });

  it('reheats alpha when requested', () => {
    const nodes: SimNode[] = [
      { id: '1', name: 'N1', type: 'post', group: 'g', val: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
    ];
    const geo = new THREE.BufferGeometry();
    const mat = new THREE.MeshBasicMaterial();
    const meshes = [new THREE.Mesh(geo, mat)];
    const linkGeo = new THREE.BufferGeometry();
    linkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const activeGeo = new THREE.BufferGeometry();
    activeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));

    const engine = new GraphPhysicsEngine(nodes, [], meshes, linkGeo, activeGeo);
    engine.alpha = 0.001;
    engine.reheat(0.15);
    expect(engine.alpha).toBe(0.15);
  });
});

/**
 * types.ts
 *
 * Type definitions for the interactive 404 scene (Starship & Origami Paper Plane).
 */

import type * as THREE from 'three';

export interface BgStar {
  x: number;
  y: number;
  z: number;
  pz: number;
  size: number;
  baseAlpha: number;
  speedMult: number;
  colorType: 'white' | 'blue' | 'gold';
}

export interface FlightMotion {
  speedRatio: number;
  warpRatio?: number;
  speed?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  isOutbound?: boolean;
}

export interface FlapPivots {
  fwdLeftPivot: THREE.Group;
  fwdRightPivot: THREE.Group;
  aftLeftPivot: THREE.Group;
  aftRightPivot: THREE.Group;
}

export interface RocketVessel {
  rocketGroup: THREE.Group;
  flaps: FlapPivots;
  plumeGroup: THREE.Group;
  geometries: THREE.BufferGeometry[];
  dispose: () => void;
}

export interface PaperPlaneVessel {
  paperPlaneGroup: THREE.Group;
  paperMesh: THREE.Mesh;
  paperLines: THREE.LineSegments;
  textures: THREE.Texture[];
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  dispose: () => void;
}

export interface Typography3D {
  code404Group: THREE.Group;
  chromeGroup?: THREE.Group;
  paperGroup?: THREE.Group;
  geometries: THREE.BufferGeometry[];
  digitMeshes?: THREE.Mesh[];
  lineGroup?: THREE.Group;
  dispose: () => void;
}

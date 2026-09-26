/**
 * types.ts
 *
 * Shared data structures and contracts for the 3D Constellation Knowledge Graph.
 */

import type { GraphNode } from '../../utils/graph-data';

export type { GraphData, GraphLink, GraphNode } from '../../utils/graph-data';

export interface SimNode extends GraphNode {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export interface ActiveLink {
  sourceIdx: number;
  targetIdx: number;
  type: 'tag' | 'author' | 'similarity';
  weight: number;
}

export interface PopAnim {
  startTime: number;
  duration: number;
}

export type CategoryMode = 'all' | 'publications' | 'tags' | 'articles' | string;

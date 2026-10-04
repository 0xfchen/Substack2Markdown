/**
 * typography.ts
 *
 * 3D Chrome and Papercraft "404" Extruded Typography for the 404 aerospace scene.
 */

import * as THREE from 'three';
import type { Typography3D } from './types';

export function createDigitShape4(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0.82, -0.68);
  shape.lineTo(0.82, -0.28);
  shape.lineTo(1.0, -0.28);
  shape.lineTo(1.0, 0.02);
  shape.lineTo(0.82, 0.02);
  shape.lineTo(0.82, 0.68);
  shape.lineTo(0.5, 0.68);
  shape.lineTo(-0.12, 0.02);
  shape.lineTo(-0.12, -0.28);
  shape.lineTo(0.5, -0.28);
  shape.lineTo(0.5, -0.68);
  shape.closePath();

  const holePath = new THREE.Path();
  holePath.moveTo(0.5, 0.02);
  holePath.lineTo(0.18, 0.02);
  holePath.lineTo(0.5, 0.44);
  holePath.closePath();
  shape.holes.push(holePath);
  return shape;
}

export function createDigitShape0(): THREE.Shape {
  const shape = new THREE.Shape();
  const digitWidth = 0.48;
  const digitHeight = 0.68;
  const cornerRadius = 0.24;

  shape.moveTo(-digitWidth + cornerRadius, -digitHeight);
  shape.lineTo(digitWidth - cornerRadius, -digitHeight);
  shape.absarc(digitWidth - cornerRadius, -digitHeight + cornerRadius, cornerRadius, -Math.PI / 2, 0, false);
  shape.lineTo(digitWidth, digitHeight - cornerRadius);
  shape.absarc(digitWidth - cornerRadius, digitHeight - cornerRadius, cornerRadius, 0, Math.PI / 2, false);
  shape.lineTo(-digitWidth + cornerRadius, digitHeight);
  shape.absarc(-digitWidth + cornerRadius, digitHeight - cornerRadius, cornerRadius, Math.PI / 2, Math.PI, false);
  shape.lineTo(-digitWidth, -digitHeight + cornerRadius);
  shape.absarc(-digitWidth + cornerRadius, -digitHeight + cornerRadius, cornerRadius, Math.PI, Math.PI * 1.5, false);

  const holePath = new THREE.Path();
  const holeWidth = 0.2;
  const holeHeight = 0.4;
  const holeRadius = 0.1;

  holePath.moveTo(-holeWidth + holeRadius, -holeHeight);
  holePath.lineTo(holeWidth - holeRadius, -holeHeight);
  holePath.absarc(holeWidth - holeRadius, -holeHeight + holeRadius, holeRadius, -Math.PI / 2, 0, false);
  holePath.lineTo(holeWidth, holeHeight - holeRadius);
  holePath.absarc(holeWidth - holeRadius, holeHeight - holeRadius, holeRadius, 0, Math.PI / 2, false);
  holePath.lineTo(-holeWidth + holeRadius, holeHeight);
  holePath.absarc(-holeWidth + holeRadius, holeHeight - holeRadius, holeRadius, Math.PI / 2, Math.PI, false);
  holePath.lineTo(-holeWidth, -holeHeight + holeRadius);
  holePath.absarc(-holeWidth + holeRadius, -holeHeight + holeRadius, holeRadius, Math.PI, Math.PI * 1.5, false);
  shape.holes.push(holePath);
  return shape;
}

export function create3D404Typography(
  chromeMaterial: THREE.Material,
  paperMaterial?: THREE.Material | THREE.Material[],
  creaseMaterial?: THREE.LineBasicMaterial
): Typography3D {
  const code404Group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const lineGeometries: THREE.BufferGeometry[] = [];

  function createExtrusion(shape: THREE.Shape, bevelSegments: number): THREE.ExtrudeGeometry {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: bevelSegments > 1 ? 0.12 : 0.08,
      bevelSize: bevelSegments > 1 ? 0.1 : 0.08,
      bevelSegments,
      steps: 1,
    });
    geometry.center();
    geometries.push(geometry);
    return geometry;
  }

  function applyPaperPlanarUVs(geometry: THREE.BufferGeometry) {
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox!;
    const rangeX = boundingBox.max.x - boundingBox.min.x || 1;
    const rangeY = boundingBox.max.y - boundingBox.min.y || 1;
    const positionAttribute = geometry.attributes.position;
    const uvAttribute = geometry.attributes.uv;
    if (!uvAttribute) return;
    for (let i = 0; i < positionAttribute.count; i++) {
      const x = positionAttribute.getX(i);
      const y = positionAttribute.getY(i);
      uvAttribute.setXY(i, (x - boundingBox.min.x) / rangeX, (y - boundingBox.min.y) / rangeY);
    }
    uvAttribute.needsUpdate = true;
  }

  // 1. Chrome Starship Typography (Dark Mode - smooth 10-segment bevels)
  const chromeGroup = new THREE.Group();
  const chromeGeometry4_1 = createExtrusion(createDigitShape4(), 10);
  const chromeGeometry0 = createExtrusion(createDigitShape0(), 10);
  const chromeGeometry4_2 = createExtrusion(createDigitShape4(), 10);

  const chromeMesh4_1 = new THREE.Mesh(chromeGeometry4_1, chromeMaterial);
  chromeMesh4_1.position.x = -1.05;
  chromeGroup.add(chromeMesh4_1);

  const chromeMesh0 = new THREE.Mesh(chromeGeometry0, chromeMaterial);
  chromeMesh0.position.x = 0;
  chromeGroup.add(chromeMesh0);

  const chromeMesh4_2 = new THREE.Mesh(chromeGeometry4_2, chromeMaterial);
  chromeMesh4_2.position.x = 1.05;
  chromeGroup.add(chromeMesh4_2);

  let paperGroup: THREE.Group | undefined;

  // 2. Origami Papercraft Typography (Light Mode)
  if (paperMaterial) {
    paperGroup = new THREE.Group();
    const paperGeometry4_1 = createExtrusion(createDigitShape4(), 1);
    const paperGeometry0 = createExtrusion(createDigitShape0(), 1);
    const paperGeometry4_2 = createExtrusion(createDigitShape4(), 1);

    applyPaperPlanarUVs(paperGeometry4_1);
    applyPaperPlanarUVs(paperGeometry0);
    applyPaperPlanarUVs(paperGeometry4_2);

    const paperMesh4_1 = new THREE.Mesh(paperGeometry4_1, paperMaterial);
    paperMesh4_1.position.x = -1.05;
    paperGroup.add(paperMesh4_1);

    const paperMesh0 = new THREE.Mesh(paperGeometry0, paperMaterial);
    paperMesh0.position.x = 0;
    paperGroup.add(paperMesh0);

    const paperMesh4_2 = new THREE.Mesh(paperGeometry4_2, paperMaterial);
    paperMesh4_2.position.x = 1.05;
    paperGroup.add(paperMesh4_2);

    if (creaseMaterial) {
      const lineGroup = new THREE.Group();
      [
        { geo: paperGeometry4_1, x: -1.05 },
        { geo: paperGeometry0, x: 0 },
        { geo: paperGeometry4_2, x: 1.05 },
      ].forEach(({ geo, x }) => {
        const edgeGeometry = new THREE.EdgesGeometry(geo, 15);
        lineGeometries.push(edgeGeometry);
        const lines = new THREE.LineSegments(edgeGeometry, creaseMaterial);
        lines.position.x = x;
        lineGroup.add(lines);
      });
      paperGroup.add(lineGroup);
    }

    code404Group.add(chromeGroup);
    code404Group.add(paperGroup);
  } else {
    code404Group.add(chromeMesh4_1);
    code404Group.add(chromeMesh0);
    code404Group.add(chromeMesh4_2);
  }

  const dispose = () => {
    geometries.forEach((geometryItem) => geometryItem.dispose());
    lineGeometries.forEach((lineItem) => lineItem.dispose());
  };

  return {
    code404Group,
    chromeGroup,
    paperGroup,
    geometries,
    dispose,
  };
}

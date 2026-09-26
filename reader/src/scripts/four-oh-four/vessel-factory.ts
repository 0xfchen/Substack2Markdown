/**
 * vessel-factory.ts
 *
 * Procedural 3D mesh generation and material assembly for Starship,
 * Origami Paper Plane, and 3D Extruded "404" typography.
 */

import * as THREE from 'three';
import type { RocketVessel, PaperPlaneVessel, Typography3D } from './types';
import { AEROSPACE_404_COLORS } from '../../utils/colors';

// ==========================================
// 1. SpaceX Starship Procedural Geometries
// ==========================================

function createConformalFinGeo(noseHeight: number, fuselageRadius: number, isRight = true): THREE.BufferGeometry {
  const Ny = 20;
  const finHeight = 0.65;
  const kneeHeight = 0.28;
  const finWidth = 0.22;
  const thetaHalf = 0.09;
  const thetaTip = 0.03;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= Ny; j++) {
    const v = j / Ny;
    const y = v * finHeight;
    const t = y / noseHeight;
    const rNose = fuselageRadius * Math.cos(t * Math.PI * 0.5) * Math.sqrt(Math.max(0, 1 - t * 0.12));
    const rIn = rNose - 0.03;

    let rOut: number;
    if (y <= kneeHeight) {
      rOut = fuselageRadius + finWidth;
    } else {
      const frac = (y - kneeHeight) / (finHeight - kneeHeight);
      rOut = (fuselageRadius + finWidth) * (1 - frac) + (rNose + 0.01) * frac;
    }

    const sgn = isRight ? 1 : -1;

    positions.push(sgn * rIn * Math.cos(thetaHalf), y, rIn * Math.sin(thetaHalf));
    positions.push(sgn * rOut * Math.cos(thetaTip), y, rOut * Math.sin(thetaTip));
    positions.push(sgn * rOut * Math.cos(-thetaTip), y, rOut * Math.sin(-thetaTip));
    positions.push(sgn * rIn * Math.cos(-thetaHalf), y, rIn * Math.sin(-thetaHalf));

    if (j < Ny) {
      const rowA = j * 4;
      const rowB = (j + 1) * 4;

      indices.push(rowA + 0, rowA + 1, rowB + 1);
      indices.push(rowA + 0, rowB + 1, rowB + 0);

      indices.push(rowA + 1, rowA + 2, rowB + 2);
      indices.push(rowA + 1, rowB + 2, rowB + 1);

      indices.push(rowA + 2, rowA + 3, rowB + 3);
      indices.push(rowA + 2, rowB + 3, rowB + 2);

      indices.push(rowA + 3, rowA + 0, rowB + 0);
      indices.push(rowA + 3, rowB + 0, rowB + 3);
    }
  }

  // Bottom cap
  indices.push(0, 2, 1);
  indices.push(0, 3, 2);

  // Top cap
  const top = Ny * 4;
  indices.push(top + 0, top + 1, top + 2);
  indices.push(top + 0, top + 2, top + 3);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createConformalAftFinGeo(fuselageRadius: number, isRight = true): THREE.BufferGeometry {
  const Ny = 24;
  const finHeight = 1.25;
  const kneeHeight = 0.42;
  const finWidth = 0.28;
  const thetaHalf = 0.08;
  const thetaTip = 0.025;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= Ny; j++) {
    const v = j / Ny;
    const y = v * finHeight;
    const rIn = fuselageRadius - 0.03;

    let rOut: number;
    if (y <= kneeHeight) {
      rOut = fuselageRadius + finWidth;
    } else {
      const frac = (y - kneeHeight) / (finHeight - kneeHeight);
      rOut = (fuselageRadius + finWidth) * (1 - frac) + (fuselageRadius + 0.01) * frac;
    }

    const sgn = isRight ? 1 : -1;

    positions.push(sgn * rIn * Math.cos(thetaHalf), y, rIn * Math.sin(thetaHalf));
    positions.push(sgn * rOut * Math.cos(thetaTip), y, rOut * Math.sin(thetaTip));
    positions.push(sgn * rOut * Math.cos(-thetaTip), y, rOut * Math.sin(-thetaTip));
    positions.push(sgn * rIn * Math.cos(-thetaHalf), y, rIn * Math.sin(-thetaHalf));

    if (j < Ny) {
      const rowA = j * 4;
      const rowB = (j + 1) * 4;

      indices.push(rowA + 0, rowA + 1, rowB + 1);
      indices.push(rowA + 0, rowB + 1, rowB + 0);

      indices.push(rowA + 1, rowA + 2, rowB + 2);
      indices.push(rowA + 1, rowB + 2, rowB + 1);

      indices.push(rowA + 2, rowA + 3, rowB + 3);
      indices.push(rowA + 2, rowB + 3, rowB + 2);

      indices.push(rowA + 3, rowA + 0, rowB + 0);
      indices.push(rowA + 3, rowB + 0, rowB + 3);
    }
  }

  // Bottom cap flush with base
  indices.push(0, 2, 1);
  indices.push(0, 3, 2);

  // Top cap
  const top = Ny * 4;
  indices.push(top + 0, top + 1, top + 2);
  indices.push(top + 0, top + 2, top + 3);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function createStarshipRocket(
  chromeMaterial: THREE.Material,
  engineBellMaterial: THREE.Material,
  plumeMaterial: THREE.Material,
  corePlumeMaterial: THREE.Material
): RocketVessel {
  const rocketGroup = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];

  const fuselageHeight = 2.90;
  const fuselageRadius = 0.32;
  const radialSegments = 64;

  // Fuselage Cylinder
  const fuselageGeo = new THREE.CylinderGeometry(
    fuselageRadius,
    fuselageRadius,
    fuselageHeight,
    radialSegments,
    1,
    false,
    0,
    Math.PI * 2
  );
  geometries.push(fuselageGeo);
  const chromeFuselage = new THREE.Mesh(fuselageGeo, chromeMaterial);
  chromeFuselage.position.y = -0.25;
  rocketGroup.add(chromeFuselage);

  // Gothic Ogive Nosecone
  const noseHeight = 1.35;
  const ogiveSegments = 48;
  const ogivePoints: THREE.Vector2[] = [];
  for (let i = 0; i <= ogiveSegments; i++) {
    const t = i / ogiveSegments;
    const y = t * noseHeight;
    const r = fuselageRadius * Math.cos(t * Math.PI * 0.5) * Math.sqrt(Math.max(0, 1 - t * 0.12));
    ogivePoints.push(new THREE.Vector2(Math.max(0.001, r), y));
  }

  const noseGeo = new THREE.LatheGeometry(ogivePoints, 64, 0, Math.PI * 2);
  geometries.push(noseGeo);
  const chromeNose = new THREE.Mesh(noseGeo, chromeMaterial);
  chromeNose.position.y = 1.20;
  rocketGroup.add(chromeNose);

  // Junction seam
  const seamGeo = new THREE.TorusGeometry(fuselageRadius + 0.0015, 0.002, 8, 64);
  seamGeo.rotateX(Math.PI / 2);
  geometries.push(seamGeo);
  const seamMaterial = new THREE.MeshStandardMaterial({
    color: AEROSPACE_404_COLORS.seam,
    roughness: 0.35,
    metalness: 0.8,
  });
  const junctionSeam = new THREE.Mesh(seamGeo, seamMaterial);
  junctionSeam.position.y = 1.20;
  rocketGroup.add(junctionSeam);

  // Forward Top Flaps
  const fwdLeftPivot = new THREE.Group();
  fwdLeftPivot.position.set(0, 1.20, 0);
  const fwdLeftGeo = createConformalFinGeo(noseHeight, fuselageRadius, false);
  geometries.push(fwdLeftGeo);
  const fwdLeftFlap = new THREE.Mesh(fwdLeftGeo, chromeMaterial);
  fwdLeftPivot.add(fwdLeftFlap);
  rocketGroup.add(fwdLeftPivot);

  const fwdRightPivot = new THREE.Group();
  fwdRightPivot.position.set(0, 1.20, 0);
  const fwdRightGeo = createConformalFinGeo(noseHeight, fuselageRadius, true);
  geometries.push(fwdRightGeo);
  const fwdRightFlap = new THREE.Mesh(fwdRightGeo, chromeMaterial);
  fwdRightPivot.add(fwdRightFlap);
  rocketGroup.add(fwdRightPivot);

  // Aft Bottom Flaps
  const aftLeftPivot = new THREE.Group();
  aftLeftPivot.position.set(0, -1.70, 0);
  const aftLeftGeo = createConformalAftFinGeo(fuselageRadius, false);
  geometries.push(aftLeftGeo);
  const aftLeftFlap = new THREE.Mesh(aftLeftGeo, chromeMaterial);
  aftLeftPivot.add(aftLeftFlap);
  rocketGroup.add(aftLeftPivot);

  const aftRightPivot = new THREE.Group();
  aftRightPivot.position.set(0, -1.70, 0);
  const aftRightGeo = createConformalAftFinGeo(fuselageRadius, true);
  geometries.push(aftRightGeo);
  const aftRightFlap = new THREE.Mesh(aftRightGeo, chromeMaterial);
  aftRightPivot.add(aftRightFlap);
  rocketGroup.add(aftRightPivot);

  // Third front-angled fin
  const aftFrontGeo = createConformalAftFinGeo(fuselageRadius, true);
  geometries.push(aftFrontGeo);
  const aftFrontFin = new THREE.Mesh(aftFrontGeo, chromeMaterial);
  aftFrontFin.position.set(0, -1.70, 0);
  aftFrontFin.rotation.y = -Math.PI * 0.5;
  rocketGroup.add(aftFrontFin);

  // Base Plate
  const basePlateGeo = new THREE.CylinderGeometry(fuselageRadius * 0.98, fuselageRadius * 0.98, 0.02, 32);
  geometries.push(basePlateGeo);
  const basePlate = new THREE.Mesh(basePlateGeo, engineBellMaterial);
  basePlate.position.y = -1.70;
  rocketGroup.add(basePlate);

  // Raptor Exhaust Plume
  const plumeGroup = new THREE.Group();
  plumeGroup.position.set(0, -1.72, 0);

  const outerPlumeGeo = new THREE.ConeGeometry(0.55, 2.2, 24, 1, true);
  outerPlumeGeo.rotateX(Math.PI);
  outerPlumeGeo.translate(0, -1.1, 0);
  geometries.push(outerPlumeGeo);
  const outerPlume = new THREE.Mesh(outerPlumeGeo, plumeMaterial);
  plumeGroup.add(outerPlume);

  const corePlumeGeo = new THREE.ConeGeometry(0.24, 1.4, 16, 1, true);
  corePlumeGeo.rotateX(Math.PI);
  corePlumeGeo.translate(0, -0.7, 0);
  geometries.push(corePlumeGeo);
  const corePlume = new THREE.Mesh(corePlumeGeo, corePlumeMaterial);
  plumeGroup.add(corePlume);

  rocketGroup.add(plumeGroup);

  const dispose = () => {
    geometries.forEach((g) => g.dispose());
    seamMaterial.dispose();
  };

  return {
    rocketGroup,
    flaps: {
      fwdLeftPivot,
      fwdRightPivot,
      aftLeftPivot,
      aftRightPivot,
    },
    plumeGroup,
    geometries,
    dispose,
  };
}

// ==========================================
// 2. Origami Paper Plane Procedural Assembly
// ==========================================

export function generatePaperTextures(): { diffuse: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  if (typeof document === 'undefined') {
    const dummy = {} as HTMLCanvasElement;
    const diffuse = new THREE.CanvasTexture(dummy);
    const bump = new THREE.CanvasTexture(dummy);
    diffuse.wrapS = THREE.RepeatWrapping;
    diffuse.wrapT = THREE.RepeatWrapping;
    bump.wrapS = THREE.RepeatWrapping;
    bump.wrapT = THREE.RepeatWrapping;
    return { diffuse, bump };
  }
  const size = 1024;
  const dCanvas = document.createElement('canvas');
  dCanvas.width = size;
  dCanvas.height = size;
  const dCtx = dCanvas.getContext('2d')!;

  const bCanvas = document.createElement('canvas');
  bCanvas.width = size;
  bCanvas.height = size;
  const bCtx = bCanvas.getContext('2d')!;

  // 1. Warm archival cotton paper base wash
  dCtx.fillStyle = AEROSPACE_404_COLORS.paperBase;
  dCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // 2. High-contrast paper pulp texture & cold-press tooth
  const dImg = dCtx.getImageData(0, 0, size, size);
  const bImg = bCtx.getImageData(0, 0, size, size);
  const dData = dImg.data;
  const bData = bImg.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const tooth = (Math.random() - 0.5) * 26;
      const cloud = (Math.sin(x * 0.03) + Math.cos(y * 0.03)) * 8;
      const grain = (Math.sin(x * 0.4) * Math.sin(y * 0.4)) * 6;
      const total = tooth + cloud + grain;

      dData[idx] = Math.min(255, Math.max(180, dData[idx] + total));
      dData[idx + 1] = Math.min(255, Math.max(180, dData[idx + 1] + total));
      dData[idx + 2] = Math.min(255, Math.max(170, dData[idx + 2] + total * 0.9));

      const bVal = Math.min(255, Math.max(0, 128 + total * 4.2));
      bData[idx] = bVal;
      bData[idx + 1] = bVal;
      bData[idx + 2] = bVal;
    }
  }
  dCtx.putImageData(dImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  // 3. Faint ruled notebook / editorial drafting lines
  dCtx.lineWidth = 1.2;
  dCtx.strokeStyle = AEROSPACE_404_COLORS.paperRuling;
  bCtx.lineWidth = 1.2;
  bCtx.strokeStyle = 'rgba(120, 120, 120, 0.25)';
  const lineSpacing = 52;
  for (let y = lineSpacing; y < size; y += lineSpacing) {
    dCtx.beginPath();
    dCtx.moveTo(0, y);
    dCtx.lineTo(size, y);
    dCtx.stroke();

    bCtx.beginPath();
    bCtx.moveTo(0, y);
    bCtx.lineTo(size, y);
    bCtx.stroke();
  }

  // Faint vertical margin line
  dCtx.lineWidth = 1.5;
  dCtx.strokeStyle = AEROSPACE_404_COLORS.paperMargin;
  dCtx.beginPath();
  dCtx.moveTo(140, 0);
  dCtx.lineTo(140, size);
  dCtx.stroke();

  // 4. Clearly visible organic pulp fibers
  dCtx.lineWidth = 1.4;
  bCtx.lineWidth = 1.4;
  for (let i = 0; i < 220; i++) {
    const fx = Math.random() * size;
    const fy = Math.random() * size;
    const len = 6 + Math.random() * 18;
    const angle = Math.random() * Math.PI * 2;
    const curve = (Math.random() - 0.5) * 8;

    const ex = fx + Math.cos(angle) * len;
    const ey = fy + Math.sin(angle) * len;
    const cx = (fx + ex) * 0.5 + Math.sin(angle) * curve;
    const cy = (fy + ey) * 0.5 + Math.cos(angle) * curve;

    const r = Math.random();
    if (r < 0.45) {
      dCtx.strokeStyle = 'rgba(71, 85, 105, 0.38)';
    } else if (r < 0.75) {
      dCtx.strokeStyle = 'rgba(162, 116, 76, 0.35)';
    } else {
      dCtx.strokeStyle = 'rgba(100, 116, 139, 0.30)';
    }

    dCtx.beginPath();
    dCtx.moveTo(fx, fy);
    dCtx.quadraticCurveTo(cx, cy, ex, ey);
    dCtx.stroke();

    bCtx.strokeStyle = 'rgba(200, 200, 200, 0.6)';
    bCtx.beginPath();
    bCtx.moveTo(fx, fy);
    bCtx.quadraticCurveTo(cx, cy, ex, ey);
    bCtx.stroke();
  }

  // 5. Tiny dark pulp flecks
  for (let i = 0; i < 300; i++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const pr = 0.8 + Math.random() * 1.4;
    dCtx.fillStyle = 'rgba(60, 60, 60, 0.25)';
    dCtx.beginPath();
    dCtx.arc(px, py, pr, 0, Math.PI * 2);
    dCtx.fill();
  }

  const diffuse = new THREE.CanvasTexture(dCanvas);
  diffuse.wrapS = THREE.RepeatWrapping;
  diffuse.wrapT = THREE.RepeatWrapping;
  diffuse.repeat.set(1.5, 1.5);
  diffuse.needsUpdate = true;

  const bump = new THREE.CanvasTexture(bCanvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(1.5, 1.5);
  bump.needsUpdate = true;

  return { diffuse, bump };
}

export function createOrigamiPaperPlane(): PaperPlaneVessel {
  const paperPlaneGroup = new THREE.Group();
  const { diffuse: paperTexture, bump: paperBumpTexture } = generatePaperTextures();

  const paperMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    flatShading: true,
    map: paperTexture,
    bumpMap: paperBumpTexture,
    bumpScale: 0.08,
    roughness: 0.95,
    metalness: 0.0,
    envMapIntensity: 0.0,
    side: THREE.FrontSide,
    shadowSide: THREE.FrontSide,
  });

  const creaseMaterial = new THREE.LineBasicMaterial({
    color: AEROSPACE_404_COLORS.creaseLines,
    transparent: true,
    opacity: 0.85,
  });

  const P_NOSE = [0, 1.90, 0.05];
  const P_SPINE_TAIL = [0, -1.30, 0.14];
  const P_L_TIP = [-1.45, -1.15, 0.30];
  const P_R_TIP = [1.45, -1.15, 0.30];
  const P_L_INNER = [-0.10, -1.30, 0.04];
  const P_R_INNER = [0.10, -1.30, 0.04];
  const P_KEEL_FRONT = [0, 0.55, -0.16];
  const P_KEEL_TAIL = [0, -1.30, -0.38];
  const P_L_UNDER = [-0.48, -1.22, 0.16];
  const P_R_UNDER = [0.48, -1.22, 0.16];

  // Authentic Duo-Tone Origami Paper (Side A: White / Side B: Craft Slate Gray)
  const paperTriangles = [
    // --- Side A: Top Surface (Crisp White Cotton Paper) ---
    ...P_NOSE, ...P_L_TIP, ...P_L_INNER,        // 0. Left main wing (white top)
    ...P_NOSE, ...P_R_INNER, ...P_R_TIP,        // 1. Right main wing (white top)
    ...P_NOSE, ...P_L_INNER, ...P_SPINE_TAIL,   // 2. Center valley left (white top)
    ...P_NOSE, ...P_SPINE_TAIL, ...P_R_INNER,   // 3. Center valley right (white top)

    // --- Side B: Underside & Reverse Folds (Craft Slate Gray Paper) ---
    ...P_NOSE, ...P_L_INNER, ...P_L_TIP,        // 4. Left main wing underside (gray)
    ...P_NOSE, ...P_R_TIP, ...P_R_INNER,        // 5. Right main wing underside (gray)
    ...P_NOSE, ...P_SPINE_TAIL, ...P_L_INNER,   // 6. Center valley left underside (gray)
    ...P_NOSE, ...P_R_INNER, ...P_SPINE_TAIL,   // 7. Center valley right underside (gray)

    // Keel & Underwing Folds (Outer faces - Craft Slate Gray)
    ...P_NOSE, ...P_KEEL_FRONT, ...P_L_INNER,   // 8. Keel left front
    ...P_KEEL_FRONT, ...P_KEEL_TAIL, ...P_L_INNER, // 9. Keel left back
    ...P_NOSE, ...P_R_INNER, ...P_KEEL_FRONT,   // 10. Keel right front
    ...P_KEEL_FRONT, ...P_R_INNER, ...P_KEEL_TAIL, // 11. Keel right back
    ...P_NOSE, ...P_L_INNER, ...P_L_UNDER,      // 12. Underwing tuck left
    ...P_NOSE, ...P_R_UNDER, ...P_R_INNER,      // 13. Underwing tuck right

    // Keel & Underwing Folds (Inner faces - Craft Slate Gray)
    ...P_NOSE, ...P_L_INNER, ...P_KEEL_FRONT,   // 14. Keel inner left front
    ...P_KEEL_FRONT, ...P_L_INNER, ...P_KEEL_TAIL, // 15. Keel inner left back
    ...P_NOSE, ...P_KEEL_FRONT, ...P_R_INNER,   // 16. Keel inner right front
    ...P_KEEL_FRONT, ...P_KEEL_TAIL, ...P_R_INNER, // 17. Keel inner right back
    ...P_NOSE, ...P_L_UNDER, ...P_L_INNER,      // 18. Underwing inner left
    ...P_NOSE, ...P_R_INNER, ...P_R_UNDER,      // 19. Underwing inner right
  ];

  const paperGeo = new THREE.BufferGeometry();
  paperGeo.setAttribute('position', new THREE.Float32BufferAttribute(paperTriangles, 3));

  // Planar UV projection for paper texture mapping
  const paperUVs: number[] = [];
  for (let i = 0; i < paperTriangles.length; i += 3) {
    const vx = paperTriangles[i];
    const vy = paperTriangles[i + 1];
    paperUVs.push((vx + 1.6) / 3.2, (vy + 1.4) / 3.4);
  }
  paperGeo.setAttribute('uv', new THREE.Float32BufferAttribute(paperUVs, 2));

  // Duo-Tone Origami Facet Coloring:
  // Triangles 0-3: Crisp Archival White stationery (top)
  // Triangles 4-19: Rich Slate Craft Gray paper (reverse/underside)
  const facetColors = [
    // Top White Surface
    0.96, 0.96, 0.98, // 0. Left main wing top
    0.99, 0.99, 1.00, // 1. Right main wing top
    0.90, 0.91, 0.93, // 2. Center valley left top
    0.93, 0.94, 0.96, // 3. Center valley right top

    // Underside Gray Surface (Craft Slate Gray)
    0.52, 0.55, 0.60, // 4. Left wing underside
    0.58, 0.61, 0.66, // 5. Right wing underside
    0.46, 0.49, 0.54, // 6. Center valley left underside
    0.48, 0.51, 0.56, // 7. Center valley right underside

    // Keel & Underwing Folds Outer (Craft Slate Gray)
    0.48, 0.51, 0.56, // 8. Keel left front
    0.42, 0.45, 0.50, // 9. Keel left back
    0.54, 0.57, 0.62, // 10. Keel right front
    0.46, 0.49, 0.54, // 11. Keel right back
    0.40, 0.43, 0.48, // 12. Underwing tuck left
    0.44, 0.47, 0.52, // 13. Underwing tuck right

    // Keel & Underwing Folds Inner (Craft Slate Gray)
    0.44, 0.47, 0.52, // 14. Keel inner left front
    0.38, 0.41, 0.46, // 15. Keel inner left back
    0.50, 0.53, 0.58, // 16. Keel inner right front
    0.42, 0.45, 0.50, // 17. Keel inner right back
    0.36, 0.39, 0.44, // 18. Underwing inner left
    0.40, 0.43, 0.48, // 19. Underwing inner right
  ];

  const totalTriangles = 20;
  const paperColors: number[] = [];
  for (let t = 0; t < totalTriangles; t++) {
    const cr = facetColors[t * 3];
    const cg = facetColors[t * 3 + 1];
    const cb = facetColors[t * 3 + 2];
    for (let v = 0; v < 3; v++) {
      paperColors.push(cr, cg, cb);
    }
  }
  paperGeo.setAttribute('color', new THREE.Float32BufferAttribute(paperColors, 3));
  paperGeo.computeVertexNormals();

  const paperMesh = new THREE.Mesh(paperGeo, paperMaterial);
  paperPlaneGroup.add(paperMesh);

  const paperLinePoints = [
    ...P_NOSE, ...P_L_TIP,
    ...P_NOSE, ...P_R_TIP,
    ...P_L_TIP, ...P_L_INNER,
    ...P_R_TIP, ...P_R_INNER,
    ...P_L_INNER, ...P_SPINE_TAIL,
    ...P_R_INNER, ...P_SPINE_TAIL,
    ...P_NOSE, ...P_SPINE_TAIL,
    ...P_NOSE, ...P_L_INNER,
    ...P_NOSE, ...P_R_INNER,
  ];

  const paperLineGeo = new THREE.BufferGeometry();
  paperLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(paperLinePoints, 3));
  const paperLines = new THREE.LineSegments(paperLineGeo, creaseMaterial);
  paperPlaneGroup.add(paperLines);

  const dispose = () => {
    paperGeo.dispose();
    paperLineGeo.dispose();
    paperTexture.dispose();
    paperBumpTexture.dispose();
    paperMaterial.dispose();
    creaseMaterial.dispose();
  };

  return {
    paperPlaneGroup,
    paperMesh,
    paperLines,
    textures: [paperTexture, paperBumpTexture],
    geometries: [paperGeo, paperLineGeo],
    materials: [paperMaterial, creaseMaterial],
    dispose,
  };
}

// ==========================================
// 3. 3D Chrome "404" Extruded Typography
// ==========================================

export function create3D404Typography(
  chromeMaterial: THREE.Material,
  paperMaterial?: THREE.Material | THREE.Material[],
  creaseMaterial?: THREE.LineBasicMaterial
): Typography3D {
  const code404Group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const lineGeometries: THREE.BufferGeometry[] = [];

  function createDigitShape4(): THREE.Shape {
    const s = new THREE.Shape();
    s.moveTo(0.82, -0.68);
    s.lineTo(0.82, -0.28);
    s.lineTo(1.0, -0.28);
    s.lineTo(1.0, 0.02);
    s.lineTo(0.82, 0.02);
    s.lineTo(0.82, 0.68);
    s.lineTo(0.5, 0.68);
    s.lineTo(-0.12, 0.02);
    s.lineTo(-0.12, -0.28);
    s.lineTo(0.5, -0.28);
    s.lineTo(0.5, -0.68);
    s.closePath();

    const hole = new THREE.Path();
    hole.moveTo(0.5, 0.02);
    hole.lineTo(0.18, 0.02);
    hole.lineTo(0.5, 0.44);
    hole.closePath();
    s.holes.push(hole);
    return s;
  }

  function createDigitShape0(): THREE.Shape {
    const s = new THREE.Shape();
    const w = 0.48, h = 0.68, r = 0.24;
    s.moveTo(-w + r, -h);
    s.lineTo(w - r, -h);
    s.absarc(w - r, -h + r, r, -Math.PI / 2, 0, false);
    s.lineTo(w, h - r);
    s.absarc(w - r, h - r, r, 0, Math.PI / 2, false);
    s.lineTo(-w + r, h);
    s.absarc(-w + r, h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(-w, -h + r);
    s.absarc(-w + r, -h + r, r, Math.PI, Math.PI * 1.5, false);

    const hole = new THREE.Path();
    const hw = 0.2, hh = 0.4, hr = 0.1;
    hole.moveTo(-hw + hr, -hh);
    hole.lineTo(hw - hr, -hh);
    hole.absarc(hw - hr, -hh + hr, hr, -Math.PI / 2, 0, false);
    hole.lineTo(hw, hh - hr);
    hole.absarc(hw - hr, hh - hr, hr, 0, Math.PI / 2, false);
    hole.lineTo(-hw + hr, hh);
    hole.absarc(-hw + hr, hh - hr, hr, Math.PI / 2, Math.PI, false);
    hole.lineTo(-hw, -hh + hr);
    hole.absarc(-hw + hr, -hh + hr, hr, Math.PI, Math.PI * 1.5, false);
    s.holes.push(hole);
    return s;
  }

  function createExtrusion(shape: THREE.Shape, bevelSegments: number): THREE.ExtrudeGeometry {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: bevelSegments > 1 ? 0.12 : 0.08,
      bevelSize: bevelSegments > 1 ? 0.1 : 0.08,
      bevelSegments,
      steps: 1,
    });
    geo.center();
    geometries.push(geo);
    return geo;
  }

  function applyPaperPlanarUVs(geo: THREE.BufferGeometry) {
    geo.computeBoundingBox();
    const bbox = geo.boundingBox!;
    const rangeX = bbox.max.x - bbox.min.x || 1;
    const rangeY = bbox.max.y - bbox.min.y || 1;
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    if (!uv) return;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      uv.setXY(i, (x - bbox.min.x) / rangeX, (y - bbox.min.y) / rangeY);
    }
    uv.needsUpdate = true;
  }

  // 1. Chrome Starship Typography (Dark Mode - smooth 10-segment bevels)
  const chromeGroup = new THREE.Group();
  const cGeo4_1 = createExtrusion(createDigitShape4(), 10);
  const cGeo0 = createExtrusion(createDigitShape0(), 10);
  const cGeo4_2 = createExtrusion(createDigitShape4(), 10);

  const cMesh4_1 = new THREE.Mesh(cGeo4_1, chromeMaterial);
  cMesh4_1.position.x = -1.05;
  chromeGroup.add(cMesh4_1);

  const cMesh0 = new THREE.Mesh(cGeo0, chromeMaterial);
  cMesh0.position.x = 0;
  chromeGroup.add(cMesh0);

  const cMesh4_2 = new THREE.Mesh(cGeo4_2, chromeMaterial);
  cMesh4_2.position.x = 1.05;
  chromeGroup.add(cMesh4_2);

  let paperGroup: THREE.Group | undefined;

  // 2. Origami Papercraft Typography (Light Mode)
  if (paperMaterial) {
    paperGroup = new THREE.Group();
    const pGeo4_1 = createExtrusion(createDigitShape4(), 1);
    const pGeo0 = createExtrusion(createDigitShape0(), 1);
    const pGeo4_2 = createExtrusion(createDigitShape4(), 1);

    applyPaperPlanarUVs(pGeo4_1);
    applyPaperPlanarUVs(pGeo0);
    applyPaperPlanarUVs(pGeo4_2);

    const pMesh4_1 = new THREE.Mesh(pGeo4_1, paperMaterial);
    pMesh4_1.position.x = -1.05;
    paperGroup.add(pMesh4_1);

    const pMesh0 = new THREE.Mesh(pGeo0, paperMaterial);
    pMesh0.position.x = 0;
    paperGroup.add(pMesh0);

    const pMesh4_2 = new THREE.Mesh(pGeo4_2, paperMaterial);
    pMesh4_2.position.x = 1.05;
    paperGroup.add(pMesh4_2);

    if (creaseMaterial) {
      const lineGroup = new THREE.Group();
      [
        { geo: pGeo4_1, x: -1.05 },
        { geo: pGeo0, x: 0 },
        { geo: pGeo4_2, x: 1.05 },
      ].forEach(({ geo, x }) => {
        const edgeGeo = new THREE.EdgesGeometry(geo, 15);
        lineGeometries.push(edgeGeo);
        const lines = new THREE.LineSegments(edgeGeo, creaseMaterial);
        lines.position.x = x;
        lineGroup.add(lines);
      });
      paperGroup.add(lineGroup);
    }

    code404Group.add(chromeGroup);
    code404Group.add(paperGroup);
  } else {
    code404Group.add(cMesh4_1);
    code404Group.add(cMesh0);
    code404Group.add(cMesh4_2);
  }

  const dispose = () => {
    geometries.forEach((g) => g.dispose());
    lineGeometries.forEach((g) => g.dispose());
  };

  return {
    code404Group,
    chromeGroup,
    paperGroup,
    geometries,
    dispose,
  };
}

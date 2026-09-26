import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { StarfieldEngine } from '../four-oh-four/starfield';
import {
  buildFlightCurve,
  computeFlightProgress,
  computeFlightVelocity,
  computeThrottle,
  computeFlightOrientation,
  makeAttitude,
  FLIGHT_DURATION,
} from '../four-oh-four/flight-trajectory';
import {
  createOrigamiPaperPlane,
  createStarshipRocket,
  create3D404Typography,
  generatePaperTextures,
} from '../four-oh-four/vessel-factory';

describe('four-oh-four modules', () => {
  describe('StarfieldEngine', () => {
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
      canvas = {
        width: 800,
        height: 600,
        getContext: vi.fn().mockReturnValue({
          clearRect: vi.fn(),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          stroke: vi.fn(),
          arc: vi.fn(),
          fill: vi.fn(),
          scale: vi.fn(),
          resetTransform: vi.fn(),
        }),
      } as unknown as HTMLCanvasElement;
    });

    it('initializes with default star count', () => {
      const engine = new StarfieldEngine(canvas, 100);
      expect(engine.getStars().length).toBe(100);
      const star = engine.getStars()[0];
      expect(star).toHaveProperty('x');
      expect(star).toHaveProperty('y');
      expect(star).toHaveProperty('z');
      expect(star).toHaveProperty('speedMult');
    });

    it('resizes canvas and handles render tick', () => {
      const engine = new StarfieldEngine(canvas, 50);
      engine.resize(800, 600);
      expect(canvas.width).toBeGreaterThanOrEqual(800);

      // Render dark mode
      expect(() => engine.render(0.016, 0.5, 0.5, false, false, true)).not.toThrow();

      // Render light mode
      expect(() => engine.render(0.016, 0.5, 0.5, true, false, false)).not.toThrow();
    });

    it('handles FlightMotion object with dynamic speed, warpRatio, and lateral parallax', () => {
      const engine = new StarfieldEngine(canvas, 50);
      engine.resize(800, 600);

      // Render with outbound warp FlightMotion
      expect(() =>
        engine.render(
          0.016,
          0.5,
          0.5,
          { speedRatio: 0.85, warpRatio: 0.85, vx: 6.2, vz: -60.0, isOutbound: true },
          false,
          true
        )
      ).not.toThrow();

      // Render with return leg FlightMotion (warpRatio = 0)
      expect(() =>
        engine.render(
          0.016,
          0.5,
          0.5,
          { speedRatio: 0.85, warpRatio: 0, vx: -2.0, vz: 60.0, isOutbound: false },
          false,
          true
        )
      ).not.toThrow();

      // Render with idle FlightMotion
      expect(() =>
        engine.render(0.016, 0.5, 0.5, { speedRatio: 0, warpRatio: 0, vx: 0, vz: 0 }, false, false)
      ).not.toThrow();
    });
  });

  describe('flight-trajectory', () => {
    it('builds a closed loop flight curve returning to home pad', () => {
      const homePos = new THREE.Vector3(2.5, 1.0, 0);
      const curve = buildFlightCurve(homePos);

      expect(curve.points.length).toBeGreaterThan(10);

      const start = curve.getPoint(0);
      const end = curve.getPoint(1);

      expect(start.distanceTo(homePos)).toBeLessThan(0.001);
      expect(end.distanceTo(homePos)).toBeLessThan(0.001);
    });

    it('computes smooth continuous flight progress with zero endpoint acceleration', () => {
      expect(computeFlightProgress(0)).toBe(0);
      expect(computeFlightProgress(1)).toBe(1);

      // Smooth midpoint transition (no artificial turning linger)
      expect(computeFlightProgress(0.5)).toBeCloseTo(0.5, 3);

      // Verify strict monotonicity (continuous forward motion)
      let prev = 0;
      for (let t = 0.05; t <= 1.0; t += 0.05) {
        const curr = computeFlightProgress(t);
        expect(curr).toBeGreaterThanOrEqual(prev);
        prev = curr;
      }
    });

    it('computes instantaneous velocity, speed ratio, and directional warp across the trajectory', () => {
      const homePos = new THREE.Vector3(2.8, -1.8, 0);
      const curve = buildFlightCurve(homePos);

      // Endpoint rest (liftoff and touchdown)
      const vStart = computeFlightVelocity(curve, 0.0);
      expect(vStart.speed).toBeCloseTo(0.0, 2);
      expect(vStart.speedRatio).toBeCloseTo(0.0, 2);
      expect(vStart.warpRatio).toBe(0.0);
      expect(vStart.isOutbound).toBe(false);

      const vEnd = computeFlightVelocity(curve, 1.0);
      expect(vEnd.speed).toBeCloseTo(0.0, 2);
      expect(vEnd.speedRatio).toBeCloseTo(0.0, 2);
      expect(vEnd.warpRatio).toBe(0.0);
      expect(vEnd.isOutbound).toBe(false);

      // Supersonic outbound cruise (Z heading into deep space: vz < 0, active warp)
      const vOut = computeFlightVelocity(curve, 0.35);
      expect(vOut.speed).toBeGreaterThan(40.0);
      expect(vOut.speedRatio).toBeGreaterThan(0.5);
      expect(vOut.velocity.z).toBeLessThan(0);
      expect(vOut.warpRatio).toBeGreaterThan(0.5);
      expect(vOut.isOutbound).toBe(true);

      // Apex banking turn (Z = -100, sweeping across X: vx > 0, warp dissolved)
      const vApex = computeFlightVelocity(curve, 0.50);
      expect(vApex.velocity.x).toBeGreaterThan(0);
      expect(vApex.warpRatio).toBe(0.0);
      expect(vApex.isOutbound).toBe(false);

      // Supersonic return cruise (Z heading back towards camera: vz > 0, serene background warp = 0)
      const vReturn = computeFlightVelocity(curve, 0.65);
      expect(vReturn.speed).toBeGreaterThan(40.0);
      expect(vReturn.velocity.z).toBeGreaterThan(0);
      expect(vReturn.warpRatio).toBe(0.0);
      expect(vReturn.isOutbound).toBe(false);
    });

    it('computes throttle properly for dark vs light mode', () => {
      expect(FLIGHT_DURATION).toBe(10.0);

      // Light mode: zero engine throttle
      const lightThrottle = computeThrottle(0.5, false);
      expect(lightThrottle.throttle).toBe(0);
      expect(lightThrottle.plumeOpacity).toBe(0);
      expect(lightThrottle.lightIntensity).toBe(0);

      // Dark mode: active throttle during flight
      const darkThrottle = computeThrottle(0.5, true);
      expect(darkThrottle.throttle).toBeGreaterThan(0);
      expect(darkThrottle.plumeOpacity).toBeGreaterThan(0);
      expect(darkThrottle.lightIntensity).toBeGreaterThan(0);
    });

    it('computes flight orientation quaternions', () => {
      const homePos = new THREE.Vector3(0, 0, 0);
      const curve = buildFlightCurve(homePos);
      const up = new THREE.Vector3(0, 1, 0);
      const targetQuat = new THREE.Quaternion();

      const qMid = computeFlightOrientation(curve, 0.5, 0.5, targetQuat, up);
      expect(qMid.length()).toBeCloseTo(1.0, 3);

      const qNearEnd = computeFlightOrientation(curve, 0.95, 0.95, targetQuat, up);
      expect(qNearEnd.length()).toBeCloseTo(1.0, 3);
    });

    it('constructs orthonormal attitude matrices with makeAttitude showcasing wings and keel fold', () => {
      const forward: [number, number, number] = [-0.96, -0.22, 0.12];
      const up: [number, number, number] = [0, 1, 0];
      const q = makeAttitude(forward, up, -20);

      expect(q.length()).toBeCloseTo(1.0, 4);

      // Verify the vessel's nose (local +Y) aligns directly with the forward target direction
      const nose = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      const fNorm = new THREE.Vector3(...forward).normalize();
      expect(nose.dot(fNorm)).toBeCloseTo(1.0, 3);

      // Verify dorsal / top surface (local +Z) faces upwards (+Y)
      const dorsal = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      expect(dorsal.y).toBeGreaterThan(0.5);

      // Verify keel / bottom surface (local -Z) faces downwards (-Y) to display the bottom fold
      const keel = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
      expect(keel.y).toBeLessThan(-0.5);
    });
  });

  describe('vessel-factory', () => {
    it('generates procedural paper textures with canvas wrap', () => {
      const { diffuse, bump } = generatePaperTextures();
      expect(diffuse).toBeInstanceOf(THREE.CanvasTexture);
      expect(bump).toBeInstanceOf(THREE.CanvasTexture);
      expect(diffuse.wrapS).toBe(THREE.RepeatWrapping);
      diffuse.dispose();
      bump.dispose();
    });

    it('creates origami paper plane with UV mapping and vertex colors', () => {
      const vessel = createOrigamiPaperPlane();
      expect(vessel.paperMesh).toBeInstanceOf(THREE.Mesh);
      expect(vessel.paperLines).toBeInstanceOf(THREE.LineSegments);

      const geo = vessel.paperMesh.geometry;
      expect(geo.getAttribute('position')).toBeDefined();
      expect(geo.getAttribute('uv')).toBeDefined();
      expect(geo.getAttribute('color')).toBeDefined();

      const mat = vessel.paperMesh.material as THREE.MeshStandardMaterial;
      expect(mat.flatShading).toBe(true);
      expect(mat.vertexColors).toBe(true);
      expect(mat.envMapIntensity).toBe(0);

      expect(() => vessel.dispose()).not.toThrow();
    });

    it('creates SpaceX Starship with flaps and plumes', () => {
      const chromeMat = new THREE.MeshBasicMaterial();
      const bellMat = new THREE.MeshBasicMaterial();
      const plumeMat = new THREE.MeshBasicMaterial();
      const corePlumeMat = new THREE.MeshBasicMaterial();

      const starship = createStarshipRocket(chromeMat, bellMat, plumeMat, corePlumeMat);
      expect(starship.rocketGroup.children.length).toBeGreaterThan(5);
      expect(starship.flaps.fwdLeftPivot).toBeDefined();
      expect(starship.flaps.aftRightPivot).toBeDefined();
      expect(starship.plumeGroup).toBeDefined();

      expect(() => starship.dispose()).not.toThrow();
      chromeMat.dispose();
      bellMat.dispose();
      plumeMat.dispose();
      corePlumeMat.dispose();
    });

    it('creates 3D extruded 404 typography', () => {
      const chromeMat = new THREE.MeshBasicMaterial();
      const typography = create3D404Typography(chromeMat);

      expect(typography.code404Group.children.length).toBe(3);
      expect(typography.geometries.length).toBe(3);

      expect(() => typography.dispose()).not.toThrow();
      chromeMat.dispose();
    });

    it('creates dual-mode typography when paperMaterial is provided', () => {
      const chromeMat = new THREE.MeshBasicMaterial();
      const paperMat = new THREE.MeshBasicMaterial();
      const creaseMat = new THREE.LineBasicMaterial();
      const typography = create3D404Typography(chromeMat, paperMat, creaseMat);

      expect(typography.chromeGroup).toBeDefined();
      expect(typography.paperGroup).toBeDefined();
      expect(typography.chromeGroup!.children.length).toBe(3);
      expect(typography.paperGroup!.children.length).toBe(4); // 3 digits + 1 lineGroup
      expect(typography.code404Group.children.length).toBe(2); // chromeGroup + paperGroup

      expect(() => typography.dispose()).not.toThrow();
      chromeMat.dispose();
      paperMat.dispose();
      creaseMat.dispose();
    });
  });
});

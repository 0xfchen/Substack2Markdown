/**
 * flight-trajectory.ts
 *
 * 3D Catmull-Rom flight curve, head-first aerobatic trajectory,
 * and engine throttle / gliding calculation.
 */

import * as THREE from 'three';

export const FLIGHT_DURATION = 10.0;

export function buildFlightCurve(homePos: THREE.Vector3): THREE.CatmullRomCurve3 {
  const pHome = homePos.clone();

  const points: THREE.Vector3[] = [
    // 0. Liftoff pad at home
    pHome.clone(),

    // 1. Snappy liftoff surge & quick pitchover into flight
    pHome.clone().add(new THREE.Vector3(0.02, 0.9, -2.5)),
    pHome.clone().add(new THREE.Vector3(-0.25, 1.8, -18.0)),

    // 2. High-speed supersonic dash deep into cosmic space / distant sky
    new THREE.Vector3(pHome.x * 0.2, pHome.y + 2.0, -50.0),
    new THREE.Vector3(-1.0, pHome.y + 1.8, -90.0),
    new THREE.Vector3(-2.2, pHome.y + 1.2, -130.0),
    new THREE.Vector3(-3.5, pHome.y + 0.6, -165.0),

    // 3. Furthest apex distance: sweeping turn deep across cosmic starfield at Z = -180
    new THREE.Vector3(-1.8, pHome.y + 0.2, -178.0),
    new THREE.Vector3(1.5, pHome.y - 0.2, -180.0),
    new THREE.Vector3(4.8, pHome.y + 0.4, -172.0),

    // 4. Return leg cruising back across the celestial background
    new THREE.Vector3(4.0, pHome.y + 1.2, -130.0),
    new THREE.Vector3(pHome.x + 2.6, pHome.y + 1.6, -75.0),
    new THREE.Vector3(pHome.x + 1.5, pHome.y + 1.2, -25.0),

    // 5. Final approach & touchdown flare
    pHome.clone().add(new THREE.Vector3(0.30, 0.50, -5.0)),
    pHome.clone().add(new THREE.Vector3(0.08, 0.15, -1.2)),

    // 6. Soft touchdown on home pad
    pHome.clone(),
  ];

  return new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
}

/**
 * Computes smooth flight curve progress from normalized elapsed time (uRaw).
 * Uses smoothstep for snappy liftoff and pitchover off the pad, continuous high-speed
 * outbound cruise through the distant cosmic expanse, and gentle touchdown flare.
 */
export function computeFlightProgress(uRaw: number): number {
  const t = Math.min(1.0, Math.max(0.0, uRaw));
  return t * t * (3.0 - 2.0 * t);
}

/**
 * Computes instantaneous 3D flight velocity, scalar speed ratio, and directional warp ratio.
 * Implements Cinematic Asymmetric Narrative (Option 2):
 * - Outbound flight (vz < 0, uRaw < 0.49): warpRatio accelerates into deep space with long streaks.
 * - Apex turn (vz ~ 0): warpRatio dissolves to 0 while lateral velocity (vx) drives banking parallax.
 * - Inbound return (vz > 0): warpRatio remains at 0 (serene celestial drift) while the craft's
 *   exponential looming approach, engine landing burns, and flap flutter take center stage.
 *
 * @param flightCurve 3D Catmull-Rom spline trajectory.
 * @param uRaw Normalized flight time (0.0 to 1.0).
 * @param duration Total flight duration in seconds.
 * @returns Instantaneous 3D velocity vector, scalar speed, speed ratio, and directional warp ratio.
 */
export function computeFlightVelocity(
  flightCurve: THREE.CatmullRomCurve3,
  uRaw: number,
  duration = FLIGHT_DURATION
): { velocity: THREE.Vector3; speed: number; speedRatio: number; warpRatio: number; isOutbound: boolean } {
  const t = Math.min(1.0, Math.max(0.0, uRaw));
  // Derivative of smoothstep: 6*t*(1-t)
  const du_duRaw = 6.0 * t * (1.0 - t);
  const du_dt = du_duRaw / duration;

  const u = computeFlightProgress(uRaw);
  const eps = 0.001;
  const u1 = Math.max(0, u - eps);
  const u2 = Math.min(1, u + eps);
  const p1 = flightCurve.getPoint(u1);
  const p2 = flightCurve.getPoint(u2);
  const dp_du = p2.sub(p1).divideScalar(u2 - u1);
  const velocity = dp_du.multiplyScalar(du_dt);
  const speed = velocity.length();

  // Peak travel speed across the trajectory is ~110 units/sec
  const speedRatio = Math.min(1.0, speed / 110.0);

  // Directional outbound warp: active only while rocketing away into deep space (-vz)
  const isOutbound = velocity.z < -0.1 && uRaw < 0.49;
  const warpRatio = isOutbound ? Math.min(1.0, Math.max(0, -velocity.z) / 95.0) : 0;

  return { velocity, speed, speedRatio, warpRatio, isOutbound };
}

export function computeThrottle(
  uProgress: number,
  isDark: boolean
): {
  throttle: number;
  plumeOpacity: number;
  coreOpacity: number;
  lightIntensity: number;
  plumeScale: number;
} {
  if (!isDark) {
    return {
      throttle: 0,
      plumeOpacity: 0,
      coreOpacity: 0,
      lightIntensity: 0,
      plumeScale: 0.8,
    };
  }

  // Dark mode Starship engine cycle:
  // Phase 1: Launch burn (uRaw: 0.0 -> 0.25)
  // Phase 2: Coast / deep space transit (uRaw: 0.25 -> 0.65)
  // Phase 3: Landing burn ignition (uRaw: 0.65 -> 0.94)
  // Phase 4: Touchdown cut-off (uRaw: 0.94 -> 1.0)
  let throttle = 0;
  if (uProgress < 0.25) {
    throttle = 0.85 + Math.random() * 0.15;
  } else if (uProgress < 0.65) {
    throttle = 0.35 + Math.random() * 0.15;
  } else if (uProgress < 0.94) {
    throttle = 0.80 + Math.random() * 0.20;
  } else {
    throttle = Math.max(0, (1.0 - uProgress) / 0.06);
  }

  return {
    throttle,
    plumeOpacity: throttle * 0.85,
    coreOpacity: throttle * 0.95,
    lightIntensity: throttle * 4.0,
    plumeScale: 0.8 + throttle * 0.45,
  };
}

export function makeAttitude(forward: [number, number, number], up: [number, number, number], bankDeg = 0): THREE.Quaternion {
  const f = new THREE.Vector3(...forward).normalize();
  const uRef = new THREE.Vector3(...up).normalize();
  const r = new THREE.Vector3().crossVectors(f, uRef).normalize();
  const u = new THREE.Vector3().crossVectors(r, f).normalize();

  if (Math.abs(bankDeg) > 0.001) {
    const rad = THREE.MathUtils.degToRad(bankDeg);
    r.applyAxisAngle(f, rad);
    u.crossVectors(r, f).normalize();
  }

  const mat = new THREE.Matrix4();
  mat.makeBasis(r, f, u);
  return new THREE.Quaternion().setFromRotationMatrix(mat);
}

// Keyframe attitudes ensuring HEAD (nose) always flies forward:
// Forward = local +Y (nose)
// Dorsal = local +Z (top of vessel)
// Wing = local +X (right wing)
interface AttitudeKeyframe {
  u: number;
  quat: THREE.Quaternion;
}

// Keyframe attitudes ensuring HEAD (nose) always flies forward:
// Forward = local +Y (nose)
// Dorsal = local +Z (top of vessel)
// Wing = local +X (right wing)
const ATTITUDE_KEYFRAMES: AttitudeKeyframe[] = [
  // 0. Rest on pad: nose pointing up, dorsal pointing towards viewer (+Z)
  { u: 0.00, quat: makeAttitude([0.04, 0.98, 0.18], [0.0, -0.18, 0.98]) },
  // 1. Snappy liftoff tilt completed immediately (by u = 0.028 / ~0.9s off pad)!
  // Nose points decisively into deep space (-Z)
  { u: 0.028, quat: makeAttitude([0.0, 0.04, -1.00], [0.0, 1.00, 0.04]) },
  // 2. Extended deep space outbound cruise (-Z)
  { u: 0.42, quat: makeAttitude([0.0, 0.0, -1.00], [0.0, 1.00, 0.0]) },
  // 3. Apogee turn entry: turning towards +X in deep space, banked left
  { u: 0.47, quat: makeAttitude([0.65, 0.05, -0.75], [0.0, 1.00, 0.0], -25) },
  // 4. Apogee apex: sweeping across starfield (+X), banked
  { u: 0.50, quat: makeAttitude([0.98, 0.05, 0.15], [0.0, 1.00, 0.0], -15) },
  // 5. Apogee exit: heading turning towards viewer (+Z), banked
  { u: 0.53, quat: makeAttitude([0.55, 0.05, 0.83], [0.0, 1.00, 0.0], -10) },
  // 6. High speed flyback: HEAD DIRECTLY TOWARDS SCREEN (+Z)!
  { u: 0.65, quat: makeAttitude([0.08, -0.05, 0.99], [0.0, 1.00, 0.05], -5) },
  // 7. Approach corridor: HEAD DIRECTLY TOWARDS SCREEN (+Z)!
  { u: 0.82, quat: makeAttitude([0.04, -0.10, 0.99], [0.0, 1.00, 0.10], 0) },
  // 8. Upright braking flare: nose flaring up towards sky!
  { u: 0.92, quat: makeAttitude([0.04, 0.65, 0.76], [0.0, 0.76, -0.65], 0) },
  // 9. Final touchdown flare: nose nearly vertical!
  { u: 0.97, quat: makeAttitude([0.04, 0.94, 0.34], [0.0, 0.34, -0.94], 0) },
  // 10. Soft touchdown on pad: exactly matches rest orientation!
  { u: 1.00, quat: makeAttitude([0.04, 0.98, 0.18], [0.0, -0.18, 0.98]) },
];

export function computeFlightOrientation(
  flightCurve: THREE.CatmullRomCurve3,
  u: number,
  uRaw: number,
  targetQuat: THREE.Quaternion,
  upVector: THREE.Vector3
): THREE.Quaternion {
  const clampedU = Math.min(1.0, Math.max(0.0, u));
  let idx = 0;
  for (let i = 0; i < ATTITUDE_KEYFRAMES.length - 1; i++) {
    if (clampedU <= ATTITUDE_KEYFRAMES[i + 1].u) {
      idx = i;
      break;
    }
  }

  const k1 = ATTITUDE_KEYFRAMES[idx];
  const k2 = ATTITUDE_KEYFRAMES[idx + 1];
  const span = k2.u - k1.u;
  const f = span > 0 ? (clampedU - k1.u) / span : 0;
  const fSmooth = f * f * (3.0 - 2.0 * f);

  const baseQuat = k1.quat.clone().slerp(k2.quat, fSmooth);

  // Modulate with mouse target aim orientation:
  // Only blend during very first moment off pad (u < 0.015) and final touchdown (u > 0.96)
  // to avoid impeding the snappy pitchover into flight
  const landingBlend = u < 0.015
    ? (1.0 - u / 0.015)
    : u > 0.96
      ? THREE.MathUtils.smoothstep(u, 0.96, 1.0)
      : 0.0;

  if (landingBlend > 0.001) {
    baseQuat.slerp(targetQuat, landingBlend * 0.85);
  }
  return baseQuat;
}

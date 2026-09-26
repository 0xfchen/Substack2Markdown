/**
 * starfield.ts
 *
 * 2D Canvas Starfield simulation with perspective zoom, mouse parallax, and warp acceleration.
 */

import type { BgStar, FlightMotion } from './types';

export class StarfieldEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private stars: BgStar[] = [];
  private width: number = 0;
  private height: number = 0;
  private starCount: number;

  constructor(canvas: HTMLCanvasElement, starCount = 320, initialWidth = 800, initialHeight = 600) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.starCount = starCount;
    const w = typeof window !== 'undefined' ? window.innerWidth : initialWidth;
    const h = typeof window !== 'undefined' ? window.innerHeight : initialHeight;
    this.resize(w, h);
  }

  public initStars(w: number, h: number): void {
    this.stars = [];
    for (let i = 0; i < this.starCount; i++) {
      const r = Math.random();
      const z = 20 + Math.random() * 980;
      this.stars.push({
        x: (Math.random() - 0.5) * w * 2.2,
        y: (Math.random() - 0.5) * h * 2.2,
        z,
        pz: z,
        size: 0.8 + Math.random() * 1.6,
        baseAlpha: 0.35 + Math.random() * 0.6,
        speedMult: 0.75 + Math.random() * 0.6,
        colorType: r < 0.7 ? 'white' : r < 0.9 ? 'blue' : 'gold',
      });
    }
  }

  public resize(w: number, h: number): void {
    if (!this.canvas || !this.ctx || w <= 0 || h <= 0) return;
    this.width = w;
    this.height = h;
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
    if (this.stars.length === 0) {
      this.initStars(w, h);
    }
  }

  public render(
    dt: number,
    mouseX: number,
    mouseY: number,
    flightState: boolean | FlightMotion,
    prefersReducedMotion: boolean,
    isDark: boolean
  ): void {
    if (!this.ctx || this.width <= 0 || this.height <= 0) return;

    this.ctx.clearRect(0, 0, this.width, this.height);

    const isFlightActive =
      typeof flightState === 'boolean' ? flightState : flightState.speedRatio > 0.001;
    const speedRatio =
      typeof flightState === 'boolean'
        ? (flightState ? 1.0 : 0.0)
        : Math.max(0, Math.min(1.0, flightState.speedRatio));
    const warpRatio =
      typeof flightState === 'object' && flightState.warpRatio !== undefined
        ? Math.max(0, Math.min(1.0, flightState.warpRatio))
        : speedRatio;
    const vx = typeof flightState === 'object' && flightState.vx ? flightState.vx : 0;

    // Lateral camera / vessel pan parallax during banking turns
    const panX = -vx * 0.8;
    const centerX = this.width * 0.5 + (mouseX - 0.5) * 40 + panX;
    const centerY = this.height * 0.5 + (mouseY - 0.5) * 30;
    const fov = this.width * 0.65;
    const baseSpeed = prefersReducedMotion ? 10 : 28;
    const maxFlyBoost = prefersReducedMotion ? 60 : 460;
    const flyBoost = maxFlyBoost * warpRatio;
    const speedPerSec = baseSpeed + flyBoost;

    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      s.pz = s.z;
      s.z -= speedPerSec * s.speedMult * dt;

      // Reset star if it passes the camera or gets too close
      if (s.z <= 12) {
        s.z = 1000;
        s.pz = 1000;
        s.x = (Math.random() - 0.5) * this.width * 2.2;
        s.y = (Math.random() - 0.5) * this.height * 2.2;
      }

      const k = fov / s.z;
      const px = centerX + s.x * k;
      const py = centerY + s.y * k;

      // Screen boundary check
      if (px < -60 || px > this.width + 60 || py < -60 || py > this.height + 60) {
        s.z = 1000;
        s.pz = 1000;
        s.x = (Math.random() - 0.5) * this.width * 2.2;
        s.y = (Math.random() - 0.5) * this.height * 2.2;
        continue;
      }

      const depth = 1 - s.z / 1000;
      const radius = Math.max(0.5, s.size * (0.6 + depth * 2.2));
      const alpha = Math.min(1.0, s.baseAlpha * (0.15 + depth * 0.85));

      const color = isDark
        ? s.colorType === 'blue'
          ? `rgba(186, 230, 253, ${alpha})`
          : s.colorType === 'gold'
            ? `rgba(254, 240, 138, ${alpha})`
            : `rgba(255, 255, 255, ${alpha})`
        : s.colorType === 'blue'
          ? `rgba(56, 189, 248, ${alpha * 0.88})`
          : s.colorType === 'gold'
            ? `rgba(234, 179, 8, ${alpha * 0.78})`
            : `rgba(100, 116, 139, ${alpha * 0.85})`;

      // Draw motion streak connecting previous position along the zoom vector
      const pk = fov / s.pz;
      const prevPx = centerX + s.x * pk;
      const prevPy = centerY + s.y * pk;
      const travelDist = Math.hypot(px - prevPx, py - prevPy);

      const streakActive = travelDist > 1.2 || (isFlightActive && warpRatio > 0.12);

      if (streakActive) {
        this.ctx.beginPath();
        this.ctx.moveTo(prevPx, prevPy);
        this.ctx.lineTo(px, py);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = radius * (1.0 + 0.4 * warpRatio);
        this.ctx.lineCap = 'round';
        this.ctx.stroke();
      }

      // Star head point
      this.ctx.beginPath();
      this.ctx.arc(px, py, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = color;
      this.ctx.fill();
    }
  }

  public getStars(): readonly BgStar[] {
    return this.stars;
  }
}

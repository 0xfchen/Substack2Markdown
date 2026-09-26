/**
 * timeline.ts
 *
 * Chronological Timeline Controller and Universe Expansion playback engine.
 */

import * as THREE from 'three';
import type { PopAnim, SimNode } from './types';

export class TimelineManager {
  public minTime: number = Infinity;
  public maxTime: number = -Infinity;
  public nodeBirthTimestamps: Float64Array;
  public wasBorn: Uint8Array;
  public activePopAnimations: Map<number, PopAnim> = new Map();
  public timelineFraction: number = 1.0;
  public isPlaying: boolean = false;
  public playbackSpeed: number = 1.0;
  public lastTimelineTime: number = 0;

  constructor(nodes: SimNode[]) {
    const len = nodes.length;
    for (let i = 0; i < len; i++) {
      const ts = nodes[i].timestamp;
      if (typeof ts === 'number' && ts > 0) {
        if (ts < this.minTime) this.minTime = ts;
        if (ts > this.maxTime) this.maxTime = ts;
      }
    }
    if (!Number.isFinite(this.minTime)) this.minTime = Date.now() - 365 * 24 * 3600 * 1000;
    if (!Number.isFinite(this.maxTime) || this.maxTime <= this.minTime) {
      this.maxTime = this.minTime + 365 * 24 * 3600 * 1000;
    }

    this.nodeBirthTimestamps = new Float64Array(len);
    this.wasBorn = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      const ts = typeof nodes[i].timestamp === 'number' && (nodes[i].timestamp as number) > 0
        ? (nodes[i].timestamp as number)
        : this.minTime;
      this.nodeBirthTimestamps[i] = ts;
      this.wasBorn[i] = 1; // Initially all nodes are present at timelineFraction = 1.0
    }
  }

  public getCutoffTime(): number {
    return this.minTime + this.timelineFraction * (this.maxTime - this.minTime);
  }

  public isPresent(): boolean {
    return this.timelineFraction >= 0.999;
  }

  public updateHUD(containerEl: HTMLElement, visiblePosts: number, totalPosts: number): void {
    const isPresent = this.isPresent();
    const cutoffTime = this.getCutoffTime();

    const timelineDate = containerEl.querySelector<HTMLElement>('[data-timeline-date]');
    if (timelineDate) {
      if (isPresent) {
        timelineDate.textContent = 'All Time';
      } else {
        const d = new Date(cutoffTime);
        timelineDate.textContent = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }
    }

    const timelineCount = containerEl.querySelector<HTMLElement>('[data-timeline-count]');
    if (timelineCount) {
      const pct = totalPosts > 0 ? Math.round((visiblePosts / totalPosts) * 100) : 100;
      timelineCount.textContent = `${visiblePosts} / ${totalPosts} articles (${pct}%)`;
    }

    const timelineProgress = containerEl.querySelector<HTMLElement>('[data-timeline-progress-fill]');
    if (timelineProgress) {
      timelineProgress.style.width = `${Math.min(100, Math.max(0, this.timelineFraction * 100))}%`;
    }

    const timelinePresentBtn = containerEl.querySelector<HTMLButtonElement>('[data-timeline-present-btn]');
    if (timelinePresentBtn) {
      timelinePresentBtn.classList.toggle('active', isPresent);
    }
  }

  public setPlaying(containerEl: HTMLElement, playing: boolean): void {
    this.isPlaying = playing;
    const timelinePlayBtn = containerEl.querySelector<HTMLButtonElement>('[data-timeline-play-btn]');
    if (timelinePlayBtn) {
      const iconPlay = timelinePlayBtn.querySelector('.icon-play');
      const iconPause = timelinePlayBtn.querySelector('.icon-pause');
      iconPlay?.classList.toggle('hidden', this.isPlaying);
      iconPause?.classList.toggle('hidden', !this.isPlaying);
      const dark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
      const mode = dark ? 'Universe Expansion' : 'Knowledge Evolution';
      timelinePlayBtn.setAttribute('aria-label', this.isPlaying ? `Pause ${mode}` : `Play ${mode}`);
      timelinePlayBtn.title = this.isPlaying ? `Pause ${mode}` : `Play ${mode}`;
    }
  }

  public cycleSpeed(containerEl: HTMLElement): void {
    if (this.playbackSpeed === 1.0) this.playbackSpeed = 2.0;
    else if (this.playbackSpeed === 2.0) this.playbackSpeed = 4.0;
    else this.playbackSpeed = 1.0;

    const timelineSpeedLabel = containerEl.querySelector<HTMLElement>('[data-timeline-speed-label]');
    if (timelineSpeedLabel) {
      timelineSpeedLabel.textContent = `${this.playbackSpeed}x`;
    }
  }

  public updatePopAnimations(now: number, nodeMeshes: THREE.Mesh[], dark: boolean): void {
    if (this.activePopAnimations.size === 0) return;

    for (const [idx, anim] of this.activePopAnimations.entries()) {
      const elapsed = now - anim.startTime;
      const progress = Math.min(1.0, Math.max(0, elapsed / anim.duration));
      const m = nodeMeshes[idx];
      const baseScale = (m.userData.baseScale as number) || 1.0;
      const mat = m.material as THREE.MeshStandardMaterial;

      if (progress >= 1.0) {
        m.scale.set(baseScale, baseScale, baseScale);
        mat.emissiveIntensity = dark ? 0.35 : 0.0;
        this.activePopAnimations.delete(idx);
      } else {
        const spring = 1.0 + 1.25 * Math.sin(progress * Math.PI) * Math.pow(1 - progress, 0.55);
        const curScale = baseScale * spring;
        m.scale.set(curScale, curScale, curScale);

        const flash = Math.sin(progress * Math.PI);
        mat.emissiveIntensity = (dark ? 0.35 : 0.0) + flash * (dark ? 0.8 : 0.4);
      }
    }
  }
}

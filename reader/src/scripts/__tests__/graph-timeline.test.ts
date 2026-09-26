import { describe, expect, it } from 'vitest';
import { TimelineManager } from '../graph/timeline';
import type { SimNode } from '../graph/types';

function createMockSimNode(id: string, timestamp: number, type: 'post' | 'tag' | 'author' = 'post'): SimNode {
  return {
    id,
    name: id,
    type,
    group: 'test',
    val: 2.0,
    timestamp,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
  };
}

describe('TimelineManager', () => {
  it('correctly calculates minTime and maxTime across nodes', () => {
    const t1 = 1600000000000;
    const t2 = 1700000000000;
    const nodes = [
      createMockSimNode('p1', t1),
      createMockSimNode('p2', t2),
      createMockSimNode('tag1', 0, 'tag'),
    ];

    const timeline = new TimelineManager(nodes);
    expect(timeline.minTime).toBe(t1);
    expect(timeline.maxTime).toBe(t2);
    expect(timeline.nodeBirthTimestamps[0]).toBe(t1);
    expect(timeline.nodeBirthTimestamps[1]).toBe(t2);
    expect(timeline.nodeBirthTimestamps[2]).toBe(t1);
  });

  it('initializes all nodes as born (wasBorn = 1) on startup', () => {
    const nodes = [
      createMockSimNode('p1', 1600000000000),
      createMockSimNode('p2', 1700000000000),
    ];

    const timeline = new TimelineManager(nodes);
    expect(timeline.wasBorn[0]).toBe(1);
    expect(timeline.wasBorn[1]).toBe(1);
    expect(timeline.isPresent()).toBe(true);
    expect(timeline.activePopAnimations.size).toBe(0);
  });

  it('cycles playback speed 1x -> 2x -> 4x -> 1x', () => {
    let labelText = '';
    const container = {
      querySelector: (selector: string) => {
        if (selector === '[data-timeline-speed-label]') {
          return {
            set textContent(val: string) {
              labelText = val;
            },
            get textContent() {
              return labelText;
            },
          };
        }
        return null;
      },
    } as any;

    const timeline = new TimelineManager([]);
    expect(timeline.playbackSpeed).toBe(1.0);

    timeline.cycleSpeed(container);
    expect(timeline.playbackSpeed).toBe(2.0);
    expect(labelText).toBe('2x');

    timeline.cycleSpeed(container);
    expect(timeline.playbackSpeed).toBe(4.0);
    expect(labelText).toBe('4x');

    timeline.cycleSpeed(container);
    expect(timeline.playbackSpeed).toBe(1.0);
    expect(labelText).toBe('1x');
  });

  it('updates playing state and button aria-label', () => {
    const attrs = new Map<string, string>();
    const playBtn = {
      querySelector: () => ({ classList: { toggle: () => {} } }),
      setAttribute: (k: string, v: string) => attrs.set(k, v),
      getAttribute: (k: string) => attrs.get(k) || null,
      title: '',
    };
    const container = {
      querySelector: (s: string) => (s === '[data-timeline-play-btn]' ? playBtn : null),
    } as any;

    const timeline = new TimelineManager([]);
    timeline.setPlaying(container, true);
    expect(timeline.isPlaying).toBe(true);
    expect(playBtn.getAttribute('aria-label')).toMatch(/Pause (Knowledge Evolution|Universe Expansion)/);

    timeline.setPlaying(container, false);
    expect(timeline.isPlaying).toBe(false);
    expect(playBtn.getAttribute('aria-label')).toMatch(/Play (Knowledge Evolution|Universe Expansion)/);
  });
});

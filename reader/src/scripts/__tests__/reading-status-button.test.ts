import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  updateControlUI,
  syncAllControls,
  initReadingStatusButtons,
} from '../reading-status-button';
import * as readingTracker from '../reading-tracker';

class MockElement {
  tagName: string;
  attributes = new Map<string, string>();
  dataset: Record<string, string> = {};
  children: MockElement[] = [];
  classList = {
    classes: new Set<string>(),
    toggle: (cls: string, force?: boolean) => {
      if (force === true) this.classList.classes.add(cls);
      else if (force === false) this.classList.classes.delete(cls);
      else {
        if (this.classList.classes.has(cls)) this.classList.classes.delete(cls);
        else this.classList.classes.add(cls);
      }
    },
    contains: (cls: string) => this.classList.classes.has(cls),
  };
  hidden = false;
  textContent = '';
  title = '';
  parentElement: MockElement | null = null;
  listeners: Record<string, Function[]> = {};

  constructor(tagName = 'div') {
    this.tagName = tagName;
  }

  setAttribute(name: string, val: string) {
    this.attributes.set(name, val);
    if (name.startsWith('data-')) {
      const prop = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[prop] = val;
    }
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name: string) {
    return this.attributes.has(name);
  }

  appendChild(child: MockElement) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  querySelector<T = MockElement>(sel: string): T | null {
    for (const child of this.children) {
      if (this.matchesSelector(child, sel)) return child as unknown as T;
      const found = child.querySelector<T>(sel);
      if (found) return found;
    }
    return null;
  }

  querySelectorAll<T = MockElement>(sel: string): T[] {
    const res: T[] = [];
    for (const child of this.children) {
      if (this.matchesSelector(child, sel)) res.push(child as unknown as T);
      res.push(...child.querySelectorAll<T>(sel));
    }
    return res;
  }

  closest<T = MockElement>(sel: string): T | null {
    let curr: MockElement | null = this;
    while (curr) {
      if (this.matchesSelector(curr, sel)) return curr as unknown as T;
      curr = curr.parentElement;
    }
    return null;
  }

  private matchesSelector(el: MockElement, sel: string): boolean {
    if (sel.startsWith('[') && sel.endsWith(']')) {
      const attr = sel.slice(1, -1);
      return el.hasAttribute(attr);
    }
    if (sel.startsWith('.')) {
      return el.classList.contains(sel.slice(1));
    }
    return el.tagName.toLowerCase() === sel.toLowerCase();
  }
}

describe('reading-status-button runtime', () => {
  let body: MockElement;
  let docListeners: Record<string, Function[]> = {};
  let winListeners: Record<string, Function[]> = {};

  beforeEach(() => {
    body = new MockElement('body');
    docListeners = {};
    winListeners = {};

    (global as any).document = {
      body,
      createElement: (tag: string) => new MockElement(tag),
      querySelectorAll: (sel: string) => body.querySelectorAll(sel),
      querySelector: (sel: string) => body.querySelector(sel),
      addEventListener: (type: string, fn: Function) => {
        docListeners[type] = docListeners[type] || [];
        docListeners[type].push(fn);
      },
    };

    (global as any).window = {
      addEventListener: (type: string, fn: Function) => {
        winListeners[type] = winListeners[type] || [];
        winListeners[type].push(fn);
      },
    };

    vi.spyOn(readingTracker, 'fetchReadingState').mockResolvedValue({} as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (global as any).document;
    delete (global as any).window;
  });

  function createMockControl(slug: string): HTMLElement {
    const el = new MockElement('div');
    el.setAttribute('data-reading-status-control', '');
    el.dataset.slug = slug;

    const btn = new MockElement('button');
    btn.setAttribute('data-status-btn', '');

    const icon = new MockElement('span');
    icon.setAttribute('data-status-icon', '');
    icon.textContent = '○';

    const text = new MockElement('span');
    text.setAttribute('data-status-text', '');
    text.textContent = 'To Read';

    const badge = new MockElement('span');
    badge.setAttribute('data-read-count', '');
    badge.hidden = true;

    btn.appendChild(icon);
    btn.appendChild(text);
    btn.appendChild(badge);
    el.appendChild(btn);

    body.appendChild(el);
    return el as unknown as HTMLElement;
  }

  describe('updateControlUI', () => {
    it('updates control to pending / To Read state', () => {
      const el = createMockControl('post-1');
      updateControlUI(el, 'pending', 0);

      expect(el.getAttribute('data-status')).toBe('pending');
      expect(el.querySelector('[data-status-icon]')?.textContent).toBe('○');
      expect(el.querySelector('[data-status-text]')?.textContent).toBe('To Read');
      expect(el.querySelector<HTMLElement>('[data-read-count]')?.hidden).toBe(true);
    });

    it('updates control to in-progress / Reading state', () => {
      const el = createMockControl('post-2');
      updateControlUI(el, 'in-progress', 1);

      expect(el.getAttribute('data-status')).toBe('in-progress');
      expect(el.querySelector('[data-status-icon]')?.textContent).toBe('◑');
      expect(el.querySelector('[data-status-text]')?.textContent).toBe('Reading');
      expect(el.querySelector<HTMLElement>('[data-read-count]')?.hidden).toBe(false);
      expect(el.querySelector<HTMLElement>('[data-read-count]')?.textContent).toBe('1×');
    });

    it('updates control to completed state with multiple reads badge', () => {
      const el = createMockControl('post-3');
      updateControlUI(el, 'completed', 3);

      expect(el.getAttribute('data-status')).toBe('completed');
      expect(el.querySelector('[data-status-icon]')?.textContent).toBe('✓');
      expect(el.querySelector('[data-status-text]')?.textContent).toBe('Complete');
      expect(el.querySelector<HTMLElement>('[data-read-count]')?.hidden).toBe(false);
      expect(el.querySelector<HTMLElement>('[data-read-count]')?.textContent).toBe('3×');
    });
  });

  describe('syncAllControls', () => {
    it('synchronizes all controls on the page matching target slug', () => {
      const el1 = createMockControl('article-alpha');
      const el2 = createMockControl('article-alpha');
      const elOther = createMockControl('article-beta');

      syncAllControls('article-alpha', 'completed', 2);

      expect(el1.getAttribute('data-status')).toBe('completed');
      expect(el2.getAttribute('data-status')).toBe('completed');
      expect(elOther.getAttribute('data-status')).toBeNull();
    });
  });

  describe('initReadingStatusButtons', () => {
    it('initializes without throwing', () => {
      createMockControl('test-post');
      expect(() => initReadingStatusButtons()).not.toThrow();
    });
  });
});

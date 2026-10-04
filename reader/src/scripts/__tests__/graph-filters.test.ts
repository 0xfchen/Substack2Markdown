/**
 * graph-filters.test.ts
 *
 * Unit tests for pure graph filtering logic (matchesNodeCategory and matchesNodeSearch).
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  matchesNodeCategory,
  matchesNodeSearch,
  setupGraphFilterControls,
} from '../graph/filters';
import { GRAPH_SELECTORS } from '../graph/selectors';
import type { GraphNode } from '../graph/types';

describe('Graph Filters Logic', () => {
  const sampleArticle: GraphNode = {
    id: 'post-1',
    name: 'Distributed Systems Architecture',
    type: 'post',
    val: 10,
    author: 'Martin Fowler',
    subtitle: 'Patterns in enterprise integration',
    tags: ['Architecture', 'Distributed Systems'],
    readingTime: 12,
  };

  const sampleShortArticle: GraphNode = {
    id: 'post-2',
    name: 'Quick Update',
    type: 'post',
    val: 5,
    author: 'Kent Beck',
    subtitle: 'Daily reflections',
    tags: ['Agile'],
    readingTime: 3,
  };

  const sampleTopicHub: GraphNode = {
    id: 'tag-arch',
    name: 'Architecture',
    type: 'tag',
    val: 8,
  };

  const samplePublicationHub: GraphNode = {
    id: 'author-pragmatic',
    name: 'The Pragmatic Engineer',
    type: 'author',
    val: 15,
  };

  describe('matchesNodeCategory', () => {
    it('matches all nodes when category mode is all', () => {
      expect(matchesNodeCategory(sampleArticle, 'all')).toBe(true);
      expect(matchesNodeCategory(sampleTopicHub, 'all')).toBe(true);
      expect(matchesNodeCategory(samplePublicationHub, 'all')).toBe(true);
    });

    it('matches only publication nodes for publications mode', () => {
      expect(matchesNodeCategory(samplePublicationHub, 'publications')).toBe(true);
      expect(matchesNodeCategory(sampleArticle, 'publications')).toBe(false);
      expect(matchesNodeCategory(sampleTopicHub, 'publications')).toBe(false);
    });

    it('matches only tag nodes for tags mode', () => {
      expect(matchesNodeCategory(sampleTopicHub, 'tags')).toBe(true);
      expect(matchesNodeCategory(sampleArticle, 'tags')).toBe(false);
      expect(matchesNodeCategory(samplePublicationHub, 'tags')).toBe(false);
    });

    it('matches only post nodes for articles mode', () => {
      expect(matchesNodeCategory(sampleArticle, 'articles')).toBe(true);
      expect(matchesNodeCategory(sampleShortArticle, 'articles')).toBe(true);
      expect(matchesNodeCategory(sampleTopicHub, 'articles')).toBe(false);
    });

    it('filters long reads (>= 10 min)', () => {
      expect(matchesNodeCategory(sampleArticle, 'long-reads')).toBe(true);
      expect(matchesNodeCategory(sampleShortArticle, 'long-reads')).toBe(false);
      expect(matchesNodeCategory(sampleTopicHub, 'long-reads')).toBe(false);
    });

    it('filters quick reads (< 5 min)', () => {
      expect(matchesNodeCategory(sampleShortArticle, 'quick-reads')).toBe(true);
      expect(matchesNodeCategory(sampleArticle, 'quick-reads')).toBe(false);
      expect(matchesNodeCategory(sampleTopicHub, 'quick-reads')).toBe(false);
    });

    it('filters by reading status for post nodes', () => {
      const readArticle: GraphNode = {
        ...sampleArticle,
        readingStatus: 'completed',
      };
      const unreadArticle: GraphNode = {
        ...sampleShortArticle,
        readingStatus: 'unread',
      };
      const defaultArticle: GraphNode = {
        ...sampleArticle,
        readingStatus: undefined,
      };

      expect(matchesNodeCategory(readArticle, 'status:completed')).toBe(true);
      expect(matchesNodeCategory(readArticle, 'status:unread')).toBe(false);
      expect(matchesNodeCategory(unreadArticle, 'status:unread')).toBe(true);
      expect(matchesNodeCategory(defaultArticle, 'status:unread')).toBe(true);
      expect(matchesNodeCategory(sampleTopicHub, 'status:completed')).toBe(false);
    });
  });

  describe('matchesNodeSearch', () => {
    it('returns true when query is empty or whitespace', () => {
      expect(matchesNodeSearch(sampleArticle, '')).toBe(true);
      expect(matchesNodeSearch(sampleArticle, '   ')).toBe(true);
    });

    it('matches case-insensitively on node name', () => {
      expect(matchesNodeSearch(sampleArticle, 'distributed')).toBe(true);
      expect(matchesNodeSearch(sampleArticle, 'SYSTEMS')).toBe(true);
      expect(matchesNodeSearch(sampleArticle, 'unrelated')).toBe(false);
    });

    it('matches on author name and subtitle', () => {
      expect(matchesNodeSearch(sampleArticle, 'fowler')).toBe(true);
      expect(matchesNodeSearch(sampleArticle, 'enterprise integration')).toBe(true);
    });

    it('matches on tags array', () => {
      expect(matchesNodeSearch(sampleArticle, 'Architecture')).toBe(true);
      expect(matchesNodeSearch(sampleShortArticle, 'Agile')).toBe(true);
      expect(matchesNodeSearch(sampleShortArticle, 'DevOps')).toBe(false);
    });
  });

  describe('setupGraphFilterControls DOM Integration', () => {
    class MockFilterElement {
      public tagName: string;
      public attributes = new Map<string, string>();
      public classSet = new Set<string>();
      public value: string = '';
      public parentElement: MockFilterElement | null = null;
      public children: MockFilterElement[] = [];
      public listeners: Record<string, Array<() => void>> = {};

      constructor(tagName: string = 'div') {
        this.tagName = tagName;
      }

      public setAttribute(name: string, val: string): void {
        this.attributes.set(name, val);
      }

      public getAttribute(name: string): string | null {
        return this.attributes.get(name) ?? null;
      }

      public get classList() {
        return {
          add: (cls: string) => this.classSet.add(cls),
          remove: (cls: string) => this.classSet.delete(cls),
          contains: (cls: string) => this.classSet.has(cls),
          toggle: (cls: string, force?: boolean) => {
            if (force === true) this.classSet.add(cls);
            else if (force === false) this.classSet.delete(cls);
            else if (this.classSet.has(cls)) this.classSet.delete(cls);
            else this.classSet.add(cls);
          },
        };
      }

      public appendChild(child: MockFilterElement): MockFilterElement {
        child.parentElement = this;
        this.children.push(child);
        return child;
      }

      public addEventListener(event: string, fn: () => void): void {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(fn);
      }

      public removeEventListener(event: string, fn: () => void): void {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter((l) => l !== fn);
      }

      public click(): void {
        if (this.listeners['click']) {
          for (const listener of [...this.listeners['click']]) {
            listener();
          }
        }
      }

      public dispatchInput(newValue: string): void {
        this.value = newValue;
        if (this.listeners['input']) {
          for (const listener of [...this.listeners['input']]) {
            listener();
          }
        }
      }

      public closest(selector: string): MockFilterElement | null {
        let current: MockFilterElement | null = this;
        while (current) {
          if (
            selector === '.graph-filter-mode-group' &&
            current.classSet.has('graph-filter-mode-group')
          ) {
            return current;
          }
          current = current.parentElement;
        }
        return null;
      }

      public querySelector<T = MockFilterElement>(selector: string): T | null {
        return (this.querySelectorAll<T>(selector)[0] as T) || null;
      }

      public querySelectorAll<T = MockFilterElement>(selector: string): T[] {
        const results: MockFilterElement[] = [];
        const check = (el: MockFilterElement) => {
          const matchFilterButtons =
            selector.includes('[data-filter]') &&
            (el.attributes.has('data-filter') ||
              el.attributes.has('data-graph-filter'));
          const matchSearchInput =
            selector.includes('[data-graph-search]') &&
            el.attributes.has('data-graph-search');
          if (matchFilterButtons || matchSearchInput) {
            results.push(el);
          }
          for (const child of el.children) {
            check(child);
          }
        };
        for (const child of this.children) {
          check(child);
        }
        return results as unknown as T[];
      }
    }

    let rootContainer: MockFilterElement;
    let onFiltersChangedCallCount = 0;
    const handleFiltersChanged = () => {
      onFiltersChangedCallCount++;
    };
    let searchInput: MockFilterElement;
    let pubButton: MockFilterElement;
    let allButton: MockFilterElement;
    let readButton: MockFilterElement;

    beforeEach(() => {
      rootContainer = new MockFilterElement('div');
      rootContainer.setAttribute('data-graph-container', '');

      searchInput = new MockFilterElement('input');
      searchInput.setAttribute('data-graph-search', '');
      rootContainer.appendChild(searchInput);

      const topicGroup = new MockFilterElement('div');
      topicGroup.classList.add('graph-filter-mode-group');
      topicGroup.setAttribute('data-filters-topic', '');

      allButton = new MockFilterElement('button');
      allButton.classList.add('graph-filter-btn');
      allButton.classList.add('active');
      allButton.setAttribute('data-filter', 'all');
      topicGroup.appendChild(allButton);

      pubButton = new MockFilterElement('button');
      pubButton.classList.add('graph-filter-btn');
      pubButton.setAttribute('data-filter', 'publications');
      topicGroup.appendChild(pubButton);

      rootContainer.appendChild(topicGroup);

      const readingGroup = new MockFilterElement('div');
      readingGroup.classList.add('graph-filter-mode-group');
      readingGroup.setAttribute('data-filters-reading', '');

      readButton = new MockFilterElement('button');
      readButton.classList.add('graph-filter-btn');
      readButton.setAttribute('data-filter', 'status:completed');
      readingGroup.appendChild(readButton);

      rootContainer.appendChild(readingGroup);

      onFiltersChangedCallCount = 0;
    });

    it('binds to filter buttons and toggles active class on click', () => {
      const controller = setupGraphFilterControls(
        rootContainer as unknown as HTMLElement,
        handleFiltersChanged
      );
      expect(controller.getActiveFilter()).toBe('all');

      pubButton.click();

      expect(pubButton.classList.contains('active')).toBe(true);
      expect(allButton.classList.contains('active')).toBe(false);
      expect(controller.getActiveFilter()).toBe('publications');
      expect(onFiltersChangedCallCount).toBe(1);

      controller.dispose();
    });

    it('manages active states within parent filter groups independently', () => {
      const controller = setupGraphFilterControls(
        rootContainer as unknown as HTMLElement,
        handleFiltersChanged
      );

      readButton.click();

      expect(readButton.classList.contains('active')).toBe(true);
      expect(controller.getActiveFilter()).toBe('status:completed');
      expect(onFiltersChangedCallCount).toBe(1);

      controller.dispose();
    });

    it('tracks text search input and triggers change callback', () => {
      const controller = setupGraphFilterControls(
        rootContainer as unknown as HTMLElement,
        handleFiltersChanged
      );

      searchInput.dispatchInput('distributed systems');

      expect(controller.getSearchQuery()).toBe('distributed systems');
      expect(onFiltersChangedCallCount).toBe(1);

      controller.dispose();
    });

    it('unregisters event listeners cleanly upon dispose', () => {
      const controller = setupGraphFilterControls(
        rootContainer as unknown as HTMLElement,
        handleFiltersChanged
      );
      controller.dispose();

      pubButton.click();
      searchInput.dispatchInput('test');

      expect(onFiltersChangedCallCount).toBe(0);
    });
  });

  describe('GRAPH_SELECTORS Contract & Template Drift Verification', () => {
    it('ensures every selector in GRAPH_SELECTORS exists in ThreeGraphScene.astro template', () => {
      const astroTemplatePath = path.resolve(__dirname, '../../components/ThreeGraphScene.astro');
      expect(fs.existsSync(astroTemplatePath)).toBe(true);
      const astroTemplateContent = fs.readFileSync(astroTemplatePath, 'utf-8');

      for (const [key, selector] of Object.entries(GRAPH_SELECTORS)) {
        const selectorOptions = selector.split(',').map((s) => s.trim());
        const hasMatchingAttribute = selectorOptions.some((subSelector) => {
          const attributeMatch = subSelector.match(/^\[([^\]]+)\]$/);
          if (!attributeMatch) return false;
          const attributeNameOrExpr = attributeMatch[1];
          return astroTemplateContent.includes(attributeNameOrExpr);
        });

        expect(
          hasMatchingAttribute,
          `GRAPH_SELECTORS.${key} ('${selector}') must match an attribute in ThreeGraphScene.astro`
        ).toBe(true);
      }
    });
  });
});

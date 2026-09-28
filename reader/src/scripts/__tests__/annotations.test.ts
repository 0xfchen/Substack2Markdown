import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateAnnotationId,
  getAllLocalAnnotations,
  getLocalAnnotations,
  saveLocalAnnotations,
  fetchServerAnnotations,
  saveServerAnnotation,
  deleteServerAnnotation,
  mergeAnnotations,
  findTextMatch,
  buildTextMap,
  wrapTextRange,
  clearAnnotations,
  renderAnnotations,
  removeAnnotationMark,
  formatAnnotationsAsMarkdown,
  mountAnnotations,
  extractSelectionQuote,
  AnnotationManager,
  type Annotation,
  type TextNodeMapping,
  STORAGE_KEY,
} from '../annotations';

// ============================================================================
// Lightweight DOM Mock for Node / Vitest
// ============================================================================

class MockNode {
  static ELEMENT_NODE = 1;
  static TEXT_NODE = 3;

  nodeType: number;
  nodeValue: string | null = null;
  parentNode: MockElement | null = null;
  parentElement: MockElement | null = null;

  constructor(nodeType: number, nodeValue: string | null = null) {
    this.nodeType = nodeType;
    this.nodeValue = nodeValue;
  }

  contains(node: MockNode | null): boolean {
    let currentNode: MockNode | null = node;
    while (currentNode) {
      if (currentNode === this) return true;
      currentNode = currentNode.parentNode;
    }
    return false;
  }
}

class MockText extends MockNode {
  constructor(text: string) {
    super(MockNode.TEXT_NODE, text);
  }

  get length(): number {
    return this.nodeValue ? this.nodeValue.length : 0;
  }

  splitText(offset: number): MockText {
    const fullText = this.nodeValue || '';
    const before = fullText.slice(0, offset);
    const after = fullText.slice(offset);
    this.nodeValue = before;

    const nextText = new MockText(after);
    nextText.parentNode = this.parentNode;
    nextText.parentElement = this.parentElement;

    if (this.parentNode) {
      const nodeIndex = this.parentNode.childNodes.indexOf(this);
      if (nodeIndex !== -1) {
        this.parentNode.childNodes.splice(nodeIndex + 1, 0, nextText);
      }
    }
    return nextText;
  }

  replaceWith(newElement: MockElement) {
    if (this.parentNode) {
      const nodeIndex = this.parentNode.childNodes.indexOf(this);
      if (nodeIndex !== -1) {
        this.parentNode.childNodes.splice(nodeIndex, 1, newElement);
        newElement.parentNode = this.parentNode;
        newElement.parentElement = this.parentNode;
        this.parentNode = null;
        this.parentElement = null;
      }
    }
  }
}

class MockElement extends MockNode {
  tagName: string;
  private _className = '';
  get className(): string {
    return this._className;
  }
  set className(val: string) {
    this._className = val;
    this.classList.classes.clear();
    val
      .split(/\s+/)
      .filter(Boolean)
      .forEach((className) => this.classList.classes.add(className));
  }

  attributes = new Map<string, string>();
  dataset: Record<string, string> = {};
  childNodes: MockNode[] = [];
  textContent = '';
  classList = {
    classes: new Set<string>(),
    add: (className: string) => this.classList.classes.add(className),
    remove: (className: string) => this.classList.classes.delete(className),
    contains: (className: string) => this.classList.classes.has(className),
    toggle: (className: string, force?: boolean) => {
      const shouldHave = force !== undefined ? force : !this.classList.classes.has(className);
      if (shouldHave) {
        this.classList.classes.add(className);
      } else {
        this.classList.classes.delete(className);
      }
      return shouldHave;
    },
  };
  style: Record<string, string> = {};
  listeners = new Map<string, ((...args: unknown[]) => void)[]>();

  addEventListener(event: string, fn: (...args: unknown[]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(fn);
  }

  removeEventListener(event: string, fn: (...args: unknown[]) => void) {
    const list = this.listeners.get(event);
    if (list) {
      const listenerIndex = list.indexOf(fn);
      if (listenerIndex !== -1) list.splice(listenerIndex, 1);
    }
  }

  constructor(tagName = 'div') {
    super(MockNode.ELEMENT_NODE, null);
    this.tagName = tagName.toUpperCase();
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
    if (name === 'class') {
      this.className = value;
    }
    if (name.startsWith('data-')) {
      const prop = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[prop] = value;
    }
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
    if (name.startsWith('data-')) {
      const prop = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      delete this.dataset[prop];
    }
  }

  appendChild<T extends MockNode>(child: T): T {
    child.parentNode = this;
    child.parentElement = this;
    this.childNodes.push(child);
    return child;
  }

  replaceWith(...newNodes: MockNode[]) {
    if (this.parentNode) {
      const nodeIndex = this.parentNode.childNodes.indexOf(this);
      if (nodeIndex !== -1) {
        this.parentNode.childNodes.splice(nodeIndex, 1, ...newNodes);
        newNodes.forEach((newNode) => {
          newNode.parentNode = this.parentNode;
          newNode.parentElement = this.parentNode;
        });
        this.parentNode = null;
        this.parentElement = null;
      }
    }
  }

  normalize() {
    for (let i = 0; i < this.childNodes.length; i++) {
      const child = this.childNodes[i];
      if (child.nodeType === MockNode.TEXT_NODE) {
        while (
          i + 1 < this.childNodes.length &&
          this.childNodes[i + 1].nodeType === MockNode.TEXT_NODE
        ) {
          const nextTextNode = this.childNodes[i + 1] as MockText;
          child.nodeValue = (child.nodeValue || '') + (nextTextNode.nodeValue || '');
          this.childNodes.splice(i + 1, 1);
        }
      } else if (child.nodeType === MockNode.ELEMENT_NODE) {
        (child as MockElement).normalize();
      }
    }
  }

  querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];

    const walk = (currentElement: MockElement) => {
      for (const child of currentElement.childNodes) {
        if (child.nodeType === MockNode.ELEMENT_NODE) {
          const elem = child as MockElement;
          if (selector === 'mark.annotation-highlight') {
            if (elem.tagName === 'MARK' && elem.classList.contains('annotation-highlight')) {
              results.push(elem);
            }
          } else if (selector.startsWith('mark.annotation-highlight[data-annotation-id=')) {
            const id = selector.match(/data-annotation-id="([^"]+)"/)?.[1];
            if (
              elem.tagName === 'MARK' &&
              elem.classList.contains('annotation-highlight') &&
              elem.getAttribute('data-annotation-id') === id
            ) {
              results.push(elem);
            }
          } else if (selector === '.annotation-card') {
            if (elem.classList.contains('annotation-card')) {
              results.push(elem);
            }
          }
          walk(elem);
        }
      }
    };

    walk(this);
    return results;
  }

  querySelector(selector: string): MockElement | null {
    const list = this.querySelectorAll(selector);
    return list.length > 0 ? list[0] : null;
  }
}

class MockTreeWalker {
  root: MockNode;
  filter: { acceptNode(node: MockNode): number };
  nodes: MockNode[] = [];
  currentIndex = -1;

  constructor(root: MockNode, filter: { acceptNode(node: MockNode): number }) {
    this.root = root;
    this.filter = filter;
    this.buildList(root);
  }

  private buildList(currentNode: MockNode) {
    if (currentNode !== this.root) {
      if (currentNode.nodeType === MockNode.TEXT_NODE) {
        const filterResult = this.filter.acceptNode(currentNode);
        if (filterResult === 1) {
          this.nodes.push(currentNode);
        }
      }
    }
    if (currentNode.nodeType === MockNode.ELEMENT_NODE) {
      const currentElement = currentNode as MockElement;
      for (const child of currentElement.childNodes) {
        this.buildList(child);
      }
    }
  }

  nextNode(): MockNode | null {
    this.currentIndex++;
    if (this.currentIndex < this.nodes.length) {
      return this.nodes[this.currentIndex];
    }
    return null;
  }
}

// ============================================================================
// Global Setup
// ============================================================================

const mockStorage = new Map<string, string>();

function setupTestEnvironment() {
  mockStorage.clear();

  (global as any).Node = MockNode;
  (global as any).Text = MockText;
  (global as any).HTMLElement = MockElement;
  (global as any).NodeFilter = {
    SHOW_TEXT: 4,
    FILTER_ACCEPT: 1,
    FILTER_REJECT: 2,
    FILTER_SKIP: 3,
  };

  (global as any).document = {
    createElement(tag: string) {
      return new MockElement(tag);
    },
    createTreeWalker(root: MockNode, _whatToShow: number, filter: any) {
      return new MockTreeWalker(root, filter);
    },
    getElementById: vi.fn(),
    querySelector: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  (global as any).window = {
    localStorage: {
      getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        mockStorage.delete(key);
      }),
    },
    getSelection: vi.fn(),
    scrollY: 0,
    scrollX: 0,
    innerWidth: 1024,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  (global as any).fetch = vi.fn();
}

function teardownTestEnvironment() {
  delete (global as any).Node;
  delete (global as any).Text;
  delete (global as any).HTMLElement;
  delete (global as any).NodeFilter;
  delete (global as any).document;
  delete (global as any).window;
  delete (global as any).fetch;
}

// ============================================================================
// Test Suites
// ============================================================================

describe('annotations module', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    teardownTestEnvironment();
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. ID Generation
  // --------------------------------------------------------------------------
  describe('generateAnnotationId', () => {
    it('generates a string starting with ann_ and has unique random suffixes', () => {
      const id1 = generateAnnotationId();
      const id2 = generateAnnotationId();
      expect(id1.startsWith('ann_')).toBe(true);
      expect(id2.startsWith('ann_')).toBe(true);
      expect(id1).not.toBe(id2);
    });
  });

  // --------------------------------------------------------------------------
  // 2. LocalStorage Caching
  // --------------------------------------------------------------------------
  describe('localStorage caching', () => {
    const slug = 'test-author/posts/example';

    it('returns empty record when storage is empty', () => {
      expect(getAllLocalAnnotations()).toEqual({});
      expect(getLocalAnnotations(slug)).toEqual([]);
    });

    it('writes and retrieves annotations for a slug', () => {
      const sample: Annotation[] = [
        {
          id: 'ann_1',
          text: 'hello world',
          prefix: '',
          suffix: '',
          color: 'yellow',
          createdAt: '2026-09-27T12:00:00Z',
          updatedAt: '2026-09-27T12:00:00Z',
        },
      ];

      saveLocalAnnotations(slug, sample);
      expect(getLocalAnnotations(slug)).toEqual(sample);

      const allAnnotations = getAllLocalAnnotations();
      expect(allAnnotations[slug]).toEqual(sample);
    });

    it('removes slug key when empty annotations array is saved', () => {
      saveLocalAnnotations(slug, [
        {
          id: 'ann_1',
          text: 'temp',
          prefix: '',
          suffix: '',
          color: 'blue',
          createdAt: '',
          updatedAt: '',
        },
      ]);
      expect(getLocalAnnotations(slug).length).toBe(1);

      saveLocalAnnotations(slug, []);
      expect(getLocalAnnotations(slug)).toEqual([]);
      expect(getAllLocalAnnotations()[slug]).toBeUndefined();
    });

    it('handles corrupted JSON in localStorage gracefully without throwing', () => {
      mockStorage.set(STORAGE_KEY, '{invalid_json}');
      expect(getAllLocalAnnotations()).toEqual({});
      expect(getLocalAnnotations(slug)).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Dev Server API Integration
  // --------------------------------------------------------------------------
  describe('server API integration', () => {
    const slug = 'author/posts/slug-1';

    it('fetchServerAnnotations returns parsed annotations on success', async () => {
      const serverList = [{ id: 'ann_srv', text: 'abc', color: 'green' }];
      (global as any).fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => serverList,
      });

      const serverAnnotations = await fetchServerAnnotations(slug);
      expect(serverAnnotations).toEqual(serverList);
      expect((global as any).fetch).toHaveBeenCalledWith(
        `/api/annotations?slug=${encodeURIComponent(slug)}`
      );
    });

    it('fetchServerAnnotations returns null on network failure', async () => {
      (global as any).fetch.mockRejectedValueOnce(new Error('Network error'));
      const serverAnnotations = await fetchServerAnnotations(slug);
      expect(serverAnnotations).toBeNull();
    });

    it('saveServerAnnotation posts annotation payload', async () => {
      (global as any).fetch.mockResolvedValueOnce({ ok: true });
      const annotation: Annotation = {
        id: 'ann_save',
        text: 'saved text',
        prefix: 'pre',
        suffix: 'suf',
        color: 'pink',
        createdAt: '2026-09-27T10:00:00Z',
        updatedAt: '2026-09-27T10:00:00Z',
      };

      const success = await saveServerAnnotation(slug, annotation);
      expect(success).toBe(true);
      expect((global as any).fetch).toHaveBeenCalledWith('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, annotation }),
      });
    });

    it('deleteServerAnnotation sends DELETE request with slug and id query params', async () => {
      (global as any).fetch.mockResolvedValueOnce({ ok: true });
      const success = await deleteServerAnnotation(slug, 'ann_del');
      expect(success).toBe(true);
      expect((global as any).fetch).toHaveBeenCalledWith(
        `/api/annotations?slug=${encodeURIComponent(slug)}&id=ann_del`,
        { method: 'DELETE' }
      );
    });
  });

  // --------------------------------------------------------------------------
  // 4. State Merging
  // --------------------------------------------------------------------------
  describe('mergeAnnotations', () => {
    it('merges distinct items from local and server', () => {
      const local: Annotation[] = [
        {
          id: 'ann_local',
          text: 'local note',
          prefix: '',
          suffix: '',
          color: 'yellow',
          createdAt: '2026-09-27T10:00:00Z',
          updatedAt: '2026-09-27T10:00:00Z',
        },
      ];
      const server: Annotation[] = [
        {
          id: 'ann_server',
          text: 'server note',
          prefix: '',
          suffix: '',
          color: 'purple',
          createdAt: '2026-09-27T11:00:00Z',
          updatedAt: '2026-09-27T11:00:00Z',
        },
      ];

      const mergedAnnotations = mergeAnnotations(local, server);
      expect(mergedAnnotations).toHaveLength(2);
      expect(mergedAnnotations.map((annotation) => annotation.id)).toContain('ann_local');
      expect(mergedAnnotations.map((annotation) => annotation.id)).toContain('ann_server');
    });

    it('resolves conflicts in favor of latest updatedAt', () => {
      const localOlder: Annotation = {
        id: 'ann_same',
        text: 'old text',
        prefix: '',
        suffix: '',
        color: 'yellow',
        createdAt: '2026-09-27T10:00:00Z',
        updatedAt: '2026-09-27T10:00:00Z',
      };
      const serverNewer: Annotation = {
        id: 'ann_same',
        text: 'new server text',
        prefix: '',
        suffix: '',
        color: 'green',
        createdAt: '2026-09-27T10:00:00Z',
        updatedAt: '2026-09-27T12:00:00Z',
      };

      const mergedAnnotations1 = mergeAnnotations([localOlder], [serverNewer]);
      expect(mergedAnnotations1[0].text).toBe('new server text');
      expect(mergedAnnotations1[0].color).toBe('green');

      const localNewer: Annotation = {
        ...localOlder,
        text: 'new local text',
        updatedAt: '2026-09-27T14:00:00Z',
      };
      const mergedAnnotations2 = mergeAnnotations([localNewer], [serverNewer]);
      expect(mergedAnnotations2[0].text).toBe('new local text');
    });
  });

  // --------------------------------------------------------------------------
  // 5. TextQuoteSelector Matching Algorithm
  // --------------------------------------------------------------------------
  describe('findTextMatch', () => {
    const documentText =
      'The quick brown fox jumps over the lazy dog. Fox jumps are majestic and fast. Another fox.';

    it('returns exact context match when prefix and suffix match', () => {
      const match = findTextMatch(
        documentText,
        'brown fox',
        'The quick ',
        ' jumps over'
      );
      expect(match).not.toBeNull();
      expect(match?.start).toBe(10);
      expect(match?.end).toBe(19);
      expect(documentText.slice(match!.start, match!.end)).toBe('brown fox');
    });

    it('disambiguates identical repeated phrases using context prefix and suffix', () => {
      const text = 'fox';
      const matchFirst = findTextMatch(documentText, text, 'The quick brown ', ' jumps over');
      expect(matchFirst).not.toBeNull();
      expect(matchFirst?.start).toBe(16);

      const matchLast = findTextMatch(documentText, text, 'Another ', '.');
      expect(matchLast).not.toBeNull();
      expect(matchLast?.start).toBe(86);
    });

    it('falls back to single occurrence match if context is missing', () => {
      const match = findTextMatch(documentText, 'majestic', '', '');
      expect(match).not.toBeNull();
      expect(documentText.slice(match!.start, match!.end)).toBe('majestic');
    });

    it('returns null if text does not exist in fullText', () => {
      const match = findTextMatch(documentText, 'nonexistent phrase', '', '');
      expect(match).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 6. DOM Tree Mapping & Text Extraction
  // --------------------------------------------------------------------------
  describe('buildTextMap', () => {
    it('concatenates text nodes across paragraphs and ignores excluded tags', () => {
      const container = new MockElement('div');
      const paragraphElement = new MockElement('p');
      paragraphElement.appendChild(new MockText('First paragraph. '));

      const script = new MockElement('script');
      script.appendChild(new MockText('console.log("ignore me");'));

      const heading = new MockElement('h2');
      const anchor = new MockElement('a');
      anchor.setAttribute('class', 'heading-anchor');
      anchor.appendChild(new MockText('#'));
      heading.appendChild(anchor);
      heading.appendChild(new MockText('Heading title'));

      container.appendChild(paragraphElement);
      container.appendChild(script);
      container.appendChild(heading);

      const { fullText, textNodes } = buildTextMap(container as any);
      expect(fullText).toBe('First paragraph. Heading title');
      expect(textNodes.length).toBe(2);
      expect(textNodes[0].start).toBe(0);
      expect(textNodes[0].end).toBe(17);
      expect(textNodes[1].start).toBe(17);
      expect(textNodes[1].end).toBe(30);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Selection Serialization
  // --------------------------------------------------------------------------
  describe('extractSelectionQuote', () => {
    it('extracts text and 32-char prefix/suffix within container', () => {
      const container = new MockElement('div');
      const textNode = new MockText(
        'Before context padding 1234567890 Target highlight phrase After context padding 1234567890'
      );
      container.appendChild(textNode);

      const mockRange = {
        commonAncestorContainer: container,
        startContainer: textNode,
        startOffset: 34,
        endContainer: textNode,
        endOffset: 57,
        toString: () => 'Target highlight phrase',
      };

      const mockSelection = {
        rangeCount: 1,
        isCollapsed: false,
        getRangeAt: () => mockRange,
      };

      const quote = extractSelectionQuote(mockSelection as any, container as any);
      expect(quote).not.toBeNull();
      expect(quote?.text).toBe('Target highlight phrase');
      expect(quote?.prefix.length).toBeLessThanOrEqual(32);
      expect(quote?.suffix.length).toBeLessThanOrEqual(32);
    });

    it('returns null for collapsed or empty selections', () => {
      const container = new MockElement('div');
      const mockSelection = {
        rangeCount: 1,
        isCollapsed: true,
        getRangeAt: () => ({ commonAncestorContainer: container, toString: () => '' }),
      };
      expect(extractSelectionQuote(mockSelection as any, container as any)).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 8. DOM Wrapping & Unwrapping
  // --------------------------------------------------------------------------
  describe('wrapTextRange and clearAnnotations', () => {
    it('wraps matched text range into mark.annotation-highlight', () => {
      const container = new MockElement('div');
      const textNode = new MockText('The quick brown fox jumps');
      container.appendChild(textNode);

      const textNodes: TextNodeMapping[] = [
        { node: textNode as any, start: 0, end: 25 },
      ];

      const annotation: Annotation = {
        id: 'ann_test_wrap',
        text: 'brown fox',
        prefix: 'The quick ',
        suffix: ' jumps',
        color: 'yellow',
        note: 'My test note',
        createdAt: '2026-09-27T12:00:00Z',
        updatedAt: '2026-09-27T12:00:00Z',
      };

      const marks = wrapTextRange(textNodes, 10, 19, annotation);
      expect(marks.length).toBe(1);
      expect(marks[0].tagName).toBe('MARK');
      expect(marks[0].getAttribute('data-annotation-id')).toBe('ann_test_wrap');
      expect(marks[0].getAttribute('data-color')).toBe('yellow');
      expect(marks[0].getAttribute('data-has-note')).toBe('true');
      expect(marks[0].getAttribute('title')).toBe('My test note');

      // Unwrapping
      clearAnnotations(container as any);
      const remainingMarks = container.querySelectorAll('mark.annotation-highlight');
      expect(remainingMarks.length).toBe(0);
      expect(container.childNodes.length).toBe(1);
      expect(container.childNodes[0].nodeValue).toBe('The quick brown fox jumps');
    });

    it('removeAnnotationMark removes only marks with matching ID', () => {
      const container = new MockElement('div');
      const textNode = new MockText('Item A Item B');
      container.appendChild(textNode);

      const annotationA: Annotation = {
        id: 'ann_a',
        text: 'Item A',
        prefix: '',
        suffix: '',
        color: 'yellow',
        createdAt: '',
        updatedAt: '',
      };
      const annotationB: Annotation = {
        id: 'ann_b',
        text: 'Item B',
        prefix: '',
        suffix: '',
        color: 'pink',
        createdAt: '',
        updatedAt: '',
      };

      renderAnnotations(container as any, [annotationA, annotationB]);
      expect(container.querySelectorAll('mark.annotation-highlight').length).toBe(2);

      removeAnnotationMark(container as any, 'ann_a');
      const marks = container.querySelectorAll('mark.annotation-highlight');
      expect(marks.length).toBe(1);
      expect(marks[0].getAttribute('data-annotation-id')).toBe('ann_b');
    });
  });

  // --------------------------------------------------------------------------
  // 9. Markdown Export Formatting
  // --------------------------------------------------------------------------
  describe('formatAnnotationsAsMarkdown', () => {
    it('formats highlights and notes into standard Markdown quotes', () => {
      const annotations: Annotation[] = [
        {
          id: 'ann_1',
          text: 'First highlight.\nMulti-line passage.',
          prefix: '',
          suffix: '',
          color: 'yellow',
          note: 'Key insight for architecture',
          createdAt: '2026-09-27T12:00:00Z',
          updatedAt: '2026-09-27T12:00:00Z',
        },
      ];

      const markdownContent = formatAnnotationsAsMarkdown('Architecture Deep Dive', annotations);
      expect(markdownContent).toContain('# Notes & Highlights: Architecture Deep Dive');
      expect(markdownContent).toContain('> First highlight.');
      expect(markdownContent).toContain('> Multi-line passage.');
      expect(markdownContent).toContain('**Note:** Key insight for architecture');
      expect(markdownContent).toContain('Highlighted on');
    });
  });

  // --------------------------------------------------------------------------
  // 10. AnnotationManager Controller Lifecycle
  // --------------------------------------------------------------------------
  describe('AnnotationManager', () => {
    it('initializes from local storage and updates annotations list', async () => {
      const container = new MockElement('div');
      const textNode = new MockText('Article content paragraph for test.');
      container.appendChild(textNode);

      saveLocalAnnotations('author/post-1', [
        {
          id: 'ann_mgr',
          text: 'Article content',
          prefix: '',
          suffix: '',
          color: 'blue',
          createdAt: '2026-09-27T10:00:00Z',
          updatedAt: '2026-09-27T10:00:00Z',
        },
      ]);

      (global as any).fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const manager = new AnnotationManager('author/post-1', container as any);
      await manager.init();

      expect(manager.getAnnotations()).toHaveLength(1);
      expect(manager.getAnnotations()[0].text).toBe('Article content');

      // Update annotation
      await manager.updateAnnotation('ann_mgr', { color: 'pink', note: 'Updated note' });
      expect(manager.getAnnotations()[0].color).toBe('pink');
      expect(manager.getAnnotations()[0].note).toBe('Updated note');

      // Delete annotation
      await manager.deleteAnnotation('ann_mgr');
      expect(manager.getAnnotations()).toHaveLength(0);
      expect(getLocalAnnotations('author/post-1')).toEqual([]);
    });

    it('synchronizes header badge and floating navigation notes button in updateUI', () => {
      const container = new MockElement('div');
      const manager = new AnnotationManager('author/post-sync', container as any);

      const headerCountBadge = new MockElement('span');
      const headerToggleButton = new MockElement('button');
      const floatingNotesBadge = new MockElement('span');
      const floatingNotesToggle = new MockElement('button');
      const floatingNotesTooltip = new MockElement('span');
      const drawerCountElement = new MockElement('span');

      const originalGetElementById = (global as any).document.getElementById;
      (global as any).document.getElementById = (id: string) => {
        if (id === 'post-notes-count') return headerCountBadge;
        if (id === 'post-notes-toggle') return headerToggleButton;
        if (id === 'floating-notes-badge') return floatingNotesBadge;
        if (id === 'floating-notes-toggle') return floatingNotesToggle;
        if (id === 'floating-notes-tooltip') return floatingNotesTooltip;
        if (id === 'drawer-notes-count') return drawerCountElement;
        return null;
      };

      try {
        manager.updateUI();

        expect(headerCountBadge.textContent).toBe('0 notes');
        expect(headerToggleButton.getAttribute('data-count')).toBe('0');
        expect(floatingNotesBadge.textContent).toBe('0');
        expect(floatingNotesBadge.getAttribute('data-count')).toBe('0');
        expect(floatingNotesToggle.getAttribute('data-count')).toBe('0');
        expect(floatingNotesToggle.classList.contains('is-hidden')).toBe(true);
        expect(floatingNotesTooltip.textContent).toBe('Notes');
        expect(drawerCountElement.textContent).toBe('0');
      } finally {
        (global as any).document.getElementById = originalGetElementById;
      }
    });

    it('toggles drawer state open and closed via toggleDrawer', () => {
      const container = new MockElement('div');
      const manager = new AnnotationManager('author/post-toggle', container as any);

      const mockDrawer = new MockElement('aside');
      const mockBackdrop = new MockElement('div');

      const originalGetElementById = (global as any).document.getElementById;
      (global as any).document.getElementById = (id: string) => {
        if (id === 'annotations-drawer') return mockDrawer;
        if (id === 'annotations-backdrop') return mockBackdrop;
        return null;
      };

      try {
        // Initially closed
        expect(mockDrawer.classList.contains('open')).toBe(false);

        // Open
        manager.toggleDrawer();
        expect(mockDrawer.classList.contains('open')).toBe(true);
        expect(mockDrawer.getAttribute('aria-hidden')).toBe('false');
        expect(mockBackdrop.classList.contains('open')).toBe(true);

        // Close
        manager.toggleDrawer();
        expect(mockDrawer.classList.contains('open')).toBe(false);
        expect(mockDrawer.getAttribute('aria-hidden')).toBe('true');
        expect(mockBackdrop.classList.contains('open')).toBe(false);
      } finally {
        (global as any).document.getElementById = originalGetElementById;
      }
    });
  });

  // --------------------------------------------------------------------------
  // 11. mountAnnotations helper
  // --------------------------------------------------------------------------
  describe('mountAnnotations()', () => {
    it('returns null if document is undefined or drawer element missing', () => {
      const originalDocument = (global as any).document;
      delete (global as any).document;
      expect(mountAnnotations()).toBeNull();
      (global as any).document = originalDocument;
    });

    it('returns null if drawer has no data-slug', () => {
      const mockDrawer = new MockElement('aside');
      const originalGetElementById = (global as any).document.getElementById;
      (global as any).document.getElementById = (id: string) => (id === 'annotations-drawer' ? mockDrawer : null);
      expect(mountAnnotations()).toBeNull();
      (global as any).document.getElementById = originalGetElementById;
    });
  });
});

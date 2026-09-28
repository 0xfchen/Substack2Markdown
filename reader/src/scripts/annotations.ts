import { ANNOTATION_COLORS, type AnnotationColor } from '../utils/colors';

export type { AnnotationColor };

export interface Annotation {
  id: string;
  text: string;
  prefix: string;
  suffix: string;
  color: AnnotationColor;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export type AnnotationsRecord = Record<string, Annotation[]>;

export interface TextNodeMapping {
  node: Text;
  start: number;
  end: number;
}

export interface TextMap {
  fullText: string;
  textNodes: TextNodeMapping[];
}

export const CONTEXT_LENGTH = 32;
export const STORAGE_KEY = 'substack_annotations_cache_v1';

/**
 * Generates a collision-resistant unique identifier for an annotation.
 */
export function generateAnnotationId(): string {
  const timestamp = Date.now().toString(36);
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  return `ann_${timestamp}_${randomSuffix}`;
}

/**
 * Returns all locally cached annotations from localStorage.
 */
export function getAllLocalAnnotations(): AnnotationsRecord {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const rawJson = window.localStorage.getItem(STORAGE_KEY);
    return rawJson ? JSON.parse(rawJson) : {};
  } catch {
    return {};
  }
}

/**
 * Returns locally cached annotations for a specific article slug.
 */
export function getLocalAnnotations(slug: string): Annotation[] {
  const allAnnotations = getAllLocalAnnotations();
  return Array.isArray(allAnnotations[slug]) ? allAnnotations[slug] : [];
}

/**
 * Writes annotations for a specific article slug to localStorage cache.
 */
export function saveLocalAnnotations(slug: string, annotations: Annotation[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const allAnnotations = getAllLocalAnnotations();
    if (!annotations || annotations.length === 0) {
      delete allAnnotations[slug];
    } else {
      allAnnotations[slug] = annotations;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(allAnnotations));
  } catch (error) {
    console.warn('[annotations] Failed to write localStorage cache:', error);
  }
}

/**
 * Fetches persisted annotations for a slug from the dev server API.
 */
export async function fetchServerAnnotations(slug: string): Promise<Annotation[] | null> {
  try {
    const response = await fetch(`/api/annotations?slug=${encodeURIComponent(slug)}`);
    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return null;
  }
}

/**
 * Saves or updates a single annotation on the dev server API.
 */
export async function saveServerAnnotation(slug: string, annotation: Annotation): Promise<boolean> {
  try {
    const response = await fetch('/api/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, annotation }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Deletes an annotation from the dev server API.
 */
export async function deleteServerAnnotation(slug: string, id: string): Promise<boolean> {
  try {
    const response = await fetch(
      `/api/annotations?slug=${encodeURIComponent(slug)}&id=${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Merges local and server annotations by ID, resolving conflicts with latest updatedAt.
 */
export function mergeAnnotations(local: Annotation[], server: Annotation[]): Annotation[] {
  const annotationMap = new Map<string, Annotation>();
  for (const item of server) {
    if (item && item.id) {
      annotationMap.set(item.id, item);
    }
  }
  for (const item of local) {
    if (item && item.id) {
      const existingAnnotation = annotationMap.get(item.id);
      if (!existingAnnotation) {
        annotationMap.set(item.id, item);
      } else {
        const localTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
        const serverTime = new Date(existingAnnotation.updatedAt || existingAnnotation.createdAt || 0).getTime();
        if (localTime > serverTime) {
          annotationMap.set(item.id, item);
        }
      }
    }
  }
  return Array.from(annotationMap.values());
}

/**
 * Determines whether a text node should be excluded from annotation mapping.
 */
function _isTextNodeIgnored(node: Node): boolean {
  let parent = node.parentElement;
  while (parent) {
    const tag = parent.tagName.toUpperCase();
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return true;
    if (
      parent.classList.contains('heading-anchor') ||
      parent.classList.contains('annotation-toolbar') ||
      parent.classList.contains('annotations-drawer')
    ) {
      return true;
    }
    parent = parent.parentElement;
  }
  return false;
}

/**
 * Builds a flat concatenated text string and node offset map for a container element.
 */
export function buildTextMap(container: HTMLElement): TextMap {
  const textNodes: TextNodeMapping[] = [];
  let fullText = '';

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (_isTextNodeIgnored(node)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let currentNode = walker.nextNode();
  while (currentNode) {
    const textNode = currentNode as Text;
    const text = textNode.nodeValue || '';
    const start = fullText.length;
    const end = start + text.length;
    textNodes.push({ node: textNode, start, end });
    fullText += text;
    currentNode = walker.nextNode();
  }

  return { fullText, textNodes };
}

/**
 * Computes the character offset in fullText corresponding to a DOM node and local offset.
 */
function _getNodeFullTextOffset(
  textNodes: TextNodeMapping[],
  targetNode: Node,
  targetOffset: number
): number {
  for (const item of textNodes) {
    if (item.node === targetNode) {
      return item.start + targetOffset;
    }
  }
  if (targetNode.nodeType === Node.ELEMENT_NODE) {
    const targetElement = targetNode as Element;
    const child = targetElement.childNodes[targetOffset];
    if (child) {
      for (const item of textNodes) {
        if (item.node === child || child.contains(item.node)) {
          return item.start;
        }
      }
    }
  }
  return -1;
}

/**
 * Extracts the exact text and 32-character prefix and suffix context for a DOM selection.
 */
export function extractSelectionQuote(
  selection: Selection,
  container: HTMLElement
): { text: string; prefix: string; suffix: string } | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) {
    return null;
  }

  const text = range.toString();
  if (!text || !text.trim()) {
    return null;
  }

  const { fullText, textNodes } = buildTextMap(container);
  const startIdx = _getNodeFullTextOffset(textNodes, range.startContainer, range.startOffset);
  const endIdx = _getNodeFullTextOffset(textNodes, range.endContainer, range.endOffset);

  if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
    const prefix = fullText.slice(Math.max(0, startIdx - CONTEXT_LENGTH), startIdx);
    const suffix = fullText.slice(endIdx, Math.min(fullText.length, endIdx + CONTEXT_LENGTH));
    return { text, prefix, suffix };
  }

  const matchIndex = fullText.indexOf(text);
  if (matchIndex !== -1) {
    const prefix = fullText.slice(Math.max(0, matchIndex - CONTEXT_LENGTH), matchIndex);
    const suffix = fullText.slice(
      matchIndex + text.length,
      Math.min(fullText.length, matchIndex + text.length + CONTEXT_LENGTH)
    );
    return { text, prefix, suffix };
  }

  return { text, prefix: '', suffix: '' };
}

/**
 * Calculates context match score between candidate position and stored prefix/suffix.
 */
function _scoreCandidate(
  fullText: string,
  candidateStart: number,
  candidateEnd: number,
  prefix: string,
  suffix: string
): number {
  let score = 0;
  if (prefix) {
    const actualPrefix = fullText.slice(Math.max(0, candidateStart - prefix.length), candidateStart);
    let matchLen = 0;
    for (let i = 1; i <= Math.min(actualPrefix.length, prefix.length); i++) {
      if (actualPrefix[actualPrefix.length - i] === prefix[prefix.length - i]) {
        matchLen++;
      } else {
        break;
      }
    }
    score += matchLen * 2;
  }
  if (suffix) {
    const actualSuffix = fullText.slice(candidateEnd, candidateEnd + suffix.length);
    let matchLen = 0;
    for (let i = 0; i < Math.min(actualSuffix.length, suffix.length); i++) {
      if (actualSuffix[i] === suffix[i]) {
        matchLen++;
      } else {
        break;
      }
    }
    score += matchLen * 2;
  }
  return score;
}

/**
 * Finds the best character range match for an annotation using TextQuoteSelector matching.
 */
export function findTextMatch(
  fullText: string,
  text: string,
  prefix: string,
  suffix: string
): { start: number; end: number } | null {
  if (!text || !fullText) return null;

  if (prefix || suffix) {
    const exactQuery = prefix + text + suffix;
    const exactPos = fullText.indexOf(exactQuery);
    if (exactPos !== -1) {
      const start = exactPos + prefix.length;
      return { start, end: start + text.length };
    }
  }

  const candidates: number[] = [];
  let pos = fullText.indexOf(text, 0);
  while (pos !== -1) {
    candidates.push(pos);
    pos = fullText.indexOf(text, pos + 1);
  }

  if (candidates.length === 1) {
    return { start: candidates[0], end: candidates[0] + text.length };
  }

  if (candidates.length > 1) {
    let bestScore = -1;
    let bestPos = candidates[0];

    for (const candidateOffset of candidates) {
      const score = _scoreCandidate(fullText, candidateOffset, candidateOffset + text.length, prefix, suffix);
      if (score > bestScore) {
        bestScore = score;
        bestPos = candidateOffset;
      }
    }

    return { start: bestPos, end: bestPos + text.length };
  }

  return null;
}

/**
 * Splits and wraps text nodes intersecting [start, end] with mark.annotation-highlight elements.
 */
export function wrapTextRange(
  textNodes: TextNodeMapping[],
  start: number,
  end: number,
  annotation: Annotation
): HTMLElement[] {
  const createdMarks: HTMLElement[] = [];
  const intersectingNodes: { item: TextNodeMapping; nodeStartInFull: number; nodeEndInFull: number }[] =
    [];

  for (const item of textNodes) {
    if (item.end > start && item.start < end) {
      intersectingNodes.push({
        item,
        nodeStartInFull: item.start,
        nodeEndInFull: item.end,
      });
    }
  }

  for (let i = intersectingNodes.length - 1; i >= 0; i--) {
    const { item, nodeStartInFull, nodeEndInFull } = intersectingNodes[i];
    const node = item.node;

    const sliceStartInFull = Math.max(start, nodeStartInFull);
    const sliceEndInFull = Math.min(end, nodeEndInFull);

    const offsetStart = sliceStartInFull - nodeStartInFull;
    const offsetEnd = sliceEndInFull - nodeStartInFull;

    if (offsetStart >= offsetEnd) continue;

    if (offsetEnd < node.length) {
      node.splitText(offsetEnd);
    }

    let targetTextNode = node;
    if (offsetStart > 0) {
      targetTextNode = node.splitText(offsetStart);
    }

    const mark = document.createElement('mark');
    mark.className = 'annotation-highlight';
    mark.setAttribute('data-annotation-id', annotation.id);
    mark.setAttribute('data-color', annotation.color);
    mark.setAttribute('data-has-note', annotation.note ? 'true' : 'false');
    if (annotation.note) {
      mark.setAttribute('title', annotation.note);
    }

    targetTextNode.replaceWith(mark);
    mark.appendChild(targetTextNode);
    createdMarks.unshift(mark);
  }

  return createdMarks;
}

/**
 * Unwraps and cleans all annotation marks within a container element.
 */
export function clearAnnotations(container: HTMLElement): void {
  const marks = container.querySelectorAll('mark.annotation-highlight');
  marks.forEach((mark) => {
    mark.replaceWith(...Array.from(mark.childNodes));
  });
  container.normalize();
}

/**
 * Re-anchors and wraps all annotations inside a container element.
 */
export function renderAnnotations(container: HTMLElement, annotations: Annotation[]): void {
  clearAnnotations(container);
  if (!annotations || annotations.length === 0) return;

  const { fullText, textNodes } = buildTextMap(container);

  interface AnnotationMatch {
    annotation: Annotation;
    start: number;
    end: number;
  }

  const matches: AnnotationMatch[] = [];
  for (const annotation of annotations) {
    const match = findTextMatch(fullText, annotation.text, annotation.prefix, annotation.suffix);
    if (match) {
      matches.push({
        annotation,
        start: match.start,
        end: match.end,
      });
    }
  }

  matches.sort((a, b) => b.start - a.start);

  for (const { annotation, start, end } of matches) {
    wrapTextRange(textNodes, start, end, annotation);
  }
}

/**
 * Removes marks for a specific annotation ID from the container.
 */
export function removeAnnotationMark(container: HTMLElement, id: string): void {
  const marks = container.querySelectorAll(`mark.annotation-highlight[data-annotation-id="${id}"]`);
  marks.forEach((mark) => {
    mark.replaceWith(...Array.from(mark.childNodes));
  });
  container.normalize();
}

/**
 * Formats an ISO date string into a friendly localized display string.
 */
export function formatAnnotationDate(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

/**
 * Formats a collection of annotations into markdown blockquotes with notes.
 */
export function formatAnnotationsAsMarkdown(title: string, annotations: Annotation[]): string {
  const lines: string[] = [`# Notes & Highlights: ${title}`, ''];
  for (const annotation of annotations) {
    const quote = annotation.text
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
    lines.push(quote);
    if (annotation.note) {
      lines.push('');
      lines.push(`**Note:** ${annotation.note}`);
    }
    lines.push('');
    lines.push(`*Highlighted on ${formatAnnotationDate(annotation.createdAt)}*`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  return lines.join('\n').trim();
}

/**
 * Escapes HTML entities for safe template injection.
 */
function _escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Controller class coordinating the annotations lifecycle, DOM toolbar, and drawer panel.
 */
export class AnnotationManager {
  private slug: string;
  private container: HTMLElement;
  private annotations: Annotation[] = [];
  private activeAnnotationId: string | null = null;
  private pendingSelection: { text: string; prefix: string; suffix: string } | null = null;

  constructor(slug: string, container: HTMLElement) {
    this.slug = slug;
    this.container = container;
  }

  /**
   * Initializes the manager, attaches event listeners, and loads initial state.
   */
  public async init(): Promise<void> {
    this.annotations = getLocalAnnotations(this.slug);
    if (this.annotations.length > 0) {
      renderAnnotations(this.container, this.annotations);
    }
    this.updateUI();

    this.bindEvents();

    const serverData = await fetchServerAnnotations(this.slug);
    if (serverData !== null) {
      const mergedAnnotations = mergeAnnotations(this.annotations, serverData);
      this.annotations = mergedAnnotations;
      saveLocalAnnotations(this.slug, this.annotations);
      renderAnnotations(this.container, this.annotations);
      this.updateUI();
    }
  }

  public getAnnotations(): Annotation[] {
    return [...this.annotations];
  }

  /**
   * Adds a new annotation, updating cache and server.
   */
  public async addAnnotation(
    color: AnnotationColor,
    note?: string
  ): Promise<Annotation | null> {
    let quote = this.pendingSelection;
    if (!quote) {
      const selection = window.getSelection();
      if (selection) {
        quote = extractSelectionQuote(selection, this.container);
      }
    }
    if (!quote) return null;

    const newAnnotation: Annotation = {
      id: generateAnnotationId(),
      text: quote.text,
      prefix: quote.prefix,
      suffix: quote.suffix,
      color,
      note: note?.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.annotations.push(newAnnotation);
    saveLocalAnnotations(this.slug, this.annotations);
    renderAnnotations(this.container, this.annotations);
    this.updateUI();

    this.pendingSelection = null;
    window.getSelection()?.removeAllRanges();
    this.hideToolbar();

    await saveServerAnnotation(this.slug, newAnnotation);
    return newAnnotation;
  }

  /**
   * Updates an existing annotation's color or note.
   */
  public async updateAnnotation(
    id: string,
    updates: { color?: AnnotationColor; note?: string }
  ): Promise<boolean> {
    const targetAnnotation = this.annotations.find((a) => a.id === id);
    if (!targetAnnotation) return false;

    if (updates.color) targetAnnotation.color = updates.color;
    if (updates.note !== undefined) {
      targetAnnotation.note = updates.note.trim() ? updates.note.trim() : undefined;
    }
    targetAnnotation.updatedAt = new Date().toISOString();

    saveLocalAnnotations(this.slug, this.annotations);

    const marks = this.container.querySelectorAll(
      `mark.annotation-highlight[data-annotation-id="${id}"]`
    );
    marks.forEach((mark) => {
      mark.setAttribute('data-color', targetAnnotation.color);
      mark.setAttribute('data-has-note', targetAnnotation.note ? 'true' : 'false');
      if (targetAnnotation.note) {
        mark.setAttribute('title', targetAnnotation.note);
      } else {
        mark.removeAttribute('title');
      }
    });

    this.updateUI();
    this.hideToolbar();

    await saveServerAnnotation(this.slug, targetAnnotation);
    return true;
  }

  /**
   * Deletes an annotation from local and server storage.
   */
  public async deleteAnnotation(id: string): Promise<boolean> {
    this.annotations = this.annotations.filter((a) => a.id !== id);
    saveLocalAnnotations(this.slug, this.annotations);
    removeAnnotationMark(this.container, id);
    this.updateUI();
    this.hideToolbar();

    await deleteServerAnnotation(this.slug, id);
    return true;
  }

  /**
   * Updates header count badges and drawer list cards.
   */
  public updateUI(): void {
    const count = this.annotations.length;
    const countText = count === 1 ? '1 note' : `${count} notes`;

    const badgeCountElement = document.getElementById('post-notes-count');
    if (badgeCountElement) {
      badgeCountElement.textContent = countText;
    }
    const badgeButtonElement = document.getElementById('post-notes-toggle');
    if (badgeButtonElement) {
      badgeButtonElement.setAttribute('data-count', String(count));
    }

    const floatingNotesBadgeElement = document.getElementById('floating-notes-badge');
    if (floatingNotesBadgeElement) {
      floatingNotesBadgeElement.textContent = String(count);
      floatingNotesBadgeElement.setAttribute('data-count', String(count));
    }
    const floatingNotesToggleElement = document.getElementById('floating-notes-toggle');
    if (floatingNotesToggleElement) {
      floatingNotesToggleElement.setAttribute('data-count', String(count));
      floatingNotesToggleElement.classList.toggle('is-hidden', count === 0);
    }
    const floatingNotesTooltipElement = document.getElementById('floating-notes-tooltip');
    if (floatingNotesTooltipElement) {
      floatingNotesTooltipElement.textContent = count === 0 ? 'Notes' : `Notes (${count})`;
    }

    const drawerCountElement = document.getElementById('drawer-notes-count');
    if (drawerCountElement) {
      drawerCountElement.textContent = String(count);
    }

    const emptyState = document.getElementById('annotations-empty-state');
    const listElement = document.getElementById('annotations-list');

    if (emptyState && listElement) {
      if (count === 0) {
        emptyState.style.display = 'flex';
        listElement.style.display = 'none';
        listElement.innerHTML = '';
      } else {
        emptyState.style.display = 'none';
        listElement.style.display = 'flex';

        listElement.innerHTML = this.annotations
          .map((annotation) => {
            return `
            <div class="annotation-card" data-annotation-id="${annotation.id}" tabindex="0" role="button" aria-label="Jump to highlight">
              <div class="annotation-card-header">
                <span class="annotation-card-color" data-color="${annotation.color}"></span>
                <span class="annotation-card-date">${formatAnnotationDate(annotation.createdAt)}</span>
              </div>
              <blockquote class="annotation-card-quote">“${_escapeHtml(annotation.text)}”</blockquote>
              ${annotation.note ? `<p class="annotation-card-note">${_escapeHtml(annotation.note)}</p>` : ''}
              <div class="annotation-card-actions">
                <button type="button" class="annotation-action-btn delete" data-action="delete" title="Delete highlight" aria-label="Delete">
                  <span>🗑️</span>
                </button>
              </div>
            </div>`;
          })
          .join('');

        listElement.querySelectorAll('.annotation-card').forEach((card) => {
          const id = card.getAttribute('data-annotation-id');
          if (!id) return;

          card.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.closest('[data-action="delete"]')) {
              e.stopPropagation();
              this.deleteAnnotation(id);
              return;
            }
            this.jumpToHighlight(id);
          });
        });
      }
    }
  }

  /**
   * Scrolls smoothly to a highlight and triggers pulse animation.
   */
  public jumpToHighlight(id: string): void {
    const marks = this.container.querySelectorAll(
      `mark.annotation-highlight[data-annotation-id="${id}"]`
    );
    if (marks.length === 0) return;

    const firstMark = marks[0] as HTMLElement;
    firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });

    marks.forEach((m) => {
      m.classList.remove('annotation-pulse');
      void (m as HTMLElement).offsetWidth;
      m.classList.add('annotation-pulse');
    });

    if (window.innerWidth < 768) {
      this.closeDrawer();
    }
  }

  public openDrawer(): void {
    const drawer = document.getElementById('annotations-drawer');
    const backdrop = document.getElementById('annotations-backdrop');
    if (drawer && backdrop) {
      drawer.classList.add('open');
      drawer.setAttribute('aria-hidden', 'false');
      backdrop.classList.add('open');
    }
  }

  public closeDrawer(): void {
    const drawer = document.getElementById('annotations-drawer');
    const backdrop = document.getElementById('annotations-backdrop');
    if (drawer && backdrop) {
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
      backdrop.classList.remove('open');
    }
  }

  public toggleDrawer(): void {
    const drawer = document.getElementById('annotations-drawer');
    if (drawer && drawer.classList.contains('open')) {
      this.closeDrawer();
    } else {
      this.openDrawer();
    }
  }

  private positionToolbar(rect: DOMRect): void {
    const toolbar = document.getElementById('annotation-toolbar');
    if (!toolbar) return;

    toolbar.classList.add('visible');
    const toolbarWidth = toolbar.offsetWidth || 240;
    const toolbarHeight = toolbar.offsetHeight || 44;

    let topPosition = rect.top + window.scrollY - toolbarHeight - 10;
    if (topPosition < window.scrollY + 10) {
      topPosition = rect.bottom + window.scrollY + 10;
    }

    let leftPosition = rect.left + window.scrollX + rect.width / 2 - toolbarWidth / 2;
    leftPosition = Math.max(12, Math.min(window.innerWidth - toolbarWidth - 12, leftPosition));

    toolbar.style.top = `${Math.round(topPosition)}px`;
    toolbar.style.left = `${Math.round(leftPosition)}px`;
  }

  private hideToolbar(): void {
    const toolbar = document.getElementById('annotation-toolbar');
    if (!toolbar) return;
    toolbar.classList.remove('visible');
    this.activeAnnotationId = null;

    const noteContainer = document.getElementById('toolbar-note-container');
    if (noteContainer) noteContainer.style.display = 'none';

    const noteInput = document.getElementById('toolbar-note-input') as HTMLTextAreaElement | null;
    if (noteInput) noteInput.value = '';

    const deleteButton = document.getElementById('toolbar-delete-btn');
    if (deleteButton) deleteButton.style.display = 'none';

    toolbar.querySelectorAll('.annotation-color-btn').forEach((colorButton) => {
      colorButton.classList.remove('active');
    });
  }

  private bindEvents(): void {
    const toolbar = document.getElementById('annotation-toolbar');
    const noteContainer = document.getElementById('toolbar-note-container');
    const noteInput = document.getElementById('toolbar-note-input') as HTMLTextAreaElement | null;
    const addNoteButton = document.getElementById('toolbar-add-note-btn');
    const cancelNoteButton = document.getElementById('toolbar-note-cancel');
    const saveNoteButton = document.getElementById('toolbar-note-save');
    const deleteButton = document.getElementById('toolbar-delete-btn');
    const headerToggleButton = document.getElementById('post-notes-toggle');
    const floatingToggleButton = document.getElementById('floating-notes-toggle');
    const drawerCloseButton = document.getElementById('annotations-drawer-close');
    const backdrop = document.getElementById('annotations-backdrop');
    const exportButton = document.getElementById('drawer-export-btn');

    if (headerToggleButton) {
      headerToggleButton.addEventListener('click', () => {
        this.toggleDrawer();
      });
    }

    if (floatingToggleButton) {
      floatingToggleButton.addEventListener('click', () => {
        this.toggleDrawer();
      });
    }

    if (drawerCloseButton) {
      drawerCloseButton.addEventListener('click', () => {
        this.closeDrawer();
      });
    }

    if (backdrop) {
      backdrop.addEventListener('click', () => {
        this.closeDrawer();
      });
    }

    if (exportButton) {
      exportButton.addEventListener('click', () => {
        const title = document.querySelector('h1.post-title')?.textContent?.trim() || 'Article';
        const md = formatAnnotationsAsMarkdown(title, this.annotations);
        navigator.clipboard.writeText(md).then(() => {
          const originalButtonHtml = exportButton.innerHTML;
          exportButton.innerHTML = '<span>✅</span> Copied!';
          setTimeout(() => {
            exportButton.innerHTML = originalButtonHtml;
          }, 2000);
        });
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideToolbar();
        this.closeDrawer();
      }
    });

    const handleSelection = () => {
      if (this.activeAnnotationId) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) {
        return;
      }

      const quote = extractSelectionQuote(selection, this.container);
      if (!quote) {
        return;
      }

      this.pendingSelection = quote;
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      this.positionToolbar(rect);

      if (deleteButton) deleteButton.style.display = 'none';
      toolbar?.querySelectorAll('.annotation-color-btn').forEach((colorButton) => colorButton.classList.remove('active'));
    };

    this.container.addEventListener('mouseup', handleSelection);
    this.container.addEventListener('touchend', handleSelection);

    document.addEventListener('selectionchange', () => {
      const selection = window.getSelection();
      if ((!selection || selection.isCollapsed) && !this.activeAnnotationId) {
        if (
          toolbar &&
          noteInput &&
          document.activeElement !== noteInput &&
          !toolbar.contains(document.activeElement)
        ) {
          this.hideToolbar();
        }
      }
    });

    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const mark = target.closest('mark.annotation-highlight') as HTMLElement | null;
      if (mark) {
        const id = mark.getAttribute('data-annotation-id');
        if (id) {
          this.activeAnnotationId = id;
          this.pendingSelection = null;
          const targetAnnotation = this.annotations.find((a) => a.id === id);
          if (targetAnnotation) {
            const rect = mark.getBoundingClientRect();
            this.positionToolbar(rect);

            if (deleteButton) deleteButton.style.display = 'inline-flex';
            toolbar?.querySelectorAll('.annotation-color-btn').forEach((colorButton) => {
              if (colorButton.getAttribute('data-color') === targetAnnotation.color) {
                colorButton.classList.add('active');
              } else {
                colorButton.classList.remove('active');
              }
            });

            if (targetAnnotation.note && noteContainer && noteInput) {
              noteContainer.style.display = 'flex';
              noteInput.value = targetAnnotation.note;
            } else if (noteContainer) {
              noteContainer.style.display = 'none';
            }
          }
        }
      }
    });

    toolbar?.querySelectorAll('.annotation-color-btn').forEach((colorButton) => {
      colorButton.addEventListener('click', () => {
        const color = colorButton.getAttribute('data-color') as AnnotationColor;
        if (!color || !ANNOTATION_COLORS[color]) return;

        if (this.activeAnnotationId) {
          this.updateAnnotation(this.activeAnnotationId, { color });
        } else {
          const note = noteInput?.value;
          this.addAnnotation(color, note);
        }
      });
    });

    if (addNoteButton && noteContainer && noteInput) {
      addNoteButton.addEventListener('click', () => {
        noteContainer.style.display = 'flex';
        noteInput.focus();
      });
    }

    if (cancelNoteButton && noteContainer) {
      cancelNoteButton.addEventListener('click', () => {
        noteContainer.style.display = 'none';
      });
    }

    if (saveNoteButton && noteInput) {
      saveNoteButton.addEventListener('click', () => {
        const note = noteInput.value;
        if (this.activeAnnotationId) {
          this.updateAnnotation(this.activeAnnotationId, { note });
        } else if (this.pendingSelection) {
          this.addAnnotation('yellow', note);
        }
      });
    }

    if (deleteButton) {
      deleteButton.addEventListener('click', () => {
        if (this.activeAnnotationId) {
          this.deleteAnnotation(this.activeAnnotationId);
        }
      });
    }

    document.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;
      if (toolbar && toolbar.classList.contains('visible')) {
        if (
          !toolbar.contains(target) &&
          !target.closest('mark.annotation-highlight') &&
          !this.container.contains(target)
        ) {
          this.hideToolbar();
        }
      }
    });
  }
}

/**
 * Initializes inline highlighting and annotation UI for the given post slug.
 */
export function initAnnotations(slug: string): AnnotationManager | null {
  const prose = document.getElementById('prose-content');
  if (!prose || !slug) return null;

  const manager = new AnnotationManager(slug, prose);
  void manager.init();
  return manager;
}

/**
 * Automatically discovers the active post slug from #annotations-drawer and mounts the annotation controller.
 */
export function mountAnnotations(): AnnotationManager | null {
  if (typeof document === 'undefined') return null;
  const drawer = document.getElementById('annotations-drawer');
  const slug = drawer?.getAttribute('data-slug');
  if (!slug) return null;
  return initAnnotations(slug);
}

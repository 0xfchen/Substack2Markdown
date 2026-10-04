/**
 * selectors.ts
 *
 * Centralized DOM query selector constants and safe query utilities
 * for the 3D Constellation Knowledge Graph view.
 * Prevents selector drift between Astro templates and TypeScript client controllers.
 */

export const GRAPH_SELECTORS = {
  // Shell & WebGL Canvas
  container: '[data-graph-container]',
  canvas: '[data-graph-canvas]',

  // Search & Filter Bar
  searchInput: '[data-graph-search]',
  searchClearButton: '[data-graph-search-clear]',
  filterRow: '[data-graph-filters]',
  filterGroupTopics: '[data-filters-topic]',
  filterGroupReading: '[data-filters-reading]',
  filterButtons: '[data-filter], [data-graph-filter]',

  // Action Buttons
  colorModeButton: '[data-color-mode-btn], [data-action="color-mode"]',
  colorModeLabel: '[data-color-mode-label]',
  resetCameraButton: '[data-reset-camera-btn], [data-action="reset-camera"]',

  // Inspector Drawer
  inspector: '[data-graph-inspector]',
  inspectorBadge: '[data-inspector-badge]',
  inspectorStatus: '[data-inspector-status]',
  inspectorCount: '[data-inspector-count]',
  inspectorCloseButton: '[data-inspector-close]',
  inspectorTitle: '[data-inspector-title]',
  inspectorMeta: '[data-inspector-meta]',
  inspectorAuthor: '[data-inspector-author]',
  inspectorDate: '[data-inspector-date]',
  inspectorTime: '[data-inspector-time]',
  inspectorDesc: '[data-inspector-desc]',
  inspectorHubDetails: '[data-inspector-hub-details]',
  inspectorHubProgress: '[data-inspector-hub-progress]',
  inspectorHubProgressText: '[data-inspector-hub-progress-text]',
  inspectorArticlesLabel: '[data-inspector-articles-label]',
  inspectorArticlesList: '[data-inspector-articles-list]',
  inspectorTags: '[data-inspector-tags]',
  inspectorAction: '[data-inspector-action]',
  inspectorLink: '[data-inspector-link]',
  inspectorBtnText: '[data-inspector-btn-text]',

  // Cursor Tooltip
  tooltip: '[data-graph-tooltip]',
  tooltipTitle: '[data-tooltip-title]',
  tooltipSub: '[data-tooltip-sub]',

  // Timeline Scrubber HUD
  timelineHud: '[data-graph-timeline-hud]',
  timelineTitle: '[data-timeline-title]',
  timelineDateBadge: '[data-timeline-date-badge]',
  timelineDate: '[data-timeline-date]',
  timelineCount: '[data-timeline-count]',
  timelinePlayButton: '[data-timeline-play-btn]',
  timelineSlider: '[data-timeline-slider]',
  timelineProgressFill: '[data-timeline-progress-fill]',
  timelineSpeedButton: '[data-timeline-speed-btn]',
  timelineSpeedLabel: '[data-timeline-speed-label]',
  timelinePresentButton: '[data-timeline-present-btn]',

  // Legend
  legend: '[data-graph-legend]',
  legendTopics: '[data-legend-topics]',
  legendReading: '[data-legend-reading]',
  legendLabelAuthor: '[data-legend-label="author"]',
  legendLabelTag: '[data-legend-label="tag"]',
  legendLabelPost: '[data-legend-label="post"]',
} as const;

/**
 * Queries an element within a container, emitting a warning in DEV mode if missing.
 */
export function queryRequiredElement<T extends HTMLElement>(
  containerElement: HTMLElement,
  selectorString: string,
  elementDescription: string
): T | null {
  const matchedElement = containerElement.querySelector<T>(selectorString);
  if (!matchedElement && typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    console.warn(
      `[ThreeGraph] Expected element '${elementDescription}' (${selectorString}) was not found in container.`
    );
  }
  return matchedElement;
}


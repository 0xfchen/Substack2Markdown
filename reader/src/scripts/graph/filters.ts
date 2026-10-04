/**
 * filters.ts
 *
 * Search input filtering, category mode switching, and author hub visibility
 * for the 3D Constellation Knowledge Graph View.
 */

import type { GraphNode, CategoryMode } from './types';
import { GRAPH_SELECTORS, queryRequiredElement } from './selectors';

/**
 * Predicate determining whether a graph node matches the active category filter mode.
 */
export function matchesNodeCategory(
  nodeItem: GraphNode,
  categoryMode: CategoryMode
): boolean {
  if (categoryMode === 'all') return true;
  if (categoryMode === 'publications') return nodeItem.type === 'author';
  if (categoryMode === 'tags') return nodeItem.type === 'tag';
  if (categoryMode === 'articles') return nodeItem.type === 'post';
  if (categoryMode === 'long-reads') {
    return nodeItem.type === 'post' && (nodeItem.readingTime || 0) >= 10;
  }
  if (categoryMode === 'quick-reads') {
    return (
      nodeItem.type === 'post' &&
      (nodeItem.readingTime || 0) > 0 &&
      (nodeItem.readingTime || 0) < 5
    );
  }
  if (categoryMode.startsWith('status:')) {
    if (nodeItem.type !== 'post') return false;
    const requiredStatus = categoryMode.replace('status:', '');
    const currentStatus = nodeItem.readingStatus || 'unread';
    return currentStatus === requiredStatus;
  }
  return true;
}

/**
 * Predicate determining whether a graph node matches an active text search query.
 */
export function matchesNodeSearch(
  nodeItem: GraphNode,
  searchQuery: string
): boolean {
  const sanitizedQuery = searchQuery.trim().toLowerCase();
  if (!sanitizedQuery) return true;

  if (nodeItem.name && nodeItem.name.toLowerCase().includes(sanitizedQuery)) {
    return true;
  }
  if (
    nodeItem.author &&
    nodeItem.author.toLowerCase().includes(sanitizedQuery)
  ) {
    return true;
  }
  if (
    nodeItem.subtitle &&
    nodeItem.subtitle.toLowerCase().includes(sanitizedQuery)
  ) {
    return true;
  }
  if (nodeItem.tags && Array.isArray(nodeItem.tags)) {
    return nodeItem.tags.some((tagItem) =>
      tagItem.toLowerCase().includes(sanitizedQuery)
    );
  }
  return false;
}

export interface GraphFilterControlsController {
  getActiveFilter: () => CategoryMode;
  getActiveCategoryMode: () => CategoryMode;
  getSearchQuery: () => string;
  getActiveSearchQuery: () => string;
  dispose: () => void;
}

/**
 * Binds category filter buttons and search input DOM controls.
 */
export function setupGraphFilterControls(
  containerElement: HTMLElement,
  onFiltersChanged: () => void
): GraphFilterControlsController {
  let activeCategoryMode: CategoryMode = 'all';
  let activeSearchQuery = '';

  const searchInputElement = queryRequiredElement<HTMLInputElement>(
    containerElement,
    GRAPH_SELECTORS.searchInput,
    'Search Input'
  );
  const searchClearButtonElement = containerElement.querySelector<HTMLButtonElement>(
    GRAPH_SELECTORS.searchClearButton
  );
  const filterButtonElements = containerElement.querySelectorAll<HTMLButtonElement>(
    GRAPH_SELECTORS.filterButtons
  );

  const updateClearButtonVisibility = (searchQueryString: string) => {
    if (searchClearButtonElement) {
      searchClearButtonElement.hidden = searchQueryString.length === 0;
    }
  };

  const applySearchQueryValue = (
    nextSearchQueryString: string,
    shouldRefocusInput: boolean = false
  ) => {
    activeSearchQuery = nextSearchQueryString;
    if (searchInputElement) {
      searchInputElement.value = nextSearchQueryString;
      if (shouldRefocusInput) {
        searchInputElement.focus();
      }
    }
    updateClearButtonVisibility(nextSearchQueryString);
    onFiltersChanged();
  };

  if (searchInputElement && searchInputElement.value) {
    activeSearchQuery = searchInputElement.value;
    updateClearButtonVisibility(activeSearchQuery);
  }

  const handleSearchInput = () => {
    const currentInputValue = searchInputElement ? searchInputElement.value : '';
    activeSearchQuery = currentInputValue;
    updateClearButtonVisibility(currentInputValue);
    onFiltersChanged();
  };

  const handleClearButtonClick = () => {
    applySearchQueryValue('', true);
  };

  const handleSearchInputKeyDown = (keyboardEvent: KeyboardEvent) => {
    if (keyboardEvent.key === 'Escape' && activeSearchQuery.length > 0) {
      keyboardEvent.stopPropagation();
      applySearchQueryValue('', true);
    }
  };

  searchInputElement?.addEventListener('input', handleSearchInput);
  searchInputElement?.addEventListener('keydown', handleSearchInputKeyDown);
  searchClearButtonElement?.addEventListener('click', handleClearButtonClick);

  const filterButtonListeners: Array<{
    buttonElement: HTMLButtonElement;
    listenerFunction: () => void;
  }> = [];

  filterButtonElements.forEach((buttonElement) => {
    const filterCategory =
      buttonElement.getAttribute('data-filter') ||
      buttonElement.getAttribute('data-graph-filter') ||
      'all';
    const clickHandler = () => {
      const parentGroup = buttonElement.closest('.graph-filter-mode-group');
      if (parentGroup) {
        parentGroup
          .querySelectorAll<HTMLButtonElement>(
            '[data-filter], [data-graph-filter]'
          )
          .forEach((btn) => btn.classList.remove('active'));
      } else {
        filterButtonElements.forEach((btn) => btn.classList.remove('active'));
      }
      buttonElement.classList.add('active');
      activeCategoryMode = filterCategory;
      onFiltersChanged();
    };

    buttonElement.addEventListener('click', clickHandler);
    filterButtonListeners.push({
      buttonElement,
      listenerFunction: clickHandler,
    });
  });

  const dispose = () => {
    searchInputElement?.removeEventListener('input', handleSearchInput);
    searchInputElement?.removeEventListener('keydown', handleSearchInputKeyDown);
    searchClearButtonElement?.removeEventListener('click', handleClearButtonClick);
    filterButtonListeners.forEach(({ buttonElement, listenerFunction }) => {
      buttonElement.removeEventListener('click', listenerFunction);
    });
  };

  return {
    getActiveFilter: () => activeCategoryMode,
    getActiveCategoryMode: () => activeCategoryMode,
    getSearchQuery: () => activeSearchQuery,
    getActiveSearchQuery: () => activeSearchQuery,
    dispose,
  };
}

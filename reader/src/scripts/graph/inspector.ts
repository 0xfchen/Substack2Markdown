/**
 * inspector.ts
 *
 * Inspector Drawer UI rendering and DOM synchronization for the 3D Constellation Knowledge Graph.
 */

import { getTagColors } from '../../utils/graph-colors';
import type { GraphNode, SimNode } from './types';
import { GRAPH_SELECTORS } from './selectors';

export function showGraphInspector(containerEl: HTMLElement, node: GraphNode, allNodes: SimNode[]): void {
  const inspector = containerEl.querySelector<HTMLElement>(GRAPH_SELECTORS.inspector);
  if (!inspector) return;
  inspector.classList.remove('hidden');

  const inspectorBadge = containerEl.querySelector<HTMLElement>(GRAPH_SELECTORS.inspectorBadge);
  const inspectorTitle = containerEl.querySelector<HTMLElement>(GRAPH_SELECTORS.inspectorTitle);
  const inspectorAuthor = containerEl.querySelector<HTMLElement>(GRAPH_SELECTORS.inspectorAuthor);
  const inspectorDate = containerEl.querySelector<HTMLElement>(GRAPH_SELECTORS.inspectorDate);
  const inspectorTime = containerEl.querySelector<HTMLElement>(GRAPH_SELECTORS.inspectorTime);
  const inspectorDesc = containerEl.querySelector<HTMLElement>(GRAPH_SELECTORS.inspectorDesc);
  const inspectorTags = containerEl.querySelector<HTMLElement>(GRAPH_SELECTORS.inspectorTags);
  const inspectorLink = containerEl.querySelector<HTMLAnchorElement>(GRAPH_SELECTORS.inspectorLink);
  const inspectorStatus = containerEl.querySelector<HTMLElement>(GRAPH_SELECTORS.inspectorStatus);
  const inspectorCountBadge = containerEl.querySelector<HTMLElement>(GRAPH_SELECTORS.inspectorCount);
  const inspectorHubDetails = containerEl.querySelector<HTMLElement>(GRAPH_SELECTORS.inspectorHubDetails);
  const inspectorHubProgress = containerEl.querySelector<HTMLElement>(GRAPH_SELECTORS.inspectorHubProgress);
  const inspectorHubProgressText = containerEl.querySelector<HTMLElement>(GRAPH_SELECTORS.inspectorHubProgressText);
  const inspectorArticlesLabel = containerEl.querySelector<HTMLElement>(GRAPH_SELECTORS.inspectorArticlesLabel);
  const inspectorArticlesList = containerEl.querySelector<HTMLElement>(GRAPH_SELECTORS.inspectorArticlesList);
  const inspectorBtnText = containerEl.querySelector<HTMLElement>(GRAPH_SELECTORS.inspectorBtnText);

  if (inspectorBadge) {
    inspectorBadge.textContent =
      node.type === 'post' ? 'Article' : node.type === 'tag' ? 'Topic Hub' : 'Publication';
    inspectorBadge.className = `graph-inspector-badge ${node.type}`;
    if (node.type === 'tag') {
      inspectorBadge.style.cssText = getTagColors(node.name).style;
    } else {
      inspectorBadge.style.cssText = '';
    }
  }

  if (inspectorTitle) inspectorTitle.textContent = node.name;

  if (node.type === 'post') {
    // 1. Article Node Presentation
    if (inspectorStatus) {
      inspectorStatus.classList.remove('hidden');
      inspectorStatus.style.display = 'inline-block';
      const status = node.readingStatus || 'unread';
      inspectorStatus.textContent =
        status === 'completed' ? 'Read' : status === 'in-progress' ? 'Reading' : 'Unread';
      inspectorStatus.className = `graph-inspector-status-badge ${status}`;
    }

    if (inspectorCountBadge) {
      inspectorCountBadge.classList.add('hidden');
      inspectorCountBadge.style.display = 'none';
    }

    if (inspectorAuthor) inspectorAuthor.textContent = node.author ? `By ${node.author}` : '';
    if (inspectorDate) inspectorDate.textContent = node.dateStr || '';
    if (inspectorTime) inspectorTime.textContent = node.readingTime ? `${node.readingTime} min read` : '';

    if (inspectorDesc) {
      inspectorDesc.textContent = node.subtitle || '';
      inspectorDesc.style.display = node.subtitle ? 'block' : 'none';
    }

    if (inspectorHubDetails) {
      inspectorHubDetails.classList.add('hidden');
      inspectorHubDetails.style.display = 'none';
    }

    if (inspectorTags) {
      if (node.tags && node.tags.length > 0) {
        inspectorTags.style.display = 'flex';
        const spans = node.tags.map((tag) => {
          const span = document.createElement('span');
          span.className = 'graph-inspector-tag';
          span.style.cssText = getTagColors(tag).style;
          span.textContent = `#${tag.replace(/^#/, '')}`;
          return span;
        });
        inspectorTags.replaceChildren(...spans);
      } else {
        inspectorTags.replaceChildren();
        inspectorTags.style.display = 'none';
      }
    }

    if (inspectorLink) {
      if (node.url) {
        inspectorLink.href = node.url;
        inspectorLink.style.display = 'inline-flex';
        if (inspectorBtnText) inspectorBtnText.textContent = 'Read Article';
      } else {
        inspectorLink.style.display = 'none';
      }
    }
  } else {
    // 2. Topic Hub (Tag) or Publication (Author) Presentation
    if (inspectorStatus) {
      inspectorStatus.classList.add('hidden');
      inspectorStatus.style.display = 'none';
      inspectorStatus.textContent = '';
    }

    const connectedPosts: GraphNode[] = [];
    const cleanTagName = node.name.replace(/^#/, '').toLowerCase();

    allNodes.forEach((n) => {
      if (n.type !== 'post') return;
      if (node.type === 'tag') {
        if ((n.tags || []).some((t) => t.toLowerCase() === cleanTagName)) {
          connectedPosts.push(n);
        }
      } else if (node.type === 'author') {
        if (n.author === node.name) {
          connectedPosts.push(n);
        }
      }
    });

    const totalArticles = connectedPosts.length || node.postCount || 1;
    const totalReadingTime = connectedPosts.reduce((sum, p) => sum + (p.readingTime || 0), 0);
    const completedCount = connectedPosts.filter((p) => p.readingStatus === 'completed').length;
    const percent = totalArticles > 0 ? Math.round((completedCount / totalArticles) * 100) : 0;
    const distinctAuthors = new Set(connectedPosts.map((p) => p.author).filter(Boolean));

    if (inspectorCountBadge) {
      inspectorCountBadge.classList.remove('hidden');
      inspectorCountBadge.style.display = 'inline-block';
      inspectorCountBadge.textContent = `${totalArticles} article${totalArticles === 1 ? '' : 's'}`;
    }

    if (inspectorAuthor) {
      if (node.type === 'tag') {
        const authList = Array.from(distinctAuthors);
        inspectorAuthor.textContent =
          authList.length > 0
            ? `${authList.slice(0, 2).join(', ')}${authList.length > 2 ? ` +${authList.length - 2}` : ''}`
            : '';
      } else {
        inspectorAuthor.textContent = 'Publication Archive';
      }
    }

    if (inspectorDate) inspectorDate.textContent = '';
    if (inspectorTime) {
      inspectorTime.textContent = totalReadingTime > 0 ? `~${totalReadingTime} min total read` : '';
    }

    if (inspectorDesc) {
      if (node.type === 'tag') {
        inspectorDesc.textContent = `Topical constellation clustering ${totalArticles} article${totalArticles === 1 ? '' : 's'} across ${distinctAuthors.size || 1} publication${distinctAuthors.size === 1 ? '' : 's'}, spanning ~${totalReadingTime} minutes of deep reading.`;
      } else {
        inspectorDesc.textContent = `Publication archive containing ${totalArticles} article${totalArticles === 1 ? '' : 's'} across technical architecture and software engineering.`;
      }
      inspectorDesc.style.display = 'block';
    }

    if (inspectorHubDetails) {
      inspectorHubDetails.classList.remove('hidden');
      inspectorHubDetails.style.display = 'flex';

      if (inspectorHubProgress) {
        inspectorHubProgress.style.width = `${percent}%`;
      }
      if (inspectorHubProgressText) {
        inspectorHubProgressText.textContent = `${completedCount}/${totalArticles} read (${percent}%)`;
      }
      if (inspectorArticlesLabel) {
        inspectorArticlesLabel.textContent =
          node.type === 'tag' ? 'Articles in Topic' : 'Articles in Publication';
      }

      if (inspectorArticlesList) {
        const items = connectedPosts.slice(0, 5).map((p) => {
          const a = document.createElement('a');
          a.className = 'graph-inspector-article-item';
          a.href = p.url || '#';
          a.title = p.name;

          const titleSpan = document.createElement('span');
          titleSpan.className = 'graph-inspector-article-title';
          titleSpan.textContent = p.name;

          const statusSpan = document.createElement('span');
          const st = p.readingStatus || 'unread';
          statusSpan.className = `graph-inspector-article-status ${st}`;
          statusSpan.textContent =
            st === 'completed' ? 'Read' : st === 'in-progress' ? 'Reading' : 'Unread';

          a.appendChild(titleSpan);
          a.appendChild(statusSpan);
          return a;
        });
        inspectorArticlesList.replaceChildren(...items);
      }
    }

    if (inspectorTags) {
      const relatedTags = new Set<string>();
      connectedPosts.forEach((p) => {
        (p.tags || []).forEach((t) => {
          const norm = t.toLowerCase();
          if (norm !== cleanTagName) relatedTags.add(norm);
        });
      });

      const topRelated = Array.from(relatedTags).slice(0, 4);
      if (topRelated.length > 0) {
        inspectorTags.style.display = 'flex';
        const spans = topRelated.map((tag) => {
          const span = document.createElement('span');
          span.className = 'graph-inspector-tag';
          span.style.cssText = getTagColors(tag).style;
          span.textContent = `#${tag.replace(/^#/, '')}`;
          return span;
        });
        inspectorTags.replaceChildren(...spans);
      } else {
        inspectorTags.replaceChildren();
        inspectorTags.style.display = 'none';
      }
    }

    if (inspectorLink) {
      const firstPost = connectedPosts[0];
      if (firstPost && firstPost.url) {
        inspectorLink.href = firstPost.url;
        inspectorLink.style.display = 'inline-flex';
        if (inspectorBtnText) {
          inspectorBtnText.textContent =
            node.type === 'tag' ? 'Read Latest in Topic' : 'Read Latest Article';
        }
      } else {
        inspectorLink.style.display = 'none';
      }
    }
  }
}

export function hideGraphInspector(containerEl: HTMLElement): void {
  const inspector = containerEl.querySelector<HTMLElement>(GRAPH_SELECTORS.inspector);
  inspector?.classList.add('hidden');
}

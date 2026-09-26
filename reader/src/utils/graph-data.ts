/**
 * graph-data.ts
 *
 * Data modeling and graph topology generator for the 3D Knowledge Graph View.
 * Extracts posts, tags, and author clusters into an interconnected 3D network.
 */

import { getNodeTopicColor, hexToColorString } from './graph-colors';

/**
 * Computes an accurate word count from raw markdown by stripping frontmatter,
 * fenced code blocks, inline code, images, URLs, and HTML tags before tokenizing.
 *
 * @param markdown Raw markdown body string
 * @returns Clean word count
 */
export function countMarkdownWords(markdown: string): number {
  if (!markdown) return 0;
  const clean = markdown
    .replace(/^---[\s\S]*?---\s*/, '') // Frontmatter
    .replace(/```[\s\S]*?```/g, ' ') // Fenced code blocks
    .replace(/`[^`]*`/g, ' ') // Inline code
    .replace(/!\[.*?\]\(.*?\)/g, ' ') // Markdown images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // Links (preserve anchor text)
    .replace(/^\s*\[[^\]]+\]:\s*.*$/gm, ' ') // Reference link definitions
    .replace(/<!--[\s\S]*?-->/g, ' ') // HTML comments
    .replace(/<[^>]+>/g, ' ') // HTML tags
    .replace(/^[#>+\-*]\s+/gm, ' ') // Markdown symbols at line start
    .trim();

  if (!clean) return 0;
  const matches = clean.match(/[\p{L}\p{N}_\-]+/gu);
  return matches ? matches.length : 0;
}

export interface GraphNode {
  id: string;
  name: string;
  type: 'post' | 'tag' | 'author';
  group: string;
  val: number;
  postCount?: number;
  color?: string;
  postId?: string;
  url?: string;
  author?: string;
  tags?: string[];
  readingStatus?: 'unread' | 'in-progress' | 'completed';
  readingTime?: number;
  dateStr?: string;
  timestamp?: number;
  subtitle?: string;
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  type: 'tag' | 'author' | 'similarity';
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  minTimestamp?: number;
  maxTimestamp?: number;
  totalPosts?: number;
}

interface RawPost {
  id: string;
  data: {
    title: string;
    subtitle?: string;
    description?: string;
    author?: string;
    pubDate: Date;
    tags?: string[];
    wordcount?: number;
  };
  body?: string;
}

export function buildGraphData(
  posts: RawPost[],
  readingState: Record<string, { status?: string }> = {},
  withBaseFn: (path: string) => string = (p) => p
): GraphData {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const nodeSet = new Set<string>();

  // 1. Collect unique authors & tags
  // 1. Collect unique authors & tags, along with earliest post timestamps
  const authorCount: Record<string, number> = {};
  const authorEarliestDate: Record<string, number> = {};
  const tagCount: Record<string, number> = {};
  const tagEarliestDate: Record<string, number> = {};
  const postsByTag: Record<string, string[]> = {};

  let minTimestamp = Infinity;
  let maxTimestamp = -Infinity;

  for (const post of posts) {
    const postTime = post.data.pubDate ? post.data.pubDate.valueOf() : 0;
    if (postTime > 0) {
      if (postTime < minTimestamp) minTimestamp = postTime;
      if (postTime > maxTimestamp) maxTimestamp = postTime;
    }

    const author = post.data.author || 'Unknown';
    authorCount[author] = (authorCount[author] || 0) + 1;
    if (postTime > 0) {
      if (!authorEarliestDate[author] || postTime < authorEarliestDate[author]) {
        authorEarliestDate[author] = postTime;
      }
    }

    const tags = post.data.tags || [];
    for (const tag of tags) {
      const normalizedTag = tag.trim().toLowerCase();
      if (!normalizedTag) continue;
      tagCount[normalizedTag] = (tagCount[normalizedTag] || 0) + 1;
      if (postTime > 0) {
        if (!tagEarliestDate[normalizedTag] || postTime < tagEarliestDate[normalizedTag]) {
          tagEarliestDate[normalizedTag] = postTime;
        }
      }
      if (!postsByTag[normalizedTag]) {
        postsByTag[normalizedTag] = [];
      }
      postsByTag[normalizedTag].push(post.id);
    }
  }

  // 2. Add Author Nodes (Publication Super-Hubs)
  for (const [author, count] of Object.entries(authorCount)) {
    const authorId = `author:${author}`;
    nodeSet.add(authorId);
    const firstTime = authorEarliestDate[author] || (Number.isFinite(minTimestamp) ? minTimestamp : 0);
    nodes.push({
      id: authorId,
      name: author,
      type: 'author',
      group: author,
      val: Math.min(8.0, 4.0 + Math.sqrt(count) * 0.4),
      postCount: count,
      timestamp: firstTime,
      dateStr: firstTime > 0 ? new Date(firstTime).toISOString().slice(0, 10) : '',
      color: hexToColorString(getNodeTopicColor({ type: 'author', name: author })),
    });
  }

  // 3. Add Tag Nodes (Topical Gravitational Anchors)
  // Only include tags that have at least 1 post
  for (const [tag, count] of Object.entries(tagCount)) {
    const tagId = `tag:${tag}`;
    nodeSet.add(tagId);
    const firstTime = tagEarliestDate[tag] || (Number.isFinite(minTimestamp) ? minTimestamp : 0);
    nodes.push({
      id: tagId,
      name: `#${tag}`,
      type: 'tag',
      group: tag,
      val: Math.min(6.5, 2.8 + Math.sqrt(count) * 0.35),
      postCount: count,
      timestamp: firstTime,
      dateStr: firstTime > 0 ? new Date(firstTime).toISOString().slice(0, 10) : '',
      color: hexToColorString(getNodeTopicColor({ type: 'tag', name: tag })),
    });
  }

  // 4. Add Post Nodes & Links
  const linkKeySet = new Set<string>();

  function addLink(source: string, target: string, type: 'tag' | 'author' | 'similarity', weight = 1.0) {
    if (!nodeSet.has(source) || !nodeSet.has(target)) return;
    const key = source < target ? `${source}\0${target}` : `${target}\0${source}`;
    if (linkKeySet.has(key)) return;
    linkKeySet.add(key);
    links.push({ source, target, type, weight });
  }

  for (const post of posts) {
    const postId = `post:${post.id}`;
    nodeSet.add(postId);

    const author = post.data.author || 'Unknown';
    const stateEntry = readingState[post.id];
    let readingStatus: 'unread' | 'in-progress' | 'completed' = 'unread';
    if (stateEntry?.status === 'completed') {
      readingStatus = 'completed';
    } else if (stateEntry?.status === 'in-progress') {
      readingStatus = 'in-progress';
    }

    const words = post.data.wordcount || countMarkdownWords(post.body || '');
    const readingTime = Math.max(1, Math.round(words / 200));
    const tags = (post.data.tags || []).map((t) => t.trim().toLowerCase()).filter(Boolean);

    nodes.push({
      id: postId,
      name: post.data.title,
      type: 'post',
      group: author,
      val: 1.8,
      postCount: 1,
      postId: post.id,
      url: withBaseFn(`/posts/${post.id}/`),
      author,
      tags,
      readingStatus,
      readingTime,
      timestamp: post.data.pubDate ? post.data.pubDate.valueOf() : 0,
      dateStr: post.data.pubDate ? post.data.pubDate.toISOString().slice(0, 10) : '',
      subtitle: post.data.subtitle || post.data.description || '',
      color: hexToColorString(
        getNodeTopicColor({
          type: 'post',
          name: post.data.title,
          tags,
          author,
        })
      ),
    });

    // Link post to its author hub
    addLink(postId, `author:${author}`, 'author', 0.8);

    // Link post to its primary tags (up to 3 to prevent dense hairball spokes)
    for (const tag of tags.slice(0, 3)) {
      addLink(postId, `tag:${tag}`, 'tag', 1.2);
    }
  }

  // 5. Direct Post-to-Post Similarity Links (Posts sharing >= 3 tags, max 2 links per post)
  const postTagSets = new Map<string, Set<string>>();
  for (const post of posts) {
    const tags = new Set((post.data.tags || []).map((t) => t.trim().toLowerCase()).filter(Boolean));
    if (tags.size >= 2) {
      postTagSets.set(post.id, tags);
    }
  }

  const postList = Array.from(postTagSets.entries());
  const postSimCount = new Map<string, number>();

  for (let i = 0; i < postList.length; i++) {
    const [p1Id, t1] = postList[i];
    if ((postSimCount.get(p1Id) || 0) >= 2) continue;

    for (let j = i + 1; j < postList.length; j++) {
      const [p2Id, t2] = postList[j];
      if ((postSimCount.get(p2Id) || 0) >= 2) continue;

      let shared = 0;
      for (const t of t1) {
        if (t2.has(t)) shared++;
      }

      // If 3 or more shared tags, create a high-affinity semantic bridge
      if (shared >= 3) {
        addLink(`post:${p1Id}`, `post:${p2Id}`, 'similarity', 0.5);
        postSimCount.set(p1Id, (postSimCount.get(p1Id) || 0) + 1);
        postSimCount.set(p2Id, (postSimCount.get(p2Id) || 0) + 1);
        if ((postSimCount.get(p1Id) || 0) >= 2) break;
      }
    }
  }

  return {
    nodes,
    links,
    minTimestamp: Number.isFinite(minTimestamp) ? minTimestamp : 0,
    maxTimestamp: Number.isFinite(maxTimestamp) ? maxTimestamp : 0,
    totalPosts: posts.length,
  };
}


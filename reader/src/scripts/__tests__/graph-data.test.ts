import { describe, it, expect } from 'vitest';
import { buildGraphData, countMarkdownWords } from '../../utils/graph-data';

describe('buildGraphData()', () => {
  const mockPosts = [
    {
      id: 'author-a/posts/intro-to-systems',
      data: {
        title: 'Intro to Systems',
        subtitle: 'Basic system design concepts',
        author: 'Alice',
        pubDate: new Date('2026-01-01'),
        tags: ['Systems', 'Architecture', 'Performance'],
        wordcount: 1000,
      },
    },
    {
      id: 'author-a/posts/advanced-systems',
      data: {
        title: 'Advanced Systems',
        subtitle: 'Deep dive into distributed systems',
        author: 'Alice',
        pubDate: new Date('2026-01-15'),
        tags: ['Systems', 'Architecture', 'Performance'],
        wordcount: 2400,
      },
    },
    {
      id: 'author-b/posts/engineering-hiring',
      data: {
        title: 'Engineering Hiring',
        subtitle: 'How to build high performance teams',
        author: 'Bob',
        pubDate: new Date('2026-02-01'),
        tags: ['Leadership', 'Hiring'],
        wordcount: 1600,
      },
    },
  ];

  it('creates post, tag, and author nodes accurately', () => {
    const readingState = {
      'author-a/posts/intro-to-systems': { status: 'completed' },
      'author-a/posts/advanced-systems': { status: 'in-progress' },
    };

    const graph = buildGraphData(mockPosts as any, readingState, (p) => `/base${p}`);

    // Check node types
    const postNodes = graph.nodes.filter((n) => n.type === 'post');
    const tagNodes = graph.nodes.filter((n) => n.type === 'tag');
    const authorNodes = graph.nodes.filter((n) => n.type === 'author');

    expect(postNodes).toHaveLength(3);
    expect(authorNodes).toHaveLength(2); // Alice, Bob
    // Tags: systems, architecture, performance, leadership, hiring (5 unique tags)
    expect(tagNodes).toHaveLength(5);

    // Verify reading status mapping
    const introNode = postNodes.find((n) => n.id === 'post:author-a/posts/intro-to-systems');
    expect(introNode?.readingStatus).toBe('completed');
    expect(introNode?.postId).toBe('author-a/posts/intro-to-systems');
    expect(introNode?.url).toBe('/base/posts/author-a/posts/intro-to-systems/');

    const advNode = postNodes.find((n) => n.id === 'post:author-a/posts/advanced-systems');
    expect(advNode?.readingStatus).toBe('in-progress');

    const hiringNode = postNodes.find((n) => n.id === 'post:author-b/posts/engineering-hiring');
    expect(hiringNode?.readingStatus).toBe('unread');

    // Verify deterministic color assignment on nodes
    expect(introNode?.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(authorNodes[0]?.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(tagNodes[0]?.color).toMatch(/^#[0-9a-f]{6}$/i);

    // Verify postCount populated accurately
    const aliceAuthorNode = authorNodes.find((n) => n.name === 'Alice');
    expect(aliceAuthorNode?.postCount).toBe(2);
    expect(introNode?.postCount).toBe(1);
    const systemsTagNode = tagNodes.find((n) => n.name === '#systems');
    expect(systemsTagNode?.postCount).toBe(2);
  });

  it('creates edges between posts and their tags, author, and multi-tag similarities', () => {
    const graph = buildGraphData(mockPosts as any);

    // Check link existence
    const authorLinks = graph.links.filter((l) => l.type === 'author');
    expect(authorLinks.length).toBeGreaterThanOrEqual(3);

    const tagLinks = graph.links.filter((l) => l.type === 'tag');
    expect(tagLinks.length).toBeGreaterThanOrEqual(7);

    // Intro and Advanced share all 3 tags ('systems', 'architecture', 'performance')
    const similarityLinks = graph.links.filter((l) => l.type === 'similarity');
    expect(similarityLinks).toHaveLength(1);
    expect(similarityLinks[0].source).toBe('post:author-a/posts/intro-to-systems');
    expect(similarityLinks[0].target).toBe('post:author-a/posts/advanced-systems');
  });

  it('enforces similarity threshold boundaries (>= 3 shared tags required)', () => {
    const boundaryPosts = [
      {
        id: 'p1',
        data: {
          title: 'Post 1',
          pubDate: new Date('2026-01-01'),
          tags: ['tag-a', 'tag-b'], // 2 tags
        },
      },
      {
        id: 'p2',
        data: {
          title: 'Post 2',
          pubDate: new Date('2026-01-02'),
          tags: ['tag-a', 'tag-b', 'tag-c'], // shares 2 tags with p1
        },
      },
      {
        id: 'p3',
        data: {
          title: 'Post 3',
          pubDate: new Date('2026-01-03'),
          tags: ['tag-a', 'tag-b', 'tag-c', 'tag-d'], // shares 3 tags with p2 ('tag-a', 'tag-b', 'tag-c')
        },
      },
    ];

    const graph = buildGraphData(boundaryPosts as any);
    const similarityLinks = graph.links.filter((l) => l.type === 'similarity');

    // p1 and p2 share 2 tags (boundary: below threshold of 3) -> NO similarity link
    const p1p2 = similarityLinks.find(
      (l) =>
        (l.source === 'post:p1' && l.target === 'post:p2') ||
        (l.source === 'post:p2' && l.target === 'post:p1')
    );
    expect(p1p2).toBeUndefined();

    // p2 and p3 share 3 tags (boundary: meets threshold >= 3) -> YES similarity link
    const p2p3 = similarityLinks.find(
      (l) =>
        (l.source === 'post:p2' && l.target === 'post:p3') ||
        (l.source === 'post:p3' && l.target === 'post:p2')
    );
    expect(p2p3).toBeDefined();
    expect(p2p3?.weight).toBe(0.5);

    // Exactly 1 similarity link exists across all 3 posts
    expect(similarityLinks).toHaveLength(1);
  });

  it('caps similarity links at max 2 per post', () => {
    const cappedPosts = [
      {
        id: 'hub',
        data: {
          title: 'Hub Post',
          pubDate: new Date('2026-01-01'),
          tags: ['t1', 't2', 't3', 't4'],
        },
      },
      {
        id: 'partner-1',
        data: {
          title: 'Partner 1',
          pubDate: new Date('2026-01-02'),
          tags: ['t1', 't2', 't3'],
        },
      },
      {
        id: 'partner-2',
        data: {
          title: 'Partner 2',
          pubDate: new Date('2026-01-03'),
          tags: ['t1', 't2', 't3'],
        },
      },
      {
        id: 'partner-3',
        data: {
          title: 'Partner 3',
          pubDate: new Date('2026-01-04'),
          tags: ['t1', 't2', 't3'],
        },
      },
    ];

    const graph = buildGraphData(cappedPosts as any);
    const similarityLinks = graph.links.filter((l) => l.type === 'similarity');

    // Hub post has 3 eligible partners with >= 3 shared tags, but must be capped at 2
    const hubLinks = similarityLinks.filter(
      (l) => l.source === 'post:hub' || l.target === 'post:hub'
    );
    expect(hubLinks).toHaveLength(2);
  });

  it('computes chronological timestamps and assigns earliest dates to author and tag hubs', () => {
    const graph = buildGraphData(mockPosts as any);

    expect(graph.minTimestamp).toBe(new Date('2026-01-01').valueOf());
    expect(graph.maxTimestamp).toBe(new Date('2026-02-01').valueOf());
    expect(graph.totalPosts).toBe(3);

    // Alice published Jan 01 and Jan 15 -> Alice's hub emerges on Jan 01
    const aliceNode = graph.nodes.find((n) => n.id === 'author:Alice');
    expect(aliceNode?.timestamp).toBe(new Date('2026-01-01').valueOf());
    expect(aliceNode?.dateStr).toBe('2026-01-01');

    // Bob published Feb 01 -> Bob's hub emerges on Feb 01
    const bobNode = graph.nodes.find((n) => n.id === 'author:Bob');
    expect(bobNode?.timestamp).toBe(new Date('2026-02-01').valueOf());
    expect(bobNode?.dateStr).toBe('2026-02-01');

    // Tag 'leadership' only appears on Bob's post (Feb 01)
    const leadershipTag = graph.nodes.find((n) => n.id === 'tag:leadership');
    expect(leadershipTag?.timestamp).toBe(new Date('2026-02-01').valueOf());

    // Tag 'systems' appears on Alice's first post (Jan 01)
    const systemsTag = graph.nodes.find((n) => n.id === 'tag:systems');
    expect(systemsTag?.timestamp).toBe(new Date('2026-01-01').valueOf());
  });
});

describe('countMarkdownWords()', () => {
  it('handles empty and whitespace-only content', () => {
    expect(countMarkdownWords('')).toBe(0);
    expect(countMarkdownWords('   \n\t  ')).toBe(0);
  });

  it('counts plain text words accurately', () => {
    expect(countMarkdownWords('Hello world, this is a clean test.')).toBe(7);
  });

  it('strips YAML frontmatter', () => {
    const md = `---
title: Sample Post
author: Alice
tags: [Systems, Architecture]
---

This is the actual article content.`;
    expect(countMarkdownWords(md)).toBe(6);
  });

  it('does not inflate word count from image URLs and markdown images', () => {
    const md = `Before the image.
![A beautiful architectural diagram with labels](https://images.substack.com/image/upload/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2Fcomplex-file-name-with-many-tokens.png)
After the image.`;
    // Only "Before the image" (3) and "After the image" (3) -> 6 words
    expect(countMarkdownWords(md)).toBe(6);
  });

  it('preserves anchor text but strips link URLs', () => {
    const md = `Read more at [The Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/deep-dive-into-system-design-architectures) for insights.`;
    // "Read more at The Pragmatic Engineer for insights" = 8 words
    expect(countMarkdownWords(md)).toBe(8);
  });

  it('strips fenced code blocks and inline code', () => {
    const md = `Here is some Python:

\`\`\`python
def calculate_metrics(data: list[int]) -> dict[str, float]:
    total = sum(data)
    average = total / max(1, len(data))
    return {"total": total, "average": average}
\`\`\`

And an inline \`const x = 42;\` example.`;
    // "Here is some Python And an inline example" = 8 words
    expect(countMarkdownWords(md)).toBe(8);
  });

  it('strips HTML comments and tags', () => {
    const md = `<!-- wp:paragraph -->
<p class="intro-lead">This is a paragraph with <span style="color: red;">styled text</span>.</p>
<!-- /wp:paragraph -->`;
    // "This is a paragraph with styled text" = 7 words
    expect(countMarkdownWords(md)).toBe(7);
  });
});



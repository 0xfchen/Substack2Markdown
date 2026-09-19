const ui = {
  backLink: '← Library',
  readingTime: (n: number) => `${n} min read`,
  updated: 'Updated',
  relatedPosts: 'Related',
  allPosts: 'Feed →',
  postsEyebrow: 'Timeline',
  postsTitle: 'Feed',
  heroTitle: 'Keep notes.',
  heroTitleLine2: '',
  viewAll: 'Feed →',
  readLink: 'Read →',
  postFeed: {
    all: 'All',
    filterLabel: 'Filter posts by category',
    previousCategories: 'Scroll categories left',
    nextCategories: 'Scroll categories right',
    searchLabel: 'Search posts',
    empty: 'No posts match this filter.',
    more: 'Load more',
    read: 'Read',
  },
};

export function getUiText() {
  return ui;
}

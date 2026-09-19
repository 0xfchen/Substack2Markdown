import { mountReadingRailForPosts } from './reading-rail';

const railQuery = '(min-width: 960px)';
const railMediaQuery = window.matchMedia(railQuery);

function mountReadingRailWhenWide() {
  if (!railMediaQuery.matches) return;
  mountReadingRailForPosts();
}

export function mountReadingRailLoader() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountReadingRailWhenWide, { once: true });
  } else {
    mountReadingRailWhenWide();
  }

  railMediaQuery.addEventListener('change', (event) => {
    if (event.matches) {
      mountReadingRailForPosts();
    }
  });
}


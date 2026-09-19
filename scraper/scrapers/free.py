import logging
import random
from time import sleep

import requests
from bs4 import BeautifulSoup

from ..config import BASE_CONTENT_DIR, DEFAULT_REQUEST_TIMEOUT
from .base import BaseSubstackScraper, FrontmatterFormat

logger = logging.getLogger(__name__)


class SubstackScraper(BaseSubstackScraper):
    """Scraper implementation for free and public Substack posts via HTTP requests."""

    def __init__(
        self,
        base_substack_url: str,
        content_save_dir: str = BASE_CONTENT_DIR,
        html_save_dir: str | None = None,
        download_images: bool = False,
        frontmatter_format: FrontmatterFormat = "mdx",
        overwrite: bool = False,
        clean_content: bool = True,
    ) -> None:
        """Initialize free Substack scraper.

        Args:
            base_substack_url: Target Substack publication or post URL.
            content_save_dir: Root directory for author-centric content (defaults to 'content').
            html_save_dir: Deprecated / unused HTML export directory.
            download_images: Whether to download images locally.
            frontmatter_format: Deprecated frontmatter format selector.
            overwrite: Whether to overwrite existing files on disk when scraping.
            clean_content: Whether to strip promotional widgets and subscription CTAs.
        """
        super().__init__(
            base_substack_url=base_substack_url,
            content_save_dir=content_save_dir,
            html_save_dir=html_save_dir,
            download_images=download_images,
            frontmatter_format=frontmatter_format,
            overwrite=overwrite,
            clean_content=clean_content,
        )

    def get_url_soup(self, url: str, max_attempts: int = 5) -> BeautifulSoup | None:
        """Fetch and parse HTML for a URL using requests with exponential backoff retry.

        Args:
            url: Post URL to fetch.
            max_attempts: Number of retry attempts on rate limiting (HTTP 429).

        Returns:
            BeautifulSoup | None: Parsed DOM, or None if skipped (e.g. premium paywall).

        Raises:
            RuntimeError: If maximum retry attempts are exhausted or network fails.
            ValueError: If fetching page encounters a generic error.
        """
        for attempt in range(1, max_attempts + 1):
            try:
                page = requests.get(url, headers=None, timeout=DEFAULT_REQUEST_TIMEOUT)
                soup = BeautifulSoup(page.content, "html.parser")

                if soup.find("h2", class_="paywall-title"):
                    logger.info("Skipping premium article: %s", url)
                    return None

                pre = soup.select_one("body > pre")
                if pre and "too many requests" in pre.text.lower():
                    if attempt == max_attempts:
                        raise RuntimeError(f"Max attempts reached for URL: {url}. Too many requests.")
                    base = 2**attempt
                    delay = base + random.uniform(-0.2 * base, 0.2 * base)
                    logger.warning(
                        "[%s/%s] Too many requests. Retrying in %.2f seconds...",
                        attempt,
                        max_attempts,
                        delay,
                    )
                    sleep(delay)
                    continue

                return soup
            except RuntimeError:
                raise
            except requests.RequestException as e:
                raise ValueError(f"Error fetching page: {e}") from e

        raise RuntimeError(f"Failed to fetch page after {max_attempts} attempts: {url}")

import random
from time import sleep

import requests
from bs4 import BeautifulSoup

from ..config import DEFAULT_REQUEST_TIMEOUT
from .base import BaseSubstackScraper


class SubstackScraper(BaseSubstackScraper):
    """Scraper implementation for free and public Substack posts via HTTP requests."""

    def __init__(
        self,
        base_substack_url: str,
        md_save_dir: str,
        html_save_dir: str,
        download_images: bool = False,
        frontmatter_format: str = "legacy",
    ) -> None:
        """Initialize free Substack scraper.

        Args:
            base_substack_url: Target Substack publication or post URL.
            md_save_dir: Root directory for markdown files.
            html_save_dir: Root directory for HTML files.
            download_images: Whether to download images locally.
            frontmatter_format: Frontmatter format ('legacy' or 'mdx').
        """
        super().__init__(
            base_substack_url, md_save_dir, html_save_dir, download_images, frontmatter_format
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
                    print(f"Skipping premium article: {url}")
                    return None

                pre = soup.select_one("body > pre")
                if pre and "too many requests" in pre.text.lower():
                    if attempt == max_attempts:
                        raise RuntimeError(f"Max attempts reached for URL: {url}. Too many requests.")
                    base = 2 ** attempt
                    delay = base + random.uniform(-0.2 * base, 0.2 * base)
                    print(f"[{attempt}/{max_attempts}] Too many requests. Retrying in {delay:.2f} seconds...")
                    sleep(delay)
                    continue

                return soup
            except RuntimeError:
                raise
            except Exception as e:
                raise ValueError(f"Error fetching page: {e}") from e

        raise RuntimeError(f"Failed to fetch page after {max_attempts} attempts: {url}")


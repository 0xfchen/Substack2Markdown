"""Substack2Markdown package.

Provides tools to scrape and archive Substack newsletters into structured Markdown format.
"""

# Re-export requests so monkeypatches like `monkeypatch.setattr(ss.requests, ...)` work
import requests  # noqa: F401

# Import browser manager
from .browser import BrowserManager

# Import catalog & JSON embed
from .catalog import safe_json_embed

# Import CLI
from .cli import (
    logger,
    main,
    parse_args,
)

# Import config constants & credentials
from .config import (
    BASE_CONTENT_DIR,
    BASE_SUBSTACK_URL,
    DEFAULT_REQUEST_TIMEOUT,
    MAX_IMAGE_WORKERS,
    NUM_POSTS_TO_SCRAPE,
    USE_PREMIUM,
    get_credentials,
)

# Import image processing helpers
from .images import (
    clean_linked_images,
    count_images_in_markdown,
    download_image,
    process_markdown_images,
    resolve_image_url,
    sanitize_image_filename,
)

# Import scraper classes
from .scrapers import (
    BaseSubstackScraper,
    PremiumSubstackScraper,
    SubstackScraper,
)

# Import URL helpers
from .url_utils import (
    extract_main_part,
    get_post_slug,
    get_publication_url,
    is_post_url,
)

__all__ = [
    # Config
    "BASE_CONTENT_DIR",
    "BASE_SUBSTACK_URL",
    "DEFAULT_REQUEST_TIMEOUT",
    "MAX_IMAGE_WORKERS",
    "NUM_POSTS_TO_SCRAPE",
    "USE_PREMIUM",
    "get_credentials",
    # URLs
    "extract_main_part",
    "get_post_slug",
    "get_publication_url",
    "is_post_url",
    # Catalog
    "safe_json_embed",
    # Images
    "clean_linked_images",
    "count_images_in_markdown",
    "download_image",
    "process_markdown_images",
    "resolve_image_url",
    "sanitize_image_filename",
    # Browser
    "BrowserManager",
    # Scrapers
    "BaseSubstackScraper",
    "SubstackScraper",
    "PremiumSubstackScraper",
    # CLI
    "logger",
    "main",
    "parse_args",
]

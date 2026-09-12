"""Substack2Markdown package.

Provides tools to scrape and archive Substack newsletters into Markdown and HTML formats.
"""

import sys

# Import config constants & credentials
from .config import (
    BASE_HTML_DIR,
    BASE_IMAGE_DIR,
    BASE_MD_DIR,
    BASE_SUBSTACK_URL,
    DEFAULT_REQUEST_TIMEOUT,
    HTML_TEMPLATE,
    JSON_DATA_DIR,
    MAX_IMAGE_WORKERS,
    NUM_POSTS_TO_SCRAPE,
    USE_PREMIUM,
    get_credentials,
)

# Import URL helpers
from .url_utils import (
    extract_main_part,
    get_post_slug,
    get_publication_url,
    is_post_url,
)

# Import catalog & HTML generator
from .catalog import (
    generate_html_file,
    safe_json_embed,
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

# Import browser manager
from .browser import BrowserManager

# Import scraper classes
from .scrapers import (
    BaseSubstackScraper,
    PremiumSubstackScraper,
    SubstackScraper,
)

# Import CLI
from .cli import (
    logger,
    main,
    parse_args,
)

# Re-export requests so monkeypatches like `monkeypatch.setattr(ss.requests, ...)` work
import requests  # noqa: F401

__all__ = [
    # Config
    "BASE_HTML_DIR",
    "BASE_IMAGE_DIR",
    "BASE_MD_DIR",
    "BASE_SUBSTACK_URL",
    "DEFAULT_REQUEST_TIMEOUT",
    "HTML_TEMPLATE",
    "JSON_DATA_DIR",
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
    "generate_html_file",
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

#!/usr/bin/env python3
"""Capture high-resolution preview screenshots for the Substack2Markdown documentation.

This script connects to the local Astro reader dev server and uses Playwright
to generate crisp 2x Retina screenshots of both the Library table view and the
individual Article reading view.

Usage:
    uv run python scripts/capture_previews.py
    uv run python scripts/capture_previews.py --only library
    uv run python scripts/capture_previews.py --only post --post-slug 20-years-of-software-engineering
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import urllib.error
import urllib.request

from playwright.sync_api import sync_playwright

from scraper.browser import BrowserManager

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "http://localhost:4321"
DEFAULT_POST_PATH = "pragmaticengineer/posts/20-years-of-software-engineering"
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_OUTPUT_DIR = os.path.join(REPO_ROOT, "reader", "public")


def _is_server_reachable(url: str, timeout_sec: float = 3.0) -> bool:
    """Check if the local dev server is active and returning HTTP 200."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "SubstackScreenshotBot/1.0"})
        with urllib.request.urlopen(req, timeout=timeout_sec) as response:
            return response.status == 200
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def _resolve_post_path(slug_or_path: str) -> str:
    """Resolve an article route path (supporting collection ID or bare slug)."""
    if "/" in slug_or_path:
        return slug_or_path.strip("/")

    # Search content directory for author-nested path
    content_dir = os.path.join(REPO_ROOT, "content")
    if os.path.isdir(content_dir):
        for author in sorted(os.listdir(content_dir)):
            posts_dir = os.path.join(content_dir, author, "posts")
            if os.path.isdir(posts_dir):
                for file in sorted(os.listdir(posts_dir)):
                    base_name = os.path.splitext(file)[0]
                    if base_name == slug_or_path:
                        return f"{author}/posts/{base_name}"

    return slug_or_path


def capture_screenshots(
    base_url: str = DEFAULT_BASE_URL,
    post_slug: str = DEFAULT_POST_PATH,
    output_dir: str = DEFAULT_OUTPUT_DIR,
    browser_name: str = "edge",
    targets: tuple[str, ...] = ("library", "post"),
) -> None:
    """Capture library and post preview screenshots using Playwright."""
    clean_base = base_url.rstrip("/")

    if not _is_server_reachable(clean_base):
        logger.error(
            "Local Astro reader server is not reachable at %s.\n"
            "Please start the dev server first:\n"
            "    cd reader && pnpm dev",
            clean_base,
        )
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    with sync_playwright() as playwright:
        channel = BrowserManager.resolve_channel(browser_name, playwright)
        if not channel:
            logger.error("Neither Chrome nor Edge could be found on this system.")
            sys.exit(1)

        logger.info("Launching %s browser for preview generation...", channel)
        browser = playwright.chromium.launch(channel=channel, headless=True)

        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            device_scale_factor=2,
        )
        page = context.new_page()

        # 1. Capture Library Preview
        if "library" in targets:
            page.set_viewport_size({"width": 1280, "height": 800})
            library_url = f"{clean_base}/"
            library_out = os.path.join(output_dir, "library-preview.png")
            logger.info("Capturing Library view: %s -> %s", library_url, library_out)

            page.goto(library_url, wait_until="networkidle")
            page.wait_for_selector("[data-reading-table]", timeout=10000)
            page.wait_for_timeout(1000)  # Allow stats bar & font metrics to settle
            page.screenshot(path=library_out)
            logger.info("Saved %s", library_out)

        # 2. Capture Article Preview (with Left Reading Rail and Right TOC Rail)
        if "post" in targets:
            page.set_viewport_size({"width": 1440, "height": 900})
            resolved_path = _resolve_post_path(post_slug)
            post_url = f"{clean_base}/posts/{resolved_path}/"
            post_out = os.path.join(output_dir, "post-preview.png")
            logger.info("Capturing Article view: %s -> %s", post_url, post_out)

            page.goto(post_url, wait_until="networkidle")
            page.wait_for_selector("main", timeout=10000)
            page.wait_for_selector(".rail-ticks", timeout=10000)
            page.wait_for_selector(".toc-rail", timeout=10000)
            page.wait_for_timeout(1000)  # Allow reading rails and code blocks to hydrate
            page.screenshot(path=post_out)
            logger.info("Saved %s", post_out)

        browser.close()
        logger.info("All requested preview screenshots captured successfully.")


def main() -> None:
    """Parse CLI arguments and run preview capture."""
    parser = argparse.ArgumentParser(description="Capture Astro reader documentation preview screenshots.")
    parser.add_argument(
        "--url",
        default=DEFAULT_BASE_URL,
        help=f"Base URL of running Astro reader (default: {DEFAULT_BASE_URL})",
    )
    parser.add_argument(
        "--post-slug",
        default=DEFAULT_POST_PATH,
        help=f"Post slug or collection path to screenshot for article view (default: {DEFAULT_POST_PATH})",
    )
    parser.add_argument(
        "--output-dir",
        default=DEFAULT_OUTPUT_DIR,
        help=f"Destination directory for screenshots (default: {DEFAULT_OUTPUT_DIR})",
    )
    parser.add_argument(
        "--browser",
        choices=["edge", "chrome"],
        default="edge",
        help="Browser channel to use (default: edge)",
    )
    parser.add_argument(
        "--only",
        choices=["library", "post", "all"],
        default="all",
        help="Which screenshots to capture (default: all)",
    )

    args = parser.parse_args()
    targets = ("library", "post") if args.only == "all" else (args.only,)

    capture_screenshots(
        base_url=args.url,
        post_slug=args.post_slug,
        output_dir=args.output_dir,
        browser_name=args.browser,
        targets=targets,
    )


if __name__ == "__main__":
    main()

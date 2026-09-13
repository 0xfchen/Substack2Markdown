import argparse
import logging
import sys

from .config import (
    BASE_HTML_DIR,
    BASE_MD_DIR,
)
from .scrapers.free import SubstackScraper
from .scrapers.premium import PremiumSubstackScraper

logger = logging.getLogger("substack_scraper")


def parse_args() -> argparse.Namespace:
    """Parse command line arguments for the Substack2Markdown scraper CLI.

    Returns:
        argparse.Namespace: Parsed command-line options and flags.
    """
    parser = argparse.ArgumentParser(
        description="Scrape a Substack site and convert posts to markdown and HTML.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Free publication
  substack_scraper --url https://example.substack.com

  # Scrape single post
  substack_scraper --url https://example.substack.com/p/some-post-title

  # Premium content using Chrome or Edge
  substack_scraper --url https://example.substack.com --premium --browser chrome

  # First run: log in and solve CAPTCHA interactively (saved to persistent profile)
  substack_scraper --url https://example.substack.com --premium --persistent-profile

  # Subsequent runs: reuse saved session without logging in again
  substack_scraper --url https://example.substack.com --premium --persistent-profile --skip-login

  # Connect directly to active personal browser window (CDP)
  substack_scraper --url https://example.substack.com --premium --cdp-url http://localhost:9222
        """,
    )

    parser.add_argument(
        "-u",
        "--url",
        type=str,
        required=True,
        help="The base URL or post URL of the Substack site to scrape (required).",
    )
    parser.add_argument(
        "-d",
        "--directory",
        type=str,
        help="The directory to save scraped markdown posts.",
    )
    parser.add_argument(
        "--html-directory", type=str, help="The directory to save scraped HTML posts."
    )
    parser.add_argument(
        "-n",
        "--number",
        type=int,
        default=0,
        help="Number of posts to scrape (0 = all posts).",
    )
    parser.add_argument(
        "--images",
        action="store_true",
        help="Download images and update markdown to use local paths.",
    )
    parser.add_argument(
        "--frontmatter",
        type=str,
        default="legacy",
        choices=["legacy", "mdx"],
        help="Header format for scraped markdown. 'legacy' (default) uses the original "
        "'# title / **date** / **Likes:** N' block. 'mdx' emits YAML frontmatter "
        "(title, subtitle, date, author, image) suitable for MDX sites.",
    )

    # Premium scraping options
    premium_group = parser.add_argument_group("Premium scraping options")
    premium_group.add_argument(
        "-p",
        "--premium",
        action="store_true",
        help="Use browser automation to access premium/paid content.",
    )
    premium_group.add_argument(
        "--browser",
        type=str,
        default="chrome",
        choices=["chrome", "edge"],
        help="Browser to use for premium scraping (default: chrome).",
    )
    premium_group.add_argument(
        "--headless",
        action="store_true",
        help="Run browser in headless mode (may trigger CAPTCHA).",
    )
    premium_group.add_argument(
        "--persistent-profile",
        action="store_true",
        help="Use a persistent browser profile to save login state.",
    )
    premium_group.add_argument(
        "--skip-login",
        action="store_true",
        help="Skip login (use with --persistent-profile or --storage-state).",
    )
    premium_group.add_argument(
        "--storage-state",
        type=str,
        default="",
        help="Path to storage state JSON file for saved session cookies.",
    )
    premium_group.add_argument(
        "--cdp-url",
        type=str,
        default="",
        help="Connect directly to an active browser via Chrome DevTools Protocol URL (e.g. http://localhost:9222).",
    )
    premium_group.add_argument(
        "--browser-path",
        type=str,
        default="",
        help="Explicit path to Chrome or Edge browser executable.",
    )
    premium_group.add_argument(
        "--user-agent",
        type=str,
        default="",
        help="Custom user agent string.",
    )

    if len(sys.argv) == 1:
        parser.print_help(sys.stderr)
        sys.exit(1)

    return parser.parse_args()


def main() -> None:
    """Execute the command line interface to scrape posts and build catalogs."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    args = parse_args()

    # Allow monkeypatched globals from the substack_scraper package/module
    ss = sys.modules.get("substack_scraper")
    base_md_dir = getattr(ss, "BASE_MD_DIR", BASE_MD_DIR) if ss else BASE_MD_DIR
    base_html_dir = getattr(ss, "BASE_HTML_DIR", BASE_HTML_DIR) if ss else BASE_HTML_DIR

    if args.directory is None:
        args.directory = base_md_dir

    if args.html_directory is None:
        args.html_directory = base_html_dir

    if args.premium:
        scraper = PremiumSubstackScraper(
            base_substack_url=args.url,
            md_save_dir=args.directory,
            html_save_dir=args.html_directory,
            download_images=args.images,
            browser=args.browser,
            headless=args.headless,
            browser_path=args.browser_path,
            user_agent=args.user_agent,
            use_persistent_profile=args.persistent_profile,
            skip_login=args.skip_login,
            storage_state=args.storage_state,
            cdp_url=args.cdp_url,
            frontmatter_format=args.frontmatter,
        )
    else:
        scraper = SubstackScraper(
            args.url,
            md_save_dir=args.directory,
            html_save_dir=args.html_directory,
            download_images=args.images,
            frontmatter_format=args.frontmatter,
        )
    scraper.scrape_posts(args.number)


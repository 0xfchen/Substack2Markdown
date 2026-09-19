import argparse
import logging
import sys

from .config import BASE_CONTENT_DIR
from .scrapers.free import SubstackScraper
from .scrapers.premium import PremiumSubstackScraper

logger = logging.getLogger("scraper")


def parse_args() -> argparse.Namespace:
    """Parse command line arguments for the Substack2Markdown scraper CLI.

    Returns:
        argparse.Namespace: Parsed command-line options and flags.
    """
    parser = argparse.ArgumentParser(
        description="Scrape a Substack site and convert posts to Markdown with author-centric storage.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Free publication
  scraper --url https://example.substack.com

  # Scrape single post
  scraper --url https://example.substack.com/p/some-post-title

  # Scrape with downloaded images
  scraper --url https://example.substack.com --images

  # Premium content using Chrome or Edge
  scraper --url https://example.substack.com --premium --browser chrome

  # First run: log in and solve CAPTCHA interactively (saved to persistent profile)
  scraper --url https://example.substack.com --premium --persistent-profile

  # Subsequent runs: reuse saved session without logging in again
  scraper --url https://example.substack.com --premium --persistent-profile --skip-login

  # Connect directly to active personal browser window (CDP)
  scraper --url https://example.substack.com --premium --cdp-url http://localhost:9222
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
        help=f"The base directory to save scraped content (default: {BASE_CONTENT_DIR}).",
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
        "--no-clean",
        dest="clean_content",
        action="store_false",
        help="Disable HTML cleaning (keep subscription buttons, paywalls, and promo widgets).",
    )
    parser.add_argument(
        "--force",
        "--overwrite",
        dest="overwrite",
        action="store_true",
        help="Force rescraping and overwrite existing markdown files.",
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

    verbosity_group = parser.add_mutually_exclusive_group()
    verbosity_group.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable verbose debug logging (sets level to DEBUG).",
    )
    verbosity_group.add_argument(
        "-q",
        "--quiet",
        action="store_true",
        help="Silence informational output; only log warnings and errors (sets level to WARNING).",
    )

    if len(sys.argv) == 1:
        parser.print_help(sys.stderr)
        sys.exit(1)

    return parser.parse_args()


def main() -> None:
    """Execute the command line interface to scrape posts and build catalogs."""
    args = parse_args()

    log_level = logging.INFO
    if args.verbose:
        log_level = logging.DEBUG
    elif args.quiet:
        log_level = logging.WARNING

    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    # Allow monkeypatched globals from the scraper package/module
    ss = sys.modules.get("scraper")
    base_content_dir = getattr(ss, "BASE_CONTENT_DIR", BASE_CONTENT_DIR) if ss else BASE_CONTENT_DIR

    if args.directory is None:
        args.directory = base_content_dir

    if args.premium:
        scraper = PremiumSubstackScraper(
            base_substack_url=args.url,
            content_save_dir=args.directory,
            download_images=args.images,
            browser=args.browser,
            headless=args.headless,
            browser_path=args.browser_path,
            user_agent=args.user_agent,
            use_persistent_profile=args.persistent_profile,
            skip_login=args.skip_login,
            storage_state=args.storage_state,
            cdp_url=args.cdp_url,
            overwrite=args.overwrite,
            clean_content=args.clean_content,
        )
    else:
        scraper = SubstackScraper(
            args.url,
            content_save_dir=args.directory,
            download_images=args.images,
            overwrite=args.overwrite,
            clean_content=args.clean_content,
        )
    scraper.scrape_posts(args.number)

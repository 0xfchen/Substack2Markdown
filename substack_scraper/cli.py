import argparse
import logging
import sys

from .config import (
    BASE_HTML_DIR,
    BASE_MD_DIR,
    BASE_SUBSTACK_URL,
    NUM_POSTS_TO_SCRAPE,
    USE_PREMIUM,
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
  # Free content with automatic Chrome driver
  python substack_scraper.py --url https://example.substack.com

  # Scrape single post
  python substack_scraper.py --url https://example.substack.com/p/some-post-title

  # Free content using Edge
  python substack_scraper.py --url https://example.substack.com --browser edge

  # Premium content (prompts for login or uses env vars)
  python substack_scraper.py --url https://example.substack.com --premium

  # First run: log in and solve CAPTCHA interactively
  python substack_scraper.py --url https://example.substack.com --premium --persistent-profile

  # Subsequent runs: reuse session without logging in again
  python substack_scraper.py --url https://example.substack.com --premium --persistent-profile --skip-login

  # Use manually downloaded driver
  python substack_scraper.py --url https://example.substack.com --premium --chrome-driver-path /path/to/chromedriver
        """,
    )

    parser.add_argument(
        "-u", "--url", type=str, help="The base URL of the Substack site to scrape."
    )
    parser.add_argument(
        "-d", "--directory", type=str, help="The directory to save scraped markdown posts."
    )
    parser.add_argument(
        "--html-directory", type=str, help="The directory to save scraped HTML posts."
    )
    parser.add_argument(
        "-n", "--number", type=int, default=0, help="Number of posts to scrape (0 = all posts)."
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
        help="Skip login (use with --persistent-profile after first login).",
    )

    # Driver path options
    driver_group = parser.add_argument_group("Driver options (for troubleshooting)")
    driver_group.add_argument(
        "--chrome-driver-path",
        type=str,
        default="",
        help="Path to chromedriver executable.",
    )
    driver_group.add_argument(
        "--edge-driver-path",
        type=str,
        default="",
        help="Path to msedgedriver executable.",
    )
    driver_group.add_argument(
        "--chrome-path",
        type=str,
        default="",
        help="Path to Chrome browser executable.",
    )
    driver_group.add_argument(
        "--edge-path",
        type=str,
        default="",
        help="Path to Edge browser executable.",
    )
    driver_group.add_argument(
        "--user-agent",
        type=str,
        default="",
        help="Custom user agent string.",
    )

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
    base_substack_url = getattr(ss, "BASE_SUBSTACK_URL", BASE_SUBSTACK_URL) if ss else BASE_SUBSTACK_URL
    use_premium = getattr(ss, "USE_PREMIUM", USE_PREMIUM) if ss else USE_PREMIUM
    base_md_dir = getattr(ss, "BASE_MD_DIR", BASE_MD_DIR) if ss else BASE_MD_DIR
    base_html_dir = getattr(ss, "BASE_HTML_DIR", BASE_HTML_DIR) if ss else BASE_HTML_DIR
    num_posts = getattr(ss, "NUM_POSTS_TO_SCRAPE", NUM_POSTS_TO_SCRAPE) if ss else NUM_POSTS_TO_SCRAPE

    if args.directory is None:
        args.directory = base_md_dir

    if args.html_directory is None:
        args.html_directory = base_html_dir

    # Determine driver/browser paths based on selected browser
    if args.browser == "chrome":
        driver_path = args.chrome_driver_path
        browser_path = args.chrome_path
    else:
        driver_path = args.edge_driver_path
        browser_path = args.edge_path

    if args.url:
        if args.premium:
            scraper = PremiumSubstackScraper(
                base_substack_url=args.url,
                md_save_dir=args.directory,
                html_save_dir=args.html_directory,
                download_images=args.images,
                browser=args.browser,
                headless=args.headless,
                driver_path=driver_path,
                browser_path=browser_path,
                user_agent=args.user_agent,
                use_persistent_profile=args.persistent_profile,
                skip_login=args.skip_login,
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

    else:
        # Use hardcoded values
        if not base_substack_url:
            logger.error(
                "No Substack URL provided. Please specify --url <URL> or set BASE_SUBSTACK_URL in the script."
            )
            sys.exit(1)
        logger.info(f"No --url specified. Using script default URL: {base_substack_url}")
        if use_premium:
            scraper = PremiumSubstackScraper(
                base_substack_url=base_substack_url,
                md_save_dir=args.directory,
                html_save_dir=args.html_directory,
                download_images=args.images,
                browser=args.browser,
                headless=args.headless,
                driver_path=driver_path,
                browser_path=browser_path,
                user_agent=args.user_agent,
                use_persistent_profile=args.persistent_profile,
                skip_login=args.skip_login,
                frontmatter_format=args.frontmatter,
            )
        else:
            scraper = SubstackScraper(
                base_substack_url=base_substack_url,
                md_save_dir=args.directory,
                html_save_dir=args.html_directory,
                download_images=args.images,
                frontmatter_format=args.frontmatter,
            )
        scraper.scrape_posts(num_posts_to_scrape=num_posts)

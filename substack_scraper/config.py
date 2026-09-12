import os


USE_PREMIUM: bool = False
BASE_SUBSTACK_URL: str = "https://niallferguson.substack.com/"
BASE_MD_DIR: str = "data/md_files"
BASE_HTML_DIR: str = "data/html_pages"
BASE_IMAGE_DIR: str = "data/images"
HTML_TEMPLATE: str = "author_template.html"
JSON_DATA_DIR: str = "data"
NUM_POSTS_TO_SCRAPE: int = 0
DEFAULT_REQUEST_TIMEOUT: int = 30
MAX_IMAGE_WORKERS: int = 6


def get_credentials() -> tuple[str, str]:
    """Retrieve Substack login credentials for premium scraping.

    The SUBSTACK_EMAIL and SUBSTACK_PASSWORD environment variables (or values
    from a .env file if present) take precedence over an optional config.py
    in the project root containing EMAIL and PASSWORD strings.

    Returns:
        tuple[str, str]: A tuple of (email, password).
    """
    try:
        from dotenv import find_dotenv, load_dotenv
        dotenv_path = find_dotenv(usecwd=True)
        if dotenv_path:
            load_dotenv(dotenv_path)
    except ImportError:
        pass

    try:
        from config import EMAIL, PASSWORD
    except ImportError:
        EMAIL, PASSWORD = "", ""
    return (
        os.environ.get("SUBSTACK_EMAIL", EMAIL),
        os.environ.get("SUBSTACK_PASSWORD", PASSWORD),
    )


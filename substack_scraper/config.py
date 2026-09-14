import os

USE_PREMIUM: bool = False
BASE_SUBSTACK_URL: str = "https://substack.com/"
BASE_CONTENT_DIR: str = "content"
NUM_POSTS_TO_SCRAPE: int = 0
DEFAULT_REQUEST_TIMEOUT: int = 30
MAX_IMAGE_WORKERS: int = 6


def get_credentials() -> tuple[str, str]:
    """Retrieve Substack login credentials for premium scraping.

    The SUBSTACK_EMAIL and SUBSTACK_PASSWORD environment variables (or values
    from a .env file if present) are used.

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

    return (
        os.environ.get("SUBSTACK_EMAIL", ""),
        os.environ.get("SUBSTACK_PASSWORD", ""),
    )

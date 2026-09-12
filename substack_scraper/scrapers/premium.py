import random
from time import sleep

from bs4 import BeautifulSoup
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

from ..browser import BrowserManager
from ..config import get_credentials
from .base import BaseSubstackScraper


class PremiumSubstackScraper(BaseSubstackScraper):
    """Scraper implementation for subscriber-only / premium Substack posts using Selenium."""

    def __init__(
        self,
        base_substack_url: str,
        md_save_dir: str,
        html_save_dir: str,
        download_images: bool = False,
        browser: str = 'chrome',
        headless: bool = False,
        driver_path: str = '',
        browser_path: str = '',
        user_agent: str = '',
        use_persistent_profile: bool = False,
        skip_login: bool = False,
        frontmatter_format: str = "legacy",
    ) -> None:
        """Initialize the premium scraper with browser automation.

        Args:
            base_substack_url: Target Substack publication or post URL.
            md_save_dir: Destination folder for markdown exports.
            html_save_dir: Destination folder for HTML exports.
            download_images: Whether to download images locally.
            browser: Automation browser ('chrome' or 'edge').
            headless: Whether to execute browser headlessly.
            driver_path: Optional explicit path to driver executable.
            browser_path: Optional explicit path to browser executable.
            user_agent: Custom browser user agent string.
            use_persistent_profile: Whether to save/load browser session state.
            skip_login: Whether to bypass login when reusing authenticated profile.
            frontmatter_format: Header format ('legacy' or 'mdx').

        Raises:
            ValueError: If credentials are missing when skip_login is False.
        """
        self.email, self.password = get_credentials()
        if not skip_login and not (self.email and self.password):
            raise ValueError(
                "Premium scraping requires credentials. Set the SUBSTACK_EMAIL "
                "and SUBSTACK_PASSWORD environment variables, or create a "
                "config.py in the project root containing your Substack login:\n"
                '    EMAIL = "your-email@domain.com"\n'
                '    PASSWORD = "your-password"\n'
                "If you've already logged in with a persistent browser profile, "
                "pass --persistent-profile --skip-login instead."
            )

        self.driver = BrowserManager.create_driver(
            browser=browser,
            headless=headless,
            driver_path=driver_path,
            browser_path=browser_path,
            user_agent=user_agent,
            use_persistent_profile=use_persistent_profile,
        )

        self.skip_login = skip_login
        self.use_persistent_profile = use_persistent_profile

        if not skip_login:
            self._login()
        else:
            print("Skipping login (using existing profile authentication)")
            self.driver.get(base_substack_url)
            sleep(3)

        super().__init__(
            base_substack_url, md_save_dir, html_save_dir, download_images, frontmatter_format
        )

    def _is_login_failed(self) -> bool:
        """Check for the presence of the error container indicating failed authentication."""
        error_container = self.driver.find_elements(By.ID, 'error-container')
        return len(error_container) > 0 and error_container[0].is_displayed()

    def _login(self) -> None:
        """Log into Substack via Selenium browser automation."""
        print("Logging into Substack...")
        self.driver.get("https://substack.com/sign-in")
        sleep(3)

        signin_with_password = self.driver.find_element(
            By.XPATH, "//a[@class='login-option substack-login__login-option']"
        )
        signin_with_password.click()
        sleep(3)

        email = self.driver.find_element(By.NAME, "email")
        password = self.driver.find_element(By.NAME, "password")
        email.send_keys(self.email)
        password.send_keys(self.password)

        submit = self.driver.find_element(By.XPATH, "//*[@id=\"substack-login\"]/div[2]/div[2]/form/button")
        submit.click()

        print("Waiting for login to complete (this may take up to 30 seconds)...")
        sleep(30)

        if self._is_login_failed():
            raise Exception(
                "Login unsuccessful. Please check your email and password, or your account status.\n"
                "If you're seeing a CAPTCHA, try:\n"
                "  1. Run without --headless to complete CAPTCHA manually\n"
                "  2. Use --persistent-profile to save your session\n"
                "  3. Then run with --skip-login on subsequent runs"
            )

        print("[OK] Login successful!")

        if self.use_persistent_profile:
            print("[OK] Session saved to persistent profile")

    def get_url_soup(self, url: str, max_attempts: int = 5) -> BeautifulSoup | None:
        """Fetch and parse post HTML using authenticated Selenium session.

        Args:
            url: Post URL to fetch.
            max_attempts: Number of attempts on rate-limiting.

        Returns:
            BeautifulSoup | None: Parsed DOM or None if premium access denied.

        Raises:
            RuntimeError: If retry attempts are exhausted.
            ValueError: If an unexpected error occurs during fetch.
        """
        for attempt in range(1, max_attempts + 1):
            try:
                self.driver.get(url)

                try:
                    WebDriverWait(self.driver, 20).until(
                        lambda d: d.find_elements(By.CSS_SELECTOR, "div.available-content")
                        or d.find_elements(By.CSS_SELECTOR, "h1.post-title")
                        or d.find_elements(By.CSS_SELECTOR, "h2.paywall-title")
                        or d.find_elements(By.CSS_SELECTOR, "body > pre")
                    )
                except TimeoutException:
                    print(f"[WARN] Timeout waiting for post content to render: {url}")

                soup = BeautifulSoup(self.driver.page_source, "html.parser")

                pre = soup.select_one("body > pre")
                if pre and "too many requests" in pre.text.lower():
                    if attempt == max_attempts:
                        raise RuntimeError(f"Max attempts reached for URL: {url}. Too many requests.")
                    base = 2 ** attempt
                    delay = base + random.uniform(-0.2 * base, 0.2 * base)
                    print(f"[{attempt}/{max_attempts}] Too many requests. Retrying in {delay:.2f} seconds...")
                    sleep(delay)
                    continue

                if soup.find("h2", class_="paywall-title"):
                    print(f"Skipping premium article (no access): {url}")
                    return None

                return soup
            except RuntimeError:
                raise
            except Exception as e:
                raise ValueError(f"Error fetching page: {url}. Error: {e}") from e

        raise RuntimeError(f"Failed to fetch page after {max_attempts} attempts: {url}")

    def __del__(self) -> None:
        """Clean up the driver when done."""
        if hasattr(self, 'driver') and self.driver:
            try:
                self.driver.quit()
            except Exception:
                pass


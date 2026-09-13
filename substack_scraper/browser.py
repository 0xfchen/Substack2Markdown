import logging
import os
from dataclasses import dataclass
from typing import Any

from playwright.sync_api import (
    Browser,
    BrowserContext,
    Playwright,
    sync_playwright,
)
from playwright.sync_api import (
    Error as PlaywrightError,
)

logger = logging.getLogger(__name__)


@dataclass
class PlaywrightSession:
    """Container holding active Playwright resources for automated browser interaction."""

    playwright: Playwright
    browser: Browser | None
    context: BrowserContext

    def close(self) -> None:
        """Close context, browser, and playwright instance with explicit error logging."""
        try:
            self.context.close()
        except PlaywrightError as exc:
            logger.debug("Error while closing browser context: %s", exc)
        if self.browser:
            try:
                self.browser.close()
            except PlaywrightError as exc:
                logger.debug("Error while closing browser instance: %s", exc)
        try:
            self.playwright.stop()
        except PlaywrightError as exc:
            logger.debug("Error while stopping Playwright engine: %s", exc)


class BrowserManager:
    """Manage browser launching, fallback selection, and session persistence via Playwright."""

    SUPPORTED_BROWSERS: list[str] = ["chrome", "edge"]
    DEFAULT_STORAGE_STATE_PATH: str = os.path.join(
        os.path.expanduser("~"), ".substack_scraper", "storage_state.json"
    )

    @staticmethod
    def get_user_data_dir(browser: str) -> str:
        """Return a persistent user data directory for browser profile storage.

        Args:
            browser: Browser identifier ('chrome' or 'edge').

        Returns:
            str: Directory path for the browser's persistent user profile.
        """
        base_dir = os.path.join(os.path.expanduser("~"), ".substack_scraper")
        os.makedirs(base_dir, exist_ok=True)
        return os.path.join(base_dir, f"{browser}_profile")

    @classmethod
    def resolve_channel(
        cls, requested_browser: str, playwright: Playwright
    ) -> str | None:
        """Resolve a viable Playwright channel with automatic fallback between Chrome and Edge.

        Args:
            requested_browser: Browser identifier requested by the user ('chrome' or 'edge').
            playwright: Active Playwright instance.

        Returns:
            str | None: The viable channel name ('chrome' or 'msedge'), or None if none found.
        """
        primary = "chrome" if requested_browser.lower() == "chrome" else "msedge"
        secondary = "msedge" if primary == "chrome" else "chrome"

        for channel in (primary, secondary):
            try:
                test_browser = playwright.chromium.launch(
                    channel=channel, headless=True
                )
                test_browser.close()
                return channel
            except PlaywrightError as exc:
                logger.debug("Channel '%s' unavailable: %s", channel, exc)
                continue

        return None

    @classmethod
    def launch(
        cls,
        browser: str = "chrome",
        headless: bool = False,
        browser_path: str = "",
        user_agent: str = "",
        use_persistent_profile: bool = False,
        storage_state: str = "",
        cdp_url: str = "",
    ) -> PlaywrightSession:
        """Launch and initialize a Playwright browser session with persistence and fallback.

        Args:
            browser: Browser preference ('chrome' or 'edge').
            headless: Whether to run the browser headlessly.
            browser_path: Explicit path to custom browser executable.
            user_agent: Optional custom User-Agent string.
            use_persistent_profile: Whether to use persistent profile directory.
            storage_state: Path to saved storage state JSON file.
            cdp_url: Optional remote debugging URL (CDP) to attach to an active browser.

        Returns:
            PlaywrightSession: The active Playwright session containing context and page manager.

        Raises:
            RuntimeError: If browser launch or CDP connection fails.
        """
        pw = sync_playwright().start()

        # Strategy 1: Connect directly to existing browser over CDP
        if cdp_url:
            try:
                logger.info("Connecting to existing browser over CDP: %s", cdp_url)
                cdp_browser = pw.chromium.connect_over_cdp(cdp_url)
                contexts = cdp_browser.contexts
                context = contexts[0] if contexts else cdp_browser.new_context()
                return PlaywrightSession(playwright=pw, browser=cdp_browser, context=context)
            except PlaywrightError as exc:
                pw.stop()
                raise RuntimeError(f"Failed to connect to browser over CDP at {cdp_url}: {exc}") from exc

        # Determine launch options
        launch_kwargs: dict[str, Any] = {
            "headless": headless,
        }

        if browser_path and os.path.exists(browser_path):
            launch_kwargs["executable_path"] = browser_path
        else:
            channel = cls.resolve_channel(browser, pw)
            if channel:
                launch_kwargs["channel"] = channel
                if channel != ("chrome" if browser.lower() == "chrome" else "msedge"):
                    logger.info("Notice: '%s' not found. Automatically using '%s' instead.", browser, channel)
            else:
                pw.stop()
                raise RuntimeError(
                    "Could not find Google Chrome or Microsoft Edge installed on this system.\n"
                    "Please install Chrome or Edge, or specify an executable via --browser-path."
                )

        args = [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--window-size=1920,1080",
        ]

        # Strategy 2: Persistent Profile
        if use_persistent_profile:
            profile_dir = cls.get_user_data_dir(browser)
            logger.info("Using persistent profile at: %s", profile_dir)
            try:
                context = pw.chromium.launch_persistent_context(
                    user_data_dir=profile_dir,
                    args=args,
                    user_agent=user_agent or None,
                    **launch_kwargs,
                )
                return PlaywrightSession(playwright=pw, browser=None, context=context)
            except PlaywrightError as exc:
                pw.stop()
                raise RuntimeError(f"Failed to launch persistent browser profile: {exc}") from exc

        # Strategy 3: Standard launch with optional storage state
        try:
            launch_browser = pw.chromium.launch(args=args, **launch_kwargs)
            context_kwargs: dict[str, Any] = {}
            if user_agent:
                context_kwargs["user_agent"] = user_agent

            effective_storage = storage_state or (
                cls.DEFAULT_STORAGE_STATE_PATH
                if os.path.exists(cls.DEFAULT_STORAGE_STATE_PATH)
                else ""
            )
            if effective_storage and os.path.exists(effective_storage):
                logger.info("Loading session from storage state: %s", effective_storage)
                context_kwargs["storage_state"] = effective_storage

            context = launch_browser.new_context(**context_kwargs)
            return PlaywrightSession(playwright=pw, browser=launch_browser, context=context)
        except PlaywrightError as exc:
            pw.stop()
            raise RuntimeError(f"Failed to launch browser: {exc}") from exc

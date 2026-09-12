import io
import os
import re
import shutil
import subprocess
import sys
import zipfile

import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.edge.options import Options as EdgeOptions
from selenium.webdriver.edge.service import Service as EdgeService


class BrowserManager:
    """Manage browser detection, driver downloads, and WebDriver initialization.

    Supports Chrome and Edge browsers with fallback logic, driver caching,
    and system PATH bypass.
    """

    SUPPORTED_BROWSERS = ['chrome', 'edge']
    CACHE_DIR = os.path.join(os.path.expanduser('~'), '.substack_scraper', 'drivers')

    @classmethod
    def get_cache_dir(cls) -> str:
        """Retrieve or create the local driver cache directory.

        Returns:
            str: Path to the local driver cache directory.
        """
        if not os.path.exists(cls.CACHE_DIR):
            os.makedirs(cls.CACHE_DIR)
        return cls.CACHE_DIR

    @staticmethod
    def get_browser_version(browser: str) -> str | None:
        """Detect the installed browser version.

        Args:
            browser: The browser name ('chrome' or 'edge').

        Returns:
            str | None: The detected version string, or None if detection fails.
        """
        version = None

        if browser == 'chrome':
            if os.name == 'nt':  # Windows
                paths = [
                    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
                    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
                    os.path.expandvars(r'%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe'),
                ]
                for path in paths:
                    if os.path.exists(path):
                        try:
                            result = subprocess.run(
                                ['powershell', '-Command', f'(Get-Item "{path}").VersionInfo.FileVersion'],
                                capture_output=True, text=True, timeout=10
                            )
                            if result.returncode == 0:
                                version = result.stdout.strip()
                                break
                        except Exception:
                            pass
            else:  # macOS/Linux
                try:
                    result = subprocess.run(
                        ['google-chrome', '--version'],
                        capture_output=True, text=True, timeout=10
                    )
                    if result.returncode == 0:
                        match = re.search(r'(\d+\.\d+\.\d+\.\d+)', result.stdout)
                        if match:
                            version = match.group(1)
                except Exception:
                    pass

        elif browser == 'edge':
            if os.name == 'nt':  # Windows
                paths = [
                    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
                    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
                ]
                for path in paths:
                    if os.path.exists(path):
                        try:
                            result = subprocess.run(
                                ['powershell', '-Command', f'(Get-Item "{path}").VersionInfo.FileVersion'],
                                capture_output=True, text=True, timeout=10
                            )
                            if result.returncode == 0:
                                version = result.stdout.strip()
                                break
                        except Exception:
                            pass
            else:  # macOS/Linux
                try:
                    result = subprocess.run(
                        ['microsoft-edge', '--version'],
                        capture_output=True, text=True, timeout=10
                    )
                    if result.returncode == 0:
                        match = re.search(r'(\d+\.\d+\.\d+\.\d+)', result.stdout)
                        if match:
                            version = match.group(1)
                except Exception:
                    pass

        return version

    @staticmethod
    def get_driver_version(driver_path: str) -> str | None:
        """Get the version string of a webdriver executable.

        Args:
            driver_path: Filesystem path to the driver binary.

        Returns:
            str | None: Version string if successfully parsed, else None.
        """
        if not os.path.exists(driver_path):
            return None
        try:
            result = subprocess.run(
                [driver_path, '--version'],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0:
                match = re.search(r'(\d+\.\d+\.\d+\.\d+)', result.stdout)
                if match:
                    return match.group(1)
        except Exception:
            pass
        return None

    @staticmethod
    def versions_compatible(browser_version: str, driver_version: str) -> bool:
        """Check if browser and driver major versions match.

        Args:
            browser_version: Browser version string.
            driver_version: Driver version string.

        Returns:
            bool: True if the major versions match, False otherwise.
        """
        if not browser_version or not driver_version:
            return False
        try:
            browser_major = int(browser_version.split('.')[0])
            driver_major = int(driver_version.split('.')[0])
            return browser_major == driver_major
        except (ValueError, IndexError):
            return False

    @staticmethod
    def _find_stale_drivers() -> list[str]:
        """Find potentially stale driver executables in common system PATH locations."""
        stale_paths = []
        common_locations = [
            r'C:\Windows\msedgedriver.exe',
            r'C:\Windows\chromedriver.exe',
            r'C:\Windows\System32\msedgedriver.exe',
            r'C:\Windows\System32\chromedriver.exe',
        ]
        for path in common_locations:
            if os.path.exists(path):
                stale_paths.append(path)
        return stale_paths

    @staticmethod
    def get_user_data_dir(browser: str) -> str:
        """Return a persistent user data directory for browser profile storage.

        Args:
            browser: Browser identifier ('chrome' or 'edge').

        Returns:
            str: Directory path for the browser's persistent user profile.
        """
        base_dir = os.path.join(os.path.expanduser('~'), '.substack_scraper')
        if not os.path.exists(base_dir):
            os.makedirs(base_dir)
        return os.path.join(base_dir, f'{browser}_profile')

    @classmethod
    def _download_driver_with_requests(cls, browser: str, browser_version: str) -> str | None:
        """Download compatible driver directly via HTTP requests into local cache."""
        major_version = browser_version.split('.')[0]
        cache_dir = cls.get_cache_dir()

        if browser == 'chrome':
            driver_name = 'chromedriver.exe' if os.name == 'nt' else 'chromedriver'
            driver_path = os.path.join(cache_dir, f'chromedriver-{major_version}', driver_name)

            if os.path.exists(driver_path):
                cached_version = cls.get_driver_version(driver_path)
                if cached_version and cls.versions_compatible(browser_version, cached_version):
                    print(f"Using cached chromedriver {cached_version}")
                    return driver_path

            try:
                print(f"Fetching Chrome driver info for version {major_version}...")
                endpoints = [
                    f"https://googlechromelabs.github.io/chrome-for-testing/LATEST_RELEASE_{major_version}",
                    "https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json",
                ]

                driver_version = None
                download_url = None

                try:
                    resp = requests.get(endpoints[0], timeout=30)
                    if resp.ok:
                        driver_version = resp.text.strip()
                        platform = 'win64' if os.name == 'nt' else ('mac-x64' if sys.platform == 'darwin' else 'linux64')
                        download_url = f"https://storage.googleapis.com/chrome-for-testing-public/{driver_version}/{platform}/chromedriver-{platform}.zip"
                except Exception:
                    pass

                if not download_url:
                    resp = requests.get(endpoints[1], timeout=30)
                    if resp.ok:
                        data = resp.json()
                        channels = data.get('channels', {})
                        stable = channels.get('Stable', {})
                        driver_version = stable.get('version', '')

                        if driver_version.startswith(major_version):
                            downloads = stable.get('downloads', {}).get('chromedriver', [])
                            platform = 'win64' if os.name == 'nt' else ('mac-x64' if sys.platform == 'darwin' else 'linux64')
                            for d in downloads:
                                if d.get('platform') == platform:
                                    download_url = d.get('url')
                                    break

                if not download_url:
                    print(f"Could not find chromedriver download URL for Chrome {major_version}")
                    return None

                print(f"Downloading chromedriver {driver_version}...")
                resp = requests.get(download_url, timeout=120)
                if not resp.ok:
                    print(f"Download failed: HTTP {resp.status_code}")
                    return None

                extract_dir = os.path.join(cache_dir, f'chromedriver-{major_version}')
                if os.path.exists(extract_dir):
                    shutil.rmtree(extract_dir)
                os.makedirs(extract_dir)

                with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
                    for name in zf.namelist():
                        if name.endswith(driver_name):
                            source = zf.open(name)
                            target_path = os.path.join(extract_dir, driver_name)
                            with open(target_path, 'wb') as target:
                                target.write(source.read())
                            if os.name != 'nt':
                                os.chmod(target_path, 0o755)
                            print(f"[OK] Chromedriver downloaded to: {target_path}")
                            return target_path

                print("Could not find chromedriver in downloaded archive")
                return None

            except Exception as e:
                print(f"Failed to download chromedriver: {e}")
                return None

        elif browser == 'edge':
            driver_name = 'msedgedriver.exe' if os.name == 'nt' else 'msedgedriver'
            driver_path = os.path.join(cache_dir, f'msedgedriver-{major_version}', driver_name)

            if os.path.exists(driver_path):
                cached_version = cls.get_driver_version(driver_path)
                if cached_version and cls.versions_compatible(browser_version, cached_version):
                    print(f"Using cached msedgedriver {cached_version}")
                    return driver_path

            try:
                print(f"Fetching Edge driver info for version {major_version}...")
                platform = 'win64' if os.name == 'nt' else ('mac64' if sys.platform == 'darwin' else 'linux64')
                version_url = f"https://msedgedriver.azureedge.net/LATEST_RELEASE_{major_version}"
                try:
                    resp = requests.get(version_url, timeout=30)
                    if resp.ok:
                        driver_version = resp.text.strip()
                    else:
                        driver_version = browser_version
                except Exception:
                    driver_version = browser_version

                download_url = f"https://msedgedriver.azureedge.net/{driver_version}/edgedriver_{platform}.zip"

                print(f"Downloading msedgedriver {driver_version}...")
                resp = requests.get(download_url, timeout=120)
                if not resp.ok:
                    print(f"Download failed: HTTP {resp.status_code}")
                    return None

                extract_dir = os.path.join(cache_dir, f'msedgedriver-{major_version}')
                if os.path.exists(extract_dir):
                    shutil.rmtree(extract_dir)
                os.makedirs(extract_dir)

                with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
                    for name in zf.namelist():
                        if name.endswith(driver_name):
                            source = zf.open(name)
                            target_path = os.path.join(extract_dir, driver_name)
                            with open(target_path, 'wb') as target:
                                target.write(source.read())
                            if os.name != 'nt':
                                os.chmod(target_path, 0o755)
                            print(f"[OK] msedgedriver downloaded to: {target_path}")
                            return target_path

                print("Could not find msedgedriver in downloaded archive")
                return None

            except Exception as e:
                print(f"Failed to download msedgedriver: {e}")
                return None

        return None

    @classmethod
    def create_driver(
        cls,
        browser: str = 'chrome',
        headless: bool = False,
        driver_path: str | None = None,
        browser_path: str | None = None,
        user_agent: str | None = None,
        use_persistent_profile: bool = False,
    ) -> webdriver.Remote:
        """Create and initialize a WebDriver instance using smart fallback strategies.

        Attempts driver initialization through:
        1. Explicit path (if provided).
        2. Local driver cache (downloaded via direct HTTP).
        3. webdriver_manager.
        4. Selenium Manager built-in fallback.

        Args:
            browser: Target browser name ('chrome' or 'edge').
            headless: Whether to launch browser in headless mode.
            driver_path: Optional explicit path to driver executable.
            browser_path: Optional explicit path to browser binary.
            user_agent: Optional custom user-agent string.
            use_persistent_profile: Whether to persist profile sessions across runs.

        Returns:
            webdriver.Remote: Initialized Selenium WebDriver instance.

        Raises:
            ValueError: If an unsupported browser is specified.
            RuntimeError: If all driver initialization strategies fail.
        """
        browser = browser.lower()
        if browser not in cls.SUPPORTED_BROWSERS:
            raise ValueError(f"Unsupported browser: {browser}. Use one of: {cls.SUPPORTED_BROWSERS}")

        stale_drivers = cls._find_stale_drivers()
        if stale_drivers:
            print("WARNING: Found old drivers in system PATH that may cause issues if other methods fail:")
            for p in stale_drivers:
                v = cls.get_driver_version(p) or "unknown"
                print(f"   - {p} (version: {v})")
            print("   We'll try to bypass these by using our own driver cache.\n")

        browser_version = cls.get_browser_version(browser)
        print(f"Detected {browser.title()} version: {browser_version or 'unknown'}")

        if not browser_version:
            print(f"WARNING: Could not detect {browser.title()} version. Make sure it's installed.")

        if browser == 'chrome':
            options = ChromeOptions()
        else:
            options = EdgeOptions()

        if headless:
            options.add_argument("--headless=new")

        if browser_path:
            options.binary_location = browser_path

        if user_agent:
            options.add_argument(f"user-agent={user_agent}")

        if use_persistent_profile:
            profile_dir = cls.get_user_data_dir(browser)
            options.add_argument(f"user-data-dir={profile_dir}")
            print(f"Using persistent profile at: {profile_dir}")

        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")

        errors = []

        # Strategy 1: Explicit driver path
        if driver_path and os.path.exists(driver_path):
            try:
                print(f"Using explicit driver path: {driver_path}")
                driver_version = cls.get_driver_version(driver_path)
                if driver_version:
                    print(f"Driver version: {driver_version}")
                    if browser_version and not cls.versions_compatible(browser_version, driver_version):
                        print("WARNING: Driver version may not match browser version")

                if browser == 'chrome':
                    service = ChromeService(executable_path=driver_path)
                    return webdriver.Chrome(service=service, options=options)
                else:
                    service = EdgeService(executable_path=driver_path)
                    return webdriver.Edge(service=service, options=options)
            except Exception as e:
                errors.append(f"Explicit driver path failed: {e}")
                print(f"[FAIL] Explicit driver path failed: {e}")

        # Strategy 2: Download to our cache
        if browser_version:
            print("\nDownloading driver to local cache (bypasses system PATH)...")
            try:
                downloaded_path = cls._download_driver_with_requests(browser, browser_version)
                if downloaded_path and os.path.exists(downloaded_path):
                    print(f"Using downloaded driver: {downloaded_path}")
                    if browser == 'chrome':
                        service = ChromeService(executable_path=downloaded_path)
                        return webdriver.Chrome(service=service, options=options)
                    else:
                        service = EdgeService(executable_path=downloaded_path)
                        return webdriver.Edge(service=service, options=options)
            except Exception as e:
                errors.append(f"Direct download failed: {e}")
                print(f"[FAIL] Direct download failed: {e}")

        # Strategy 3: webdriver_manager with explicit path
        print("\nTrying webdriver_manager...")
        try:
            if browser == 'chrome':
                from webdriver_manager.chrome import ChromeDriverManager
                mgr = ChromeDriverManager()
                driver_path_wdm = mgr.install()
                print(f"webdriver_manager installed driver to: {driver_path_wdm}")
                service = ChromeService(executable_path=driver_path_wdm)
                return webdriver.Chrome(service=service, options=options)
            else:
                from webdriver_manager.microsoft import EdgeChromiumDriverManager
                mgr = EdgeChromiumDriverManager()
                driver_path_wdm = mgr.install()
                print(f"webdriver_manager installed driver to: {driver_path_wdm}")
                service = EdgeService(executable_path=driver_path_wdm)
                return webdriver.Edge(service=service, options=options)
        except Exception as e:
            errors.append(f"webdriver_manager failed: {e}")
            print(f"[FAIL] webdriver_manager failed: {e}")

        # Strategy 4: Selenium Manager
        print("\nTrying Selenium Manager (last resort)...")
        try:
            if browser == 'chrome':
                return webdriver.Chrome(options=options)
            else:
                return webdriver.Edge(options=options)
        except Exception as e:
            errors.append(f"Selenium Manager failed: {e}")
            print(f"[FAIL] Selenium Manager failed: {e}")

        error_msg = cls._build_error_message(browser, browser_version, stale_drivers, errors)
        raise RuntimeError(error_msg)

    @classmethod
    def _build_error_message(
        cls,
        browser: str,
        browser_version: str | None,
        stale_drivers: list[str],
        errors: list[str],
    ) -> str:
        """Build a detailed troubleshooting error message when driver creation fails."""
        lines = [
            "",
            "=" * 70,
            "BROWSER DRIVER SETUP FAILED",
            "=" * 70,
            "",
            f"Could not start {browser.title()} WebDriver.",
            "",
        ]

        if browser_version:
            lines.append(f"Your {browser.title()} version: {browser_version}")
            major_version = browser_version.split('.')[0]
        else:
            lines.append(f"Could not detect your {browser.title()} version.")
            major_version = "XXX"

        lines.append("")

        if stale_drivers:
            lines.extend([
                "STALE DRIVERS IN SYSTEM PATH:",
                "These old drivers may have interfered with automatic setup:",
            ])
            for path in stale_drivers:
                driver_ver = cls.get_driver_version(path) or "unknown version"
                lines.append(f"   - {path} (version: {driver_ver})")
            lines.extend([
                "",
                "To fix: Open an Administrator command prompt and delete these files,",
                "or rename them (e.g., chromedriver.exe.bak)",
                "",
            ])

        lines.extend([
            "HOW TO FIX:",
            "",
            "Option 1: Download the correct driver manually",
        ])

        if browser == 'chrome':
            lines.extend([
                f"   1. Go to: https://googlechromelabs.github.io/chrome-for-testing/",
                f"   2. Download chromedriver for version {major_version} (win64)",
                f"   3. Extract chromedriver.exe somewhere (e.g., C:\\tools\\chromedriver.exe)",
                f"   4. Run with: --chrome-driver-path C:\\tools\\chromedriver.exe",
            ])
        else:
            lines.extend([
                f"   1. Go to: https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/",
                f"   2. Download msedgedriver for version {major_version}",
                f"   3. Extract msedgedriver.exe somewhere (e.g., C:\\tools\\msedgedriver.exe)",
                f"   4. Run with: --edge-driver-path C:\\tools\\msedgedriver.exe",
            ])

        lines.extend([
            "",
            "Option 2: Try a different browser",
            f"   python substack_scraper.py --premium --browser {'edge' if browser == 'chrome' else 'chrome'}",
            "",
            "Option 3: Delete stale drivers (requires Administrator)",
            "   Open cmd as Administrator and run:",
        ])
        for path in stale_drivers:
            lines.append(f"   del \"{path}\"")

        lines.extend([
            "",
            "-" * 70,
            "Debug info (errors encountered):",
        ])

        for i, error in enumerate(errors, 1):
            error_short = str(error)[:300] + "..." if len(str(error)) > 300 else str(error)
            lines.append(f"   {i}. {error_short}")

        lines.extend(["", "=" * 70])
        return "\n".join(lines)

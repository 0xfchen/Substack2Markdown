# Substack2Markdown

Substack2Markdown is a Python tool for downloading free and premium Substack posts and saving them as both Markdown and HTML files, complete with a local HTML interface to browse and sort through posts by date or like count. It can save paid subscriber-only content as long as you are subscribed to that Substack publication.

![Substack2Markdown Interface](./assets/images/screenshot.png)

Once you run the scraper, it saves markdown files into `data/md_files/<author>/` and generates an interactive HTML viewer in `data/html_pages/<author>.html`. When image downloading is enabled (`--images`), post images are saved locally into `data/images/<author>/<post_slug>/`.

## Features

- Converts Substack posts into Markdown files with original formatting and embeds.
- Generates an interactive local HTML viewer with sorting by date or like count.
- Supports both free and premium publications (with active subscription).
- Supports Chrome and Microsoft Edge browsers with automated driver discovery and caching.
- Supports persistent browser profiles to remember login sessions and solve CAPTCHAs interactively.
- Supports single-post scraping via post URL (e.g. `/p/post-slug`).
- Downloads post images locally with `--images` and rewrites markdown image links.
- Supports optional MDX frontmatter output (`--frontmatter mdx`).

## Installation

Clone the repository and install dependencies using `uv` (recommended) or `pip`:

```bash
git clone https://github.com/yourusername/Substack2Markdown.git
cd Substack2Markdown

# Install dependencies with uv (or pip install .)
uv sync
```

### Credentials Setup (For Premium Content)

To scrape subscriber-only posts, provide your Substack credentials using either of the following methods:

1. **`.env` file** in the project root (recommended, see `.env.example`):
   ```ini
   SUBSTACK_EMAIL=your-email@domain.com
   SUBSTACK_PASSWORD=your-password
   ```

2. **Environment variables**:
   ```bash
   export SUBSTACK_EMAIL="your-email@domain.com"
   export SUBSTACK_PASSWORD="your-password"
   ```

> The `.env` file is gitignored to ensure your credentials are never committed.

For premium scraping, you will also need either **Google Chrome** or **Microsoft Edge** installed.

## Usage

### Basic Scraping (Free Content)

Scrape an entire publication:
```bash
uv run substack_scraper --url https://example.substack.com
# Or using python module:
python -m substack_scraper --url https://example.substack.com
```

Scrape a single post directly:
```bash
uv run substack_scraper --url https://example.substack.com/p/my-post
```

Limit the number of posts to scrape:
```bash
uv run substack_scraper --url https://example.substack.com --number 5
```

Download images locally and rewrite markdown image links:
```bash
uv run substack_scraper --url https://example.substack.com --images
```

Export with legacy header format (default is `mdx`):
```bash
uv run substack_scraper --url https://example.substack.com --frontmatter legacy
```

Specify custom output directory:
```bash
uv run substack_scraper --url https://example.substack.com --directory /path/to/save/posts
```

### Premium Scraping (Subscriber-Only Content)

Premium posts require subscriber access. Automation uses **Playwright** with zero driver setup, launching your desktop **Google Chrome** or **Microsoft Edge** directly.

Scrape premium content using Chrome or Edge:
```bash
uv run substack_scraper --url https://example.substack.com --premium --browser chrome
```

#### Reusing Existing Sessions (No Repeated Logins)

**Option 1: Persistent Profile (Recommended)**
Saves your logged-in state to `~/.substack_scraper/<browser>_profile`:
```bash
# First run: logs in or solve CAPTCHA interactively once
uv run substack_scraper --url https://example.substack.com --premium --persistent-profile

# Subsequent runs: reuse the session automatically
uv run substack_scraper --url https://example.substack.com --premium --persistent-profile --skip-login
```

**Option 2: Storage State JSON**
Playwright automatically exports auth tokens and cookies to `~/.substack_scraper/storage_state.json` upon successful login:
```bash
# Run headlessly reusing saved cookies
uv run substack_scraper --url https://example.substack.com --premium --headless --skip-login
# Or specify a custom state file:
uv run substack_scraper --url https://example.substack.com --premium --storage-state path/to/state.json
```

**Option 3: Attach Directly to Active Browser (CDP)**
Connect directly to an already-open personal Chrome/Edge window without logging in again:
```bash
# 1. Start Chrome with remote debugging:
chrome.exe --remote-debugging-port=9222

# 2. Scrape directly using the active browser's tabs and cookies:
uv run substack_scraper --url https://example.substack.com --premium --cdp-url http://localhost:9222
```

## Viewing Markdown Files in Browser

To read the Markdown files in your browser, you can install the [Markdown Viewer](https://chromewebstore.google.com/detail/markdown-viewer/ckkdlimhmcjmikdlpkmbgfkaikojcbjk) browser extension, or simply open the generated HTML archive (`data/html_pages/<author>.html`) in any web browser and switch between HTML and Markdown views.

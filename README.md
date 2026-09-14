# Substack2Markdown

Substack2Markdown is a Python tool for downloading free and premium Substack posts and saving them into clean, structured Markdown files organized by author (`content/<author>/posts/<slug>.md`). It extracts rich post metadata, sanitizes promotional clutter, and powers a modern local static reader.

Once you run the scraper, it saves markdown files into `content/<author>/posts/` and an author catalog into `content/<author>/metadata.json`. When image downloading is enabled (`--images`), post images are saved locally into `content/<author>/images/<post_slug>/` and rewritten with relative links.

## Features

- Converts Substack posts into clean Markdown files with rich YAML frontmatter.
- Cleans distracting promotional widgets (subscription banners, paywall prompts, footers) with `--no-clean` opt-out.
- Preserves code block language syntax identifiers (` ```python `) for syntax highlighting.
- Extracts rich post metadata (`post_id`, `tags`, `description`, `wordcount`, `audience`, `canonical_url`) with zero extra network requests.
- Author-centric content organization (`content/<author>/posts/`, `images/`, `metadata.json`).
- Supports both free and premium publications (with active subscription).
- Supports Chrome and Microsoft Edge browsers with automated driver discovery and caching.
- Supports persistent browser profiles to remember login sessions and solve CAPTCHAs interactively.
- Supports single-post scraping via post URL (e.g. `/p/post-slug`).
- Downloads post images locally with `--images` and rewrites markdown image links.
- Scaffolds a local static reader in `reader/` powered by Astro.

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

Keep raw promotional widgets (disable cleaning):
```bash
uv run substack_scraper --url https://example.substack.com --no-clean
```

Specify custom output base directory:
```bash
uv run substack_scraper --url https://example.substack.com --directory /path/to/save/content
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

## Local Reader (Astro)

A modern static reader is provided in the `reader/` directory.

To run the local reader:
```bash
cd reader
pnpm install
pnpm dev
```
Open [http://localhost:4321](http://localhost:4321) in your browser to read through all scraped newsletters with full search, tag filtering, and syntax highlighting.

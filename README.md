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

To scrape subscriber-only posts, provide your Substack credentials using any of the following methods (in order of precedence):

1. **Environment variables**:
   ```bash
   export SUBSTACK_EMAIL="your-email@domain.com"
   export SUBSTACK_PASSWORD="your-password"
   ```

2. **`.env` file** in the project root (see `.env.example`):
   ```ini
   SUBSTACK_EMAIL=your-email@domain.com
   SUBSTACK_PASSWORD=your-password
   ```

3. **`config.py`** in the project root:
   ```python
   EMAIL = "your-email@domain.com"
   PASSWORD = "your-password"
   ```

> `config.py` and `.env` are gitignored to ensure your credentials are never committed.

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

Export with MDX-compliant YAML frontmatter:
```bash
uv run substack_scraper --url https://example.substack.com --frontmatter mdx
```

Specify custom output directory:
```bash
uv run substack_scraper --url https://example.substack.com --directory /path/to/save/posts
```

### Premium Scraping (Subscriber-Only Content)

Scrape premium content using Chrome or Edge:
```bash
uv run substack_scraper --url https://example.substack.com --premium --browser chrome
```

Use a persistent browser profile to save login sessions and solve CAPTCHA interactively:
```bash
# First run: solves CAPTCHA or logs in interactively once
uv run substack_scraper --url https://example.substack.com --premium --persistent-profile

# Subsequent runs: reuse the existing logged-in session
uv run substack_scraper --url https://example.substack.com --premium --persistent-profile --skip-login
```

## Viewing Markdown Files in Browser

To read the Markdown files in your browser, you can install the [Markdown Viewer](https://chromewebstore.google.com/detail/markdown-viewer/ckkdlimhmcjmikdlpkmbgfkaikojcbjk) browser extension, or simply open the generated HTML archive (`data/html_pages/<author>.html`) in any web browser and switch between HTML and Markdown views.

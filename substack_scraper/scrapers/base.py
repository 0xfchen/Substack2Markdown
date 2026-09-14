import html
import json
import logging
import os
import re
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Any, Literal
from xml.etree import ElementTree as ET

import html2text
import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

from ..config import BASE_CONTENT_DIR, DEFAULT_REQUEST_TIMEOUT
from ..images import count_images_in_markdown, process_markdown_images
from ..url_utils import (
    extract_main_part,
    get_post_slug,
    get_publication_url,
    is_post_url,
)

logger = logging.getLogger(__name__)

FrontmatterFormat = Literal["mdx", "legacy"]


class SubstackHTML2Text(html2text.HTML2Text):
    """Custom HTML2Text converter that preserves code block language syntax identifiers."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.backquote_code_style = True
        self.body_width = 0
        self._current_code_lang: str = ""

    def handle_tag(self, tag: str, attrs: dict[str, str | None], start: bool) -> None:
        if tag == "pre":
            if start:
                classes = attrs.get("class") or ""
                match = re.search(r"language-(\w+)", classes)
                self._current_code_lang = match.group(1) if match else ""
            else:
                self._current_code_lang = ""
        elif tag == "code" and start and not self._current_code_lang:
            classes = attrs.get("class") or ""
            match = re.search(r"language-(\w+)", classes)
            if match:
                self._current_code_lang = match.group(1)
        super().handle_tag(tag, attrs, start)

    def o(self, data: str, puredata: bool = False, force: bool | str = False) -> None:
        if self.startpre and self.backquote_code_style and self._current_code_lang:
            self.startpre = False
            self.out("\n" + self.pre_indent + "```" + self._current_code_lang + "\n")
            self.p_p = 0
            self._current_code_lang = ""
        super().o(data, puredata=puredata, force=force)


class BaseSubstackScraper(ABC):
    """Abstract base scraper defining Substack post and metadata extraction pipeline.

    Handles URL discovery via sitemaps and RSS feeds, image tracking,
    author-centric folder structures, content cleaning, and YAML frontmatter.
    """

    def __init__(
        self,
        base_substack_url: str,
        content_save_dir: str = BASE_CONTENT_DIR,
        html_save_dir: str | None = None,
        download_images: bool = False,
        frontmatter_format: FrontmatterFormat = "mdx",
        overwrite: bool = False,
        clean_content: bool = True,
    ) -> None:
        """Initialize base scraper configuration and target directories.

        Args:
            base_substack_url: Publication homepage or individual post URL.
            content_save_dir: Root directory for author-centric exports (defaults to 'content').
            html_save_dir: Deprecated / unused HTML export directory.
            download_images: Whether to download CDN images locally.
            frontmatter_format: Deprecated frontmatter format selector.
            overwrite: Whether to overwrite existing files on disk when scraping.
            clean_content: Whether to strip promotional widgets and subscription CTAs.
        """
        self.frontmatter_format: FrontmatterFormat = frontmatter_format
        self.overwrite: bool = overwrite
        self.clean_content: bool = clean_content
        self.is_single_post: bool = is_post_url(base_substack_url)
        self.post_slug: str | None = get_post_slug(base_substack_url) if self.is_single_post else None
        original_url = base_substack_url

        if self.is_single_post:
            base_substack_url = get_publication_url(base_substack_url)

        if not base_substack_url.endswith("/"):
            base_substack_url += "/"
        self.base_substack_url: str = base_substack_url

        self.writer_name: str = extract_main_part(base_substack_url)
        self.base_content_dir: str = content_save_dir
        self.author_dir: str = os.path.join(content_save_dir, self.writer_name)
        self.posts_save_dir: str = os.path.join(self.author_dir, "posts")
        self.images_save_dir: str = os.path.join(self.author_dir, "images")
        self.metadata_file_path: str = os.path.join(self.author_dir, "metadata.json")

        # Aliases for backward compatibility
        self.md_save_dir: str = self.posts_save_dir
        self.base_md_dir: str = content_save_dir
        self.base_html_dir: str = html_save_dir or os.path.join(content_save_dir, "_html")
        self.html_save_dir: str = self.base_html_dir

        os.makedirs(self.posts_save_dir, exist_ok=True)
        logger.info("Created posts directory %s", self.posts_save_dir)

        self.download_images: bool = download_images
        self.image_dir: Path = Path(self.images_save_dir)
        if self.download_images:
            os.makedirs(self.images_save_dir, exist_ok=True)

        if self.is_single_post:
            self.post_urls: list[str] = [original_url]
        else:
            self.keywords: list[str] = ["about", "archive", "podcast"]
            self.post_urls: list[str] = self.get_all_post_urls()

    def get_all_post_urls(self) -> list[str]:
        """Fetch all post URLs via sitemap.xml with feed.xml fallback.

        Returns:
            list[str]: Filtered post URL list.
        """
        urls = self.fetch_urls_from_sitemap()
        if not urls:
            urls = self.fetch_urls_from_feed()
        return self.filter_urls(urls, self.keywords)

    def fetch_urls_from_sitemap(self) -> list[str]:
        """Fetch post URLs declared in the publication sitemap.xml.

        Returns:
            list[str]: Discovered URLs, or empty list on error.
        """
        sitemap_url = f"{self.base_substack_url}sitemap.xml"
        response = requests.get(sitemap_url, timeout=DEFAULT_REQUEST_TIMEOUT)

        if not response.ok:
            logger.warning("Error fetching sitemap at %s: %s", sitemap_url, response.status_code)
            return []

        root = ET.fromstring(response.content)
        urls = [
            element.text for element in root.iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc") if element.text
        ]
        return urls

    def fetch_urls_from_feed(self) -> list[str]:
        """Fetch recent post URLs from feed.xml RSS fallback.

        Returns:
            list[str]: URLs extracted from RSS items (typically up to 22 posts).
        """
        logger.info("Falling back to feed.xml. This will only contain up to the 22 most recent posts.")
        feed_url = f"{self.base_substack_url}feed.xml"
        response = requests.get(feed_url, timeout=DEFAULT_REQUEST_TIMEOUT)

        if not response.ok:
            logger.warning("Error fetching feed at %s: %s", feed_url, response.status_code)
            return []

        root = ET.fromstring(response.content)
        urls = []
        for item in root.findall(".//item"):
            link = item.find("link")
            if link is not None and link.text:
                urls.append(link.text)

        return urls

    @staticmethod
    def filter_urls(urls: list[str], keywords: list[str]) -> list[str]:
        """Exclude non-post URLs containing specific reserved keywords.

        Args:
            urls: Candidate URLs to filter.
            keywords: Blacklisted keywords (e.g. 'about', 'archive', 'podcast').

        Returns:
            list[str]: URLs that do not contain any of the blacklisted keywords.
        """
        return [url for url in urls if all(keyword not in url for keyword in keywords)]

    @staticmethod
    def convert_youtube_embeds(html_content: str) -> str:
        """Replace Substack YouTube embed wrappers with linked thumbnail markdown/HTML.

        Args:
            html_content: Raw post HTML containing potential youtube-wrap divs.

        Returns:
            str: Modified HTML with clickable preview thumbnails replacing embed divs.
        """
        if "youtube-wrap" not in html_content:
            return html_content
        soup = BeautifulSoup(html_content, "html.parser")
        for wrap in soup.find_all("div", class_="youtube-wrap"):
            video_id = None
            if wrap.has_attr("data-attrs"):
                try:
                    video_id = json.loads(wrap["data-attrs"]).get("videoId")
                except (KeyError, TypeError, ValueError):
                    pass
            if not video_id:
                iframe = wrap.find("iframe")
                if iframe and "src" in iframe.attrs:
                    match = re.search(r"embed/([a-zA-Z0-9_-]+)", iframe["src"])
                    if match:
                        video_id = match.group(1)
            if not video_id:
                continue

            link = soup.new_tag("a", href=f"https://www.youtube.com/watch?v={video_id}")
            img = soup.new_tag(
                "img",
                src=f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
                alt="YouTube video",
            )
            link.append(img)
            wrap.replace_with(link)

        return str(soup)

    @staticmethod
    def _clean_post_html(soup: BeautifulSoup) -> None:
        """Strip promotional widgets, subscription banners, reaction bars, and comment buttons."""
        selectors_to_remove = [
            "div.subscription-widget-wrap",
            "div.post-footer",
            "div.post-ufi",
            "div.comments-section",
            "div.caption-rec-wrap",
            "button.like-button",
            "div.like-button-container",
        ]
        for selector in selectors_to_remove:
            for element in soup.select(selector):
                element.decompose()

        # Remove "Leave a comment" and interactive engagement prompt buttons
        for element in soup.find_all(["a", "button"]):
            text = element.get_text(strip=True).lower()
            href = element.get("href", "").rstrip("/")
            if text in ("leave a comment", "subscribe", "share", "share this post") or href.endswith(
                ("/comments", "/subscribe", "/share")
            ):
                parent = element.parent
                if (
                    parent
                    and parent.name in ("p", "div")
                    and any(cls in parent.get("class", []) for cls in ("button-wrapper", "button-wrap"))
                ):
                    parent.decompose()
                elif element.name == "button" or any(cls in element.get("class", []) for cls in ("button", "primary")):
                    element.decompose()

    @staticmethod
    def html_to_md(html_content: str, clean_content: bool = True) -> str:
        """Convert HTML content to Markdown with code language preservation and widget cleaning.

        Args:
            html_content: Raw post body HTML.
            clean_content: Whether to strip promotional widgets and reaction bars.

        Returns:
            str: Cleaned markdown string with preserved code block languages.
        """
        html_content = BaseSubstackScraper.convert_youtube_embeds(html_content)
        soup = BeautifulSoup(html_content, "html.parser")

        if clean_content:
            BaseSubstackScraper._clean_post_html(soup)

        converter = SubstackHTML2Text()
        return converter.handle(str(soup)).strip()

    def save_to_file(self, filepath: str, content: str, overwrite: bool = False) -> None:
        """Write content string to specified file with overwrite guard.

        Args:
            filepath: Destination file path.
            content: Text content to write.
            overwrite: If False, skip writing when file already exists.

        Raises:
            ValueError: If filepath or content is not a string.
        """
        if not isinstance(filepath, str):
            raise ValueError("filepath must be a string")
        if not isinstance(content, str):
            raise ValueError("content must be a string")
        if os.path.exists(filepath) and not overwrite:
            logger.info("File already exists: %s", filepath)
            return

        with open(filepath, "w", encoding="utf-8") as file:
            file.write(content)

    @staticmethod
    def get_filename_from_url(url: str, filetype: str = ".md") -> str:
        """Derive an output filename from a URL and extension.

        Args:
            url: Post or page URL.
            filetype: Desired file extension (e.g. '.md').

        Returns:
            str: Filename with extension.

        Raises:
            ValueError: If url or filetype is not a string.
        """
        if not isinstance(url, str):
            raise ValueError("url must be a string")
        if not isinstance(filetype, str):
            raise ValueError("filetype must be a string")
        if not filetype.startswith("."):
            filetype = f".{filetype}"
        return url.split("/")[-1] + filetype

    @staticmethod
    def _extract_metadata_from_md(md_filepath: str) -> dict[str, Any] | None:
        """Extract metadata dictionary from a local markdown file's frontmatter."""
        if not os.path.exists(md_filepath):
            return None
        try:
            with open(md_filepath, encoding="utf-8") as file:
                content = file.read()
        except OSError:
            return None

        metadata: dict[str, Any] = {}
        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                frontmatter_lines = parts[1].strip().splitlines()
                current_list_key = None
                for line in frontmatter_lines:
                    stripped = line.strip()
                    if not stripped:
                        continue
                    if stripped.startswith("- ") and current_list_key:
                        item = stripped[2:].strip().strip('"').strip("'")
                        metadata.setdefault(current_list_key, []).append(item)
                        continue
                    current_list_key = None
                    if ":" in line:
                        key, value = line.split(":", 1)
                        key = key.strip()
                        value = value.strip().strip('"').strip("'")
                        if not value:
                            current_list_key = key
                            metadata[key] = []
                        elif key in ("post_id", "wordcount") and value.isdigit():
                            metadata[key] = int(value)
                        else:
                            metadata[key] = value
        return metadata or None

    @staticmethod
    def _extract_post_id(html_content: str) -> int | None:
        """Extract Substack numeric post ID from HTML content."""
        match = re.search(r'\\?"post\\?":\s*\{[^}]*\\?"id\\?":\s*(\d+)', html_content)
        if match:
            return int(match.group(1))
        general_match = re.search(r'"postId":\s*(\d+)', html_content)
        if general_match:
            return int(general_match.group(1))
        id_match = re.search(r'\\?"id\\?":\s*(\d+)', html_content)
        if id_match:
            return int(id_match.group(1))
        return None

    @staticmethod
    def _extract_preloaded_post_data(html_content: str) -> dict[str, Any]:
        """Extract rich post metadata from window._preloads embedded in Substack HTML.

        Returns:
            dict[str, Any]: Dictionary containing post_id, tags, description,
                wordcount, audience, and canonical_url.
        """
        metadata: dict[str, Any] = {
            "post_id": None,
            "tags": [],
            "description": "",
            "wordcount": None,
            "audience": "everyone",
            "canonical_url": "",
        }

        # 1. Attempt to find window._preloads with JSON.parse("...")
        json_match = re.search(r'JSON\.parse\("((?:[^"\\]|\\.)*)"\)', html_content)
        if json_match:
            try:
                raw_inner = json_match.group(1)
                # If raw_inner has escaped quotes (\"), unescape them
                try:
                    decoded_str = raw_inner.encode("utf-8").decode("unicode_escape")
                    payload = json.loads(decoded_str)
                except Exception:
                    payload = json.loads(raw_inner.replace('\\"', '"'))
                post = payload.get("post") if isinstance(payload, dict) else None
                if isinstance(post, dict):
                    if "id" in post:
                        metadata["post_id"] = int(post["id"])
                    if "postTags" in post and isinstance(post["postTags"], list):
                        metadata["tags"] = [
                            t.get("name") for t in post["postTags"] if isinstance(t, dict) and t.get("name")
                        ]
                    if "description" in post and post["description"]:
                        metadata["description"] = post["description"].strip()
                    if "wordcount" in post and post["wordcount"] is not None:
                        metadata["wordcount"] = int(post["wordcount"])
                    if "audience" in post and post["audience"]:
                        metadata["audience"] = post["audience"]
                    if "canonical_url" in post and post["canonical_url"]:
                        metadata["canonical_url"] = post["canonical_url"]
                    return metadata
            except Exception as exc:
                logger.debug("Failed parsing JSON.parse preloads: %s", exc)

        # 2. Fallback regex extraction if full JSON.parse fails or is not present
        if metadata["post_id"] is None:
            metadata["post_id"] = BaseSubstackScraper._extract_post_id(html_content)

        if not metadata["tags"]:
            tags_match = re.search(r'\\?"postTags\\?":\s*(\[[^\]]*\])', html_content)
            if tags_match:
                try:
                    clean_tags_str = tags_match.group(1).replace('\\"', '"')
                    tags_list = json.loads(clean_tags_str)
                    metadata["tags"] = [t.get("name") for t in tags_list if isinstance(t, dict) and t.get("name")]
                except Exception:
                    pass

        if not metadata["description"]:
            desc_match = re.search(
                r'<meta\s+(?:name|property)="(?:\w+:)?description"\s+content="([^"]*)"',
                html_content,
                re.IGNORECASE,
            )
            if desc_match:
                metadata["description"] = html.unescape(desc_match.group(1).strip())

        if metadata["wordcount"] is None:
            wc_match = re.search(r'\\?"wordcount\\?":\s*(\d+)', html_content)
            if wc_match:
                metadata["wordcount"] = int(wc_match.group(1))

        if metadata["audience"] == "everyone":
            aud_match = re.search(r'\\?"audience\\?":\s*\\?"([^\\",]+)\\?"', html_content)
            if aud_match:
                metadata["audience"] = aud_match.group(1)

        if not metadata["canonical_url"]:
            canon_match = re.search(r'<link\s+rel="canonical"\s+href="([^"]*)"', html_content, re.IGNORECASE)
            if canon_match:
                metadata["canonical_url"] = canon_match.group(1).strip()

        return metadata

    @staticmethod
    def combine_metadata_and_content(
        title: str,
        subtitle: str,
        date: str,
        author: str,
        cover_image: str,
        content: str,
        post_id: int | None = None,
        tags: list[str] | None = None,
        description: str = "",
        wordcount: int | None = None,
        audience: str = "everyone",
        canonical_url: str = "",
        like_count: str | None = None,
        frontmatter_format: FrontmatterFormat = "mdx",
        source_url: str = "",
    ) -> str:
        """Combine post metadata headers with markdown body using clean YAML frontmatter.

        Args:
            title: Post title.
            subtitle: Post subtitle.
            date: Publication date string (ISO or readable).
            author: Author display name.
            cover_image: Cover image URL.
            content: Main article markdown body.
            post_id: Optional Substack post ID for unique identification.
            tags: Optional list of post tag strings.
            description: Optional SEO description or article summary.
            wordcount: Optional word count integer.
            audience: Audience tier ('everyone' or 'only_paid').
            canonical_url: Permanent link back to the live Substack essay.
            like_count: Legacy like count (ignored in output).
            frontmatter_format: Format selector (standardized to 'mdx').
            source_url: Original post URL for MDX frontmatter.

        Returns:
            str: Combined markdown with YAML frontmatter.

        Raises:
            ValueError: If title or content is not a string.
        """
        if not isinstance(title, str):
            raise ValueError("title must be a string")
        if not isinstance(content, str):
            raise ValueError("content must be a string")

        safe_title = title.replace('"', '\\"')
        safe_subtitle = subtitle.replace('"', '\\"') if subtitle else ""
        safe_desc = description.replace('"', '\\"') if description else ""
        safe_author = author.replace('"', '\\"') if author else ""
        active_url = canonical_url or source_url

        frontmatter = "---\n"
        frontmatter += f'title: "{safe_title}"\n'
        if safe_subtitle:
            frontmatter += f'subtitle: "{safe_subtitle}"\n'
        if safe_desc:
            frontmatter += f'description: "{safe_desc}"\n'
        if post_id is not None:
            frontmatter += f"post_id: {post_id}\n"
        if safe_author:
            frontmatter += f'author: "{safe_author}"\n'
        if date:
            frontmatter += f'date: "{date}"\n'
        if tags:
            frontmatter += "tags:\n"
            for t in tags:
                clean_tag = t.replace('"', '\\"')
                frontmatter += f'  - "{clean_tag}"\n'
        if wordcount is not None:
            frontmatter += f"wordcount: {wordcount}\n"
        if audience:
            frontmatter += f'audience: "{audience}"\n'
        if active_url:
            frontmatter += f'canonical_url: "{active_url}"\n'
        if cover_image:
            frontmatter += f'cover_image: "{cover_image}"\n'
        frontmatter += "---\n\n"

        body = content.strip()
        if not body.startswith("# "):
            body = f"# {title}\n\n{body}"

        return frontmatter + body

    def extract_post_data(
        self,
        soup: BeautifulSoup,
        url: str = "",
    ) -> dict[str, Any]:
        """Extract metadata and parse post body into markdown from BeautifulSoup.

        Args:
            soup: Parsed HTML DOM of the Substack post.
            url: Source post URL.

        Returns:
            dict[str, Any]: Dictionary containing title, subtitle, author, date,
                cover_image, post_id, tags, description, wordcount, audience,
                canonical_url, and md_content.
        """
        title_element = soup.select_one("h1.post-title, h2")
        title = title_element.text.strip() if title_element else "Untitled"
        title_found = title_element is not None

        subtitle_element = soup.select_one("h3.subtitle, div.subtitle-HEEcLo")
        subtitle = subtitle_element.text.strip() if subtitle_element else ""

        date = ""
        author = ""
        cover_image = ""
        script_tag = soup.find("script", {"type": "application/ld+json"})
        if script_tag and script_tag.string:
            try:
                ld_json = json.loads(script_tag.string)
                if "datePublished" in ld_json:
                    date_str = ld_json["datePublished"]
                    date_obj = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                    date = date_obj.strftime("%Y-%m-%d")
                if "author" in ld_json:
                    authors = ld_json["author"]
                    if isinstance(authors, list) and authors:
                        author = authors[0].get("name", "")
                    elif isinstance(authors, dict):
                        author = authors.get("name", "")
                if "image" in ld_json:
                    images = ld_json["image"]
                    if isinstance(images, list) and images:
                        img = images[0]
                        cover_image = img.get("url", "") if isinstance(img, dict) else str(img)
                    elif isinstance(images, dict):
                        cover_image = images.get("url", "")
            except (json.JSONDecodeError, ValueError, KeyError):
                pass

        if not date:
            date = "Date not found"

        preloaded = self._extract_preloaded_post_data(str(soup))
        post_id = preloaded.get("post_id") or self._extract_post_id(str(soup))
        tags = preloaded.get("tags", [])
        description = preloaded.get("description", "") or subtitle
        wordcount = preloaded.get("wordcount")
        audience = preloaded.get("audience", "everyone")
        canonical_url = preloaded.get("canonical_url", "") or url

        content_element = soup.select_one("div.available-content")
        content_html = str(content_element) if content_element else ""
        md = self.html_to_md(content_html, clean_content=self.clean_content)

        if wordcount is None and md:
            wordcount = len(md.split())

        if not title_found or not content_element:
            paywall = soup.select_one("h2.paywall-title")
            ld_script = soup.find("script", {"type": "application/ld+json"})
            logger.warning(
                "[EXTRACT FAIL] url=%s title_found=%s title=%r content_element_found=%s paywall_present=%s ld_json_present=%s date=%r author=%r",
                url,
                title_found,
                title,
                content_element is not None,
                paywall is not None,
                ld_script is not None,
                date,
                author,
            )
            try:
                debug_dir = os.path.join(self.base_content_dir, "_debug", self.writer_name)
                os.makedirs(debug_dir, exist_ok=True)
                slug = get_post_slug(url) if url and is_post_url(url) else (url.rstrip("/").split("/")[-1] or "unknown")
                debug_path = os.path.join(debug_dir, f"{slug}.html")
                with open(debug_path, "w", encoding="utf-8") as f:
                    f.write(str(soup))
                logger.debug("Dumped raw HTML -> %s", debug_path)
            except OSError as dump_err:
                logger.warning("Failed to dump debug HTML: %s", dump_err)

        return {
            "title": title,
            "subtitle": subtitle,
            "author": author,
            "date": date,
            "cover_image": cover_image,
            "post_id": post_id,
            "tags": tags,
            "description": description,
            "wordcount": wordcount,
            "audience": audience,
            "canonical_url": canonical_url,
            "md_content": md,
        }

    def save_essays_data_to_json(self, essays_data: list[dict]) -> None:
        """Save essays metadata records to metadata.json in the author's directory.

        Merges records in place by unique post_id first (if available), then by slug
        or file_link. Preserves original order and updates modified fields.

        Args:
            essays_data: List of post metadata dictionaries to serialize.
        """
        os.makedirs(self.author_dir, exist_ok=True)
        json_path = self.metadata_file_path
        existing_data: list[dict] = []
        if os.path.exists(json_path):
            with open(json_path, encoding="utf-8") as file:
                try:
                    existing_data = json.load(file)
                except (json.JSONDecodeError, ValueError):
                    existing_data = []

        def _get_entry_key(entry: dict) -> str:
            if entry.get("post_id"):
                return f"id:{entry['post_id']}"
            if entry.get("slug"):
                return f"slug:{entry['slug']}"
            file_link = entry.get("file_link", "")
            if file_link:
                base_name = os.path.splitext(os.path.basename(file_link))[0]
                return f"file:{base_name}"
            return f"title:{entry.get('title', '')}"

        merged_data: list[dict] = []
        key_to_index: dict[str, int] = {}

        for item in existing_data:
            key = _get_entry_key(item)
            key_to_index[key] = len(merged_data)
            merged_data.append(dict(item))

        for item in essays_data:
            key = _get_entry_key(item)
            if key in key_to_index:
                index = key_to_index[key]
                merged_data[index].update(item)
            else:
                key_to_index[key] = len(merged_data)
                merged_data.append(dict(item))

        with open(json_path, "w", encoding="utf-8") as file:
            json.dump(merged_data, file, ensure_ascii=False, indent=4)

    def scrape_posts(self, num_posts_to_scrape: int = 0) -> None:
        """Iterate over all post URLs, scraping and saving them to disk.

        Args:
            num_posts_to_scrape: Number of posts to download (0 = scrape all).
        """
        proc_imgs = process_markdown_images

        essays_data = []
        count = 0
        total = num_posts_to_scrape if num_posts_to_scrape != 0 else len(self.post_urls)
        with tqdm(total=total, desc="Scraping posts") as pbar:
            for url in self.post_urls:
                try:
                    md_filename = self.get_filename_from_url(url, filetype=".md")
                    md_filepath = os.path.join(self.posts_save_dir, md_filename)
                    slug = get_post_slug(url) if is_post_url(url) else url.rstrip("/").split("/")[-1]

                    if self.overwrite or not os.path.exists(md_filepath):
                        soup = self.get_url_soup(url)
                        if soup is None:
                            total += 1
                            pbar.total = total
                            pbar.refresh()
                            continue

                        extracted = self.extract_post_data(soup, url)
                        if isinstance(extracted, tuple):
                            title, subtitle, author, date, cover_image = extracted[0:5]
                            raw_body = extracted[6] if len(extracted) > 6 else extracted[5]
                            preloads = self._extract_preloaded_post_data(str(soup))
                            post_id = self._extract_post_id(str(soup))
                            tags = preloads.get("tags", [])
                            description = preloads.get("description") or subtitle
                            wordcount = preloads.get("wordcount") or (len(raw_body.split()) if raw_body else 0)
                            audience = preloads.get("audience", "everyone")
                            canonical_url = preloads.get("canonical_url", url)
                        else:
                            title = extracted["title"]
                            subtitle = extracted["subtitle"]
                            author = extracted["author"]
                            date = extracted["date"]
                            cover_image = extracted["cover_image"]
                            raw_body = extracted["md_content"]
                            post_id = extracted.get("post_id")
                            tags = extracted.get("tags", [])
                            description = extracted.get("description", "") or subtitle
                            wordcount = extracted.get("wordcount") or (len(raw_body.split()) if raw_body else 0)
                            audience = extracted.get("audience", "everyone")
                            canonical_url = extracted.get("canonical_url", url)

                        content_element = soup.select_one("div.available-content")
                        if title == "Untitled" or content_element is None:
                            pbar.write(
                                f"[SKIP] Extraction failed for {url} (title={title!r}, content_present={content_element is not None}). See _debug dump."
                            )
                            count += 1
                            pbar.update(1)
                            if num_posts_to_scrape != 0 and count == num_posts_to_scrape:
                                break
                            continue

                        if self.download_images:
                            total_images = count_images_in_markdown(raw_body)
                            with tqdm(
                                total=total_images,
                                desc=f"Downloading images for {slug}",
                                leave=False,
                            ) as img_pbar:
                                raw_body = proc_imgs(
                                    raw_body,
                                    self.writer_name,
                                    slug,
                                    img_pbar,
                                    base_content_dir=self.base_content_dir,
                                )

                        final_md = self.combine_metadata_and_content(
                            title=title,
                            subtitle=subtitle,
                            date=date,
                            author=author,
                            cover_image=cover_image,
                            content=raw_body,
                            post_id=post_id,
                            tags=tags,
                            description=description,
                            wordcount=wordcount,
                            audience=audience,
                            canonical_url=canonical_url,
                        )

                        self.save_to_file(md_filepath, final_md, overwrite=self.overwrite)

                        entry_data = {
                            "title": title,
                            "subtitle": subtitle,
                            "description": description,
                            "author": author,
                            "date": date,
                            "cover_image": cover_image,
                            "post_id": post_id,
                            "tags": tags,
                            "wordcount": wordcount,
                            "audience": audience,
                            "canonical_url": canonical_url,
                            "file_link": os.path.relpath(md_filepath, self.author_dir).replace("\\", "/"),
                            "slug": slug,
                        }
                        essays_data.append(entry_data)
                    else:
                        pbar.write(f"File already exists: {md_filepath}")
                        existing_entry: dict[str, Any] = {
                            "file_link": os.path.relpath(md_filepath, self.author_dir).replace("\\", "/"),
                            "slug": slug,
                        }
                        extracted_metadata = self._extract_metadata_from_md(md_filepath)
                        if extracted_metadata:
                            existing_entry.update(extracted_metadata)
                        essays_data.append(existing_entry)
                except Exception as e:
                    pbar.write(f"Error scraping post: {e}")

                count += 1
                pbar.update(1)
                if num_posts_to_scrape != 0 and count == num_posts_to_scrape:
                    break
        self.save_essays_data_to_json(essays_data=essays_data)

    @abstractmethod
    def get_url_soup(self, url: str) -> BeautifulSoup | None:
        """Fetch and parse HTML for a given post URL."""
        pass

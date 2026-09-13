import json
import os
import sys
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Literal
from xml.etree import ElementTree as ET

import html2text
import markdown
import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

from ..catalog import generate_html_file
from ..config import BASE_IMAGE_DIR, DEFAULT_REQUEST_TIMEOUT, JSON_DATA_DIR
from ..images import count_images_in_markdown, process_markdown_images
from ..url_utils import (
    extract_main_part,
    get_post_slug,
    get_publication_url,
    is_post_url,
)

FrontmatterFormat = Literal["mdx", "legacy"]


class BaseSubstackScraper(ABC):
    """Abstract base scraper defining Substack post and metadata extraction pipeline.

    Handles URL discovery via sitemaps and RSS feeds, image tracking,
    markdown/HTML generation, and frontmatter formatting.
    """

    def __init__(
        self,
        base_substack_url: str,
        md_save_dir: str,
        html_save_dir: str,
        download_images: bool = False,
        frontmatter_format: FrontmatterFormat = "mdx",
    ) -> None:
        """Initialize base scraper configuration and target directories.

        Args:
            base_substack_url: Publication homepage or individual post URL.
            md_save_dir: Root directory for markdown exports.
            html_save_dir: Root directory for rendered HTML exports.
            download_images: Whether to download CDN images locally.
            frontmatter_format: Frontmatter format ('legacy' or 'mdx').

        Raises:
            ValueError: If frontmatter_format is not 'legacy' or 'mdx'.
        """
        if frontmatter_format not in ("legacy", "mdx"):
            raise ValueError("frontmatter_format must be 'legacy' or 'mdx'")
        self.frontmatter_format: str = frontmatter_format
        self.is_single_post: bool = is_post_url(base_substack_url)
        self.post_slug: str | None = (
            get_post_slug(base_substack_url) if self.is_single_post else None
        )
        original_url = base_substack_url

        if self.is_single_post:
            base_substack_url = get_publication_url(base_substack_url)

        if not base_substack_url.endswith("/"):
            base_substack_url += "/"
        self.base_substack_url: str = base_substack_url

        self.writer_name: str = extract_main_part(base_substack_url)
        self.base_md_dir: str = md_save_dir
        self.base_html_dir: str = html_save_dir
        md_save_dir: str = f"{md_save_dir}/{self.writer_name}"

        self.md_save_dir: str = md_save_dir
        self.html_save_dir: str = f"{html_save_dir}/{self.writer_name}"

        if not os.path.exists(md_save_dir):
            os.makedirs(md_save_dir)
            print(f"Created md directory {md_save_dir}")
        if not os.path.exists(self.html_save_dir):
            os.makedirs(self.html_save_dir)
            print(f"Created html directory {self.html_save_dir}")

        self.download_images: bool = download_images
        self.image_dir = Path(BASE_IMAGE_DIR) / self.writer_name

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
            print(f"Error fetching sitemap at {sitemap_url}: {response.status_code}")
            return []

        root = ET.fromstring(response.content)
        urls = [
            element.text
            for element in root.iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")
        ]
        return urls

    def fetch_urls_from_feed(self) -> list[str]:
        """Fetch recent post URLs from feed.xml RSS fallback.

        Returns:
            list[str]: URLs extracted from RSS items (typically up to 22 posts).
        """
        print(
            "Falling back to feed.xml. This will only contain up to the 22 most recent posts."
        )
        feed_url = f"{self.base_substack_url}feed.xml"
        response = requests.get(feed_url, timeout=DEFAULT_REQUEST_TIMEOUT)

        if not response.ok:
            print(f"Error fetching feed at {feed_url}: {response.status_code}")
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
        for wrap in soup.select("div.youtube-wrap[data-attrs]"):
            try:
                video_id = json.loads(wrap["data-attrs"])["videoId"]
            except (KeyError, TypeError, ValueError):
                continue
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
    def html_to_md(html_content: str) -> str:
        """Convert HTML body content to formatted Markdown text.

        Args:
            html_content: HTML string representation of article body.

        Returns:
            str: Rendered Markdown text.

        Raises:
            ValueError: If html_content is not a string.
        """
        if not isinstance(html_content, str):
            raise ValueError("html_content must be a string")
        html_content = BaseSubstackScraper.convert_youtube_embeds(html_content)
        h = html2text.HTML2Text()
        h.ignore_links = False
        h.body_width = 0
        return h.handle(html_content)

    @staticmethod
    def save_to_file(filepath: str, content: str) -> None:
        """Write text content to a local file.

        Args:
            filepath: Destination path for the file.
            content: Text content to write.

        Raises:
            ValueError: If filepath or content is not a string.
        """
        if not isinstance(filepath, str):
            raise ValueError("filepath must be a string")
        if not isinstance(content, str):
            raise ValueError("content must be a string")
        if os.path.exists(filepath):
            print(f"File already exists: {filepath}")
            return
        with open(filepath, "w", encoding="utf-8") as file:
            file.write(content)

    @staticmethod
    def md_to_html(md_content: str) -> str:
        """Convert Markdown string to HTML with markdown extra extensions.

        Args:
            md_content: Markdown content string.

        Returns:
            str: Generated HTML.
        """
        return markdown.markdown(md_content, extensions=["extra"])

    def save_to_html_file(self, filepath: str, content: str) -> None:
        """Wrap HTML content in stylesheet skeleton and write to disk.

        Args:
            filepath: Target output HTML path.
            content: Body HTML content.

        Raises:
            ValueError: If filepath or content is not a string.
        """
        if not isinstance(filepath, str):
            raise ValueError("filepath must be a string")
        if not isinstance(content, str):
            raise ValueError("content must be a string")

        html_dir = os.path.dirname(filepath)
        css_path = os.path.relpath("./assets/css/essay-styles.css", html_dir)
        css_path = css_path.replace("\\", "/")

        html_content = f"""
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Markdown Content</title>
                <link rel="stylesheet" href="{css_path}">
            </head>
            <body>
                <main class="markdown-content">
                {content}
                </main>
            </body>
            </html>
        """

        with open(filepath, "w", encoding="utf-8") as file:
            file.write(html_content)

    @staticmethod
    def get_filename_from_url(url: str, filetype: str = ".md") -> str:
        """Derive an output filename from a URL and extension.

        Args:
            url: Post or page URL.
            filetype: Desired file extension (e.g. '.md' or '.html').

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
    def combine_metadata_and_content(
        title: str,
        subtitle: str,
        date: str,
        author: str,
        cover_image: str,
        like_count: str,
        content: str,
        frontmatter_format: FrontmatterFormat = "mdx",
        source_url: str = "",
    ) -> str:
        """Combine post metadata headers with markdown body using the given format.

        Args:
            title: Post title.
            subtitle: Post subtitle.
            date: Publication date string (ISO or readable).
            author: Author display name.
            cover_image: Cover image URL.
            like_count: Number of likes.
            content: Main article markdown body.
            frontmatter_format: Format selector ('legacy' or 'mdx').
            source_url: Original post URL for MDX frontmatter.

        Returns:
            str: Combined markdown with metadata header or YAML frontmatter.

        Raises:
            ValueError: If title or content is not a string.
        """
        if not isinstance(title, str):
            raise ValueError("title must be a string")
        if not isinstance(content, str):
            raise ValueError("content must be a string")

        if frontmatter_format == "mdx":
            safe_title = title.replace('"', '\\"')
            safe_subtitle = subtitle.replace('"', '\\"') if subtitle else ""
            safe_author = author.replace('"', '\\"') if author else ""

            frontmatter = "---\n"
            frontmatter += f'title: "{safe_title}"\n'
            if safe_subtitle:
                frontmatter += f'subtitle: "{safe_subtitle}"\n'
            frontmatter += f'date: "{date}"\n'
            frontmatter += f'author: "{safe_author}"\n'
            if source_url:
                frontmatter += f'source_url: "{source_url}"\n'
            if cover_image:
                frontmatter += f'image: "{cover_image}"\n'
            frontmatter += "---\n\n"
            return frontmatter + content

        # legacy format
        display_date = date
        if date and date != "Date not found":
            try:
                display_date = datetime.fromisoformat(date).strftime("%b %d, %Y")
            except ValueError:
                pass

        metadata = f"# {title}\n\n"
        if subtitle:
            metadata += f"## {subtitle}\n\n"
        metadata += f"**{display_date}**\n\n"
        metadata += f"**Likes:** {like_count}\n\n"
        return metadata + content

    def extract_post_data(
        self,
        soup: BeautifulSoup,
        url: str = "",
    ) -> tuple[str, str, str, str, str, str, str]:
        """Extract metadata and parse post body into markdown from BeautifulSoup.

        Args:
            soup: Parsed HTML DOM of the Substack post.
            url: Source post URL.

        Returns:
            tuple[str, str, str, str, str, str, str]: A tuple containing:
                (title, subtitle, author, date, cover_image, like_count, md_content).
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
                        cover_image = (
                            img.get("url", "") if isinstance(img, dict) else str(img)
                        )
                    elif isinstance(images, dict):
                        cover_image = images.get("url", "")
            except (json.JSONDecodeError, ValueError, KeyError):
                pass

        if not date:
            date = "Date not found"

        like_count_element = soup.select_one(
            "div.like-button-container button div.label"
        )
        like_count = (
            like_count_element.text.strip()
            if like_count_element and like_count_element.text.strip().isdigit()
            else "0"
        )

        content_element = soup.select_one("div.available-content")
        content_html = str(content_element) if content_element else ""
        md = self.html_to_md(content_html)

        if not title_found or not content_element:
            paywall = soup.select_one("h2.paywall-title")
            ld_script = soup.find("script", {"type": "application/ld+json"})
            print(f"[EXTRACT FAIL] url={url}")
            print(f"  title_found={title_found} title={title!r}")
            print(f"  content_element_found={content_element is not None}")
            print(f"  paywall_present={paywall is not None}")
            print(f"  ld_json_present={ld_script is not None}")
            print(f"  date={date!r} author={author!r}")
            try:
                debug_dir = os.path.join(
                    os.path.dirname(self.md_save_dir), "_debug", self.writer_name
                )
                os.makedirs(debug_dir, exist_ok=True)
                slug = (
                    get_post_slug(url)
                    if url and is_post_url(url)
                    else (url.rstrip("/").split("/")[-1] or "unknown")
                )
                debug_path = os.path.join(debug_dir, f"{slug}.html")
                with open(debug_path, "w", encoding="utf-8") as f:
                    f.write(str(soup))
                print(f"  dumped raw HTML -> {debug_path}")
            except OSError as dump_err:
                print(f"  failed to dump debug HTML: {dump_err}")

        md_content = self.combine_metadata_and_content(
            title,
            subtitle,
            date,
            author,
            cover_image,
            like_count,
            md,
            self.frontmatter_format,
            url,
        )
        return title, subtitle, author, date, cover_image, like_count, md_content

    @abstractmethod
    def get_url_soup(self, url: str) -> BeautifulSoup | None:
        """Fetch and parse HTML for a single post URL."""
        raise NotImplementedError

    def save_essays_data_to_json(self, essays_data: list[dict]) -> None:
        """Save essays metadata records to a JSON file for the author.

        Args:
            essays_data: List of post metadata dictionaries to serialize.
        """
        ss = sys.modules.get("substack_scraper")
        target_data_dir = (
            getattr(ss, "JSON_DATA_DIR", JSON_DATA_DIR) if ss else JSON_DATA_DIR
        )
        if not os.path.exists(target_data_dir):
            os.makedirs(target_data_dir)

        json_path = os.path.join(target_data_dir, f"{self.writer_name}.json")
        if os.path.exists(json_path):
            with open(json_path, encoding="utf-8") as file:
                existing_data = json.load(file)
            essays_data = existing_data + [
                data for data in essays_data if data not in existing_data
            ]
        with open(json_path, "w", encoding="utf-8") as file:
            json.dump(essays_data, file, ensure_ascii=False, indent=4)

    def scrape_posts(self, num_posts_to_scrape: int = 0) -> None:
        """Iterate over all post URLs, scraping and saving them to disk.

        Args:
            num_posts_to_scrape: Number of posts to download (0 = scrape all).
        """
        ss = sys.modules.get("substack_scraper")
        gen_html = (
            getattr(ss, "generate_html_file", generate_html_file)
            if ss
            else generate_html_file
        )
        proc_imgs = (
            getattr(ss, "process_markdown_images", process_markdown_images)
            if ss
            else process_markdown_images
        )

        essays_data = []
        count = 0
        total = num_posts_to_scrape if num_posts_to_scrape != 0 else len(self.post_urls)
        with tqdm(total=total, desc="Scraping posts") as pbar:
            for url in self.post_urls:
                try:
                    md_filename = self.get_filename_from_url(url, filetype=".md")
                    html_filename = self.get_filename_from_url(url, filetype=".html")
                    md_filepath = os.path.join(self.md_save_dir, md_filename)
                    html_filepath = os.path.join(self.html_save_dir, html_filename)

                    if not os.path.exists(md_filepath):
                        soup = self.get_url_soup(url)
                        if soup is None:
                            total += 1
                            pbar.total = total
                            pbar.refresh()
                            continue

                        title, subtitle, author, date, cover_image, like_count, md = (
                            self.extract_post_data(soup, url)
                        )

                        content_element = soup.select_one("div.available-content")
                        if title == "Untitled" or content_element is None:
                            pbar.write(
                                f"[SKIP] Extraction failed for {url} (title={title!r}, content_present={content_element is not None}). See _debug dump."
                            )
                            count += 1
                            pbar.update(1)
                            if (
                                num_posts_to_scrape != 0
                                and count == num_posts_to_scrape
                            ):
                                break
                            continue

                        if self.download_images:
                            total_images = count_images_in_markdown(md)
                            slug = (
                                get_post_slug(url)
                                if is_post_url(url)
                                else url.rstrip("/").split("/")[-1]
                            )
                            with tqdm(
                                total=total_images,
                                desc=f"Downloading images for {slug}",
                                leave=False,
                            ) as img_pbar:
                                md = proc_imgs(md, self.writer_name, slug, img_pbar)

                        self.save_to_file(md_filepath, md)
                        html_content = self.md_to_html(md)
                        self.save_to_html_file(html_filepath, html_content)

                        essays_data.append(
                            {
                                "title": title,
                                "subtitle": subtitle,
                                "author": author,
                                "date": date,
                                "cover_image": cover_image,
                                "like_count": like_count,
                                "file_link": md_filepath,
                                "html_link": html_filepath,
                            }
                        )
                    else:
                        pbar.write(f"File already exists: {md_filepath}")
                except Exception as e:
                    pbar.write(f"Error scraping post: {e}")

                count += 1
                pbar.update(1)
                if num_posts_to_scrape != 0 and count == num_posts_to_scrape:
                    break
        self.save_essays_data_to_json(essays_data=essays_data)
        gen_html(author_name=self.writer_name, html_dir=self.base_html_dir)

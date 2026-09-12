import hashlib
import mimetypes
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import unquote

import requests

from .config import BASE_IMAGE_DIR, BASE_MD_DIR, DEFAULT_REQUEST_TIMEOUT, MAX_IMAGE_WORKERS


def _get_requests():
    """Retrieve requests module or monkeypatched version from sys.modules."""
    ss = sys.modules.get("substack_scraper")
    return getattr(ss, "requests", requests) if ss else requests


def resolve_image_url(url: str) -> str:
    """Extract the original source image URL from a Substack CDN URL.

    Args:
        url: The candidate image URL, which may be a Substack CDN fetch URL.

    Returns:
        str: Unquoted direct image URL or original URL if not a CDN wrapper.
    """
    if url.startswith("https://substackcdn.com/image/fetch/"):
        parts = url.split("/https%3A%2F%2F")
        if len(parts) > 1:
            url = "https://" + unquote(parts[1])
    return url


def clean_linked_images(md_content: str) -> str:
    """Convert markdown linked images [![alt](img)](link) to ![alt](img).

    Only unwraps links that point back at the image itself or at the
    Substack CDN (Substack's zoom-view wrappers). External links (e.g.
    YouTube thumbnails linking to the video) are preserved intact.

    Args:
        md_content: The markdown text to process.

    Returns:
        str: Markdown with redundant image link wrappers removed.
    """
    pattern = r'\[!\[(.*?)\]\((.*?)\)\]\((.*?)\)'

    def replace(match):
        alt, src, target = match.groups()
        if target == src or target.startswith("https://substackcdn.com/"):
            return f'![{alt}]({src})'
        return match.group(0)

    return re.sub(pattern, replace, md_content)


def count_images_in_markdown(md_content: str) -> int:
    """Count the total number of image references in markdown content.

    Args:
        md_content: The markdown text to inspect.

    Returns:
        int: Number of unique or repeated markdown image references.
    """
    cleaned_content = clean_linked_images(md_content)
    pattern = r'!\[.*?\]\((.*?)\)'
    matches = re.findall(pattern, cleaned_content)
    return len(matches)


def sanitize_image_filename(url: str, timeout: int = 5) -> str:
    """Create a filesystem-safe filename from an image URL.

    Args:
        url: Direct or CDN image URL.
        timeout: Network timeout in seconds when performing HEAD request to
            inspect content-type for extension fallback.

    Returns:
        str: Cleaned and sanitized image filename.
    """
    url = resolve_image_url(url)
    filename = url.split("/")[-1]
    filename = filename.split("?")[0]
    filename = re.sub(r'[<>:"/\\|?*]', '', filename)

    if len(filename) > 100 or not filename:
        hash_object = hashlib.md5(url.encode())
        ext = None
        req = _get_requests()
        try:
            resp = req.head(url, timeout=timeout)
            ext = mimetypes.guess_extension(resp.headers.get('content-type', ''))
        except Exception:
            pass
        ext = ext or '.jpg'
        filename = f"{hash_object.hexdigest()}{ext}"

    return filename


def download_image(
    url: str,
    save_path: Path,
    pbar=None,
    timeout: int = DEFAULT_REQUEST_TIMEOUT,
) -> str | None:
    """Download an image from a URL and save it to the specified local path.

    Args:
        url: Remote image URL.
        save_path: Target local Path where the image should be saved.
        pbar: Optional tqdm progress bar to increment upon success.
        timeout: Request timeout in seconds.

    Returns:
        str | None: String path to the saved file on success, or None on failure.
    """
    req = _get_requests()
    try:
        response = req.get(url, stream=True, timeout=timeout)
        if response.status_code == 200:
            save_path.parent.mkdir(parents=True, exist_ok=True)
            with open(save_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            if pbar:
                pbar.update(1)
            return str(save_path)
    except Exception as e:
        msg = f"Error downloading image {url}: {str(e)}"
        if pbar:
            pbar.write(msg)
        else:
            print(msg)
    return None


def _call_download_image(*args, **kwargs):
    """Invoke download_image with support for module-level test patches."""
    ss = sys.modules.get("substack_scraper")
    downloader = getattr(ss, "download_image", download_image) if ss else download_image
    return downloader(*args, **kwargs)


def process_markdown_images(
    md_content: str,
    author: str,
    post_slug: str,
    pbar=None,
    max_workers: int = MAX_IMAGE_WORKERS,
) -> str:
    """Download Substack CDN images concurrently and update markdown references.

    Args:
        md_content: Raw post markdown content.
        author: Author or publication directory name.
        post_slug: Post slug subdirectory name.
        pbar: Optional tqdm progress bar to increment per image.
        max_workers: Maximum number of worker threads for parallel downloading.

    Returns:
        str: Updated markdown content with CDN links replaced by relative paths.
    """
    image_dir = Path(BASE_IMAGE_DIR) / author / post_slug
    md_content = clean_linked_images(md_content)
    pattern = r'\(https://substackcdn\.com/image/fetch/[^\s\)]+\)'

    matches = [m.group(0).strip('()') for m in re.finditer(pattern, md_content)]
    unique_urls = list(dict.fromkeys(matches))

    download_tasks = []
    for raw_url in unique_urls:
        resolved_url = resolve_image_url(raw_url)
        filename = sanitize_image_filename(raw_url)
        save_path = image_dir / filename
        if not save_path.exists():
            download_tasks.append((resolved_url, save_path))
        elif pbar:
            pbar.update(1)

    download_results = {}
    if download_tasks:
        workers = min(len(download_tasks), max(1, max_workers))
        with ThreadPoolExecutor(max_workers=workers) as executor:
            future_to_path = {
                executor.submit(_call_download_image, res_url, sp, pbar): sp
                for res_url, sp in download_tasks
            }
            for future in future_to_path:
                sp = future_to_path[future]
                try:
                    res = future.result()
                    if res:
                        download_results[sp] = res
                except Exception:
                    pass

    def replace_image(match):
        url = match.group(0).strip('()')
        resolved_url = resolve_image_url(url)
        filename = sanitize_image_filename(url)
        save_path = image_dir / filename
        if not save_path.exists() and save_path not in download_results:
            return match.group(0)

        rel_path = os.path.relpath(save_path, Path(BASE_MD_DIR) / author)
        rel_path = rel_path.replace("\\", "/")
        return f"({rel_path})"

    return re.sub(pattern, replace_image, md_content)


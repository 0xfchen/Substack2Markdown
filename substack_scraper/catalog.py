import html
import json
import os
import sys
from typing import Any
from .config import BASE_HTML_DIR, JSON_DATA_DIR, HTML_TEMPLATE


def safe_json_embed(data: Any) -> str:
    """Safely serialize data to JSON for embedding inside an HTML <script> tag.

    Replaces angle brackets and ampersands with unicode escape sequences to
    prevent script tag breakout and cross-site scripting (XSS) vectors.

    Args:
        data: The Python object to serialize (dict, list, etc.).

    Returns:
        str: Sanitized JSON string safe for HTML script tag embedding.
    """
    json_str = json.dumps(data, ensure_ascii=False, indent=4)
    return (
        json_str.replace("&", "\\u0026")
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
    )


def generate_html_file(
    author_name: str,
    html_dir: str | None = None,
    data_dir: str | None = None,
) -> None:
    """Generate an interactive HTML listing page for the given author.

    Reads the scraped post metadata from data/<author>.json and merges it into
    the HTML template.

    Args:
        author_name: Name or slug of the author / publication.
        html_dir: Directory where the output HTML will be saved. Defaults to
            BASE_HTML_DIR.
        data_dir: Directory where the metadata JSON is stored. Defaults to
            JSON_DATA_DIR.
    """
    ss = sys.modules.get("substack_scraper")
    current_html_dir = getattr(ss, "BASE_HTML_DIR", BASE_HTML_DIR) if ss else BASE_HTML_DIR
    current_data_dir = getattr(ss, "JSON_DATA_DIR", JSON_DATA_DIR) if ss else JSON_DATA_DIR

    target_html_dir = html_dir or current_html_dir
    target_data_dir = data_dir or current_data_dir

    if not os.path.exists(target_html_dir):
        os.makedirs(target_html_dir)

    json_path = os.path.join(target_data_dir, f'{author_name}.json')
    with open(json_path, 'r', encoding='utf-8') as file:
        essays_data = json.load(file)

    embedded_json_data = safe_json_embed(essays_data)

    with open(HTML_TEMPLATE, 'r', encoding='utf-8') as file:
        html_template = file.read()

    safe_author = html.escape(author_name)
    html_with_data = html_template.replace('<!-- AUTHOR_NAME -->', safe_author).replace(
        '<script type="application/json" id="essaysData"></script>',
        f'<script type="application/json" id="essaysData">{embedded_json_data}</script>'
    )
    html_with_author = html_with_data.replace('author_name', safe_author)

    html_output_path = os.path.join(target_html_dir, f'{author_name}.html')
    with open(html_output_path, 'w', encoding='utf-8') as file:
        file.write(html_with_author)

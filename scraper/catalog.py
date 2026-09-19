import json
from typing import Any


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
    return json_str.replace("&", "\\u0026").replace("<", "\\u003c").replace(">", "\\u003e")

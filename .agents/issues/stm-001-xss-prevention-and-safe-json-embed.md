# Prevent XSS in HTML Viewer and Escape Embedded JSON

## Problem Description

The local HTML catalog viewer (`author_template.html` and `assets/js/populate-essays.js`) was vulnerable to cross-site scripting (XSS):
1. In `substack_scraper.py`, `generate_html_file()` injected raw serialized JSON into a `<script type="application/json" id="essaysData">` tag using `json.dumps()` without escaping HTML entities. If a Substack post title or subtitle contained `</script><script>alert(1)</script>`, the browser would close the JSON script tag prematurely and execute malicious JavaScript.
2. In `assets/js/populate-essays.js`, `populateEssays()` interpolated raw post titles and subtitles directly into template strings using `innerHTML`:
   ```javascript
   const list = data.map(essay => `
       <li>
           <a href="../${showHTML ? essay.html_link : essay.file_link}" target="_blank">${essay.title}</a>
           <div class="subtitle">${essay.subtitle}</div>
           <div class="metadata">${essay.like_count} Likes - ${essay.date}</div>
       </li>
   `).join('');
   essaysContainer.innerHTML = `<ul>${list}</ul>`;
   ```
3. Author names in HTML titles and headers were injected unescaped.

## Proposed Solution

1. **JSON Tag Escaping (`safe_json_embed`)**:
   Implement a helper function that safely serializes Python objects to JSON and replaces dangerous HTML characters (`&`, `<`, `>`) with unicode escape sequences (`\u0026`, `\u003c`, `\u003e`). Inside `<script>` tags, the JavaScript engine parses unicode escape sequences transparently while preventing HTML tag breaking.
2. **Author Name Sanitization**:
   Use `html.escape()` on `author_name` before replacing template placeholders in `generate_html_file()`.
3. **Safe DOM Node Creation**:
   Refactor `assets/js/populate-essays.js` to create DOM elements (`document.createElement`) and assign user-provided text content via `textContent` instead of `innerHTML`.

## Changes Made

- `substack_scraper.py` (later modularized into `substack_scraper/catalog.py`):
  - Added `safe_json_embed(data: Any) -> str` to escape `&`, `<`, `>`.
  - Updated `generate_html_file()` to escape author names with `html.escape()` and embed essays data using `safe_json_embed()`.
- `assets/js/populate-essays.js`:
  - Replaced `innerHTML` template strings with `document.createElement('li')`, `document.createElement('a')`, and `.textContent`.
  - Added validation for external vs. relative links on essay anchor elements.
- `tests/test_substack_scraper.py`:
  - Added `test_safe_json_embed_escapes_html_tags` asserting dangerous tags are replaced with unicode escapes.
  - Added `test_generate_html_file_escapes_author_and_embeds_safely` verifying XSS payloads in titles and authors do not emit unescaped `<script>` tags.

## Verification

- Automated pytest suite:
  ```bash
  uv run pytest tests/test_substack_scraper.py -k "safe_json_embed or escapes_author"
  ```
- Verified that XSS attack vectors in titles render harmlessly as literal text in the browser.

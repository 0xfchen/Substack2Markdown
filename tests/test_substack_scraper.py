import os
import sys
from unittest.mock import MagicMock, Mock, patch

import pytest

import substack_scraper as ss


class FakeScraper(ss.BaseSubstackScraper):
    def get_url_soup(self, url: str):
        return None


# ---------------------------------------------------------------------------
# Existing tests (preserved)
# ---------------------------------------------------------------------------


def test_resolve_image_url_extracts_original_url():
    cdn_url = (
        "https://substackcdn.com/image/fetch/w_1456,c_limit,f_webp,q_auto:good,"
        "fl_progressive:steep/https%3A%2F%2Fbucket.s3.us-west-2.amazonaws.com%2Fimage.jpg"
    )

    assert ss.resolve_image_url(cdn_url) == "https://bucket.s3.us-west-2.amazonaws.com/image.jpg"


def test_sanitize_image_filename_uses_resolved_url_name():
    cdn_url = (
        "https://substackcdn.com/image/fetch/w_1456,c_limit,f_webp,q_auto:good,"
        "fl_progressive:steep/https%3A%2F%2Fbucket.s3.us-west-2.amazonaws.com%2Fimage.jpg%3Fv%3D1"
    )

    assert ss.sanitize_image_filename(cdn_url) == "image.jpg"


def test_count_images_in_markdown_counts_cleaned_linked_images():
    markdown = "[![alt](https://cdn/a.png)](https://example.com)\n\n![plain](https://cdn/b.png)"

    assert ss.count_images_in_markdown(markdown) == 2


def test_single_post_url_initializes_without_fetching_all_posts(tmp_path):
    scraper = FakeScraper(
        "https://example.substack.com/p/my-post",
        str(tmp_path / "md"),
        str(tmp_path / "html"),
        download_images=True,
    )

    assert scraper.is_single_post is True
    assert scraper.post_slug == "my-post"
    assert scraper.base_substack_url == "https://example.substack.com/"
    assert scraper.post_urls == ["https://example.substack.com/p/my-post"]
    assert scraper.download_images is True


def test_parse_args_supports_images_flag(monkeypatch):
    monkeypatch.setattr(
        sys,
        "argv",
        ["substack_scraper.py", "--url", "https://example.substack.com/p/post", "--images"],
    )

    args = ss.parse_args()

    assert args.url == "https://example.substack.com/p/post"
    assert args.images is True


# ---------------------------------------------------------------------------
# New tests
# ---------------------------------------------------------------------------


# 1. Parametrized test_clean_linked_images
@pytest.mark.parametrize(
    "input_md, expected",
    [
        pytest.param(
            "[![Image 1](/img/test/image1.png)](/img/test/image1.png)",
            "![Image 1](/img/test/image1.png)",
            id="basic_cleaning",
        ),
        pytest.param(
            "Check [this link](https://example.com) and [![photo](img.png)](img.png) and ![plain](other.png)",
            "Check [this link](https://example.com) and ![photo](img.png) and ![plain](other.png)",
            id="mixed_content",
        ),
        pytest.param(
            "[![CDN](https://substackcdn.com/image/fetch/w_1456/https%3A%2F%2Fexample.com%2Fphoto.jpg)](https://substackcdn.com/image/fetch/w_1456/https%3A%2F%2Fexample.com%2Fphoto.jpg)",
            "![CDN](https://substackcdn.com/image/fetch/w_1456/https%3A%2F%2Fexample.com%2Fphoto.jpg)",
            id="substack_cdn_urls",
        ),
        pytest.param(
            "![Already clean](https://example.com/img.png)",
            "![Already clean](https://example.com/img.png)",
            id="no_changes_needed",
        ),
        pytest.param(
            "",
            "",
            id="empty_content",
        ),
        pytest.param(
            "Line one\n\n[![img](a.png)](a.png)\n\nLine three",
            "Line one\n\n![img](a.png)\n\nLine three",
            id="preserve_newlines",
        ),
        pytest.param(
            '[![Image with "quotes" & special](https://example.com/img%20file.png)](https://example.com/img%20file.png)',
            '![Image with "quotes" & special](https://example.com/img%20file.png)',
            id="special_characters",
        ),
    ],
)
def test_clean_linked_images(input_md, expected):
    assert ss.clean_linked_images(input_md) == expected


# 2. test_resolve_image_url_passthrough
def test_resolve_image_url_passthrough():
    """Non-CDN URLs should pass through unchanged."""
    urls = [
        "https://example.com/photo.jpg",
        "https://bucket.s3.amazonaws.com/image.png",
        "https://i.imgur.com/abc123.gif",
        "/relative/path/image.png",
    ]
    for url in urls:
        assert ss.resolve_image_url(url) == url


# 3. test_is_post_url
@pytest.mark.parametrize(
    "url, expected",
    [
        ("https://example.substack.com/p/my-post", True),
        ("https://example.substack.com/p/another-post-slug", True),
        ("https://example.substack.com/", False),
        ("https://example.substack.com/archive", False),
        ("https://example.substack.com/about", False),
    ],
)
def test_is_post_url(url, expected):
    assert ss.is_post_url(url) == expected


# 4. test_get_publication_url
@pytest.mark.parametrize(
    "url, expected",
    [
        ("https://example.substack.com/p/my-post", "https://example.substack.com/"),
        ("https://blog.example.com/p/slug", "https://blog.example.com/"),
        ("http://test.substack.com/p/post-name", "http://test.substack.com/"),
    ],
)
def test_get_publication_url(url, expected):
    assert ss.get_publication_url(url) == expected


# 5. test_get_post_slug
@pytest.mark.parametrize(
    "url, expected",
    [
        ("https://example.substack.com/p/my-post", "my-post"),
        ("https://example.substack.com/p/another-slug", "another-slug"),
        ("https://example.substack.com/p/slug-with-123", "slug-with-123"),
        ("https://example.substack.com/archive", "unknown_post"),
    ],
)
def test_get_post_slug(url, expected):
    assert ss.get_post_slug(url) == expected


# 6. test_process_markdown_images
@patch("substack_scraper.download_image")
def test_process_markdown_images(mock_download):
    """Mock requests.get and verify image download + path rewriting."""
    mock_download.return_value = "data/images/testauthor/test-post/photo.jpg"

    md_content = (
        "Some text\n"
        "![alt](https://substackcdn.com/image/fetch/w_1456,c_limit/https%3A%2F%2Fexample.com%2Fphoto.jpg)\n"
        "More text"
    )

    result = ss.process_markdown_images(md_content, "testauthor", "test-post")

    # download_image should have been called once
    assert mock_download.call_count == 1

    # The CDN URL should be replaced with a local relative path
    assert "substackcdn.com" not in result
    assert "Some text" in result
    assert "More text" in result


# 7. test_download_image_error_handling
@patch("substack_scraper.requests.get")
def test_download_image_error_handling(mock_get, tmp_path):
    """Mock network error, verify graceful handling (returns None)."""
    mock_get.side_effect = ConnectionError("Network unreachable")

    result = ss.download_image(
        "https://example.com/image.jpg",
        tmp_path / "image.jpg",
    )

    assert result is None


# 8. test_scraper_initialization
def test_scraper_initialization(tmp_path):
    """Verify writer_name and author directory structure are created."""
    content_dir = str(tmp_path / "content")

    scraper = FakeScraper(
        "https://example.substack.com/p/test-post",
        content_save_dir=content_dir,
    )

    assert scraper.writer_name == "example"
    assert os.path.isdir(os.path.join(content_dir, "example", "posts"))


# 9. test_mdx_frontmatter_includes_source_url
def test_mdx_frontmatter_includes_source_url():
    """Verify the post URL is emitted as canonical_url in YAML frontmatter."""
    result = ss.BaseSubstackScraper.combine_metadata_and_content(
        title="Title",
        subtitle="Subtitle",
        date="2024-01-01",
        author="Author",
        cover_image="",
        content="Body",
        canonical_url="https://example.substack.com/p/test-post",
    )

    assert 'canonical_url: "https://example.substack.com/p/test-post"' in result
    assert result.index('author: "Author"') < result.index("canonical_url:")


# 10. get_credentials
def test_get_credentials_env_vars(monkeypatch):
    monkeypatch.setenv("SUBSTACK_EMAIL", "env@example.com")
    monkeypatch.setenv("SUBSTACK_PASSWORD", "env-secret")

    assert ss.get_credentials() == ("env@example.com", "env-secret")


def test_get_credentials_empty_when_unconfigured(monkeypatch):
    monkeypatch.delenv("SUBSTACK_EMAIL", raising=False)
    monkeypatch.delenv("SUBSTACK_PASSWORD", raising=False)
    with patch("dotenv.find_dotenv", return_value=""):
        assert ss.get_credentials() == ("", "")


# 11. YouTube embeds (issue #25)
YOUTUBE_EMBED_HTML = (
    '<div class="available-content"><p>Intro</p>'
    '<div id="youtube2-9FDgRXPSv3U" data-attrs="{&quot;videoId&quot;:&quot;9FDgRXPSv3U&quot;,'
    '&quot;startTime&quot;:null,&quot;endTime&quot;:null}" data-component-name="Youtube2ToDOM" '
    'class="youtube-wrap"><div class="youtube-inner">'
    '<iframe src="https://www.youtube-nocookie.com/embed/9FDgRXPSv3U?rel=0" frameborder="0">'
    "</iframe></div></div><p>Outro</p></div>"
)


def test_youtube_embed_exported_as_linked_thumbnail():
    md = ss.BaseSubstackScraper.html_to_md(YOUTUBE_EMBED_HTML)

    assert (
        "[![YouTube video](https://img.youtube.com/vi/9FDgRXPSv3U/hqdefault.jpg)]"
        "(https://www.youtube.com/watch?v=9FDgRXPSv3U)" in md
    )
    assert "Intro" in md and "Outro" in md


def test_youtube_embed_with_malformed_attrs_is_skipped():
    html = '<div class="youtube-wrap" data-attrs="not-json"><iframe src="x"></iframe></div><p>Body</p>'

    md = ss.BaseSubstackScraper.html_to_md(html)

    assert "Body" in md


def test_clean_linked_images_preserves_youtube_thumbnail_links():
    md = "[![YouTube video](https://img.youtube.com/vi/abc/hqdefault.jpg)](https://www.youtube.com/watch?v=abc)"

    assert ss.clean_linked_images(md) == md


# 12. Security & XSS Prevention
def test_safe_json_embed_escapes_html_tags():
    payload = {"title": "</script><script>alert(1)</script>", "data": "a & b < c > d"}
    embedded = ss.safe_json_embed(payload)

    assert "</script>" not in embedded
    assert "<" not in embedded
    assert ">" not in embedded
    assert "\\u003c/script\\u003e" in embedded
    assert "\\u0026" in embedded


# 13. CLI & Defaults
def test_default_use_premium_is_false():
    assert ss.USE_PREMIUM is False


def test_main_bare_command_shows_help_and_exits(monkeypatch, capsys):
    monkeypatch.setattr(sys, "argv", ["substack_scraper.py"])
    with pytest.raises(SystemExit) as exc_info:
        ss.main()
    assert exc_info.value.code != 0
    captured = capsys.readouterr()
    assert "--url" in captured.err or "--url" in captured.out
    assert "--premium" in captured.err or "--premium" in captured.out


# 14. Network Timeouts & Reliability
def test_process_markdown_images_preserves_remote_url_on_download_failure(monkeypatch):
    # Mock download_image to fail (return None)
    monkeypatch.setattr(ss, "download_image", lambda *args, **kwargs: None)

    md = "![alt](https://substackcdn.com/image/fetch/w_1456/https%3A%2F%2Fexample.com%2Ffailed.jpg)"
    result = ss.process_markdown_images(md, "test_author", "test_slug")

    # URL should be retained rather than replaced with broken local path
    assert "https://substackcdn.com/image/fetch/" in result
    assert "images" not in result


def test_download_image_uses_timeout(monkeypatch, tmp_path):
    mock_get = Mock(side_effect=ss.requests.Timeout("Connection timed out"))
    monkeypatch.setattr(ss.requests, "get", mock_get)

    result = ss.download_image("https://example.com/img.jpg", tmp_path / "img.jpg", timeout=12, max_retries=1)
    assert result is None
    mock_get.assert_called_once()
    assert mock_get.call_args[1]["timeout"] == 12


# 15. Custom Domains & Output Directories
@pytest.mark.parametrize(
    "url, expected",
    [
        # ByteByteGo
        ("https://blog.bytebytego.com/", "bytebytego"),
        ("https://blog.bytebytego.com", "bytebytego"),
        ("https://blog.bytebytego.com/p/ep1-system-design", "bytebytego"),
        ("http://blog.bytebytego.com/archive", "bytebytego"),
        ("blog.bytebytego.com", "bytebytego"),
        # The Pragmatic Engineer
        ("https://newsletter.pragmaticengineer.com/", "pragmaticengineer"),
        ("https://newsletter.pragmaticengineer.com", "pragmaticengineer"),
        ("https://newsletter.pragmaticengineer.com/p/the-pulse-100", "pragmaticengineer"),
        ("http://newsletter.pragmaticengineer.com/about", "pragmaticengineer"),
        ("newsletter.pragmaticengineer.com", "pragmaticengineer"),
        # SemiAnalysis
        ("https://newsletter.semianalysis.com/", "semianalysis"),
        ("https://newsletter.semianalysis.com", "semianalysis"),
        ("https://newsletter.semianalysis.com/p/ai-datacenter-scale", "semianalysis"),
        ("http://newsletter.semianalysis.com/archive", "semianalysis"),
        ("newsletter.semianalysis.com", "semianalysis"),
    ],
)
def test_extract_main_part_supports_custom_domains(url, expected):
    assert ss.extract_main_part(url) == expected


# 16. Concurrency & Performance
def test_process_markdown_images_concurrent_downloads(monkeypatch):
    downloaded_urls = []

    def mock_download(url, save_path, pbar=None, timeout=None):
        downloaded_urls.append(url)
        return str(save_path)

    monkeypatch.setattr(ss, "download_image", mock_download)

    md = (
        "![img1](https://substackcdn.com/image/fetch/w_1456/https%3A%2F%2Fexample.com%2F1.jpg)\n"
        "![img2](https://substackcdn.com/image/fetch/w_1456/https%3A%2F%2Fexample.com%2F2.jpg)\n"
        "![img3](https://substackcdn.com/image/fetch/w_1456/https%3A%2F%2Fexample.com%2F3.jpg)\n"
    )

    result = ss.process_markdown_images(md, "author", "post", max_workers=3)

    assert len(downloaded_urls) == 3
    assert "https://example.com/1.jpg" in downloaded_urls
    assert "https://example.com/2.jpg" in downloaded_urls
    assert "https://example.com/3.jpg" in downloaded_urls
    assert "substackcdn.com" not in result


# 17. Credentials & .env loading
def test_get_credentials_loads_from_env_file(tmp_path, monkeypatch):
    monkeypatch.delenv("SUBSTACK_EMAIL", raising=False)
    monkeypatch.delenv("SUBSTACK_PASSWORD", raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text("SUBSTACK_EMAIL=env_user@example.com\nSUBSTACK_PASSWORD=env_pass\n", encoding="utf-8")
    monkeypatch.chdir(tmp_path)

    email, password = ss.get_credentials()
    assert email == "env_user@example.com"
    assert password == "env_pass"


# 18. Playwright BrowserManager & PremiumScraper Tests
def test_browser_manager_get_user_data_dir():
    profile_dir = ss.BrowserManager.get_user_data_dir("chrome")
    assert "chrome_profile" in profile_dir
    assert ".substack_scraper" in profile_dir


def test_browser_manager_resolve_channel():
    mock_pw = MagicMock()
    mock_browser = MagicMock()
    mock_pw.chromium.launch.return_value = mock_browser

    resolved = ss.BrowserManager.resolve_channel("chrome", mock_pw)
    assert resolved in ("chrome", "msedge")
    assert mock_browser.close.called


def test_browser_manager_launch_cdp():
    mock_pw_instance = MagicMock()
    mock_cdp_browser = MagicMock()
    mock_context = MagicMock()
    mock_cdp_browser.contexts = [mock_context]
    mock_pw_instance.chromium.connect_over_cdp.return_value = mock_cdp_browser

    with patch("substack_scraper.browser.sync_playwright") as mock_sync_pw:
        mock_sync_pw.return_value.start.return_value = mock_pw_instance
        session = ss.BrowserManager.launch(cdp_url="http://localhost:9222")
        assert session.context == mock_context
        mock_pw_instance.chromium.connect_over_cdp.assert_called_once_with("http://localhost:9222")


def test_premium_scraper_requires_credentials_when_not_skipping():
    with (
        patch("substack_scraper.scrapers.premium.get_credentials", return_value=("", "")),
        patch(
            "substack_scraper.scrapers.premium.BrowserManager.DEFAULT_STORAGE_STATE_PATH",
            "/nonexistent/path/storage.json",
        ),
    ):
        with pytest.raises(ValueError, match="Premium scraping requires credentials"):
            ss.PremiumSubstackScraper(
                base_substack_url="https://example.substack.com",
                content_save_dir="content",
                skip_login=False,
            )


def test_premium_scraper_init_with_skip_login():
    mock_session = MagicMock()
    mock_context = MagicMock()
    mock_page = MagicMock()
    mock_context.pages = [mock_page]
    mock_session.context = mock_context

    with patch("substack_scraper.scrapers.premium.BrowserManager.launch", return_value=mock_session):
        scraper = ss.PremiumSubstackScraper(
            base_substack_url="https://example.substack.com",
            content_save_dir="content",
            skip_login=True,
        )
        assert scraper.skip_login is True
        mock_page.goto.assert_called_once_with("https://example.substack.com", wait_until="domcontentloaded")


# 19. Rescraping and Image Retry Tests
def test_download_image_retries_on_failure_and_succeeds(tmp_path):
    mock_resp_fail = Mock()
    mock_resp_fail.status_code = 503

    mock_resp_ok = Mock()
    mock_resp_ok.status_code = 200
    mock_resp_ok.iter_content = Mock(return_value=[b"fake_image_data"])

    dest = tmp_path / "retry_success.jpg"
    with (
        patch("substack_scraper.images.requests.get", side_effect=[mock_resp_fail, mock_resp_ok]) as mock_get,
        patch("substack_scraper.images.sleep") as mock_sleep,
    ):
        result = ss.download_image("https://example.com/retry.jpg", dest, max_retries=3)

        assert result == str(dest)
        assert mock_get.call_count == 2
        assert mock_sleep.call_count == 1
        assert dest.read_bytes() == b"fake_image_data"


def test_download_image_fails_after_max_retries(tmp_path):
    mock_resp_fail = Mock()
    mock_resp_fail.status_code = 500

    dest = tmp_path / "retry_fail.jpg"
    with (
        patch(
            "substack_scraper.images.requests.get", side_effect=[mock_resp_fail, mock_resp_fail, mock_resp_fail]
        ) as mock_get,
        patch("substack_scraper.images.sleep") as mock_sleep,
    ):
        result = ss.download_image("https://example.com/fail.jpg", dest, max_retries=3)

        assert result is None
        assert mock_get.call_count == 3
        assert mock_sleep.call_count == 2
        assert not dest.exists()


def test_scrape_posts_skips_existing_when_overwrite_is_false(tmp_path):
    md_dir = tmp_path / "md"
    html_dir = tmp_path / "html"
    scraper = FakeScraper(
        "https://example.substack.com/p/test-post",
        str(md_dir),
        str(html_dir),
        overwrite=False,
    )

    # Pre-create the markdown file
    author_md_dir = md_dir / "example"
    author_md_dir.mkdir(parents=True, exist_ok=True)
    existing_md = author_md_dir / "test-post.md"
    existing_md.write_text("existing content", encoding="utf-8")

    scraper.extract_post_data = Mock()
    scraper.save_to_file = Mock()

    scraper.scrape_posts()

    scraper.extract_post_data.assert_not_called()
    scraper.save_to_file.assert_not_called()
    assert existing_md.read_text(encoding="utf-8") == "existing content"


def test_scrape_posts_rescrapes_existing_when_overwrite_is_true(tmp_path):
    md_dir = tmp_path / "md"
    html_dir = tmp_path / "html"
    scraper = FakeScraper(
        "https://example.substack.com/p/test-post",
        str(md_dir),
        str(html_dir),
        overwrite=True,
    )

    # Pre-create the markdown file
    author_md_dir = md_dir / "example"
    author_md_dir.mkdir(parents=True, exist_ok=True)
    existing_md = author_md_dir / "test-post.md"
    existing_md.write_text("old content", encoding="utf-8")

    mock_soup = Mock()
    mock_soup.select_one = Mock(return_value=Mock())
    scraper.get_url_soup = Mock(return_value=mock_soup)

    fake_tuple = (
        "Updated Title",
        "Updated Subtitle",
        "Author",
        "2026-09-13",
        "",
        "10",
        "Updated Content",
    )
    scraper.extract_post_data = Mock(return_value=fake_tuple)
    scraper.save_to_file = Mock()

    scraper.scrape_posts()

    scraper.extract_post_data.assert_called_once_with(mock_soup, "https://example.substack.com/p/test-post")
    scraper.save_to_file.assert_called_once()
    assert scraper.save_to_file.call_args[1]["overwrite"] is True


def test_cli_force_flag_sets_overwrite(monkeypatch):
    monkeypatch.setattr(
        sys,
        "argv",
        ["substack_scraper.py", "--url", "https://example.substack.com", "--force"],
    )
    args = ss.parse_args()
    assert args.overwrite is True

    monkeypatch.setattr(
        sys,
        "argv",
        ["substack_scraper.py", "--url", "https://example.substack.com", "--overwrite"],
    )
    args_alias = ss.parse_args()
    assert args_alias.overwrite is True


# ---------------------------------------------------------------------------
# Catalog & Metadata Synchronization Tests
# ---------------------------------------------------------------------------


def test_extract_post_id_from_preloads():
    html = (
        "<html><head><script>"
        'window._preloads = JSON.parse("{\\"post\\":{\\"id\\":214748970,\\"slug\\":\\"codex\\"}}");'
        "</script></head></html>"
    )
    post_id = ss.BaseSubstackScraper._extract_post_id(html)
    assert post_id == 214748970


def test_extract_post_id_returns_none_when_missing():
    html = "<html><head><title>No post ID</title></head></html>"
    post_id = ss.BaseSubstackScraper._extract_post_id(html)
    assert post_id is None


def test_combine_metadata_and_content_includes_post_id():
    markdown_output = ss.BaseSubstackScraper.combine_metadata_and_content(
        title="Codex Post",
        subtitle="Inside OpenAI",
        date="2026-09-09",
        author="Gergely",
        cover_image="",
        like_count="100",
        content="Post body",
        frontmatter_format="mdx",
        source_url="https://example.substack.com/p/codex",
        post_id=214748970,
    )
    assert "post_id: 214748970" in markdown_output
    assert 'title: "Codex Post"' in markdown_output


def test_extract_metadata_from_md_mdx_format(tmp_path):
    md_file = tmp_path / "post.md"
    md_file.write_text(
        '---\ntitle: "Codex Post"\npost_id: 214748970\ndate: "2026-09-09"\nauthor: "Gergely"\n---\n\nBody',
        encoding="utf-8",
    )
    metadata = ss.BaseSubstackScraper._extract_metadata_from_md(str(md_file))
    assert metadata is not None
    assert metadata["title"] == "Codex Post"
    assert metadata["post_id"] == 214748970
    assert metadata["date"] == "2026-09-09"
    assert metadata["author"] == "Gergely"


def test_clean_post_html_strips_widgets_and_footers():
    html = (
        '<div class="available-content">'
        "<p>Real content</p>"
        '<div class="subscription-widget-wrap"><input placeholder="email"/></div>'
        '<div class="post-footer"><button>Share</button></div>'
        "</div>"
    )
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    ss.BaseSubstackScraper._clean_post_html(soup)
    cleaned_str = str(soup)
    assert "Real content" in cleaned_str
    assert "subscription-widget-wrap" not in cleaned_str
    assert "post-footer" not in cleaned_str


def test_substack_html2text_code_block_language_fences():
    html = '<pre><code class="language-python">def hello():\n    return "world"</code></pre>'
    md = ss.BaseSubstackScraper.html_to_md(html)
    assert "```python" in md
    assert 'def hello():\n    return "world"' in md
    assert md.strip().endswith("```")


def test_extract_preloaded_post_data():
    html = (
        "<html><head><script>"
        'window._preloads = JSON.parse("{\\"post\\":{\\"id\\":1234,\\"description\\":\\"A summary\\",\\"wordcount\\":500,\\"audience\\":\\"only_paid\\",\\"canonical_url\\":\\"https://example.com/p/test\\",\\"postTags\\":[{\\"name\\":\\"tech\\"},{\\"name\\":\\"ai\\"}]}}");'
        "</script></head></html>"
    )
    data = ss.BaseSubstackScraper._extract_preloaded_post_data(html)
    assert data["post_id"] == 1234
    assert data["description"] == "A summary"
    assert data["wordcount"] == 500
    assert data["audience"] == "only_paid"
    assert data["canonical_url"] == "https://example.com/p/test"
    assert data["tags"] == ["tech", "ai"]


def test_save_essays_data_to_json_updates_existing_entry_by_post_id(tmp_path):
    scraper = FakeScraper("https://example.substack.com", content_save_dir=str(tmp_path))

    initial_entries = [
        {
            "post_id": 12345,
            "title": "Initial Title",
            "slug": "initial-slug",
            "file_link": "posts/initial.md",
        }
    ]
    scraper.save_essays_data_to_json(initial_entries)

    updated_entries = [
        {
            "post_id": 12345,
            "title": "Updated Title With New Headline",
            "slug": "new-renamed-slug",
            "file_link": "posts/new-renamed-slug.md",
        }
    ]
    scraper.save_essays_data_to_json(updated_entries)

    import json

    json_path = tmp_path / "example" / "metadata.json"
    with open(json_path, encoding="utf-8") as file:
        saved_data = json.load(file)

    assert len(saved_data) == 1
    assert saved_data[0]["post_id"] == 12345
    assert saved_data[0]["title"] == "Updated Title With New Headline"
    assert saved_data[0]["slug"] == "new-renamed-slug"
    assert saved_data[0]["file_link"] == "posts/new-renamed-slug.md"


def test_save_essays_data_to_json_appends_genuinely_new_posts(tmp_path):
    scraper = FakeScraper("https://example.substack.com", content_save_dir=str(tmp_path))

    scraper.save_essays_data_to_json([{"post_id": 101, "title": "First"}])
    scraper.save_essays_data_to_json([{"post_id": 102, "title": "Second"}])

    import json

    with open(tmp_path / "example" / "metadata.json", encoding="utf-8") as file:
        saved_data = json.load(file)

    assert len(saved_data) == 2
    assert saved_data[0]["post_id"] == 101
    assert saved_data[1]["post_id"] == 102


def test_scrape_posts_recovers_metadata_for_skipped_existing_files(tmp_path):
    content_dir = tmp_path / "content"
    author_posts_dir = content_dir / "example" / "posts"
    author_posts_dir.mkdir(parents=True, exist_ok=True)
    existing_file = author_posts_dir / "test-post.md"
    existing_file.write_text(
        '---\ntitle: "Existing Preserved"\npost_id: 8888\ndate: "2026-09-01"\nauthor: "Author"\n---\n\nContent',
        encoding="utf-8",
    )

    scraper = FakeScraper(
        "https://example.substack.com/p/test-post",
        content_save_dir=str(content_dir),
        overwrite=False,
    )
    scraper.scrape_posts()

    import json

    metadata_path = content_dir / "example" / "metadata.json"
    with open(metadata_path, encoding="utf-8") as file:
        saved_data = json.load(file)

    assert len(saved_data) == 1
    assert saved_data[0]["post_id"] == 8888
    assert saved_data[0]["title"] == "Existing Preserved"
    assert saved_data[0]["slug"] == "test-post"


def test_parse_args_verbose_and_quiet_mutually_exclusive(monkeypatch):
    monkeypatch.setattr(
        sys,
        "argv",
        ["substack_scraper", "--url", "https://example.substack.com", "-v", "-q"],
    )
    with pytest.raises(SystemExit):
        ss.parse_args()


def test_parse_args_verbose_flag(monkeypatch):
    monkeypatch.setattr(
        sys,
        "argv",
        ["substack_scraper", "--url", "https://example.substack.com", "--verbose"],
    )
    args = ss.parse_args()
    assert args.verbose is True
    assert args.quiet is False


def test_parse_args_quiet_flag(monkeypatch):
    monkeypatch.setattr(
        sys,
        "argv",
        ["substack_scraper", "--url", "https://example.substack.com", "-q"],
    )
    args = ss.parse_args()
    assert args.quiet is True
    assert args.verbose is False


def test_premium_auto_skip_login_when_credentials_missing_but_profile_exists(tmp_path, monkeypatch):
    profile_dir = tmp_path / "chrome_profile"
    profile_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr("substack_scraper.scrapers.premium.get_credentials", lambda: (None, None))
    monkeypatch.setattr(ss.BrowserManager, "get_user_data_dir", lambda browser: str(profile_dir))

    fake_session = MagicMock()
    fake_session.context.pages = [MagicMock()]
    monkeypatch.setattr(ss.BrowserManager, "launch", lambda **kwargs: fake_session)

    scraper = ss.PremiumSubstackScraper(
        base_substack_url="https://example.substack.com/p/premium-post",
        content_save_dir=str(tmp_path / "content"),
        use_persistent_profile=True,
    )
    assert scraper.skip_login is True


def test_base_and_free_scrapers_use_logging(tmp_path, caplog):
    import logging

    content_dir = tmp_path / "content"

    with caplog.at_level(logging.INFO):
        scraper = FakeScraper(
            "https://example.substack.com/p/test-post",
            content_save_dir=str(content_dir),
        )

    assert scraper.writer_name == "example"
    assert any("Created posts directory" in record.message for record in caplog.records)


def test_clean_post_html_strips_comment_and_promo_buttons():
    html = """
    <div class="available-content">
        <p>This is the real article body paragraph.</p>
        <p class="button-wrapper">
            <a class="button primary" href="https://example.substack.com/p/test-slug/comments">
                <span>Leave a comment</span>
            </a>
        </p>
        <p class="button-wrapper">
            <a class="button primary" href="https://example.substack.com/subscribe">
                <span>Subscribe now</span>
            </a>
        </p>
        <p>Here is another legitimate paragraph mentioning to leave a comment if you like.</p>
        <div class="post-footer">Footer promo content</div>
    </div>
    """
    from substack_scraper.scrapers.base import BaseSubstackScraper

    md = BaseSubstackScraper.html_to_md(html, clean_content=True)
    assert "This is the real article body paragraph." in md
    assert "Here is another legitimate paragraph mentioning to leave a comment if you like." in md
    assert "[Leave a comment]" not in md
    assert "[Subscribe now]" not in md
    assert "Footer promo content" not in md

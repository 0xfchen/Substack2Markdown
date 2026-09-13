# Substack2Markdown - Tickets & Plans Index

Unified, chronological index of all retroactively created issues and plans mapped to commit history.

## Ticket Registry

| Ticket | Type | Category | Description | Document Link |
| :--- | :--- | :--- | :--- | :--- |
| **`stm-001`** | **Issue** | `security` | Prevent XSS in HTML viewer and escape embedded JSON | [`issues/stm-001-xss-prevention-and-safe-json-embed.md`](issues/stm-001-xss-prevention-and-safe-json-embed.md) |
| **`stm-002`** | **Issue** | `fix` | Improve default CLI behavior and handle missing URL safely | [`issues/stm-002-cli-missing-url-handling.md`](issues/stm-002-cli-missing-url-handling.md) |
| **`stm-003`** | **Issue** | `fix` | Add HTTP timeouts and fallback for failed image downloads | [`issues/stm-003-image-download-http-timeouts.md`](issues/stm-003-image-download-http-timeouts.md) |
| **`stm-004`** | **Plan** | `feat` | Respect custom output directories and support custom Substack domains | [`plans/stm-004-custom-directories-and-domains.md`](plans/stm-004-custom-directories-and-domains.md) |
| **`stm-005`** | **Issue** | `perf` | Parallelize image downloads using ThreadPoolExecutor | [`issues/stm-005-parallelize-image-downloads.md`](issues/stm-005-parallelize-image-downloads.md) |
| **`stm-006`** | **Plan** | `feat` | Load credentials from `.env` file if present | [`plans/stm-006-dotenv-credentials-loading.md`](plans/stm-006-dotenv-credentials-loading.md) |
| **`stm-007`** | **Issue** | `refactor` | Use logging instead of print for CLI messages | [`issues/stm-007-logging-migration-for-cli.md`](issues/stm-007-logging-migration-for-cli.md) |
| **`stm-008`** | **Issue** | `refactor` | Modularize codebase into `substack_scraper/` package | [`issues/stm-008-modularize-codebase-package.md`](issues/stm-008-modularize-codebase-package.md) |
| **`stm-009`** | **Issue** | `refactor` | Move output folders into `data/` subdirectories (`md_files`, `html_pages`, `images`) | [`issues/stm-009-standardize-data-subdirectories.md`](issues/stm-009-standardize-data-subdirectories.md) |
| **`stm-010`** | **Plan** | `feat` | Migrate premium scraper from Selenium to Playwright with session reuse | [`plans/stm-010-playwright-migration.md`](plans/stm-010-playwright-migration.md) |
| **`stm-011`** | **Issue** | `refactor` | Remove `config.py` fallback for credentials in favor of `.env` and environment variables | [`issues/stm-011-remove-config-file-credential-fallback.md`](issues/stm-011-remove-config-file-credential-fallback.md) |
| **`stm-012`** | **Plan** | `feat` | Make `--url` required in CLI and display help on bare invocation | [`plans/stm-012-cli-required-url.md`](plans/stm-012-cli-required-url.md) |
| **`stm-013`** | **Plan** | `feat` | Set default frontmatter format to MDX | [`plans/stm-013-default-mdx-frontmatter.md`](plans/stm-013-default-mdx-frontmatter.md) |
| **`stm-014`** | **Issue** | `refactor` | Type `frontmatter_format` with `Literal['mdx', 'legacy']` | [`issues/stm-014-type-frontmatter-format-literal.md`](issues/stm-014-type-frontmatter-format-literal.md) |
| **`stm-015`** | **Plan** | `feat` | Add `--force` rescraping option and image download retry with backoff | [`plans/stm-015-rescraping-and-image-retry.md`](plans/stm-015-rescraping-and-image-retry.md) |
| **`stm-016`** | **Plan** | `feat` | Catalog & Metadata Synchronization (HTML `post_id` parsing, catalog deduplication) | [`plans/stm-016-catalog-and-metadata-sync.md`](plans/stm-016-catalog-and-metadata-sync.md) |
| **`stm-017`** | **Plan** | `feat` | CLI Experience & Logging (Verbosity flags, unified logger, auto profile resolution) | [`plans/stm-017-cli-experience-and-logging.md`](plans/stm-017-cli-experience-and-logging.md) |

---

### Excluded Commits
- `test: use real Substack publication URLs and variations in extract_main_part tests`
- `build: add pyproject.toml and uv.lock, replace requirements.txt`
- `build: raise minimum Python requirement to 3.11+`
- `docs: modernize README.md with CLI package usage, browser options, and clean up obsolete references`
- `chore: update default BASE_SUBSTACK_URL to https://substack.com/`

# Parallelize Image Downloads Using ThreadPoolExecutor

## Problem Description

In image-heavy Substack posts (e.g. data analyses, charts, tutorials), downloading images sequentially on a single thread caused severe performance bottlenecks:
- A single essay containing 20–30 high-resolution images took upwards of 30–60 seconds to process due to serial network latency.
- Repeated duplicate images within the same post were processed multiple times.

## Proposed Solution

1. **Concurrent Downloads via `ThreadPoolExecutor`**:
   Use Python's `concurrent.futures.ThreadPoolExecutor` to download images concurrently.
2. **Configurable Worker Pool**:
   Introduce `MAX_IMAGE_WORKERS = 6` to balance concurrency speed without triggering CDN rate limits.
3. **URL Deduplication**:
   Extract and deduplicate unique image URLs before scheduling download tasks.
4. **Non-blocking Progress Updates**:
   Update progress bars as tasks complete or when files already exist on disk.

## Changes Made

- `substack_scraper.py` (later modularized into `substack_scraper/config.py` and `substack_scraper/images.py`):
  - Defined `MAX_IMAGE_WORKERS: int = 6`.
  - Refactored `process_markdown_images()` to:
    - Collect unique image URLs from markdown content.
    - Check if images already exist locally before spawning downloads.
    - Submit pending downloads to a `ThreadPoolExecutor` bounded by `min(len(download_tasks), max_workers)`.
    - Map completed futures to local target paths.
    - Replace references in markdown in a single regex substitution pass.
- `tests/test_substack_scraper.py`:
  - Added `test_process_markdown_images_concurrent_downloads` ensuring multiple images are downloaded concurrently and markdown links are replaced accurately.

## Verification

- Automated pytest suite:
  ```bash
  uv run pytest tests/test_substack_scraper.py -k "concurrent_downloads"
  ```
- Tested image-heavy articles and observed a 4x–5x reduction in post processing time.


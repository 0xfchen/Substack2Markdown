# Content Directory

This directory contains scraped Substack newsletter posts, images, and metadata organized by publication/author:

```text
content/
└── <author>/
    ├── metadata.json                 # Publication metadata and essay catalog
    ├── posts/
    │   ├── <post-slug-1>.md          # Clean Markdown with YAML frontmatter
    │   └── <post-slug-2>.md
    └── images/                       # Downloaded post images (when --images is passed)
        └── <post-slug-1>/
            ├── image-1.png
            └── image-2.jpg
```

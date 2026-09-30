# Blog cover images

Drop a cover image in this directory and name it in a post's frontmatter:

```yaml
---
cover: protein-101.jpg
coverAlt: A steel thaali with dal, roti and a bowl of curd
---
```

Notes:

- Supported formats: `.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`.
- `coverAlt` is **required** whenever `cover` is set. A cover is informative on
  the post page, so it needs a description; the listing card renders it with
  empty alt text because the headline right next to it already names the post.
- The file name is matched exactly. A name that does not resolve here fails the
  build and lists the files that do exist — no silent missing image.
- Astro resizes and re-encodes covers at build time, so commit the good-quality
  original rather than a pre-shrunk copy.

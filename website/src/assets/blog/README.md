# Blog cover images

Covers are committed here and named in a post's frontmatter:

```yaml
---
cover: protein-101.webp
coverAlt: A steel thaali with dal, roti and a bowl of curd
---
```

`coverAlt` is **required** whenever `cover` is set. A cover is informative on the post page, so
it needs a description; the listing card renders it with empty alt text because the headline
right next to it already names the post. The file name is matched exactly — a name that does
not resolve fails the build and lists the files that do exist.

## Do not add these by hand

The file to run is `npm run blog:images`, which converts the original artwork to **WebP at
quality 75, 1600 px wide** and inserts the two frontmatter lines for you:

```bash
npm run blog:images               # convert what exists, report what does not
npm run blog:images -- --prompts  # rewrite PROMPTS.md from the prompt manifest
npm run blog:images -- --force    # re-encode even when already up to date
```

Drop the source image in `asset/blog/<post-file-name>.png` (that folder sits next to the
repository and is git-ignored — it is an input, not site content). The script is the single
place the format, the quality and the width are decided, so a cover cannot arrive as a 6 MB
PNG because somebody forgot.

## The prompts live next to the alt text

[`PROMPTS.md`](PROMPTS.md) is generated from the manifest at the top of
[`scripts/blog-images.mjs`](../../../scripts/blog-images.mjs), which holds, per post: the
generation prompt and the alt text for the image it should produce.

Keep the two together. An alt text written after the fact, from the prompt rather than from
the picture, describes an image nobody has seen. If the artwork you generate shows something
different from the prompt, edit the alt text in the manifest and re-run the script.

## What a good cover is

- **16:9, at least 1600 px wide.** That is the card's aspect ratio, so nothing is cropped
  somewhere the photographer did not choose.
- **No text or logos in the image.** The site has its own type and its own mark; a generated
  wordmark would be a second, wrong one, and small text is unreadable at card size anyway.
- **Real crockery, natural light, food that looks cooked.** Every other photograph on this
  site comes from real cooking in a real kitchen.

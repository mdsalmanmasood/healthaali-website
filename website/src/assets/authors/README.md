# Author portraits

Optional. A byline shows a **monogram** — the author's initials — until there is a real
photograph to show instead, and it will keep showing the monogram if there never is one. No
stand-in face, no stock portrait, no generated likeness: a byline is a claim about who wrote
the page, and a picture of somebody else is the wrong kind of wrong.

**What a portrait is:** the small round photograph next to the author's name under a post
headline, in the "About the author" box at the foot of it, and on their page at
`/blog/author/<id>`. It is the author's own picture. It is not a logo, not a dish, and not a
brand mark — the site has a logo, and it is the wrong thing to put in a person's byline.

Today the author is **Nehal Masood**, and her portrait is supplied: `nehal-masood.webp`, named
in the `portrait` field in [`src/data/authors.ts`](../../data/authors.ts). Her byline draws
that photograph wherever it appears, and her `Person` node carries an `image`. The team author
(`healthaali-kitchen`) has no picture of a person to show, so it still draws the initials `HK`
— which is what a byline without a photograph is supposed to do.

## The supplied portrait

`nehal-masood.webp` — 1024×1024, WebP, quality 75, 43 KB.

It was cropped and encoded from the photograph the author supplied — `asset/authors/nehal-masood.png`,
1024×1536 PNG, 2.0 MB, in the gitignored `asset/` directory beside the other source assets. Only
the square WebP above is committed. Run this from the project root:

```js
await sharp("asset/authors/nehal-masood.png")
  .extract({ left: 0, top: 120, width: 1024, height: 1024 })
  .webp({ quality: 75 })
  .toFile("website/src/assets/authors/nehal-masood.webp");
```

The crop is square and takes the full width; `top: 120` drops the empty band above the head
while keeping the whole face and a little headroom. `object-fit: cover` then fits that square
into the circle without cropping it again. To take a different crop later, re-run the two lines
above with different `extract` bounds — the original is untouched in `asset/authors/`.

## Adding one

1. Put the image in this directory, e.g. `nehal-masood.webp`. A square file works best —
   `nehal-masood.webp` is 1024×1024 — because it is displayed as a circle with
   `object-fit: cover`, which takes the centre of whatever it is given. The file is only ever
   delivered through Astro's image pipeline, so commit a good-quality original rather than a
   pre-shrunk copy. A head-and-shoulders portrait rather than a small face in a wide frame.
2. Name it in that author's entry in [`src/data/authors.ts`](../../data/authors.ts), in the
   `portrait` field:

```ts
{
  id: "nehal-masood",
  name: "Nehal Masood",
  type: "Person",
  portrait: "nehal-masood.webp",
  // …
}
```

That one line does four things: the byline swaps the monogram for the picture, the author
page gains the same photograph, and the `Person` node on every post she wrote gains an
`image` (with the file's real width and height). Nothing else needs editing.

A portrait that is named but missing from this directory fails the build with the list of
files that do exist — the alternative is a byline that silently loses its photograph.

Supported formats: `.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`.

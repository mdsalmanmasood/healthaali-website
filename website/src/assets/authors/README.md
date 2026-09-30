# Author portraits

Optional. A byline shows a **monogram** — the author's initials — until there is a real
photograph to show instead, and it will keep showing the monogram if there never is one. No
stand-in face, no stock portrait, no generated likeness: a byline is a claim about who wrote
the page, and a picture of somebody else is the wrong kind of wrong.

To add one:

1. Put the image here, e.g. `salman.webp`. Square crops work best; it is displayed as a 40 px
   circle with `object-fit: cover`, and the file is only ever delivered through Astro's image
   pipeline, so commit a good-quality original rather than a pre-shrunk copy.
2. Name it in that author's entry in [`src/data/authors.ts`](../../data/authors.ts):

```ts
{
  id: "salman",
  name: "Salman Masood",
  portrait: "salman.webp",
  // …
}
```

A portrait that is named but missing from this directory fails the build with the list of
files that do exist — the alternative is a byline that silently loses its photograph.

Supported formats: `.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`.

# Blog cover images — generation prompts

Six covers for the six launch posts. Nothing here is published yet: the posts
ship without images, and each one gets a cover the moment its file appears.

## How to use this

1. Generate an image from a prompt below with any text-to-image model.
2. Save it as `asset/blog/<slug>.png` — the folder next to the repository, which
   is git-ignored, using the post's file name as the file name.
3. Run `npm run blog:images`. It converts the file to WebP at quality 75,
   1600 px wide, writes it to `src/assets/blog/`, and adds `cover:` and
   `coverAlt:` to that post's frontmatter. Nothing else needs editing.
4. Run `npm run verify` — the accessibility, link and weight gates all run
   against pages that now have images.

## The rules these prompts follow

- **16:9, at least 1600 px wide.** That is the card's aspect ratio, so nothing
  is cropped in a way the photographer did not choose.
- **No text, no logos, no packaging.** The site has its own type and its own
  marks; a generated wordmark would be a second, wrong one, and generated text
  is unreadable at card size.
- **Natural light, real crockery, unstyled food.** The photography on the rest
  of the site is real cooking in a real kitchen, and a cover that looks like a
  stock library would be the odd one out.
- **Alt text first.** Each entry below has its description already written. If
  the image you end up using shows something else, change the alt text in
  `scripts/blog-images.mjs` and re-run the script — an alt text that does not
  match the picture is worse than no picture.

---

## 1. how-much-protein-do-you-need-indian-diet

**Subject:** protein on an ordinary Indian plate

**Prompt**

```text
Top-down photograph of a simple Indian meal on a cream linen cloth: a small steel katori of thick yellow dal, two soft whole-wheat rotis stacked to one side, a bowl of plain curd with a steel spoon, and two halved boiled eggs showing orange yolks. Soft natural window light from the left, warm neutral tones, gentle shadows, shallow depth of field, a few scattered cumin seeds on the cloth. Photographic, 50mm lens. No text, no logos, no packaging, no people.
```

**Save the result as** `asset/blog/how-much-protein-do-you-need-indian-diet.png` (any of .png, .jpg, .jpeg,
.webp or .avif — the name is what matters).

**Alt text** (already written for this image; adjust it if the picture differs)

```text
A top-down view of dal in a steel katori, two rotis, a bowl of curd and two halved boiled eggs arranged on a cream cloth.
```

---

## 2. cooking-with-less-oil-tadka

**Subject:** a dry tempering in an iron kadai

**Prompt**

```text
Photograph of a black cast-iron kadai on a dark kitchen counter, whole cumin seeds and two dried red chillies dry-roasting in it with no oil visible, a thin wisp of aromatic steam rising, a small steel bowl holding one teaspoon of mustard oil beside the pan. Warm directional light from the upper right, cream and deep-green cloth in the background, visible texture on the pan, droplets of water on the seeds. Photographic, 50mm lens, close and appetising. No text, no logos, no people, no hands.
```

**Save the result as** `asset/blog/cooking-with-less-oil-tadka.png` (any of .png, .jpg, .jpeg,
.webp or .avif — the name is what matters).

**Alt text** (already written for this image; adjust it if the picture differs)

```text
Cumin seeds and dried red chillies dry-roasting in a black iron kadai, with a small bowl of mustard oil beside it.
```

---

## 3. how-to-build-a-balanced-thaali

**Subject:** four parts of a balanced thali

**Prompt**

```text
A polished steel thali photographed at 45 degrees on cream cotton cloth, holding four clearly separate parts: a small katori of dal, a portion of steamed rice, a green vegetable sabzi, and a bowl of thick curd, with one folded roti at the edge of the plate. Even diffused daylight, fresh bright vegetables, no oil sheen, muted cream and terracotta background, everything in focus. Photographic, 35mm lens. No text, no logos, no people.
```

**Save the result as** `asset/blog/how-to-build-a-balanced-thaali.png` (any of .png, .jpg, .jpeg,
.webp or .avif — the name is what matters).

**Alt text** (already written for this image; adjust it if the picture differs)

```text
A steel thali holding separate portions of dal, rice, a green vegetable sabzi and curd, with a folded roti at the edge.
```

---

## 4. why-home-cooked-food-is-hard-to-track

**Subject:** a kitchen counter just after cooking

**Prompt**

```text
Overhead photograph of an ordinary Indian home kitchen counter immediately after cooking: a half-finished katori of dal with a spoon resting in it, a stack of fresh rotis in a checked cloth, a small bowl of chopped onion with a lemon wedge, and a single steel teaspoon of oil catching the light. Warm late-afternoon light, lived-in and unstyled, cream and green cloth, faint steam over the dal. Photographic, 35mm lens. No text, no logos, no packaging, no people, no hands.
```

**Save the result as** `asset/blog/why-home-cooked-food-is-hard-to-track.png` (any of .png, .jpg, .jpeg,
.webp or .avif — the name is what matters).

**Alt text** (already written for this image; adjust it if the picture differs)

```text
A kitchen counter after cooking: a half-finished katori of dal, a stack of rotis in a cloth, chopped onion with lemon, and one teaspoon of oil.
```

---

## 5. weight-loss-with-indian-food-without-banning-rice

**Subject:** a measured portion of rice, not a small one

**Prompt**

```text
Photograph on a cream linen cloth of an Indian place setting: a generous bowl of steamed rice next to a katori of yellow dal, a plate of sliced cucumber, tomato and onion with a lemon wedge, and a second, much smaller empty bowl beside the first for comparison. Soft diffused daylight, clean and calm composition, warm neutral palette, slight steam rising from the rice. Photographic, 50mm lens, eye-level. No text, no logos, no scales, no measuring tape, no people.
```

**Save the result as** `asset/blog/weight-loss-with-indian-food-without-banning-rice.png` (any of .png, .jpg, .jpeg,
.webp or .avif — the name is what matters).

**Alt text** (already written for this image; adjust it if the picture differs)

```text
A bowl of steamed rice beside a katori of dal and a plate of sliced salad vegetables on a cream cloth.
```

---

## 6. high-protein-meals-under-15-minutes

**Subject:** a ten-minute paneer pocket on the tawa

**Prompt**

```text
Angled photograph of a dark flat tawa on a gas stove with two golden stuffed paneer pockets crisping on it, a small bowl of chopped coriander and a lemon wedge just behind the stove, a clean steel plate waiting beside it. Warm evening kitchen light from a window at the left, cream tiles, faint steam, oil barely visible. Photographic, 50mm lens, close and appetising. No text, no logos, no packaging, no people, no hands.
```

**Save the result as** `asset/blog/high-protein-meals-under-15-minutes.png` (any of .png, .jpg, .jpeg,
.webp or .avif — the name is what matters).

**Alt text** (already written for this image; adjust it if the picture differs)

```text
Two golden stuffed paneer pockets crisping on a dark flat tawa, with chopped coriander and a lemon wedge behind it.
```

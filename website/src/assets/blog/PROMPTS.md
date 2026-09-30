# Blog cover images — generation prompts

12 covers, one for every post on this blog. Nothing here is
published yet: the posts ship without images, and each one gets a cover the
moment its file appears.

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

---

## 7. how-much-protein-in-dal

**Subject:** the same dal, thick and thin, side by side

**Prompt**

```text
Overhead photograph on cream linen of two identical steel katoris of toor dal: the left one thick enough to hold the shape of the spoon, the right one thin and watery, with a small steel bowl of dry yellow toor dal and a folded stack of two rotis beside them. Soft natural window light from the upper left, warm neutral tones, visible texture in the dal, a few cumin seeds on the cloth. Photographic, 50mm lens. No text, no logos, no packaging, no people, no hands.
```

**Save the result as** `asset/blog/how-much-protein-in-dal.png` (any of .png, .jpg, .jpeg,
.webp or .avif — the name is what matters).

**Alt text** (already written for this image; adjust it if the picture differs)

```text
Two steel katoris of the same dal, one thick and one thin, beside a bowl of dry toor dal and a stack of two rotis.
```

---

## 8. fibre-in-an-indian-diet

**Subject:** the parts of a plate that carry the fibre

**Prompt**

```text
Top-down photograph on cream linen cloth of a katori of green sabzi, a katori of cooked rajma, a small bowl of raw cucumber, onion and tomato salad with a lemon wedge, one apple cut in half showing the skin, and a small steel bowl of peanuts. Bright diffused daylight, fresh vegetables, no oil sheen, muted cream and terracotta background, everything in focus. Photographic, 35mm lens. No text, no logos, no packaging, no people.
```

**Save the result as** `asset/blog/fibre-in-an-indian-diet.png` (any of .png, .jpg, .jpeg,
.webp or .avif — the name is what matters).

**Alt text** (already written for this image; adjust it if the picture differs)

```text
A katori of sabzi, a katori of rajma, a bowl of raw salad, a halved apple and a bowl of peanuts arranged on cream cloth.
```

---

## 9. sugar-in-an-ordinary-indian-day

**Subject:** one day's sugar, laid out on a tray

**Prompt**

```text
Overhead photograph of a plain steel tray on a cream cloth holding an ordinary day's sugar: three small glasses of chai, a saucer with four plain biscuits, a small bowl of tomato ketchup with a spoon, a tall glass of orange juice, one piece of light-coloured mithai, and a small steel bowl of loose white sugar with a teaspoon in it. Soft even daylight, unstyled and lived-in, warm neutral palette. Photographic, 35mm lens. No text, no logos, no packaging, no brand marks, no people, no hands.
```

**Save the result as** `asset/blog/sugar-in-an-ordinary-indian-day.png` (any of .png, .jpg, .jpeg,
.webp or .avif — the name is what matters).

**Alt text** (already written for this image; adjust it if the picture differs)

```text
A steel tray holding three glasses of chai, four biscuits on a saucer, a bowl of ketchup, a glass of juice, a piece of mithai and a bowl of sugar.
```

---

## 10. soya-chunks-cheapest-protein

**Subject:** soya chunks before and after the soak

**Prompt**

```text
Photograph on a cream cloth of two steel bowls side by side: the left holding dry, pale soya chunks, the right holding the same chunks after soaking, plump and drained, with a folded cotton kitchen towel and a small bowl of crushed black pepper beside them, and a dark kadai just behind. Cool diffused daylight from a window at the right, clean and calm composition, shallow depth of field, visible texture on the chunks. Photographic, 50mm lens. No text, no logos, no packaging, no people, no hands.
```

**Save the result as** `asset/blog/soya-chunks-cheapest-protein.png` (any of .png, .jpg, .jpeg,
.webp or .avif — the name is what matters).

**Alt text** (already written for this image; adjust it if the picture differs)

```text
Two steel bowls side by side, one of dry soya chunks and one of soaked, drained chunks, with a cloth and a bowl of crushed pepper.
```

---

## 11. eating-out-without-losing-the-plan

**Subject:** a restaurant table ordered well

**Prompt**

```text
Photograph at 45 degrees of an Indian restaurant table with a dark wooden top and white plates: a tandoori platter of chicken and paneer tikka with onion rings and lemon, a small bowl of dal, two rotis in a cloth, a bowl of raita, a glass of buttermilk, and a tall glass of water. Warm restaurant lighting from above, softly out-of-focus room behind, appetising and clean, no menu visible in frame. Photographic, 35mm lens. No text, no logos, no packaging, no people, no hands.
```

**Save the result as** `asset/blog/eating-out-without-losing-the-plan.png` (any of .png, .jpg, .jpeg,
.webp or .avif — the name is what matters).

**Alt text** (already written for this image; adjust it if the picture differs)

```text
A restaurant table set with a tandoori platter, a bowl of dal, two rotis, raita, buttermilk and a glass of water.
```

---

## 12. protein-at-breakfast-indian-food

**Subject:** an Indian breakfast with the protein on the plate

**Prompt**

```text
Overhead photograph on cream cloth of an Indian breakfast: a plate of poha with a small bowl of plain curd beside it, two boiled eggs halved to show the yolks, a small steel bowl of roasted peanuts, a steel tumbler of chai, and a lemon wedge. Bright morning light from a window at the left, unstyled family kitchen, warm cream and green palette, faint steam from the chai. Photographic, 35mm lens. No text, no logos, no packaging, no people, no hands.
```

**Save the result as** `asset/blog/protein-at-breakfast-indian-food.png` (any of .png, .jpg, .jpeg,
.webp or .avif — the name is what matters).

**Alt text** (already written for this image; adjust it if the picture differs)

```text
A plate of poha with a bowl of curd, two halved boiled eggs, roasted peanuts and a tumbler of chai on cream cloth.
```

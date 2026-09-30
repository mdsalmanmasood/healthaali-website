/**
 * The two YouTube addresses this site builds.
 *
 * Both are stated once here because more than one part of the site needs them:
 * a blog post embeds a video and a recipe card plays one, and the pair of rules
 * they follow — which host a player is allowed to come from, and which URL a
 * video really lives at — have to be identical or one surface quietly breaks.
 *
 * Which video, if any, is a decision for the caller; this module only knows how
 * to address one.
 */

/**
 * Where an embedded player is loaded from.
 *
 * `youtube-nocookie.com` is YouTube's own no-cookie-before-play host, and it is
 * the only host the Content-Security-Policy allows in a frame (see
 * public/_headers). The player is only fetched after the visitor asks for it —
 * see the click-to-play note in src/layouts/BaseLayout.astro.
 */
export const youtubeEmbedUrl = (id: string): string =>
  `https://www.youtube-nocookie.com/embed/${id}`;

/**
 * The public watch URL. The channel publishes Shorts, whose canonical URL is
 * `/shorts/<id>` — the same address the recipe cards link to — so a post that
 * embeds a recipe links to exactly the video the recipes page lists, and the
 * no-JavaScript fallback under a player goes to the video the player would have
 * loaded.
 */
export const youtubeWatchUrl = (id: string): string =>
  `https://www.youtube.com/shorts/${id}`;

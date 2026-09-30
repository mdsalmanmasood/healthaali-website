/**
 * The blog's RSS 2.0 feed, built without a feed library.
 *
 * The site only needs a summary feed — title, link, date, description — so a
 * hand-written document is smaller than a dependency and easier to keep exact.
 * Two details are deliberate:
 *
 *   - `lastBuildDate` is omitted when there are no posts, rather than stamped
 *     with the build time. A timestamp from `new Date()` would make every build
 *     produce a different file, which defeats reproducible builds and makes a
 *     scheduled "did anything change?" check useless.
 *   - Values are escaped by hand, including stripping the C0 control characters
 *     XML 1.0 forbids outright. A stray one in a title would make the whole
 *     document unparseable rather than merely ugly.
 */
import type { APIRoute } from "astro";

import { blogFeedTitle, blogPath, getPosts } from "../../data/blog";
import { absoluteUrl, site } from "../../data/site";

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

export const GET: APIRoute = async () => {
  const posts = await getPosts();

  const feedUrl = absoluteUrl("/blog/rss.xml");
  const channelUrl = absoluteUrl(blogPath);
  const description =
    "Notes from the HealThaali kitchen on cooking with less oil, balanced Indian meals and steady progress.";

  const items = posts.map((post) => {
    const url = absoluteUrl(post.href);
    const categories = post.tags
      .map((tag) => `      <category>${escapeXml(tag)}</category>`)
      .join("\n");

    return [
      "    <item>",
      `      <title>${escapeXml(post.title)}</title>`,
      `      <link>${escapeXml(url)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
      `      <pubDate>${post.publishedAt.toUTCString()}</pubDate>`,
      `      <description>${escapeXml(post.description)}</description>`,
      ...(categories ? [categories] : []),
      "    </item>",
    ].join("\n");
  });

  const lastBuildDate = posts[0]
    ? `\n    <lastBuildDate>${posts[0].publishedAt.toUTCString()}</lastBuildDate>`
    : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(blogFeedTitle)}</title>
    <link>${escapeXml(channelUrl)}</link>
    <description>${escapeXml(description)}</description>
    <language>en</language>
    <copyright>${escapeXml(`© ${new Date().getFullYear()} ${site.name}`)}</copyright>${lastBuildDate}
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
${items.join("\n")}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
};

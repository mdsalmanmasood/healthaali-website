/**
 * Cooking topics — the three landing pages for a way of cooking rather than for
 * one dish: no-oil, high-protein, and weight-loss.
 *
 * Why a rule rather than a list of dishes
 * ---------------------------------------
 * `recipes.json` is regenerated from the channel's public feed by `npm run
 * recipes`, and the daily sync workflow commits whatever is new. A curated list
 * of video ids here would therefore be wrong within a week — either quietly
 * missing the newest dish or pointing at one that is no longer published. So
 * membership is derived at build time from the same snapshot the rest of the
 * site renders.
 *
 * Why the *title* and not the description
 * ---------------------------------------
 * A video's description is largely hashtags (`#weightlossrecipes`,
 * `#HighProtein`), and matching those would eventually file a dessert under
 * weight loss because a phrase appeared in a soup of tags. A title is a claim
 * the publisher makes in its own voice: "Zero-Oil Mutton Liver pepper fry"
 * asserts zero oil, and nothing on these pages has to be inferred from it. The
 * copy below says exactly this, so a reader can check the rule by scanning the
 * titles — which is the point.
 *
 * The copy is grounded
 * --------------------
 * Every number and argument below is one the site already publishes, in the
 * posts each topic links. Nothing here is a new claim about food, a rate of
 * loss, or an ingredient this site has not cooked. Where the underlying post
 * refuses to claim something — that oil is bad for you, that zero-oil food is
 * always better — the page refuses it too, in the same words.
 */

import { absoluteUrl, site } from "./site";
import type { FaqItem } from "./faq";
import { recipes, type Recipe } from "./recipes";

/** `"High protein"` and `"high protein"` are the same tag; `"high"` and `"protein"` are not. */
const sameLabel = (left: string, right: string): boolean =>
  left.trim().toLowerCase() === right.trim().toLowerCase();

export interface CookingTopic {
  /** URL segment: `/no-oil-recipes`, `/high-protein-recipes`, … */
  slug: string;
  /** Short name for rails and the footer. */
  label: string;
  /** `<title>`. The brand is appended by BaseLayout. */
  title: string;
  /** Meta description, and the summary a crawler shows under the link. */
  description: string;
  /** The `<h1>`. */
  heading: string;
  /** One sentence under the heading. */
  lead: string;
  /** The page's argument, one paragraph per element. */
  intro: string[];
  /**
   * How a dish qualifies: tested against the title the channel published. Every
   * pattern is anchored on words the publisher used to describe their own video.
   */
  dishMatch: RegExp;
  /** Blog tags whose posts belong here, as written in post frontmatter. */
  postTags: string[];
  /** Heading over the "the numbers / the order to change things in" section. */
  factsHeading: string;
  /** The grounded facts that section lists, in the order they matter. */
  facts: string[];
  /** What the page deliberately does not claim, shown as a notice verbatim. */
  limits: string;
  faq: FaqItem[];
}

export const topics: CookingTopic[] = [
  {
    slug: "no-oil-recipes",
    label: "No-oil cooking",
    title: "No-oil and less-oil Indian recipes",
    description:
      "Indian dishes cooked with no oil at all, and the technique for using less oil in the ones that need some — every recipe filmed in the kitchen.",
    heading: "No-oil and less-oil Indian recipes",
    lead:
      "Zero oil where the dish allows it, less oil where it does not — with the cooking shown on camera rather than described.",
    intro: [
      "The dishes below were published with “no oil” or “zero oil” in their own titles: a dry, properly hot pan, whole spices roasted rather than bloomed in fat, and a splash of water where a recipe would reach for the bottle. The title is the test used to collect them, so nothing on this page has been re-labelled by us.",
      "The rest of the kitchen is not oil-free, and this page does not claim it is. What the videos show is the amount coming down without the dish turning into something else — because oil is the part of an ordinary Indian day that adds no protein, no fibre and no volume, and it is possible to spend 300 calories on it before anyone has fried anything on purpose.",
    ],
    dishMatch: /\b(zero|no)[- ]oil\b|\boil[- ]free\b/i,
    postTags: ["Zero oil"],
    factsHeading: "Where the oil goes, and what to change first",
    facts: [
      "A teaspoon of oil is 5 ml — about 4.5 grams, which is about 40 calories. Everything else here is that number, multiplied.",
      "Roast the whole spices dry first. Cumin, mustard seeds and dried chilli bloom perfectly well in a hot dry pan, and a teaspoon of oil added at the end then contributes flavour rather than heat.",
      "Give the onions water, not oil. They soften because they lose water, not because they are sitting in fat; a splash with the lid on does the same job in about the same time.",
      "Preheat properly. Food that hits a lukewarm pan sticks, and the reflex when it sticks is to add more oil.",
      "Change one dish rather than the whole kitchen. Halving the oil in the sabzi you cook every day is roughly 100 to 150 calories a day — often more than people manage by giving up something they like.",
    ],
    limits:
      "What this page is not: a claim that oil is bad for you, or that a zero-oil dish is always better than one cooked with oil. A teaspoon of mustard oil over a finished dal is 40 calories of flavour that makes the rest of the plate more likely to be eaten — and most of the recipes we film still use some, deliberately.",
    faq: [
      {
        question: "Can an Indian dish really be cooked with no oil at all?",
        answer:
          "Some of them, yes — the dishes below were filmed that way, and the technique is in the video rather than described here. What usually makes it work is that the flavour is carried by something else: crushed black pepper in the soya chicken, a lemon-and-spice marinade doing the work a batter normally would on the fish.",
      },
      {
        question: "Is a no-oil diet healthier than cooking with oil?",
        answer:
          "That is not what is claimed here, and the writing linked on this page says so before anything else: oil is fat, fat is a nutrient, and a meal with some fat in it is usually a better meal than one without. The narrower claim is that a lot of oil in Indian home cooking is spent without anyone deciding to spend it.",
      },
      {
        question: "Do these dishes come with calorie counts or ingredient tables?",
        answer:
          "No. Each dish page carries the description published with the video, in the channel's own words, and no ingredient table or calorie count is invented on top of it. In the app, a dish is counted against your own targets and the portions you actually served, which is the only version of those numbers that is about you.",
      },
    ],
  },

  {
    slug: "high-protein-recipes",
    label: "High-protein recipes",
    title: "High-protein Indian recipes",
    description:
      "Indian dishes published as high-protein — paneer, soya, eggs, fish, chicken and dal — plus what the label actually adds up to in an Indian day.",
    heading: "High-protein Indian recipes",
    lead:
      "The dishes the channel labels high-protein, newest first, with the arithmetic of an Indian protein day underneath them.",
    intro: [
      "Every dish below was published with “high protein” in its own title. That is the only test used — no dish has been re-labelled here, and none is called high-protein because a phrase turned up in a hashtag.",
      "Protein is the change that makes an ordinary day easier to hold, because it is what keeps you full between meals. It is also the number Indian home cooking most often misses: a plate lands around 20 g a meal when nobody is paying attention, and 30 to 40 g is reachable with the dal, curd, paneer, eggs, soya, fish or chicken that is already in the kitchen.",
    ],
    dishMatch: /high[- ]protein/i,
    postTags: ["High protein"],
    factsHeading: "What “high protein” adds up to",
    facts: [
      "Soya chunks carry around 15 g of protein per 30 g dry — the cheapest protein in the kitchen. They go dry and floury when cooked badly, which is exactly what tempts people into frying them; a wet, spiced base or a coarse grind fixes it.",
      "Paneer carries 18 to 20 g per 100 g, keeps for a week, and needs no cooking to be safe to eat. Eggs are about 6 g each and are the fastest protein there is.",
      "A katori of dal at lunch and another at dinner is 16 to 18 g on its own. How much is in the katori depends on how much water went into the pot rather than on which dal was bought.",
      "Curd or hung curd is 5 to 6 g per katori, and combining a pulse with a grain — dal with rice, curd with roti — is something Indian meals have been doing for a very long time.",
      "Per day, the guidance most dietitians work from is roughly 0.8 to 1.0 g per kilogram of body weight for most adults, and closer to 1.0 to 1.2 g per kilogram when you are losing weight, training, or over 60.",
    ],
    limits:
      "What this page is not: individual nutrition advice. The figures above are the ones the linked posts work from, with their reasoning and their caveats, and they are general information rather than a plan for you. If you are managing a health condition, that belongs with your doctor or dietitian.",
    faq: [
      {
        question: "How much protein do I actually need in a day?",
        answer:
          "The short version used across this site is roughly 0.8 to 1.0 g per kilogram of body weight for most adults, and closer to 1.0 to 1.2 g per kilogram when you are losing weight, training, or over 60 — so about 44 to 55 g a day at 55 kg, and about 68 to 85 g at 85 kg. The post linked here works through where those ranges come from and where they stop applying.",
      },
      {
        question: "Is dal enough protein on its own?",
        answer:
          "Two katoris a day, one at lunch and one at dinner, is 16 to 18 g — a real part of the day rather than a garnish, and two katoris beat one katori paired perfectly with anything. Whether it is enough depends on the rest of the plate, and on how much water went into the pot, which is what decides what a katori actually carries.",
      },
      {
        question: "What should I keep in the kitchen to cook this way on a weeknight?",
        answer:
          "Paneer, eggs, curd, soya chunks and a batch of cooked chana or rajma from the weekend. With those five in the house, a fifteen-minute high-protein meal stops being a decision — which is the whole problem on the nights it matters.",
      },
      {
        question: "Which of these is the cheapest per gram of protein?",
        answer:
          "Soya chunks, by a wide margin, and they take on whatever they are cooked in. Paneer and curd are complete proteins and turn up in dishes people already like, but they cost more per gram.",
      },
    ],
  },

  {
    slug: "weight-loss-recipes",
    label: "Weight-loss cooking",
    title: "Weight-loss recipes for an Indian kitchen",
    description:
      "Indian dishes published as weight-loss friendly, plus the order that works: the oil, the protein, the snacks — and rice kept rather than banned.",
    heading: "Weight-loss recipes for an Indian kitchen",
    lead:
      "The dishes the channel publishes for weight loss, and the four changes that do most of the work — none of which is giving up rice.",
    intro: [
      "These entries were published with “weight loss” in their own title, so the collection is the channel's labelling rather than ours. It includes the occasional video that is advice instead of a recipe, and those are worth watching for the same reason the dishes are worth cooking.",
      "Underneath the recipes sits one argument: weight comes down when you consistently eat slightly less energy than you use. Which change you make first is what decides whether you can hold it — oil, then protein, then drinks and snacks, and only then the grain portion, as a portion rather than a ban.",
    ],
    dishMatch: /\bweight[- ]?loss\b|\blose weight\b/i,
    postTags: ["Weight loss"],
    factsHeading: "Change these three before you cut rice",
    facts: [
      "The oil. It is the largest source of calories in Indian home cooking that adds no volume, no protein and no fibre. An ordinary day carries around 300 calories of it without anyone frying anything on purpose, and halving that is roughly 150 calories a day.",
      "The protein. Most Indian plates land around 20 g a meal. Pushing it to 30 to 40 g is what keeps an afternoon from being settled by chai and biscuits, and dal, curd, paneer, eggs, soya, fish or chicken all get you there.",
      "Drinks and snacks. Not because they are uniquely fattening, but because they are the easiest place to spend 300 calories and forget them: sweet tea through the day, a packaged juice, biscuits with the evening cup.",
      "Rice last, and as a portion. A katori is about 130 calories, with almost no fat in it, and it pairs with dal in a way that genuinely improves the protein picture. Two fists to one, decided at the serving spoon, is the swap that holds.",
      "Expect the month, not the day. Rates commonly given as safe and sustainable for most adults sit around a quarter to half a kilogram a week, and salt, sleep and hormones move the scale by a kilogram either way.",
    ],
    limits:
      "What this page is not: a plan, a promise of a rate of loss, or medical advice. If you have diabetes, thyroid issues, PCOS, are pregnant, or take medication, this is a conversation with your doctor before it is a conversation with a recipe page.",
    faq: [
      {
        question: "Do I have to give up rice to lose weight?",
        answer:
          "No. Rice is about 130 calories a katori, has almost no fat, and is the thing that makes a meal feel like a meal in most Indian homes. What usually happens when people cut it is that the calories come back somewhere else — more of the fry, a bigger snack at six, or a “healthy” replacement that costs more than the rice did.",
      },
      {
        question: "How fast should weight come off?",
        answer:
          "The rates commonly given as safe and sustainable for most adults sit around a quarter to half a kilogram a week. Faster is usually water, and usually followed by the rebound that makes people stop. Weigh yourself in the same conditions once or twice a week and read the month, not the day.",
      },
      {
        question: "Is this a diet plan I can follow?",
        answer:
          "It is a recipe collection plus the reasoning behind the order of changes — not a plan, and not medical advice. The app is where a plan gets personalised: it puts meals on your week and counts them against your own targets, while the cooking stays in your kitchen.",
      },
      {
        question: "What should I change first?",
        answer:
          "The oil, because it is the largest source of calories that adds nothing else to the plate, and because changing it does not make the food feel like a diet. Then protein, then the drinks and snacks, and only then the grain portion.",
      },
    ],
  },
];

/**
 * The dishes published under one topic, newest first (the snapshot is already
 * ordered that way), matched against the video's own title.
 *
 * A topic that matches nothing is a build failure rather than an empty section:
 * these pages are the site's landing pages for a search, and one that quietly
 * lists no dishes would be published, indexed and useless. The message names the
 * rule, because the fix is in this file rather than in the snapshot.
 */
export const dishesForTopic = (topic: CookingTopic): Recipe[] => {
  const matched = recipes.filter((recipe) => topic.dishMatch.test(recipe.title));

  if (matched.length === 0) {
    throw new Error(
      `[topics] "${topic.slug}" matches no dish. The rule ${String(topic.dishMatch)} is tested ` +
        `against each published video title; if the channel has genuinely stopped using those ` +
        `words, widen the pattern or remove the topic — do not leave a landing page with nothing on it.`,
    );
  }

  return matched;
};

/** The blog posts filed under one topic, by the tags their frontmatter carries. */
export const postsForTopic = <Post extends { tags: string[] }>(
  topic: CookingTopic,
  posts: Post[],
): Post[] =>
  posts.filter((post) => post.tags.some((tag) => topic.postTags.some((mine) => sameLabel(tag, mine))));

/**
 * The topic page a blog tag belongs to, when there is one.
 *
 * Tag pages and topic pages answer different searches — "what have you written
 * about protein" against "give me high-protein recipes" — so they stay separate
 * pages, and each links to the other. Without this, the two would compete with
 * no relationship declared between them.
 */
export const topicForTag = (tagName: string): CookingTopic | undefined =>
  topics.find((topic) => topic.postTags.some((tag) => sameLabel(tag, tagName)));

/** The topics a dish belongs to, for the cross-links on its own page. */
export const topicsForRecipe = (recipe: Recipe): CookingTopic[] =>
  topics.filter((topic) => topic.dishMatch.test(recipe.title));

export const topicPath = (topic: CookingTopic): string => `/${topic.slug}`;
export const topicUrl = (topic: CookingTopic): string => absoluteUrl(topicPath(topic));

/** Every topic, for the rails that link them. */
export const topicRail = (): { href: string; label: string; hint: string }[] =>
  topics.map((topic) => ({
    href: topicPath(topic),
    label: topic.label,
    // One line of the page's own argument, so a rail entry is not a bare word.
    hint: topic.lead,
  }));

/** `@id` of a topic page, so its nodes can be referenced rather than restated. */
export const topicId = (topic: CookingTopic): string => `${topicUrl(topic)}#topic`;

/** Used by the layout for `CollectionPage.name`. */
export const topicCollectionName = (topic: CookingTopic): string => `${topic.heading} — ${site.name}`;

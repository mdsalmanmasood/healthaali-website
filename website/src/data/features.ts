import type { IconName } from "../lib/icons";

export interface Feature {
  icon: IconName;
  title: string;
  description: string;
  /** Use the orange accent instead of the green one. */
  accent?: boolean;
  href?: string;
}

/**
 * The seven pillars, matching the icon row on the supplied product board:
 * "Record. Remember. Reason. Reshape."
 */
export const pillars: Feature[] = [
  {
    icon: "bowl",
    title: "Personalized recipes",
    description:
      "Recipes are chosen from your goal, your health profile and the food you actually like eating — not a generic diet list.",
  },
  {
    icon: "chart",
    title: "Nutrition tracking",
    description:
      "Protein, carbs, fat and fibre for every meal, shown against your own daily targets on one calm dashboard.",
  },
  {
    icon: "sparkles",
    title: "AI food intelligence",
    description:
      "HealThaali AI reads today's intake and suggests the next meal that balances it — like a higher-protein dinner.",
    accent: true,
  },
  {
    icon: "leaf",
    title: "Healthy lifestyle",
    description:
      "Zero-oil technique and everyday home cooking, so better food fits into a normal week instead of replacing it.",
  },
  {
    icon: "scale",
    title: "Weight management",
    description:
      "Set a goal weight and watch the trend move. Start, current and goal stay visible, with the change over time.",
  },
  {
    icon: "history",
    title: "Your food memory",
    description:
      "HealThaali remembers what you enjoy, what you prefer, what you avoid and what you eat most often.",
  },
  {
    icon: "target",
    title: "Real food, real results",
    description:
      "Progress is measured on ordinary Indian meals — rice, dal, sabzi, fry — rebuilt to be lighter and higher in protein.",
    accent: true,
  },
];

export interface FeatureGroup {
  id: string;
  eyebrow: string;
  title: string;
  blurb: string;
  icon: IconName;
  items: Feature[];
}

/** Detailed grouping used by /features. */
export const featureGroups: FeatureGroup[] = [
  {
    id: "personalized",
    eyebrow: "Personalized to you",
    title: "A profile, not a preset diet",
    blurb:
      "HealThaali starts by asking a few real questions — age, gender, height, weight, goal, health conditions, food preferences and lifestyle — then keeps adapting from there.",
    icon: "user",
    items: [
      {
        icon: "clipboard",
        title: "Guided profile setup",
        description:
          "Basic information, health and goals, food preferences and lifestyle, in one short flow.",
      },
      {
        icon: "target",
        title: "Goals & targets",
        description:
          "Choose a goal such as weight loss and set the target you are working towards.",
      },
      {
        icon: "utensils",
        title: "Food preferences",
        description:
          "Tell it Indian, low oil, high protein, spicy — or combinations — and the suggestions follow.",
      },
      {
        icon: "history",
        title: "Food memory",
        description:
          "A running, editable picture of what you enjoy, prefer, avoid and eat most often.",
      },
    ],
  },
  {
    id: "nutrition",
    eyebrow: "Nutrition you can see",
    title: "Numbers without the spreadsheet",
    blurb:
      "The dashboard, meal plan, logging and recipe detail screens all speak the same language, so the day's numbers are one glance away.",
    icon: "chart",
    items: [
      {
        icon: "gauge",
        title: "Home dashboard",
        description:
          "Today's calories against your target, plus protein, carbs, fat and fibre, and a recommendation for the next meal.",
        accent: true,
      },
      {
        icon: "calendar",
        title: "Meal plan",
        description:
          "Breakfast, lunch, dinner and snacks laid out for the day, and switchable to week or month view.",
      },
      {
        icon: "plus",
        title: "Food logging",
        description:
          "Search a food or recipe, or pick from recent and favourites, and log it in a couple of taps.",
      },
      {
        icon: "camera",
        title: "Scan food",
        description:
          "Point the camera at a plate, or use gallery and barcode, when typing is more effort than eating.",
      },
      {
        icon: "list",
        title: "Recipe detail",
        description:
          "Ingredients, instructions and nutrition per serving on one screen, with Start Cooking to follow along.",
      },
      {
        icon: "users",
        title: "One experience, every screen",
        description:
          "The same account and the same data whether you are on the phone or in the browser.",
      },
    ],
  },
  {
    id: "guidance",
    eyebrow: "Guidance, not guesswork",
    title: "HealThaali AI reads the day for you",
    blurb:
      "Instead of another chart, the assistant turns what it already knows into a next step — based on your profile, today's intake and your preferences.",
    icon: "sparkles",
    items: [
      {
        icon: "sparkles",
        title: "Balancing suggestions",
        description:
          "Got most of your carbs early? It will suggest a higher-protein dinner rather than a lecture.",
        accent: true,
      },
      {
        icon: "droplet",
        title: "Lighter swaps",
        description:
          "Alternatives for drinks, sweets and fried favourites, offered as options rather than bans.",
      },
      {
        icon: "flame",
        title: "Pattern awareness",
        description:
          "If fried food has crept up this week, it points at zero-oil versions of the same dishes.",
      },
      {
        icon: "heart",
        title: "Learns from your choices",
        description:
          "Recommendations follow the recipes you keep coming back to, not a fixed template.",
      },
    ],
  },
  {
    id: "progress",
    eyebrow: "Progress over perfection",
    title: "Watch the trend, not one bad day",
    blurb:
      "Your Progress tracks weight over a month, three months, six months or a year, and keeps the start, current and goal visible.",
    icon: "chart",
    items: [
      {
        icon: "scale",
        title: "Weight trend",
        description:
          "A weight line with your start, current and goal weight called out, plus how far you have come.",
      },
      {
        icon: "chart",
        title: "Nutrition history",
        description:
          "Switch the same view to nutrition or habits to see what actually changed.",
      },
      {
        icon: "bell",
        title: "Notifications & reminders",
        description:
          "Nudges for meals and logging, configurable in Settings so they help instead of nag.",
      },
      {
        icon: "calendar",
        title: "Ranges that suit real life",
        description:
          "1M, 3M, 6M and 1Y ranges, because week-to-week noise is not progress.",
      },
    ],
  },
  {
    id: "privacy",
    eyebrow: "Your data, your call",
    title: "Privacy is a screen in the app, not a slogan",
    blurb:
      "HealThaali keeps Data & Privacy in Settings, alongside Help & Support, so the controls sit where you would look for them.",
    icon: "shield",
    items: [
      {
        icon: "shield",
        title: "Data & Privacy controls",
        description:
          "A dedicated section in Settings, described in full in the privacy policy.",
      },
      {
        icon: "lock",
        title: "Account deletion",
        description:
          "A documented route to delete your account and the data attached to it.",
      },
      {
        icon: "settings",
        title: "Settings that stay put",
        description:
          "Health profile, goals, preferences, reminders, connected services and about — all in one place.",
      },
      {
        icon: "heart",
        title: "Health Connect",
        description:
          "Optional connection to your platform health store, so you decide whether to share step and activity data.",
      },
    ],
  },
];

/** Honest scope statement reused wherever health data is discussed. */
export const medicalDisclaimer =
  "HealThaali offers general nutrition information and meal guidance. It is not a medical device and does not diagnose, treat or cure any condition. Always follow the advice of your own doctor or dietitian.";

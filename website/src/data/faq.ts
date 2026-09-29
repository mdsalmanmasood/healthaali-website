export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * Every answer here maps to something visible in the supplied product design:
 * no invented pricing, ratings, certifications or download numbers.
 */
export const faq: FaqItem[] = [
  {
    question: "What does HealThaali actually do?",
    answer:
      "It plans your meals around home-cooked Indian food, tracks the nutrition in what you eat, and adapts its suggestions to your profile. In practice you get a daily plan, a dashboard of protein, carbs, fat and fibre against your targets, food logging (including photo and barcode scanning), step-by-step recipes and a progress view.",
  },
  {
    question: "Do I have to weigh and calculate everything myself?",
    answer:
      "No. Meals in your plan already carry their calories and macros. For anything outside the plan you can search for the food, pick from recent or favourites, or scan it. Logging a banana or a boiled egg is a tap, not a spreadsheet entry.",
  },
  {
    question: "What is HealThaali AI?",
    answer:
      "It is the suggestion layer. It looks at your profile, what you have already eaten today and your food preferences, then offers concrete next steps — for example a higher-protein dinner because most of today's carbs came early, or a zero-oil version of something you order often.",
  },
  {
    question: "What is “Food Memory”?",
    answer:
      "A plain-language summary of your habits that HealThaali builds as you use it: what you often enjoy, what you prefer, what you usually avoid and what you eat most frequently. It is there so the recommendations get sharper without you re-entering preferences.",
  },
  {
    question: "Is HealThaali only for Indian food?",
    answer:
      "The recipes and the zero-oil cooking approach are built around Indian home cooking — rice, dal, sabzi, thalis, snacks and everyday dishes. That focus is the point: the food has to be something you would actually eat again tomorrow.",
  },
  {
    question: "Can I use it if I have a health condition such as diabetes?",
    answer:
      "Your profile has room for health conditions and food preferences, and the app uses them to personalise suggestions. That said, HealThaali is not a medical device and does not diagnose or treat anything. If you are managing a condition, use it alongside advice from your doctor or dietitian, not instead of it.",
  },
  {
    question: "Where can I use it — phone, web, or both?",
    answer:
      "HealThaali is designed as one experience across screens, with the Android app as the primary companion. Web availability is announced on the Web App page; if it is not live yet, that page says so rather than linking to a placeholder.",
  },
  {
    question: "Is my health data private?",
    answer:
      "Settings includes a Data & Privacy section, and the privacy policy on this site describes what is collected, why, where it is stored and how to delete your account. We would rather point you at the policy than make a vague promise here.",
  },
];

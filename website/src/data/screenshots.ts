import type { ImageMetadata } from "astro";

import splash from "../assets/screens/splash.png";
import welcome from "../assets/screens/welcome.png";
import createProfile from "../assets/screens/create-profile.png";
import profileSetup from "../assets/screens/profile-setup.png";
import dashboard from "../assets/screens/dashboard.png";
import mealPlan from "../assets/screens/meal-plan.png";
import recipeDetail from "../assets/screens/recipe-detail.png";
import foodLog from "../assets/screens/food-log.png";
import scanFood from "../assets/screens/scan-food.png";
import aiSuggestions from "../assets/screens/ai-suggestions.png";
import progress from "../assets/screens/progress.png";
import foodMemory from "../assets/screens/food-memory.png";
import settings from "../assets/screens/settings.png";

export interface Screen {
  id: string;
  src: ImageMetadata;
  alt: string;
  caption?: string;
}

/**
 * True phone-proportions screens (board row 1). Use inside the `.phone` frame.
 * All descriptions are written from what the screen actually shows.
 */
export const phoneScreens = {
  splash: {
    id: "splash",
    src: splash,
    alt: "HealThaali splash screen with the HT leaf monogram and the tagline Healthy Food, Happier You",
    caption: "Splash",
  },
  welcome: {
    id: "welcome",
    src: welcome,
    alt: "Onboarding screen introducing HealThaali with the promises personalized recipes, nutrition tracking, healthy lifestyle and AI food intelligence",
    caption: "Welcome",
  },
  createProfile: {
    id: "create-profile",
    src: createProfile,
    alt: "Create Profile screen asking for basic information, health and goals, food preferences and lifestyle",
    caption: "Create profile",
  },
  profileSetup: {
    id: "profile-setup",
    src: profileSetup,
    alt: "Profile setup screen showing name, age, gender, weight, height, goal weight loss, a diabetes type 2 health condition and Indian, low oil, high protein food preferences",
    caption: "Your profile",
  },
  dashboard: {
    id: "dashboard",
    src: dashboard,
    alt: "Home dashboard showing 650 of 1800 kcal with protein, carbs, fat and fibre bars, meal shortcuts and today's recipe recommendation",
    caption: "Home dashboard",
  },
  mealPlan: {
    id: "meal-plan",
    src: mealPlan,
    alt: "Meal plan screen listing breakfast, lunch, dinner and snacks with calories and times, with today, week and month views",
    caption: "Meal plan",
  },
  recipeDetail: {
    id: "recipe-detail",
    src: recipeDetail,
    alt: "Recipe detail screen for Masala Oats Upma with high protein, low oil and weight loss tags, calories per serving, an ingredient list and a Start Cooking button",
    caption: "Recipe detail",
  },
} satisfies Record<string, Screen>;

/** The wider board mockups (row 2). Use inside the `.screen` card frame. */
export const cardScreens = {
  foodLog: {
    id: "food-log",
    src: foodLog,
    alt: "Log your meal screen with a food search box, recent, favourites, scan and custom filters, and quick rows for milk tea, banana, boiled egg, apple and chapati",
    caption: "Food logging",
  },
  scanFood: {
    id: "scan-food",
    src: scanFood,
    alt: "Scan your food screen with a camera viewfinder over a plated meal and scan, gallery and barcode options",
    caption: "Scan food",
  },
  aiSuggestions: {
    id: "ai-suggestions",
    src: aiSuggestions,
    alt: "HealThaali AI screen offering a higher-protein dinner, low-carb tea options and zero-oil alternatives based on today's intake",
    caption: "HealThaali AI",
  },
  progress: {
    id: "progress",
    src: progress,
    alt: "Health progress screen with a weight trend line over one month and start, current and goal weight figures",
    caption: "Your progress",
  },
  foodMemory: {
    id: "food-memory",
    src: foodMemory,
    alt: "Food memory screen summarising foods you often enjoy, prefer, avoid and eat most frequently",
    caption: "Food memory",
  },
  settings: {
    id: "settings",
    src: settings,
    alt: "Settings screen listing health profile, goals and targets, food preferences, notifications, health connect, data and privacy, help and support",
    caption: "Settings & more",
  },
} satisfies Record<string, Screen>;

/** Ordered sets used by the gallery-style sections. */
export const androidScreens: Screen[] = [
  phoneScreens.dashboard,
  phoneScreens.mealPlan,
  phoneScreens.recipeDetail,
];

export const workflowScreens: Screen[] = [
  cardScreens.foodLog,
  cardScreens.scanFood,
  cardScreens.aiSuggestions,
  cardScreens.progress,
  cardScreens.foodMemory,
  cardScreens.settings,
];

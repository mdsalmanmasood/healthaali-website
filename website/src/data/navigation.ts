export interface NavItem {
  label: string;
  href: string;
  /** Short description used by the mobile menu, where there is room for it. */
  hint?: string;
}

/**
 * Sticky-header navigation (desktop breakpoint and up).
 *
 * Exactly five items, which is what fits on one line at the 1024px breakpoint
 * with room to spare. "Products" is the hub for the Android and web builds —
 * they are the same app on two platforms, so they are listed inside /products
 * and in the footer rather than taking two slots here. Adding a sixth item
 * pushes the row past the available width, so measure before doing it.
 */
export const mainNav: NavItem[] = [
  { label: "Features", href: "/features", hint: "Everything the app does" },
  { label: "Recipes", href: "/recipes", hint: "Watch the dishes being cooked" },
  { label: "Products", href: "/products", hint: "What exists today, and what is still being built" },
  { label: "Blog", href: "/blog", hint: "Notes from the kitchen" },
  { label: "About", href: "/about", hint: "Why we build this" },
];

/**
 * Extra destinations shown only in the mobile menu / footer.
 *
 * "Delete Account" belongs to the data-rights side of the site: it is the route
 * `/privacy` and `/terms` point at, and it is reachable here and in the footer
 * rather than the header, whose five items already fill the row at 1024px.
 */
export const secondaryNav: NavItem[] = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Contact", href: "/contact" },
  { label: "Delete Account", href: "/delete-account" },
];

/** Mobile menu order: main destinations first, then the utility pages. */
export const mobileNav: NavItem[] = [...mainNav, ...secondaryNav.slice(2), ...secondaryNav.slice(0, 2)];

export interface FooterGroup {
  title: string;
  links: NavItem[];
}

export const footerNav: FooterGroup[] = [
  {
    title: "Product",
    links: [
      { label: "Products", href: "/products" },
      { label: "Features", href: "/features" },
      { label: "Recipes", href: "/recipes" },
      { label: "Web App", href: "/web-app" },
      { label: "Android", href: "/android" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    /*
      The three topic pages. They are listed here and not in the header: that
      row is full at the 1024px breakpoint (see the note above), and these are
      the pages someone arrives at from a search rather than browses to — so the
      job here is to give them a way onward once they are on the site, and to
      put a link to each one on every page of it.

      The paths are written out rather than derived from `topics.ts` so this
      stays a plain list of links, and a slug that moves without being moved
      here is caught by `npm run check:links` against the built site.
    */
    title: "Cook this way",
    links: [
      { label: "No-oil recipes", href: "/no-oil-recipes" },
      { label: "High-protein recipes", href: "/high-protein-recipes" },
      { label: "Weight-loss recipes", href: "/weight-loss-recipes" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      // Kept out of the header on purpose: that row is full at the 1024px
      // breakpoint, and this is a page people arrive at by searching for it
      // rather than one they browse to.
      { label: "Delete Account", href: "/delete-account" },
    ],
  },
];

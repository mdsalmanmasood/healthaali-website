export interface NavItem {
  label: string;
  href: string;
  /** Short description used by the mobile menu, where there is room for it. */
  hint?: string;
}

/** Sticky-header navigation (desktop breakpoint and up). */
export const mainNav: NavItem[] = [
  { label: "Features", href: "/features", hint: "Everything the app does" },
  { label: "Web App", href: "/web-app", hint: "Use HealThaali in a browser" },
  { label: "Android", href: "/android", hint: "The phone companion" },
  { label: "About", href: "/about", hint: "Why we build this" },
];

/** Extra destinations shown only in the mobile menu / footer. */
export const secondaryNav: NavItem[] = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Contact", href: "/contact" },
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
      { label: "Features", href: "/features" },
      { label: "Web App", href: "/web-app" },
      { label: "Android", href: "/android" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];

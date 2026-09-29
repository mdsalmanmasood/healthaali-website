export interface Testimonial {
  quote: string;
  author: string;
  /** Optional context line, e.g. "Bengaluru · using HealThaali for 3 months". */
  meta?: string;
}

/**
 * Intentionally empty.
 *
 * No reviews were supplied with the brand assets, so none are published. The
 * homepage testimonial section renders only when this array has entries —
 * add real, attributable quotes (with permission) and the section appears
 * automatically. Never add invented names, photos or ratings.
 */
export const testimonials: Testimonial[] = [];

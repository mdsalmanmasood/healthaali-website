/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_WEBAPP_URL?: string;
  readonly PUBLIC_ANDROID_URL?: string;
  readonly PUBLIC_CONTACT_EMAIL?: string;
  readonly PUBLIC_CONTACT_ENDPOINT?: string;
  readonly PUBLIC_ANALYTICS_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  /** Re-applies the stored theme; defined by the inline anti-flash script. */
  __healthaaliApplyTheme?: () => void;
}

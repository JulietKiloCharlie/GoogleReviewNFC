export const DEFAULT_WELCOME = "How was your experience with us?";
export const DEFAULT_THANKS = "Thank you for taking the time to share your feedback.";
export const DEFAULT_ACCENT = "#d7c4a3";

export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "assets",
  "login",
  "reset-password",
  "verify-email",
]);

export const LIMITS = {
  name: 120,
  slug: 80,
  description: 280,
  address: 300,
  welcome: 160,
  thanks: 200,
  message: 2000,
  logoBytes: 8 * 1024 * 1024,
};

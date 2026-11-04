export const ALLOWED_EMAIL = (process.env.ALLOWED_EMAIL ?? "adarshbharathwaj13@gmail.com").trim().toLowerCase();
export const SESSION_MAX_AGE = 60 * 60 * 24 * 180; // 180 days, in seconds (cookie refreshes on use)

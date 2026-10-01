// Default Extension Configuration
// JEV_API_KEY is injected at build time from .env, or can be overridden via Chrome Extension Popup
export const CONFIG = {
  JEV_API_KEY: "__JEV_API_KEY_PLACEHOLDER__",
  API_ENDPOINT: "https://api.typesafe.ai/v1/systemone",
  MODEL: "jev-latest",
  THRESHOLDS: {
    SUBTLE: 0.60,      // 60% - 70%: Subtle banner
    PROMINENT: 0.70,   // 70% - 80%: Prominent dark banner
    STAMP: 0.80        // > 80%: Rubber stamp animation
  },
  MAX_CONCURRENCY: 3,  // Maximum simultaneous requests to Jev API
  CACHE_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000 // 7 days cache
};

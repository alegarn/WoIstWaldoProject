// User-facing labels intentionally not yet translated; migrate to `t()` keys (complete in `en.json`, drafted in the other 8 locales) when the rating domain gets its i18n wave.
export const RATING_LABELS = [
  "?",
  "Death of fun",
  "Meh...",
  "Ok, why not",
  "Ok ok, good guess",
  "Great Guess!",
];

export const RATING_COLORS = {
  low: "#1D133D",
  high: "#FFD700",
  stops: ["#1D133D", "#1D133D", "#E53935", "#FB8C00", "#43A047", "#FFD700"],
};

// Same i18n deferral as RATING_LABELS: user-facing English until the rating domain's i18n wave.
export const RATING_DIMENSIONS = [
  { key: "quality", label: "Image Quality" },
  { key: "enigma", label: "Enigma Quality" },
  { key: "fun", label: "Fun" },
  { key: "difficulty", label: "Difficulty" },
];

/**
 * Reads the design tokens Tailwind emits on :root.
 *
 * The DOM styles itself from these same custom properties (bg-risk-high,
 * text-node-manufacturer, …), so the WebGL scene and the React UI can never
 * drift apart: change a colour in src/styles/index.css and both follow.
 *
 * Requires `@theme static` in the stylesheet — Tailwind 4 otherwise tree-shakes
 * tokens that no utility class happens to use, and canvas-only colours vanish.
 */

const TOKENS = {
  // node types
  manufacturer: '--color-node-manufacturer',
  distributor: '--color-node-distributor',
  retailer: '--color-node-retailer',
  // risk ramp (unused until the model produces scores)
  riskLow: '--color-risk-low',
  riskMedium: '--color-risk-medium',
  riskHigh: '--color-risk-high',
  riskFlagged: '--color-risk-flagged',
  // surfaces
  ink: '--color-ink-900',
}

/* Only used if the stylesheet has not applied yet — keeps the first frame from
   rendering in black rather than crashing Color's parser. Keep in sync with
   the @theme block. */
const FALLBACKS = {
  manufacturer: '#38bdf8',
  distributor: '#a78bfa',
  retailer: '#34d399',
  riskLow: '#22c55e',
  riskMedium: '#f59e0b',
  riskHigh: '#ef4444',
  riskFlagged: '#f43f5e',
  ink: '#060913',
}

/** @returns {Record<keyof typeof TOKENS, string>} CSS colour strings. */
export function readPalette(element = document.documentElement) {
  const styles = getComputedStyle(element)
  const palette = {}

  for (const [key, token] of Object.entries(TOKENS)) {
    palette[key] = styles.getPropertyValue(token).trim() || FALLBACKS[key]
  }

  return palette
}

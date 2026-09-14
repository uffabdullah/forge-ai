# /frontend/components — UI components

Shared, presentational UI built on top of the 3D canvas. Nothing here should
touch Three.js directly — components receive plain data (a node, a risk score,
a list of flagged suppliers) and render it.

## What goes here

- **`NodeCard.jsx`** — detail panel for a clicked node: ID, type, region, product line, risk score, top suspicious signals.
- **`RiskBadge.jsx`** — small colour-coded score pill (low / medium / high / flagged).
- **`AlertList.jsx`** — ranked list of the highest-risk distributors, click to focus in 3D.
- **`StatsPanel.jsx`** — dataset counters (nodes, transactions, flagged suppliers, model precision).
- **`Legend.jsx`** — colour + icon key for node types and risk levels.
- **`Hero.jsx` / `Section.jsx`** — scroll-storytelling layout wrappers with GSAP reveal animations.
- **`RiveBadge.jsx`** — wrapper around a Rive animation with a hook for play/pause on scroll.

## Conventions

- One component per file, named to match the file.
- Keep them dumb: data in via props, events out via callbacks (`onSelect(nodeId)`).
- Components are sourced from Skiper UI / Unlumen UI where a good match exists —
  copy the source in here rather than depending on a package, and note the
  origin in a comment at the top of the file.
- Style with CSS custom properties (`--risk-high`, `--node-manufacturer`, …) so
  the 3D scene and the DOM share one palette.

## Setup note

Skiper UI and Unlumen UI are React + Tailwind libraries. If we use them, the
frontend gains `react`, `react-dom`, `tailwindcss` and a `src/components/`
structure — confirm before scaffolding, since `package.json` is currently plain
Vite + Three.js.

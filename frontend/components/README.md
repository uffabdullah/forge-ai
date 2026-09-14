# /frontend/components — UI components

Shared React components (`.jsx`) built on top of the 3D canvas. Nothing here
imports Three.js: presentational components receive plain data (a node, a risk
score, a list of flagged suppliers) and emit events via callbacks, and
`GraphStage.jsx` is the single container that talks to the scene through a hook.

Vite resolves this folder through the `@components` alias, so an import reads
`import NodeCard from '@components/NodeCard.jsx'`.

## What goes here

- **`Hero.jsx`** — opening scroll-storytelling section. Takes `stats` and renders
  whatever `stage` node it is handed as a full-bleed layer behind the copy. The
  copy is `pointer-events-none` so orbiting works across the whole hero — add
  `pointer-events-auto` to any real control placed there.
- **`GraphStage.jsx`** — container for the WebGL graph. Takes the parsed
  `{ nodes, edges, status, error }` as props and bridges them to `useGraphScene`;
  renders the loading and failure states inline.
- **`NodeCard.jsx`** — detail panel for a clicked node: ID, type, region, product line, risk score, top suspicious signals.
- **`RiskBadge.jsx`** — small colour-coded score pill (low / medium / high / flagged).
- **`AlertList.jsx`** — ranked list of the highest-risk distributors, click to focus in 3D.
- **`StatsPanel.jsx`** — dataset counters (nodes, transactions, flagged suppliers, model precision).
- **`Legend.jsx`** — colour + icon key for node types and risk levels.
- **`Section.jsx`** — scroll-storytelling wrapper that registers a GSAP reveal.
- **`RiveBadge.jsx`** — wrapper around a Rive animation with a hook for play/pause on scroll.

## Conventions

- One component per file, named to match the file, exported as `default`.
- Keep them dumb: data in via props, events out via callbacks (`onSelect(nodeId)`).
- Components sourced from Skiper UI / Unlumen UI are copied in here rather than
  added as a dependency — note the origin in a comment at the top of the file.
- Style with Tailwind utilities backed by the `@theme static` tokens in
  `src/styles/index.css` (`bg-risk-high`, `text-node-manufacturer`, …) so the DOM
  and the 3D scene share one palette.
- If a component needs to reach the WebGL scene, it takes a callback and the
  scene API lives in the container component — never a Three.js import here.

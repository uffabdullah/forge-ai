# /frontend — Vite + React + Tailwind site (Three.js / GSAP / Lenis / Rive)

Vite app that tells the supply-chain story and then lets you explore the graph in
3D: scroll-driven sections, a hero 3D network, and Rive vector accents.

## Stack

| Layer | Choice |
| --- | --- |
| Bundler | **vite** 8 |
| UI | **react** 19 + **tailwindcss** 4 (via `@tailwindcss/vite`) |
| 3D | **three** 0.186 — plain JS, mounted imperatively (no react-three-fiber) |
| Scroll | **gsap** + ScrollTrigger, **lenis** for smooth scrolling |
| CSV | **papaparse** |
| Animation accents | **@rive-app/canvas** |
| Components | Skiper UI / Unlumen UI source, copied into `components/` |

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Vite entry point; loads Inter + JetBrains Mono and `src/main.jsx`. |
| `vite.config.js` | `react()` + `tailwindcss()` plugins; `@` → `src/`, `@components` → `components/`. |
| `scripts/sync-data.js` | Copies `/data/*.csv` → `public/data/`; runs automatically before `dev` and `build`. |
| `src/main.jsx` | React root, wraps `App` in `StrictMode`. |
| `src/App.jsx` | Page composition; owns `useGraphData` so the hero can show live counts. |
| `src/styles/index.css` | `@import "tailwindcss"` + the `@theme static` design tokens. |
| `src/hooks/useGraphData.js` | Fetches + parses both CSVs, validates, returns the scene shape. |
| `src/hooks/useGraphScene.js` | Mounts `createGraphScene` against a container ref. |
| `src/hooks/useSmoothScroll.js` | Lenis driven from the GSAP ticker, ScrollTrigger updated from Lenis. |
| `src/three/graph3d.js` | The scene: InstancedMesh nodes, LineSegments edges, OrbitControls, fog. |
| `src/three/layout.js` | Deterministic layered layout (types on planes, regions clustered). |
| `src/three/palette.js` | Reads the `@theme` tokens off `:root` for the canvas. |
| `components/GraphStage.jsx` | Container for the scene; renders load/error state. |
| `components/Hero.jsx` | Hero section; hosts the stage layer behind the copy. |
| `public/data/*.csv` | Git-ignored copies of the generated dataset (see `sync:data`). |

Still to come: `src/scroll/sections.js` (ScrollTrigger story timelines),
`src/rive/*.js` (asset loaders), `components/NodeCard.jsx` + `AlertList.jsx`.

## Data flow

`data/generate_transactions.py` → `data/*.csv` → `npm run sync:data` →
`public/data/*.csv` → `useGraphData` (fetch + papaparse) → `useGraphScene` →
Three.js. Regenerate the dataset with a new seed and the next `npm run dev`
picks it up; nothing is cached across runs.

`useGraphData` returns nodes `{ id, type, region, product, riskScore, index }`
and edges `{ id, source, target, sourceIndex, targetIndex, quantity, price,
timestamp, region, product }`. `riskScore` is `null` until the GNN produces
scores, and `index` is the node's position in the array — edges reference it as
`sourceIndex`/`targetIndex` for zero-lookup geometry building. Rows with missing
ids, duplicate nodes, and edges whose endpoints are absent from `nodes.csv` are
dropped and counted rather than throwing. Supabase later replaces the fetch
inside this one hook; nothing downstream changes.

## The 3D scene

**Layout** — a force simulation would rediscover the layers this graph already
has, at 1k+ nodes, non-deterministically and with another dependency. Instead
`computeLayeredLayout` puts manufacturers / distributors / retailers on three
planes 46 units apart along X (so goods flow reads left to right) and gives each
region an angular sector within its plane, spiralling nodes outward by region.
A `region_mismatch` node will therefore sit visibly outside its region's
cluster once scoring lands.

**Rendering** — all nodes are one `InstancedMesh` with per-instance colour, all
1,666 transactions are one `LineSegments` whose vertex colours blend source type
→ target type. Nodes use `MeshBasicMaterial` so each instance is exactly the
palette colour from CSS; depth comes from scene fog, whose range is scaled off
the camera's home distance (`homeDistance * 0.75 … * 2.6`) — scaling it off the
bounding radius instead washes the far layer out to background colour.

**Interaction** — `OrbitControls` (from `three/addons/controls/OrbitControls.js`)
with damping and slow `autoRotate` that stops on first pointer down. Clicking a
node flies the camera to it via GSAP (`focusNode`); clicking empty space
(`resetView`) pulls back to the full network. Drag vs click is separated by a 4px
threshold.

**Loop** — `gsap.ticker` drives rendering, so the scene shares a single rAF loop
with Lenis and ScrollTrigger instead of adding a competing one. An
`IntersectionObserver` halts rendering once the hero scrolls out of view.

## Why plain Three.js instead of react-three-fiber

The graph is one canvas that mounts once; selection and risk highlighting will be
imperative calls, not props, because they touch instance buffers rather than
React state. R3F would add ~80 kB and a second reconciler to wrap exactly one
`<canvas>`. Revisit if the scene grows into many independently-animated React
components.

## Imperative library pattern

Every non-React library owns a DOM node and a lifecycle React does not manage:
the component holds a ref, creates the thing in `useEffect`, returns a handle,
and `dispose()`es everything on cleanup — so StrictMode's double-mount and HMR
cannot leak a second scene or WebGL context. See `src/hooks/useSmoothScroll.js`
and `src/hooks/useGraphScene.js`.

## Design tokens

Colours live in `@theme static` in `src/styles/index.css`:
`--color-node-manufacturer|distributor|retailer`, `--color-risk-low|medium|high|flagged`,
and the `--color-ink-*` surfaces. Tailwind emits them as custom properties on
`:root`, so the DOM (`bg-risk-high`) and the canvas (`readPalette()`) share one
palette. `static` is required — without it Tailwind 4 tree-shakes tokens that no
utility class happens to use, and canvas-only colours silently disappear.

## Usage

```bash
npm install
npm run dev      # http://localhost:5173  (syncs data first)
npm run build    # → dist/
npm run preview
```

Copy `.env.example` to `.env.local` (git-ignored) and fill in the Supabase keys.

## Visualization ideas

- Colour nodes on the cool→hot risk ramp instead of by type; flagged nodes pulse.
- Fly the camera to the highest-risk distributor when its card is hovered.
- Highlight the anomalous subgraph (neighbours + edges) and dim the rest.
- Animate a "counterfeit batch" particle travelling the injected edges.
- Shrink nodes by degree, or size them by transaction volume.

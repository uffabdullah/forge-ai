# /frontend — Three.js + GSAP + Lenis + Rive site

Vite app that tells the supply-chain story and then lets you explore the graph in
3D: scroll-driven sections, a hero 3D network, and Rive vector accents.

## Planned files

| File | Purpose |
| --- | --- |
| `index.html` | Vite entry point. |
| `src/main.js` | App bootstrap, wires scroll + scenes together. |
| `src/graph3d.js` | Three.js scene: nodes as instanced spheres positioned by force/region layout, edges as `LineSegments`, risk score → emissive colour. |
| `src/scroll.js` | Lenis smooth scrolling + GSAP `ScrollTrigger` timelines for the storytelling sections. |
| `src/supabase.js` | Reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, fetches nodes + edges. |
| `src/rive.js` | Loads `.riv` assets (risk pulse, counterfeit stamp, animated icons). |
| `src/styles.css` | Layout + typography for the landing page. |
| `public/*.riv` | Rive animation files. |
| `components/` | Reusable UI components — see `components/README.md`. |

## Stack

- **vite** — dev server / bundler
- **three** — WebGL rendering of the graph
- **gsap** (+ ScrollTrigger) — scroll choreography and camera moves
- **lenis** — smooth scroll
- **@rive-app/canvas** — vector animation accents

## Usage

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

Env vars (put them in `frontend/.env.local`, git-ignored): `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`.

## Visualization ideas

- Colour nodes on a cool→hot ramp by risk score; make flagged nodes pulse.
- Fly the camera to the highest-risk distributor when its card is hovered.
- Highlight the anomalous subgraph (its neighbours + edges) and dim the rest.
- Animate a "counterfeit batch" particle travelling the injected edges.
- Use `InstancedMesh` and cap visible edges by risk so 1k+ nodes stay at 60fps.

## Notes

- `package.json` is intentionally plain Vite + Three.js. Skiper UI and Unlumen UI
  are React + Tailwind component libraries, so adopting them means adding
  `react`, `react-dom`, `tailwindcss` and the relevant copy-paste component
  source into `components/` — flag this before building the UI layer.

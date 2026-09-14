# CounterfeitTrace — GNN Supply-Chain Counterfeit Detection

CounterfeitTrace models a physical distribution network (medicines, seeds, fertilizer, electronics) as a directed transaction graph — manufacturers sell to distributors, distributors sell to retailers — and uses a Graph Neural Network (PyTorch Geometric) to score every node with a counterfeit-injection risk, learning the structural fingerprints that give a bad actor away: prices that sit far outside the category baseline, goods that keep appearing outside the region the seller claims to operate in, and transaction volumes that arrive in one compressed burst instead of an even yearly cadence. Synthetic ground-truth data is generated in `/data`, the graph and model live in `/model`, scores are persisted to Supabase through `/backend`, and the frontend renders the network in 3D with Three.js wrapped in a scroll-driven GSAP + Lenis landing page with Rive accents.

## Repo layout

| Folder | What lives there |
| --- | --- |
| `data/` | Synthetic data generation scripts and the generated `nodes.csv`, `edges.csv`, `anomaly_labels.csv` |
| `model/` | PyTorch Geometric graph loading, training, inference, saved checkpoints |
| `backend/` | Supabase client/config and scripts that push the graph + risk scores into Postgres |
| `frontend/` | Vite + React + Tailwind site: Three.js 3D graph, GSAP + Lenis scroll storytelling, Rive accents |
| `frontend/components/` | Reusable React UI components (cards, panels, badges, stat readouts) |

## Quickstart

```bash
# Python side (data + model + backend share one env)
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Generate the synthetic dataset
python data/generate_transactions.py

# Frontend
cd frontend && npm install && npm run dev
```

## Status

Steps 1–2 (structure, synthetic data generator) and the frontend are in place: Vite + React +
Tailwind, with the real generated dataset rendering in 3D. `frontend/scripts/sync-data.js`
copies `data/*.csv` into `frontend/public/data/` on every `dev`/`build`, `useGraphData` parses
them with papaparse, and the hero draws all 142 nodes as one `InstancedMesh` and all 1,666
transactions as one `LineSegments`, coloured by node type. Three.js, GSAP, Lenis and Rive are
mounted imperatively from `useEffect` hooks rather than through a React wrapper.

Still placeholders: GNN model training (`model/`), the Supabase data layer replacing the CSV
fetch (`backend/` + `frontend/src/hooks/useGraphData.js`), and everything that needs a risk
score — risk colouring, `NodeCard`, `AlertList`, Rive accents.

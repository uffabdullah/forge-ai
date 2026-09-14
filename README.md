# CounterfeitTrace — GNN Supply-Chain Counterfeit Detection

CounterfeitTrace models a physical distribution network (medicines, seeds, fertilizer, electronics) as a directed transaction graph — manufacturers sell to distributors, distributors sell to retailers — and uses a Graph Neural Network (PyTorch Geometric) to score every node with a counterfeit-injection risk, learning the structural fingerprints that give a bad actor away: prices that sit far outside the category baseline, goods that keep appearing outside the region the seller claims to operate in, and transaction volumes that arrive in one compressed burst instead of an even yearly cadence. Synthetic ground-truth data is generated in `/data`, the graph and model live in `/model`, scores are persisted to Supabase through `/backend`, and the frontend renders the network in 3D with Three.js wrapped in a scroll-driven GSAP + Lenis landing page with Rive accents.

## Repo layout

| Folder | What lives there |
| --- | --- |
| `data/` | Synthetic data generation scripts and the generated `nodes.csv`, `edges.csv`, `anomaly_labels.csv` |
| `model/` | PyTorch Geometric graph loading, training, inference, saved checkpoints |
| `backend/` | Supabase client/config and scripts that push the graph + risk scores into Postgres |
| `frontend/` | Vite site: Three.js 3D graph, GSAP + Lenis scroll storytelling, Rive accents |
| `frontend/components/` | Reusable UI components (buttons, cards, panels, stat readouts) |

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

Step 1 (structure) and Step 2 (synthetic data generator) complete. Model, backend sync, and frontend implementation are still placeholders.

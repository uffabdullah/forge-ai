# /model — PyTorch Geometric training + inference

Turns the CSV graph from `/data` into a PyG `Data` object, trains a node
classifier that flags counterfeit-injection points, and writes risk scores that
`/backend` pushes to Supabase.

## Planned files

| File | Purpose |
| --- | --- |
| `dataset.py` | Loads `data/nodes.csv` + `data/edges.csv`, builds node features and edge indices, returns `torch_geometric.data.Data`. |
| `model.py` | The GNN itself (e.g. 3× `GCNConv`/`SAGEConv` + linear head → 1 logit per node). |
| `train.py` | Training loop on `data/anomaly_labels.csv`, with a class-imbalance-aware loss and a held-out split. |
| `infer.py` | Loads a checkpoint, scores every node, writes `risk_scores.csv`. |
| `checkpoints/` | Saved weights (git-ignored). |

## Node features to start with

- one-hot `node_type`, one-hot `product_category`, one-hot `region`
- out-degree / in-degree, total quantity, mean and std-dev unit price
- `price_ratio` = mean unit price ÷ category baseline
- `foreign_region_ratio` = share of outgoing edges whose region ≠ node region
- burstiness: max transactions in any rolling 14-day window, and its ratio to the mean

Those last three are exactly the injected anomaly signals, so a well-fit model
should recover them — that overlap is intentional (it makes the demo explainable).

## Tasks

- **Node classification** — is this node a counterfeit injection point? (primary)
- **Link prediction** *(stretch)* — which missing transactions are plausible?
- **Explanations** *(stretch)* — GNNExplainer / attention weights to highlight the edges that drove a score.

## Usage (once implemented)

```bash
python model/train.py --epochs 200 --seed 7
python model/infer.py --checkpoint model/checkpoints/best.pt
```

## Notes

- Keep `anomaly_labels.csv` out of the feature matrix; labels are for loss/eval only.
- With only 5 positives, prefer PR-AUC / precision@k over accuracy.
- Everything is seeded so a demo run is repeatable on stage.

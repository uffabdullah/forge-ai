# /data — Synthetic data generation + generated CSVs

Everything that produces the transaction graph the rest of the project consumes.
No hand-written data lives here: the graph is always regenerated from a script so
results stay reproducible (fixed RNG seed).

## Files

| File | Purpose |
| --- | --- |
| `generate_transactions.py` | Builds the synthetic supply-chain graph and injects 5 anomalous distributor nodes. Writes the three CSVs below. |
| `nodes.csv` | *(generated)* one row per node: `node_id, node_type, region, product_category` |
| `edges.csv` | *(generated)* one row per transaction: `txn_id, source_id, target_id, quantity, price, timestamp, region, product_category` |
| `anomaly_labels.csv` | *(generated)* ground truth: `node_id, anomaly_type, region, description` for the 5 injected nodes |

## Graph shape

- **3 node types** — `manufacturer` → `distributor` → `retailer`, IDs prefixed `MFG-`, `DST-`, `RTL-`.
- **Product lines** — medicine, seeds, fertilizer, electronics (drives the baseline unit price).
- **Regions** — north, south, east, west, central.
- **Timeline** — one calendar year (2025), timestamps on every edge.

## Usage

```bash
python generate_transactions.py                 # writes next to the script
python generate_transactions.py --seed 42       # different instance
python generate_transactions.py --out-dir .     # write somewhere else
```

Regenerating with the default seed always produces a byte-identical dataset;
change `--seed` to draw a new one.

## Injected anomalies (what the GNN has to learn)

Five distributors carry one profile each, and `anomaly_labels.csv` is the answer
key used for evaluation only — never as a model input:

1. **`price_undercut`** — sells 35–55% below the category baseline.
2. **`price_inflated`** — charges 2.6–4.0× the baseline.
3. **`region_mismatch`** — most sales land outside its declared region.
4. **`burst_timing`** — volume compressed into ~10 days instead of a yearly cadence.
5. **`mixed`** — mild undercut + partial out-of-region + two short bursts (the hard case).

## Next steps

- Add category-specific seasonality so timing anomalies are less trivially separable.
- Export a `data/graph.pt` PyG `Data` object here (or in `/model`) so training skips CSV parsing.
- Add a `--scale` flag for stress-testing on a much larger graph.

# /backend — Supabase client, graph + score sync

The bridge between the Python pipeline and the frontend: Supabase (Postgres)
stores the graph and the per-node risk scores, and the frontend reads them back
for the 3D visualization.

## Planned files

| File | Purpose |
| --- | --- |
| `.env` | *(git-ignored)* `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — service role key stays server-side only. |
| `.env.example` | *(committed)* template with empty values. |
| `supabase_client.py` | Reads env vars, builds one reusable client, raises a clear error if config is missing. |
| `schema.sql` | Table + index + RLS definitions (see below). |
| `push_graph.py` | Uploads `data/nodes.csv` and `data/edges.csv` (upsert on primary key). |
| `push_scores.py` | Uploads `model/risk_scores.csv` and refreshes the leaderboard view of highest-risk nodes. |

## Proposed schema

```sql
create table nodes (
  node_id          text primary key,
  node_type        text not null,
  region           text not null,
  product_category text not null,
  risk_score       double precision,
  is_flagged       boolean default false,
  anomaly_type     text            -- ground truth, for the demo overlay
);

create table edges (
  txn_id           text primary key,
  source_id        text references nodes(node_id),
  target_id        text references nodes(node_id),
  quantity         integer,
  price            double precision,
  ts               timestamptz,
  region           text,
  product_category text
);

create index edges_source_idx on edges (source_id);
create index edges_target_idx on edges (target_id);
create index nodes_risk_idx   on nodes (risk_score desc);
```

RLS: enable on both tables and allow public **read-only** (the anon key is
shipped in the browser); all writes go through the service role key.

## Usage (once implemented)

```bash
python backend/push_graph.py      # nodes + edges
python backend/push_scores.py     # risk scores from the model
```

## Notes

- Never commit `.env`, and never expose the service role key to the frontend.
- Batch inserts in chunks (~500 rows) so the hackathon-data upload stays under request limits.
- Idempotent upserts mean the demo can be re-run live without cleaning tables first.

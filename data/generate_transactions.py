#!/usr/bin/env python3
"""Generate a synthetic supply-chain transaction graph with injected counterfeits.

The graph is a directed, bipartite-ish distribution network:

    manufacturer  ->  distributor  ->  retailer

Edges are transactions (quantity, unit price, timestamp, region). Sixteen
distributor nodes (~40% of the 40 distributors) are given anomalous price /
region / timing patterns that mimic where counterfeit goods get injected,
and their IDs are written to ``anomaly_labels.csv`` as ground truth. Sixteen
is enough that a 70/30 train/val split still holds out several positives.

Outputs
-------
nodes.csv           node_id, node_type, region, product_category
edges.csv           txn_id, source_id, target_id, quantity, price, timestamp,
                    region, product_category
anomaly_labels.csv  node_id, anomaly_type, region, description

Usage
-----
    python generate_transactions.py
    python generate_transactions.py --seed 42
    python generate_transactions.py --out-dir ./generated
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #

PRODUCT_LINES = ("medicine", "seeds", "fertilizer", "electronics")

# Typical price of one genuine unit, in the local currency, per product line.
# Every price in the dataset is derived from this, so "abnormal price" means
# "far away from this number for this product line".
BASELINE_PRICE = {
    "medicine": 18.0,
    "seeds": 6.5,
    "fertilizer": 24.0,
    "electronics": 95.0,
}

REGIONS = ("north", "south", "east", "west", "central")

N_MANUFACTURERS = 12
N_DISTRIBUTORS = 40
N_RETAILERS = 90
N_ANOMALOUS = 16  # 40% of N_DISTRIBUTORS; 15-20 leaves a healthy majority

# Healthy margins: manufacturers sell at a wholesale discount, distributors
# resell at a retail markup.
WHOLESALE_DISCOUNT = (0.55, 0.72)
RETAIL_MARKUP = (1.20, 1.90)

YEAR_START = pd.Timestamp("2025-01-01 00:00:00")
YEAR_END = pd.Timestamp("2025-12-31 23:59:59")

# The five counterfeit signatures we inject. Each anomalous distributor gets
# one profile, cycling so every signature appears at least three times.
ANOMALY_PROFILES: tuple[dict, ...] = (
    {
        "anomaly_type": "price_undercut",
        "description": (
            "Sells 35-55% below the category baseline price - the signature of "
            "dumped or relabelled counterfeit stock undercutting genuine supply."
        ),
        "price_multiplier": (0.35, 0.55),
    },
    {
        "anomaly_type": "price_inflated",
        "description": (
            "Charges 2.6-4.0x the category baseline, consistent with fake goods "
            "sold as premium originals."
        ),
        "price_multiplier": (2.60, 4.00),
    },
    {
        "anomaly_type": "region_mismatch",
        "description": (
            "85% of downstream transactions happen outside the region the "
            "distributor declares - goods are re-routed through unregistered "
            "territory."
        ),
        "foreign_edge_share": 0.85,
    },
    {
        "anomaly_type": "burst_timing",
        "description": (
            "Volume arrives in a single ~10-day burst with 3x the transaction "
            "count instead of an even yearly cadence - one undocumented batch "
            "entering the network."
        ),
        "burst_days": 10,
        "burst_multiplier": 3,
    },
    {
        "anomaly_type": "mixed",
        "description": (
            "Hardest case: mild undercut (~0.65x), 40% out-of-region sales and "
            "two short bursts. No single signal dominates."
        ),
        "price_multiplier": (0.60, 0.72),
        "foreign_edge_share": 0.40,
        "burst_days": 14,
        "burst_windows": 2,
        "burst_multiplier": 2,
    },
)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def sample_timestamps(
    rng: np.random.Generator,
    n: int,
    start: pd.Timestamp = YEAR_START,
    end: pd.Timestamp = YEAR_END,
) -> pd.DatetimeIndex:
    """Return ``n`` uniformly random timestamps inside ``[start, end]``."""
    span = max(1, int((end - start).total_seconds()))
    return start + pd.to_timedelta(rng.integers(0, span, size=n), unit="s")


def bulk_discount(quantity: int) -> float:
    """Large orders are cheaper per unit, up to 25% off."""
    return 1.0 - min(0.25, quantity / 20_000.0)


def distributor_timestamps(
    rng: np.random.Generator, n: int, profile: dict | None
) -> pd.DatetimeIndex:
    """Timestamps for one distributor's downstream sales.

    A healthy distributor transacts on an even yearly cadence. A node with a
    ``burst_timing`` profile instead concentrates everything into a few very
    short windows, which is what a single large undocumented batch looks like.
    """
    burst_days = profile.get("burst_days", 0) if profile else 0
    if not burst_days:
        return sample_timestamps(rng, n)

    n_windows = int(profile.get("burst_windows", 1))
    latest_start = YEAR_END - pd.Timedelta(days=burst_days)
    starts = sample_timestamps(rng, n_windows, YEAR_START, latest_start).to_numpy()

    window_of = rng.integers(0, n_windows, size=n)
    offsets = rng.uniform(0.0, burst_days * 86_400.0, size=n)
    return pd.to_datetime(starts[window_of]) + pd.to_timedelta(offsets, unit="s")


def edge_regions(
    rng: np.random.Generator, home_region: str, n: int, foreign_share: float
) -> np.ndarray:
    """Per-edge region labels, with ``foreign_share`` of them outside home."""
    regions = np.full(n, home_region, dtype=object)
    if foreign_share <= 0:
        return regions

    foreign_mask = rng.random(n) < foreign_share
    n_foreign = int(foreign_mask.sum())
    if n_foreign:
        elsewhere = [r for r in REGIONS if r != home_region]
        regions[foreign_mask] = rng.choice(elsewhere, size=n_foreign)
    return regions


# --------------------------------------------------------------------------- #
# Graph construction
# --------------------------------------------------------------------------- #


def build_nodes(rng: np.random.Generator) -> pd.DataFrame:
    """Create manufacturers, distributors and retailers (ID, type, region)."""
    rows: list[dict] = []

    for prefix, count, node_type in (
        ("MFG", N_MANUFACTURERS, "manufacturer"),
        ("DST", N_DISTRIBUTORS, "distributor"),
        ("RTL", N_RETAILERS, "retailer"),
    ):
        for i in range(1, count + 1):
            rows.append(
                {
                    "node_id": f"{prefix}-{i:03d}",
                    "node_type": node_type,
                    "region": str(rng.choice(REGIONS)),
                    "product_category": str(rng.choice(PRODUCT_LINES)),
                }
            )

    return pd.DataFrame(rows)


def assign_anomalies(
    nodes: pd.DataFrame, rng: np.random.Generator
) -> dict[str, dict]:
    """Pick N_ANOMALOUS distributors and cycle the five signatures onto them."""
    distributor_ids = nodes.loc[
        nodes["node_type"] == "distributor", "node_id"
    ].to_numpy()
    chosen = rng.choice(distributor_ids, size=N_ANOMALOUS, replace=False)
    profiles = [ANOMALY_PROFILES[i % len(ANOMALY_PROFILES)] for i in range(N_ANOMALOUS)]
    profiles = [profiles[i] for i in rng.permutation(len(profiles))]
    paired = sorted(zip(chosen.tolist(), profiles), key=lambda item: item[0])
    return {node_id: profile for node_id, profile in paired}


def build_edges(
    nodes: pd.DataFrame,
    rng: np.random.Generator,
    anomalous: dict[str, dict],
) -> pd.DataFrame:
    """Create every transaction edge in the network."""
    manufacturers = nodes[nodes["node_type"] == "manufacturer"]
    distributors = nodes[nodes["node_type"] == "distributor"]
    retailers = nodes[nodes["node_type"] == "retailer"]

    mfg_ids = manufacturers["node_id"].to_numpy()
    rtl_ids = retailers["node_id"].to_numpy()
    mfg_region = dict(zip(manufacturers["node_id"], manufacturers["region"]))

    rows: list[dict] = []

    def record(source_id, target_id, category, quantity, price, when, region):
        rows.append(
            {
                "source_id": source_id,
                "target_id": target_id,
                "quantity": int(quantity),
                "price": round(float(price), 2),
                "timestamp": pd.Timestamp(when).strftime("%Y-%m-%d %H:%M:%S"),
                "region": str(region),
                "product_category": category,
            }
        )

    for _, node in distributors.iterrows():
        node_id = node["node_id"]
        home_region = node["region"]
        category = node["product_category"]
        profile = anomalous.get(node_id)

        # ---- upstream: genuine stock bought from manufacturers -------------- #
        # Kept normal even for anomalous nodes: counterfeiters still buy some
        # real product to launder their paperwork.
        n_suppliers = int(rng.integers(1, 4))
        for supplier in rng.choice(mfg_ids, size=n_suppliers, replace=False):
            n_shipments = int(rng.integers(3, 11))
            quantities = rng.integers(400, 5_000, size=n_shipments)
            unit_prices = BASELINE_PRICE[category] * rng.uniform(
                *WHOLESALE_DISCOUNT, size=n_shipments
            )
            for quantity, unit_price, when in zip(
                quantities,
                unit_prices,
                sorted(sample_timestamps(rng, n_shipments)),
            ):
                record(
                    supplier,
                    node_id,
                    category,
                    quantity,
                    unit_price * bulk_discount(quantity),
                    when,
                    mfg_region[supplier],
                )

        # ---- downstream: sales to retailers (where the anomaly lives) ------- #
        multiplier = (
            profile.get("price_multiplier") if profile else None
        ) or RETAIL_MARKUP
        foreign_share = profile.get("foreign_edge_share", 0.0) if profile else 0.0
        burst_multiplier = int(profile.get("burst_multiplier", 1)) if profile else 1

        n_buyers = int(rng.integers(4, 9))
        for buyer in rng.choice(rtl_ids, size=n_buyers, replace=False):
            n_tx = int(rng.integers(2, 8)) * burst_multiplier
            quantities = rng.integers(20, 400, size=n_tx)
            unit_prices = BASELINE_PRICE[category] * rng.uniform(*multiplier, size=n_tx)
            regions = edge_regions(rng, home_region, n_tx, foreign_share)

            for quantity, unit_price, when, region in zip(
                quantities,
                unit_prices,
                sorted(distributor_timestamps(rng, n_tx, profile)),
                regions,
            ):
                record(
                    node_id,
                    buyer,
                    category,
                    quantity,
                    unit_price * bulk_discount(quantity),
                    when,
                    region,
                )

    edges = pd.DataFrame(rows).sort_values("timestamp").reset_index(drop=True)
    edges.insert(0, "txn_id", [f"TXN-{i:06d}" for i in range(1, len(edges) + 1)])
    return edges[
        [
            "txn_id",
            "source_id",
            "target_id",
            "quantity",
            "price",
            "timestamp",
            "region",
            "product_category",
        ]
    ]


def build_labels(nodes: pd.DataFrame, anomalous: dict[str, dict]) -> pd.DataFrame:
    """Ground-truth table for the injected nodes."""
    region_of = dict(zip(nodes["node_id"], nodes["region"]))
    return pd.DataFrame(
        [
            {
                "node_id": node_id,
                "anomaly_type": profile["anomaly_type"],
                "region": region_of[node_id],
                "description": profile["description"],
            }
            for node_id, profile in sorted(anomalous.items())
        ]
    )


# --------------------------------------------------------------------------- #
# Reporting
# --------------------------------------------------------------------------- #


def print_summary(
    nodes: pd.DataFrame,
    edges: pd.DataFrame,
    labels: pd.DataFrame,
    out_dir: Path,
) -> None:
    anomalous_ids = set(labels["node_id"])
    sales = edges[edges["source_id"].isin(nodes.loc[nodes["node_type"] == "distributor", "node_id"])]
    normal_sales = sales[~sales["source_id"].isin(anomalous_ids)]
    anomaly_sales = sales[sales["source_id"].isin(anomalous_ids)]

    print(f"\nWrote 3 files to {out_dir}")
    print(f"  nodes.csv            {len(nodes):>6,} rows")
    print(f"  edges.csv            {len(edges):>6,} rows")
    print(f"  anomaly_labels.csv   {len(labels):>6,} rows")
    print(f"  (transactions span {edges['timestamp'].min()} -> {edges['timestamp'].max()})")

    print("\nInjected anomalous distributors:")
    type_counts = labels["anomaly_type"].value_counts()
    print("  " + ", ".join(f"{k}={v}" for k, v in type_counts.items()))
    for _, row in labels.iterrows():
        node_id = row["node_id"]
        node_sales = anomaly_sales[anomaly_sales["source_id"] == node_id]
        print(
            f"  {node_id}  {row['anomaly_type']:<16} "
            f"{len(node_sales):>4} sales, median unit price "
            f"{node_sales['price'].median():>8.2f}"
        )

    print(
        f"\nMedian unit price, healthy distributors: "
        f"{normal_sales['price'].median():.2f}  |  anomalous: "
        f"{anomaly_sales['price'].median():.2f}"
    )
    print(
        f"Median sales per distributor, healthy: "
        f"{normal_sales.groupby('source_id').size().median():.0f}  |  anomalous: "
        f"{anomaly_sales.groupby('source_id').size().median():.0f}"
    )


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a synthetic supply-chain graph with injected anomalies.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--seed", type=int, default=7, help="RNG seed (default: 7)")
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path(__file__).resolve().parent,
        help="Where to write the CSVs (default: the folder holding this script)",
    )
    args = parser.parse_args()

    rng = np.random.default_rng(args.seed)

    nodes = build_nodes(rng)
    anomalous = assign_anomalies(nodes, rng)
    edges = build_edges(nodes, rng, anomalous)
    labels = build_labels(nodes, anomalous)

    args.out_dir.mkdir(parents=True, exist_ok=True)
    nodes.to_csv(args.out_dir / "nodes.csv", index=False)
    edges.to_csv(args.out_dir / "edges.csv", index=False)
    labels.to_csv(args.out_dir / "anomaly_labels.csv", index=False)

    print_summary(nodes, edges, labels, args.out_dir)


if __name__ == "__main__":
    main()

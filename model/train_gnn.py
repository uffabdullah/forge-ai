#!/usr/bin/env python3
"""Train a supervised heterogeneous GNN on the synthetic supply-chain graph.

Why GraphSAGE (not GAT)
-----------------------
PyG's current HeteroData path is ``torch_geometric.nn.to_hetero``, which
replicates a homogeneous encoder once per edge type. ``SAGEConv((-1, -1), ...)``
is the operator that mapping was designed around: it already supports
bipartite (src, dst) feature pairs, includes a self-term so destination
nodes keep their own features, and does not try to add self-loops onto
manufacturer->distributor edges (``GATConv``'s default ``add_self_loops=True``
raises on those bipartite relations).

SAGEConv cannot consume ``edge_attr``, so quantity / price / timestamp are
(1) stored on the HeteroData as requested and (2) pooled into node features
as mean/std of incident edges -- otherwise burstiness (a *variance* signal)
would be invisible to a 2-layer mean aggregator.

Class imbalance
---------------
~16 anomalous nodes out of 142. Handled with ``BCEWithLogitsLoss`` and
``pos_weight = sqrt(n_neg / n_pos)`` computed on the training mask only.
That up-weights the minority gradient without fabricating extra nodes.
Both classes are split 70/30 (stratified) so validation contains anomalies
the model never trained on. Train and val metrics are reported separately.

Usage
-----
    python model/train_gnn.py
    python model/train_gnn.py --epochs 250 --seed 7
"""

from __future__ import annotations

import argparse
import warnings
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from sklearn.metrics import accuracy_score, average_precision_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from torch import nn
from torch_geometric.data import HeteroData
from torch_geometric.nn import SAGEConv, to_hetero

warnings.filterwarnings(
    "ignore",
    category=FutureWarning,
    module=r"torch\.jit",
)

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
MODEL_DIR = Path(__file__).resolve().parent

NODE_TYPES = ("manufacturer", "distributor", "retailer")
# Forward flow of goods. Reverse relations exist so a 2-layer encoder can
# push downstream price/timing signals *back* onto distributors -- that is
# where the injected anomalies actually live.
REL_FORWARD = "transacts"
REL_REVERSE = "rev_transacts"

EDGE_PAIRS = (
    ("manufacturer", "distributor"),
    ("distributor", "retailer"),
)


# --------------------------------------------------------------------------- #
# Data
# --------------------------------------------------------------------------- #


def _zscore(values: np.ndarray) -> np.ndarray:
    values = values.astype(np.float64)
    std = values.std()
    if std < 1e-8:
        return np.zeros_like(values, dtype=np.float32)
    return ((values - values.mean()) / std).astype(np.float32)


def _one_hot(series: pd.Series, vocabulary: list[str]) -> np.ndarray:
    index = {value: i for i, value in enumerate(vocabulary)}
    out = np.zeros((len(series), len(vocabulary)), dtype=np.float32)
    for row, value in enumerate(series.to_numpy()):
        out[row, index[str(value)]] = 1.0
    return out


def _incident_stats(
    node_ids: list[str],
    edges: pd.DataFrame,
    feat: np.ndarray,
    direction: str,
) -> np.ndarray:
    """Mean and std of (qty, price, timestamp) plus log-degree.

    ``feat`` is an (E, 3) array aligned with ``edges``.
    Returns an (N, 7) array: mean[3], std[3], log1p(degree).
    """
    n = len(node_ids)
    loc = {nid: i for i, nid in enumerate(node_ids)}
    column = "source_id" if direction == "out" else "target_id"
    sums = np.zeros((n, 3), dtype=np.float64)
    sumsq = np.zeros((n, 3), dtype=np.float64)
    counts = np.zeros(n, dtype=np.float64)

    keys = edges[column].to_numpy()
    for e_idx, key in enumerate(keys):
        i = loc.get(key)
        if i is None:
            continue
        row = feat[e_idx]
        sums[i] += row
        sumsq[i] += row * row
        counts[i] += 1.0

    means = np.zeros((n, 3), dtype=np.float32)
    stds = np.zeros((n, 3), dtype=np.float32)
    positive = counts > 0
    means[positive] = (sums[positive] / counts[positive, None]).astype(np.float32)
    variance = np.zeros((n, 3), dtype=np.float64)
    variance[positive] = sumsq[positive] / counts[positive, None] - (
        sums[positive] / counts[positive, None]
    ) ** 2
    stds[positive] = np.sqrt(np.clip(variance[positive], 0.0, None)).astype(np.float32)
    log_deg = np.log1p(counts).astype(np.float32)[:, None]
    return np.concatenate([means, stds, log_deg], axis=1)


def _foreign_share(node_ids: list[str], nodes: pd.DataFrame, edges: pd.DataFrame) -> np.ndarray:
    """Share of *outgoing* edges whose region != the node's declared region."""
    home = dict(zip(nodes["node_id"], nodes["region"].astype(str)))
    loc = {nid: i for i, nid in enumerate(node_ids)}
    foreign = np.zeros(len(node_ids), dtype=np.float64)
    total = np.zeros(len(node_ids), dtype=np.float64)
    for src, region in zip(edges["source_id"].to_numpy(), edges["region"].astype(str)):
        i = loc.get(src)
        if i is None:
            continue
        total[i] += 1.0
        if region != home.get(src, region):
            foreign[i] += 1.0
    share = np.zeros(len(node_ids), dtype=np.float32)
    positive = total > 0
    share[positive] = (foreign[positive] / total[positive]).astype(np.float32)
    return share[:, None]


def _outgoing_price_ratio(
    node_ids: list[str], nodes: pd.DataFrame, edges: pd.DataFrame
) -> np.ndarray:
    """Node mean outgoing price divided by its product-category mean.

    Price anomalies are defined relative to the category baseline, not in
    absolute dollars (electronics vs seeds), so this is the linear feature
    GraphSAGE would otherwise have to rediscover from pooled log-price.
    """
    cat_of = dict(zip(nodes["node_id"].astype(str), nodes["product_category"].astype(str)))
    src = edges["source_id"].astype(str)
    price = edges["price"].to_numpy(dtype=np.float64)
    cat = src.map(cat_of)
    tmp = pd.DataFrame({"src": src, "cat": cat, "price": price})
    cat_mean = tmp.groupby("cat")["price"].mean()
    node_mean = tmp.groupby("src")["price"].mean()
    loc = {nid: i for i, nid in enumerate(node_ids)}
    ratio = np.ones(len(node_ids), dtype=np.float32)
    for nid, mean_p in node_mean.items():
        i = loc.get(str(nid))
        if i is None:
            continue
        denom = float(cat_mean.get(cat_of.get(str(nid)), mean_p)) or 1.0
        ratio[i] = float(mean_p) / denom
    log_ratio = np.log(np.clip(ratio, 1e-3, None))
    # |log ratio| is pre-signed: undercut and inflated both land high.
    return np.stack([_zscore(ratio), _zscore(np.abs(log_ratio))], axis=1)


def _burst_ratio(node_ids: list[str], edges: pd.DataFrame, window_days: int = 14) -> np.ndarray:
    """max 14-day outgoing volume / mean 14-day volume. High = burst timing."""
    loc = {nid: i for i, nid in enumerate(node_ids)}
    ts = pd.to_datetime(edges["timestamp"])
    start = ts.min()
    bin_id = ((ts - start).dt.total_seconds() / (window_days * 86400.0)).astype(int)
    bins_by_node: dict[str, list[int]] = defaultdict(list)
    for src, b in zip(edges["source_id"].astype(str), bin_id.to_numpy()):
        bins_by_node[src].append(int(b))

    out = np.ones(len(node_ids), dtype=np.float32)
    for nid, bins in bins_by_node.items():
        i = loc.get(nid)
        if i is None or not bins:
            continue
        counts = np.array(list(Counter(bins).values()), dtype=np.float64)
        mean = counts.mean()
        out[i] = float(counts.max() / mean) if mean > 0 else 1.0
    return _zscore(out)[:, None]


def load_tables(data_dir: Path) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    nodes = pd.read_csv(data_dir / "nodes.csv")
    edges = pd.read_csv(data_dir / "edges.csv")
    labels = pd.read_csv(data_dir / "anomaly_labels.csv")
    for required in ("node_id", "node_type", "region", "product_category"):
        if required not in nodes.columns:
            raise ValueError(f"nodes.csv missing column {required!r}")
    for required in ("source_id", "target_id", "quantity", "price", "timestamp"):
        if required not in edges.columns:
            raise ValueError(f"edges.csv missing column {required!r}")
    if "node_id" not in labels.columns:
        raise ValueError("anomaly_labels.csv missing column 'node_id'")
    return nodes, edges, labels


def build_hetero_data(
    nodes: pd.DataFrame, edges: pd.DataFrame, labels: pd.DataFrame
) -> tuple[HeteroData, dict[str, list[str]], dict]:
    """Build a HeteroData graph with three node types and transacts edges."""
    anomalous = set(labels["node_id"].astype(str))
    regions = sorted(nodes["region"].astype(str).unique())
    categories = sorted(nodes["product_category"].astype(str).unique())

    edges = edges.copy()
    edges["timestamp"] = pd.to_datetime(edges["timestamp"])
    ts_seconds = edges["timestamp"].to_numpy(dtype="datetime64[s]").astype(np.float64)
    qty = np.log1p(edges["quantity"].to_numpy(dtype=np.float64))
    price = np.log1p(edges["price"].to_numpy(dtype=np.float64))
    edge_feat = np.stack([_zscore(qty), _zscore(price), _zscore(ts_seconds)], axis=1)

    id_maps: dict[str, list[str]] = {}
    id_to_local: dict[str, tuple[str, int]] = {}
    data = HeteroData()

    for ntype in NODE_TYPES:
        sub = nodes[nodes["node_type"] == ntype].reset_index(drop=True)
        ids = sub["node_id"].astype(str).tolist()
        id_maps[ntype] = ids
        for i, nid in enumerate(ids):
            id_to_local[nid] = (ntype, i)

        onehots = np.concatenate(
            [
                _one_hot(sub["region"].astype(str), regions),
                _one_hot(sub["product_category"].astype(str), categories),
            ],
            axis=1,
        )
        outgoing = _incident_stats(ids, edges, edge_feat, "out")
        incoming = _incident_stats(ids, edges, edge_feat, "in")
        foreign = _foreign_share(ids, nodes, edges)
        price_ratio = _outgoing_price_ratio(ids, nodes, edges)
        burst = _burst_ratio(ids, edges)
        x = np.concatenate([onehots, outgoing, incoming, foreign, price_ratio, burst], axis=1)

        y = np.array([1.0 if nid in anomalous else 0.0 for nid in ids], dtype=np.float32)
        data[ntype].x = torch.from_numpy(x)
        data[ntype].y = torch.from_numpy(y)
        data[ntype].n_id = torch.arange(len(ids))

    src_types = edges["source_id"].astype(str).map(lambda i: id_to_local[i][0])
    dst_types = edges["target_id"].astype(str).map(lambda i: id_to_local[i][0])

    for src_type, dst_type in EDGE_PAIRS:
        mask = (src_types == src_type) & (dst_types == dst_type)
        if not mask.any():
            raise RuntimeError(f"no {src_type}->{dst_type} transactions in edges.csv")
        src_idx = [id_to_local[nid][1] for nid in edges.loc[mask, "source_id"].astype(str)]
        dst_idx = [id_to_local[nid][1] for nid in edges.loc[mask, "target_id"].astype(str)]
        edge_index = torch.tensor([src_idx, dst_idx], dtype=torch.long)
        edge_attr = torch.from_numpy(edge_feat[mask.to_numpy()])

        data[src_type, REL_FORWARD, dst_type].edge_index = edge_index
        data[src_type, REL_FORWARD, dst_type].edge_attr = edge_attr
        data[dst_type, REL_REVERSE, src_type].edge_index = edge_index.flip(0).contiguous()
        data[dst_type, REL_REVERSE, src_type].edge_attr = edge_attr

    meta = {
        "regions": regions,
        "categories": categories,
        "in_channels": int(data[NODE_TYPES[0]].x.size(-1)),
        "edge_dim": 3,
        "node_features": (
            "one-hot region, one-hot product_category, "
            "pooled in/out mean+std of (log qty, log price, timestamp), "
            "log in/out degree, outgoing foreign-region share, "
            "category-relative outgoing price ratio, |log price ratio|, "
            "14-day outgoing burst ratio"
        ),
        "encoder": "2-layer GraphSAGE via torch_geometric.nn.to_hetero",
    }
    return data, id_maps, meta


def split_masks(y: np.ndarray, val_size: float, seed: int) -> tuple[np.ndarray, np.ndarray]:
    """Disjoint 70/30 (by default) split of *both* classes, stratified on y.

    Validation therefore contains labeled anomalies the loss never sees.
    """
    indices = np.arange(len(y))
    train_idx, val_idx = train_test_split(
        indices,
        test_size=val_size,
        random_state=seed,
        stratify=y.astype(int),
    )
    train_mask = np.zeros(len(y), dtype=bool)
    val_mask = np.zeros(len(y), dtype=bool)
    train_mask[train_idx] = True
    val_mask[val_idx] = True
    return train_mask, val_mask


def attach_masks(data: HeteroData, id_maps: dict[str, list[str]], seed: int, val_size: float) -> np.ndarray:
    """Write per-type train/val masks. Returns the global label vector order."""
    ordered_y: list[float] = []
    for ntype in NODE_TYPES:
        ordered_y.extend(data[ntype].y.cpu().numpy().tolist())

    y = np.asarray(ordered_y, dtype=np.float32)
    train_mask, val_mask = split_masks(y, val_size=val_size, seed=seed)

    offset = 0
    for ntype in NODE_TYPES:
        n = len(id_maps[ntype])
        data[ntype].train_mask = torch.from_numpy(train_mask[offset : offset + n])
        data[ntype].val_mask = torch.from_numpy(val_mask[offset : offset + n])
        offset += n
    return y


# --------------------------------------------------------------------------- #
# Model
# --------------------------------------------------------------------------- #


class SAGEEncoder(nn.Module):
    """Homogeneous 2-layer GraphSAGE; ``to_hetero`` replicates it per relation.

    Forward is FX-traceable (no lazy module construction) so ``to_hetero`` can
    wrap it. SAGEConv((-1, -1)) already accepts bipartite (src, dst) features.
    """

    def __init__(
        self, in_channels: int, hidden_channels: int, out_channels: int, dropout: float
    ) -> None:
        super().__init__()
        self.lin_in = nn.Linear(in_channels, hidden_channels)
        self.conv1 = SAGEConv((-1, -1), hidden_channels)
        self.conv2 = SAGEConv((-1, -1), out_channels)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        x = self.lin_in(x).relu()
        x = self.conv1(x, edge_index).relu()
        x = self.dropout(x)
        return self.conv2(x, edge_index)


class HeteroSAGEClassifier(nn.Module):
    def __init__(
        self,
        metadata: tuple,
        in_channels: int,
        hidden_channels: int = 48,
        out_channels: int = 32,
        dropout: float = 0.35,
    ) -> None:
        super().__init__()
        encoder = SAGEEncoder(in_channels, hidden_channels, out_channels, dropout)
        self.encoder = to_hetero(encoder, metadata, aggr="mean")
        # Concatenate GNN embedding with the raw node features so category
        # price-ratio / foreign-share / burstiness are not washed out by
        # neighborhood averaging.
        self.head = nn.Linear(out_channels + in_channels, 1)

    def forward(self, data: HeteroData) -> dict[str, torch.Tensor]:
        z_dict = self.encoder(data.x_dict, data.edge_index_dict)
        out: dict[str, torch.Tensor] = {}
        for ntype, emb in z_dict.items():
            out[ntype] = self.head(torch.cat([emb, data[ntype].x], dim=-1)).squeeze(-1)
        return out


def stack_logits(logit_dict: dict[str, torch.Tensor]) -> torch.Tensor:
    return torch.cat([logit_dict[ntype] for ntype in NODE_TYPES], dim=0)


def stack_attr(data: HeteroData, attr: str) -> torch.Tensor:
    return torch.cat([data[ntype][attr] for ntype in NODE_TYPES], dim=0)


# --------------------------------------------------------------------------- #
# Train / eval
# --------------------------------------------------------------------------- #


@torch.no_grad()
def predict_proba(model: nn.Module, data: HeteroData) -> torch.Tensor:
    model.eval()
    logits = stack_logits(model(data))
    return torch.sigmoid(logits)


def masked_metrics(y_true: np.ndarray, scores: np.ndarray, mask: np.ndarray, threshold: float = 0.5) -> dict[str, float]:
    if mask.sum() == 0:
        return {"accuracy": 0.0, "precision": 0.0, "recall": 0.0}
    y = y_true[mask].astype(int)
    pred = (scores[mask] >= threshold).astype(int)
    return {
        "accuracy": float(accuracy_score(y, pred)),
        "precision": float(precision_score(y, pred, zero_division=0)),
        "recall": float(recall_score(y, pred, zero_division=0)),
    }


def train(args: argparse.Namespace) -> None:
    rng_seed = args.seed
    torch.manual_seed(rng_seed)
    np.random.seed(rng_seed)

    device = torch.device("cpu" if args.cpu or not torch.cuda.is_available() else "cuda")
    nodes, edges, labels = load_tables(Path(args.data_dir))
    data, id_maps, meta = build_hetero_data(nodes, edges, labels)
    attach_masks(data, id_maps, seed=rng_seed, val_size=args.val_size)
    data = data.to(device)

    model = HeteroSAGEClassifier(
        metadata=data.metadata(),
        in_channels=meta["in_channels"],
        hidden_channels=args.hidden,
        out_channels=args.emb_dim,
        dropout=args.dropout,
    ).to(device)

    y = stack_attr(data, "y")
    train_mask = stack_attr(data, "train_mask")
    val_mask = stack_attr(data, "val_mask")

    n_pos = y[train_mask].sum().clamp(min=1.0)
    n_neg = (train_mask.sum() - n_pos).clamp(min=1.0)
    # sqrt inverse-frequency: full n_neg/n_pos over-flagged distributors.
    pos_weight = (n_neg / n_pos).sqrt().to(device)
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)

    known = labels["node_id"].astype(str).tolist()
    ordered_ids = [nid for ntype in NODE_TYPES for nid in id_maps[ntype]]

    n_labeled = int((y >= 0.5).sum().item())
    n_train_pos = int(n_pos.item())
    n_val_pos = int(y[val_mask].sum().item())
    print("Encoder: 2-layer GraphSAGE wrapped with to_hetero (mean over relations)")
    print("  reason: SAGEConv((-1, -1)) is the HeteroData-native bipartite conv;")
    print("  GATConv's default self-loops fail on manufacturer->distributor edges.")
    print("Imbalance: sqrt(n_neg/n_pos) class-weighted BCE on the train mask")
    print(
        f"  stratified {1.0 - args.val_size:.0%}/{args.val_size:.0%} split  train={int(train_mask.sum())} "
        f"({n_train_pos} pos)  val={int(val_mask.sum())} ({n_val_pos} pos held out)"
    )
    print(f"  labeled anomalies={n_labeled}  pos_weight={float(pos_weight):.2f}")
    print(f"  graph: { {ntype: int(data[ntype].num_nodes) for ntype in NODE_TYPES} }")
    print(f"  device={device}  epochs={args.epochs}  seed={rng_seed}")

    best_state = None
    best_key = None
    best_epoch = 0
    best_val_ap = -1.0
    min_ckpt = args.min_ckpt_epoch

    for epoch in range(1, args.epochs + 1):
        model.train()
        optimizer.zero_grad()
        logits = stack_logits(model(data))
        loss = criterion(logits[train_mask], y[train_mask])
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), max_norm=2.0)
        optimizer.step()

        scores = predict_proba(model, data).cpu().numpy()
        y_np = y.detach().cpu().numpy()
        train_np = train_mask.cpu().numpy()
        val_np = val_mask.cpu().numpy()
        train_m = masked_metrics(y_np, scores, train_np)
        val_m = masked_metrics(y_np, scores, val_np)
        try:
            val_ap = float(average_precision_score(y_np[val_np], scores[val_np]))
        except ValueError:
            val_ap = 0.0
        val_f1_den = val_m["precision"] + val_m["recall"]
        val_f1 = (
            0.0
            if val_f1_den == 0
            else 2 * val_m["precision"] * val_m["recall"] / val_f1_den
        )
        n_val_caught = int(((scores >= 0.5) & (y_np >= 0.5) & val_np).sum())
        n_val_fp = int(((scores >= 0.5) & (y_np < 0.5) & val_np).sum())
        # Checkpoint on held-out val only -- never on train catch rate.
        key = (val_f1, val_ap, val_m["recall"], -n_val_fp)
        if epoch >= min_ckpt and (best_key is None or key > best_key):
            best_key = key
            best_val_ap = val_ap
            best_epoch = epoch
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}

        if epoch % args.log_every == 0 or epoch == args.epochs:
            print(
                f"epoch {epoch:03d}  loss={loss.item():.4f}  "
                f"train rec={train_m['recall']:.3f}  "
                f"val acc={val_m['accuracy']:.3f}  "
                f"prec={val_m['precision']:.3f}  rec={val_m['recall']:.3f}  "
                f"val_caught={n_val_caught}/{n_val_pos}  val_fp={n_val_fp}"
            )

    if best_state is not None:
        model.load_state_dict(best_state)

    scores = predict_proba(model, data).cpu().numpy()
    y_np = y.detach().cpu().numpy()
    train_np = train_mask.cpu().numpy()
    val_np = val_mask.cpu().numpy()
    train_m = masked_metrics(y_np, scores, train_np)
    val_m = masked_metrics(y_np, scores, val_np)
    try:
        val_ap = float(average_precision_score(y_np[val_np], scores[val_np]))
    except ValueError:
        val_ap = 0.0
    best_val_ap = val_ap

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    pred_path = MODEL_DIR / "predictions.csv"
    pd.DataFrame({"id": ordered_ids, "risk_score": scores.astype(np.float64)}).to_csv(
        pred_path, index=False
    )

    ckpt_path = MODEL_DIR / "checkpoint.pt"
    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "id_maps": id_maps,
            "meta": meta,
            "args": vars(args),
            "pos_weight": float(pos_weight.detach().cpu()),
            "best_epoch": best_epoch,
            "val_metrics": val_m,
            "train_metrics": train_m,
            "val_ap": best_val_ap,
        },
        ckpt_path,
    )

    threshold = 0.5
    flagged = scores >= threshold
    y_bool = y_np >= 0.5
    id_to_score = dict(zip(ordered_ids, scores))
    id_to_split = {
        nid: ("train" if t else "val")
        for nid, t, v in zip(ordered_ids, train_np, val_np)
        if t or v
    }
    type_of = dict(zip(labels["node_id"].astype(str), labels["anomaly_type"].astype(str)))

    train_anoms = [nid for nid in known if id_to_split.get(nid) == "train"]
    val_anoms = [nid for nid in known if id_to_split.get(nid) == "val"]
    train_caught = [nid for nid in train_anoms if id_to_score[nid] >= threshold]
    val_caught = [nid for nid in val_anoms if id_to_score[nid] >= threshold]
    train_missed = [nid for nid in train_anoms if id_to_score[nid] < threshold]
    val_missed = [nid for nid in val_anoms if id_to_score[nid] < threshold]
    val_fp = [
        nid
        for nid, flag, label, on_val in zip(ordered_ids, flagged, y_bool, val_np)
        if flag and not label and on_val
    ]
    train_fp = [
        nid
        for nid, flag, label, on_train in zip(ordered_ids, flagged, y_bool, train_np)
        if flag and not label and on_train
    ]

    print(f"\n=== train set ({int(train_np.sum())} nodes, {len(train_anoms)} anomalies, threshold 0.5) ===")
    print(f"accuracy  {train_m['accuracy']:.4f}")
    print(f"precision {train_m['precision']:.4f}")
    print(f"recall    {train_m['recall']:.4f}")
    print(
        f"caught {len(train_caught)} / {len(train_anoms)} training anomalies; "
        f"{len(train_fp)} train false positive(s)."
    )
    if train_missed:
        print(f"  missed train: {', '.join(train_missed)}")

    print(
        f"\n=== validation set ({int(val_np.sum())} held-out nodes, "
        f"{len(val_anoms)} anomalies never in the loss, threshold 0.5) ==="
    )
    print(f"accuracy  {val_m['accuracy']:.4f}")
    print(f"precision {val_m['precision']:.4f}")
    print(f"recall    {val_m['recall']:.4f}")
    print(f"(best checkpoint from epoch {best_epoch}, val PR-AUC={best_val_ap:.3f})")
    print(
        f"caught {len(val_caught)} / {len(val_anoms)} held-out anomalies; "
        f"{len(val_fp)} val false positive(s)."
    )
    print("held-out anomalies:")
    for nid in val_anoms:
        mark = "FLAGGED" if nid in val_caught else "missed"
        print(f"  {nid}  {type_of.get(nid, '?'):<16}  risk={id_to_score[nid]:.4f}  {mark}")
    if val_missed:
        print(f"Missed val: {', '.join(val_missed)}")
    if val_fp:
        preview = ", ".join(val_fp[:12])
        extra = "" if len(val_fp) <= 12 else f" ... +{len(val_fp) - 12} more"
        print(f"Val false positives: {preview}{extra}")

    print("\n=== all labeled anomalies ===")
    for nid in known:
        split = id_to_split.get(nid, "?")
        mark = "FLAGGED" if id_to_score[nid] >= threshold else "missed"
        print(
            f"  {nid}  {split:<5}  {type_of.get(nid, '?'):<16}  "
            f"risk={id_to_score[nid]:.4f}  {mark}"
        )

    print("\n=== summary ===")
    print(
        f"Held-out val: flagged {len(val_caught)} / {len(val_anoms)} anomalies, "
        f"{len(val_fp)} false positive(s).  "
        f"Train (for comparison): flagged {len(train_caught)} / {len(train_anoms)}, "
        f"{len(train_fp)} FP(s)."
    )
    print(f"Wrote {pred_path.relative_to(ROOT)}")
    print(f"Wrote {ckpt_path.relative_to(ROOT)}")
    print(
        "Imbalance handling: class-weighted BCE "
        f"(pos_weight={float(pos_weight):.1f} = sqrt(train_neg/train_pos)). "
        "No oversampling -- the full graph is one batch."
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the CounterfeitTrace Hetero-SAGE classifier.")
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR)
    parser.add_argument("--epochs", type=int, default=200)
    parser.add_argument("--lr", type=float, default=5e-3)
    parser.add_argument("--weight-decay", type=float, default=1e-3)
    parser.add_argument("--hidden", type=int, default=48)
    parser.add_argument("--emb-dim", type=int, default=32)
    parser.add_argument("--dropout", type=float, default=0.35)
    parser.add_argument("--val-size", type=float, default=0.3)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--log-every", type=int, default=20)
    parser.add_argument("--min-ckpt-epoch", type=int, default=20)
    parser.add_argument("--cpu", action="store_true", help="Force CPU even if CUDA is available.")
    return parser.parse_args()


if __name__ == "__main__":
    train(parse_args())

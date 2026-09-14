import Papa from 'papaparse'
import { useEffect, useState } from 'react'

/**
 * Loads the transaction graph for the 3D scene.
 *
 * CSVs are copied into `public/data/` by `scripts/sync-data.js` (nodes, edges,
 * and model/predictions.csv). When Supabase is wired up later, only this hook
 * changes — the shape it returns is the contract the scene depends on.
 */

const NODES_URL = '/data/nodes.csv'
const EDGES_URL = '/data/edges.csv'
const PRED_URL = '/data/predictions.csv'

const PARSE_OPTIONS = { header: true, dynamicTyping: true, skipEmptyLines: true }

/** Binary flag threshold used in model/train_gnn.py. */
export const FLAG_THRESHOLD = 0.5

async function fetchCsv(url, signal) {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Failed to load ${url} (HTTP ${response.status}). Is it in frontend/public/data/?`)
  }

  const { data, errors } = Papa.parse(await response.text(), PARSE_OPTIONS)
  return { rows: data, errors, missing: false }
}

async function fetchCsvOptional(url, signal) {
  try {
    return await fetchCsv(url, signal)
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    return { rows: [], errors: [], missing: true, error }
  }
}

/** `2025-01-01 01:35:15` → Date. Papaparse leaves it as a string; V8-only
 *  parsing of the space-separated form is avoided by swapping in the `T`. */
function parseTimestamp(value) {
  if (!value) return null
  const date = new Date(String(value).replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? null : date
}

function toScore(value) {
  const score = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(score) ? score : null
}

/** Colour-coded pill band. Flagged matches the model's 0.5 decision threshold. */
export function riskBandFor(score) {
  if (score == null) return null
  if (score >= FLAG_THRESHOLD) return 'flagged'
  if (score >= 0.35) return 'high'
  if (score >= 0.15) return 'medium'
  return 'low'
}

/**
 * @returns {{nodes: Array, edges: Array, status: 'loading'|'ready'|'error',
 *            error: Error|null, stats: object, warnings: string[]}}
 *   nodes: `{ id, type, region, product, riskScore, isFlagged, riskBand, index }`
 *   edges: `{ id, source, target, sourceIndex, targetIndex, quantity, price,
 *   timestamp, region, product }`.
 */
export function useGraphData() {
  const [state, setState] = useState({
    nodes: [],
    edges: [],
    status: 'loading',
    error: null,
    stats: null,
    warnings: [],
  })

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    async function load() {
      const [nodesCsv, edgesCsv, predCsv] = await Promise.all([
        fetchCsv(NODES_URL, controller.signal),
        fetchCsv(EDGES_URL, controller.signal),
        fetchCsvOptional(PRED_URL, controller.signal),
      ])

      const warnings = []

      const scoreById = new Map()
      if (predCsv.missing) {
        warnings.push('predictions.csv missing — nodes coloured by type until the model is trained.')
      } else {
        for (const row of predCsv.rows) {
          const id = row.id != null ? String(row.id) : ''
          const score = toScore(row.risk_score)
          if (!id || score == null) continue
          scoreById.set(id, score)
        }
      }

      // ---- nodes ---------------------------------------------------------
      const nodes = []
      const indexById = new Map()
      let droppedNodes = 0

      for (const row of nodesCsv.rows) {
        if (!row.node_id || !row.node_type) {
          droppedNodes += 1
          continue
        }
        if (indexById.has(row.node_id)) {
          droppedNodes += 1
          continue
        }

        const id = String(row.node_id)
        const riskScore = scoreById.has(id) ? scoreById.get(id) : null
        const isFlagged = riskScore != null && riskScore >= FLAG_THRESHOLD

        indexById.set(id, nodes.length)
        nodes.push({
          id,
          type: row.node_type,
          region: row.region || 'unknown',
          product: row.product_category || null,
          riskScore,
          isFlagged,
          riskBand: riskBandFor(riskScore),
          index: nodes.length,
        })
      }

      // ---- edges ---------------------------------------------------------
      const edges = []
      let danglingEdges = 0

      for (const row of edgesCsv.rows) {
        const sourceIndex = indexById.get(row.source_id)
        const targetIndex = indexById.get(row.target_id)

        if (sourceIndex === undefined || targetIndex === undefined) {
          danglingEdges += 1
          continue
        }

        edges.push({
          id: row.txn_id,
          source: row.source_id,
          target: row.target_id,
          sourceIndex,
          targetIndex,
          quantity: row.quantity,
          price: row.price,
          timestamp: parseTimestamp(row.timestamp),
          region: row.region,
          product: row.product_category,
        })
      }

      // ---- report --------------------------------------------------------
      if (droppedNodes > 0) warnings.push(`${droppedNodes} node row(s) skipped (missing id/type or duplicate).`)
      if (danglingEdges > 0) warnings.push(`${danglingEdges} edge row(s) skipped (endpoint missing from nodes.csv).`)
      const parseErrors =
        nodesCsv.errors.length + edgesCsv.errors.length + (predCsv.errors?.length || 0)
      if (parseErrors > 0) warnings.push(`${parseErrors} CSV row(s) failed to parse.`)
      if (!predCsv.missing && scoreById.size === 0) {
        warnings.push('predictions.csv loaded but no scores joined — check the id column.')
      }

      const byType = {}
      for (const node of nodes) byType[node.type] = (byType[node.type] || 0) + 1

      const regions = [...new Set(nodes.map((node) => node.region))].sort()
      const flagged = nodes.filter((node) => node.isFlagged).length
      const scored = nodes.filter((node) => node.riskScore != null).length

      if (cancelled) return

      setState({
        nodes,
        edges,
        status: 'ready',
        error: null,
        stats: { nodes: nodes.length, edges: edges.length, byType, regions, flagged, scored },
        warnings,
      })
    }

    load().catch((error) => {
      if (cancelled || error.name === 'AbortError') return
      setState((previous) => ({ ...previous, status: 'error', error }))
    })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  return state
}

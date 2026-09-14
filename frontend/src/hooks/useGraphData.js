import Papa from 'papaparse'
import { useEffect, useState } from 'react'

/**
 * Loads the transaction graph for the 3D scene.
 *
 * For now the CSVs are copied into `public/data/` by the data step and fetched
 * as static assets, so the graph renders the real synthetic dataset with no
 * backend running. When Supabase is wired up in a later step, only this hook
 * changes — the shape it returns is the contract the scene depends on.
 */

const NODES_URL = '/data/nodes.csv'
const EDGES_URL = '/data/edges.csv'

const PARSE_OPTIONS = { header: true, dynamicTyping: true, skipEmptyLines: true }

async function fetchCsv(url, signal) {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Failed to load ${url} (HTTP ${response.status}). Is it in frontend/public/data/?`)
  }

  const { data, errors } = Papa.parse(await response.text(), PARSE_OPTIONS)
  return { rows: data, errors }
}

/** `2025-01-01 01:35:15` → Date. Papaparse leaves it as a string; V8-only
 *  parsing of the space-separated form is avoided by swapping in the `T`. */
function parseTimestamp(value) {
  if (!value) return null
  const date = new Date(String(value).replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * @returns {{nodes: Array, edges: Array, status: 'loading'|'ready'|'error',
 *            error: Error|null, stats: object, warnings: string[]}}
 *   nodes: `{ id, type, region, product, riskScore, index }` — `index` is the
 *   scene's array position, referenced by edges as sourceIndex/targetIndex.
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
      const [nodesCsv, edgesCsv] = await Promise.all([
        fetchCsv(NODES_URL, controller.signal),
        fetchCsv(EDGES_URL, controller.signal),
      ])

      const warnings = []

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

        indexById.set(row.node_id, nodes.length)
        nodes.push({
          id: row.node_id,
          type: row.node_type,
          region: row.region || 'unknown',
          product: row.product_category || null,
          riskScore: null, // filled in once the GNN produces scores
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
          danglingEdges += 1 // endpoint not in nodes.csv — cannot draw it
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
      if (nodesCsv.errors.length > 0 || edgesCsv.errors.length > 0) {
        warnings.push(`${nodesCsv.errors.length + edgesCsv.errors.length} CSV row(s) failed to parse.`)
      }

      const byType = {}
      for (const node of nodes) byType[node.type] = (byType[node.type] || 0) + 1

      const regions = [...new Set(nodes.map((node) => node.region))].sort()

      setState({
        nodes,
        edges,
        status: 'ready',
        error: null,
        stats: { nodes: nodes.length, edges: edges.length, byType, regions },
        warnings,
      })
    }

    load().catch((error) => {
      if (cancelled || error.name === 'AbortError') return
      setState((previous) => ({ ...previous, status: 'error', error }))
    })

    // StrictMode mounts twice in dev — abort the first pass instead of letting
    // two fetches race, and never set state after unmount.
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  return state
}

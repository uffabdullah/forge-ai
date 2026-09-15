/**
 * StatsPanel — dataset counters for the inspector.
 *
 * Skiper UI / Unlumen-style metric strip. Precision is optional (the GNN
 * reports it at train time; it is not in predictions.csv).
 */

const number = (value) => (value == null ? '—' : Number(value).toLocaleString('en-US'))

const formatPrecision = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `${(Number(value) * 100).toFixed(0)}%`
}

export default function StatsPanel({ nodes, edges, flagged, precision }) {
  const cells = [
    { label: 'nodes', value: number(nodes) },
    { label: 'txns', value: number(edges) },
    { label: 'flagged', value: number(flagged) },
    { label: 'precision', value: formatPrecision(precision) },
  ]

  return (
    <section className="pointer-events-auto border border-white/10 bg-ink-900/40 p-3 backdrop-blur-xl">
      <h2 className="mb-2 px-1 font-display text-[10px] tracking-[0.28em] text-slate-500 uppercase">
        network
      </h2>
      <dl className="grid grid-cols-2 gap-px overflow-hidden bg-white/10 sm:grid-cols-4">
        {cells.map(({ label, value }) => (
          <div key={label} className="bg-ink-900/70 px-3 py-3">
            <dd className="font-display text-lg text-white">{value}</dd>
            <dt className="mt-0.5 text-[10px] tracking-wider text-slate-500 uppercase">{label}</dt>
          </div>
        ))}
      </dl>
    </section>
  )
}

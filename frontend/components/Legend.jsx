/**
 * Legend — colour key for node types and risk bands.
 *
 * Skiper UI / Unlumen-style key: dots + labels, Tailwind tokens only so it
 * stays in lockstep with the canvas palette.
 */

const TYPES = [
  { id: 'manufacturer', label: 'manufacturer', swatch: 'bg-node-manufacturer' },
  { id: 'distributor', label: 'distributor', swatch: 'bg-node-distributor' },
  { id: 'retailer', label: 'retailer', swatch: 'bg-node-retailer' },
]

const BANDS = [
  { id: 'low', label: 'low', swatch: 'bg-risk-low' },
  { id: 'medium', label: 'medium', swatch: 'bg-risk-medium' },
  { id: 'high', label: 'high', swatch: 'bg-risk-high' },
  { id: 'flagged', label: 'flagged ≥ 0.5', swatch: 'bg-risk-flagged' },
]

function Row({ swatch, label }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${swatch}`} />
      <span>{label}</span>
    </li>
  )
}

export default function Legend() {
  return (
    <section className="pointer-events-auto rounded-2xl border border-white/10 bg-ink-800/60 p-4 shadow-[0_12px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <h2 className="font-mono text-[10px] tracking-[0.22em] text-slate-500 uppercase">legend</h2>
      <div className="mt-3 grid grid-cols-2 gap-4 text-[11px] text-slate-400">
        <ul className="space-y-1.5">
          {TYPES.map((row) => (
            <Row key={row.id} {...row} />
          ))}
        </ul>
        <ul className="space-y-1.5">
          {BANDS.map((row) => (
            <Row key={row.id} {...row} />
          ))}
        </ul>
      </div>
    </section>
  )
}

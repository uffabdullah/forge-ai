/**
 * Legend — colour key. Hairline, no heavy card chrome.
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
      <span className={`h-1.5 w-1.5 ${swatch}`} />
      <span>{label}</span>
    </li>
  )
}

export default function Legend() {
  return (
    <section className="pointer-events-auto">
      <h2 className="font-display text-[10px] tracking-[0.28em] text-slate-500 uppercase">legend</h2>
      <div className="mt-3 grid grid-cols-2 gap-6 text-[10px] tracking-[0.12em] text-slate-400 uppercase">
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

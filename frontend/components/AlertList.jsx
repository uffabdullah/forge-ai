/**
 * AlertList — ranked highest-risk distributors; click focuses the 3D node.
 *
 * Skiper UI / Unlumen-style list: dense rows, mono IDs, no Three.js.
 * Emits `onSelect(nodeId)`.
 */
import RiskBadge from '@components/RiskBadge.jsx'

export default function AlertList({
  nodes = [],
  selectedId = null,
  onSelect,
  listClassName = 'max-h-[min(52vh,28rem)]',
}) {
  const ranked = [...nodes]
    .filter((node) => node.type === 'distributor' && node.riskScore != null)
    .sort((a, b) => Number(b.riskScore) - Number(a.riskScore) || Number(b.isFlagged) - Number(a.isFlagged))
    .slice(0, 16)

  return (
    <section className="pointer-events-auto rounded-2xl border border-white/10 bg-ink-800/60 p-3 shadow-[0_12px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <header className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="font-mono text-[10px] tracking-[0.22em] text-slate-500 uppercase">alerts</h2>
        <span className="font-mono text-[10px] text-slate-600">{ranked.filter((n) => n.isFlagged).length} flagged</span>
      </header>

      {ranked.length === 0 ? (
        <p className="px-1 py-3 text-xs text-slate-500">No risk scores yet.</p>
      ) : (
        <ol className={`space-y-0.5 overflow-y-auto pr-1 ${listClassName}`}>
          {ranked.map((node, index) => {
            const active = node.id === selectedId
            return (
              <li key={node.id}>
                <button
                  type="button"
                  onClick={() => onSelect?.(node.id)}
                  className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition ${
                    active ? 'bg-white/10 ring-1 ring-white/15' : 'hover:bg-white/5'
                  }`}
                >
                  <span className="w-4 font-mono text-[10px] text-slate-600">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-xs text-white">{node.id}</span>
                    <span className="block truncate text-[10px] text-slate-500">
                      {node.region} · {node.product}
                    </span>
                  </span>
                  <RiskBadge band={node.riskBand} score={node.riskScore} />
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

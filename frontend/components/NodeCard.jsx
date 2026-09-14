/**
 * NodeCard — detail panel for a clicked graph node.
 *
 * Skiper UI / Unlumen-style glass inspector: ink surface, tight type, no
 * Three.js. Data in via `node` + `signals`; close via `onClose`.
 */
import RiskBadge from '@components/RiskBadge.jsx'

const TYPE_TEXT = {
  manufacturer: 'text-node-manufacturer',
  distributor: 'text-node-distributor',
  retailer: 'text-node-retailer',
}

export default function NodeCard({ node, signals = [], onClose }) {
  if (!node) return null

  return (
    <article className="pointer-events-auto rounded-2xl border border-white/10 bg-ink-800/60 p-4 shadow-[0_12px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.22em] text-slate-500 uppercase">node</p>
          <h2 className="mt-1 font-mono text-lg text-white">{node.id}</h2>
        </div>
        <div className="flex items-center gap-2">
          <RiskBadge band={node.riskBand} score={node.riskScore} />
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-2 py-0.5 font-mono text-[11px] text-slate-500 ring-1 ring-white/10 hover:text-white"
            >
              esc
            </button>
          )}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-slate-500 uppercase tracking-wider">type</dt>
          <dd className={`mt-0.5 font-medium ${TYPE_TEXT[node.type] || 'text-slate-200'}`}>{node.type}</dd>
        </div>
        <div>
          <dt className="text-slate-500 uppercase tracking-wider">region</dt>
          <dd className="mt-0.5 text-slate-200">{node.region}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-slate-500 uppercase tracking-wider">product line</dt>
          <dd className="mt-0.5 text-slate-200">{node.product || '—'}</dd>
        </div>
      </dl>

      {signals.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-white/5 pt-3">
          {signals.map((signal) => (
            <li key={signal} className="flex gap-2 text-xs text-slate-400">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-risk-flagged/80" />
              {signal}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

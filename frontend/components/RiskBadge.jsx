/**
 * RiskBadge — colour-coded score pill.
 *
 * Skiper UI / Unlumen-style chip: quiet glass, one accent colour, no chrome.
 * Copied as source (Tailwind only) rather than pulled in as a package.
 */
const STYLES = {
  low: 'bg-risk-low/15 text-risk-low ring-risk-low/30',
  medium: 'bg-risk-medium/15 text-risk-medium ring-risk-medium/30',
  high: 'bg-risk-high/15 text-risk-high ring-risk-high/30',
  flagged: 'bg-risk-flagged/20 text-risk-flagged ring-risk-flagged/40',
}

const LABELS = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  flagged: 'flagged',
}

export default function RiskBadge({ band, score, className = '' }) {
  const tone = STYLES[band] ? band : 'low'
  const label =
    score != null && Number.isFinite(Number(score))
      ? Number(score).toFixed(2)
      : LABELS[tone]

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] tracking-wide ring-1 ${STYLES[tone]} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABELS[tone]}
      {score != null && Number.isFinite(Number(score)) ? ` · ${label}` : null}
    </span>
  )
}

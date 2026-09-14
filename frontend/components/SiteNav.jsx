/**
 * SiteNav — sticky product nav.
 *
 * Skiper UI / Unlumen-style: hairline glass bar, mono wordmark, text links.
 * Jumps go through Lenis (`onJump`) so we never fight the existing smooth scroll.
 */
const LINKS = [
  { id: 'network', label: 'Network' },
  { id: 'signatures', label: 'Signatures' },
  { id: 'model', label: 'Model' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'investigate', label: 'Investigate' },
]

export default function SiteNav({ onJump, onAlerts, flagged = null }) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40">
      <nav className="pointer-events-auto mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => onJump('hero')}
          className="rounded-full border border-white/10 bg-ink-800/70 px-3 py-1.5 font-mono text-[11px] tracking-[0.22em] text-white uppercase backdrop-blur-xl"
        >
          CounterfeitTrace
        </button>

        <ul className="hidden items-center gap-1 rounded-full border border-white/10 bg-ink-800/70 p-1 backdrop-blur-xl md:flex">
          {LINKS.map((link) => (
            <li key={link.id}>
              <button
                type="button"
                onClick={() => onJump(link.id)}
                className="whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] text-slate-400 transition hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => (onAlerts ? onAlerts() : onJump('workspace'))}
          className="rounded-full border border-risk-flagged/30 bg-ink-800/70 px-3 py-1.5 font-mono text-[11px] text-risk-flagged backdrop-blur-xl"
        >
          {flagged == null ? 'Alerts' : `${flagged} flagged`}
        </button>
      </nav>
    </header>
  )
}

/**
 * SiteNav — Hubtown-style cinematic chrome.
 * Wordmark left, text links + pills right. Jumps go through Lenis.
 */
const LINKS = [
  { id: 'network', label: 'Network' },
  { id: 'signatures', label: 'Signatures' },
  { id: 'model', label: 'Model' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'investigate', label: 'Investigate' },
]

export default function SiteNav({ onJump, onAlerts, flagged = null, onMenu }) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-[52]">
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-ink-900 via-ink-900/75 to-transparent" />
      <nav className="relative pointer-events-auto mx-auto flex items-center justify-between gap-4 px-8 py-6 sm:px-12">
        <button
          type="button"
          onClick={() => onJump('hero')}
          className="font-display text-[11px] font-medium tracking-[0.22em] text-white uppercase sm:text-[13px] sm:tracking-[0.42em]"
        >
          CounterfeitTrace
        </button>

        <div className="flex items-center gap-5">
          <ul className="hidden items-center gap-5 md:flex">
            {LINKS.map((link) => (
              <li key={link.id}>
                <button
                  type="button"
                  onClick={() => onJump(link.id)}
                  className="text-[11px] tracking-[0.18em] text-slate-400 uppercase transition hover:text-white"
                >
                  {link.label}
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => (onAlerts ? onAlerts() : onJump('workspace'))}
            className="hidden rounded-full border border-white/15 bg-ink-900/70 px-4 py-2 font-display text-[11px] tracking-[0.18em] text-white uppercase backdrop-blur-md md:inline-flex"
          >
            {flagged == null ? 'Alerts' : `${flagged} flagged`}
          </button>

          <button
            type="button"
            onClick={() => (onMenu ? onMenu() : onJump('investigate'))}
            data-sound="modal"
            className="flex items-center gap-2 rounded-full bg-slate-200 px-4 py-2 font-display text-[11px] tracking-[0.18em] text-ink-950 uppercase"
          >
            <span aria-hidden className="grid grid-cols-2 gap-0.5">
              <span className="h-1 w-1 bg-ink-950" />
              <span className="h-1 w-1 bg-ink-950" />
              <span className="h-1 w-1 bg-ink-950" />
              <span className="h-1 w-1 bg-ink-950" />
            </span>
            Menu
          </button>
        </div>
      </nav>
    </header>
  )
}

/**
 * SiteNav — Hubtown-style cinematic chrome.
 * Wordmark left, text links + pills right. Jumps go through Lenis.
 * Rendered via a portal so a parent transform cannot trap `position: fixed`.
 */
const LINKS = [
  { id: 'network', label: 'Network' },
  { id: 'signatures', label: 'Signatures' },
  { id: 'model', label: 'Model' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'investigate', label: 'Investigate' },
]

export default function SiteNav({
  onJump,
  onAlerts,
  flagged = null,
  onMenu,
  revealed = true,
}) {
  return (
    <header
      className={`fixed inset-x-0 top-0 z-[80] transition-opacity duration-500 ${
        revealed ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-ink-900 via-ink-900/70 to-transparent" />
      <nav className="relative mx-auto flex items-center justify-between gap-4 px-8 py-6 sm:px-12">
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

/**
 * SideRail — Hubtown-style left chapter list over the 3D stage.
 */
const ITEMS = [
  { id: 'network', label: 'Network' },
  { id: 'signatures', label: 'Signatures' },
  { id: 'model', label: 'Model' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'investigate', label: 'Investigate' },
]

export default function SideRail({ activeId = 'network', onJump, visible = true }) {
  return (
    <nav
      aria-label="Chapters"
      className={`pointer-events-none fixed top-1/2 left-7 z-40 hidden -translate-y-1/2 transition-opacity duration-500 md:block ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <ul className="pointer-events-auto space-y-3">
        {ITEMS.map((item) => {
          const active = item.id === activeId
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onJump?.(item.id)}
                className={`flex items-center gap-2 text-left font-display text-[10px] tracking-[0.28em] uppercase transition ${
                  active ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 ${active ? 'bg-white' : 'bg-transparent'}`}
                />
                {item.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

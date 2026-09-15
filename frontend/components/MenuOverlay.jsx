/**
 * MenuOverlay — full-viewport chapter menu, Hubtown MENU pill target.
 */
const ITEMS = [
  { id: 'hero', label: 'Stage' },
  { id: 'network', label: 'Network' },
  { id: 'signatures', label: 'Signatures' },
  { id: 'model', label: 'Model' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'investigate', label: 'Investigate' },
  { id: 'credits', label: 'Credits' },
]

export default function MenuOverlay({ open, onClose, onJump }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-ink-950/80 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative mx-auto flex h-full max-w-5xl flex-col justify-center px-8">
        <p className="font-display text-[11px] tracking-[0.4em] text-slate-500 uppercase">
          Menu
        </p>
        <ul className="mt-8 space-y-3">
          {ITEMS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  onJump(item.id)
                  onClose()
                }}
                className="font-display text-3xl tracking-[0.12em] text-white uppercase transition hover:text-slate-300 sm:text-5xl"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

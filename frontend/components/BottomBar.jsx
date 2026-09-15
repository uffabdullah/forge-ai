/**
 * BottomBar — Hubtown-style status strip: sound toggle + agent.
 */
export default function BottomBar({ onAsk, onToggleSound, soundOn = false, visible = true }) {
  return (
    <div
      className={`pointer-events-none fixed inset-x-5 bottom-5 z-40 hidden items-end justify-between transition-opacity duration-500 md:flex sm:inset-x-8 sm:bottom-7 ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <button
        type="button"
        onClick={onToggleSound}
        className="pointer-events-auto flex items-center gap-2 bg-black/45 px-4 py-2 font-display text-[10px] tracking-[0.32em] text-white uppercase"
      >
        <span aria-hidden className={`inline-block h-1.5 w-1.5 ${soundOn ? 'bg-white' : 'bg-white/35'}`} />
        {soundOn ? 'Sound on' : 'Sound off'}
      </button>
      <button
        type="button"
        onClick={onAsk}
        className="pointer-events-auto px-3 py-2 font-display text-[10px] tracking-[0.32em] text-slate-300 uppercase transition hover:text-white"
      >
        Ask the agent
      </button>
    </div>
  )
}

/**
 * IntroGate — Hubtown-style entrance: wordmark, load line, then the world opens.
 */
import { useEffect, useState } from 'react'

export default function IntroGate({ ready = false, onEnter, onPrime }) {
  const [progress, setProgress] = useState(8)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce && ready) {
      onEnter?.()
      return undefined
    }

    const id = window.setInterval(() => {
      setProgress((value) => {
        if (ready) return Math.min(100, value + 7)
        return Math.min(72, value + 1.4)
      })
    }, 48)

    return () => window.clearInterval(id)
  }, [ready])

  useEffect(() => {
    if (!ready || progress < 100 || leaving) return undefined
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      onEnter?.()
      return undefined
    }
    const hold = window.setTimeout(() => setLeaving(true), 280)
    return () => window.clearTimeout(hold)
  }, [leaving, onEnter, progress, ready])

  useEffect(() => {
    if (!leaving) return undefined
    const done = window.setTimeout(() => onEnter?.(), 900)
    return () => window.clearTimeout(done)
  }, [leaving, onEnter])

  return (
    <div
      className={`fixed inset-0 z-[80] flex flex-col items-center justify-center bg-ink-900 transition-opacity duration-[900ms] ease-out ${
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <p className="font-display text-[13px] font-medium tracking-[0.48em] text-white uppercase">
        CounterfeitTrace
      </p>
      <p className="mt-4 max-w-sm text-center text-[11px] tracking-[0.22em] text-slate-500 uppercase">
        {ready ? 'Opening the network' : 'Assembling the graph'}
      </p>
      <div className="mt-10 h-px w-48 overflow-hidden bg-white/10">
        <div
          className="h-full bg-white transition-[width] duration-150 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <button
        type="button"
        onClick={() => {
          onPrime?.()
          setLeaving(true)
        }}
        className="mt-10 font-display text-[10px] tracking-[0.32em] text-slate-400 uppercase transition hover:text-white"
      >
        Enter
      </button>
    </div>
  )
}

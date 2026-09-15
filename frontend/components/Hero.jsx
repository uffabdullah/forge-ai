/**
 * Hero — full-bleed Three.js stage with Hubtown-style lower-center copy.
 * Pointer events pass through copy so the canvas stays orbitable.
 */
export default function Hero({
  id = 'hero',
  title,
  subtitle,
  cta,
  onCta,
  stage,
  overlay,
  copyVisible = true,
}) {
  return (
    <section id={id} className="relative isolate h-screen min-h-[40rem] overflow-hidden">
      <div className="absolute inset-0 z-0">{stage}</div>

      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(5,11,24,0.55)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-2/5 bg-gradient-to-t from-ink-900 via-ink-900/40 to-transparent" />

      <div
        className={`pointer-events-none absolute inset-x-0 bottom-[18%] z-10 px-6 text-center transition-opacity duration-500 ${
          copyVisible ? 'hero-copy-in opacity-100' : 'opacity-0'
        }`}
      >
        <h1 className="mx-auto max-w-4xl font-display text-4xl font-medium tracking-[0.08em] text-white uppercase sm:text-6xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mx-auto mt-5 max-w-xl text-pretty text-sm leading-relaxed text-slate-400 sm:text-[15px]">
            {subtitle}
          </p>
        )}
        {cta && (
          <button
            type="button"
            onClick={onCta}
            className="pointer-events-auto mt-8 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 font-display text-[11px] tracking-[0.22em] text-white uppercase backdrop-blur-md transition hover:bg-white/10"
          >
            {cta}
          </button>
        )}
      </div>

      {overlay ? (
        <div
          className={`absolute inset-0 z-20 transition-opacity duration-500 ${
            copyVisible ? 'pointer-events-none opacity-100' : 'pointer-events-none opacity-0 [&>*]:pointer-events-none'
          }`}
        >
          {overlay}
        </div>
      ) : null}
    </section>
  )
}

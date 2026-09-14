/**
 * Hero — the scroll-storytelling opening section.
 *
 * Presentational only: `stage` is rendered as a full-bleed layer behind the
 * copy (the caller owns whatever mounts into it, e.g. the WebGL graph). The
 * copy is `pointer-events-none` so dragging anywhere on the hero reaches the
 * canvas — add `pointer-events-auto` to the specific element if a real control
 * (button, link, inspector panel) is ever placed here.
 */
export default function Hero({ id = 'hero', eyebrow, title, subtitle, stats = [], stage, overlay }) {
  return (
    <section
      id={id}
      className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-16"
    >
      {/* 3D / background layer */}
      <div className="absolute inset-0 z-0">{stage}</div>

      {/* Vignette: transparent at the centre so the graph stays crisp, deeper at
          the edges so the hero melts into the page background. */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--color-ink-900)_75%)]" />

      <div className="pointer-events-none relative z-10 mx-auto max-w-3xl text-center">
        {eyebrow && (
          <p className="mb-4 font-mono text-xs tracking-[0.3em] text-node-distributor uppercase">
            {eyebrow}
          </p>
        )}

        <h1 className="text-balance text-4xl font-bold text-white sm:text-6xl">{title}</h1>

        {subtitle && (
          <p className="mt-6 text-pretty text-base text-slate-400 sm:text-lg">{subtitle}</p>
        )}

        {stats.length > 0 && (
          <dl className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-ink-600 bg-ink-600 sm:grid-cols-4">
            {stats.map(({ label, value }) => (
              <div key={label} className="bg-ink-800/80 px-4 py-5 backdrop-blur-sm">
                <dd className="font-mono text-2xl font-medium text-white">{value}</dd>
                <dt className="mt-1 text-xs tracking-wide text-slate-500 uppercase">{label}</dt>
              </div>
            ))}
          </dl>
        )}
      </div>

      <p className="pointer-events-none absolute bottom-8 z-10 font-mono text-xs text-slate-600">
        drag to orbit · click a node · scroll ↓
      </p>

      {overlay ? <div className="pointer-events-none absolute inset-0 z-20">{overlay}</div> : null}
    </section>
  )
}

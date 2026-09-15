/**
 * Section — Hubtown-style chapter overlay on the pinned 3D graph.
 *
 * Copy scrubs in and out with scroll. Interactive children opt back into
 * pointer events. Does not remount Lenis.
 */
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useEffect, useRef } from 'react'

gsap.registerPlugin(ScrollTrigger)

export default function Section({
  id,
  eyebrow,
  title,
  kicker,
  children,
  className = '',
  chapter = false,
  persist = false,
}) {
  const rootRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return undefined

    const ctx = gsap.context(() => {
      const copy = root.querySelector('[data-story-copy]')
      const body = root.querySelector('[data-story-body]')

      if (chapter && copy) {
        const items = [copy, body].filter(Boolean)
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            start: 'top 90%',
            end: persist ? 'bottom top' : 'bottom 10%',
            scrub: 0.7,
          },
        })
        timeline.fromTo(
          items,
          { y: 72, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.2, ease: 'none', stagger: 0.03 },
        )
        timeline.to(items, { y: 0, opacity: 1, duration: persist ? 0.8 : 0.6, ease: 'none' })
        if (!persist) {
          timeline.to(items, { y: -48, opacity: 0, duration: 0.2, ease: 'none' })
        }
        return
      }

      const targets = root.querySelectorAll('[data-reveal]')
      if (!targets.length) return
      gsap.fromTo(
        targets,
        { y: 48, opacity: 0, rotateX: 8 },
        {
          y: 0,
          opacity: 1,
          rotateX: 0,
          duration: 1.05,
          stagger: 0.1,
          ease: 'power3.out',
          immediateRender: false,
          scrollTrigger: {
            trigger: root,
            start: 'top 84%',
            once: true,
          },
        },
      )
    }, root)

    ScrollTrigger.refresh()
    return () => ctx.revert()
  }, [chapter, persist])

  if (!chapter) {
    return (
      <section
        id={id}
        ref={rootRef}
        className={`scroll-mt-32 px-6 py-24 sm:px-10 sm:py-32 [perspective:900px] ${className}`}
      >
        <div className="mx-auto max-w-5xl">
          {eyebrow && (
            <p
              data-reveal
              className="font-display text-[11px] tracking-[0.32em] text-slate-500 uppercase"
            >
              {eyebrow}
            </p>
          )}
          {title && (
            <h2
              data-reveal
              className="mt-3 max-w-2xl text-balance font-display text-3xl font-medium tracking-[0.04em] text-white uppercase sm:text-4xl"
            >
              {title}
            </h2>
          )}
          {kicker && (
            <p data-reveal className="mt-4 max-w-2xl text-pretty text-slate-400">
              {kicker}
            </p>
          )}
          <div className={title || eyebrow ? 'mt-12' : undefined}>{children}</div>
        </div>
      </section>
    )
  }

  return (
    <section
      id={id}
      ref={rootRef}
      className={`pointer-events-none relative flex min-h-screen items-center px-6 py-28 sm:px-10 sm:py-32 ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink-900/55 via-ink-900/25 to-ink-900/65" />
      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <div data-story-copy>
          {eyebrow && (
            <p className="font-display text-[11px] tracking-[0.32em] text-slate-500 uppercase">
              {eyebrow}
            </p>
          )}
          {title && (
            <h2 className="mt-3 max-w-2xl text-balance font-display text-3xl font-medium tracking-[0.04em] text-white uppercase sm:text-5xl">
              {title}
            </h2>
          )}
          {kicker && (
            <p className="mt-4 max-w-2xl text-pretty text-slate-400">{kicker}</p>
          )}
        </div>
        <div
          data-story-body
          className={`pointer-events-auto ${title || eyebrow ? 'mt-12' : undefined}`}
        >
          {children}
        </div>
      </div>
    </section>
  )
}

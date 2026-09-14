/**
 * Section — scroll-storytelling wrapper that registers a GSAP reveal.
 *
 * Skiper UI / Unlumen-style: a quiet block, no chrome. Animation is skipped
 * when the user prefers reduced motion. Does not touch Lenis.
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
}) {
  const rootRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return undefined

    const ctx = gsap.context(() => {
      const targets = root.querySelectorAll('[data-reveal]')
      if (!targets.length) return
      gsap.fromTo(
        targets,
        { y: 28, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.08,
          ease: 'power2.out',
          immediateRender: false,
          scrollTrigger: {
            trigger: root,
            start: 'top 82%',
            once: true,
          },
        },
      )
    }, root)

    ScrollTrigger.refresh()
    return () => ctx.revert()
  }, [])

  return (
    <section
      id={id}
      ref={rootRef}
      className={`scroll-mt-24 px-6 py-24 sm:py-32 ${className}`}
    >
      <div className="mx-auto max-w-5xl">
        {eyebrow && (
          <p
            data-reveal
            className="font-mono text-[11px] tracking-[0.28em] text-node-distributor uppercase"
          >
            {eyebrow}
          </p>
        )}
        {title && (
          <h2
            data-reveal
            className="mt-3 max-w-2xl text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl"
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

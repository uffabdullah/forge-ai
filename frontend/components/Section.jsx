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
      const title = root.querySelector('h2')
      if (title) {
        gsap.fromTo(
          title,
          { y: 24 },
          {
            y: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: root,
              start: 'top 90%',
              end: 'top 30%',
              scrub: true,
            },
          },
        )
      }
    }, root)

    ScrollTrigger.refresh()
    return () => ctx.revert()
  }, [])

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

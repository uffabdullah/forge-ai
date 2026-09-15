import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { useEffect, useRef } from 'react'

gsap.registerPlugin(ScrollTrigger)

/**
 * Smooth scrolling + scroll-driven animation, mounted imperatively.
 *
 * This is the pattern every plain-JS library in this app follows: the React
 * component owns a ref and a lifecycle, the library owns the canvas/DOM node it
 * creates, and cleanup is total so StrictMode's double-mount (and HMR) cannot
 * leak. Rive and Three.js mount the same way — see frontend/README.md.
 *
 * @returns {React.RefObject<Lenis|null>} the live Lenis instance (null before mount).
 */
export function useSmoothScroll() {
  const lenisRef = useRef(null)

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.35,
      smoothWheel: true,
      // Let touch devices keep native inertial scrolling.
      syncTouch: false,
    })
    lenisRef.current = lenis

    // Drive Lenis from GSAP's ticker so both share one rAF loop, and let
    // ScrollTrigger read Lenis' virtual scroll position instead of the native one.
    lenis.on('scroll', ScrollTrigger.update)
    const raf = (time) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    // Triggers measured before fonts/layout settle end up at the wrong offsets.
    const refresh = () => ScrollTrigger.refresh()
    if (document.fonts) document.fonts.ready.then(refresh)

    return () => {
      gsap.ticker.remove(raf)
      lenis.off('scroll', ScrollTrigger.update)
      lenis.destroy()
      lenisRef.current = null
      // Unmounting a section moves everything below it — re-measure.
      ScrollTrigger.refresh()
    }
  }, [])

  return lenisRef
}

import { useEffect, useRef } from 'react'
import '@/styles/ambient.css'

/**
 * Fixed ambient layer: slow-drifting aurora blobs over a grain texture, which
 * additionally parallax as the page scrolls so the app feels like it sits on a
 * living surface rather than a flat colour.
 *
 * The scroll handler writes a single CSS custom property and lets CSS do the
 * transforms, so we touch the DOM once per frame at most. Reads are batched
 * into requestAnimationFrame to avoid layout thrashing, and the whole effect
 * is skipped for users who prefer reduced motion.
 */
export function AmbientBackground() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    const el = rootRef.current
    if (!el) return

    let frame = 0
    let latest = 0

    const apply = () => {
      frame = 0
      // Normalised 0..1 over the first couple of screens, then clamped, so the
      // parallax never drifts the blobs entirely off-canvas on long pages.
      const progress = Math.min(1, latest / (window.innerHeight * 2))
      el.style.setProperty('--scroll', progress.toFixed(4))
    }

    const onScroll = () => {
      latest = window.scrollY || document.documentElement.scrollTop || 0
      if (!frame) frame = requestAnimationFrame(apply)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className="bm-ambient" aria-hidden="true" ref={rootRef}>
      <div className="bm-ambient-blob bm-ambient-blob-1" />
      <div className="bm-ambient-blob bm-ambient-blob-2" />
      <div className="bm-ambient-blob bm-ambient-blob-3" />
      <div className="bm-ambient-grain" />
    </div>
  )
}

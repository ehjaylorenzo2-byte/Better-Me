import '@/styles/ambient.css'

/**
 * Fixed, non-interactive ambient layer rendered once at the app root.
 * Purely decorative, so it is hidden from assistive technology.
 */
export function AmbientBackground() {
  return (
    <div className="bm-ambient" aria-hidden="true">
      <div className="bm-ambient-blob bm-ambient-blob-1" />
      <div className="bm-ambient-blob bm-ambient-blob-2" />
      <div className="bm-ambient-blob bm-ambient-blob-3" />
      <div className="bm-ambient-grain" />
    </div>
  )
}

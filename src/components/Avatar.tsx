import { chipVarsForLabel } from '@/theme/categoryStyles'
import './avatar.css'

/**
 * Profile picture with a graceful fallback: when no photo is set we render the
 * user's initials on a colour derived deterministically from their username,
 * so every account still gets a distinct, stable-looking avatar.
 */
export function Avatar({
  url,
  username,
  size = 48,
  ring = true,
  className = '',
}: {
  url?: string | null
  username?: string | null
  size?: number
  ring?: boolean
  className?: string
}) {
  const name = username?.trim() || '?'
  const initials = name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || name[0]?.toUpperCase() || '?'


  return (
    <span
      className={`bm-avatar ${ring ? 'bm-avatar-ring' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      {url ? (
        <img src={url} alt="" className="bm-avatar-img" width={size} height={size} loading="lazy" />
      ) : (
        <span
          className="bm-avatar-initials bm-chip"
          style={{ ...chipVarsForLabel(name), fontSize: size * 0.38 }}
        >
          {initials}
        </span>
      )}
    </span>
  )
}

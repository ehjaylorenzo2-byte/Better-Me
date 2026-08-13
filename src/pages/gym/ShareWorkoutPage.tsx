import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { getWorkoutForDate } from '@/services/gym'
import { listRoutines } from '@/services/programs'
import {
  findNewRecords,
  formatDuration,
  getExerciseTotals,
  getWorkoutTotals,
  gramsToKg,
  listPersonalRecords,
} from '@/services/workoutSets'
import {
  SHARE_SIZE,
  canShareImageFile,
  canvasToPngBlob,
  downloadBlob,
  drawShareImage,
  ensureShareFonts,
  shareFileName,
  type ShareData,
  type ShareLayout,
} from '@/utils/shareImage'
import { getUserPreferences } from '@/services/preferences'
import { getWorkoutShareLine } from '@/utils/motivation'
import { formatIsoDateLong, getPhilippineToday } from '@/utils/timezone'
import './gym.css'
import '@/components/gym/gym-log.css'

/**
 * Turns a finished workout into a picture.
 *
 * The image is drawn here, on this phone, from figures that are already on this
 * phone. It is never sent anywhere to be generated. Download is the primary
 * action because it always works; the system share sheet is offered only when
 * the browser can genuinely hand over a PNG file.
 */
export function ShareWorkoutPage() {
  const params = useParams()
  const date = params.date ?? getPhilippineToday()
  const { userId } = useAuth()
  const { show } = useToast()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const photoRef = useRef<HTMLImageElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [data, setData] = useState<ShareData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Remembered between visits, so coming back to this page a day later gives
  // you the card you last made rather than the default one.
  const [layout, setLayout] = useState<ShareLayout>(() => readChoice('layout', 'square') as ShareLayout)
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => readChoice('theme', 'dark') as 'light' | 'dark',
  )
  const [transparent, setTransparent] = useState(() => readChoice('transparent', 'no') === 'yes')

  useEffect(() => {
    writeChoice('layout', layout)
    writeChoice('theme', theme)
    writeChoice('transparent', transparent ? 'yes' : 'no')
  }, [layout, theme, transparent])
  const [photoName, setPhotoName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [nudge, setNudge] = useState(0)

  const load = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const workout = await getWorkoutForDate(userId, date)
      if (!workout) {
        setError('There is no workout saved for this day.')
        return
      }
      const [totals, exerciseTotals, records, routines, prefs] = await Promise.all([
        getWorkoutTotals(workout.id),
        getExerciseTotals(workout.id),
        listPersonalRecords(userId),
        listRoutines(userId, { includeArchived: true }),
        getUserPreferences(userId),
      ])
      if (!totals || totals.setCount === 0) {
        setError('There is nothing logged for this day yet.')
        return
      }

      // Records are the point of the card, so they are described in the units
      // the exercise is actually measured in. A record on a plank is minutes,
      // not kilograms.
      const beaten = findNewRecords(exerciseTotals, records).map((record) => ({
        name: record.name,
        detail:
          record.kind === 'weight'
            ? `${gramsToKg(record.valueGrams ?? 0)} kg${record.reps ? ` × ${record.reps}` : ''}`
            : record.kind === 'reps'
              ? `${record.reps} reps`
              : 'best ever',
      }))

      // Only used when there was no record. Deliberately the single best set
      // rather than a total, and never labelled as a record on the card.
      const heaviest = [...exerciseTotals]
        .filter((e) => e.setCount > 0)
        .sort((a, b) => (b.bestWeightGrams ?? 0) - (a.bestWeightGrams ?? 0))[0]
      const highlight =
        beaten.length === 0 && heaviest
          ? {
              name: heaviest.name,
              detail:
                heaviest.measure === 'weight_reps'
                  ? `${gramsToKg(heaviest.bestWeightGrams) ?? 0} kg × ${heaviest.bestReps ?? 0}`
                  : heaviest.measure === 'duration'
                    ? `${Math.round(heaviest.totalSeconds / 60)} min`
                    : heaviest.measure === 'distance'
                      ? `${(heaviest.totalMetres / 1000).toFixed(2)} km`
                      : `${heaviest.totalReps} reps`,
            }
          : null

      setData({
        title: routines.find((r) => r.id === workout.routineId)?.name ?? 'Workout',
        dateLabel: formatIsoDateLong(date),
        duration: formatDuration(totals.durationMinutes),
        records: beaten,
        highlight,
        // Seeded by the date so the line is stable if you come back to this
        // screen tomorrow, and follows the tone set in Motivation settings.
        motivation: getWorkoutShareLine(
          { recordCount: beaten.length },
          Number(date.replaceAll('-', '')),
          prefs.motivationTone,
        ),
      })
    } catch {
      setError('Could not load this workout.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, date])

  // Fonts first, then draw. Drawing before the webfonts land gives an export
  // that looks nothing like the preview.
  useEffect(() => {
    let cancelled = false
    if (!data) return
    ensureShareFonts().then(() => {
      if (!cancelled) setNudge((n) => n + 1)
    })
    return () => {
      cancelled = true
    }
  }, [data])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !data) return
    canvas.width = SHARE_SIZE
    canvas.height = SHARE_SIZE
    drawShareImage(canvas, data, {
      layout,
      theme,
      transparent: layout === 'overlay' ? true : transparent,
      photo: layout === 'overlay' ? photoRef.current : null,
    })
  }, [data, layout, theme, transparent, photoName, nudge])

  const onPickPhoto = (file: File | undefined) => {
    if (!file) return
    // Read as a data URL rather than an object URL so nothing has to be revoked
    // while the canvas is still drawing from it. The file never leaves the phone.
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        photoRef.current = img
        setPhotoName(file.name)
      }
      img.onerror = () => show('That image could not be opened.', 'error')
      img.src = String(reader.result)
    }
    reader.onerror = () => show('That image could not be read.', 'error')
    reader.readAsDataURL(file)
  }

  const onDownload = async () => {
    const canvas = canvasRef.current
    if (!canvas || busy) return
    setBusy(true)
    try {
      const blob = await canvasToPngBlob(canvas)
      downloadBlob(blob, shareFileName(date, layout))
      show('Saved to your downloads.', 'success')
    } catch {
      show('Could not save the image.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const onShare = async () => {
    const canvas = canvasRef.current
    if (!canvas || busy) return
    setBusy(true)
    try {
      const blob = await canvasToPngBlob(canvas)
      const file = new File([blob], shareFileName(date, layout), { type: 'image/png' })
      await navigator.share({ files: [file] })
    } catch (err) {
      // A cancelled share sheet is not a failure worth a red toast.
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        show('Sharing is not available here. Use Download instead.', 'error')
      }
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error ?? 'Nothing to share yet.'} onRetry={load} />

  const shareable = canShareImageFile()

  return (
    <div className="bm-enter">
      <PageHeader title="Share this workout" />

      <div className={`bm-share-stage ${layout === 'overlay' || transparent ? 'is-checkered' : ''}`}>
        <canvas ref={canvasRef} className="bm-share-canvas" aria-label="Preview of your workout image" />
      </div>

      <Card style={{ marginBottom: 14 }}>
        <h2 className="bm-section-title">Style</h2>

        <p className="bm-share-label">Shape</p>
        <div className="bm-share-chips">
          <Chip active={layout === 'square'} onClick={() => setLayout('square')}>
            Square post
          </Chip>
          <Chip active={layout === 'overlay'} onClick={() => setLayout('overlay')}>
            For your photo
          </Chip>
        </div>

        {layout === 'square' ? (
          <>
            <p className="bm-share-label">Colour</p>
            <div className="bm-share-chips">
              <Chip active={theme === 'dark'} onClick={() => setTheme('dark')}>
                Dark
              </Chip>
              <Chip active={theme === 'light'} onClick={() => setTheme('light')}>
                Light
              </Chip>
            </div>

            <label className="bm-share-toggle">
              <input
                type="checkbox"
                checked={transparent}
                onChange={(e) => setTransparent(e.target.checked)}
              />
              <span>
                No background
                <em>A see-through PNG you can drop on top of anything.</em>
              </span>
            </label>
          </>
        ) : (
          <>
            <p className="bm-share-label">Your photo</p>
            <p className="bm-share-hint">
              Optional. Add one and it is drawn straight into the picture on this phone — it is never
              uploaded anywhere. Leave it out and you get a see-through PNG to place over a photo yourself.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="bm-share-file"
              onChange={(e) => onPickPhoto(e.target.files?.[0])}
            />
            <button
              type="button"
              className="bm-btn bm-btn-secondary bm-btn-full"
              onClick={() => fileRef.current?.click()}
            >
              {photoName ? 'Choose a different photo' : 'Choose a photo'}
            </button>
            {photoName ? (
              <button
                type="button"
                className="bm-btn bm-btn-ghost bm-btn-full"
                style={{ marginTop: 8 }}
                onClick={() => {
                  photoRef.current = null
                  setPhotoName(null)
                  if (fileRef.current) fileRef.current.value = ''
                }}
              >
                Remove photo
              </button>
            ) : null}
          </>
        )}
      </Card>

      <button className="bm-btn bm-btn-primary bm-btn-full" onClick={onDownload} disabled={busy}>
        {busy ? 'Working…' : 'Download image'}
      </button>

      {shareable ? (
        <button
          className="bm-btn bm-btn-secondary bm-btn-full"
          style={{ marginTop: 10 }}
          onClick={onShare}
          disabled={busy}
        >
          Share…
        </button>
      ) : null}

      <p className="bm-share-privacy">
        The picture is made on your phone from your own numbers. Nothing about your workout is sent
        anywhere to create it.
      </p>
    </div>
  )
}

/**
 * The share choices, kept on the device.
 *
 * Wrapped because storage throws rather than returning null in a few situations
 * — private windows, a full quota, an embedded WebView with storage disabled —
 * and a remembered preference is never worth a crashed screen.
 */
const CHOICE_PREFIX = 'bm-share:'

function readChoice(key: string, fallback: string): string {
  try {
    return localStorage.getItem(CHOICE_PREFIX + key) ?? fallback
  } catch {
    return fallback
  }
}

function writeChoice(key: string, value: string): void {
  try {
    localStorage.setItem(CHOICE_PREFIX + key, value)
  } catch {
    // Not being able to remember is not a failure worth showing anyone.
  }
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={`bm-share-chip ${active ? 'is-active' : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

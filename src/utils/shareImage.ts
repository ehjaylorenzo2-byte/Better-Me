/**
 * The workout share image.
 *
 * Drawn on a canvas on this device, from numbers that are already on this
 * device. Nothing is uploaded, no image service is called, and the file never
 * leaves the phone unless the person taps Share or Download themselves. That is
 * a deliberate constraint, not an oversight: a workout photo is personal.
 *
 * Everything is laid out against a 1080 x 1080 grid and scaled by one factor, so
 * the same code can render a small preview and a full-size export without the
 * proportions drifting between them.
 */

export const SHARE_SIZE = 1080

export type ShareLayout = 'square' | 'overlay'

export interface ShareTheme {
  /** Page behind the type. Ignored when the background is transparent. */
  bg: string
  ink: string
  dim: string
  lime: string
  /** Type that sits on the lime pill. */
  onLime: string
  rule: string
}

export const SHARE_THEMES: Record<'light' | 'dark', ShareTheme> = {
  light: {
    bg: '#F4F4F2',
    ink: '#101208',
    dim: '#63675B',
    lime: '#D2F34C',
    onLime: '#101208',
    rule: 'rgba(16, 18, 8, 0.18)',
  },
  dark: {
    bg: '#0E100C',
    ink: '#F4F5F0',
    dim: '#9BA192',
    lime: '#D2F34C',
    onLime: '#101208',
    rule: 'rgba(244, 245, 240, 0.20)',
  },
}

/** One line of the card: what the lift was, and what you did on it. */
export interface ShareLift {
  name: string
  /** Already formatted for display, e.g. "80 kg × 10", "22 reps", "1.20 km". */
  detail: string
}

export interface ShareData {
  /** Routine name, or a plain fallback when the workout was not from a routine. */
  title: string
  /** Already formatted for display, e.g. "Thursday, 13 August". */
  dateLabel: string
  /** Already formatted, e.g. "1h 18m". */
  duration: string
  /**
   * Personal records set in this session. Usually empty, which is the point:
   * a record is only worth showing because most days do not have one.
   */
  records: ShareLift[]
  /**
   * The session's best single set, shown only when there was no record. Never
   * labelled as a record, because it is not one.
   */
  highlight?: ShareLift | null
  /** One earned sentence. See getWorkoutShareLine in utils/motivation.ts. */
  motivation: string
}

export interface ShareOptions {
  layout: ShareLayout
  theme: 'light' | 'dark'
  transparent: boolean
  /** Optional photo, already loaded. Drawn cover-style under the overlay. */
  photo?: CanvasImageSource | null
}

const FAMILY_BLACK = '"Creato Display Black", "Creato Display", system-ui, sans-serif'
const FAMILY_MEDIUM = '"Creato Display Medium", "Creato Display", system-ui, sans-serif'
const FAMILY_BOOK = '"Creato Display", system-ui, sans-serif'

/**
 * The webfonts have to be in memory before the first stroke, or the canvas
 * silently falls back to a system face and the export looks nothing like the
 * preview. Failures are swallowed: a share card in the wrong font still beats
 * no share card.
 */
export async function ensureShareFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  const faces = [`900 100px ${FAMILY_BLACK}`, `500 100px ${FAMILY_MEDIUM}`, `400 100px ${FAMILY_BOOK}`]
  try {
    await Promise.all(faces.map((face) => document.fonts.load(face)))
    await document.fonts.ready
  } catch {
    // Keep going with whatever is available.
  }
}

/**
 * Letter-spaced text, drawn a character at a time.
 *
 * ctx.letterSpacing exists in current Chrome and Safari but not in every engine
 * this app has to run in, and a tracked label that silently loses its tracking
 * looks like a bug. Doing it by hand is a few lines and works everywhere.
 */
function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
): number {
  let cursor = x
  for (const char of text) {
    ctx.fillText(char, cursor, y)
    cursor += ctx.measureText(char).width + spacing
  }
  return cursor - x - spacing
}

function measureTracked(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
  let width = 0
  for (const char of text) width += ctx.measureText(char).width + spacing
  return Math.max(0, width - spacing)
}

/** Greedy word wrap. The motivation line is a sentence, so it has to break. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
  maxWidth: number,
): string[] {
  ctx.font = font
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

/** Shrinks a font until the text fits, so a long routine name never runs off. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  family: string,
  startPx: number,
  maxWidth: number,
  minPx: number,
): number {
  let size = startPx
  ctx.font = `${size}px ${family}`
  while (ctx.measureText(text).width > maxWidth && size > minPx) {
    size -= 2
    ctx.font = `${size}px ${family}`
  }
  return size
}

/** Cover-fit, the same rule CSS background-size: cover uses. */
function drawPhotoCover(ctx: CanvasRenderingContext2D, photo: CanvasImageSource, size: number): void {
  const source = photo as unknown as { width?: number; height?: number; videoWidth?: number; videoHeight?: number }
  const w = source.width ?? source.videoWidth ?? size
  const h = source.height ?? source.videoHeight ?? size
  if (!w || !h) return
  const scale = Math.max(size / w, size / h)
  const dw = w * scale
  const dh = h * scale
  ctx.drawImage(photo, (size - dw) / 2, (size - dh) / 2, dw, dh)
}

/**
 * Draws the whole card. The canvas is sized by the caller; everything scales
 * from the 1080 grid so preview and export cannot disagree.
 */
export function drawShareImage(canvas: HTMLCanvasElement, data: ShareData, options: ShareOptions): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const size = canvas.width
  const k = size / SHARE_SIZE
  const t = SHARE_THEMES[options.theme]

  ctx.clearRect(0, 0, size, size)
  ctx.textBaseline = 'alphabetic'

  if (options.photo) {
    drawPhotoCover(ctx, options.photo, size)
  } else if (!options.transparent) {
    ctx.fillStyle = t.bg
    ctx.fillRect(0, 0, size, size)
  }

  if (options.layout === 'overlay') {
    drawOverlay(ctx, data, options, k, size)
  } else {
    drawSquare(ctx, data, options, k, size)
  }
}

/**
 * The square card.
 *
 * The workout is the headline, the record is the point, and the line at the
 * bottom is the reason anyone posts it. There are deliberately no session
 * totals: sets, reps and kilograms lifted are a training log, not a thing to
 * show people, and a big "8,420 kg" says almost nothing about whether the
 * session was any good. What a record says is unambiguous — you had never done
 * that before.
 *
 * Lime appears exactly twice: the rule under the title, and the record marker.
 */
function drawSquare(
  ctx: CanvasRenderingContext2D,
  data: ShareData,
  options: ShareOptions,
  k: number,
  size: number,
): void {
  const t = SHARE_THEMES[options.theme]
  const pad = 76 * k
  const contentWidth = size - pad * 2
  let y = pad

  // Brand
  const dot = 14 * k
  ctx.fillStyle = t.lime
  ctx.beginPath()
  ctx.arc(pad + dot / 2, y + 20 * k, dot / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = t.dim
  ctx.font = `500 ${26 * k}px ${FAMILY_MEDIUM}`
  drawTracked(ctx, 'BETTER ME', pad + dot + 16 * k, y + 29 * k, 4 * k)
  y += 104 * k

  // The workout is the headline. "Pull Day" is what the picture is about.
  const titleSize = fitFont(ctx, data.title, FAMILY_BLACK, 116 * k, contentWidth, 60 * k)
  ctx.fillStyle = t.ink
  ctx.font = `900 ${titleSize}px ${FAMILY_BLACK}`
  ctx.fillText(data.title, pad, y + titleSize * 0.82)
  y += titleSize + 24 * k

  // The single lime rule.
  ctx.fillStyle = t.lime
  ctx.fillRect(pad, y, 150 * k, 14 * k)
  y += 14 * k + 34 * k

  // Date and duration share one quiet line. Duration is a fact about the
  // session rather than a score, so it is stated, not celebrated.
  ctx.fillStyle = t.dim
  ctx.font = `400 ${30 * k}px ${FAMILY_BOOK}`
  ctx.fillText(`${data.dateLabel}  ·  ${data.duration}`, pad, y + 24 * k)

  y += 24 * k + 62 * k

  // The record follows straight on from the workout, because it is the same
  // thought: this is what the session was. An earlier version pinned it just
  // above the motivation line and left a hole through the middle of the card.
  const entries = data.records.length > 0 ? data.records : data.highlight ? [data.highlight] : []
  const isRecord = data.records.length > 0
  const label = isRecord
    ? data.records.length > 1
      ? 'NEW PERSONAL RECORDS'
      : 'NEW PERSONAL RECORD'
    : "TODAY'S BEST SET"

  if (entries.length > 0) {
    const shown = entries.slice(0, 3)
    const blockHeight = 52 * k + shown.length * 74 * k

    // A lime bar down the left edge marks a record. Nothing marks a best set,
    // because a best set is not an achievement and should not borrow the look
    // of one.
    if (isRecord) {
      ctx.fillStyle = t.lime
      ctx.fillRect(pad, y, 10 * k, blockHeight)
    }

    const textLeft = isRecord ? pad + 34 * k : pad
    ctx.fillStyle = isRecord ? t.ink : t.dim
    ctx.font = `500 ${26 * k}px ${FAMILY_MEDIUM}`
    drawTracked(ctx, label, textLeft, y + 26 * k, 3 * k)
    y += 52 * k

    for (const entry of shown) {
      ctx.fillStyle = t.ink
      const nameSize = fitFont(ctx, entry.name, FAMILY_BLACK, 54 * k, contentWidth - 70 * k, 34 * k)
      ctx.font = `900 ${nameSize}px ${FAMILY_BLACK}`
      ctx.fillText(entry.name, textLeft, y + 46 * k)
      const nameWidth = ctx.measureText(entry.name).width

      ctx.fillStyle = t.dim
      ctx.font = `400 ${38 * k}px ${FAMILY_BOOK}`
      ctx.fillText(`  ${entry.detail}`, textLeft + nameWidth, y + 46 * k)
      y += 74 * k
    }
  }

  // The line people actually read, anchored to the bottom so it closes the card
  // however much sits above it.
  const motivationLines = wrapText(ctx, data.motivation, `500 ${36 * k}px ${FAMILY_MEDIUM}`, contentWidth)
  const motivationTop = size - pad - 34 * k - motivationLines.length * 48 * k

  ctx.fillStyle = t.ink
  ctx.font = `500 ${36 * k}px ${FAMILY_MEDIUM}`
  motivationLines.forEach((line, index) => {
    ctx.fillText(line, pad, motivationTop + 36 * k + index * 48 * k)
  })

  ctx.fillStyle = t.dim
  ctx.font = `400 ${24 * k}px ${FAMILY_BOOK}`
  ctx.fillText('betterme', pad, size - pad + 6 * k)
}

/**
 * Compact overlay, bottom left, for dropping over your own photo.
 *
 * Same priorities as the square, with less room: the workout, the record, and
 * nothing that needs a second read. The dark fade is drawn only across the
 * lower part of the frame so the photo stays visible, and it is baked into the
 * transparent PNG as real alpha rather than faked with a flat rectangle.
 */
function drawOverlay(
  ctx: CanvasRenderingContext2D,
  data: ShareData,
  options: ShareOptions,
  k: number,
  size: number,
): void {
  const t = SHARE_THEMES.dark
  const pad = 74 * k

  const scrim = ctx.createLinearGradient(0, size, 0, size * 0.38)
  scrim.addColorStop(0, 'rgba(14, 16, 12, 0.88)')
  scrim.addColorStop(0.45, 'rgba(14, 16, 12, 0.5)')
  scrim.addColorStop(1, 'rgba(14, 16, 12, 0)')
  ctx.fillStyle = scrim
  ctx.fillRect(0, size * 0.38, size, size * 0.62)

  let y = size - pad

  ctx.fillStyle = 'rgba(244, 245, 240, 0.5)'
  ctx.font = `500 ${22 * k}px ${FAMILY_MEDIUM}`
  drawTracked(ctx, 'BETTER ME', pad, y, 4 * k)
  y -= 50 * k

  // One record line, or one best set. Never a row of totals.
  const entry = data.records[0] ?? data.highlight ?? null
  if (entry) {
    ctx.fillStyle = 'rgba(244, 245, 240, 0.9)'
    ctx.font = `900 ${32 * k}px ${FAMILY_BLACK}`
    ctx.fillText(entry.name, pad, y)
    const nameWidth = ctx.measureText(entry.name).width
    ctx.font = `400 ${32 * k}px ${FAMILY_BOOK}`
    ctx.fillText(`  ${entry.detail}`, pad + nameWidth, y)
    y -= 42 * k

    if (data.records.length > 0) {
      ctx.fillStyle = t.lime
      ctx.font = `500 ${22 * k}px ${FAMILY_MEDIUM}`
      drawTracked(ctx, 'NEW PERSONAL RECORD', pad, y, 3 * k)
      y -= 44 * k
    }
  }

  const titleSize = fitFont(ctx, data.title, FAMILY_BLACK, 96 * k, size - pad * 2, 56 * k)
  ctx.fillStyle = t.ink
  ctx.font = `900 ${titleSize}px ${FAMILY_BLACK}`
  ctx.fillText(data.title, pad, y)
  // Cap height is roughly three quarters of the em, so clearing the ascender
  // takes 0.82 rather than the half that put the rule through the letters.
  y -= titleSize * 0.82

  // The one thread of lime, above the title rather than through it.
  ctx.fillStyle = t.lime
  ctx.fillRect(pad, y - 18 * k, 110 * k, 10 * k)
}

/** A filename someone can find again in their downloads folder. */
export function shareFileName(date: string, layout: ShareLayout): string {
  return `betterme-workout-${date}${layout === 'overlay' ? '-overlay' : ''}.png`
}

/**
 * Canvas to file.
 *
 * toBlob is the correct API but is missing or async-broken in a few older
 * WebViews, so a data-URL path stands behind it. Download has to work every
 * time; that is the whole point of having it separate from Share.
 */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else fallback()
      }, 'image/png')
      return
    }
    fallback()

    function fallback() {
      try {
        const url = canvas.toDataURL('image/png')
        const base64 = url.split(',')[1] ?? ''
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
        resolve(new Blob([bytes], { type: 'image/png' }))
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Could not build the image.'))
      }
    }
  })
}

/** Saves the blob without needing any permission or plugin. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoked on the next tick so Safari has finished reading it.
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** True only when this browser can actually share a PNG file, not just a link. */
export function canShareImageFile(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false
  try {
    const probe = new File([new Blob([''], { type: 'image/png' })], 'probe.png', { type: 'image/png' })
    return navigator.canShare({ files: [probe] })
  } catch {
    return false
  }
}

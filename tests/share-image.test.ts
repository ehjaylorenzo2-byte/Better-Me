import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  SHARE_SIZE,
  SHARE_THEMES,
  canShareImageFile,
  drawShareImage,
  shareFileName,
  type ShareData,
} from '../src/utils/shareImage'

/**
 * The share card is the one thing in this app a stranger might see, so the
 * things that would embarrass it are pinned here: a filename nobody can find
 * again, a canvas call that throws on a browser without 2d support, a share
 * button offered where sharing a file is impossible, and — the important one —
 * any suggestion that the picture is made somewhere other than this phone.
 */

const DATA: ShareData = {
  title: 'Pull Day',
  dateLabel: 'Monday, 10 August',
  duration: '1h 18m',
  records: [{ name: 'Barbell Row', detail: '80 kg × 10' }],
  highlight: null,
  motivation: 'A number you have never hit before.',
}

describe('share filenames', () => {
  it('names the file after the workout date, so it is findable later', () => {
    expect(shareFileName('2026-08-10', 'square')).toBe('betterme-workout-2026-08-10.png')
  })

  it('marks the overlay separately, so the two do not overwrite each other', () => {
    expect(shareFileName('2026-08-10', 'overlay')).toBe('betterme-workout-2026-08-10-overlay.png')
  })
})

describe('drawing', () => {
  it('exports at exactly 1080 square', () => {
    expect(SHARE_SIZE).toBe(1080)
  })

  it('gives up quietly when the browser has no 2d canvas rather than throwing', () => {
    const canvas = { width: 1080, height: 1080, getContext: () => null } as unknown as HTMLCanvasElement
    expect(() =>
      drawShareImage(canvas, DATA, { layout: 'square', theme: 'dark', transparent: false }),
    ).not.toThrow()
  })

  it('paints a background for a solid card and paints none for a transparent one', () => {
    const painted: string[] = []
    const ctx = stubContext(painted)
    const canvas = { width: 1080, height: 1080, getContext: () => ctx } as unknown as HTMLCanvasElement

    drawShareImage(canvas, DATA, { layout: 'square', theme: 'dark', transparent: false })
    expect(painted).toContain(`fillRect:0,0,1080,1080:${SHARE_THEMES.dark.bg}`)

    painted.length = 0
    drawShareImage(canvas, DATA, { layout: 'square', theme: 'dark', transparent: true })
    expect(painted.some((call) => call.startsWith('fillRect:0,0,1080,1080'))).toBe(false)
  })

  it('leads with the workout, the record and the line', () => {
    const painted: string[] = []
    const ctx = stubContext(painted)
    const canvas = { width: 1080, height: 1080, getContext: () => ctx } as unknown as HTMLCanvasElement

    drawShareImage(canvas, DATA, { layout: 'square', theme: 'light', transparent: false })
    const text = spaced(painted)

    expect(text).toContain('Pull Day')
    expect(text).toContain('Barbell Row')
    expect(text).toContain('80 kg × 10')
    expect(text).toContain('never hit before')
  })

  /**
   * The card used to carry sets, reps and total kilograms lifted. They are gone
   * on purpose: a session total is a training log, and "8,420 kg" says nothing
   * about whether the session was any good. Pinned so they cannot creep back.
   */
  it('shows no session totals at all', () => {
    const painted: string[] = []
    const ctx = stubContext(painted)
    const canvas = { width: 1080, height: 1080, getContext: () => ctx } as unknown as HTMLCanvasElement

    drawShareImage(canvas, DATA, { layout: 'square', theme: 'dark', transparent: false })
    const text = tight(painted)

    expect(text).not.toContain('SETS')
    expect(text).not.toContain('REPS')
    expect(text).not.toContain('KG LIFTED')
    expect(text).not.toContain('8,420')
  })

  it('never calls a best set a record', () => {
    const painted: string[] = []
    const ctx = stubContext(painted)
    const canvas = { width: 1080, height: 1080, getContext: () => ctx } as unknown as HTMLCanvasElement

    drawShareImage(
      canvas,
      {
        ...DATA,
        records: [],
        highlight: { name: 'Barbell Row', detail: '70 kg × 8' },
        motivation: 'Not every session breaks a record. They all still count.',
      },
      { layout: 'square', theme: 'dark', transparent: false },
    )
    const text = tight(painted)

    expect(text).toContain("TODAY'S BEST SET")
    expect(text).not.toContain('NEW PERSONAL RECORD')
  })

  it('carries the workout and the record onto the photo overlay too', () => {
    const painted: string[] = []
    const ctx = stubContext(painted)
    const canvas = { width: 1080, height: 1080, getContext: () => ctx } as unknown as HTMLCanvasElement

    drawShareImage(canvas, DATA, { layout: 'overlay', theme: 'dark', transparent: true })

    expect(spaced(painted)).toContain('Pull Day')
    expect(spaced(painted)).toContain('Barbell Row')
    expect(tight(painted)).toContain('NEW PERSONAL RECORD')
    expect(tight(painted)).not.toContain('SETS')
  })
})

describe('sharing', () => {
  it('does not offer the share sheet when the browser cannot share a file', () => {
    vi.stubGlobal('navigator', {})
    expect(canShareImageFile()).toBe(false)
    vi.unstubAllGlobals()
  })
})

describe('privacy', () => {
  it('never sends the workout anywhere to make the picture', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/utils/shareImage.ts'),
      'utf8',
    )
    // No network of any kind belongs in a module whose entire promise is that
    // the image is drawn on the device.
    expect(source).not.toMatch(/\bfetch\s*\(/)
    expect(source).not.toMatch(/XMLHttpRequest/)
    expect(source).not.toMatch(/supabase/i)
    expect(source).not.toMatch(/https?:\/\/(?!\/)/)
  })
})

/**
 * Two readings of the same painted output.
 *
 * Tracked labels are drawn one character at a time, so "NEW PERSONAL RECORD"
 * arrives as nineteen separate fillText calls. Joining those with a space gives
 * "N E W ...", which no sensible assertion matches — so a test written that way
 * passes by being unable to fail. `tight` concatenates instead, which restores
 * the label exactly; `spaced` is for whole strings drawn in one call.
 */
function spaced(painted: string[]): string {
  return painted.filter((c) => c.startsWith('text:')).join(' ')
}

function tight(painted: string[]): string {
  return painted
    .filter((c) => c.startsWith('text:'))
    .map((c) => c.slice('text:'.length))
    .join('')
}

/** The smallest 2d context that records what was asked of it. */
function stubContext(log: string[]) {
  const state = { fillStyle: '#000', font: '' }
  return {
    get fillStyle() {
      return state.fillStyle
    },
    set fillStyle(value: string) {
      state.fillStyle = value
    },
    get font() {
      return state.font
    },
    set font(value: string) {
      state.font = value
    },
    textBaseline: 'alphabetic',
    clearRect: () => {},
    fillRect: (x: number, y: number, w: number, h: number) =>
      log.push(`fillRect:${x},${y},${w},${h}:${state.fillStyle}`),
    fillText: (text: string) => log.push(`text:${text}`),
    measureText: (text: string) => ({ width: text.length * 10 }),
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    fill: () => {},
    drawImage: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
  } as unknown as CanvasRenderingContext2D
}

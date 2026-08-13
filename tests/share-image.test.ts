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
  title: 'Push Day',
  dateLabel: 'Monday, 10 August',
  duration: '1h 18m',
  setCount: 16,
  totalReps: 142,
  volumeGrams: 8_420_000,
  personalRecord: 'Bench Press 80 kg',
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

  it('puts every figure it was given on the card', () => {
    const painted: string[] = []
    const ctx = stubContext(painted)
    const canvas = { width: 1080, height: 1080, getContext: () => ctx } as unknown as HTMLCanvasElement

    drawShareImage(canvas, DATA, { layout: 'square', theme: 'light', transparent: false })
    const text = painted.filter((c) => c.startsWith('text:')).join(' ')

    expect(text).toContain('Push Day')
    expect(text).toContain('1h 18m')
    expect(text).toContain('16')
    expect(text).toContain('142')
    // 8,420,000 grams is 8,420 kilograms, not 8,420,000 of anything.
    expect(text).toContain('8,420')
    expect(text).toContain('Bench Press 80 kg')
  })

  it('leaves the record off entirely when nothing was beaten', () => {
    const painted: string[] = []
    const ctx = stubContext(painted)
    const canvas = { width: 1080, height: 1080, getContext: () => ctx } as unknown as HTMLCanvasElement

    drawShareImage(
      canvas,
      { ...DATA, personalRecord: null },
      { layout: 'square', theme: 'dark', transparent: false },
    )
    expect(painted.filter((c) => c.startsWith('text:')).join(' ')).not.toContain('New PR')
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

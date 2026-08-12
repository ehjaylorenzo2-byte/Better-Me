import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Lime is a fill, never a word.
 *
 * #D2F34C on white is about 1.4:1, which is close to invisible and nowhere near
 * the 4.5:1 needed for text. The palette already provides --accent-text for
 * green words, but the rule kept getting broken one stylesheet at a time: the
 * theme picker, the login footer, the habits progress line and the lock keypad
 * had all drifted back to plain --accent.
 *
 * So the rule is enforced here instead of remembered. Borders, backgrounds and
 * accent-color are all still free to use --accent, because none of them are
 * text and none of them need 4.5:1.
 */

function stylesheets(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) stylesheets(full, found)
    else if (entry.name.endsWith('.css')) found.push(full)
  }
  return found
}

describe('lime is never used as text colour', () => {
  const root = path.resolve(process.cwd(), 'src')
  const files = stylesheets(root)

  it('finds stylesheets to check', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it('has no rule setting text to the raw accent', () => {
    const offenders: string[] = []

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8')
      source.split('\n').forEach((line, index) => {
        const trimmed = line.trim()
        // Anything whose property merely ends in "color" is a border or a
        // background, and those may use the raw accent freely.
        if (!trimmed.startsWith('color:')) return
        // `var(--chip-accent, var(--accent))` is fine: the category colour wins
        // and light mode darkens it. Only a bare `var(--accent)` is the bug.
        if (!/^color:\s*var\(--accent\)\s*;?$/.test(trimmed)) return
        offenders.push(`${path.relative(root, file)}:${index + 1}  ${trimmed}`)
      })
    }

    expect(offenders, `Use var(--accent-text) for green words:\n${offenders.join('\n')}`).toEqual([])
  })

  it('the regression cases specifically stay fixed', () => {
    const checks: Array<[string, string]> = [
      ['pages/profile/profile.css', '.bm-theme-option.active'],
      ['pages/auth/auth.css', '.bm-auth-footer'],
      ['pages/habits/habits.css', '.bm-habits-progress-row span'],
      ['features/lock/lock.css', '.bm-lock-key-soft'],
    ]
    for (const [file, selector] of checks) {
      const source = fs.readFileSync(path.join(root, file), 'utf8')
      expect(source, `${file} lost ${selector}`).toContain(selector)
    }
  })
})

/**
 * Text size has to move the whole scale, not just body copy. If a size token
 * ever goes back to a bare pixel value, Large stops working for that one step
 * and the hierarchy quietly breaks at the top.
 */
describe('type scale follows the text size setting', () => {
  const tokens = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')

  it('derives every font size from the scale factor', () => {
    for (const token of ['display', 'title', 'heading', 'body', 'label', 'caption']) {
      const match = tokens.match(new RegExp(`--fs-${token}:\\s*([^;]+);`))
      expect(match, `--fs-${token} is missing`).toBeTruthy()
      expect(match?.[1], `--fs-${token} ignores --fs-scale`).toContain('var(--fs-scale)')
    }
  })

  it('offers a smaller and a larger setting either side of the default', () => {
    expect(tokens).toMatch(/\[data-text-size='small'\]/)
    expect(tokens).toMatch(/\[data-text-size='large'\]/)
    expect(tokens).toMatch(/--fs-scale:\s*1;/)
  })
})

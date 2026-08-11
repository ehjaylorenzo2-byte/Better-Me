import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * Guards against two stylesheets defining the same class.
 *
 * This has bitten twice. `.bm-section-head` meant a stacked label-and-total
 * block in one file and a flex "title / See all" row in another, so every
 * section total jumped onto one baseline. `.bm-tx-chip` meant a 34px square
 * icon chip in one file and a pill with a label in another, so the new
 * transaction sheet rendered its account names on top of each other.
 *
 * Neither showed up in typecheck, tests, or code review. Both were only visible
 * in a screenshot, and only if you happened to look at the right screen. CSS has
 * no module system here, so this test is the module system.
 *
 * If a class genuinely needs to be shared, put it in styles/ where shared things
 * live. Everything under components/ and pages/ should own its own names.
 */

const ROOT = process.cwd()
const SHARED_DIR = path.join(ROOT, 'src', 'styles')

function cssFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...cssFiles(full))
    else if (entry.endsWith('.css')) out.push(full)
  }
  return out
}

/**
 * Which classes a file claims ownership of.
 *
 * Only unscoped selectors count. `.bm-btn { }` claims bm-btn, but
 * `.bm-sheet .bm-btn { }` is deliberately reaching into a shared component from
 * a specific context, which is normal and not a clash. A leading theme
 * selector does not count as scoping, since `[data-theme='dark'] .bm-card` is
 * still the card's own file talking about the card.
 */
function definedClasses(css: string): Set<string> {
  const found = new Set<string>()
  // Strip comments and rule bodies so only selectors are scanned.
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const selectorBlocks = withoutComments.match(/(^|})[^{}]+\{/gm) ?? []

  for (const raw of selectorBlocks) {
    const selector = raw.replace(/^}/, '').replace(/\{$/, '').trim()
    if (!selector || selector.startsWith('@') || selector.startsWith('from') || selector.startsWith('to')) {
      continue
    }
    for (const part of selector.split(',')) {
      const cleaned = part
        .trim()
        // A leading theme selector is not scoping.
        .replace(/^\[data-theme=('|")[a-z]+\1\]\s+/, '')
        .trim()

      const compounds = cleaned.split(/\s+|>/).filter(Boolean)
      // More than one compound means the rule is scoped inside something else,
      // which is a deliberate override rather than an ownership claim.
      if (compounds.length !== 1) continue

      const match = compounds[0].match(/^\.([a-zA-Z0-9_-]+)/)
      if (match) found.add(match[1])
    }
  }
  return found
}

describe('css class ownership', () => {
  const files = cssFiles(path.join(ROOT, 'src')).filter((f) => !f.startsWith(SHARED_DIR))

  it('finds stylesheets to check', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it('never defines the same class in two component or page stylesheets', () => {
    const owners = new Map<string, string[]>()

    for (const file of files) {
      const rel = path.relative(ROOT, file)
      for (const cls of definedClasses(readFileSync(file, 'utf8'))) {
        owners.set(cls, [...(owners.get(cls) ?? []), rel])
      }
    }

    const clashes = [...owners.entries()]
      .filter(([, where]) => where.length > 1)
      .map(([cls, where]) => `${cls} defined in ${where.join(' and ')}`)

    expect(clashes).toEqual([])
  })
})

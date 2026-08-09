/**
 * Category colour tokens. Each has a vivid accent plus a translucent tint used
 * for the icon chip background, so a list of categories reads as colourful
 * without fighting Better Me's dark forest surfaces. All accents were picked
 * to stay legible on both the dark and light themes.
 */

export interface CategoryColor {
  id: string
  label: string
  accent: string
  tint: string
}

export const CATEGORY_COLORS: CategoryColor[] = [
  { id: 'mint', label: 'Mint', accent: '#21EDA6', tint: 'rgba(33, 237, 166, 0.16)' },
  { id: 'emerald', label: 'Emerald', accent: '#34D399', tint: 'rgba(52, 211, 153, 0.16)' },
  { id: 'teal', label: 'Teal', accent: '#2DD4BF', tint: 'rgba(45, 212, 191, 0.16)' },
  { id: 'sky', label: 'Sky', accent: '#38BDF8', tint: 'rgba(56, 189, 248, 0.16)' },
  { id: 'indigo', label: 'Indigo', accent: '#818CF8', tint: 'rgba(129, 140, 248, 0.18)' },
  { id: 'violet', label: 'Violet', accent: '#A78BFA', tint: 'rgba(167, 139, 250, 0.18)' },
  { id: 'pink', label: 'Pink', accent: '#F472B6', tint: 'rgba(244, 114, 182, 0.16)' },
  { id: 'rose', label: 'Rose', accent: '#FB7185', tint: 'rgba(251, 113, 133, 0.16)' },
  { id: 'orange', label: 'Orange', accent: '#FB923C', tint: 'rgba(251, 146, 60, 0.16)' },
  { id: 'amber', label: 'Amber', accent: '#FBBF24', tint: 'rgba(251, 191, 36, 0.16)' },
  { id: 'lime', label: 'Lime', accent: '#A3E635', tint: 'rgba(163, 230, 53, 0.16)' },
  { id: 'slate', label: 'Slate', accent: '#94A3B8', tint: 'rgba(148, 163, 184, 0.16)' },
]

const COLOR_BY_ID = new Map(CATEGORY_COLORS.map((c) => [c.id, c]))

export function getCategoryColor(id: string | null | undefined): CategoryColor {
  return COLOR_BY_ID.get(id ?? '') ?? CATEGORY_COLORS[0]
}

/** Deterministic fallback colour for a label with no stored category (legacy rows). */
export function colorForLabel(label: string): CategoryColor {
  let hash = 0
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) | 0
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length]
}

export const CATEGORY_ICON_IDS = [
  'cart',
  'utensils',
  'coffee',
  'car',
  'home',
  'zap',
  'wifi',
  'heart-pulse',
  'heart',
  'shopping-bag',
  'shirt',
  'film',
  'repeat',
  'graduation-cap',
  'plane',
  'gift',
  'banknote',
  'dumbbell',
  'phone',
  'wrench',
  'sparkles',
  'wallet',
  'laptop',
  'briefcase',
  'trending-up',
  'undo',
  'piggy-bank',
  'credit-card',
  'landmark',
  'circle',
] as const

export type CategoryIconId = (typeof CATEGORY_ICON_IDS)[number]

export function isValidIcon(id: string): id is CategoryIconId {
  return (CATEGORY_ICON_IDS as readonly string[]).includes(id)
}

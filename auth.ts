/**
 * Better Me's category icon library. All icons are 24x24 outline glyphs drawn
 * with currentColor strokes so they inherit whatever category colour is
 * applied, and stay consistent with the outline caterpillar logo.
 *
 * Icons are grouped for the picker UI: a flat list of sixty is unusable on a
 * phone, grouped sections are scannable.
 */

type Shape =
  | { t: 'p'; d: string }
  | { t: 'c'; cx: number; cy: number; r: number }
  | { t: 'r'; x: number; y: number; w: number; h: number; rx?: number }

const I = (...shapes: Shape[]) => shapes
const p = (d: string): Shape => ({ t: 'p', d })
const c = (cx: number, cy: number, r: number): Shape => ({ t: 'c', cx, cy, r })
const r = (x: number, y: number, w: number, h: number, rx = 2): Shape => ({ t: 'r', x, y, w, h, rx })

export const ICON_PATHS: Record<string, Shape[]> = {
  // ---- Food & drink -------------------------------------------------------
  utensils: I(p('M4 3v7a2 2 0 002 2h0a2 2 0 002-2V3'), p('M6 12v9'), p('M17 3c-1.7 0-3 2-3 5s1.3 4 3 4v9')),
  coffee: I(p('M4 8h12v5a5 5 0 01-5 5H9a5 5 0 01-5-5V8z'), p('M16 9h2a2.5 2.5 0 010 5h-2'), p('M7 3v2M11 3v2')),
  pizza: I(p('M12 3L3 20h18L12 3z'), c(11, 12, 1), c(14, 16, 1), c(9, 16, 1)),
  burger: I(p('M4 9a8 8 0 0116 0H4z'), p('M3 13h18'), p('M4 17h16a3 3 0 01-3 3H7a3 3 0 01-3-3z')),
  cake: I(p('M4 21h16v-7a3 3 0 00-3-3H7a3 3 0 00-3 3v7z'), p('M12 8V5'), p('M4 16c2 1.5 3 1.5 4 0s2-1.5 4 0 3 1.5 4 0 2-1.5 4 0')),
  drink: I(p('M5 4h14l-6 8v7'), p('M9 19h6'), p('M7 8h10')),
  groceries: I(p('M3 5h2l2.2 10.2A2 2 0 009.2 17h7.9a2 2 0 002-1.6L21 8H6'), c(9.5, 20, 1.2), c(17.5, 20, 1.2)),
  basket: I(p('M4 9h16l-1.6 9.1a2 2 0 01-2 1.9H7.6a2 2 0 01-2-1.9L4 9z'), p('M8 9L10 4M16 9l-2-5')),

  // ---- Transport ----------------------------------------------------------
  car: I(p('M5 16h14M4 16l1.6-5.2A2 2 0 017.5 9.4h9a2 2 0 011.9 1.4L20 16v3h-2.5v-1.5h-11V19H4v-3z'), c(7.5, 16.5, 1), c(16.5, 16.5, 1)),
  motorcycle: I(c(5.5, 17, 3), c(18.5, 17, 3), p('M8.5 17h5l3-6h-4'), p('M14 7h3l1.5 4')),
  bus: I(r(4, 4, 16, 13, 3), p('M4 11h16'), c(8, 19, 1.2), c(16, 19, 1.2), p('M6 17v2M18 17v2')),
  train: I(r(5, 3, 14, 13, 3), p('M5 11h14'), p('M8 20l-2 2M16 20l2 2'), c(9, 13.5, 1), c(15, 13.5, 1)),
  plane: I(p('M10 3.5a1.5 1.5 0 013 0V9l8 4.5v2L13 13v4.5l2.5 2v1.5L11.5 20 8 21v-1.5L10.5 17.5V13L2.5 15.5v-2L10 9V3.5z')),
  bike: I(c(5.5, 17.5, 3.5), c(18.5, 17.5, 3.5), p('M9 17.5l3.5-7h4'), p('M12.5 10.5L11 7h-2'), p('M14 7h3')),
  fuel: I(p('M4 20V5a2 2 0 012-2h5a2 2 0 012 2v15'), p('M3 20h12'), p('M13 9h3a2 2 0 012 2v6a1.5 1.5 0 003 0v-7l-2.5-3'), p('M6 8h5')),
  parking: I(r(4, 4, 16, 16, 3), p('M10 16V9h2.8a2.6 2.6 0 010 5.2H10')),
  boat: I(p('M4 17l1.5-5h13L20 17'), p('M12 12V6l5 4'), p('M3 19c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0')),

  // ---- Home & bills -------------------------------------------------------
  home: I(p('M3 11l9-7 9 7'), p('M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9')),
  bed: I(p('M3 19v-9h13a5 5 0 015 5v4'), p('M3 15h18'), c(7.5, 12.5, 1.8)),
  sofa: I(p('M4 12V8a2 2 0 012-2h12a2 2 0 012 2v4'), p('M3 12a2 2 0 012 2v3h14v-3a2 2 0 012-2v6H3v-6z'), p('M7 12h10')),
  lightbulb: I(p('M9 18h6'), p('M10 21h4'), p('M12 3a6 6 0 00-3.5 10.9c.5.4.8 1 .8 1.6V16h5.4v-.5c0-.6.3-1.2.8-1.6A6 6 0 0012 3z')),
  zap: I(p('M13 2L4 14h7l-1 8 9-12h-7l1-8z')),
  droplet: I(p('M12 3s6 6.2 6 10a6 6 0 01-12 0c0-3.8 6-10 6-10z')),
  flame: I(p('M12 22a6 6 0 006-6c0-5-6-10-6-10S6 11 6 16a6 6 0 006 6z'), p('M12 22a2.5 2.5 0 002.5-2.5c0-2-2.5-4-2.5-4s-2.5 2-2.5 4A2.5 2.5 0 0012 22z')),
  wifi: I(p('M2.5 9a15 15 0 0119 0'), p('M5.5 12.5a10.5 10.5 0 0113 0'), p('M8.5 16a6 6 0 017 0'), c(12, 19.5, 1)),
  tv: I(r(3, 6, 18, 12, 3), p('M8 3l4 3 4-3')),
  wrench: I(p('M15 3a5 5 0 00-4.6 7l-6.8 6.8a2 2 0 102.8 2.8L13.2 13A5 5 0 0019 6.6L16.2 9.4 14 8.4 13 6.2 15.8 3.4A5 5 0 0015 3z')),
  trash: I(p('M4 7h16'), p('M9 7V5h6v2'), p('M6 7l1 13h10l1-13'), p('M10 11v6M14 11v6')),
  laundry: I(r(4, 3, 16, 18, 3), c(12, 14, 4.5), p('M8 6.5h.01M11 6.5h.01')),

  // ---- Health & personal --------------------------------------------------
  'heart-pulse': I(p('M12 20s-7-4.5-7-9.5A4.5 4.5 0 0112 8a4.5 4.5 0 017 2.5c0 5-7 9.5-7 9.5z'), p('M4 13h3l1.5-3 2 5 1.5-2h4')),
  heart: I(p('M12 20s-7-4.5-7-9.5A4.5 4.5 0 0112 8a4.5 4.5 0 017 2.5c0 5-7 9.5-7 9.5z')),
  pill: I(p('M8 3a5 5 0 015 5v8a5 5 0 01-10 0V8a5 5 0 015-5z'), p('M3 12h10'), p('M15 14l6-6a3.5 3.5 0 00-5-5l-2.5 2.5')),
  stethoscope: I(p('M6 3v5a4 4 0 008 0V3'), p('M6 3H4M14 3h2'), p('M10 12v3a5 5 0 0010 0v-1'), c(20, 11.5, 2)),
  tooth: I(p('M8 3c-2.5 0-4 2-4 4.5 0 4 2 5.5 2.5 9.5.3 2.4.8 4 2 4s1.5-2 2-4.5c.3-1.5.7-2 1.5-2s1.2.5 1.5 2c.5 2.5.8 4.5 2 4.5s1.7-1.6 2-4c.5-4 2.5-5.5 2.5-9.5C20 5 18.5 3 16 3c-1.6 0-2.6 1-4 1s-2.4-1-4-1z')),
  glasses: I(c(6, 14, 3.5), c(18, 14, 3.5), p('M9.5 14h5'), p('M2.5 11l2-5h2M21.5 11l-2-5h-2')),
  dumbbell: I(p('M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6'), p('M6.5 12h11')),
  scissors: I(c(6, 6, 2.5), c(6, 18, 2.5), p('M8 7.5L20 18M8 16.5L20 6')),
  sparkles: I(p('M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z'), p('M18 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z')),
  shirt: I(p('M8 3l4 2 4-2 5 3-2.5 4L17 9v11H7V9l-1.5.9L3 6l5-3z')),
  shoe: I(p('M3 16v-6h4l3 2.5 4 .5c3 .4 7 1.2 7 3.5v2H3v-2z'), p('M7 10l1 3')),

  // ---- Family, learning, giving ------------------------------------------
  family: I(c(8, 8, 3), c(17, 9, 2.3), p('M2.5 19c.8-3.3 3-5 5.5-5s4.7 1.7 5.5 5'), p('M15.5 19c.4-2.3 1.7-3.6 3.2-3.6 1.4 0 2.4.9 2.8 2.6')),
  baby: I(c(12, 9, 5), p('M9.5 8.5h.01M14.5 8.5h.01'), p('M10 11.5c1.2.9 2.8.9 4 0'), p('M7 14l-2 6M17 14l2 6'), p('M9 21h6')),
  pets: I(c(6, 9, 2.2), c(10.5, 6.5, 2.2), c(15.5, 6.5, 2.2), c(19, 10, 2.2), p('M12 12c-2.5 0-5 2.2-5 4.6 0 1.8 1.3 2.9 3 2.9 1.2 0 1.6-.5 2-.5s.8.5 2 .5c1.7 0 3-1.1 3-2.9C17 14.2 14.5 12 12 12z')),
  'graduation-cap': I(p('M2.5 9L12 5l9.5 4L12 13 2.5 9z'), p('M6.5 11v4.5c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V11'), p('M21.5 9v5')),
  book: I(p('M4 4.5A1.5 1.5 0 015.5 3H19v16H5.5A1.5 1.5 0 004 20.5v-16z'), p('M4 17.5A1.5 1.5 0 015.5 16H19'), p('M8 7h7')),
  church: I(p('M12 2v5M10 4h4'), p('M12 7l6 4v10H6V11l6-4z'), p('M10 21v-4a2 2 0 014 0v4')),
  charity: I(p('M12 21s-6-3.8-6-8.2A3.8 3.8 0 0112 10a3.8 3.8 0 016 2.8c0 4.4-6 8.2-6 8.2z'), p('M5 8.5L7 3h10l2 5.5')),
  gift: I(r(3, 8, 18, 5, 1), p('M5 13v8h14v-8'), p('M12 8v13'), p('M12 8S9.5 8 8.5 7A2 2 0 0112 5.2 2 2 0 0115.5 7C14.5 8 12 8 12 8z')),

  // ---- Money & work -------------------------------------------------------
  banknote: I(r(2.5, 6, 19, 12, 2.5), c(12, 12, 2.8), p('M6 10v4M18 10v4')),
  coins: I(c(8, 8, 5), p('M13.5 4.7A5 5 0 0121 9.5a5 5 0 01-5.8 4.9'), p('M3.4 13.5A5 5 0 008 16.9'), p('M10.6 19.3A5 5 0 0021 15')),
  wallet: I(p('M3 7a2 2 0 012-2h12v4'), p('M3 7v10a2 2 0 002 2h14a1 1 0 001-1v-8a1 1 0 00-1-1H5'), c(17, 13, 1.2)),
  'credit-card': I(r(2.5, 5, 19, 14, 2.5), p('M2.5 10h19'), p('M6 15h4')),
  'piggy-bank': I(p('M4 12a7 7 0 017-6h2a7 7 0 016.5 4.5l2 .8V15l-2 .5A7 7 0 0116 19v2h-3v-1.5h-3V21H7v-2.4A7 7 0 014 14v-2z'), c(15.5, 11.5, 1), p('M4.5 11.5A2.5 2.5 0 013 8.2'), p('M8 6.5L7 3.5')),
  landmark: I(p('M3 10l9-6 9 6'), p('M5 10v8M10 10v8M14 10v8M19 10v8'), p('M2.5 21h19')),
  'trending-up': I(p('M3 17l6-6 4 4 8-8'), p('M15 7h6v6')),
  'trending-down': I(p('M3 7l6 6 4-4 8 8'), p('M15 17h6v-6')),
  receipt: I(p('M5 3h14v18l-2.3-1.6L14.4 21l-2.4-1.6L9.6 21l-2.3-1.6L5 21V3z'), p('M9 8h6M9 12h6')),
  calculator: I(r(4, 3, 16, 18, 3), r(7.5, 6.5, 9, 3.5, 1), p('M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01M16 17.5h.01')),
  briefcase: I(r(3, 7, 18, 13, 2.5), p('M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2'), p('M3 12h18')),
  laptop: I(r(4, 5, 16, 11, 2), p('M2 19h20'), p('M10 19h4')),
  handshake: I(p('M6 11l3-3 3 2 3-2 3 3'), p('M3 10l3-3 3 3'), p('M21 10l-3-3-3 3'), p('M8 13l3 3 2-1 2 2 2-2')),
  percent: I(c(7, 7, 3), c(17, 17, 3), p('M19 5L5 19')),
  shield: I(p('M12 3l8 3v5.5c0 5-3.4 8.6-8 9.5-4.6-.9-8-4.5-8-9.5V6l8-3z'), p('M9 12l2 2 4-4')),
  umbrella: I(p('M12 3a9 9 0 019 9H3a9 9 0 019-9z'), p('M12 12v6.5a2.5 2.5 0 004.5 1.5'), p('M12 3V1.5')),

  // ---- Tech, fun, misc ----------------------------------------------------
  phone: I(r(6, 2.5, 12, 19, 3), p('M10.5 5.5h3'), p('M11 18.5h2')),
  monitor: I(r(2.5, 4, 19, 12, 2.5), p('M8 20h8M12 16v4')),
  gamepad: I(p('M7 8h10a5 5 0 014.6 7l-1 2.4A2.5 2.5 0 0116 18l-1.5-2h-5L8 18a2.5 2.5 0 01-4.6-.6l-1-2.4A5 5 0 017 8z'), p('M8 11v3M6.5 12.5h3'), c(16, 12, 1), c(18, 14, 1)),
  headphones: I(p('M4 14v-2a8 8 0 0116 0v2'), p('M4 14h2.5a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-5z'), p('M20 14h-2.5a1 1 0 00-1 1v4a1 1 0 001 1H19a1 1 0 001-1v-5z')),
  music: I(c(6, 18, 3), c(17, 16, 3), p('M9 18V6l11-2v12')),
  film: I(r(2.5, 4, 19, 16, 2.5), p('M7 4v16M17 4v16'), p('M2.5 12h19M2.5 8h4.5M17 8h4.5M2.5 16h4.5M17 16h4.5')),
  camera: I(p('M3 8h4l1.5-2.5h7L17 8h4v11H3V8z'), c(12, 13, 3.5)),
  ticket: I(p('M3 8V6h18v2a2.5 2.5 0 000 5v6H3v-6a2.5 2.5 0 000-5z'), p('M13 6v13')),
  repeat: I(p('M4 8h13l-3-3'), p('M20 16H7l3 3'), p('M20 8v4M4 16v-4')),
  calendar: I(r(3, 5, 18, 16, 3), p('M3 10h18M8 3v4M16 3v4'), p('M8 14h.01M12 14h.01M16 14h.01')),
  clock: I(c(12, 12, 9), p('M12 7v5.5l3.5 2')),
  'map-pin': I(p('M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z'), c(12, 10, 2.6)),
  package: I(p('M3 8l9-4 9 4v8l-9 4-9-4V8z'), p('M3 8l9 4 9-4M12 12v8'), p('M7.5 6l9 4')),
  truck: I(p('M2.5 6h11v10h-11z'), p('M13.5 9.5H18l3 3V16h-7.5'), c(7, 18, 1.8), c(17, 18, 1.8)),
  star: I(p('M12 3.5l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.9l6-.8L12 3.5z')),
  tag: I(p('M3 11V4h7l11 11-7 7L3 11z'), c(7.5, 7.5, 1.4)),
  folder: I(p('M3 7a2 2 0 012-2h4l2 2.5h8a2 2 0 012 2V18a1 1 0 01-1 1H4a1 1 0 01-1-1V7z')),
  circle: I(c(12, 12, 8.5)),
}

export const ICON_GROUPS: Array<{ label: string; icons: string[] }> = [
  { label: 'Food & drink', icons: ['utensils', 'coffee', 'pizza', 'burger', 'cake', 'drink', 'groceries', 'basket'] },
  { label: 'Transport', icons: ['car', 'motorcycle', 'bus', 'train', 'plane', 'bike', 'fuel', 'parking', 'boat'] },
  { label: 'Home & bills', icons: ['home', 'bed', 'sofa', 'lightbulb', 'zap', 'droplet', 'flame', 'wifi', 'tv', 'wrench', 'trash', 'laundry'] },
  { label: 'Health & personal', icons: ['heart-pulse', 'heart', 'pill', 'stethoscope', 'tooth', 'glasses', 'dumbbell', 'scissors', 'sparkles', 'shirt', 'shoe'] },
  { label: 'Family & giving', icons: ['family', 'baby', 'pets', 'graduation-cap', 'book', 'church', 'charity', 'gift'] },
  { label: 'Money & work', icons: ['banknote', 'coins', 'wallet', 'credit-card', 'piggy-bank', 'landmark', 'trending-up', 'trending-down', 'receipt', 'calculator', 'briefcase', 'laptop', 'handshake', 'percent', 'shield', 'umbrella'] },
  { label: 'Tech & fun', icons: ['phone', 'monitor', 'gamepad', 'headphones', 'music', 'film', 'camera', 'ticket'] },
  { label: 'Other', icons: ['repeat', 'calendar', 'clock', 'map-pin', 'package', 'truck', 'star', 'tag', 'folder', 'circle'] },
]

export const ALL_ICON_IDS = Object.keys(ICON_PATHS)

export function CategoryIcon({ name, size = 20 }: { name: string; size?: number }) {
  const shapes = ICON_PATHS[name] ?? ICON_PATHS.circle
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shapes.map((s, i) => {
        if (s.t === 'p') return <path key={i} d={s.d} />
        if (s.t === 'c') return <circle key={i} cx={s.cx} cy={s.cy} r={s.r} />
        return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} />
      })}
    </svg>
  )
}

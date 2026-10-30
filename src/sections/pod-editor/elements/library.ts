import { ARTWORKS } from './artworks'
import { SCENES, type SceneKind } from './scenes'

// Built-in element library: editable shapes, curved / stacked text presets and
// themed illustration sets. Everything is vector (SVG / Fabric text) so it stays
// sharp at print resolution.

export type TextPart = {
  text: string
  font: string
  size: number
  fill: string
  weight?: 'normal' | 'bold'
  italic?: boolean
  /** Fabric charSpacing (1/1000 em) */
  spacing?: number
  stroke?: string
  strokeWidth?: number
  /**
   * Vertical position in the 200 × 200 preset box. Straight text: the baseline.
   * Arch: the top of the letters at the apex (they hang below the arc).
   * Smile: the bottom of the letters at the apex (they stand on the arc).
   */
  y: number
  /** Bend along a circle of this radius: positive = arch (rainbow), negative = smile. */
  curve?: number
}

export type ElementItem =
  | {
      id: string
      name: string
      kind: 'svg'
      svg: string
      editable?: boolean
      /** Painterly scene (gradients, depth) rather than a flat icon */
      art?: boolean
      /** Large illustrated scene (landscape or character piece) */
      scene?: SceneKind
      /** Width / height, for scenes (tiles keep the picture's proportions) */
      aspect?: number
    }
  | { id: string; name: string; kind: 'text'; parts: TextPart[] }

export interface ElementCategory {
  id: string
  title: string
  /** Shown as a chip next to the title */
  badge?: string
  items: ElementItem[]
}

/** Fonts used by text presets (loaded from Google Fonts in the root layout). */
export const LIBRARY_FONTS = [
  'Abril Fatface',
  'Anton',
  'Archivo Black',
  'Bebas Neue',
  'Caveat',
  'Lobster',
  'Oswald',
  'Pacifico',
  'Permanent Marker',
  'Playfair Display',
  'Righteous',
  'Satisfy',
]

// ── Shapes (single fill, recolorable) ──

const SHAPE_FILL = '#5f5b45'

function polygonPoints(sides: number, r: number, inner?: number, rotate = -90) {
  const pts: string[] = []
  const n = inner ? sides * 2 : sides
  for (let i = 0; i < n; i++) {
    const radius = inner && i % 2 === 1 ? inner : r
    const a = ((rotate + (360 / n) * i) * Math.PI) / 180
    pts.push(`${(50 + radius * Math.cos(a)).toFixed(2)},${(50 + radius * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
}

/** Horizontal slice [y1, y2] of the circle (50, 50, r = 44), as a path. */
function circleBand(y1: number, y2: number, r = 44) {
  const x = (y: number) => Math.sqrt(Math.max(0, r * r - (y - 50) ** 2))
  const a = x(y1)
  const b = x(y2)
  return `M ${(50 - a).toFixed(2)} ${y1} H ${(50 + a).toFixed(2)} A ${r} ${r} 0 0 1 ${(50 + b).toFixed(2)} ${y2} H ${(50 - b).toFixed(2)} A ${r} ${r} 0 0 1 ${(50 - a).toFixed(2)} ${y1}Z`
}

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`
const shape = (id: string, name: string, body: string): ElementItem => ({
  id,
  name,
  kind: 'svg',
  editable: true,
  svg: svg(body.replaceAll('FILL', SHAPE_FILL)),
})

const SHAPES: ElementItem[] = [
  shape('star', 'Star', `<polygon fill="FILL" points="${polygonPoints(5, 46, 19)}"/>`),
  shape('heart', 'Heart', '<path fill="FILL" d="M50 88 C20 66 6 50 6 32 C6 18 17 8 30 8 C39 8 46 13 50 20 C54 13 61 8 70 8 C83 8 94 18 94 32 C94 50 80 66 50 88Z"/>'),
  shape('line', 'Line', '<rect fill="FILL" x="4" y="47" width="92" height="6" rx="1"/>'),
  shape('triangle', 'Triangle', `<polygon fill="FILL" points="${polygonPoints(3, 50, undefined)}" transform="translate(0 8)"/>`),
  shape('circle', 'Circle', '<circle fill="FILL" cx="50" cy="50" r="46"/>'),
  shape('square', 'Square', '<rect fill="FILL" x="6" y="6" width="88" height="88"/>'),
  shape('rounded', 'Rounded square', '<rect fill="FILL" x="6" y="6" width="88" height="88" rx="20"/>'),
  shape('hexagon', 'Hexagon', `<polygon fill="FILL" points="${polygonPoints(6, 47, undefined, 0)}"/>`),
  shape('pentagon', 'Pentagon', `<polygon fill="FILL" points="${polygonPoints(5, 47)}"/>`),
  shape('diamond', 'Diamond', '<polygon fill="FILL" points="50,4 92,50 50,96 8,50"/>'),
  shape('burst', 'Burst', `<polygon fill="FILL" points="${polygonPoints(14, 48, 38)}"/>`),
  shape('star4', 'Sparkle', '<path fill="FILL" d="M50 2 C54 34 66 46 98 50 C66 54 54 66 50 98 C46 66 34 54 2 50 C34 46 46 34 50 2Z"/>'),
  shape('arrow', 'Arrow', '<path fill="FILL" d="M4 40 H58 V20 L96 50 L58 80 V60 H4Z"/>'),
  shape('bubble', 'Speech bubble', '<path fill="FILL" d="M14 10 H86 Q94 10 94 18 V62 Q94 70 86 70 H40 L22 88 V70 H14 Q6 70 6 62 V18 Q6 10 14 10Z"/>'),
  shape('plus', 'Plus', '<path fill="FILL" d="M38 6 H62 V38 H94 V62 H62 V94 H38 V62 H6 V38 H38Z"/>'),
  shape('ring', 'Ring', '<path fill="FILL" fill-rule="evenodd" d="M50 4 A46 46 0 1 1 49.99 4Z M50 22 A28 28 0 1 0 50.01 22Z"/>'),
  shape('crescent', 'Crescent', '<path fill="FILL" d="M62 6 A45 45 0 1 0 94 64 A36 36 0 1 1 62 6Z"/>'),
  shape('arch', 'Arch', '<path fill="FILL" d="M8 94 V50 A42 42 0 0 1 92 50 V94Z"/>'),
]

// ── Text presets (200 × 200 design box, y = baseline) ──

const INK = '#2b2622'

const CURVED_TEXT: ElementItem[] = [
  {
    id: 'ct-sarcasm', name: 'Sarcasm University', kind: 'text', parts: [
      { text: 'SARCASM', font: 'Archivo Black', size: 30, fill: '#ffffff', stroke: INK, strokeWidth: 1.6, spacing: 60, y: 70, curve: 190 },
      { text: 'UNIVERSITY', font: 'Oswald', size: 13, fill: INK, spacing: 400, y: 130 },
    ],
  },
  {
    id: 'ct-progress', name: 'Progress over perfection', kind: 'text', parts: [
      { text: 'Progress', font: 'Pacifico', size: 38, fill: INK, y: 104, curve: -300 },
      { text: 'OVER', font: 'Oswald', size: 13, fill: INK, spacing: 200, y: 128 },
      { text: 'PERFECTION', font: 'Oswald', size: 13, fill: INK, spacing: 200, y: 144 },
    ],
  },
  {
    id: 'ct-good-vibes', name: 'Good vibes only', kind: 'text', parts: [
      { text: 'GOOD VIBES', font: 'Righteous', size: 30, fill: '#e0703f', y: 62, curve: 170 },
      { text: 'ONLY', font: 'Righteous', size: 30, fill: '#e9a23b', y: 142, curve: -170 },
    ],
  },
  {
    id: 'ct-wholeness', name: 'Wholeness est. 1998', kind: 'text', parts: [
      { text: 'WHOLENESS', font: 'Playfair Display', size: 30, fill: INK, weight: 'bold', spacing: 40, y: 76, curve: 230 },
      { text: 'EST. 1998', font: 'Oswald', size: 11, fill: INK, spacing: 300, y: 130 },
    ],
  },
  {
    id: 'ct-stay-wild', name: 'Stay wild moon child', kind: 'text', parts: [
      { text: 'STAY WILD', font: 'Bebas Neue', size: 40, fill: '#3f4a6b', spacing: 80, y: 58, curve: 180 },
      { text: 'MOON CHILD', font: 'Bebas Neue', size: 26, fill: '#c9a24a', spacing: 120, y: 143, curve: -180 },
    ],
  },
  {
    id: 'ct-adventure', name: 'Adventure awaits', kind: 'text', parts: [
      { text: 'ADVENTURE', font: 'Anton', size: 34, fill: '#2f6b4f', spacing: 50, y: 67, curve: 200 },
      { text: 'awaits', font: 'Satisfy', size: 30, fill: '#d47c5a', y: 134 },
    ],
  },
  {
    id: 'ct-coffee', name: 'But first coffee', kind: 'text', parts: [
      { text: 'BUT FIRST', font: 'Oswald', size: 18, fill: '#6b4a35', weight: 'bold', spacing: 300, y: 67, curve: 150 },
      { text: 'Coffee', font: 'Lobster', size: 44, fill: '#6b4a35', y: 128 },
    ],
  },
  {
    id: 'ct-summer', name: 'Endless summer', kind: 'text', parts: [
      { text: 'ENDLESS', font: 'Abril Fatface', size: 32, fill: '#e2574c', spacing: 40, y: 68, curve: 200 },
      { text: 'SUMMER', font: 'Abril Fatface', size: 32, fill: '#f1a33c', spacing: 40, y: 150, curve: -200 },
    ],
  },
]

const TEXT_ELEMENTS: ElementItem[] = [
  {
    id: 'te-happy', name: 'Happy and dazzling', kind: 'text', parts: [
      { text: 'HAPPY', font: 'Bebas Neue', size: 46, fill: '#4bb3b0', spacing: 80, y: 78 },
      { text: 'AND', font: 'Oswald', size: 16, fill: '#e9a23b', weight: 'bold', spacing: 300, y: 104 },
      { text: 'DAZZLING', font: 'Bebas Neue', size: 46, fill: '#e2574c', spacing: 60, y: 148 },
    ],
  },
  {
    id: 'te-bride', name: 'Bride crew', kind: 'text', parts: [
      { text: 'BRIDE', font: 'Playfair Display', size: 50, fill: INK, spacing: 60, y: 98 },
      { text: 'crew', font: 'Satisfy', size: 34, fill: INK, y: 134 },
    ],
  },
  {
    id: 'te-mama-bear', name: 'Mama bear', kind: 'text', parts: [
      { text: 'MAMA', font: 'Anton', size: 54, fill: '#7a4b35', spacing: 40, y: 96 },
      { text: 'BEAR', font: 'Anton', size: 54, fill: '#c98a5a', spacing: 40, y: 152 },
    ],
  },
  {
    id: 'te-live-laugh', name: 'Live laugh love', kind: 'text', parts: [
      { text: 'live', font: 'Caveat', size: 40, fill: '#d47c5a', weight: 'bold', y: 72 },
      { text: 'laugh', font: 'Caveat', size: 40, fill: '#8a9f6e', weight: 'bold', y: 110 },
      { text: 'love', font: 'Caveat', size: 40, fill: '#c8383b', weight: 'bold', y: 148 },
    ],
  },
  {
    id: 'te-hometown', name: 'Hometown pride', kind: 'text', parts: [
      { text: 'EST. 2025', font: 'Oswald', size: 13, fill: INK, spacing: 400, y: 70 },
      { text: 'HOMETOWN', font: 'Archivo Black', size: 30, fill: INK, y: 106 },
      { text: 'PRIDE', font: 'Permanent Marker', size: 36, fill: '#c8383b', y: 146 },
    ],
  },
  {
    id: 'te-birthday', name: 'Birthday squad', kind: 'text', parts: [
      { text: 'BIRTHDAY', font: 'Righteous', size: 36, fill: '#9a6fb0', spacing: 40, y: 94 },
      { text: 'SQUAD', font: 'Righteous', size: 44, fill: '#e9a23b', spacing: 120, y: 142 },
    ],
  },
  {
    id: 'te-no-bad-days', name: 'No bad days', kind: 'text', parts: [
      { text: 'no bad', font: 'Permanent Marker', size: 38, fill: '#3f4a6b', y: 94 },
      { text: 'DAYS', font: 'Bebas Neue', size: 58, fill: '#e0703f', spacing: 160, y: 148 },
    ],
  },
  {
    id: 'te-dog-mom', name: 'Dog mom', kind: 'text', parts: [
      { text: 'Dog', font: 'Lobster', size: 52, fill: '#7a4b35', y: 96 },
      { text: 'MOM', font: 'Oswald', size: 30, fill: INK, weight: 'bold', spacing: 500, y: 138 },
    ],
  },
  {
    id: 'te-stay-cozy', name: 'Stay cozy', kind: 'text', parts: [
      { text: 'stay', font: 'Satisfy', size: 36, fill: '#b5654a', y: 86 },
      { text: 'COZY', font: 'Abril Fatface', size: 56, fill: '#5f5b45', spacing: 60, y: 140 },
    ],
  },
]

// ── Illustrations (multi-color, 100 × 100) ──

const art = (id: string, name: string, body: string): ElementItem => ({ id, name, kind: 'svg', svg: svg(body) })

const HALLOWEEN: ElementItem[] = [
  art('hw-pumpkin', 'Jack-o’-lantern', `
    <path fill="#4f7a3a" d="M47 20 Q46 10 54 6 L57 10 Q52 13 53 20Z"/>
    <ellipse cx="32" cy="58" rx="24" ry="32" fill="#e8742a"/>
    <ellipse cx="68" cy="58" rx="24" ry="32" fill="#e8742a"/>
    <ellipse cx="50" cy="58" rx="22" ry="34" fill="#f28c28"/>
    <path fill="#2b2233" d="M30 46 L40 38 L42 52Z M70 46 L60 38 L58 52Z M47 58 L50 52 L53 58Z M28 66 Q50 86 72 66 L66 68 L62 74 L57 70 L50 76 L43 70 L38 74 L34 68Z"/>`),
  art('hw-ghost', 'Ghost', `
    <path fill="#f6f1ea" stroke="#2b2233" stroke-width="2.5" d="M22 88 V44 A28 28 0 0 1 78 44 V88 L70 80 L62 88 L54 80 L46 88 L38 80 L30 88Z"/>
    <ellipse cx="40" cy="46" rx="4.5" ry="6.5" fill="#2b2233"/><ellipse cx="60" cy="46" rx="4.5" ry="6.5" fill="#2b2233"/>
    <ellipse cx="50" cy="60" rx="5" ry="6" fill="#2b2233"/>
    <circle cx="32" cy="56" r="4" fill="#f4b6b6"/><circle cx="68" cy="56" r="4" fill="#f4b6b6"/>`),
  art('hw-bat', 'Bat', `
    <path fill="#2b2233" d="M50 38 Q44 30 46 24 L50 30 L54 24 Q56 30 50 38Z M50 36 C40 36 36 44 36 50 C28 42 16 40 4 44 C12 48 14 56 12 62 C20 56 28 58 32 64 C36 58 42 58 44 62 L50 58 L56 62 C58 58 64 58 68 64 C72 58 80 56 88 62 C86 56 88 48 96 44 C84 40 72 42 64 50 C64 44 60 36 50 36Z"/>
    <circle cx="46" cy="44" r="2" fill="#f2c94c"/><circle cx="54" cy="44" r="2" fill="#f2c94c"/>`),
  art('hw-witch-hat', 'Witch hat', `
    <ellipse cx="50" cy="80" rx="44" ry="10" fill="#3a2d4a"/>
    <path fill="#4b3a5f" d="M28 78 L46 14 Q50 8 56 14 L64 28 L58 30 L72 78Z"/>
    <path fill="#e8742a" d="M30 70 H70 L72 78 H28Z"/>
    <rect x="44" y="68" width="12" height="12" rx="2" fill="none" stroke="#f2c94c" stroke-width="3"/>`),
  art('hw-skull', 'Skull', `
    <path fill="#f6f1ea" stroke="#2b2233" stroke-width="2.5" d="M50 10 C26 10 14 28 16 48 C17 58 22 64 30 66 V80 Q30 88 38 88 H62 Q70 88 70 80 V66 C78 64 83 58 84 48 C86 28 74 10 50 10Z"/>
    <circle cx="36" cy="46" r="9" fill="#2b2233"/><circle cx="64" cy="46" r="9" fill="#2b2233"/>
    <path fill="#2b2233" d="M50 56 L45 66 H55Z"/>
    <path stroke="#2b2233" stroke-width="2.5" d="M40 76 V88 M50 76 V88 M60 76 V88"/>`),
  art('hw-spider', 'Spider web', `
    <g fill="none" stroke="#6b5c7a" stroke-width="1.6">
      <path d="M50 4 V96 M4 50 H96 M17 17 L83 83 M83 17 L17 83"/>
      <path d="M50 18 Q61 28 73 27 Q72 39 82 50 Q72 61 73 73 Q61 72 50 82 Q39 72 27 73 Q28 61 18 50 Q28 39 27 27 Q39 28 50 18Z"/>
      <path d="M50 32 Q56 38 63 37 Q62 44 68 50 Q62 56 63 63 Q56 62 50 68 Q44 62 37 63 Q38 56 32 50 Q38 44 37 37 Q44 38 50 32Z"/>
    </g>
    <path stroke="#2b2233" stroke-width="1.4" d="M70 4 V58"/>
    <g stroke="#2b2233" stroke-width="2.2" fill="none" stroke-linecap="round">
      <path d="M64 62 L56 56 M64 66 L54 66 M64 70 L56 76 M76 62 L84 56 M76 66 L86 66 M76 70 L84 76"/>
    </g>
    <ellipse cx="70" cy="66" rx="7" ry="8" fill="#2b2233"/><circle cx="70" cy="57" r="4.5" fill="#2b2233"/>`),
]

const CHRISTMAS: ElementItem[] = [
  art('xm-tree', 'Christmas tree', `
    <rect x="44" y="80" width="12" height="14" fill="#7a4b35"/>
    <path fill="#2f7d4f" d="M50 10 L72 40 H62 L80 62 H68 L88 84 H12 L32 62 H20 L38 40 H28Z"/>
    <path fill="#e9b44c" d="M50 2 L53 9 H60 L54 13 L56 20 L50 16 L44 20 L46 13 L40 9 H47Z"/>
    <circle cx="44" cy="36" r="3" fill="#c8383b"/><circle cx="58" cy="52" r="3" fill="#e9b44c"/>
    <circle cx="38" cy="60" r="3" fill="#e9b44c"/><circle cx="64" cy="74" r="3" fill="#c8383b"/><circle cx="30" cy="78" r="3" fill="#5b8db8"/>`),
  art('xm-ornament', 'Ornament', `
    <rect x="42" y="10" width="16" height="10" rx="2" fill="#e9b44c"/>
    <circle cx="50" cy="58" r="36" fill="#c8383b"/>
    <path fill="#a82c30" d="M14 58 A36 36 0 0 0 86 58 Q50 70 14 58Z"/>
    <path fill="none" stroke="#f6f1ea" stroke-width="3" d="M18 46 Q50 60 82 46"/>
    <path fill="#e9b44c" d="M50 34 L53 42 H61 L55 47 L57 55 L50 50 L43 55 L45 47 L39 42 H47Z"/>
    <ellipse cx="34" cy="38" rx="6" ry="9" fill="#ffffff" opacity="0.35" transform="rotate(30 34 38)"/>`),
  art('xm-gift', 'Gift box', `
    <rect x="14" y="40" width="72" height="52" rx="4" fill="#2f7d4f"/>
    <rect x="10" y="30" width="80" height="16" rx="3" fill="#3a9461"/>
    <rect x="44" y="30" width="12" height="62" fill="#c8383b"/>
    <path fill="#c8383b" d="M50 30 C40 14 22 16 28 26 C32 32 44 30 50 30Z M50 30 C60 14 78 16 72 26 C68 32 56 30 50 30Z"/>`),
  art('xm-snowflake', 'Snowflake', `
    <g stroke="#5b8db8" stroke-width="5" stroke-linecap="round" fill="none">
      <path d="M50 6 V94 M12 28 L88 72 M12 72 L88 28"/>
      <path d="M40 14 L50 24 L60 14 M40 86 L50 76 L60 86 M16 40 L28 34 L22 22 M84 60 L72 66 L78 78 M16 60 L28 66 L22 78 M84 40 L72 34 L78 22"/>
    </g>`),
  art('xm-candy', 'Candy cane', `
    <path fill="none" stroke="#f6f1ea" stroke-width="14" stroke-linecap="round" d="M60 92 V34 A16 16 0 0 0 28 34"/>
    <path fill="none" stroke="#c8383b" stroke-width="14" stroke-linecap="round" stroke-dasharray="7 7" d="M60 92 V34 A16 16 0 0 0 28 34"/>
    <path fill="none" stroke="#2b2233" stroke-opacity="0.15" stroke-width="2" d="M67 92 V34 A23 23 0 0 0 21 34"/>`),
  art('xm-snowman', 'Snowman', `
    <circle cx="50" cy="70" r="24" fill="#f6f1ea" stroke="#c9d6e3" stroke-width="2"/>
    <circle cx="50" cy="34" r="17" fill="#f6f1ea" stroke="#c9d6e3" stroke-width="2"/>
    <rect x="36" y="8" width="28" height="14" rx="2" fill="#2b2233"/><rect x="30" y="19" width="40" height="5" rx="2" fill="#2b2233"/>
    <circle cx="44" cy="32" r="2.2" fill="#2b2233"/><circle cx="56" cy="32" r="2.2" fill="#2b2233"/>
    <path fill="#e8742a" d="M50 37 L64 40 L50 41Z"/>
    <path fill="#c8383b" d="M34 48 Q50 56 66 48 L66 54 Q50 60 34 54Z M58 54 L64 70 L56 70Z"/>
    <circle cx="50" cy="66" r="2.5" fill="#2b2233"/><circle cx="50" cy="76" r="2.5" fill="#2b2233"/>`),
]

const LOVE: ElementItem[] = [
  art('lv-arrow', 'Heart & arrow', `
    <path fill="#e2574c" d="M50 86 C24 66 10 52 10 35 C10 22 20 13 32 13 C40 13 46 17 50 24 C54 17 60 13 68 13 C80 13 90 22 90 35 C90 52 76 66 50 86Z"/>
    <path fill="#ffffff" opacity="0.3" d="M24 30 Q26 22 34 21 Q28 26 28 34Z"/>
    <path stroke="#7a4b35" stroke-width="3.5" d="M8 76 L92 22"/>
    <path fill="#e9b44c" d="M92 22 L80 22 L86 30Z M8 76 L4 68 L14 70 L10 80Z"/>`),
  art('lv-hearts', 'Two hearts', `
    <path fill="#f4a6a0" d="M38 74 C18 58 8 48 8 34 C8 24 16 17 25 17 C31 17 35 20 38 25 C41 20 45 17 51 17 C60 17 68 24 68 34 C68 48 58 58 38 74Z"/>
    <path fill="#e2574c" d="M62 88 C42 72 32 62 32 48 C32 38 40 31 49 31 C55 31 59 34 62 39 C65 34 69 31 75 31 C84 31 92 38 92 48 C92 62 82 72 62 88Z"/>`),
  art('lv-letter', 'Love letter', `
    <rect x="8" y="24" width="84" height="56" rx="5" fill="#f6e3d4"/>
    <path fill="#efd2bd" d="M8 30 L50 58 L92 30 V76 Q92 80 88 80 H12 Q8 80 8 76Z"/>
    <path fill="none" stroke="#c98a5a" stroke-width="2.5" d="M10 28 L50 56 L90 28"/>
    <path fill="#e2574c" d="M50 66 C40 58 34 53 34 46 C34 41 38 38 42 38 C46 38 48 40 50 43 C52 40 54 38 58 38 C62 38 66 41 66 46 C66 53 60 58 50 66Z"/>`),
  art('lv-rose', 'Rose', `
    <path stroke="#3a7a4a" stroke-width="4" fill="none" d="M50 52 V96"/>
    <path fill="#4f8f5a" d="M50 76 Q34 66 26 74 Q36 84 50 78Z M50 68 Q66 58 74 66 Q64 76 50 70Z"/>
    <path fill="#c8383b" d="M50 56 C30 56 24 40 28 26 C34 32 40 30 42 24 C46 30 54 30 58 24 C60 30 66 32 72 26 C76 40 70 56 50 56Z"/>
    <path fill="#e2574c" d="M50 46 C40 46 36 36 40 28 C44 32 48 30 50 26 C52 30 56 32 60 28 C64 36 60 46 50 46Z"/>
    <path fill="none" stroke="#a82c30" stroke-width="2" d="M44 34 Q50 40 56 34"/>`),
  art('lv-balloon', 'Heart balloon', `
    <path fill="none" stroke="#7a6a5a" stroke-width="1.8" d="M50 70 Q42 80 52 88 Q60 94 50 98"/>
    <path fill="#e2574c" d="M50 70 C28 54 14 42 14 27 C14 16 22 8 33 8 C40 8 46 12 50 18 C54 12 60 8 67 8 C78 8 86 16 86 27 C86 42 72 54 50 70Z"/>
    <path fill="#a82c30" d="M46 70 H54 L50 76Z"/>
    <ellipse cx="32" cy="24" rx="5" ry="9" fill="#ffffff" opacity="0.35" transform="rotate(-30 32 24)"/>`),
  art('lv-ring', 'Diamond ring', `
    <circle cx="50" cy="64" r="26" fill="none" stroke="#e9b44c" stroke-width="7"/>
    <path fill="#bfe3f2" d="M36 24 L44 12 H56 L64 24 L50 40Z"/>
    <path fill="#8cc9e2" d="M36 24 H64 L50 40Z"/>
    <path fill="#ffffff" opacity="0.7" d="M44 12 L48 24 H40Z"/>`),
]

const NATURE: ElementItem[] = [
  art('nt-daisy', 'Daisy', `
    <g fill="#ffffff" stroke="#e7ddd0" stroke-width="1.5">
      ${Array.from({ length: 12 }, (_, i) => `<ellipse cx="50" cy="24" rx="8" ry="20" transform="rotate(${i * 30} 50 50)"/>`).join('')}
    </g>
    <circle cx="50" cy="50" r="13" fill="#f2b632"/><circle cx="46" cy="46" r="4" fill="#f7d06a"/>`),
  art('nt-leaves', 'Leaf sprig', `
    <path fill="none" stroke="#5b7a45" stroke-width="3" d="M50 96 Q48 50 54 6"/>
    ${[[-1, 80], [1, 66], [-1, 52], [1, 38], [-1, 24]].map(([s, y]) => `<path fill="${s < 0 ? '#7da35b' : '#8fb86a'}" d="M51 ${y} Q${51 + s * 30} ${y - 22} ${51 + s * 34} ${y - 4} Q${51 + s * 16} ${y + 6} 51 ${y}Z"/>`).join('')}
    <path fill="#7da35b" d="M54 8 Q62 -2 60 14 Q56 14 54 8Z"/>`),
  art('nt-sun', 'Sun', `
    <g stroke="#f2a23c" stroke-width="5" stroke-linecap="round">
      ${Array.from({ length: 12 }, (_, i) => `<path d="M50 8 V18" transform="rotate(${i * 30} 50 50)"/>`).join('')}
    </g>
    <circle cx="50" cy="50" r="24" fill="#f7c948"/>
    <circle cx="42" cy="47" r="2.5" fill="#7a4b35"/><circle cx="58" cy="47" r="2.5" fill="#7a4b35"/>
    <path fill="none" stroke="#7a4b35" stroke-width="2.5" stroke-linecap="round" d="M42 56 Q50 63 58 56"/>
    <circle cx="36" cy="55" r="3.5" fill="#f2a23c" opacity="0.6"/><circle cx="64" cy="55" r="3.5" fill="#f2a23c" opacity="0.6"/>`),
  art('nt-mountain', 'Mountain badge', `
    <circle cx="50" cy="50" r="46" fill="#f3e6d3"/>
    <circle cx="66" cy="34" r="9" fill="#f2a23c"/>
    <path fill="#5f7d8c" d="M8 72 L34 38 L52 62 L64 48 L92 72 A46 46 0 0 1 8 72Z"/>
    <path fill="#ffffff" d="M34 38 L28 46 L34 44 L40 48Z M64 48 L60 53 L64 52 L68 54Z"/>
    <path fill="#3f5f4a" d="M8 72 Q30 64 50 74 Q72 64 92 72 A46 46 0 0 1 8 72Z"/>
    <circle cx="50" cy="50" r="46" fill="none" stroke="#2b2622" stroke-width="3"/>`),
  art('nt-tulip', 'Tulip', `
    <path fill="none" stroke="#4f8f5a" stroke-width="4" d="M50 50 V96"/>
    <path fill="#5ea36b" d="M50 92 Q28 82 26 58 Q42 66 50 84Z M50 88 Q72 78 74 54 Q58 62 50 80Z"/>
    <path fill="#e2574c" d="M32 22 Q36 44 50 52 Q64 44 68 22 L58 32 L50 14 L42 32Z"/>
    <path fill="#f08a7e" d="M42 32 L50 14 L58 32 Q50 40 42 32Z"/>`),
  art('nt-cactus', 'Cactus', `
    <path fill="#5ea36b" d="M42 80 V22 A8 8 0 0 1 58 22 V80Z"/>
    <path fill="#5ea36b" d="M42 56 H32 Q24 56 24 48 V34 A5 5 0 0 1 34 34 V46 H42Z M58 46 H66 V30 A5 5 0 0 1 76 30 V42 Q76 54 68 54 H58Z"/>
    <path stroke="#3f7a4a" stroke-width="2" d="M50 22 V78"/>
    <path fill="#d47c5a" d="M30 78 H70 L64 96 H36Z"/><rect x="28" y="74" width="44" height="8" rx="2" fill="#c06a48"/>
    <circle cx="50" cy="13" r="4" fill="#f08a7e"/>`),
]

const ANIMALS: ElementItem[] = [
  art('an-cat', 'Cat', `
    <path fill="#f2a65a" d="M16 18 L36 34 H64 L84 18 L82 56 C82 76 68 88 50 88 C32 88 18 76 18 56Z"/>
    <path fill="#f6c99a" d="M22 26 L32 34 L22 44Z M78 26 L68 34 L78 44Z"/>
    <ellipse cx="38" cy="56" rx="4.5" ry="6" fill="#2b2622"/><ellipse cx="62" cy="56" rx="4.5" ry="6" fill="#2b2622"/>
    <path fill="#e2574c" d="M46 66 H54 L50 71Z"/>
    <path fill="none" stroke="#2b2622" stroke-width="2" stroke-linecap="round" d="M50 71 Q46 76 42 73 M50 71 Q54 76 58 73 M8 62 H30 M10 70 L30 66 M92 62 H70 M90 70 L70 66"/>`),
  art('an-paw', 'Paw print', `
    <path fill="#7a4b35" d="M50 50 C34 50 24 66 26 78 C28 88 40 88 50 84 C60 88 72 88 74 78 C76 66 66 50 50 50Z"/>
    <ellipse cx="24" cy="44" rx="9" ry="12" fill="#7a4b35" transform="rotate(-20 24 44)"/>
    <ellipse cx="40" cy="26" rx="9" ry="12" fill="#7a4b35" transform="rotate(-8 40 26)"/>
    <ellipse cx="60" cy="26" rx="9" ry="12" fill="#7a4b35" transform="rotate(8 60 26)"/>
    <ellipse cx="76" cy="44" rx="9" ry="12" fill="#7a4b35" transform="rotate(20 76 44)"/>`),
  art('an-fox', 'Fox', `
    <path fill="#e8742a" d="M12 10 L36 32 H64 L88 10 L86 46 L50 90 L14 46Z"/>
    <path fill="#f6f1ea" d="M14 46 L50 90 L50 66 Q34 64 26 50Z M86 46 L50 90 L50 66 Q66 64 74 50Z"/>
    <path fill="#2b2622" d="M20 18 L32 30 L22 34Z M80 18 L68 30 L78 34Z"/>
    <ellipse cx="36" cy="50" rx="4" ry="5" fill="#2b2622"/><ellipse cx="64" cy="50" rx="4" ry="5" fill="#2b2622"/>
    <ellipse cx="50" cy="84" rx="6" ry="4.5" fill="#2b2622"/>`),
  art('an-bear', 'Bear', `
    <circle cx="22" cy="24" r="14" fill="#8a5a3c"/><circle cx="78" cy="24" r="14" fill="#8a5a3c"/>
    <circle cx="22" cy="24" r="7" fill="#c98a5a"/><circle cx="78" cy="24" r="7" fill="#c98a5a"/>
    <circle cx="50" cy="54" r="38" fill="#8a5a3c"/>
    <ellipse cx="50" cy="66" rx="18" ry="14" fill="#d9a77a"/>
    <circle cx="36" cy="48" r="4" fill="#2b2622"/><circle cx="64" cy="48" r="4" fill="#2b2622"/>
    <ellipse cx="50" cy="60" rx="6" ry="4.5" fill="#2b2622"/>
    <path fill="none" stroke="#2b2622" stroke-width="2.2" stroke-linecap="round" d="M50 64 V70 M44 72 Q50 76 56 72"/>`),
  art('an-fish', 'Fish', `
    <path fill="#5b8db8" d="M70 50 L94 30 V70Z"/>
    <path fill="#7fb3d8" d="M8 50 C20 26 52 20 74 50 C52 80 20 74 8 50Z"/>
    <path fill="none" stroke="#5b8db8" stroke-width="2.5" d="M44 30 Q52 50 44 70 M56 34 Q62 50 56 66"/>
    <circle cx="24" cy="46" r="5" fill="#ffffff"/><circle cx="23" cy="46" r="2.5" fill="#2b2622"/>
    <path fill="#f2a65a" d="M40 26 Q50 12 62 30Z"/>`),
  art('an-butterfly', 'Butterfly', `
    <path fill="#9a6fb0" d="M48 46 C36 18 6 14 8 36 C10 52 30 54 48 50Z M52 46 C64 18 94 14 92 36 C90 52 70 54 52 50Z"/>
    <path fill="#e9a23b" d="M48 54 C32 54 16 66 22 80 C28 92 44 78 48 60Z M52 54 C68 54 84 66 78 80 C72 92 56 78 52 60Z"/>
    <circle cx="24" cy="34" r="5" fill="#f6f1ea"/><circle cx="76" cy="34" r="5" fill="#f6f1ea"/>
    <rect x="47" y="32" width="6" height="44" rx="3" fill="#2b2622"/>
    <path fill="none" stroke="#2b2622" stroke-width="2" stroke-linecap="round" d="M49 33 Q44 20 38 18 M51 33 Q56 20 62 18"/>`),
]

const FOOD: ElementItem[] = [
  art('fd-coffee', 'Coffee cup', `
    <path fill="none" stroke="#a37a5a" stroke-width="3" stroke-linecap="round" d="M38 22 Q34 14 40 8 M52 22 Q48 14 54 8"/>
    <path fill="#f6f1ea" stroke="#6b4a35" stroke-width="3" d="M18 34 H74 L68 84 Q67 90 60 90 H32 Q25 90 24 84Z"/>
    <path fill="none" stroke="#6b4a35" stroke-width="6" d="M72 46 Q90 46 86 60 Q82 70 68 68"/>
    <rect x="22" y="48" width="48" height="16" fill="#d47c5a"/>
    <path fill="#f6f1ea" d="M46 60 C40 55 38 53 38 51 C38 49 40 48 42 48 C44 48 45 49 46 50 C47 49 48 48 50 48 C52 48 54 49 54 51 C54 53 52 55 46 60Z"/>`),
  art('fd-donut', 'Donut', `
    <circle cx="50" cy="52" r="40" fill="#e3a868"/>
    <path fill="#f08a9e" d="M50 16 C70 16 86 30 86 48 C86 54 80 52 78 58 C74 66 68 58 62 64 C56 70 50 62 44 66 C36 70 34 60 26 62 C18 64 14 56 14 48 C14 30 30 16 50 16Z"/>
    <circle cx="50" cy="50" r="12" fill="#ffffff"/>
    <g stroke-width="3.5" stroke-linecap="round">
      <path stroke="#f7d06a" d="M32 30 L36 34"/><path stroke="#7fb3d8" d="M62 26 L66 30"/><path stroke="#ffffff" d="M70 44 L74 40"/>
      <path stroke="#8fb86a" d="M26 46 L30 42"/><path stroke="#f7d06a" d="M58 62 L62 60"/><path stroke="#7fb3d8" d="M40 62 L36 60"/>
    </g>`),
  art('fd-pizza', 'Pizza slice', `
    <path fill="#e3a868" d="M10 22 Q50 2 90 22 L84 32 Q50 14 16 32Z"/>
    <path fill="#f7c948" d="M16 32 Q50 14 84 32 L50 96Z"/>
    <circle cx="40" cy="40" r="7" fill="#c8383b"/><circle cx="62" cy="44" r="7" fill="#c8383b"/><circle cx="50" cy="66" r="6" fill="#c8383b"/>
    <circle cx="54" cy="32" r="2.5" fill="#4f8f5a"/><circle cx="36" cy="54" r="2.5" fill="#4f8f5a"/><circle cx="60" cy="58" r="2.5" fill="#4f8f5a"/>`),
  art('fd-icecream', 'Ice cream', `
    <path fill="#e3a868" d="M30 50 H70 L50 96Z"/>
    <path fill="none" stroke="#c98a5a" stroke-width="2" d="M36 58 L58 82 M46 52 L64 72 M64 58 L42 82 M54 52 L36 72"/>
    <circle cx="50" cy="30" r="20" fill="#f4a6b8"/>
    <path fill="#f4a6b8" d="M28 46 Q28 38 36 38 H64 Q72 38 72 46 Q66 52 60 48 Q54 54 50 48 Q44 54 40 48 Q34 52 28 46Z"/>
    <circle cx="50" cy="8" r="6" fill="#c8383b"/><path stroke="#4f8f5a" stroke-width="2" d="M50 4 Q54 0 58 2"/>
    <g stroke-width="3" stroke-linecap="round"><path stroke="#ffffff" d="M42 24 L44 28"/><path stroke="#7fb3d8" d="M56 30 L60 30"/><path stroke="#f7d06a" d="M48 38 L50 34"/></g>`),
  art('fd-cupcake', 'Cupcake', `
    <path fill="#7fb3d8" d="M22 54 H78 L70 92 H30Z"/>
    <path stroke="#5b8db8" stroke-width="2.5" d="M34 56 L38 90 M50 56 V90 M66 56 L62 90"/>
    <path fill="#f6f1ea" d="M18 56 C10 46 22 36 28 40 C26 26 42 22 46 30 C48 18 64 20 62 32 C70 26 84 36 78 46 C86 50 82 60 74 58 Z"/>
    <circle cx="50" cy="20" r="6" fill="#c8383b"/>`),
  art('fd-avocado', 'Avocado', `
    <path fill="#4f7a3a" d="M50 6 C34 6 30 26 24 42 C16 62 22 94 50 94 C78 94 84 62 76 42 C70 26 66 6 50 6Z"/>
    <path fill="#c9df8a" d="M50 14 C38 14 36 30 32 44 C26 62 30 86 50 86 C70 86 74 62 68 44 C64 30 62 14 50 14Z"/>
    <circle cx="50" cy="60" r="15" fill="#a0673e"/><circle cx="45" cy="55" r="4" fill="#c08a5e"/>`),
]

const SPACE: ElementItem[] = [
  art('sp-moon', 'Moon & stars', `
    <path fill="#f7d06a" d="M56 10 A40 40 0 1 0 90 66 A32 32 0 1 1 56 10Z"/>
    <circle cx="38" cy="48" r="4" fill="#e9b44c"/><circle cx="30" cy="66" r="3" fill="#e9b44c"/>
    <path fill="#f7d06a" d="M78 12 L80 18 L86 20 L80 22 L78 28 L76 22 L70 20 L76 18Z M88 38 L89 41 L92 42 L89 43 L88 46 L87 43 L84 42 L87 41Z"/>`),
  art('sp-planet', 'Planet', `
    <ellipse cx="50" cy="52" rx="46" ry="12" fill="none" stroke="#c99a3a" stroke-width="5" transform="rotate(-18 50 52)"/>
    <circle cx="50" cy="50" r="28" fill="#9a6fb0"/>
    <path fill="#b48fc8" d="M23 42 Q50 36 77 44 L78 50 Q50 43 22 49Z M23 58 Q50 52 76 61 L73 67 Q50 60 27 66Z"/>
    <path fill="none" stroke="#e9b44c" stroke-width="5" stroke-linecap="round" d="M4 52 A46 12 0 0 0 96 52" transform="rotate(-18 50 52)"/>`),
  art('sp-rocket', 'Rocket', `
    <path fill="#f2a23c" d="M40 74 Q50 98 60 74Z"/><path fill="#f7d06a" d="M44 74 Q50 88 56 74Z"/>
    <path fill="#e2574c" d="M34 56 L20 74 L36 70Z M66 56 L80 74 L64 70Z"/>
    <path fill="#f6f1ea" stroke="#c9d6e3" stroke-width="2" d="M50 6 C66 18 70 44 64 72 H36 C30 44 34 18 50 6Z"/>
    <path fill="#e2574c" d="M50 6 C58 12 62 20 64 28 H36 C38 20 42 12 50 6Z"/>
    <circle cx="50" cy="44" r="8" fill="#5b8db8" stroke="#3f6a8f" stroke-width="3"/>`),
  art('sp-shooting', 'Shooting star', `
    <path fill="#f7d06a" opacity="0.5" d="M8 92 L54 46 L60 52Z"/>
    <path fill="#f2a23c" opacity="0.6" d="M22 92 L56 58 L60 62Z M4 76 L50 40 L52 46Z"/>
    <polygon fill="#f7c948" points="${polygonPoints(5, 26, 11)}" transform="translate(16 -14)"/>`),
  art('sp-sparkles', 'Sparkles', `
    <path fill="#f7c948" d="M42 10 C45 34 54 43 78 46 C54 49 45 58 42 82 C39 58 30 49 6 46 C30 43 39 34 42 10Z"/>
    <path fill="#f2a23c" d="M78 54 C79.5 66 84 70.5 96 72 C84 73.5 79.5 78 78 90 C76.5 78 72 73.5 60 72 C72 70.5 76.5 66 78 54Z"/>
    <path fill="#9a6fb0" d="M76 6 C77 14 80 17 88 18 C80 19 77 22 76 30 C75 22 72 19 64 18 C72 17 75 14 76 6Z"/>`),
  art('sp-ufo', 'UFO', `
    <path fill="#f7d06a" opacity="0.45" d="M34 60 L18 96 H82 L66 60Z"/>
    <path fill="#8cc9e2" d="M30 46 A20 20 0 0 1 70 46Z"/>
    <ellipse cx="50" cy="52" rx="44" ry="12" fill="#7d8a99"/>
    <ellipse cx="50" cy="48" rx="30" ry="6" fill="#a3afbc"/>
    <circle cx="24" cy="54" r="3" fill="#f7d06a"/><circle cx="50" cy="58" r="3" fill="#f7d06a"/><circle cx="76" cy="54" r="3" fill="#f7d06a"/>`),
]

const RETRO: ElementItem[] = [
  art('rt-sunset', 'Retro sunset', [
    [6, 34, '#f7d06a'], [36, 48, '#f2a23c'], [51, 61, '#e2574c'], [64, 72, '#c8383b'], [75, 81, '#9a3a5a'], [84, 94, '#6b2f5a'],
  ].map(([a, b, c]) => `<path fill="${c}" d="${circleBand(a as number, b as number)}"/>`).join('')),
  art('rt-bolt', 'Lightning bolt', `
    <path fill="#f7c948" stroke="#2b2622" stroke-width="3" stroke-linejoin="round" d="M58 4 L18 56 H46 L36 96 L82 40 H54Z"/>`),
  art('rt-smiley', 'Smiley', `
    <circle cx="50" cy="50" r="44" fill="#f7c948" stroke="#2b2622" stroke-width="3"/>
    <ellipse cx="36" cy="40" rx="5" ry="9" fill="#2b2622"/><ellipse cx="64" cy="40" rx="5" ry="9" fill="#2b2622"/>
    <path fill="none" stroke="#2b2622" stroke-width="4.5" stroke-linecap="round" d="M26 58 Q50 84 74 58"/>`),
  art('rt-peace', 'Peace sign', `
    <circle cx="50" cy="50" r="40" fill="none" stroke="#8a9f6e" stroke-width="9"/>
    <path stroke="#8a9f6e" stroke-width="9" stroke-linecap="round" d="M50 12 V88 M50 50 L23 77 M50 50 L77 77"/>`),
  art('rt-rainbow', 'Rainbow', `
    <g fill="none" stroke-width="9" stroke-linecap="round">
      <path stroke="#e2574c" d="M10 80 A40 40 0 0 1 90 80"/>
      <path stroke="#f2a23c" d="M20 80 A30 30 0 0 1 80 80"/>
      <path stroke="#f7c948" d="M30 80 A20 20 0 0 1 70 80"/>
      <path stroke="#8a9f6e" d="M40 80 A10 10 0 0 1 60 80"/>
    </g>`),
  art('rt-flower', 'Groovy flower', `
    <g fill="#f08a7e">${Array.from({ length: 8 }, (_, i) => `<circle cx="50" cy="22" r="16" transform="rotate(${i * 45} 50 50)"/>`).join('')}</g>
    <circle cx="50" cy="50" r="18" fill="#f7c948"/>
    <circle cx="44" cy="46" r="2.5" fill="#2b2622"/><circle cx="56" cy="46" r="2.5" fill="#2b2622"/>
    <path fill="none" stroke="#2b2622" stroke-width="2.5" stroke-linecap="round" d="M43 54 Q50 60 57 54"/>`),
]

const SPORTS: ElementItem[] = [
  art('st-basketball', 'Basketball', `
    <circle cx="50" cy="50" r="44" fill="#e8742a"/>
    <g fill="none" stroke="#2b2622" stroke-width="3">
      <circle cx="50" cy="50" r="44"/><path d="M50 6 V94 M6 50 H94"/>
      <path d="M20 18 Q38 50 20 82 M80 18 Q62 50 80 82"/>
    </g>`),
  art('st-soccer', 'Soccer ball', `
    <circle cx="50" cy="50" r="44" fill="#ffffff" stroke="#2b2622" stroke-width="3"/>
    <polygon fill="#2b2622" points="${polygonPoints(5, 13)}"/>
    <g fill="#2b2622">
      <path d="M50 6 L58 12 L50 18 L42 12Z" transform="rotate(0 50 50)"/>
      <path d="M50 6 L58 12 L50 18 L42 12Z" transform="rotate(72 50 50)"/>
      <path d="M50 6 L58 12 L50 18 L42 12Z" transform="rotate(144 50 50)"/>
      <path d="M50 6 L58 12 L50 18 L42 12Z" transform="rotate(216 50 50)"/>
      <path d="M50 6 L58 12 L50 18 L42 12Z" transform="rotate(288 50 50)"/>
    </g>
    <g stroke="#2b2622" stroke-width="2.5">
      <path d="M50 37 V18" transform="rotate(0 50 50)"/><path d="M50 37 V18" transform="rotate(72 50 50)"/>
      <path d="M50 37 V18" transform="rotate(144 50 50)"/><path d="M50 37 V18" transform="rotate(216 50 50)"/>
      <path d="M50 37 V18" transform="rotate(288 50 50)"/>
    </g>`),
  art('st-baseball', 'Baseball', `
    <circle cx="50" cy="50" r="44" fill="#f6f1ea" stroke="#c9b9a6" stroke-width="2"/>
    <g fill="none" stroke="#c8383b" stroke-width="3">
      <path d="M22 16 Q40 50 22 84"/><path d="M78 16 Q60 50 78 84"/>
    </g>
    <g stroke="#c8383b" stroke-width="2.5" stroke-linecap="round">
      ${[24, 34, 44, 56, 66, 76].map((y) => `<path d="M${y < 50 ? 26 + (y - 24) * 0.25 : 32 - (y - 56) * 0.3} ${y} l6 -3"/><path d="M${y < 50 ? 74 - (y - 24) * 0.25 : 68 + (y - 56) * 0.3} ${y} l-6 -3"/>`).join('')}
    </g>`),
  art('st-trophy', 'Trophy', `
    <path fill="none" stroke="#e9b44c" stroke-width="6" d="M28 22 H14 Q12 44 34 48 M72 22 H86 Q88 44 66 48"/>
    <path fill="#f7c948" d="M26 10 H74 V30 Q74 58 50 60 Q26 58 26 30Z"/>
    <rect x="44" y="58" width="12" height="16" fill="#e9b44c"/>
    <rect x="30" y="74" width="40" height="16" rx="3" fill="#7a4b35"/>
    <path fill="#ffffff" opacity="0.5" d="M34 16 H40 V34 Q40 44 46 50 Q34 46 34 32Z"/>
    <polygon fill="#e9b44c" points="${polygonPoints(5, 9, 4)}" transform="translate(0 -18)"/>`),
  art('st-dumbbell', 'Dumbbell', `
    <rect x="26" y="45" width="48" height="10" rx="3" fill="#7d8a99"/>
    <rect x="12" y="28" width="16" height="44" rx="4" fill="#3f4a6b"/><rect x="72" y="28" width="16" height="44" rx="4" fill="#3f4a6b"/>
    <rect x="4" y="36" width="10" height="28" rx="3" fill="#5b6a8f"/><rect x="86" y="36" width="10" height="28" rx="3" fill="#5b6a8f"/>`),
  art('st-medal', 'Medal', `
    <path fill="#5b8db8" d="M28 4 H46 L58 40 H40Z"/><path fill="#c8383b" d="M72 4 H54 L42 40 H60Z"/>
    <circle cx="50" cy="64" r="28" fill="#f7c948"/><circle cx="50" cy="64" r="20" fill="none" stroke="#e9b44c" stroke-width="4"/>
    <polygon fill="#e9b44c" points="${polygonPoints(5, 11, 5)}" transform="translate(0 14)"/>`),
]

/** Theme set: large scenes first, then the painterly artworks, then the flat icons */
const theme = (id: string, title: string, icons: ElementItem[]): ElementCategory => ({
  id,
  title,
  items: [
    ...SCENES.filter((s) => s.theme === id).map(
      (s): ElementItem => ({ id: s.id, name: s.name, kind: 'svg', svg: s.svg, scene: s.kind, aspect: s.aspect }),
    ),
    ...ARTWORKS.filter((a) => a.theme === id).map((a): ElementItem => ({ id: a.id, name: a.name, kind: 'svg', svg: a.svg, art: true })),
    ...icons,
  ],
})

export const ELEMENT_CATEGORIES: ElementCategory[] = [
  { id: 'shapes', title: 'Shapes', badge: 'Editable', items: SHAPES },
  { id: 'curved', title: 'Curved Text', badge: 'Editable', items: CURVED_TEXT },
  { id: 'text', title: 'Text elements', badge: 'Editable', items: TEXT_ELEMENTS },
  theme('halloween', 'Halloween', HALLOWEEN),
  theme('christmas', 'Christmas', CHRISTMAS),
  theme('love', 'Love', LOVE),
  theme('nature', 'Nature & Floral', NATURE),
  theme('animals', 'Animals', ANIMALS),
  theme('food', 'Coffee & Food', FOOD),
  theme('space', 'Space', SPACE),
  theme('retro', 'Retro', RETRO),
  theme('sports', 'Sports', SPORTS),
]

/** Text-on-arc path in preset units, apex at (0, 0): arch for curve > 0, smile for curve < 0. */
export function arcPath(curve: number, length: number) {
  const r = Math.abs(curve)
  // Arc long enough for the text (plus slack), capped at a half circle
  const half = Math.min(Math.PI / 2, (length * 0.6) / r)
  const dx = r * Math.sin(half)
  const dy = r * (1 - Math.cos(half))
  return curve > 0
    ? `M ${-dx} ${dy} A ${r} ${r} 0 0 1 ${dx} ${dy}`
    : `M ${-dx} ${-dy} A ${r} ${r} 0 0 0 ${dx} ${-dy}`
}

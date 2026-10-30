import { lin, rad, stars } from './artworks'

// Large illustrated scenes for the themed sets: wide landscapes (3:2, rounded
// card) and character pieces (3:4, arched window). Like the artworks, every id
// is prefixed with the scene id so the SVGs never clash.

export type SceneKind = 'landscape' | 'people'

export interface Scene {
  id: string
  name: string
  theme: string
  kind: SceneKind
  /** Width / height of the viewBox */
  aspect: number
  svg: string
}

const FRAMES = {
  wide: { w: 150, h: 100, shape: '<rect x="2" y="2" width="146" height="96" rx="10"/>' },
  tall: { w: 90, h: 120, shape: '<path d="M2 45 A43 43 0 0 1 88 45 V108 Q88 118 78 118 H12 Q2 118 2 108Z"/>' },
}

function scene(
  theme: string,
  kind: SceneKind,
  frame: keyof typeof FRAMES,
  id: string,
  name: string,
  border: string,
  build: (u: (name: string) => string) => { defs: string; body: string },
): Scene {
  const { w, h, shape } = FRAMES[frame]
  const u = (n: string) => `${id}-${n}`
  const { defs, body } = build(u)
  const outline = shape.replace('/>', ` fill="none" stroke="${border}" stroke-width="2.5"/>`)
  return {
    id,
    name,
    theme,
    kind,
    aspect: w / h,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><defs>${defs}<clipPath id="${u('c')}">${shape}</clipPath></defs><g clip-path="url(#${u('c')})">${body}</g>${outline}</svg>`,
  }
}

/** Pine tree standing on (x, base), optionally snow-capped. */
const pine = (x: number, base: number, h: number, fill: string, snow?: string) => {
  const w = h * 0.36
  const tiers = [0, 0.3, 0.55]
    .map((t) => {
      const top = base - h + h * t
      const bw = w * (0.55 + t * 0.8)
      return `<path fill="${fill}" d="M${x} ${top} L${x + bw} ${top + h * 0.42} H${x - bw}Z"/>`
    })
    .join('')
  const cap = snow ? `<path fill="${snow}" d="M${x} ${base - h} L${x + w * 0.3} ${base - h + h * 0.22} L${x} ${base - h + h * 0.17} L${x - w * 0.3} ${base - h + h * 0.22}Z"/>` : ''
  return `<rect x="${x - h * 0.04}" y="${base - h * 0.12}" width="${h * 0.08}" height="${h * 0.12}" fill="${fill}"/>${tiers}${cap}`
}

/** Small "V" birds */
const birds = (pts: [number, number, number][], stroke: string) =>
  pts
    .map(([x, y, s]) => `<path fill="none" stroke="${stroke}" stroke-width="${0.5 * s + 0.3}" stroke-linecap="round" d="M${x - 2.4 * s} ${y - 1 * s} Q${x - 1.1 * s} ${y - 1.4 * s} ${x} ${y} Q${x + 1.1 * s} ${y - 1.4 * s} ${x + 2.4 * s} ${y - 1 * s}"/>`)
    .join('')

/** Simple round cartoon eyes with a highlight */
const eyes = (lx: number, rx: number, y: number, color = '#2b2233') =>
  [lx, rx]
    .map((x) => `<ellipse cx="${x}" cy="${y}" rx="1.4" ry="1.8" fill="${color}"/><circle cx="${x + 0.5}" cy="${y - 0.6}" r="0.5" fill="#ffffff"/>`)
    .join('')

const GIRAFFE = `
  <path d="M108 66 Q108 60 116 60 L124 61 Q128 62 127 67 L125 68 H110Z"/>
  <path d="M108 62 L99.5 41 L103 39.5 L113 61Z"/>
  <path d="M98 40.5 L92 42.5 L91 40.5 L97 37 L101 36 L104 38.5Z"/>
  <g stroke-width="1.6" stroke-linecap="round" fill="none">
    <path d="M110.5 66 L109.5 80 M113.5 66 L113.5 80 M122 66 L121 80 M125 66 L126 80"/>
    <path stroke-width="0.9" d="M101 36.5 V33.5 M103.4 37.6 L104.4 34.6 M127 63 Q130 66 129 71"/>
  </g>`

export const SCENES: Scene[] = [
  // ── Halloween ──
  scene('halloween', 'landscape', 'wide', 'sc-hollow', 'Haunted hollow', '#1b1236', (u) => ({
    defs:
      lin(u('sky'), [[0, '#1b1236'], [0.55, '#4b2a63'], [1, '#d0663f']]) +
      rad(u('glow'), [[0, '#fff3c4', 0.9], [0.4, '#f7d77a', 0.45], [1, '#f7d77a', 0]]),
    body: `
      <rect width="150" height="100" fill="url(#${u('sky')})"/>
      <circle cx="112" cy="30" r="30" fill="url(#${u('glow')})"/>
      <circle cx="112" cy="30" r="13" fill="#fbe7a8"/><circle cx="107" cy="26" r="2.6" fill="#ecd08a"/><circle cx="116" cy="34" r="1.8" fill="#ecd08a"/>
      ${stars([[14, 14, 0.8], [30, 24, 0.6], [52, 10, 0.7], [70, 22, 0.5], [86, 12, 0.6], [140, 14, 0.7], [134, 48, 0.5], [8, 40, 0.5]])}
      <path fill="#3a2552" d="M0 62 Q30 50 60 58 Q90 48 120 56 Q140 52 150 56 V100 H0Z"/>
      <path fill="#1a1228" d="M26 60 V38 H24 L36 26 L41 31 V28 H40 L44 16 L48 28 H47.5 V38 H48 V60Z M28 37 V28 H31 V34Z"/>
      <g fill="#f7c948"><rect x="30" y="42" width="4" height="5" rx="1"/><rect x="39" y="44" width="4" height="5" rx="1"/><rect x="43" y="31" width="2" height="3" rx="0.8"/><path d="M34 52 h6 v8 h-6z" opacity="0.55"/></g>
      <path fill="#261a38" d="M0 70 Q20 54 50 59 Q70 62 84 74 V100 H0Z"/>
      <path fill="#140e1f" d="M118 100 L120 70 Q116 60 108 54 L110 53 Q118 58 121 64 Q122 54 128 46 L130 47 Q125 56 124 66 Q130 60 138 58 L138 60 Q130 63 125 72 L126 100Z"/>
      <ellipse cx="75" cy="80" rx="80" ry="6" fill="#ffffff" opacity="0.1"/>
      <path fill="#140e1f" d="M0 86 Q40 78 80 84 Q115 80 150 86 V100 H0Z"/>
      <g fill="#4a3d5c">
        <path d="M58 86 V78 Q62 73 66 78 V86Z"/><rect x="73" y="74" width="2.4" height="11"/><rect x="69.6" y="77.5" width="9.2" height="2.4"/>
        <path d="M86 87 V80 Q90 75 94 80 V87Z"/>
      </g>
      <ellipse cx="28" cy="90" rx="6" ry="4.5" fill="#e8742a"/><ellipse cx="28" cy="90" rx="2.6" ry="4.5" fill="#f28c28"/>
      <path fill="#4f7a3a" d="M27.5 85.8 Q28 83.5 30 83 L30.4 84 Q29 84.6 29 86Z"/>
      <ellipse cx="40" cy="92" rx="4" ry="3" fill="#d9661f"/>
      <ellipse cx="75" cy="88" rx="70" ry="4" fill="#ffffff" opacity="0.08"/>
      <path fill="#140e1f" d="M96 24 q3 -3 5 0 q2 -2 4 1 q-3 0 -4.5 2 q-1.5 -2 -4.5 -3Z M128 40 q2.4 -2.4 4 0 q1.6 -1.6 3.2 .8 q-2.4 0 -3.6 1.6 q-1.2 -1.6 -3.6 -2.4Z M84 34 q2 -2 3.4 0 q1.4 -1.4 2.8 .6 q-2 0 -3 1.4 q-1 -1.4 -3.2 -2Z"/>`,
  })),
  scene('halloween', 'people', 'tall', 'sc-witch', 'Little witch', '#241a4a', (u) => ({
    defs:
      lin(u('sky'), [[0, '#241a4a'], [0.7, '#5b3a7a'], [1, '#e08a5a']]) +
      rad(u('lamp'), [[0, '#ffe08a', 0.8], [1, '#ffe08a', 0]]),
    body: `
      <rect width="90" height="120" fill="url(#${u('sky')})"/>
      <circle cx="45" cy="46" r="34" fill="#f7e3a6" opacity="0.18"/>
      <circle cx="45" cy="46" r="27" fill="#f7e3a6"/>
      ${stars([[12, 40, 0.7], [18, 26, 0.5], [76, 30, 0.6], [80, 56, 0.5], [10, 70, 0.6], [82, 80, 0.5]])}
      <path fill="#2b1d3f" d="M0 104 Q45 94 90 104 V120 H0Z"/>
      <path fill="#1a1228" d="M12 104 Q10 96 14 92 L13 87 L16 90 H19 L22 87 L21 92 Q24 96 22 104Z M22 102 Q28 102 27 94 Q26 92 28 92 Q30 98 25 104Z"/>
      <circle cx="15.8" cy="92" r="0.7" fill="#f7c948"/><circle cx="19.4" cy="92" r="0.7" fill="#f7c948"/>
      <path fill="#e06b3a" d="M33 56 Q32 46 45 45 Q58 46 57 56 L59 72 Q55 70 53 66 L52 60 H38 L37 66 Q35 70 31 72Z"/>
      <rect x="42" y="66" width="6" height="6" fill="#e8b08f"/>
      <g fill="#2b1d3f"><rect x="37" y="103" width="4" height="10"/><rect x="49" y="103" width="4" height="10"/></g>
      <g fill="#f28c28"><rect x="37" y="106" width="4" height="1.6"/><rect x="49" y="106" width="4" height="1.6"/><rect x="37" y="109.5" width="4" height="1.6"/><rect x="49" y="109.5" width="4" height="1.6"/></g>
      <ellipse cx="38" cy="114" rx="4" ry="2.4" fill="#1a1228"/><ellipse cx="52" cy="114" rx="4" ry="2.4" fill="#1a1228"/>
      <path fill="#6a3fa0" d="M33 74 Q45 69 57 74 L65 104 Q45 109 25 104Z"/>
      <path fill="#56318a" d="M45 76 L48 105 Q45 105.5 42 105Z"/>
      <path fill="#f28c28" d="M37 72.5 L45 78 L53 72.5 Q45 70 37 72.5Z"/>
      <path fill="#2b1d3f" d="M29.6 88 H60.4 L61.1 91 H28.9Z"/><rect x="43" y="87.5" width="4" height="4" fill="none" stroke="#f2c94c" stroke-width="0.9"/>
      <path fill="#6a3fa0" d="M35 75 Q28 80 27 90 L31 91 Q32 83 37 80Z"/><circle cx="29" cy="91.5" r="2.4" fill="#f3c7a5"/>
      <path fill="#6a3fa0" d="M55 75 Q62 80 64 90 L60 91 Q58 83 53 80Z"/><circle cx="62" cy="91.5" r="2.4" fill="#f3c7a5"/>
      <circle cx="62" cy="100" r="11" fill="url(#${u('lamp')})"/>
      <path stroke="#2b1d3f" stroke-width="0.8" d="M62 93.5 V96"/>
      <ellipse cx="62" cy="100" rx="6" ry="4.8" fill="#f28c28"/><ellipse cx="62" cy="100" rx="2.6" ry="4.8" fill="#f7a23c"/>
      <path fill="#2b1d3f" d="M59 98.5 L60.4 97 L61 99Z M65 98.5 L63.6 97 L63 99Z M59.5 101.4 Q62 103.4 64.5 101.4 L62 102.2Z"/>
      <circle cx="45" cy="58" r="10" fill="#f3c7a5"/>
      <path fill="#e06b3a" d="M35 56 Q36 49 45 49 Q54 49 55 56 Q50 53 45 54 Q40 53 35 56Z"/>
      ${eyes(41, 49, 59)}
      <circle cx="38.5" cy="62.5" r="1.8" fill="#f4a6a6" opacity="0.8"/><circle cx="51.5" cy="62.5" r="1.8" fill="#f4a6a6" opacity="0.8"/>
      <path fill="none" stroke="#a0463a" stroke-width="0.9" stroke-linecap="round" d="M43 63.5 Q45 65.5 47 63.5"/>
      <g fill="#d98a6a"><circle cx="40" cy="61.6" r="0.35"/><circle cx="41.4" cy="62.4" r="0.35"/><circle cx="48.6" cy="62.4" r="0.35"/><circle cx="50" cy="61.6" r="0.35"/></g>
      <ellipse cx="45" cy="50" rx="18" ry="3.6" fill="#2b1d3f"/>
      <path fill="#3a2652" d="M35 50 L42 30 Q44 22 50 20 Q56 19 60 24 Q54 23 52 28 L55 50Z"/>
      <path fill="#f28c28" d="M36.6 45.5 H54.2 L54.6 49.4 H35.4Z"/><rect x="43.4" y="45.3" width="3.6" height="4.2" fill="none" stroke="#f2c94c" stroke-width="0.8"/>`,
  })),

  // ── Christmas ──
  scene('christmas', 'landscape', 'wide', 'sc-village', 'Winter village', '#14234a', (u) => ({
    defs:
      lin(u('sky'), [[0, '#14234a'], [0.6, '#2f4f8a'], [1, '#8fb4d8']]) +
      lin(u('aurora'), [[0, '#6fe3b0', 0], [0.45, '#6fe3b0', 0.55], [1, '#8f7ae8', 0]], 1, 0) +
      lin(u('snow'), [[0, '#ffffff'], [1, '#dce8f5']]) +
      rad(u('lamp'), [[0, '#ffe08a', 0.7], [1, '#ffe08a', 0]]),
    body: `
      <rect width="150" height="100" fill="url(#${u('sky')})"/>
      <path fill="url(#${u('aurora')})" d="M0 30 Q40 10 75 26 Q110 40 150 18 V28 Q110 52 75 38 Q40 22 0 42Z"/>
      ${stars([[10, 10, 0.7], [26, 18, 0.5], [44, 8, 0.6], [92, 12, 0.6], [112, 8, 0.5], [140, 30, 0.6], [60, 16, 0.4]])}
      <path fill="#fdf3d6" d="M128 10 A8 8 0 1 0 136 22 A9.5 9.5 0 0 1 128 10Z"/>
      <path fill="#c9d9ec" d="M0 62 Q35 46 70 58 Q105 44 150 58 V100 H0Z"/>
      ${[[14, 56, 9], [22, 54, 11], [96, 52, 10], [104, 53, 8], [136, 56, 9], [144, 57, 11]].map(([x, b, h]) => pine(x, b, h, '#5f7fab')).join('')}
      <g>
        <rect x="30" y="63" width="26" height="16" fill="#c8583b"/>
        <rect x="50" y="52" width="4" height="9" fill="#5b3a2a"/><rect x="49.4" y="51" width="5.2" height="1.8" rx="0.9" fill="#ffffff"/>
        <path fill="#5b3a2a" d="M28 64 L43 50 L58 64Z"/>
        <path fill="#ffffff" d="M27 64.5 L43 49 L59 64.5 L56 64.5 L43 52.6 L30 64.5Z"/>
        <g fill="#ffd36a"><rect x="33.5" y="67" width="5" height="5"/><rect x="47.5" y="67" width="5" height="5"/></g>
        <rect x="40.5" y="70" width="5" height="9" fill="#5b3a2a"/>
        <circle cx="53" cy="47" r="2" fill="#e6edf5" opacity="0.6"/><circle cx="55.5" cy="43" r="2.6" fill="#e6edf5" opacity="0.45"/><circle cx="59" cy="38.5" r="3.2" fill="#e6edf5" opacity="0.3"/>
      </g>
      <g>
        <rect x="62" y="60" width="20" height="20" fill="#3f6a8f"/>
        <path fill="#2b3f5a" d="M59 61 L72 46 L85 61Z"/>
        <path fill="#ffffff" d="M58 61.5 L72 45 L86 61.5 L83 61.5 L72 48.8 L61 61.5Z"/>
        <g fill="#ffd36a"><rect x="65" y="64" width="4.5" height="5"/><rect x="74.5" y="64" width="4.5" height="5"/><circle cx="72" cy="55" r="2.2"/></g>
        <rect x="69.5" y="71" width="5" height="9" fill="#2b3f5a"/>
      </g>
      <g>
        <rect x="96" y="64" width="18" height="14" fill="#2f7d4f"/>
        <path fill="#5b3a2a" d="M93 65 L105 54 L117 65Z"/>
        <path fill="#ffffff" d="M92 65.5 L105 53 L118 65.5 L115 65.5 L105 56.6 L95 65.5Z"/>
        <g fill="#ffd36a"><rect x="99" y="67.5" width="4.5" height="4.5"/><rect x="106.5" y="67.5" width="4.5" height="4.5"/></g>
      </g>
      ${pine(88, 80, 16, '#2f6b4f', '#ffffff')}
      <g fill="#e2474a"><circle cx="86" cy="72" r="0.9"/><circle cx="90.4" cy="75.6" r="0.9"/></g><g fill="#f7c948"><circle cx="89.4" cy="70.6" r="0.9"/><circle cx="85" cy="77" r="0.9"/><path d="M88 62.4 l0.9 1.8 l1.9 .3 l-1.4 1.3 l.4 1.9 l-1.8 -1 l-1.8 1 l.4 -1.9 l-1.4 -1.3 l1.9 -.3z"/></g>
      <circle cx="122" cy="68" r="7" fill="url(#${u('lamp')})"/>
      <rect x="121.4" y="68" width="1.2" height="16" fill="#2b3f5a"/><circle cx="122" cy="68" r="1.8" fill="#ffe08a"/>
      ${pine(10, 88, 22, '#1f4a3a', '#ffffff')}${pine(138, 86, 24, '#1f4a3a', '#ffffff')}${pine(148, 90, 18, '#1f4a3a', '#ffffff')}
      <path fill="url(#${u('snow')})" d="M0 80 Q40 74 75 80 Q110 86 150 78 V100 H0Z"/>
      <path fill="none" stroke="#c9d9ec" stroke-width="1" stroke-dasharray="1.6 2.4" d="M43 81 Q50 90 70 94 Q90 98 110 92"/>
      ${stars([[8, 50, 0.7], [20, 36, 0.6], [36, 46, 0.5], [60, 40, 0.7], [84, 30, 0.5], [100, 40, 0.6], [118, 50, 0.7], [140, 44, 0.5], [70, 72, 0.5], [30, 90, 0.6], [126, 92, 0.6]], '#ffffff')}`,
  })),
  scene('christmas', 'people', 'tall', 'sc-santa', 'Jolly Santa', '#1d3a5f', (u) => ({
    defs:
      lin(u('bg'), [[0, '#1d3a5f'], [1, '#3f6a8f']]) +
      lin(u('coat'), [[0, '#e2474a'], [1, '#a8262b']]),
    body: `
      <rect width="90" height="120" fill="url(#${u('bg')})"/>
      ${stars([[10, 40, 1], [20, 22, 0.8], [70, 20, 0.9], [80, 44, 1], [14, 68, 0.8], [78, 72, 0.9], [30, 10, 0.6], [60, 8, 0.7], [8, 90, 0.7], [84, 96, 0.8]], '#ffffff')}
      <path fill="url(#${u('coat')})" d="M4 120 Q6 96 30 90 Q45 86 60 90 Q84 96 86 120Z"/>
      <rect x="4" y="108" width="82" height="6" fill="#2b2233"/>
      <rect x="40" y="91" width="10" height="29" rx="2" fill="#f6f1ea"/>
      <rect x="39" y="106.6" width="12" height="8.8" rx="1" fill="none" stroke="#f2c94c" stroke-width="1.6"/>
      <circle cx="31" cy="59" r="3" fill="#eab394"/><circle cx="59" cy="59" r="3" fill="#eab394"/>
      <circle cx="45" cy="58" r="14" fill="#f5c9a6"/>
      <path fill="#f6f1ea" d="M29 58 Q27 78 34 90 Q40 99 45 100 Q50 99 56 90 Q63 78 61 58 Q58 66 52 67 Q45 64 38 67 Q32 66 29 58Z"/>
      <path fill="none" stroke="#dcd6cc" stroke-width="0.7" stroke-linecap="round" d="M36 76 Q38 84 42 90 M45 74 V94 M54 76 Q52 84 48 90 M32 70 Q34 78 37 84 M58 70 Q56 78 53 84"/>
      <circle cx="36" cy="61" r="2.6" fill="#f08a8a" opacity="0.55"/><circle cx="54" cy="61" r="2.6" fill="#f08a8a" opacity="0.55"/>
      <path fill="none" stroke="#3a2a22" stroke-width="1.2" stroke-linecap="round" d="M37.4 56.6 Q39.6 54.4 41.8 56.6 M48.2 56.6 Q50.4 54.4 52.6 56.6"/>
      <path fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" d="M36 52 Q39.5 49.6 43 51.6 M47 51.6 Q50.5 49.6 54 52"/>
      <ellipse cx="45" cy="70.5" rx="2.6" ry="1.8" fill="#8a3a3a"/>
      <path fill="#ffffff" stroke="#dcd6cc" stroke-width="0.6" d="M45 65.5 Q38 62 33.5 66.5 Q37 70.5 45 67.5 Q53 70.5 56.5 66.5 Q52 62 45 65.5Z"/>
      <circle cx="45" cy="62.4" r="2.6" fill="#eaa58a"/>
      <path fill="url(#${u('coat')})" d="M30 46 Q32 24 50 22 Q66 22 74 38 L70 40 Q64 30 56 32 Q60 40 60 46Z"/>
      <circle cx="73" cy="41" r="5" fill="#f6f1ea"/>
      <rect x="28" y="42" width="34" height="8" rx="4" fill="#f6f1ea"/>`,
  })),

  // ── Love ──
  scene('love', 'landscape', 'wide', 'sc-sakura', 'Sakura bridge', '#c96a8a', (u) => ({
    defs:
      lin(u('sky'), [[0, '#ffd6e0'], [0.6, '#ffe9d6'], [1, '#fff6ea']]) +
      lin(u('water'), [[0, '#f7c4d2'], [1, '#9fbfe0']]) +
      rad(u('sun'), [[0, '#fff6e6'], [0.5, '#fff0dc', 0.6], [1, '#fff0dc', 0]]),
    body: `
      <rect width="150" height="100" fill="url(#${u('sky')})"/>
      <circle cx="104" cy="30" r="22" fill="url(#${u('sun')})"/><circle cx="104" cy="30" r="10" fill="#fff6e6"/>
      <path fill="#e8b8cf" opacity="0.85" d="M0 56 L25 38 L40 48 L62 30 L88 52 L110 40 L150 58 V72 H0Z"/>
      <path fill="#ffffff" opacity="0.85" d="M62 30 L56 35 L60 34.4 L63 36.4 L67 33.6Z"/>
      <path fill="#c99ac0" d="M0 64 Q30 54 60 62 Q100 56 150 64 V72 H0Z"/>
      <rect y="70" width="150" height="30" fill="url(#${u('water')})"/>
      <path fill="none" stroke="#d9483b" stroke-width="1.6" opacity="0.3" d="M48 77 Q80 98 112 77"/>
      <path fill="none" stroke="#ffffff" stroke-width="0.9" stroke-linecap="round" opacity="0.7" d="M20 80 H34 M60 92 H80 M90 86 H104 M118 92 H132 M70 98 H84"/>
      <path fill="#9fcf8a" d="M0 71 Q24 68 44 76 Q32 88 0 92Z"/>
      <path fill="#8fbf7a" d="M150 73 Q122 75 112 84 Q126 94 150 96Z"/>
      <path fill="#d9483b" d="M46 74.5 Q80 51 114 74.5 L114 78 Q80 55.4 46 78Z"/>
      <g stroke="#d9483b" stroke-width="1.1">${[0.1, 0.22, 0.34, 0.5, 0.66, 0.78, 0.9]
        .map((t) => {
          const x = 46 + 68 * t
          const deck = 74.5 - 47 * t * (1 - t)
          return `<path d="M${x.toFixed(1)} ${deck.toFixed(1)} V${(deck - 5).toFixed(1)}"/>`
        })
        .join('')}</g>
      <path fill="none" stroke="#d9483b" stroke-width="1.4" d="M47 69.5 Q80 46 113 69.5"/>
      <g fill="#2b2233"><rect x="46" y="68" width="2" height="8"/><rect x="112" y="68" width="2" height="8"/></g>
      <path fill="#5a3a3a" d="M14 100 Q18 80 16 66 Q12 56 6 50 L9 49 Q15 55 18 60 Q20 48 28 40 L30 42 Q23 50 21 62 Q28 56 38 54 L38 57 Q28 60 22 70 Q21 84 24 100Z"/>
      <g>${[
        [4, 44, 8, '#f7b6c8'], [14, 36, 9, '#f9c6d4'], [26, 32, 9, '#f4a6b8'], [38, 38, 8, '#f9c6d4'], [44, 50, 7, '#f4a6b8'],
        [2, 56, 6, '#f4a6b8'], [20, 46, 8, '#fbd6e0'], [32, 48, 7, '#f7b6c8'], [8, 30, 6, '#fbd6e0'], [36, 28, 6, '#f7b6c8'], [24, 22, 6, '#fbd6e0'],
      ]
        .map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`)
        .join('')}</g>
      <g fill="#f4a6b8">${[[52, 30, 20], [60, 44, 70], [70, 36, -30], [86, 58, 40], [48, 62, -10], [124, 48, 30], [96, 84, 60], [40, 88, -40]]
        .map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="1.6" ry="0.9" transform="rotate(${a} ${x} ${y})"/>`)
        .join('')}</g>
      ${birds([[126, 18, 1], [134, 24, 0.7]], '#a86a8a')}`,
  })),
  scene('love', 'people', 'tall', 'sc-couple', 'Sunset couple', '#5b3a7a', (u) => ({
    defs:
      lin(u('sky'), [[0, '#5b3a7a'], [0.45, '#e2647a'], [0.8, '#f7a26a'], [1, '#ffd59a']]) +
      rad(u('sun'), [[0, '#fff1c9'], [0.6, '#ffd59a'], [1, '#ffd59a', 0]]),
    body: `
      <rect width="90" height="120" fill="url(#${u('sky')})"/>
      ${stars([[18, 22, 0.6], [30, 12, 0.5], [70, 18, 0.6], [62, 8, 0.4], [80, 34, 0.5]])}
      <circle cx="45" cy="86" r="34" fill="url(#${u('sun')})"/>
      <g fill="#f7a26a" opacity="0.6"><ellipse cx="22" cy="80" rx="18" ry="1.6"/><ellipse cx="70" cy="74" rx="16" ry="1.4"/></g>
      <path fill="#3a1f3f" d="M0 98 Q45 84 90 98 V120 H0Z"/>
      <g fill="#3a1f3f">
        <circle cx="37" cy="66" r="4.2"/>
        <path d="M32.6 65 Q32.6 60 37 60 Q41.4 60 41.4 65 L42.4 72 L39.6 70 H34.4 L31.6 72Z"/>
        <path d="M34.5 70.5 Q37 69.5 39.5 70.5 L41 78 L44 87 H30 L33 78Z"/>
        <rect x="34.2" y="86" width="1.6" height="5.4"/><rect x="38" y="86" width="1.6" height="5.4"/>
        <circle cx="52" cy="63" r="4.5"/>
        <path d="M48 68.5 Q52 67 56 68.5 L57 80 H47Z"/>
        <path d="M47.5 79 H51.6 L51 91.4 H48.6Z M52.4 79 H56.5 L55.4 91.4 H53Z"/>
      </g>
      <g fill="none" stroke="#3a1f3f" stroke-width="1.7" stroke-linecap="round">
        <path d="M39.6 72 L45 78.4 L48 70.5"/>
        <path d="M56 70 L60 62"/>
      </g>
      <path fill="none" stroke="#3a1f3f" stroke-width="0.5" d="M60 62 Q64 50 62.4 40"/>
      <path fill="#e2474a" d="M62.4 41 C52 33 50 25 55 22 C58 20 61 22 62.4 25 C63.8 22 66.8 20 69.8 22 C74.8 25 72.8 33 62.4 41Z"/>
      <path fill="#ffffff" opacity="0.5" d="M56 25 Q57 23 59 24 Q57 25 57 28Z"/>
      <g fill="#f4a6b8" opacity="0.85">
        <path d="M20 46 c-2.4 -2 -2.8 -4 -1.4 -4.8 c.8 -.5 1.4 0 1.4 .7 c0 -.7 .6 -1.2 1.4 -.7 c1.4 .8 1 2.8 -1.4 4.8z"/>
        <path d="M74 56 c-1.8 -1.5 -2.1 -3 -1 -3.6 c.6 -.4 1 0 1 .5 c0 -.5 .4 -.9 1 -.5 c1.1 .6 .8 2.1 -1 3.6z"/>
      </g>
      ${birds([[22, 32, 1], [30, 36, 0.7], [70, 46, 0.8]], '#3a1f3f')}`,
  })),

  // ── Nature ──
  scene('nature', 'landscape', 'wide', 'sc-valley', 'Valley sunrise', '#3f3a55', (u) => ({
    defs:
      lin(u('sky'), [[0, '#ffb88a'], [0.5, '#ffd9a8'], [1, '#fff1d6']]) +
      rad(u('sun'), [[0, '#fff6dc'], [0.4, '#fff1c9', 0.7], [1, '#fff1c9', 0]]) +
      lin(u('river'), [[0, '#fff1d6'], [1, '#9fc3d8']]),
    body: `
      <rect width="150" height="100" fill="url(#${u('sky')})"/>
      <g fill="#fff6dc" opacity="0.25">
        <path d="M75 52 L40 0 H52Z M75 52 L66 0 H80Z M75 52 L96 0 H108Z M75 52 L124 0 H140Z M75 52 L0 14 V26Z M75 52 L150 18 V30Z"/>
      </g>
      <circle cx="75" cy="52" r="30" fill="url(#${u('sun')})"/>
      <circle cx="75" cy="52" r="11" fill="#fff6dc"/>
      <path fill="#e7b9a8" d="M0 52 L18 40 L32 48 L50 34 L68 46 L88 30 L108 44 L126 36 L150 48 V100 H0Z"/>
      <path fill="#c98f8f" d="M0 62 L22 48 L40 58 L60 46 L82 60 L104 50 L122 58 L150 50 V100 H0Z"/>
      <path fill="#8f6a86" d="M0 72 Q20 60 42 68 Q70 58 92 70 Q120 62 150 70 V100 H0Z"/>
      <path fill="url(#${u('river')})" d="M72 69 Q66 76 74 80 Q86 86 70 92 Q58 98 60 100 H94 Q84 96 94 90 Q104 84 84 78 Q76 74 77 69Z"/>
      <path fill="#3f3a55" d="M0 82 Q20 74 40 84 Q52 92 62 100 H0Z"/>
      <path fill="#3f3a55" d="M150 80 Q120 76 100 88 Q94 94 92 100 H150Z"/>
      ${[[6, 84, 14], [14, 82, 18], [22, 84, 13], [30, 88, 15], [118, 84, 15], [128, 82, 19], [138, 81, 14], [146, 83, 17], [108, 90, 12]].map(([x, b, h]) => pine(x, b, h, '#2f2b45')).join('')}
      ${birds([[46, 26, 1], [54, 22, 0.8], [104, 24, 0.9]], '#8f6a86')}`,
  })),
  scene('nature', 'people', 'tall', 'sc-hiker', 'Summit hiker', '#3a3450', (u) => ({
    defs:
      lin(u('sky'), [[0, '#7fb0d8'], [0.6, '#f7c6a0'], [1, '#f7a27a']]) +
      rad(u('sun'), [[0, '#fff6dc'], [0.4, '#fff1c9', 0.7], [1, '#fff1c9', 0]]),
    body: `
      <rect width="90" height="120" fill="url(#${u('sky')})"/>
      <circle cx="60" cy="64" r="26" fill="url(#${u('sun')})"/><circle cx="60" cy="64" r="10" fill="#fff6dc"/>
      <path fill="#ffffff" opacity="0.6" d="M8 34 Q12 28 20 31 Q26 26 32 32 Q38 32 36 36 H8Z M58 22 Q62 18 68 20 Q74 17 78 22 H58Z"/>
      <path fill="#b48fa8" opacity="0.85" d="M0 80 L14 64 L26 72 L44 54 L60 70 L76 60 L90 70 V120 H0Z"/>
      <path fill="#ffffff" opacity="0.8" d="M44 54 L39 59.5 L43 58.6 L45.4 60.6 L48.6 58Z"/>
      <path fill="#7a6a8f" d="M0 92 L18 78 L34 88 L52 76 L70 90 L90 80 V120 H0Z"/>
      <ellipse cx="60" cy="94" rx="40" ry="4" fill="#ffffff" opacity="0.35"/>
      <path fill="#3a3450" d="M0 120 V98 L12 92 L24 84 L32 80.5 L40 82 L48 90 L60 100 L74 108 L90 112 V120Z"/>
      <g fill="#2a2440">
        <circle cx="34.6" cy="59" r="3.2"/>
        <path d="M31 57 H39 L38.4 58.2 H31Z"/>
        <rect x="27.2" y="61.6" width="5.4" height="9.4" rx="1.6"/>
        <ellipse cx="29.9" cy="61.4" rx="3.2" ry="1.4"/>
        <path d="M31.6 62.4 Q34.4 61.4 37 62.4 L37.2 71.4 H31.2Z"/>
        <path d="M31.4 71 H34.4 L32.6 80.6 H30.2Z"/>
        <path d="M33.6 71 H37 L39.6 76.2 L39.2 81 H36.8 L37.4 76.8Z"/>
      </g>
      <path fill="none" stroke="#2a2440" stroke-width="1.8" stroke-linecap="round" d="M36.4 63.6 L40 68.4"/>
      <path fill="none" stroke="#2a2440" stroke-width="0.8" stroke-linecap="round" d="M39.2 65.8 L42.6 81.6"/>
      ${birds([[66, 46, 0.9], [72, 50, 0.7], [20, 50, 0.8]], '#7a6a8f')}`,
  })),

  // ── Animals ──
  scene('animals', 'landscape', 'wide', 'sc-savanna', 'Savanna sunset', '#3a1f2a', (u) => ({
    defs:
      lin(u('sky'), [[0, '#7b3f61'], [0.5, '#e2574c'], [0.85, '#f7a23c'], [1, '#ffd38a']]) +
      rad(u('sun'), [[0, '#fff1c4'], [0.55, '#ffd38a'], [1, '#ffd38a', 0]]),
    body: `
      <rect width="150" height="100" fill="url(#${u('sky')})"/>
      <circle cx="92" cy="66" r="34" fill="url(#${u('sun')})"/>
      <g fill="#7b3f61" opacity="0.3"><ellipse cx="34" cy="30" rx="26" ry="2.2"/><ellipse cx="44" cy="34" rx="16" ry="1.4"/><ellipse cx="120" cy="22" rx="20" ry="1.8"/></g>
      <g fill="#5a2a3a" opacity="0.7"><ellipse cx="56" cy="78" rx="10" ry="3"/><ellipse cx="70" cy="77" rx="6" ry="2.4"/><ellipse cx="140" cy="78" rx="9" ry="3"/></g>
      <path fill="#3a1f2a" d="M0 79 Q75 73 150 79 V100 H0Z"/>
      <g fill="#2a1620">
        <path d="M28 80 L30 62 Q24 56 18 52 L19 51 Q26 54 31 59 L32 50 L34 50 L33 60 Q38 54 44 52 L44 53.5 Q38 57 34 63 L33 80Z"/>
        <path d="M4 50.5 Q14 42 30 42.5 Q46 40.5 58 46.5 Q50 50.5 40 50.5 Q24 52.5 4 50.5Z"/>
        <path d="M12 45 Q26 37 46 40.5 Q34 43.5 12 45Z"/>
      </g>
      <g fill="#2a1620" stroke="#2a1620">${GIRAFFE}</g>
      <g fill="#2a1620" stroke="#2a1620" transform="translate(140 80) scale(0.62) translate(-117 -80)">${GIRAFFE}</g>
      <path fill="none" stroke="#2a1620" stroke-width="0.7" stroke-linecap="round" d="M44 92 L45 86 M46 92 L48 87 M48 92 L48.4 85.6 M96 94 L97 88 M98 94 L100 89 M70 96 L70.6 91 M72 96 L74 92"/>
      ${birds([[50, 24, 1.1], [58, 30, 0.8], [64, 22, 0.7]], '#3a1f2a')}`,
  })),
  scene('animals', 'people', 'tall', 'sc-dog', 'Girl & her dog', '#4f7a3a', (u) => ({
    defs:
      lin(u('bg'), [[0, '#cfe8f2'], [0.65, '#fdf1d6'], [1, '#e8f0c8']]) +
      lin(u('dog'), [[0, '#efbd72'], [1, '#d99a4a']]),
    body: `
      <rect width="90" height="120" fill="url(#${u('bg')})"/>
      <circle cx="68" cy="30" r="9" fill="#ffe28a"/><circle cx="68" cy="30" r="14" fill="#ffe28a" opacity="0.3"/>
      <path fill="#ffffff" d="M12 34 Q16 28 22 31 Q28 26 34 32 Q40 32 38 37 H12Z"/>
      <path fill="#a8cf7a" d="M0 86 Q40 76 90 84 V120 H0Z"/>
      <path fill="#7a4b35" d="M21 58 Q20 42 34 42 Q48 42 47 58 L48 70 Q44 64 44 56 H24 Q24 64 20 70Z"/>
      <path fill="#7a4b35" d="M44 45 Q57 43 56 56 Q54 64 49 69 Q51 58 45 52Z"/>
      <circle cx="44.6" cy="46.6" r="2" fill="#e2474a"/>
      <path fill="#5b8db8" d="M8 120 Q10 86 34 81 Q48 83 54 92 L54 120Z"/>
      <path fill="#ffffff" opacity="0.5" d="M14 100 H54 V103 H13Z M12 110 H54 V113 H11Z"/>
      <rect x="31" y="68" width="6" height="14" fill="#e8b08f"/>
      <path fill="url(#${u('dog')})" d="M42 120 Q44 90 64 86 Q84 90 86 120Z"/>
      <path fill="#f6d9a8" d="M56 120 Q58 96 64 94 Q70 96 72 120Z"/>
      <path fill="#e2474a" d="M53 84 Q64 89 75 84 L75.4 87.4 Q64 92.4 52.6 87.4Z"/><circle cx="64" cy="91.6" r="2" fill="#f7c948"/>
      <path fill="#c98a45" d="M53 60 Q45 64 47 80 Q51 83 55 75Z M75 60 Q83 64 81 80 Q77 83 73 75Z"/>
      <ellipse cx="64" cy="71" rx="12.5" ry="12" fill="url(#${u('dog')})"/>
      <ellipse cx="64" cy="78" rx="7" ry="5" fill="#f6d9a8"/>
      <path fill="#f08a9a" d="M62.4 80.4 Q64 87 65.6 80.4Z"/>
      <path fill="none" stroke="#2b2233" stroke-width="0.8" stroke-linecap="round" d="M60 80 Q62 81.6 64 80 Q66 81.6 68 80 M64 77 V80"/>
      <ellipse cx="64" cy="75.4" rx="2.6" ry="1.9" fill="#2b2233"/>
      ${eyes(59, 69, 69.4)}
      <circle cx="34" cy="58" r="12" fill="#f3c7a5"/>
      <path fill="#7a4b35" d="M22.6 55 Q23.6 45 34 45 Q43 45 45.6 52.6 Q38 49.6 30 53.4 Q26 52.6 22.6 55Z"/>
      ${eyes(29.6, 38.4, 59)}
      <circle cx="27" cy="63" r="2" fill="#f4a6a6" opacity="0.8"/><circle cx="41" cy="63" r="2" fill="#f4a6a6" opacity="0.8"/>
      <path fill="#c8564a" d="M31 63.6 Q34 67.4 37 63.6Z"/>
      <path fill="#5b8db8" d="M18 98 Q30 92 46 96 L58 99 L57.4 104 L44 102 Q30 100 22 106Z"/>
      <ellipse cx="59" cy="101.4" rx="3.6" ry="3" fill="#f3c7a5"/>
      <g>${[[8, 92, '#f4a6b8'], [16, 104, '#ffffff'], [78, 100, '#f7c948'], [84, 90, '#ffffff'], [6, 112, '#f7c948']]
        .map(([x, y, c]) => `<g fill="${c}">${[0, 72, 144, 216, 288].map((d) => `<circle cx="${x}" cy="${(y as number) - 1.8}" r="1.3" transform="rotate(${d} ${x} ${y})"/>`).join('')}</g><circle cx="${x}" cy="${y}" r="1" fill="#e9a23b"/>`)
        .join('')}</g>`,
  })),

  // ── Coffee & Food ──
  scene('food', 'landscape', 'wide', 'sc-cafe', 'Corner café', '#5d3826', (u) => ({
    defs:
      lin(u('sky'), [[0, '#cfe8f2'], [1, '#fdf1e0']]) +
      rad(u('glow'), [[0, '#fff3c4'], [0.7, '#f7c96a'], [1, '#e9a23b']], 0.5, 0.4, 0.8),
    body: `
      <rect width="150" height="100" fill="url(#${u('sky')})"/>
      <g fill="#e8dccb"><rect x="0" y="30" width="22" height="70"/><rect x="128" y="24" width="22" height="76"/></g>
      <g fill="#d6c6b0"><rect x="5" y="38" width="5" height="6"/><rect x="13" y="38" width="5" height="6"/><rect x="5" y="50" width="5" height="6"/><rect x="134" y="32" width="5" height="6"/><rect x="142" y="32" width="5" height="6"/><rect x="134" y="44" width="5" height="6"/></g>
      <rect x="20" y="20" width="110" height="70" fill="#f2e3cf"/>
      <rect x="18" y="18" width="114" height="5" fill="#c98a5a"/>
      <g fill="#9fc3d8" stroke="#c98a5a" stroke-width="1.2"><rect x="30" y="28" width="12" height="10"/><rect x="69" y="28" width="12" height="10"/><rect x="108" y="28" width="12" height="10"/></g>
      <rect x="52" y="41" width="46" height="9" rx="2" fill="#5d3826"/>
      <path fill="#fdf1e0" d="M70.5 43 H77.5 L76.8 48 H71.2Z M77.5 44 Q80 44 80 45.4 Q80 46.8 77.2 46.8 V46 Q79 46 79 45.4 Q79 44.8 77.4 44.8Z"/>
      <g fill="#fdf1e0"><circle cx="60" cy="45.5" r="1"/><circle cx="64" cy="45.5" r="1"/><circle cx="86" cy="45.5" r="1"/><circle cx="90" cy="45.5" r="1"/></g>
      ${Array.from({ length: 14 }, (_, i) => {
        const x = 20 + i * 8
        const c = i % 2 ? '#fdf6ec' : '#e2574c'
        return `<rect x="${x}" y="52" width="8" height="8" fill="${c}"/><circle cx="${x + 4}" cy="60" r="4" fill="${c}"/>`
      }).join('')}
      <rect x="20" y="51" width="112" height="2" fill="#c8383b"/>
      <rect x="30" y="64" width="52" height="24" fill="url(#${u('glow')})" stroke="#5d3826" stroke-width="1.6"/>
      <path stroke="#5d3826" stroke-width="1" d="M56 64 V88"/>
      <g fill="#5d3826"><path d="M38 64 V67 M74 64 V67" stroke="#5d3826" stroke-width="0.5"/><path d="M35 67 A3 3 0 0 1 41 67Z M71 67 A3 3 0 0 1 77 67Z"/><rect x="30" y="79" width="52" height="1.4"/></g>
      <g fill="#ffffff"><rect x="36" y="76" width="3" height="3" rx="0.5"/><rect x="43" y="76" width="3" height="3" rx="0.5"/><rect x="62" y="75" width="4" height="4" rx="0.6"/><rect x="70" y="76" width="3" height="3" rx="0.5"/></g>
      <rect x="92" y="63" width="18" height="27" fill="#5d3826"/>
      <rect x="95" y="66" width="12" height="12" rx="1" fill="url(#${u('glow')})"/>
      <circle cx="105.6" cy="80" r="0.9" fill="#f7c948"/>
      <path fill="#c98a5a" d="M113 82 H123 L121.4 90 H114.6Z"/>
      <g fill="#4f8f5a"><ellipse cx="118" cy="78" rx="4" ry="5"/><ellipse cx="114.6" cy="76" rx="2.4" ry="4" transform="rotate(-30 114.6 76)"/><ellipse cx="121.6" cy="76" rx="2.4" ry="4" transform="rotate(30 121.6 76)"/></g>
      <rect y="90" width="150" height="10" fill="#d8c8b4"/><rect y="90" width="150" height="1.2" fill="#c4b29c"/>
      <g fill="#5d3826"><ellipse cx="44" cy="88" rx="8" ry="1.6"/><rect x="43.3" y="88" width="1.4" height="7"/><rect x="40" y="94.4" width="8" height="1"/></g>
      <path fill="none" stroke="#5d3826" stroke-width="0.9" d="M32 86 V95 M32 89 H36 V95 M56 86 V95 M56 89 H52 V95"/>
      <g fill="#ffffff"><rect x="40" y="85" width="2.4" height="2.4" rx="0.4"/><rect x="45.6" y="85" width="2.4" height="2.4" rx="0.4"/></g>
      <path fill="none" stroke="#5d3826" stroke-width="0.5" d="M20 14 Q75 26 130 14"/>
      <g fill="#ffd36a">${[0.08, 0.2, 0.32, 0.44, 0.56, 0.68, 0.8, 0.92]
        .map((t) => {
          const x = 20 + 110 * t
          const y = 14 + 24 * t * (1 - t)
          return `<circle cx="${x.toFixed(1)}" cy="${(y + 1.4).toFixed(1)}" r="1.2"/>`
        })
        .join('')}</g>`,
  })),
  scene('food', 'people', 'tall', 'sc-barista', 'Happy barista', '#5d3826', (u) => ({
    defs: lin(u('bg'), [[0, '#fdf1e0'], [1, '#f2d9bf']]),
    body: `
      <rect width="90" height="120" fill="url(#${u('bg')})"/>
      <rect x="0" y="40" width="90" height="2.4" fill="#c98a5a"/>
      <g><rect x="6" y="30" width="7" height="10" rx="1.6" fill="#f7c948" opacity="0.8"/><rect x="15" y="27" width="6" height="13" rx="1.6" fill="#e2574c" opacity="0.7"/>
        <rect x="70" y="31" width="7" height="9" rx="1.6" fill="#5b8db8" opacity="0.7"/><path fill="#c98a5a" d="M79 34 H86 L85 40 H80Z"/>
        <g fill="#4f8f5a"><ellipse cx="82.5" cy="31" rx="2" ry="3.4"/><ellipse cx="80" cy="32" rx="1.6" ry="3" transform="rotate(-35 80 32)"/><ellipse cx="85" cy="32" rx="1.6" ry="3" transform="rotate(35 85 32)"/></g></g>
      <rect x="0" y="70" width="90" height="2.4" fill="#c98a5a" opacity="0.6"/>
      <g opacity="0.6"><rect x="6" y="61" width="8" height="9" rx="1.6" fill="#ffffff"/><rect x="76" y="62" width="8" height="8" rx="1.6" fill="#ffffff"/></g>
      <path fill="#f6f1ea" d="M6 120 Q8 88 30 82 L45 86 L60 82 Q82 88 84 120Z"/>
      <path fill="#5d3826" d="M30.5 90 H59.5 L64 120 H26Z"/>
      <path fill="none" stroke="#5d3826" stroke-width="2" d="M33.6 90 L36.4 82 M56.4 90 L53.6 82"/>
      <rect x="39" y="106" width="12" height="7" rx="1" fill="#7a4b35"/>
      <rect x="41" y="71" width="8" height="12" fill="#e2a982"/>
      <circle cx="31.6" cy="61" r="2.6" fill="#eab394"/><circle cx="58.4" cy="61" r="2.6" fill="#eab394"/>
      <circle cx="31.6" cy="64.6" r="0.9" fill="#f7c948"/><circle cx="58.4" cy="64.6" r="0.9" fill="#f7c948"/>
      <circle cx="45" cy="60" r="13" fill="#f0bf98"/>
      <circle cx="45" cy="39.6" r="6.4" fill="#3a2a22"/>
      <path fill="#3a2a22" d="M31.4 60 Q30 44 45 44 Q60 44 58.6 60 Q57.6 52 51 49.6 Q45 53 38 49.6 Q32.6 52 31.4 60Z"/>
      <path fill="none" stroke="#3a2a22" stroke-width="1" stroke-linecap="round" d="M37.4 56 Q39.6 54.6 42 55.6 M48 55.6 Q50.4 54.6 52.6 56"/>
      <path fill="none" stroke="#3a2a22" stroke-width="1.2" stroke-linecap="round" d="M37.8 60.6 Q39.8 58.6 41.8 60.6 M48.2 60.6 Q50.2 58.6 52.2 60.6"/>
      <circle cx="37" cy="65" r="2.2" fill="#f08a8a" opacity="0.6"/><circle cx="53" cy="65" r="2.2" fill="#f08a8a" opacity="0.6"/>
      <path fill="#c8564a" d="M41.6 65.6 Q45 69.6 48.4 65.6Z"/>
      <path fill="#f6f1ea" d="M14 104 Q22 94 38 97 L38.6 102.6 Q26 101 18 110Z M76 104 Q68 94 52 97 L51.4 102.6 Q64 101 72 110Z"/>
      <path fill="#ffffff" stroke="#c9b8a5" stroke-width="0.8" d="M38.6 88 H51.4 L49.8 104 H40.2Z"/>
      <path fill="#c98a5a" d="M39.2 93 H50.8 L50.4 97.4 H39.6Z"/>
      <rect x="37.4" y="86" width="15.2" height="3" rx="1.2" fill="#f6f1ea" stroke="#c9b8a5" stroke-width="0.8"/>
      <ellipse cx="38.6" cy="99.4" rx="3.2" ry="2.8" fill="#f0bf98"/><ellipse cx="51.4" cy="99.4" rx="3.2" ry="2.8" fill="#f0bf98"/>`,
  })),

  // ── Space ──
  scene('space', 'landscape', 'wide', 'sc-alien', 'Alien world', '#0d0a26', (u) => ({
    defs:
      lin(u('sky'), [[0, '#0d0a26'], [0.6, '#3a1f6a'], [1, '#a8467a']]) +
      rad(u('neb'), [[0, '#f08ab8', 0.5], [1, '#f08ab8', 0]]) +
      rad(u('pl'), [[0, '#ffd59a'], [0.6, '#f2a25a'], [1, '#b0563a']], 0.35, 0.3, 0.8) +
      lin(u('ground'), [[0, '#5a3a7a'], [1, '#1d1238']]) +
      lin(u('cr'), [[0, '#b8f0fa'], [1, '#3fb3d0']]),
    body: `
      <rect width="150" height="100" fill="url(#${u('sky')})"/>
      <ellipse cx="40" cy="30" rx="44" ry="20" fill="url(#${u('neb')})"/>
      ${stars([[8, 10, 0.7], [20, 40, 0.5], [44, 8, 0.6], [62, 22, 0.8], [76, 10, 0.5], [92, 30, 0.6], [118, 8, 0.7], [140, 20, 0.6], [134, 44, 0.5], [10, 58, 0.5], [70, 40, 0.4]])}
      <circle cx="30" cy="22" r="6" fill="#d9d4ee"/><circle cx="28.4" cy="20.6" r="1.4" fill="#b9b2d8"/>
      <circle cx="50" cy="36" r="3" fill="#9fd3e8"/>
      <ellipse cx="104" cy="66" rx="54" ry="10" fill="none" stroke="#f7d6a0" stroke-opacity="0.5" stroke-width="3" transform="rotate(-10 104 66)"/>
      <circle cx="104" cy="66" r="32" fill="url(#${u('pl')})"/>
      <path fill="#b0563a" opacity="0.3" d="M73 58 Q104 48 135 58 L136 63 Q104 53 72 64Z M74 74 Q104 68 134 76 L131 81 Q104 73 77 80Z"/>
      <path fill="none" stroke="#f7d6a0" stroke-width="3" stroke-linecap="round" d="M50.6 74.6 A54 10 -10 0 0 157.4 57.4"/>
      <path fill="#3a2556" d="M0 72 L20 64 L34 70 L50 60 L66 72 L80 74 V100 H0Z"/>
      <path fill="url(#${u('ground')})" d="M0 80 Q40 72 80 80 Q115 86 150 78 V100 H0Z"/>
      <g><ellipse cx="44" cy="88" rx="10" ry="2.6" fill="#1d1238"/><path fill="none" stroke="#7a5aa0" stroke-width="0.8" d="M34 88 A10 2.6 0 0 0 54 88"/>
        <ellipse cx="102" cy="92" rx="7" ry="1.8" fill="#1d1238"/><path fill="none" stroke="#7a5aa0" stroke-width="0.7" d="M95 92 A7 1.8 0 0 0 109 92"/>
        <ellipse cx="134" cy="86" rx="5" ry="1.4" fill="#1d1238"/></g>
      <g fill="url(#${u('cr')})"><path d="M14 86 L17 72 L20 86Z"/><path d="M19 86 L24 64 L29 86Z"/><path d="M28 86 L31 76 L34 86Z"/></g>
      <path fill="#ffffff" opacity="0.4" d="M24 64 L22 86 H19Z M17 72 L15.6 86 H14Z"/>
      <g><rect x="114" y="76" width="14" height="5" rx="1.2" fill="#d6dce8"/><rect x="117" y="72" width="6" height="4" rx="1" fill="#9fb0c8"/>
        <path stroke="#d6dce8" stroke-width="0.6" d="M126 76 V70"/><circle cx="126" cy="69.4" r="1" fill="#e2574c"/>
        <g fill="#2b2233"><circle cx="116" cy="82" r="2"/><circle cx="121" cy="82" r="2"/><circle cx="126" cy="82" r="2"/></g></g>
      <path stroke="#ffffff" stroke-width="0.7" stroke-linecap="round" opacity="0.8" d="M110 14 L126 8"/>`,
  })),
  scene('space', 'people', 'tall', 'sc-astronaut', 'Floating astronaut', '#14143a', (u) => ({
    defs:
      rad(u('bg'), [[0, '#3a2a7a'], [1, '#0d0a26']], 0.5, 0.3, 0.8) +
      rad(u('earth'), [[0, '#6fc3e8'], [0.7, '#2a7fb8'], [1, '#1d4f8a']], 0.4, 0.2, 0.7) +
      lin(u('visor'), [[0, '#3a2a7a'], [0.6, '#1d2f5f'], [1, '#e2647a']], 1, 1),
    body: `
      <rect width="90" height="120" fill="url(#${u('bg')})"/>
      ${stars([[10, 40, 0.7], [20, 20, 0.5], [70, 18, 0.7], [80, 40, 0.5], [12, 74, 0.6], [80, 70, 0.6], [34, 10, 0.5], [58, 8, 0.4], [6, 96, 0.5], [86, 94, 0.5]])}
      <circle cx="45" cy="148" r="48" fill="url(#${u('earth')})"/>
      <path fill="#7fc36a" opacity="0.9" d="M16 112 Q24 104 34 108 Q40 112 34 118 Q24 120 16 112Z M54 104 Q64 100 72 106 Q70 112 62 112 Q56 110 54 104Z"/>
      <circle cx="45" cy="148" r="48" fill="none" stroke="#9fe0f5" stroke-opacity="0.5" stroke-width="2.4"/>
      <circle cx="74" cy="26" r="5" fill="#f2a25a"/><ellipse cx="74" cy="26" rx="9" ry="2" fill="none" stroke="#f7d6a0" stroke-width="0.8" transform="rotate(-20 74 26)"/>
      <path fill="none" stroke="#c9d0e0" stroke-width="0.9" stroke-dasharray="2 1.6" d="M30 70 Q12 80 10 60 Q8 40 0 36"/>
      <g transform="rotate(-12 45 62)">
        <rect x="29" y="46" width="32" height="30" rx="6" fill="#c9d0e0"/>
        <g stroke-linecap="round" fill="none">
          <path stroke="#c9d0e0" stroke-width="8.6" d="M33 62 L22 50 M57 63 L66 72 M38.6 82 L36 96 M51.4 82 L55 95"/>
          <path stroke="#f6f7fb" stroke-width="7" d="M33 62 L22 50 M57 63 L66 72 M38.6 82 L36 96 M51.4 82 L55 95"/>
        </g>
        <circle cx="21" cy="48.6" r="4" fill="#f28c28"/><circle cx="67" cy="73.4" r="4" fill="#f28c28"/>
        <ellipse cx="35.6" cy="98" rx="5" ry="3.4" fill="#c9d0e0"/><ellipse cx="55.6" cy="97.4" rx="5" ry="3.4" fill="#c9d0e0"/>
        <rect x="32" y="58" width="26" height="27" rx="8" fill="#f6f7fb"/>
        <rect x="38" y="64" width="14" height="9" rx="2" fill="#d6dce8"/>
        <circle cx="41.4" cy="68.5" r="1.4" fill="#e2574c"/><circle cx="45" cy="68.5" r="1.4" fill="#f7c948"/><circle cx="48.6" cy="68.5" r="1.4" fill="#5b8db8"/>
        <rect x="32" y="76" width="26" height="2.4" fill="#c9d0e0"/>
        <path stroke="#c9d0e0" stroke-width="1" d="M45 29 V24"/><circle cx="45" cy="23" r="1.6" fill="#e2574c"/>
        <circle cx="45" cy="44" r="15.4" fill="#c9d0e0"/>
        <circle cx="45" cy="44" r="14.4" fill="#f6f7fb"/>
        <ellipse cx="45" cy="45" rx="11" ry="9" fill="url(#${u('visor')})"/>
        <path fill="#ffffff" opacity="0.6" d="M37 41 Q39 37 44 36.4 Q40 39 39.4 43Z"/>
        <circle cx="51" cy="49" r="1.2" fill="#ffffff" opacity="0.5"/>
      </g>`,
  })),

  // ── Retro ──
  scene('retro', 'landscape', 'wide', 'sc-highway', 'Desert highway', '#2a1f5a', (u) => ({
    defs:
      lin(u('sky'), [[0, '#2a1f5a'], [0.45, '#c2477a'], [0.75, '#f7845a'], [1, '#ffd06a']]) +
      lin(u('sun'), [[0, '#ffe066'], [1, '#f05a5a']]) +
      lin(u('ground'), [[0, '#e07a4a'], [1, '#8a3a3a']]),
    body: `
      <rect width="150" height="100" fill="url(#${u('sky')})"/>
      ${stars([[12, 10, 0.7], [30, 18, 0.5], [52, 8, 0.6], [100, 10, 0.6], [124, 16, 0.5], [142, 8, 0.6]])}
      <circle cx="75" cy="58" r="26" fill="url(#${u('sun')})"/>
      <g fill="#ed7a62">${[44, 49, 53.6, 57.6]
        .map((y, i) => {
          const half = Math.sqrt(26 ** 2 - (y - 58) ** 2)
          return `<rect x="${(75 - half).toFixed(1)}" y="${y}" width="${(half * 2).toFixed(1)}" height="${1 + i * 0.6}"/>`
        })
        .join('')}</g>
      <path fill="#7a2f4a" d="M0 62 H14 L18 50 H34 L38 62Z M106 62 L112 46 H128 L132 54 H140 L143 62Z"/>
      <rect y="62" width="150" height="38" fill="url(#${u('ground')})"/>
      <path fill="#3a2a3a" d="M73 62 H77 L122 100 H28Z"/>
      <path fill="none" stroke="#ffd06a" stroke-width="0.9" d="M72.6 62 L30 100 M77.4 62 L120 100"/>
      <g fill="#ffd06a"><path d="M74.8 64 H75.2 L75.3 66 H74.7Z"/><path d="M74.6 69 H75.4 L75.6 73 H74.4Z"/><path d="M74.4 77 H75.6 L75.9 83 H74.1Z"/><path d="M74.1 88 H75.9 L76.3 97 H73.7Z"/></g>
      <g fill="#4a1f3a">
        <path d="M18 92 V72 Q18 69 20.5 69 Q23 69 23 72 V92Z M18 82 H13 Q11 82 11 80 V74 Q11 72.6 12.4 72.6 Q13.8 72.6 13.8 74 V78.6 H18Z M23 79 H27.4 V73 Q27.4 71.6 28.8 71.6 Q30.2 71.6 30.2 73 V80 Q30.2 82 28.2 82 H23Z"/>
        <path d="M134 86 V72 Q134 70 136 70 Q138 70 138 72 V86Z M134 79 H130.6 Q129 79 129 77.4 V74 Q129 73 130 73 Q131 73 131 74 V76.6 H134Z"/>
      </g>
      <g fill="#c2477a" opacity="0.6"><ellipse cx="50" cy="66" rx="6" ry="1.4"/><ellipse cx="102" cy="68" rx="8" ry="1.6"/></g>
      ${birds([[40, 30, 0.9], [46, 26, 0.7], [112, 30, 0.8]], '#2a1f5a')}`,
  })),
  scene('retro', 'people', 'tall', 'sc-diva', 'Retro diva', '#3a2218', (u) => ({
    defs: lin(u('bg'), [[0, '#ffe0a0'], [1, '#f7a26a']]),
    body: `
      <rect width="90" height="120" fill="url(#${u('bg')})"/>
      <g fill="none" stroke-width="8">${[['#e2574c', 62], ['#f28c28', 54], ['#f7c948', 46], ['#5fb3a0', 38]]
        .map(([c, r]) => `<circle cx="45" cy="120" r="${r}" stroke="${c}"/>`)
        .join('')}</g>
      <g fill="#f6f1ea"><path d="M12 22 l1.2 3 l3 1.2 l-3 1.2 l-1.2 3 l-1.2 -3 l-3 -1.2 l3 -1.2z"/><path d="M76 30 l1 2.4 l2.4 1 l-2.4 1 l-1 2.4 l-1 -2.4 l-2.4 -1 l2.4 -1z"/></g>
      <g fill="#3a2218">${[
        [45, 32, 9], [33, 36, 9], [57, 36, 9], [25, 46, 9], [65, 46, 9], [23, 58, 8.6], [67, 58, 8.6], [27, 69, 8], [63, 69, 8], [38, 30, 8], [52, 30, 8], [45, 48, 16],
      ]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`)
        .join('')}</g>
      <path fill="#5fb3a0" d="M6 120 Q10 90 45 86 Q80 90 84 120Z"/>
      <path fill="#f7c948" d="M10 110 Q14 96 30 91 L32 94 Q18 99 13 112Z M80 110 Q76 96 60 91 L58 94 Q72 99 77 112Z"/>
      <rect x="40" y="72" width="10" height="14" fill="#a8693f"/>
      <path fill="#a8693f" d="M36 86 L45 96 L54 86Z"/>
      <circle cx="45" cy="60" r="13" fill="#b8794f"/>
      <path fill="#3a2218" d="M32.6 56 Q33 44 45 44 Q57 44 57.4 56 Q52 50 45 50.6 Q38 50 32.6 56Z"/>
      <path fill="#e2574c" d="M31 52.6 Q45 44 59 52.6 L58.4 55.4 Q45 47.4 31.6 55.4Z"/>
      <g fill="#2b2233"><circle cx="39.6" cy="59.6" r="4.6"/><circle cx="50.4" cy="59.6" r="4.6"/></g>
      <path fill="none" stroke="#2b2233" stroke-width="1.2" d="M44 59 Q45 58 46 59 M35 59 L32 57.6 M55 59 L58 57.6"/>
      <path fill="#f08ab8" opacity="0.7" d="M37 57.6 Q38.4 56.4 40.4 56.8 L37.6 60Z M47.8 57.6 Q49.2 56.4 51.2 56.8 L48.4 60Z"/>
      <path fill="#c8383b" d="M40.6 66.4 Q45 64.4 49.4 66.4 Q45 70.8 40.6 66.4Z"/>
      <path fill="none" stroke="#f2c94c" stroke-width="1" d="M31.6 64 a2.6 2.6 0 1 0 0.01 0 M58.4 64 a2.6 2.6 0 1 0 0.01 0"/>`,
  })),

  // ── Sports ──
  scene('sports', 'landscape', 'wide', 'sc-ski', 'Ski slopes', '#3f5f8a', (u) => ({
    defs:
      lin(u('sky'), [[0, '#5fa8e0'], [1, '#d6ecf8']]) +
      lin(u('snow'), [[0, '#ffffff'], [1, '#dce8f5']]) +
      rad(u('sun'), [[0, '#fff6d0'], [0.4, '#fff6d0', 0.6], [1, '#fff6d0', 0]]),
    body: `
      <rect width="150" height="100" fill="url(#${u('sky')})"/>
      <circle cx="122" cy="20" r="16" fill="url(#${u('sun')})"/><circle cx="122" cy="20" r="6.4" fill="#fff6d0"/>
      <path fill="#ffffff" opacity="0.85" d="M14 22 Q18 16 26 19 Q32 14 38 20 Q44 20 42 25 H14Z M86 14 Q90 10 96 12 Q102 9 106 14 H86Z"/>
      <path fill="#8fa8c8" d="M0 60 L30 26 L48 44 L70 18 L96 50 L116 34 L150 58 V100 H0Z"/>
      <path fill="#6f88aa" d="M30 26 L48 44 L40 60 Z M70 18 L96 50 L80 60Z M116 34 L150 58 L128 62Z"/>
      <path fill="#ffffff" d="M30 26 L22 35.6 L27 34.6 L31 37.6 L35.4 32.4Z M70 18 L61 29.4 L67 27.8 L71 31.4 L76 26.8Z M116 34 L110 41 L114 40 L118 43 L121.4 39.6Z"/>
      <path fill="none" stroke="#4a4a5a" stroke-width="0.6" d="M14 58 L150 22"/>
      <g fill="#4a4a5a">${[[42, 50.6], [80, 40.6], [118, 30.4]].map(([x, y]) => `<path d="M${x} ${y} V${y + 5}" stroke="#4a4a5a" stroke-width="0.5"/><rect x="${x - 2.4}" y="${y + 5}" width="4.8" height="2.4" rx="0.8"/>`).join('')}</g>
      <path fill="url(#${u('snow')})" d="M0 100 V74 Q60 58 150 52 V100Z"/>
      ${[[6, 76, 12], [14, 74, 15], [22, 76, 11], [138, 58, 12], [146, 57, 14], [128, 60, 10]].map(([x, b, h]) => pine(x, b, h, '#2f6b4f', '#ffffff')).join('')}
      <path fill="none" stroke="#c9dcef" stroke-width="1.2" stroke-linecap="round" d="M140 58 Q120 62 104 70 Q96 74 90 78"/>
      <g fill="#ffffff" opacity="0.9"><circle cx="68" cy="78" r="2.4"/><circle cx="64" cy="76" r="1.8"/><circle cx="62" cy="80" r="1.6"/><circle cx="66" cy="73" r="1.2"/><circle cx="59" cy="77" r="1"/></g>
      <path fill="none" stroke="#2b2233" stroke-width="1.3" stroke-linecap="round" d="M68 82 L92 77 M70 84 L94 79"/>
      <path fill="none" stroke="#2b2233" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M76 81 L79.6 74.6 L83.4 80"/>
      <path fill="none" stroke="#e2474a" stroke-width="4.8" stroke-linecap="round" d="M79.4 73 L84.6 65.6"/>
      <path fill="none" stroke="#e2474a" stroke-width="1.9" stroke-linecap="round" d="M83.6 67 L89 70.6 M80.6 69 L75 70.4"/>
      <path fill="none" stroke="#2b2233" stroke-width="0.7" d="M89 70.6 L94 79 M75 70.4 L70.6 78.6"/>
      <circle cx="86.4" cy="62" r="2.7" fill="#f7c948"/>
      <path fill="#2b2233" d="M86.6 61 h2.4 v1.4 h-2.4z"/>`,
  })),
  scene('sports', 'people', 'tall', 'sc-runner', 'Sunrise runner', '#2b1d2f', (u) => ({
    defs:
      lin(u('sky'), [[0, '#f7c948'], [0.6, '#f28c5a'], [1, '#e2574c']]) +
      rad(u('sun'), [[0, '#fff6dc'], [0.5, '#fff1c9', 0.8], [1, '#fff1c9', 0]]),
    body: `
      <rect width="90" height="120" fill="url(#${u('sky')})"/>
      <circle cx="45" cy="74" r="34" fill="url(#${u('sun')})"/>
      <g fill="#c2475a" opacity="0.55"><rect x="0" y="80" width="10" height="14"/><rect x="11" y="74" width="7" height="20"/><rect x="19" y="82" width="9" height="12"/><rect x="62" y="78" width="8" height="16"/><rect x="71" y="72" width="7" height="22"/><rect x="79" y="82" width="11" height="12"/></g>
      <rect y="92" width="90" height="28" fill="#c8583b"/>
      <g fill="none" stroke="#fdf1e0" stroke-width="0.8" opacity="0.85">${[-60, -20, 15, 45, 75, 110, 150]
        .map((x) => `<path d="M${x} 120 L${(45 + (x - 45) * 0.35).toFixed(1)} 92"/>`)
        .join('')}</g>
      <ellipse cx="44" cy="109" rx="12" ry="1.8" fill="#2b1d2f" opacity="0.35"/>
      <g transform="translate(0 6)" fill="none" stroke="#2b1d2f" stroke-linecap="round" stroke-linejoin="round">
        <path stroke-width="7.4" d="M48 58.6 L43 75"/>
        <path stroke-width="3.6" d="M46.6 61 L53 68 L58.6 62.4"/>
        <path stroke-width="3.6" d="M45 61.6 L39 68.4 L33 66.4"/>
        <path stroke-width="4.6" d="M43.4 75 L52.6 81.4 L50.4 93.4"/>
        <path stroke-width="1.8" d="M50.4 93.4 L54.6 94.4"/>
        <path stroke-width="4.6" d="M42.6 75.6 L38.4 87 L28 94"/>
        <path stroke-width="1.8" d="M28 94 L26.4 90.6"/>
        <circle cx="50.6" cy="52" r="4.6" fill="#2b1d2f" stroke="none"/>
        <path stroke="#e2474a" stroke-width="1.4" d="M46.2 50.6 L54.8 51 M46.4 50.8 L42.6 53.6"/>
      </g>
      <path fill="none" stroke="#fdf1e0" stroke-width="1.2" stroke-linecap="round" opacity="0.7" d="M18 64 H28 M14 72 H26 M20 80 H30"/>
      ${birds([[22, 36, 0.9], [30, 30, 0.7], [70, 34, 0.8]], '#c2475a')}`,
  })),
]

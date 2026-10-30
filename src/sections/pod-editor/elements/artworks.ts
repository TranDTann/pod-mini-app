// Painterly illustrations for the themed sets: layered scenes with gradients,
// glows and depth (vs. the flat icons in library.ts). 100 × 100 viewBox.
// Every id is prefixed with the artwork id so the SVGs never clash.

export interface Artwork {
  id: string
  name: string
  theme: string
  svg: string
}

function artwork(theme: string, id: string, name: string, build: (u: (name: string) => string) => { defs: string; body: string }): Artwork {
  const u = (n: string) => `${id}-${n}`
  const { defs, body } = build(u)
  return {
    id,
    name,
    theme,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${defs}<clipPath id="${u('c')}"><circle cx="50" cy="50" r="46"/></clipPath></defs>${body}</svg>`,
  }
}

export const lin = (id: string, stops: [number, string, number?][], x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops
    .map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`)
    .join('')}</linearGradient>`
export const rad = (id: string, stops: [number, string, number?][], cx = 0.5, cy = 0.5, r = 0.5) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops
    .map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`)
    .join('')}</radialGradient>`
export const stars = (pts: [number, number, number][], fill = '#fff8e1') =>
  pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('')
const ring = (stroke = '#2b2233') => `<circle cx="50" cy="50" r="46" fill="none" stroke="${stroke}" stroke-width="2.5"/>`

export const ARTWORKS: Artwork[] = [
  // ── Halloween ──
  artwork('halloween', 'aw-haunted', 'Haunted moon', (u) => ({
    defs:
      lin(u('sky'), [[0, '#1d1638'], [0.55, '#4a2f6b'], [1, '#c2573a']]) +
      rad(u('glow'), [[0, '#fff3c4'], [0.45, '#f7d77a', 0.6], [1, '#f7d77a', 0]]),
    body: `<g clip-path="url(#${u('c')})">
      <rect width="100" height="100" fill="url(#${u('sky')})"/>
      <circle cx="62" cy="36" r="30" fill="url(#${u('glow')})"/>
      <circle cx="62" cy="36" r="15" fill="#fbe7a8"/><circle cx="57" cy="32" r="3" fill="#ecd08a"/><circle cx="67" cy="41" r="2" fill="#ecd08a"/>
      ${stars([[18, 22, 0.8], [28, 14, 0.6], [84, 18, 0.7], [36, 30, 0.5], [88, 54, 0.5]])}
      <path fill="#241a33" d="M0 74 Q24 58 46 66 Q70 54 100 70 V100 H0Z"/>
      <path fill="#1a1326" d="M30 66 V44 L33 38 L36 44 V50 H42 V40 L46 32 L50 40 V50 H54 V46 L57 41 L60 46 V64Z"/>
      <rect x="44.5" y="43" width="3" height="4" rx="1.5" fill="#f7c948"/><rect x="34" y="52" width="2.4" height="3.4" rx="1.2" fill="#f7c948"/>
      <path fill="#120d1b" d="M0 84 Q30 74 56 82 Q80 76 100 84 V100 H0Z"/>
      <ellipse cx="24" cy="84" rx="9" ry="7" fill="#e8742a"/><ellipse cx="24" cy="84" rx="4" ry="7" fill="#f28c28"/>
      <path fill="#2b2233" d="M20 82 L22 80 L23 83Z M28 82 L26 80 L25 83Z M21 87 Q24 89 27 87 L24 88Z"/>
      <ellipse cx="76" cy="88" rx="6" ry="4.5" fill="#d9661f"/><ellipse cx="76" cy="88" rx="2.6" ry="4.5" fill="#e8742a"/>
      <path fill="#1a1326" d="M70 22 q3 -3 5 0 q2 -2 4 1 q-3 0 -4.5 2 q-1.5 -2 -4.5 -3Z M80 30 q2 -2 3.5 0 q1.5 -1.4 3 .6 q-2 0 -3.2 1.6 q-1 -1.6 -3.3 -2.2Z"/>
    </g>${ring()}`,
  })),
  artwork('halloween', 'aw-patch', 'Pumpkin patch', (u) => ({
    defs:
      lin(u('sky'), [[0, '#f7b267'], [0.6, '#f4845f'], [1, '#7b3f61']]) +
      rad(u('pk'), [[0, '#ffb347'], [0.7, '#f07b1d'], [1, '#c4500f']], 0.4, 0.35, 0.7) +
      rad(u('pk2'), [[0, '#ffc46b'], [0.7, '#f28c28'], [1, '#c95a14']], 0.4, 0.35, 0.7),
    body: `<g clip-path="url(#${u('c')})">
      <rect width="100" height="100" fill="url(#${u('sky')})"/>
      <circle cx="50" cy="60" r="20" fill="#ffd38a" opacity="0.7"/>
      <path fill="#5a2f45" d="M0 62 Q20 52 40 60 Q62 50 100 60 V100 H0Z"/>
      <path fill="#3b2233" d="M0 72 Q30 62 60 72 Q80 66 100 72 V100 H0Z"/>
      <path fill="none" stroke="#4f7a3a" stroke-width="1.6" d="M6 88 Q20 76 34 86 Q50 96 64 84 Q80 74 96 86"/>
      <ellipse cx="34" cy="80" rx="16" ry="12" fill="url(#${u('pk')})"/>
      <path fill="none" stroke="#c4500f" stroke-width="1.2" d="M28 70 Q24 80 28 91 M40 70 Q44 80 40 91 M34 68 V92"/>
      <path fill="#4f7a3a" d="M33 69 Q32 62 36 60 L37 62 Q35 64 35.5 69Z"/>
      <ellipse cx="68" cy="84" rx="12" ry="9" fill="url(#${u('pk2')})"/>
      <path fill="none" stroke="#c95a14" stroke-width="1" d="M63 76 Q60 84 63 92 M73 76 Q76 84 73 92"/>
      <path fill="#4f7a3a" d="M67.5 76 Q67 70 70 69 L71 70.5 Q69 72 69.5 76Z"/>
      <path fill="#6f9a4a" d="M48 86 Q52 78 58 80 Q54 84 48 86Z M14 78 Q16 70 24 72 Q18 76 14 78Z"/>
      <path fill="#3b2233" d="M78 32 q3 -3 5 0 q2 -2 4 1 q-3 0 -4.5 2 q-1.5 -2 -4.5 -3Z"/>
    </g>${ring('#5a2f45')}`,
  })),

  // ── Christmas ──
  artwork('christmas', 'aw-cabin', 'Snowy cabin', (u) => ({
    defs:
      lin(u('sky'), [[0, '#0f2347'], [0.7, '#2c5a8a'], [1, '#7fa8c9']]) +
      rad(u('win'), [[0, '#ffe8a3'], [1, '#f2a23c']]) +
      rad(u('halo'), [[0, '#ffd77a', 0.7], [1, '#ffd77a', 0]]),
    body: `<g clip-path="url(#${u('c')})">
      <rect width="100" height="100" fill="url(#${u('sky')})"/>
      ${stars([[16, 20, 0.9], [30, 12, 0.6], [70, 14, 0.8], [84, 26, 0.6], [52, 22, 0.5], [40, 34, 0.5], [78, 40, 0.5]])}
      <circle cx="74" cy="22" r="7" fill="#f6f1ea"/><circle cx="77" cy="20" r="6" fill="#163055"/>
      <path fill="#dfe9f2" d="M0 66 Q30 54 60 64 Q80 58 100 64 V100 H0Z"/>
      <path fill="#1f4a3a" d="M12 66 L20 44 L28 66Z M18 70 L26 50 L34 70Z M76 66 L84 46 L92 66Z"/>
      <path fill="#f6f1ea" d="M20 44 L17.5 51 L22.5 51Z M26 50 L23.5 57 L28.5 57Z M84 46 L81.5 53 L86.5 53Z"/>
      <rect x="40" y="58" width="28" height="20" fill="#7a4b35"/>
      <path fill="#5d3826" d="M40 62 H68 M40 66 H68 M40 70 H68 M40 74 H68" stroke="#5d3826" stroke-width="0.8"/>
      <path fill="#a33b32" d="M36 60 L54 44 L72 60Z"/>
      <path fill="#f6f1ea" d="M35 60 L54 43 L73 60 L70 61 L54 47 L38 61Z"/>
      <rect x="60" y="44" width="5" height="9" fill="#5d3826"/><rect x="59" y="42.5" width="7" height="2.5" rx="1" fill="#f6f1ea"/>
      <circle cx="47" cy="66" r="9" fill="url(#${u('halo')})"/>
      <rect x="43.5" y="62.5" width="7" height="7" rx="1" fill="url(#${u('win')})"/>
      <path stroke="#7a4b35" stroke-width="0.9" d="M47 62.5 V69.5 M43.5 66 H50.5"/>
      <rect x="55" y="66" width="7" height="12" rx="1" fill="#4a2b1c"/>
      <path fill="#f6f1ea" d="M0 80 Q40 72 100 80 V100 H0Z"/>
      ${stars([[10, 50, 0.9], [34, 40, 0.8], [62, 34, 0.7], [90, 50, 0.9], [26, 76, 0.7], [70, 86, 0.8]], '#ffffff')}
    </g>${ring('#163055')}`,
  })),
  artwork('christmas', 'aw-wreath', 'Festive wreath', (u) => ({
    defs:
      rad(u('lf'), [[0, '#5fa86f'], [1, '#1f5a3a']], 0.5, 0.5, 0.6) +
      lin(u('bow'), [[0, '#e2574c'], [1, '#9e2a2b']]) +
      rad(u('lt'), [[0, '#fff3c4'], [1, '#f7c948', 0]]),
    body: `${Array.from({ length: 22 }, (_, i) => {
      const a = (i / 22) * Math.PI * 2
      const x = 50 + 32 * Math.cos(a)
      const y = 52 + 32 * Math.sin(a)
      const deg = (a * 180) / Math.PI + 90
      return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="7" ry="13" fill="url(#${u('lf')})" transform="rotate(${(deg + (i % 2 ? 28 : -28)).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`
    }).join('')}
      ${Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2 + 0.2
        const x = 50 + 33 * Math.cos(a)
        const y = 52 + 33 * Math.sin(a)
        return i % 3 === 0
          ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="url(#${u('lt')})"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.6" fill="#fff3c4"/>`
          : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="#c8383b"/><circle cx="${(x - 0.8).toFixed(1)}" cy="${(y - 0.8).toFixed(1)}" r="0.8" fill="#f6b0a8"/>`
      }).join('')}
      <path fill="url(#${u('bow')})" d="M50 84 Q36 70 28 78 Q26 90 50 86Z M50 84 Q64 70 72 78 Q74 90 50 86Z"/>
      <path fill="#9e2a2b" d="M47 85 L40 98 L45 96 L48 99Z M53 85 L60 98 L55 96 L52 99Z"/>
      <circle cx="50" cy="85" r="4.5" fill="#c8383b"/>`,
  })),

  // ── Love ──
  artwork('love', 'aw-heart-sunset', 'Heart sunset', (u) => ({
    defs:
      lin(u('sky'), [[0, '#6b3fa0'], [0.45, '#f0628a'], [0.8, '#ffb36b']]) +
      lin(u('sea'), [[0, '#ff9a76'], [1, '#5b3a8a']]) +
      `<clipPath id="${u('h')}"><path d="M50 92 C20 70 4 54 4 34 C4 18 16 8 30 8 C39 8 46 13 50 20 C54 13 61 8 70 8 C84 8 96 18 96 34 C96 54 80 70 50 92Z"/></clipPath>`,
    body: `<g clip-path="url(#${u('h')})">
      <rect width="100" height="100" fill="url(#${u('sky')})"/>
      <circle cx="50" cy="58" r="16" fill="#ffe0a3"/>
      <rect y="58" width="100" height="42" fill="url(#${u('sea')})"/>
      <path stroke="#ffe0a3" stroke-width="1.6" stroke-linecap="round" d="M40 63 H60 M36 68 H64 M42 73 H58 M46 78 H54"/>
      <path fill="#3b2a5a" d="M8 40 q3 -3 5 0 q2 -2 4 1 q-3 0 -4.5 2 q-1.5 -2 -4.5 -3Z M22 30 q2 -2 3.5 0 q1.5 -1.4 3 .6 q-2 0 -3.2 1.6 q-1 -1.6 -3.3 -2.2Z"/>
      <path fill="#ffffff" opacity="0.25" d="M20 20 Q30 14 40 18 Q30 20 24 28Z"/>
    </g>
    <path fill="none" stroke="#7a2f5a" stroke-width="2.5" d="M50 92 C20 70 4 54 4 34 C4 18 16 8 30 8 C39 8 46 13 50 20 C54 13 61 8 70 8 C84 8 96 18 96 34 C96 54 80 70 50 92Z"/>`,
  })),
  artwork('love', 'aw-bouquet', 'Rose bouquet', (u) => ({
    defs:
      rad(u('r1'), [[0, '#ff8a8a'], [0.6, '#e2475a'], [1, '#a82c3f']], 0.45, 0.4, 0.6) +
      rad(u('r2'), [[0, '#ffc2c2'], [0.6, '#f48aa0'], [1, '#c95a78']], 0.45, 0.4, 0.6) +
      lin(u('wrap'), [[0, '#f6e3d4'], [1, '#d9b99b']]),
    body: `
      <path fill="#4f8f5a" d="M30 34 Q14 26 10 38 Q22 44 32 40Z M70 34 Q86 26 90 38 Q78 44 68 40Z M44 22 Q38 8 50 4 Q56 14 52 24Z"/>
      ${[[50, 34, 'r1', 13], [32, 44, 'r2', 11], [68, 44, 'r2', 11], [40, 26, 'r2', 9], [60, 26, 'r1', 9], [50, 50, 'r1', 10]]
        .map(([x, y, g, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#${u(g as string)})"/>
          <path fill="none" stroke="#7a1f33" stroke-opacity="0.45" stroke-width="1.2" d="M${(x as number) - (r as number) * 0.5} ${y} Q${x} ${(y as number) - (r as number) * 0.7} ${(x as number) + (r as number) * 0.5} ${y} Q${x} ${(y as number) + (r as number) * 0.5} ${(x as number) - (r as number) * 0.2} ${(y as number) - (r as number) * 0.1}"/>`)
        .join('')}
      <circle cx="24" cy="30" r="2" fill="#ffffff"/><circle cx="78" cy="30" r="2" fill="#ffffff"/><circle cx="28" cy="24" r="1.5" fill="#ffffff"/><circle cx="74" cy="22" r="1.5" fill="#ffffff"/>
      <path fill="url(#${u('wrap')})" d="M22 52 L50 96 L78 52 Q64 60 50 58 Q36 60 22 52Z"/>
      <path fill="none" stroke="#c49a78" stroke-width="1" d="M36 58 L50 92 M64 58 L50 92"/>
      <path fill="#e2475a" d="M40 74 Q50 68 60 74 L58 78 Q50 74 42 78Z"/>
      <path fill="#e2475a" d="M50 75 L44 88 L48 86 L50 90 L52 86 L56 88Z"/>`,
  })),

  // ── Nature ──
  artwork('nature', 'aw-lake', 'Mountain lake', (u) => ({
    defs:
      lin(u('sky'), [[0, '#ffd9a0'], [0.5, '#f7a99a'], [1, '#b7a1d8']]) +
      lin(u('m1'), [[0, '#7d6fa8'], [1, '#4b4a7a']]) +
      lin(u('m2'), [[0, '#4a6f8a'], [1, '#2f4a5f']]) +
      lin(u('lake'), [[0, '#9fc3d8'], [1, '#3f6a8a']]),
    body: `<g clip-path="url(#${u('c')})">
      <rect width="100" height="100" fill="url(#${u('sky')})"/>
      <circle cx="64" cy="40" r="9" fill="#fff1c9"/>
      <path fill="url(#${u('m1')})" d="M0 60 L22 30 L36 46 L52 22 L74 52 L86 38 L100 54 V64 H0Z"/>
      <path fill="#f6f1ea" d="M52 22 L46 31 L50 30 L53 33 L57 29Z M22 30 L18 36 L22 35 L25 37Z"/>
      <path fill="url(#${u('m2')})" d="M0 64 L14 48 L30 62 L44 50 L60 64 Z M56 64 L76 46 L100 62 V64Z"/>
      <rect y="64" width="100" height="36" fill="url(#${u('lake')})"/>
      <path fill="#4b4a7a" opacity="0.35" d="M0 64 L22 86 L36 74 L52 96 L74 70 L86 82 L100 68 V64Z"/>
      <path stroke="#fff1c9" stroke-width="1.4" stroke-linecap="round" opacity="0.8" d="M58 70 H70 M60 75 H68 M62 80 H66"/>
      <path fill="#1f3a2f" d="M6 64 L10 50 L14 64Z M12 66 L17 48 L22 66Z M84 64 L89 50 L94 64Z"/>
    </g>${ring('#2f4a5f')}`,
  })),
  artwork('nature', 'aw-meadow', 'Wildflower meadow', (u) => ({
    defs:
      lin(u('sky'), [[0, '#bfe3f2'], [1, '#fdf1d6']]) +
      lin(u('h1'), [[0, '#a8cf7a'], [1, '#6f9a4a']]) +
      lin(u('h2'), [[0, '#8fbf5a'], [1, '#4f7a3a']]),
    body: `<g clip-path="url(#${u('c')})">
      <rect width="100" height="100" fill="url(#${u('sky')})"/>
      <circle cx="30" cy="30" r="10" fill="#ffe28a"/><circle cx="30" cy="30" r="16" fill="#ffe28a" opacity="0.3"/>
      <path fill="#ffffff" d="M58 26 Q62 18 70 22 Q76 16 82 24 Q88 24 86 30 H58 Q54 28 58 26Z"/>
      <path fill="url(#${u('h1')})" d="M0 58 Q30 44 60 56 Q80 50 100 56 V100 H0Z"/>
      <path fill="url(#${u('h2')})" d="M0 72 Q40 60 100 70 V100 H0Z"/>
      ${[[12, 80, '#f4a6b8'], [22, 88, '#ffffff'], [30, 76, '#f7c948'], [42, 86, '#9a6fb0'], [52, 78, '#f4a6b8'], [62, 90, '#ffffff'], [70, 78, '#f7c948'], [80, 86, '#e2574c'], [88, 76, '#9a6fb0'], [18, 68, '#ffffff'], [48, 66, '#f7c948'], [76, 66, '#f4a6b8']]
        .map(([x, y, c]) => `<path stroke="#4f7a3a" stroke-width="0.9" d="M${x} ${y} v8"/><g fill="${c}">${[0, 72, 144, 216, 288].map((d) => `<circle cx="${x}" cy="${(y as number) - 2.2}" r="1.6" transform="rotate(${d} ${x} ${y})"/>`).join('')}</g><circle cx="${x}" cy="${y}" r="1.2" fill="#e9a23b"/>`)
        .join('')}
    </g>${ring('#4f7a3a')}`,
  })),

  // ── Animals ──
  artwork('animals', 'aw-moon-cat', 'Moon cat', (u) => ({
    defs:
      lin(u('sky'), [[0, '#1b1f4a'], [1, '#4a3f8a']]) +
      rad(u('moon'), [[0, '#fff6d0'], [1, '#f2cf6a']], 0.4, 0.4, 0.7) +
      rad(u('glow'), [[0, '#fff1c4', 0.5], [1, '#fff1c4', 0]]),
    body: `<g clip-path="url(#${u('c')})">
      <rect width="100" height="100" fill="url(#${u('sky')})"/>
      ${stars([[14, 24, 0.9], [24, 50, 0.6], [80, 16, 0.8], [88, 40, 0.6], [70, 30, 0.5], [12, 70, 0.6], [86, 74, 0.7], [40, 14, 0.5]])}
      <circle cx="52" cy="54" r="40" fill="url(#${u('glow')})"/>
      <path fill="url(#${u('moon')})" d="M40 18 A34 34 0 1 0 84 70 A40 40 0 0 1 40 18Z"/>
      <path fill="#1b1830" d="M54 58 Q50 42 60 36 L58 28 L64 33 Q68 31 72 33 L77 28 L76 37 Q84 44 80 58 Q90 64 86 76 Q84 80 78 76 Q80 68 76 64 Q70 70 60 68 Q52 66 54 58Z"/>
      <circle cx="63" cy="43" r="1.6" fill="#f7c948"/><circle cx="72" cy="43" r="1.6" fill="#f7c948"/>
    </g>${ring('#1b1f4a')}`,
  })),
  artwork('animals', 'aw-whale', 'Deep sea whale', (u) => ({
    defs:
      lin(u('sea'), [[0, '#5fc3d8'], [0.5, '#2a7fa8'], [1, '#14365a']]) +
      lin(u('body'), [[0, '#3f6fa8'], [1, '#26467a']]) +
      lin(u('ray'), [[0, '#ffffff', 0.35], [1, '#ffffff', 0]]),
    body: `<g clip-path="url(#${u('c')})">
      <rect width="100" height="100" fill="url(#${u('sea')})"/>
      <path fill="url(#${u('ray')})" d="M30 0 L44 0 L36 70 L26 70Z M58 0 L66 0 L70 60 L62 60Z"/>
      <path fill="url(#${u('body')})" d="M14 56 Q16 36 44 36 Q70 36 78 50 L92 40 Q90 52 94 62 L80 58 Q74 72 46 72 Q16 72 14 56Z"/>
      <path fill="#b9d8ef" d="M18 60 Q30 70 48 70 Q66 70 76 60 Q60 64 46 64 Q30 64 18 60Z"/>
      <path fill="none" stroke="#8fb4d8" stroke-width="0.8" d="M28 63 V68 M34 64 V70 M40 65 V71 M46 65 V71 M52 65 V71 M58 64 V70 M64 63 V68"/>
      <circle cx="28" cy="52" r="2" fill="#14365a"/><circle cx="27.4" cy="51.4" r="0.6" fill="#ffffff"/>
      <path fill="#26467a" d="M40 62 Q44 74 54 76 Q50 68 50 62Z"/>
      ${stars([[22, 30, 1.6], [26, 22, 1.1], [20, 16, 0.8], [70, 80, 1.2], [76, 86, 0.8], [40, 86, 1]], '#d6f1fa')}
      <path fill="#0e2742" d="M0 88 Q20 80 34 88 Q50 82 70 90 Q86 84 100 90 V100 H0Z"/>
      <path fill="#2f6b4f" d="M16 88 Q14 76 18 70 Q20 78 20 88Z M82 88 Q84 78 80 72 Q78 80 78 88Z"/>
    </g>${ring('#14365a')}`,
  })),

  // ── Coffee & Food ──
  artwork('food', 'aw-latte', 'Latte art', (u) => ({
    defs:
      rad(u('saucer'), [[0, '#ffffff'], [0.85, '#efe6da'], [1, '#d9cbb8']]) +
      rad(u('coffee'), [[0, '#c98a5a'], [0.75, '#8a5a3c'], [1, '#5d3826']]) +
      rad(u('foam'), [[0, '#fffaf0'], [1, '#f2dfc2']]),
    body: `
      <circle cx="50" cy="52" r="44" fill="url(#${u('saucer')})"/>
      <path fill="#f6f1ea" stroke="#d9cbb8" stroke-width="1" d="M80 40 Q96 40 96 52 Q96 64 80 64 L80 58 Q90 58 90 52 Q90 46 80 46Z"/>
      <circle cx="50" cy="52" r="31" fill="#f6f1ea" stroke="#e3d6c4" stroke-width="1.5"/>
      <circle cx="50" cy="52" r="26" fill="url(#${u('coffee')})"/>
      <path fill="url(#${u('foam')})" d="M50 72 C34 60 28 52 30 44 C32 36 42 34 47 40 Q50 44 50 48 Q50 44 53 40 C58 34 68 36 70 44 C72 52 66 60 50 72Z"/>
      <path fill="none" stroke="#c98a5a" stroke-width="1.2" opacity="0.7" d="M38 46 Q50 54 62 46 M40 54 Q50 60 60 54"/>
      <path fill="#5d3826" d="M16 20 q4 -4 8 0 q-4 4 -8 0Z M20 18 v4" transform="rotate(-20 20 20)"/>
      <ellipse cx="22" cy="86" rx="4" ry="2.6" fill="#5d3826" transform="rotate(30 22 86)"/>
      <ellipse cx="84" cy="18" rx="4" ry="2.6" fill="#5d3826" transform="rotate(-30 84 18)"/>`,
  })),
  artwork('food', 'aw-shake', 'Strawberry shake', (u) => ({
    defs:
      lin(u('glass'), [[0, '#ffc2d1'], [1, '#f07a9a']]) +
      lin(u('bg'), [[0, '#fff1e6'], [1, '#ffd9c7']]) +
      rad(u('berry'), [[0, '#ff7a7a'], [1, '#c8383b']], 0.4, 0.35, 0.7),
    body: `<g clip-path="url(#${u('c')})">
      <rect width="100" height="100" fill="url(#${u('bg')})"/>
      <circle cx="20" cy="24" r="3" fill="#ffffff" opacity="0.7"/><circle cx="82" cy="70" r="4" fill="#ffffff" opacity="0.6"/>
      <path fill="none" stroke="#5b8db8" stroke-width="3.5" stroke-linecap="round" d="M58 8 L52 36"/>
      <path fill="url(#${u('glass')})" d="M30 40 H70 L64 88 Q63 92 58 92 H42 Q37 92 36 88Z"/>
      <path fill="#ffffff" opacity="0.35" d="M34 44 H40 L38 86 H36Z"/>
      <path fill="#fffaf5" d="M28 42 Q24 34 32 32 Q32 24 42 26 Q46 18 56 22 Q66 20 66 28 Q76 28 72 38 Q74 42 70 42Z"/>
      <circle cx="50" cy="20" r="6" fill="url(#${u('berry')})"/><path fill="#4f8f5a" d="M47 14 L50 16 L53 14 L52 17 L48 17Z"/>
      <g fill="#f7d06a"><circle cx="40" cy="32" r="0.9"/><circle cx="60" cy="30" r="0.9"/><circle cx="46" cy="36" r="0.9"/><circle cx="58" cy="37" r="0.9"/></g>
    </g>${ring('#c95a78')}`,
  })),

  // ── Space ──
  artwork('space', 'aw-galaxy', 'Ringed planet', (u) => ({
    defs:
      rad(u('sky'), [[0, '#5a3f9a'], [0.6, '#24195a'], [1, '#0d0a26']], 0.3, 0.3, 0.9) +
      rad(u('neb'), [[0, '#f08ab8', 0.55], [1, '#f08ab8', 0]]) +
      rad(u('neb2'), [[0, '#6fd3e8', 0.45], [1, '#6fd3e8', 0]]) +
      rad(u('pl'), [[0, '#ffd59a'], [0.6, '#f2a25a'], [1, '#b0563a']], 0.35, 0.3, 0.8),
    body: `<g clip-path="url(#${u('c')})">
      <rect width="100" height="100" fill="url(#${u('sky')})"/>
      <ellipse cx="26" cy="30" rx="30" ry="20" fill="url(#${u('neb')})"/>
      <ellipse cx="80" cy="78" rx="28" ry="18" fill="url(#${u('neb2')})"/>
      ${stars([[12, 50, 0.8], [20, 80, 0.6], [34, 12, 0.6], [62, 14, 0.9], [88, 30, 0.7], [76, 50, 0.5], [44, 88, 0.7], [90, 60, 0.5], [8, 30, 0.5]])}
      <ellipse cx="54" cy="56" rx="38" ry="9" fill="none" stroke="#f7d6a0" stroke-opacity="0.55" stroke-width="3" transform="rotate(-16 54 56)"/>
      <circle cx="54" cy="56" r="22" fill="url(#${u('pl')})"/>
      <path fill="#b0563a" opacity="0.35" d="M33 50 Q54 44 75 52 L76 56 Q54 48 32 55Z M34 62 Q54 58 74 64 L72 68 Q54 62 36 67Z"/>
      <path fill="none" stroke="#f7d6a0" stroke-width="3" stroke-linecap="round" d="M16 66 A38 9 -16 0 0 92 46"/>
      <circle cx="22" cy="24" r="5" fill="#d9d4ee"/><circle cx="20.5" cy="22.5" r="1.2" fill="#b9b2d8"/>
    </g>${ring('#0d0a26')}`,
  })),
  artwork('space', 'aw-launch', 'Rocket launch', (u) => ({
    defs:
      lin(u('sky'), [[0, '#14204a'], [0.6, '#4a3f8a'], [1, '#f08a7e']]) +
      lin(u('flame'), [[0, '#fff3c4'], [0.4, '#f7c948'], [1, '#e8742a', 0]]) +
      lin(u('body'), [[0, '#ffffff'], [1, '#c9d6e3']], 1, 0),
    body: `<g clip-path="url(#${u('c')})">
      <rect width="100" height="100" fill="url(#${u('sky')})"/>
      ${stars([[14, 18, 0.8], [30, 30, 0.6], [80, 14, 0.8], [86, 34, 0.6], [22, 44, 0.5], [70, 24, 0.5]])}
      <path fill="url(#${u('flame')})" d="M42 62 Q50 104 58 62Z"/>
      <path fill="#e2574c" d="M40 50 L30 66 L42 62Z M60 50 L70 66 L58 62Z"/>
      <path fill="url(#${u('body')})" d="M50 12 C62 22 64 44 60 64 H40 C36 44 38 22 50 12Z"/>
      <path fill="#e2574c" d="M50 12 C56 17 59 23 61 30 H39 C41 23 44 17 50 12Z"/>
      <circle cx="50" cy="42" r="5.5" fill="#5b8db8" stroke="#3f6a8f" stroke-width="2"/><circle cx="48.5" cy="40.5" r="1.4" fill="#d6f1fa"/>
      <path fill="#ffffff" d="M0 86 Q10 74 22 80 Q28 70 40 78 Q50 72 58 80 Q70 70 80 80 Q92 74 100 82 V100 H0Z"/>
      <path fill="#f6e3ef" d="M0 92 Q20 84 40 90 Q60 84 80 90 Q92 86 100 90 V100 H0Z"/>
    </g>${ring('#14204a')}`,
  })),

  // ── Retro ──
  artwork('retro', 'aw-synthwave', 'Synthwave sunset', (u) => ({
    defs:
      lin(u('sky'), [[0, '#1a0f3a'], [0.6, '#7a2f8a'], [1, '#f0628a']]) +
      lin(u('sun'), [[0, '#ffe066'], [0.5, '#ff9a5a'], [1, '#f0428a']]) +
      lin(u('floor'), [[0, '#3a1460'], [1, '#12082a']]),
    body: `<g clip-path="url(#${u('c')})">
      <rect width="100" height="100" fill="url(#${u('sky')})"/>
      ${stars([[14, 16, 0.7], [26, 28, 0.5], [80, 14, 0.7], [88, 30, 0.5], [60, 10, 0.5]])}
      <circle cx="50" cy="56" r="26" fill="url(#${u('sun')})"/>
      <g fill="#7a2f8a">${[44, 50, 56, 62, 68, 74].map((y, i) => `<rect x="20" y="${y}" width="60" height="${1 + i * 0.5}"/>`).join('')}</g>
      <rect y="66" width="100" height="34" fill="url(#${u('floor')})"/>
      <g stroke="#f05ab8" stroke-width="0.8" opacity="0.85">
        ${[70, 75, 82, 91].map((y) => `<path d="M0 ${y} H100"/>`).join('')}
        ${[-60, -30, -12, 0, 12, 30, 60].map((dx) => `<path d="M50 66 L${50 + dx * 2.2} 100"/>`).join('')}
      </g>
      <path fill="#12082a" d="M18 66 Q17 50 20 38 Q14 36 8 40 Q12 34 20 36 Q16 30 10 30 Q18 28 21 35 Q22 28 28 26 Q24 32 23 36 Q30 32 34 36 Q26 36 23 39 Q21 52 22 66Z"/>
      <path fill="#12082a" d="M82 66 Q83 54 80 44 Q86 42 92 46 Q88 40 80 42 Q84 36 90 36 Q82 34 79 41 Q78 34 72 32 Q76 38 77 42 Q70 38 66 42 Q74 42 77 45 Q79 56 78 66Z"/>
    </g>${ring('#1a0f3a')}`,
  })),
  artwork('retro', 'aw-disco', 'Disco ball', (u) => ({
    defs:
      rad(u('ball'), [[0, '#ffffff'], [0.5, '#c9d0e0'], [1, '#6a7290']], 0.35, 0.3, 0.8) +
      rad(u('glow'), [[0, '#f7c948', 0.5], [1, '#f08ab8', 0]]),
    body: `
      <circle cx="50" cy="56" r="44" fill="url(#${u('glow')})"/>
      <path stroke="#7d8a99" stroke-width="1.2" d="M50 0 V16"/>
      <circle cx="50" cy="56" r="36" fill="url(#${u('ball')})"/>
      <g fill="none" stroke="#5a6280" stroke-width="0.7" opacity="0.7">
        ${[-24, -12, 0, 12, 24].map((dy) => `<ellipse cx="50" cy="${56 + dy}" rx="${Math.sqrt(36 * 36 - dy * dy).toFixed(1)}" ry="3"/>`).join('')}
        ${[12, 24, 33].map((rx) => `<ellipse cx="50" cy="56" rx="${rx}" ry="36"/>`).join('')}
      </g>
      <g fill="#ffffff">
        <rect x="34" y="38" width="5" height="5" opacity="0.95"/><rect x="40" y="32" width="4" height="4" opacity="0.8"/><rect x="30" y="46" width="4" height="4" opacity="0.7"/>
        <rect x="60" y="70" width="4" height="4" opacity="0.5"/><rect x="52" y="44" width="3" height="3" opacity="0.6"/>
      </g>
      <g fill="#f7c948">
        <path d="M12 22 L14 28 L20 30 L14 32 L12 38 L10 32 L4 30 L10 28Z"/>
        <path d="M88 76 L89.5 80 L94 81.5 L89.5 83 L88 88 L86.5 83 L82 81.5 L86.5 80Z"/>
      </g>
      <path fill="#f08ab8" d="M86 18 L87 21 L90 22 L87 23 L86 26 L85 23 L82 22 L85 21Z"/>`,
  })),

  // ── Sports ──
  artwork('sports', 'aw-hoop', 'Sunset hoops', (u) => ({
    defs:
      lin(u('sky'), [[0, '#2f3f7a'], [0.55, '#e2574c'], [1, '#f7b267']]) +
      rad(u('ball'), [[0, '#ffa25a'], [0.7, '#e8742a'], [1, '#b0501a']], 0.4, 0.35, 0.7),
    body: `<g clip-path="url(#${u('c')})">
      <rect width="100" height="100" fill="url(#${u('sky')})"/>
      <circle cx="50" cy="72" r="18" fill="#ffd38a" opacity="0.8"/>
      <path fill="#2b2a4a" d="M0 78 H18 V64 H26 V78 H34 V58 H44 V78 H56 V66 H64 V78 H72 V54 H82 V78 H100 V100 H0Z"/>
      <rect x="70" y="20" width="3" height="58" fill="#1d1c33"/>
      <rect x="54" y="16" width="26" height="18" rx="1.5" fill="#f6f1ea" stroke="#1d1c33" stroke-width="1.5"/>
      <rect x="62" y="22" width="10" height="8" fill="none" stroke="#e2574c" stroke-width="1.2"/>
      <path fill="none" stroke="#e2574c" stroke-width="2" d="M58 34 H76"/>
      <path fill="none" stroke="#f6f1ea" stroke-width="0.9" d="M59 34 L62 46 L65 34 L68 46 L71 34 L74 46 L75 34 M60 40 H74"/>
      <circle cx="34" cy="38" r="10" fill="url(#${u('ball')})"/>
      <g fill="none" stroke="#5a2a10" stroke-width="1"><path d="M24 38 H44 M34 28 V48"/><path d="M27 31 Q34 38 27 45 M41 31 Q34 38 41 45"/></g>
      <path fill="none" stroke="#ffffff" stroke-width="1" stroke-dasharray="2 3" opacity="0.7" d="M14 70 Q20 44 32 30"/>
    </g>${ring('#2b2a4a')}`,
  })),
  artwork('sports', 'aw-wave', 'Big wave surf', (u) => ({
    defs:
      lin(u('sky'), [[0, '#ffe7b3'], [1, '#ffc2a0']]) +
      lin(u('wave'), [[0, '#2a9fb8'], [0.6, '#1f6f9a'], [1, '#14466a']]) +
      lin(u('lip'), [[0, '#7fd3e2'], [1, '#2a9fb8']]),
    body: `<g clip-path="url(#${u('c')})">
      <rect width="100" height="100" fill="url(#${u('sky')})"/>
      <circle cx="74" cy="28" r="11" fill="#f7a23c"/><circle cx="74" cy="28" r="17" fill="#f7a23c" opacity="0.25"/>
      <path fill="url(#${u('wave')})" d="M0 100 V58 Q10 30 38 24 Q62 20 70 38 Q60 32 52 36 Q42 42 46 56 Q50 70 66 72 Q84 74 100 64 V100Z"/>
      <path fill="url(#${u('lip')})" d="M38 24 Q62 20 70 38 Q60 32 52 36 Q46 30 38 24Z"/>
      <path fill="#ffffff" d="M64 34 Q70 36 72 42 Q68 38 64 38Z M70 38 Q76 40 74 46 Q72 42 70 40Z" opacity="0.9"/>
      <path fill="none" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" opacity="0.6" d="M10 60 Q20 44 34 40 M14 72 Q22 60 36 54 M56 76 Q70 80 86 74"/>
      <path fill="#f7d06a" d="M40 60 L62 52 L64 55 L42 64Z"/>
      <path fill="#1d1c33" d="M50 54 L52 46 L56 44 L60 46 L58 48 L56 47 L55 52 L52 56Z"/><circle cx="56" cy="41" r="2.2" fill="#1d1c33"/>
      <path fill="#ffffff" d="M0 86 Q14 80 28 86 Q42 92 56 86 Q72 80 86 86 Q94 90 100 86 V100 H0Z"/>
    </g>${ring('#14466a')}`,
  })),
]

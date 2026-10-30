// Adjustment layer (và smart filter dạng chỉnh màu) → hàm biến đổi màu trên từng pixel (giá trị 0..1).
// Công thức Levels/Curves/Invert/Posterize/Threshold/Exposure/Brightness-Contrast/Hue-Saturation
// dựa theo bản dựng ngược của psd-tools (MIT, https://github.com/psd-tools/psd-tools), kiểm chứng lại
// bằng các file mẫu do Photoshop lưu (xem scripts/validate.ts).

export type AdjustSpec = { type: string; [k: string]: unknown };
export type ColorFn = (c: Float32Array, n: number) => void; // biến đổi tại chỗ mảng RGB (n pixel)

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const N = 256;

/** Spline bậc 3 tự nhiên qua các điểm (x tăng dần). */
function naturalSpline(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n === 2) return (x: number) => ys[0] + ((x - xs[0]) * (ys[1] - ys[0])) / (xs[1] - xs[0]);
  const h = xs.slice(1).map((x, i) => x - xs[i]);
  const al = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) al[i] = (3 / h[i]) * (ys[i + 1] - ys[i]) - (3 / h[i - 1]) * (ys[i] - ys[i - 1]);
  const l = new Array(n).fill(1), mu = new Array(n).fill(0), z = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    l[i] = 2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (al[i] - h[i - 1] * z[i - 1]) / l[i];
  }
  const c = new Array(n).fill(0), b = new Array(n).fill(0), d = new Array(n).fill(0);
  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (ys[j + 1] - ys[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }
  return (x: number) => {
    let j = 0;
    while (j < n - 2 && x > xs[j + 1]) j++;
    const t = x - xs[j];
    return ys[j] + b[j] * t + c[j] * t * t + d[j] * t * t * t;
  };
}

const lutFrom = (f: (t: number) => number) => { const L = new Float32Array(N); for (let i = 0; i < N; i++) L[i] = clamp01(f(i / (N - 1))); return L; };
const ap = (L: Float32Array, v: number) => {
  const x = clamp01(v) * (N - 1), i = Math.floor(x), f = x - i;
  return i >= N - 1 ? L[N - 1] : L[i] + f * (L[i + 1] - L[i]);
};

/** Áp LUT từng kênh trước (index 1..3), rồi LUT tổng (index 0) — đúng thứ tự Photoshop. */
function lutFn(luts: (Float32Array | undefined)[]): ColorFn {
  return (c, n) => {
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
      let v = c[i * 3 + k];
      const L = luts[k + 1]; if (L) v = ap(L, v);
      if (luts[0]) v = ap(luts[0], v);
      c[i * 3 + k] = v;
    }
  };
}

// ---------- HSL / HSV ----------
function rgb2hsl(r: number, g: number, b: number, o: number[]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, L = (mx + mn) / 2;
  let H = 0, S = 0;
  if (d > 1e-9) {
    S = d / (1 - Math.abs(2 * L - 1));
    if (mx === r) H = (((g - b) / d) % 6 + 6) % 6; else if (mx === g) H = (b - r) / d + 2; else H = (r - g) / d + 4;
    H /= 6;
  }
  o[0] = H; o[1] = S; o[2] = L;
}
function hsl2rgb(H: number, S: number, L: number, o: number[]) {
  const C = (1 - Math.abs(2 * L - 1)) * S, h = H * 6, X = C * (1 - Math.abs((h % 2) - 1)), m = L - C / 2;
  let r = 0, g = 0, b = 0;
  if (h < 1) { r = C; g = X; } else if (h < 2) { r = X; g = C; } else if (h < 3) { g = C; b = X; }
  else if (h < 4) { g = X; b = C; } else if (h < 5) { r = X; b = C; } else { r = C; b = X; }
  o[0] = r + m; o[1] = g + m; o[2] = b + m;
}
const applyLightness = (v: number, l: number) => (l > 0 ? clamp01(v * (1 - l) + l) : l < 0 ? clamp01(v * (1 + l)) : v);
const applySat = (v: number, s: number) => clamp01(s > 0 ? v / (1 - s + 1e-2) : v * (1 + s));

// lưới nội suy độ bão hoà giữa các dải màu (thực nghiệm của psd-tools)
const SAT_GRID_RAW = [
  [100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100],
  [100,94,92,91,91,90,90,90,90,90,90,89,89,89,89,89,89,89,88,88,88],
  [100,92,89,86,84,83,82,81,81,80,80,79,79,78,78,77,77,76,76,75,74],
  [100,91,86,82,79,77,74,73,71,70,70,68,67,66,65,64,62,61,59,58,56],
  [100,91,84,79,75,71,68,65,63,61,60,58,56,54,52,49,47,44,41,36,32],
  [100,90,83,77,71,66,62,59,55,52,50,47,44,41,37,33,28,22,17,9,-1],
  [100,90,82,74,68,62,57,52,47,43,40,36,31,26,21,13,5,-5,-15,-25,-35],
  [100,90,81,73,65,59,52,46,39,35,30,24,19,11,2,-8,-18,-28,-38,-48,-58],
  [100,90,81,71,63,55,47,39,33,26,20,13,4,-6,-16,-26,-36,-46,-56,-66,-76],
  [100,90,80,70,61,52,43,35,26,17,10,1,-9,-19,-29,-39,-49,-59,-69,-79,-89],
  [100,90,80,70,60,50,40,30,20,10,0,-10,-20,-30,-40,-49,-60,-70,-80,-90,-100],
  [100,89,79,68,58,47,36,24,13,1,-10,-19,-30,-40,-50,-60,-70,-79,-89,-99,-100],
  [100,89,79,67,56,44,31,19,4,-9,-20,-30,-40,-50,-60,-70,-79,-90,-99,-100,-100],
  [100,89,78,66,54,41,26,11,-6,-19,-30,-40,-50,-59,-70,-79,-89,-99,-100,-100,-100],
  [100,89,78,65,52,37,21,2,-16,-29,-40,-50,-60,-70,-79,-90,-99,-100,-100,-100,-100],
  [100,89,77,64,49,33,13,-8,-26,-39,-49,-60,-70,-79,-90,-99,-100,-100,-100,-100,-100],
  [100,89,77,62,47,28,5,-18,-36,-49,-60,-70,-79,-89,-99,-100,-100,-100,-100,-100,-100],
  [100,89,76,61,44,22,-5,-28,-46,-59,-70,-79,-90,-99,-100,-100,-100,-100,-100,-100,-100],
  [100,88,76,59,41,17,-15,-38,-56,-69,-80,-89,-99,-100,-100,-100,-100,-100,-100,-100,-100],
  [100,88,75,58,36,9,-25,-48,-66,-79,-90,-99,-100,-100,-100,-100,-100,-100,-100,-100,-100],
  [100,88,74,56,32,-1,-35,-58,-76,-89,-100,-100,-100,-100,-100,-100,-100,-100,-100,-100,-100],
];
const SAT_GRID = SAT_GRID_RAW.slice().reverse().map(r => r.slice().reverse().map(v => v / 100));
function satInterp(x: number, y: number) {
  const fx = (clamp(x, -1, 1) + 1) * 10, fy = (clamp(y, -1, 1) + 1) * 10;
  const i = Math.min(19, Math.floor(fx)), j = Math.min(19, Math.floor(fy)), tx = fx - i, ty = fy - j;
  return (SAT_GRID[i][j] * (1 - tx) + SAT_GRID[i + 1][j] * tx) * (1 - ty) + (SAT_GRID[i][j + 1] * (1 - tx) + SAT_GRID[i + 1][j + 1] * tx) * ty;
}
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
function rangeMask(h: number, [BL, TL, TR, BR]: number[]) {
  const c = (((h - BL / 360) % 1) + 1) % 1;
  const ls = (((TL - BL) / 360) % 1 + 1) % 1, cs = (((TR - BL) / 360) % 1 + 1) % 1, rs = (((BR - BL) / 360) % 1 + 1) % 1;
  if (c >= ls && c <= cs) return 1;
  if (c < ls) return ls > 1e-9 ? c / ls : 0;
  if (c > cs && c <= rs) return rs - cs > 1e-9 ? (rs - c) / (rs - cs) : 0;
  return 0;
}

function hueSaturation(a: AdjustSpec): ColorFn | null {
  const tmp = [0, 0, 0], o = [0, 0, 0];
  if (a.colorize) {
    const z = (a.colorization ?? { hue: 0, saturation: 25, lightness: 0 }) as { hue: number; saturation: number; lightness: number };
    const H = (((z.hue / 360) % 1) + 1) % 1, S = z.saturation / 100, Lc = z.lightness / 100;
    return (c, n) => {
      for (let i = 0; i < n; i++) {
        rgb2hsl(c[i * 3], c[i * 3 + 1], c[i * 3 + 2], tmp);
        hsl2rgb(H, S, applyLightness(tmp[2], Lc), o);
        c[i * 3] = o[0]; c[i * 3 + 1] = o[1]; c[i * 3 + 2] = o[2];
      }
    };
  }
  const m = (a.master ?? { hue: 0, saturation: 0, lightness: 0 }) as { hue: number; saturation: number; lightness: number };
  const mh = m.hue / 360, ms = m.saturation / 100, ml = m.lightness / 100;
  const ranges = (['reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas'] as const)
    .map(k => a[k] as { a: number; b: number; c: number; d: number; hue: number; saturation: number; lightness: number } | undefined)
    .filter((r): r is NonNullable<typeof r> => !!r && (r.hue !== 0 || r.saturation !== 0 || r.lightness !== 0))
    .map(r => ({ rng: [r.a, r.b, r.c, r.d], h: r.hue / 360, s: r.saturation / 100, l: r.lightness / 100 }));
  if (!ranges.length && !mh && !ms && !ml) return null;
  return (c, n) => {
    for (let i = 0; i < n; i++) {
      const R = applyLightness(c[i * 3], ml), G = applyLightness(c[i * 3 + 1], ml), B = applyLightness(c[i * 3 + 2], ml);
      rgb2hsl(R, G, B, tmp);
      let [H, S, L] = tmp;
      let rh = 0, rs = 0, rl = 0;
      for (const r of ranges) {
        const mk = rangeMask(H, r.rng);
        rh += r.h * mk;
        rl = clamp(rl + r.l * mk, -1, 1);
        const contrib = r.s * (r.s > 0 ? 1 - Math.pow(1 - mk, 1.5 / (1 - r.s ** 4 + 5e-2)) : mk);
        rs = satInterp(rs, contrib);
      }
      if (rl !== 0) {
        // lightness theo dải màu áp trong HSV
        const V = L + S * Math.min(L, 1 - L);
        let SV = V > 1e-9 ? 2 * (1 - L / V) : 0;
        const V2 = rl >= 0 ? V : clamp01(V * (1 + rl * SV));
        const div = 1 / (SV + 1e-3);
        SV = clamp01(rl >= 0 ? SV * (1 - rl) : 1 + (div - 1) / (Math.abs(rl) - div + 1e-3));
        L = V2 * (1 - SV / 2);
        const den = Math.min(L, 1 - L);
        S = den > 1e-9 ? (V2 - L) / den : 0;
      }
      H = (((H + rh + mh) % 1) + 1) % 1;
      S = applySat(applySat(S, ms), rs);
      hsl2rgb(H, S, L, o);
      c[i * 3] = o[0]; c[i * 3 + 1] = o[1]; c[i * 3 + 2] = o[2];
    }
  };
}

function brightnessContrast(a: AdjustSpec): ColorFn | null {
  const br = Number(a.brightness ?? 0), ct = Number(a.contrast ?? 0);
  if (!br && !ct) return null;
  if (a.useLegacy) {
    const shift = br / 255, piv = 127 / 255;
    const L = lutFrom(t => (ct > 0 ? (t + shift - piv) * (100 / Math.max(100 - ct, 1e-9)) + piv : (t - piv) * ((100 + ct) / 100) + piv + shift));
    return lutFn([L]);
  }
  const b = br / 150, c = ct / 100;
  const cx = [0, 63 / 255, 191 / 255, 1], d = 25 / 255;
  const cs = naturalSpline(cx, [0, cx[1] - c * d, cx[2] + c * d, 1]);
  const pol = (A: number, x: number, r: number) => A * Math.pow(x, r);
  const ba = Math.abs(b);
  const xr: number[] = [], yr: number[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const h = 0.5 * (ba * (pol(1.65, t, 0.35) + pol(-1, t, 10)) + (1 - ba) * (pol(1.96, t, 0.4) + pol(1, t, 4)) + pol(1, t, 1.25));
    const bs = b * t * (1 - t) * h;
    xr.push(t - bs); yr.push(cs(t) + bs);
  }
  const L = lutFrom(t => { // nội suy tuyến tính theo xr
    let j = 0; while (j < N - 2 && t > xr[j + 1]) j++;
    const f = (t - xr[j]) / (xr[j + 1] - xr[j] || 1);
    return yr[j] + clamp01(f) * (yr[j + 1] - yr[j]);
  });
  return lutFn([L]);
}

/** Trả về hàm biến đổi màu, hoặc null nếu không hỗ trợ / không có tác dụng. */
export function makeAdjustment(a: AdjustSpec): { fn: ColorFn | null; supported: boolean } {
  switch (a.type) {
    case 'invert': return { fn: (c, n) => { for (let i = 0; i < n * 3; i++) c[i] = 1 - c[i]; }, supported: true };
    case 'posterize': {
      const lv = clamp(Math.round(Number(a.levels ?? 4)), 2, 255), cf = (N - 1) / N;
      return { fn: (c, n) => { for (let i = 0; i < n * 3; i++) c[i] = Math.floor(cf * c[i] * lv) / (lv - 1); }, supported: true };
    }
    case 'threshold': {
      const th = (Number(a.level ?? 128) - 1 / 255) * ((N - 1) / N);
      return { fn: (c, n) => { for (let i = 0; i < n; i++) { const l = Math.round((0.3 * c[i * 3] + 0.59 * c[i * 3 + 1] + 0.11 * c[i * 3 + 2]) * 255); const v = l > th ? 1 : 0; c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v; } }, supported: true };
    }
    case 'levels': {
      const ch = (a.channels ?? []) as { shadowInput: number; highlightInput: number; shadowOutput: number; highlightOutput: number; midtoneInput: number }[];
      const luts = ch.slice(0, 4).map(q => {
        const ib = q.shadowInput / 255, iw = q.highlightInput / 255, ob = q.shadowOutput / 255, ow = q.highlightOutput / 255;
        // ag-psd đã quy midtoneInput về gamma (1 = trung tính)
        const gm = clamp(q.midtoneInput, 0.01, 9.99), sc = Math.abs(iw - ib) > 1e-9 ? iw - ib : 1;
        return lutFrom(t => clamp01(Math.pow(clamp01((t - ib) / sc), 1 / gm)) * (ow - ob) + ob);
      });
      return { fn: luts.length ? lutFn(luts) : null, supported: true };
    }
    case 'curves': {
      const ch = (a.channels ?? []) as ({ input: number; output: number }[] | undefined)[];
      const luts = ch.slice(0, 4).map(pts => {
        if (!pts || pts.length < 2) return undefined;
        const xs = pts.map(p => p.input / 255), ys = pts.map(p => p.output / 255);
        const f = naturalSpline(xs, ys);
        return lutFrom(t => f(clamp(t, xs[0], xs[xs.length - 1])));
      });
      return { fn: luts.some(Boolean) ? lutFn(luts) : null, supported: true };
    }
    case 'exposure': {
      const ex = Number(a.exposure ?? 0), off = Number(a.offset ?? 0), gm = clamp(Number(a.gamma ?? 1), 0.01, 9.99), cg = 2.2;
      const L = lutFrom(t => Math.pow(Math.pow(clamp01(Math.pow(t, cg) * 2 ** ex + off), 1 / gm), 1 / cg));
      return { fn: lutFn([L]), supported: true };
    }
    case 'brightness/contrast': return { fn: brightnessContrast(a), supported: true };
    case 'hue/saturation': return { fn: hueSaturation(a), supported: true };
    default: return { fn: null, supported: false };
  }
}

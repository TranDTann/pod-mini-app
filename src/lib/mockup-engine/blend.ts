// Công thức blend mode (giá trị kênh 0..1, đã mã hoá gamma — Photoshop mặc định blend trong không gian
// màu của tài liệu, KHÔNG tuyến tính hoá). b = backdrop (lớp dưới), s = source (lớp trên).
//
// Mô hình ghép (W3C Compositing, trùng với Photoshop cho các mode tách kênh):
//   αo = αs + αb·(1 − αs)
//   co = αs·(1 − αb)·Cs + αs·αb·B(Cb, Cs) + (1 − αs)·αb·Cb            (co premultiplied)

import type { BlendMode } from './types';

export type SepFn = (b: number, s: number) => number;

const cl = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const E = 1e-5; // dung sai làm tròn float (premultiplied → straight)
const colorDodge: SepFn = (b, s) => (b <= E ? 0 : s >= 1 - E ? 1 : Math.min(1, b / (1 - s)));
const colorBurn: SepFn = (b, s) => (b >= 1 - E ? 1 : s <= E ? 0 : 1 - Math.min(1, (1 - b) / s));
// Vivid Light của Photoshop: ở 2 đầu (s = 0 / s = 1) ưu tiên s (khác Color Burn/Dodge đứng riêng) — kiểm chứng bằng file mẫu
const vivid: SepFn = (b, s) => (s <= E ? 0 : s >= 1 - E ? 1 : s <= 0.5 ? colorBurn(b, 2 * s) : colorDodge(b, 2 * s - 1));
// Hard Mix của Photoshop = ngưỡng 0.5 của Vivid Light dùng quy ước Burn/Dodge thường (không phải "b + s ≥ 1" như tài liệu)
const vividW3C: SepFn = (b, s) => (s <= 0.5 ? colorBurn(b, 2 * s) : colorDodge(b, 2 * s - 1));

export const SEPARABLE: Partial<Record<BlendMode, SepFn>> = {
  normal: (_b, s) => s,
  darken: (b, s) => Math.min(b, s),
  multiply: (b, s) => b * s,
  'color burn': colorBurn,
  'linear burn': (b, s) => cl(b + s - 1),
  lighten: (b, s) => Math.max(b, s),
  screen: (b, s) => b + s - b * s,
  'color dodge': colorDodge,
  'linear dodge': (b, s) => cl(b + s),
  overlay: (b, s) => (b <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s)),
  // Soft Light của Photoshop (khác bản W3C/PDF)
  'soft light': (b, s) => (s <= 0.5 ? 2 * b * s + b * b * (1 - 2 * s) : 2 * b * (1 - s) + Math.sqrt(b) * (2 * s - 1)),
  'hard light': (b, s) => (s <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s)),
  'vivid light': vivid,
  'linear light': (b, s) => cl(b + 2 * s - 1),
  'pin light': (b, s) => (s <= 0.5 ? Math.min(b, 2 * s) : Math.max(b, 2 * s - 1)),
  'hard mix': (b, s) => (vividW3C(b, s) >= 0.5 ? 1 : 0),
  difference: (b, s) => Math.abs(b - s),
  exclusion: (b, s) => b + s - 2 * b * s,
  subtract: (b, s) => cl(b - s),
  divide: (b, s) => (s <= E ? (b <= E ? 0 : 1) : Math.min(1, b / s)),
};

// --- mode không tách kênh (Hue/Saturation/Color/Luminosity, Darker/Lighter Color) ---
const lum = (r: number, g: number, b: number) => 0.3 * r + 0.59 * g + 0.11 * b;
function clipColor(c: number[]) {
  const l = lum(c[0], c[1], c[2]), n = Math.min(c[0], c[1], c[2]), x = Math.max(c[0], c[1], c[2]);
  if (n < 0) for (let i = 0; i < 3; i++) c[i] = l + ((c[i] - l) * l) / (l - n);
  if (x > 1) for (let i = 0; i < 3; i++) c[i] = l + ((c[i] - l) * (1 - l)) / (x - l);
  return c;
}
const setLum = (c: number[], l: number) => { const d = l - lum(c[0], c[1], c[2]); return clipColor([c[0] + d, c[1] + d, c[2] + d]); };
const sat = (c: number[]) => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
function setSat(c: number[], s: number) {
  const idx = [0, 1, 2].sort((a, b) => c[a] - c[b]);
  const out = [0, 0, 0];
  const [mn, md, mx] = idx;
  if (c[mx] > c[mn]) { out[md] = ((c[md] - c[mn]) * s) / (c[mx] - c[mn]); out[mx] = s; }
  out[mn] = 0;
  return out;
}

/** Trả B(Cb, Cs) cho cả 3 kênh vào `o`. */
export function blendPixel(mode: BlendMode, b: number[], s: number[], o: number[]) {
  const f = SEPARABLE[mode];
  if (f) { o[0] = f(b[0], s[0]); o[1] = f(b[1], s[1]); o[2] = f(b[2], s[2]); return; }
  let r: number[];
  switch (mode) {
    case 'hue': r = setLum(setSat(s, sat(b)), lum(b[0], b[1], b[2])); break;
    case 'saturation': r = setLum(setSat(b, sat(s)), lum(b[0], b[1], b[2])); break;
    case 'color': r = setLum(s, lum(b[0], b[1], b[2])); break;
    case 'luminosity': r = setLum(b, lum(s[0], s[1], s[2])); break;
    case 'darker color': r = lum(s[0], s[1], s[2]) < lum(b[0], b[1], b[2]) ? s : b; break;
    case 'lighter color': r = lum(s[0], s[1], s[2]) > lum(b[0], b[1], b[2]) ? s : b; break;
    default: r = s; // normal / dissolve (dissolve: xấp xỉ bằng normal)
  }
  o[0] = r[0]; o[1] = r[1]; o[2] = r[2];
}

/** 8 mode mà Photoshop xử lý Fill Opacity khác Opacity. */
export const SPECIAL_FILL_MODES: BlendMode[] = ['color burn', 'linear burn', 'color dodge', 'linear dodge', 'vivid light', 'linear light', 'hard mix', 'difference'];

/**
 * Với 8 mode đặc biệt, Photoshop áp Fill Opacity TRƯỚC khi kẹp [0,1]: kết quả = clamp(Cb + fill·(B_chưa_kẹp − Cb)).
 * (Kiểm chứng bằng file mẫu Photoshop: Linear Light, Fill 20% → khớp đúng giá trị pixel.)
 */
export const UNCLAMPED: Partial<Record<BlendMode, SepFn>> = {
  'color burn': (b, s) => (b >= 1 ? 1 : s <= 0 ? -1e3 : 1 - (1 - b) / s),
  'linear burn': (b, s) => b + s - 1,
  'color dodge': (b, s) => (b <= 0 ? 0 : s >= 1 ? 1e3 : b / (1 - s)),
  'linear dodge': (b, s) => b + s,
  'vivid light': (b, s) => (s <= 0.5 ? (b >= 1 ? 1 : s <= 0 ? -1e3 : 1 - (1 - b) / (2 * s)) : (b <= 0 ? 0 : s >= 1 ? 1e3 : b / (2 - 2 * s))),
  'linear light': (b, s) => b + 2 * s - 1,
};
